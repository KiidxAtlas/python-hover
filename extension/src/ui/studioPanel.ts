import * as vscode from 'vscode';

export type StudioState = {
    version: string;
    onlineDiscovery: boolean;
    runtimeHelper: boolean;
    astFallback: boolean;
    docScraping: boolean;
    buildFullCorpus: boolean;
    enableDebugLogging: boolean;
    docsBrowser: 'integrated' | 'external';
    devdocsBrowser: 'integrated' | 'external';
    indexedSymbols: number;
    cacheSizeLabel: string;
    corpusSizeLabel: string;
    pythonStdlibCorpusPackages: number;
    pythonStdlibCorpusEntries: number;
    hasPythonStdlibCorpus: boolean;
    lastHoverTitle?: string;
    indexedPackages?: { name: string; count: number }[];
};

export type StudioMessage =
    | { type: 'run-command'; command: string }
    | { type: 'open-settings'; query?: string }
    | { type: 'update-setting'; key: string; value: boolean | string };

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
        if (!this.panel) return;
        this.panel.title = 'PyHover';
        this.panel.webview.html = this.renderHtml(state);
    }

    dispose(): void {
        this.panel?.dispose();
        this.panel = undefined;
    }

    private createPanel(): vscode.WebviewPanel {
        const panel = vscode.window.createWebviewPanel(
            'pyhover.studio',
            'PyHover',
            vscode.ViewColumn.Active,
            {
                enableScripts: true,
                retainContextWhenHidden: false,
            },
        );

        this.disposables.push(
            panel.webview.onDidReceiveMessage(message => {
                void this.onMessage(message as StudioMessage);
            })
        );

        panel.onDidDispose(() => {
            this.panel = undefined;
            vscode.Disposable.from(...this.disposables).dispose();
            this.disposables = [];
        });

        return panel;
    }

    private renderHtml(state: StudioState): string {
        const nonce = `${Date.now()}`;
        const serializedState = JSON.stringify(state)
            .replace(/</g, '\\u003c')
            .replace(/>/g, '\\u003e')
            .replace(/&/g, '\\u0026');

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PyHover</title>
<style>
    :root {
        color-scheme: light dark;
        --bg: var(--vscode-editor-background);
        --fg: var(--vscode-editor-foreground);
        --muted: var(--vscode-descriptionForeground);
        --sidebar: color-mix(in srgb, var(--bg) 93%, var(--fg) 7%);
        --border: color-mix(in srgb, var(--fg) 12%, transparent);
        --border-strong: color-mix(in srgb, var(--fg) 20%, transparent);
        --accent: var(--vscode-textLink-foreground);
        --success: var(--vscode-testing-iconPassed, #2ea043);
        --button: var(--vscode-button-background);
        --button-fg: var(--vscode-button-foreground);
        --button-secondary: var(--vscode-button-secondaryBackground);
        --button-secondary-fg: var(--vscode-button-secondaryForeground);
    }

    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: var(--bg); color: var(--fg); }
    body {
        font-family: var(--vscode-font-family);
        font-size: 13px;
        line-height: 1.5;
    }

    .app {
        min-height: 100vh;
        display: grid;
        grid-template-columns: 192px minmax(0, 1fr);
    }

    .sidebar {
        border-right: 1px solid var(--border);
        background: var(--sidebar);
        padding: 12px 10px;
        display: grid;
        grid-template-rows: auto 1fr auto;
        gap: 8px;
    }

    /* suppress heavy header elements */
    .scope-chip,
    .sidebar h1,
    .sidebar > div > p,
    .toolbar-copy .eyebrow,
    .section-head {
        display: none;
    }

    .eyebrow {
        font-size: 10px;
        color: var(--muted);
        margin-bottom: 4px;
        letter-spacing: 0.05em;
    }

    .sidebar p,
    .meta-note,
    .card-detail,
    .section-copy,
    .stat-label,
    .empty-copy {
        color: var(--muted);
    }

    .nav {
        display: grid;
        gap: 2px;
        align-content: start;
    }

    .nav-item {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        border: 1px solid transparent;
        border-radius: 5px;
        background: transparent;
        color: inherit;
        padding: 6px 8px;
        font-size: 12px;
        text-align: left;
        cursor: pointer;
        transition: background 100ms ease, border-color 100ms ease;
    }

    .nav-item:hover {
        background: color-mix(in srgb, var(--accent) 6%, var(--bg));
        border-color: var(--border);
    }

    .nav-item.active {
        background: color-mix(in srgb, var(--accent) 9%, var(--bg));
        border-color: color-mix(in srgb, var(--accent) 22%, var(--border));
    }

    .nav-title {
        font-weight: 500;
    }

    .nav-copy {
        display: none;
    }

    .nav-count {
        min-width: 18px;
        height: 18px;
        display: inline-grid;
        place-items: center;
        border-radius: 999px;
        background: color-mix(in srgb, var(--fg) 8%, transparent);
        font-size: 10px;
        color: var(--muted);
    }

    .sidebar-footer {
        border-top: 1px solid var(--border);
        padding: 8px 2px 0;
        font-size: 12px;
    }

    .sidebar-footer strong {
        display: block;
        margin-bottom: 2px;
        font-size: 12px;
        font-weight: 500;
    }

    .main {
        min-width: 0;
        padding: 14px;
        display: grid;
        gap: 10px;
        align-content: start;
    }

    .toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }

    .toolbar-copy h2 {
        margin: 0;
        font-size: 14px;
        font-weight: 500;
        line-height: 1.3;
    }

    .toolbar-copy p {
        margin: 3px 0 0;
        font-size: 12px;
        color: var(--muted);
    }

    .toolbar-actions,
    .card-actions,
    .segmented {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
    }

    .button,
    .segment-button,
    .search,
    .toggle {
        font: inherit;
    }

    .button,
    .segment-button {
        border-radius: 5px;
        padding: 5px 9px;
        font-size: 12px;
        border: 1px solid transparent;
        cursor: pointer;
        transition: filter 100ms ease;
    }

    .button-primary {
        background: var(--button);
        color: var(--button-fg);
    }

    .button-secondary {
        background: var(--button-secondary);
        color: var(--button-secondary-fg);
    }

    .button-ghost,
    .segment-button {
        background: color-mix(in srgb, var(--bg) 86%, var(--fg) 5%);
        color: var(--fg);
        border-color: var(--border);
    }

    .segment-button.active {
        background: color-mix(in srgb, var(--accent) 14%, var(--bg));
        border-color: color-mix(in srgb, var(--accent) 28%, transparent);
        color: var(--accent);
    }

    .searchbar {
        display: block;
    }

    .search {
        width: 100%;
        border-radius: 5px;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--bg) 95%, var(--fg) 4%);
        color: var(--fg);
        padding: 6px 10px;
        font-size: 12px;
        outline: none;
    }

    .search:focus {
        border-color: color-mix(in srgb, var(--accent) 38%, transparent);
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 20%, transparent);
    }

    .summary-strip {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
        gap: 6px;
    }

    .summary-item {
        border-radius: 5px;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--bg) 96%, var(--fg) 4%);
        padding: 8px 10px;
    }

    .summary-item strong {
        display: block;
        font-size: 13px;
        font-weight: 500;
        line-height: 1.3;
        margin-top: 1px;
    }

    .summary-label {
        display: block;
        font-size: 10px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .card-grid {
        display: grid;
        gap: 6px;
    }

    .card {
        border: 1px solid var(--border);
        border-radius: 7px;
        background: color-mix(in srgb, var(--bg) 96%, var(--fg) 4%);
        padding: 10px 12px;
        display: grid;
        gap: 5px;
    }

    .card-badge {
        display: inline-flex;
        width: fit-content;
        align-items: center;
        border-radius: 3px;
        padding: 1px 5px;
        font-size: 10px;
        border: 1px solid var(--border);
        color: var(--muted);
    }

    .card h5 {
        margin: 0;
        font-size: 12px;
        font-weight: 500;
        line-height: 1.3;
    }

    .card p {
        margin: 0;
        font-size: 12px;
        color: var(--muted);
    }

    .card-detail {
        font-size: 11px;
    }

    .toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }

    .toggle {
        appearance: none;
        width: 36px;
        height: 20px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--fg) 14%, transparent);
        position: relative;
        cursor: pointer;
        flex-shrink: 0;
        border: 1px solid transparent;
        transition: background 100ms ease;
    }

    .toggle::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: white;
        transition: transform 100ms ease;
    }

    .toggle:checked {
        background: color-mix(in srgb, var(--success) 78%, transparent);
    }

    .toggle:checked::after {
        transform: translateX(16px);
    }

    .pill-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }

    .pill {
        border-radius: 3px;
        border: 1px solid var(--border);
        padding: 2px 7px;
        font-size: 11px;
        color: var(--muted);
    }

    .empty {
        border: 1px dashed var(--border-strong);
        border-radius: 7px;
        padding: 16px;
        background: color-mix(in srgb, var(--bg) 96%, var(--fg) 3%);
        text-align: center;
    }

    .empty strong {
        display: block;
        margin-bottom: 4px;
        font-size: 13px;
        font-weight: 500;
    }

    .table-wrap {
        overflow-x: auto;
        margin-top: 4px;
    }

    .pkg-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
    }

    .pkg-table th,
    .pkg-table td {
        padding: 4px 8px;
        text-align: left;
        border-bottom: 1px solid var(--border);
    }

    .pkg-table th {
        color: var(--muted);
        font-weight: 500;
        white-space: nowrap;
    }

    .pkg-table td:last-child {
        color: var(--muted);
        text-align: right;
    }

    .pkg-table tbody tr:last-child td {
        border-bottom: none;
    }

    @media (max-width: 1024px) {
        .app {
            grid-template-columns: 1fr;
        }

        .sidebar {
            border-right: none;
            border-bottom: 1px solid var(--border);
        }
    }

    @media (max-width: 720px) {
        .main {
            padding: 12px;
        }

        .toolbar {
            flex-direction: column;
            align-items: stretch;
        }

        .summary-strip {
            grid-template-columns: 1fr 1fr;
        }
    }
