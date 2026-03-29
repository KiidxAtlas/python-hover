import * as vscode from 'vscode';
import { IndexedSymbolPreview, IndexedSymbolSummary } from '../../../shared/types';

export type ModuleBrowserSettings = {
  defaultView: 'hierarchy' | 'flat';
  defaultSort: 'name' | 'kind' | 'package';
  defaultDensity: 'comfortable' | 'compact';
  showPrivateSymbols: boolean;
  showHierarchyHints: boolean;
  autoLoadPreviews: boolean;
  previewBatchSize: number;
};

export type ModuleBrowserMessage =
  | { type: 'open-doc'; url: string }
  | { type: 'pin-symbol'; symbol: IndexedSymbolSummary }
  | { type: 'open-source'; symbol: IndexedSymbolSummary }
  | { type: 'copy-import'; symbol: IndexedSymbolSummary }
  | { type: 'load-previews'; requestId: number; symbols: IndexedSymbolSummary[] }
  | { type: 'run-command'; command: string }
  | { type: 'open-settings'; query?: string }
  | { type: 'update-setting'; key: string; value: boolean | string | number };

type ModuleBrowserPayload = {
  moduleName: string;
  symbols: IndexedSymbolSummary[];
  settings: ModuleBrowserSettings;
};

export class ModuleBrowserPanel {
  private static instance: ModuleBrowserPanel | undefined;
  private panel: vscode.WebviewPanel | undefined;
  private disposables: vscode.Disposable[] = [];
  private currentPayload: ModuleBrowserPayload | undefined;

  private constructor(private readonly onMessage: (message: ModuleBrowserMessage) => void | Promise<void>) { }

  static getInstance(onMessage: (message: ModuleBrowserMessage) => void | Promise<void>): ModuleBrowserPanel {
    if (!ModuleBrowserPanel.instance) {
      ModuleBrowserPanel.instance = new ModuleBrowserPanel(onMessage);
    }
    return ModuleBrowserPanel.instance;
  }

  show(moduleName: string, symbols: IndexedSymbolSummary[], settings: ModuleBrowserSettings): void {
    this.currentPayload = { moduleName, symbols, settings };
    const targetColumn = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.Active;

    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        'pyhover.moduleBrowser',
        this.titleFor(moduleName),
        targetColumn,
        {
          enableScripts: true,
          retainContextWhenHidden: false,
        },
      );

      this.disposables.push(
        this.panel.webview.onDidReceiveMessage(message => {
          void this.onMessage(message as ModuleBrowserMessage);
        }),
      );

