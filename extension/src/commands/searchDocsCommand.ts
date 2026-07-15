import {
  HoverHistoryEntry,
  IndexedSymbolSummary,
  SavedDocEntry,
} from "#shared/types";
import {
  buildSearchResultDescription,
  buildSearchResultDetail,
  formatSymbolKindLabel,
  iconForSymbolKind,
} from "#src/ui/browser/searchPresentation";
import * as vscode from "vscode";

type SearchDocsCommandDeps = {
  hoverProvider: {
    hydrateCachedInventories: () => Promise<string[]>;
    getIndexedSymbolCount: () => number;
    searchDocs: (query: string) => IndexedSymbolSummary[];
    getHoverHistory: () => HoverHistoryEntry[];
  };
  getSavedDocs: () => SavedDocEntry[];
  getRecentPackageSummaries: (
    limit?: number,
  ) => Array<{ name: string; count: number }>;
  rememberRecentPackage: (packageName: string | undefined) => Promise<void>;
  openConfiguredLink: (url: string, kind?: "docs" | "devdocs") => Promise<void>;
};

type SearchItem = vscode.QuickPickItem & {
  url?: string;
  moduleName?: string;
  packageName?: string;
  historyEntry?: HoverHistoryEntry;
  savedEntry?: SavedDocEntry;
};

