import { DiskCache } from "#docs-engine/cache/diskCache";
import { DocResolver } from "#docs-engine/docResolver";
import { HoverDocBuilder } from "#docs-engine/process/hoverDocBuilder";
import { DocKeyBuilder } from "#shared/docKey";
import {
  BUILTIN_OWNER_TYPES,
  BUILTIN_TYPES,
  isKnownTopLevelBuiltin,
} from "#shared/pythonBuiltins";
import {
  HoverDoc,
  HoverHistoryEntry,
  IndexedSymbolPreview,
  IndexedSymbolSummary,
  LspSymbol,
  ResolutionSource,
  SymbolInfo,
} from "#shared/types";
import { Config } from "#src/config";
import { LspClient } from "#src/core/lspClient";
import { PythonHelper } from "#src/core/pythonHelper";
import {
  detectHoverContext,
  prioritizeExamplesForContext,
} from "#src/hover/hoverContext";
import { HoverParameterLensService } from "#src/hover/hoverParameterLensService";
import { HoverResolutionManager } from "#src/hover/hoverResolutionManager";
import { HoverSessionState } from "#src/hover/hoverSessionState";
import { ResolutionService } from "#src/hover/resolutionService";
import { Logger } from "#src/logger";
import { AliasResolver } from "#src/symbols/aliasResolver";
import { NameRefinement } from "#src/symbols/nameRefinement";
import {
  classifyHoverSymbol,
  extractImportedRoots,
  isLibraryPath,
  isStdlibPath,
  isStdlibTopLevelModule,
} from "#src/symbols/symbolClassifier";
import { HoverRenderer } from "#src/ui/rendering/hoverRenderer";
import {
  findEnclosingClassName,
  inferBuiltinOwnerFromReceiver,
  inferBuiltinOwnerFromSignature,
} from "#src/utils/builtin-inference";
import {
  cacheNegativeHover,
  isNegativeHoverCached,
  logWithCooldown,
} from "#src/utils/cache-utils";
import {
  buildInstalledSourceCandidates,
  isWeakLibrarySignature,
  moduleFromLibraryPath,
  normalizeBuiltinDunderAlias,
  shouldUseInstalledSourceFallback,
} from "#src/utils/resolution-utils";
import * as vscode from "vscode";

/**
 * Python structural keywords that should always show keyword documentation when hovered,
 * even if the cursor is adjacent to a class/function definition.
 * E.g. hovering `class` in `class Person:` → shows `class` statement docs, not Person's docs.
 *
 * `import`, `from`, `as` show keyword docs when the cursor is on the keyword token itself.
 * When the cursor is on the module name in an import line, `isImportModuleHover` takes over.
 * Excluded: `True`, `False`, `None` — handled as constants by the static resolver.
 */
const PYTHON_STRUCTURAL_KEYWORDS = new Set([
  "and",
  "as",
  "assert",
  "async",
  "await",
  "break",
  "case",
  "class",
  "continue",
  "def",
  "del",
  "elif",
  "else",
  "except",
  "finally",
  "for",
  "from",
  "global",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "match",
  "nonlocal",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "try",
  "while",
  "with",
  "yield",
]);

export class HoverProvider implements vscode.HoverProvider {
  private static readonly HOVER_LOG_COOLDOWN_MS = 2000;
  private static readonly NEGATIVE_HOVER_CACHE_MS = 2000;

  private renderer: HoverRenderer;
  private docResolver: DocResolver;
  private pythonHelper: PythonHelper;
  private docBuilder: HoverDocBuilder;
  private aliasResolver: AliasResolver;
  private sessionState: HoverSessionState;
  private parameterLensService: HoverParameterLensService;
  private ready: Promise<void>;
  /** Segments hover caches when the configured interpreter path changes. */
  private readonly envCacheId: string;

  private diagnosticCollection: vscode.DiagnosticCollection | undefined;
  private deprecatedRanges = new Map<string, vscode.Diagnostic[]>();
  readonly onDidChangeSidebarState: vscode.Event<void>;

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

  /** In-flight hover requests by stable cursor position.
   *  Deduplicates the expensive pre-cache phase (LSP + AST + refinement) before a symbol cache key exists. */
  private inflightPositionHovers = new Map<
    string,
    Promise<vscode.Hover | null>
  >();

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

  /** Alias resolution log dedupe for this session. */
  private loggedAliasResolutions = new Set<string>();
  /** Suppress repeated identical hover logs for the same target within a short window. */
  private hoverLogTimestamps = new Map<string, number>();
  /** Short-lived cache for hover attempts that intentionally returned no result. */
  private negativeHoverCache = new Map<string, number>();
  /** Imported roots per document version to avoid reparsing full files on every hover. */
  private importedRootsCache = new Map<string, ReadonlySet<string>>();
  /** Full document text per document version to avoid repeated getText() calls per hover. */
  private documentTextCache = new Map<string, string>();
  /** Alias resolutions per document version and symbol. */
  private aliasResolutionCache = new Map<string, string>();

  /** Active hover-delay timer — cleared on cancellation to avoid stale resolutions. */
  private hoverDelayTimer: ReturnType<typeof setTimeout> | undefined;

  /** Cached minimatch function — loaded once on first use and reused. */
  private minimatchFn:
    | ((path: string, pattern: string, opts?: object) => boolean)
    | null
    | undefined;

  private resolutionService: ResolutionService;
  private resolutionManager: HoverResolutionManager;

  constructor(
    private lspClient: LspClient,
    private config: Config,
    diskCache: DiskCache,
  ) {
    this.renderer = new HoverRenderer(config);
    this.envCacheId = config.interpreterCacheFingerprint;
    this.docResolver = new DocResolver(diskCache, {
      cacheTTL: {
        inventoryDays: config.inventoryCacheDays,
        snippetHours: config.snippetCacheHours,
      },
      requestTimeout: config.requestTimeout,
      customLibraries: config.customLibraries,
      onlineDiscovery: config.onlineDiscovery,
      buildFullCorpus: config.buildFullCorpus,
      enableDocScraping: config.docScrapingEnabled,
      useKnownDocsUrls: config.useKnownDocsUrls,
    });
    this.pythonHelper = new PythonHelper(config.pythonPath, diskCache, {
      enablePersistentRuntime: config.runtimeHelperEnabled,
      interpreterCacheId: config.interpreterCacheFingerprint,
    });
    this.docBuilder = new HoverDocBuilder();
    this.aliasResolver = new AliasResolver();
    this.sessionState = new HoverSessionState();
    this.onDidChangeSidebarState = this.sessionState.onDidChangeSidebarState;
    this.parameterLensService = new HoverParameterLensService(
      this.renderer,
      this.docResolver,
      this.docBuilder,
      this.sessionState,
      {
        resolveAliasForDocument: (document, documentText, symbol) =>
          this.resolveAliasForDocument(document, documentText, symbol),
      },
    );
    this.resolutionManager = new HoverResolutionManager(
      this.docResolver,
      this.pythonHelper,
    );
    // Wire resolution manager into parameter lens service for consistent resolution
    this.parameterLensService.setResolutionManager(this.resolutionManager);
    this.ready = this.initializePythonVersion();
    this.resolutionService = new ResolutionService(this.envCacheId);
  }

  private async initializePythonVersion() {
    try {
      const version = await this.pythonHelper.getPythonVersion();
      Logger.log(`Detected Python version: ${version}`);
      this.docResolver.setPythonVersion(version);
    } catch (e) {
      Logger.error("Failed to initialize Python version", e);
    }
  }

  /** Evict oldest entries when a map exceeds the cache limit. */
  private evictIfNeeded<K, V>(map: Map<K, V>): void {
    if (map.size <= HoverProvider.MAX_CACHE_SIZE) {
      return;
    }
    const excess = map.size - HoverProvider.MAX_CACHE_SIZE;
    const iter = map.keys();
    for (let i = 0; i < excess; i++) {
      const { value } = iter.next();
      if (value !== undefined) {
        map.delete(value);
      }
    }
  }

