import * as vscode from 'vscode';
import { LspSymbol } from '../../shared/types';

const LSP_TIMEOUT_MS = 2000;
const RESOLVED_SYMBOL_CACHE_TTL_MS = 4000;
const DOCUMENT_SYMBOL_CACHE_TTL_MS = 15000;
const HOVER_QUERY_CACHE_TTL_MS = 4000;
const MAX_CACHE_ENTRIES = 256;

const BUILTIN_TYPES = new Set([
    'str', 'list', 'dict', 'set', 'tuple', 'int', 'float',
    'bytes', 'bytearray', 'frozenset', 'complex', 'bool', 'object',
]);

export class LspClient {
    private static internalHoverRequests = new Map<string, number>();
    private readonly resolvedSymbolCache = new Map<string, { expiresAt: number; value: LspSymbol | null }>();
    private readonly inflightResolvedSymbols = new Map<string, Promise<LspSymbol | null>>();
    private readonly documentSymbolCache = new Map<string, { expiresAt: number; value: vscode.DocumentSymbol[] | undefined }>();
    private readonly inflightDocumentSymbols = new Map<string, Promise<vscode.DocumentSymbol[] | undefined>>();
    private readonly hoverQueryCache = new Map<string, { expiresAt: number; value: vscode.Hover[] | undefined }>();
    private readonly inflightHoverQueries = new Map<string, Promise<vscode.Hover[] | undefined>>();

    static isInternalHoverRequest(uri: vscode.Uri, position: vscode.Position): boolean {
        const key = this.hoverRequestKey(uri, position);
        return (this.internalHoverRequests.get(key) ?? 0) > 0;
    }

    private static hoverRequestKey(uri: vscode.Uri, position: vscode.Position): string {
        return `${uri.toString()}:${position.line}:${position.character}`;
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    async resolveSymbol(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): Promise<LspSymbol | null> {
        const cacheKey = this.positionCacheKey(document, position);
        const cached = this.resolvedSymbolCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return this.cloneSymbol(cached.value);
        }
        if (cached) {
            this.resolvedSymbolCache.delete(cacheKey);
        }

        const inflight = this.inflightResolvedSymbols.get(cacheKey);
        if (inflight) {
            return inflight.then(value => this.cloneSymbol(value));
        }

        const resolution = this.resolveSymbolUncached(document, position);
        this.inflightResolvedSymbols.set(cacheKey, resolution);

        try {
            const result = await resolution;
            this.setCacheEntry(this.resolvedSymbolCache, cacheKey, this.cloneSymbol(result), RESOLVED_SYMBOL_CACHE_TTL_MS);
            return this.cloneSymbol(result);
        } finally {
            this.inflightResolvedSymbols.delete(cacheKey);
        }
    }

    private async resolveSymbolUncached(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): Promise<LspSymbol | null> {
        const ctx = this.buildContext(document, position);
        if (!ctx) return null;

        const { expression, segmentRange, queryChar, rightExtended } = ctx;
        // Pylance can return different definitions when the column sits on the last
        // character of a token vs the start. For a *single* identifier, always query
        // at the **start** of that token so every cursor offset inside the word agrees.
        // When we extended to `df.agg` from a hover on `df`, keep querying at the end
        // of the full chain so we still resolve the attribute, not just the variable.
        const queryColumn = rightExtended ? queryChar : segmentRange.start.character;
        const queryPos = new vscode.Position(position.line, queryColumn);

        // Single parallel query at the canonical position.
        const [definitions, hovers] = await Promise.all([
            this.lspQuery<vscode.Location[] | vscode.LocationLink[]>(
                'vscode.executeDefinitionProvider', document.uri, queryPos,
            ),
            this.executeExternalHoverQuery(
                document.uri,
                queryPos,
            ),
        ]);

        const result: LspSymbol = { name: expression };

        // Pylance hover is the authoritative source for type-qualified names
        // (e.g. "(method) str.upper() -> str" → name = "str.upper").
        this.applyHoverInfo(result, [hovers], [definitions]);

        // Definition path gives us the exact module prefix.
        await this.applyDefinitionInfo(result, [definitions]);

        // Some inherited/dynamic methods have weak hover data at the call site but
        // good signature metadata at the actual definition location.
        if (!result.signature || !result.docstring) {
            await this.hydrateFromDefinitionHover(result, [definitions]);
        }

        return result;
    }

    // ─── Context building ─────────────────────────────────────────────────────

