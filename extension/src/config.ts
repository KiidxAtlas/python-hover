import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { CustomLibraryConfig } from '../../shared/types';

export class Config {
    private get config() {
        return vscode.workspace.getConfiguration('python-hover');
    }

    /** Memoized fingerprint — recomputed when the interpreter path has changed. */
    private _fingerprintCache: { path: string; fingerprint: string } | undefined;

    get isEnabled(): boolean {
        return this.config.get('enable', true);
    }

    get onlineDiscovery(): boolean {
        return this.config.get('onlineDiscovery', true);
    }

    /** Pre-fetch objects.inv for imports in the active editor (off by default — lazy load on hover). */
    get warmupImports(): boolean {
        return this.config.get('warmupImports', false);
    }

    /**
     * Use the bundled package → docs base URL map for fast resolution.
     * When false, discovery uses PyPI project URLs + objects.inv probes only.
     */
    get useKnownDocsUrls(): boolean {
        return this.config.get('useKnownDocsUrls', false);
    }

    get buildFullCorpus(): boolean {
        return this.config.get('buildFullCorpus', false);
    }

    get docsVersion(): string {
        return this.config.get('docsVersion', 'auto');
    }

    get maxSnippetLines(): number {
        return this.config.get('maxSnippetLines', 12);
    }

    get inventoryCacheDays(): number {
        return this.config.get('cacheTTL.inventoryDays', 7);
    }

    get snippetCacheHours(): number {
        return this.config.get('cacheTTL.snippetHours', 48);
    }

    get showPracticalExamples(): boolean {
        return this.config.get('showPracticalExamples', true);
    }

    get requestTimeout(): number {
        const raw = this.config.get('requestTimeout', 10000);
        return Math.min(Math.max(raw, 1000), 60000);
    }

    /** Where to open official docs links: 'integrated' (side panel), 'external' (system browser) */
    get docsBrowser(): 'integrated' | 'external' {
        return this.config.get('docsBrowser', 'integrated');
    }

    /** Where to open DevDocs links: 'integrated' (side panel), 'external' (system browser) */
    get devdocsBrowser(): 'integrated' | 'external' {
        return this.config.get('devdocsBrowser', 'external');
    }

    get customLibraries(): CustomLibraryConfig[] {
        const raw = this.config.get<unknown[]>('customLibraries', []);
        return raw.flatMap(entry => {
            if (!entry || typeof entry !== 'object') return [];

            const candidate = entry as { name?: unknown; baseUrl?: unknown; inventoryUrl?: unknown };
            if (typeof candidate.name !== 'string' || typeof candidate.baseUrl !== 'string') return [];

            const name = candidate.name.trim();
            const baseUrl = candidate.baseUrl.trim();
            const inventoryUrl = typeof candidate.inventoryUrl === 'string' ? candidate.inventoryUrl.trim() : undefined;
            if (!name || !baseUrl) return [];

            try {
                new URL(baseUrl);
                if (inventoryUrl) {
                    new URL(inventoryUrl);
                }
            } catch {
                return [];
            }

            return [{ name, baseUrl, inventoryUrl }];
        });
    }

    get showSignatures(): boolean {
        return this.config.get('ui.showSignatures', true);
    }

    get showReturnTypes(): boolean {
        return this.config.get('ui.showReturnTypes', true);
    }

    get showDebugPinButton(): boolean {
        return this.config.get('ui.showDebugPinButton', false);
    }

    get showStatusBar(): boolean {
        return this.config.get('ui.showStatusBar', true);
    }

    get showEditorContextMenu(): boolean {
        return this.config.get('ui.contextMenu.enabled', true);
    }

    get showSearchDocsContextMenu(): boolean {
        return this.config.get('ui.contextMenu.searchDocs', true);
    }

    get showBrowseModuleContextMenu(): boolean {
        return this.config.get('ui.contextMenu.browseModule', true);
    }

    get showPinHoverContextMenu(): boolean {
        return this.config.get('ui.contextMenu.pinHover', true);
    }

    get showDebugPinHoverContextMenu(): boolean {
        return this.config.get('ui.contextMenu.debugPinHover', true);
    }

    get showOpenStudioContextMenu(): boolean {
        return this.config.get('ui.contextMenu.openStudio', true);
    }

    get maxContentLength(): number {
        return this.config.get('ui.maxContentLength', 800);
    }

    get pythonPath(): string {
        const pythonConfig = vscode.workspace.getConfiguration('python');
        const configured = pythonConfig.get<string>('defaultInterpreterPath') || pythonConfig.get<string>('pythonPath');
        if (configured && configured.trim().length > 0) {
            return configured;
        }
        return process.platform === 'win32' ? 'python' : 'python3';
    }

