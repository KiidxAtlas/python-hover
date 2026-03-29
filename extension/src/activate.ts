import * as vscode from 'vscode';
import { DiskCache } from '../../docs-engine/src/cache/diskCache';
import { HoverDoc, IndexedSymbolSummary, ResolutionSource } from '../../shared/types';
import { Config } from './config';
import { updateSettingWithPreferredTarget } from './configTarget';
import { HoverProvider } from './hoverProvider';
import { openHoverDocSource, openIndexedSymbolSource, openSourceTarget } from './indexedSymbolActions';
import { Logger } from './logger';
import { LspClient } from './lspClient';
import { DocsPanel } from './ui/docsPanel';
import { HoverDebugPanel } from './ui/hoverDebugPanel';
import { HoverPanel } from './ui/hoverPanel';
import { ModuleBrowserMessage, ModuleBrowserPanel, ModuleBrowserSettings } from './ui/moduleBrowserPanel';
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
        let activeCorpusBuild: vscode.CancellationTokenSource | undefined;

        const diagnosticCollection = vscode.languages.createDiagnosticCollection('python-hover');
        context.subscriptions.push(diagnosticCollection);

        let hoverProvider!: HoverProvider;

        let hoverRegistration: vscode.Disposable | undefined;
        const registerHoverProvider = () => {
            hoverRegistration?.dispose();
            hoverProvider?.dispose();
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
        const updateContextMenuContexts = () => {
            void Promise.all([
                vscode.commands.executeCommand('setContext', 'pyhover.contextMenu.enabled', config.showEditorContextMenu),
                vscode.commands.executeCommand('setContext', 'pyhover.contextMenu.searchDocs', config.showSearchDocsContextMenu),
                vscode.commands.executeCommand('setContext', 'pyhover.contextMenu.browseModule', config.showBrowseModuleContextMenu),
                vscode.commands.executeCommand('setContext', 'pyhover.contextMenu.pinHover', config.showPinHoverContextMenu),
                vscode.commands.executeCommand('setContext', 'pyhover.contextMenu.debugPinHover', config.showDebugPinHoverContextMenu),
                vscode.commands.executeCommand('setContext', 'pyhover.contextMenu.openStudio', config.showOpenStudioContextMenu),
            ]);
        };
        const refreshAfterCacheMutation = (reason: string) => {
            hoverProvider.clearSessionCache();
            rebuildHoverRuntime(reason, false);
            warmupImportsForDocument(vscode.window.activeTextEditor?.document);
            warmupConfiguredPackages();
            updateStudio();
        };

        // Clear per-file diagnostics when document closes
        context.subscriptions.push(
            vscode.workspace.onDidCloseTextDocument(doc => {
                diagnosticCollection.delete(doc.uri);
            })
        );

        // Register hover provider for all Python files
        registerHoverProvider();
        updateContextMenuContexts();
        context.subscriptions.push({ dispose: () => hoverRegistration?.dispose() });
        context.subscriptions.push({ dispose: () => hoverProvider?.dispose() });

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
                    updateContextMenuContexts();
                    updateStudio();
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
                refreshAfterCacheMutation('Cache cleared. Recreating hover provider.');
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.clearStdlibCorpus', () => {
                diskCache.clearPythonStdlibCorpus();
                vscode.window.showInformationMessage('PyHover stdlib corpus cleared.');
                Logger.log('Stdlib corpus cleared via command.');
                refreshAfterCacheMutation('Stdlib corpus cleared. Recreating hover provider.');
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.clearAllCache', () => {
                diskCache.clear({ preservePythonStdlibCorpus: false });
                vscode.window.showInformationMessage('PyHover cleared all cached docs, inventories, and stdlib corpus data.');
                Logger.log('Full cache cleared via command.');
                refreshAfterCacheMutation('Full cache cleared. Recreating hover provider.');
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.cancelPythonCorpusBuild', () => {
                if (!activeCorpusBuild) {
                    vscode.window.showInformationMessage('No Python stdlib corpus build is currently running.');
                    return;
                }

                activeCorpusBuild.cancel();
                updateStudio();
                vscode.window.showInformationMessage('Cancelling the Python stdlib corpus build…');
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.buildPythonCorpus', async () => {
                if (!config.onlineDiscovery) {
                    vscode.window.showWarningMessage('Enable python-hover.onlineDiscovery to build the Python corpus.');
                    return;
                }

                if (activeCorpusBuild) {
                    vscode.window.showInformationMessage('A Python stdlib corpus build is already running.');
                    return;
                }

                const cancellation = new vscode.CancellationTokenSource();
                activeCorpusBuild = cancellation;
                updateStudio();

                try {
                    const result = await vscode.window.withProgress(
                        {
                            location: vscode.ProgressLocation.Notification,
                            title: 'PyHover: Building Python stdlib corpus',
                            cancellable: true,
                        },
                        async (progress, token) => {
                            const cancellationSubscription = token.onCancellationRequested(() => {
                                cancellation.cancel();
                            });

                            try {
                                let lastReported = 0;
                                return await hoverProvider.buildPythonCorpus(({ completed, total, current }) => {
                                    const percent = total > 0 ? Math.floor((completed / total) * 100) : 0;
                                    const increment = Math.max(0, percent - lastReported);
                                    lastReported = percent;
                                    progress.report({
                                        increment,
                                        message: `${completed}/${total} ${current.split('#')[0]}`,
                                    });
                                }, () => cancellation.token.isCancellationRequested);
                            } finally {
                                cancellationSubscription.dispose();
                            }
                        }
                    );

                    if (result.cancelled) {
                        vscode.window.showWarningMessage(
                            `PyHover: cancelled stdlib corpus build after ${result.completed.toLocaleString()} of ${result.targets.toLocaleString()} targets.`
                        );
                    } else {
                        vscode.window.showInformationMessage(
                            `PyHover: built Python corpus for ${result.targets.toLocaleString()} stdlib targets across ${result.corpusPackages.toLocaleString()} buckets.`
                        );
                    }
                } finally {
                    cancellation.dispose();
                    activeCorpusBuild = undefined;
                    updateStudio();
                    statusBarManager.update();
                }
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
                        void openConfiguredLink(sel.url, 'docs');
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
        const buildModuleBrowserSettings = (): ModuleBrowserSettings => ({
            defaultView: config.moduleBrowserDefaultView,
            defaultSort: config.moduleBrowserDefaultSort,
            defaultDensity: config.moduleBrowserDefaultDensity,
            showPrivateSymbols: config.moduleBrowserShowPrivateSymbols,
            showHierarchyHints: config.moduleBrowserShowHierarchyHints,
            autoLoadPreviews: config.moduleBrowserAutoLoadPreviews,
            previewBatchSize: config.moduleBrowserPreviewBatchSize,
        });
        const moduleBrowserPanel = ModuleBrowserPanel.getInstance(async (message: ModuleBrowserMessage) => {
            switch (message.type) {
                case 'open-doc':
                    if (message.url) {
                        await openConfiguredLink(message.url, 'docs');
                    }
                    break;
                case 'pin-symbol':
                    await vscode.commands.executeCommand('python-hover.pinIndexedSymbol', message.symbol);
                    break;
                case 'open-source':
                    await vscode.commands.executeCommand('python-hover.openIndexedSymbolSource', message.symbol);
                    break;
                case 'copy-import': {
                    const importStatement = buildImportStatementForIndexedSymbol(message.symbol);
                    if (importStatement) {
                        await vscode.commands.executeCommand('python-hover.copyImport', importStatement);
                    } else if (message.symbol?.name) {
                        vscode.window.showInformationMessage(`No import statement is available for "${message.symbol.name}".`);
                    }
                    break;
                }
                case 'load-previews': {
                    const previews = await hoverProvider.getIndexedSymbolPreviews(Array.isArray(message.symbols) ? message.symbols : []);
                    moduleBrowserPanel.postPreviewData(message.requestId, previews);
                    break;
                }
                case 'run-command':
                    await vscode.commands.executeCommand(message.command);
                    break;
                case 'open-settings':
                    await vscode.commands.executeCommand('workbench.action.openSettings', message.query || 'python-hover.ui.moduleBrowser');
                    break;
                case 'update-setting':
                    await updateSettingWithPreferredTarget('python-hover', message.key.replace(/^python-hover\./, ''), message.value);
                    moduleBrowserPanel.refreshSettings(buildModuleBrowserSettings());
                    break;
            }
        });
        const openConfiguredLink = async (url: string, kind: 'docs' | 'devdocs' = 'docs') => {
            if (!url) {
                return;
            }

            const browser = kind === 'devdocs' ? config.devdocsBrowser : config.docsBrowser;
            if (browser === 'integrated') {
                docsPanel.show(url);
                return;
            }

            await vscode.env.openExternal(vscode.Uri.parse(url));
        };
        const parseDocLinkPayload = (payload: unknown): { url?: string; kind: 'docs' | 'devdocs' } => {
            if (typeof payload === 'string') {
                return { url: payload, kind: 'docs' };
            }

            if (!payload || typeof payload !== 'object') {
                return { url: undefined, kind: 'docs' };
            }

            const candidate = payload as { url?: unknown; kind?: unknown };
            return {
                url: typeof candidate.url === 'string' ? candidate.url : undefined,
                kind: candidate.kind === 'devdocs' ? 'devdocs' : 'docs',
            };
        };
        const buildStudioState = (): StudioState => {
            const overview = diskCache.getOverview();
            return {
                version: String(context.extension.packageJSON.version || '?'),
                indexedSymbols: hoverProvider.getIndexedSymbolCount(),
                cacheSizeLabel: `${(overview.generalBytes / 1_048_576).toFixed(1)} MB`,
                corpusSizeLabel: `${(overview.pythonStdlibCorpusBytes / 1_048_576).toFixed(1)} MB`,
                fullCacheSizeLabel: `${(overview.totalBytes / 1_048_576).toFixed(1)} MB`,
                pythonStdlibCorpusPackages: overview.pythonStdlibCorpusPackages,
                pythonStdlibCorpusEntries: overview.pythonStdlibCorpusEntries,
                hasPythonStdlibCorpus: overview.hasPythonStdlibCorpus,
                isBuildingPythonStdlibCorpus: Boolean(activeCorpusBuild),
                lastHoverTitle: hoverProvider.getLastDoc()?.title,
                onlineDiscovery: config.onlineDiscovery,
                runtimeHelper: config.runtimeHelperEnabled,
                astFallback: config.astFallbackEnabled,
                docScraping: config.docScrapingEnabled,
                buildFullCorpus: config.buildFullCorpus,
                warmupImports: config.warmupImports,
                useKnownDocsUrls: config.useKnownDocsUrls,
                enableDebugLogging: config.enableDebugLogging,
                diagnosticsEnabled: config.diagnosticsEnabled,
                showStatusBar: config.showStatusBar,
                showDebugPinButton: config.showDebugPinButton,
                showSignatures: config.showSignatures,
                showReturnTypes: config.showReturnTypes,
                compactMode: config.compactMode,
                showProvenance: config.showProvenance,
                showToolbar: config.showToolbar,
                showParameters: config.showParameters,
                showSeeAlso: config.showSeeAlso,
                showRaises: config.showRaises,
                showModuleExports: config.showModuleExports,
                showModuleStats: config.showModuleStats,
                showFooter: config.showFooter,
                showImportHints: config.showImportHints,
                docsBrowser: config.docsBrowser,
                devdocsBrowser: config.devdocsBrowser,
                requestTimeout: config.requestTimeout,
                hoverActivationDelay: config.hoverActivationDelay,
                inventoryCacheDays: config.inventoryCacheDays,
                snippetCacheHours: config.snippetCacheHours,
                contextMenuEnabled: config.showEditorContextMenu,
                contextMenuSearchDocs: config.showSearchDocsContextMenu,
                contextMenuBrowseModule: config.showBrowseModuleContextMenu,
                contextMenuPinHover: config.showPinHoverContextMenu,
                contextMenuDebugPinHover: config.showDebugPinHoverContextMenu,
                contextMenuOpenStudio: config.showOpenStudioContextMenu,
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
        const updateSetting = async (key: string, value: boolean | string | number) => {
            const setting = key.replace(/^python-hover\./, '');
            await updateSettingWithPreferredTarget('python-hover', setting, value);
        };
        const applyStudioPreset = async (preset: 'focused' | 'balanced' | 'deepDocs') => {
            const entries: Array<[string, boolean | string | number]> = (() => {
                switch (preset) {
                    case 'focused':
                        return [
                            ['ui.compactMode', true],
                            ['ui.showMetadataChips', true],
                            ['ui.showProvenance', true],
                            ['ui.showToolbar', true],
                            ['ui.showFooter', false],
                            ['ui.showImportHints', false],
                            ['ui.showParameters', false],
                            ['ui.showRaises', false],
                            ['ui.showSeeAlso', false],
                            ['ui.showModuleExports', false],
                            ['showPracticalExamples', false],
                            ['ui.maxContentLength', 420],
                            ['ui.maxExamples', 1],
                            ['ui.maxModuleExports', 8],
                        ];
                    case 'deepDocs':
                        return [
                            ['ui.compactMode', false],
                            ['ui.showMetadataChips', true],
                            ['ui.showProvenance', true],
                            ['ui.showToolbar', true],
                            ['ui.showFooter', true],
                            ['ui.showImportHints', true],
                            ['ui.showParameters', true],
                            ['ui.showRaises', true],
                            ['ui.showSeeAlso', true],
                            ['ui.showModuleExports', true],
                            ['ui.showModuleStats', true],
                            ['ui.showCallouts', true],
                            ['showPracticalExamples', true],
                            ['docScraping', true],
                            ['buildFullCorpus', true],
                            ['ui.maxContentLength', 1400],
                            ['maxSnippetLines', 18],
                            ['ui.maxParameters', 10],
                            ['ui.maxExamples', 4],
                            ['ui.maxModuleExports', 32],
                            ['ui.maxSeeAlsoItems', 14],
                        ];
                    case 'balanced':
                    default:
                        return [
                            ['ui.compactMode', false],
                            ['ui.showMetadataChips', true],
                            ['ui.showProvenance', true],
                            ['ui.showToolbar', true],
                            ['ui.showFooter', true],
                            ['ui.showImportHints', true],
                            ['ui.showParameters', true],
                            ['ui.showRaises', true],
                            ['ui.showSeeAlso', true],
                            ['ui.showModuleExports', true],
                            ['ui.showModuleStats', true],
                            ['ui.showCallouts', true],
                            ['showPracticalExamples', true],
                            ['docScraping', false],
                            ['buildFullCorpus', false],
                            ['ui.maxContentLength', 800],
                            ['maxSnippetLines', 12],
                            ['ui.maxParameters', 6],
                            ['ui.maxExamples', 2],
                            ['ui.maxModuleExports', 20],
                            ['ui.maxSeeAlsoItems', 8],
                        ];
                }
            })();

            for (const [setting, value] of entries) {
                await updateSettingWithPreferredTarget('python-hover', setting, value);
            }
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
                case 'apply-preset':
                    await applyStudioPreset(message.preset);
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
                    void openConfiguredLink(picked.url, 'docs');
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
            vscode.commands.registerCommand('python-hover.openDocLink', async (payload?: string | { url?: string; kind?: string }) => {
                const { url, kind } = parseDocLinkPayload(payload);
                if (!url) return;
                await openConfiguredLink(url, kind);
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.openHoverSource', async (payload?: string | { token?: string; target?: string }) => {
                const token = typeof payload === 'string'
                    ? payload
                    : typeof payload?.token === 'string'
                        ? payload.token
                        : undefined;
                const fallbackTarget = typeof payload === 'object' && payload && typeof payload.target === 'string'
                    ? payload.target
                    : undefined;

                const doc = hoverProvider.getDocByCommandToken(token);
                const opened = doc
                    ? await openHoverDocSource(doc, url => openConfiguredLink(url, 'docs'))
                    : fallbackTarget
                        ? await openSourceTarget(fallbackTarget, url => openConfiguredLink(url, 'docs'))
                        : false;

                if (!opened) {
                    vscode.window.showInformationMessage('No source location is available for this hover.');
                }
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.pinDocReference', async (payload?: {
                label?: string;
                url?: string;
                currentModule?: string;
                currentPackage?: string;
                currentTitle?: string;
            }) => {
                const label = typeof payload?.label === 'string' ? payload.label.trim() : '';
                const url = typeof payload?.url === 'string' ? payload.url.trim() : undefined;

                const doc = label
                    ? await hoverProvider.resolvePinnedReference({
                        label,
                        url,
                        currentModule: typeof payload?.currentModule === 'string' ? payload.currentModule : undefined,
                        currentPackage: typeof payload?.currentPackage === 'string' ? payload.currentPackage : undefined,
                        currentTitle: typeof payload?.currentTitle === 'string' ? payload.currentTitle : undefined,
                    })
                    : null;

                if (doc) {
                    HoverPanel.push(doc);
                    return;
                }

                if (url) {
                    await openConfiguredLink(url, 'docs');
                    return;
                }

                if (label) {
                    vscode.window.showInformationMessage(`No related documentation is indexed for "${label}" yet.`);
                }
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.pinPanelBack', () => {
                HoverPanel.goBack();
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.pinPanelForward', () => {
                HoverPanel.goForward();
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.pinPanelJump', (index?: number) => {
                if (typeof index !== 'number') return;
                HoverPanel.jumpTo(index);
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

                const opened = await openIndexedSymbolSource(
                    symbol,
                    hoverProvider,
                    url => openConfiguredLink(url, 'docs'),
                );
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
                        moduleBrowserPanel.show(targetModule, hydratedModuleSymbols, buildModuleBrowserSettings());
                        return;
                    }

                    vscode.window.showInformationMessage(
                        `No indexed symbols found for "${targetModule}". Hover over a symbol from this package once to cache its inventory.`
                    );
                    return;
                }

                moduleBrowserPanel.show(targetModule, moduleSymbols, buildModuleBrowserSettings());
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

function buildImportStatementForIndexedSymbol(symbol: IndexedSymbolSummary): string | undefined {
    const rawTitle = symbol.name;
    if (!rawTitle || /^__\w+__$/.test(rawTitle)) return undefined;
    if (symbol.kind === 'module') {
        return `import ${rawTitle}`;
    }

    const moduleRef = symbol.module || symbol.name.split('.')[0] || symbol.package;
    if (!moduleRef || moduleRef === 'builtins') return undefined;

    const segments = rawTitle.split('.').filter(Boolean);
    let shortName = segments[segments.length - 1] || rawTitle;
    if (segments.length > 1 && /^(?:method|property|field)$/i.test(symbol.kind || '')) {
        shortName = segments[0];
    }
    return `from ${moduleRef} import ${shortName}`;
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
