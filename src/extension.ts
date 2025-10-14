/**
 * Python Hover - Enhanced Documentation Extension for VS Code
 *
 * @author KiidxAtlas
 * @copyright 2025 KiidxAtlas. All rights reserved.
 * @license MIT
 * @version 0.4.2
 *
 * This extension provides instant Python documentation with enhanced examples,
 * smart context detection, and support for 300+ constructs and 19+ libraries.
 */

import * as vscode from 'vscode';
import { NETWORK, PERFORMANCE } from './constants/defaults';
import { CacheManager } from './services/cache';
import { ConfigurationManager } from './services/config';
import { DataLoader } from './services/dataLoader';
import { ErrorNotifier } from './services/errorNotifier';
import { InventoryManager } from './services/inventory';
import { Logger } from './services/logger';
import { PackageDetector } from './services/packageDetector';
import { PythonHoverProvider } from './ui/hoverProvider';
import { VersionDetector } from './ui/versionDetector';
import { CircuitBreakerManager } from './utils/circuitBreaker';

export function activate(context: vscode.ExtensionContext) {
    // Initialize configuration first
    const configManager = new ConfigurationManager();

    // Initialize logger with configuration
    const logger = Logger.getInstance(configManager);
    logger.info('🐍 Extension activating...');

    // Initialize DataLoader for lazy loading
    const dataLoader = new DataLoader();

    // Initialize circuit breaker manager
    const circuitBreakerManager = new CircuitBreakerManager();

    // Create circuit breakers for different services
    const docsBreaker = circuitBreakerManager.getBreaker('docs-api', {
        failureThreshold: NETWORK.CB_FAILURE_THRESHOLD,
        successThreshold: NETWORK.CB_SUCCESS_THRESHOLD,
        timeout: NETWORK.CB_TIMEOUT,
        resetTimeout: NETWORK.CB_RESET_TIMEOUT
    });

    const inventoryBreaker = circuitBreakerManager.getBreaker('inventory-api', {
        failureThreshold: NETWORK.CB_FAILURE_THRESHOLD,
        successThreshold: NETWORK.CB_SUCCESS_THRESHOLD,
        timeout: NETWORK.CB_TIMEOUT,
        resetTimeout: NETWORK.CB_RESET_TIMEOUT
    });

    // Initialize managers
    const cacheManager = new CacheManager(context.globalStorageUri);
    const packageDetector = new PackageDetector();
    const inventoryManager = new InventoryManager(cacheManager, logger, configManager, packageDetector);
    const versionDetector = new VersionDetector(configManager);

    // Register hover provider with DataLoader
    const hoverProvider = new PythonHoverProvider(
        configManager,
        inventoryManager,
        versionDetector,
        cacheManager,
        dataLoader
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

    // Register logger disposal
    context.subscriptions.push({
        dispose: () => logger.dispose()
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

    // Update status bar every interval (using constant)
    const statusBarInterval = setInterval(updateStatusBar, PERFORMANCE.STATUS_BAR_UPDATE_INTERVAL);
    context.subscriptions.push({
        dispose: () => clearInterval(statusBarInterval)
    });

    // Initial update
    updateStatusBar();

    // Listen for Python environment changes
    // Watch for changes to Python interpreter setting
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('python.defaultInterpreterPath')) {
                logger.info('Python interpreter changed, clearing version cache');
                hoverProvider.clearVersionCache();
            }
        })
    );

    // Listen for Python extension environment changes
    // The Python extension activates and exposes an API that includes environment change events
    async function setupPythonExtensionListener() {
        try {
            const pythonExt = vscode.extensions.getExtension('ms-python.python');
            if (pythonExt) {
                if (!pythonExt.isActive) {
                    await pythonExt.activate();
                }

                const pythonApi = pythonExt.exports;
                // The Python extension API exposes an onDidChangePythonInterpreter event
                if (pythonApi && pythonApi.environments && pythonApi.environments.onDidChangeActiveEnvironmentPath) {
                    const disposable = pythonApi.environments.onDidChangeActiveEnvironmentPath(() => {
                        logger.info('Active Python environment changed, clearing version cache');
                        hoverProvider.clearVersionCache();
                    });
                    context.subscriptions.push(disposable);
                    logger.info('Python environment change listener registered');
                } else {
                    logger.debug('Python extension API does not expose environment change events');
                }
            } else {
                logger.debug('Python extension not found, skipping environment change listener');
            }
        } catch (error) {
            logger.error('Failed to setup Python extension listener:', error);
        }
    }

    // Setup listener after a short delay to ensure Python extension is ready
    setTimeout(setupPythonExtensionListener, 1000);

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

                const action = await ErrorNotifier.showInfo(
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
                await ErrorNotifier.showError('Failed to retrieve cache information');
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
                await ErrorNotifier.showInfo(
                    `✅ Cache cleared! Deleted ${stats.filesDeleted} files.`
                );
            } catch (error) {
                await ErrorNotifier.showError(`Failed to clear cache: ${error}`);
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
                ErrorNotifier.showInfo('📋 URL copied to clipboard!');
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
                ErrorNotifier.showInfo('✅ Example inserted!');
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
                ErrorNotifier.showInfo(`🔤 Font size: ${newSize}`);
            } else {
                ErrorNotifier.showInfo('Already at maximum font size');
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
                ErrorNotifier.showInfo(`🔤 Font size: ${newSize}`);
            } else {
                ErrorNotifier.showInfo('Already at minimum font size');
            }
        })
    );

    // Register show supported libraries command
    context.subscriptions.push(
        vscode.commands.registerCommand('pythonHover.showSupportedLibraries', async () => {
            const allLibraries = inventoryManager.getAllSupportedLibraries();
            const counts = inventoryManager.getSupportedLibrariesCount();
            const autoDetectEnabled = configManager.autoDetectLibrariesEnabled;

            // Library category mapping
            const categoryMap: Record<string, string> = {
                // Data Science & ML
                'numpy': 'Data Science & ML', 'pandas': 'Data Science & ML', 'scipy': 'Data Science & ML',
                'matplotlib': 'Data Science & ML', 'sklearn': 'Data Science & ML', 'torch': 'Data Science & ML',
                'pytorch': 'Data Science & ML',
                // Web Development
                'flask': 'Web Development', 'django': 'Web Development', 'fastapi': 'Web Development',
                'aiohttp': 'Web Development', 'requests': 'Web Development',
                // Testing & Automation
                'pytest': 'Testing & Automation', 'selenium': 'Testing & Automation',
                // Database & Validation
                'sqlalchemy': 'Database & Validation', 'pydantic': 'Database & Validation',
                // Utilities
                'beautifulsoup4': 'Utilities', 'bs4': 'Utilities', 'pillow': 'Utilities',
                'click': 'Utilities', 'sphinx': 'Utilities'
            };

            const categorized: Record<string, string[]> = {
                'Data Science & ML': [],
                'Web Development': [],
                'Testing & Automation': [],
                'Database & Validation': [],
                'Utilities': [],
                'Custom Libraries': [],
                'Other': []
            };

            const customLibNames = new Set((configManager.customLibraries ?? []).map(l => l.name));

            for (const lib of allLibraries) {
                const name = lib.name;
                if (customLibNames.has(name)) {
                    categorized['Custom Libraries'].push(name);
                } else {
                    const category = categoryMap[name] || 'Other';
                    categorized[category].push(name);
                }
            }

            // Build markdown content
            let content = `# 📚 Supported Python Libraries\n\n`;
            content += `**Total Libraries:** ${counts.total}\n`;
            content += `- Built-in: ${counts.builtIn}\n`;
            content += `- Custom: ${counts.custom}\n\n`;

            if (autoDetectEnabled) {
                content += `🧪 **Auto-detect:** ✅ Enabled - Any library with Intersphinx docs is supported!\n\n`;
            } else {
                content += `🧪 **Auto-detect:** ❌ Disabled - Only pre-configured libraries shown\n\n`;
            }

            content += `---\n\n`;

            // Add categorized libraries
            for (const [category, libs] of Object.entries(categorized)) {
                if (libs.length > 0) {
                    content += `## ${category}\n\n`;
                    const sortedLibs = libs.sort();
                    content += sortedLibs.map(lib => `- \`${lib}\``).join('\n');
                    content += `\n\n`;
                }
            }

            content += `---\n\n`;
            content += `💡 **Tip:** Add your own libraries in settings:\n`;
            content += `\`pythonHover.customLibraries\`\n\n`;
            content += `🧪 **Auto-detect:** Toggle in settings:\n`;
            content += `\`pythonHover.experimental.autoDetectLibraries\`\n\n`;
            content += `📖 [Learn more about custom libraries](command:vscode.open?${encodeURIComponent(JSON.stringify('https://github.com/KiidxAtlas/python-hover/blob/main/CUSTOM_LIBRARIES.md'))})\n`;

            const doc = await vscode.workspace.openTextDocument({
                content,
                language: 'markdown'
            });

            await vscode.window.showTextDocument(doc, {
                preview: true,
                viewColumn: vscode.ViewColumn.Beside
            });
        })
    );

    // Register health check command for circuit breakers
    context.subscriptions.push(
        vscode.commands.registerCommand('pythonHover.showHealthStatus', async () => {
            const health = circuitBreakerManager.getHealthSummary();

            let message = `🏥 **Python Hover Health Status**\n\n`;
            message += `📊 **Circuit Breakers:**\n`;
            message += `- Total: ${health.total}\n`;
            message += `- Healthy: ${health.healthy} ✅\n`;
            message += `- Unhealthy: ${health.unhealthy} ⚠️\n\n`;

            if (health.details.length > 0) {
                message += `**Details:**\n`;
                for (const detail of health.details) {
                    const statusEmoji = detail.state === 'closed' ? '✅' :
                        detail.state === 'half-open' ? '🔄' : '🔴';
                    const successRate = (detail.successRate * 100).toFixed(1);
                    message += `- ${statusEmoji} ${detail.name}: ${detail.state} (${successRate}% success)\n`;
                }
            }

            await ErrorNotifier.showInfo(message, 'Reset All', 'Close');
        })
    );

    // Handle configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
            if (event.affectsConfiguration('pythonHover')) {
                configManager.refresh();
                hoverProvider.refreshTheme();

                // Invalidate inventories when library-related settings change
                if (event.affectsConfiguration('pythonHover.customLibraries') ||
                    event.affectsConfiguration('pythonHover.experimental.autoDetectLibraries')) {
                    logger.info('Library configuration changed, invalidating inventory cache');
                    inventoryManager.invalidateCache().catch(error => {
                        logger.error('Failed to invalidate inventory cache:', error);
                    });
                }

                // Clear version cache when docs version setting changes
                if (event.affectsConfiguration('pythonHover.docsVersion')) {
                    logger.info('Documentation version setting changed, clearing version cache');
                    hoverProvider.clearVersionCache();
                }

                logger.info('Configuration reloaded successfully');
            }
        })
    );

    logger.info('✅ Extension activated successfully');
}

export function deactivate() {
    Logger.getInstance().info('Extension deactivated');
}
