import * as vscode from 'vscode';
import { HoverDoc, IndexedSymbolSummary } from '../../../shared/types';
import { isActiveParameterMatch } from '../parameterLens';
import { buildSavedDocEntry } from '../savedDocs';
import { cleanContent, cleanSignature } from './contentCleaner';
import { buildCopyableSignature, buildDescriptionContent, buildImportStatement, getCompactExample, getDisplayTitle, getRequiredPythonVersion, getVisibleNoteItems, isMeaningfullyOutdated } from './docPresentation';

type InspectorNode = {
    id: string;
    label: string;
    description?: string;
    tooltip?: vscode.MarkdownString;
    icon?: vscode.ThemeIcon;
    command?: vscode.Command;
    children?: InspectorNode[];
    collapsibleState?: vscode.TreeItemCollapsibleState;
};

export class HoverInspectorView implements vscode.TreeDataProvider<InspectorNode> {
    static readonly viewType = 'pyhover.inspector';
    private static readonly MODULE_SYMBOL_PREVIEW_LIMIT = 12;

    private readonly didChangeTreeDataEmitter = new vscode.EventEmitter<InspectorNode | undefined | void>();
    readonly onDidChangeTreeData = this.didChangeTreeDataEmitter.event;

    private currentDoc: HoverDoc | undefined;

    constructor(private readonly getModuleSymbols: (moduleName: string) => IndexedSymbolSummary[]) { }

    showDoc(doc: HoverDoc | null | undefined): void {
        this.currentDoc = doc ?? undefined;
        this.refresh();
    }

    refresh(): void {
        this.didChangeTreeDataEmitter.fire();
    }

    getTreeItem(element: InspectorNode): vscode.TreeItem {
        const collapsibleState = element.collapsibleState
            ?? (element.children?.length
                ? vscode.TreeItemCollapsibleState.Expanded
                : vscode.TreeItemCollapsibleState.None);
        const item = new vscode.TreeItem(element.label, collapsibleState);
        item.id = element.id;
        item.description = element.description;
        item.tooltip = element.tooltip;
        item.iconPath = element.icon;
        item.command = element.command;
        return item;
    }

    getChildren(element?: InspectorNode): InspectorNode[] {
        if (element) {
            return element.children ?? [];
        }

        return this.currentDoc ? this.buildDocNodes(this.currentDoc) : this.buildEmptyNodes();
    }

    private buildEmptyNodes(): InspectorNode[] {
        return [
            this.commandNode('empty-search', 'Search docs', 'Indexed symbol search', 'search', 'python-hover.searchDocs'),
            this.commandNode('empty-browse', 'Browse modules', 'Indexed module browser', 'symbol-namespace', 'python-hover.browseModule'),
            this.commandNode('empty-studio', 'Open Studio', 'Settings and cache tools', 'layout', 'python-hover.openStudio'),
            this.commandNode('empty-history', 'Hover history', 'Recent hover targets', 'history', 'python-hover.showHistory'),
        ];
    }

