import * as vscode from 'vscode';
import { CacheManager } from './cache';
import { ConfigurationManager } from './config';
import { PythonHoverProvider } from './hoverProvider';
import { InventoryManager } from './inventory';
import { VersionDetector } from './versionDetector';

export function activate(context: vscode.ExtensionContext) {
    // Debug logging
    console.log('[PythonHover] Extension is being activated');

    // Initialize managers
    const configManager = new ConfigurationManager();
    const cacheManager = new CacheManager(context.globalStorageUri);
    const inventoryManager = new InventoryManager(cacheManager);
    const versionDetector = new VersionDetector(configManager);

    console.log('[PythonHover] Managers initialized');

    // Create and register hover provider
    const hoverProvider = new PythonHoverProvider(
        configManager,
        inventoryManager,
        versionDetector,
        cacheManager
    );

    const disposable = vscode.languages.registerHoverProvider(
        { language: 'python' },
        hoverProvider
    );

    console.log('[PythonHover] Hover provider registered for Python language');

    context.subscriptions.push(disposable);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('pythonHover.clearCache', async () => {
            try {
                const stats = await cacheManager.clear();
                await inventoryManager.invalidateCache();

                // Show detailed feedback
                const message = `Cache cleared successfully! Deleted ${stats.filesDeleted} files.`;
                vscode.window.showInformationMessage(message);
                console.log(`[PythonHover] ${message}`);
            } catch (error) {
                const errorMessage = `Failed to clear cache: ${error}`;
                vscode.window.showErrorMessage(errorMessage);
                console.error(`[PythonHover] ${errorMessage}`);
            }
        })
    );

    // Register command to open documentation URL
    context.subscriptions.push(
        vscode.commands.registerCommand('pythonHover.openDocumentation', (url: string) => {
            vscode.env.openExternal(vscode.Uri.parse(url));
        })
    );

    // Register configuration change handler
    const configDisposable = vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
        if (event.affectsConfiguration('pythonHover')) {
            configManager.refresh();
        }
    });

    context.subscriptions.push(configDisposable);
}

export function deactivate() {
    // Cleanup if needed
}
