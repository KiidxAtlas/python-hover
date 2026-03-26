import * as vscode from 'vscode';
import { DiskCache } from '../../docs-engine/src/cache/diskCache';
import { Config } from './config';
import { HoverProvider } from './hoverProvider';
import { Logger } from './logger';
import { LspClient } from './lspClient';
import { DocsPanel } from './ui/docsPanel';
import { HoverDebugPanel } from './ui/hoverDebugPanel';
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
            },
            config.interpreterCacheFingerprint,
        );

        // Wire status bar clear button to DiskCache.clear() so in-memory caches
        // (memory + corpusMemory) are flushed alongside the on-disk files.
        statusBarManager.setClearCacheCallback(() => diskCache.clear());

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

        // Pre-load inventories for packages imported in the active document so
        // first-hover latency is lower. Only runs when onlineDiscovery is enabled —
        // inventories are fetched lazily on first hover otherwise.
        // Only applies to real user files (file: scheme) — Pylance opens many
        // virtual/internal type-stub documents that we must not try to warmup.
        const warmupImportsForDocument = (document: vscode.TextDocument | undefined) => {
            if (!document || document.languageId !== 'python') return;
            if (!config.warmupImports || !config.onlineDiscovery) return;
            if (document.uri.scheme !== 'file') return;
            hoverProvider.warmupDocumentImports(document);
        };

        warmupImportsForDocument(vscode.window.activeTextEditor?.document);

        context.subscriptions.push(
            vscode.window.onDidChangeActiveTextEditor(editor => {
                warmupImportsForDocument(editor?.document);
            })
        );

        context.subscriptions.push(
            vscode.workspace.onDidOpenTextDocument(document => {
                warmupImportsForDocument(document);
            })
        );

        // Clear session cache when a document is saved (symbols may have changed)
        context.subscriptions.push(
            vscode.workspace.onDidSaveTextDocument(() => {
                hoverProvider.clearSessionCache();
            })
        );

        // ── Commands ─────────────────────────────────────────────────────────

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.copyUrl', async (url?: string) => {
                const text = url || hoverProvider.getLastDoc()?.url;
                if (text) {
                    await vscode.env.clipboard.writeText(text);
                    vscode.window.showInformationMessage('URL copied to clipboard');
                }
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.copySignature', async (sig?: string) => {
                const text = sig || hoverProvider.getLastDoc()?.signature;
                if (text) {
                    await vscode.env.clipboard.writeText(text);
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

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.debugPinHover', () => {
                const doc = hoverProvider.getLastDoc();
                if (!doc) {
                    vscode.window.showInformationMessage('Hover over a Python symbol first, then click Debug.');
                    return;
                }

                HoverPanel.show(doc);
                HoverDebugPanel.show(doc, hoverProvider.getLastRenderedHoverMarkdown() || '');
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

                type BrowseItem = vscode.QuickPickItem & { url?: string; action?: string };
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

                // Group symbols by kind for a categorized view
                const kindOrder = ['class', 'function', 'method', 'data', 'exception', 'module', 'attribute'];
                const kindIcons: Record<string, string> = {
                    class: '$(symbol-class)', function: '$(symbol-function)',
                    method: '$(symbol-method)', data: '$(symbol-field)',
                    exception: '$(warning)', module: '$(symbol-namespace)',
                    attribute: '$(symbol-property)',
                };
                const kindLabels: Record<string, string> = {
                    class: 'Classes', function: 'Functions', method: 'Methods',
                    data: 'Data', exception: 'Exceptions', module: 'Modules',
                    attribute: 'Attributes',
                };

                const grouped = new Map<string, typeof moduleSymbols>();
                for (const sym of moduleSymbols) {
                    const k = sym.kind || 'function';
                    if (!grouped.has(k)) grouped.set(k, []);
                    grouped.get(k)!.push(sym);
                }

                const items: BrowseItem[] = [];
                const sortedKinds = [...grouped.keys()].sort((a, b) => {
                    const ai = kindOrder.indexOf(a); const bi = kindOrder.indexOf(b);
                    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
                });

                for (const kind of sortedKinds) {
                    const syms = grouped.get(kind)!;
                    const label = kindLabels[kind] || kind.charAt(0).toUpperCase() + kind.slice(1);
                    items.push({ label: `${label} (${syms.length})`, kind: vscode.QuickPickItemKind.Separator, action: '' });
                    for (const sym of syms.sort((a, b) => a.name.localeCompare(b.name))) {
                        const icon = kindIcons[kind] || '$(symbol-misc)';
                        const shortName = sym.name.replace(moduleName + '.', '');
                        items.push({
                            label: `${icon} ${shortName}`,
                            description: sym.kind,
                            detail: sym.name,
                            url: sym.url,
                        });
                    }
                }

                const qp = vscode.window.createQuickPick<BrowseItem>();
                qp.title = `$(symbol-module) ${moduleName} — ${moduleSymbols.length} symbols`;
                qp.placeholder = 'Filter symbols…';
                qp.matchOnDescription = true;
                qp.matchOnDetail = true;
                qp.items = items;

                qp.onDidAccept(() => {
                    const sel = qp.selectedItems[0] as BrowseItem;
                    if (sel?.url) { docsPanel.show(sel.url); }
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
