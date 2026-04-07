import * as path from 'path';
import * as vscode from 'vscode';

export type StudioPreset = 'focused' | 'balanced' | 'deepDocs';

export type StudioActivePreset = StudioPreset | 'custom';

export type StudioState = {
    version: string;
    activePreset: StudioActivePreset;
    indexedSymbols: number;
    cacheSizeLabel: string;
    corpusSizeLabel: string;
    fullCacheSizeLabel: string;
    pythonStdlibCorpusPackages: number;
    pythonStdlibCorpusEntries: number;
    hasPythonStdlibCorpus: boolean;
    isBuildingPythonStdlibCorpus: boolean;
    lastHoverTitle?: string;
    onlineDiscovery: boolean;
    runtimeHelper: boolean;
    astFallback: boolean;
    docScraping: boolean;
    buildFullCorpus: boolean;
    warmupImports: boolean;
    useKnownDocsUrls: boolean;
    enableDebugLogging: boolean;
    diagnosticsEnabled: boolean;
    showStatusBar: boolean;
    showDebugPinButton: boolean;
    showBadges: boolean;
    showMetadataChips: boolean;
    showSignatures: boolean;
    showReturnTypes: boolean;
    compactMode: boolean;
    showProvenance: boolean;
    showToolbar: boolean;
    showCallouts: boolean;
    showParameters: boolean;
    showSeeAlso: boolean;
    showRaises: boolean;
    showModuleExports: boolean;
    showModuleStats: boolean;
    showFooter: boolean;
    showImportHints: boolean;
    showPracticalExamples: boolean;
    docsBrowser: 'integrated' | 'external';
    devdocsBrowser: 'integrated' | 'external';
    redirectIntegratedHoverToDocsPage: boolean;
    autoOpenCurrentHoverInIntegratedDocs: boolean;
    maxContentLength: number;
    maxSnippetLines: number;
    maxParameters: number;
    maxExamples: number;
    maxModuleExports: number;
    maxSeeAlsoItems: number;
    requestTimeout: number;
    hoverActivationDelay: number;
    inventoryCacheDays: number;
    snippetCacheHours: number;
    moduleBrowserDefaultView: 'hierarchy' | 'flat';
    moduleBrowserDefaultSort: 'name' | 'kind' | 'package';
    moduleBrowserDefaultDensity: 'comfortable' | 'compact';
    moduleBrowserShowPrivateSymbols: boolean;
    moduleBrowserAutoLoadPreviews: boolean;
    moduleBrowserShowHierarchyHints: boolean;
    contextMenuEnabled: boolean;
    contextMenuSearchDocs: boolean;
    contextMenuBrowseModule: boolean;
    contextMenuPinHover: boolean;
    contextMenuDebugPinHover: boolean;
    contextMenuOpenStudio: boolean;
};

export type StudioMessage =
    | { type: 'run-command'; command: string }
    | { type: 'open-settings'; query?: string }
    | { type: 'update-setting'; key: string; value: boolean | string | number }
    | { type: 'apply-preset'; preset: StudioPreset };

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object';
}

function isStudioPreset(value: unknown): value is StudioPreset {
    return value === 'focused' || value === 'balanced' || value === 'deepDocs';
}

function isStudioMessage(value: unknown): value is StudioMessage {
    if (!isRecord(value) || typeof value.type !== 'string') {
        return false;
    }

    switch (value.type) {
        case 'run-command':
            return typeof value.command === 'string';
        case 'open-settings':
            return value.query === undefined || typeof value.query === 'string';
        case 'update-setting':
            return typeof value.key === 'string'
                && (typeof value.value === 'boolean' || typeof value.value === 'string' || typeof value.value === 'number');
        case 'apply-preset':
            return isStudioPreset(value.preset);
        default:
            return false;
    }
}

export class StudioPanel {
    private static instance: StudioPanel | undefined;
    private panel: vscode.WebviewPanel | undefined;
    private disposables: vscode.Disposable[] = [];

    private constructor(private readonly onMessage: (message: StudioMessage) => void | Promise<void>) { }

    static getInstance(onMessage: (message: StudioMessage) => void | Promise<void>): StudioPanel {
        if (!StudioPanel.instance) {
            StudioPanel.instance = new StudioPanel(onMessage);
        }
        return StudioPanel.instance;
    }

    show(state: StudioState): void {
        if (!this.panel) {
            this.panel = this.createPanel();
        }

        this.update(state);
        this.panel.reveal(vscode.ViewColumn.Active, false);
    }

    update(state: StudioState): void {
        if (!this.panel) {return;}
        this.panel.title = 'PyHover Studio';
        this.panel.webview.html = this.renderHtml(this.panel.webview, state);
    }

    dispose(): void {
        this.panel?.dispose();
        this.panel = undefined;
    }

