/**
 * Python Hover Provider - Core hover implementation
 *
 * @author KiidxAtlas
 * @copyright 2025 KiidxAtlas
 * @license MIT
 *
 * This file contains the main hover provider logic for Python documentation.
 * Open source - feel free to contribute!
 */

import * as vscode from 'vscode';
import { LIMITS, PERFORMANCE } from '../constants/defaults';
import { ENHANCED_EXAMPLES } from '../data/enhancedExamples';
import { SPECIAL_METHOD_DESCRIPTIONS } from '../data/specialMethods';
import { STATIC_EXAMPLES } from '../data/staticExamples';
import { CustomDocumentationLoader, formatCustomDoc } from '../documentation/customDocumentation';
import { DocumentationFetcher } from '../documentation/documentationFetcher';
import { getImportedLibraries, getThirdPartyDoc } from '../documentation/thirdPartyLibraries';
import { ContextDetector } from '../resolvers/contextDetector';
import { MethodResolver } from '../resolvers/methodResolver';
import { SymbolResolver } from '../resolvers/symbolResolver';
import { CacheManager } from '../services/cache';
import { ConfigurationManager } from '../services/config';
import { DataLoader } from '../services/dataLoader';
import { InventoryEntry, InventoryManager } from '../services/inventory';
import { Logger } from '../services/logger';
import { DeprecationInfo, ParameterInfo, RelatedSymbol, ReturnInfo } from '../types';
import { BoundedCache } from '../utils/boundedCache';
import { HoverTheme } from './hoverTheme';
import { getRelatedMethodsForMethod } from './smartSuggestions';
import { formatComparison, formatVersionInfo, getMethodComparison, getVersionInfo } from './versionComparison';
import { VersionDetector } from './versionDetector';

export class PythonHoverProvider implements vscode.HoverProvider {
    private logger: Logger;
    private symbolResolver: SymbolResolver;
    private documentationFetcher: DocumentationFetcher;
    private contextDetector: ContextDetector;
    private methodResolver: MethodResolver;
    private customDocsLoader: CustomDocumentationLoader;
    private pendingHoverRequests: BoundedCache<string, Promise<vscode.Hover | null>>;
    private theme: HoverTheme;
    private debounceTimers: Map<string, NodeJS.Timeout>;
    private versionCache: BoundedCache<string, { version: string; timestamp: number; pythonPath?: string }>;
    private dataLoader: DataLoader;

    constructor(
        private configManager: ConfigurationManager,
        private inventoryManager: InventoryManager,
        private versionDetector: VersionDetector,
        cacheManager: CacheManager,
        dataLoader?: DataLoader
    ) {
        this.logger = Logger.getInstance();
        this.symbolResolver = new SymbolResolver();
        this.documentationFetcher = new DocumentationFetcher(cacheManager);
        this.contextDetector = new ContextDetector();
        this.methodResolver = new MethodResolver();
        this.customDocsLoader = new CustomDocumentationLoader();

        // Use BoundedCache instead of Map for better memory management
        this.pendingHoverRequests = new BoundedCache({
            maxSize: LIMITS.MAX_PENDING_REQUESTS,
            ttl: 30000 // 30 seconds
        });

        this.theme = new HoverTheme();
        this.debounceTimers = new Map();

        // Use BoundedCache for version cache with TTL
        this.versionCache = new BoundedCache({
            maxSize: LIMITS.MAX_VERSION_CACHE_SIZE,
            ttl: PERFORMANCE.VERSION_CACHE_TTL
        });

        // Initialize DataLoader (create new if not provided)
        this.dataLoader = dataLoader || new DataLoader();

        // Preload data in background after short delay (non-blocking)
        setTimeout(() => {
            this.dataLoader.preloadAll().catch(err => {
                this.logger.error('Error preloading data:', err);
            });
        }, 5000);

        // Load custom docs when initialized
        this.loadCustomDocs();
    }

    /**
     * Build full URL from inventory entry
     */
    private buildDocUrl(entry: InventoryEntry): string {
        return `${entry.uri}#${entry.anchor}`;
    }

    /**
     * Create a standardized hover with common structure
     * Implements Template Method pattern to reduce duplication
     */
    private createStandardHover(config: {
        symbol: string;
        type: string;
        badges?: Array<{ text: string; type: 'info' | 'warning' | 'success' | 'error' }>;
        content?: string;
        example?: string;
        docUrl?: string;
        versionInfo?: { version: string; pythonPath?: string };
    }): vscode.Hover {
        const md = this.theme.createMarkdown();

        // Header
        md.appendMarkdown(this.theme.formatHeader(config.symbol, config.type));

        // Badges (optional)
        if (config.badges) {
            md.appendMarkdown(this.theme.formatBadgeGroup(config.badges));
        }

        // Content
        if (config.content) {
            md.appendMarkdown(this.theme.formatContent(config.content));
        }

        // Example (optional)
        if (config.example) {
            md.appendMarkdown(this.theme.formatDivider());
            md.appendMarkdown(this.theme.formatCodeBlock(config.example, 'python'));
        }

        // Documentation link
        if (config.docUrl) {
            md.appendMarkdown(this.theme.formatDivider());
            const links = [{ text: 'View Documentation', url: config.docUrl, icon: 'book' }];
            md.appendMarkdown(this.theme.formatActionLinks(links));
        }

        // Version footer
        this.appendVersionFooter(md, config.versionInfo);

        return new vscode.Hover(md);
    }

    /**
     * Get debounce delay from configuration
     */
    private getDebounceDelay(): number {
        return this.configManager.getValue<number>('debounceDelay', PERFORMANCE.DEBOUNCE_DELAY);
    }

    /**
     * Get version cache TTL from configuration (in milliseconds)
     */
    private getVersionCacheTTL(): number {
        const seconds = this.configManager.getValue<number>('versionCacheTTL', PERFORMANCE.VERSION_CACHE_TTL / 1000);
        return seconds * 1000; // Convert to milliseconds
    }

    /**
     * Refresh theme settings
     */
    public refreshTheme(): void {
        this.theme.refresh();
    }

    /**
     * Load custom documentation from workspace
     */
    private async loadCustomDocs(): Promise<void> {
        try {
            const folders = vscode.workspace.workspaceFolders;
            if (folders && folders.length > 0) {
                await this.customDocsLoader.loadCustomDocs(folders[0]);
            }
        } catch (error) {
            this.logger.error('Error loading custom docs', error as Error);
        }
    }

    /**
     * Reload custom documentation
     */
    public async reloadCustomDocs(): Promise<void> {
        await this.loadCustomDocs();
    }

    private async getCachedPythonVersion(document: vscode.TextDocument): Promise<{ version: string; pythonPath?: string }> {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        const cacheKey = workspaceFolder?.uri.toString() || 'default';

        const cached = this.versionCache.get(cacheKey);
        const now = Date.now();

        if (cached && (now - cached.timestamp) < this.getVersionCacheTTL()) {
            return { version: cached.version, pythonPath: (cached as any).pythonPath };
        }

        const versionInfo = await this.versionDetector.detectPythonVersionInfo();

        this.versionCache.set(cacheKey, {
            version: versionInfo.version,
            timestamp: now,
            pythonPath: versionInfo.pythonPath
        } as any);

        return versionInfo;
    }

    /**
     * Clear version cache (useful when Python environment changes)
     */
    public clearVersionCache(): void {
        this.versionCache.clear();
        this.logger.info('Version cache cleared');
    }

    public async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Hover | null> {
        if (token.isCancellationRequested) {
            return null;
        }

        const requestKey = `${document.uri.toString()}:${position.line}:${position.character}`;

        if (this.pendingHoverRequests.has(requestKey)) {
            return this.pendingHoverRequests.get(requestKey)!;
        }

        const existingTimer = this.debounceTimers.get(requestKey);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        const debouncedPromise = new Promise<vscode.Hover | null>((resolve) => {
            const timer = setTimeout(async () => {
                this.debounceTimers.delete(requestKey);
                try {
                    const result = await this.provideHoverImpl(document, position, token);
                    resolve(result);
                } catch (error) {
                    this.logger.error('Error in hover provider', error as Error);
                    resolve(null);
                }
            }, this.getDebounceDelay());

            this.debounceTimers.set(requestKey, timer);
        });

        this.pendingHoverRequests.set(requestKey, debouncedPromise);

        try {
            return await debouncedPromise;
        } finally {
            this.pendingHoverRequests.delete(requestKey);
        }
    }

