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

    const hoverProviderDisposable = vscode.languages.registerHoverProvider(
        { language: 'python' },
        hoverProvider
    );

    context.subscriptions.push(hoverProviderDisposable);

    // Ensure proper disposal
    context.subscriptions.push({
        dispose: () => hoverProvider.dispose()
    });

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