    private createPanel(): vscode.WebviewPanel {
        const mediaRoot = this.mediaRootUri();
        const panel = vscode.window.createWebviewPanel(
            'pyhover.studio',
            'PyHover Studio',
            vscode.ViewColumn.Active,
            {
                enableScripts: true,
                retainContextWhenHidden: false,
                localResourceRoots: [mediaRoot],
            },
        );

        this.disposables.push(
            panel.webview.onDidReceiveMessage(message => {
                if (!isStudioMessage(message)) {
                    return;
                }
                void this.onMessage(message);
            }),
        );

        panel.onDidDispose(() => {
            this.panel = undefined;
            vscode.Disposable.from(...this.disposables).dispose();
            this.disposables = [];
        });

        return panel;
    }

    private mediaRootUri(): vscode.Uri {
        return vscode.Uri.file(path.join(__dirname, '../../../../media'));
    }

    private studioScriptUri(webview: vscode.Webview): string {
        return webview.asWebviewUri(vscode.Uri.joinPath(this.mediaRootUri(), 'studioWebview.js')).toString();
    }

    private renderHtml(webview: vscode.Webview, state: StudioState): string {
        const safeHover = state.lastHoverTitle ? this.escapeHtml(state.lastHoverTitle) : 'none';
        const sections = [
            this.renderSection('Quick Actions', 'Daily commands and maintenance tasks.', [
                this.renderActionRow('Search docs', `${state.indexedSymbols.toLocaleString()} indexed symbols ready to search.`, 'python-hover.searchDocs', 'Search docs', 'primary'),
                this.renderActionRow('Browse modules', 'Open the indexed module browser when you know the library but not the symbol.', 'python-hover.browseModule', 'Browse modules'),
                this.renderActionRow('Pin last hover', state.lastHoverTitle ? `Current target: ${safeHover}` : 'Hover a Python symbol first, then pin it here.', 'python-hover.pinLast', 'Pin last hover'),
                this.renderActionRow('Hover history', 'Jump back through recent hover targets.', 'python-hover.showHistory', 'Open history'),
                this.renderSettingsRow('Advanced settings', 'Open VS Code settings for the full Python Hover configuration surface.', 'python-hover', 'Open settings'),
            ]),
            this.renderSection('Corpus And Cache', 'Build, cancel, and clear the on-disk docs cache.', [
                this.renderActionRow(
                    state.isBuildingPythonStdlibCorpus ? 'Stdlib corpus build running' : 'Build stdlib corpus',
                    state.isBuildingPythonStdlibCorpus
                        ? 'A stdlib corpus build is in progress. You can cancel it now.'
                        : (state.hasPythonStdlibCorpus
                            ? `${state.pythonStdlibCorpusEntries.toLocaleString()} stdlib entries across ${state.pythonStdlibCorpusPackages.toLocaleString()} buckets.`
                            : 'Build once for richer builtins, keywords, and stdlib member hovers.'),
                    state.isBuildingPythonStdlibCorpus ? 'python-hover.cancelPythonCorpusBuild' : 'python-hover.buildPythonCorpus',
                    state.isBuildingPythonStdlibCorpus ? 'Cancel build' : 'Build corpus',
                    state.isBuildingPythonStdlibCorpus ? 'danger' : 'primary',
                ),
                this.renderActionRow('Clear docs cache', `General docs cache: ${this.escapeHtml(state.cacheSizeLabel)}. Keeps the stdlib corpus intact.`, 'python-hover.clearCache', 'Clear docs cache'),
                this.renderActionRow('Clear stdlib corpus', `Stdlib corpus cache: ${this.escapeHtml(state.corpusSizeLabel)}. Removes only the Python stdlib corpus.`, 'python-hover.clearStdlibCorpus', 'Clear stdlib corpus'),
                this.renderActionRow('Clear everything', `Total on-disk cache: ${this.escapeHtml(state.fullCacheSizeLabel)}. Removes docs, inventories, runtime cache, and stdlib corpus.`, 'python-hover.clearAllCache', 'Clear all cache', 'danger'),
                this.renderActionRow('Open cache folder', 'Inspect cached files directly in Finder.', 'python-hover.openCacheFolder', 'Open cache folder'),
                this.renderActionRow('Show logs', 'Open the PyHover output channel for resolver and fetch logs.', 'python-hover.showLogs', 'Open logs'),
            ]),
            this.renderSection('Hover Display', 'Keep the hover compact while preserving the parts you still care about.', [
                this.renderToggleRow('Compact mode', 'Prefer shorter hover content and less chrome.', 'python-hover.ui.compactMode', state.compactMode),
                this.renderToggleRow('Toolbar actions', 'Show pin, docs, source, and browse actions in the hover.', 'python-hover.ui.showToolbar', state.showToolbar),
                this.renderToggleRow('Badges', 'Show async, deprecated, property, and overload badges.', 'python-hover.ui.showBadges', state.showBadges),
                this.renderToggleRow('Metadata chips', 'Show kind, source, module, and version chips under the title.', 'python-hover.ui.showMetadataChips', state.showMetadataChips),
                this.renderToggleRow('Source provenance', 'Show where the visible docs content came from.', 'python-hover.ui.showProvenance', state.showProvenance),
                this.renderToggleRow('Signatures', 'Render signatures near the top of the hover.', 'python-hover.ui.showSignatures', state.showSignatures),
                this.renderToggleRow('Return details', 'Render return type details when available.', 'python-hover.ui.showReturnTypes', state.showReturnTypes),
                this.renderToggleRow('Practical examples', 'Keep short worked examples visible inside the hover.', 'python-hover.showPracticalExamples', state.showPracticalExamples),
                this.renderToggleRow('Callouts', 'Show deprecation, version, and protocol callout blocks.', 'python-hover.ui.showCallouts', state.showCallouts),
                this.renderNumberRow('Content length', 'Maximum characters before the hover truncates to docs.', 'python-hover.ui.maxContentLength', state.maxContentLength, 200, 2000, 100, 'chars'),
                this.renderNumberRow('Snippet lines', 'Maximum lines to keep from inline code examples.', 'python-hover.maxSnippetLines', state.maxSnippetLines, 1, 100, 1, 'lines'),
                this.renderPresetRow('Presets', 'Apply a coherent hover profile instead of changing individual controls one by one.', [
                    { id: 'focused', label: 'Focused' },
                    { id: 'balanced', label: 'Balanced' },
                    { id: 'deepDocs', label: 'Deep docs' },
                ], state.activePreset),
            ]),
            this.renderSection('Hover Depth', 'Decide how much structured detail stays visible before users open full docs.', [
                this.renderToggleRow('Parameters', 'Show the parameters section.', 'python-hover.ui.showParameters', state.showParameters),
                this.renderNumberRow('Max parameters', 'Cap the number of parameters before the rest stay in docs.', 'python-hover.ui.maxParameters', state.maxParameters, 1, 20, 1, 'items'),
                this.renderToggleRow('Raises', 'Show exception information when docs include it.', 'python-hover.ui.showRaises', state.showRaises),
                this.renderToggleRow('See also', 'Show related symbols and references.', 'python-hover.ui.showSeeAlso', state.showSeeAlso),
                this.renderNumberRow('Max see also', 'Maximum related references shown inline.', 'python-hover.ui.maxSeeAlsoItems', state.maxSeeAlsoItems, 1, 30, 1, 'items'),
                this.renderToggleRow('Module exports', 'Show indexed exports in module hovers.', 'python-hover.ui.showModuleExports', state.showModuleExports),
                this.renderNumberRow('Max module exports', 'Limit the exported names rendered inside module hovers.', 'python-hover.ui.maxModuleExports', state.maxModuleExports, 1, 100, 1, 'items'),
                this.renderToggleRow('Module stats', 'Show module summary stats like version and export counts.', 'python-hover.ui.showModuleStats', state.showModuleStats),
                this.renderToggleRow('Footer', 'Show the compact footer region.', 'python-hover.ui.showFooter', state.showFooter),
                this.renderToggleRow('Import hints', 'Show import suggestions in the hover footer.', 'python-hover.ui.showImportHints', state.showImportHints),
                this.renderNumberRow('Max examples', 'Keep only the first examples inline and leave the rest in docs.', 'python-hover.ui.maxExamples', state.maxExamples, 1, 10, 1, 'items'),
            ]),
            this.renderSection('Docs And Performance', 'Tune discovery, enrichment, and latency.', [
                this.renderToggleRow('Online discovery', 'Allow web inventory and docs fetching.', 'python-hover.onlineDiscovery', state.onlineDiscovery),
                this.renderToggleRow('Runtime helper', 'Use the Python helper for richer installed-package and keyword insight.', 'python-hover.runtimeHelper', state.runtimeHelper),
                this.renderToggleRow('AST fallback', 'Recover symbol identity when the language server is incomplete.', 'python-hover.astFallback', state.astFallback),
                this.renderToggleRow('Doc scraping', 'Fetch and structure third-party docs pages for richer hovers.', 'python-hover.docScraping', state.docScraping),
                this.renderToggleRow('Build full package corpus', 'Scrape full package docs in the background on first hover.', 'python-hover.buildFullCorpus', state.buildFullCorpus),
                this.renderToggleRow('Warm imports', 'Preload inventories for imported packages in the active editor.', 'python-hover.warmupImports', state.warmupImports),
                this.renderToggleRow('Known docs map', 'Prefer bundled docs roots for popular libraries.', 'python-hover.useKnownDocsUrls', state.useKnownDocsUrls),
                this.renderToggleRow('Diagnostics', 'Show deprecated symbol diagnostics in the editor.', 'python-hover.diagnostics.enabled', state.diagnosticsEnabled),
                this.renderToggleRow('Debug logging', 'Keep verbose logging available in the output channel.', 'python-hover.enableDebugLogging', state.enableDebugLogging),
                this.renderChoiceRow('Official docs links', 'Choose where official docs open.', 'python-hover.docsBrowser', state.docsBrowser, [
                    { value: 'integrated', label: 'Integrated' },
                    { value: 'external', label: 'External' },
                ]),
                this.renderToggleRow('Redirect integrated hover docs', 'When official docs links stay integrated, send hover Docs actions to the PyHover docs page instead of the side browser.', 'python-hover.ui.redirectIntegratedHoverToDocsPage', state.redirectIntegratedHoverToDocsPage),
                this.renderToggleRow('Auto-open current hover in browser', 'When the integrated docs panel is already open, replace its current page with the latest hover target automatically.', 'python-hover.ui.autoOpenCurrentHoverInIntegratedDocs', state.autoOpenCurrentHoverInIntegratedDocs),
                this.renderChoiceRow('DevDocs links', 'Choose where DevDocs searches open.', 'python-hover.devdocsBrowser', state.devdocsBrowser, [
                    { value: 'integrated', label: 'Integrated' },
                    { value: 'external', label: 'External' },
                ]),
                this.renderNumberRow('HTTP timeout', 'Request timeout for docs fetching.', 'python-hover.requestTimeout', state.requestTimeout, 1000, 60000, 1000, 'ms'),
                this.renderNumberRow('Hover activation delay', 'Additional debounce before PyHover resolves a hover.', 'python-hover.hoverActivationDelay', state.hoverActivationDelay, 0, 2000, 25, 'ms'),
                this.renderSettingsRow('Python docs version', 'Switch the docs target version or leave it on auto-detect.', 'python-hover.docsVersion', 'Open version setting'),
                this.renderSettingsRow('Preload packages', 'Choose packages to warm up on startup for faster first hovers.', 'python-hover.preloadPackages', 'Open preload settings'),
                this.renderSettingsRow('Exclude patterns', 'Keep generated, vendored, or irrelevant files out of PyHover.', 'python-hover.excludePatterns', 'Open exclude settings'),
                this.renderInfoRow('Cache retention', `Inventories: ${state.inventoryCacheDays} days · scraped pages: ${state.snippetCacheHours} hours`),
            ]),
            this.renderSection('Module Browser', 'Tune the indexed browser before you open it.', [
                this.renderChoiceRow('Default view', 'Open the browser in hierarchy or flat mode.', 'python-hover.ui.moduleBrowser.defaultView', state.moduleBrowserDefaultView, [
                    { value: 'hierarchy', label: 'Hierarchy' },
                    { value: 'flat', label: 'Flat' },
                ]),
                this.renderChoiceRow('Default sort', 'Choose which field leads the initial result ordering.', 'python-hover.ui.moduleBrowser.defaultSort', state.moduleBrowserDefaultSort, [
                    { value: 'name', label: 'Name' },
                    { value: 'kind', label: 'Kind' },
                    { value: 'package', label: 'Package' },
                ]),
                this.renderChoiceRow('Density', 'Prefer roomier cards or a tighter scan-friendly list.', 'python-hover.ui.moduleBrowser.defaultDensity', state.moduleBrowserDefaultDensity, [
                    { value: 'comfortable', label: 'Comfortable' },
                    { value: 'compact', label: 'Compact' },
                ]),
                this.renderToggleRow('Private symbols', 'Keep underscore-prefixed members visible in the browser.', 'python-hover.ui.moduleBrowser.showPrivateSymbols', state.moduleBrowserShowPrivateSymbols),
                this.renderToggleRow('Auto-load previews', 'Resolve preview cards automatically when the browser opens.', 'python-hover.ui.moduleBrowser.autoLoadPreviews', state.moduleBrowserAutoLoadPreviews),
                this.renderToggleRow('Hierarchy hints', 'Show namespace breadcrumbs and parentage cues.', 'python-hover.ui.moduleBrowser.showHierarchyHints', state.moduleBrowserShowHierarchyHints),
                this.renderSettingsRow('Advanced module browser settings', 'Open the full module browser settings group in VS Code.', 'python-hover.ui.moduleBrowser', 'Open module browser settings'),
            ]),
            this.renderSection('Interface', 'Control persistent chrome and editor context menu entries.', [
                this.renderToggleRow('Status bar', 'Show the single PyHover status bar entry.', 'python-hover.ui.showStatusBar', state.showStatusBar),
                this.renderToggleRow('Hover debug button', 'Show the Debug button in the hover toolbar.', 'python-hover.ui.showDebugPinButton', state.showDebugPinButton),
                this.renderToggleRow('Context menu commands', 'Master toggle for all PyHover entries in the Python editor context menu.', 'python-hover.ui.contextMenu.enabled', state.contextMenuEnabled),
                this.renderToggleRow('Context menu: Search docs', 'Show Search Docs in the Python editor context menu.', 'python-hover.ui.contextMenu.searchDocs', state.contextMenuSearchDocs),
                this.renderToggleRow('Context menu: Browse module', 'Show Browse Module in the Python editor context menu.', 'python-hover.ui.contextMenu.browseModule', state.contextMenuBrowseModule),
                this.renderToggleRow('Context menu: Pin hover', 'Show Pin Hover in the Python editor context menu.', 'python-hover.ui.contextMenu.pinHover', state.contextMenuPinHover),
                this.renderToggleRow('Context menu: Debug pin', 'Show Debug Pin Hover in the Python editor context menu.', 'python-hover.ui.contextMenu.debugPinHover', state.contextMenuDebugPinHover),
                this.renderToggleRow('Context menu: Open Studio', 'Show Open Studio in the Python editor context menu.', 'python-hover.ui.contextMenu.openStudio', state.contextMenuOpenStudio),
            ]),
        ].join('');
        const scriptUri = this.studioScriptUri(webview);

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${webview.cspSource}; script-src ${webview.cspSource}; base-uri 'none';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PyHover Studio</title>
<style>
    :root {
        color-scheme: light dark;
        --bg: var(--vscode-editor-background);
        --panel: color-mix(in srgb, var(--bg) 95%, var(--vscode-editor-foreground) 5%);
        --panel-alt: color-mix(in srgb, var(--bg) 92%, var(--vscode-editor-foreground) 8%);
        --fg: var(--vscode-editor-foreground);
        --muted: var(--vscode-descriptionForeground);
        --border: color-mix(in srgb, var(--vscode-editor-foreground) 14%, transparent);
        --border-strong: color-mix(in srgb, var(--vscode-editor-foreground) 24%, transparent);
        --accent: var(--vscode-textLink-foreground);
        --button: var(--vscode-button-background);
        --button-fg: var(--vscode-button-foreground);
        --button-secondary: var(--vscode-button-secondaryBackground);
        --button-secondary-fg: var(--vscode-button-secondaryForeground);
        --success: var(--vscode-testing-iconPassed, #2ea043);
        --danger: var(--vscode-testing-iconFailed, #d73a49);
    }
    * { box-sizing: border-box; }
    html, body {
        margin: 0;
        padding: 0;
        background:
            radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 9%, transparent), transparent 38%),
            var(--bg);
        color: var(--fg);
        font: 13px/1.5 var(--vscode-font-family);
    }
    button, input { font: inherit; }
    .shell {
        width: min(1180px, 100%);
        margin: 0 auto;
        padding: 16px;
        display: grid;
        gap: 14px;
    }
    .header,
    .section,
    .summary {
        border: 1px solid var(--border);
        border-radius: 16px;
        background: var(--panel);
    }
    .header {
        display: grid;
        gap: 14px;
        padding: 16px;
        background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 10%, var(--panel-alt)), var(--panel));
    }
    .header-top {
        display: grid;
        grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.95fr);
        gap: 12px;
    }
    .header-actions {
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 12px;
        background: color-mix(in srgb, var(--bg) 97%, var(--fg) 3%);
        display: grid;
        gap: 10px;
        align-content: start;
    }
    .header-status-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
    }
    .header-status-card {
        display: grid;
        gap: 4px;
        padding: 10px;
        border-radius: 12px;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--bg) 96%, var(--fg) 4%);
    }
    .header-status-card strong {
        font-size: 13px;
        line-height: 1.25;
    }
    .header h1,
    .section h2,
    .row h3,
    .summary strong,
    .eyebrow,
    p {
        margin: 0;
    }
    .eyebrow {
        display: inline-flex;
        width: fit-content;
        padding: 2px 8px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--accent) 12%, transparent);
        color: var(--accent);
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }
    .header h1,
    .section h2 {
        font-size: 18px;
        line-height: 1.2;
        font-weight: 650;
    }
    .muted,
    .header-copy,
    .row-copy,
    .summary small {
        color: var(--muted);
    }
    .summary-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
    }
    .summary {
        display: grid;
        gap: 4px;
        padding: 10px 12px;
    }
    .summary strong {
        font-size: 16px;
        font-weight: 650;
    }
    .chips,
    .actions,
    .segments {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }
    .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 9px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--bg) 96%, var(--fg) 4%);
        color: var(--muted);
        font-size: 12px;
    }
    .section {
        display: grid;
        gap: 0;
        overflow: hidden;
    }
    .section-head {
        display: grid;
        gap: 5px;
        padding: 14px 16px;
        border-bottom: 1px solid var(--border);
        background: var(--panel-alt);
    }
    .section-kicker {
        font-size: 11px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--muted);
    }
    .section-body {
        display: grid;
        gap: 10px;
        padding: 12px;
    }
    .row {
        padding: 12px;
        border-radius: 12px;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--bg) 97%, var(--fg) 3%);
    }
    .row-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }
    .row-title {
        display: grid;
        gap: 3px;
        min-width: 0;
    }
    .row h3 {
        font-size: 14px;
        line-height: 1.25;
        font-weight: 650;
    }
    .row:hover {
        border-color: var(--border-strong);
        background: color-mix(in srgb, var(--accent) 6%, var(--bg));
    }
    .button,
    .segment,
    .stepper-button,
    .toggle {
        font: inherit;
    }
    .button:focus-visible,
    .segment:focus-visible,
    .stepper-button:focus-visible,
    .toggle:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
    }
    .button,
    .segment,
    .stepper-button {
        border: 1px solid var(--border);
        border-radius: 8px;
        cursor: pointer;
        background: transparent;
        color: var(--fg);
        padding: 7px 10px;
    }
    .button:hover,
    .segment:hover,
    .stepper-button:hover {
        border-color: var(--border-strong);
        background: color-mix(in srgb, var(--accent) 8%, var(--bg));
    }
    .button.primary {
        background: var(--button);
        color: var(--button-fg);
        border-color: transparent;
    }
    .button.secondary {
        background: var(--button-secondary);
        color: var(--button-secondary-fg);
        border-color: transparent;
    }
    .button.danger {
        border-color: color-mix(in srgb, var(--danger) 45%, transparent);
        color: var(--danger);
    }
    .segment.active {
        color: var(--accent);
        border-color: color-mix(in srgb, var(--accent) 34%, transparent);
        background: color-mix(in srgb, var(--accent) 12%, var(--bg));
    }
    .toggle {
        appearance: none;
        width: 40px;
        height: 22px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--fg) 14%, transparent);
        position: relative;
        border: 1px solid transparent;
        cursor: pointer;
        flex-shrink: 0;
    }
    .toggle::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: white;
        transition: transform 100ms ease;
    }
    .toggle:checked {
        background: color-mix(in srgb, var(--success) 80%, transparent);
    }
    .toggle:checked::after {
        transform: translateX(18px);
    }
    .stepper {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border: 1px solid var(--border);
        border-radius: 999px;
        padding: 4px;
        background: color-mix(in srgb, var(--bg) 95%, var(--fg) 5%);
    }
    .stepper-button {
        width: 28px;
        height: 28px;
        border-radius: 999px;
        padding: 0;
    }
    .stepper-value {
        min-width: 90px;
        text-align: center;
        font-weight: 600;
    }
    .action-copy {
        color: var(--muted);
        font-size: 12px;
    }
    @media (max-width: 900px) {
        .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .header-top {
            grid-template-columns: 1fr;
        }
        .header-status-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
    }
    @media (max-width: 640px) {
        .shell {
            padding: 10px;
        }
        .summary-grid {
            grid-template-columns: 1fr;
        }
        .header-status-grid {
            grid-template-columns: 1fr;
        }
        .row-head {
            flex-direction: column;
            align-items: stretch;
        }
    }
