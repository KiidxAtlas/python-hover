import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { PYHOVER_CACHE_DIR_NAME } from '../../../docs-engine/src/cache/diskCache';

export class StatusBarManager {
    private item: vscode.StatusBarItem;
    private corpusItem: vscode.StatusBarItem;
    private context: vscode.ExtensionContext;

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
        this.corpusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 101);
        this.corpusItem.command = 'python-hover.buildPythonCorpus';
        this.context.subscriptions.push(this.item);
        this.context.subscriptions.push(this.corpusItem);

        this.registerCommands();
        this.render();

        this.context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('python-hover')) this.render();
            })
        );
    }

    /** Force a re-render (e.g. after cache wipe). */
    public update() {
        this.cacheSizeExpiry = 0;
        this.render();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    private render() {
        const cfg = vscode.workspace.getConfiguration('python-hover');
        const online = cfg.get<boolean>('onlineDiscovery', true);
        const version = this.getVersion();
        const cacheSize = this.getCacheSizeInMB();

        this.item.text = `${online ? '$(globe)' : '$(circle-slash)'} PyHover ${cacheSize}`;
        const mode = online ? '$(globe) Online' : '$(circle-slash) Offline';
        const tt = new vscode.MarkdownString(
            `**PyHover** v${version}\n\n` +
            `${mode}  ·  $(database) ${cacheSize}\n\n` +
            `Click for quick actions like search, browse, corpus tools, and Studio.`
        );
        tt.supportThemeIcons = true;
        this.item.tooltip = tt;
        this.corpusItem.text = '$(book) Build Corpus';

        const corpusTooltip = new vscode.MarkdownString(
            'Build the Python stdlib corpus once for richer built-in and keyword hovers.\n\n' +
            'Clear Cache keeps the Python corpus intact.'
        );
        this.corpusItem.tooltip = corpusTooltip;

        this.item.backgroundColor = online
            ? undefined
            : new vscode.ThemeColor('statusBarItem.warningBackground');

        this.item.show();
        this.corpusItem.show();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MENU
    // ─────────────────────────────────────────────────────────────────────────

    private registerCommands() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand('python-hover.showStatusNotification', async () => {
                type StatusAction = vscode.QuickPickItem & { command?: string };
                const cfg = vscode.workspace.getConfiguration('python-hover');
                const online = cfg.get<boolean>('onlineDiscovery', true);
                const cacheSize = this.getCacheSizeInMB();

                const items: StatusAction[] = [
                    { label: 'Workspace', kind: vscode.QuickPickItemKind.Separator },
                    {
                        label: online ? '$(globe) Online discovery: on' : '$(circle-slash) Online discovery: off',
                        description: `Cache ${cacheSize}`,
                        command: 'python-hover.toggleOnlineDiscovery',
                    },
                    {
                        label: '$(book) Build Python corpus',
                        description: 'Fetch richer built-in and keyword docs',
                        command: 'python-hover.buildPythonCorpus',
                    },
                    {
                        label: '$(trash) Clear documentation cache',
                        description: 'Keeps the Python corpus intact',
                        command: 'python-hover.clearCache',
                    },
                    { label: 'Explore', kind: vscode.QuickPickItemKind.Separator },
                    {
                        label: '$(search) Search Python docs',
                        description: 'Jump straight to indexed symbol search',
                        command: 'python-hover.searchDocs',
                    },
                    {
                        label: '$(symbol-namespace) Browse indexed modules',
                        description: 'Open the module picker from cached indexes',
                        command: 'python-hover.browseModule',
                    },
                    {
                        label: '$(layout) Open PyHover Studio',
                        description: 'Open the full workspace panel only when you need it',
                        command: 'python-hover.openStudio',
                    },
                    { label: 'History', kind: vscode.QuickPickItemKind.Separator },
                    {
                        label: '$(history) Hover history',
                        description: 'Recent symbols you hovered',
                        command: 'python-hover.showHistory',
                    },
                    {
                        label: '$(pin) Pin last hover',
                        description: 'Re-pin the most recently hovered symbol to the docs panel',
                        command: 'python-hover.pinLast',
                    },
                    { label: 'Cache', kind: vscode.QuickPickItemKind.Separator },
                    {
                        label: '$(folder-opened) View cache folder',
                        description: `${cacheSize} — open in file explorer`,
                        command: 'python-hover.openCacheFolder',
                    },
                    { label: 'Support', kind: vscode.QuickPickItemKind.Separator },
                    {
                        label: '$(settings-gear) Open settings',
                        description: 'Configure PyHover behavior',
                        command: 'workbench.action.openSettings',
                    },
                    {
                        label: '$(output) Show logs',
                        description: 'Inspect resolver and cache output',
                        command: 'python-hover.showLogs',
                    },
                    {
                        label: '$(heart) Sponsor PyHover',
                        description: 'Support development on GitHub Sponsors',
                        command: 'python-hover.openSponsor',
                    },
                    {
                        label: '$(coffee) Buy Me a Coffee',
                        description: 'One-time donation via buymeacoffee.com',
                        command: 'python-hover.openDonate',
                    },
                ];

                const picked = await vscode.window.showQuickPick(items, {
                    title: 'PyHover Actions',
                    placeHolder: 'Choose a PyHover action',
                    matchOnDescription: true,
                });

                if (!picked?.command) {
                    return;
                }

                if (picked.command === 'workbench.action.openSettings') {
                    await vscode.commands.executeCommand(picked.command, 'python-hover');
                    return;
                }

                if (picked.command === 'python-hover.openSponsor') {
                    await vscode.env.openExternal(vscode.Uri.parse('https://github.com/sponsors/KiidxAtlas'));
                    return;
                }

                if (picked.command === 'python-hover.openDonate') {
                    await vscode.env.openExternal(vscode.Uri.parse('https://buymeacoffee.com/kiidxatlas'));
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
                await cfg.update('onlineDiscovery', !cur, vscode.ConfigurationTarget.Global);
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
        if (this.cachedVersion !== undefined) return this.cachedVersion;
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
        if (now < this.cacheSizeExpiry) return this.cacheSizeLabel;
        if (this.cacheSizeWalking) return this.cacheSizeLabel;

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
