import * as crypto from 'crypto';
import * as vscode from 'vscode';

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

    get customLibraries(): Array<{ name: string; baseUrl: string }> {
        const raw = this.config.get<any[]>('customLibraries', []);
        return raw.filter(entry => {
            if (!entry || typeof entry.name !== 'string' || typeof entry.baseUrl !== 'string') return false;
            if (!entry.name.trim() || !entry.baseUrl.trim()) return false;
            try { new URL(entry.baseUrl); return true; } catch { return false; }
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

    get diagnosticsEnabled(): boolean {
        return this.config.get('diagnostics.enabled', true);
    }

    get hoverActivationDelay(): number {
        return Math.min(Math.max(this.config.get('hoverActivationDelay', 0), 0), 2000);
    }

    get preloadPackages(): string[] {
        return this.config.get<string[]>('preloadPackages', []).filter(p => typeof p === 'string' && p.trim().length > 0);
    }

    get excludePatterns(): string[] {
        return this.config.get<string[]>('excludePatterns', []);
    }
}
