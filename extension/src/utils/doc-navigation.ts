import { HoverDoc, IndexedSymbolSummary } from "#shared/types";
import { HoverProvider } from "#src/hover/hoverProvider";
import * as vscode from "vscode";

type WorkspaceSymbolCandidate = {
  name?: string;
  location?: vscode.Location | { uri: vscode.Uri; range?: vscode.Range };
};

export async function openIndexedSymbolSource(
  symbol: IndexedSymbolSummary,
  hoverProvider: HoverProvider,
  openDocsLink: (url: string) => Thenable<void>,
): Promise<boolean> {
  const workspaceLocation = await findWorkspaceSymbolLocation(symbol.name);
  if (workspaceLocation) {
    await revealLocation(workspaceLocation);
    return true;
  }

  const doc = await hoverProvider.resolveIndexedSymbolDoc(symbol);
  if (!doc) {
    return false;
  }

  return openHoverDocSource(doc, openDocsLink);
}

export async function openHoverDocSource(
  doc: Pick<HoverDoc, "sourceUrl" | "links" | "url">,
  openDocsLink: (url: string) => Thenable<void>,
): Promise<boolean> {
  const sourceTarget = getHoverDocSourceTarget(doc);
  if (!sourceTarget) {
    return false;
  }

  return openSourceTarget(sourceTarget, openDocsLink);
}

function getHoverDocSourceTarget(
  doc: Pick<HoverDoc, "sourceUrl" | "links" | "url">,
): string | undefined {
  const sourceTarget =
    doc.sourceUrl || doc.links?.source || doc.links?.Source || doc.url;
  return typeof sourceTarget === "string" && sourceTarget.trim()
    ? sourceTarget.trim()
    : undefined;
}

export async function openSourceTarget(
  sourceTarget: string,
  openDocsLink: (url: string) => Thenable<void>,
): Promise<boolean> {
  if (!sourceTarget) {
    return false;
  }

  const isGitHubLink =
    sourceTarget.includes("github.com") &&
    (sourceTarget.includes("/blob/") || sourceTarget.includes("/tree/"));
  if (isGitHubLink) {
    // Build the VS Code for Web link by transforming the full URL safely.
    // Use a single pass to avoid partial/incomplete sanitization.
    const vscodeGithubLink = sourceTarget
      .replace("github.com", "github.dev")
      .replace("/blob/", "/")
      .replace(/\.git$/, "")
      // Ensure the result is a valid http(s) URL before opening.
      .replace(/^https?:\/\//, "https://");

    // Validate the transformed URL is safe before opening.
    try {
      new URL(vscodeGithubLink);
    } catch {
      // If transformation produced an invalid URL, fall back to original.
      await openDocsLink(sourceTarget);
      return true;
    }

    // Attempt VS Code for Web first (best experience), fall back to GH if not available
    try {
      // Open in integrated browser first
      await openDocsLink(vscodeGithubLink);
      return true;
    } catch {
      // Fall back to github.com
      await openDocsLink(sourceTarget);
      return true;
    }
  }

  await openDocsLink(sourceTarget);
  return true;
}

async function findWorkspaceSymbolLocation(
  symbolName: string,
): Promise<vscode.Location | undefined> {
  if (!symbolName || symbolName.length === 0) {
    return undefined;
  }

  const results = await vscode.commands.executeCommand<
    vscode.SymbolInformation[]
  >("vscode.executeWorkspaceSymbolProvider", symbolName);

  if (!results || results.length === 0) {
    return undefined;
  }

  const candidates: WorkspaceSymbolCandidate[] = results
    .map((s) => ({
      name: s.name,
      location: s.location,
    }))
    .filter((c) => c.location);

  if (candidates.length === 0) {
    return undefined;
  }

  const exact = candidates.find(
    (c) => c.name && c.name.toLowerCase() === symbolName.toLowerCase(),
  );
  if (exact && exact.location) {
    return exact.location as vscode.Location;
  }

  const first = candidates[0];
  return first && first.location
    ? (first.location as vscode.Location)
    : undefined;
}

async function revealLocation(location: vscode.Location): Promise<void> {
  const editor = await vscode.window.showTextDocument(location.uri, {
    selection: location.range,
    preserveFocus: false,
  });
  editor.revealRange(location.range, vscode.TextEditorRevealType.InCenter);
}
