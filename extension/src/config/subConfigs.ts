import { CustomLibraryConfig } from "#shared/types";
import { buildInterpreterCacheFingerprint, FingerprintCache, isDependencyManifestUri as isDependencyManifest } from "#src/config/workspaceFingerprint";
import { normalizeRegularHoverSectionOrder, REGULAR_HOVER_SECTION_ORDER, RegularHoverSectionId } from "#src/hover/hoverLayout";
import { Logger } from "../logger";
import * as vscode from "vscode";

// ─────────────────────────────────────────────────────────────────────────
// Sub-config: Core settings (extension enable, discovery, caching)
// ─────────────────────────────────────────────────────────────────────────

export class CoreConfig {
  constructor(private config: vscode.WorkspaceConfiguration) {}

  /** Swap in a freshly-obtained WorkspaceConfiguration snapshot. `vscode.WorkspaceConfiguration`
   *  is a point-in-time snapshot — a held handle never sees later writes, even from the
   *  extension's own `.update()` calls — so a live-reading Config needs this on every
   *  `onDidChangeConfiguration` firing. */
  refresh(section: vscode.WorkspaceConfiguration): void {
    this.config = section;
  }

  get isEnabled(): boolean {
    return this.config.get("enable", true);
  }

  get onlineDiscovery(): boolean {
    return this.config.get("onlineDiscovery", true);
  }

  get warmupImports(): boolean {
    return this.config.get("warmupImports", false);
  }

  get useKnownDocsUrls(): boolean {
    return this.config.get("useKnownDocsUrls", false);
  }

  get buildFullCorpus(): boolean {
    return this.config.get("buildFullCorpus", false);
  }

  get docsVersion(): string {
    return this.config.get("docsVersion", "auto");
  }

  get maxSnippetLines(): number {
    return this.config.get("maxSnippetLines", 12);
  }

  get inventoryCacheDays(): number {
    return this.config.get("cacheTTL.inventoryDays", 7);
  }

  get snippetCacheHours(): number {
    return this.config.get("cacheTTL.snippetHours", 48);
  }

  get keepCacheIndefinitely(): boolean {
    return this.config.get("cacheTTL.keepIndefinitely", false);
  }

  get requestTimeout(): number {
    const raw = this.config.get("requestTimeout", 10000);
    return Math.min(Math.max(raw, 1000), 60000);
  }

  get runtimeHelperEnabled(): boolean {
    return this.config.get("runtimeHelper", true);
  }

  get docScrapingEnabled(): boolean {
    return this.config.get("docScraping", false);
  }

  get astFallbackEnabled(): boolean {
    return this.config.get("astFallback", true);
  }

  get customLibraries(): CustomLibraryConfig[] {
    const raw = this.config.get<unknown[]>("customLibraries", []);
    return raw.flatMap((entry) => {
      if (!entry || typeof entry !== "object") {
        return [];
      }
      const candidate = entry as { name?: unknown; baseUrl?: unknown; inventoryUrl?: unknown };
      if (typeof candidate.name !== "string" || typeof candidate.baseUrl !== "string") {
        return [];
      }
      const name = candidate.name.trim();
      const baseUrl = candidate.baseUrl.trim();
      const inventoryUrl = typeof candidate.inventoryUrl === "string" ? candidate.inventoryUrl.trim() : undefined;
      if (!name || !baseUrl) {
        return [];
      }
      try {
        new URL(baseUrl);
        if (inventoryUrl) {
          new URL(inventoryUrl);
        }
      } catch {
        return [];
      }
      const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
      return [{ name, baseUrl: normalizedBaseUrl, inventoryUrl }];
    });
  }

  get enableDebugLogging(): boolean {
    return this.config.get("enableDebugLogging", false);
  }

  get revealOutputOnStartup(): boolean {
    return this.config.get("revealOutputOnStartup", false);
  }

  get revealOutputOnError(): boolean {
    return this.config.get("revealOutputOnError", false);
  }

  get telemetryEnabled(): boolean {
    return this.config.get("telemetry.enabled", false);
  }

