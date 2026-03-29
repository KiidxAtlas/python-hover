import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { DiskCache } from '../../docs-engine/src/cache/diskCache';
import { SymbolInfo } from '../../shared/types';
import { Logger } from './logger';

interface PendingRequest {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    timer: ReturnType<typeof setTimeout>;
}

/**
 * Manages a single persistent Python subprocess that handles all IPC requests.
 * Replaces the old spawn-per-hover model — eliminates 100–300ms startup cost per call.
 *
 * Protocol: newline-delimited JSON over stdin/stdout.
 *   Request:  {"id": N, "cmd": "resolve"|"identify"|"version_info", ...args}
 *   Response: {"id": N, "result": ...} | {"id": N, "error": "..."}
 */
class PythonProcess {
    private proc: cp.ChildProcess | null = null;
    private pending = new Map<number, PendingRequest>();
    private nextId = 0;
    private buffer = '';
    private dead = false;

    constructor(
        private readonly pythonPath: string,
        private readonly helperPath: string,
    ) {}

    start(): void {
        if (this.proc) return;
        this.dead = false;
        this.buffer = '';

        try {
            this.proc = cp.spawn(this.pythonPath, [this.helperPath, '--server'], {
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            this.proc.stdout!.on('data', (chunk: Buffer) => this.onData(chunk.toString()));

            this.proc.stderr!.on('data', (data: Buffer) => {
                const msg = data.toString().trim();
                if (msg) Logger.log(`[PythonProcess stderr] ${msg}`);
            });

            this.proc.on('error', (err) => {
                Logger.error('PythonProcess spawn error', err);
                this.handleDeath();
            });

            this.proc.on('close', (code) => {
                Logger.log(`PythonProcess closed (code=${code})`);
                this.handleDeath();
            });
        } catch (err) {
            Logger.error('Failed to start PythonProcess', err);
            this.proc = null;
            this.dead = true;
        }
    }

    private onData(chunk: string): void {
        this.buffer += chunk;
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop()!; // keep incomplete trailing line

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
                const msg = JSON.parse(trimmed);
                const pending = this.pending.get(msg.id);
                if (!pending) continue;
                this.pending.delete(msg.id);
                clearTimeout(pending.timer);
                if (msg.error) {
                    pending.reject(new Error(msg.error));
                } else {
                    pending.resolve(msg.result);
                }
            } catch (e) {
                Logger.error('PythonProcess failed to parse response line', e);
            }
        }
    }

    private handleDeath(): void {
        this.dead = true;
        this.proc = null;
        // Reject all pending requests
        for (const [id, pending] of this.pending) {
            clearTimeout(pending.timer);
            pending.reject(new Error('Python process died'));
            this.pending.delete(id);
        }
    }

    send(cmd: Record<string, any>, timeoutMs: number): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.proc || this.dead) {
                reject(new Error('Python process not running'));
                return;
            }

            const id = this.nextId++;
            const timer = setTimeout(() => {
                if (this.pending.has(id)) {
                    this.pending.delete(id);
                    reject(new Error(`Python IPC timeout (cmd=${cmd.cmd})`));
                }
            }, timeoutMs);

            this.pending.set(id, { resolve, reject, timer });

            try {
                this.proc.stdin!.write(JSON.stringify({ id, ...cmd }) + '\n');
            } catch (e) {
                clearTimeout(timer);
                this.pending.delete(id);
                reject(e);
            }
        });
    }

    isAlive(): boolean {
        return !this.dead && this.proc !== null;
    }

    dispose(): void {
        if (this.proc) {
            try { this.proc.kill(); } catch { /* ignore */ }
        }
        this.handleDeath();
    }
}

// ─────────────────────────────────────────────────────────────────────────────

export interface PythonHelperOptions {
    /** When false, no persistent server — version probe only; no imports or AST IPC. */
    enablePersistentRuntime?: boolean;
    /** Segments disk/runtime cache keys per interpreter configuration. */
    interpreterCacheId?: string;
}

