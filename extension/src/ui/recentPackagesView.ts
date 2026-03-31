import * as vscode from 'vscode';
import { BaseTreeView, PlaceholderTreeNode } from './baseTreeView';

export type RecentPackageEntry = {
    name: string;
    count: number;
};

type RecentPackagesTreeNode = RecentPackageEntry | PlaceholderTreeNode;

type RecentPackagesAccessor = () => RecentPackageEntry[];

export class RecentPackagesView extends BaseTreeView<RecentPackageEntry> {
    static readonly viewType = 'pyhover.packages';

    constructor(private readonly getEntries: RecentPackagesAccessor) {
        super();
    }

    getTreeItem(element: RecentPackagesTreeNode): vscode.TreeItem {
        if (this.isPlaceholderNode(element)) {
            return this.buildPlaceholderTreeItem(element, 'symbol-namespace', 'pyhoverRecentPackagesPlaceholder');
        }

        const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.None);
        item.id = `recent-package:${element.name}`;
        item.description = `${element.count.toLocaleString()} indexed symbols`;
        item.tooltip = this.buildMarkdownTooltip(element.name, `${element.count.toLocaleString()} indexed symbols`, 'Click to open the module browser.');
        item.iconPath = new vscode.ThemeIcon('package');
        item.command = {
            command: 'python-hover.browseModule',
            title: 'Browse Module Symbols',
            arguments: [element.name],
        };
        return item;
    }

    protected getRootChildren(): RecentPackageEntry[] {
        return this.getEntries();
    }

    protected getPlaceholderNode(): PlaceholderTreeNode {
        return {
            kind: 'placeholder',
            id: 'recent-packages-empty',
            label: 'No recent packages yet',
            description: 'Browse a package or open indexed docs to pin it here.',
        };
    }
}
