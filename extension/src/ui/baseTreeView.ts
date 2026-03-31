import * as vscode from 'vscode';

export type PlaceholderTreeNode = {
    kind: 'placeholder';
    id: string;
    label: string;
    description: string;
    contextValue?: string;
    iconId?: string;
};

export abstract class BaseTreeView<TNode> implements vscode.TreeDataProvider<TNode | PlaceholderTreeNode> {
    protected readonly didChangeTreeDataEmitter = new vscode.EventEmitter<TNode | PlaceholderTreeNode | undefined | void>();
    readonly onDidChangeTreeData = this.didChangeTreeDataEmitter.event;

    refresh(): void {
        this.didChangeTreeDataEmitter.fire();
    }

    getChildren(element?: TNode | PlaceholderTreeNode): Array<TNode | PlaceholderTreeNode> {
        if (element) {
            return [];
        }

        const entries = this.getRootChildren();
        return entries.length > 0 ? entries : [this.getPlaceholderNode()];
    }

    protected isPlaceholderNode(element: TNode | PlaceholderTreeNode): element is PlaceholderTreeNode {
        return typeof element === 'object'
            && element !== null
            && 'kind' in element
            && element.kind === 'placeholder';
    }

    protected buildPlaceholderTreeItem(
        element: PlaceholderTreeNode,
        defaultIconId: string,
        defaultContextValue: string,
    ): vscode.TreeItem {
        const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
        item.id = element.id;
        item.description = element.description;
        item.tooltip = this.buildMarkdownTooltip(element.label, element.description);
        item.iconPath = new vscode.ThemeIcon(element.iconId ?? defaultIconId);
        item.contextValue = element.contextValue ?? defaultContextValue;
        return item;
    }

    protected themeIconForSymbolKind(kind: string | undefined, fallbackIconId: string): vscode.ThemeIcon {
        switch ((kind ?? '').toLowerCase()) {
            case 'class':
                return new vscode.ThemeIcon('symbol-class');
            case 'method':
                return new vscode.ThemeIcon('symbol-method');
            case 'function':
                return new vscode.ThemeIcon('symbol-function');
            case 'module':
                return new vscode.ThemeIcon('symbol-module');
            case 'property':
                return new vscode.ThemeIcon('symbol-property');
            case 'attribute':
            case 'field':
                return new vscode.ThemeIcon('symbol-field');
            case 'keyword':
                return new vscode.ThemeIcon('symbol-key');
            case 'exception':
                return new vscode.ThemeIcon('error');
            default:
                return new vscode.ThemeIcon(fallbackIconId);
        }
    }

    protected buildMetaDescription(...parts: Array<string | undefined>): string | undefined {
        const filtered = parts
            .map(part => part?.trim())
            .filter((part): part is string => Boolean(part));
        return filtered.length > 0 ? filtered.join(' • ') : undefined;
    }

    protected formatKindLabel(kind?: string): string | undefined {
        if (!kind) {
            return undefined;
        }

        return kind.charAt(0).toUpperCase() + kind.slice(1).toLowerCase();
    }

    protected buildMarkdownTooltip(title: string, ...sections: Array<string | undefined>): vscode.MarkdownString {
        const tooltip = new vscode.MarkdownString();
        tooltip.isTrusted = false;
        tooltip.appendMarkdown(`**${this.escapeMarkdown(title)}**`);

        for (const section of sections) {
            if (!section) {
                continue;
            }

            tooltip.appendMarkdown(`\n\n${this.escapeMarkdown(section)}`);
        }

        return tooltip;
    }

    protected escapeMarkdown(value: string): string {
        return value.replace(/([\\`*_{}[\]()+#.!-])/g, '\\$1');
    }

    protected abstract getRootChildren(): TNode[];

    protected abstract getPlaceholderNode(): PlaceholderTreeNode;

    abstract getTreeItem(element: TNode | PlaceholderTreeNode): vscode.TreeItem | Thenable<vscode.TreeItem>;
}
