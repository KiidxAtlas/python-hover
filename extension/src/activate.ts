import { DiskCache } from "#docs-engine/cache/diskCache";
import { setEngineLogger } from "#docs-engine/engineLogger";
import {
  HoverDoc,
  HoverHistoryEntry,
  IndexedSymbolSummary,
  ResolutionSource,
  SavedDocEntry,
} from "#shared/types";
import { Config } from "#src/config";
import { updateSettingWithPreferredTarget } from "#src/configTarget";
import {
  normalizeRegularHoverSectionOrder,
  RegularHoverSectionId,
} from "#src/hover/hoverLayout";
import { HoverProvider } from "#src/hover/hoverProvider";
import {
  openHoverDocSource,
  openIndexedSymbolSource,
  openSourceTarget,
} from "#src/integrations/indexedSymbolActions";
import { LspClient } from "#src/integrations/lspClient";
import { Logger } from "#src/logger";
import { registerSearchDocsCommand } from "#src/runtime/browser/searchDocsCommand";
import { createCacheCommands } from "#src/runtime/commands/cacheCommands";
import { applyContextMenuContexts } from "#src/runtime/context/contextMenu";
import { createDocsRouting } from "#src/runtime/docs/docsRouting";
import { createLibraryState } from "#src/runtime/state/libraryState";
import {
  applyStudioPreset as applyStudioPresetEntries,
  buildStudioState,
} from "#src/runtime/studio/studioState";
import {
  buildSavedDocEntry,
  MAX_SAVED_DOCS,
  normalizeSavedDocEntry,
} from "#src/state/savedDocs";
import { isStdlibTopLevelModule } from "#src/symbols/symbolClassifier";
import { DocsPanel } from "#src/ui/panels/docsPanel";
import { HoverDebugPanel } from "#src/ui/panels/hoverDebugPanel";
import { HoverPanel } from "#src/ui/panels/hoverPanel";
import {
  ModuleBrowserMessage,
  ModuleBrowserPanel,
  ModuleBrowserSettings,
} from "#src/ui/panels/moduleBrowserPanel";
import {
  StudioMessage,
  StudioPanel,
  StudioPreset,
} from "#src/ui/panels/studioPanel";
import { buildImportStatement as buildSharedImportStatement } from "#src/ui/rendering/docPresentation";
import { StatusBarManager } from "#src/ui/shell/statusBar";
import { HoverHistoryView } from "#src/ui/views/hoverHistoryView";
import { HoverInspectorView } from "#src/ui/views/hoverInspectorView";
import { RecentPackagesView } from "#src/ui/views/recentPackagesView";
import { SavedDocsView } from "#src/ui/views/savedDocsView";
import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  Logger.initialize("PyHover");
  setEngineLogger({
    log: Logger.log.bind(Logger),
    debug: Logger.debug.bind(Logger),
    error: Logger.error.bind(Logger),
  });
  Logger.log("PyHover is now active!");

  try {
    const config = new Config();
    Logger.setDebugEnabled(config.enableDebugLogging);
    Logger.setRevealOnError(config.revealOutputOnError);
    if (config.revealOutputOnStartup) {
      Logger.show();
    }
    const lspClient = new LspClient();
    const statusBarManager = new StatusBarManager(context);
    const recentPackagesStateKey = "python-hover.recentPackages.v1";
    const savedDocsStateKey = "python-hover.savedDocs.v1";

    const globalStoragePath = context.globalStorageUri.fsPath;
    const createDiskCache = () =>
      new DiskCache(
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
    const hoverHistoryView = new HoverHistoryView(() =>
      hoverProvider.getHoverHistory(),
    );
    const recentPackagesView = new RecentPackagesView(() =>
      getRecentPackageSummaries(8),
    );
    const savedDocsView = new SavedDocsView(() => getSavedDocs());

    const diagnosticCollection =
      vscode.languages.createDiagnosticCollection("python-hover");
    context.subscriptions.push(diagnosticCollection);

    let hoverProvider!: HoverProvider;
    const docsPanel = DocsPanel.getInstance();
    let lastAutoOpenedHoverRequest: { url: string; at: number } | undefined;
    let liveRedirectIntegratedHoverToDocsPage =
      config.redirectIntegratedHoverToDocsPage;
    let liveAutoOpenCurrentHoverInIntegratedDocs =
      config.autoOpenCurrentHoverInIntegratedDocs;
    const hoverInspectorView = new HoverInspectorView((moduleName: string) =>
      hoverProvider.getModuleSymbols(moduleName),
    );

    let hoverRegistration: vscode.Disposable | undefined;
    let hoverSidebarSubscription: vscode.Disposable | undefined;
    const maybeAutoOpenCurrentHoverDocs = () => {
      if (
        config.docsBrowser !== "integrated" ||
        !liveAutoOpenCurrentHoverInIntegratedDocs
      ) {
        lastAutoOpenedHoverRequest = undefined;
        return;
      }

      if (!docsPanel.isOpen()) {
        return;
      }

      const doc = hoverProvider.getLastDoc();
      const nextUrl = doc?.url?.trim();
      if (!nextUrl) {
        return;
      }

      const now = Date.now();
      if (
        lastAutoOpenedHoverRequest &&
        lastAutoOpenedHoverRequest.url === nextUrl &&
        now - lastAutoOpenedHoverRequest.at < 250
      ) {
        return;
      }

      lastAutoOpenedHoverRequest = { url: nextUrl, at: now };
      docsPanel.show(nextUrl, { createIfMissing: false });
    };
    const bindHoverSidebar = () => {
      hoverSidebarSubscription?.dispose();
      hoverInspectorView.showDoc(hoverProvider.getLastDoc());
      hoverHistoryView.refresh();
      recentPackagesView.refresh();
      hoverSidebarSubscription = hoverProvider.onDidChangeSidebarState(() => {
        hoverInspectorView.showDoc(hoverProvider.getLastDoc());
        hoverHistoryView.refresh();
        recentPackagesView.refresh();
        maybeAutoOpenCurrentHoverDocs();
      });
    };
    const registerHoverProvider = () => {
      hoverRegistration?.dispose();
      hoverProvider?.dispose();
      hoverProvider = new HoverProvider(lspClient, config, diskCache);
      hoverProvider.setDiagnosticCollection(diagnosticCollection);
      hoverRegistration = vscode.languages.registerHoverProvider(
        { language: "python" },
        hoverProvider,
      );
      bindHoverSidebar();
      Logger.log("HoverProvider registered successfully.");
    };
    const rebuildHoverRuntime = (
      reason: string,
      recreateDiskCache: boolean,
    ) => {
      if (recreateDiskCache) {
        diskCache = createDiskCache();
      }

      Logger.log(reason);
      registerHoverProvider();
      statusBarManager.update();
    };
    const updateContextMenuContexts = () => {
      applyContextMenuContexts({
        enabled: config.showEditorContextMenu,
        searchDocs: config.showSearchDocsContextMenu,
        browseModule: config.showBrowseModuleContextMenu,
        pinHover: config.showPinHoverContextMenu,
        debugPinHover: config.showDebugPinHoverContextMenu,
        openStudio: config.showOpenStudioContextMenu,
      });
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
      vscode.workspace.onDidCloseTextDocument((doc) => {
        diagnosticCollection.delete(doc.uri);
      }),
    );

    // Register hover provider for all Python files
    registerHoverProvider();
    updateContextMenuContexts();
    context.subscriptions.push({ dispose: () => hoverRegistration?.dispose() });
    context.subscriptions.push({ dispose: () => hoverProvider?.dispose() });
    context.subscriptions.push({
      dispose: () => hoverSidebarSubscription?.dispose(),
    });
    context.subscriptions.push(
      vscode.window.createTreeView(HoverInspectorView.viewType, {
        treeDataProvider: hoverInspectorView,
        showCollapseAll: false,
      }),
    );
    context.subscriptions.push(
      vscode.window.createTreeView(SavedDocsView.viewType, {
        treeDataProvider: savedDocsView,
        showCollapseAll: false,
      }),
    );
    context.subscriptions.push(
      vscode.window.createTreeView(HoverHistoryView.viewType, {
        treeDataProvider: hoverHistoryView,
        showCollapseAll: false,
      }),
    );
    context.subscriptions.push(
      vscode.window.createTreeView(RecentPackagesView.viewType, {
        treeDataProvider: recentPackagesView,
        showCollapseAll: false,
      }),
    );

    // Warn once if no Python language extension is active (Pylance / python-language-server)
    checkPythonExtension();

    // Pre-load inventories for packages imported in the active document so
    // first-hover latency is lower. Only runs when onlineDiscovery is enabled —
    // inventories are fetched lazily on first hover otherwise.
    // Only applies to real user files (file: scheme) — Pylance opens many
    // virtual/internal type-stub documents that we must not try to warmup.
    const warmupImportsForDocument = (
      document: vscode.TextDocument | undefined,
    ) => {
      if (!document || document.languageId !== "python") {
        return;
      }
      if (!config.warmupImports || !config.onlineDiscovery) {
        return;
      }
      if (document.uri.scheme !== "file") {
        return;
      }
      hoverProvider.warmupDocumentImports(document);
    };

    const warmupConfiguredPackages = () => {
      if (!config.onlineDiscovery || config.preloadPackages.length === 0) {
        return;
      }
      hoverProvider.warmupPackages(config.preloadPackages);
    };

    warmupImportsForDocument(vscode.window.activeTextEditor?.document);
    warmupConfiguredPackages();

    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        warmupImportsForDocument(editor?.document);
      }),
    );

    context.subscriptions.push(
      vscode.workspace.onDidOpenTextDocument((document) => {
        warmupImportsForDocument(document);
      }),
    );

    // Clear session cache when a document is saved (symbols may have changed)
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument(() => {
        hoverProvider.clearSessionCache();
      }),
    );

    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        const affectsPythonHover = event.affectsConfiguration("python-hover");
        const affectsInterpreter =
          event.affectsConfiguration("python.defaultInterpreterPath") ||
          event.affectsConfiguration("python.pythonPath");
        const affectsDiskCache =
          affectsInterpreter ||
          event.affectsConfiguration("python-hover.cacheTTL");
        const affectsProviderCore =
          event.affectsConfiguration("python-hover.runtimeHelper") ||
          event.affectsConfiguration("python-hover.enable") ||
          event.affectsConfiguration("python-hover.onlineDiscovery") ||
          event.affectsConfiguration("python-hover.buildFullCorpus") ||
          event.affectsConfiguration("python-hover.docScraping") ||
          event.affectsConfiguration("python-hover.useKnownDocsUrls") ||
          event.affectsConfiguration("python-hover.requestTimeout") ||
          event.affectsConfiguration("python-hover.customLibraries");
        const affectsDocsRouting =
          event.affectsConfiguration("python-hover.docsBrowser") ||
          event.affectsConfiguration("python-hover.devdocsBrowser") ||
          event.affectsConfiguration(
            "python-hover.ui.redirectIntegratedHoverToDocsPage",
          ) ||
          event.affectsConfiguration(
            "python-hover.ui.autoOpenCurrentHoverInIntegratedDocs",
          );
        const affectsHoverPresentation =
          event.affectsConfiguration("python-hover.ui") ||
          event.affectsConfiguration("python-hover.docsBrowser") ||
          event.affectsConfiguration("python-hover.devdocsBrowser") ||
          event.affectsConfiguration("python-hover.showPracticalExamples");
        const affectsUnclassifiedHoverSetting =
          affectsPythonHover &&
          !affectsDiskCache &&
          !affectsProviderCore &&
          !affectsDocsRouting &&
          !affectsHoverPresentation;

        Logger.setDebugEnabled(config.enableDebugLogging);
        Logger.setRevealOnError(config.revealOutputOnError);

        if (event.affectsConfiguration("python-hover.revealOutputOnStartup")) {
          if (config.revealOutputOnStartup) {
            Logger.show();
          }
        }

        if (affectsDiskCache || affectsProviderCore) {
          rebuildHoverRuntime(
            "Configuration changed. Recreating hover provider.",
            affectsDiskCache,
          );
        } else if (affectsDocsRouting) {
          rebuildHoverRuntime(
            "Configuration changed. Recreating hover provider for docs routing.",
            false,
          );
        } else if (affectsHoverPresentation) {
          hoverProvider.clearSessionCache();
          Logger.log(
            "Configuration changed. Cleared hover presentation cache.",
          );
        } else if (affectsUnclassifiedHoverSetting) {
          hoverProvider.clearSessionCache();
          Logger.log(
            "Configuration changed. Refreshed hover state for updated settings.",
          );
        }

        if (affectsPythonHover) {
          liveRedirectIntegratedHoverToDocsPage =
            config.redirectIntegratedHoverToDocsPage;
          liveAutoOpenCurrentHoverInIntegratedDocs =
            config.autoOpenCurrentHoverInIntegratedDocs;
          lastAutoOpenedHoverRequest = undefined;
          docsPanel?.configure({
            autoOpenCurrentHoverInIntegratedDocs:
              liveAutoOpenCurrentHoverInIntegratedDocs,
          });
          warmupImportsForDocument(vscode.window.activeTextEditor?.document);
          warmupConfiguredPackages();
          updateContextMenuContexts();
          updateStudio();
        }
      }),
    );

    // ── Commands ─────────────────────────────────────────────────────────

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "python-hover.showStatusNotification",
        async () => {
          await statusBarManager.showStatusNotification();
        },
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "python-hover.toggleOnlineDiscovery",
        async () => {
          await statusBarManager.toggleOnlineDiscovery();
        },
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "python-hover.copyImport",
        async (importStatement?: string) => {
          let text = importStatement;
          if (!text) {
            const doc = hoverProvider.getLastDoc();
            if (doc) {
              text = buildImportStatementForDoc(doc);
            }
          }
          if (text) {
            await vscode.env.clipboard.writeText(text);
            vscode.window.showInformationMessage(`Copied: ${text}`);
          } else {
            vscode.window.showInformationMessage(
              "Hover over a Python symbol first to copy its import statement.",
            );
          }
        },
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand("python-hover.pinLast", () => {
        const doc = hoverProvider.getLastDoc();
        if (!doc) {
          vscode.window.showInformationMessage(
            "No recent hover — hover over a Python symbol first.",
          );
          return;
        }
        HoverPanel.show(doc);
      }),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "python-hover.copyUrl",
        async (urlOrToken?: string) => {
          const explicitUrl =
            typeof urlOrToken === "string" &&
            /^(?:https?:|file:|\/|[A-Za-z]:\\)/.test(urlOrToken)
              ? urlOrToken
              : undefined;
          const text =
            explicitUrl || hoverProvider.getDocByCommandToken(urlOrToken)?.url;
          if (text) {
            await vscode.env.clipboard.writeText(text);
            vscode.window.showInformationMessage("URL copied to clipboard");
          }
        },
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "python-hover.copySignature",
        async (sigOrToken?: string) => {
          const explicitSignature =
            typeof sigOrToken === "string" &&
            (sigOrToken.includes("(") || sigOrToken.includes("->"))
              ? sigOrToken
              : undefined;
          const text =
            explicitSignature ||
            hoverProvider.getDocByCommandToken(sigOrToken)?.signature;
          if (text) {
            await vscode.env.clipboard.writeText(text);
            vscode.window.showInformationMessage(
              "Signature copied to clipboard",
            );
          }
        },
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "python-hover.pinHover",
        (token?: string) => {
          const doc = hoverProvider.getDocByCommandToken(token);
          if (!doc) {
            vscode.window.showInformationMessage(
              "Hover over a Python symbol first, then click Pin.",
            );
            return;
          }
          HoverPanel.show(doc);
        },
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "python-hover.debugPinHover",
        (token?: string) => {
          const doc = hoverProvider.getDocByCommandToken(token);
          if (!doc) {
            vscode.window.showInformationMessage(
              "Hover over a Python symbol first, then click Debug.",
            );
            return;
          }

          HoverPanel.show(doc);
          HoverDebugPanel.show(
            doc,
            hoverProvider.getRenderedHoverMarkdown(token) || "",
          );
        },
      ),
    );

    // Open a docs URL in a persistent side-panel browser (ViewColumn.Beside).
    // Uses our own WebviewPanel so the column is guaranteed — VS Code's built-in
    // simpleBrowser.show ignores viewColumn when its panel is already visible.
    docsPanel.configure({
      autoOpenCurrentHoverInIntegratedDocs:
        liveAutoOpenCurrentHoverInIntegratedDocs,
      onDidToggleAutoOpenCurrentHoverInIntegratedDocs: async (enabled) => {
        liveAutoOpenCurrentHoverInIntegratedDocs = enabled;
        lastAutoOpenedHoverRequest = undefined;
        await updateSettingWithPreferredTarget(
          "python-hover",
          "ui.autoOpenCurrentHoverInIntegratedDocs",
          enabled,
        );
        updateStudio();
        maybeAutoOpenCurrentHoverDocs();
      },
    });
    const allowedModuleBrowserCommands = new Set(["python-hover.searchDocs"]);
    const allowedModuleBrowserSettingKeys = new Set([
      "python-hover.ui.moduleBrowser.defaultSort",
      "python-hover.ui.moduleBrowser.defaultView",
      "python-hover.ui.moduleBrowser.defaultDensity",
      "python-hover.ui.moduleBrowser.showPrivateSymbols",
      "python-hover.ui.moduleBrowser.autoLoadPreviews",
      "python-hover.ui.moduleBrowser.showHierarchyHints",
    ]);
    const allowedStudioCommands = new Set([
      "python-hover.searchDocs",
      "python-hover.browseModule",
      "python-hover.pinLast",
      "python-hover.showHistory",
      "python-hover.buildPythonCorpus",
      "python-hover.cancelPythonCorpusBuild",
      "python-hover.clearCache",
      "python-hover.clearStdlibCorpus",
      "python-hover.clearAllCache",
      "python-hover.openCacheFolder",
      "python-hover.showLogs",
    ]);
    const allowedStudioSettingKeys = new Set([
      "python-hover.ui.compactMode",
      "python-hover.ui.showToolbar",
      "python-hover.ui.showProvenance",
      "python-hover.ui.showBadges",
      "python-hover.ui.showMetadataChips",
      "python-hover.ui.showSignatures",
      "python-hover.ui.showParameterLens",
      "python-hover.ui.showReturnTypes",
      "python-hover.ui.showCallouts",
      "python-hover.ui.showDescription",
      "python-hover.ui.showParameters",
      "python-hover.ui.showRaises",
      "python-hover.ui.showSeeAlso",
      "python-hover.ui.showNotes",
      "python-hover.ui.showModuleExports",
      "python-hover.ui.showModuleStats",
      "python-hover.ui.showImportHints",
      "python-hover.ui.showFooter",
      "python-hover.ui.maxContentLength",
      "python-hover.maxSnippetLines",
      "python-hover.ui.maxParameters",
      "python-hover.ui.maxExamples",
      "python-hover.ui.maxModuleExports",
      "python-hover.ui.maxSeeAlsoItems",
      "python-hover.ui.hoverSectionOrder",
      "python-hover.showPracticalExamples",
      "python-hover.onlineDiscovery",
      "python-hover.runtimeHelper",
      "python-hover.astFallback",
      "python-hover.docScraping",
      "python-hover.buildFullCorpus",
      "python-hover.warmupImports",
      "python-hover.useKnownDocsUrls",
      "python-hover.diagnostics.enabled",
      "python-hover.enableDebugLogging",
      "python-hover.docsBrowser",
      "python-hover.devdocsBrowser",
      "python-hover.ui.redirectIntegratedHoverToDocsPage",
      "python-hover.ui.autoOpenCurrentHoverInIntegratedDocs",
      "python-hover.requestTimeout",
      "python-hover.hoverActivationDelay",
      "python-hover.ui.showStatusBar",
      "python-hover.ui.showDebugPinButton",
      "python-hover.ui.contextMenu.enabled",
      "python-hover.ui.contextMenu.searchDocs",
      "python-hover.ui.contextMenu.browseModule",
      "python-hover.ui.contextMenu.pinHover",
      "python-hover.ui.contextMenu.debugPinHover",
      "python-hover.ui.contextMenu.openStudio",
      "python-hover.ui.moduleBrowser.defaultView",
      "python-hover.ui.moduleBrowser.defaultSort",
      "python-hover.ui.moduleBrowser.defaultDensity",
      "python-hover.ui.moduleBrowser.showPrivateSymbols",
      "python-hover.ui.moduleBrowser.autoLoadPreviews",
      "python-hover.ui.moduleBrowser.showHierarchyHints",
    ]);
    const isAllowedSettingsQuery = (
      query: string | undefined,
      fallback: string,
    ): string => {
      return query && query.startsWith("python-hover") ? query : fallback;
    };
    const buildModuleBrowserSettings = (): ModuleBrowserSettings => ({
      defaultView: config.moduleBrowserDefaultView,
      defaultSort: config.moduleBrowserDefaultSort,
      defaultDensity: config.moduleBrowserDefaultDensity,
      showPrivateSymbols: config.moduleBrowserShowPrivateSymbols,
      showHierarchyHints: config.moduleBrowserShowHierarchyHints,
      autoLoadPreviews: config.moduleBrowserAutoLoadPreviews,
      previewBatchSize: config.moduleBrowserPreviewBatchSize,
    });
    const moduleBrowserPanel = ModuleBrowserPanel.getInstance(
      async (message: ModuleBrowserMessage) => {
        try {
          switch (message.type) {
            case "open-doc":
              if (message.url) {
                await openConfiguredLink(message.url, "docs");
              }
              break;
            case "pin-symbol":
              await vscode.commands.executeCommand(
                "python-hover.pinIndexedSymbol",
                message.symbol,
              );
              break;
            case "open-source":
              await vscode.commands.executeCommand(
                "python-hover.openIndexedSymbolSource",
                message.symbol,
              );
              break;
            case "copy-import": {
              const importStatement = buildImportStatementForIndexedSymbol(
                message.symbol,
              );
              if (importStatement) {
                await vscode.commands.executeCommand(
                  "python-hover.copyImport",
                  importStatement,
                );
              } else if (message.symbol?.name) {
                vscode.window.showInformationMessage(
                  `No import statement is available for "${message.symbol.name}".`,
                );
              }
              break;
            }
            case "load-previews": {
              const previews = await hoverProvider.getIndexedSymbolPreviews(
                Array.isArray(message.symbols) ? message.symbols : [],
              );
              moduleBrowserPanel.postPreviewData(message.requestId, previews);
              break;
            }
            case "run-command":
              if (!allowedModuleBrowserCommands.has(message.command)) {
                Logger.debug(
                  "Ignored unsupported module browser command",
                  message.command,
                );
                break;
              }
              await vscode.commands.executeCommand(message.command);
              break;
            case "open-settings":
              await vscode.commands.executeCommand(
                "workbench.action.openSettings",
                isAllowedSettingsQuery(
                  message.query,
                  "python-hover.ui.moduleBrowser",
                ),
              );
              break;
            case "update-setting":
              if (!allowedModuleBrowserSettingKeys.has(message.key)) {
                Logger.debug(
                  "Ignored unsupported module browser setting",
                  message.key,
                );
                break;
              }
              await updateSettingWithPreferredTarget(
                "python-hover",
                message.key.replace(/^python-hover\./, ""),
                message.value,
              );
              break;
          }
        } catch (error) {
          if (message.type === "update-setting") {
            reportSettingUpdateError(message.key, error);
          } else {
            Logger.error("Module browser action failed", error);
          }
        } finally {
          moduleBrowserPanel.refreshSettings(buildModuleBrowserSettings());
        }
      },
    );
    const {
      openIntegratedDocs,
      openConfiguredLink,
      parseDocLinkPayload,
      parsePreferredDocsPayload,
    } = createDocsRouting({
      getBrowserForKind: (kind) =>
        kind === "devdocs" ? config.devdocsBrowser : config.docsBrowser,
      showDocsPanel: (url) => docsPanel.show(url),
      logError: (message, error) => Logger.error(message, error),
    });
    const libraryState = createLibraryState({
      globalState: context.globalState,
      savedDocsStateKey,
      recentPackagesStateKey,
      maxSavedDocs: MAX_SAVED_DOCS,
      normalizeSavedDocEntry,
      buildSavedDocEntry,
      getDocByCommandToken: (token) =>
        hoverProvider.getDocByCommandToken(token),
      getExactDocByCommandToken: (token) =>
        hoverProvider.getExactDocByCommandToken(token),
      getLastDoc: () => hoverProvider.getLastDoc(),
      getHoverHistory: () => hoverProvider.getHoverHistory(),
      getIndexedPackageSummaries: () =>
        hoverProvider.getIndexedPackageSummaries(),
      onSavedDocsChanged: () => {
        savedDocsView.refresh();
        statusBarManager.update();
      },
      onRecentPackagesChanged: () => {
        recentPackagesView.refresh();
        statusBarManager.update();
      },
    });
    const getSavedDocs = (): SavedDocEntry[] => libraryState.getSavedDocs();
    const toggleSavedDoc = async (
      payload?: string | Partial<SavedDocEntry>,
    ) => {
      const result = await libraryState.toggleSavedDoc(payload);
      if (result.status === "invalid") {
        vscode.window.showInformationMessage(
          "This hover target cannot be saved yet. Try again after a docs-backed hover resolves.",
        );
        return;
      }

      if (result.status === "removed") {
        vscode.window.showInformationMessage(
          `Removed "${result.entry.title}" from Saved Docs.`,
        );
        return;
      }

      vscode.window.showInformationMessage(
        `Saved "${result.entry.title}" to Saved Docs.`,
      );
    };
    const removeSavedDoc = async (payload?: Partial<SavedDocEntry>) => {
      await libraryState.removeSavedDoc(payload);
    };
    const rememberRecentPackage = async (packageName: string | undefined) => {
      await libraryState.rememberRecentPackage(packageName);
    };
    const getRecentPackages = (): string[] => libraryState.getRecentPackages();
    const getRecentPackageSummaries = (
      limit = 6,
    ): Array<{ name: string; count: number }> =>
      libraryState.getRecentPackageSummaries(limit);
    const runSearchDocs = registerSearchDocsCommand({
      hoverProvider,
      getSavedDocs: () => getSavedDocs(),
      getRecentPackageSummaries: (limit) => getRecentPackageSummaries(limit),
      rememberRecentPackage: (packageName) =>
        rememberRecentPackage(packageName),
      openConfiguredLink: (url, kind) => openConfiguredLink(url, kind),
    });
    context.subscriptions.push(
      vscode.commands.registerCommand("python-hover.searchDocs", runSearchDocs),
    );
    const getStudioState = () => {
      const overview = diskCache.getOverview();
      return buildStudioState({
        config,
        version: String(context.extension.packageJSON.version || "?"),
        overview,
        indexedSymbols: hoverProvider.getIndexedSymbolCount(),
        isBuildingPythonStdlibCorpus: Boolean(activeCorpusBuild),
        lastHoverTitle: hoverProvider.getLastDoc()?.title,
      });
    };
    const refreshStudio = () => {
      studioPanel.show(getStudioState());
      statusBarManager.update();
    };
    const updateStudio = () => {
      studioPanel.update(getStudioState());
      statusBarManager.update();
    };
    const cacheCommands = createCacheCommands({
      context,
      config,
      diskCache,
      hoverProvider,
      activeCorpusBuild: () => activeCorpusBuild,
      setActiveCorpusBuild: (value) => {
        activeCorpusBuild = value;
      },
      updateStudio,
      statusBarUpdate: () => statusBarManager.update(),
      refreshAfterCacheMutation,
    });
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "python-hover.clearCache",
        cacheCommands.clearCache,
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "python-hover.clearStdlibCorpus",
        cacheCommands.clearStdlibCorpus,
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "python-hover.clearAllCache",
        cacheCommands.clearAllCache,
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "python-hover.cancelPythonCorpusBuild",
        cacheCommands.cancelPythonCorpusBuild,
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "python-hover.buildPythonCorpus",
        cacheCommands.buildPythonCorpus,
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "python-hover.openCacheFolder",
        cacheCommands.openCacheFolder,
      ),
    );
    const reportSettingUpdateError = (key: string, error: unknown) => {
      Logger.error(`Failed to update setting ${key}`, error);
      void vscode.window.showErrorMessage(
        `PyHover could not update ${key}. Check the PyHover output channel for details.`,
      );
    };
    const updateSetting = async (
      key: string,
      value: boolean | string | number,
    ) => {
      const setting = key.replace(/^python-hover\./, "");
      await updateSettingWithPreferredTarget("python-hover", setting, value);
    };
    const reorderHoverSection = async (
      section: RegularHoverSectionId,
      direction: "up" | "down",
    ) => {
      const current = normalizeRegularHoverSectionOrder(
        config.hoverSectionOrder,
      );
      const index = current.indexOf(section);
      if (index === -1) {
        return;
      }
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= current.length) {
        return;
      }
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      await updateSettingWithPreferredTarget(
        "python-hover",
        "ui.hoverSectionOrder",
        next,
      );
    };
    const ensureIndexedPackageLoaded = async (packageName: string) => {
      const normalized = packageName.trim();
      if (!normalized) {
        return;
      }

      await hoverProvider.ensureIndexedPackage(
        normalized,
        normalized === "builtins" ||
          normalized === "python" ||
          isStdlibTopLevelModule(normalized),
      );
    };
    const getBrowseablePackages = async (): Promise<string[]> => {
      let packages = hoverProvider.getIndexedPackages();
      if (packages.length > 0) {
        return packages;
      }

      packages = await hoverProvider.hydrateCachedInventories();
      if (packages.length > 0) {
        return packages;
      }

      await Promise.all([
        ensureIndexedPackageLoaded("builtins"),
        ensureIndexedPackageLoaded("typing"),
        ensureIndexedPackageLoaded("asyncio"),
      ]);

      return hoverProvider.getIndexedPackages();
    };
    statusBarManager.setDataAccessors({
      getHoverHistory: () => hoverProvider.getHoverHistory(),
      getIndexedSymbolCount: () => hoverProvider.getIndexedSymbolCount(),
      getLastHoverTitle: () => hoverProvider.getLastDoc()?.title,
      getRecentPackages: () => getRecentPackageSummaries(5),
      getSavedDocs: () => getSavedDocs().slice(0, 5),
    });
    const applyStudioPreset = async (preset: StudioPreset) => {
      await applyStudioPresetEntries(preset, (setting, value) =>
        updateSettingWithPreferredTarget("python-hover", setting, value),
      );
    };
    const studioPanel = StudioPanel.getInstance(
      async (message: StudioMessage) => {
        try {
          switch (message.type) {
            case "run-command":
              if (!allowedStudioCommands.has(message.command)) {
                Logger.debug(
                  "Ignored unsupported studio command",
                  message.command,
                );
                break;
              }
              await vscode.commands.executeCommand(message.command);
              break;
            case "open-settings":
              await vscode.commands.executeCommand(
                "workbench.action.openSettings",
                isAllowedSettingsQuery(message.query, "python-hover"),
              );
              break;
            case "update-setting":
              if (!allowedStudioSettingKeys.has(message.key)) {
                Logger.debug("Ignored unsupported studio setting", message.key);
                break;
              }
              await updateSetting(message.key, message.value);
              break;
            case "reorder-hover-section":
              await reorderHoverSection(message.section, message.direction);
              break;
            case "apply-preset":
              await applyStudioPreset(message.preset);
              break;
          }
        } catch (error) {
          if (message.type === "update-setting") {
            reportSettingUpdateError(message.key, error);
          } else if (message.type === "reorder-hover-section") {
            Logger.error(
              `Failed to reorder hover section ${message.section} (${message.direction})`,
              error,
            );
            void vscode.window.showErrorMessage(
              "PyHover could not reorder hover sections. Check the PyHover output channel for details.",
            );
          } else if (message.type === "apply-preset") {
            Logger.error(
              `Failed to apply studio preset ${message.preset}`,
              error,
            );
            void vscode.window.showErrorMessage(
              "PyHover could not apply that Studio preset. Check the PyHover output channel for details.",
            );
          } else {
            Logger.error("Studio action failed", error);
          }
        } finally {
          updateStudio();
        }
      },
    );
    context.subscriptions.push({ dispose: () => docsPanel.dispose() });
    context.subscriptions.push({ dispose: () => moduleBrowserPanel.dispose() });
    context.subscriptions.push({ dispose: () => studioPanel.dispose() });

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "python-hover.toggleSavedHover",
        async (payload?: string | Partial<SavedDocEntry>) => {
          await toggleSavedDoc(payload);
        },
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "python-hover.removeSavedHover",
        async (payload?: Partial<SavedDocEntry>) => {
          await removeSavedDoc(payload);
        },
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "python-hover.openSavedHoverEntry",
        async (entry?: Partial<SavedDocEntry>) => {
          const savedEntry = entry ? normalizeSavedDocEntry(entry) : undefined;
          if (!savedEntry) {
            vscode.window.showInformationMessage(
              "That saved doc entry is no longer available.",
            );
            return;
          }

          const commandToken =
            typeof savedEntry.commandToken === "string"
              ? savedEntry.commandToken
              : undefined;
          const doc = commandToken
            ? hoverProvider.getExactDocByCommandToken(commandToken)
            : null;
          if (doc) {
            hoverInspectorView.showDoc(doc);
            void vscode.commands
              .executeCommand(`${HoverInspectorView.viewType}.focus`)
              .then(undefined, () => undefined);
            return;
          }

          if (savedEntry.url) {
            await openConfiguredLink(savedEntry.url, "docs");
            return;
          }

          if (savedEntry.module) {
            await vscode.commands.executeCommand(
              "python-hover.browseModule",
              savedEntry.module,
            );
            return;
          }

          if (savedEntry.sourceUrl) {
            await openSourceTarget(savedEntry.sourceUrl, (url) =>
              openConfiguredLink(url, "docs"),
            );
            return;
          }

          vscode.window.showInformationMessage(
            "That saved doc entry no longer has an openable target.",
          );
        },
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand("python-hover.openStudio", () => {
        refreshStudio();
      }),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand("python-hover.showLogs", () => {
        Logger.show();
      }),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand("python-hover.showHistory", async () => {
        const history = hoverProvider.getHoverHistory();
        if (history.length === 0) {
          vscode.window.showInformationMessage(
            "No hover history yet — hover over Python symbols to populate it.",
          );
          return;
        }
        type HistoryItem = vscode.QuickPickItem & { entry: HoverHistoryEntry };
        const liveEntries = history.filter((entry) => !!entry.commandToken);
        const linkedEntries = history.filter(
          (entry) => !entry.commandToken && !!entry.url,
        );
        const makeHistoryItem = (
          entry: HoverHistoryEntry,
          detail: string,
        ): HistoryItem => ({
          label: entry.title,
          description: [entry.kind, entry.module ?? entry.package]
            .filter(Boolean)
            .join(" • "),
          detail,
          entry,
        });
        const items: Array<HistoryItem | vscode.QuickPickItem> = [];
        if (liveEntries.length > 0) {
          items.push({
            label: `Live Session (${liveEntries.length})`,
            kind: vscode.QuickPickItemKind.Separator,
          });
          items.push(
            ...liveEntries.map((entry) =>
              makeHistoryItem(
                entry,
                "Reopen this symbol in the PyHover inspector.",
              ),
            ),
          );
        }
        if (linkedEntries.length > 0) {
          items.push({
            label: `Docs Links (${linkedEntries.length})`,
            kind: vscode.QuickPickItemKind.Separator,
          });
          items.push(
            ...linkedEntries.map((entry) =>
              makeHistoryItem(entry, "Open the stored documentation target."),
            ),
          );
        }
        const picked = (await vscode.window.showQuickPick(items, {
          title: "PyHover: Hover History",
          placeHolder:
            "Recent symbols grouped by live session entries and stored docs links",
          matchOnDescription: true,
          matchOnDetail: true,
        })) as HistoryItem | undefined;
        if (picked?.entry) {
          void vscode.commands.executeCommand(
            "python-hover.openSidebarHistoryEntry",
            picked.entry,
          );
        }
      }),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "python-hover.openSidebarHistoryEntry",
        async (entry?: HoverHistoryEntry) => {
          const commandToken =
            typeof entry?.commandToken === "string"
              ? entry.commandToken
              : undefined;
          const doc = commandToken
            ? hoverProvider.getExactDocByCommandToken(commandToken)
            : null;

          if (doc) {
            hoverInspectorView.showDoc(doc);
            void vscode.commands
              .executeCommand(`${HoverInspectorView.viewType}.focus`)
              .then(undefined, () => undefined);
            return;
          }

          if (entry?.url) {
            await openConfiguredLink(entry.url, "docs");
            return;
          }

          vscode.window.showInformationMessage(
            "That history entry is no longer available in the current session.",
          );
        },
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "python-hover.openDocsSide",
        (url: string) => {
          void openIntegratedDocs(url);
        },
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "python-hover.openDocLink",
        async (payload?: string | { url?: string; kind?: string }) => {
          const { url, kind } = parseDocLinkPayload(payload);
          if (!url) {
            return;
          }
          await openConfiguredLink(url, kind);
        },
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "python-hover.openPreferredDocs",
        async (
          payload?: string | { url?: string; token?: string; kind?: string },
        ) => {
          const { url, token, kind } = parsePreferredDocsPayload(payload);
          if (!url) {
            return;
          }

          if (
            kind === "docs" &&
            config.docsBrowser === "integrated" &&
            liveRedirectIntegratedHoverToDocsPage &&
            token
          ) {
            const doc = hoverProvider.getDocByCommandToken(token);
            if (doc) {
              HoverPanel.show(doc);
              return;
            }
          }

          await openConfiguredLink(url, kind);
        },
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "python-hover.openHoverSource",
        async (payload?: string | { token?: string; target?: string }) => {
          const token =
            typeof payload === "string"
              ? payload
              : typeof payload?.token === "string"
                ? payload.token
                : undefined;
          const fallbackTarget =
            typeof payload === "object" &&
            payload &&
            typeof payload.target === "string"
              ? payload.target
              : undefined;

          const doc = hoverProvider.getDocByCommandToken(token);
          const opened = doc
            ? await openHoverDocSource(doc, (url) =>
                openConfiguredLink(url, "docs"),
              )
            : fallbackTarget
              ? await openSourceTarget(fallbackTarget, (url) =>
                  openConfiguredLink(url, "docs"),
                )
              : false;

          if (!opened) {
            vscode.window.showInformationMessage(
              "No source location is available for this hover.",
            );
          }
        },
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "python-hover.pinDocReference",
        async (payload?: {
          label?: string;
          url?: string;
          currentModule?: string;
          currentPackage?: string;
          currentTitle?: string;
        }) => {
          const label =
            typeof payload?.label === "string" ? payload.label.trim() : "";
          const url =
            typeof payload?.url === "string" ? payload.url.trim() : undefined;

          const doc = label
            ? await hoverProvider.resolvePinnedReference({
                label,
                url,
                currentModule:
                  typeof payload?.currentModule === "string"
                    ? payload.currentModule
                    : undefined,
                currentPackage:
                  typeof payload?.currentPackage === "string"
                    ? payload.currentPackage
                    : undefined,
                currentTitle:
                  typeof payload?.currentTitle === "string"
                    ? payload.currentTitle
                    : undefined,
              })
            : null;

          if (doc) {
            HoverPanel.push(doc);
            return;
          }

          if (url) {
            await openConfiguredLink(url, "docs");
            return;
          }

          if (label) {
            vscode.window.showInformationMessage(
              `No related documentation is indexed for "${label}" yet.`,
            );
          }
        },
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand("python-hover.pinPanelBack", () => {
        HoverPanel.goBack();
      }),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand("python-hover.pinPanelForward", () => {
        HoverPanel.goForward();
      }),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "python-hover.pinPanelJump",
        (index?: number) => {
          if (typeof index !== "number") {
            return;
          }
          HoverPanel.jumpTo(index);
        },
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "python-hover.getIndexedSymbolPreviews",
        async (symbols: IndexedSymbolSummary[]) => {
          return hoverProvider.getIndexedSymbolPreviews(
            Array.isArray(symbols) ? symbols : [],
          );
        },
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "python-hover.pinIndexedSymbol",
        async (symbol: IndexedSymbolSummary) => {
          if (!symbol?.name) {
            return;
          }

          const doc = await hoverProvider.resolveIndexedSymbolDoc(symbol);
          if (!doc) {
            vscode.window.showInformationMessage(
              `No pinned hover content is available for "${symbol.name}" yet.`,
            );
            return;
          }

          HoverPanel.show(doc);
        },
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "python-hover.openIndexedSymbolSource",
        async (symbol: IndexedSymbolSummary) => {
          if (!symbol?.name) {
            return;
          }

          const opened = await openIndexedSymbolSource(
            symbol,
            hoverProvider,
            (url) => openConfiguredLink(url, "docs"),
          );
          if (!opened) {
            vscode.window.showInformationMessage(
              `No source location is available for "${symbol.name}".`,
            );
          }
        },
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "python-hover.browseModule",
        async (moduleName: string) => {
          let targetModule = moduleName?.trim();
          if (!targetModule) {
            type ModulePickItem = vscode.QuickPickItem & {
              moduleName?: string;
            };
            const packages = await getBrowseablePackages();

            if (packages.length === 0) {
              vscode.window.showInformationMessage(
                config.onlineDiscovery
                  ? "No indexed packages are available yet. PyHover could not seed its starter indexes. Hover a library symbol once or build the corpus first."
                  : "No indexed packages are available yet. Online discovery is off, so PyHover needs cached inventories or a built corpus before Browse Modules can populate.",
              );
              return;
            }

            const summaryByName = new Map(
              hoverProvider
                .getIndexedPackageSummaries()
                .map((summary) => [summary.name, summary.count]),
            );
            const recentPackageNames = new Set(getRecentPackages());
            const packageItems = packages
              .map((pkg) => ({
                label: `${isStdlibTopLevelModule(pkg) || pkg === "builtins" ? "$(library)" : "$(package)"} ${pkg}`,
                description: summaryByName.has(pkg)
                  ? `${(summaryByName.get(pkg) ?? 0).toLocaleString()} indexed symbols`
                  : "Indexed module/package",
                detail: recentPackageNames.has(pkg)
                  ? isStdlibTopLevelModule(pkg) || pkg === "builtins"
                    ? "Recent standard-library package"
                    : "Recent package"
                  : isStdlibTopLevelModule(pkg) || pkg === "builtins"
                    ? "Python standard library"
                    : "Indexed third-party or custom library",
                moduleName: pkg,
              }))
              .sort((left, right) => {
                const leftRecent = left.moduleName
                  ? recentPackageNames.has(left.moduleName)
                  : false;
                const rightRecent = right.moduleName
                  ? recentPackageNames.has(right.moduleName)
                  : false;
                if (leftRecent !== rightRecent) {
                  return leftRecent ? -1 : 1;
                }
                return (left.moduleName ?? left.label).localeCompare(
                  right.moduleName ?? right.label,
                );
              });

            const items: ModulePickItem[] = [];
            const recentItems = packageItems.filter(
              (item) =>
                item.moduleName && recentPackageNames.has(item.moduleName),
            );
            const stdlibItems = packageItems.filter(
              (item) =>
                item.moduleName &&
                !recentPackageNames.has(item.moduleName) &&
                (isStdlibTopLevelModule(item.moduleName) ||
                  item.moduleName === "builtins"),
            );
            const libraryItems = packageItems.filter(
              (item) =>
                item.moduleName &&
                !recentPackageNames.has(item.moduleName) &&
                !isStdlibTopLevelModule(item.moduleName) &&
                item.moduleName !== "builtins",
            );
            if (recentItems.length > 0) {
              items.push({
                label: "Recent Packages",
                kind: vscode.QuickPickItemKind.Separator,
              });
              items.push(...recentItems);
            }
            if (stdlibItems.length > 0) {
              items.push({
                label: "Standard Library",
                kind: vscode.QuickPickItemKind.Separator,
              });
              items.push(...stdlibItems);
            }
            if (libraryItems.length > 0) {
              items.push({
                label: "Libraries",
                kind: vscode.QuickPickItemKind.Separator,
              });
              items.push(...libraryItems);
            }

            const picked = await vscode.window.showQuickPick(items, {
              title: "Browse Indexed Module",
              placeHolder: "Select or search for an indexed module or package",
              matchOnDescription: true,
              matchOnDetail: true,
            });

            if (!picked) {
              return;
            }
            const selectedModuleName = (picked as ModulePickItem).moduleName;
            if (!selectedModuleName) {
              return;
            }
            targetModule = selectedModuleName;
          }

          let moduleSymbols = hoverProvider.getModuleSymbols(targetModule);

          if (moduleSymbols.length === 0) {
            const requestedPackage = targetModule.split(".")[0] || targetModule;
            await ensureIndexedPackageLoaded(requestedPackage);

            moduleSymbols = hoverProvider.getModuleSymbols(targetModule);
          }

          if (moduleSymbols.length === 0) {
            await hoverProvider.hydrateCachedInventories();
            moduleSymbols = hoverProvider.getModuleSymbols(targetModule);
            if (moduleSymbols.length > 0) {
              moduleBrowserPanel.show(
                targetModule,
                moduleSymbols,
                buildModuleBrowserSettings(),
              );
              return;
            }

            vscode.window.showInformationMessage(
              `No indexed symbols found for "${targetModule}". Hover over a symbol from this package once to cache its inventory.`,
            );
            return;
          }

          await rememberRecentPackage(targetModule);
          moduleBrowserPanel.show(
            targetModule,
            moduleSymbols,
            buildModuleBrowserSettings(),
          );
        },
      ),
    );

    const corpusPromptStateKey = "python-hover.corpusPromptShown.v1";
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
        "PyHover can build a Python stdlib corpus once for richer built-in and keyword hovers. Clear Cache now keeps that corpus intact.",
        "Build Corpus",
        "Open PyHover",
      );

      if (action === "Build Corpus") {
        await vscode.commands.executeCommand("python-hover.buildPythonCorpus");
        return;
      }

      if (action === "Open PyHover") {
        await vscode.commands.executeCommand("python-hover.openStudio");
      }
    };

    setTimeout(() => {
      void maybeShowCorpusPrompt();
    }, 1200);
  } catch (e) {
    Logger.error("Failed to activate PyHover", e);
    vscode.window
      .showErrorMessage(
        "PyHover failed to activate. Check the output panel for details.",
        "Show Output",
      )
      .then((action) => {
        if (action === "Show Output") {
          Logger.show();
        }
      });
  }
}