  warmupDocumentImports(document: vscode.TextDocument): void {
    if (document.languageId !== "python") {
      return;
    }

    const packages = extractImportedRoots(this.getDocumentText(document));
    if (packages.length > 0) {
      this.docResolver.warmupInventories(packages);
    }
  }

  warmupPackages(packages: string[]): void {
    if (packages.length > 0) {
      this.docResolver.warmupInventories(packages);
    }
  }

  setDiagnosticCollection(col: vscode.DiagnosticCollection): void {
    this.diagnosticCollection = col;
  }

  getLastDoc(): HoverDoc | null {
    return this.sessionState.getLastDoc();
  }

  getDocByCommandToken(token?: string): HoverDoc | null {
    return this.sessionState.getDocByCommandToken(token);
  }

  getExactDocByCommandToken(token: string): HoverDoc | null {
    return this.sessionState.getExactDocByCommandToken(token);
  }

  getRenderedHoverMarkdown(token?: string): string | null {
    const doc = this.getDocByCommandToken(token);
    if (!doc) {
      return null;
    }

    const hover = this.renderer.render(doc);
    const contents = Array.isArray(hover.contents)
      ? hover.contents
      : [hover.contents];
    const parts = contents
      .map((content) => {
        if (typeof content === "string") {
          return content;
        }
        if ("value" in content && typeof content.value === "string") {
          return content.value;
        }
        return "";
      })
      .filter(Boolean);

    return parts.length > 0 ? parts.join("\n\n") : null;
  }

  getLastRenderedHoverMarkdown(): string | null {
    return this.getRenderedHoverMarkdown();
  }

  getHoverHistory(): HoverHistoryEntry[] {
    return this.sessionState.getHoverHistory();
  }

  searchDocs(query: string) {
    return this.docResolver.searchSymbols(query);
  }

  async resolvePinnedReference(reference: {
    label: string;
    url?: string;
    currentModule?: string;
    currentPackage?: string;
    currentTitle?: string;
  }): Promise<HoverDoc | null> {
    await this.ready;

    const symbol = this.docResolver.findSymbolReference(reference);
    if (!symbol) {
      return null;
    }

    return this.resolveIndexedSymbolDoc(symbol);
  }

  getModuleSymbols(moduleName: string) {
    return this.docResolver.getModuleSymbols(moduleName);
  }

  getIndexedPackages() {
    return this.docResolver.getIndexedPackages();
  }

  getIndexedPackageSummaries() {
    return this.docResolver.getIndexedPackageSummaries();
  }

  async ensureIndexedPackage(
    packageName: string,
    isStdlib = false,
  ): Promise<void> {
    await this.ready;
    await this.docResolver.ensureIndexedPackage(packageName, isStdlib);
  }

  async hydrateCachedInventories(): Promise<string[]> {
    await this.ready;
    return this.docResolver.hydrateCachedInventories();
  }

  async resolveIndexedSymbolDoc(
    symbol: IndexedSymbolSummary,
  ): Promise<HoverDoc | null> {
    await this.ready;

    const symbolInfo = this.buildIndexedSymbolInfo(symbol);
    const docKey = DocKeyBuilder.fromSymbol(symbolInfo);

    try {
      const docs = await this.resolutionManager.resolveDoc(
        docKey,
        this.config.runtimeHelperEnabled &&
          symbol.package &&
          symbol.package !== "builtins"
          ? symbol.package
          : undefined,
      );

      const built = this.docBuilder.build(symbolInfo, docs);
      built.metadata = {
        ...(built.metadata ?? {}),
        indexedPackage: symbol.package,
        indexedName: symbol.name,
        indexedModule: symbol.module,
      };
      return built;
    } catch (error) {
      Logger.log(`Indexed symbol resolve failed for ${symbol.name}: ${error}`);
      return null;
    }
  }

  async getIndexedSymbolPreviews(
    symbols: IndexedSymbolSummary[],
  ): Promise<IndexedSymbolPreview[]> {
    const uniqueSymbols = [
      ...new Map(
        symbols.map((symbol) => [`${symbol.package}:${symbol.name}`, symbol]),
      ).values(),
    ];

    const previews = await Promise.all(
      uniqueSymbols.map(async (symbol) => {
        if (symbol.summary || symbol.signature) {
          return this.buildIndexedSymbolPreview(symbol);
        }

        const resolved = await this.resolveIndexedSymbolDoc(symbol);
        return this.buildIndexedSymbolPreview(symbol, resolved ?? undefined);
      }),
    );

    return previews;
  }

  async buildPythonCorpus(
    onProgress?: (progress: {
      completed: number;
      total: number;
      current: string;
    }) => void,
    shouldCancel?: () => boolean,
  ) {
    await this.ready;
    return this.docResolver.buildPythonStdlibCorpus(onProgress, shouldCancel);
  }

  getIndexedSymbolCount() {
    return this.docResolver.getIndexedSymbolCount();
  }

  private buildIndexedSymbolInfo(symbol: IndexedSymbolSummary): SymbolInfo {
    const name = symbol.name;
    const parts = name.split(".");
    const module =
      symbol.module ||
      (parts.length > 1
        ? parts.slice(0, -1).join(".")
        : symbol.package || name);
    return {
      name,
      qualname: name,
      kind: symbol.kind,
      module,
      isStdlib:
        symbol.package === "builtins" ||
        isStdlibTopLevelModule(symbol.package || parts[0] || ""),
    };
  }

  private buildIndexedSymbolPreview(
    symbol: IndexedSymbolSummary,
    doc?: HoverDoc,
  ): IndexedSymbolPreview {
    const summary =
      doc?.summary ||
      doc?.structuredContent?.summary ||
      doc?.structuredContent?.description ||
      symbol.summary;
    return {
      name: symbol.name,
      title: doc?.title || symbol.title || symbol.name,
      kind: doc?.kind || symbol.kind,
      module: doc?.module || symbol.module,
      summary,
      signature: doc?.signature || symbol.signature,
      url: doc?.url || symbol.url,
      sourceUrl: doc?.sourceUrl || doc?.links?.source || symbol.sourceUrl,
      source: doc?.source,
      installedVersion: doc?.installedVersion,
    };
  }

  /** Discard the session cache (call when document is saved). */
  clearSessionCache(): void {
    this.hoverCache.clear();
    this.identifyCache.clear();
    this.inflightPositionHovers.clear();
    this.positionToKey.clear();
    this.installedVersionCache.clear();
    this.loggedAliasResolutions.clear();
    this.hoverLogTimestamps.clear();
    this.negativeHoverCache.clear();
    this.importedRootsCache.clear();
    this.documentTextCache.clear();
    this.aliasResolutionCache.clear();
    this.parameterLensService.clearSessionCache();
    // commandDocCache is intentionally NOT cleared here — the Pin / Debug
    // command tokens in already-rendered hovers must remain valid after a
    // document save so the user can still act on them without re-hovering.
    this.pythonHelper.clearSessionCache();
    this.diagnosticCollection?.clear();
    this.deprecatedRanges.clear();
    this.sessionState.fireSidebarDidChange();
  }