    private buildDocNodes(doc: HoverDoc): InspectorNode[] {
        const nodes: InspectorNode[] = [];
        const title = getDisplayTitle(doc.title);
        const subtitle = [doc.kind, doc.module].filter(Boolean).join(' • ');
        const moduleBrowseTarget = this.getInspectorModuleName(doc);

        nodes.push({
            id: 'symbol',
            label: title,
            description: subtitle || undefined,
            tooltip: this.markdownTooltip(`**${this.escapeMarkdown(title)}**${subtitle ? `\n\n${this.escapeMarkdown(subtitle)}` : ''}`),
            icon: new vscode.ThemeIcon(this.themeIconForKind(doc.kind)),
        });

        if (doc.parameterLens) {
            const lens = doc.parameterLens;
            const lensChildren: InspectorNode[] = [
                this.infoNode('lens-parameter', 'Parameter', `${lens.parameter.name || lens.parameterLabel} (${lens.parameterIndex + 1}/${lens.parameterCount})`, 'target'),
            ];
            if (lens.parameter.type) {
                lensChildren.push(this.infoNode('lens-type', 'Type', lens.parameter.type, 'symbol-parameter'));
            }
            if (lens.parameter.default !== undefined) {
                lensChildren.push(this.infoNode('lens-default', 'Default', lens.parameter.default, 'symbol-value'));
            }
            const lensSignature = cleanSignature(lens.signature);
            const currentSignature = doc.signature ? cleanSignature(doc.signature) : undefined;
            if (!currentSignature || currentSignature !== lensSignature) {
                lensChildren.push(this.infoNode('lens-signature', 'Call', this.clipText(lensSignature, 80), 'symbol-method'));
            }
            if (lens.parameter.description) {
                lensChildren.push(this.leafNode(
                    'lens-description',
                    'Focus',
                    this.clipText(cleanContent(lens.parameter.description), 110),
                    'note',
                    lens.parameter.description,
                ));
            }
            nodes.push(this.sectionNode('parameter-lens', 'Parameter Lens', undefined, 'target', lensChildren, vscode.TreeItemCollapsibleState.Expanded));
        }

        const actionChildren: InspectorNode[] = [];
        const token = this.getCommandToken(doc);
        const importStatement = this.buildImportStatement(doc);
        const signature = this.getCopyableSignature(doc);
        const savedDocEntry = buildSavedDocEntry(doc);

        actionChildren.push(this.commandNode('action-pin', 'Pin panel', undefined, 'pin', token ? 'python-hover.pinHover' : 'python-hover.pinLast', token ? [token] : undefined));
        if (doc.url) {
            actionChildren.push(this.commandNode('action-docs', 'Open docs', undefined, 'book', 'python-hover.openDocLink', [{ url: doc.url, kind: 'docs' }]));
        }
        if (doc.sourceUrl || doc.links?.source) {
            actionChildren.push(this.commandNode('action-source', 'Open source', undefined, 'source-control', 'python-hover.openHoverSource', [{ token, target: doc.sourceUrl || doc.links?.source }]));
        }
        if (moduleBrowseTarget && moduleBrowseTarget !== 'builtins') {
            actionChildren.push(this.commandNode('action-browse', 'Browse module', moduleBrowseTarget, 'symbol-namespace', 'python-hover.browseModule', [moduleBrowseTarget]));
        }
        if (importStatement) {
            actionChildren.push(this.commandNode('action-import', 'Copy import', importStatement, 'copy', 'python-hover.copyImport', [importStatement]));
        }
        if (signature) {
            actionChildren.push(this.commandNode('action-signature', 'Copy signature', this.clipText(signature, 60), 'symbol-method', 'python-hover.copySignature', [signature]));
        }
        if (savedDocEntry) {
            actionChildren.push(this.commandNode('action-save', 'Save doc', 'Add to Saved Docs', 'bookmark', 'python-hover.toggleSavedHover', [savedDocEntry]));
        }
        actionChildren.push(this.commandNode('action-history', 'Show history', 'Recent hover targets', 'history', 'python-hover.showHistory'));
        nodes.push(this.sectionNode('actions', 'Actions', undefined, 'zap', actionChildren, vscode.TreeItemCollapsibleState.Expanded));

        const contextChildren: InspectorNode[] = [];
        if (doc.module) {
            contextChildren.push(this.infoNode('context-module', 'Module', doc.module, 'symbol-namespace'));
        }
        const packageName = typeof doc.metadata?.indexedPackage === 'string'
            ? doc.metadata.indexedPackage
            : (moduleBrowseTarget ?? doc.module)?.split('.')[0];
        if (packageName) {
            contextChildren.push(this.infoNode('context-package', 'Package', packageName, 'package'));
        }
        contextChildren.push(this.infoNode('context-source', 'Source', this.renderSourceLabel(doc), 'server-environment'));
        if (doc.installedVersion) {
            contextChildren.push(this.infoNode('context-version', 'Installed', doc.installedVersion, 'tag'));
        }
        if (doc.latestVersion && !doc.installedVersion) {
            contextChildren.push(this.infoNode('context-latest', 'Latest', doc.latestVersion, 'tag'));
        }
        if (doc.requiresPython) {
            contextChildren.push(this.infoNode('context-python', 'Python', doc.requiresPython, 'versions'));
        }
        if (importStatement) {
            contextChildren.push(this.infoNode('context-import', 'Import', importStatement, 'symbol-file'));
        }
        if (doc.exportCount) {
            contextChildren.push(this.infoNode('context-indexed', 'Indexed', `${doc.exportCount.toLocaleString()} symbols`, 'list-unordered'));
        }
        if (contextChildren.length > 0) {
            nodes.push(this.sectionNode('context', 'Context', undefined, 'info', contextChildren, vscode.TreeItemCollapsibleState.Collapsed));
        }

        const moduleName = this.getInspectorModuleName(doc);
        if (moduleName) {
            const moduleSymbols = this.getModuleSymbols(moduleName);
            const symbolSection = this.buildModuleSymbolsSection(
                moduleName,
                moduleSymbols,
                doc.kind === 'module'
                    ? vscode.TreeItemCollapsibleState.Expanded
                    : vscode.TreeItemCollapsibleState.Collapsed,
            );
            if (symbolSection) {
                nodes.push(symbolSection);
            }
        }

        const signatureDescription = signature ? this.clipText(signature, 68) : undefined;
        if (signatureDescription) {
            nodes.push(this.leafNode('signature', 'Signature', signatureDescription, 'symbol-method', signature, signature ? {
                command: 'python-hover.copySignature',
                title: 'Copy Signature',
                arguments: [signature],
            } : undefined));
        }

        const summary = cleanContent(buildDescriptionContent(doc) || '');
        if (summary) {
            nodes.push(this.leafNode('summary', 'Summary', this.clipText(summary, 110), 'note', summary, token ? {
                command: 'python-hover.pinHover',
                title: 'Pin Documentation Panel',
                arguments: [token],
            } : {
                command: 'python-hover.pinLast',
                title: 'Pin Last Hover',
            }));
        }

        const example = getCompactExample(doc);
        if (example) {
            nodes.push(this.leafNode('example', 'Example', this.clipText(example.replace(/\s+/g, ' '), 110), 'code', example));
        }

        const noteItems = getVisibleNoteItems(doc);
        if (noteItems.length > 0) {
            const visibleNotes = noteItems.slice(0, 2).map((note, index) => this.leafNode(
                `note-${index}`,
                note.label,
                this.clipText(note.text, 110),
                'comment-discussion',
                note.text,
            ));
            if (noteItems.length > visibleNotes.length) {
                visibleNotes.push(this.infoNode(
                    'notes-more',
                    'More notes',
                    `${noteItems.length - visibleNotes.length} more in pinned docs`,
                    'ellipsis',
                ));
            }
            nodes.push(this.sectionNode(
                'notes',
                'Notes',
                `${noteItems.length} total`,
                'comment-discussion',
                visibleNotes,
                vscode.TreeItemCollapsibleState.Collapsed,
            ));
        }

        const relatedChildren: InspectorNode[] = [];
        if (doc.parameters && doc.parameterLens) {
            const activeParameter = doc.parameters.find((parameter, index) => isActiveParameterMatch(doc.parameterLens, parameter, index));
            if (activeParameter?.description) {
                relatedChildren.push(this.infoNode('related-active-parameter', 'Current arg', this.clipText(cleanContent(activeParameter.description), 110), 'target'));
            }
        }
        if (doc.returns?.type || doc.returns?.description) {
            const returnsDetail = [doc.returns.type, doc.returns.description ? cleanContent(doc.returns.description) : undefined]
                .filter(Boolean)
                .join(' — ');
            relatedChildren.push(this.infoNode('related-returns', 'Returns', this.clipText(returnsDetail, 110), 'return'));
        }
        if (doc.seeAlso && doc.seeAlso.length > 0) {
            doc.seeAlso.slice(0, 4).forEach((item, index) => {
                const related = this.buildSeeAlsoNode(item, doc, index);
                if (related) {
                    relatedChildren.push(related);
                }
            });
        }
        if (relatedChildren.length > 0) {
            nodes.push(this.sectionNode('related', 'Related', undefined, 'link', relatedChildren, vscode.TreeItemCollapsibleState.Collapsed));
        }

        const availabilityChildren: InspectorNode[] = [];
        if (doc.latestVersion && doc.installedVersion && isMeaningfullyOutdated(doc.installedVersion, doc.latestVersion)) {
            availabilityChildren.push(this.infoNode('availability-update', 'Update', `${doc.installedVersion} -> ${doc.latestVersion}`, 'arrow-up'));
        }
        const requiredVersion = getRequiredPythonVersion(doc);
        if (requiredVersion) {
            availabilityChildren.push(this.infoNode('availability-python', 'Requires', `Python ${requiredVersion}+`, 'warning'));
        }
        if (availabilityChildren.length > 0) {
            nodes.push(this.sectionNode('availability', 'Availability', undefined, 'pulse', availabilityChildren, vscode.TreeItemCollapsibleState.Collapsed));
        }

        return nodes;
    }

