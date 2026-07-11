import { DiskCache } from "#docs-engine/cache/diskCache";
import { setEngineLogger } from "#docs-engine/engineLogger";
import {
  HoverDoc,
  IndexedSymbolSummary,
  ResolutionSource,
  SavedDocEntry,
} from "#shared/types";
import { registerHistoryAndLinkCommands } from "#src/commands/registerHistoryAndLinkCommands";
import { registerModuleBrowseCommands } from "#src/commands/registerModuleBrowseCommands";
import { registerPrimaryCommands } from "#src/commands/registerPrimaryCommands";
import { registerRuntimeCommands } from "#src/commands/registerRuntimeCommands";
import { registerSavedAndPanelCommands } from "#src/commands/registerSavedAndPanelCommands";
import { Config } from "#src/config";
import { updateSettingWithPreferredTarget } from "#src/configTarget";
import { LspClient } from "#src/core/lspClient";
import {
  ALLOWED_MODULE_BROWSER_COMMANDS,
  ALLOWED_MODULE_BROWSER_SETTING_KEYS,
  ALLOWED_STUDIO_COMMANDS,
  ALLOWED_STUDIO_SETTING_KEYS,
  allowedSettingsQuery,
} from "#src/core/studioGuards";
import { createDocsRouting } from "#src/fetch/docsRouting";
import {
  normalizeRegularHoverSectionOrder,
  RegularHoverSectionId,
} from "#src/hover/hoverLayout";
import { HoverProvider } from "#src/hover/hoverProvider";
import { Logger } from "#src/logger";
import { createLibraryState } from "#src/state/libraryState";
import {
  buildSavedDocEntry,
  MAX_SAVED_DOCS,
  normalizeSavedDocEntry,
} from "#src/state/savedDocs";
import {
  applyStudioPreset as applyStudioPresetEntries,
  buildStudioState,
} from "#src/state/studioState";
import { TelemetryState } from "#src/state/telemetryState";
import { applyContextMenuContexts } from "#src/ui/context/contextMenu";
import { DocsPanel } from "#src/ui/panels/docsPanel";
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
import {
  openHoverDocSource,
  openIndexedSymbolSource,
  openSourceTarget,
} from "#src/utils/doc-navigation";
import * as vscode from "vscode";

/**
 * Minimal public API surface, reachable via
 * `vscode.extensions.getExtension<PythonHoverApi>("kiidxatlas.python-hover")?.exports`.
 * Exists for diagnostic/test tooling (see extension/src/test-integration/hoverSuite.ts)
 * that needs the structured HoverDoc PyHover actually resolved — not just the rendered
 * markdown a generic `vscode.executeHoverProvider` call returns.
 */
export interface PythonHoverApi {
  getLastResolvedDoc: () => HoverDoc | null;
}

