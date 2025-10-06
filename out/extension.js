"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const cache_1 = require("./cache");
const config_1 = require("./config");
const hoverProvider_1 = require("./hoverProvider");
const inventory_1 = require("./inventory");
const versionDetector_1 = require("./versionDetector");
function activate(context) {
    console.log('[PythonHover] 🐍 Extension activating...');
    // Initialize managers
    const configManager = new config_1.ConfigurationManager();
    const cacheManager = new cache_1.CacheManager(context.globalStorageUri);
    const inventoryManager = new inventory_1.InventoryManager(cacheManager);
    const versionDetector = new versionDetector_1.VersionDetector(configManager);
    // Register hover provider
    const hoverProvider = new hoverProvider_1.PythonHoverProvider(configManager, inventoryManager, versionDetector, cacheManager);
    context.subscriptions.push(vscode.languages.registerHoverProvider({ language: 'python' }, hoverProvider));
    // Register clear cache command
    context.subscriptions.push(vscode.commands.registerCommand('pythonHover.clearCache', async () => {
        try {
            const stats = await cacheManager.clear();
            await inventoryManager.invalidateCache();
            vscode.window.showInformationMessage(`✅ Cache cleared! Deleted ${stats.filesDeleted} files.`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`❌ Failed to clear cache: ${error}`);
            console.error('[PythonHover] Cache clear error:', error);
        }
    }));
    // Register command to open documentation URL (makes links clickable)
    context.subscriptions.push(vscode.commands.registerCommand('pythonHover.openDocs', (url) => {
        if (url && url.startsWith('http')) {
            vscode.env.openExternal(vscode.Uri.parse(url));
        }
    }));
    // Register command to copy documentation URL
    context.subscriptions.push(vscode.commands.registerCommand('pythonHover.copyUrl', (url) => {
        if (url) {
            vscode.env.clipboard.writeText(url);
            vscode.window.showInformationMessage('📋 URL copied to clipboard!');
        }
    }));
    // Handle configuration changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('pythonHover')) {
            configManager.refresh();
        }
    }));
    console.log('[PythonHover] ✅ Extension activated successfully');
}
function deactivate() {
    console.log('[PythonHover] Extension deactivated');
}
//# sourceMappingURL=extension.js.map