    private buildModuleSymbolsSection(
        moduleName: string,
        symbols: IndexedSymbolSummary[],
        collapsibleState: vscode.TreeItemCollapsibleState,
    ): InspectorNode | undefined {
        if (symbols.length === 0) {
            return undefined;
        }

        const visibleSymbols = [...symbols]
            .sort((left, right) => left.name.localeCompare(right.name))
            .slice(0, HoverInspectorView.MODULE_SYMBOL_PREVIEW_LIMIT);

        const children = visibleSymbols.map((symbol, index) => this.buildModuleSymbolNode(symbol, index));
        if (symbols.length > visibleSymbols.length) {
            children.push(this.commandNode(
                'module-symbols-more',
                'Browse full module',
                `${symbols.length.toLocaleString()} indexed symbols`,
                'go-to-file',
                'python-hover.browseModule',
                [moduleName],
            ));
        }

        return this.sectionNode(
            'module-symbols',
            'Symbols',
            `${Math.min(visibleSymbols.length, symbols.length)} shown of ${symbols.length.toLocaleString()}`,
            'symbol-array',
            children,
            collapsibleState,
        );
    }

    private buildModuleSymbolNode(symbol: IndexedSymbolSummary, index: number): InspectorNode {
        const shortName = this.shortSymbolName(symbol);
        const description = [symbol.kind, this.clipText(symbol.signature || symbol.summary || '', 56)]
            .filter(Boolean)
            .join(' • ');
        const tooltipParts = [symbol.name];
        if (symbol.signature) {
            tooltipParts.push(symbol.signature);
        }
        if (symbol.summary) {
            tooltipParts.push(cleanContent(symbol.summary));
        }

        return {
            id: `module-symbol-${index}-${symbol.name}`,
            label: shortName,
            description: description || undefined,
            icon: new vscode.ThemeIcon(this.themeIconForKind(symbol.kind)),
            tooltip: this.markdownTooltip(tooltipParts.map(part => this.escapeMarkdown(part)).join('\n\n')),
            command: {
                command: 'python-hover.pinIndexedSymbol',
                title: 'Pin Indexed Symbol',
                arguments: [symbol],
            },
        };
    }

