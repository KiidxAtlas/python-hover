import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Logger } from '../logger';

interface StatusMenuItem extends vscode.QuickPickItem {
    action: string;
}

export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'python-hover.showStatusNotification';
        this.context.subscriptions.push(this.statusBarItem);

        this.registerCommands();
        this.updateStatusBar();

        // Listen for config changes
        this.context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('python-hover.onlineDiscovery')) {
                this.updateStatusBar();
            }
        }));
    }

    private registerCommands() {
        this.context.subscriptions.push(vscode.commands.registerCommand('python-hover.showStatusNotification', async () => {
            const version = this.getVersion();
            const cacheSize = this.getCacheSizeInMB();
            const config = vscode.workspace.getConfiguration('python-hover');
            const onlineDiscovery = config.get<boolean>('onlineDiscovery', true);

            const items: StatusMenuItem[] = [
                {
                    label: onlineDiscovery ? '$(globe) Online Mode' : '$(circle-slash) Offline Mode',
                    description: onlineDiscovery ? 'Fetching docs from web' : 'Using local cache only',
                    detail: 'Click to toggle online/offline mode',
                    action: 'toggle'
                },
                {
                    label: '$(output) View Logs',
                    description: 'Open extension output',
                    action: 'output'
                },
                {
                    label: '$(folder) Open Cache',
                    description: cacheSize,
                    action: 'cache'
                },
                {
                    label: '$(trash) Clear Cache',
                    description: 'Delete all cached documentation',
                    action: 'clear'
                },
                {
                    label: '',
                    kind: vscode.QuickPickItemKind.Separator,
                    action: ''
                },
                {
                    label: '$(github) GitHub',
                    description: 'Report issues & contribute',
                    action: 'github'
                },
                {
                    label: '$(heart) Support',
                    description: 'Buy me a coffee ☕',
                    action: 'support'
                }
            ];

            const quickPick = vscode.window.createQuickPick<StatusMenuItem>();
            quickPick.title = `PyHover v${version}`;
            quickPick.placeholder = 'Select an action...';
            quickPick.items = items;
            quickPick.matchOnDescription = true;

            quickPick.onDidAccept(async () => {
                const selected = quickPick.selectedItems[0];
                quickPick.hide();

                if (!selected) return;

                switch (selected.action) {
                    case 'toggle':
                        await config.update('onlineDiscovery', !onlineDiscovery, vscode.ConfigurationTarget.Global);
                        const newState = !onlineDiscovery ? 'enabled' : 'disabled';
                        vscode.window.showInformationMessage(`Online discovery ${newState}`);
                        break;
                    case 'output':
                        Logger.show();
                        break;
                    case 'cache':
                        this.openCacheLocation();
                        break;
                    case 'clear':
                        await this.clearCacheQuick();
                        break;
                    case 'github':
                        vscode.env.openExternal(vscode.Uri.parse('https://github.com/KiidxAtlas/python-hover'));
                        break;
                    case 'support':
                        vscode.env.openExternal(vscode.Uri.parse('https://buymeacoffee.com/kiidxatlas'));
                        break;
                }
            });

            quickPick.onDidHide(() => quickPick.dispose());
            quickPick.show();
        }));

        // Keep the toggle command for keybindings
        this.context.subscriptions.push(vscode.commands.registerCommand('python-hover.toggleOnlineDiscovery', async () => {
            const config = vscode.workspace.getConfiguration('python-hover');
            const onlineDiscovery = config.get<boolean>('onlineDiscovery', true);
            await config.update('onlineDiscovery', !onlineDiscovery, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Online Discovery ${!onlineDiscovery ? 'Enabled' : 'Disabled'}`);
        }));
    }

    private async clearCacheQuick() {
        const cachePath = this.getCachePath();
        try {
            if (fs.existsSync(cachePath)) {
                fs.rmSync(cachePath, { recursive: true, force: true });
                vscode.window.showInformationMessage('$(check) Cache cleared');
            } else {
                vscode.window.showInformationMessage('Cache is already empty');
            }
            this.updateStatusBar();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to clear cache: ${error}`);
        }
    }


    private getVersion(): string {
        try {
            const packageJsonPath = path.join(this.context.extensionPath, 'package.json');
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            return packageJson.version;
        } catch (e) {
            return 'Unknown';
        }
    }

    private getCacheSizeInMB(): string {
        const cachePath = this.getCachePath();
        if (!fs.existsSync(cachePath)) {
            return '0.00 MB';
        }

        let totalSize = 0;

        const calculateSize = (dirPath: string) => {
            try {
                const files = fs.readdirSync(dirPath);
                for (const file of files) {
                    const filePath = path.join(dirPath, file);
                    const stats = fs.statSync(filePath);
                    if (stats.isDirectory()) {
                        calculateSize(filePath);
                    } else {
                        totalSize += stats.size;
                    }
                }
            } catch (e) {
                // Ignore errors accessing files
            }
        };

        calculateSize(cachePath);
        const sizeInMB = totalSize / (1024 * 1024);
        return sizeInMB.toFixed(2) + ' MB';
    }

    public update() {
        this.updateStatusBar();
    }

    private updateStatusBar() {
        const cacheSize = this.getCacheSizeInMB();
        const config = vscode.workspace.getConfiguration('python-hover');
        const onlineDiscovery = config.get<boolean>('onlineDiscovery', true);

        // Clean, minimal status bar text
        const icon = onlineDiscovery ? '$(python)' : '$(python)$(circle-slash)';
        this.statusBarItem.text = `${icon} ${cacheSize}`;

        // Rich tooltip with full details
        const mode = onlineDiscovery ? '🌐 Online' : '📴 Offline';
        this.statusBarItem.tooltip = new vscode.MarkdownString(
            `**PyHover** v${this.getVersion()}\n\n` +
            `${mode} · Cache: ${cacheSize}\n\n` +
            `_Click for options_`
        );
        this.statusBarItem.tooltip.supportThemeIcons = true;

        // Color indicator for offline mode
        this.statusBarItem.backgroundColor = onlineDiscovery
            ? undefined
            : new vscode.ThemeColor('statusBarItem.warningBackground');

        this.statusBarItem.show();
    }

    private getCachePath(): string {
        // Use globalStorageUri for persistent cache
        return path.join(this.context.globalStorageUri.fsPath, 'pyhover_cache');
    }

    private openCacheLocation() {
        const cachePath = this.getCachePath();
        // Ensure it exists before opening
        if (!fs.existsSync(cachePath)) {
            fs.mkdirSync(cachePath, { recursive: true });
        }
        vscode.env.openExternal(vscode.Uri.file(cachePath));
    }
}
