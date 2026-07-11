import { CustomLibraryConfig } from "#shared/types";
import { buildInterpreterCacheFingerprint, FingerprintCache, isDependencyManifestUri as isDependencyManifest } from "#src/config/workspaceFingerprint";
import * as vscode from "vscode";
import { CoreConfig, UiConfig, DiagnosticsConfig } from "./subConfigs";

// Re-export sub-configs for consumers that may import them directly.
export { CoreConfig, UiConfig, DiagnosticsConfig } from "./subConfigs";

/**
 * Unified Config facade — delegates to sub-configs for logical grouping.
 * This replaces the previous god-object with 45+ getters with a clean,
 * testable facade that exposes CoreConfig, UiConfig, and DiagnosticsConfig.
 */
export class Config {
  private readonly core: CoreConfig;
  private readonly ui: UiConfig;
  private readonly diagnostics: DiagnosticsConfig;
  private _fingerprintCache: FingerprintCache = {};

  constructor(private readonly config: vscode.WorkspaceConfiguration) {
    this.core = new CoreConfig(config);
    this.ui = new UiConfig(config);
    this.diagnostics = new DiagnosticsConfig(config);
  }

  /** Re-point every sub-config at a freshly-obtained WorkspaceConfiguration snapshot.
   *  `vscode.workspace.getConfiguration(...)` returns a point-in-time snapshot — a
   *  previously-obtained handle never observes later writes, including the extension's
   *  own settings updates (verified directly: reading the same handle after `.update()`
   *  still returns the old value; only a fresh `getConfiguration()` call sees the new
   *  one). Since `Config`/`HoverRenderer`/`HoverProvider` are constructed once and held
   *  by reference for the extension's lifetime, without this every setting change made
   *  from PyHover Studio (or Settings UI) would be silently ignored until a full window
   *  reload. Call this from the `onDidChangeConfiguration` handler before any other
   *  reaction to a `python-hover.*` change. */
  refresh(): void {
    const fresh = vscode.workspace.getConfiguration("python-hover");
    this.core.refresh(fresh);
    this.ui.refresh(fresh);
    this.diagnostics.refresh(fresh);
  }

  // ── Core Config delegation (extension, discovery, caching) ───────────
  get isEnabled(): boolean { return this.core.isEnabled; }
  get onlineDiscovery(): boolean { return this.core.onlineDiscovery; }
  get warmupImports(): boolean { return this.core.warmupImports; }
  get useKnownDocsUrls(): boolean { return this.core.useKnownDocsUrls; }
  get buildFullCorpus(): boolean { return this.core.buildFullCorpus; }
  get docsVersion(): string { return this.core.docsVersion; }
  get maxSnippetLines(): number { return this.core.maxSnippetLines; }
  get inventoryCacheDays(): number { return this.core.inventoryCacheDays; }
  get snippetCacheHours(): number { return this.core.snippetCacheHours; }
  get requestTimeout(): number { return this.core.requestTimeout; }
  get runtimeHelperEnabled(): boolean { return this.core.runtimeHelperEnabled; }
  get docScrapingEnabled(): boolean { return this.core.docScrapingEnabled; }
  get astFallbackEnabled(): boolean { return this.core.astFallbackEnabled; }
  get customLibraries(): CustomLibraryConfig[] { return this.core.customLibraries; }
  get enableDebugLogging(): boolean { return this.core.enableDebugLogging; }
  get revealOutputOnStartup(): boolean { return this.core.revealOutputOnStartup; }
  get revealOutputOnError(): boolean { return this.core.revealOutputOnError; }
  get telemetryEnabled(): boolean { return this.core.telemetryEnabled; }
  get preloadPackages(): string[] { return this.core.preloadPackages; }
  get excludePatterns(): string[] { return this.core.excludePatterns; }
  get hoverActivationDelay(): number { return this.core.hoverActivationDelay; }