    /**
     * Build the dotted expression at the cursor position.
     *
     * Scans LEFT for a dotted chain (e.g. cursor on "agg" → "df.agg"), then
     * peeks ONE segment RIGHT so that hovering "df" in "df.agg" still resolves
     * the method rather than just the variable.
     *
     * Returns the expression, the hovered segment range, and the character
     * offset Pylance should be queried at (last char of rightmost segment).
     */
    private buildContext(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): { expression: string; segmentRange: vscode.Range; queryChar: number; rightExtended: boolean } | null {
        const segmentRange = document.getWordRangeAtPosition(
            position, /[A-Za-z_][A-Za-z0-9_]*/,
        );
        if (!segmentRange) return null;

        const line = document.lineAt(position.line).text;
        if (this.isDanglingAttributeAccess(line, segmentRange.start.character)) {
            return null;
        }
        const segments = [document.getText(segmentRange)];

        // Scan left
        let cursor = segmentRange.start.character;
        while (cursor > 0) {
            let i = cursor - 1;
            while (i >= 0 && line[i] === ' ') i--;
            if (i < 0 || line[i] !== '.') break;
            i--;
            while (i >= 0 && line[i] === ' ') i--;
            if (i < 0) break;

            // Skip balanced brackets (e.g. "foo()[bar].method")
            if (line[i] === ')' || line[i] === ']') {
                i = this.scanPastBalanced(line, i);
                if (i < 0) break;
                while (i >= 0 && line[i] === ' ') i--;
                if (i < 0) break;
            }

            const end = i + 1;
            while (i >= 0 && /[A-Za-z0-9_]/.test(line[i])) i--;
            const start = i + 1;
            if (start >= end) break;

            const ident = line.slice(start, end);
            if (!/^[A-Za-z_]/.test(ident)) break;
            segments.unshift(ident);
            cursor = start;
        }

        // Peek one segment right (cursor on "df" in "df.agg" → extend to "df.agg")
        let queryChar = segmentRange.end.character - 1;
        const rightMatch = /^\.([A-Za-z_][A-Za-z0-9_]*)/.exec(
            line.slice(segmentRange.end.character),
        );
        let rightExtended = false;
        if (rightMatch) {
            segments.push(rightMatch[1]);
            queryChar = segmentRange.end.character + rightMatch[0].length - 1;
            rightExtended = true;
        }

        return {
            expression: segments.join('.'),
            segmentRange,
            queryChar,
            rightExtended,
        };
    }

    // ─── Hover info extraction ────────────────────────────────────────────────