export class PythonHelper {
    private pythonPath: string;
    private helperPath: string;
    private diskCache: DiskCache;
    private readonly enablePersistentRuntime: boolean;
    private readonly interpreterCacheId: string;

    /** Resolved interpreter path — determined once and cached. */
    private resolvedPath?: Promise<string | null>;

    /** The single persistent server process — started on first use. */
    private process: PythonProcess | null = null;

    /** Per-session in-memory cache: symbol → SymbolInfo. Avoids re-calling Python for
     *  the same symbol within a single VS Code session. Keyed by the fully-qualified
     *  symbol name so different documents sharing the same symbol hit the same entry.
     *  Capped at 1 000 entries — oldest evicted when full. */
    private sessionCache = new Map<string, SymbolInfo | null>();
    private static readonly SESSION_CACHE_MAX = 1_000;

    private hasShownMissingPythonNotification = false;

    constructor(
        pythonPath: string = 'python',
        diskCache: DiskCache,
        options: PythonHelperOptions = {},
    ) {
        this.pythonPath = pythonPath;
        this.diskCache = diskCache;
        this.enablePersistentRuntime = options.enablePersistentRuntime ?? false;
        this.interpreterCacheId = options.interpreterCacheId ?? 'default';
        // Running from out/extension/src/pythonHelper.js
        // python-helper is at extension/python-helper/ → 3 levels up + into python-helper
        this.helperPath = path.resolve(__dirname, '../../../python-helper/helper.py');
    }

    // ─── Interpreter resolution ───────────────────────────────────────────────

    private looksLikeWindowsPath(p: string): boolean {
        return /^[a-zA-Z]:[\\/]/.test(p) || /^\\\\/.test(p);
    }

    private looksLikePosixPath(p: string): boolean {
        return p.startsWith('/');
    }

    private isProbablyIncompatibleWithHost(p: string): boolean {
        if (!p) return true;
        if (process.platform !== 'win32' && this.looksLikeWindowsPath(p)) return true;
        if (process.platform === 'win32' && this.looksLikePosixPath(p)) return true;
        return false;
    }

    private isPathLikeAbsolute(p: string): boolean {
        return path.isAbsolute(p) || this.looksLikeWindowsPath(p) || this.looksLikePosixPath(p);
    }

    private getCandidateInterpreters(): string[] {
        const candidates: string[] = [];
        if (this.pythonPath) candidates.push(this.pythonPath);
        if (process.platform === 'win32') {
            candidates.push('python', 'py');
        } else {
            candidates.push('python3', 'python');
        }
        return [...new Set(candidates.filter(Boolean))];
    }

    private canRunInterpreter(interpreter: string): Promise<boolean> {
        return new Promise((resolve) => {
            const proc = cp.spawn(interpreter, ['-c', 'import sys; print(sys.executable)'], {
                stdio: ['ignore', 'pipe', 'ignore'],
            });
            let done = false;
            const timeout = setTimeout(() => {
                if (done) return;
                done = true;
                try { proc.kill(); } catch { /* ignore */ }
                resolve(false);
            }, 1200);
            proc.on('error', () => { if (!done) { done = true; clearTimeout(timeout); resolve(false); } });
            proc.on('close', (code) => { if (!done) { done = true; clearTimeout(timeout); resolve(code === 0); } });
        });
    }

