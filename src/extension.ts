import * as vscode from 'vscode';
import { CacheManager } from './cache';
import { ConfigurationManager } from './config';
import { PythonHoverProvider } from './hoverProvider';
import { InventoryManager } from './inventory';
import { VersionDetector } from './versionDetector';

export function activate(context: vscode.ExtensionContext) {
    console.log('[PythonHover] 🐍 Extension activating...');

    // Initialize managers
    const configManager = new ConfigurationManager();
    const cacheManager = new CacheManager(context.globalStorageUri);
    const inventoryManager = new InventoryManager(cacheManager);
    const versionDetector = new VersionDetector(configManager);

    // Register hover provider
    const hoverProvider = new PythonHoverProvider(
        configManager,
        inventoryManager,
        versionDetector,
        cacheManager
    );

    context.subscriptions.push(
        vscode.languages.registerHoverProvider({ language: 'python' }, hoverProvider)
    );

    // Register clear cache command
    context.subscriptions.push(
        vscode.commands.registerCommand('pythonHover.clearCache', async () => {
            try {
                const stats = await cacheManager.clear();
                await inventoryManager.invalidateCache();
                vscode.window.showInformationMessage(
                    `✅ Cache cleared! Deleted ${stats.filesDeleted} files.`
                );
            } catch (error) {
                vscode.window.showErrorMessage(`❌ Failed to clear cache: ${error}`);
                console.error('[PythonHover] Cache clear error:', error);
            }
        })
    );

    // Register command to open documentation URL (makes links clickable)
    context.subscriptions.push(
        vscode.commands.registerCommand('pythonHover.openDocs', (url: string) => {
            if (url && url.startsWith('http')) {
                vscode.env.openExternal(vscode.Uri.parse(url));
            }
        })
    );

    // Register command to copy documentation URL
    context.subscriptions.push(
        vscode.commands.registerCommand('pythonHover.copyUrl', (url: string) => {
            if (url) {
                vscode.env.clipboard.writeText(url);
                vscode.window.showInformationMessage('📋 URL copied to clipboard!');
            }
        })
    );

    // Handle configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
            if (event.affectsConfiguration('pythonHover')) {
                configManager.refresh();
            }
        })
    );

    console.log('[PythonHover] ✅ Extension activated successfully');
}

export function deactivate() {
    console.log('[PythonHover] Extension deactivated');
}
