import { PYHOVER_CACHE_DIR_NAME } from "#docs-engine/cache/diskCache";
import { HoverHistoryEntry, SavedDocEntry } from "#shared/types";
import { updateSettingWithPreferredTarget } from "#src/configTarget";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

type StatusBarDataAccessors = {
  getHoverHistory?: () => HoverHistoryEntry[];
  getIndexedSymbolCount?: () => number;
  getLastHoverTitle?: () => string | undefined;
  getRecentPackages?: () => Array<{ name: string; count: number }>;
  getSavedDocs?: () => SavedDocEntry[];
};

export class StatusBarManager {
  private item: vscode.StatusBarItem;
  private context: vscode.ExtensionContext;
  private dataAccessors: StatusBarDataAccessors = {};

  /** Cached cache-size string so render() never blocks on repeated dir-walks. */
  private cacheSizeLabel = "…";
  private cacheSizeExpiry = 0;
  /** Whether an async walk is currently in flight (prevents parallel redundant walks). */
  private cacheSizeWalking = false;
  /** Cached extension version — read once from package.json. */
  private cachedVersion: string | undefined;
  /** Active loading state — shows a spinner while async operations are in flight. */
  private _loadingState: string | undefined;
  /** Last error message — shown when resolution fails, so users get feedback. */
  private _lastError: string | undefined;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );
    this.item.command = "python-hover.showStatusNotification";
    this.context.subscriptions.push(this.item);
    this.render();

    this.context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("python-hover")) {
          this.render();
        }
      }),
    );
  }

  /** Set the loading state (shows a spinner in the status bar). */
  public setLoadingState(state: string | undefined): void {
    this._loadingState = state;
    this.render();
  }

  /** Set the last error message (shows an error indicator in the status bar). */
  public setLastError(message: string | undefined): void {
    this._lastError = message;
    this.render();
  }

  /** Force a re-render (e.g. after cache wipe). */
  public update() {
    this.cacheSizeExpiry = 0;
    this.render();
  }

  public setDataAccessors(accessors: StatusBarDataAccessors) {
    this.dataAccessors = accessors;
    this.render();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  private render() {
    const cfg = vscode.workspace.getConfiguration("python-hover");
    const showStatusBar = cfg.get<boolean>("ui.showStatusBar", true);
    const online = cfg.get<boolean>("onlineDiscovery", true);
    const version = this.getVersion();
    const cacheSize = this.getCacheSizeInMB();
    const indexedSymbols = this.dataAccessors.getIndexedSymbolCount?.();
    const lastHoverTitle = this.dataAccessors.getLastHoverTitle?.();
    const historyPreview = this.buildHistoryPreview(
      this.dataAccessors.getHoverHistory?.() ?? [],
    );

    if (!showStatusBar) {
      this.item.hide();
      return;
    }

    // Build a truncated status bar text that fits narrow windows.
    // Priority: online icon + "PyHover" + cacheSize + (error if any) + (loading spinner if any).
    // History preview is dropped when space is tight.
    const statusParts: string[] = [];
    statusParts.push(online ? "$(globe)" : "$(circle-slash)");
    statusParts.push("PyHover");
    statusParts.push(cacheSize);

    // Show error in status bar text — gives users immediate feedback.
    if (this._lastError) {
      const truncatedError = this.truncateString(this._lastError, 30);
      statusParts.push(`$(error) ${truncatedError}`);
    }

    if (this._loadingState) {
      statusParts.push(`$(sync-spin)`);
      statusParts.push(this.truncateString(this._loadingState, 25));
    } else if (historyPreview) {
      statusParts.push("·");
      statusParts.push(this.truncateString(historyPreview, 35));
    }

    this.item.text = statusParts.join(" ");

    // Build tooltip with full details.
    const mode = online ? "$(globe) Online" : "$(circle-slash) Offline";
    const tt = new vscode.MarkdownString();
    tt.appendMarkdown(`**PyHover** v${version}\n\n`);

    // Show error prominently in tooltip, with a direct path to settings —
    // many resolution errors trace back to a misconfigured interpreter path.
    if (this._lastError) {
      tt.appendMarkdown(`> **Error:** ${this._lastError}\n\n`);
      tt.appendMarkdown(
        `> [$(gear) Open Settings](command:workbench.action.openSettings?${encodeURIComponent(JSON.stringify("python-hover"))} "Open Python Hover settings")\n\n`,
      );
    }

    if (this._loadingState) {
      tt.appendMarkdown(`**Loading:** ${this._loadingState}\n\n`);
    }

    // Cache info with human-readable description.
    const cacheDesc = cacheSize === "0 MB"
      ? "Cache: none (fresh install)"
      : `Cache: ${cacheSize} (fetched docs & inventories)`;
    tt.appendMarkdown(
      `${mode}  ·  ${cacheDesc}${typeof indexedSymbols === "number" ? `  ·  $(symbol-key) ${indexedSymbols.toLocaleString()} indexed` : ""}\n\n`,
    );
    // Direct cache actions — no need to open the full quick-pick menu just to clear the cache.
    tt.appendMarkdown(
      `[$(trash) Clear cache](command:python-hover.clearCache "Clear documentation cache") &nbsp;·&nbsp; [$(folder-opened) Open cache folder](command:python-hover.openCacheFolder "Open the PyHover cache folder")\n\n`,
    );

    if (lastHoverTitle) {
      tt.appendText("Last hover: ");
      tt.appendMarkdown("**");
      tt.appendText(lastHoverTitle);
      tt.appendMarkdown("**\n\n");
    }
    if (historyPreview) {
      tt.appendMarkdown(`History: ${historyPreview}\n\n`);
    }
    tt.appendText(
      "Click for quick actions: search docs, browse modules, hover history, cache tools, and Studio.",
    );
    tt.supportThemeIcons = true;
    // Only these two hardcoded command links may execute — scoped trust, not blanket isTrusted,
    // since other fields in this tooltip (error message, hover title) come from resolved content.
    tt.isTrusted = {
      enabledCommands: [
        "python-hover.clearCache",
        "python-hover.openCacheFolder",
        "workbench.action.openSettings",
      ],
    };
    this.item.tooltip = tt;

    // Color coding: error > offline > warning > normal.
    if (this._lastError) {
      this.item.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.errorBackground",
      );
    } else if (!online) {
      this.item.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.warningBackground",
      );
    } else {
      this.item.backgroundColor = undefined;
    }

    this.item.show();
  }

  /** Truncate a string to max length, adding ellipsis if truncated. */
  private truncateString(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 1) + "…";
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MENU
  // ─────────────────────────────────────────────────────────────────────────

  public async showStatusNotification(): Promise<void> {
    type StatusAction = vscode.QuickPickItem & {
      command?: string;
      run?: () => Thenable<unknown> | Promise<void> | void;
    };
    const cfg = vscode.workspace.getConfiguration("python-hover");
    const online = cfg.get<boolean>("onlineDiscovery", true);
    const cacheSize = this.getCacheSizeInMB();
    const recentPackages =
      this.dataAccessors.getRecentPackages?.().slice(0, 5) ?? [];
    const recentHistory = (this.dataAccessors.getHoverHistory?.() ?? [])
      .filter((entry) => !!entry.url)
      .slice(0, 4);
    const savedDocs = this.dataAccessors.getSavedDocs?.().slice(0, 4) ?? [];
    const lastHoverTitle = this.dataAccessors.getLastHoverTitle?.();
    const formatKind = (kind?: string) =>
      kind
        ? `${kind.charAt(0).toUpperCase()}${kind.slice(1).toLowerCase()}`
        : undefined;
    const meta = (...parts: Array<string | undefined>) =>
      parts.filter(Boolean).join(" • ");

    const items: StatusAction[] = [];

    // ── Session Section ───────────────────────────────────────────────
    items.push({ label: "Session", kind: vscode.QuickPickItemKind.Separator });

    // Online toggle
    items.push({
      label: online
        ? "$(globe) Online docs enabled"
        : "$(circle-slash) Online docs disabled",
      description: `Cache ${cacheSize}`,
      detail: online
        ? "Web docs lookup, inventories, and scraping are available."
        : "Only cached docs and local/runtime sources will be used.",
      command: "python-hover.toggleOnlineDiscovery",
    });

    // Last hover (if available)
    if (lastHoverTitle) {
      items.push({
        label: "$(pin) Re-pin last hover",
        description: lastHoverTitle,
        detail: "Re-pin the latest hover into the inspector or docs panel.",
        command: "python-hover.pinLast",
      });
    }

    // ── Studio & Settings (combined — removed redundant "Open settings") ──
    items.push({ label: "Studio", kind: vscode.QuickPickItemKind.Separator });
    items.push({
      label: "$(layout) Open PyHover Studio",
      description: "Settings, cache controls, and product-level tuning",
      detail: "Keyboard shortcut: Ctrl+Shift+P → 'PyHover: Open Studio'",
      command: "python-hover.openStudio",
    });

    // ── Explore Section ───────────────────────────────────────────────
    items.push({ label: "Explore", kind: vscode.QuickPickItemKind.Separator });
    items.push({
      label: "$(search) Search Python docs",
      description: "Indexed symbol search",
      detail: "Search known docs targets, saved docs, recent items.",
      command: "python-hover.searchDocs",
    });
    items.push({
      label: "$(search-fuzzy) Find method across libraries",
      description: "Semantic-style command palette search",
      detail: "Quickly discover APIs like pandas.concat or numpy.concatenate.",
      command: "python-hover.findMethod",
    });
    items.push({
      label: "$(symbol-namespace) Browse indexed modules",
      description: "Browse packages and modules",
      detail: "Open the module picker across standard library and third-party indexes.",
      command: "python-hover.browseModule",
    });

    // ── History & Saved Section ───────────────────────────────────────
    items.push({ label: "History", kind: vscode.QuickPickItemKind.Separator });
    items.push({
      label: "$(history) Hover history",
      description: "Recent symbols you hovered",
      detail: "Grouped into live session entries and stored docs links.",
      command: "python-hover.showHistory",
    });

    if (recentPackages.length > 0) {
      items.push({
        label: "Recent Packages",
        kind: vscode.QuickPickItemKind.Separator,
      });
      for (const pkg of recentPackages) {
        items.push({
          label: `$(symbol-namespace) ${pkg.name}`,
          description: `${pkg.count.toLocaleString()} indexed symbols`,
          detail: "Open this package in the module browser.",
          run: () =>
            vscode.commands.executeCommand("python-hover.browseModule", pkg.name),
        });
      }
    }

    if (recentHistory.length > 0) {
      items.push({
        label: "Recent Docs",
        kind: vscode.QuickPickItemKind.Separator,
      });
      for (const entry of recentHistory) {
        items.push({
          label: `${entry.commandToken ? "$(history)" : "$(link-external)"} ${entry.title}`,
          description: meta(formatKind(entry.kind), entry.module ?? entry.package),
          detail: entry.commandToken
            ? "Live session entry. Reopen in the inspector if still available."
            : "Stored docs link. Open the last known documentation target.",
          run: () =>
            vscode.commands.executeCommand(
              "python-hover.openSidebarHistoryEntry",
              entry,
            ),
        });
      }
    }

    if (savedDocs.length > 0) {
      items.push({
        label: "Saved Docs",
        kind: vscode.QuickPickItemKind.Separator,
      });
      for (const entry of savedDocs) {
        items.push({
          label: `$(bookmark) ${entry.title}`,
          description: meta(formatKind(entry.kind), entry.module ?? entry.package),
          detail: entry.summary || "Saved reading-list target.",
          run: () =>
            vscode.commands.executeCommand(
              "python-hover.openSavedHoverEntry",
              entry,
            ),
        });
      }
    }

    // ── Maintenance Section ───────────────────────────────────────────
    items.push({ label: "Maintenance", kind: vscode.QuickPickItemKind.Separator });
    items.push({
      label: "$(book) Build Python corpus",
      description: "Fetch richer built-in and keyword docs",
      detail: "Populate the stdlib corpus for better offline hover coverage.",
      command: "python-hover.buildPythonCorpus",
    });
    items.push({
      label: "$(trash) Clear documentation cache",
      description: "Clear fetched docs and inventories",
      detail: "Keeps the Python stdlib corpus intact.",
      command: "python-hover.clearCache",
    });
    items.push({
      label: "$(folder-opened) View cache folder",
      description: `${cacheSize}`,
      detail: "Open the PyHover cache folder in Finder.",
      command: "python-hover.openCacheFolder",
    });
    items.push({
      label: "$(output) Show logs",
      description: "Inspect resolver and cache output",
      detail: "Open the PyHover output channel.",
      command: "python-hover.showLogs",
    });

    const picked = await vscode.window.showQuickPick(items, {
      title: "PyHover Command Center",
      placeHolder: "Type to search across all actions…",
      matchOnDescription: true,
      matchOnDetail: true,
    });

    if (!picked?.command) {
      if (picked?.run) {
        await picked.run();
      }
      return;
    }

    if (picked.command === "workbench.action.openSettings") {
      await vscode.commands.executeCommand(picked.command, "python-hover");
      return;
    }

    await vscode.commands.executeCommand(picked.command);
  }

  public async toggleOnlineDiscovery(): Promise<void> {
    const cfg = vscode.workspace.getConfiguration("python-hover");
    const cur = cfg.get<boolean>("onlineDiscovery", true);
    await updateSettingWithPreferredTarget(
      "python-hover",
      "onlineDiscovery",
      !cur,
    );
    vscode.window.showInformationMessage(
      `PyHover: online discovery ${!cur ? "enabled" : "disabled"}`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  private getVersion(): string {
    if (this.cachedVersion !== undefined) {
      return this.cachedVersion;
    }
    try {
      const pkg = JSON.parse(
        fs.readFileSync(
          path.join(this.context.extensionPath, "package.json"),
          "utf8",
        ),
      );
      this.cachedVersion = pkg.version as string;
    } catch {
      this.cachedVersion = "?";
    }
    return this.cachedVersion!;
  }

  private buildHistoryPreview(entries: HoverHistoryEntry[]): string {
    if (!entries.length) {
      return "";
    }

    const names = entries
      .slice(0, 3)
      .map((entry) => entry.title.replace(/^builtins\./, ""));
    const extra = entries.length - names.length;
    return extra > 0 ? `${names.join(", ")} +${extra}` : names.join(", ");
  }

  /**
   * Returns the cached cache-size label immediately (never blocks).
   * Kicks off an async walk in the background if the TTL has expired.
   * render() is called again once the walk completes so the UI updates.
   */
  private getCacheSizeInMB(): string {
    const now = Date.now();
    if (now < this.cacheSizeExpiry) {
      return this.cacheSizeLabel;
    }
    if (this.cacheSizeWalking) {
      return this.cacheSizeLabel;
    }

    this.cacheSizeWalking = true;
    const p = this.getCachePath();
    this.computeCacheSizeAsync(p)
      .then((label) => {
        this.cacheSizeLabel = label;
        this.cacheSizeExpiry = Date.now() + 10_000;
        this.cacheSizeWalking = false;
        this.render();
      })
      .catch(() => {
        this.cacheSizeWalking = false;
      });

    return this.cacheSizeLabel;
  }

  private async computeCacheSizeAsync(dir: string): Promise<string> {
    try {
      await fs.promises.access(dir);
    } catch {
      return "0 MB";
    }
    const total = await this.walkDirAsync(dir);
    return `${(total / 1_048_576).toFixed(1)} MB`;
  }

  private async walkDirAsync(dir: string): Promise<number> {
    let total = 0;
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      await Promise.all(
        entries.map(async (entry) => {
          const fp = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            total += await this.walkDirAsync(fp);
          } else {
            try {
              const st = await fs.promises.stat(fp);
              total += st.size;
            } catch {
              /* ignore */
            }
          }
        }),
      );
    } catch {
      /* ignore */
    }
    return total;
  }

  private getCachePath(): string {
    return path.join(
      this.context.globalStorageUri.fsPath,
      PYHOVER_CACHE_DIR_NAME,
    );
  }
}