  // ── Ui Config delegation (rendering, display, interaction) ───────────
  get showPracticalExamples(): boolean { return this.ui.showPracticalExamples; }
  get docsBrowser(): "integrated" | "external" { return this.ui.docsBrowser; }
  get devdocsBrowser(): "integrated" | "external" { return this.ui.devdocsBrowser; }
  get showSignatures(): boolean { return this.ui.showSignatures; }
  get showReturnTypes(): boolean { return this.ui.showReturnTypes; }
  get showDebugPinButton(): boolean { return this.ui.showDebugPinButton; }
  get showStatusBar(): boolean { return this.ui.showStatusBar; }
  get showEditorContextMenu(): boolean { return this.ui.contextMenuEnabled; }
  get showSearchDocsContextMenu(): boolean { return this.ui.contextMenuSearchDocs; }
  get showBrowseModuleContextMenu(): boolean { return this.ui.contextMenuBrowseModule; }
  get showPinHoverContextMenu(): boolean { return this.ui.contextMenuPinHover; }
  get showDebugPinHoverContextMenu(): boolean { return this.ui.contextMenuDebugPinHover; }
  get showOpenStudioContextMenu(): boolean { return this.ui.contextMenuOpenStudio; }
  get maxContentLength(): number { return this.ui.maxContentLength; }
  get compactMode(): boolean { return this.ui.compactMode; }
  get showBadges(): boolean { return this.ui.showBadges; }
  get showMetadataChips(): boolean { return this.ui.showMetadataChips; }
  get showProvenance(): boolean { return this.ui.showProvenance; }
  get showToolbar(): boolean { return this.ui.showToolbar; }
  get showCallouts(): boolean { return this.ui.showCallouts; }
  get showDescription(): boolean { return this.ui.showDescription; }
  get showParameterLens(): boolean { return this.ui.showParameterLens; }
  get showNotes(): boolean { return this.ui.showNotes; }
  get showParameters(): boolean { return this.ui.showParameters; }
  get maxParameters(): number { return this.ui.maxParameters; }
  get showSeeAlso(): boolean { return this.ui.showSeeAlso; }
  get showRaises(): boolean { return this.ui.showRaises; }
  get showModuleExports(): boolean { return this.ui.showModuleExports; }
  get showModuleStats(): boolean { return this.ui.showModuleStats; }
  get showFooter(): boolean { return this.ui.showFooter; }
  get showImportHints(): boolean { return this.ui.showImportHints; }
  get hoverSectionOrder() { return this.ui.hoverSectionOrder; }
  get maxExamples(): number { return this.ui.maxExamples; }
  get maxModuleExports(): number { return this.ui.maxModuleExports; }
  get maxSeeAlsoItems(): number { return this.ui.maxSeeAlsoItems; }
  get showUpdateWarning(): boolean { return this.ui.showUpdateWarning; }
  get redirectIntegratedHoverToDocsPage(): boolean { return this.ui.redirectIntegratedHoverToDocsPage; }
  get autoOpenCurrentHoverInIntegratedDocs(): boolean { return this.ui.autoOpenCurrentHoverInIntegratedDocs; }
  get learnModeEnabled(): boolean { return this.ui.learnMode; }
  get hoverVisualStyle(): "minimal" | "expanded" { return this.ui.visualStyle; }
  get showHoverErrorNotifications(): boolean { return this.ui.showHoverErrorNotifications; }
  get moduleBrowserDefaultView() { return this.ui.moduleBrowserDefaultView; }
  get moduleBrowserDefaultSort() { return this.ui.moduleBrowserDefaultSort; }
  get moduleBrowserDefaultDensity() { return this.ui.moduleBrowserDefaultDensity; }
  get moduleBrowserShowPrivateSymbols(): boolean { return this.ui.moduleBrowserShowPrivateSymbols; }
  get moduleBrowserShowHierarchyHints(): boolean { return this.ui.moduleBrowserShowHierarchyHints; }
  get moduleBrowserAutoLoadPreviews(): boolean { return this.ui.moduleBrowserAutoLoadPreviews; }
  get moduleBrowserPreviewBatchSize(): number { return this.ui.moduleBrowserPreviewBatchSize; }

  // ── Diagnostics Config delegation (Python, diagnostics) ───────────────
  get pythonPath(): string { return this.diagnostics.pythonPath; }
  get diagnosticsEnabled(): boolean { return this.diagnostics.diagnosticsEnabled; }

  /** Stable id for cache keys — ties disk + session caches to interpreter path and workspace. */
  get interpreterCacheFingerprint(): string {
    return this.diagnostics.buildInterpreterCacheFingerprint(this._fingerprintCache);
  }

  isDependencyManifestUri(uri: vscode.Uri): boolean {
    return this.diagnostics.isDependencyManifestUri(uri);
  }

  /** Access the sub-configs directly for advanced usage. */
  get coreConfig() { return this.core; }
  get uiConfig() { return this.ui; }
  get diagnosticsConfig() { return this.diagnostics; }
}

/** Convenience: access the vscode workspace configuration directly. */
function getVscodeConfig(section = "python-hover"): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration(section);
}