  /** Clear caches related to a single document (keeps global caches intact). */
  clearDocumentSessionCache(document?: vscode.TextDocument): void {
    if (!document) {
      this.clearSessionCache();
      return;
    }
    const uriPrefix = `${document.uri.toString()}:`;

    for (const key of Array.from(this.documentTextCache.keys())) {
      if (key.startsWith(uriPrefix)) this.documentTextCache.delete(key);
    }
    for (const key of Array.from(this.importedRootsCache.keys())) {
      if (key.startsWith(uriPrefix)) this.importedRootsCache.delete(key);
    }
    for (const key of Array.from(this.aliasResolutionCache.keys())) {
      if (key.startsWith(uriPrefix)) this.aliasResolutionCache.delete(key);
    }
    for (const key of Array.from(this.identifyCache.keys())) {
      if (key.startsWith(uriPrefix)) this.identifyCache.delete(key);
    }
    for (const key of Array.from(this.positionToKey.keys())) {
      if (key.startsWith(uriPrefix)) this.positionToKey.delete(key);
    }
    for (const key of Array.from(this.inflightPositionHovers.keys())) {
      if (key.startsWith(uriPrefix)) this.inflightPositionHovers.delete(key);
    }

    // Leave hoverCache, installedVersionCache, and other global caches intact
    // to preserve cross-document performance.
    this.parameterLensService.clearSessionCache();
    this.pythonHelper.clearSessionCache();
    this.sessionState.fireSidebarDidChange();
  }

  private documentVersionCacheKey(document: vscode.TextDocument): string {
    return `${document.uri.toString()}:${document.version}`;
  }

  private getDocumentText(document: vscode.TextDocument): string {
    const cacheKey = this.documentVersionCacheKey(document);
    const cached = this.documentTextCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const text = document.getText();
    this.documentTextCache.set(cacheKey, text);
    this.evictIfNeeded(this.documentTextCache);
    return text;
  }

  private importedRootsForDocument(
    document: vscode.TextDocument,
  ): ReadonlySet<string> {
    const cacheKey = this.documentVersionCacheKey(document);
    const cached = this.importedRootsCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const roots = new Set(extractImportedRoots(this.getDocumentText(document)));
    this.importedRootsCache.set(cacheKey, roots);
    this.evictIfNeeded(this.importedRootsCache);
    return roots;
  }

  private resolveAliasForDocument(
    document: vscode.TextDocument,
    documentText: string,
    symbol: string,
  ): string {
    const cacheKey = `${this.documentVersionCacheKey(document)}:${symbol}`;
    const cached = this.aliasResolutionCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const resolved = this.aliasResolver.resolve(documentText, symbol);
    this.aliasResolutionCache.set(cacheKey, resolved);
    this.evictIfNeeded(this.aliasResolutionCache);
    return resolved;
  }

  private addDeprecatedDiagnostic(
    document: vscode.TextDocument,
    position: vscode.Position,
    hoverDoc: HoverDoc,
  ): void {
    if (!this.diagnosticCollection) {
      return;
    }

    const range =
      document.getWordRangeAtPosition(position) ??
      new vscode.Range(position, position);
    const message = `${hoverDoc.title} is deprecated.${hoverDoc.summary ? " " + hoverDoc.summary.slice(0, 120) : ""}`;
    const uriStr = document.uri.toString();
    const existing = this.deprecatedRanges.get(uriStr) ?? [];
    const alreadyTracked = existing.some(
      (diag) =>
        diag.code === "deprecated" &&
        diag.message === message &&
        diag.range.isEqual(range),
    );
    if (alreadyTracked) {
      return;
    }

    const diag = new vscode.Diagnostic(
      range,
      message,
      vscode.DiagnosticSeverity.Warning,
    );
    diag.source = "PyHover";
    diag.code = "deprecated";

    const updated = [...existing, diag];
    this.deprecatedRanges.set(uriStr, updated);
    this.diagnosticCollection.set(document.uri, updated);
  }

  private rememberCommandDoc(doc: HoverDoc, commandToken: string): HoverDoc {
    return this.sessionState.rememberCommandDoc(doc, commandToken);
  }

