import * as vscode from 'vscode';
import { HoverDocBuilder } from '../../docs-engine/src/builder/hoverDocBuilder';
import { DiskCache } from '../../docs-engine/src/cache/diskCache';
import { DocResolver } from '../../docs-engine/src/docResolver';
import { DocKeyBuilder } from '../../shared/docKey';
import { HoverDoc, LspSymbol, ResolutionSource } from '../../shared/types';
import { AliasResolver } from './aliasResolver';
import { Config } from './config';
import { Logger } from './logger';
import { LspClient } from './lspClient';
import { NameRefinement } from './nameRefinement';
import { PythonHelper } from './pythonHelper';
import { classifyHoverSymbol, extractImportedRoots, isLibraryPath, isStdlibPath } from './symbolClassifier';
import { HoverRenderer } from './ui/hoverRenderer';

/**
 * Python structural keywords that should always show keyword documentation when hovered,
 * even if the cursor is adjacent to a class/function definition.
 * E.g. hovering `class` in `class Person:` → shows `class` statement docs, not Person's docs.
 *
 * Excluded: `import`, `from`, `as` — handled by the import-hover fast-path.
 * Excluded: `True`, `False`, `None` — handled as constants by the static resolver.
 */
const PYTHON_STRUCTURAL_KEYWORDS = new Set([
    'and', 'assert', 'async', 'await',
    'break', 'case', 'class', 'continue', 'def', 'del',
    'elif', 'else', 'except', 'finally', 'for',
    'global', 'if', 'in', 'is', 'lambda',
    'match', 'nonlocal', 'not', 'or', 'pass', 'raise',
    'return', 'try', 'while', 'with', 'yield',
]);

export class HoverProvider implements vscode.HoverProvider {
    private renderer: HoverRenderer;
    private docResolver: DocResolver;
    private pythonHelper: PythonHelper;
    private docBuilder: HoverDocBuilder;
    private aliasResolver: AliasResolver;
    private ready: Promise<void>;

    private diagnosticCollection: vscode.DiagnosticCollection | undefined;
    private deprecatedRanges = new Map<string, vscode.Diagnostic[]>();
    private lastDoc: HoverDoc | null = null;

    /** Maximum entries per in-memory cache before oldest entries are evicted. */
    private static readonly MAX_CACHE_SIZE = 500;

    /** Per-session hover cache: qualified symbol name → rendered Hover.
     *  Prevents re-running the full pipeline when the same symbol is hovered again. */
    private hoverCache = new Map<string, vscode.Hover>();

    /** In-flight resolution promises: cacheKey → Promise.
     *  Concurrent hovers for the same symbol share one pipeline instead of racing. */
    private inflightHovers = new Map<string, Promise<vscode.Hover | null>>();

    /** In-flight identify calls: "uri:line:col" → Promise.
     *  Concurrent hovers at the same position share one IPC call instead of flooding Python. */
    private inflightIdentify = new Map<string, Promise<string | null>>();

    /** Persistent identify cache: "uri:docVersion:line:col" → result.
     *  Avoids repeated IPC calls for the same position in the same document version. */
    private identifyCache = new Map<string, string | null>();

    /** Position → hover cache key: "uri:docVersion:line:col" → cacheKey.
     *  Lets us skip straight to hoverCache on repeat calls without re-running the
     *  full LSP + AST + refinement pipeline (which logs at every step). */
    private positionToKey = new Map<string, string>();

    /** Installed package version cache: module root → version string.
     *  Avoids an IPC round-trip per hover for every library symbol once resolved. */
    private installedVersionCache = new Map<string, string | null>();

    constructor(private lspClient: LspClient, private config: Config, diskCache: DiskCache) {
        this.renderer = new HoverRenderer(config);
        this.docResolver = new DocResolver(diskCache, {
            cacheTTL: {
                inventoryDays: config.inventoryCacheDays,
                snippetHours: config.snippetCacheHours,
            },
            requestTimeout: config.requestTimeout,
            customLibraries: config.customLibraries,
            onlineDiscovery: config.onlineDiscovery,
            buildFullCorpus: config.buildFullCorpus,
        });
        this.pythonHelper = new PythonHelper(config.pythonPath, diskCache);
        this.docBuilder = new HoverDocBuilder();
        this.aliasResolver = new AliasResolver();
        this.ready = this.initializePythonVersion();
    }

