import * as vscode from 'vscode';
import { DiskCache } from '../../docs-engine/src/cache/diskCache';
import { Config } from './config';
import { HoverProvider } from './hoverProvider';
import { Logger } from './logger';
import { LspClient } from './lspClient';
import { DocsPanel } from './ui/docsPanel';
import { HoverPanel } from './ui/hoverPanel';
import { StatusBarManager } from './ui/statusBar';

export function activate(context: vscode.ExtensionContext) {
    Logger.initialize('PyHover');
    Logger.log('PyHover is now active!');

    try {
        const config = new Config();
        const lspClient = new LspClient();
        const statusBarManager = new StatusBarManager(context);

        const globalStoragePath = context.globalStorageUri.fsPath;
        const diskCache = new DiskCache(
            globalStoragePath,
            () => statusBarManager.update(),
            {
                inventoryDays: config.inventoryCacheDays,
                snippetHours: config.snippetCacheHours,
            }
        );

        const hoverProvider = new HoverProvider(lspClient, config, diskCache);

        const diagnosticCollection = vscode.languages.createDiagnosticCollection('python-hover');
        context.subscriptions.push(diagnosticCollection);
        hoverProvider.setDiagnosticCollection(diagnosticCollection);

        // Clear per-file diagnostics when document closes
        context.subscriptions.push(
            vscode.workspace.onDidCloseTextDocument(doc => {
                diagnosticCollection.delete(doc.uri);
            })
        );

        // Register hover provider for all Python files
        const selector: vscode.DocumentSelector = { language: 'python' };
        context.subscriptions.push(
            vscode.languages.registerHoverProvider(selector, hoverProvider)
        );

        // Warn once if no Python language extension is active (Pylance / python-language-server)
        checkPythonExtension();

        // Eagerly load inventories for common packages in the background so
        // first-hover latency is near-zero for numpy, pandas, requests, etc.
        hoverProvider.warmupInventories();

        // Clear session cache when a document is saved (symbols may have changed)
        context.subscriptions.push(
            vscode.workspace.onDidSaveTextDocument(() => {
                hoverProvider.clearSessionCache();
            })
        );

        // ── Commands ─────────────────────────────────────────────────────────

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.copyUrl', async (url: string) => {
                if (url) {
                    await vscode.env.clipboard.writeText(url);
                    vscode.window.showInformationMessage('URL copied to clipboard');
                }
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.copySignature', async (sig: string) => {
                if (sig) {
                    await vscode.env.clipboard.writeText(sig);
                    vscode.window.showInformationMessage('Signature copied to clipboard');
                }
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.clearCache', () => {
                diskCache.clear();
                vscode.window.showInformationMessage('PyHover cache cleared.');
                Logger.log('Cache cleared via command.');
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.searchDocs', () => {
                type SearchItem = vscode.QuickPickItem & { url?: string };
                const qp = vscode.window.createQuickPick<SearchItem>();
                const count = hoverProvider.getIndexedSymbolCount();
                qp.placeholder = `Search ${count.toLocaleString()} indexed Python symbols (e.g. "DataFrame.merge", "asyncio.gather")…`;
                qp.matchOnDescription = true;
                qp.matchOnDetail = true;

                qp.onDidChangeValue(query => {
                    if (!query.trim()) { qp.items = []; return; }
                    const results = hoverProvider.searchDocs(query);
                    if (results.length === 0) {
                        qp.items = [{ label: '$(info) No results — hover more symbols to index their packages', url: undefined }];
                        return;
                    }
                    qp.items = results.map(r => ({
                        label: r.name,
                        description: r.package,
                        detail: r.kind,
                        url: r.url,
                    }));
                });

                qp.onDidAccept(() => {
                    const sel = qp.selectedItems[0] as SearchItem;
                    if (sel?.url) { vscode.env.openExternal(vscode.Uri.parse(sel.url)); }
                    qp.hide();
                });

                qp.onDidHide(() => qp.dispose());
                qp.show();
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.pinHover', () => {
                const doc = hoverProvider.getLastDoc();
                if (!doc) {
                    vscode.window.showInformationMessage('Hover over a Python symbol first, then click Pin.');
                    return;
                }
                HoverPanel.show(doc);
            })
        );

        // Open a docs URL in a persistent side-panel browser (ViewColumn.Beside).
        // Uses our own WebviewPanel so the column is guaranteed — VS Code's built-in
        // simpleBrowser.show ignores viewColumn when its panel is already visible.
        const docsPanel = DocsPanel.getInstance();
        context.subscriptions.push({ dispose: () => docsPanel.dispose() });

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.openDocsSide', (url: string) => {
                if (!url) return;
                docsPanel.show(url);
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.browseModule', async (moduleName: string) => {
                if (!moduleName) return;

                type BrowseItem = vscode.QuickPickItem & { url?: string };
                const results = hoverProvider.searchDocs(moduleName);
                // Filter to symbols that belong to this module/package
                const moduleSymbols = results.filter(r =>
                    r.name.startsWith(moduleName + '.') || r.package === moduleName
                );

                if (moduleSymbols.length === 0) {
                    vscode.window.showInformationMessage(
                        `No indexed symbols found for "${moduleName}". Hover over a symbol from this package first to load its index.`
                    );
                    return;
                }

                const qp = vscode.window.createQuickPick<BrowseItem>();
                qp.title = `$(symbol-module) ${moduleName} — ${moduleSymbols.length} symbols`;
                qp.placeholder = 'Filter symbols…';
                qp.matchOnDescription = true;
                qp.items = moduleSymbols.map(r => ({
                    label: r.name.replace(moduleName + '.', ''),
                    description: r.kind,
                    detail: r.name,
                    url: r.url,
                }));

                qp.onDidAccept(() => {
                    const sel = qp.selectedItems[0] as BrowseItem;
                    if (sel?.url) { vscode.env.openExternal(vscode.Uri.parse(sel.url)); }
                    qp.hide();
                });
                qp.onDidHide(() => qp.dispose());
                qp.show();
            })
        );

        Logger.log('HoverProvider registered successfully.');
    } catch (e) {
        Logger.error('Failed to activate PyHover', e);
        vscode.window.showErrorMessage(
            'PyHover failed to activate. Check the output panel for details.',
            'Show Output'
        ).then(action => {
            if (action === 'Show Output') Logger.show();
        });
    }
}

export function deactivate() {
    Logger.dispose();
}

/**
 * Check that a Python language extension is installed and active.
 * PyHover relies on the Language Server Protocol for symbol resolution;
 * without Pylance (or equivalent), hover quality degrades significantly.
 */
function checkPythonExtension(): void {
    const PYTHON_EXTENSIONS = [
        'ms-python.vscode-pylance',
        'ms-python.python',
        'ms-python.python-language-server',
    ];

    const active = PYTHON_EXTENSIONS.some(id => {
        const ext = vscode.extensions.getExtension(id);
        return ext !== undefined;
    });

    if (!active) {
        vscode.window.showWarningMessage(
            'PyHover works best with the Python extension (Pylance). ' +
            'Install it for accurate symbol resolution and richer documentation.',
            'Install Python Extension'
        ).then(action => {
            if (action === 'Install Python Extension') {
                vscode.commands.executeCommand(
                    'workbench.extensions.search',
                    'ms-python.vscode-pylance'
                );
            }
        });
    }
}