</style>
</head>
<body>
<div class="app">
    <aside class="sidebar">
        <div>
            <div class="eyebrow">PyHover</div>
            <h1>Control Panel</h1>
            <p>Focused controls for hover quality, docs, and corpus state.</p>
        </div>
        <div class="scope-chip">Current workspace</div>
        <nav class="nav" id="nav"></nav>
        <div class="sidebar-footer">
            <div class="eyebrow">Current Hover</div>
            <strong id="sidebar-hover-title"></strong>
            <div class="meta-note" id="sidebar-hover-note"></div>
        </div>
    </aside>
    <main class="main">
        <header class="toolbar">
            <div class="toolbar-copy">
                <div class="eyebrow">Editor</div>
                <h2 id="section-title"></h2>
                <p id="section-copy"></p>
            </div>
            <div class="toolbar-actions">
                <button class="button button-primary" data-run-command="python-hover.buildPythonCorpus">Build Corpus</button>
            </div>
        </header>

        <div class="searchbar">
            <input id="search" class="search" type="search" placeholder="Search actions, toggles, and shortcuts">
        </div>

        <section class="summary-strip">
            <div class="summary-item"><span class="summary-label">Indexed</span><strong id="summary-symbols"></strong></div>
            <div class="summary-item"><span class="summary-label">Cache</span><strong id="summary-cache"></strong></div>
            <div class="summary-item"><span class="summary-label">Corpus</span><strong id="summary-corpus"></strong></div>
            <div class="summary-item"><span class="summary-label">Last Hover</span><strong id="summary-hover"></strong></div>
        </section>

        <section>
            <div class="section-head">
                <div>
                    <h4 id="cards-title"></h4>
                    <p class="section-copy" id="cards-copy"></p>
                </div>
            </div>
            <div class="card-grid" id="cards"></div>
        </section>
    </main>
