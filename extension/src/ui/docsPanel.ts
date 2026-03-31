import * as vscode from 'vscode';
import { createWebviewNonce } from './webviewNonce';

/**
 * Persistent side-panel docs browser.
 *
 * First call → creates a WebviewPanel in ViewColumn.Beside (always to the right of the
 * active code editor, never replacing it).  Subsequent calls → reveal + navigate the
 * existing panel without recreating it, so the column position the user chose is kept.
 *
 * The inner iframe loads docs.python.org / numpy.org / etc. directly.
 * A small toolbar lets the user type a URL or pop the page out to the system browser.
 */
export class DocsPanel {
    private static _instance: DocsPanel | undefined;
    private panel: vscode.WebviewPanel | undefined;
  private pendingNavigationTimer: ReturnType<typeof setTimeout> | undefined;
  private autoOpenCurrentHoverInIntegratedDocs = false;
  private onDidToggleAutoOpenCurrentHoverInIntegratedDocs: ((enabled: boolean) => void | Promise<void>) | undefined;

  private isDocsPanelMessage(message: unknown): message is
    | { type: 'openExternal' | 'syncTitle' | 'copyUrl'; url: string }
    | { type: 'setAutoOpenCurrentHover'; enabled: boolean } {
    if (!message || typeof message !== 'object' || (message as { type?: unknown }).type === undefined) {
      return false;
    }

    const type = (message as { type?: unknown }).type;
    if (type === 'setAutoOpenCurrentHover') {
      return typeof (message as { enabled?: unknown }).enabled === 'boolean';
    }

    return (((type === 'openExternal') || (type === 'syncTitle') || (type === 'copyUrl'))
      && typeof (message as { url?: unknown }).url === 'string');
  }

    static getInstance(): DocsPanel {
        if (!DocsPanel._instance) {
            DocsPanel._instance = new DocsPanel();
        }
        return DocsPanel._instance;
    }

  isOpen(): boolean {
    return !!this.panel;
  }

  configure(options: {
    autoOpenCurrentHoverInIntegratedDocs?: boolean;
    onDidToggleAutoOpenCurrentHoverInIntegratedDocs?: (enabled: boolean) => void | Promise<void>;
  }): void {
    if (typeof options.autoOpenCurrentHoverInIntegratedDocs === 'boolean') {
      this.autoOpenCurrentHoverInIntegratedDocs = options.autoOpenCurrentHoverInIntegratedDocs;
    }

    if (options.onDidToggleAutoOpenCurrentHoverInIntegratedDocs) {
      this.onDidToggleAutoOpenCurrentHoverInIntegratedDocs = options.onDidToggleAutoOpenCurrentHoverInIntegratedDocs;
    }

    void this.panel?.webview.postMessage({
      type: 'syncAutoOpenCurrentHover',
      enabled: this.autoOpenCurrentHoverInIntegratedDocs,
    });
  }

