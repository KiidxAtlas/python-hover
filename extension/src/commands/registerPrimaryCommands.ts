import { HoverDoc } from "#shared/types";
import { HoverDebugPanel } from "#src/ui/panels/hoverDebugPanel";
import { HoverPanel } from "#src/ui/panels/hoverPanel";
import * as vscode from "vscode";

type HoverProviderCommands = {
  getLastDoc: () => HoverDoc | null;
  getDocByCommandToken: (token?: string) => HoverDoc | null;
  getRenderedHoverMarkdown: (token?: string) => string | null;
};

type StatusBarCommands = {
  showStatusNotification: () => Promise<void>;
  toggleOnlineDiscovery: () => Promise<void>;
};

export type RegisterPrimaryCommandsDeps = {
  hoverProvider: HoverProviderCommands;
  statusBarManager: StatusBarCommands;
  buildImportStatementForDoc: (doc: HoverDoc) => string | undefined;
};

export function registerPrimaryCommands(
  context: vscode.ExtensionContext,
  deps: RegisterPrimaryCommandsDeps,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "python-hover.showStatusNotification",
      async () => {
        await deps.statusBarManager.showStatusNotification();
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "python-hover.toggleOnlineDiscovery",
      async () => {
        await deps.statusBarManager.toggleOnlineDiscovery();
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "python-hover.copyImport",
      async (importStatement?: string) => {
        let text = importStatement;
        if (!text) {
          const doc = deps.hoverProvider.getLastDoc();
          if (doc) {
            text = deps.buildImportStatementForDoc(doc);
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
      const doc = deps.hoverProvider.getLastDoc();
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
          explicitUrl ||
          deps.hoverProvider.getDocByCommandToken(urlOrToken)?.url;
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
          deps.hoverProvider.getDocByCommandToken(sigOrToken)?.signature;
        if (text) {
          await vscode.env.clipboard.writeText(text);
          vscode.window.showInformationMessage("Signature copied to clipboard");
        }
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "python-hover.pinHover",
      (token?: string) => {
        const doc =
          deps.hoverProvider.getDocByCommandToken(token) ??
          deps.hoverProvider.getLastDoc();
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
        const doc =
          deps.hoverProvider.getDocByCommandToken(token) ??
          deps.hoverProvider.getLastDoc();
        if (!doc) {
          vscode.window.showInformationMessage(
            "Hover over a Python symbol first, then click Debug.",
          );
          return;
        }

        HoverPanel.show(doc);
        HoverDebugPanel.show(
          doc,
          deps.hoverProvider.getRenderedHoverMarkdown(token) ||
            deps.hoverProvider.getRenderedHoverMarkdown() ||
            "",
        );
      },
    ),
  );
}
