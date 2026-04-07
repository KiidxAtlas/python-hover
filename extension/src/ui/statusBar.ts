import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { PYHOVER_CACHE_DIR_NAME } from '../../../docs-engine/src/cache/diskCache';
import { HoverHistoryEntry, SavedDocEntry } from '../../../shared/types';
import { updateSettingWithPreferredTarget } from '../configTarget';

type StatusBarDataAccessors = {
    getHoverHistory?: () => HoverHistoryEntry[];
    getIndexedSymbolCount?: () => number;
    getLastHoverTitle?: () => string | undefined;
    getRecentPackages?: () => Array<{ name: string; count: number }>;
    getSavedDocs?: () => SavedDocEntry[];
};

export class StatusBarManager {
    private item: vscode.StatusBarItem;
    private context: vscode.ExtensionContext;
    private dataAccessors: StatusBarDataAccessors = {};

    /** Cached cache-size string so render() never blocks on repeated dir-walks. */
    private cacheSizeLabel = '…';
    private cacheSizeExpiry = 0;
    /** Whether an async walk is currently in flight (prevents parallel redundant walks). */
    private cacheSizeWalking = false;
    /** Cached extension version — read once from package.json. */
    private cachedVersion: string | undefined;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.item.command = 'python-hover.showStatusNotification';
        this.context.subscriptions.push(this.item);

        this.registerCommands();
        this.render();

