import * as vscode from 'vscode';
import { IndexedSymbolPreview, IndexedSymbolSummary } from '../../../shared/types';

export class ModuleBrowserPanel {
  private static instance: ModuleBrowserPanel | undefined;
  private panel: vscode.WebviewPanel | undefined;
  private disposables: vscode.Disposable[] = [];

  static getInstance(): ModuleBrowserPanel {
    if (!ModuleBrowserPanel.instance) {
      ModuleBrowserPanel.instance = new ModuleBrowserPanel();
    }
    return ModuleBrowserPanel.instance;
  }

  show(moduleName: string, symbols: IndexedSymbolSummary[]): void {
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        'pyhover.moduleBrowser',
        this.titleFor(moduleName),
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
        {
          enableScripts: true,
          retainContextWhenHidden: false,
        }
      );

      this.panel.onDidDispose(() => {
        this.panel = undefined;
        vscode.Disposable.from(...this.disposables).dispose();
        this.disposables = [];
      });

      this.disposables.push(
        this.panel.webview.onDidReceiveMessage(async message => {
          if (message?.type === 'open-doc' && typeof message.url === 'string' && message.url) {
            void vscode.commands.executeCommand('python-hover.openDocsSide', message.url);
            return;
          }

          if (message?.type === 'pin-symbol' && message.symbol) {
            void vscode.commands.executeCommand('python-hover.pinIndexedSymbol', message.symbol);
            return;
          }

          if (message?.type === 'open-source' && message.symbol) {
            void vscode.commands.executeCommand('python-hover.openIndexedSymbolSource', message.symbol);
            return;
          }

          if (message?.type === 'load-previews' && Array.isArray(message.symbols) && this.panel) {
            const previews = await vscode.commands.executeCommand<IndexedSymbolPreview[]>(
              'python-hover.getIndexedSymbolPreviews',
              message.symbols,
            ) ?? [];
            void this.panel.webview.postMessage({
              type: 'preview-data',
              requestId: message.requestId,
              previews,
            });
          }
        })
      );
    }

    this.panel.title = this.titleFor(moduleName);
    this.panel.webview.html = this.buildHtml(moduleName, symbols);
    this.panel.reveal(undefined, true);
  }

  dispose(): void {
    this.panel?.dispose();
    this.panel = undefined;
  }

  private titleFor(moduleName: string): string {
    return `${moduleName} Browser`;
  }

  private buildHtml(moduleName: string, symbols: IndexedSymbolSummary[]): string {
    const data = JSON.stringify(symbols)
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
    --fg: var(--vscode-editor-foreground);
    --muted: var(--vscode-descriptionForeground);
    --panel: color-mix(in srgb, var(--bg) 82%, var(--fg) 6%);
    --border: color-mix(in srgb, var(--fg) 18%, transparent);
    --accent: var(--vscode-textLink-foreground);
    --chip: color-mix(in srgb, var(--accent) 12%, var(--bg));
  }

  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--fg); }
  body {
    font: 13px/1.45 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    min-height: 100vh;
  }

  .shell { max-width: 1120px; margin: 0 auto; padding: 16px; }
  .hero {
    padding: 14px 16px;
    border: 1px solid var(--border);
    background: var(--panel);
    border-radius: 6px;
  }
  .eyebrow {
    color: var(--muted);
    font-size: 11px;
    margin-bottom: 4px;
  }
  h1 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }
  .subtitle {
    margin-top: 6px;
    color: var(--muted);
    font-size: 12px;
    max-width: 760px;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
  }
  .pill {
    padding: 2px 7px;
    border-radius: 4px;
    background: var(--chip);
    border: 1px solid var(--border);
    font-size: 12px;
  }
  .controls {
    margin-top: 12px;
    display: grid;
    grid-template-columns: minmax(260px, 1.6fr) minmax(180px, 0.8fr);
    gap: 8px;
  }
  .input,
  .select {
    width: 100%;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg);
    border-radius: 4px;
    padding: 6px 10px;
    font: inherit;
  }
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 8px;
    margin: 10px 0 0;
  }
  .summary-card {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 10px 12px;
  }
  .summary-card strong {
    display: block;
    font-size: 18px;
    line-height: 1;
    margin-bottom: 4px;
  }
  .summary-card span { color: var(--muted); font-size: 12px; }
  .kind-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 10px 0 0;
  }
  .breadcrumbs {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
  }
  .crumb {
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg);
    border-radius: 4px;
    padding: 3px 9px;
    font: inherit;
    cursor: pointer;
    font-size: 12px;
  }
  .crumb.current {
    background: color-mix(in srgb, var(--accent) 14%, var(--bg));
  }
  .chip {
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg);
    border-radius: 4px;
    padding: 3px 9px;
    font: inherit;
    cursor: pointer;
    font-size: 12px;
  }
  .chip.active {
    background: var(--accent);
    color: var(--vscode-button-foreground);
    border-color: transparent;
  }
  .results {
    margin-top: 12px;
    display: grid;
    gap: 8px;
  }
  .section {
    display: grid;
    gap: 8px;
  }
  .section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }
  .section-title {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
  }
  .section-subtle {
    color: var(--muted);
    font-size: 12px;
  }
  .grid {
    display: grid;
    gap: 8px;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  }
  .empty {
    padding: 20px;
    border-radius: 5px;
    border: 1px dashed var(--border);
    color: var(--muted);
    text-align: center;
  }
  .card {
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 10px 12px;
    background: var(--bg);
  }
  .card-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }
  .name {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    word-break: break-word;
  }
  .subtle {
    margin-top: 3px;
    color: var(--muted);
    font-size: 12px;
    word-break: break-word;
  }
  .summary {
    margin-top: 8px;
    color: var(--fg);
    font-size: 12px;
  }
  .signature {
    margin-top: 8px;
    padding: 7px 10px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: color-mix(in srgb, var(--bg) 76%, var(--fg) 7%);
    overflow: auto;
    font-size: 12px;
  }
  .signature code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .nav-card {
    cursor: pointer;
    background: color-mix(in srgb, var(--accent) 6%, var(--bg));
  }
  .nav-card:hover,
  .card:hover {
    border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
  }
  .actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
  }
  .action {
    border: 1px solid var(--border);
    background: color-mix(in srgb, var(--accent) 10%, var(--bg));
    color: var(--fg);
    border-radius: 4px;
    padding: 4px 9px;
    cursor: pointer;
    font: inherit;
    font-size: 12px;
  }
  .action:hover,
  .chip:hover { filter: brightness(1.08); }
  .footer {
    margin-top: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 7px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--bg);
    font-size: 12px;
    color: var(--muted);
  }
  @media (max-width: 720px) {
    .shell { padding: 12px; }
    .controls { grid-template-columns: 1fr; }
    .card-top { flex-direction: column; }
    .actions { width: 100%; }
  }