    private async initializePythonVersion() {
        try {
            const version = await this.pythonHelper.getPythonVersion();
            Logger.log(`Detected Python version: ${version}`);
            this.docResolver.setPythonVersion(version);
            this.renderer.setDetectedVersion(version);
        } catch (e) {
            Logger.error('Failed to initialize Python version', e);
        }
    }

    /** Evict oldest entries when a map exceeds the cache limit. */
    private evictIfNeeded<K, V>(map: Map<K, V>): void {
        if (map.size <= HoverProvider.MAX_CACHE_SIZE) return;
        const excess = map.size - HoverProvider.MAX_CACHE_SIZE;
        const iter = map.keys();
        for (let i = 0; i < excess; i++) {
            const { value } = iter.next();
            if (value !== undefined) map.delete(value);
        }
    }

    warmupDocumentImports(document: vscode.TextDocument): void {
        if (document.languageId !== 'python') return;

        const packages = extractImportedRoots(document.getText());
        if (packages.length > 0) {
            this.docResolver.warmupInventories(packages);
        }
    }

    setDiagnosticCollection(col: vscode.DiagnosticCollection): void {
        this.diagnosticCollection = col;
    }

    getLastDoc(): HoverDoc | null {
        return this.lastDoc;
    }

    getLastRenderedHoverMarkdown(): string | null {
        if (!this.lastDoc) return null;

        const hover = this.renderer.render(this.lastDoc);
        const contents = Array.isArray(hover.contents) ? hover.contents : [hover.contents];
        const parts = contents.map(content => {
            if (typeof content === 'string') return content;
            if ('value' in content && typeof content.value === 'string') return content.value;
            return '';
        }).filter(Boolean);

        return parts.length > 0 ? parts.join('\n\n') : null;
    }

    searchDocs(query: string) {
        return this.docResolver.searchSymbols(query);
    }

    getIndexedSymbolCount() {
        return this.docResolver.getIndexedSymbolCount();
    }

