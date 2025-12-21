import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Logger } from '../logger';

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
            const config = vscode.workspace.getConfiguration('python-hover');
            const onlineDiscovery = config.get<boolean>('onlineDiscovery', true);

            const toggleAction = onlineDiscovery ? 'Disable Online' : 'Enable Online';
            const openOutputAction = 'Output';
            const openCacheAction = 'Cache Folder';
            const clearCacheAction = 'Clear Cache';
            const supportAction = 'Support';

            const selection = await vscode.window.showInformationMessage(
                `PyHover v${version}`,
                toggleAction,
                openOutputAction,
                openCacheAction,
                clearCacheAction,
                supportAction
            );

            if (selection === toggleAction) {
                await config.update('onlineDiscovery', !onlineDiscovery, vscode.ConfigurationTarget.Global);
                // Status bar updates via listener
            } else if (selection === openOutputAction) {
                Logger.show();
            } else if (selection === openCacheAction) {
                this.openCacheLocation();
            } else if (selection === clearCacheAction) {
                // Clear cache without confirmation as requested
                const cachePath = this.getCachePath();
                try {
                    if (fs.existsSync(cachePath)) {
                        fs.rmSync(cachePath, { recursive: true, force: true });
                        vscode.window.showInformationMessage('PyHover cache cleared.');
                    } else {
                        vscode.window.showInformationMessage('Cache is already empty.');
                    }
                    this.updateStatusBar();
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to clear cache: ${error}`);
                }
            } else if (selection === supportAction) {
                vscode.env.openExternal(vscode.Uri.parse('https://buymeacoffee.com/kiidxatlas'));
            }
        }));

        // Keep the toggle command for keybindings if needed, but it's not used by status bar anymore
        this.context.subscriptions.push(vscode.commands.registerCommand('python-hover.toggleOnlineDiscovery', async () => {
            const config = vscode.workspace.getConfiguration('python-hover');
            const onlineDiscovery = config.get<boolean>('onlineDiscovery', true);
            await config.update('onlineDiscovery', !onlineDiscovery, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Online Discovery ${!onlineDiscovery ? 'Enabled' : 'Disabled'}`);
        }));
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
        const version = this.getVersion();
        const cacheSize = this.getCacheSizeInMB();
        const config = vscode.workspace.getConfiguration('python-hover');
        const onlineDiscovery = config.get<boolean>('onlineDiscovery', true);

        const icon = onlineDiscovery ? '$(globe)' : '$(circle-slash)';
        this.statusBarItem.text = `${icon} PyHover ${version} (${cacheSize})`;
        this.statusBarItem.tooltip = `PyHover Status: ${onlineDiscovery ? 'Online' : 'Offline'} (Click to toggle)`;
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

    private async clearCache() {
        const cachePath = this.getCachePath();
        const confirm = await vscode.window.showWarningMessage(
            'Are you sure you want to clear the PyHover cache?',
            'Yes',
            'No'
        );

        if (confirm === 'Yes') {
            try {
                if (fs.existsSync(cachePath)) {
                    fs.rmSync(cachePath, { recursive: true, force: true });
                    vscode.window.showInformationMessage('PyHover cache cleared.');
                } else {
                    vscode.window.showInformationMessage('Cache is already empty.');
                }
                this.updateStatusBar();
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to clear cache: ${error}`);
            }
        }
    }
}
