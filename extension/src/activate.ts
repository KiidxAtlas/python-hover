import * as vscode from 'vscode';
import { DiskCache } from '../../docs-engine/src/cache/diskCache';
import { HoverDoc, IndexedSymbolSummary, ResolutionSource } from '../../shared/types';
import { Config } from './config';
import { HoverProvider } from './hoverProvider';
import { openIndexedSymbolSource } from './indexedSymbolActions';
import { Logger } from './logger';
import { LspClient } from './lspClient';
import { DocsPanel } from './ui/docsPanel';
import { HoverDebugPanel } from './ui/hoverDebugPanel';
import { HoverPanel } from './ui/hoverPanel';
import { ModuleBrowserPanel } from './ui/moduleBrowserPanel';
import { StatusBarManager } from './ui/statusBar';
import { StudioMessage, StudioPanel, StudioState } from './ui/studioPanel';

export function activate(context: vscode.ExtensionContext) {
    Logger.initialize('PyHover');
    Logger.log('PyHover is now active!');

    try {
        const config = new Config();
        Logger.setDebugEnabled(config.enableDebugLogging);
        const lspClient = new LspClient();
        const statusBarManager = new StatusBarManager(context);

        const globalStoragePath = context.globalStorageUri.fsPath;
        const createDiskCache = () => new DiskCache(
            globalStoragePath,
            () => statusBarManager.update(),
            {
                inventoryDays: config.inventoryCacheDays,
                snippetHours: config.snippetCacheHours,
            },
            config.interpreterCacheFingerprint,
        );
        let diskCache = createDiskCache();

        const diagnosticCollection = vscode.languages.createDiagnosticCollection('python-hover');
        context.subscriptions.push(diagnosticCollection);

        let hoverProvider = new HoverProvider(lspClient, config, diskCache);
        hoverProvider.setDiagnosticCollection(diagnosticCollection);

        let hoverRegistration: vscode.Disposable | undefined;
        const registerHoverProvider = () => {
            hoverRegistration?.dispose();
            hoverProvider.dispose();
            hoverProvider = new HoverProvider(lspClient, config, diskCache);
            hoverProvider.setDiagnosticCollection(diagnosticCollection);
            hoverRegistration = vscode.languages.registerHoverProvider({ language: 'python' }, hoverProvider);
        };
        const rebuildHoverRuntime = (reason: string, recreateDiskCache: boolean) => {
            if (recreateDiskCache) {
                diskCache = createDiskCache();
            }

            Logger.log(reason);
            registerHoverProvider();
            statusBarManager.update();
        };

        // Clear per-file diagnostics when document closes
        context.subscriptions.push(
            vscode.workspace.onDidCloseTextDocument(doc => {
                diagnosticCollection.delete(doc.uri);
            })
        );

        // Register hover provider for all Python files
        registerHoverProvider();
        context.subscriptions.push({ dispose: () => hoverRegistration?.dispose() });
        context.subscriptions.push({ dispose: () => hoverProvider.dispose() });

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

        const warmupConfiguredPackages = () => {
            if (!config.onlineDiscovery || config.preloadPackages.length === 0) return;
            hoverProvider.warmupPackages(config.preloadPackages);
        };

        warmupImportsForDocument(vscode.window.activeTextEditor?.document);
        warmupConfiguredPackages();

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

        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(event => {
                const affectsInterpreter =
                    event.affectsConfiguration('python.defaultInterpreterPath')
                    || event.affectsConfiguration('python.pythonPath');
                const affectsDiskCache =
                    affectsInterpreter
                    || event.affectsConfiguration('python-hover.cacheTTL');
                const affectsProviderCore =
                    event.affectsConfiguration('python-hover.runtimeHelper')
                    || event.affectsConfiguration('python-hover.enable')
                    || event.affectsConfiguration('python-hover.onlineDiscovery')
                    || event.affectsConfiguration('python-hover.buildFullCorpus')
                    || event.affectsConfiguration('python-hover.docScraping')
                    || event.affectsConfiguration('python-hover.useKnownDocsUrls')
                    || event.affectsConfiguration('python-hover.requestTimeout')
                    || event.affectsConfiguration('python-hover.customLibraries');

                Logger.setDebugEnabled(config.enableDebugLogging);

                if (affectsDiskCache || affectsProviderCore) {
                    rebuildHoverRuntime(
                        'Configuration changed. Recreating hover provider.',
                        affectsDiskCache,
                    );
                }

                if (event.affectsConfiguration('python-hover')) {
                    warmupImportsForDocument(vscode.window.activeTextEditor?.document);
                    warmupConfiguredPackages();
                }
            })
        );

        // ── Commands ─────────────────────────────────────────────────────────

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.copyImport', async (importStatement?: string) => {
                let text = importStatement;
                if (!text) {
                    const doc = hoverProvider.getLastDoc();
                    if (doc) text = buildImportStatementForDoc(doc);
                }
                if (text) {
                    await vscode.env.clipboard.writeText(text);
                    vscode.window.showInformationMessage(`Copied: ${text}`);
                } else {
                    vscode.window.showInformationMessage('Hover over a Python symbol first to copy its import statement.');
                }
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.pinLast', () => {
                const doc = hoverProvider.getLastDoc();
                if (!doc) {
                    vscode.window.showInformationMessage('No recent hover — hover over a Python symbol first.');
                    return;
                }
                HoverPanel.show(doc);
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.copyUrl', async (urlOrToken?: string) => {
                const explicitUrl = typeof urlOrToken === 'string' && /^(?:https?:|file:|\/|[A-Za-z]:\\)/.test(urlOrToken)
                    ? urlOrToken
                    : undefined;
                const text = explicitUrl || hoverProvider.getDocByCommandToken(urlOrToken)?.url;
                if (text) {
                    await vscode.env.clipboard.writeText(text);
                    vscode.window.showInformationMessage('URL copied to clipboard');
                }
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.copySignature', async (sigOrToken?: string) => {
                const explicitSignature = typeof sigOrToken === 'string' && (sigOrToken.includes('(') || sigOrToken.includes('->'))
                    ? sigOrToken
                    : undefined;
                const text = explicitSignature || hoverProvider.getDocByCommandToken(sigOrToken)?.signature;
                if (text) {
                    await vscode.env.clipboard.writeText(text);
                    vscode.window.showInformationMessage('Signature copied to clipboard');
                }
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.clearCache', () => {
                diskCache.clear({ preservePythonStdlibCorpus: true });
                vscode.window.showInformationMessage('PyHover cache cleared. Python stdlib corpus preserved.');
                Logger.log('Cache cleared via command.');
                statusBarManager.update();
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.buildPythonCorpus', async () => {
                if (!config.onlineDiscovery) {
                    vscode.window.showWarningMessage('Enable python-hover.onlineDiscovery to build the Python corpus.');
                    return;
                }

                const result = await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: 'PyHover: Building Python stdlib corpus',
                        cancellable: false,
                    },
                    async progress => {
                        let lastReported = 0;
                        return hoverProvider.buildPythonCorpus(({ completed, total, current }) => {
                            const percent = total > 0 ? Math.floor((completed / total) * 100) : 0;
                            const increment = Math.max(0, percent - lastReported);
                            lastReported = percent;
                            progress.report({
                                increment,
                                message: `${completed}/${total} ${current.split('#')[0]}`,
                            });
                        });
                    }
                );

                vscode.window.showInformationMessage(
                    `PyHover: built Python corpus for ${result.targets.toLocaleString()} stdlib targets across ${result.corpusPackages.toLocaleString()} buckets.`
                );
                statusBarManager.update();
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.searchDocs', () => {
                void hoverProvider.hydrateCachedInventories();
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
                    if (sel?.url) {
                        if (config.docsBrowser === 'integrated') {
                            void vscode.commands.executeCommand('python-hover.openDocsSide', sel.url);
                        } else {
                            void vscode.env.openExternal(vscode.Uri.parse(sel.url));
                        }
                    }
                    qp.hide();
                });

                qp.onDidHide(() => qp.dispose());
                qp.show();
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.pinHover', (token?: string) => {
                const doc = hoverProvider.getDocByCommandToken(token);
                if (!doc) {
                    vscode.window.showInformationMessage('Hover over a Python symbol first, then click Pin.');
                    return;
                }
                HoverPanel.show(doc);
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.debugPinHover', (token?: string) => {
                const doc = hoverProvider.getDocByCommandToken(token);
                if (!doc) {
                    vscode.window.showInformationMessage('Hover over a Python symbol first, then click Debug.');
                    return;
                }

                HoverPanel.show(doc);
                HoverDebugPanel.show(doc, hoverProvider.getRenderedHoverMarkdown(token) || '');
            })
        );

        // Open a docs URL in a persistent side-panel browser (ViewColumn.Beside).
        // Uses our own WebviewPanel so the column is guaranteed — VS Code's built-in
        // simpleBrowser.show ignores viewColumn when its panel is already visible.
        const docsPanel = DocsPanel.getInstance();
        const moduleBrowserPanel = ModuleBrowserPanel.getInstance();
        const buildStudioState = (): StudioState => {
            const overview = diskCache.getOverview();
            return {
                version: String(context.extension.packageJSON.version || '?'),
                onlineDiscovery: config.onlineDiscovery,
                runtimeHelper: config.runtimeHelperEnabled,
                astFallback: config.astFallbackEnabled,
                docScraping: config.docScrapingEnabled,
                buildFullCorpus: config.buildFullCorpus,
                enableDebugLogging: config.enableDebugLogging,
                docsBrowser: config.docsBrowser,
                devdocsBrowser: config.devdocsBrowser,
                indexedSymbols: hoverProvider.getIndexedSymbolCount(),
                cacheSizeLabel: `${(overview.generalBytes / 1_048_576).toFixed(1)} MB`,
                corpusSizeLabel: `${(overview.pythonStdlibCorpusBytes / 1_048_576).toFixed(1)} MB`,
                pythonStdlibCorpusPackages: overview.pythonStdlibCorpusPackages,
                pythonStdlibCorpusEntries: overview.pythonStdlibCorpusEntries,
                hasPythonStdlibCorpus: overview.hasPythonStdlibCorpus,
                lastHoverTitle: hoverProvider.getLastDoc()?.title,
                indexedPackages: hoverProvider.getIndexedPackages().map(name => ({
                    name,
                    count: hoverProvider.getModuleSymbols(name).length,
                })),
            };
        };
        const refreshStudio = () => {
            studioPanel.show(buildStudioState());
            statusBarManager.update();
        };
        const updateStudio = () => {
            studioPanel.update(buildStudioState());
            statusBarManager.update();
        };
        const updateSetting = async (key: string, value: boolean | string) => {
            const setting = key.replace(/^python-hover\./, '');
            await vscode.workspace.getConfiguration('python-hover').update(setting, value, vscode.ConfigurationTarget.Global);
        };
        const studioPanel = StudioPanel.getInstance(async (message: StudioMessage) => {
            switch (message.type) {
                case 'run-command':
                    await vscode.commands.executeCommand(message.command);
                    break;
                case 'open-settings':
                    await vscode.commands.executeCommand('workbench.action.openSettings', message.query || 'python-hover');
                    break;
                case 'update-setting':
                    await updateSetting(message.key, message.value);
                    break;
            }

            updateStudio();
        });
        context.subscriptions.push({ dispose: () => docsPanel.dispose() });
        context.subscriptions.push({ dispose: () => moduleBrowserPanel.dispose() });
        context.subscriptions.push({ dispose: () => studioPanel.dispose() });

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.openStudio', () => {
                refreshStudio();
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.showLogs', () => {
                Logger.show();
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.showHistory', async () => {
                const history = hoverProvider.getHoverHistory();
                if (history.length === 0) {
                    vscode.window.showInformationMessage(
                        'No hover history yet — hover over Python symbols to populate it.'
                    );
                    return;
                }
                type HistoryItem = vscode.QuickPickItem & { url?: string };
                const items: HistoryItem[] = history.map(h => ({
                    label: h.title,
                    description: h.module ?? h.package ?? '',
                    detail: h.kind ?? '',
                    url: h.url,
                }));
                const picked = await vscode.window.showQuickPick(items, {
                    title: 'PyHover: Hover History',
                    placeHolder: 'Recent symbols — select to open docs',
                    matchOnDescription: true,
                }) as HistoryItem | undefined;
                if (picked?.url) {
                    if (config.docsBrowser === 'integrated') {
                        void vscode.commands.executeCommand('python-hover.openDocsSide', picked.url);
                    } else {
                        void vscode.env.openExternal(vscode.Uri.parse(picked.url));
                    }
                }
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.openCacheFolder', () => {
                const cacheUri = vscode.Uri.joinPath(context.globalStorageUri, 'pyhover-cache');
                void vscode.workspace.fs.createDirectory(cacheUri).then(() => {
                    void vscode.commands.executeCommand('revealFileInOS', cacheUri);
                });
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.openDocsSide', (url: string) => {
                if (!url) return;
                docsPanel.show(url);
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.getIndexedSymbolPreviews', async (symbols: IndexedSymbolSummary[]) => {
                return hoverProvider.getIndexedSymbolPreviews(Array.isArray(symbols) ? symbols : []);
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.pinIndexedSymbol', async (symbol: IndexedSymbolSummary) => {
                if (!symbol?.name) return;

                const doc = await hoverProvider.resolveIndexedSymbolDoc(symbol);
                if (!doc) {
                    vscode.window.showInformationMessage(`No pinned hover content is available for "${symbol.name}" yet.`);
                    return;
                }

                HoverPanel.show(doc);
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.openIndexedSymbolSource', async (symbol: IndexedSymbolSummary) => {
                if (!symbol?.name) return;

                const opened = await openIndexedSymbolSource(symbol, hoverProvider, docsPanel);
                if (!opened) {
                    vscode.window.showInformationMessage(`No source location is available for "${symbol.name}".`);
                }
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.browseModule', async (moduleName: string) => {
                let targetModule = moduleName?.trim();
                if (!targetModule) {
                    let packages = hoverProvider.getIndexedPackages();
                    if (packages.length === 0) {
                        packages = await hoverProvider.hydrateCachedInventories();
                    }

                    if (packages.length === 0) {
                        vscode.window.showInformationMessage(
                            'No indexed packages are available yet. Hover over Python symbols once or build the corpus first.'
                        );
                        return;
                    }

                    const picked = await vscode.window.showQuickPick(
                        packages.map(pkg => ({
                            label: pkg,
                            description: 'Indexed module/package',
                        })),
                        {
                            title: 'Browse Indexed Module',
                            placeHolder: 'Select or search for an indexed module/package',
                            matchOnDescription: true,
                        }
                    );

                    if (!picked) return;
                    targetModule = picked.label;
                }

                const moduleSymbols = hoverProvider.getModuleSymbols(targetModule);

                if (moduleSymbols.length === 0) {
                    await hoverProvider.hydrateCachedInventories();
                    const hydratedModuleSymbols = hoverProvider.getModuleSymbols(targetModule);
                    if (hydratedModuleSymbols.length > 0) {
                        moduleBrowserPanel.show(targetModule, hydratedModuleSymbols);
                        return;
                    }

                    vscode.window.showInformationMessage(
                        `No indexed symbols found for "${targetModule}". Hover over a symbol from this package once to cache its inventory.`
                    );
                    return;
                }

                moduleBrowserPanel.show(targetModule, moduleSymbols);
            })
        );

        const corpusPromptStateKey = 'python-hover.corpusPromptShown.v1';
        const maybeShowCorpusPrompt = async () => {
            if (context.globalState.get<boolean>(corpusPromptStateKey)) {
                return;
            }

            const overview = diskCache.getOverview();
            if (overview.hasPythonStdlibCorpus) {
                await context.globalState.update(corpusPromptStateKey, true);
                return;
            }

            await context.globalState.update(corpusPromptStateKey, true);
            const action = await vscode.window.showInformationMessage(
                'PyHover can build a Python stdlib corpus once for richer built-in and keyword hovers. Clear Cache now keeps that corpus intact.',
                'Build Corpus',
                'Open PyHover',
            );

            if (action === 'Build Corpus') {
                await vscode.commands.executeCommand('python-hover.buildPythonCorpus');
                return;
            }

            if (action === 'Open PyHover') {
                await vscode.commands.executeCommand('python-hover.openStudio');
            }
        };

        setTimeout(() => {
            void maybeShowCorpusPrompt();
        }, 1200);

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

function buildImportStatementForDoc(doc: HoverDoc): string | undefined {
    if (doc.source === ResolutionSource.Local) return undefined;
    const rawTitle = doc.title.replace(/^builtins\./, '');
    if (!rawTitle || /^__\w+__$/.test(rawTitle)) return undefined;
    if (doc.kind === 'module') {
        return (!rawTitle || rawTitle === 'builtins') ? undefined : `import ${rawTitle}`;
    }
    if (!doc.module || doc.module === 'builtins') return undefined;
    const shortName = rawTitle.split('.').pop() || rawTitle;
    return `from ${doc.module} import ${shortName}`;
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