    private async provideHoverImpl(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): Promise<vscode.Hover | null> {
        try {
            const versionInfo = await this.getCachedPythonVersion(document);
            const { version: pythonVersion, pythonPath } = versionInfo;

            const symbols = this.symbolResolver.resolveSymbolAtPosition(document, position);
            if (symbols.length === 0) {
                return null;
            }

            const primarySymbol = symbols[0];

            // Check for custom documentation first
            const customDoc = this.customDocsLoader.getCustomDoc(primarySymbol.symbol);
            if (customDoc) {
                return this.createCustomDocHover(customDoc, primarySymbol, versionInfo);
            }

            // Get imported libraries
            const documentText = document.getText();
            const importedLibsMap = getImportedLibraries(documentText, this.configManager);
            const importedLibsSet = new Set(importedLibsMap.values());

            // Check for third-party library documentation
            if (this.configManager.autoDetectLibrariesEnabled) {
                // Hovering over library itself (e.g., 'numpy' in 'import numpy')
                if (importedLibsSet.has(primarySymbol.symbol)) {
                    return await this.createModuleHover(primarySymbol.symbol, pythonVersion, pythonPath);
                }

                // Symbol imported from a library (e.g., 'KernelManager' from 'jupyter_client')
                const sourceLibrary = importedLibsMap.get(primarySymbol.symbol);
                if (sourceLibrary && sourceLibrary !== primarySymbol.symbol) {
                    const entry = await this.inventoryManager.resolveSymbol(
                        primarySymbol.symbol,
                        pythonVersion,
                        sourceLibrary,
                        pythonPath
                    );

                    if (entry) {
                        const docSnippet = await this.documentationFetcher.fetchDocumentationForSymbol(
                            primarySymbol.symbol,
                            entry,
                            this.configManager.maxSnippetLines,
                            sourceLibrary
                        );
                        return await this.createRichHover(docSnippet, entry, primarySymbol, versionInfo);
                    }
                }
            }

            // Extract method name from dotted expressions
            let methodName = primarySymbol.symbol;
            if (methodName.includes('.')) {
                const parts = methodName.split('.');
                const baseModule = parts[0];
                methodName = parts[parts.length - 1];

                if (importedLibsSet.has(baseModule) || primarySymbol.context === baseModule) {
                    primarySymbol.context = baseModule;
                    primarySymbol.symbol = methodName;
                }
            }

            // Check for third-party method documentation
            if (primarySymbol.type === 'method' && primarySymbol.context) {
                const thirdPartyDoc = getThirdPartyDoc(primarySymbol.context, methodName);
                if (thirdPartyDoc) {
                    return await this.createThirdPartyHoverAsync(thirdPartyDoc, primarySymbol, versionInfo);
                }
            }

            // Check imported libraries for method documentation
            for (const lib of importedLibsSet) {
                const thirdPartyDoc = getThirdPartyDoc(lib, methodName);
                if (thirdPartyDoc) {
                    return await this.createThirdPartyHoverAsync(thirdPartyDoc, primarySymbol, versionInfo);
                }
            }

            // Detect method context
            if (primarySymbol.type === 'method') {
                let receiverType = primarySymbol.context;

                if (methodName.includes('.')) {
                    const parts = methodName.split('.');
                    const baseSymbol = parts[0];
                    methodName = parts[parts.length - 1];

                    if (importedLibsMap.has(baseSymbol)) {
                        const library = importedLibsMap.get(baseSymbol);
                        receiverType = library;
                        primarySymbol.context = library;
                        primarySymbol.symbol = methodName;
                    }
                }

                const alreadySetFromDottedExpression = importedLibsSet.has(receiverType || '');

                Logger.getInstance().info(`[HoverProvider] ReceiverType before detection: ${receiverType}`);
                Logger.getInstance().info(`[HoverProvider] AlreadySetFromDottedExpression: ${alreadySetFromDottedExpression}`);
                Logger.getInstance().info(`[HoverProvider] Condition check: !receiverType=${!receiverType}, receiverType==='object'=${receiverType === 'object'}`);

                // NEW: Always try to detect context for "object" since it's just a fallback
                // Also try if receiverType is not set or if it's not from a dotted expression
                if (!receiverType || receiverType === 'object' || (!alreadySetFromDottedExpression && !importedLibsMap.has(methodName.split('.')[0]))) {
                    Logger.getInstance().info(`[HoverProvider] Calling detectMethodContext for method: ${methodName}`);
                    const detectedType = this.contextDetector.detectMethodContext(document, position, methodName);
                    if (detectedType) {
                        Logger.getInstance().info(`[HoverProvider] Detected type: ${detectedType}`);
                        receiverType = detectedType;
                    } else {
                        Logger.getInstance().info(`[HoverProvider] No type detected`);
                    }
                }

                Logger.getInstance().info(`[HoverProvider] Final receiverType: ${receiverType}`);

                if (receiverType) {
                    Logger.getInstance().info(`[HoverProvider] ReceiverType includes dot: ${receiverType.includes('.')}`);

                    // NEW: If receiverType is a simple class name but we have libraries imported,
                    // try to qualify it dynamically by checking which library has this symbol
                    if (!receiverType.includes('.') && importedLibsSet.size > 0) {
                        Logger.getInstance().info(`[HoverProvider] Attempting to qualify simple type: ${receiverType}`);

                        // Store current receiverType to avoid type narrowing issues
                        const currentType: string = receiverType;

                        // Try each imported library to see if it has this symbol
                        for (const lib of importedLibsSet) {
                            try {
                                const qualifiedName: string = `${lib}.${currentType}`;
                                Logger.getInstance().info(`[HoverProvider] Trying to resolve: ${qualifiedName}`);

                                // Quick check: see if inventory has this symbol with this library context
                                const testEntry = await this.inventoryManager.resolveSymbol(
                                    currentType,
                                    pythonVersion,
                                    lib,
                                    pythonPath
                                );

                                if (testEntry) {
                                    Logger.getInstance().info(`[HoverProvider] Found ${currentType} in library ${lib}`);
                                    receiverType = qualifiedName;
                                    break;
                                }
                            } catch (error) {
                                // Skip libraries that fail (e.g., libraries with invalid/missing inventory files)
                                Logger.getInstance().debug(`[HoverProvider] Failed to check library ${lib}: ${error instanceof Error ? error.message : String(error)}`);
                                continue;
                            }
                        }
                    }

                    // NEW: Handle qualified type names (e.g., "pandas.DataFrame")
                    if (receiverType.includes('.')) {
                        Logger.getInstance().info(`[HoverProvider] Handling qualified type name: ${receiverType}`);
                        const parts = receiverType.split('.');
                        const library = parts[0];
                        const className = parts[parts.length - 1];

                        Logger.getInstance().info(`[HoverProvider] Library: ${library}, ClassName: ${className}`);
                        Logger.getInstance().info(`[HoverProvider] Is library imported: ${importedLibsSet.has(library)}`);

                        // Check if this library is imported
                        if (importedLibsSet.has(library)) {
                            // Try to find third-party documentation for this method
                            const thirdPartyDoc = getThirdPartyDoc(library, methodName);
                            if (thirdPartyDoc) {
                                primarySymbol.context = className;
                                primarySymbol.symbol = methodName;
                                return await this.createThirdPartyHoverAsync(thirdPartyDoc, primarySymbol, versionInfo);
                            }

                            // No static docs, but we know the library and class
                            // Try to resolve from inventory with library context
                            const fullSymbol = `${className}.${methodName}`;
                            const entry = await this.inventoryManager.resolveSymbol(
                                fullSymbol,
                                pythonVersion,
                                library,  // Use library as context for inventory lookup
                                pythonPath
                            );

                            if (entry) {
                                const docSnippet = await this.documentationFetcher.fetchDocumentationForSymbol(
                                    methodName,
                                    entry,
                                    this.configManager.maxSnippetLines,
                                    library
                                );

                                // Try to get rich documentation from the URL
                                if (entry.uri) {
                                    const docUrl = `${entry.uri}#${entry.anchor}`;
                                    const richDoc = await this.documentationFetcher.fetchRichDocumentation(docUrl, methodName);

                                    if (richDoc && (richDoc.parameters?.length || richDoc.examples?.length || richDoc.seeAlso?.length)) {
                                        return this.createDynamicRichHover(richDoc, primarySymbol.type, versionInfo);
                                    }
                                }

                                // Use regular rich hover with the docs we found
                                primarySymbol.context = className;
                                primarySymbol.symbol = methodName;
                                return await this.createRichHover(docSnippet, entry, primarySymbol, versionInfo);
                            }

                            // Set the context to the class name for later processing
                            primarySymbol.context = className;
                            primarySymbol.symbol = methodName;
                        }
                    } else if (!primarySymbol.context || primarySymbol.context === 'object') {
                        const methodInfo = this.methodResolver.resolveMethodInfo(document, position, methodName, receiverType);
                        if (methodInfo) {
                            primarySymbol.context = receiverType;
                            primarySymbol.symbol = methodName;
                        } else {
                            primarySymbol.symbol = methodName;
                        }
                    }
                } else if (!primarySymbol.context) {
                    primarySymbol.symbol = methodName;
                }
            }

            // Update symbol for MAP lookups
            if (primarySymbol.type === 'method' && methodName !== primarySymbol.symbol && methodName.length > 0) {
                primarySymbol.symbol = methodName;
            }

            // Handle dunder methods
            if (primarySymbol.symbol.startsWith('__') && primarySymbol.symbol.endsWith('__')) {
                let dunderMethodName = primarySymbol.symbol;
                if (dunderMethodName.includes('.')) {
                    dunderMethodName = dunderMethodName.split('.').pop() || dunderMethodName;
                }

                const description = SPECIAL_METHOD_DESCRIPTIONS[dunderMethodName];
                if (description) {
                    const dunderInfo = { description };
                    return this.createDunderMethodHover(dunderMethodName, dunderInfo, versionInfo);
                }
            }

            // Build lookup symbol
            let lookupSymbol = primarySymbol.symbol;
            if (primarySymbol.type === 'method' && primarySymbol.context) {
                if (!primarySymbol.symbol.startsWith(primarySymbol.context + '.')) {
                    lookupSymbol = `${primarySymbol.context}.${primarySymbol.symbol}`;
                }
            }

            const inventoryEntry = await this.inventoryManager.resolveSymbol(
                lookupSymbol,
                pythonVersion,
                primarySymbol.context,
                pythonPath
            );

            // Handle special types
            if (primarySymbol.type === 'f-string') {
                return this.createFStringHover(versionInfo);
            }

            if (primarySymbol.type === 'operator') {
                return this.createOperatorHover(primarySymbol.symbol, versionInfo);
            }

            // Handle keywords with enhanced examples
            if (primarySymbol.type === 'keyword' && ENHANCED_EXAMPLES[primarySymbol.symbol]) {
                const inventoryEntry = await this.inventoryManager.resolveSymbol(
                    primarySymbol.symbol,
                    pythonVersion,
                    primarySymbol.context,
                    pythonPath
                );

                if (inventoryEntry) {
                    const docSnippet = await this.documentationFetcher.fetchDocumentationForSymbol(
                        primarySymbol.symbol,
                        inventoryEntry,
                        this.configManager.maxSnippetLines,
                        primarySymbol.context
                    );

                    return this.createEnhancedExampleHoverWithDocs(
                        primarySymbol.symbol,
                        docSnippet,
                        inventoryEntry,
                        versionInfo
                    );
                }

                return this.createEnhancedExampleHover(primarySymbol.symbol, versionInfo);
            }

            // Fetch documentation
            let maxLines = this.configManager.maxSnippetLines;
            if (['else', 'elif', 'finally', 'except', 'with'].includes(primarySymbol.symbol)) {
                maxLines = Math.max(40, maxLines);
            }

            const docSnippet = await this.documentationFetcher.fetchDocumentationForSymbol(
                primarySymbol.symbol,
                inventoryEntry || undefined,
                maxLines,
                primarySymbol.context
            );

            // Auto-discovery fallback
            if (!inventoryEntry && this.configManager.autoDetectLibrariesEnabled && !docSnippet.content) {
                const isSimpleIdentifier = /^[a-z_][a-z0-9_]*$/i.test(primarySymbol.symbol);
                if (isSimpleIdentifier && !primarySymbol.symbol.includes('.')) {
                    const entry = await this.inventoryManager.resolveSymbol(
                        primarySymbol.symbol,
                        pythonVersion,
                        primarySymbol.symbol,
                        pythonPath
                    );

                    if (entry) {
                        return await this.createModuleHover(primarySymbol.symbol, pythonVersion, pythonPath);
                    }
                }
            }

            return await this.createRichHover(docSnippet, inventoryEntry, primarySymbol, versionInfo);

        } catch (error: any) {
            this.logger.error('Error in hover provider', error as Error);

            // Check if it's a network error
            if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
                return this.createNetworkErrorHover();
            }

            // For other errors, fail silently
            return null;
        }
    }

    /**
     * Create a hover for network errors
     */
    private createNetworkErrorHover(): vscode.Hover {
        const md = this.theme.createMarkdown();

        // Header
        md.appendMarkdown('## $(error) Network Error\n\n');

        // Warning message
        md.appendMarkdown(this.theme.formatWarning('Could not fetch documentation. Please check your internet connection.'));

        // Helpful tip
        md.appendMarkdown(this.theme.formatTip('You can clear the cache and retry, or check your network settings.'));

        md.appendMarkdown(this.theme.formatDivider());

        // Action links
        const links = [
            { text: 'Clear Cache', command: 'command:pythonHover.clearCache', icon: 'trash' },
            { text: 'Check Settings', command: 'command:workbench.action.openSettings?["pythonHover"]', icon: 'gear' }
        ];
        md.appendMarkdown(this.theme.formatActionLinks(links));

        return new vscode.Hover(md);
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        // Clean up theme listener
        this.theme.dispose();

        // Clear all pending timers
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();

        // Clear pending requests
        this.pendingHoverRequests.clear();

        // Clear caches
        this.versionCache.clear();

        this.logger.info('Hover provider disposed');
    }

    private createCustomDocHover(customDoc: any, _symbolInfo: { symbol: string; type: string }, pythonVersionInfo?: { version: string; pythonPath?: string }): vscode.Hover {
        const md = this.theme.createMarkdown();
        md.appendMarkdown(formatCustomDoc(customDoc));
        this.appendVersionFooter(md, pythonVersionInfo);
        return new vscode.Hover(md);
    }

    private async createModuleHover(moduleName: string, pythonVersion: string, pythonPath?: string): Promise<vscode.Hover> {
        const md = this.theme.createMarkdown();
        const uiConfig = this.configManager.getConfig().ui;

        md.appendMarkdown(this.theme.formatHeader(`${moduleName}`, 'module'));

        const entry = await this.inventoryManager.resolveSymbol(
            moduleName,
            pythonVersion,
            moduleName,
            pythonPath
        );

        // Try to get rich information from PyPI
        const pypiInfo = await this.documentationFetcher.fetchPyPIInfo(moduleName);

        if (entry || pypiInfo) {
            // Enhanced badges with version info
            const badges: Array<{ text: string, type?: 'info' | 'success' | 'warning' | 'error' }> = [
                { text: 'module', type: 'info' }
            ];

            if (pypiInfo?.version) {
                badges.push({ text: `v${pypiInfo.version}`, type: 'success' });
            }

            // Add category badge
            const category = this.categorizeModule(moduleName);
            if (category) {
                badges.push({ text: category, type: 'info' });
            }

            md.appendMarkdown(this.theme.formatBadgeGroup(badges));

            // Quick actions bar
            if (uiConfig.showQuickActions) {
                const docUrl = pypiInfo?.docUrl || (entry ? this.buildDocUrl(entry) : `https://pypi.org/project/${moduleName}/`);
                const encodedUrl = encodeURIComponent(JSON.stringify([docUrl]));
                const actions = [
                    { text: 'Docs', icon: 'book', command: `command:pythonHover.openDocs?${encodedUrl}` },
                    { text: 'PyPI', icon: 'package', command: `command:pythonHover.openDocs?${encodeURIComponent(JSON.stringify([`https://pypi.org/project/${moduleName}/`]))}` },
                    { text: 'Copy URL', icon: 'link', command: `command:pythonHover.copyUrl?${encodedUrl}` }
                ];
                md.appendMarkdown(this.theme.formatQuickActions(actions));
            }

            md.appendMarkdown(this.theme.formatDivider());

            // Module summary/description
            let description = '';
            if (entry) {
                const docSnippet = await this.documentationFetcher.fetchDocumentationForSymbol(
                    moduleName,
                    entry,
                    this.configManager.maxSnippetLines,
                    moduleName
                );
                description = docSnippet?.content || '';
            }

            if (!description && pypiInfo?.summary) {
                description = pypiInfo.summary;
            }

            if (description) {
                const maxLength = uiConfig.maxContentLength || 800;
                const docUrl = pypiInfo?.docUrl || (entry ? this.buildDocUrl(entry) : undefined);
                if (description.length > maxLength && docUrl) {
                    const encodedUrl = encodeURIComponent(JSON.stringify([docUrl]));
                    const readMoreCmd = `command:pythonHover.openDocs?${encodedUrl}`;
                    md.appendMarkdown(this.theme.formatContentWithTruncation(description, maxLength, readMoreCmd));
                } else {
                    md.appendMarkdown(this.theme.formatContent(description));
                }
                md.appendMarkdown('\n\n');
            }

            // Show package metadata from PyPI
            if (pypiInfo) {
                const metadata: string[] = [];

                if (pypiInfo.author) {
                    metadata.push(`**Author:** ${pypiInfo.author}`);
                }

                if (pypiInfo.license) {
                    metadata.push(`**License:** ${pypiInfo.license}`);
                }

                if (pypiInfo.requires_python) {
                    metadata.push(`**Python:** ${pypiInfo.requires_python}`);
                }

                if (metadata.length > 0) {
                    md.appendMarkdown(this.theme.formatSectionHeader('Package Info'));
                    md.appendMarkdown(metadata.join(' • ') + '\n\n');
                }
            }

            // Show key exports/submodules if available
            const keyExports = await this.getModuleExports(moduleName, pythonVersion, pythonPath);
            if (keyExports.length > 0) {
                md.appendMarkdown(this.theme.formatSectionHeader('Key Exports'));
                const exportList = keyExports.slice(0, 10).map(exp => `- \`${exp}\``).join('\n');
                md.appendMarkdown(exportList + '\n\n');
                if (keyExports.length > 10) {
                    md.appendMarkdown(`*...and ${keyExports.length - 10} more*\n\n`);
                }
            }

            md.appendMarkdown(this.theme.formatTip(`Hover over functions from \`${moduleName}\` for detailed documentation`));
            md.appendMarkdown(this.theme.formatDivider());

            // Action links (only if quick actions not shown at top)
            if (!uiConfig.showQuickActions) {
                const docUrl = pypiInfo?.docUrl || (entry ? this.buildDocUrl(entry) : undefined);
                const links = [];
                if (docUrl) {
                    links.push({ text: 'View Documentation', url: docUrl, icon: 'book' });
                }
                links.push({ text: 'View on PyPI', url: `https://pypi.org/project/${moduleName}/`, icon: 'package' });
                md.appendMarkdown(this.theme.formatActionLinks(links));
            }

            // Keyboard hints
            if (uiConfig.showKeyboardHints) {
                const shortcuts = [
                    { keys: 'F12', description: 'Go to definition' },
                    { keys: 'Ctrl+Space', description: 'IntelliSense' }
                ];
                md.appendMarkdown(this.theme.formatKeyboardHint(shortcuts));
            }

            this.appendVersionFooter(md, { version: pythonVersion, pythonPath });
            return new vscode.Hover(md);
        }

        // Fallback to hardcoded module info
        const moduleInfo: Record<string, { description: string; docs: string; badge?: string; exports?: string[] }> = {
            'numpy': {
                description: 'Fundamental package for scientific computing with Python. NumPy provides powerful N-dimensional array objects, broadcasting functions, linear algebra, Fourier transforms, and random number capabilities.',
                docs: 'https://numpy.org/doc/',
                badge: 'Scientific Computing',
                exports: ['array', 'ndarray', 'zeros', 'ones', 'arange', 'linspace', 'dot', 'matmul', 'random', 'linalg']
            },
            'pandas': {
                description: 'Powerful data analysis and manipulation library built on top of NumPy. Provides DataFrame and Series data structures for working with structured data.',
                docs: 'https://pandas.pydata.org/docs/',
                badge: 'Data Analysis',
                exports: ['DataFrame', 'Series', 'read_csv', 'read_excel', 'read_json', 'to_datetime', 'merge', 'concat']
            },
            'flask': {
                description: 'Lightweight WSGI web application framework designed with simplicity and flexibility in mind.',
                docs: 'https://flask.palletsprojects.com/',
                badge: 'Web Framework',
                exports: ['Flask', 'request', 'Response', 'render_template', 'jsonify', 'redirect', 'url_for', 'session']
            },
            'django': {
                description: 'High-level Python web framework that encourages rapid development and clean, pragmatic design.',
                docs: 'https://docs.djangoproject.com/',
                badge: 'Web Framework'
            },
            'requests': {
                description: 'Elegant and simple HTTP library for Python. Makes sending HTTP requests extremely simple.',
                docs: 'https://requests.readthedocs.io/',
                badge: 'HTTP Client',
                exports: ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'Session', 'Response']
            }
        };

        const info = moduleInfo[moduleName.toLowerCase()];
        if (info) {
            const badges: Array<{ text: string, type?: 'info' | 'success' | 'warning' | 'error' }> = [
                { text: 'module', type: 'info' }
            ];
            if (info.badge) {
                badges.push({ text: info.badge, type: 'success' });
            }
            md.appendMarkdown(this.theme.formatBadgeGroup(badges));

            // Quick actions
            if (uiConfig.showQuickActions) {
                const encodedUrl = encodeURIComponent(JSON.stringify([info.docs]));
                const actions = [
                    { text: 'Docs', icon: 'book', command: `command:pythonHover.openDocs?${encodedUrl}` },
                    { text: 'PyPI', icon: 'package', command: `command:pythonHover.openDocs?${encodeURIComponent(JSON.stringify([`https://pypi.org/project/${moduleName}/`]))}` }
                ];
                md.appendMarkdown(this.theme.formatQuickActions(actions));
            }

            md.appendMarkdown(this.theme.formatDivider());
            md.appendMarkdown(this.theme.formatContent(info.description));
            md.appendMarkdown('\n\n');

            // Show key exports if available
            if (info.exports && info.exports.length > 0) {
                md.appendMarkdown(this.theme.formatSectionHeader('Key Exports'));
                const exportList = info.exports.map(exp => `- \`${exp}\``).join('\n');
                md.appendMarkdown(exportList + '\n\n');
            }

            md.appendMarkdown(this.theme.formatTip(`Hover over functions like \`${moduleName}.function()\` for detailed documentation`));
            md.appendMarkdown(this.theme.formatDivider());

            if (!uiConfig.showQuickActions) {
                const links = [
                    { text: 'Official Documentation', url: info.docs, icon: 'book' },
                    { text: 'View on PyPI', url: `https://pypi.org/project/${moduleName}/`, icon: 'package' }
                ];
                md.appendMarkdown(this.theme.formatActionLinks(links));
            }
        } else {
            // Generic fallback for unknown modules
            const badges: Array<{ text: string, type?: 'info' | 'success' | 'warning' | 'error' }> = [
                { text: 'module', type: 'info' },
                { text: 'third-party', type: 'success' }
            ];
            md.appendMarkdown(this.theme.formatBadgeGroup(badges));

            md.appendMarkdown(this.theme.formatDivider());
            md.appendMarkdown(this.theme.formatContent(`Third-party Python module: **${moduleName}**`));
            md.appendMarkdown('\n\n');
            md.appendMarkdown(this.theme.formatTip(`Hover over functions from \`${moduleName}\` for detailed documentation`));
            md.appendMarkdown(this.theme.formatDivider());

            const links = [{ text: 'View on PyPI', url: `https://pypi.org/project/${moduleName}/`, icon: 'package' }];
            md.appendMarkdown(this.theme.formatActionLinks(links));
        }

        this.appendVersionFooter(md, { version: pythonVersion, pythonPath });
        return new vscode.Hover(md);
    }

    /**
     * Categorize module by name patterns
     */
    private categorizeModule(moduleName: string): string | undefined {
        const categories: Record<string, RegExp> = {
            'Web Framework': /^(flask|django|fastapi|tornado|bottle|pyramid|web2py)/i,
            'Data Science': /^(pandas|numpy|scipy|scikit-learn|sklearn|matplotlib|seaborn)/i,
            'Machine Learning': /^(tensorflow|keras|torch|pytorch|transformers|ml|ai)/i,
            'Database': /^(sqlalchemy|pymongo|redis|psycopg|mysql|sqlite)/i,
            'HTTP Client': /^(requests|httpx|aiohttp|urllib)/i,
            'Testing': /^(pytest|unittest|nose|mock)/i,
            'CLI': /^(click|argparse|typer|rich)/i
        };

        for (const [category, pattern] of Object.entries(categories)) {
            if (pattern.test(moduleName)) {
                return category;
            }
        }

        return undefined;
    }

    /**
     * Get key exports from a module using inventory
     */
    private async getModuleExports(moduleName: string, pythonVersion: string, pythonPath?: string): Promise<string[]> {
        try {
            // Query the inventory for symbols in this module
            const exports: string[] = [];

            // This is a simplified implementation - in reality you'd query the inventory
            // for all symbols with domain 'py:class', 'py:function', etc. that start with moduleName

            // For now, return empty array - this would need inventory query support
            return exports;
        } catch (error) {
            this.logger.debug(`Could not fetch exports for ${moduleName}:`, error);
            return [];
        }
    }

    private async createThirdPartyHoverAsync(libDoc: any, symbolInfo: { symbol: string; type: string }, pythonVersionInfo?: { version: string; pythonPath?: string }): Promise<vscode.Hover> {
        // Try to fetch rich documentation from the actual docs page
        let richDoc = null;
        if (libDoc.url) {
            this.logger.debug(`🔍 Attempting to fetch rich documentation for ${libDoc.name} from ${libDoc.url}`);
            richDoc = await this.documentationFetcher.fetchRichDocumentation(libDoc.url, libDoc.name);
        }

        // If we have rich documentation, use it; otherwise fall back to static data
        if (richDoc && (richDoc.parameters?.length || richDoc.examples?.length || richDoc.seeAlso?.length)) {
            this.logger.debug(`✅ Using rich documentation for ${libDoc.name}`);
            return this.createDynamicRichHover(richDoc, symbolInfo.type, pythonVersionInfo);
        }

        // Fallback to basic hover with static data
        this.logger.debug(`ℹ️ Using basic hover for ${libDoc.name}`);
        return this.createBasicThirdPartyHover(libDoc, symbolInfo, pythonVersionInfo);
    }

    /**
     * Create a basic hover for third-party library with static data
     */
    private createBasicThirdPartyHover(libDoc: any, symbolInfo: { symbol: string; type: string }, pythonVersionInfo?: { version: string; pythonPath?: string }): vscode.Hover {
        const md = this.theme.createMarkdown();
        const uiConfig = this.configManager.getConfig().ui;

        // Header
        md.appendMarkdown(this.theme.formatHeader(libDoc.name, symbolInfo.type === 'method' ? 'function' : symbolInfo.type));

        // Type/role badges
        const badges: Array<{ text: string, type?: 'info' | 'success' | 'warning' | 'error' }> = [
            { text: symbolInfo.type === 'method' ? 'function' : symbolInfo.type, type: 'info' }
        ];
        if (libDoc.url && libDoc.url.includes('pandas')) {
            badges.push({ text: 'pandas', type: 'success' });
        } else if (libDoc.url && libDoc.url.includes('numpy')) {
            badges.push({ text: 'numpy', type: 'success' });
        } else if (libDoc.url) {
            badges.push({ text: 'third-party', type: 'success' });
        }
        md.appendMarkdown(this.theme.formatBadgeGroup(badges));

        // Quick actions bar at top
        if (uiConfig.showQuickActions && libDoc.url) {
            const encodedUrl = encodeURIComponent(JSON.stringify([libDoc.url]));
            const actions = [
                { text: 'Docs', icon: 'book', command: `command:pythonHover.openDocs?${encodedUrl}` },
                { text: 'Copy URL', icon: 'link', command: `command:pythonHover.copyUrl?${encodedUrl}` }
            ];
            md.appendMarkdown(this.theme.formatQuickActions(actions));
        }

        md.appendMarkdown(this.theme.formatDivider());

        // Description
        if (libDoc.description) {
            const maxLength = uiConfig.maxContentLength || 800;
            if (libDoc.description.length > maxLength && libDoc.url) {
                const encodedUrl = encodeURIComponent(JSON.stringify([libDoc.url]));
                const readMoreCmd = `command:pythonHover.openDocs?${encodedUrl}`;
                md.appendMarkdown(this.theme.formatContentWithTruncation(libDoc.description, maxLength, readMoreCmd));
            } else {
                md.appendMarkdown(this.theme.formatContent(libDoc.description));
            }
            md.appendMarkdown('\n\n');
        }

        // Single example if available
        if (libDoc.example) {
            md.appendMarkdown(this.theme.formatSectionHeader('Example'));
            md.appendMarkdown(this.theme.formatCodeBlock(libDoc.example, 'python'));
        }

        // Documentation link (only if quick actions not shown at top)
        if (!uiConfig.showQuickActions && libDoc.url) {
            md.appendMarkdown(this.theme.formatDivider());
            const links = [{ text: 'View Documentation', url: libDoc.url, icon: 'book' }];
            md.appendMarkdown(this.theme.formatActionLinks(links));
        }

        // Keyboard hints at bottom
        if (uiConfig.showKeyboardHints) {
            const shortcuts = [
                { keys: 'F12', description: 'Go to definition' },
                { keys: 'Ctrl+Space', description: 'IntelliSense' }
            ];
            md.appendMarkdown(this.theme.formatKeyboardHint(shortcuts));
        }

        // Version footer
        this.appendVersionFooter(md, pythonVersionInfo);

        return new vscode.Hover(md);
    }

    /**
     * Create a rich hover with dynamically parsed documentation
     */
    private createDynamicRichHover(richDoc: any, symbolType: string, pythonVersionInfo?: { version: string; pythonPath?: string }): vscode.Hover {
        const md = this.theme.createMarkdown();
        const uiConfig = this.configManager.getConfig().ui;

        // Header
        md.appendMarkdown(this.theme.formatHeader(richDoc.name, symbolType === 'method' ? 'function' : symbolType));

        // Type/role badges
        const badges: Array<{ text: string, type?: 'info' | 'success' | 'warning' | 'error' }> = [
            { text: symbolType === 'method' ? 'function' : symbolType, type: 'info' }
        ];
        if (richDoc.url && richDoc.url.includes('pandas')) {
            badges.push({ text: 'pandas', type: 'success' });
        } else if (richDoc.url && richDoc.url.includes('numpy')) {
            badges.push({ text: 'numpy', type: 'success' });
        } else if (richDoc.url) {
            badges.push({ text: 'third-party', type: 'success' });
        }
        md.appendMarkdown(this.theme.formatBadgeGroup(badges));

        // Check for deprecation
        if (uiConfig.showDeprecationWarnings && richDoc.deprecated) {
            md.appendMarkdown(this.theme.formatDeprecation(
                richDoc.versionAdded || '',
                richDoc.deprecated,
                undefined
            ));
        }

        // Quick actions bar at top
        if (uiConfig.showQuickActions && richDoc.url) {
            const encodedUrl = encodeURIComponent(JSON.stringify([richDoc.url]));
            const actions = [
                { text: 'Docs', icon: 'book', command: `command:pythonHover.openDocs?${encodedUrl}` },
                { text: 'Copy URL', icon: 'link', command: `command:pythonHover.copyUrl?${encodedUrl}` }
            ];
            md.appendMarkdown(this.theme.formatQuickActions(actions));
        }

        md.appendMarkdown(this.theme.formatDivider());

        // Summary box if available (separate from full description)
        if (richDoc.summary && richDoc.summary !== richDoc.description) {
            md.appendMarkdown(this.theme.formatSummaryBox(richDoc.summary));
        }

        // Description
        if (richDoc.description) {
            const maxLength = uiConfig.maxContentLength || 800;
            if (richDoc.description.length > maxLength && richDoc.url) {
                const encodedUrl = encodeURIComponent(JSON.stringify([richDoc.url]));
                const readMoreCmd = `command:pythonHover.openDocs?${encodedUrl}`;
                md.appendMarkdown(this.theme.formatContentWithTruncation(richDoc.description, maxLength, readMoreCmd));
            } else {
                md.appendMarkdown(this.theme.formatContent(richDoc.description));
            }
            md.appendMarkdown('\n\n');
        }

        // Parameters section with enhanced formatting
        if (uiConfig.showParameterTables && richDoc.parameters && richDoc.parameters.length > 0) {
            md.appendMarkdown(this.theme.formatSectionHeader('Parameters'));

            // Use detailed parameter formatting for better visual hierarchy
            for (const param of richDoc.parameters) {
                md.appendMarkdown(this.theme.formatParameterDetailed({
                    name: param.name,
                    type: param.type,
                    description: param.description,
                    default: param.default,
                    required: param.required,
                    constraints: param.constraints
                }));
            }
        }

        // Return type with enhanced formatting
        if (uiConfig.showReturnTypes) {
            if (richDoc.returnType && richDoc.returns) {
                md.appendMarkdown(this.theme.formatReturnType(richDoc.returnType, richDoc.returns));
            } else if (richDoc.returns) {
                const returnMatch = richDoc.returns.match(/^([^\n:]+)(?:\s*:\s*|\s+—\s+|\s+-\s+|\n)(.+)/s);
                if (returnMatch) {
                    const [, type, description] = returnMatch;
                    md.appendMarkdown(this.theme.formatReturnType(type.trim(), description.trim()));
                } else {
                    md.appendMarkdown(this.theme.formatSectionHeader('Returns'));
                    md.appendMarkdown(richDoc.returns + '\n\n');
                }
            }
        }

        // Yields section (for generators)
        if (richDoc.yields) {
            md.appendMarkdown(this.theme.formatYields(richDoc.yields));
        }

        // Raises/Exceptions section
        if (richDoc.raises && richDoc.raises.length > 0) {
            md.appendMarkdown(this.theme.formatRaises(richDoc.raises));
        }

        // Attributes section (for classes)
        if (richDoc.attributes && richDoc.attributes.length > 0) {
            md.appendMarkdown(this.theme.formatAttributes(richDoc.attributes));
        }

        // Notes section
        if (richDoc.notes) {
            md.appendMarkdown(this.theme.formatSectionHeader('Notes'));
            md.appendMarkdown(richDoc.notes + '\n\n');
        }

        // Warnings section
        if (richDoc.warnings) {
            md.appendMarkdown(this.theme.formatSectionHeader('⚠️ Warning'));
            md.appendMarkdown(richDoc.warnings + '\n\n');
        }

        // See Also section with enhanced formatting
        if (uiConfig.showSeeAlso && richDoc.seeAlso && richDoc.seeAlso.length > 0) {
            const related = richDoc.seeAlso.map((item: string) => ({
                name: item,
                description: ''
            }));
            md.appendMarkdown(this.theme.formatSeeAlso(related));
        }

        // Examples section with enhanced formatting
        if (richDoc.examples && richDoc.examples.length > 0) {
            md.appendMarkdown(this.theme.formatSectionHeader('Examples'));
            for (const ex of richDoc.examples) {
                md.appendMarkdown(this.theme.formatExampleEnhanced({
                    title: ex.title,
                    code: ex.code,
                    output: ex.output,
                    description: ex.description
                }));
            }
        }

        // Version metadata
        if (richDoc.versionAdded || richDoc.versionChanged) {
            md.appendMarkdown(this.theme.formatVersionMetadata({
                added: richDoc.versionAdded,
                changed: richDoc.versionChanged,
                deprecated: richDoc.deprecated
            }));
        }

        // Documentation link (only if quick actions not shown at top)
        if (!uiConfig.showQuickActions && richDoc.url) {
            md.appendMarkdown(this.theme.formatDivider());
            const links = [{ text: 'View Documentation', url: richDoc.url, icon: 'book' }];
            md.appendMarkdown(this.theme.formatActionLinks(links));
        }

        // Keyboard hints at bottom
        if (uiConfig.showKeyboardHints) {
            const shortcuts = [
                { keys: 'F12', description: 'Go to definition' },
                { keys: 'Ctrl+Space', description: 'IntelliSense' }
            ];
            md.appendMarkdown(this.theme.formatKeyboardHint(shortcuts));
        }

        // Version footer
        this.appendVersionFooter(md, pythonVersionInfo);

        return new vscode.Hover(md);
    }

    /**
     * Create a hover for special dunder methods
     */
    private createDunderMethodHover(methodName: string, dunderInfo: { description: string; example?: string }, pythonVersionInfo?: { version: string; pythonPath?: string }): vscode.Hover {
        const md = this.theme.createMarkdown();
        const uiConfig = this.configManager.getConfig().ui;

        // Header for special method
        md.appendMarkdown(this.theme.formatHeader(`${methodName} — Special Method`, 'method'));

        // Badge for special method
        const badges: Array<{ text: string, type?: 'info' | 'success' | 'warning' | 'error' }> = [
            { text: 'Special Method', type: 'info' },
            { text: 'Dunder', type: 'success' }
        ];
        md.appendMarkdown(this.theme.formatBadgeGroup(badges));

        // Quick actions bar
        if (uiConfig.showQuickActions) {
            const docUrl = "https://docs.python.org/3/reference/datamodel.html#special-method-names";
            const encodedDocUrl = encodeURIComponent(JSON.stringify([docUrl]));
            const actions = [
                { text: 'Docs', icon: 'book', command: `command:pythonHover.openDocs?${encodedDocUrl}` },
                { text: 'Copy URL', icon: 'link', command: `command:pythonHover.copyUrl?${encodedDocUrl}` }
            ];
            md.appendMarkdown(this.theme.formatQuickActions(actions));
        }

        md.appendMarkdown(this.theme.formatDivider());

        // Description
        md.appendMarkdown(this.theme.formatContent(dunderInfo.description));

        // Example code if available
        if (ENHANCED_EXAMPLES[methodName]) {
            md.appendMarkdown(this.theme.formatSectionHeader('Example'));
            md.appendMarkdown(ENHANCED_EXAMPLES[methodName].content);
            md.appendMarkdown('\n\n');
        } else if (dunderInfo.example) {
            md.appendMarkdown(this.theme.formatSectionHeader('Example'));
            md.appendMarkdown(this.theme.formatCodeBlock(dunderInfo.example));
        }

        // Informative note
        md.appendMarkdown(this.theme.formatNote('Special methods are invoked implicitly by Python syntax and built-in operations.'));

        // Related dunder methods (See Also section)
        if (uiConfig.showSeeAlso) {
            const related = this.getRelatedDunderMethods(methodName);
            if (related.length > 0) {
                md.appendMarkdown(this.theme.formatSeeAlso(related));
            }
        }

        md.appendMarkdown(this.theme.formatDivider());

        // Action links (only if quick actions not shown at top)
        if (!uiConfig.showQuickActions) {
            const docUrl = "https://docs.python.org/3/reference/datamodel.html#special-method-names";
            const encodedDocUrl = encodeURIComponent(JSON.stringify([docUrl]));
            const links = [
                { text: 'Open Documentation', command: `command:pythonHover.openDocs?${encodedDocUrl}`, icon: 'book' },
                { text: 'Copy URL', command: `command:pythonHover.copyUrl?${encodedDocUrl}`, icon: 'copy' }
            ];
            md.appendMarkdown(this.theme.formatActionLinks(links));
        }

        // Keyboard hints
        if (uiConfig.showKeyboardHints) {
            const shortcuts = [
                { keys: 'F12', description: 'Go to definition' },
                { keys: 'Ctrl+Space', description: 'IntelliSense' }
            ];
            md.appendMarkdown(this.theme.formatKeyboardHint(shortcuts));
        }

        // Add Python version at the bottom
        this.appendVersionFooter(md, pythonVersionInfo);

        return new vscode.Hover(md);
    }

    /**
     * Get related dunder methods based on category
     */
    private getRelatedDunderMethods(methodName: string): RelatedSymbol[] {
        // Categorize dunder methods by functionality
        const categories: Record<string, { methods: string[], description: string }> = {
            '__init__': {
                methods: ['__new__', '__del__', '__repr__', '__str__'],
                description: 'Object lifecycle methods'
            },
            '__str__': {
                methods: ['__repr__', '__format__', '__bytes__'],
                description: 'String representation methods'
            },
            '__repr__': {
                methods: ['__str__', '__format__', '__bytes__'],
                description: 'String representation methods'
            },
            '__add__': {
                methods: ['__radd__', '__iadd__', '__sub__', '__mul__'],
                description: 'Arithmetic operators'
            },
            '__eq__': {
                methods: ['__ne__', '__lt__', '__le__', '__gt__', '__ge__', '__hash__'],
                description: 'Comparison operators'
            },
            '__getitem__': {
                methods: ['__setitem__', '__delitem__', '__len__', '__contains__'],
                description: 'Container methods'
            },
            '__enter__': {
                methods: ['__exit__'],
                description: 'Context manager protocol'
            },
            '__call__': {
                methods: ['__init__', '__new__'],
                description: 'Callable protocol'
            },
            '__iter__': {
                methods: ['__next__', '__reversed__', '__contains__'],
                description: 'Iterator protocol'
            },
            '__get__': {
                methods: ['__set__', '__delete__', '__set_name__'],
                description: 'Descriptor protocol'
            }
        };

        const category = categories[methodName];
        if (!category) {
            return [];
        }

        return category.methods
            .filter(m => m !== methodName)
            .map(m => ({
                name: m,
                description: SPECIAL_METHOD_DESCRIPTIONS[m] || ''
            }));
    }

    /**
     * Create a hover with enhanced examples
     */
    private createEnhancedExampleHover(symbolName: string, pythonVersionInfo?: { version: string; pythonPath?: string }): vscode.Hover {
        this.logger.debug(`📖 Creating enhanced example hover for: ${symbolName}`);
        const md = this.theme.createMarkdown();

        // Determine type
        const displayType = symbolName === 'class' ? 'Class Definition' : 'Keyword';

        // Header
        md.appendMarkdown(this.theme.formatHeader(`${symbolName}`, 'keyword'));

        // Badge
        const badges = [{ text: displayType, type: 'info' as const }];
        md.appendMarkdown(this.theme.formatBadgeGroup(badges));

        md.appendMarkdown(this.theme.formatDivider());

        // Description if available
        if (ENHANCED_EXAMPLES[symbolName].description) {
            md.appendMarkdown(this.theme.formatContent(ENHANCED_EXAMPLES[symbolName].description));
        }

        // Rich example content
        md.appendMarkdown(ENHANCED_EXAMPLES[symbolName].content);
        md.appendMarkdown('\n\n');

        md.appendMarkdown(this.theme.formatDivider());

        // Link to official docs using the direct URL mapping if available
        const docUrlFromMap = this.getDocUrlForSymbol(symbolName);
        this.logger.debug(`🔗 Doc URL from MAP: ${docUrlFromMap || '(not found)'}`);
        const docUrl = docUrlFromMap || `https://docs.python.org/3/reference/compound_stmts.html#${symbolName}`;
        this.logger.debug(`🔗 Final doc URL: ${docUrl}`);
        const links = [
            { text: 'View in Python documentation', url: docUrl, icon: 'book' }
        ];
        md.appendMarkdown(this.theme.formatActionLinks(links));

        // Add Python version at the bottom
        this.appendVersionFooter(md, pythonVersionInfo);

        return new vscode.Hover(md);
    }

    /**
     * Create enhanced example hover with full documentation content
     */
    private createEnhancedExampleHoverWithDocs(
        symbolName: string,
        docSnippet: any,
        inventoryEntry: InventoryEntry,
        pythonVersionInfo?: { version: string; pythonPath?: string }
    ): vscode.Hover {
        this.logger.debug(`📖 Creating enhanced example hover WITH docs for: ${symbolName}`);
        const md = this.theme.createMarkdown();

        // Header
        md.appendMarkdown(this.theme.formatHeader(`${symbolName}`, 'keyword'));

        // Badge
        const displayType = symbolName === 'class' ? 'Class Definition' : 'Keyword';
        const badges = [{ text: displayType, type: 'info' as const }];
        md.appendMarkdown(this.theme.formatBadgeGroup(badges));

        md.appendMarkdown(this.theme.formatDivider());

        // Add documentation content (already includes examples from exampleEnricher)
        if (docSnippet?.content) {
            this.logger.debug(`📄 Adding documentation content (${docSnippet.content.length} chars)`);
            md.appendMarkdown(this.theme.formatContent(docSnippet.content));
            md.appendMarkdown('\n\n');
        }

        md.appendMarkdown(this.theme.formatDivider());

        // Link to official docs
        const fullUrl = `${inventoryEntry.uri}#${inventoryEntry.anchor}`;
        const links = [
            { text: 'View in Python documentation', url: fullUrl, icon: 'book' }
        ];
        md.appendMarkdown(this.theme.formatActionLinks(links));

        // Add Python version at the bottom
        this.appendVersionFooter(md, pythonVersionInfo);

        return new vscode.Hover(md);
    }

    private async createRichHover(
        docSnippet: any,
        inventoryEntry: InventoryEntry | null,
        symbolInfo: { symbol: string; type: string; context?: string },
        pythonVersionInfo?: { version: string; pythonPath?: string }
    ): Promise<vscode.Hover> {
        // NEW: Try to fetch rich documentation using SphinxParser for stdlib docs
        if (inventoryEntry) {
            const docUrl = `${inventoryEntry.uri}#${inventoryEntry.anchor}`;
            this.logger.debug(`🔍 Attempting to fetch rich stdlib documentation for ${symbolInfo.symbol} from ${docUrl}`);

            try {
                const richDoc = await this.documentationFetcher.fetchRichDocumentation(docUrl, symbolInfo.symbol);

                // If we have rich documentation with meaningful content, use it
                if (richDoc && (richDoc.parameters?.length || richDoc.examples?.length || richDoc.seeAlso?.length || richDoc.raises?.length || richDoc.summary)) {
                    this.logger.debug(`✅ Using rich SphinxParser documentation for stdlib symbol ${symbolInfo.symbol}`);
                    return this.createDynamicRichHover(richDoc, symbolInfo.type, pythonVersionInfo);
                }
            } catch (error) {
                this.logger.debug(`ℹ️ SphinxParser failed for ${symbolInfo.symbol}, falling back to manual extraction:`, error);
            }
        }

        // Fallback to manual extraction if SphinxParser doesn't work
        this.logger.debug(`ℹ️ Using manual extraction for ${symbolInfo.symbol}`);

        const md = this.theme.createMarkdown();
        const uiConfig = this.configManager.getConfig().ui;

        // Determine display name - for methods with context, show "type.method"
        let displayName: string;
        if (symbolInfo.type === 'method' && symbolInfo.context) {
            displayName = `${symbolInfo.context}.${symbolInfo.symbol}`;
        } else {
            displayName = inventoryEntry?.name || symbolInfo.symbol;
        }

        const bareSymbol = symbolInfo.symbol.split('.').pop() || symbolInfo.symbol;

        // Header with theme
        md.appendMarkdown(this.theme.formatHeader(displayName, symbolInfo.type));

        // Type/role badges
        const badges = [];
        if (inventoryEntry) {
            badges.push({ text: `${inventoryEntry.domain}:${inventoryEntry.role}`, type: 'info' as const });
        } else {
            badges.push({ text: symbolInfo.type, type: 'info' as const });
        }
        md.appendMarkdown(this.theme.formatBadgeGroup(badges));

        // NEW: Check for deprecation and show warning prominently
        if (uiConfig.showDeprecationWarnings && docSnippet && docSnippet.content) {
            const deprecation = this.isDeprecated(docSnippet.content);
            if (deprecation) {
                md.appendMarkdown(this.theme.formatDeprecation(
                    deprecation.version || '',
                    deprecation.message,
                    deprecation.alternative
                ));
            }
        }

        // NEW: Add quick actions bar at top
        if (uiConfig.showQuickActions && (docSnippet || inventoryEntry)) {
            const docUrl = inventoryEntry
                ? `${inventoryEntry.uri}#${inventoryEntry.anchor}`
                : (docSnippet?.url?.startsWith('http')
                    ? docSnippet.url
                    : `https://docs.python.org/3/${docSnippet?.url || ''}`);

            if (docUrl) {
                const encodedUrl = encodeURIComponent(JSON.stringify([docUrl]));
                const actions = [
                    { text: 'Docs', icon: 'book', command: `command:pythonHover.openDocs?${encodedUrl}` },
                    { text: 'Copy URL', icon: 'link', command: `command:pythonHover.copyUrl?${encodedUrl}` }
                ];
                md.appendMarkdown(this.theme.formatQuickActions(actions));
            }
        }

        md.appendMarkdown(this.theme.formatDivider());

        // NEW: Extract and show signature prominently
        if (uiConfig.showSignatures && docSnippet && docSnippet.content) {
            const signature = this.extractSignature(docSnippet.content, bareSymbol);
            if (signature) {
                md.appendMarkdown(this.theme.formatSignatureBox(signature, bareSymbol));
            }
        }

        // NEW: Extract and show parameters as table
        if (uiConfig.showParameterTables && docSnippet && docSnippet.content) {
            const params = this.extractParameters(docSnippet.content);
            if (params.length > 0) {
                md.appendMarkdown(this.theme.formatSectionHeader('Parameters'));
                md.appendMarkdown(this.theme.formatParameterTable(params));
            }
        }

        // NEW: Extract and show return type
        if (uiConfig.showReturnTypes && docSnippet && docSnippet.content) {
            const returnInfo = this.extractReturnInfo(docSnippet.content);
            if (returnInfo) {
                md.appendMarkdown(this.theme.formatReturnType(returnInfo.type, returnInfo.description));
            }
        }

        // Description section (with smart truncation)
        if (docSnippet && docSnippet.content && docSnippet.content.trim()) {
            const content = docSnippet.content.trim();

            // NEW: Detect if we got a generic/index page instead of specific documentation
            const isGenericPage = (
                content.includes('Built-in Functions¶') ||
                content.includes('are listed here in alphabetical order') ||
                (content.length > 100 && !content.toLowerCase().includes(bareSymbol.toLowerCase()))
            );

            if (isGenericPage) {
                // Show a helpful message instead of the generic page
                md.appendMarkdown(this.theme.formatWarning('Specific documentation not found. See full documentation for details.'));

                if (docSnippet.url) {
                    md.appendMarkdown(this.theme.formatContent(`\n\nDocumentation available at [docs.python.org](${docSnippet.url}).`));
                }
            } else {
                // Show the actual documentation
                const maxLength = uiConfig.maxContentLength || 800;
                const summary = this.extractBestParagraph(content);

                if (summary) {
                    if (summary.length > maxLength) {
                        const docUrl = inventoryEntry
                            ? `${inventoryEntry.uri}#${inventoryEntry.anchor}`
                            : docSnippet.url;
                        const encodedUrl = docUrl ? encodeURIComponent(JSON.stringify([docUrl])) : undefined;
                        const readMoreCmd = encodedUrl ? `command:pythonHover.openDocs?${encodedUrl}` : undefined;
                        md.appendMarkdown(this.theme.formatContentWithTruncation(summary, maxLength, readMoreCmd));
                    } else {
                        md.appendMarkdown(this.theme.formatContent(summary));
                    }
                } else {
                    // If extractBestParagraph returns nothing, show the raw content with truncation
                    if (content.length > maxLength) {
                        const docUrl = inventoryEntry
                            ? `${inventoryEntry.uri}#${inventoryEntry.anchor}`
                            : docSnippet.url;
                        const encodedUrl = docUrl ? encodeURIComponent(JSON.stringify([docUrl])) : undefined;
                        const readMoreCmd = encodedUrl ? `command:pythonHover.openDocs?${encodedUrl}` : undefined;
                        md.appendMarkdown(this.theme.formatContentWithTruncation(content, maxLength, readMoreCmd));
                    } else {
                        md.appendMarkdown(this.theme.formatContent(content));
                    }
                }
            }
        } else if (docSnippet && docSnippet.url) {
            // Fallback message when content extraction fails
            md.appendMarkdown(this.theme.formatContent(`Documentation available at [docs.python.org](${docSnippet.url}). Click **Open Documentation** below for full details.`));
        }

        // NOTE: Examples are already included in docSnippet.content via exampleEnricher
        // Do not manually add examples here to avoid duplication

        // Add version information if available
        this.appendVersionInfo(md, bareSymbol);

        // Add method comparison if available
        this.appendMethodComparison(md, bareSymbol);

        // NEW: Add "See Also" section with related symbols
        if (uiConfig.showSeeAlso) {
            const related = this.findRelatedSymbols(bareSymbol, symbolInfo.context);
            if (related.length > 0) {
                md.appendMarkdown(this.theme.formatSeeAlso(related));
            }
        }

        // Add related methods (smart suggestions) for method calls (fallback if See Also didn't cover it)
        if (symbolInfo.type === 'method' && symbolInfo.context && !uiConfig.showSeeAlso) {
            this.appendRelatedMethodsSection(md, symbolInfo.context, bareSymbol);
        }

        // Source line with clickable action links (only if quick actions not shown at top)
        if (!uiConfig.showQuickActions) {
            this.appendActionLinks(md, docSnippet, inventoryEntry);
        }

        // NEW: Add keyboard hints at bottom
        if (uiConfig.showKeyboardHints) {
            const shortcuts = [
                { keys: 'F12', description: 'Go to definition' },
                { keys: 'Ctrl+Space', description: 'IntelliSense' }
            ];
            md.appendMarkdown(this.theme.formatKeyboardHint(shortcuts));
        }

        // Add Python version at the bottom
        this.appendVersionFooter(md, pythonVersionInfo);

        return new vscode.Hover(md);
    }

    /**
     * Create a hover for f-strings
     */
    private async createFStringHover(pythonVersionInfo?: { version: string; pythonPath?: string }): Promise<vscode.Hover> {
        const md = this.theme.createMarkdown();

        // Header
        md.appendMarkdown(this.theme.formatHeader('f-string — Formatted String Literal', 'keyword'));

        // Badge
        const badges = [{ text: 'String Formatting', type: 'info' as const }];
        md.appendMarkdown(this.theme.formatBadgeGroup(badges));

        md.appendMarkdown(this.theme.formatDivider());

        // Fetch documentation content
        const docSnippet = await this.documentationFetcher.fetchDocumentationForSymbol(
            'f-string',
            undefined,
            this.configManager.maxSnippetLines
        );

        // Description
        if (docSnippet && docSnippet.content) {
            md.appendMarkdown(this.theme.formatContent(docSnippet.content));
        }

        // NOTE: Examples are already included in docSnippet.content via exampleEnricher
        // Do not manually add examples here to avoid duplication

        md.appendMarkdown(this.theme.formatDivider());

        // Action links
        const docUrl = docSnippet?.url || 'https://docs.python.org/3/reference/lexical_analysis.html#f-strings';
        const fullUrl = docUrl.startsWith('http') ? docUrl : `https://docs.python.org/3/${docUrl}`;
        const encodedUrl = encodeURIComponent(JSON.stringify([fullUrl]));
        const links = [
            { text: 'View Documentation', command: `command:pythonHover.openDocs?${encodedUrl}`, icon: 'book' },
            { text: 'Copy URL', command: `command:pythonHover.copyUrl?${encodedUrl}`, icon: 'copy' }
        ];
        md.appendMarkdown(this.theme.formatActionLinks(links));

        // Version footer
        this.appendVersionFooter(md, pythonVersionInfo);

        return new vscode.Hover(md);
    }

    /**
     * Create a hover for operators
     */
    private async createOperatorHover(operator: string, pythonVersionInfo?: { version: string; pythonPath?: string }): Promise<vscode.Hover> {
        const md = this.theme.createMarkdown();

        // Header
        md.appendMarkdown(this.theme.formatHeader(`\`${operator}\` — Python Operator`, 'operator'));

        // Badge
        const badges = [{ text: 'Operator', type: 'info' as const }];
        md.appendMarkdown(this.theme.formatBadgeGroup(badges));

        md.appendMarkdown(this.theme.formatDivider());

        // Fetch documentation content
        const operatorDocumentation = await (this.documentationFetcher as any).fetchOperatorDocumentation(operator);

        // Description
        if (operatorDocumentation && operatorDocumentation.content) {
            md.appendMarkdown(this.theme.formatContent(operatorDocumentation.content));
        }

        // Examples section
        if (STATIC_EXAMPLES[operator]) {
            md.appendMarkdown(this.theme.formatSectionHeader('Examples'));
            const examplesText = STATIC_EXAMPLES[operator].examples.join('\n');
            md.appendMarkdown(this.theme.formatCodeBlock(examplesText));
        }

        md.appendMarkdown(this.theme.formatDivider());

        // Action links
        const docUrl = operatorDocumentation?.url || 'https://docs.python.org/3/reference/expressions.html#operators';
        const fullUrl = docUrl.startsWith('http') ? docUrl : `https://docs.python.org/3/${docUrl}`;
        const encodedUrl = encodeURIComponent(JSON.stringify([fullUrl]));
        const links = [
            { text: 'View Documentation', command: `command:pythonHover.openDocs?${encodedUrl}`, icon: 'book' },
            { text: 'Copy URL', command: `command:pythonHover.copyUrl?${encodedUrl}`, icon: 'copy' }
        ];
        md.appendMarkdown(this.theme.formatActionLinks(links));

        // Version footer
        this.appendVersionFooter(md, pythonVersionInfo);

        return new vscode.Hover(md);
    }

    /**
     * Extract the best paragraph from content
     */
    private extractBestParagraph(content: string): string {
        const paragraphs = content
            .split(/\n\s*\n/)
            .map((p: string) => p.trim())
            .filter((p: string) => p.length > 0);

        const goodParagraphs: string[] = [];

        for (const p of paragraphs) {
            // Skip headers (except the first one if it's the function signature)
            if (/^#{1,6}\s+/.test(p) && goodParagraphs.length > 0) continue;
            // Skip standalone links
            if (/^\[.*\]\(.*\)$/.test(p)) continue;

            // Include paragraphs with substantial text content
            if (/[A-Za-z]/.test(p) && p.length > 10) {
                goodParagraphs.push(p);

                // Collect up to 3-4 paragraphs or ~400 characters, whichever comes first
                const totalLength = goodParagraphs.join('\n\n').length;
                if (goodParagraphs.length >= 3 || totalLength >= 400) {
                    break;
                }
            }
        }

        if (goodParagraphs.length > 0) {
            return goodParagraphs.join('\n\n');
        }

        return paragraphs[0] || '';
    }

    /**
     * Append related methods section
     */
    private appendRelatedMethodsSection(
        md: vscode.MarkdownString,
        context: string,
        methodName: string
    ): void {
        const config = vscode.workspace.getConfiguration('pythonHover');
        if (!config.get('showRelatedMethods', true)) {
            return;
        }

        const relatedMethods = getRelatedMethodsForMethod(context, methodName);

        if (relatedMethods.length > 0) {
            md.appendMarkdown(this.theme.formatSectionHeader('Related Methods'));
            const methodsToShow = relatedMethods.slice(0, 5);

            for (const method of methodsToShow) {
                md.appendMarkdown(this.theme.formatListItem(`\`${context}.${method.name}()\` — ${method.description}`));
            }
            md.appendMarkdown('\n');
        }
    }

    /**
     * Append action links with proper command URIs for guaranteed clickability
     */
    private appendActionLinks(
        md: vscode.MarkdownString,
        docSnippet: any,
        inventoryEntry: InventoryEntry | null
    ): void {
        let docUrl: string | null = null;

        // Determine documentation URL
        if (inventoryEntry) {
            docUrl = inventoryEntry.anchor
                ? `${inventoryEntry.uri}#${inventoryEntry.anchor}`
                : inventoryEntry.uri;
        } else if (docSnippet && docSnippet.url) {
            docUrl = docSnippet.url.startsWith('http')
                ? docSnippet.url
                : `https://docs.python.org/3/${docSnippet.url}`;
        }

        if (docUrl) {
            const encodedUrl = encodeURIComponent(JSON.stringify([docUrl]));
            const displayUrl = docUrl.replace(/^https?:\/\//, '');

            md.appendMarkdown(this.theme.formatDivider());

            // Source line
            md.appendMarkdown(`**Source:** ${this.theme.formatLink(displayUrl, docUrl)}\n\n`);

            // Action links with enhanced formatting
            const links = [
                { text: 'Open Documentation', command: `command:pythonHover.openDocs?${encodedUrl}`, icon: 'book' },
                { text: 'Copy URL', command: `command:pythonHover.copyUrl?${encodedUrl}`, icon: 'copy' }
            ];
            md.appendMarkdown(this.theme.formatActionLinks(links));
        }
    }

    /**
     * Append version information if available
     */
    private appendVersionInfo(md: vscode.MarkdownString, symbolName: string): void {
        const config = vscode.workspace.getConfiguration('pythonHover');
        if (!config.get('showVersionInfo', true)) {
            return;
        }

        const versionInfo = getVersionInfo(symbolName);
        if (versionInfo) {
            md.appendMarkdown(this.theme.formatSectionHeader('Version Info'));
            md.appendMarkdown(formatVersionInfo(versionInfo));
        }
    }

    /**
     * Append method comparison if available
     */
    private appendMethodComparison(md: vscode.MarkdownString, methodName: string): void {
        const config = vscode.workspace.getConfiguration('pythonHover');
        if (!config.get('showVersionInfo', true)) {
            return;
        }

        const comparison = getMethodComparison(methodName);
        if (comparison) {
            md.appendMarkdown(this.theme.formatSectionHeader('Version Comparison'));
            md.appendMarkdown(formatComparison(comparison));
        }
    }

    /**
     * Append Python version footer consistently
     */
    private appendVersionFooter(md: vscode.MarkdownString, pythonVersionInfo?: { version: string; pythonPath?: string }): void {
        if (pythonVersionInfo) {
            md.appendMarkdown(this.theme.formatDivider());
            md.appendMarkdown(`<div style="text-align: right; font-size: 0.85em; color: #888;">Python ${pythonVersionInfo.version}</div>`);
        }
    }

    /**
     * Extract parameters from documentation content
     */
    private extractParameters(docContent: string): ParameterInfo[] {
        const params: ParameterInfo[] = [];

        // Try to match Sphinx-style parameter lists
        // Matches patterns like:
        // :param name: description
        // :param type name: description
        const paramRegex = /:(?:param|parameter)(?:\s+(\w+))?\s+(\w+):\s*(.+?)(?=\n:|$)/gs;
        let match;

        while ((match = paramRegex.exec(docContent)) !== null) {
            const type = match[1]; // Optional type
            const name = match[2];
            const description = match[3].trim();

            params.push({
                name,
                type,
                description,
                required: true // Default to required unless we find otherwise
            });
        }

        // Also try to match Google-style docstrings
        // Args:
        //     name (type): description
        if (params.length === 0) {
            const argsSection = docContent.match(/Args?:\s*\n((?:\s+.+\n?)+)/i);
            if (argsSection) {
                const argsText = argsSection[1];
                const argLines = argsText.split('\n').filter(line => line.trim());

                for (const line of argLines) {
                    const googleMatch = line.match(/^\s*(\w+)\s*(?:\(([^)]+)\))?\s*:\s*(.+)/);
                    if (googleMatch) {
                        params.push({
                            name: googleMatch[1],
                            type: googleMatch[2],
                            description: googleMatch[3].trim(),
                            required: !googleMatch[3].includes('optional')
                        });
                    }
                }
            }
        }

        return params;
    }

    /**
     * Extract function signature from documentation
     */
    private extractSignature(docContent: string, symbolName: string): string | null {
        // Try to find a code block with the function signature
        const codeBlockMatch = docContent.match(/```(?:python)?\s*\n([^\n]+\([\s\S]*?\)(?:\s*->\s*\w+)?)\n```/);
        if (codeBlockMatch) {
            return codeBlockMatch[1].trim();
        }

        // Try to find inline code with function signature
        const inlineMatch = docContent.match(new RegExp(`\`${symbolName}\\([^)]*\\)(?:\\s*->\\s*\\w+)?\``));
        if (inlineMatch) {
            return inlineMatch[0].replace(/`/g, '').trim();
        }

        // Try to match signature-style patterns
        const sigMatch = docContent.match(new RegExp(`${symbolName}\\s*\\([^)]*\\)(?:\\s*->\\s*[^\\n]+)?`));
        if (sigMatch) {
            return sigMatch[0].trim();
        }

        return null;
    }

    /**
     * Detect if a symbol is deprecated
     * Only matches explicit deprecation warnings, not casual mentions
     */
    private isDeprecated(docContent: string): DeprecationInfo | null {
        // Only match explicit deprecation patterns to avoid false positives

        // 1. Check for Sphinx .. deprecated:: directive
        const sphinxMatch = docContent.match(/\.\.\s+deprecated::\s*([0-9.]+)?\s*\n\s+(.+)/);
        if (sphinxMatch) {
            return {
                version: sphinxMatch[1],
                message: sphinxMatch[2].trim()
            };
        }

        // 2. Match lines that START with "Deprecated" (with optional bold/strong markers)
        const explicitDeprecated = docContent.match(/(?:^|\n)(?:\*\*)?Deprecated(?:\*\*)?(?:\s+(?:since|in)\s+(?:version\s+)?([0-9.]+))?[:\s]+(.+?)(?:\n|$)/im);
        if (explicitDeprecated) {
            const version = explicitDeprecated[1];
            let message = explicitDeprecated[2].trim();

            // Try to find alternative suggestion
            const altMatch = message.match(/(?:use|try|replaced by|instead use)\s+[`']?(\w+(?:\.\w+)?(?:\(\))?)[`']?/i);
            const alternative = altMatch ? altMatch[1] : undefined;

            message = message.replace(/\.$/, '');

            return {
                version,
                message,
                alternative
            };
        }

        // 3. Match deprecation warnings that are clearly standalone statements
        const warningMatch = docContent.match(/(?:^|\n)(?:⚠️|WARNING|Note)?\s*(?:\*\*)?This (?:function|method|class|feature) is deprecated(?:\*\*)?(?:\s+(?:since|in)\s+(?:version\s+)?([0-9.]+))?[:\s.]+(.+?)(?:\n|$)/im);
        if (warningMatch) {
            return {
                version: warningMatch[1],
                message: warningMatch[2].trim()
            };
        }

        return null;
    }

    /**
     * Extract return type information
     */
    private extractReturnInfo(docContent: string): ReturnInfo | null {
        // Try Sphinx-style :returns: or :return:
        const sphinxMatch = docContent.match(/:returns?:\s*(.+?)(?=\n:|$)/is);
        if (sphinxMatch) {
            const fullText = sphinxMatch[1].trim();
            const typeMatch = fullText.match(/^([^-–]+?)\s*[-–]\s*(.+)/);
            if (typeMatch) {
                return {
                    type: typeMatch[1].trim(),
                    description: typeMatch[2].trim()
                };
            }
            return { type: fullText };
        }

        // Try :rtype: for return type
        const rtypeMatch = docContent.match(/:rtype:\s*(.+?)(?=\n:|$)/i);
        if (rtypeMatch) {
            return { type: rtypeMatch[1].trim() };
        }

        // Try Google-style Returns:
        const googleMatch = docContent.match(/Returns:\s*\n\s+([^\n]+?):\s*(.+)/i);
        if (googleMatch) {
            return {
                type: googleMatch[1].trim(),
                description: googleMatch[2].trim()
            };
        }

        // Try to extract from signature -> Type
        const sigMatch = docContent.match(/->\s*([^:\n]+)(?::|$)/);
        if (sigMatch) {
            return { type: sigMatch[1].trim() };
        }

        return null;
    }

    /**
     * Find related symbols for "See Also" section
     */
    private findRelatedSymbols(symbolName: string, context?: string): RelatedSymbol[] {
        const related: RelatedSymbol[] = [];

        // Use existing related methods functionality
        if (context) {
            const relatedMethods = getRelatedMethodsForMethod(context, symbolName);
            for (const method of relatedMethods.slice(0, 5)) {
                related.push({
                    name: `${context}.${method.name}`,
                    description: method.description,
                    type: 'method'
                });
            }
        }

        return related;
    }

    /**
     * Get documentation URL for a symbol from the direct URL mapping
     */
    private getDocUrlForSymbol(symbol: string): string | null {
        // Import the MAP from documentationUrls
        const { MAP } = require('../data/documentationUrls');

        if (symbol in MAP) {
            const info = MAP[symbol];
            const baseUrl = 'https://docs.python.org/3/';
            const fullUrl = baseUrl + info.url;
            return info.anchor ? `${fullUrl}#${info.anchor}` : fullUrl;
        }

        return null;
    }
}
