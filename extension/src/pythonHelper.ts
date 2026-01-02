import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { DiskCache } from '../../docs-engine/src/cache/diskCache';
import { SymbolInfo } from '../../shared/types';
import { Logger } from './logger';

export class PythonHelper {
    private pythonPath: string;
    private helperPath: string;
    private diskCache: DiskCache;
    private resolvedPythonPath?: Promise<string | null>;
    private hasShownMissingPythonLog = false;

    constructor(pythonPath: string = 'python', diskCache: DiskCache) {
        this.pythonPath = pythonPath;
        this.diskCache = diskCache;
        // Running from out/extension/src/pythonHelper.js
        // python-helper is at extension/python-helper/
        // Path: out/extension/src -> out/extension -> out -> extension (3 levels up, then into python-helper)
        this.helperPath = path.resolve(__dirname, '../../../python-helper/helper.py');
    }

    private looksLikeWindowsPath(p: string): boolean {
        return /^[a-zA-Z]:[\\/]/.test(p) || /^\\\\/.test(p);
    }

    private looksLikePosixPath(p: string): boolean {
        return p.startsWith('/');
    }

    private isProbablyIncompatibleWithHost(p: string): boolean {
        if (!p) return true;

        // If the extension host is Linux/macOS (including WSL/SSH remotes),
        // don't try to spawn a Windows-style interpreter path.
        if (process.platform !== 'win32' && this.looksLikeWindowsPath(p)) {
            return true;
        }

        // If the extension host is Windows, don't try to spawn a POSIX path.
        if (process.platform === 'win32' && this.looksLikePosixPath(p)) {
            return true;
        }

        return false;
    }

    private isPathLikeAbsolute(p: string): boolean {
        return path.isAbsolute(p) || this.looksLikeWindowsPath(p) || this.looksLikePosixPath(p);
    }

    private getCandidateInterpreters(): string[] {
        const candidates: string[] = [];
        if (this.pythonPath) candidates.push(this.pythonPath);

        // Reasonable fallbacks per platform.
        if (process.platform === 'win32') {
            candidates.push('python');
            candidates.push('py');
        } else {
            candidates.push('python3');
            candidates.push('python');
        }

        // De-duplicate while preserving order.
        return [...new Set(candidates.filter(Boolean))];
    }

    private async canRunInterpreter(interpreter: string): Promise<boolean> {
        return new Promise((resolve) => {
            const proc = cp.spawn(interpreter, ['-c', 'import sys; print(sys.executable)'], {
                stdio: ['ignore', 'pipe', 'ignore']
            });

            let done = false;
            const timeout = setTimeout(() => {
                if (done) return;
                done = true;
                try {
                    proc.kill();
                } catch {
                    // ignore
                }
                resolve(false);
            }, 1200);

            proc.on('error', () => {
                if (done) return;
                done = true;
                clearTimeout(timeout);
                resolve(false);
            });

            proc.on('close', (code) => {
                if (done) return;
                done = true;
                clearTimeout(timeout);
                resolve(code === 0);
            });
        });
    }

    private async ensurePythonPathResolved(): Promise<string | null> {
        if (this.resolvedPythonPath) return this.resolvedPythonPath;

        this.resolvedPythonPath = (async () => {
            const candidates = this.getCandidateInterpreters();

            for (const candidate of candidates) {
                if (this.isProbablyIncompatibleWithHost(candidate)) {
                    Logger.log(`PythonHelper: ignoring incompatible interpreter path: ${candidate}`);
                    continue;
                }

                // If it's a concrete path, require it to exist.
                if (this.isPathLikeAbsolute(candidate)) {
                    // Windows paths on non-Windows hosts are already filtered by incompatibility checks.
                    if (!fs.existsSync(candidate)) {
                        Logger.log(`PythonHelper: interpreter path does not exist: ${candidate}`);
                        continue;
                    }
                }

                if (await this.canRunInterpreter(candidate)) {
                    if (candidate !== this.pythonPath) {
                        Logger.log(`PythonHelper: using fallback interpreter: ${candidate}`);
                    }
                    this.pythonPath = candidate;
                    return candidate;
                }
            }

            Logger.error(
                `PythonHelper: no usable Python interpreter found. Tried: ${candidates.join(', ')}`
            );
            return null;
        })();

        return this.resolvedPythonPath;
    }

