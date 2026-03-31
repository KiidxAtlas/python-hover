import * as vscode from 'vscode';
import { HoverHistoryEntry } from '../../../shared/types';
import { BaseTreeView, PlaceholderTreeNode } from './baseTreeView';

type HoverHistoryTreeNode = HoverHistoryEntry | PlaceholderTreeNode;

type HoverHistoryAccessor = () => HoverHistoryEntry[];

export class HoverHistoryView extends BaseTreeView<HoverHistoryEntry> {
    static readonly viewType = 'pyhover.history';

    constructor(private readonly getEntries: HoverHistoryAccessor) {
        super();
    }

    getTreeItem(element: HoverHistoryTreeNode): vscode.TreeItem {
        if (this.isPlaceholderNode(element)) {
            return this.buildPlaceholderTreeItem(element, 'history', 'pyhoverHistoryPlaceholder');
        }

        const item = new vscode.TreeItem(element.title, vscode.TreeItemCollapsibleState.None);
        item.id = `${element.commandToken || element.url || element.title}`;
        item.contextValue = 'pyhoverHistoryEntry';
        item.description = this.buildMetaDescription(this.formatKindLabel(element.kind), element.module ?? element.package);
        item.tooltip = this.buildTooltip(element);
        item.iconPath = this.themeIconForSymbolKind(element.kind, 'history');
        item.command = {
            command: 'python-hover.openSidebarHistoryEntry',
            title: 'Open Sidebar History Entry',
            arguments: [element],
        };
        return item;
    }

    protected getRootChildren(): HoverHistoryEntry[] {
        return this.getEntries().filter(entry => !!entry.commandToken || !!entry.url);
    }

    protected getPlaceholderNode(): PlaceholderTreeNode {
        return {
            kind: 'placeholder',
            id: 'history-empty',
            label: 'No hover history yet',
            description: 'Hover Python symbols to populate recent history.',
        };
    }

    private buildTooltip(entry: HoverHistoryEntry): vscode.MarkdownString {
        const meta = this.buildMetaDescription(this.formatKindLabel(entry.kind), entry.module ?? entry.package);
        const availability = entry.commandToken
            ? 'Live session entry. Reopens directly in the PyHover inspector.'
            : 'Archived docs target. Opens the stored documentation target.';
        return this.buildMarkdownTooltip(entry.title, meta, availability);
    }
}