    private commandNode(id: string, label: string, description: string | undefined, iconId: string, command: string, args?: unknown[]): InspectorNode {
        return {
            id,
            label,
            description,
            icon: new vscode.ThemeIcon(iconId),
            tooltip: description
                ? this.markdownTooltip(`**${this.escapeMarkdown(label)}**\n\n${this.escapeMarkdown(description)}`)
                : undefined,
            command: {
                command,
                title: label,
                arguments: args,
            },
        };
    }

    private infoNode(id: string, label: string, value: string, iconId: string): InspectorNode {
        return this.leafNode(id, label, value, iconId, value);
    }

    private leafNode(id: string, label: string, description: string | undefined, iconId: string, tooltipText?: string, command?: vscode.Command): InspectorNode {
        return {
            id,
            label,
            description,
            icon: new vscode.ThemeIcon(iconId),
            tooltip: tooltipText ? this.markdownTooltip(this.escapeMarkdown(tooltipText)) : undefined,
            command,
        };
    }

    private sectionNode(
        id: string,
        label: string,
        description: string | undefined,
        iconId: string,
        children: InspectorNode[],
        collapsibleState?: vscode.TreeItemCollapsibleState,
    ): InspectorNode {
        return {
            id,
            label,
            description,
            icon: new vscode.ThemeIcon(iconId),
            children,
            collapsibleState,
        };
    }