    async resolveRuntime(symbol: string): Promise<SymbolInfo | null> {
        const cacheKey = `runtime:${symbol}`;
        const cached = this.diskCache.get(cacheKey);
        if (cached) {
            try {
                const info = JSON.parse(cached);
                // Logger.log(`PythonHelper: Cache hit for ${symbol}`);
                return info;
            } catch (e) {
                Logger.error(`PythonHelper: Failed to parse cached data for ${symbol}`, e);
            }
        }

        const pythonPath = await this.ensurePythonPathResolved();
        if (!pythonPath) {
            if (!this.hasShownMissingPythonLog) {
                this.hasShownMissingPythonLog = true;
                Logger.error(
                    'PythonHelper: skipping runtime resolution because no usable Python interpreter was found on this host.'
                );
            }
            return null;
        }

        Logger.log(`PythonHelper: resolving ${symbol} using ${pythonPath} and ${this.helperPath}`);
        return new Promise((resolve) => {
            const args = [this.helperPath, '--resolve', symbol];

            const process = cp.spawn(pythonPath, args);

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('error', (err) => {
                Logger.error('PythonHelper spawn error:', err);
                clearTimeout(timeout);
                resolve(null);
            });

            process.on('close', (code) => {
                clearTimeout(timeout);
                if (code !== 0) {
                    Logger.error(`Python helper exited with code ${code}: ${stderr}`);
                    resolve(null);
                    return;
                }
                Logger.log('PythonHelper stdout:', stdout);

                try {
                    const result = JSON.parse(stdout);
                    if (result.error) {
                        Logger.log(`Python helper error: ${result.error}`);
                        resolve(null);
                    } else {
                        const info: SymbolInfo = {
                            name: symbol.split('.').pop() || symbol,
                            module: result.module,
                            docstring: result.docstring,
                            signature: result.signature,
                            path: result.module, // Using module as path for now
                            isStdlib: result.is_stdlib,
                            qualname: result.qualname,
                            kind: result.kind
                        };
                        this.diskCache.set(cacheKey, JSON.stringify(info));
                        resolve(info);
                    }
                } catch (e) {
                    Logger.error('Failed to parse Python helper output:', e);
                    resolve(null);
                }
            });

            // Timeout
            const timeout = setTimeout(() => {
                if (!process.killed) {
                    process.kill();
                    Logger.error(`PythonHelper timed out resolving ${symbol}`);
                    resolve(null);
                }
            }, 3000);
        });
    }

    async identify(source: string, line: number, column: number): Promise<string | null> {
        const pythonPath = await this.ensurePythonPathResolved();
        if (!pythonPath) {
            return null;
        }
        return new Promise((resolve) => {
            const args = [
                this.helperPath,
                '--identify',
                '--file', '-',  // Tell helper to read from stdin
                '--line', line.toString(),
                '--column', column.toString()
            ];

            const process = cp.spawn(pythonPath, args);
            let stdout = '';

            process.stdout.on('data', (data) => stdout += data.toString());

            process.on('close', (code) => {
                clearTimeout(timeout);
                if (code !== 0) {
                    resolve(null);
                    return;
                }
                try {
                    const result = JSON.parse(stdout);
                    resolve(result.type || null);
                } catch (e) {
                    resolve(null);
                }
            });

            process.on('error', () => {
                clearTimeout(timeout);
                resolve(null);
            });

            // Write source to stdin
            process.stdin.write(source);
            process.stdin.end();

            // Timeout
            const timeout = setTimeout(() => {
                if (!process.killed) {
                    process.kill();
                    resolve(null);
                }
            }, 2000);
        });
    }


    async getPythonVersion(): Promise<string> {
        const pythonPath = await this.ensurePythonPathResolved();
        if (!pythonPath) {
            return '3';
        }
        return new Promise((resolve) => {
            const args = [this.helperPath, '--version-info'];
            const process = cp.spawn(pythonPath, args);
            let stdout = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.on('close', (code) => {
                clearTimeout(timeout);
                if (code === 0) {
                    try {
                        const result = JSON.parse(stdout);
                        resolve(result.version); // e.g. "3.11"
                    } catch (e) {
                        resolve('3'); // Fallback
                    }
                } else {
                    resolve('3'); // Fallback
                }
            });

            process.on('error', () => {
                clearTimeout(timeout);
                resolve('3');
            });

            // Timeout
            const timeout = setTimeout(() => {
                if (!process.killed) {
                    process.kill();
                    resolve('3');
                }
            }, 2000);
        });
    }

    dispose() {
        // Nothing to dispose for spawn
    }
}