export function deactivate() {
  Logger.dispose();
}

function buildImportStatementForDoc(doc: HoverDoc): string | undefined {
  return buildSharedImportStatement({
    title: doc.title,
    kind: doc.kind,
    module: doc.module,
    source: doc.source,
  });
}

function buildImportStatementForIndexedSymbol(
  symbol: IndexedSymbolSummary,
): string | undefined {
  return buildSharedImportStatement({
    title: symbol.name,
    kind: symbol.kind,
    module: symbol.module || symbol.package || symbol.name.split(".")[0],
    source: ResolutionSource.Corpus,
  });
}

/**
 * Check that a Python language extension is installed and active.
 * PyHover relies on the Language Server Protocol for symbol resolution;
 * without Pylance (or equivalent), hover quality degrades significantly.
 */
function checkPythonExtension(): void {
  const PYTHON_EXTENSIONS = [
    "ms-python.vscode-pylance",
    "ms-python.python",
    "ms-python.python-language-server",
  ];

  const active = PYTHON_EXTENSIONS.some((id) => {
    const ext = vscode.extensions.getExtension(id);
    return ext !== undefined;
  });

  if (!active) {
    vscode.window
      .showWarningMessage(
        "PyHover works best with the Python extension (Pylance). " +
          "Install it for accurate symbol resolution and richer documentation.",
        "Install Python Extension",
      )
      .then((action) => {
        if (action === "Install Python Extension") {
          vscode.commands.executeCommand(
            "workbench.extensions.search",
            "ms-python.vscode-pylance",
          );
        }
      });
  }
}