        this.context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('python-hover')) {this.render();}
            })
        );
    }

    /** Force a re-render (e.g. after cache wipe). */
    public update() {
        this.cacheSizeExpiry = 0;
        this.render();
    }

    public setDataAccessors(accessors: StatusBarDataAccessors) {
        this.dataAccessors = accessors;
        this.render();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    private render() {
        const cfg = vscode.workspace.getConfiguration('python-hover');
        const showStatusBar = cfg.get<boolean>('ui.showStatusBar', true);
        const online = cfg.get<boolean>('onlineDiscovery', true);
        const version = this.getVersion();
        const cacheSize = this.getCacheSizeInMB();
        const indexedSymbols = this.dataAccessors.getIndexedSymbolCount?.();
        const lastHoverTitle = this.dataAccessors.getLastHoverTitle?.();

        if (!showStatusBar) {
            this.item.hide();
            return;
        }

        this.item.text = `${online ? '$(globe)' : '$(circle-slash)'} PyHover ${cacheSize}`;
        const mode = online ? '$(globe) Online' : '$(circle-slash) Offline';
        const escapedLastHover = lastHoverTitle?.replace(/[`*_{}[\]()+#.!-]/g, '\\$&');
        const tt = new vscode.MarkdownString(
            `**PyHover** v${version}\n\n` +
            `${mode}  ·  $(database) ${cacheSize}${typeof indexedSymbols === 'number' ? `  ·  $(symbol-key) ${indexedSymbols.toLocaleString()} indexed` : ''}\n\n` +
            `${escapedLastHover ? `Last hover: **${escapedLastHover}**\n\n` : ''}` +
            `Click for quick actions like search, browse, hover history, cache tools, and Studio.`
        );
        tt.supportThemeIcons = true;
        this.item.tooltip = tt;

        this.item.backgroundColor = online
            ? undefined
            : new vscode.ThemeColor('statusBarItem.warningBackground');

        this.item.show();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MENU
    // ─────────────────────────────────────────────────────────────────────────

    private registerCommands() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.showStatusNotification', async () => {
                type StatusAction = vscode.QuickPickItem & { command?: string; run?: () => Thenable<unknown> | Promise<void> | void };
                const cfg = vscode.workspace.getConfiguration('python-hover');
                const online = cfg.get<boolean>('onlineDiscovery', true);
                const cacheSize = this.getCacheSizeInMB();
                const recentPackages = this.dataAccessors.getRecentPackages?.().slice(0, 5) ?? [];
                const recentHistory = (this.dataAccessors.getHoverHistory?.() ?? []).filter(entry => !!entry.url).slice(0, 4);
                const savedDocs = this.dataAccessors.getSavedDocs?.().slice(0, 4) ?? [];
                const lastHoverTitle = this.dataAccessors.getLastHoverTitle?.();
                const formatKind = (kind?: string) => kind ? `${kind.charAt(0).toUpperCase()}${kind.slice(1).toLowerCase()}` : undefined;
                const meta = (...parts: Array<string | undefined>) => parts.filter(Boolean).join(' • ');

                const items: StatusAction[] = [
                    { label: 'Session', kind: vscode.QuickPickItemKind.Separator },
                    {
                        label: online ? '$(globe) Online docs enabled' : '$(circle-slash) Online docs disabled',
                        description: `Cache ${cacheSize}`,
                        detail: online
                            ? 'Web docs lookup, inventories, and scraping are available.'
                            : 'Only cached docs and local/runtime sources will be used.',
                        command: 'python-hover.toggleOnlineDiscovery',
                    },
                    ...(lastHoverTitle ? [{
                        label: '$(pin) Last hover target',
                        description: lastHoverTitle,
                        detail: 'Re-pin the latest hover into the inspector or docs panel.',
                        command: 'python-hover.pinLast',
                    }] : []),
                    {
                        label: '$(layout) Open PyHover Studio',
                        description: 'Settings, cache controls, and product-level tuning',
                        command: 'python-hover.openStudio',
                    },
                    {
                        label: '$(settings-gear) Open settings',
                        description: 'Full VS Code settings surface',
                        command: 'workbench.action.openSettings',
                    },
                    { label: 'Explore', kind: vscode.QuickPickItemKind.Separator },
                    {
                        label: '$(search) Search Python docs',
                        description: 'Indexed symbol search',
                        detail: 'Search known docs targets, saved docs, recent items, and package shortcuts.',
                        command: 'python-hover.searchDocs',
                    },
                    {
                        label: '$(symbol-namespace) Browse indexed modules',
                        description: 'Browse packages and modules',
                        detail: 'Open the module picker across standard library and third-party indexes.',
                        command: 'python-hover.browseModule',
                    },
                    { label: 'Recent And Saved', kind: vscode.QuickPickItemKind.Separator },
                    {
                        label: '$(history) Hover history',
                        description: 'Recent symbols you hovered',
                        detail: 'Grouped into live session entries and stored docs links.',
                        command: 'python-hover.showHistory',
                    },
                    ...(recentPackages.length > 0
                        ? [
                            { label: 'Recent Packages', kind: vscode.QuickPickItemKind.Separator },
                            ...recentPackages.map(pkg => ({
                                label: `$(symbol-namespace) ${pkg.name}`,
                                description: `${pkg.count.toLocaleString()} indexed symbols`,
                                detail: 'Open this package in the module browser.',
                                run: () => vscode.commands.executeCommand('python-hover.browseModule', pkg.name),
                            })),
                        ]
                        : []),
                    ...(recentHistory.length > 0
                        ? [
                            { label: 'Recent Docs', kind: vscode.QuickPickItemKind.Separator },
                            ...recentHistory.map(entry => ({
                                label: `${entry.commandToken ? '$(history)' : '$(link-external)'} ${entry.title}`,
                                description: meta(formatKind(entry.kind), entry.module ?? entry.package),
                                detail: entry.commandToken
                                    ? 'Live session entry. Reopen in the inspector if still available.'
                                    : 'Stored docs link. Open the last known documentation target.',
                                run: () => vscode.commands.executeCommand('python-hover.openSidebarHistoryEntry', entry),
                            })),
                        ]
                        : []),
                    ...(savedDocs.length > 0
                        ? [
                            { label: 'Saved Docs', kind: vscode.QuickPickItemKind.Separator },
                            ...savedDocs.map(entry => ({
                                label: `$(bookmark) ${entry.title}`,
                                description: meta(formatKind(entry.kind), entry.module ?? entry.package),
                                detail: entry.summary || 'Saved reading-list target.',
                                run: () => vscode.commands.executeCommand('python-hover.openSavedHoverEntry', entry),
                            })),
                        ]
                        : []),
                    { label: 'Maintenance', kind: vscode.QuickPickItemKind.Separator },
                    {
                        label: '$(book) Build Python corpus',
                        description: 'Fetch richer built-in and keyword docs',
                        detail: 'Populate the stdlib corpus for better offline and builtin hover coverage.',
                        command: 'python-hover.buildPythonCorpus',
                    },
                    {
                        label: '$(trash) Clear documentation cache',
                        description: 'Clear fetched docs and inventories',
                        detail: 'Keeps the Python stdlib corpus intact.',
                        command: 'python-hover.clearCache',
                    },
                    {
                        label: '$(folder-opened) View cache folder',
                        description: `${cacheSize}`,
                        detail: 'Open the PyHover cache folder in Finder.',
                        command: 'python-hover.openCacheFolder',
                    },
                    {
                        label: '$(output) Show logs',
                        description: 'Inspect resolver and cache output',
                        detail: 'Open the PyHover output channel.',
                        command: 'python-hover.showLogs',
                    },
                ];

                const picked = await vscode.window.showQuickPick(items, {
                    title: 'PyHover Command Center',
                    placeHolder: 'Choose a session, navigation, or maintenance action',
                    matchOnDescription: true,
                    matchOnDetail: true,
                });

                if (!picked?.command) {
                    if (picked?.run) {
                        await picked.run();
                    }
                    return;
                }

                if (picked.command === 'workbench.action.openSettings') {
                    await vscode.commands.executeCommand(picked.command, 'python-hover');
                    return;
                }

                await vscode.commands.executeCommand(picked.command);
            })
        );

        // Standalone toggle (usable via keybinding)
        this.context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.toggleOnlineDiscovery', async () => {
                const cfg = vscode.workspace.getConfiguration('python-hover');
                const cur = cfg.get<boolean>('onlineDiscovery', true);
                await updateSettingWithPreferredTarget('python-hover', 'onlineDiscovery', !cur);
                vscode.window.showInformationMessage(
                    `PyHover: online discovery ${!cur ? 'enabled' : 'disabled'}`
                );
            })
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    private getVersion(): string {
        if (this.cachedVersion !== undefined) {return this.cachedVersion;}
        try {
            const pkg = JSON.parse(
                fs.readFileSync(path.join(this.context.extensionPath, 'package.json'), 'utf8')
            );
            this.cachedVersion = pkg.version as string;
        } catch {
            this.cachedVersion = '?';
        }
        return this.cachedVersion!;
    }

    /**
     * Returns the cached cache-size label immediately (never blocks).
     * Kicks off an async walk in the background if the TTL has expired.
     * render() is called again once the walk completes so the UI updates.
     */
    private getCacheSizeInMB(): string {
        const now = Date.now();
        if (now < this.cacheSizeExpiry) {return this.cacheSizeLabel;}
        if (this.cacheSizeWalking) {return this.cacheSizeLabel;}

        this.cacheSizeWalking = true;
        const p = this.getCachePath();
        this.computeCacheSizeAsync(p).then(label => {
            this.cacheSizeLabel = label;
            this.cacheSizeExpiry = Date.now() + 10_000;
            this.cacheSizeWalking = false;
            this.render();
        }).catch(() => {
            this.cacheSizeWalking = false;
        });

        return this.cacheSizeLabel;
    }

    private async computeCacheSizeAsync(dir: string): Promise<string> {
        try {
            await fs.promises.access(dir);
        } catch {
            return '0 MB';
        }
        const total = await this.walkDirAsync(dir);
        return `${(total / 1_048_576).toFixed(1)} MB`;
    }

    private async walkDirAsync(dir: string): Promise<number> {
        let total = 0;
        try {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            await Promise.all(entries.map(async entry => {
                const fp = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    total += await this.walkDirAsync(fp);
                } else {
                    try {
                        const st = await fs.promises.stat(fp);
                        total += st.size;
                    } catch { /* ignore */ }
                }
            }));
        } catch { /* ignore */ }
        return total;
    }

    private getCachePath(): string {
        return path.join(this.context.globalStorageUri.fsPath, PYHOVER_CACHE_DIR_NAME);
    }
}