export function registerSearchDocsCommand(
  deps: SearchDocsCommandDeps,
): (initialQuery?: string) => void {
  return (initialQuery?: string) => {
    const qp = vscode.window.createQuickPick<SearchItem>();
    qp.title = "PyHover Search";
    qp.matchOnDescription = true;
    qp.matchOnDetail = true;

    const updatePlaceholder = () => {
      const count = deps.hoverProvider.getIndexedSymbolCount();
      qp.placeholder = count > 0
        ? `Search ${count.toLocaleString()} indexed Python symbols (e.g. "DataFrame.merge", "asyncio.gather")...`
        : "Search indexed Python symbols or enter a package name to load it...";
    };
    updatePlaceholder();

    const buildStarterSearchItems = (): SearchItem[] => {
      const savedDocItems = deps
        .getSavedDocs()
        .slice(0, 5)
        .map((entry) => ({
          label: `$(bookmark) ${entry.title}`,
          description: [
            formatSymbolKindLabel(entry.kind),
            entry.module ?? entry.package,
          ]
            .filter(Boolean)
            .join(" • "),
          detail: "Saved doc • Reopen this saved reading-list target",
          savedEntry: entry,
          packageName: entry.package ?? entry.module,
        }));
      const historyItems = deps.hoverProvider
        .getHoverHistory()
        .filter((entry) => !!entry.url)
        .slice(0, 5)
        .map((entry) => ({
          label: `${entry.commandToken ? "$(history)" : "$(link-external)"} ${entry.title}`,
          description: [
            formatSymbolKindLabel(entry.kind),
            entry.module ?? entry.package,
          ]
            .filter(Boolean)
            .join(" • "),
          detail: entry.commandToken
            ? "Recent hover • Reopen in the inspector if the session copy is still available"
            : "Recent docs link • Open the stored documentation target",
          url: entry.url,
          packageName: entry.package ?? entry.module,
          historyEntry: entry,
        }));
      const recentPackageItems = deps
        .getRecentPackageSummaries(6)
        .map((pkg) => ({
          label: `$(symbol-namespace) ${pkg.name}`,
          description: `${pkg.count.toLocaleString()} indexed symbols`,
          detail: "Recent package • Open in module browser",
          moduleName: pkg.name,
          packageName: pkg.name,
        }));

      const items: SearchItem[] = [];
      if (savedDocItems.length > 0) {
        items.push({
          label: "Saved Docs",
          kind: vscode.QuickPickItemKind.Separator,
        });
        items.push(...savedDocItems);
      }
      if (historyItems.length > 0) {
        items.push({
          label: "Recent Docs",
          kind: vscode.QuickPickItemKind.Separator,
        });
        items.push(...historyItems);
      }
      if (recentPackageItems.length > 0) {
        items.push({
          label: "Recent Packages",
          kind: vscode.QuickPickItemKind.Separator,
        });
        items.push(...recentPackageItems);
      }
      if (items.length === 0) {
        items.push({
          label:
            "$(info) Search docs or browse a package to build recent shortcuts",
          detail:
            "PyHover will surface recent symbols and indexed packages here.",
          alwaysShow: true,
        });
      }
      return items;
    };

    const updateSearchItems = (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) {
        qp.items = buildStarterSearchItems();
        return;
      }

      const results = deps.hoverProvider.searchDocs(trimmed).slice(0, 40);
      if (results.length === 0) {
        const rootPackage = trimmed.split(".")[0];
        const canLoadPackage = /^[a-z_][a-z0-9_-]*$/i.test(rootPackage) &&
          rootPackage === rootPackage.toLowerCase();
        qp.items = [
          {
            label: "$(info) No indexed symbols match this search",
            description: qp.busy ? "Cached indexes are still loading" : undefined,
            detail: qp.busy
              ? "Results will refresh automatically when loading finishes."
              : "Try a shorter symbol name or load the package index below.",
            alwaysShow: true,
          },
          ...(canLoadPackage
            ? [{
                label: `$(cloud-download) Load and browse package "${rootPackage}"`,
                description: "Fetch its documentation index if needed",
                detail: "Requires online discovery unless the package is already cached.",
                moduleName: rootPackage,
                packageName: rootPackage,
                alwaysShow: true,
              } satisfies SearchItem]
            : []),
        ];
        return;
      }

      qp.items = [
        {
          label: `Results (${results.length})`,
          kind: vscode.QuickPickItemKind.Separator,
        },
        ...results.map((result) => ({
          label: `${iconForSymbolKind(result.kind)} ${result.name}`,
          description: buildSearchResultDescription(result),
          detail: buildSearchResultDetail(result),
          url: result.url,
          packageName: result.package,
        })),
        {
          label: `$(symbol-namespace) Browse module "${trimmed}"`,
          description: "Open the package or module directly",
          detail:
            "Useful when you know the library but not the exact symbol name.",
          moduleName: trimmed,
          packageName: trimmed,
          alwaysShow: true,
        },
      ];
    };

    if (initialQuery) {
      qp.value = initialQuery;
      updateSearchItems(initialQuery);
    } else {
      qp.items = buildStarterSearchItems();
    }

    qp.onDidChangeValue((query) => {
      updateSearchItems(query);
    });

    qp.onDidAccept(() => {
      const sel = qp.selectedItems[0] as SearchItem;
      if (sel?.savedEntry) {
        void vscode.commands.executeCommand(
          "python-hover.openSavedHoverEntry",
          sel.savedEntry,
        );
      } else if (sel?.historyEntry) {
        void vscode.commands.executeCommand(
          "python-hover.openSidebarHistoryEntry",
          sel.historyEntry,
        );
      } else if (sel?.moduleName) {
        void vscode.commands.executeCommand(
          "python-hover.browseModule",
          sel.moduleName,
        );
      } else if (sel?.url) {
        void deps.rememberRecentPackage(sel.packageName);
        void deps.openConfiguredLink(sel.url, "docs");
      }
      qp.hide();
    });

    let disposed = false;
    qp.onDidHide(() => {
      disposed = true;
      qp.dispose();
    });
    qp.show();

    // Disk inventories hydrate asynchronously. Refresh the open picker when they
    // arrive so an early search cannot get stuck showing a false zero-results state.
    qp.busy = true;
    void deps.hoverProvider.hydrateCachedInventories().then(
      () => {
        if (disposed) {
          return;
        }
        qp.busy = false;
        updatePlaceholder();
        updateSearchItems(qp.value);
      },
      () => {
        if (!disposed) {
          qp.busy = false;
          updateSearchItems(qp.value);
        }
      },
    );
  };
}
