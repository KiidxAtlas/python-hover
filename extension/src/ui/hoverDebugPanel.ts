import * as vscode from 'vscode';
import { HoverDoc } from '../../../shared/types';
import { HOVER_DEBUG_PANEL_COMMANDS } from './webviewCommandAllowlist';
import { createWebviewNonce } from './webviewNonce';

export class HoverDebugPanel {
    static currentPanel: HoverDebugPanel | undefined;

    private readonly panel: vscode.WebviewPanel;

    private constructor(doc: HoverDoc, hoverMarkdown: string) {
        this.panel = vscode.window.createWebviewPanel(
            'pythonHoverDebugPanel',
          `${this.displayTitle(doc)} Debug`,
            { viewColumn: vscode.ViewColumn.Three, preserveFocus: true },
          { enableScripts: true, enableCommandUris: HOVER_DEBUG_PANEL_COMMANDS, retainContextWhenHidden: false, localResourceRoots: [] },
        );
        this.panel.webview.html = this.renderHtml(doc, hoverMarkdown);
        this.panel.onDidDispose(() => {
            HoverDebugPanel.currentPanel = undefined;
        });
    }

    static show(doc: HoverDoc, hoverMarkdown: string): void {
        if (HoverDebugPanel.currentPanel) {
            HoverDebugPanel.currentPanel.update(doc, hoverMarkdown);
        } else {
            HoverDebugPanel.currentPanel = new HoverDebugPanel(doc, hoverMarkdown);
        }
    }

    update(doc: HoverDoc, hoverMarkdown: string): void {
      this.panel.title = `${this.displayTitle(doc)} Debug`;
        this.panel.webview.html = this.renderHtml(doc, hoverMarkdown);
        this.panel.reveal(vscode.ViewColumn.Three, true);
    }