    /** Discard the session cache (call when document is saved). */
    clearSessionCache(): void {
        this.hoverCache.clear();
        this.identifyCache.clear();
        this.positionToKey.clear();
        this.installedVersionCache.clear();
        this.pythonHelper.clearSessionCache();
        this.diagnosticCollection?.clear();
        this.deprecatedRanges.clear();
    }

    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
    ): Promise<vscode.Hover | null> {
        try {
            await this.ready;

            // Periodic eviction so caches don't grow unbounded over long sessions.
            this.evictIfNeeded(this.hoverCache);
            this.evictIfNeeded(this.identifyCache);
            this.evictIfNeeded(this.positionToKey);
            if (!this.config.isEnabled) return null;

            // Compute the segment range once — set on every hover we return so VS Code
            // doesn't re-query the provider when the cursor moves within the same word
            // (which changes lastDoc and breaks Pin).
            const segmentRange = this.getSegmentRange(document, position);

            // Fast path: if we've already resolved this position in this document version,
            // skip the entire LSP + AST + refinement pipeline and go straight to hoverCache.
            const posKey = `${document.uri.toString()}:${document.version}:${position.line}:${position.character}`;
            const knownKey = this.positionToKey.get(posKey);
            if (knownKey) {
                const cached = this.hoverCache.get(knownKey);
                if (cached) return cached;
                const inflight = this.inflightHovers.get(knownKey);
                if (inflight) return inflight;
            }

            // ── Structural keyword fast-path ──────────────────────────────────────
            // When the cursor is directly on a structural keyword (class, def, for, …)
            // we bypass LSP entirely — Pylance would otherwise resolve the *following*
            // symbol (the class/function being defined) and return its docs instead.
            const simpleWordRange = document.getWordRangeAtPosition(position, /[a-zA-Z_][a-zA-Z0-9_]*/);
            const simpleWord = simpleWordRange ? document.getText(simpleWordRange) : '';
            if (PYTHON_STRUCTURAL_KEYWORDS.has(simpleWord)) {
                const kwKey = `keyword:${simpleWord}`;
                this.positionToKey.set(posKey, kwKey);
                const kwCached = this.hoverCache.get(kwKey);
                if (kwCached) return kwCached;
                const kwInflight = this.inflightHovers.get(kwKey);
                if (kwInflight) return kwInflight;
                const kwPromise = this.resolveKeyword(simpleWord, kwKey, segmentRange);
                this.inflightHovers.set(kwKey, kwPromise);
                kwPromise.finally(() => this.inflightHovers.delete(kwKey));
                return kwPromise;
            }

            // ── Phase 1: LSP + AST (sequential — AST branches on LSP result) ──────
            let lspSymbol = await this.lspClient.resolveSymbol(document, position);
            if (token.isCancellationRequested) return null;

            const isImportHover = this.isImportModuleHover(document, position);

            // ── Import-line fast path: module overview ────────────────────────────
            // When the user hovers on `import foo` or `from foo import …` (on "foo"),
            // skip AST identification and the full symbol pipeline entirely — just fetch
            // a module overview card (inventory + PyPI summary + top exports).
            if (isImportHover && lspSymbol) {
                const moduleName = NameRefinement.normalizeImportModule(lspSymbol.name);
                if (moduleName) {
                    const isStdlib = lspSymbol.path ? isStdlibPath(lspSymbol.path) : false;
                    const moduleKey = `__module__:${moduleName}`;
                    this.positionToKey.set(posKey, moduleKey);

                    const cached = this.hoverCache.get(moduleKey);
                    if (cached) return cached;

                    const inflight = this.inflightHovers.get(moduleKey);
                    if (inflight) return inflight;

                    const modulePromise = (async () => {
                        // Fetch module overview + installed version concurrently
                        const [moduleDoc, installedVersion] = await Promise.all([
                            this.docResolver.resolveModuleOverview(moduleName, isStdlib),
                            this.pythonHelper.getInstalledVersion(moduleName).catch(() => null),
                        ]);
                        if (installedVersion) {
                            moduleDoc.installedVersion = installedVersion;
                        }
                        this.lastDoc = moduleDoc;
                        const hover = this.renderer.render(moduleDoc);
                        if (segmentRange) hover.range = segmentRange;
                        this.hoverCache.set(moduleKey, hover);
                        return hover;
                    })();
                    this.inflightHovers.set(moduleKey, modulePromise);
                    modulePromise.finally(() => this.inflightHovers.delete(moduleKey));
                    return modulePromise;
                }
            }

            // Run AST identification only when LSP didn't give a fully-qualified path
            const needsAst = !lspSymbol || !lspSymbol.path || !lspSymbol.name.includes('.');
            let identifiedType: string | null = null;
            if (needsAst) {
                if (token.isCancellationRequested) return null;

                // Cache identify results by document version + position.
                // document.version increments on every edit, so cached results stay valid
                // until the document changes. This prevents repeated IPC calls for the
                // same position while the user hovers or VS Code re-evaluates the hover.
                const identifyCacheKey = `${document.uri.toString()}:${document.version}:${position.line + 1}:${position.character}`;
                if (this.identifyCache.has(identifyCacheKey)) {
                    identifiedType = this.identifyCache.get(identifyCacheKey) ?? null;
                } else {
                    // Deduplicate concurrent in-flight calls for the same position.
                    const identifyKey = `${document.uri.toString()}:${position.line + 1}:${position.character}`;
                    let identifyPromise = this.inflightIdentify.get(identifyKey);
                    if (!identifyPromise) {
                        identifyPromise = this.pythonHelper.identify(
                            document.getText(),
                            position.line + 1,
                            position.character,
                        );
                        this.inflightIdentify.set(identifyKey, identifyPromise);
                        identifyPromise.finally(() => this.inflightIdentify.delete(identifyKey));
                    }
                    identifiedType = await identifyPromise;
                    this.identifyCache.set(identifyCacheKey, identifiedType);
                }
            }

            if (identifiedType) {
                const TYPE_CANON: Record<string, string> = { 'f-string': 'str' };
                const canonType = TYPE_CANON[identifiedType] ?? identifiedType;
                const CONSTANTS = new Set(['None', 'Ellipsis']);
                const isLiteral = [
                    'list', 'dict', 'set', 'tuple', 'str', 'int', 'float',
                    'bool', 'bytes', 'complex', 'None', 'Ellipsis', 'f-string',
                ].includes(identifiedType);

                if (isLiteral) {
                    lspSymbol = {
                        name: canonType,
                        kind: CONSTANTS.has(canonType) ? 'constant' : 'class',
                        module: 'builtins',
                        path: 'builtins',
                    };
                } else {
                    if (!lspSymbol) {
                        lspSymbol = {
                            name: identifiedType,
                            kind: 'function',
                            module: 'user',
                            path: document.uri.fsPath,
                        };
                    } else if (identifiedType !== lspSymbol.name) {
                        lspSymbol.name = identifiedType;
                    }
                }
            }

            if (!lspSymbol) return null;

            // ── Phase 2: Name refinement (sync, fast) ────────────────────────────
            lspSymbol.name = NameRefinement.fromSignature(lspSymbol.name, lspSymbol.signature);

            // Sanitise stray leading/trailing dots that refinement may produce.
            lspSymbol.name = lspSymbol.name.replace(/^\.+|\.+$/g, '');

            // Standalone builtins (e.g. len, print) are typed as methods in stub class bodies
            // but are really top-level functions — correct the kind so the badge says "Function".
            if (lspSymbol.kind === 'method' && lspSymbol.name.startsWith('builtins.')) {
                const afterBuiltins = lspSymbol.name.slice('builtins.'.length);
                if (!afterBuiltins.includes('.')) {
                    lspSymbol.kind = 'function';
                }
            }

            // Alias resolution (e.g. pd.DataFrame → pandas.DataFrame)
            const originalName = lspSymbol.name;
            const resolvedName = this.aliasResolver.resolve(document.getText(), lspSymbol.name);
            if (resolvedName !== originalName) {
                lspSymbol.name = resolvedName;
            }

            // ── Session cache + in-flight deduplication ───────────────────────────
            // Library symbols are the same regardless of which file they're hovered in;
            // only local symbols need to be scoped per-file.
            const isLibrary = !lspSymbol.path || isLibraryPath(lspSymbol.path);
            const cacheKey = isLibrary
                ? lspSymbol.name
                : `${document.uri.fsPath}::${lspSymbol.name}`;

            // Record position → cacheKey so future calls skip the pipeline entirely.
            this.positionToKey.set(posKey, cacheKey);

            // Return cached result immediately (no logging, no async work)
            const cached = this.hoverCache.get(cacheKey);
            if (cached) {
                return cached;
            }

            // If another hover for the same symbol is already resolving, share its promise.
            // This prevents stampedes when the cursor lingers on a slow-loading symbol.
            const inflight = this.inflightHovers.get(cacheKey);
            if (inflight) {
                return inflight;
            }

            // Log alias resolution only once per symbol (after cache miss confirmed)
            if (resolvedName !== originalName) {
                Logger.log(`Alias resolved: ${originalName} → ${resolvedName}`);
            }

            if (token.isCancellationRequested) return null;

            // ── Register in-flight promise to deduplicate concurrent same-symbol hovers ─
            const wasAliasResolved = resolvedName !== originalName;
            const resolutionPromise = this.resolveAndRender(lspSymbol, document, position, cacheKey, wasAliasResolved, segmentRange, token);
            this.inflightHovers.set(cacheKey, resolutionPromise);
            resolutionPromise.finally(() => this.inflightHovers.delete(cacheKey));
            return resolutionPromise;

        } catch (e) {
            Logger.error('HoverProvider failed', e);
            return null;
        }
    }

    private async resolveAndRender(
        lspSymbol: LspSymbol,
        document: vscode.TextDocument,
        position: vscode.Position,
        cacheKey: string,
        wasAliasResolved: boolean,
        hoverRange: vscode.Range | undefined,
        token: vscode.CancellationToken,
    ): Promise<vscode.Hover | null> {
        try {
            if (token.isCancellationRequested) return null;

            // ── Classify: local user code vs library symbol ───────────────────────
            //
            // Decision tree (first matching rule wins):
            //  1. Path to user file          → local
            //  2. Path to library stub       → library (skip Python IPC entirely)
            //  3. Alias-resolved             → library (e.g. pd.DataFrame → pandas.DataFrame)
            //  4. Builtin type method        → library (str.upper, list.append, …)
            //  5. Directly imported root     → library (import fastapi → fastapi.FastAPI)
            //  6. Capital class.method       → library attempt (DataFrame.agg from Pylance hover)
            //  7. No other signal            → local (return whatever Pylance gave us)

            const { isBuiltinMethod, isDotted, isLocal } = classifyHoverSymbol(
                lspSymbol,
                document.getText(),
                wasAliasResolved,
            );

            // ── Local path: show user docstring + Pylance signature ───────────────
            if (isLocal) {
                let content = lspSymbol.docstring || '';
                let signature = lspSymbol.signature;

                // AST extraction for user-defined functions/classes without LSP docstring
                if (!content && lspSymbol.name && document) {
                    const localName = lspSymbol.name.split('.').pop() ?? lspSymbol.name;
                    const astInfo = await this.pythonHelper
                        .getLocalDocstring(document.getText(), localName)
                        .catch(() => null);
                    if (astInfo?.docstring) content = astInfo.docstring;
                    if (astInfo?.signature && !signature) signature = astInfo.signature;
                }

                // Dunder methods: fall back to object.<method> docs
                let dundarUrl: string | undefined;
                let dundarDevdocsUrl: string | undefined;
                const methodName = lspSymbol.name.split('.').pop() ?? '';
                if (!content && methodName.startsWith('__') && methodName.endsWith('__')) {
                    const fallbackKey = DocKeyBuilder.fromSymbol({
                        name: methodName, module: 'builtins', path: 'builtins',
                        kind: 'method', qualname: `object.${methodName}`, isStdlib: true,
                    });
                    const fallbackDocs = await this.docResolver.resolve(fallbackKey).catch(() => null);
                    if (fallbackDocs?.content) content = fallbackDocs.content;
                    if (fallbackDocs?.url) dundarUrl = fallbackDocs.url;
                    if (fallbackDocs?.devdocsUrl) dundarDevdocsUrl = fallbackDocs.devdocsUrl;
                }

                const localDoc: HoverDoc = {
                    title: lspSymbol.name,
                    content,
                    summary: content || undefined,
                    signature,
                    kind: lspSymbol.kind,
                    source: ResolutionSource.Local,
                    confidence: 1.0,
                    overloads: lspSymbol.overloads,
                    protocolHints: lspSymbol.protocolHints,
                    sourceUrl: lspSymbol.path,
                    url: dundarUrl,
                    devdocsUrl: dundarDevdocsUrl,
                };

                this.lastDoc = localDoc;
                const hover = this.renderer.render(localDoc);
                if (hoverRange) hover.range = hoverRange;

                // Don't cache empty local results for dotted names.
                // First hover may be on cold Pylance — skip cache so the next hover
                // retries and gets the proper library resolution once Pylance warms up.
                if (content || !isDotted) {
                    this.hoverCache.set(cacheKey, hover);
                }
                return hover;
            }

            // ── Library path: resolve docs (no Python IPC) ────────────────────────
            const symbolInfo = { ...lspSymbol };

            // Infer isStdlib from path when Pylance gave us a stdlib stub
            if (!symbolInfo.isStdlib && lspSymbol.path && isStdlibPath(lspSymbol.path)) {
                symbolInfo.isStdlib = true;
            }

            // Builtin type methods always belong to the builtins package regardless
            // of whether Pylance gave us a path — without this DocKeyBuilder guesses
            // pkg='str'/'list'/etc. which don't exist in any inventory.
            if (isBuiltinMethod) {
                symbolInfo.isStdlib = true;
                symbolInfo.module = 'builtins';
            }

            // Suppress Pylance's misleading (*args, **kwargs) signature for typing forms
            if ((symbolInfo.module === 'typing' || symbolInfo.name?.startsWith('typing.')) &&
                /^\(\*args,?\s*\*\*(?:kwargs|kwds)\)$/.test(symbolInfo.signature?.trim() ?? '')) {
                symbolInfo.signature = undefined;
            }

            if (token.isCancellationRequested) return null;

            // ── Doc resolution + installed version (parallel) ─────────────────────
            const docKey = DocKeyBuilder.fromSymbol(symbolInfo);
            const isThirdParty = !symbolInfo.isStdlib && !!symbolInfo.module
                && symbolInfo.module !== 'builtins';
            const topModule = symbolInfo.module?.split('.')[0] ?? '';

            const installedVersionPromise = (isThirdParty && topModule)
                ? (this.installedVersionCache.has(topModule)
                    ? Promise.resolve(this.installedVersionCache.get(topModule) ?? null)
                    : this.pythonHelper.getInstalledVersion(topModule).catch(() => null).then(v => {
                        this.installedVersionCache.set(topModule, v);
                        return v;
                    }))
                : Promise.resolve(null);

            const [docs, installedVersion] = await Promise.all([
                this.docResolver.resolve(docKey),
                installedVersionPromise,
            ]);

            const hoverDoc = this.docBuilder.build(symbolInfo, docs);
            if (installedVersion) hoverDoc.installedVersion = installedVersion;
            this.lastDoc = hoverDoc;

            // Deprecated API diagnostics
            if (hoverDoc.badges?.some(b => b.label === 'deprecated') && this.diagnosticCollection) {
                const range = document.getWordRangeAtPosition(position)
                    ?? new vscode.Range(position, position);
                const message = `${hoverDoc.title} is deprecated.${hoverDoc.summary ? ' ' + hoverDoc.summary.slice(0, 120) : ''}`;
                const diag = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
                diag.source = 'PyHover';
                diag.code = 'deprecated';
                const uriStr = document.uri.toString();
                const existing = this.deprecatedRanges.get(uriStr) ?? [];
                existing.push(diag);
                this.deprecatedRanges.set(uriStr, existing);
                this.diagnosticCollection.set(document.uri, this.deprecatedRanges.get(uriStr)!);
            }

            const hover = this.renderer.render(hoverDoc);
            if (hoverRange) hover.range = hoverRange;
            this.hoverCache.set(cacheKey, hover);
            return hover;

        } catch (e) {
            Logger.error('HoverProvider failed', e);
            return null;
        }
    }

    /**
     * Compute the hover range for the current identifier segment.
     *
     * This keeps hovers independent for each part of an access chain while still
     * allowing the resolver to use left-hand context internally.
     */
    private getSegmentRange(document: vscode.TextDocument, position: vscode.Position): vscode.Range | undefined {
        return document.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_]*/);
    }

    // ─── Private helpers ─────────────────────────────────────────────────────

    /**
     * Resolve a Python structural keyword (class, def, for, …) directly via the
     * Python runtime and render a keyword hover card.  Bypasses LSP entirely so
     * that Pylance can't accidentally substitute the surrounding class/function.
     */
    private async resolveKeyword(word: string, cacheKey: string, hoverRange?: vscode.Range): Promise<vscode.Hover | null> {
        // Run runtime lookup and corpus resolve concurrently.
        const [runtimeInfo, resolvedDoc] = await Promise.all([
            this.pythonHelper.resolveRuntime(word).catch(() => null),
            this.docResolver.resolve(DocKeyBuilder.fromSymbol({
                name: word, module: 'builtins', path: 'builtins',
                kind: 'keyword', isStdlib: true,
            })).catch(() => null),
        ]);

        // Soft keywords (match, case) are not importable — Python returns no docstring.
        // Fall back to the static summary so they still show a hover.
        const content = runtimeInfo?.docstring || resolvedDoc?.summary || resolvedDoc?.content;
        if (!content) return null;

        // Use Static source when Python had no docstring (soft keywords like match/case).
        const source = runtimeInfo?.docstring ? ResolutionSource.Runtime : ResolutionSource.Static;

        const keywordDoc: HoverDoc = {
            title: word,
            kind: 'keyword',
            content,
            source,
            confidence: 1.0,
            url: resolvedDoc?.url,
            devdocsUrl: resolvedDoc?.devdocsUrl,
        };
        this.lastDoc = keywordDoc;
        const hover = this.renderer.render(keywordDoc);
        if (hoverRange) hover.range = hoverRange;
        this.hoverCache.set(cacheKey, hover);
        return hover;
    }

    private isImportModuleHover(document: vscode.TextDocument, position: vscode.Position): boolean {
        try {
            const line = document.lineAt(position.line).text;
            const col = position.character;

            const fromIdx = line.indexOf('from ');
            const importIdx = line.indexOf(' import ');
            if (fromIdx !== -1 && importIdx !== -1 && col >= fromIdx + 5 && col <= importIdx) return true;

            const importStart = line.match(/^\s*import\s+/);
            if (importStart && col >= importStart[0].length) return true;
        } catch { /* ignore */ }
        return false;
    }

    dispose(): void {
        this.pythonHelper.dispose();
    }
}