      this.panel.onDidDispose(() => {
        this.panel = undefined;
        this.currentPayload = undefined;
        vscode.Disposable.from(...this.disposables).dispose();
        this.disposables = [];
      });
    }

      this.panel.title = this.titleFor(moduleName);
      this.panel.webview.html = this.buildHtml(this.currentPayload);
      this.panel.reveal(targetColumn, false);
    }

  refreshSettings(settings: ModuleBrowserSettings): void {
    if (!this.currentPayload || !this.panel) {
            return;
        }

    this.currentPayload = { ...this.currentPayload, settings };
    this.panel.webview.html = this.buildHtml(this.currentPayload);
  }

  postPreviewData(requestId: number, previews: IndexedSymbolPreview[]): void {
    if (!this.panel) {
            return;
        }

      void this.panel.webview.postMessage({
        type: 'preview-data',
        requestId,
        previews,
      });
    }

  dispose(): void {
    this.panel?.dispose();
    this.panel = undefined;
    this.currentPayload = undefined;
  }

  private titleFor(moduleName: string): string {
    return `${moduleName} Browser`;
  }

  private buildHtml(payload: ModuleBrowserPayload): string {
    const { moduleName, symbols, settings } = payload;
    const data = JSON.stringify(symbols)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026');
      const settingsData = JSON.stringify(settings)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026');
    const nonce = String(Date.now());

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${this.escapeHtml(moduleName)} Browser</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: var(--vscode-editor-background);
    --panel: color-mix(in srgb, var(--bg) 95%, var(--vscode-editor-foreground) 5%);
    --panel-alt: color-mix(in srgb, var(--bg) 92%, var(--vscode-editor-foreground) 8%);
    --sidebar: color-mix(in srgb, var(--bg) 97%, var(--vscode-editor-foreground) 3%);
    --fg: var(--vscode-editor-foreground);
    --muted: var(--vscode-descriptionForeground);
    --border: color-mix(in srgb, var(--vscode-editor-foreground) 16%, transparent);
    --border-strong: color-mix(in srgb, var(--vscode-editor-foreground) 24%, transparent);
    --accent: var(--vscode-textLink-foreground);
    --button: var(--vscode-button-background);
    --button-fg: var(--vscode-button-foreground);
    --success: var(--vscode-testing-iconPassed, #2ea043);
    --row-hover: color-mix(in srgb, var(--accent) 8%, var(--bg));
    --row-active: color-mix(in srgb, var(--accent) 12%, var(--bg));
  }

  * { box-sizing: border-box; }

  html,
  body {
    margin: 0;
    padding: 0;
    height: 100%;
    background: var(--bg);
    color: var(--fg);
    font: 13px/1.45 var(--vscode-font-family);
  }

  button,
  input,
  select {
    font: inherit;
  }

  .app {
    height: 100vh;
    display: grid;
    grid-template-rows: auto 1fr;
  }

  .toolbar {
    display: grid;
    gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
    background: var(--panel);
  }

  .toolbar-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .search {
    flex: 1 1 280px;
  }

  .search,
  .select {
    min-height: 34px;
    padding: 7px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg);
    color: var(--fg);
    outline: none;
  }

  .search:focus,
  .select:focus {
    border-color: color-mix(in srgb, var(--accent) 35%, transparent);
  }

  .split {
    min-height: 0;
    display: grid;
    grid-template-columns: 280px minmax(0, 1fr);
  }

  .sidebar {
    min-height: 0;
    overflow: auto;
    padding: 12px;
    display: grid;
    align-content: start;
    gap: 12px;
    border-right: 1px solid var(--border);
    background: var(--sidebar);
  }

  .sidebar-block {
    display: grid;
    gap: 8px;
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--panel);
  }

  .sidebar-block.hidden {
    display: none;
  }

  .sidebar-label,
  .list-caption {
    font-size: 11px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .module-title,
  .list-title {
    font-size: 15px;
    font-weight: 650;
    line-height: 1.25;
    word-break: break-word;
  }

  .muted,
  .sidebar-note,
  .row-path,
  .row-meta,
  .row-summary,
  .empty,
  .list-meta {
    color: var(--muted);
  }

  .pill-row,
  .breadcrumbs,
  .segments,
  .kind-row,
  .actions,
  .stack {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .pill,
  .crumb,
  .segment,
  .kind-chip,
  .nav-item,
  .check {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 4px 9px;
    background: color-mix(in srgb, var(--bg) 96%, var(--fg) 4%);
    color: var(--muted);
  }

  .crumb,
  .segment,
  .kind-chip,
  .nav-item,
  .ghost,
  .action,
  .primary {
    cursor: pointer;
  }

  .crumb,
  .segment,
  .kind-chip,
  .nav-item,
  .ghost,
  .action,
  .primary {
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 6px 9px;
    background: transparent;
    color: var(--fg);
  }

  .primary {
    background: var(--button);
    color: var(--button-fg);
    border-color: transparent;
  }

  .ghost:hover,
  .action:hover,
  .crumb:hover,
  .segment:hover,
  .kind-chip:hover,
  .nav-item:hover,
  .primary:hover {
    border-color: var(--border-strong);
    background: color-mix(in srgb, var(--accent) 8%, var(--bg));
  }

  .segment.active,
  .kind-chip.active,
  .crumb.current,
  .nav-item.current {
    color: var(--accent);
    border-color: color-mix(in srgb, var(--accent) 34%, transparent);
    background: color-mix(in srgb, var(--accent) 12%, var(--bg));
  }

  .check {
    border-radius: 8px;
    padding: 5px 8px;
    color: var(--fg);
  }

  .check input {
    margin: 0;
  }

  .sidebar-section-head,
  .row-head,
  .list-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }

  .nav-list {
    display: grid;
    gap: 6px;
  }

  .nav-item {
    width: 100%;
    justify-content: space-between;
    border-radius: 8px;
    text-align: left;
  }

  .nav-text {
    min-width: 0;
    display: grid;
    gap: 2px;
  }

  .nav-title {
    color: var(--fg);
    font-weight: 600;
    word-break: break-word;
  }

  .main {
    min-width: 0;
    min-height: 0;
    display: grid;
    grid-template-rows: auto auto 1fr;
  }

  .list-header {
    padding: 12px;
    border-bottom: 1px solid var(--border);
    background: var(--panel);
  }

  .kind-bar {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    background: var(--panel-alt);
  }

  .results {
    min-height: 0;
    overflow: auto;
  }

  .row {
    display: grid;
    gap: 6px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
  }

  .row:hover {
    background: var(--row-hover);
  }

  .row.active {
    background: var(--row-active);
  }

  .row.compact {
    padding-top: 8px;
    padding-bottom: 8px;
    gap: 4px;
  }

  .row-head {
    align-items: center;
  }

  .row-title-group {
    min-width: 0;
    display: grid;
    gap: 3px;
  }

  .row-title {
    font-size: 14px;
    font-weight: 650;
    line-height: 1.2;
    word-break: break-word;
  }

  .signature {
    max-width: 100%;
    overflow: auto;
    padding: 6px 8px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: color-mix(in srgb, var(--bg) 93%, var(--fg) 7%);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .action {
    padding: 4px 8px;
    font-size: 12px;
    color: var(--accent);
  }

  .detail-block {
    display: grid;
    gap: 8px;
  }

  .detail-title {
    font-size: 14px;
    font-weight: 650;
    line-height: 1.25;
    word-break: break-word;
  }

  .detail-copy {
    color: var(--muted);
    word-break: break-word;
  }

  .empty {
    padding: 16px 12px;
    border-bottom: 1px solid var(--border);
  }

  @media (max-width: 980px) {
    .split {
      grid-template-columns: 1fr;
    }

    .main {
      order: 1;
    }

    .sidebar {
      order: 2;
      border-right: 0;
      border-bottom: 1px solid var(--border);
    }
  }

  @media (max-width: 720px) {
    .toolbar {
      padding: 8px;
    }

    .sidebar,
    .list-header,
    .kind-bar,
    .row {
      padding-left: 10px;
      padding-right: 10px;
    }

    .row-head,
    .list-header,
    .sidebar-section-head {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
</head>
<body>
<div class="app">
  <header class="toolbar">
    <div class="toolbar-row">
      <input id="query" class="search" type="search" placeholder="Search dotted names like DataFrame.groupby or os.path.join">
      <select id="package-filter" class="select"></select>
      <select id="sort-filter" class="select">
        <option value="name">Sort: name</option>
        <option value="kind">Sort: kind</option>
        <option value="package">Sort: package</option>
      </select>
      <select id="view-filter" class="select">
        <option value="hierarchy">View: hierarchy</option>
        <option value="flat">View: flat</option>
      </select>
    </div>
    <div class="toolbar-row">
      <div class="segments" id="density-row"></div>
      <label class="check"><input id="toggle-private" type="checkbox">Show private</label>
      <label class="check"><input id="toggle-documented" type="checkbox">Documented only</label>
      <label class="check"><input id="toggle-auto" type="checkbox">Auto previews</label>
      <label class="check"><input id="toggle-hints" type="checkbox">Hierarchy hints</label>
      <button class="ghost" data-manual-preview="true">Load previews</button>
      <button class="ghost" data-run-command="python-hover.searchDocs">Search docs</button>
      <button class="ghost" data-open-settings="python-hover.ui.moduleBrowser">Settings</button>
    </div>
  </header>

  <div class="split">
    <aside class="sidebar">
      <section class="sidebar-block" id="module-block">
        <div class="sidebar-label">Module</div>
        <div class="module-title">${this.escapeHtml(moduleName)}</div>
        <div class="pill-row" id="sidebar-meta"></div>
        <div class="breadcrumbs" id="breadcrumbs"></div>
      </section>

      <section class="sidebar-block" id="module-actions-block">
        <div class="sidebar-section-head">
          <div class="sidebar-label">Module Actions</div>
          <div class="muted" id="current-scope"></div>
        </div>
        <div class="stack" id="module-actions"></div>
      </section>

      <section class="sidebar-block" id="selected-symbol-block">
        <div class="sidebar-section-head">
          <div class="sidebar-label">Selected Symbol</div>
          <div class="muted" id="detail-meta"></div>
        </div>
        <div class="detail-block" id="detail-panel"></div>
      </section>

      <section class="sidebar-block" id="namespaces-block">
        <div class="sidebar-section-head">
          <div class="sidebar-label">Namespaces</div>
          <div class="muted" id="branch-meta"></div>
        </div>
        <div class="nav-list" id="branch-list"></div>
      </section>
    </aside>

    <section class="main">
      <header class="list-header">
        <div>
          <div class="list-caption">Symbols</div>
          <div class="list-title" id="list-title"></div>
        </div>
        <div class="list-meta" id="list-meta"></div>
      </header>
      <div class="kind-bar">
        <div class="kind-row" id="kind-row"></div>
      </div>
      <div class="results" id="results"></div>
    </section>
  </div>
</div>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const moduleName = ${JSON.stringify(moduleName)};
  const symbols = ${data};
  const defaults = ${settingsData};
  const previewCache = new Map();
  const requestedPreviews = new Set();
  const stateVersion = 2;
  const restored = vscode.getState() || {};
  const sameModule = restored.stateVersion === stateVersion && restored.moduleName === moduleName;

  let query = sameModule && typeof restored.query === 'string' ? restored.query : '';
  let activeKind = sameModule && typeof restored.activeKind === 'string' ? restored.activeKind : 'all';
  let currentPath = sameModule && Array.isArray(restored.currentPath) ? restored.currentPath : [];
  let selectedPackage = sameModule && typeof restored.selectedPackage === 'string' ? restored.selectedPackage : 'all';
  let selectedSymbolName = sameModule && typeof restored.selectedSymbolName === 'string' ? restored.selectedSymbolName : '';
  let viewMode = sameModule && typeof restored.viewMode === 'string' ? restored.viewMode : defaults.defaultView;
  let sortMode = sameModule && typeof restored.sortMode === 'string' ? restored.sortMode : defaults.defaultSort;
  let density = sameModule && typeof restored.density === 'string' ? restored.density : defaults.defaultDensity;
  let showPrivate = sameModule && typeof restored.showPrivate === 'boolean' ? restored.showPrivate : defaults.showPrivateSymbols;
  let showDocumentedOnly = sameModule && typeof restored.showDocumentedOnly === 'boolean' ? restored.showDocumentedOnly : false;
  let autoLoadPreviews = sameModule && typeof restored.autoLoadPreviews === 'boolean' ? restored.autoLoadPreviews : defaults.autoLoadPreviews;
  let previewRequestId = 0;

  const queryInput = document.getElementById('query');
  const packageFilter = document.getElementById('package-filter');
  const sortFilter = document.getElementById('sort-filter');
  const viewFilter = document.getElementById('view-filter');
  const togglePrivate = document.getElementById('toggle-private');
  const toggleDocumented = document.getElementById('toggle-documented');
  const toggleAuto = document.getElementById('toggle-auto');
  const toggleHints = document.getElementById('toggle-hints');
  const moduleActionsBlockEl = document.getElementById('module-actions-block');
  const selectedSymbolBlockEl = document.getElementById('selected-symbol-block');
  const namespacesBlockEl = document.getElementById('namespaces-block');
  const sidebarMetaEl = document.getElementById('sidebar-meta');
  const breadcrumbsEl = document.getElementById('breadcrumbs');
  const moduleActionsEl = document.getElementById('module-actions');
  const currentScopeEl = document.getElementById('current-scope');
  const detailMetaEl = document.getElementById('detail-meta');
  const detailPanelEl = document.getElementById('detail-panel');
  const branchMetaEl = document.getElementById('branch-meta');
  const branchListEl = document.getElementById('branch-list');
  const listTitleEl = document.getElementById('list-title');
  const listMetaEl = document.getElementById('list-meta');
  const kindRowEl = document.getElementById('kind-row');
  const densityRowEl = document.getElementById('density-row');
  const resultsEl = document.getElementById('results');

  queryInput.value = query;
  sortFilter.value = sortMode;
  viewFilter.value = viewMode;
  togglePrivate.checked = showPrivate;
  toggleDocumented.checked = showDocumentedOnly;
  toggleAuto.checked = autoLoadPreviews;
  toggleHints.checked = defaults.showHierarchyHints;

  for (const symbol of symbols) {
    const preview = initialPreview(symbol);
    if (hasInitialPreviewData(preview)) {
      previewCache.set(symbol.name, preview);
      requestedPreviews.add(symbol.name);
    }
  }

  queryInput.addEventListener('input', event => {
    query = event.target.value || '';
    if (query.trim()) {
      currentPath = [];
    }
    render();
  });

  packageFilter.addEventListener('change', event => {
    selectedPackage = event.target.value || 'all';
    render();
  });

  sortFilter.addEventListener('change', event => {
    sortMode = event.target.value || defaults.defaultSort;
    defaults.defaultSort = sortMode;
    vscode.postMessage({ type: 'update-setting', key: 'python-hover.ui.moduleBrowser.defaultSort', value: sortMode });
    render();
  });

  viewFilter.addEventListener('change', event => {
    viewMode = event.target.value || defaults.defaultView;
    defaults.defaultView = viewMode;
    vscode.postMessage({ type: 'update-setting', key: 'python-hover.ui.moduleBrowser.defaultView', value: viewMode });
    render();
  });

  togglePrivate.addEventListener('change', event => {
    showPrivate = event.target.checked;
    vscode.postMessage({ type: 'update-setting', key: 'python-hover.ui.moduleBrowser.showPrivateSymbols', value: showPrivate });
    render();
  });

  toggleDocumented.addEventListener('change', event => {
    showDocumentedOnly = event.target.checked;
    render();
  });

  toggleAuto.addEventListener('change', event => {
    autoLoadPreviews = event.target.checked;
    vscode.postMessage({ type: 'update-setting', key: 'python-hover.ui.moduleBrowser.autoLoadPreviews', value: autoLoadPreviews });
    render();
  });

  toggleHints.addEventListener('change', event => {
    defaults.showHierarchyHints = event.target.checked;
    vscode.postMessage({ type: 'update-setting', key: 'python-hover.ui.moduleBrowser.showHierarchyHints', value: defaults.showHierarchyHints });
    render();
  });

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest('button') : null;
    if (!target) {
      const row = event.target instanceof Element ? event.target.closest('[data-select-symbol]') : null;
      if (row) {
        selectedSymbolName = row.getAttribute('data-select-symbol') || '';
        render();
      }
      return;
    }

    const breadcrumb = target.getAttribute('data-breadcrumb');
    if (breadcrumb !== null) {
      currentPath = breadcrumb ? breadcrumb.split('.').filter(Boolean) : [];
      render();
      return;
    }

    const path = target.getAttribute('data-path');
    if (path) {
      currentPath = path.split('.').filter(Boolean);
      viewMode = 'hierarchy';
      viewFilter.value = 'hierarchy';
      render();
      return;
    }

    const kind = target.getAttribute('data-kind');
    if (kind) {
      activeKind = kind;
      render();
      return;
    }

    const densityValue = target.getAttribute('data-density');
    if (densityValue) {
      density = densityValue;
      defaults.defaultDensity = density;
      vscode.postMessage({ type: 'update-setting', key: 'python-hover.ui.moduleBrowser.defaultDensity', value: density });
      render();
      return;
    }

    if (target.hasAttribute('data-manual-preview')) {
      queuePreviewLoad(getRenderableRows(), true);
      return;
    }

    const openDoc = target.getAttribute('data-open-doc');
    if (openDoc) {
      vscode.postMessage({ type: 'open-doc', url: openDoc });
      return;
    }

    const pinSymbol = target.getAttribute('data-pin-symbol');
    if (pinSymbol) {
      vscode.postMessage({ type: 'pin-symbol', symbol: decodeItem(pinSymbol) });
      return;
    }

    const sourceSymbol = target.getAttribute('data-source-symbol');
    if (sourceSymbol) {
      vscode.postMessage({ type: 'open-source', symbol: decodeItem(sourceSymbol) });
      return;
    }

    const copySymbol = target.getAttribute('data-copy-symbol');
    if (copySymbol) {
      vscode.postMessage({ type: 'copy-import', symbol: decodeItem(copySymbol) });
      return;
    }

    const command = target.getAttribute('data-run-command');
    if (command) {
      vscode.postMessage({ type: 'run-command', command });
      return;
    }

    if (target.hasAttribute('data-open-settings')) {
      vscode.postMessage({ type: 'open-settings', query: target.getAttribute('data-open-settings') || undefined });
    }
  });

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function persistState() {
    vscode.setState({
      stateVersion,
      moduleName,
      query,
      activeKind,
      currentPath,
      selectedPackage,
      selectedSymbolName,
      viewMode,
      sortMode,
      density,
      showPrivate,
      showDocumentedOnly,
      autoLoadPreviews,
    });
  }

  function normalizeKind(kind) {
    return kind || 'symbol';
  }

  function tailName(item) {
    return item.name.split('.').pop() || item.name;
  }

  function isPrivateSymbol(item) {
    return /^_/.test(tailName(item));
  }

  function relativeParts(item) {
    if (item.name === moduleName) return [];
    if (item.name.startsWith(moduleName + '.')) {
      return item.name.slice(moduleName.length + 1).split('.').filter(Boolean);
    }
    return item.name.split('.').filter(Boolean);
  }

  function pathMatches(parts) {
    if (parts.length < currentPath.length) return false;
    return currentPath.every((segment, index) => parts[index] === segment);
  }

  function currentPrefix() {
    return currentPath.length > 0 ? moduleName + '.' + currentPath.join('.') : moduleName;
  }

  function initialPreview(item) {
    return {
      name: item.name,
      title: item.title,
      kind: item.kind,
      module: item.module,
      summary: item.summary,
      signature: item.signature,
      url: item.url,
      sourceUrl: item.sourceUrl,
    };
  }

  function hasInitialPreviewData(preview) {
    return Boolean(preview.summary || preview.signature || preview.sourceUrl || preview.installedVersion);
  }

  function previewFor(item) {
    return previewCache.get(item.name) || initialPreview(item);
  }

  function hasDocs(item) {
    const preview = previewFor(item);
    return Boolean(item.url || preview.url || preview.summary || preview.signature || preview.sourceUrl);
  }

  function truncate(text, maxLength) {
    if (!text) return '';
    const clean = String(text).replace(/\\s+/g, ' ').trim();
    if (clean.length <= maxLength) return clean;
    return clean.slice(0, maxLength - 1).trimEnd() + '…';
  }

  function getPackages(items) {
    return [...new Set(items.map(item => item.package).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  function getKinds(items) {
    const counts = new Map();
    for (const item of items) {
      const kind = normalizeKind(item.kind);
      counts.set(kind, (counts.get(kind) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }

  function getExactRoot() {
    return symbols.find(item => item.name === moduleName);
  }

  function buildImportStatement(item) {
    const rawTitle = item.name;
    if (!rawTitle || /^__\\w+__$/.test(rawTitle)) return undefined;
    if (normalizeKind(item.kind) === 'module') {
      return 'import ' + rawTitle;
    }

    const moduleRef = item.module || moduleName.split('.')[0] || moduleName;
    if (!moduleRef || moduleRef === 'builtins') return undefined;

    const segments = rawTitle.split('.').filter(Boolean);
    let shortName = segments[segments.length - 1] || rawTitle;
    if (segments.length > 1 && /^(?:method|property|field)$/i.test(normalizeKind(item.kind))) {
      shortName = segments[0];
    }
    return 'from ' + moduleRef + ' import ' + shortName;
  }

  function collectSymbols(includeKind) {
    const normalizedQuery = query.trim().toLowerCase();
    let items = symbols.slice();

    if (selectedPackage !== 'all') {
      items = items.filter(item => item.package === selectedPackage);
    }
    if (!showPrivate) {
      items = items.filter(item => !isPrivateSymbol(item));
    }
    if (showDocumentedOnly) {
      items = items.filter(item => hasDocs(item));
    }
    if (includeKind && activeKind !== 'all') {
      items = items.filter(item => normalizeKind(item.kind) === activeKind);
    }
    if (normalizedQuery) {
      items = items.filter(item => {
        const preview = previewFor(item);
        return [
          item.name,
          item.package,
          item.module,
          item.kind,
          preview.summary,
          preview.signature,
        ].filter(Boolean).join(' ').toLowerCase().includes(normalizedQuery);
      });
    } else {
      items = items.filter(item => pathMatches(relativeParts(item)));
    }

    return sortItems(items);
  }

  function sortItems(items) {
    return items.slice().sort((left, right) => {
      const normalizedQuery = query.trim().toLowerCase();
      if (normalizedQuery) {
        const relevance = scoreMatch(right, normalizedQuery) - scoreMatch(left, normalizedQuery);
        if (relevance !== 0) return relevance;
      }
      if (sortMode === 'package') {
        const packageCmp = (left.package || '').localeCompare(right.package || '');
        if (packageCmp !== 0) return packageCmp;
      }
      if (sortMode === 'kind') {
        const kindCmp = normalizeKind(left.kind).localeCompare(normalizeKind(right.kind));
        if (kindCmp !== 0) return kindCmp;
      }
      return left.name.localeCompare(right.name);
    });
  }

  function scoreMatch(item, normalizedQuery) {
    const fullName = item.name.toLowerCase();
    const tail = tailName(item).toLowerCase();
    const moduleRef = (item.module || '').toLowerCase();
    if (fullName === normalizedQuery) return 120;
    if (tail === normalizedQuery) return 110;
    if (fullName.endsWith('.' + normalizedQuery)) return 100;
    if (fullName.startsWith(normalizedQuery)) return 90;
    if (tail.startsWith(normalizedQuery)) return 80;
    if (moduleRef && moduleRef + '.' + tail === normalizedQuery) return 75;
    if (fullName.includes('.' + normalizedQuery)) return 70;
    if (tail.includes(normalizedQuery)) return 60;
    if (fullName.includes(normalizedQuery)) return 40;
    return 0;
  }

  function hierarchyView(items) {
    const namespaces = new Map();
    const leaves = [];

    for (const item of items) {
      const parts = relativeParts(item);
      if (!pathMatches(parts)) continue;

      if (parts.length <= currentPath.length + 1 || query.trim()) {
        leaves.push(item);
        continue;
      }

      const child = parts[currentPath.length];
      const fullPath = currentPath.concat(child);
      const key = fullPath.join('.');
      const existing = namespaces.get(key) || {
        path: fullPath,
        name: child,
        symbolCount: 0,
        kinds: new Set(),
      };
      existing.symbolCount += 1;
      existing.kinds.add(normalizeKind(item.kind));
      namespaces.set(key, existing);
    }

    return {
      branches: [...namespaces.values()].sort((a, b) => a.path.join('.').localeCompare(b.path.join('.'))),
      leaves,
    };
  }

  function encodeItem(item) {
    return encodeURIComponent(JSON.stringify(item));
  }

  function decodeItem(raw) {
    return JSON.parse(decodeURIComponent(raw));
  }

  function queuePreviewLoad(items, force) {
    const pending = items
      .filter(item => !previewCache.has(item.name) && (force || !requestedPreviews.has(item.name)))
      .slice(0, defaults.previewBatchSize);
    if (pending.length === 0) return;

    const requestId = ++previewRequestId;
    for (const item of pending) {
      requestedPreviews.add(item.name);
    }
    vscode.postMessage({ type: 'load-previews', requestId, symbols: pending });
  }

  function displayName(item) {
    const prefix = currentPrefix();
    if (item.name.startsWith(prefix + '.')) {
      return item.name.slice(prefix.length + 1);
    }
    if (item.name.startsWith(moduleName + '.')) {
      return item.name.slice(moduleName.length + 1);
    }
    if (/[/#]/.test(item.name)) {
      const anchor = item.name.split('#').pop() || item.name;
      const parts = anchor.split('/').filter(Boolean);
      return parts[parts.length - 1] || item.name;
    }
    return item.name;
  }

  function formatRowMeta(item, preview) {
    const parts = [normalizeKind(preview.kind || item.kind), item.package || moduleName];
    if (preview.installedVersion) {
      parts.push('v' + preview.installedVersion);
    }
    parts.push(hasDocs(item) ? 'docs' : 'index only');
    return parts.join(' · ');
  }

  function renderPackageFilter(items) {
    const packages = getPackages(items);
    const options = ['<option value="all">All packages (' + packages.length + ')</option>'];
    for (const pkg of packages) {
      const count = items.filter(item => item.package === pkg).length;
      options.push('<option value="' + escapeHtml(pkg) + '"' + (selectedPackage === pkg ? ' selected' : '') + '>' + escapeHtml(pkg) + ' (' + count + ')</option>');
    }
    packageFilter.innerHTML = options.join('');
  }

  function renderDensityControls() {
    densityRowEl.innerHTML = [
      '<button class="segment' + (density === 'comfortable' ? ' active' : '') + '" data-density="comfortable">Comfortable</button>',
      '<button class="segment' + (density === 'compact' ? ' active' : '') + '" data-density="compact">Compact</button>',
    ].join('');
  }

  function renderKindFilters(items) {
    const chips = ['<button class="kind-chip' + (activeKind === 'all' ? ' active' : '') + '" data-kind="all">All ' + items.length + '</button>'];
    for (const entry of getKinds(items)) {
      chips.push('<button class="kind-chip' + (activeKind === entry[0] ? ' active' : '') + '" data-kind="' + escapeHtml(entry[0]) + '">' + escapeHtml(entry[0]) + ' ' + entry[1] + '</button>');
    }
    kindRowEl.innerHTML = chips.join('');
  }

  function renderSidebar(filteredItems, rows, hierarchy) {
    const exactRoot = getExactRoot();
    const documented = filteredItems.filter(item => hasDocs(item)).length;
    sidebarMetaEl.innerHTML = [
      '<span class="pill">' + symbols.length + ' indexed</span>',
      '<span class="pill">' + rows.length + ' shown</span>',
      '<span class="pill">' + documented + ' with docs</span>',
    ].join('');
    currentScopeEl.textContent = currentPath.length > 0 ? currentPath.join('.') : moduleName;

    const crumbs = ['<button class="crumb' + (currentPath.length === 0 ? ' current' : '') + '" data-breadcrumb="">' + escapeHtml(moduleName) + '</button>'];
    for (let index = 0; index < currentPath.length; index++) {
      const path = currentPath.slice(0, index + 1).join('.');
      crumbs.push('<button class="crumb' + (index === currentPath.length - 1 ? ' current' : '') + '" data-breadcrumb="' + escapeHtml(path) + '">' + escapeHtml(currentPath[index]) + '</button>');
    }
    breadcrumbsEl.innerHTML = crumbs.join('');

    const actions = [];
    if (exactRoot && exactRoot.url) {
      actions.push('<button class="primary" data-open-doc="' + escapeHtml(exactRoot.url) + '">Open docs</button>');
    }
    if (exactRoot) {
      actions.push('<button class="ghost" data-pin-symbol="' + encodeItem(exactRoot) + '">Pin module</button>');
      actions.push('<button class="ghost" data-source-symbol="' + encodeItem(exactRoot) + '">Source</button>');
      const importStatement = buildImportStatement(exactRoot);
      if (importStatement) {
        actions.push('<button class="ghost" data-copy-symbol="' + encodeItem(exactRoot) + '">Copy import</button>');
      }
    }
    moduleActionsBlockEl.classList.toggle('hidden', actions.length === 0);
    moduleActionsEl.innerHTML = actions.join('');

    renderSelectedDetail(rows);

    if (viewMode !== 'hierarchy') {
      namespacesBlockEl.classList.add('hidden');
      branchMetaEl.textContent = '';
      branchListEl.innerHTML = '';
      return;
    }

    namespacesBlockEl.classList.remove('hidden');

    if (query.trim()) {
      branchMetaEl.textContent = 'Search active';
      branchListEl.innerHTML = '<div class="sidebar-note">Namespace navigation is hidden while filtering. Clear the search to drill into paths again.</div>';
      return;
    }

    branchMetaEl.textContent = hierarchy.branches.length + ' branch' + (hierarchy.branches.length === 1 ? '' : 'es');
    if (hierarchy.branches.length === 0) {
      branchListEl.innerHTML = '<div class="sidebar-note">No deeper namespaces are indexed at this level.</div>';
      return;
    }

    branchListEl.innerHTML = hierarchy.branches.map(branch => {
      const kinds = [...branch.kinds].sort().join(', ');
      return '<button class="nav-item" data-path="' + escapeHtml(branch.path.join('.')) + '">' +
        '<span class="nav-text"><span class="nav-title">' + escapeHtml(branch.name) + '</span>' +
        (defaults.showHierarchyHints ? '<span class="sidebar-note">' + escapeHtml(kinds || 'symbol') + '</span>' : '') +
        '</span>' +
        '<span class="pill">' + branch.symbolCount + '</span>' +
      '</button>';
    }).join('');
  }

  function renderSelectedDetail(rows) {
    if (!selectedSymbolName || !rows.some(item => item.name === selectedSymbolName)) {
      selectedSymbolName = rows[0]?.name || '';
    }

    const selected = rows.find(item => item.name === selectedSymbolName);
    if (!selected) {
      selectedSymbolBlockEl.classList.add('hidden');
      detailMetaEl.textContent = 'No symbol selected';
      detailPanelEl.innerHTML = '<div class="sidebar-note">Select a symbol from the list to see its signature, summary, and actions here.</div>';
      return;
    }

    selectedSymbolBlockEl.classList.remove('hidden');

    const preview = previewFor(selected);
    const importStatement = buildImportStatement(selected);
    const docsUrl = preview.url || selected.url;
    detailMetaEl.textContent = normalizeKind(preview.kind || selected.kind);
    detailPanelEl.innerHTML =
      '<div class="detail-title">' + escapeHtml(displayName(selected)) + '</div>' +
      '<div class="detail-copy">' + escapeHtml(selected.name) + '</div>' +
      (preview.signature ? '<div class="signature">' + escapeHtml(truncate(preview.signature, 220)) + '</div>' : '') +
      '<div class="detail-copy">' + escapeHtml(truncate(preview.summary || 'Preview content loads when docs are hydrated.', 260)) + '</div>' +
      '<div class="detail-copy">' + escapeHtml(formatRowMeta(selected, preview)) + '</div>' +
      '<div class="stack">' +
        (docsUrl ? '<button class="ghost" data-open-doc="' + escapeHtml(docsUrl) + '">Docs</button>' : '') +
        '<button class="ghost" data-pin-symbol="' + encodeItem(selected) + '">Pin</button>' +
        '<button class="ghost" data-source-symbol="' + encodeItem(selected) + '">Source</button>' +
        (importStatement ? '<button class="ghost" data-copy-symbol="' + encodeItem(selected) + '">Copy import</button>' : '') +
      '</div>';
  }

  function renderList(rows, hierarchy) {
    listTitleEl.textContent = query.trim()
      ? 'Search results'
      : viewMode === 'hierarchy'
        ? 'Symbols at ' + (currentPath.length > 0 ? currentPath.join('.') : moduleName)
        : 'All matching symbols';

    const metaParts = [rows.length + ' item' + (rows.length === 1 ? '' : 's')];
    if (viewMode === 'hierarchy' && !query.trim()) {
      metaParts.push(hierarchy.branches.length + ' branch' + (hierarchy.branches.length === 1 ? '' : 'es'));
    }
    if (selectedPackage !== 'all') {
      metaParts.push(selectedPackage);
    }
    listMetaEl.textContent = metaParts.join(' · ');

    resultsEl.className = 'results density-' + density;
    if (rows.length === 0) {
      resultsEl.innerHTML = '<div class="empty">' + (viewMode === 'hierarchy' && hierarchy.branches.length > 0 && !query.trim()
        ? 'Choose a namespace from the sidebar to inspect the symbols inside it.'
        : 'No symbols match the current filters.') + '</div>';
      return;
    }

    resultsEl.innerHTML = rows.map(item => {
      const preview = previewFor(item);
      const summary = truncate(preview.summary, density === 'compact' ? 110 : 220);
      const signature = truncate(preview.signature, density === 'compact' ? 100 : 180);
      const docsUrl = preview.url || item.url;
      const importStatement = buildImportStatement(item);

      return '<article class="row' + (density === 'compact' ? ' compact' : '') + (selectedSymbolName === item.name ? ' active' : '') + '" data-select-symbol="' + escapeHtml(item.name) + '">' +
        '<div class="row-head">' +
          '<div class="row-title-group">' +
            '<div class="row-title">' + escapeHtml(displayName(item)) + '</div>' +
            '<div class="row-path">' + escapeHtml(item.name) + '</div>' +
          '</div>' +
          '<div class="actions">' +
            (docsUrl ? '<button class="action" data-open-doc="' + escapeHtml(docsUrl) + '">Docs</button>' : '') +
            '<button class="action" data-pin-symbol="' + encodeItem(item) + '">Pin</button>' +
            '<button class="action" data-source-symbol="' + encodeItem(item) + '">Source</button>' +
            (importStatement ? '<button class="action" data-copy-symbol="' + encodeItem(item) + '">Import</button>' : '') +
          '</div>' +
        '</div>' +
        '<div class="row-meta">' + escapeHtml(formatRowMeta(item, preview)) + '</div>' +
        (signature ? '<div class="signature">' + escapeHtml(signature) + '</div>' : '') +
        (summary ? '<div class="row-summary">' + escapeHtml(summary) + '</div>' : '<div class="row-summary">Preview content loads when docs are hydrated.</div>') +
      '</article>';
    }).join('');
  }

  function getRenderableRows() {
    const scopedItems = collectSymbols(false);
    const filteredItems = activeKind === 'all'
      ? scopedItems
      : scopedItems.filter(item => normalizeKind(item.kind) === activeKind);
    const hierarchy = hierarchyView(filteredItems);
    return viewMode === 'hierarchy' && !query.trim() ? hierarchy.leaves : filteredItems;
  }

  function render() {
    persistState();
    sortFilter.value = sortMode;
    viewFilter.value = viewMode;
    togglePrivate.checked = showPrivate;
    toggleDocumented.checked = showDocumentedOnly;
    toggleAuto.checked = autoLoadPreviews;
    toggleHints.checked = defaults.showHierarchyHints;

    renderPackageFilter(symbols);
    renderDensityControls();

    const scopedItems = collectSymbols(false);
    renderKindFilters(scopedItems);

    const filteredItems = activeKind === 'all'
      ? scopedItems
      : scopedItems.filter(item => normalizeKind(item.kind) === activeKind);
    const hierarchy = hierarchyView(filteredItems);
    const rows = viewMode === 'hierarchy' && !query.trim() ? hierarchy.leaves : filteredItems;

    renderSidebar(filteredItems, rows, hierarchy);
    renderList(rows, hierarchy);

    if (autoLoadPreviews) {
      queuePreviewLoad(rows, false);
    }
  }

  window.addEventListener('message', event => {
    const message = event.data;
    if (!message || message.type !== 'preview-data' || !Array.isArray(message.previews)) {
      return;
    }

    let didChange = false;
    for (const preview of message.previews) {
      if (!preview || !preview.name) continue;
      const previous = previewCache.get(preview.name);
      const next = JSON.stringify(preview);
      const current = previous ? JSON.stringify(previous) : '';
      if (next !== current) {
        previewCache.set(preview.name, preview);
        didChange = true;
      }
    }

    if (didChange) {
      render();
    }
  });

  render();
</script>
</body>
</html>`;
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