  private displayTitle(doc: HoverDoc): string {
    return doc.title.replace(/^builtins\./, '');
  }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    private renderHtml(doc: HoverDoc, hoverMarkdown: string): string {
        const payload = JSON.stringify(doc, null, 2);
      const summary = doc.summary || doc.structuredContent?.summary || doc.content || 'No summary available.';
      const examplesCount = doc.examples?.length || doc.structuredContent?.examples?.length || 0;
      const displayTitle = this.displayTitle(doc);
      const nonce = createWebviewNonce();
      const docStateKey = JSON.stringify([displayTitle, doc.url || '', doc.sourceUrl || '', doc.module || '', 'debug']);
      const commandToken = typeof doc.metadata?.commandToken === 'string'
        ? encodeURIComponent(JSON.stringify(doc.metadata.commandToken)).replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/'/g, '%27')
        : '';
      const pinHref = commandToken
        ? `command:python-hover.pinHover?${commandToken}`
        : 'command:python-hover.pinHover';

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; script-src 'nonce-${nonce}'; base-uri 'none';">
<title>${this.escape(displayTitle)} Debug</title>
<style>
  :root {
    --panel-border: color-mix(in srgb, var(--vscode-panel-border) 72%, transparent);
    --panel-accent: var(--vscode-textLink-foreground);
    --panel-surface: color-mix(in srgb, var(--vscode-editor-background) 95%, var(--vscode-foreground) 5%);
    --panel-surface-strong: color-mix(in srgb, var(--vscode-editor-background) 92%, var(--vscode-foreground) 8%);
  }
  body {
    font-family: var(--vscode-font-family);
    font-size: 12px;
    color: var(--vscode-foreground);
    background:
      radial-gradient(circle at top left, color-mix(in srgb, var(--panel-accent) 10%, transparent), transparent 40%),
      var(--vscode-editor-background);
    margin: 0;
    line-height: 1.5;
  }
  .shell {
    padding: 14px 16px;
    display: grid;
    gap: 12px;
  }
  .hero, .card {
    border: 1px solid var(--panel-border);
    border-radius: 12px;
    background: var(--panel-surface);
  }
  .hero {
    padding: 14px;
    background: linear-gradient(180deg, color-mix(in srgb, var(--panel-accent) 10%, var(--panel-surface-strong)), var(--panel-surface));
  }
  .hero-top {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(260px, 1fr);
    gap: 12px;
    align-items: start;
  }
  .eyebrow {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    margin: 0 0 6px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  h1 { font-size: 15px; font-weight: 600; margin: 0 0 8px; line-height: 1.25; }
  h2 { font-size: 13px; margin: 0; color: var(--vscode-foreground); }
  p.note {
    color: var(--vscode-descriptionForeground);
    margin: 0;
    font-size: 12px;
  }
  pre {
    white-space: pre-wrap;
    word-break: break-word;
    background: var(--vscode-textCodeBlock-background);
    border: 1px solid var(--panel-border);
    border-radius: 8px;
    padding: 10px 12px;
    overflow-x: auto;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
  }
  .content-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.95fr);
    gap: 12px;
    align-items: start;
  }
  .main-column,
  .side-column {
    display: grid;
    gap: 12px;
    min-width: 0;
  }
  .meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 8px;
  }
  .meta-card {
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid var(--panel-border);
    background: color-mix(in srgb, var(--vscode-textCodeBlock-background) 86%, transparent);
  }
  .meta-card strong {
    display: block;
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 2px;
  }
  .meta-card span {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .action-group {
    display: grid;
    gap: 8px;
    margin-top: 12px;
  }
  .section-kicker {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .actions a {
    text-decoration: none;
    color: var(--vscode-textLink-foreground);
    border: 1px solid var(--panel-border);
    border-radius: 8px;
    padding: 5px 9px;
    font-size: 11px;
    background: color-mix(in srgb, var(--vscode-textCodeBlock-background) 88%, transparent);
  }
  .actions a:hover {
    border-color: color-mix(in srgb, var(--panel-accent) 32%, transparent);
    background: color-mix(in srgb, var(--panel-accent) 10%, transparent);
  }
  .actions a:focus-visible {
    outline: 2px solid var(--panel-accent);
    outline-offset: 2px;
  }
  .card {
    padding: 12px;
    display: grid;
    gap: 10px;
  }
  .lead-card {
    border-color: color-mix(in srgb, var(--panel-accent) 28%, var(--panel-border));
  }
  @media (max-width: 840px) {
    .hero-top,
    .content-grid {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 640px) {
    .shell {
      padding: 10px;
    }
  }
</style>
</head>
<body>
<div class="shell">
<section class="hero">
  <div class="hero-top">
    <div>
      <p class="eyebrow">Hover debug</p>
      <h1>${this.escape(displayTitle)}</h1>
      <p class="note">This view shows the exact markdown and HoverDoc payload that powered the visible hover. Use it when source selection, structure, or formatting looks wrong.</p>
    </div>
    <div class="meta">
      <div class="meta-card"><strong>${this.escape(doc.kind || 'Unknown')}</strong><span>Kind</span></div>
      <div class="meta-card"><strong>${this.escape(doc.module || 'n/a')}</strong><span>Module</span></div>
      <div class="meta-card"><strong>${this.escape(doc.source)}</strong><span>Source</span></div>
      <div class="meta-card"><strong>${String(doc.confidence)}</strong><span>Confidence</span></div>
      <div class="meta-card"><strong>${String(examplesCount)}</strong><span>Examples</span></div>
    </div>
  </div>
  <div class="action-group">
    <div class="section-kicker">Tools</div>
    <div class="actions">
      <a href="${pinHref}">Pin hover</a>
      <a href="command:python-hover.openStudio">Open Studio</a>
      <a href="command:python-hover.showLogs">Show logs</a>
      <a href="command:python-hover.buildPythonCorpus">Build corpus</a>
    </div>
  </div>
</section>
<div class="content-grid">
  <div class="main-column">
  <section class="card lead-card">
    <div class="section-kicker">Resolved summary</div>
    <h2>What the visible hover tried to say</h2>
    <p class="note">${this.escape(summary)}</p>
  </section>
  <section class="card">
    <div class="section-kicker">Rendered hover markdown</div>
    <h2>Markdown emitted to VS Code</h2>
    <pre>${this.escape(hoverMarkdown || '<empty>')}</pre>
  </section>
  </div>
  <aside class="side-column">
  <section class="card">
    <div class="section-kicker">HoverDoc payload</div>
    <h2>Resolved document model</h2>
    <pre>${this.escape(payload)}</pre>
  </section>
  </aside>
</div>
</div>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const docStateKey = ${JSON.stringify(docStateKey)};
  const restored = vscode.getState() || {};
  const scrollByDoc = restored.scrollByDoc && typeof restored.scrollByDoc === 'object' ? restored.scrollByDoc : {};
  const restoredScrollY = typeof scrollByDoc[docStateKey] === 'number' ? scrollByDoc[docStateKey] : 0;

  if (restoredScrollY > 0) {
    window.addEventListener('load', () => {
      window.scrollTo({ top: restoredScrollY, behavior: 'auto' });
    }, { once: true });
  }

  let persistScrollTimer;
  window.addEventListener('scroll', () => {
    clearTimeout(persistScrollTimer);
    persistScrollTimer = setTimeout(() => {
      const state = vscode.getState() || {};
      const nextScrollByDoc = state.scrollByDoc && typeof state.scrollByDoc === 'object' ? state.scrollByDoc : {};
      nextScrollByDoc[docStateKey] = window.scrollY;
      vscode.setState({ ...state, scrollByDoc: nextScrollByDoc });
    }, 40);
  }, { passive: true });
</script>
</body>
</html>`;
    }
}