</div>

<script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const state = ${serializedState};
    const restored = vscode.getState() || {};
    let activeCategory = typeof restored.activeCategory === 'string' ? restored.activeCategory : 'overview';
    let searchQuery = typeof restored.searchQuery === 'string' ? restored.searchQuery : '';

    const categories = [
        { id: 'overview', label: 'Overview', copy: 'Workspace status and common actions' },
        { id: 'hover', label: 'Hover Tools', copy: 'Pin, debug, and inspect hover output' },
        { id: 'corpus', label: 'Corpus And Cache', copy: 'Build corpus and manage cached docs' },
        { id: 'browse', label: 'Browse And Search', copy: 'Search docs and explore indexed modules' },
        { id: 'behavior', label: 'Behavior', copy: 'Runtime, scraping, and logging settings' },
        { id: 'links', label: 'Link Targets', copy: 'Where docs links should open' },
        { id: 'settings', label: 'Settings', copy: 'Jump into focused settings pages' },
    ];

    const sections = buildSections(state);
    if (!sections[activeCategory]) {
        activeCategory = 'overview';
    }

    document.getElementById('search').value = searchQuery;
    document.getElementById('search').addEventListener('input', event => {
        searchQuery = event.target.value || '';
        persistViewState();
        render();
    });

    bindStaticButtons();
    populateHero();
    render();

    function persistViewState() {
        vscode.setState({ activeCategory, searchQuery });
    }

    function buildSections(currentState) {
        return {
            overview: {
                title: 'Workspace Overview',
                copy: 'A high-level view of hover quality, corpus readiness, and the commands you will use most.',
                cards: [
                        infoCard(
                            'Workspace summary',
                            currentState.indexedSymbols.toLocaleString() + ' indexed symbols · cache ' + currentState.cacheSizeLabel + ' · corpus ' + currentState.corpusSizeLabel,
                            currentState.hasPythonStdlibCorpus
                                ? currentState.pythonStdlibCorpusPackages.toLocaleString() + ' stdlib package buckets cached with ' + currentState.pythonStdlibCorpusEntries.toLocaleString() + ' entries.'
                                : 'The Python stdlib corpus has not been built yet.',
                            'Status'
                        ),
                    actionCard(
                        'Build Python stdlib corpus',
                        'Fetch and cache richer built-in and keyword docs once.',
                        currentState.hasPythonStdlibCorpus ? 'Refresh the Python corpus when upstream docs or extraction logic change.' : 'Recommended for better stdlib and keyword hovers.',
                        'Build corpus',
                        { type: 'run-command', command: 'python-hover.buildPythonCorpus' },
                        'Corpus'
                    ),
                    actionCard(
                        'Search Python docs',
                        'Search indexed symbols with the built-in docs flow.',
                        'Best for direct symbol lookup.',
                        'Search docs',
                        { type: 'run-command', command: 'python-hover.searchDocs' },
                        'Browse'
                    ),
                    actionCard(
                        'Browse indexed modules',
                        'Open the module browser when you know the package but not the exact symbol.',
                        currentState.indexedSymbols.toLocaleString() + ' indexed symbols currently available.',
                        'Browse modules',
                        { type: 'run-command', command: 'python-hover.browseModule' },
                        'Browse'
                    ),
                    actionCard(
                        'Open PyHover settings',
                        'Jump straight to the extension settings.',
                        'Use focused settings pages instead of digging through the full settings tree.',
                        'Open settings',
                        { type: 'open-settings', query: 'python-hover' },
                        'Settings'
                    ),
                ],
            },
            hover: {
                title: 'Hover Tools',
                copy: 'Pin the current hover, inspect the raw payload, and jump into logs when content or routing looks wrong.',
                cards: [
                    infoCard(
                        'Current hover target',
                        currentState.lastHoverTitle || 'No hover pinned yet',
                        currentState.lastHoverTitle
                            ? 'Pin or debug the most recent resolved hover target.'
                            : 'Hover a Python symbol first, then return here to pin or debug it.',
                        'Hover'
                    ),
                    actionCard(
                        'Pin current hover',
                        'Open the pinned hover panel.',
                        'Uses the exact hovered token when launched from the hover toolbar.',
                        'Pin hover',
                        { type: 'run-command', command: 'python-hover.pinHover' },
                        'Action'
                    ),
                    actionCard(
                        'Debug current hover',
                        'Open the hover debug view with rendered markdown and raw payload.',
                        'Use this when a hover appears wrong or incomplete.',
                        'Debug hover',
                        { type: 'run-command', command: 'python-hover.debugPinHover' },
                        'Action'
                    ),
                    actionCard(
                        'Show logs',
                        'Open the PyHover output channel.',
                        'Useful for tracing resolver and corpus behavior.',
                        'Open logs',
                        { type: 'run-command', command: 'python-hover.showLogs' },
                        'Diagnostics'
                    ),
                ],
            },
            corpus: {
                title: 'Corpus And Cache',
                copy: 'Manage the Python stdlib corpus separately from the normal docs cache so richer hovers stay intact.',
                cards: [
                        infoCard(
                            'Python corpus status',
                            currentState.hasPythonStdlibCorpus
                                ? currentState.pythonStdlibCorpusPackages.toLocaleString() + ' package buckets · ' + currentState.pythonStdlibCorpusEntries.toLocaleString() + ' entries'
                                : 'Python stdlib corpus not built',
                            'Clear documentation cache keeps the Python corpus intact by design.',
                            'Corpus'
                        ),
                    actionCard(
                        'Build Python stdlib corpus',
                        'Fetch and cache richer built-in and keyword docs once.',
                        currentState.hasPythonStdlibCorpus ? 'Refresh the existing corpus.' : 'Recommended for better built-ins and keywords.',
                        'Build corpus',
                        { type: 'run-command', command: 'python-hover.buildPythonCorpus' },
                        'Corpus'
                    ),
                    actionCard(
                        'Clear documentation cache',
                        'Refresh cached docs without deleting the Python corpus.',
                        'Use this when scraped or fetched content needs to be rebuilt.',
                        'Clear cache',
                        { type: 'run-command', command: 'python-hover.clearCache' },
                        'Cache'
                    ),
                    ...(currentState.indexedPackages && currentState.indexedPackages.length > 0 ? [
                        tableCard(
                            'Indexed packages',
                            currentState.indexedPackages.length.toLocaleString() + ' packages · ' + currentState.indexedSymbols.toLocaleString() + ' symbols total',
                            currentState.indexedPackages
                                .slice()
                                .sort((a, b) => b.count - a.count)
                                .map(p => [p.name, p.count.toLocaleString()]),
                            ['Package', 'Symbols'],
                            'Browse'
                        ),
                    ] : []),
                ],
            },
            browse: {
                title: 'Browse And Search',
                copy: 'Search indexed docs directly or explore packages through the module browser.',
                cards: [
                        infoCard(
                            'Indexed docs',
                            currentState.indexedSymbols.toLocaleString() + ' indexed symbols available',
                            'Hover more packages or build corpora to expand the indexed set.',
                            'Browse'
                        ),
                    actionCard(
                        'Search Python docs',
                        'Search indexed symbols with the built-in docs lookup.',
                        'Best for direct symbol lookup.',
                        'Search docs',
                        { type: 'run-command', command: 'python-hover.searchDocs' },
                        'Browse'
                    ),
                    actionCard(
                        'Browse indexed modules',
                        'Open the module browser for exploration.',
                        'Best when you know the package but not the symbol.',
                        'Browse modules',
                        { type: 'run-command', command: 'python-hover.browseModule' },
                        'Browse'
                    ),
                ],
            },
            behavior: {
                title: 'Behavior',
                copy: 'Tune how aggressively PyHover uses runtime inspection, AST fallback, scraping, and background corpus building.',
                cards: [
                    toggleCard('Online discovery', 'Enable inventories and docs lookups from the web.', 'python-hover.onlineDiscovery', currentState.onlineDiscovery, 'Discovery'),
                    toggleCard('Runtime helper', 'Use the persistent Python helper for runtime introspection and keyword help.', 'python-hover.runtimeHelper', currentState.runtimeHelper, 'Runtime'),
                    toggleCard('AST fallback', 'Recover better symbol identity when LSP data is incomplete.', 'python-hover.astFallback', currentState.astFallback, 'Resolver'),
                    toggleCard('Doc scraping', 'Fetch and structure third-party docs HTML for richer hovers.', 'python-hover.docScraping', currentState.docScraping, 'Corpus'),
                    toggleCard('Build full package corpus', 'Build an entire package corpus in the background on first hover.', 'python-hover.buildFullCorpus', currentState.buildFullCorpus, 'Corpus'),
                    toggleCard('Debug logging', 'Keep verbose logging available for troubleshooting.', 'python-hover.enableDebugLogging', currentState.enableDebugLogging, 'Diagnostics'),
                ],
            },
            links: {
                title: 'Link Targets',
                copy: 'Control where official docs and DevDocs links open from hovers, pins, and docs actions.',
                cards: [
                    choiceCard('Official docs link target', 'Choose where Docs links open from hovers and pins.', 'python-hover.docsBrowser', currentState.docsBrowser, 'Links'),
                    choiceCard('DevDocs link target', 'Choose where scoped DevDocs links open.', 'python-hover.devdocsBrowser', currentState.devdocsBrowser, 'Links'),
                ],
            },
            settings: {
                title: 'Settings',
                copy: 'Jump into focused settings pages when you need more than the common controls shown here.',
                cards: [
                    settingsCard('Open PyHover settings', 'Open the extension settings filtered to PyHover.', 'python-hover', 'Settings'),
                    settingsCard('Open corpus settings', 'Jump directly to corpus-building behavior settings.', 'python-hover.buildFullCorpus', 'Settings'),
                    settingsCard('Open scraping settings', 'Jump directly to third-party docs scraping settings.', 'python-hover.docScraping', 'Settings'),
                ],
            },
        };
    }

    function infoCard(title, description, detail, badge) {
        return { kind: 'info', title, description, detail, badge };
    }

    function actionCard(title, description, detail, buttonLabel, action, badge) {
        return { kind: 'action', title, description, detail, buttonLabel, action, badge };
    }

    function settingsCard(title, description, query, badge) {
        return { kind: 'settings', title, description, detail: query, query, badge, buttonLabel: 'Open settings' };
    }

    function toggleCard(title, description, key, value, badge) {
        return { kind: 'toggle', title, description, detail: value ? 'Currently on' : 'Currently off', key, value, badge };
    }

    function tableCard(title, description, rows, headers, badge) {
        return { kind: 'table', title, description, rows, headers, badge };
    }

    function choiceCard(title, description, key, value, badge) {
        return { kind: 'choice', title, description, detail: value === 'integrated' ? 'Currently opening in the integrated side panel.' : 'Currently opening in the external browser.', key, value, badge };
    }

    function populateHero() {
        document.getElementById('summary-symbols').textContent = state.indexedSymbols.toLocaleString();
        document.getElementById('summary-cache').textContent = state.cacheSizeLabel;
        document.getElementById('summary-corpus').textContent = state.corpusSizeLabel;
        document.getElementById('summary-hover').textContent = state.lastHoverTitle || 'None';
        document.getElementById('sidebar-hover-title').textContent = state.lastHoverTitle || 'No hover captured yet';
        document.getElementById('sidebar-hover-note').textContent = state.lastHoverTitle
            ? 'Use Hover Tools to pin or debug the current target.'
            : 'Hover a Python symbol, then return here for deeper inspection.';
    }

    function bindStaticButtons() {
        for (const button of document.querySelectorAll('[data-run-command]')) {
            button.addEventListener('click', () => {
                const command = button.getAttribute('data-run-command');
                if (command) {
                    vscode.postMessage({ type: 'run-command', command });
                }
            });
        }

        for (const button of document.querySelectorAll('[data-open-settings]')) {
            button.addEventListener('click', () => {
                const query = button.getAttribute('data-open-settings');
                vscode.postMessage({ type: 'open-settings', query });
            });
        }
    }

    function render() {
        renderNav();
        renderSection();
    }

    function renderNav() {
        const nav = document.getElementById('nav');
        nav.innerHTML = categories.map(category => {
            const section = sections[category.id];
            const count = section.cards.length;
            const active = category.id === activeCategory ? ' active' : '';
            return '<button class="nav-item' + active + '" data-category="' + escapeHtml(category.id) + '">' +
                '<div><div class="nav-title">' + escapeHtml(category.label) + '</div><div class="nav-copy">' + escapeHtml(category.copy) + '</div></div>' +
                '<span class="nav-count">' + count + '</span>' +
            '</button>';
        }).join('');

        for (const button of nav.querySelectorAll('[data-category]')) {
            button.addEventListener('click', () => {
                activeCategory = button.getAttribute('data-category') || 'overview';
                persistViewState();
                render();
            });
        }
    }

    function renderSection() {
        const section = sections[activeCategory] || sections.overview;
        document.getElementById('section-title').textContent = section.title;
        document.getElementById('section-copy').textContent = section.copy;
        document.getElementById('cards-title').textContent = section.title;
        document.getElementById('cards-copy').textContent = searchQuery
            ? 'Filtered by your current search query.'
            : section.copy;

        const filteredCards = section.cards.filter(card => matchesSearch(card, searchQuery));
        const cards = document.getElementById('cards');
        if (filteredCards.length === 0) {
            cards.innerHTML = '<div class="empty"><strong>No matches in this section</strong><div class="empty-copy">Try a different search or switch sections from the left rail.</div></div>';
            return;
        }

        cards.innerHTML = filteredCards.map(renderCard).join('');
        bindDynamicCards(cards);
    }

    function matchesSearch(card, query) {
        if (!query) return true;
        const normalized = query.trim().toLowerCase();
        if (!normalized) return true;
        const haystack = [card.title, card.description, card.detail, card.badge].join(' ').toLowerCase();
        return haystack.includes(normalized);
    }

    function renderCard(card) {
        const badge = card.badge ? '<div class="card-badge">' + escapeHtml(card.badge) + '</div>' : '';
        const detail = card.detail ? '<div class="card-detail">' + escapeHtml(card.detail) + '</div>' : '';

        if (card.kind === 'toggle') {
            return '<article class="card">' + badge + '<div class="toggle-row"><div><h5>' + escapeHtml(card.title) + '</h5><p>' + escapeHtml(card.description) + '</p></div><input class="toggle" type="checkbox" data-toggle-key="' + escapeHtml(card.key) + '" ' + (card.value ? 'checked' : '') + '></div>' + detail + '</article>';
        }

        if (card.kind === 'choice') {
            return '<article class="card">' + badge + '<h5>' + escapeHtml(card.title) + '</h5><p>' + escapeHtml(card.description) + '</p>' + detail +
                '<div class="segmented">' +
                    renderChoiceButton(card.key, 'integrated', card.value, 'Integrated') +
                    renderChoiceButton(card.key, 'external', card.value, 'External') +
                '</div></article>';
        }

        if (card.kind === 'settings') {
            return '<article class="card">' + badge + '<h5>' + escapeHtml(card.title) + '</h5><p>' + escapeHtml(card.description) + '</p>' + detail +
                '<div class="card-actions"><button class="button button-secondary" data-settings-query="' + escapeHtml(card.query) + '">' + escapeHtml(card.buttonLabel) + '</button></div></article>';
        }

        if (card.kind === 'action') {
            return '<article class="card">' + badge + '<h5>' + escapeHtml(card.title) + '</h5><p>' + escapeHtml(card.description) + '</p>' + detail +
                '<div class="card-actions"><button class="button button-primary" data-card-command="' + escapeHtml(card.action.command) + '">' + escapeHtml(card.buttonLabel) + '</button></div></article>';
        }

        if (card.kind === 'table') {
            const headerRow = card.headers
                ? '<tr>' + card.headers.map(h => '<th>' + escapeHtml(h) + '</th>').join('') + '</tr>'
                : '';
            const dataRows = (card.rows || []).map(row =>
                '<tr>' + row.map(cell => '<td>' + escapeHtml(String(cell)) + '</td>').join('') + '</tr>'
            ).join('');
            return '<article class="card">' + badge +
                '<h5>' + escapeHtml(card.title) + '</h5>' +
                '<p>' + escapeHtml(card.description) + '</p>' +
                '<div class="table-wrap"><table class="pkg-table"><thead>' + headerRow + '</thead><tbody>' + dataRows + '</tbody></table></div>' +
                '</article>';
        }

        return '<article class="card">' + badge + '<h5>' + escapeHtml(card.title) + '</h5><p>' + escapeHtml(card.description) + '</p>' + detail + '</article>';
    }

    function renderChoiceButton(key, optionValue, currentValue, label) {
        const active = optionValue === currentValue ? ' active' : '';
        return '<button class="segment-button' + active + '" data-choice-key="' + escapeHtml(key) + '" data-choice-value="' + escapeHtml(optionValue) + '">' + escapeHtml(label) + '</button>';
    }

    function bindDynamicCards(root) {
        for (const input of root.querySelectorAll('[data-toggle-key]')) {
            input.addEventListener('change', () => {
                const key = input.getAttribute('data-toggle-key');
                if (!key) return;
                vscode.postMessage({ type: 'update-setting', key, value: input.checked });
            });
        }

        for (const button of root.querySelectorAll('[data-card-command]')) {
            button.addEventListener('click', () => {
                const command = button.getAttribute('data-card-command');
                if (!command) return;
                vscode.postMessage({ type: 'run-command', command });
            });
        }

        for (const button of root.querySelectorAll('[data-settings-query]')) {
            button.addEventListener('click', () => {
                const query = button.getAttribute('data-settings-query');
                vscode.postMessage({ type: 'open-settings', query });
            });
        }

        for (const button of root.querySelectorAll('[data-choice-key]')) {
            button.addEventListener('click', () => {
                const key = button.getAttribute('data-choice-key');
                const value = button.getAttribute('data-choice-value');
                if (!key || !value) return;
                vscode.postMessage({ type: 'update-setting', key, value });
            });
        }
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
</script>
</body>
</html>`;
    }
}