</style>
</head>
<body>
<div class="shell">
    <header class="header">
        <div class="header-top">
            <div>
                <div class="eyebrow">PyHover Studio</div>
                <h1>Simple controls for hover quality, caches, and editor chrome.</h1>
                <p class="header-copy">The controls here write to real extension settings and commands. Use Studio when you want fast, intentional tuning instead of digging through settings JSON.</p>
            </div>
            <div class="header-actions">
                <div class="section-kicker">Quick launch</div>
                <div class="actions">
                    <button class="button secondary" data-run-command="python-hover.searchDocs" data-focus-id="header:searchDocs">Search docs</button>
                    <button class="button secondary" data-run-command="python-hover.browseModule" data-focus-id="header:browseModule">Browse modules</button>
                    <button class="button" data-open-settings="python-hover" data-focus-id="header:settings">Open settings</button>
                </div>
                <div class="header-status-grid">
                    <article class="header-status-card"><small>Docs routing</small><strong>${this.escapeHtml(this.formatDocsRoutingLabel(state.docsBrowser, state.devdocsBrowser, state.redirectIntegratedHoverToDocsPage, state.autoOpenCurrentHoverInIntegratedDocs))}</strong><small>Official and DevDocs links keep the same opening behavior unless hover docs redirection or auto-open is enabled.</small></article>
                    <article class="header-status-card"><small>Hover profile</small><strong>${this.escapeHtml(this.formatHoverProfileLabel(state.compactMode, state.activePreset))}</strong><small>Quick read density and content depth are aligned here first.</small></article>
                    <article class="header-status-card"><small>Discovery</small><strong>${this.escapeHtml(this.formatDiscoveryLabel(state.onlineDiscovery, state.docScraping, state.runtimeHelper))}</strong><small>Web fetches, scraping, and local Python help are summarized at a glance.</small></article>
                    <article class="header-status-card"><small>Module browser</small><strong>${this.escapeHtml(this.formatBrowserLabel(state.moduleBrowserDefaultView, state.moduleBrowserDefaultDensity))}</strong><small>Open the browser with the default shape you actually want to scan.</small></article>
                </div>
                <p class="action-copy">Focus on the hover, docs search, and browser first. Everything else here is for shaping how much information PyHover surfaces and where it opens.</p>
            </div>
        </div>
        <div class="chips">
            <span class="chip">v${this.escapeHtml(state.version)}</span>
            <span class="chip">Preset ${this.escapeHtml(this.formatPresetLabel(state.activePreset))}</span>
            <span class="chip">${state.indexedSymbols.toLocaleString()} indexed symbols</span>
            <span class="chip">Cache ${this.escapeHtml(state.fullCacheSizeLabel)}</span>
            <span class="chip">Stdlib ${this.escapeHtml(state.corpusSizeLabel)}</span>
            <span class="chip">Last hover: ${safeHover}</span>
            <span class="chip">${state.isBuildingPythonStdlibCorpus ? 'Corpus build running' : 'Corpus build idle'}</span>
        </div>
        <div class="summary-grid">
            <article class="summary"><small>General cache</small><strong>${this.escapeHtml(state.cacheSizeLabel)}</strong><small>Docs pages, inventories, and runtime cache.</small></article>
            <article class="summary"><small>Stdlib corpus</small><strong>${this.escapeHtml(state.corpusSizeLabel)}</strong><small>${state.hasPythonStdlibCorpus ? `${state.pythonStdlibCorpusEntries.toLocaleString()} entries across ${state.pythonStdlibCorpusPackages.toLocaleString()} buckets.` : 'Not built yet.'}</small></article>
            <article class="summary"><small>Hover target</small><strong>${safeHover}</strong><small>${state.lastHoverTitle ? 'Current hover target captured.' : 'Hover a Python symbol to populate this.'}</small></article>
            <article class="summary"><small>Index</small><strong>${state.indexedSymbols.toLocaleString()}</strong><small>Searchable symbols from cached inventories and corpora.</small></article>
        </div>
    </header>

    ${sections}
