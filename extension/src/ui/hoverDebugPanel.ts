import * as vscode from 'vscode';
import { HoverDoc } from '../../../shared/types';

export class HoverDebugPanel {
    static currentPanel: HoverDebugPanel | undefined;

    private readonly panel: vscode.WebviewPanel;

    private constructor(doc: HoverDoc, hoverMarkdown: string) {
        this.panel = vscode.window.createWebviewPanel(
            'pythonHoverDebugPanel',
            `${doc.title} Debug`,
            { viewColumn: vscode.ViewColumn.Three, preserveFocus: true },
          { enableScripts: false, enableCommandUris: true, retainContextWhenHidden: true },
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
        this.panel.title = `${doc.title} Debug`;
        this.panel.webview.html = this.renderHtml(doc, hoverMarkdown);
        this.panel.reveal(vscode.ViewColumn.Three, true);
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
<title>${this.escape(doc.title)} Debug</title>
<style>
  :root {
    --panel-border: color-mix(in srgb, var(--vscode-panel-border) 72%, transparent);
    --panel-accent: var(--vscode-textLink-foreground);
  }
  body {
    font-family: var(--vscode-font-family);
    font-size: 12px;
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    padding: 14px 16px;
    margin: 0;
    line-height: 1.5;
  }
  .hero, .card {
    border: 1px solid var(--panel-border);
    border-radius: 7px;
    background: color-mix(in srgb, var(--vscode-editor-background) 96%, var(--vscode-foreground) 4%);
  }
  .hero {
    padding: 12px 14px;
    margin-bottom: 10px;
  }
  .eyebrow {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    margin: 0 0 4px;
  }
  h1 { font-size: 13px; font-weight: 500; margin: 0 0 6px; }
  h2 { font-size: 11px; margin: 0 0 8px; color: var(--vscode-descriptionForeground); }
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
    border-radius: 5px;
    padding: 8px 10px;
    overflow-x: auto;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
  }
  .meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 6px;
    margin-top: 10px;
  }
  .meta-card {
    padding: 8px 10px;
    border-radius: 5px;
    border: 1px solid var(--panel-border);
    background: color-mix(in srgb, var(--vscode-textCodeBlock-background) 86%, transparent);
  }
  .meta-card strong {
    display: block;
    font-size: 13px;
    font-weight: 500;
    margin-bottom: 1px;
  }
  .meta-card span {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
  }
  .actions a {
    text-decoration: none;
    color: var(--vscode-textLink-foreground);
    border: 1px solid var(--panel-border);
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 11px;
    background: color-mix(in srgb, var(--vscode-textCodeBlock-background) 88%, transparent);
  }
  .stack {
    display: grid;
    gap: 8px;
  }
  .card {
    padding: 10px 12px;
  }
</style>
</head>
<body>
<section class="hero">
  <p class="eyebrow">Hover debug</p>
  <h1>${this.escape(doc.title)}</h1>
  <p class="note">This view shows the exact markdown and HoverDoc payload that powered the visible hover. Use it when source selection, structure, or formatting looks wrong.</p>
  <div class="actions">
    <a href="${pinHref}">Pin hover</a>
    <a href="command:python-hover.openStudio">Open PyHover</a>
    <a href="command:python-hover.showLogs">Show logs</a>
    <a href="command:python-hover.buildPythonCorpus">Build corpus</a>
  </div>
  <div class="meta">
    <div class="meta-card"><strong>${this.escape(doc.kind || 'Unknown')}</strong><span>Kind</span></div>
    <div class="meta-card"><strong>${this.escape(doc.module || 'n/a')}</strong><span>Module</span></div>
    <div class="meta-card"><strong>${this.escape(doc.source)}</strong><span>Source</span></div>
    <div class="meta-card"><strong>${String(doc.confidence)}</strong><span>Confidence</span></div>
    <div class="meta-card"><strong>${String(examplesCount)}</strong><span>Examples</span></div>
  </div>
</section>
<div class="stack">
  <section class="card">
    <h2>Resolved summary</h2>
    <p class="note">${this.escape(summary)}</p>
  </section>
  <section class="card">
    <h2>Hover Markdown</h2>
    <pre>${this.escape(hoverMarkdown || '<empty>')}</pre>
  </section>
  <section class="card">
    <h2>HoverDoc Payload</h2>
    <pre>${this.escape(payload)}</pre>
  </section>
</div>
</body>
</html>`;
    }
}