    /**
     * Parse Pylance hover text and apply it to the result.
     *
     * Pylance hover has a ```python code block containing the signature, e.g.:
     *   (method) str.upper() -> str
     *   (function) numpy.array(object: ...) -> ndarray
     *   (variable) df: DataFrame
     *
     * For method/function with a dotted qualified name, we trust that name over
     * whatever expression we built from the cursor — Pylance's type inference is
     * more accurate than cursor-position heuristics for inferred local types.
     */
    private applyHoverInfo(
        result: LspSymbol,
        hovers: (vscode.Hover[] | undefined)[],
        definitions: (vscode.Location[] | vscode.LocationLink[] | undefined)[],
    ): void {
        const hoverList = hovers.find(h => h && h.length > 0);
        if (!hoverList) return;

        for (const hover of hoverList) {
            for (const c of hover.contents) {
                const text = typeof c === 'string' ? c : (c as vscode.MarkdownString).value;
                const block = /```python\n([\s\S]*?)\n```/.exec(text);
                if (!block) continue;

                const raw = block[1].trim();

                // Extract kind prefix: (method), (function), (class), etc.
                const kindMatch = /^\(([a-z]+)\)\s/.exec(raw);
                if (kindMatch) result.kind = kindMatch[1];

                // For "(method) ClassName.method(...)" — use the Pylance-qualified name.
                // For builtin types (str, list, …) always prefer this since the definition
                // lookup can fail on large builtins.pyi files.
                // For all others, only use it when there is no definition (Pylance cold).
                const qualMatch = /^\(method\)\s+((?:[A-Za-z_]\w*\.)+[A-Za-z_]\w*)\s*[[()]/.exec(raw);
                if (qualMatch) {
                    const qualName = qualMatch[1];
                    const root = qualName.split('.')[0];
                    const hasDefinition = definitions.some(d => d && d.length > 0);
                    if (!hasDefinition || BUILTIN_TYPES.has(root)) {
                        result.name = qualName;
                    }
                }

                // Signature: strip the kind prefix
                result.signature = raw.replace(/^\([a-z]+\)\s+/, '');

                // Docstring: everything after the code block (minus Pylance internals)
                const afterBlock = text.slice(block.index + block[0].length).trim();
                if (afterBlock) {
                    const docstring = afterBlock
                        .split('\n')
                        .filter(l => !l.trim().startsWith('<!--'))
                        .join('\n')
                        .trim();
                    if (docstring) result.docstring = docstring;
                }

                return; // first code block wins
            }
        }
    }

    // ─── Definition info extraction ───────────────────────────────────────────

    /**
     * Apply the definition location to the result.
     *
     * Derives the module from the file path (e.g. site-packages/pandas/core/frame.pyi
     * → "pandas.core.frame") and resolves the symbol name at the definition site
     * (e.g. "DataFrame.agg").  Together these produce the fully-qualified name
     * "pandas.core.frame.DataFrame.agg".
     */
    private async applyDefinitionInfo(
        result: LspSymbol,
        definitions: (vscode.Location[] | vscode.LocationLink[] | undefined)[],
    ): Promise<void> {
        const loc = this.firstLocation(definitions);
        if (!loc) return;

        result.path = loc.uri.fsPath;

        const symbolAtDef = await this.resolveSymbolAtLocation(loc);
        const module = this.moduleFromPath(loc.uri.fsPath);

        if (!symbolAtDef) return;

        const leaf = symbolAtDef.split('.').pop()!;

        // Pylance falls back to __getattr__/__getitem__ when it can't resolve a
        // specific attribute dynamically — reconstruct from class + cursor word.
        if (leaf === '__getattr__' || leaf === '__getitem__') {
            const className = symbolAtDef.split('.').slice(0, -1).join('.');
            const attr = result.name.split('.').pop() || result.name;
            result.name = module ? `${module}.${className}.${attr}` : `${className}.${attr}`;
        } else {
            result.name = module ? `${module}.${symbolAtDef}` : symbolAtDef;
        }

        if (module) result.module = module;
    }

    private async hydrateFromDefinitionHover(
        result: LspSymbol,
        definitions: (vscode.Location[] | vscode.LocationLink[] | undefined)[],
    ): Promise<void> {
        const loc = this.firstLocation(definitions);
        if (!loc) return;

        const hovers = await this.executeExternalHoverQuery(
            loc.uri,
            loc.range.start,
        );
        if (!hovers || hovers.length === 0) return;

        const hydrated: LspSymbol = { name: result.name };
        this.applyHoverInfo(hydrated, [hovers], []);

        if (!result.signature && hydrated.signature) {
            result.signature = hydrated.signature;
        }
        if (!result.docstring && hydrated.docstring) {
            result.docstring = hydrated.docstring;
        }
        if (!result.kind && hydrated.kind) {
            result.kind = hydrated.kind;
        }
    }

    // ─── LSP helpers ─────────────────────────────────────────────────────────

    private lspQuery<T>(command: string, ...args: unknown[]): Promise<T | undefined> {
        return Promise.race([
            vscode.commands.executeCommand<T>(command, ...args),
            new Promise<undefined>(r => setTimeout(() => r(undefined), LSP_TIMEOUT_MS)),
        ]).catch(() => undefined);
    }

    private async executeExternalHoverQuery(
        uri: vscode.Uri,
        position: vscode.Position,
    ): Promise<vscode.Hover[] | undefined> {
        const cacheKey = this.uriPositionCacheKey(uri, position);
        const cached = this.hoverQueryCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.value;
        }
        if (cached) {
            this.hoverQueryCache.delete(cacheKey);
        }

        const inflight = this.inflightHoverQueries.get(cacheKey);
        if (inflight) {
            return inflight;
        }

        const key = LspClient.hoverRequestKey(uri, position);
        LspClient.internalHoverRequests.set(key, (LspClient.internalHoverRequests.get(key) ?? 0) + 1);

        const query = this.lspQuery<vscode.Hover[]>(
            'vscode.executeHoverProvider',
            uri,
            position,
        );
        this.inflightHoverQueries.set(cacheKey, query);

        try {
            const result = await query;
            this.setCacheEntry(this.hoverQueryCache, cacheKey, result, HOVER_QUERY_CACHE_TTL_MS);
            return result;
        } finally {
            this.inflightHoverQueries.delete(cacheKey);
            const remaining = (LspClient.internalHoverRequests.get(key) ?? 1) - 1;
            if (remaining <= 0) {
                LspClient.internalHoverRequests.delete(key);
            } else {
                LspClient.internalHoverRequests.set(key, remaining);
            }
        }
    }

    private firstLocation(
        results: (vscode.Location[] | vscode.LocationLink[] | undefined)[],
    ): vscode.Location | undefined {
        for (const list of results) {
            if (!list || list.length === 0) continue;
            const first = list[0];
            if ('uri' in first) return first;
            if ('targetUri' in first) {
                return new vscode.Location(first.targetUri, first.targetRange);
            }
        }
        return undefined;
    }

