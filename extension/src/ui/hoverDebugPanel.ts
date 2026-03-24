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
            { enableScripts: false, retainContextWhenHidden: true },
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

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${this.escape(doc.title)} Debug</title>
<style>
  body {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 12px;
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    padding: 16px 20px;
    margin: 0;
    line-height: 1.5;
  }
  h1 { font-size: 1.2em; margin: 0 0 10px; }
  h2 { font-size: 1em; margin: 18px 0 8px; }
  p.note {
    color: var(--vscode-descriptionForeground);
    margin: 0 0 14px;
  }
  pre {
    white-space: pre-wrap;
    word-break: break-word;
    background: var(--vscode-textCodeBlock-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 6px;
    padding: 10px 12px;
    overflow-x: auto;
  }
  .meta {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 6px 12px;
    margin-bottom: 12px;
  }
  .meta strong {
    color: var(--vscode-textPreformat-foreground);
  }
</style>
</head>
<body>
<h1>${this.escape(doc.title)} Debug</h1>
<p class="note">The regular Pin panel opens separately. This view shows the exact hover markdown and payload used for that same hover.</p>
<div class="meta">
  <strong>Kind</strong><span>${this.escape(doc.kind || '')}</span>
  <strong>Module</strong><span>${this.escape(doc.module || '')}</span>
  <strong>Source</strong><span>${this.escape(doc.source)}</span>
  <strong>Confidence</strong><span>${String(doc.confidence)}</span>
</div>
<h2>Hover Markdown</h2>
<pre>${this.escape(hoverMarkdown || '<empty>')}</pre>
<h2>HoverDoc Payload</h2>
<pre>${this.escape(payload)}</pre>
</body>
</html>`;
    }
}
