import * as vscode from 'vscode';
import { CacheManager } from './cache';
import { ConfigurationManager } from './config';
import { PythonHoverProvider } from './hoverProvider';
import { InventoryManager } from './inventory';
import { VersionDetector } from './versionDetector';
import { Logger } from './logger';

export function activate(context: vscode.ExtensionContext) {
    // Initialize configuration first
    const configManager = new ConfigurationManager();
    
    // Initialize logger with configuration
    const logger = Logger.getInstance(configManager);
    logger.info('🐍 Extension activating...');

    // Initialize managers
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

    const hoverProviderDisposable = vscode.languages.registerHoverProvider(
        { language: 'python' },
        hoverProvider
    );

    context.subscriptions.push(hoverProviderDisposable);

    // Ensure proper disposal
    context.subscriptions.push({
        dispose: () => hoverProvider.dispose()
    });

    // Create status bar item
    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    
    statusBarItem.text = '$(database) Python Docs';
    statusBarItem.tooltip = 'Python Hover: Click to view cache info';
    statusBarItem.command = 'pythonHover.showCacheInfo';
    statusBarItem.show();
    
    context.subscriptions.push(statusBarItem);
    
    // Function to update status bar with cache stats
    async function updateStatusBar() {
        try {
            const stats = await cacheManager.getStats();
            if (stats && stats.totalSize !== undefined) {
                const sizeMB = (stats.totalSize / (1024 * 1024)).toFixed(1);
                statusBarItem.text = `$(database) ${sizeMB}MB`;
                statusBarItem.tooltip = `Python Hover Cache\n${stats.fileCount} files • ${sizeMB}MB\nClick for details`;
            }
        } catch (error) {
            logger.error('Failed to update status bar:', error);
            statusBarItem.text = '$(database) Python Docs';
        }
    }
    
    // Update status bar every 30 seconds
    const statusBarInterval = setInterval(updateStatusBar, 30000);
    context.subscriptions.push({
        dispose: () => clearInterval(statusBarInterval)
    });
    
    // Initial update
    updateStatusBar();
    
    // Register command to show cache info
    context.subscriptions.push(
        vscode.commands.registerCommand('pythonHover.showCacheInfo', async () => {
            try {
                const stats = await cacheManager.getStats();
                const sizeMB = (stats.totalSize / (1024 * 1024)).toFixed(2);
                const sizeKB = (stats.totalSize / 1024).toFixed(0);
                
                const message = `📦 **Python Hover Cache**\n\n` +
                    `📁 Files: ${stats.fileCount}\n` +
                    `💾 Size: ${sizeMB} MB (${sizeKB} KB)\n` +
                    `📍 Location: ${stats.cacheDir || 'Global storage'}\n\n` +
                    `Cache includes documentation snippets and Intersphinx inventories for faster hover responses.`;
                
                const action = await vscode.window.showInformationMessage(
                    message,
                    'Clear Cache',
                    'Open Location',
                    'Close'
                );
                
                if (action === 'Clear Cache') {
                    await vscode.commands.executeCommand('pythonHover.clearCache');
                    updateStatusBar();
                } else if (action === 'Open Location' && stats.cacheDir) {
                    await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(stats.cacheDir));
                }
            } catch (error) {
                logger.error('Failed to show cache info:', error);
                vscode.window.showErrorMessage('Failed to retrieve cache information');
            }
        })
    );

    // Register clear cache command
    context.subscriptions.push(
        vscode.commands.registerCommand('pythonHover.clearCache', async () => {
            try {
                const stats = await cacheManager.clear();
                await inventoryManager.invalidateCache();
                updateStatusBar(); // Update status bar after clearing cache
                vscode.window.showInformationMessage(
                    `✅ Cache cleared! Deleted ${stats.filesDeleted} files.`
                );
            } catch (error) {
                vscode.window.showErrorMessage(`❌ Failed to clear cache: ${error}`);
                logger.error('Cache clear error:', error);
            }
        })
    );

    // Register command to open documentation URL (respects openDocsInEditor setting)
    context.subscriptions.push(
        vscode.commands.registerCommand('pythonHover.openDocs', (url: string) => {
            if (url && url.startsWith('http')) {
                const config = vscode.workspace.getConfiguration('pythonHover');
                const openInEditor = config.get<boolean>('openDocsInEditor', false);

                if (openInEditor) {
                    // Open in VS Code's Simple Browser
                    vscode.commands.executeCommand('simpleBrowser.show', url);
                } else {
                    // Open in external browser
                    vscode.env.openExternal(vscode.Uri.parse(url));
                }
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

    // Register insert example command
    context.subscriptions.push(
        vscode.commands.registerCommand('pythonHover.insertExample', (code: string) => {
            const editor = vscode.window.activeTextEditor;
            if (editor && code) {
                const snippet = new vscode.SnippetString(code);
                editor.insertSnippet(snippet);
                vscode.window.showInformationMessage('✅ Example inserted!');
            }
        })
    );

    // Register font size increase command
    context.subscriptions.push(
        vscode.commands.registerCommand('pythonHover.increaseFontSize', async () => {
            const config = vscode.workspace.getConfiguration('pythonHover');
            const sizes = ['small', 'medium', 'large'];
            const currentSize = config.get<string>('fontSize', 'medium');
            const currentIndex = sizes.indexOf(currentSize);

            if (currentIndex < sizes.length - 1) {
                const newSize = sizes[currentIndex + 1];
                await config.update('fontSize', newSize, vscode.ConfigurationTarget.Global);
                hoverProvider.refreshTheme();
                vscode.window.showInformationMessage(`🔤 Font size: ${newSize}`);
            } else {
                vscode.window.showInformationMessage('Already at maximum font size');
            }
        })
    );

    // Register font size decrease command
    context.subscriptions.push(
        vscode.commands.registerCommand('pythonHover.decreaseFontSize', async () => {
            const config = vscode.workspace.getConfiguration('pythonHover');
            const sizes = ['small', 'medium', 'large'];
            const currentSize = config.get<string>('fontSize', 'medium');
            const currentIndex = sizes.indexOf(currentSize);

            if (currentIndex > 0) {
                const newSize = sizes[currentIndex - 1];
                await config.update('fontSize', newSize, vscode.ConfigurationTarget.Global);
                hoverProvider.refreshTheme();
                vscode.window.showInformationMessage(`🔤 Font size: ${newSize}`);
            } else {
                vscode.window.showInformationMessage('Already at minimum font size');
            }
        })
    );

    // Handle configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
            if (event.affectsConfiguration('pythonHover')) {
                configManager.refresh();
                hoverProvider.refreshTheme();
            }
        })
    );

    console.log('[PythonHover] ✅ Extension activated successfully');
}

export function deactivate() {
    console.log('[PythonHover] Extension deactivated');
}
