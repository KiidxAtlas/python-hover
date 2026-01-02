import * as vscode from 'vscode';
import { DiskCache } from '../../docs-engine/src/cache/diskCache';
import { Config } from './config';
import { HoverProvider } from './hoverProvider';
import { Logger } from './logger';
import { LspClient } from './lspClient';
import { StatusBarManager } from './ui/statusBar';

export function activate(context: vscode.ExtensionContext) {
    Logger.initialize('PyHover');
    Logger.log('PyHover is now active!');

    try {
        const config = new Config();
        const lspClient = new LspClient();
        const statusBarManager = new StatusBarManager(context);

        // Initialize Cache with TTL from settings
        const globalStoragePath = context.globalStorageUri.fsPath;
        const diskCache = new DiskCache(
            globalStoragePath,
            () => statusBarManager.update(),
            {
                inventoryDays: config.inventoryCacheDays,
                snippetHours: config.snippetCacheHours
            }
        );

        const hoverProvider = new HoverProvider(lspClient, config, diskCache);

        // Broaden selector to match any python file (untitled, file, etc)
        const selector: vscode.DocumentSelector = { language: 'python' };

        Logger.log('Registering HoverProvider...');
        const registration = vscode.languages.registerHoverProvider(selector, hoverProvider);
        context.subscriptions.push(registration);

        // Register Copy URL command
        context.subscriptions.push(vscode.commands.registerCommand('python-hover.copyUrl', async (url: string) => {
            if (url) {
                await vscode.env.clipboard.writeText(url);
                vscode.window.showInformationMessage('URL copied to clipboard');
            }
        }));

        // Register Clear Cache command
        context.subscriptions.push(vscode.commands.registerCommand('python-hover.clearCache', () => {
            diskCache.clear();
            vscode.window.showInformationMessage('PyHover cache cleared.');
            Logger.log('Cache cleared via command.');
        }));

        Logger.log('HoverProvider registered successfully.');
    } catch (e) {
        Logger.error('Failed to activate PyHover', e);
    }
}

export function deactivate() {
    Logger.dispose();
}
