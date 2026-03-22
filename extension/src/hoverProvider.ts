import * as vscode from 'vscode';
import { DocResolver } from '../../docs-engine/docResolver';
import { HoverDocBuilder } from '../../docs-engine/src/builder/hoverDocBuilder';
import { DiskCache } from '../../docs-engine/src/cache/diskCache';
import { TypeshedParser } from '../../docs-engine/src/parsing/typeshedParser';
import { DocKeyBuilder } from '../../shared/docKey';
import { HoverDoc, LspSymbol, ResolutionSource } from '../../shared/types';
import { AliasResolver } from './aliasResolver';
import { Config } from './config';
import { Logger } from './logger';
import { LspClient } from './lspClient';
import { NameRefinement } from './nameRefinement';
import { PythonHelper } from './pythonHelper';
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
    'break', 'class', 'continue', 'def', 'del',
    'elif', 'else', 'except', 'finally', 'for',
    'global', 'if', 'in', 'is', 'lambda',
    'nonlocal', 'not', 'or', 'pass', 'raise',
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

    /** Kick off background inventory loads for common packages. */
    warmupInventories(): void {
        this.docResolver.warmupInventories();
    }

    setDiagnosticCollection(col: vscode.DiagnosticCollection): void {
        this.diagnosticCollection = col;
    }

    getLastDoc(): HoverDoc | null {
        return this.lastDoc;
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
            if (!this.config.isEnabled) return null;

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
                const kwPromise = this.resolveKeyword(simpleWord, kwKey);
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
                    const isStdlib = lspSymbol.path ? this.isStdlibPath(lspSymbol.path) : false;
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
                    if (identifiedType) Logger.log(`AST identified: ${identifiedType}`);
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
                        Logger.log(`Refining LSP name ${lspSymbol.name} with AST: ${identifiedType}`);
                        lspSymbol.name = identifiedType;
                    }
                }
            }

            if (!lspSymbol) return null;

            // ── Phase 2: Name refinement (sync, fast) ────────────────────────────
            lspSymbol.name = NameRefinement.fromSignature(lspSymbol.name, lspSymbol.signature);
            lspSymbol.name = NameRefinement.fromPath(lspSymbol.name, lspSymbol.path, isImportHover);

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
            const isLibrary = !lspSymbol.path || this.isLibraryPath(lspSymbol.path);
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
            const resolutionPromise = this.resolveAndRender(lspSymbol, document, position, cacheKey, isImportHover, wasAliasResolved, token);
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
        isImportHover: boolean,
        wasAliasResolved: boolean,
        token: vscode.CancellationToken,
    ): Promise<vscode.Hover | null> {
        try {
            // ── Phase 3: Parallel async resolution ───────────────────────────────
            // Run runtime introspection and typeshed parsing concurrently.
            const [runtimeInfo, typeshedInfo] = await Promise.all([
                this.pythonHelper.resolveRuntime(lspSymbol.name),
                lspSymbol.path?.endsWith('.pyi')
                    ? TypeshedParser.parse(lspSymbol.path, lspSymbol.name).catch(() => null)
                    : Promise.resolve(null),
            ]);

            if (token.isCancellationRequested) return null;

            // Apply typeshed enrichment
            if (typeshedInfo) {
                if (typeshedInfo.signature) lspSymbol.signature = typeshedInfo.signature;
                if (typeshedInfo.overloads) lspSymbol.overloads = typeshedInfo.overloads;
                if (typeshedInfo.protocolHints) lspSymbol.protocolHints = typeshedInfo.protocolHints;
            }

            // ── Phase 4: Local code fast-path ────────────────────────────────────
            const isLocalPath = lspSymbol.path && !this.isLibraryPath(lspSymbol.path);
            // Treat "no path + no module + NOT alias-resolved" as a local/unresolvable symbol.
            // This prevents bare local variable names (e.g. `agg` in `df.agg(...)`) from
            // hitting PyPI and returning unrelated packages (e.g. the "agg" FATE dice roller).
            //
            // IMPORTANT: alias-resolved names (e.g. `np.array` → `numpy.array`) MUST NOT be
            // treated as unresolvable even if the runtime can't import them — the package may
            // simply not be installed in the active Python environment (e.g. numpy on py3.14)
            // but its documentation is still available through the Sphinx inventory.
            const isUnresolvable = !lspSymbol.path && !(runtimeInfo?.module) && !wasAliasResolved;
            if ((!runtimeInfo || !runtimeInfo.module) && (isLocalPath || isUnresolvable)) {
                Logger.log('Local code detected — skipping remote doc lookup');

                let content = lspSymbol.docstring || '';
                let signature = lspSymbol.signature;

                // Try AST docstring extraction when LSP didn't provide a docstring.
                // This covers user-defined functions/classes in the current file.
                if (!content && lspSymbol.name && document) {
                    const localName = lspSymbol.name.split('.').pop() ?? lspSymbol.name;
                    const astInfo = await this.pythonHelper.getLocalDocstring(
                        document.getText(),
                        localName,
                    ).catch(() => null);
                    if (astInfo) {
                        if (astInfo.docstring) content = astInfo.docstring;
                        if (astInfo.signature && !signature) signature = astInfo.signature;
                    }
                }

                const notes: string[] = [];

                // Fallback for dunder methods (use object.<method> docs + URL)
                let dundarUrl: string | undefined;
                let dundarDevdocsUrl: string | undefined;
                if (!content && lspSymbol.name) {
                    const methodName = lspSymbol.name.split('.').pop();
                    if (methodName?.startsWith('__') && methodName.endsWith('__')) {
                        try {
                            const fallbackKey = DocKeyBuilder.fromSymbol({
                                name: methodName,
                                module: 'builtins',
                                path: 'builtins',
                                kind: 'method',
                                qualname: `object.${methodName}`,
                                isStdlib: true,
                            });
                            const fallbackDocs = await this.docResolver.resolve(fallbackKey);
                            if (fallbackDocs?.content) content = fallbackDocs.content;
                            if (fallbackDocs?.url) dundarUrl = fallbackDocs.url;
                            if (fallbackDocs?.devdocsUrl) dundarDevdocsUrl = fallbackDocs.devdocsUrl;
                        } catch { /* ignore */ }
                    }
                }

                if (!content && signature) {
                    const returnMatch = signature.match(/->\s*(.+)$/);
                    if (returnMatch) content = `Returns \`${returnMatch[1].trim()}\``;
                }

                if (lspSymbol.path) {
                    const fileName = lspSymbol.path.replace(/\\/g, '/').split('/').pop();
                    notes.push(`Defined in \`${fileName}\``);
                }

                const localDoc: HoverDoc = {
                    title: lspSymbol.name,
                    content,
                    summary: content || (lspSymbol.kind ? `Local ${lspSymbol.kind}` : 'Local symbol'),
                    signature: signature || lspSymbol.signature,
                    kind: lspSymbol.kind,
                    source: ResolutionSource.Local,
                    confidence: 1.0,
                    overloads: lspSymbol.overloads,
                    protocolHints: lspSymbol.protocolHints,
                    notes: notes.length > 0 ? notes : undefined,
                    sourceUrl: lspSymbol.path,
                    // Dunder methods link to object.<method> docs on docs.python.org
                    url: dundarUrl,
                    devdocsUrl: dundarDevdocsUrl,
                };

                this.lastDoc = localDoc;
                const hover = this.renderer.render(localDoc);
                this.hoverCache.set(cacheKey, hover);
                return hover;
            }

            // ── Phase 5: Merge symbol info + keyword fast-path ───────────────────
            const symbolInfo = { ...lspSymbol, ...runtimeInfo };

            // Safety net: if runtime didn't provide isStdlib (runtime failed or symbol
            // wasn't importable), infer it from the LSP file path so the doc resolver
            // never accidentally queries the PyPI typing backport for stdlib symbols.
            if (!symbolInfo.isStdlib && lspSymbol.path && this.isStdlibPath(lspSymbol.path)) {
                symbolInfo.isStdlib = true;
            }

            // Safety net: suppress misleading (*args, **kwargs) signatures for typing
            // constructs. Pylance emits these from _GenericAlias.__call__ — they are
            // meaningless to users since typing forms are used as annotations, not calls.
            if ((symbolInfo.module === 'typing' || symbolInfo.name?.startsWith('typing.')) &&
                /^\(\*args,?\s*\*\*(?:kwargs|kwds)\)$/.test(symbolInfo.signature?.trim() ?? '')) {
                symbolInfo.signature = undefined;
            }

            if (runtimeInfo?.kind === 'keyword' && runtimeInfo.docstring) {
                Logger.log(`Keyword: ${lspSymbol.name}`);
                const docKey = DocKeyBuilder.fromSymbol({
                    name: lspSymbol.name,
                    module: 'builtins',
                    path: 'builtins',
                    kind: 'keyword',
                    isStdlib: true,
                });
                const resolvedDoc = await this.docResolver.resolve(docKey);
                const keywordDoc: HoverDoc = {
                    title: lspSymbol.name,
                    content: runtimeInfo.docstring,
                    kind: 'keyword',
                    source: ResolutionSource.Runtime,
                    confidence: 1.0,
                    url: resolvedDoc?.url,
                    devdocsUrl: resolvedDoc?.devdocsUrl,
                };
                this.lastDoc = keywordDoc;
                const hover = this.renderer.render(keywordDoc);
                this.hoverCache.set(cacheKey, hover);
                return hover;
            }

            // Merge names (prefer qualified LSP name over short runtime name)
            symbolInfo.name = NameRefinement.mergeRuntimeName(
                lspSymbol.name,
                runtimeInfo?.name,
                runtimeInfo?.module,
            );
            if (symbolInfo.qualname === runtimeInfo?.name && symbolInfo.name !== runtimeInfo?.name) {
                symbolInfo.qualname = symbolInfo.name;
            }

            if (token.isCancellationRequested) return null;

            // ── Phase 6: Doc resolution + installed version (parallel) ───────────
            const docKey = DocKeyBuilder.fromSymbol(symbolInfo);
            const isLibrarySymbol = !symbolInfo.isStdlib && !!symbolInfo.module &&
                symbolInfo.module !== 'builtins';
            const topModule = symbolInfo.module?.split('.')[0] ?? '';
            const [docs, installedVersion] = await Promise.all([
                this.docResolver.resolve(docKey),
                isLibrarySymbol && topModule
                    ? this.pythonHelper.getInstalledVersion(topModule).catch(() => null)
                    : Promise.resolve(null),
            ]);
            const hoverDoc = this.docBuilder.build(symbolInfo, docs);
            if (installedVersion) { hoverDoc.installedVersion = installedVersion; }

            this.lastDoc = hoverDoc;

            // Deprecated API diagnostics
            if (hoverDoc.badges?.some(b => b.label === 'deprecated') && this.diagnosticCollection) {
                const range = document.getWordRangeAtPosition(position) ?? new vscode.Range(position, position);
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
            this.hoverCache.set(cacheKey, hover);
            return hover;

        } catch (e) {
            Logger.error('HoverProvider failed', e);
            return null;
        }
    }

    // ─── Private helpers ─────────────────────────────────────────────────────

    /**
     * Resolve a Python structural keyword (class, def, for, …) directly via the
     * Python runtime and render a keyword hover card.  Bypasses LSP entirely so
     * that Pylance can't accidentally substitute the surrounding class/function.
     */
    private async resolveKeyword(word: string, cacheKey: string): Promise<vscode.Hover | null> {
        const runtimeInfo = await this.pythonHelper.resolveRuntime(word).catch(() => null);
        if (!runtimeInfo?.docstring) return null;

        const docKey = DocKeyBuilder.fromSymbol({
            name: word, module: 'builtins', path: 'builtins',
            kind: 'keyword', isStdlib: true,
        });
        const resolvedDoc = await this.docResolver.resolve(docKey).catch(() => null);

        const keywordDoc: HoverDoc = {
            title: word,
            kind: 'keyword',
            content: runtimeInfo.docstring,
            source: ResolutionSource.Runtime,
            confidence: 1.0,
            url: resolvedDoc?.url,
            devdocsUrl: resolvedDoc?.devdocsUrl,
        };
        this.lastDoc = keywordDoc;
        const hover = this.renderer.render(keywordDoc);
        this.hoverCache.set(cacheKey, hover);
        return hover;
    }

    /**
     * True when the path is a Python stdlib file (inside lib/pythonX.Y but NOT site-packages).
     * Used to skip PyPI lookup for stdlib module overview hovers.
     */
    private isStdlibPath(p: string): boolean {
        const n = p.replace(/\\/g, '/').toLowerCase();
        if (n.includes('/site-packages/') || n.includes('/dist-packages/')) return false;
        return (
            /\/lib\/python\d/.test(n) ||
            n.includes('/typeshed/') ||
            n.includes('/typeshed-fallback/') ||
            n.includes('/stdlib/')
        );
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

    private isLibraryPath(p: string): boolean {
        const n = p.replace(/\\/g, '/').toLowerCase();
        return (
            n.includes('/site-packages/') ||
            n.includes('/dist-packages/') ||
            /\/lib\/python\d/.test(n) ||
            /\/lib\/python\//.test(n) ||
            /\/libs\//.test(n) ||
            /[/\\]lib[/\\]/i.test(p) ||
            n.includes('/typeshed/') ||
            n.includes('/stubs/')
        );
    }

    dispose(): void {
        this.pythonHelper.dispose();
    }
}