    private buildSeeAlsoNode(item: string, doc: HoverDoc, index: number): InspectorNode | undefined {
        const match = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(item.trim());
        if (match) {
            const label = match[1];
            return this.commandNode(
                `seealso-${index}`,
                label,
                'Open related reference',
                'link-external',
                'python-hover.pinDocReference',
                [{
                    label,
                    url: match[2],
                    currentModule: doc.module,
                    currentPackage: typeof doc.metadata?.indexedPackage === 'string' ? doc.metadata.indexedPackage : undefined,
                    currentTitle: doc.title,
                }],
            );
        }

        const cleaned = cleanContent(item).trim();
        if (!cleaned) {
            return undefined;
        }

        return this.commandNode(
            `seealso-${index}`,
            cleaned,
            'Pin related reference',
            'references',
            'python-hover.pinDocReference',
            [{
                label: cleaned,
                currentModule: doc.module,
                currentPackage: typeof doc.metadata?.indexedPackage === 'string' ? doc.metadata.indexedPackage : undefined,
                currentTitle: doc.title,
            }],
        );
    }

    private themeIconForKind(kind?: string): string {
        switch ((kind ?? '').toLowerCase()) {
            case 'class': return 'symbol-class';
            case 'method': return 'symbol-method';
            case 'function': return 'symbol-function';
            case 'module': return 'symbol-module';
            case 'property': return 'symbol-property';
            default: return 'symbol-field';
        }
    }

    private renderSourceLabel(doc: HoverDoc): string {
        switch (doc.source) {
            case 'SearchIndex': return 'Site index';
            case 'Corpus': return 'Corpus';
            case 'Static': return 'Static docs';
            case 'Runtime': return 'Runtime';
            case 'Local': return 'Local';
            case 'DevDocs': return 'DevDocs';
            case 'LSP': return 'Language server';
            default: return doc.source;
        }
    }

    private getCommandToken(doc: HoverDoc): string | undefined {
        return typeof doc.metadata?.commandToken === 'string' ? doc.metadata.commandToken : undefined;
    }

    private getInspectorModuleName(doc: HoverDoc): string | undefined {
        if (doc.kind === 'module') {
            return getDisplayTitle(doc.title) || doc.module;
        }
        return doc.module;
    }

    private buildImportStatement(doc: HoverDoc): string | undefined {
        return buildImportStatement(doc);
    }

    private getCopyableSignature(doc: HoverDoc): string | undefined {
        return doc.signature ? buildCopyableSignature(doc.title, doc.signature) : undefined;
    }

    private clipText(value: string, maxLength: number): string {
        const normalized = value.replace(/\s+/g, ' ').trim();
        if (normalized.length <= maxLength) {
            return normalized;
        }
        return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
    }

    private shortSymbolName(symbol: IndexedSymbolSummary): string {
        const moduleName = symbol.module?.trim();
        if (moduleName && symbol.name.startsWith(`${moduleName}.`)) {
            return symbol.name.slice(moduleName.length + 1);
        }

        const parts = symbol.name.split('.').filter(Boolean);
        return parts[parts.length - 1] || symbol.name;
    }

    private markdownTooltip(text: string): vscode.MarkdownString {
        const tooltip = new vscode.MarkdownString(text);
        tooltip.isTrusted = false;
        return tooltip;
    }

    private escapeMarkdown(value: string): string {
        return value.replace(/([\\`*_{}[\]()+#.!-])/g, '\\$1');
    }
}
