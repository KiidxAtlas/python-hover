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
  private pendingNavigationTimer: ReturnType<typeof setTimeout> | undefined;

    static getInstance(): DocsPanel {
        if (!DocsPanel._instance) {
            DocsPanel._instance = new DocsPanel();
        }
        return DocsPanel._instance;
    }

    show(url: string): void {
      const safeUrl = this.normalizeWebUrl(url);
      if (!safeUrl) {
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
                }
            );
          this.panel.webview.onDidReceiveMessage(message => {
            if (message?.type !== 'openExternal' || typeof message.url !== 'string') {
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
      const nonce = String(Date.now());
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
  sandbox="allow-same-origin allow-scripts allow-forms">
</iframe>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const bar   = document.getElementById('url-bar');
  const frame = document.getElementById('frame');

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

  function navigate(url) {
    const target = normalizeUrl(url || bar.value.trim());
    if (!target) return;
    bar.value  = target;
    frame.src  = target;
  }

  document.getElementById('go-btn').addEventListener('click', () => navigate());
  document.getElementById('ext-btn').addEventListener('click', () => {
    const target = normalizeUrl(bar.value.trim() || frame.src);
    if (!target) return;
    vscode.postMessage({ type: 'openExternal', url: target });
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
