import * as vscode from 'vscode';
import { IndexedSymbolSummary } from '../../shared/types';
import { HoverProvider } from './hoverProvider';
import { DocsPanel } from './ui/docsPanel';

type WorkspaceSymbolCandidate = {
    name?: string;
    location?: vscode.Location | { uri: vscode.Uri; range?: vscode.Range };
};

export async function openIndexedSymbolSource(
    symbol: IndexedSymbolSummary,
    hoverProvider: HoverProvider,
    docsPanel: DocsPanel,
): Promise<boolean> {
    const workspaceLocation = await findWorkspaceSymbolLocation(symbol.name);
    if (workspaceLocation) {
        await revealLocation(workspaceLocation);
        return true;
    }

    const doc = await hoverProvider.resolveIndexedSymbolDoc(symbol);
    const sourceTarget = doc?.sourceUrl || doc?.links?.source || doc?.links?.Source || doc?.url;
    if (!sourceTarget) {
        return false;
    }

    if (/^https?:\/\//i.test(sourceTarget)) {
        docsPanel.show(sourceTarget);
        return true;
    }

    const uri = sourceTarget.includes('://') ? vscode.Uri.parse(sourceTarget) : vscode.Uri.file(sourceTarget);
    const textDocument = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(textDocument, {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: true,
        preview: true,
    });
    return true;
}

async function findWorkspaceSymbolLocation(symbolName: string): Promise<vscode.Location | undefined> {
    const queries = [...new Set([symbolName, symbolName.split('.').pop() || symbolName])];
    const candidates: WorkspaceSymbolCandidate[] = [];

    for (const query of queries) {
        const result = await vscode.commands.executeCommand<WorkspaceSymbolCandidate[]>('vscode.executeWorkspaceSymbolProvider', query);
        if (result && result.length > 0) {
            candidates.push(...result);
        }
    }

    if (candidates.length === 0) {
        return undefined;
    }

    const target = symbolName.toLowerCase();
    const leaf = symbolName.split('.').pop()?.toLowerCase() || target;
    const ranked = candidates
        .map(candidate => ({ candidate, score: scoreWorkspaceSymbolCandidate(candidate.name || '', target, leaf) }))
        .filter(entry => entry.score > 0)
        .sort((a, b) => b.score - a.score);

    for (const entry of ranked) {
        const location = extractLocation(entry.candidate);
        if (location) {
            return location;
        }
    }

    return undefined;
}

function scoreWorkspaceSymbolCandidate(candidateName: string, target: string, leaf: string): number {
    const normalized = candidateName.toLowerCase();
    if (!normalized) return 0;
    if (normalized === target) return 100;
    if (normalized.endsWith(`.${target}`)) return 95;
    if (normalized === leaf) return 85;
    if (normalized.endsWith(`.${leaf}`)) return 75;
    if (normalized.includes(target)) return 50;
    if (normalized.includes(leaf)) return 30;
    return 0;
}

function extractLocation(candidate: WorkspaceSymbolCandidate): vscode.Location | undefined {
    const location = candidate.location;
    if (!location) return undefined;
    if (location instanceof vscode.Location) {
        return location;
    }

    if (location.uri) {
        return new vscode.Location(
            location.uri,
            location.range || new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)),
        );
    }

    return undefined;
}

async function revealLocation(location: vscode.Location): Promise<void> {
    const document = await vscode.workspace.openTextDocument(location.uri);
    const editor = await vscode.window.showTextDocument(document, {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: true,
        preview: true,
    });
    editor.selection = new vscode.Selection(location.range.start, location.range.end);
    editor.revealRange(location.range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}
