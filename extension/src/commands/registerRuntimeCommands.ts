import { SavedDocEntry } from "#shared/types";
import {
  CacheCommandsDeps,
  createCacheCommands,
} from "#src/commands/cacheCommands";
import { registerSearchDocsCommand } from "#src/commands/searchDocsCommand";
import { Config } from "#src/config";
import { HoverProvider } from "#src/hover/hoverProvider";
import { TelemetryState } from "#src/state/telemetryState";
import { formatStandardInfoMessage } from "#src/utils/error-handling";
import * as vscode from "vscode";

type RegisterRuntimeCommandsDeps = {
  context: vscode.ExtensionContext;
  config: Config;
  hoverProvider: HoverProvider;
  telemetryState: TelemetryState;
  docsPanelShow: (url: string) => void;
  docsBrowserMode: () => "integrated" | "external";
  getSavedDocs: () => SavedDocEntry[];
  getRecentPackageSummaries: (
    limit?: number,
  ) => Array<{ name: string; count: number }>;
  rememberRecentPackage: (packageName: string | undefined) => Promise<void>;
  openConfiguredLink: (url: string, kind?: "docs" | "devdocs") => Promise<void>;
  updateSetting: (
    setting: string,
    value: string | number | boolean | string[],
  ) => Promise<void>;
  getLearnModeEnabled: () => boolean;
} & Pick<
  CacheCommandsDeps,
  | "diskCache"
  | "activeCorpusBuild"
  | "setActiveCorpusBuild"
  | "updateStudio"
  | "statusBarUpdate"
  | "refreshAfterCacheMutation"
>;

export function registerRuntimeCommands(
  deps: RegisterRuntimeCommandsDeps,
): void {
  const runSearchDocs = registerSearchDocsCommand({
    hoverProvider: deps.hoverProvider,
    getSavedDocs: () => deps.getSavedDocs(),
    getRecentPackageSummaries: (limit) => deps.getRecentPackageSummaries(limit),
    rememberRecentPackage: (packageName) =>
      deps.rememberRecentPackage(packageName),
    openConfiguredLink: (url, kind) => deps.openConfiguredLink(url, kind),
  });

  deps.context.subscriptions.push(
    vscode.commands.registerCommand("python-hover.searchDocs", runSearchDocs),
  );
  deps.context.subscriptions.push(
    vscode.commands.registerCommand("python-hover.findMethod", runSearchDocs),
  );

  deps.context.subscriptions.push(
    vscode.commands.registerCommand(
      "python-hover.toggleLearnMode",
      async () => {
        const enabled = !deps.getLearnModeEnabled();
        await deps.updateSetting("ui.learnMode", enabled);
        if (enabled) {
          await deps.updateSetting(
            "ui.autoOpenCurrentHoverInIntegratedDocs",
            true,
          );
          const doc = deps.hoverProvider.getLastDoc();
          if (doc?.url && deps.docsBrowserMode() === "integrated") {
            deps.docsPanelShow(doc.url);
          }
        }
        vscode.window.showInformationMessage(
          formatStandardInfoMessage(
            enabled ? "Learn mode enabled" : "Learn mode disabled",
          ),
        );
      },
    ),
  );

  deps.context.subscriptions.push(
    vscode.commands.registerCommand("python-hover.showTelemetry", async () => {
      const snapshot = deps.telemetryState.getSnapshot();
      const topSymbols = Object.entries(snapshot.topSymbols)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, count]) => `${name} (${count})`)
        .join(", ");
      const bySource = Object.entries(snapshot.bySource)
        .sort((a, b) => b[1] - a[1])
        .map(([source, count]) => `${source}: ${count}`)
        .join(" • ");

      await vscode.window.showInformationMessage(
        `PyHover telemetry: ${snapshot.totalHoverEvents} hovers. Sources: ${bySource || "none"}. Top: ${topSymbols || "none"}.`,
      );
    }),
  );

  const cacheCommands = createCacheCommands({
    context: deps.context,
    config: deps.config,
    diskCache: deps.diskCache,
    hoverProvider: deps.hoverProvider,
    activeCorpusBuild: deps.activeCorpusBuild,
    setActiveCorpusBuild: deps.setActiveCorpusBuild,
    updateStudio: deps.updateStudio,
    statusBarUpdate: deps.statusBarUpdate,
    refreshAfterCacheMutation: deps.refreshAfterCacheMutation,
  });

  deps.context.subscriptions.push(
    vscode.commands.registerCommand(
      "python-hover.clearCache",
      cacheCommands.clearCache,
    ),
  );
  deps.context.subscriptions.push(
    vscode.commands.registerCommand(
      "python-hover.clearStdlibCorpus",
      cacheCommands.clearStdlibCorpus,
    ),
  );
  deps.context.subscriptions.push(
    vscode.commands.registerCommand(
      "python-hover.clearAllCache",
      cacheCommands.clearAllCache,
    ),
  );
  deps.context.subscriptions.push(
    vscode.commands.registerCommand(
      "python-hover.cancelPythonCorpusBuild",
      cacheCommands.cancelPythonCorpusBuild,
    ),
  );
  deps.context.subscriptions.push(
    vscode.commands.registerCommand(
      "python-hover.buildPythonCorpus",
      cacheCommands.buildPythonCorpus,
    ),
  );
  deps.context.subscriptions.push(
    vscode.commands.registerCommand(
      "python-hover.openCacheFolder",
      cacheCommands.openCacheFolder,
    ),
  );
}