</style>
</head>
<body>
<div class="shell">
  <section class="hero">
    <div class="eyebrow">Indexed Module Browser</div>
    <h1>${this.escapeHtml(moduleName)}</h1>
    <p class="subtitle">Browse everything already indexed for this module, narrow it by kind, and open any symbol in the integrated docs panel without leaving the code editor.</p>
    <div class="meta" id="meta"></div>
    <div class="controls">
      <input id="query" class="input" type="search" placeholder="Filter symbols by name or package">
      <select id="sort" class="select">
        <option value="name">Sort by name</option>
        <option value="kind">Sort by kind</option>
      </select>
    </div>
    <div class="summary-grid" id="summary"></div>
    <div class="kind-row" id="kind-row"></div>
    <div class="breadcrumbs" id="breadcrumbs"></div>
  </section>
  <section class="results" id="results"></section>
</div>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const moduleName = ${JSON.stringify(moduleName)};
  const symbols = ${data};
  const queryInput = document.getElementById('query');
  const sortSelect = document.getElementById('sort');
  const resultsEl = document.getElementById('results');
  const summaryEl = document.getElementById('summary');
  const kindRowEl = document.getElementById('kind-row');
  const metaEl = document.getElementById('meta');
  const breadcrumbsEl = document.getElementById('breadcrumbs');
  const previewCache = new Map();
  const requestedPreviews = new Set();
  let previewRequestId = 0;

  let activeKind = 'all';
  let currentPath = [];

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getKindCounts(items) {
    const counts = new Map();
    for (const item of items) {
      const key = item.kind || 'symbol';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
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

  function truncate(text, maxLength) {
    if (!text) return '';
    const clean = String(text).replace(/\s+/g, ' ').trim();
    if (clean.length <= maxLength) return clean;
    return clean.slice(0, maxLength - 1).trimEnd() + '…';
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
    return Boolean(preview.summary || preview.signature || preview.sourceUrl);
  }

  for (const symbol of symbols) {
    const preview = initialPreview(symbol);
    if (hasInitialPreviewData(preview)) {
      previewCache.set(symbol.name, preview);
      requestedPreviews.add(symbol.name);
    }
  }

  function previewFor(item) {
    return previewCache.get(item.name) || initialPreview(item);
  }

  function renderMeta(items) {
    const packages = new Set(items.map(item => item.package).filter(Boolean));
    const exact = items.find(item => item.name === moduleName);
    metaEl.innerHTML = [
      '<span class="pill">' + items.length + ' indexed symbols</span>',
      '<span class="pill">' + packages.size + ' package bucket' + (packages.size === 1 ? '' : 's') + '</span>',
      exact ? '<span class="pill">module root indexed</span>' : '<span class="pill">module root not indexed</span>'
    ].join('');
  }

  function renderBreadcrumbs() {
    const crumbs = ['<button class="crumb' + (currentPath.length === 0 ? ' current' : '') + '" data-breadcrumb="">' + escapeHtml(moduleName) + '</button>'];
    for (let index = 0; index < currentPath.length; index++) {
      const path = currentPath.slice(0, index + 1).join('.');
      crumbs.push('<button class="crumb' + (index === currentPath.length - 1 ? ' current' : '') + '" data-breadcrumb="' + escapeHtml(path) + '">' + escapeHtml(currentPath[index]) + '</button>');
    }
    breadcrumbsEl.innerHTML = crumbs.join('');
    for (const button of breadcrumbsEl.querySelectorAll('[data-breadcrumb]')) {
      button.addEventListener('click', () => {
        const path = button.getAttribute('data-breadcrumb') || '';
        currentPath = path ? path.split('.').filter(Boolean) : [];
        render();
      });
    }
  }

  function renderSummary(items) {
    const packages = new Set(items.map(item => item.package).filter(Boolean));
    const publicMembers = items.filter(item => {
      const tail = item.name.split('.').pop() || '';
      return tail && !tail.startsWith('_');
    }).length;
    const exact = items.filter(item => item.name === moduleName).length;

    summaryEl.innerHTML = [
      ['Symbols', items.length],
      ['Kinds', getKindCounts(items).length],
      ['Public-looking names', publicMembers],
      ['Root matches', exact],
      ['Packages', packages.size]
    ].map(([label, value]) => '<div class="summary-card"><strong>' + value + '</strong><span>' + label + '</span></div>').join('');
  }

  function renderKindFilters(items) {
    const counts = getKindCounts(items);
    const chips = ['<button class="chip' + (activeKind === 'all' ? ' active' : '') + '" data-kind="all">All <strong>' + items.length + '</strong></button>'];
    for (const [kind, count] of counts) {
      chips.push('<button class="chip' + (activeKind === kind ? ' active' : '') + '" data-kind="' + escapeHtml(kind) + '">' + escapeHtml(kind) + ' <strong>' + count + '</strong></button>');
    }
    kindRowEl.innerHTML = chips.join('');
    for (const button of kindRowEl.querySelectorAll('[data-kind]')) {
      button.addEventListener('click', () => {
        activeKind = button.getAttribute('data-kind') || 'all';
        render();
      });
    }
  }

  function filteredSymbols() {
    const query = queryInput.value.trim().toLowerCase();
    let items = symbols.filter(item => activeKind === 'all' || (item.kind || 'symbol') === activeKind);
    if (query) {
      items = items.filter(item => item.name.toLowerCase().includes(query) || item.package.toLowerCase().includes(query));
    } else {
      items = items.filter(item => pathMatches(relativeParts(item)));
    }

    if (sortSelect.value === 'kind') {
      items = items.slice().sort((a, b) => {
        const kindCmp = (a.kind || 'symbol').localeCompare(b.kind || 'symbol');
        if (kindCmp !== 0) return kindCmp;
        return a.name.localeCompare(b.name);
      });
    } else {
      items = items.slice().sort((a, b) => a.name.localeCompare(b.name));
    }
    return items;
  }

  function hierarchyView(items) {
    const namespaces = new Map();
    const leaves = [];

    for (const item of items) {
      const parts = relativeParts(item);
      if (!pathMatches(parts)) continue;

      if (parts.length <= currentPath.length + 1) {
        leaves.push(item);
        continue;
      }

      const child = parts[currentPath.length];
      const fullPath = currentPath.concat(child);
      const key = fullPath.join('.');
      const entry = namespaces.get(key) || {
        name: child,
        path: fullPath,
        symbolCount: 0,
        kinds: new Set(),
      };
      entry.symbolCount += 1;
      entry.kinds.add(item.kind || 'symbol');
      namespaces.set(key, entry);
    }

    return {
      namespaces: [...namespaces.values()].sort((a, b) => a.path.join('.').localeCompare(b.path.join('.'))),
      leaves,
    };
  }

  function renderHierarchy(items) {
    const view = hierarchyView(items);
    const sections = [];

    if (view.namespaces.length > 0) {
      const cards = view.namespaces.map(namespace => {
        const kindLabel = [...namespace.kinds].sort().join(', ');
        return '<article class="card nav-card" data-path="' + escapeHtml(namespace.path.join('.')) + '">'
          + '<div class="card-top">'
          + '<div>'
          + '<h2 class="name">' + escapeHtml(namespace.name) + '</h2>'
          + '<div class="subtle">' + escapeHtml(moduleName + '.' + namespace.path.join('.')) + '</div>'
          + '</div>'
          + '</div>'
          + '<div class="summary">Browse ' + namespace.symbolCount + ' nested symbol' + (namespace.symbolCount === 1 ? '' : 's') + ' in this branch.</div>'
          + '<div class="footer">'
          + '<span class="tag">hierarchy node</span>'
          + '<span class="tag">kinds: ' + escapeHtml(kindLabel || 'symbol') + '</span>'
          + '</div>'
          + '</article>';
      }).join('');
      sections.push('<section class="section"><div class="section-head"><h2 class="section-title">Namespaces</h2><div class="section-subtle">Navigate deeper through package and symbol paths.</div></div><div class="grid">' + cards + '</div></section>');
    }

    if (view.leaves.length > 0) {
      sections.push(renderSymbolSection(view.leaves, queryInput.value.trim() ? 'Matching Symbols' : 'Symbols at This Level'));
    }

    if (sections.length === 0) {
      resultsEl.innerHTML = '<div class="empty">Nothing is indexed at this path yet. Try a broader filter or move back up the hierarchy.</div>';
      return;
    }

    resultsEl.innerHTML = sections.join('');
    wireInteractiveElements();
    queuePreviewLoad(view.leaves);
  }

  function renderSymbolSection(items, title) {
    return '<section class="section"><div class="section-head"><h2 class="section-title">' + escapeHtml(title) + '</h2><div class="section-subtle">Open docs, pin a hover-style panel, or jump to source when available.</div></div><div class="grid">' + items.map(renderSymbolCard).join('') + '</div></section>';
  }

  function renderSymbolCard(item) {
    const preview = previewFor(item);
    const shortName = item.name.startsWith(currentPrefix() + '.')
      ? item.name.slice(currentPrefix().length + 1)
      : item.name.startsWith(moduleName + '.')
        ? item.name.slice(moduleName.length + 1)
        : item.name;
    const summary = truncate(preview.summary, 220);
    const signature = truncate(preview.signature, 180);
    const data = encodeURIComponent(JSON.stringify(item));

    return '<article class="card">'
      + '<div class="card-top">'
      + '<div>'
      + '<h2 class="name">' + escapeHtml(shortName || item.name) + '</h2>'
      + '<div class="subtle">' + escapeHtml(item.name) + '</div>'
      + '</div>'
      + '<div class="actions">'
      + '<button class="action" data-open="' + escapeHtml(item.url) + '">Open Docs</button>'
      + '<button class="action" data-pin="' + data + '">Pin Hover</button>'
      + '<button class="action" data-source="' + data + '">Source</button>'
      + '</div>'
      + '</div>'
      + (signature ? '<div class="signature"><code>' + escapeHtml(signature) + '</code></div>' : '')
      + (summary ? '<div class="summary">' + escapeHtml(summary) + '</div>' : '')
      + '<div class="footer">'
      + '<span class="tag">kind: ' + escapeHtml(preview.kind || item.kind || 'symbol') + '</span>'
      + '<span class="tag">package: ' + escapeHtml(item.package || moduleName) + '</span>'
      + (preview.installedVersion ? '<span class="tag">installed: v' + escapeHtml(preview.installedVersion) + '</span>' : '')
      + '</div>'
      + '</article>';
  }

  function wireInteractiveElements() {
    for (const button of resultsEl.querySelectorAll('[data-open]')) {
      button.addEventListener('click', () => {
        const url = button.getAttribute('data-open');
        if (url) {
          vscode.postMessage({ type: 'open-doc', url });
        }
      });
    }

    for (const button of resultsEl.querySelectorAll('[data-pin]')) {
      button.addEventListener('click', () => {
        const raw = button.getAttribute('data-pin');
        if (raw) {
          vscode.postMessage({ type: 'pin-symbol', symbol: JSON.parse(decodeURIComponent(raw)) });
        }
      });
    }

    for (const button of resultsEl.querySelectorAll('[data-source]')) {
      button.addEventListener('click', () => {
        const raw = button.getAttribute('data-source');
        if (raw) {
          vscode.postMessage({ type: 'open-source', symbol: JSON.parse(decodeURIComponent(raw)) });
        }
      });
    }

    for (const card of resultsEl.querySelectorAll('[data-path]')) {
      card.addEventListener('click', () => {
        const path = card.getAttribute('data-path');
        if (path) {
          currentPath = path.split('.').filter(Boolean);
          render();
        }
      });
    }
  }

  function queuePreviewLoad(items) {
    const pending = items
      .filter(item => !previewCache.has(item.name) && !requestedPreviews.has(item.name))
      .slice(0, 12);
    if (pending.length === 0) return;

    const requestId = ++previewRequestId;
    for (const item of pending) {
      requestedPreviews.add(item.name);
    }
    vscode.postMessage({ type: 'load-previews', requestId, symbols: pending });
  }

  function render() {
    renderMeta(symbols);
    renderSummary(symbols);
    renderKindFilters(symbols);
    renderBreadcrumbs();
    const items = filteredSymbols();
    if (!items.length) {
      resultsEl.innerHTML = '<div class="empty">No symbols match the current filter. Try a broader search or switch back to <strong>All</strong>.</div>';
      return;
    }
    renderHierarchy(items);
  }

  window.addEventListener('message', event => {
    const message = event.data;
    if (!message || message.type !== 'preview-data' || !Array.isArray(message.previews)) {
      return;
    }

    let didChange = false;
    for (const preview of message.previews) {
      if (preview && preview.name) {
        const previous = previewCache.get(preview.name);
        const next = JSON.stringify(preview);
        const current = previous ? JSON.stringify(previous) : '';
        if (next !== current) {
          previewCache.set(preview.name, preview);
          didChange = true;
        }
      }
    }

    if (didChange) {
      render();
    }
  });

  queryInput.addEventListener('input', render);
  sortSelect.addEventListener('change', render);
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
