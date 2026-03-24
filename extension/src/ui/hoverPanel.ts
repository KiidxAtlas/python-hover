import * as vscode from 'vscode';
import { HoverDoc } from '../../../shared/types';
import { cleanContent, cleanSignature } from './contentCleaner';

export class HoverPanel {
    static currentPanel: HoverPanel | undefined;

    private readonly panel: vscode.WebviewPanel;

    private constructor(doc: HoverDoc) {
        this.panel = vscode.window.createWebviewPanel(
            'pythonHoverPanel',
            doc.title,
            { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
            { enableScripts: false, retainContextWhenHidden: true },
        );
        this.panel.webview.html = this.renderHtml(doc);
        this.panel.onDidDispose(() => {
            HoverPanel.currentPanel = undefined;
        });
    }

    static show(doc: HoverDoc): void {
        if (HoverPanel.currentPanel) {
            HoverPanel.currentPanel.update(doc);
        } else {
            HoverPanel.currentPanel = new HoverPanel(doc);
        }
    }

    update(doc: HoverDoc): void {
        this.panel.title = doc.title;
        this.panel.webview.html = this.renderHtml(doc);
        this.panel.reveal(vscode.ViewColumn.Beside, true);
    }

    private escape(s: string): string {
        return s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    private markdownish(s: string): string {
        // Bold
        s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // Inline code
        s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
        // Double newlines → paragraph break
        s = s.replace(/\n\n/g, '</p><p>');
        return s;
    }

    private renderHtml(doc: HoverDoc): string {
        const e = (s: string) => this.escape(s);
        const m = (s: string) => this.markdownish(e(s));

        // Title / badges
        const kindBadge = doc.kind
            ? `<span class="badge">${e(doc.kind)}</span>`
            : '';
        const depBadge = doc.badges?.some(b => b.label === 'deprecated')
            ? `<span class="badge badge-warn">deprecated</span>`
            : '';
        const asyncBadge = doc.badges?.some(b => b.label === 'async')
            ? `<span class="badge">async</span>`
            : '';

        // Signature (apply same cleaning as hover renderer)
        let signatureHtml = '';
        if (doc.signature) {
            let sig = cleanSignature(doc.signature);
            if (sig.startsWith('(')) sig = `${doc.title}${sig}`;
            signatureHtml = `<pre class="sig"><code>${e(sig)}</code></pre>`;
        } else if (doc.overloads && doc.overloads.length > 0) {
            signatureHtml = doc.overloads
                .map(o => `<pre class="sig"><code>${e(cleanSignature(o))}</code></pre>`)
                .join('\n');
        }

        // Description (apply same content cleaning as hover renderer — no truncation)
        const rawDesc = doc.summary || doc.content || '';
        const desc = cleanContent(rawDesc);
        const descHtml = desc
            ? `<p>${m(desc)}</p>`
            : '';

        // Parameters table
        let paramsHtml = '';
        if (doc.parameters && doc.parameters.length > 0) {
            const rows = doc.parameters.map(p => {
                const name = p.default !== undefined ? `${e(p.name)}=${e(p.default)}` : e(p.name);
                const type = p.type ? e(p.type) : '—';
                const pdesc = p.description ? m(p.description) : '';
                return `<tr><td><code>${name}</code></td><td><code>${type}</code></td><td>${pdesc}</td></tr>`;
            }).join('\n');
            paramsHtml = `
<section>
  <h2>Parameters</h2>
  <table>
    <thead><tr><th>Name</th><th>Type</th><th>Description</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>`;
        }

        // Returns
        let returnsHtml = '';
        if (doc.returns) {
            const rtype = doc.returns.type ? `<code>${e(doc.returns.type)}</code> ` : '';
            const rdesc = doc.returns.description ? `— ${m(doc.returns.description)}` : '';
            returnsHtml = `<section><h2>Returns</h2><p>${rtype}${rdesc}</p></section>`;
        }

        // Raises
        let raisesHtml = '';
        if (doc.raises && doc.raises.length > 0) {
            const items = doc.raises.map(exc => {
                const edesc = exc.description ? ` — ${m(exc.description)}` : '';
                return `<li><code>${e(exc.type)}</code>${edesc}</li>`;
            }).join('\n');
            raisesHtml = `<section><h2>Raises</h2><ul>${items}</ul></section>`;
        }

        // Examples (ALL of them, no truncation)
        let examplesHtml = '';
        if (doc.examples && doc.examples.length > 0) {
            const blocks = doc.examples
                .map(ex => `<pre><code>${e(ex)}</code></pre>`)
                .join('\n');
            examplesHtml = `<section><h2>Examples</h2>${blocks}</section>`;
        }

        // Footer links
        const links: string[] = [];
        if (doc.url) {
            links.push(`<a href="${e(doc.url)}" target="_blank">Official Docs</a>`);
        }
        if (doc.devdocsUrl) {
            links.push(`<a href="${e(doc.devdocsUrl)}" target="_blank">DevDocs</a>`);
        }
        const footerHtml = links.length > 0
            ? `<footer>${links.join(' · ')}</footer>`
            : '';

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${e(doc.title)}</title>
<style>
  body {
    font-family: var(--vscode-editor-font-family, sans-serif);
    font-size: 13px;
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    padding: 16px 20px;
    margin: 0;
    line-height: 1.6;
  }
  h1 { font-size: 1.3em; margin-bottom: 4px; }
  h2 { font-size: 1em; margin-top: 20px; margin-bottom: 6px; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 3px; }
  .badge {
    display: inline-block;
    font-size: 0.75em;
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    margin-right: 4px;
    vertical-align: middle;
  }
  .badge-warn { background: #b8860b; color: #fff; }
  pre.sig {
    background: var(--vscode-textCodeBlock-background);
    padding: 8px 10px;
    border-radius: 4px;
    overflow-x: auto;
  }
  pre.sig code {
    color: var(--vscode-symbolIcon-functionForeground, var(--vscode-foreground));
    font-family: var(--vscode-editor-font-family, monospace);
  }
  pre {
    background: var(--vscode-textCodeBlock-background);
    padding: 8px 10px;
    border-radius: 4px;
    overflow-x: auto;
  }
  code {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 0.95em;
  }
  table { border-collapse: collapse; width: 100%; }
  th, td { text-align: left; padding: 4px 8px; border: 1px solid var(--vscode-panel-border); }
  th { background: var(--vscode-textCodeBlock-background); }
  a { color: var(--vscode-textLink-foreground); }
  footer { margin-top: 24px; border-top: 1px solid var(--vscode-panel-border); padding-top: 8px; font-size: 0.85em; }
  ul { margin: 0; padding-left: 20px; }
  section { margin-top: 16px; }
</style>
</head>
<body>
<h1>${e(doc.title)} ${kindBadge}${asyncBadge}${depBadge}</h1>
${signatureHtml}
${descHtml}
${paramsHtml}
${returnsHtml}
${raisesHtml}
${examplesHtml}
${footerHtml}
</body>
</html>`;
    }
}