  get preloadPackages(): string[] {
    return this.config.get<string[]>("preloadPackages", []).filter((p) => typeof p === "string" && p.trim().length > 0);
  }

  get excludePatterns(): string[] {
    return this.config.get<string[]>("excludePatterns", []);
  }

  get hoverActivationDelay(): number {
    return Math.min(Math.max(this.config.get("hoverActivationDelay", 0), 0), 2000);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Sub-config: UI / rendering settings
// ─────────────────────────────────────────────────────────────────────────

export class UiConfig {
  constructor(private config: vscode.WorkspaceConfiguration) {}

  refresh(section: vscode.WorkspaceConfiguration): void {
    this.config = section;
  }

  get showPracticalExamples(): boolean {
    const legacy = this.config.get<boolean | undefined>("showPracticalExamples", undefined);
    return this.config.get("ui.showPracticalExamples", legacy ?? true);
  }

  get docsBrowser(): "integrated" | "external" {
    return this.config.get("docsBrowser", "integrated");
  }

  get devdocsBrowser(): "integrated" | "external" {
    return this.config.get("devdocsBrowser", "integrated");
  }

  get showSignatures(): boolean {
    return this.config.get("ui.showSignatures", true);
  }

  get showReturnTypes(): boolean {
    return this.config.get("ui.showReturnTypes", true);
  }

  get showDebugPinButton(): boolean {
    return this.config.get("ui.showDebugPinButton", false);
  }

  get showStatusBar(): boolean {
    return this.config.get("ui.showStatusBar", true);
  }

  get contextMenuEnabled(): boolean {
    return this.config.get("ui.contextMenu.enabled", true);
  }

  get contextMenuSearchDocs(): boolean {
    return this.config.get("ui.contextMenu.searchDocs", true);
  }

  get contextMenuBrowseModule(): boolean {
    return this.config.get("ui.contextMenu.browseModule", true);
  }

  get contextMenuPinHover(): boolean {
    return this.config.get("ui.contextMenu.pinHover", true);
  }

  get contextMenuDebugPinHover(): boolean {
    return this.config.get("ui.contextMenu.debugPinHover", true);
  }

  get contextMenuOpenStudio(): boolean {
    return this.config.get("ui.contextMenu.openStudio", true);
  }

  get maxContentLength(): number {
    return this.config.get("ui.maxContentLength", 800);
  }

  get compactMode(): boolean {
    if (this.visualStyle === "minimal") return true;
    return this.config.get("ui.compactMode", false);
  }

  get showBadges(): boolean {
    return this.config.get("ui.showBadges", true);
  }

  get showMetadataChips(): boolean {
    return this.config.get("ui.showMetadataChips", true);
  }

  get showProvenance(): boolean {
    return this.config.get("ui.showProvenance", true);
  }

  get showToolbar(): boolean {
    return this.config.get("ui.showToolbar", true);
  }

  get showCallouts(): boolean {
    return this.config.get("ui.showCallouts", true);
  }

  get showDescription(): boolean {
    return this.config.get("ui.showDescription", true);
  }

  get showParameterLens(): boolean {
    return this.config.get("ui.showParameterLens", true);
  }

  get showNotes(): boolean {
    return this.config.get("ui.showNotes", true);
  }

  get showParameters(): boolean {
    return this.config.get("ui.showParameters", true);
  }

  get maxParameters(): number {
    const raw = this.config.get("ui.maxParameters", 6);
    return Math.min(Math.max(raw, 1), 20);
  }

  get showSeeAlso(): boolean {
    return this.config.get("ui.showSeeAlso", true);
  }

  get showRaises(): boolean {
    return this.config.get("ui.showRaises", true);
  }

  get showModuleExports(): boolean {
    return this.config.get("ui.showModuleExports", true);
  }

  get showModuleStats(): boolean {
    return this.config.get("ui.showModuleStats", true);
  }

  get showFooter(): boolean {
    return this.config.get("ui.showFooter", true);
  }

  get showImportHints(): boolean {
    return this.config.get("ui.showImportHints", true);
  }

  get hoverSectionOrder(): RegularHoverSectionId[] {
    const raw = this.config.get<unknown>("ui.hoverSectionOrder", [...REGULAR_HOVER_SECTION_ORDER]);
    return normalizeRegularHoverSectionOrder(raw);
  }

  get maxExamples(): number {
    const raw = this.config.get("ui.maxExamples", 2);
    return Math.min(Math.max(raw, 1), 10);
  }

  get maxModuleExports(): number {
    const raw = this.config.get("ui.maxModuleExports", 20);
    return Math.min(Math.max(raw, 1), 100);
  }

  get maxSeeAlsoItems(): number {
    const raw = this.config.get("ui.maxSeeAlsoItems", 8);
    return Math.min(Math.max(raw, 1), 30);
  }

  get showUpdateWarning(): boolean {
    return this.config.get("ui.showUpdateWarning", true);
  }

  get redirectIntegratedHoverToDocsPage(): boolean {
    return this.config.get("ui.redirectIntegratedHoverToDocsPage", false);
  }

  get autoOpenCurrentHoverInIntegratedDocs(): boolean {
    return this.config.get("ui.autoOpenCurrentHoverInIntegratedDocs", false);
  }

  get learnMode(): boolean {
    return this.config.get("ui.learnMode", false);
  }

  get visualStyle(): "minimal" | "expanded" {
    return this.config.get("ui.visualStyle", "expanded");
  }

  get showHoverErrorNotifications(): boolean {
    return this.config.get("ui.showHoverErrorNotifications", false);
  }

  get moduleBrowserDefaultView(): "hierarchy" | "flat" {
    return this.config.get("ui.moduleBrowser.defaultView", "flat");
  }

  get moduleBrowserDefaultSort(): "name" | "kind" | "package" {
    return this.config.get("ui.moduleBrowser.defaultSort", "name");
  }

  get moduleBrowserDefaultDensity(): "comfortable" | "compact" {
    return this.config.get("ui.moduleBrowser.defaultDensity", "comfortable");
  }

  get moduleBrowserShowPrivateSymbols(): boolean {
    return this.config.get("ui.moduleBrowser.showPrivateSymbols", false);
  }

  get moduleBrowserShowHierarchyHints(): boolean {
    return this.config.get("ui.moduleBrowser.showHierarchyHints", true);
  }

  get moduleBrowserAutoLoadPreviews(): boolean {
    return this.config.get("ui.moduleBrowser.autoLoadPreviews", true);
  }

  get moduleBrowserPreviewBatchSize(): number {
    const raw = this.config.get("ui.moduleBrowser.previewBatchSize", 18);
    return Math.min(Math.max(raw, 4), 50);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Sub-config: Diagnostics and Python settings
// ─────────────────────────────────────────────────────────────────────────

export class DiagnosticsConfig {
  constructor(private config: vscode.WorkspaceConfiguration) {}

  refresh(section: vscode.WorkspaceConfiguration): void {
    this.config = section;
  }

  get diagnosticsEnabled(): boolean {
    return this.config.get("diagnostics.enabled", true);
  }

  get pythonPath(): string {
    const pythonConfig = vscode.workspace.getConfiguration("python");
    const configured = pythonConfig.get<string>("defaultInterpreterPath") || pythonConfig.get<string>("pythonPath");
    if (configured && configured.trim().length > 0) {
      return configured;
    }
    const fallback = process.platform === "win32" ? "python" : "python3";
    Logger.debug(`Using fallback Python path: ${fallback}`);
    return fallback;
  }

  /** Build a stable cache key from the Python path and workspace fingerprint. */
  buildInterpreterCacheFingerprint(fingerprintCache: FingerprintCache): string {
    return buildInterpreterCacheFingerprint(this.pythonPath, fingerprintCache);
  }

  isDependencyManifestUri(uri: vscode.Uri): boolean {
    return isDependencyManifest(uri);
  }
}