  /** Cache key stable for any cursor offset inside the same identifier token. */
  private stableHoverPositionKey(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): string {
    const word = document.getWordRangeAtPosition(
      position,
      /[A-Za-z_][A-Za-z0-9_]*/,
    );
    if (word) {
      return `${document.uri.toString()}:${document.version}:${word.start.line}:${word.start.character}:${word.end.character}`;
    }
    return `${document.uri.toString()}:${document.version}:${position.line}:${position.character}`;
  }

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
  ): Promise<vscode.Hover | null> {
    try {
      const hoverStartedAt = Date.now();
      if (LspClient.isInternalHoverRequest(document.uri, position)) {
        return null;
      }

      await this.ready;

      // Periodic eviction so caches don't grow unbounded over long sessions.
      this.evictIfNeeded(this.hoverCache);
      this.evictIfNeeded(this.identifyCache);
      this.evictIfNeeded(this.positionToKey);
      if (!this.config.isEnabled) {
        return null;
      }

      // Skip resolution for excluded file patterns.
      if (document.uri.scheme === "file") {
        const rel = vscode.workspace.asRelativePath(document.uri, false);
        const patterns = this.config.excludePatterns;
        if (patterns.length > 0) {
          if (this.minimatchFn === undefined) {
            const minimatchModule = await import("minimatch").catch(() => null);
            this.minimatchFn = minimatchModule?.minimatch ?? null;
          }
          const minimatch = this.minimatchFn;
          if (
            minimatch &&
            patterns.some((p) => minimatch(rel, p, { dot: true }))
          ) {
            return null;
          }
        }
      }

      // Optional per-extension activation delay — lets VS Code cancel stale hovers
      // before we start any expensive resolution (IPC, network, cache reads).
      const delay = this.config.hoverActivationDelay;
      if (delay > 0) {
        await new Promise<void>((resolve, reject) => {
          if (token.isCancellationRequested) {
            reject(new Error("cancelled"));
            return;
          }
          this.hoverDelayTimer = setTimeout(() => {
            this.hoverDelayTimer = undefined;
            if (token.isCancellationRequested) {
              reject(new Error("cancelled"));
              return;
            }
            resolve();
          }, delay);
          token.onCancellationRequested(() => {
            clearTimeout(this.hoverDelayTimer);
            this.hoverDelayTimer = undefined;
            reject(new Error("cancelled"));
          });
        }).catch(() => null);
        if (token.isCancellationRequested) {
          return null;
        }
      }

      // Compute the segment range once — set on every hover we return so VS Code
      // doesn't re-query the provider when the cursor moves within the same word
      // (which changes lastDoc and breaks Pin).
      const segmentRange = this.getSegmentRange(document, position);
      const segmentText = segmentRange ? document.getText(segmentRange) : "";
      const documentText = this.getDocumentText(document);
      const parameterLens = await this.parameterLensService.getParameterLens(
        document,
        position,
        token,
      );

      // Fast path: if we've already resolved this position in this document version,
      // skip the entire LSP + AST + refinement pipeline and go straight to hoverCache.
      const posKey = this.stableHoverPositionKey(document, position);
      const knownKey = this.positionToKey.get(posKey);
      if (knownKey) {
        if (
          this.isNegativeHoverCached(knownKey) ||
          this.isNegativeHoverCached(posKey)
        ) {
          return this.parameterLensService.decorateHoverWithParameterLens(
            null,
            undefined,
            parameterLens,
            segmentRange,
            document,
            documentText,
            position,
          );
        }
        const cached = this.hoverCache.get(knownKey);
        if (cached) {
          return this.parameterLensService.decorateHoverWithParameterLens(
            cached,
            knownKey,
            parameterLens,
            segmentRange,
            document,
            documentText,
            position,
          );
        }
        const inflight = this.inflightHovers.get(knownKey);
        if (inflight) {
          return inflight.then((result) =>
            this.parameterLensService.decorateHoverWithParameterLens(
              result,
              knownKey,
              parameterLens,
              segmentRange,
              document,
              documentText,
              position,
            ),
          );
        }
      }

      const inflightByPosition = this.inflightPositionHovers.get(posKey);
      if (inflightByPosition) {
        return inflightByPosition.then((result) =>
          this.parameterLensService.decorateHoverWithParameterLens(
            result,
            knownKey,
            parameterLens,
            segmentRange,
            document,
            documentText,
            position,
          ),
        );
      }

      const hoverPromise = (async () => {
        // ── Structural keyword fast-path ──────────────────────────────────────
        // When the cursor is directly on a structural keyword (class, def, for, …)
        // we bypass LSP entirely — Pylance would otherwise resolve the *following*
        // symbol (the class/function being defined) and return its docs instead.
        const simpleWordRange = document.getWordRangeAtPosition(
          position,
          /[a-zA-Z_][a-zA-Z0-9_]*/,
        );
        const simpleWord = simpleWordRange
          ? document.getText(simpleWordRange)
          : "";
        if (PYTHON_STRUCTURAL_KEYWORDS.has(simpleWord)) {
          const kwKey = `${this.envCacheId}:keyword:${simpleWord}`;
          this.positionToKey.set(posKey, kwKey);
          const kwCached = this.hoverCache.get(kwKey);
          if (kwCached) {
            return kwCached;
          }
          const kwInflight = this.inflightHovers.get(kwKey);
          if (kwInflight) {
            return kwInflight;
          }
          const kwPromise = this.resolveKeyword(
            simpleWord,
            kwKey,
            segmentRange,
          );
          this.inflightHovers.set(kwKey, kwPromise);
          kwPromise.finally(() => this.inflightHovers.delete(kwKey));
          return kwPromise.then((result) =>
            this.parameterLensService.decorateHoverWithParameterLens(
              result,
              kwKey,
              parameterLens,
              segmentRange,
              document,
              documentText,
              position,
            ),
          );
        }

        // ── Phase 1: LSP + AST (sequential — AST branches on LSP result) ──────
        const lspStartedAt = Date.now();
        let lspSymbol = await this.lspClient.resolveSymbol(document, position);
        Logger.debugDuration(
          "Hover LSP phase",
          lspStartedAt,
          {
            file: document.uri.fsPath,
            line: position.line + 1,
            symbol: lspSymbol?.name,
          },
          40,
        );
        this.logHoverEvent(
          `request:${posKey}:${lspSymbol?.name ?? segmentText}`,
          `Hover requested for ${segmentText || "<unknown>"}`,
          {
            file: document.uri.fsPath,
            line: position.line + 1,
            character: position.character,
            lspName: lspSymbol?.name,
            lspKind: lspSymbol?.kind,
            lspModule: lspSymbol?.module,
            lspPath: lspSymbol?.path,
          },
          true,
        );
        if (token.isCancellationRequested) {
          return null;
        }

        const isImportHover = this.isImportModuleHover(document, position);

        // ── Import-line fast path: module overview ────────────────────────────
        // When the user hovers on `import foo` or `from foo import …` (on "foo"),
        // skip AST identification and the full symbol pipeline entirely — just fetch
        // a module overview card (inventory + PyPI summary + top exports).
        if (isImportHover && lspSymbol) {
          const moduleName = NameRefinement.normalizeImportModule(
            lspSymbol.name,
          );
          if (moduleName) {
            const isStdlib =
              !!lspSymbol.isStdlib ||
              (lspSymbol.path ? isStdlibPath(lspSymbol.path) : false) ||
              isStdlibTopLevelModule(moduleName);
            const moduleKey = `${this.envCacheId}:__module__:${moduleName}`;
            this.positionToKey.set(posKey, moduleKey);

            const cached = this.hoverCache.get(moduleKey);
            if (cached) {
              return cached;
            }

            const inflight = this.inflightHovers.get(moduleKey);
            if (inflight) {
              return inflight;
            }

            const modulePromise = (async () => {
              // Fetch module overview + installed version via resolution manager
              const moduleDoc =
                await this.resolutionManager.resolveModuleOverview(
                  moduleName,
                  isStdlib,
                );
              if (!moduleDoc) return null;
              this.rememberCommandDoc(moduleDoc, moduleKey);
              const hover = this.renderer.render(moduleDoc);
              if (segmentRange) {
                hover.range = segmentRange;
              }
              this.hoverCache.set(moduleKey, hover);
              return hover;
            };)();
            this.inflightHovers.set(moduleKey, modulePromise);
            modulePromise.finally(() => this.inflightHovers.delete(moduleKey));
            return modulePromise.then((result) =>
              this.parameterLensService.decorateHoverWithParameterLens(
                result,
                moduleKey,
                parameterLens,
                segmentRange,
                document,
                documentText,
                position,
              ),
            );
          }
        }

        const importedRoots = this.importedRootsForDocument(document);

        // AST identify: only with persistent runtime; LSP-first unless explicit fallback.
        const canAst =
          this.config.runtimeHelperEnabled && this.config.astFallbackEnabled;
        const hasLibraryDefinitionPath = !!(
          lspSymbol?.path && isLibraryPath(lspSymbol.path)
        );
        const hasUserDefinitionPath = !!(
          lspSymbol?.path && !hasLibraryDefinitionPath
        );
        const dottedRoot =
          (lspSymbol?.name ?? "").replace(/^builtins\./, "").split(".")[0] ??
          "";
        const shouldTrustImportedOrStdlibRoot =
          !!dottedRoot &&
          (importedRoots.has(dottedRoot) || isStdlibTopLevelModule(dottedRoot));
        const shouldAstRefineLocalChain =
          this.config.runtimeHelperEnabled &&
          !!lspSymbol &&
          lspSymbol.name.includes(".") &&
          !isImportHover &&
          (!hasLibraryDefinitionPath || !shouldTrustImportedOrStdlibRoot);
        const needsAst =
          (this.config.runtimeHelperEnabled && !lspSymbol) ||
          shouldAstRefineLocalChain ||
          (canAst &&
            !!lspSymbol &&
            (!lspSymbol.path ||
              !lspSymbol.name.includes(".") ||
              hasUserDefinitionPath));
        let identifiedType: string | null = null;
        if (needsAst) {
          const identifyStartedAt = Date.now();
          if (token.isCancellationRequested) {
            return null;
          }

          // Cache identify results by document version + position.
          // document.version increments on every edit, so cached results stay valid
          // until the document changes. This prevents repeated IPC calls for the
          // same position while the user hovers or VS Code re-evaluates the hover.
          const wordForId = document.getWordRangeAtPosition(
            position,
            /[A-Za-z_][A-Za-z0-9_]*/,
          );
          const identifyCacheKey = wordForId
            ? `${document.uri.toString()}:${document.version}:${wordForId.start.line + 1}:${wordForId.start.character}:${wordForId.end.character}`
            : `${document.uri.toString()}:${document.version}:${position.line + 1}:${position.character}`;
          if (this.identifyCache.has(identifyCacheKey)) {
            identifiedType = this.identifyCache.get(identifyCacheKey) ?? null;
          } else {
            const identifyKey = wordForId
              ? `${document.uri.toString()}:${wordForId.start.line + 1}:${wordForId.start.character}:${wordForId.end.character}`
              : `${document.uri.toString()}:${position.line + 1}:${position.character}`;
            let identifyPromise = this.inflightIdentify.get(identifyKey);
            if (!identifyPromise) {
              identifyPromise = this.pythonHelper.identify(
                documentText,
                position.line + 1,
                position.character,
              );
              this.inflightIdentify.set(identifyKey, identifyPromise);
              identifyPromise.finally(() =>
                this.inflightIdentify.delete(identifyKey),
              );
            }
            identifiedType = await identifyPromise;
            this.identifyCache.set(identifyCacheKey, identifiedType);
          }
          Logger.debugDuration(
            "Hover AST identify phase",
            identifyStartedAt,
            {
              file: document.uri.fsPath,
              line: position.line + 1,
              symbol: lspSymbol?.name ?? segmentText,
              identifiedType,
            },
            30,
          );
        }

        // Docstring string literals — suppress hover entirely so hovering """..."""
        // doesn't show string (str) documentation.
        if (identifiedType === "docstring_literal") {
          this.cacheNegativeHover(posKey);
          return this.parameterLensService.decorateHoverWithParameterLens(
            null,
            undefined,
            parameterLens,
            segmentRange,
            document,
            documentText,
            position,
          );
        }

        if (identifiedType) {
          this.logHoverEvent(
            `ast:${posKey}:${identifiedType}`,
            `AST identified hover target for ${segmentText || "<unknown>"}`,
            { identifiedType },
            true,
          );
          const CONSTANTS = new Set(["None", "Ellipsis"]);
          const isLiteral = [
            "list",
            "dict",
            "set",
            "tuple",
            "str",
            "int",
            "float",
            "bool",
            "bytes",
            "complex",
            "None",
            "Ellipsis",
            "f-string",
          ].includes(identifiedType);

          if (isLiteral) {
            lspSymbol = {
              name: identifiedType,
              kind:
                identifiedType === "f-string"
                  ? "keyword"
                  : CONSTANTS.has(identifiedType)
                    ? "constant"
                    : "class",
              module: "builtins",
              path: "builtins",
              isStdlib: true,
            };
          } else {
            if (!lspSymbol) {
              lspSymbol = {
                name: identifiedType,
                kind: "function",
                module: "user",
                path: document.uri.fsPath,
              };
            } else if (identifiedType !== lspSymbol.name) {
              lspSymbol.name = identifiedType;
            }
          }
        }

        if (!lspSymbol) {
          this.cacheNegativeHover(posKey);
          this.logHoverEvent(
            `no-symbol:${posKey}:${segmentText}`,
            `Hover: no symbol recognized for ${segmentText || "<unknown>"}`,
          );
          return this.parameterLensService.decorateHoverWithParameterLens(
            null,
            undefined,
            parameterLens,
            segmentRange,
            document,
            documentText,
            position,
          );
        }

        // ── Phase 2: Name refinement (sync, fast) ────────────────────────────
        lspSymbol.name = NameRefinement.fromSignature(
          lspSymbol.name,
          lspSymbol.signature,
        );

        // Sanitise stray leading/trailing dots that refinement may produce.
        lspSymbol.name = lspSymbol.name.replace(/^\.+|\.+$/g, "");

        // Standalone builtins (e.g. len, print) are typed as methods in stub class bodies
        // but are really top-level functions — correct the kind so the badge says "Function".
        if (
          lspSymbol.kind === "method" &&
          lspSymbol.name.startsWith("builtins.")
        ) {
          const afterBuiltins = lspSymbol.name.slice("builtins.".length);
          if (!afterBuiltins.includes(".")) {
            lspSymbol.kind = "function";
          }
        }

        // Alias resolution (e.g. pd.DataFrame → pandas.DataFrame)
        const originalName = lspSymbol.name;
        const resolvedName = this.resolveAliasForDocument(
          document,
          documentText,
          lspSymbol.name,
        );
        if (resolvedName !== originalName) {
          lspSymbol.name = resolvedName;
        }

        // Some providers resolve isinstance/issubclass through type dunder hooks
        // (e.g. builtins.type.__instancecheck__). Canonicalize to public builtins.
        lspSymbol.name = normalizeBuiltinDunderAlias(lspSymbol.name);

        this.logHoverEvent(
          `selected:${posKey}:${lspSymbol.name}`,
          `Hover symbol selected for ${segmentText || "<unknown>"}`,
          {
            originalName,
            resolvedName: lspSymbol.name,
            kind: lspSymbol.kind,
            module: lspSymbol.module,
            path: lspSymbol.path,
          },
          true,
        );

        // ── Session cache + in-flight deduplication ───────────────────────────
        // Build a canonical DocKey and serialize it for stable caching across
        // the different resolver layers (LSP / AST / runtime).
        const { cacheKey, docKey, isLibrary } =
          this.resolutionService.buildCacheKey(lspSymbol, document);

        // Record position → cacheKey so future calls skip the pipeline entirely.
        this.positionToKey.set(posKey, cacheKey);

        // Return cached result immediately (no logging, no async work)
        const cached = this.hoverCache.get(cacheKey);
        if (cached) {
          return this.parameterLensService.decorateHoverWithParameterLens(
            cached,
            cacheKey,
            parameterLens,
            segmentRange,
            document,
            documentText,
            position,
          );
        }

        // If another hover for the same symbol is already resolving, share its promise.
        // This prevents stampedes when the cursor lingers on a slow-loading symbol.
        const inflight = this.inflightHovers.get(cacheKey);
        if (inflight) {
          return inflight.then((result) =>
            this.parameterLensService.decorateHoverWithParameterLens(
              result,
              cacheKey,
              parameterLens,
              segmentRange,
              document,
              documentText,
              position,
            ),
          );
        }

        // Log alias resolution only once per symbol (after cache miss confirmed)
        if (resolvedName !== originalName) {
          const aliasLogKey = `${originalName}->${resolvedName}`;
          if (!this.loggedAliasResolutions.has(aliasLogKey)) {
            this.loggedAliasResolutions.add(aliasLogKey);
            Logger.log(`Alias resolved: ${originalName} → ${resolvedName}`);
          }
        }

        if (token.isCancellationRequested) {
          return null;
        }

        // ── Register in-flight promise to deduplicate concurrent same-symbol hovers ─
        const wasAliasResolved = resolvedName !== originalName;
        const resolutionPromise = this.resolveAndRender(
          lspSymbol,
          document,
          documentText,
          position,
          cacheKey,
          wasAliasResolved,
          importedRoots,
          segmentRange,
          token,
        );
        this.inflightHovers.set(cacheKey, resolutionPromise);
        resolutionPromise.finally(() => this.inflightHovers.delete(cacheKey));
        return resolutionPromise.then((result) => {
          return this.parameterLensService
            .decorateHoverWithParameterLens(
              result,
              cacheKey,
              parameterLens,
              segmentRange,
              document,
              documentText,
              position,
            )
            .then((decorated) => {
              Logger.debugDuration(
                "Hover total pipeline",
                hoverStartedAt,
                {
                  file: document.uri.fsPath,
                  line: position.line + 1,
                  symbol: lspSymbol?.name,
                  resolved: !!decorated,
                },
                60,
              );
              return decorated;
            });
        });
      };)();

      this.inflightPositionHovers.set(posKey, hoverPromise);
      hoverPromise.finally(() => this.inflightPositionHovers.delete(posKey));
      return hoverPromise;
    } catch (e) {
      Logger.error("HoverProvider failed", e);
      return null;
    }
  }

  private async resolveAndRender(
    lspSymbol: LspSymbol,
    document: vscode.TextDocument,
    documentText: string,
    position: vscode.Position,
    cacheKey: string,
    wasAliasResolved: boolean,
    importedRoots: ReadonlySet<string>,
    hoverRange: vscode.Range | undefined,
    token: vscode.CancellationToken,
  ): Promise<vscode.Hover | null> {
    try {
      const resolveStartedAt = Date.now();
      if (token.isCancellationRequested) {
        return null;
      }

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
        importedRoots,
        wasAliasResolved,
      );

      // ── Local path: show user docstring + Pylance signature ───────────────
      // Guardrail: never show an empty "local" card for builtins like `bool`.
      // If we can't produce any meaningful local content, fall through to the
      // library doc resolver which can hit stdlib corpus/static docs.
      const builtinLeaf =
        (lspSymbol.name ?? "")
          .replace(/^builtins\./, "")
          .split(".")
          .pop() ?? "";
      const looksLikeBuiltinType = BUILTIN_TYPES.has(builtinLeaf);
      const shouldPreferLibrary =
        (lspSymbol.module === "builtins" || looksLikeBuiltinType) && !isDotted;

      if (isLocal && !shouldPreferLibrary) {
        let content = lspSymbol.docstring || "";
        let signature = lspSymbol.signature;
        let forceLibraryFallback = false;

        // AST extraction for user-defined functions/classes without LSP docstring.
        // Use the full qualified name relative to the module so that class methods
        // (e.g. 'Person.greet') are found correctly inside the class body rather
        // than mistakenly matching a top-level function with the same leaf name.
        if (
          this.config.runtimeHelperEnabled &&
          !content &&
          lspSymbol.name &&
          document
        ) {
          const modulePrefix = lspSymbol.module ? lspSymbol.module + "." : "";
          const localName =
            modulePrefix && lspSymbol.name.startsWith(modulePrefix)
              ? lspSymbol.name.slice(modulePrefix.length)
              : lspSymbol.name;
          const astInfo = await this.pythonHelper
            .getLocalDocstring(documentText, localName)
            .catch(() => null);
          if (astInfo?.docstring) {
            content = astInfo.docstring;
          }
          if (astInfo?.signature && !signature) {
            signature = astInfo.signature;
          }
        }

        // Dunder methods: fall back to object.<method> docs
        let dundarUrl: string | undefined;
        let dundarDevdocsUrl: string | undefined;
        let dundarFallbackDoc: HoverDoc | null = null;
        const methodName = lspSymbol.name.split(".").pop() ?? "";
        if (
          !content &&
          methodName.startsWith("__") &&
          methodName.endsWith("__")
        ) {
          const fallbackKey = DocKeyBuilder.fromSymbol({
            name: methodName,
            module: "builtins",
            path: "builtins",
            kind: "method",
            qualname: `object.${methodName}`,
            isStdlib: true,
          });
          dundarFallbackDoc = await this.docResolver
            .resolve(fallbackKey)
            .catch(() => null);
          if (dundarFallbackDoc?.content) {
            content = dundarFallbackDoc.content;
          }
          if (dundarFallbackDoc?.url) {
            dundarUrl = dundarFallbackDoc.url;
          }
          if (dundarFallbackDoc?.devdocsUrl) {
            dundarDevdocsUrl = dundarFallbackDoc.devdocsUrl;
          }
        }

        // __init__ with no docstring: show the class docstring as context.
        // Works whether the name is dotted (Person.__init__) or bare (__init__)
        // by falling back to a backward document scan for the enclosing class.
        if (
          !content &&
          methodName === "__init__" &&
          this.config.runtimeHelperEnabled
        ) {
          let className = "";
          if (lspSymbol.name.includes(".")) {
            className = lspSymbol.name.split(".").slice(0, -1).pop() ?? "";
          } else {
            className = findEnclosingClassName(document, position.line);
          }
          if (className) {
            const classInfo = await this.pythonHelper
              .getLocalDocstring(documentText, className)
              .catch(() => null);
            if (classInfo?.docstring) {
              content = classInfo.docstring;
            }
            if (classInfo?.signature && !signature) {
              signature = classInfo.signature;
            }
          }
        }

        // Local unknown dotted methods are often inferred container methods
        // (e.g. parents.get) that should resolve to builtins docs.
        const isUnknownLocalMethod =
          lspSymbol.name.includes(".") &&
          !!signature &&
          /\bunknown\b/i.test(signature);
        if (isUnknownLocalMethod) {
          const inferredOwner = await inferBuiltinOwnerFromReceiver(
            document,
            position,
            this.getSegmentRange.bind(this),
            (doc, pos) => this.lspClient.resolveSymbol(doc, pos),
          );
          if (inferredOwner) {
            const leaf = lspSymbol.name.split(".").pop() ?? lspSymbol.name;
            lspSymbol.name = `${inferredOwner}.${leaf}`;
            lspSymbol.module = "builtins";
            lspSymbol.path = "builtins";
            lspSymbol.isStdlib = true;
            forceLibraryFallback = true;
            this.logHoverEvent(
              `local-unknown-fallback:${cacheKey}:${lspSymbol.name}`,
              `Hover: promoted unknown local method to builtin ${lspSymbol.name}`,
            );
          }
        }

        // When content came from Python dunder docs (not the user's own
        // docstring), use the fallback doc's source (Corpus/Static) so the
        // hover doesn't show the misleading "Local" chip.
        const dundarContentActive =
          !lspSymbol.docstring &&
          !!dundarFallbackDoc?.content &&
          content === dundarFallbackDoc.content;
        const localDoc: HoverDoc = {
          title: lspSymbol.name,
          content,
          summary: content || undefined,
          signature,
          kind: lspSymbol.kind,
          source: dundarContentActive
            ? (dundarFallbackDoc!.source ?? ResolutionSource.Static)
            : ResolutionSource.Local,
          confidence: dundarContentActive ? dundarFallbackDoc!.confidence : 1.0,
          overloads: lspSymbol.overloads,
          protocolHints: lspSymbol.protocolHints,
          sourceUrl: dundarContentActive ? undefined : lspSymbol.path,
          url: dundarUrl,
          devdocsUrl: dundarDevdocsUrl,
          module: dundarContentActive
            ? (dundarFallbackDoc!.module ?? "builtins")
            : undefined,
        };
        const enrichedLocalDoc = this.applyContextualEnhancements(
          localDoc,
          document,
          position,
        );

        // If we still have nothing meaningful, let the library resolver try.
        // But never fall through when:
        //  • the path is confirmed as a user file (library resolver has nothing useful)
        //  • a dunder URL was found (we have a relevant docs link to show)
        const isConfirmedUserFile = !!(
          lspSymbol.path && !isLibraryPath(lspSymbol.path)
        );
        const hasDunderUrl = !!dundarUrl;
        if (forceLibraryFallback) {
          // fall through to library resolver
        } else if (
          !localDoc.summary &&
          !localDoc.signature &&
          !isConfirmedUserFile &&
          !hasDunderUrl
        ) {
          // fall through
        } else {
          this.rememberCommandDoc(enrichedLocalDoc, cacheKey);
          const hover = this.renderer.render(enrichedLocalDoc);
          if (hoverRange) {
            hover.range = hoverRange;
          }

          // Don't cache empty local results for dotted names.
          // First hover may be on cold Pylance — skip cache so the next hover
          // retries and gets the proper library resolution once Pylance warms up.
          if (content || !isDotted) {
            this.hoverCache.set(cacheKey, hover);
          }
          Logger.debugDuration(
            "Hover local render",
            resolveStartedAt,
            {
              symbol: lspSymbol.name,
              hasContent: !!content,
            },
            30,
          );
          return hover;
        }
      }

      // ── Library path: resolve docs (no Python IPC) ────────────────────────
      const symbolInfo = { ...lspSymbol };
      const isTypeshedSymbol = /\/typeshed(?:-fallback)?\//i.test(
        lspSymbol.path ?? "",
      );

      const shouldInferReceiverOwner = !symbolInfo.name.includes(".");
      const inferredReceiverOwner = shouldInferReceiverOwner
        ? await inferBuiltinOwnerFromReceiver(
            document,
            position,
            this.getSegmentRange.bind(this),
            (doc, pos) => this.lspClient.resolveSymbol(doc, pos),
          )
        : null;
      const builtinOwner =
        inferBuiltinOwnerFromSignature(symbolInfo.signature) ??
        inferredReceiverOwner;
      if (builtinOwner) {
        const originalBuiltinName = symbolInfo.name;
        const leaf = symbolInfo.name.split(".").pop() ?? symbolInfo.name;
        const nameWithoutModule = symbolInfo.name.replace(/^builtins\./, "");
        const existingRoot = nameWithoutModule.split(".")[0];
        // Rewrite when name is bare OR its root isn't the correct builtin owner
        // (e.g. p.name.upper → str.upper, bare upper → str.upper)
        if (
          !symbolInfo.name.includes(".") ||
          !BUILTIN_OWNER_TYPES.has(existingRoot)
        ) {
          symbolInfo.name = `${builtinOwner}.${leaf}`;
        }
        this.logHoverEvent(
          `builtin-normalized:${cacheKey}:${originalBuiltinName}:${builtinOwner}`,
          `Hover: normalized builtin method ${originalBuiltinName} -> ${symbolInfo.name}`,
        );
        symbolInfo.isStdlib = true;
        symbolInfo.module = "builtins";
        symbolInfo.path = "builtins";
      }

      // Infer isStdlib from path when Pylance gave us a stdlib stub
      if (
        !symbolInfo.isStdlib &&
        lspSymbol.path &&
        isStdlibPath(lspSymbol.path)
      ) {
        symbolInfo.isStdlib = true;
      }

      if (!symbolInfo.isStdlib) {
        const resolvedRoot =
          (symbolInfo.name ?? "").replace(/^builtins\./, "").split(".")[0] ??
          "";
        if (isStdlibTopLevelModule(resolvedRoot)) {
          symbolInfo.isStdlib = true;
          if (!symbolInfo.module && resolvedRoot !== "builtins") {
            symbolInfo.module = resolvedRoot;
          }
        }
      }

      const topLevelBuiltinName = (symbolInfo.name ?? "").replace(
        /^builtins\./,
        "",
      );
      if (
        !symbolInfo.isStdlib &&
        !symbolInfo.name.includes(".") &&
        isKnownTopLevelBuiltin(topLevelBuiltinName)
      ) {
        symbolInfo.isStdlib = true;
        symbolInfo.module = "builtins";
        symbolInfo.path = "builtins";
      }

      if (
        symbolInfo.isStdlib &&
        !symbolInfo.module &&
        lspSymbol.path &&
        lspSymbol.path !== "builtins"
      ) {
        symbolInfo.module = moduleFromLibraryPath(lspSymbol.path) ?? undefined;
      }

      if (
        symbolInfo.isStdlib &&
        !symbolInfo.module &&
        !symbolInfo.name.includes(".") &&
        symbolInfo.kind !== "module"
      ) {
        symbolInfo.module = "builtins";
        symbolInfo.path = "builtins";
      }

      // Builtin type methods always belong to the builtins package regardless
      // of whether Pylance gave us a path — without this DocKeyBuilder guesses
      // pkg='str'/'list'/etc. which don't exist in any inventory.
      if (isBuiltinMethod) {
        symbolInfo.isStdlib = true;
        symbolInfo.module = "builtins";
      }

      // When stdlib-classified with a local-chain name whose root is not a known
      // builtin type or stdlib module (e.g. "p.name.upper" resolved to builtins),
      // strip to just the leaf so DocKeyBuilder doesn't produce wrong anchors.
      if (
        symbolInfo.isStdlib &&
        symbolInfo.module === "builtins" &&
        symbolInfo.name.includes(".")
      ) {
        const cleanName = symbolInfo.name.replace(/^builtins\./, "");
        const nameRoot = cleanName.split(".")[0];
        if (
          !BUILTIN_OWNER_TYPES.has(nameRoot) &&
          !isStdlibTopLevelModule(nameRoot) &&
          nameRoot !== "builtins"
        ) {
          symbolInfo.name = cleanName.split(".").pop() ?? symbolInfo.name;
        }
      }

      // Suppress Pylance's misleading (*args, **kwargs) signature for typing forms
      if (
        (symbolInfo.module === "typing" ||
          symbolInfo.name?.startsWith("typing.")) &&
        /^\(\*args,?\s*\*\*(?:kwargs|kwds)\)$/.test(
          symbolInfo.signature?.trim() ?? "",
        )
      ) {
        symbolInfo.signature = undefined;
      }

      if (token.isCancellationRequested) {
        return null;
      }

      // ── Doc resolution + installed version (parallel) ─────────────────────
      if (
        shouldUseInstalledSourceFallback(
          this.config.runtimeHelperEnabled,
          symbolInfo,
          lspSymbol.path,
        )
      ) {
        const sourceInfo = await this.pythonHelper
          .getInstalledSourceSymbol(
            lspSymbol.path!,
            buildInstalledSourceCandidates(symbolInfo, lspSymbol.path!),
            symbolInfo.module ??
              moduleFromLibraryPath(lspSymbol.path!) ??
              undefined,
          )
          .catch(() => null);

        if (sourceInfo?.docstring && !symbolInfo.docstring) {
          symbolInfo.docstring = sourceInfo.docstring;
        }

        if (
          sourceInfo?.signature &&
          isWeakLibrarySignature(symbolInfo.signature)
        ) {
          symbolInfo.signature = sourceInfo.signature;
        }

        if (sourceInfo?.kind && !symbolInfo.kind) {
          symbolInfo.kind = sourceInfo.kind;
        }

        if (sourceInfo?.module && !symbolInfo.module) {
          symbolInfo.module = sourceInfo.module;
        }

        if (sourceInfo?.isStdlib) {
          symbolInfo.isStdlib = true;
        }
      }

      const docKey = DocKeyBuilder.fromSymbol(symbolInfo);
      const rootName =
        (symbolInfo.name ?? "").replace(/^builtins\./, "").split(".")[0] ?? "";
      const hasLibraryDefinitionPath = !!(
        lspSymbol.path && isLibraryPath(lspSymbol.path)
      );
      const hasTrustedLibraryEvidence =
        hasLibraryDefinitionPath ||
        wasAliasResolved ||
        symbolInfo.isStdlib === true ||
        importedRoots.has(rootName);
      const isUnresolvedLocalChain =
        isLocal &&
        isDotted &&
        !hasTrustedLibraryEvidence &&
        !symbolInfo.isStdlib &&
        !wasAliasResolved &&
        !!rootName;
      const isGuessedPackageFallback =
        !symbolInfo.module &&
        !symbolInfo.isStdlib &&
        !lspSymbol.path &&
        !!rootName &&
        docKey.package === rootName &&
        docKey.module === rootName;

      const isUnimportedThirdPartyGuess =
        !hasTrustedLibraryEvidence &&
        !docKey.isStdlib &&
        !!rootName &&
        docKey.package === rootName;

      if (isUnresolvedLocalChain) {
        this.cacheNegativeHover(cacheKey);
        this.logHoverEvent(
          `skip-local-chain:${cacheKey}:${symbolInfo.name}`,
          `Hover: unresolved local chain ${symbolInfo.name} has no library ownership evidence.`,
        );
        return null;
      }

      if (
        (isGuessedPackageFallback || isUnimportedThirdPartyGuess) &&
        !importedRoots.has(rootName)
      ) {
        this.cacheNegativeHover(cacheKey);
        this.logHoverEvent(
          `skip-unimported:${cacheKey}:${symbolInfo.name}`,
          `Hover: skipped unimported symbol guess for ${symbolInfo.name}`,
        );
        return null;
      }

      this.logHoverEvent(
        `resolve:${cacheKey}:${symbolInfo.name}`,
        `Resolving docs for ${symbolInfo.name}`,
        {
          docKey,
          importedRoots: [...importedRoots],
          builtinMethod: isBuiltinMethod,
          isLocal,
          isDotted,
        },
        true,
      );

      const isThirdParty =
        !symbolInfo.isStdlib &&
        !!symbolInfo.module &&
        symbolInfo.module !== "builtins";
      const topModule = symbolInfo.module?.split(".")[0] ?? "";

      const docs = await this.resolutionManager.resolveDoc(
        docKey,
        this.config.runtimeHelperEnabled && isThirdParty && topModule
          ? topModule
          : undefined,
      );

      const hoverDoc = this.docBuilder.build(symbolInfo, docs);
      if (isTypeshedSymbol) {
        hoverDoc.notes = [
          ...(hoverDoc.notes ?? []),
          "Signature/type information is sourced from typeshed stubs for this symbol.",
        ];
      }
      const enrichedHoverDoc = this.applyContextualEnhancements(
        hoverDoc,
        document,
        position,
      );
      this.rememberCommandDoc(enrichedHoverDoc, cacheKey);

      if (
        !enrichedHoverDoc.summary &&
        !enrichedHoverDoc.content &&
        !enrichedHoverDoc.signature &&
        !enrichedHoverDoc.url &&
        !enrichedHoverDoc.devdocsUrl
      ) {
        const fallbackHover = this.renderFailureHover(
          cacheKey,
          symbolInfo,
          "No renderable docs were found for this symbol in the current sources.",
          hoverRange,
        );
        return fallbackHover;
      } else if (!enrichedHoverDoc.summary && !enrichedHoverDoc.content) {
        this.logHoverEvent(
          `resolved-links-only:${cacheKey}:${symbolInfo.name}`,
          `Hover: resolved ${symbolInfo.name} with links only; detailed content is not cached yet.`,
        );
      }

      // Deprecated API diagnostics
      if (
        this.config.diagnosticsEnabled &&
        enrichedHoverDoc.badges?.some((b) => b.label === "deprecated") &&
        this.diagnosticCollection
      ) {
        this.addDeprecatedDiagnostic(document, position, enrichedHoverDoc);
      }

      const hover = this.renderer.render(enrichedHoverDoc);
      if (hoverRange) {
        hover.range = hoverRange;
      }
      this.hoverCache.set(cacheKey, hover);
      this.negativeHoverCache.delete(cacheKey);
      Logger.debugDuration(
        "Hover docs resolve+render",
        resolveStartedAt,
        {
          symbol: symbolInfo.name,
          source: enrichedHoverDoc.source,
        },
        40,
      );

      // Record in hover history ring buffer (skip module-overview entries).
      if (enrichedHoverDoc.title && enrichedHoverDoc.kind !== "module") {
        this.sessionState.rememberHoverHistoryEntry({
          title: enrichedHoverDoc.title.replace(/^builtins\./, ""),
          kind: enrichedHoverDoc.kind,
          module: enrichedHoverDoc.module,
          package: enrichedHoverDoc.module?.split(".")[0],
          url: enrichedHoverDoc.url,
          commandToken: cacheKey,
        });
      }

      return hover;
    } catch (e) {
      Logger.error("HoverProvider failed", e);
      return this.renderFailureHover(
        cacheKey,
        lspSymbol,
        "Network/cache resolution failed. You can still open local docs or cached links below.",
        hoverRange,
      );
    }
  }

  private applyContextualEnhancements(
    doc: HoverDoc,
    document: vscode.TextDocument,
    position: vscode.Position,
  ): HoverDoc {
    const contextHints = detectHoverContext(document, position);
    return {
      ...doc,
      contextHints,
      examples: prioritizeExamplesForContext(doc.examples, contextHints),
      metadata: {
        ...(doc.metadata ?? {}),
        contextTags: contextHints.tags,
      },
    };
  }

  private renderFailureHover(
    cacheKey: string,
    symbolInfo: Pick<LspSymbol, "name" | "kind" | "module">,
    reason: string,
    hoverRange?: vscode.Range,
  ): vscode.Hover {
    const fallbackDoc: HoverDoc = {
      title: symbolInfo.name,
      kind: symbolInfo.kind || "symbol",
      module: symbolInfo.module,
      summary: `Could not fully resolve docs for ${symbolInfo.name}.`,
      content: `${reason}\n\nFallback options:\n- Use local/runtime docstring resolution\n- Open cached docs links from hover history\n- Search indexed symbols for alternate references`,
      source: ResolutionSource.Fallback,
      confidence: 0.25,
    };

    this.rememberCommandDoc(fallbackDoc, cacheKey);
    const hover = this.renderer.render(fallbackDoc);
    if (hoverRange) {
      hover.range = hoverRange;
    }
    this.hoverCache.set(cacheKey, hover);
    return hover;
  }

  /**
   * Compute the hover range for the current identifier segment.
   *
   * This keeps hovers independent for each part of an access chain while still
   * allowing the resolver to use left-hand context internally.
   */
  private getSegmentRange(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Range | undefined {
    return document.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_]*/);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  /**
   * Resolve a Python structural keyword (class, def, for, …) directly via the
   * Python runtime and render a keyword hover card.  Bypasses LSP entirely so
   * that Pylance can't accidentally substitute the surrounding class/function.
   */
  private async resolveKeyword(
    word: string,
    cacheKey: string,
    hoverRange?: vscode.Range,
  ): Promise<vscode.Hover | null> {
    // Run runtime lookup and corpus resolve concurrently.
    const [runtimeInfo, resolvedDoc] = await Promise.all([
      this.config.runtimeHelperEnabled
        ? this.pythonHelper.resolveRuntime(word).catch(() => null)
        : Promise.resolve(null),
      this.docResolver
        .resolve(
          DocKeyBuilder.fromSymbol({
            name: word,
            module: "builtins",
            path: "builtins",
            kind: "keyword",
            isStdlib: true,
          }),
        )
        .catch(() => null),
    ]);

    // Soft keywords (match, case) are not importable — Python returns no docstring.
    // Prefer extracted official docs when available; fall back to runtime pydoc.help().
    const content =
      resolvedDoc?.content || runtimeInfo?.docstring || resolvedDoc?.summary;
    if (!content) {
      return null;
    }

    // Attribute source to whichever data origin actually supplied the content.
    const contentFromRuntime =
      !!runtimeInfo?.docstring && content === runtimeInfo.docstring;
    const source = contentFromRuntime
      ? ResolutionSource.Runtime
      : resolvedDoc?.source || ResolutionSource.Static;

    const keywordDoc: HoverDoc = {
      title: word,
      kind: "keyword",
      content,
      structuredContent: !contentFromRuntime
        ? resolvedDoc?.structuredContent
        : undefined,
      seeAlso: resolvedDoc?.seeAlso,
      sourceUrl: resolvedDoc?.sourceUrl,
      links: resolvedDoc?.links,
      source,
      confidence: 1.0,
      url: resolvedDoc?.url,
      devdocsUrl: resolvedDoc?.devdocsUrl,
    };
    this.rememberCommandDoc(keywordDoc, cacheKey);
    const hover = this.renderer.render(keywordDoc);
    if (hoverRange) {
      hover.range = hoverRange;
    }
    this.hoverCache.set(cacheKey, hover);
    return hover;
  }

  private isImportModuleHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): boolean {
    try {
      const line = document.lineAt(position.line).text;
      const col = position.character;

      const fromIdx = line.indexOf("from ");
      const importIdx = line.indexOf(" import ");
      if (
        fromIdx !== -1 &&
        importIdx !== -1 &&
        col >= fromIdx + 5 &&
        col <= importIdx
      ) {
        return true;
      }

      const importStart = line.match(/^\s*import\s+/);
      if (importStart && col >= importStart[0].length) {
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  }

  private logHoverEvent(
    key: string,
    message: string,
    data?: unknown,
    debug = false,
  ): void {
    logWithCooldown(
      this.hoverLogTimestamps,
      key,
      HoverProvider.HOVER_LOG_COOLDOWN_MS,
      () => {
        if (debug) {
          Logger.debug(message, data);
          return;
        }
        Logger.log(message, data);
      },
      this.evictIfNeeded.bind(this),
    );
  }

  private cacheNegativeHover(cacheKey: string): void {
    cacheNegativeHover(
      this.negativeHoverCache,
      cacheKey,
      this.evictIfNeeded.bind(this),
    );
  }

  private isNegativeHoverCached(cacheKey: string): boolean {
    return isNegativeHoverCached(
      this.negativeHoverCache,
      cacheKey,
      HoverProvider.NEGATIVE_HOVER_CACHE_MS,
    );
  }

  dispose(): void {
    if (this.hoverDelayTimer !== undefined) {
      clearTimeout(this.hoverDelayTimer);
      this.hoverDelayTimer = undefined;
    }
    this.sessionState.dispose();
    this.pythonHelper.dispose();
  }
}