    private async ensurePythonPathResolved(): Promise<string | null> {
        if (this.resolvedPath) return this.resolvedPath;

        this.resolvedPath = (async () => {
            const candidates = this.getCandidateInterpreters();

            for (const candidate of candidates) {
                if (this.isProbablyIncompatibleWithHost(candidate)) {
                    Logger.log(`PythonHelper: skipping incompatible path: ${candidate}`);
                    continue;
                }
                if (this.isPathLikeAbsolute(candidate) && !fs.existsSync(candidate)) {
                    Logger.log(`PythonHelper: path does not exist: ${candidate}`);
                    continue;
                }
                if (await this.canRunInterpreter(candidate)) {
                    if (candidate !== this.pythonPath) {
                        Logger.log(`PythonHelper: using fallback interpreter: ${candidate}`);
                    }
                    this.pythonPath = candidate;
                    return candidate;
                }
            }

            Logger.error(`PythonHelper: no usable Python interpreter. Tried: ${candidates.join(', ')}`);
            return null;
        })();

        return this.resolvedPath;
    }

    // ─── Process lifecycle ────────────────────────────────────────────────────

    private async getProcess(): Promise<PythonProcess | null> {
        if (!this.enablePersistentRuntime) {
            return null;
        }

        const pythonPath = await this.ensurePythonPathResolved();
        if (!pythonPath) {
            if (!this.hasShownMissingPythonNotification) {
                this.hasShownMissingPythonNotification = true;
                // Show actionable notification with a button to select interpreter
                vscode.window.showWarningMessage(
                    'PyHover: No Python interpreter found. Runtime documentation will be limited.',
                    'Select Interpreter'
                ).then(action => {
                    if (action === 'Select Interpreter') {
                        vscode.commands.executeCommand('python.selectInterpreter');
                    }
                });
            }
            return null;
        }

        // Start process if not running
        if (!this.process || !this.process.isAlive()) {
            Logger.log(`PythonHelper: starting persistent server with ${pythonPath}`);
            this.process = new PythonProcess(pythonPath, this.helperPath);
            this.process.start();
        }

        return this.process;
    }

