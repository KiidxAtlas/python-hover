import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Logger } from '../logger';

interface MenuItem extends vscode.QuickPickItem {
    action: string;
}

const SEP: MenuItem = { label: '', kind: vscode.QuickPickItemKind.Separator, action: '' };

export class StatusBarManager {
    private item: vscode.StatusBarItem;
    private context: vscode.ExtensionContext;
    private symbolCount = 0;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.item.command = 'python-hover.showStatusNotification';
        this.context.subscriptions.push(this.item);

        this.registerCommands();
        this.render();

        this.context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('python-hover')) this.render();
            })
        );
    }

    /** Called by HoverProvider after inventories load to refresh the symbol count label. */
    setSymbolCount(n: number) {
        this.symbolCount = n;
        this.render();
    }

    /** Force a re-render (e.g. after cache wipe). */
    public update() { this.render(); }

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    private render() {
        const cfg = vscode.workspace.getConfiguration('python-hover');
        const online = cfg.get<boolean>('onlineDiscovery', true);
        const version = this.getVersion();

        this.item.text = `${online ? '$(globe)' : '$(circle-slash)'} PyHover`;

        const cacheSize = this.getCacheSizeInMB();
        const mode = online ? '$(globe) Online' : '$(circle-slash) Offline';
        const tt = new vscode.MarkdownString(
            `**PyHover** v${version}\n\n` +
            `${mode}  ·  $(database) ${cacheSize}\n\n` +
            `*Click for options*`
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
                const cfg = vscode.workspace.getConfiguration('python-hover');
                const online = cfg.get<boolean>('onlineDiscovery', true);
                const debug = cfg.get<boolean>('enableDebugLogging', false);
                const version = this.getVersion();
                const cacheSize = this.getCacheSizeInMB();

                const items: MenuItem[] = [
                    // ── Mode ─────────────────────────────────────────────────
                    {
                        label: online
                            ? '$(globe) Online Mode  $(check)'
                            : '$(circle-slash) Offline Mode',
                        description: online
                            ? 'Docs fetched from web  ·  click to go offline'
                            : 'Using local cache only  ·  click to go online',
                        action: 'toggle-online',
                    },

                    // ── Documentation ─────────────────────────────────────────
                    { ...SEP, label: 'Documentation' },
                    {
                        label: '$(search) Search Docs…',
                        description: 'Ctrl+K Ctrl+D',
                        detail: this.symbolCount > 0
                            ? `Search across ${this.symbolCount.toLocaleString()} indexed symbols`
                            : 'Search indexed Python symbols',
                        action: 'search',
                    },
                    {
                        label: '$(pin) Pin Last Hover',
                        description: 'Open pinned documentation panel',
                        action: 'pin',
                    },

                    // ── Cache ─────────────────────────────────────────────────
                    { ...SEP, label: 'Cache' },
                    {
                        label: `$(database) Cache — ${cacheSize}`,
                        description: 'Click to open cache folder',
                        action: 'open-cache',
                    },
                    {
                        label: '$(trash) Clear Cache',
                        description: 'Delete all cached documentation',
                        action: 'clear-cache',
                    },

                    // ── Settings ──────────────────────────────────────────────
                    { ...SEP, label: 'Settings' },
                    {
                        label: '$(output) View Logs',
                        description: 'Open PyHover output channel',
                        action: 'logs',
                    },
                    {
                        label: debug
                            ? '$(bug) Debug Logging  $(check)'
                            : '$(bug) Debug Logging',
                        description: debug
                            ? 'Verbose logging on — click to disable'
                            : 'Click to enable verbose logging',
                        action: 'toggle-debug',
                    },
                    {
                        label: '$(gear) Open Settings',
                        description: 'Configure PyHover options',
                        action: 'settings',
                    },

                    // ── Links ─────────────────────────────────────────────────
                    { ...SEP, label: 'Links' },
                    {
                        label: '$(github) GitHub',
                        description: 'Report bugs · request features · contribute',
                        action: 'github',
                    },
                    {
                        label: '$(heart) Sponsor',
                        description: 'Buy me a coffee ☕',
                        action: 'sponsor',
                    },
                ];

                const qp = vscode.window.createQuickPick<MenuItem>();
                qp.title = `🐍 PyHover v${version}`;
                qp.placeholder = 'Select an action…';
                qp.items = items;
                qp.matchOnDescription = true;

                qp.onDidAccept(async () => {
                    const sel = qp.selectedItems[0];
                    qp.hide();
                    if (!sel) return;

                    switch (sel.action) {
                        case 'toggle-online': {
                            const next = !online;
                            await cfg.update('onlineDiscovery', next, vscode.ConfigurationTarget.Global);
                            vscode.window.showInformationMessage(
                                `PyHover: online discovery ${next ? 'enabled' : 'disabled'}`
                            );
                            break;
                        }
                        case 'search':
                            vscode.commands.executeCommand('python-hover.searchDocs');
                            break;
                        case 'pin':
                            vscode.commands.executeCommand('python-hover.pinHover');
                            break;
                        case 'open-cache':
                            this.openCacheFolder();
                            break;
                        case 'clear-cache':
                            await this.clearCache();
                            break;
                        case 'logs':
                            Logger.show();
                            break;
                        case 'toggle-debug': {
                            const next = !debug;
                            await cfg.update('enableDebugLogging', next, vscode.ConfigurationTarget.Global);
                            vscode.window.showInformationMessage(
                                `PyHover: debug logging ${next ? 'enabled' : 'disabled'}`
                            );
                            break;
                        }
                        case 'settings':
                            vscode.commands.executeCommand(
                                'workbench.action.openSettings',
                                'python-hover'
                            );
                            break;
                        case 'github':
                            vscode.env.openExternal(
                                vscode.Uri.parse('https://github.com/KiidxAtlas/python-hover')
                            );
                            break;
                        case 'sponsor':
                            vscode.env.openExternal(
                                vscode.Uri.parse('https://buymeacoffee.com/kiidxatlas')
                            );
                            break;
                    }
                });

                qp.onDidHide(() => qp.dispose());
                qp.show();
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

    private async clearCache() {
        const p = this.getCachePath();
        try {
            if (fs.existsSync(p)) {
                fs.rmSync(p, { recursive: true, force: true });
                vscode.window.showInformationMessage('$(check) PyHover cache cleared');
            } else {
                vscode.window.showInformationMessage('PyHover cache is already empty');
            }
            this.render();
        } catch (e) {
            vscode.window.showErrorMessage(`PyHover: failed to clear cache — ${e}`);
        }
    }

    private openCacheFolder() {
        const p = this.getCachePath();
        if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
        vscode.env.openExternal(vscode.Uri.file(p));
    }

    private getVersion(): string {
        try {
            const pkg = JSON.parse(
                fs.readFileSync(path.join(this.context.extensionPath, 'package.json'), 'utf8')
            );
            return pkg.version as string;
        } catch { return '?'; }
    }

    private getCacheSizeInMB(): string {
        const p = this.getCachePath();
        if (!fs.existsSync(p)) return '0 MB';
        let total = 0;
        const walk = (dir: string) => {
            try {
                for (const f of fs.readdirSync(dir)) {
                    const fp = path.join(dir, f);
                    const st = fs.statSync(fp);
                    if (st.isDirectory()) walk(fp);
                    else total += st.size;
                }
            } catch { /* ignore */ }
        };
        walk(p);
        return `${(total / 1_048_576).toFixed(1)} MB`;
    }

    private getCachePath(): string {
        return path.join(this.context.globalStorageUri.fsPath, 'pyhover_cache');
    }
}
