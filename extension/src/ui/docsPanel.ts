import * as vscode from 'vscode';

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

    static getInstance(): DocsPanel {
        if (!DocsPanel._instance) {
            DocsPanel._instance = new DocsPanel();
        }
        return DocsPanel._instance;
    }

    show(url: string): void {
        if (this.panel) {
            // Panel already exists — navigate to the new URL, stay in whatever column it's in
            this.panel.title = this.titleFromUrl(url);
            this.panel.reveal(undefined, /* preserveFocus */ true);
            // Small delay so the webview is visible before we post a message
            setTimeout(() => {
                this.panel?.webview.postMessage({ type: 'navigate', url });
            }, 50);
        } else {
            // First open — create in the beside column so it never covers the code editor
            this.panel = vscode.window.createWebviewPanel(
                'pyhover.docsBrowser',
                this.titleFromUrl(url),
                { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,   // keep state when hidden
                }
            );
            this.panel.webview.html = this.buildHtml(url);
            this.panel.onDidDispose(() => { this.panel = undefined; });
        }
    }

    dispose(): void {
        this.panel?.dispose();
        this.panel = undefined;
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
        const safe = initialUrl.replace(/"/g, '&quot;').replace(/</g, '&lt;');
        return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none';
           frame-src *;
           script-src 'unsafe-inline';
           style-src 'unsafe-inline';">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { height: 100%; overflow: hidden;
    background: var(--vscode-editor-background, #1e1e1e);
    color: var(--vscode-editor-foreground, #ccc); }

  /* ── toolbar ── */
  #toolbar {
    display: flex; align-items: center; gap: 6px;
    padding: 5px 8px; height: 34px;
    background: var(--vscode-titleBar-activeBackground, #252526);
    border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
  }
  #url-bar {
    flex: 1; min-width: 0;
    background: var(--vscode-input-background, #3c3c3c);
    border: 1px solid var(--vscode-input-border, transparent);
    color: var(--vscode-input-foreground, #ccc);
    padding: 3px 8px; border-radius: 3px;
    font-size: 12px; font-family: inherit;
  }
  #url-bar:focus { outline: 1px solid var(--vscode-focusBorder, #007fd4); }

  .btn {
    flex-shrink: 0;
    background: var(--vscode-button-background, #0e639c);
    color: var(--vscode-button-foreground, #fff);
    border: none; padding: 3px 10px; border-radius: 3px;
    cursor: pointer; font-size: 11px; white-space: nowrap;
  }
  .btn:hover { background: var(--vscode-button-hoverBackground, #1177bb); }
  .btn.sec {
    background: var(--vscode-button-secondaryBackground, #3a3d41);
    color: var(--vscode-button-secondaryForeground, #ccc);
  }
  .btn.sec:hover { background: var(--vscode-button-secondaryHoverBackground, #45494e); }

  /* ── frame ── */
  #frame {
    display: block; width: 100%;
    height: calc(100vh - 34px);
    border: none; background: #fff;
  }
</style>
</head>
<body>
<div id="toolbar">
  <input id="url-bar" type="text" spellcheck="false" value="${safe}">
  <button class="btn" id="go-btn">Go</button>
  <button class="btn sec" id="ext-btn" title="Open in system browser">↗</button>
</div>
<iframe id="frame" src="${safe}"
  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation">
</iframe>
<script>
  const bar   = document.getElementById('url-bar');
  const frame = document.getElementById('frame');

  function navigate(url) {
    if (!url) url = bar.value.trim();
    if (!url) return;
    bar.value  = url;
    frame.src  = url;
  }

  document.getElementById('go-btn').addEventListener('click', () => navigate());
  document.getElementById('ext-btn').addEventListener('click', () => {
    window.open(bar.value.trim() || frame.src, '_blank');
  });
  bar.addEventListener('keydown', e => { if (e.key === 'Enter') navigate(); });

  // Messages from the extension (navigate to a new URL)
  window.addEventListener('message', e => {
    if (e.data && e.data.type === 'navigate') navigate(e.data.url);
  });
</script>
</body>
</html>`;
    }
}