    private async send(cmd: Record<string, any>, timeoutMs = 3000): Promise<any> {
        const proc = await this.getProcess();
        if (!proc) return null;

        try {
            return await proc.send(cmd, timeoutMs);
        } catch (e) {
            Logger.error(`PythonHelper IPC error (${cmd.cmd})`, e);

            // If the process died mid-request, clear it so next call restarts
            if (this.process && !this.process.isAlive()) {
                this.process = null;
            }
            return null;
        }
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    async resolveRuntime(symbol: string): Promise<SymbolInfo | null> {
        if (!this.enablePersistentRuntime) {
            return null;
        }

        // 1. Session cache (in-memory — instant)
        if (this.sessionCache.has(symbol)) {
            return this.sessionCache.get(symbol) ?? null;
        }

        // 2. Disk cache (persistent across sessions)
        const cacheKey = `runtime:${this.interpreterCacheId}:${symbol}`;
        const cached = this.diskCache.get(cacheKey);
        if (cached) {
            try {
                const info = JSON.parse(cached) as SymbolInfo;
                this.sessionCache.set(symbol, info);
                return info;
            } catch (e) {
                Logger.error(`PythonHelper: failed to parse cached data for ${symbol}`, e);
            }
        }

        // 3. IPC call to persistent server
        Logger.log(`PythonHelper: resolving ${symbol} via IPC`);
        const result = await this.send({ cmd: 'resolve', symbol });

        if (!result || result.error) {
            Logger.log(`PythonHelper: resolve failed for ${symbol}: ${result?.error}`);
            if (this.sessionCache.size >= PythonHelper.SESSION_CACHE_MAX) {
                const oldest = this.sessionCache.keys().next().value;
                if (oldest !== undefined) this.sessionCache.delete(oldest);
            }
            this.sessionCache.set(symbol, null);
            return null;
        }

        const info: SymbolInfo = {
            name: symbol.split('.').pop() || symbol,
            module: result.module,
            docstring: result.docstring,
            signature: result.signature,
            path: result.module,
            isStdlib: result.is_stdlib,
            qualname: result.qualname,
            kind: result.kind,
        };

        // Evict oldest entry if the cap is reached.
        if (this.sessionCache.size >= PythonHelper.SESSION_CACHE_MAX) {
            const oldest = this.sessionCache.keys().next().value;
            if (oldest !== undefined) this.sessionCache.delete(oldest);
        }
        this.sessionCache.set(symbol, info);
        this.diskCache.set(cacheKey, JSON.stringify(info));
        return info;
    }

    async identify(source: string, line: number, column: number): Promise<string | null> {
        if (!this.enablePersistentRuntime) {
            return null;
        }
        const result = await this.send({ cmd: 'identify', source, line, col: column }, 1000);
        return result?.type ?? null;
    }

    /**
     * Extract the docstring and signature for a local user-defined symbol
     * directly from source code via AST (no import needed).
     */
    async getLocalDocstring(source: string, symbol: string): Promise<SymbolInfo | null> {
        if (!this.enablePersistentRuntime) {
            return null;
        }
        const result = await this.send({ cmd: 'get_docstring', source, symbol }, 2000);
        if (!result || result.error) return null;
        return {
            name: symbol,
            module: result.module ?? 'user',
            docstring: result.docstring,
            signature: result.signature,
            kind: result.kind,
            isStdlib: false,
            qualname: result.qualname,
        };
    }

    async getInstalledSourceSymbol(
        filePath: string,
        candidates: string[],
        moduleName?: string,
    ): Promise<SymbolInfo | null> {
        if (!this.enablePersistentRuntime || !filePath || candidates.length === 0) {
            return null;
        }

        const result = await this.send({
            cmd: 'resolve_source_symbol',
            file_path: filePath,
            candidates,
            module: moduleName,
        }, 2500);

        if (!result || result.error) return null;

        return {
            name: candidates[0],
            module: result.module,
            docstring: result.docstring,
            signature: result.signature,
            path: filePath,
            isStdlib: result.is_stdlib,
            qualname: result.qualname,
            kind: result.kind,
        };
    }

    async getPythonVersion(): Promise<string> {
        if (!this.enablePersistentRuntime) {
            return this.probePythonVersionMinor();
        }
        const result = await this.send({ cmd: 'version_info' }, 2000);
        return result?.version ?? '3';
    }

    /**
     * One-shot interpreter probe — no persistent process (used when runtimeHelper is off).
     */
    async probePythonVersionMinor(): Promise<string> {
        const exe = await this.ensurePythonPathResolved();
        if (!exe) {
            return '3';
        }

        return new Promise((resolve) => {
            const proc = cp.spawn(
                exe,
                ['-c', 'import sys; print(f"{sys.version_info[0]}.{sys.version_info[1]}")'],
                { stdio: ['ignore', 'pipe', 'ignore'] },
            );
            let out = '';
            let settled = false;
            const done = (v: string) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(v);
            };
            const timer = setTimeout(() => done('3'), 2000);
            proc.stdout?.on('data', (d: Buffer) => { out += d.toString(); });
            proc.on('error', () => done('3'));
            proc.on('close', (code) => {
                if (code !== 0) {
                    done('3');
                    return;
                }
                const v = out.trim();
                done(/^\d+\.\d+$/.test(v) ? v : '3');
            });
        });
    }

    /**
     * Returns the installed version string for a package (e.g. "1.26.4" for numpy),
     * using `importlib.metadata.version()` in the active Python environment.
     * Returns null if the package is not installed or the lookup fails.
     */
    async getInstalledVersion(packageName: string): Promise<string | null> {
        if (!this.enablePersistentRuntime) {
            return null;
        }
        const result = await this.send({ cmd: 'pkg_version', package: packageName }, 1500);
        return result?.version ?? null;
    }

    /** Clear session cache (e.g. when a document is saved and symbols may change). */
    clearSessionCache(): void {
        this.sessionCache.clear();
    }

    dispose(): void {
        if (this.process) {
            this.process.dispose();
            this.process = null;
        }
    }
}