</div>

<script src="${scriptUri}"></script>
</body>
</html>`;
    }

    private renderSection(title: string, copy: string, rows: string[]): string {
        return `<section class="section"><div class="section-head"><div class="section-kicker">Settings group</div><h2>${this.escapeHtml(title)}</h2><p class="muted">${this.escapeHtml(copy)}</p></div><div class="section-body">${rows.join('')}</div></section>`;
    }

    private renderActionRow(title: string, copy: string, command: string, buttonLabel: string, tone: 'primary' | 'secondary' | 'danger' = 'secondary'): string {
        return `<article class="row"><div class="row-head"><div class="row-title"><h3>${this.escapeHtml(title)}</h3><p class="row-copy">${this.escapeHtml(copy)}</p></div><button class="button ${tone}" data-run-command="${this.escapeHtml(command)}" data-focus-id="command:${this.escapeHtml(command)}">${this.escapeHtml(buttonLabel)}</button></div></article>`;
    }

    private renderSettingsRow(title: string, copy: string, query: string, buttonLabel: string): string {
        return `<article class="row"><div class="row-head"><div class="row-title"><h3>${this.escapeHtml(title)}</h3><p class="row-copy">${this.escapeHtml(copy)}</p></div><button class="button" data-open-settings="${this.escapeHtml(query)}" data-focus-id="settings:${this.escapeHtml(query)}">${this.escapeHtml(buttonLabel)}</button></div></article>`;
    }

    private renderToggleRow(title: string, copy: string, key: string, value: boolean): string {
        return `<article class="row"><div class="row-head"><div class="row-title"><h3>${this.escapeHtml(title)}</h3><p class="row-copy">${this.escapeHtml(copy)}</p></div><input class="toggle" type="checkbox" data-toggle-key="${this.escapeHtml(key)}" data-focus-id="toggle:${this.escapeHtml(key)}" ${value ? 'checked' : ''}></div></article>`;
    }

    private renderChoiceRow(title: string, copy: string, key: string, value: string, options: Array<{ value: string; label: string }>): string {
        const segments = options.map(option => {
            const active = option.value === value ? ' active' : '';
            return `<button class="segment${active}" data-choice-key="${this.escapeHtml(key)}" data-choice-value="${this.escapeHtml(option.value)}" data-focus-id="choice:${this.escapeHtml(key)}:${this.escapeHtml(option.value)}">${this.escapeHtml(option.label)}</button>`;
        }).join('');

        return `<article class="row"><div class="row-title"><h3>${this.escapeHtml(title)}</h3><p class="row-copy">${this.escapeHtml(copy)}</p></div><div class="segments">${segments}</div></article>`;
    }

    private renderNumberRow(title: string, copy: string, key: string, value: number, min: number, max: number, step: number, unit: string): string {
        return `<article class="row"><div class="row-head"><div class="row-title"><h3>${this.escapeHtml(title)}</h3><p class="row-copy">${this.escapeHtml(copy)}</p></div><div class="stepper"><button class="stepper-button" data-number-key="${this.escapeHtml(key)}" data-number-value="${value}" data-number-min="${min}" data-number-max="${max}" data-number-step="-${step}" data-focus-id="number:${this.escapeHtml(key)}:decrement">−</button><div class="stepper-value">${this.escapeHtml(this.formatNumberValue(value, unit))}</div><button class="stepper-button" data-number-key="${this.escapeHtml(key)}" data-number-value="${value}" data-number-min="${min}" data-number-max="${max}" data-number-step="${step}" data-focus-id="number:${this.escapeHtml(key)}:increment">+</button></div></div></article>`;
    }

    private renderInfoRow(title: string, copy: string): string {
        return `<article class="row"><div class="row-title"><h3>${this.escapeHtml(title)}</h3><p class="row-copy">${this.escapeHtml(copy)}</p></div></article>`;
    }

    private renderPresetRow(title: string, copy: string, presets: Array<{ id: string; label: string }>, activePreset: StudioActivePreset): string {
        const buttons = presets.map(preset => {
            const active = preset.id === activePreset ? ' active' : '';
            return `<button class="segment${active}" data-preset="${this.escapeHtml(preset.id)}" data-focus-id="preset:${this.escapeHtml(preset.id)}">${this.escapeHtml(preset.label)}</button>`;
        }).join('');
        const nextCopy = `${copy} Current profile: ${this.formatPresetLabel(activePreset)}.`;
        return `<article class="row"><div class="row-title"><h3>${this.escapeHtml(title)}</h3><p class="row-copy">${this.escapeHtml(nextCopy)}</p></div><div class="segments">${buttons}</div></article>`;
    }

    private formatNumberValue(value: number, unit: string): string {
        if (unit === 'ms' && value >= 1000) {
            return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)} s`;
        }
        return `${value} ${unit}`;
    }

    private formatPresetLabel(preset: StudioActivePreset): string {
        switch (preset) {
            case 'focused':
                return 'Focused';
            case 'deepDocs':
                return 'Deep docs';
            case 'balanced':
                return 'Balanced';
            default:
                return 'Custom';
        }
    }

    private formatDocsRoutingLabel(docsBrowser: StudioState['docsBrowser'], devdocsBrowser: StudioState['devdocsBrowser'], redirectIntegratedHoverToDocsPage: boolean, autoOpenCurrentHoverInIntegratedDocs: boolean): string {
        const docsLabel = docsBrowser === 'integrated' ? 'Integrated docs' : 'External docs';
        const devdocsLabel = devdocsBrowser === 'integrated' ? 'integrated DevDocs' : 'external DevDocs';
        let hoverLabel = 'manual browser';
        if (docsBrowser === 'integrated' && redirectIntegratedHoverToDocsPage) {
            hoverLabel = 'hover docs page';
        } else if (docsBrowser === 'integrated' && autoOpenCurrentHoverInIntegratedDocs) {
            hoverLabel = 'auto-open browser';
        } else if (docsBrowser === 'integrated') {
            hoverLabel = 'manual browser';
        }
        return `${docsLabel} + ${devdocsLabel} • ${hoverLabel}`;
    }

    private formatHoverProfileLabel(compactMode: boolean, activePreset: StudioActivePreset): string {
        const density = compactMode ? 'Compact' : 'Standard';
        return `${density} • ${this.formatPresetLabel(activePreset)}`;
    }

    private formatDiscoveryLabel(onlineDiscovery: boolean, docScraping: boolean, runtimeHelper: boolean): string {
        const mode = onlineDiscovery ? 'Online' : 'Offline';
        const scraping = docScraping ? 'scraping on' : 'scraping off';
        const helper = runtimeHelper ? 'runtime helper on' : 'runtime helper off';
        return `${mode} • ${scraping} • ${helper}`;
    }

    private formatBrowserLabel(view: StudioState['moduleBrowserDefaultView'], density: StudioState['moduleBrowserDefaultDensity']): string {
        const nextView = view === 'hierarchy' ? 'Hierarchy' : 'Flat';
        const nextDensity = density === 'comfortable' ? 'comfortable' : 'compact';
        return `${nextView} • ${nextDensity}`;
    }

    private escapeHtml(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}
