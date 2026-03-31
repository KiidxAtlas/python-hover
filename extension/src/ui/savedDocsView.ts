import * as vscode from 'vscode';
import { SavedDocEntry } from '../../../shared/types';
import { BaseTreeView, PlaceholderTreeNode } from './baseTreeView';

type SavedDocsTreeNode = SavedDocEntry | PlaceholderTreeNode;

type SavedDocsAccessor = () => SavedDocEntry[];

export class SavedDocsView extends BaseTreeView<SavedDocEntry> {
    static readonly viewType = 'pyhover.saved';

    constructor(private readonly getEntries: SavedDocsAccessor) {
        super();
    }

    getTreeItem(element: SavedDocsTreeNode): vscode.TreeItem {
        if (this.isPlaceholderNode(element)) {
            return this.buildPlaceholderTreeItem(element, 'bookmark', 'pyhoverSavedDocPlaceholder');
        }

        const item = new vscode.TreeItem(element.title, vscode.TreeItemCollapsibleState.None);
        item.id = element.id;
        item.description = this.buildMetaDescription(this.formatKindLabel(element.kind), element.module ?? element.package);
        item.tooltip = this.buildTooltip(element);
        item.iconPath = this.themeIconForSymbolKind(element.kind, 'bookmark');
        item.contextValue = 'pyhoverSavedDocEntry';
        item.command = {
            command: 'python-hover.openSavedHoverEntry',
            title: 'Open Saved Doc Entry',
            arguments: [element],
        };
        return item;
    }

    protected getRootChildren(): SavedDocEntry[] {
        return this.getEntries();
    }

    protected getPlaceholderNode(): PlaceholderTreeNode {
        return {
            kind: 'placeholder',
            id: 'saved-docs-empty',
            label: 'No saved docs yet',
            description: 'Save symbols from hover cards to build a reusable reading list.',
        };
    }

    private buildTooltip(entry: SavedDocEntry): vscode.MarkdownString {
        const meta = this.buildMetaDescription(this.formatKindLabel(entry.kind), entry.module ?? entry.package);
        const target = entry.url
            ? 'Saved docs link available.'
            : entry.module
                ? 'Saved module target available.'
                : 'Saved session target available.';
        return this.buildMarkdownTooltip(entry.title, meta, entry.summary, target);
    }
}