  show(url: string, options?: { createIfMissing?: boolean }): void {
      const safeUrl = this.normalizeWebUrl(url);
      if (!safeUrl) {
        return;
      }

    const createIfMissing = options?.createIfMissing ?? true;
    if (!this.panel && !createIfMissing) {
      return;
    }

        if (this.panel) {
            // Panel already exists — navigate to the new URL, stay in whatever column it's in
          this.panel.title = this.titleFromUrl(safeUrl);
            this.panel.reveal(undefined, /* preserveFocus */ true);
            // Small delay so the webview is visible before we post a message
          clearTimeout(this.pendingNavigationTimer);
          this.pendingNavigationTimer = setTimeout(() => {
            this.pendingNavigationTimer = undefined;
            this.panel?.webview.postMessage({ type: 'navigate', url: safeUrl });
            }, 50);
        } else {
            // First open — create in the beside column so it never covers the code editor
            this.panel = vscode.window.createWebviewPanel(
                'pyhover.docsBrowser',
              this.titleFromUrl(safeUrl),
                { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
                {
                    enableScripts: true,
                  retainContextWhenHidden: false,
                  localResourceRoots: [],
                }
            );
          this.panel.webview.onDidReceiveMessage(message => {
            if (!this.isDocsPanelMessage(message)) {
              return;
            }

            if (message.type === 'syncTitle') {
              const safeTitleUrl = this.normalizeWebUrl(message.url);
              if (safeTitleUrl && this.panel) {
                this.panel.title = this.titleFromUrl(safeTitleUrl);
              }
              return;
            }

            if (message.type === 'setAutoOpenCurrentHover') {
              this.autoOpenCurrentHoverInIntegratedDocs = message.enabled;
              void this.onDidToggleAutoOpenCurrentHoverInIntegratedDocs?.(message.enabled);
              return;
            }

            if (message.type === 'copyUrl') {
              const copyUrl = this.normalizeWebUrl(message.url);
              if (!copyUrl) {
                return;
              }

              void vscode.env.clipboard.writeText(copyUrl);
              return;
            }

            const externalUrl = this.normalizeWebUrl(message.url);
            if (!externalUrl) {
              return;
            }

            void vscode.env.openExternal(vscode.Uri.parse(externalUrl));
          });
          this.panel.webview.html = this.buildHtml(safeUrl);
          this.panel.onDidDispose(() => {
            clearTimeout(this.pendingNavigationTimer);
            this.pendingNavigationTimer = undefined;
            this.panel = undefined;
          });
        }
    }

    dispose(): void {
      clearTimeout(this.pendingNavigationTimer);
      this.pendingNavigationTimer = undefined;
        this.panel?.dispose();
        this.panel = undefined;
    }

  private normalizeWebUrl(url: string): string | null {
    try {
      const parsed = new URL(url.trim());
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
      }
      return parsed.toString();
    } catch {
      return null;
    }
  }

    private titleFromUrl(url: string): string {
        try {
            const host = new URL(url).hostname.replace(/^www\./, '');
            return host || 'Python Docs';
        } catch {
            return 'Python Docs';
        }
    }

