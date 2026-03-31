import * as path from 'path';
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function isIndexedSymbolSummary(value: unknown): value is IndexedSymbolSummary {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.name === 'string'
    && typeof value.url === 'string'
    && typeof value.kind === 'string'
    && typeof value.package === 'string'
    && (value.title === undefined || typeof value.title === 'string')
    && (value.module === undefined || typeof value.module === 'string')
    && (value.signature === undefined || typeof value.signature === 'string')
    && (value.summary === undefined || typeof value.summary === 'string')
    && (value.sourceUrl === undefined || typeof value.sourceUrl === 'string');
}

function isModuleBrowserMessage(value: unknown): value is ModuleBrowserMessage {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return false;
  }

  switch (value.type) {
    case 'open-doc':
      return typeof value.url === 'string';
    case 'pin-symbol':
    case 'open-source':
    case 'copy-import':
      return isIndexedSymbolSummary(value.symbol);
    case 'load-previews':
      return typeof value.requestId === 'number'
        && Array.isArray(value.symbols)
        && value.symbols.every(isIndexedSymbolSummary);
    case 'run-command':
      return typeof value.command === 'string';
    case 'open-settings':
      return value.query === undefined || typeof value.query === 'string';
    case 'update-setting':
      return typeof value.key === 'string'
        && (typeof value.value === 'boolean' || typeof value.value === 'string' || typeof value.value === 'number');
    default:
      return false;
  }
}

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
          localResourceRoots: [this.mediaRootUri()],
        },
      );

      this.disposables.push(
        this.panel.webview.onDidReceiveMessage(message => {
          if (!isModuleBrowserMessage(message)) {
            return;
          }
          void this.onMessage(message);
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
    this.panel.webview.html = this.buildHtml(this.panel.webview, this.currentPayload);
      this.panel.reveal(targetColumn, false);
    }

  refreshSettings(settings: ModuleBrowserSettings): void {
    if (!this.currentPayload || !this.panel) {
            return;
        }

    this.currentPayload = { ...this.currentPayload, settings };
    this.panel.webview.html = this.buildHtml(this.panel.webview, this.currentPayload);
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

  private mediaRootUri(): vscode.Uri {
    return vscode.Uri.file(path.join(__dirname, '../../../../media'));
  }

  private moduleBrowserScriptUri(webview: vscode.Webview): string {
    return webview.asWebviewUri(vscode.Uri.joinPath(this.mediaRootUri(), 'moduleBrowserWebview.js')).toString();
  }

  private buildInitialPackageOptions(symbols: IndexedSymbolSummary[]): string {
    const packages = [...new Set(symbols.map(symbol => symbol.package).filter(Boolean))].sort((left, right) => left.localeCompare(right));
    const options = [`<option value="all" selected>All packages (${packages.length})</option>`];

    for (const pkg of packages) {
      const count = symbols.filter(symbol => symbol.package === pkg).length;
      options.push(`<option value="${this.escapeHtml(pkg)}">${this.escapeHtml(pkg)} (${count})</option>`);
    }

    return options.join('');
  }

  private buildInitialSidebarMeta(symbols: IndexedSymbolSummary[]): string {
    const documentedCount = symbols.filter(symbol => this.hasInitialDocs(symbol)).length;
    return [
      `${symbols.length} indexed`,
      `${documentedCount} with docs`,
    ].map(label => `<span class="pill">${this.escapeHtml(label)}</span>`).join('');
  }

  private buildInitialKindFilters(symbols: IndexedSymbolSummary[]): string {
    const counts = new Map<string, number>();
    for (const symbol of symbols) {
      const kind = this.normalizeKind(symbol.kind);
      counts.set(kind, (counts.get(kind) || 0) + 1);
    }

    const chips = [`<span class="kind-chip active">All ${symbols.length}</span>`];
    for (const [kind, count] of [...counts.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
      chips.push(`<span class="kind-chip">${this.escapeHtml(kind)} ${count}</span>`);
    }

    return chips.join('');
  }

  private buildInitialModuleActions(symbols: IndexedSymbolSummary[], moduleName: string): string {
    const exactRoot = symbols.find(symbol => symbol.name === moduleName);
    if (!exactRoot?.url) {
      return '<div class="sidebar-note">Interactive actions load when the browser script is ready.</div>';
    }

    return `<a class="ghost" href="${this.escapeHtml(exactRoot.url)}" target="_blank" rel="noopener noreferrer">Open docs</a>`;
  }

  private buildInitialSelectedDetail(symbols: IndexedSymbolSummary[]): { meta: string; html: string } {
    const selected = [...symbols].sort((left, right) => left.name.localeCompare(right.name))[0];
    if (!selected) {
      return {
        meta: 'No symbol selected',
        html: '<div class="sidebar-note">No indexed symbols are available for this module yet.</div>',
      };
    }

    const summary = this.escapeHtml(this.truncate(selected.summary || 'Select a symbol after the browser script loads for richer actions and previews.', 260));
    return {
      meta: this.escapeHtml(this.normalizeKind(selected.kind)),
      html: [
        `<div class="detail-title">${this.escapeHtml(this.displayName(selected))}</div>`,
        `<div class="detail-copy">${this.escapeHtml(selected.name)}</div>`,
        selected.signature ? `<div class="signature">${this.escapeHtml(this.truncate(selected.signature, 220))}</div>` : '',
        `<div class="detail-copy">${summary || 'No cached summary is available for this symbol yet.'}</div>`,
        `<div class="detail-copy">${this.escapeHtml(this.formatInitialRowMeta(selected))}</div>`,
        selected.url ? `<div class="stack"><a class="ghost" href="${this.escapeHtml(selected.url)}" target="_blank" rel="noopener noreferrer">Open docs</a></div>` : '',
      ].filter(Boolean).join(''),
    };
  }

  private buildInitialNamespaces(moduleName: string, symbols: IndexedSymbolSummary[]): { meta: string; html: string } {
    const branches = new Map<string, number>();

    for (const symbol of symbols) {
      if (!symbol.name.startsWith(`${moduleName}.`)) {
        continue;
      }

      const parts = symbol.name.slice(moduleName.length + 1).split('.').filter(Boolean);
      if (parts.length <= 1) {
        continue;
      }

      branches.set(parts[0], (branches.get(parts[0]) || 0) + 1);
    }

    const entries = [...branches.entries()].sort((left, right) => left[0].localeCompare(right[0])).slice(0, 12);
    if (entries.length === 0) {
      return {
        meta: '0 branches',
        html: '<div class="sidebar-note">Namespace navigation loads when the browser script is ready.</div>',
      };
    }

    return {
      meta: `${entries.length} branches`,
      html: entries.map(([name, count]) => `<div class="nav-item"><span class="nav-text"><span class="nav-title">${this.escapeHtml(name)}</span></span><span class="pill">${count}</span></div>`).join(''),
    };
  }

  private buildInitialRows(symbols: IndexedSymbolSummary[]): { title: string; meta: string; html: string } {
    const rows = [...symbols]
      .sort((left, right) => left.name.localeCompare(right.name))
      .slice(0, 160);

    return {
      title: 'Indexed symbols',
      meta: `${rows.length} item${rows.length === 1 ? '' : 's'} shown`,
      html: rows.length === 0
        ? '<div class="empty">No indexed symbols are available for this module yet.</div>'
        : rows.map(symbol => {
          const summary = this.escapeHtml(this.truncate(symbol.summary || 'No cached summary is available for this symbol yet.', 220));
          const signature = symbol.signature ? `<div class="signature">${this.escapeHtml(this.truncate(symbol.signature, 180))}</div>` : '';
          const docsLink = symbol.url
            ? `<div class="actions"><a class="action" href="${this.escapeHtml(symbol.url)}" target="_blank" rel="noopener noreferrer">Docs</a></div>`
            : '';
          return [
            '<article class="row">',
            '<div class="row-head">',
            '<div class="row-title-group">',
            `<div class="row-title">${this.escapeHtml(this.displayName(symbol))}</div>`,
            `<div class="row-path">${this.escapeHtml(symbol.name)}</div>`,
            '</div>',
            docsLink,
            '</div>',
            `<div class="row-meta">${this.escapeHtml(this.formatInitialRowMeta(symbol))}</div>`,
            signature,
            `<div class="row-summary">${summary}</div>`,
            '</article>',
          ].join('');
        }).join(''),
    };
  }

  private displayName(symbol: IndexedSymbolSummary): string {
    const parts = symbol.name.split('.').filter(Boolean);
    return parts[parts.length - 1] || symbol.name;
  }

  private normalizeKind(kind?: string): string {
    return kind || 'symbol';
  }

  private hasInitialDocs(symbol: IndexedSymbolSummary): boolean {
    return Boolean(symbol.url || symbol.summary || symbol.signature || symbol.sourceUrl);
  }

  private formatInitialRowMeta(symbol: IndexedSymbolSummary): string {
    const parts = [this.normalizeKind(symbol.kind), symbol.package || symbol.module || 'module'];
    parts.push(this.hasInitialDocs(symbol) ? 'docs' : 'index only');
    return parts.join(' · ');
  }

  private truncate(text: string, maxLength: number): string {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean.length <= maxLength) {
      return clean;
    }

    return `${clean.slice(0, maxLength - 1).trimEnd()}...`;
  }

  private buildHtml(webview: vscode.Webview, payload: ModuleBrowserPayload): string {
    const { moduleName, symbols, settings } = payload;
    const payloadData = this.serializeForScript({ moduleName, symbols, settings });
    const initialPackageOptions = this.buildInitialPackageOptions(symbols);
    const initialSidebarMeta = this.buildInitialSidebarMeta(symbols);
    const initialKindFilters = this.buildInitialKindFilters(symbols);
    const initialModuleActions = this.buildInitialModuleActions(symbols, moduleName);
    const initialSelectedDetail = this.buildInitialSelectedDetail(symbols);
    const initialNamespaces = this.buildInitialNamespaces(moduleName, symbols);
    const initialRows = this.buildInitialRows(symbols);
    const scriptUri = this.moduleBrowserScriptUri(webview);

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${webview.cspSource}; script-src ${webview.cspSource}; base-uri 'none';">
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
    background:
      radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 9%, transparent), transparent 36%),
      var(--bg);
    color: var(--fg);
    font: 13px/1.45 var(--vscode-font-family);
  }

  button,
  input,
  select {
    font: inherit;
  }

  button:focus-visible,
  input:focus-visible,
  select:focus-visible,
  .row:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .app {
    height: 100vh;
    display: grid;
    grid-template-rows: auto 1fr;
  }

  .toolbar {
    display: grid;
    gap: 10px;
    padding: 12px;
    border-bottom: 1px solid var(--border);
    background: var(--panel);
  }

  .toolbar-hero {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(260px, 0.95fr);
    gap: 12px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 10%, var(--panel-alt)), var(--panel));
  }

  .toolbar-copy {
    display: grid;
    gap: 5px;
    min-width: 0;
  }

  .toolbar-kicker {
    font-size: 11px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .toolbar-title {
    font-size: 18px;
    font-weight: 650;
    line-height: 1.2;
    word-break: break-word;
  }

  .toolbar-subtitle {
    color: var(--muted);
    max-width: 68ch;
  }

  .toolbar-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-content: start;
  }

  .toolbar-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: color-mix(in srgb, var(--bg) 97%, var(--fg) 3%);
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
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 14px;
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
    padding: 14px 14px 12px;
    border-bottom: 1px solid var(--border);
    background: var(--panel);
  }

  .kind-bar {
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    background: var(--panel-alt);
  }

  .results {
    min-height: 0;
    overflow: auto;
    padding: 10px;
    display: grid;
    gap: 10px;
  }

  .row {
    display: grid;
    gap: 6px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: color-mix(in srgb, var(--bg) 97%, var(--fg) 3%);
  }

  .row:hover {
    background: var(--row-hover);
    border-color: var(--border-strong);
  }

  .row.active {
    background: var(--row-active);
    border-color: color-mix(in srgb, var(--accent) 30%, transparent);
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
    border: 1px solid var(--border);
    border-radius: 12px;
    background: color-mix(in srgb, var(--bg) 97%, var(--fg) 3%);
  }

  @media (max-width: 980px) {
    .split {
      grid-template-columns: 1fr;
    }

    .toolbar-hero {
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
    .row,
    .results {
      padding-left: 10px;
      padding-right: 10px;
    }

    .row-head,
    .list-header,
    .sidebar-section-head,
    .toolbar-hero {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
</head>
<body>
<div class="app">
  <header class="toolbar">
    <div class="toolbar-hero">
      <div class="toolbar-copy">
        <div class="toolbar-kicker">Module browser</div>
        <div class="toolbar-title">${this.escapeHtml(moduleName)}</div>
        <div class="toolbar-subtitle">Search indexed symbols, drill through namespaces, and pin docs without leaving the editor.</div>
      </div>
      <div class="toolbar-meta">${initialSidebarMeta}</div>
    </div>
    <div class="toolbar-row">
      <input id="query" class="search" type="search" data-focus-id="query" placeholder="Search dotted names like DataFrame.groupby or os.path.join">
      <select id="package-filter" class="select" data-focus-id="package-filter">${initialPackageOptions}</select>
      <select id="sort-filter" class="select" data-focus-id="sort-filter">
        <option value="name">Sort: name</option>
        <option value="kind">Sort: kind</option>
        <option value="package">Sort: package</option>
      </select>
      <select id="view-filter" class="select" data-focus-id="view-filter">
        <option value="hierarchy">View: hierarchy</option>
        <option value="flat">View: flat</option>
      </select>
    </div>
    <div class="toolbar-row">
      <div class="segments" id="density-row"></div>
      <label class="check"><input id="toggle-private" data-focus-id="toggle-private" type="checkbox">Show private</label>
      <label class="check"><input id="toggle-documented" data-focus-id="toggle-documented" type="checkbox">Documented only</label>
      <label class="check"><input id="toggle-auto" data-focus-id="toggle-auto" type="checkbox">Auto previews</label>
      <label class="check"><input id="toggle-hints" data-focus-id="toggle-hints" type="checkbox">Hierarchy hints</label>
      <button class="ghost" data-manual-preview="true" data-focus-id="manual-preview">Load previews</button>
      <button class="ghost" data-run-command="python-hover.searchDocs" data-focus-id="search-docs">Search docs</button>
      <button class="ghost" data-open-settings="python-hover.ui.moduleBrowser" data-focus-id="module-settings">Settings</button>
    </div>
  </header>

  <div class="split">
    <aside class="sidebar" id="sidebar">
      <section class="sidebar-block" id="module-block">
        <div class="sidebar-label">Module</div>
        <div class="module-title">${this.escapeHtml(moduleName)}</div>
        <div class="pill-row" id="sidebar-meta">${initialSidebarMeta}</div>
        <div class="breadcrumbs" id="breadcrumbs"><span class="crumb current">${this.escapeHtml(moduleName)}</span></div>
      </section>

      <section class="sidebar-block" id="module-actions-block">
        <div class="sidebar-section-head">
          <div class="sidebar-label">Module Actions</div>
          <div class="muted" id="current-scope">${this.escapeHtml(moduleName)}</div>
        </div>
        <div class="stack" id="module-actions">${initialModuleActions}</div>
      </section>

      <section class="sidebar-block" id="selected-symbol-block">
        <div class="sidebar-section-head">
          <div class="sidebar-label">Selected Symbol</div>
          <div class="muted" id="detail-meta">${initialSelectedDetail.meta}</div>
        </div>
        <div class="detail-block" id="detail-panel">${initialSelectedDetail.html}</div>
      </section>

      <section class="sidebar-block" id="namespaces-block">
        <div class="sidebar-section-head">
          <div class="sidebar-label">Namespaces</div>
          <div class="muted" id="branch-meta">${this.escapeHtml(initialNamespaces.meta)}</div>
        </div>
        <div class="nav-list" id="branch-list">${initialNamespaces.html}</div>
      </section>
    </aside>

    <section class="main">
      <header class="list-header">
        <div>
          <div class="list-caption">Symbols</div>
          <div class="list-title" id="list-title">${this.escapeHtml(initialRows.title)}</div>
        </div>
        <div class="list-meta" id="list-meta">${this.escapeHtml(initialRows.meta)}</div>
      </header>
      <div class="kind-bar">
        <div class="kind-row" id="kind-row">${initialKindFilters}</div>
      </div>
      <div class="results" id="results">${initialRows.html}</div>
    </section>
  </div>
</div>

<div id="pyhover-module-browser-payload" hidden>${payloadData}</div>
<script src="${scriptUri}"></script>
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

  private serializeForScript(value: unknown): string {
    return JSON.stringify(value)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
  }
}