    /**
     * Stable id for cache keys — ties disk + session caches to the configured interpreter path.
     * Memoized per interpreter path to avoid re-hashing on every hover.
     */
    get interpreterCacheFingerprint(): string {
        const p = this.pythonPath;
        if (this._fingerprintCache?.path === p) return this._fingerprintCache.fingerprint;
        const fingerprint = crypto.createHash('sha256').update(p).digest('hex').slice(0, 16);
        this._fingerprintCache = { path: p, fingerprint };
        return fingerprint;
    }

    /** Persistent Python subprocess: import/inspect/pydoc (enabled by default for richer hover resolution). */
    get runtimeHelperEnabled(): boolean {
        return this.config.get('runtimeHelper', true);
    }

    /** Fetch & parse remote HTML for richer third-party hovers (off by default). */
    get docScrapingEnabled(): boolean {
        return this.config.get('docScraping', false);
    }

    /** When runtime helper is on, also use AST identify when LSP gives an incomplete symbol. */
    get astFallbackEnabled(): boolean {
        return this.config.get('astFallback', true);
    }

    get enableDebugLogging(): boolean {
        return this.config.get('enableDebugLogging', false);
    }

    get compactMode(): boolean {
        return this.config.get('ui.compactMode', false);
    }

    get showBadges(): boolean {
        return this.config.get('ui.showBadges', true);
    }

    get showMetadataChips(): boolean {
        return this.config.get('ui.showMetadataChips', true);
    }

    get showProvenance(): boolean {
        return this.config.get('ui.showProvenance', true);
    }

    get showToolbar(): boolean {
        return this.config.get('ui.showToolbar', true);
    }

    get showCallouts(): boolean {
        return this.config.get('ui.showCallouts', true);
    }

    get showParameters(): boolean {
        return this.config.get('ui.showParameters', true);
    }

    get maxParameters(): number {
        const raw = this.config.get('ui.maxParameters', 6);
        return Math.min(Math.max(raw, 1), 20);
    }

    get showSeeAlso(): boolean {
        return this.config.get('ui.showSeeAlso', true);
    }

    get showRaises(): boolean {
        return this.config.get('ui.showRaises', true);
    }

    get showModuleExports(): boolean {
        return this.config.get('ui.showModuleExports', true);
    }

    get showModuleStats(): boolean {
        return this.config.get('ui.showModuleStats', true);
    }

    get showFooter(): boolean {
        return this.config.get('ui.showFooter', true);
    }

    get showImportHints(): boolean {
        return this.config.get('ui.showImportHints', true);
    }

    get maxExamples(): number {
        const raw = this.config.get('ui.maxExamples', 2);
        return Math.min(Math.max(raw, 1), 10);
    }

    get maxModuleExports(): number {
        const raw = this.config.get('ui.maxModuleExports', 20);
        return Math.min(Math.max(raw, 1), 100);
    }

    get maxSeeAlsoItems(): number {
        const raw = this.config.get('ui.maxSeeAlsoItems', 8);
        return Math.min(Math.max(raw, 1), 30);
    }

    get showUpdateWarning(): boolean {
        return this.config.get('ui.showUpdateWarning', true);
    }

    get redirectIntegratedHoverToDocsPage(): boolean {
        return this.config.get('ui.redirectIntegratedHoverToDocsPage', false);
    }

    get autoOpenCurrentHoverInIntegratedDocs(): boolean {
        return this.config.get('ui.autoOpenCurrentHoverInIntegratedDocs', false);
    }

    get moduleBrowserDefaultView(): 'hierarchy' | 'flat' {
        return this.config.get('ui.moduleBrowser.defaultView', 'flat');
    }

    get moduleBrowserDefaultSort(): 'name' | 'kind' | 'package' {
        return this.config.get('ui.moduleBrowser.defaultSort', 'name');
    }

    get moduleBrowserDefaultDensity(): 'comfortable' | 'compact' {
        return this.config.get('ui.moduleBrowser.defaultDensity', 'comfortable');
    }

    get moduleBrowserShowPrivateSymbols(): boolean {
        return this.config.get('ui.moduleBrowser.showPrivateSymbols', false);
    }

    get moduleBrowserShowHierarchyHints(): boolean {
        return this.config.get('ui.moduleBrowser.showHierarchyHints', true);
    }

    get moduleBrowserAutoLoadPreviews(): boolean {
        return this.config.get('ui.moduleBrowser.autoLoadPreviews', true);
    }

    get moduleBrowserPreviewBatchSize(): number {
        const raw = this.config.get('ui.moduleBrowser.previewBatchSize', 18);
        return Math.min(Math.max(raw, 4), 50);
    }

    get diagnosticsEnabled(): boolean {
        return this.config.get('diagnostics.enabled', true);
    }

    get hoverActivationDelay(): number {
        return Math.min(Math.max(this.config.get('hoverActivationDelay', 75), 0), 2000);
    }

    get preloadPackages(): string[] {
        return this.config.get<string[]>('preloadPackages', []).filter(p => typeof p === 'string' && p.trim().length > 0);
    }

    get excludePatterns(): string[] {
        return this.config.get<string[]>('excludePatterns', []);
    }
}