    private buildHtml(initialUrl: string): string {
      const nonce = createWebviewNonce();
        const safe = initialUrl
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none';
           frame-src http: https:;
           script-src 'nonce-${nonce}';
           style-src 'unsafe-inline';
           base-uri 'none';">
<style>
  :root {
    --panel-border: color-mix(in srgb, var(--vscode-panel-border, #3c3c3c) 72%, transparent);
    --panel-strong: color-mix(in srgb, var(--vscode-textLink-foreground, #3794ff) 30%, var(--panel-border));
    --panel-surface: color-mix(in srgb, var(--vscode-editor-background, #1e1e1e) 95%, var(--vscode-editor-foreground, #ccc) 5%);
    --panel-surface-strong: color-mix(in srgb, var(--vscode-editor-background, #1e1e1e) 92%, var(--vscode-editor-foreground, #ccc) 8%);
    --panel-muted: var(--vscode-descriptionForeground, #9da5b4);
    --panel-accent: var(--vscode-textLink-foreground, #3794ff);
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    height: 100%;
    overflow: hidden;
    background:
      radial-gradient(circle at top left, color-mix(in srgb, var(--panel-accent) 12%, transparent), transparent 42%),
      var(--vscode-editor-background, #1e1e1e);
    color: var(--vscode-editor-foreground, #ccc);
    font: 13px/1.45 var(--vscode-font-family);
  }
  button, input { font: inherit; }
  .shell {
    height: 100%;
    display: grid;
    grid-template-rows: auto 1fr;
    gap: 10px;
    padding: 10px;
  }
  .chrome,
  .frame-shell {
    border: 1px solid var(--panel-border);
    border-radius: 12px;
    background: var(--panel-surface);
    overflow: hidden;
  }
  .chrome {
    display: grid;
    gap: 10px;
    padding: 12px;
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--panel-accent) 10%, var(--panel-surface-strong)), var(--panel-surface));
  }
  .chrome.collapsed {
    gap: 8px;
    padding: 10px 12px;
  }
  .chrome.collapsed .subtitle,
  .chrome.collapsed .input-row,
  .chrome.collapsed .helper-row {
    display: none;
  }
  .chrome.collapsed .title {
    font-size: 13px;
  }
  .chrome-top,
  .input-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .chrome-copy {
    min-width: 0;
    flex: 1 1 320px;
    display: grid;
    gap: 4px;
  }
  .eyebrow,
  .label {
    font-size: 11px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--panel-muted);
  }
  .title {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.25;
  }
  .subtitle {
    color: var(--panel-muted);
    max-width: 70ch;
  }
  .meta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 9px;
    border-radius: 999px;
    border: 1px solid var(--panel-border);
    background: color-mix(in srgb, var(--vscode-editor-background, #1e1e1e) 94%, var(--vscode-editor-foreground, #ccc) 6%);
    color: var(--panel-muted);
    font-size: 12px;
    white-space: nowrap;
  }
  .pill.accent {
    color: var(--panel-accent);
    border-color: color-mix(in srgb, var(--panel-accent) 34%, transparent);
    background: color-mix(in srgb, var(--panel-accent) 12%, transparent);
  }
  .pill strong {
    color: var(--vscode-editor-foreground, #ccc);
    font-weight: 600;
  }
  .input-row {
    padding: 10px;
    border: 1px solid var(--panel-border);
    border-radius: 10px;
    background: color-mix(in srgb, var(--vscode-editor-background, #1e1e1e) 97%, var(--vscode-editor-foreground, #ccc) 3%);
  }
  #url-bar {
    flex: 1 1 320px;
    min-width: 0;
    background: var(--vscode-input-background, #3c3c3c);
    border: 1px solid var(--vscode-input-border, transparent);
    color: var(--vscode-input-foreground, #ccc);
    padding: 8px 10px;
    border-radius: 8px;
  }
  #url-bar:focus { outline: 1px solid var(--vscode-focusBorder, #007fd4); }
  #url-bar:focus-visible,
  .btn:focus-visible {
    outline: 2px solid var(--vscode-focusBorder, #007fd4);
    outline-offset: 2px;
  }
  .btn {
    flex-shrink: 0;
    min-height: 34px;
    background: var(--vscode-button-background, #0e639c);
    color: var(--vscode-button-foreground, #fff);
    border: none;
    padding: 0 12px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 12px;
    white-space: nowrap;
  }
  .btn:hover { background: var(--vscode-button-hoverBackground, #1177bb); }
  .btn.sec {
    background: var(--vscode-button-secondaryBackground, #3a3d41);
    color: var(--vscode-button-secondaryForeground, #ccc);
  }
  .btn.sec:hover { background: var(--vscode-button-secondaryHoverBackground, #45494e); }
  .btn.icon {
    min-width: 34px;
    padding: 0 10px;
  }
  .btn:disabled {
    opacity: 0.55;
    cursor: default;
  }
  .helper-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    color: var(--panel-muted);
    font-size: 12px;
    justify-content: space-between;
  }
  .helper-copy {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .toggle-chip {
    appearance: none;
    border: 1px solid var(--panel-border);
    border-radius: 999px;
    background: color-mix(in srgb, var(--vscode-editor-background, #1e1e1e) 94%, var(--vscode-editor-foreground, #ccc) 6%);
    color: var(--panel-muted);
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 30px;
    padding: 0 10px;
    cursor: pointer;
    white-space: nowrap;
  }
  .toggle-chip.active {
    color: var(--panel-accent);
    border-color: color-mix(in srgb, var(--panel-accent) 34%, transparent);
    background: color-mix(in srgb, var(--panel-accent) 12%, transparent);
  }
  .toggle-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: currentColor;
    opacity: 0.8;
  }
  .frame-shell {
    min-height: 0;
    padding: 6px;
    background: color-mix(in srgb, var(--vscode-editor-background, #1e1e1e) 96%, var(--vscode-editor-foreground, #ccc) 4%);
  }
  #frame {
    display: block;
    width: 100%;
    height: 100%;
    border: none;
    border-radius: 8px;
    background: #fff;
  }
  @media (max-width: 720px) {
    .shell {
      padding: 8px;
      gap: 8px;
    }
    .chrome {
      padding: 10px;
    }
    .chrome-top,
    .input-row {
      align-items: stretch;
    }
    .btn {
      flex: 1 1 auto;
    }
  }
</style>
</head>
<body>
<div class="shell">
  <header class="chrome">
    <div class="chrome-top">
      <div class="chrome-copy">
        <div class="eyebrow">Docs Browser</div>
        <div class="title">Browse official and package docs without replacing the editor</div>
        <div class="subtitle">Use this panel for deeper reading when a hover is still too compact. The page stays visible while the top controls can stay collapsed until you need them.</div>
      </div>
      <div class="meta-row">
        <span class="pill accent"><strong id="host-pill">Loading…</strong></span>
        <span class="pill">Integrated panel</span>
        <button class="btn sec" id="expand-btn" aria-expanded="false" title="Show or hide the docs controls">Show Controls</button>
      </div>
    </div>
    <div class="input-row">
      <button class="btn sec icon" id="back-btn" title="Back">&#x2039;</button>
      <button class="btn sec icon" id="forward-btn" title="Forward">&#x203A;</button>
      <button class="btn sec icon" id="reload-btn" title="Reload">&#x21bb;</button>
      <input id="url-bar" type="text" spellcheck="false" value="${safe}">
      <button class="btn" id="go-btn">Go</button>
      <button class="btn sec" id="copy-btn" title="Copy current URL">Copy Link</button>
      <button class="btn sec" id="ext-btn" title="Open in system browser">Open External</button>
    </div>
    <div class="helper-row">
      <div class="helper-copy">
        <span class="label">Current path</span>
        <span id="path-label">Loading…</span>
      </div>
      <div class="helper-copy">
        <button class="toggle-chip${this.autoOpenCurrentHoverInIntegratedDocs ? ' active' : ''}" id="auto-open-btn" type="button" aria-pressed="${this.autoOpenCurrentHoverInIntegratedDocs ? 'true' : 'false'}" title="Automatically open the current hover in this browser panel">
          <span class="toggle-dot"></span>
          <span id="auto-open-label">${this.autoOpenCurrentHoverInIntegratedDocs ? 'Auto-open hover on' : 'Auto-open hover off'}</span>
        </button>
        <span>Cmd/Ctrl+L focuses URL</span>
        <span>Cmd/Ctrl+R reloads</span>
      </div>
    </div>
  </header>
  <div class="frame-shell">
    <iframe id="frame" src="${safe}"
      sandbox="allow-same-origin allow-scripts allow-forms">
    </iframe>
  </div>
</div>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const chrome = document.querySelector('.chrome');
  const bar   = document.getElementById('url-bar');
  const frame = document.getElementById('frame');
  const hostPill = document.getElementById('host-pill');
  const pathLabel = document.getElementById('path-label');
  const backBtn = document.getElementById('back-btn');
  const forwardBtn = document.getElementById('forward-btn');
  const reloadBtn = document.getElementById('reload-btn');
  const copyBtn = document.getElementById('copy-btn');
  const expandBtn = document.getElementById('expand-btn');
  const autoOpenBtn = document.getElementById('auto-open-btn');
  const autoOpenLabel = document.getElementById('auto-open-label');
  let historyStack = [];
  let historyIndex = -1;
  let pendingNavigationMode = 'push';
  let isExpanded = false;
  let autoOpenCurrentHover = ${this.autoOpenCurrentHoverInIntegratedDocs ? 'true' : 'false'};

  function normalizeUrl(url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
      }
      return parsed.toString();
    } catch {
      return null;
    }
  }

  function syncChrome(url) {
    const target = normalizeUrl(url || bar.value.trim() || frame.src);
    if (!target) {
      return null;
    }

    try {
      const parsed = new URL(target);
      const nextHost = parsed.hostname.replace(/^www\\./, '') || parsed.hostname;
      const nextPath = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : 'Root page';
      hostPill.textContent = nextHost;
      pathLabel.textContent = nextPath;
    } catch {
      hostPill.textContent = 'Unknown host';
      pathLabel.textContent = target;
    }

    return target;
  }

  function setExpanded(expanded) {
    isExpanded = expanded;
    chrome.classList.toggle('collapsed', !expanded);
    expandBtn.textContent = expanded ? 'Hide Controls' : 'Show Controls';
    expandBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }

  function syncAutoOpenToggle(enabled) {
    autoOpenCurrentHover = enabled;
    autoOpenBtn.classList.toggle('active', enabled);
    autoOpenBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    autoOpenLabel.textContent = enabled ? 'Auto-open hover on' : 'Auto-open hover off';
  }

  function updateNavButtons() {
    backBtn.disabled = historyIndex <= 0;
    forwardBtn.disabled = historyIndex < 0 || historyIndex >= historyStack.length - 1;
  }

  function rememberHistory(url) {
    if (!url) {
      return;
    }

    if (historyIndex >= 0 && historyStack[historyIndex] === url) {
      updateNavButtons();
      return;
    }

    historyStack = historyStack.slice(0, historyIndex + 1);
    historyStack.push(url);
    historyIndex = historyStack.length - 1;
    updateNavButtons();
  }

  function navigate(url, mode) {
    const target = syncChrome(url || bar.value.trim());
    if (!target) return;
    pendingNavigationMode = mode || 'push';
    bar.value  = target;
    frame.src  = target;
    vscode.postMessage({ type: 'syncTitle', url: target });
  }

  document.getElementById('go-btn').addEventListener('click', () => navigate());
  backBtn.addEventListener('click', () => {
    if (historyIndex <= 0) return;
    historyIndex -= 1;
    updateNavButtons();
    navigate(historyStack[historyIndex], 'history');
  });
  forwardBtn.addEventListener('click', () => {
    if (historyIndex >= historyStack.length - 1) return;
    historyIndex += 1;
    updateNavButtons();
    navigate(historyStack[historyIndex], 'history');
  });
  reloadBtn.addEventListener('click', () => {
    const target = normalizeUrl(bar.value.trim() || frame.src);
    if (!target) return;
    navigate(target, 'reload');
  });
  copyBtn.addEventListener('click', () => {
    const target = normalizeUrl(bar.value.trim() || frame.src);
    if (!target) return;
    vscode.postMessage({ type: 'copyUrl', url: target });
  });
  expandBtn.addEventListener('click', () => setExpanded(!isExpanded));
  autoOpenBtn.addEventListener('click', () => {
    syncAutoOpenToggle(!autoOpenCurrentHover);
    vscode.postMessage({ type: 'setAutoOpenCurrentHover', enabled: autoOpenCurrentHover });
  });
  document.getElementById('ext-btn').addEventListener('click', () => {
    const target = normalizeUrl(bar.value.trim() || frame.src);
    if (!target) return;
    vscode.postMessage({ type: 'openExternal', url: target });
  });
  bar.addEventListener('keydown', e => { if (e.key === 'Enter') navigate(); });
  frame.addEventListener('load', () => {
    const target = syncChrome(frame.src || bar.value.trim());
    if (!target) return;
    bar.value = target;
    if (pendingNavigationMode === 'push') {
      rememberHistory(target);
    }
    pendingNavigationMode = 'push';
    vscode.postMessage({ type: 'syncTitle', url: target });
  });
  document.addEventListener('keydown', e => {
    const meta = e.metaKey || e.ctrlKey;
    if (meta && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      bar.focus();
      bar.select();
      return;
    }
    if (meta && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      const target = normalizeUrl(bar.value.trim() || frame.src);
      if (!target) return;
      navigate(target, 'reload');
    }
  });

  // Messages from the extension (navigate to a new URL)
  window.addEventListener('message', e => {
    if (!e.data) return;
    if (e.data.type === 'navigate') {
      navigate(e.data.url);
      return;
    }
    if (e.data.type === 'syncAutoOpenCurrentHover') {
      syncAutoOpenToggle(Boolean(e.data.enabled));
    }
  });

  const initialTarget = syncChrome(bar.value);
  if (initialTarget) {
    rememberHistory(initialTarget);
  }
  syncAutoOpenToggle(autoOpenCurrentHover);
  setExpanded(false);
</script>
</body>
</html>`;
    }
}