    private async resolveSymbolAtLocation(loc: vscode.Location): Promise<string | null> {
        try {
            const symbols = await this.getDocumentSymbols(loc.uri);
            if (!symbols) return null;

            const findPath = (list: vscode.DocumentSymbol[]): string[] | null => {
                for (const s of list) {
                    if (!s.range.contains(loc.range.start)) continue;
                    const child = findPath(s.children);
                    return child ? [s.name, ...child] : [s.name];
                }
                return null;
            };

            const path = findPath(symbols);
            return path ? path.join('.') : null;
        } catch {
            return null;
        }
    }

    private moduleFromPath(fsPath: string): string | null {
        const p = fsPath.replace(/\\/g, '/');

        const markers = [
            '/site-packages/',
            '/dist-packages/',
            '/bundled/stubs/',
            '/typeshed-fallback/stdlib/',
            '/stdlib/',
            '/stubs/',
        ];

        for (const marker of markers) {
            const idx = p.lastIndexOf(marker);
            if (idx === -1) continue;

            let rel = p.slice(idx + marker.length);
            rel = rel.replace(/^python\d+(?:\.\d+)?\//, '');
            rel = rel.replace(/^\d+\.\d+\//, '');
            rel = rel.replace(/\.(py|pyi)$/, '');
            if (rel.endsWith('/__init__')) rel = rel.slice(0, -9);

            let mod = rel.replace(/\//g, '.');
            // Stub package suffix (pandas-stubs → pandas)
            mod = mod.replace(/^([^.]+)-stubs/, '$1');
            // Platform path aliases
            if (['ntpath', 'posixpath', 'macpath'].includes(mod)) mod = 'os.path';

            return mod || null;
        }
        return null;
    }

    private async getDocumentSymbols(uri: vscode.Uri): Promise<vscode.DocumentSymbol[] | undefined> {
        const cacheKey = this.documentCacheKey(uri);
        const cached = this.documentSymbolCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.value;
        }
        if (cached) {
            this.documentSymbolCache.delete(cacheKey);
        }

        const inflight = this.inflightDocumentSymbols.get(cacheKey);
        if (inflight) {
            return inflight;
        }

        const query = this.lspQuery<vscode.DocumentSymbol[]>(
            'vscode.executeDocumentSymbolProvider', uri,
        );
        this.inflightDocumentSymbols.set(cacheKey, query);

        try {
            const result = await query;
            this.setCacheEntry(this.documentSymbolCache, cacheKey, result, DOCUMENT_SYMBOL_CACHE_TTL_MS);
            return result;
        } finally {
            this.inflightDocumentSymbols.delete(cacheKey);
        }
    }

    private positionCacheKey(document: vscode.TextDocument, position: vscode.Position): string {
        return `${document.uri.toString()}:${document.version}:${position.line}:${position.character}`;
    }

    private uriPositionCacheKey(uri: vscode.Uri, position: vscode.Position): string {
        return `${this.documentCacheKey(uri)}:${position.line}:${position.character}`;
    }

    private documentCacheKey(uri: vscode.Uri): string {
        const openDocument = vscode.workspace.textDocuments.find(document => document.uri.toString() === uri.toString());
        return openDocument ? `${uri.toString()}:${openDocument.version}` : uri.toString();
    }

    private cloneSymbol(symbol: LspSymbol | null): LspSymbol | null {
        if (!symbol) {
            return null;
        }

        return {
            ...symbol,
            overloads: symbol.overloads ? [...symbol.overloads] : undefined,
            protocolHints: symbol.protocolHints ? [...symbol.protocolHints] : undefined,
        };
    }

    private setCacheEntry<T>(cache: Map<string, { expiresAt: number; value: T }>, key: string, value: T, ttlMs: number): void {
        cache.delete(key);
        cache.set(key, {
            expiresAt: Date.now() + ttlMs,
            value,
        });

        while (cache.size > MAX_CACHE_ENTRIES) {
            const oldestKey = cache.keys().next().value;
            if (!oldestKey) {
                break;
            }
            cache.delete(oldestKey);
        }
    }

    private scanPastBalanced(line: string, index: number): number {
        const close = line[index];
        const open = close === ')' ? '(' : '[';
        let depth = 0;
        for (let i = index; i >= 0; i--) {
            if (line[i] === close) depth++;
            else if (line[i] === open) { if (--depth === 0) return i - 1; }
        }
        return -1;
    }

    /**
     * Reject invalid syntax like `.upper()` where the hovered identifier is preceded
     * by a dot but there is no receiver expression on the left-hand side.
     */
    private isDanglingAttributeAccess(line: string, segmentStart: number): boolean {
        let cursor = segmentStart - 1;
        while (cursor >= 0 && line[cursor] === ' ') cursor--;
        if (cursor < 0 || line[cursor] !== '.') return false;

        cursor--;
        while (cursor >= 0 && line[cursor] === ' ') cursor--;
        if (cursor < 0) return true;

        return !/[A-Za-z0-9_)\]}"']/.test(line[cursor]);
    }
}