export function activate(context: vscode.ExtensionContext): PythonHoverApi | undefined {
  Logger.initialize("PyHover");
  setEngineLogger({
    log: Logger.log.bind(Logger),
    debug: Logger.debug.bind(Logger),
    error: Logger.error.bind(Logger),
  });
  Logger.log("PyHover is now active!");

  try {
    const config = new Config(vscode.workspace.getConfiguration("python-hover"));
    Logger.setDebugEnabled(config.enableDebugLogging);
    Logger.setRevealOnError(config.revealOutputOnError);
    if (config.revealOutputOnStartup) {
      Logger.show();
    }
    const lspClient = new LspClient();
    const statusBarManager = new StatusBarManager(context);
    const telemetryState = new TelemetryState(context.globalState);
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
      config.autoOpenCurrentHoverInIntegratedDocs || config.learnModeEnabled;
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
        const latestDoc = hoverProvider.getLastDoc();
        if (config.telemetryEnabled && latestDoc) {
          telemetryState.recordHover(latestDoc);
        }
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
      // Wire error reporting to status bar — surfaces resolution failures to users.
      hoverProvider.setOnErrorCallback((message) => {
        statusBarManager.setLastError(message);
      });
      // Wire loading-state reporting to status bar — surfaces genuinely slow
      // network/IPC hovers with a "Resolving…" indicator.
      hoverProvider.setOnLoadingStateCallback((state) => {
        statusBarManager.setLoadingState(state);
      });
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
    // If the user grants workspace trust later in the same session, rebuild so the
    // Python runtime helper (gated on isTrusted in PythonHelper's constructor) turns
    // on without requiring a window reload.
    context.subscriptions.push(
      vscode.workspace.onDidGrantWorkspaceTrust(() => {
        rebuildHoverRuntime("Workspace trust granted — re-enabling Python runtime helper.", false);
      }),
    );
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
      vscode.workspace.onDidSaveTextDocument((document) => {
        if (config.isDependencyManifestUri(document.uri)) {
          hoverProvider.clearSessionCache();
          rebuildHoverRuntime(
            "Dependency manifests changed. Recreating disk cache bucket.",
            true,
          );
          warmupImportsForDocument(vscode.window.activeTextEditor?.document);
          warmupConfiguredPackages();
          updateStudio();
          return;
        }
        // Only clear document-scoped caches for normal file saves to keep global
        // caches (hover results, installed versions) intact for better UX.
        hoverProvider.clearDocumentSessionCache(document);
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

        if (affectsPythonHover) {
          // `config` is held by reference for the extension's lifetime (passed into
          // HoverProvider/HoverRenderer/StatusBarManager once at construction) — its
          // underlying WorkspaceConfiguration snapshot must be refreshed here or every
          // setting change below reads stale pre-change values, silently no-op-ing
          // Studio's toggles/reordering until a full window reload.
          config.refresh();
        }

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
          // This is the fallback bucket for any python-hover.* setting that isn't
          // (yet) listed in one of the specific groups above — most likely a newly
          // added setting the classification cascade hasn't been updated for. A full
          // rebuild is the safe default here: a session-cache clear alone would
          // under-react if the new setting actually needed provider-level changes,
          // and a full rebuild is a superset of what a plain cache clear achieves.
          rebuildHoverRuntime(
            "Configuration changed (unclassified python-hover setting). Recreating hover provider as a safe default.",
            false,
          );
        }

        if (affectsPythonHover) {
          liveRedirectIntegratedHoverToDocsPage =
            config.redirectIntegratedHoverToDocsPage;
          liveAutoOpenCurrentHoverInIntegratedDocs =
            config.autoOpenCurrentHoverInIntegratedDocs ||
            config.learnModeEnabled;
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

    registerPrimaryCommands(context, {
      hoverProvider,
      statusBarManager,
      buildImportStatementForDoc,
    });

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
              if (!ALLOWED_MODULE_BROWSER_COMMANDS.has(message.command)) {
                Logger.debug(
                  "Ignored unsupported module browser command",
                  message.command,
                );
                break;
              }
              if (message.arg !== undefined) {
                await vscode.commands.executeCommand(message.command, message.arg);
              } else {
                await vscode.commands.executeCommand(message.command);
              }
              break;
            case "open-settings":
              await vscode.commands.executeCommand(
                "workbench.action.openSettings",
                allowedSettingsQuery(
                  message.query,
                  "python-hover.ui.moduleBrowser",
                ),
              );
              break;
            case "update-setting":
              if (!ALLOWED_MODULE_BROWSER_SETTING_KEYS.has(message.key)) {
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
            reportPanelActionError(message.type, error);
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
    registerRuntimeCommands({
      context,
      config,
      hoverProvider,
      telemetryState,
      docsPanelShow: (url) => docsPanel.show(url),
      docsBrowserMode: () => config.docsBrowser,
      getSavedDocs,
      getRecentPackageSummaries,
      rememberRecentPackage,
      openConfiguredLink,
      updateSetting: (setting, value) =>
        updateSettingWithPreferredTarget("python-hover", setting, value),
      getLearnModeEnabled: () => config.learnModeEnabled,
      diskCache,
      activeCorpusBuild: () => activeCorpusBuild,
      setActiveCorpusBuild: (value) => {
        activeCorpusBuild = value;
      },
      updateStudio,
      statusBarUpdate: () => statusBarManager.update(),
      refreshAfterCacheMutation,
    });
    const reportSettingUpdateError = (key: string, error: unknown) => {
      Logger.error(`Failed to update setting ${key}`, error);
      void vscode.window.showErrorMessage(
        `PyHover could not update ${key}. Check the PyHover output channel for details.`,
      );
    };
    // Generic fallback for panel message-handler failures that aren't a setting update
    // (open-doc, pin-symbol, run-command, etc.) — these used to only Logger.error, so a
    // user clicking e.g. "Pin symbol" and hitting a failure got no visible feedback at all.
    const reportPanelActionError = (actionType: string, error: unknown) => {
      Logger.error(`Panel action "${actionType}" failed`, error);
      void vscode.window.showErrorMessage(
        `PyHover: the "${actionType}" action failed. Check the PyHover output channel for details.`,
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
          Logger.log(`Studio message received: ${JSON.stringify(message)}`);
          switch (message.type) {
            case "run-command":
              if (!ALLOWED_STUDIO_COMMANDS.has(message.command)) {
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
                allowedSettingsQuery(message.query, "python-hover"),
              );
              break;
            case "update-setting":
              if (!ALLOWED_STUDIO_SETTING_KEYS.has(message.key)) {
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
            reportPanelActionError(message.type, error);
          }
        } finally {
          updateStudio();
        }
      },
    );
    context.subscriptions.push({ dispose: () => docsPanel.dispose() });
    context.subscriptions.push({ dispose: () => moduleBrowserPanel.dispose() });
    context.subscriptions.push({ dispose: () => studioPanel.dispose() });

    registerSavedAndPanelCommands(context, {
      hoverProvider,
      hoverInspectorView,
      toggleSavedDoc,
      removeSavedDoc,
      normalizeSavedDocEntry,
      openConfiguredLink,
      openSourceTarget,
      refreshStudio,
      showLogs: () => Logger.show(),
    });

    registerHistoryAndLinkCommands(context, {
      hoverProvider,
      hoverInspectorView,
      openConfiguredLink,
      openIntegratedDocs,
      parseDocLinkPayload,
      parsePreferredDocsPayload,
      openHoverDocSource,
      openSourceTarget,
      openIndexedSymbolSource,
      liveRedirectIntegratedHoverToDocsPage: () =>
        liveRedirectIntegratedHoverToDocsPage,
      docsBrowserMode: () => config.docsBrowser,
    });

    registerModuleBrowseCommands(context, {
      hoverProvider,
      moduleBrowserPanel,
      buildModuleBrowserSettings,
      configOnlineDiscovery: () => config.onlineDiscovery,
      getRecentPackages,
      rememberRecentPackage,
    });

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

    // `hoverProvider` is captured by reference here, not by value — it keeps pointing
    // at whatever the current instance is even after registerHoverProvider() replaces
    // it on a config change, since this arrow function closes over the outer `let`.
    return { getLastResolvedDoc: () => hoverProvider.getLastDoc() };
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
