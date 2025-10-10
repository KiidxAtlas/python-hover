import * as vscode from 'vscode';
import { CacheManager } from '../services/cache';
import { ConfigurationManager } from '../services/config';
import { ContextDetector } from '../resolvers/contextDetector';
import { CustomDocumentationLoader, formatCustomDoc } from '../documentation/customDocumentation';
import { DocumentationFetcher } from '../documentation/documentationFetcher';
import { ENHANCED_EXAMPLES } from '../data/enhancedExamples';
import { HoverTheme } from './hoverTheme';
import { InventoryEntry, InventoryManager } from '../services/inventory';
import { Logger } from '../services/logger';
import { MethodResolver } from '../resolvers/methodResolver';
import { getRelatedMethodsForMethod } from './smartSuggestions';
import { SPECIAL_METHOD_DESCRIPTIONS } from '../data/specialMethods';
import { STATIC_EXAMPLES } from '../data/staticExamples';
import { SymbolResolver } from '../resolvers/symbolResolver';
import { getImportedLibraries, getThirdPartyDoc } from '../documentation/thirdPartyLibraries';
import { formatComparison, formatVersionInfo, getMethodComparison, getVersionInfo } from './versionComparison';
import { VersionDetector } from './versionDetector';
import { ParameterInfo, ReturnInfo, DeprecationInfo, RelatedSymbol } from '../types';

export class PythonHoverProvider implements vscode.HoverProvider {
    private logger: Logger;
    private symbolResolver: SymbolResolver;
    private documentationFetcher: DocumentationFetcher;
    private contextDetector: ContextDetector;
    private methodResolver: MethodResolver;
    private customDocsLoader: CustomDocumentationLoader;
    private pendingHoverRequests: Map<string, Promise<vscode.Hover | null>>;
    private theme: HoverTheme;
    private debounceTimers: Map<string, NodeJS.Timeout>;
    private versionCache: Map<string, { version: string; timestamp: number }>;

    constructor(
        private configManager: ConfigurationManager,
        private inventoryManager: InventoryManager,
        private versionDetector: VersionDetector,
        cacheManager: CacheManager
    ) {
        this.logger = Logger.getInstance();
        this.symbolResolver = new SymbolResolver();
        this.documentationFetcher = new DocumentationFetcher(cacheManager);
        this.contextDetector = new ContextDetector();
        this.methodResolver = new MethodResolver();
        this.customDocsLoader = new CustomDocumentationLoader();
        this.pendingHoverRequests = new Map();
        this.theme = new HoverTheme();
        this.debounceTimers = new Map();
        this.versionCache = new Map();

        // Load custom docs when initialized
        this.loadCustomDocs();
    }

    /**
     * Get debounce delay from configuration
     */
    private getDebounceDelay(): number {
        return this.configManager.getValue<number>('debounceDelay', 150);
    }

    /**
     * Get version cache TTL from configuration (in milliseconds)
     */
    private getVersionCacheTTL(): number {
        const seconds = this.configManager.getValue<number>('versionCacheTTL', 30);
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

    /**
     * Get cached Python version for a document
     * Caches version detection results to avoid repeated file system operations
     */
    private async getCachedPythonVersion(document: vscode.TextDocument): Promise<{ version: string; pythonPath?: string }> {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        const cacheKey = workspaceFolder?.uri.toString() || 'default';

        // Check if we have a cached version that's still valid
        const cached = this.versionCache.get(cacheKey);
        const now = Date.now();

        if (cached && (now - cached.timestamp) < this.getVersionCacheTTL()) {
            this.logger.debug(`Using cached Python version: ${cached.version}`);
            return { version: cached.version, pythonPath: (cached as any).pythonPath };
        }

        // Detect version and cache it
        this.logger.debug(`Detecting Python version for workspace: ${cacheKey}`);
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
        // Check if cancellation was requested
        if (token.isCancellationRequested) {
            return null;
        }

        // Create unique key for request deduplication
        const requestKey = `${document.uri.toString()}:${position.line}:${position.character}`;

        // Check if we already have a pending request for this position
        if (this.pendingHoverRequests.has(requestKey)) {
            this.logger.debug(`Reusing pending request for ${requestKey}`);
            return this.pendingHoverRequests.get(requestKey)!;
        }

        // Debounce: Cancel any existing timer for this position
        const existingTimer = this.debounceTimers.get(requestKey);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        // Create debounced promise
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

        // Store it to deduplicate concurrent requests
        this.pendingHoverRequests.set(requestKey, debouncedPromise);

        try {
            return await debouncedPromise;
        } finally {
            // Clean up after request completes
            this.pendingHoverRequests.delete(requestKey);
        }
    }

    private async provideHoverImpl(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): Promise<vscode.Hover | null> {
        try {
            // Detect Python version for this document (with caching)
            const versionInfo = await this.getCachedPythonVersion(document);
            const pythonVersion = versionInfo.version;
            const pythonPath = versionInfo.pythonPath;
            this.logger.debug(`Using Python version: ${pythonVersion}${pythonPath ? ` (${pythonPath})` : ''}`);

            // Resolve symbols at the current position
            const symbols = this.symbolResolver.resolveSymbolAtPosition(document, position);
            this.logger.debug(`Symbols resolved: ${JSON.stringify(symbols)}`);
            if (symbols.length === 0) {
                return null;
            }

            // Try to resolve the first symbol
            const primarySymbol = symbols[0];
            this.logger.debug(`Resolving symbol: ${primarySymbol.symbol} (type: ${primarySymbol.type})`);

            // NEW: Check for custom documentation first
            const customDoc = this.customDocsLoader.getCustomDoc(primarySymbol.symbol);
            if (customDoc) {
                this.logger.debug(`Found custom documentation for ${primarySymbol.symbol}`);
                return this.createCustomDocHover(customDoc, primarySymbol, versionInfo);
            }

            // Get imported libraries for later use (even if auto-detect is disabled, we still need this for context)
            const documentText = document.getText();
            const importedLibsMap = getImportedLibraries(documentText, this.configManager);
            const importedLibsSet = new Set(importedLibsMap.values());

            // NEW: Check for third-party library documentation (if auto-detect is enabled)
            if (this.configManager.autoDetectLibrariesEnabled) {
                // Check if we're hovering over a module import (like 'numpy')
                // Only show module hover if the symbol IS the library itself, not an imported symbol FROM the library
                if (importedLibsSet.has(primarySymbol.symbol)) {
                    // This is the library itself (e.g., hovering over 'numpy' in 'import numpy')
                    const { version, pythonPath } = await this.getCachedPythonVersion(document);
                    return await this.createModuleHover(primarySymbol.symbol, version, pythonPath);
                }

                // Check if this symbol was imported FROM a library (e.g., 'KernelManager' from 'jupyter_client')
                const sourceLibrary = importedLibsMap.get(primarySymbol.symbol);
                if (sourceLibrary && sourceLibrary !== primarySymbol.symbol) {
                    // This symbol was imported from a library, look it up in that library's inventory
                    this.logger.debug(`Symbol '${primarySymbol.symbol}' imported from library '${sourceLibrary}', looking up in inventory`);

                    const { version, pythonPath } = await this.getCachedPythonVersion(document);

                    // Try to find the full qualified name in the inventory
                    // For example: KernelManager -> jupyter_client.manager.KernelManager
                    const entry = await this.inventoryManager.resolveSymbol(
                        primarySymbol.symbol,
                        version,
                        sourceLibrary,  // Pass the source library as context
                        pythonPath
                    );

                    if (entry) {
                        this.logger.debug(`Found inventory entry for ${primarySymbol.symbol} from ${sourceLibrary}: ${entry.uri}#${entry.anchor}`);

                        // Fetch and create rich hover for this inventory entry
                        const maxLines = this.configManager.maxSnippetLines;
                        const docSnippet = await this.documentationFetcher.fetchDocumentationForSymbol(
                            primarySymbol.symbol,
                            entry,
                            maxLines,
                            sourceLibrary
                        );

                        return this.createRichHover(docSnippet, entry, primarySymbol, versionInfo);
                    }

                    this.logger.debug(`No inventory entry found for ${primarySymbol.symbol} from ${sourceLibrary}, continuing with other lookups`);
                    // Fall through to other lookups if not found
                }
            } else {
                this.logger.debug(`Auto-detect libraries is disabled, skipping third-party library auto-detection`);
            }

            // Check if this is a method call on a third-party library (e.g., np.array, pd.DataFrame)
            // Extract just the method name if symbol contains a dot
            let methodName = primarySymbol.symbol;
            if (methodName.includes('.')) {
                methodName = methodName.split('.').pop() || methodName;
            }

            // First check if the context is a known library (from symbol resolver)
            if (primarySymbol.type === 'method' && primarySymbol.context) {
                const thirdPartyDoc = getThirdPartyDoc(primarySymbol.context, methodName);
                if (thirdPartyDoc) {
                    this.logger.debug(`Found third-party docs for ${primarySymbol.context}.${methodName}`);
                    return this.createThirdPartyHover(thirdPartyDoc, primarySymbol, versionInfo);
                }
            }

            // Also check all imported libraries by their actual names
            for (const lib of importedLibsSet) {
                const thirdPartyDoc = getThirdPartyDoc(lib, methodName);
                if (thirdPartyDoc) {
                    this.logger.debug(`Found third-party docs for ${lib}.${methodName}`);
                    return this.createThirdPartyHover(thirdPartyDoc, primarySymbol, versionInfo);
                }
            }

            // ENHANCEMENT: Check for method context
            if (primarySymbol.type === 'method') {
                // If symbol contains a dot (like "paths.jupyter_data_dir"), check if the base is an import
                let methodName = primarySymbol.symbol;
                let receiverType = primarySymbol.context;

                if (methodName.includes('.')) {
                    const parts = methodName.split('.');
                    const baseSymbol = parts[0]; // e.g., "paths" from "paths.jupyter_data_dir"
                    methodName = parts[parts.length - 1]; // Get just "jupyter_data_dir"
                    this.logger.debug(`Extracted method name: ${methodName}`);
                    this.logger.debug(`Checking if base symbol "${baseSymbol}" is an imported module...`);

                    // Check if the base symbol is an imported third-party module
                    if (importedLibsMap.has(baseSymbol)) {
                        const library = importedLibsMap.get(baseSymbol);
                        this.logger.debug(`Base symbol "${baseSymbol}" is imported from: ${library}`);
                        receiverType = library; // Use the actual library name
                        primarySymbol.context = library; // Update the context immediately
                        primarySymbol.symbol = methodName; // Update symbol to just the method name
                    }
                }

                // Detect the method's object type for better context if not already provided
                // Skip if we already determined it's from an imported library
                if (!receiverType && !importedLibsMap.has(methodName.split('.')[0])) {
                    receiverType = this.contextDetector.detectMethodContext(document, position, methodName);
                }

                if (receiverType) {
                    this.logger.debug(`Detected method context: ${receiverType}.${methodName}`);

                    // Only resolve method info if we haven't already set context from imports
                    if (!primarySymbol.context) {
                        // Resolve method with context
                        const methodInfo = this.methodResolver.resolveMethodInfo(document, position, methodName, receiverType);
                        if (methodInfo) {
                            primarySymbol.context = receiverType;
                            // Store as "type.method" for display, but we'll look up just the method
                            primarySymbol.symbol = methodName;
                        } else {
                            primarySymbol.symbol = methodName;
                        }
                    }
                } else {
                    // No context found, just use the method name
                    if (!primarySymbol.context) {
                        primarySymbol.symbol = methodName;
                    }
                }
            }

            // ENHANCEMENT: Check for special dunder methods
            if (primarySymbol.symbol.startsWith('__') && primarySymbol.symbol.endsWith('__')) {
                this.logger.debug(`Detected special method: ${primarySymbol.symbol}`);

                // Log available special method descriptions for debugging
                this.logger.debug(`Available special method descriptions: ${Object.keys(SPECIAL_METHOD_DESCRIPTIONS).join(', ')}`);

                // Extract pure dunder method name if it's part of a qualified name (e.g., "MyClass.__init__")
                let dunderMethodName = primarySymbol.symbol;
                if (dunderMethodName.includes('.')) {
                    dunderMethodName = dunderMethodName.split('.').pop() || dunderMethodName;
                    this.logger.debug(`Extracted dunder method name: ${dunderMethodName}`);
                }

                // Use SPECIAL_METHOD_DESCRIPTIONS directly
                const description = SPECIAL_METHOD_DESCRIPTIONS[dunderMethodName];
                this.logger.debug(`Found description: ${description || 'none'}`);

                if (description) {
                    // Create custom hover for dunder methods
                    const dunderInfo = { description };
                    return this.createDunderMethodHover(dunderMethodName, dunderInfo, versionInfo);
                }
            }

            // Build the symbol to look up in inventory
            let lookupSymbol = primarySymbol.symbol;
            if (primarySymbol.type === 'method' && primarySymbol.context) {
                // For methods, look up as "type.method" (e.g., "list.append")
                // But don't duplicate if the symbol already includes the context (e.g., "torch.zeros")
                if (!primarySymbol.symbol.startsWith(primarySymbol.context + '.')) {
                    lookupSymbol = `${primarySymbol.context}.${primarySymbol.symbol}`;
                }
                this.logger.debug(`Looking up method as: ${lookupSymbol}`);
            }

            const inventoryEntry = await this.inventoryManager.resolveSymbol(
                lookupSymbol,
                pythonVersion,
                primarySymbol.context, // Pass context for third-party library support
                pythonPath // Pass Python path for version-aware inventory
            );

            this.logger.debug(`Inventory entry result: ${inventoryEntry ? `${inventoryEntry.name} -> ${inventoryEntry.uri}#${inventoryEntry.anchor}` : 'not found'}`);

            // Check for f-strings
            if (primarySymbol.type === 'f-string') {
                this.logger.debug(`Handling f-string: ${primarySymbol.symbol}`);
                // Create a themed hover for f-strings
                return this.createFStringHover(versionInfo);
            }

            // Handle operators
            if (primarySymbol.type === 'operator') {
                this.logger.debug(`Handling operator: ${primarySymbol.symbol}`);
                return this.createOperatorHover(primarySymbol.symbol, versionInfo);
            }

            // ENHANCEMENT: Handle language keywords with enhanced examples
            if (primarySymbol.type === 'keyword' && ENHANCED_EXAMPLES[primarySymbol.symbol]) {
                this.logger.debug(`Found enhanced example for keyword: ${primarySymbol.symbol}`);
                return this.createEnhancedExampleHover(primarySymbol.symbol, versionInfo);
            }

            // Fetch documentation snippet with adjusted limits for compound statements
            let maxLines = this.configManager.maxSnippetLines;
            // For compound statement keywords, allow more lines to show complete context
            if (['else', 'elif', 'finally', 'except', 'with'].includes(primarySymbol.symbol)) {
                maxLines = Math.max(40, maxLines); // At least 40 lines for compound statements
            }

            // Use the new unified documentation fetcher that prioritizes direct URL mappings
            const docSnippet = await this.documentationFetcher.fetchDocumentationForSymbol(
                primarySymbol.symbol,
                inventoryEntry || undefined,
                maxLines,
                primarySymbol.context // Pass context for better examples
            );

            this.logger.debug(`Generated documentation URL: ${docSnippet.url}`);

            return this.createRichHover(docSnippet, inventoryEntry, primarySymbol, versionInfo);

        } catch (error: any) {
            // Better error handling with user feedback
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
        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        md.supportHtml = true;
        md.supportThemeIcons = true;

        // Format custom documentation
        md.appendMarkdown(formatCustomDoc(customDoc));

        // Add Python version at the bottom
        this.appendVersionFooter(md, pythonVersionInfo);

        return new vscode.Hover(md);
    }

    private async createModuleHover(moduleName: string, pythonVersion: string, pythonPath?: string): Promise<vscode.Hover> {
        const md = this.theme.createMarkdown();

        // Header
        md.appendMarkdown(this.theme.formatHeader(`${moduleName} module`, 'module'));

        // Try to fetch module documentation from inventory
        const entry = await this.inventoryManager.resolveSymbol(
            moduleName,
            pythonVersion,
            moduleName,  // Use the module name as context to search in its own inventory
            pythonPath
        );

        if (entry) {
            this.logger.debug(`Found inventory entry for module ${moduleName}: ${entry.uri}#${entry.anchor}`);

            // Fetch documentation snippet
            const maxLines = this.configManager.maxSnippetLines;
            const docSnippet = await this.documentationFetcher.fetchDocumentationForSymbol(
                moduleName,
                entry,
                maxLines,
                moduleName
            );

            if (docSnippet) {
                // Add badge for third-party library
                const badges = [{ text: 'Third-party Library', type: 'info' as const }];
                md.appendMarkdown(this.theme.formatBadgeGroup(badges));

                // Add description from documentation
                if (docSnippet.content) {
                    md.appendMarkdown(this.theme.formatContent(docSnippet.content));
                }

                // Add helpful tip
                md.appendMarkdown(this.theme.formatTip(`Hover over functions from \`${moduleName}\` for detailed help`));

                md.appendMarkdown(this.theme.formatDivider());

                // Add documentation link
                const fullUrl = `${entry.uri}#${entry.anchor}`;
                const links = [
                    { text: 'View Documentation', url: fullUrl, icon: 'book' }
                ];
                md.appendMarkdown(this.theme.formatActionLinks(links));

                return new vscode.Hover(md);
            }
        }

        // Fallback: Use hardcoded module info database for common libraries
        const moduleInfo: { [key: string]: { description: string; docs: string; badge?: string } } = {
            'numpy': {
                description: 'Fundamental package for scientific computing with Python',
                docs: 'https://numpy.org/doc/',
                badge: 'Scientific Computing'
            },
            'pandas': {
                description: 'Powerful data analysis and manipulation library',
                docs: 'https://pandas.pydata.org/docs/',
                badge: 'Data Analysis'
            },
            'flask': {
                description: 'Lightweight WSGI web application framework',
                docs: 'https://flask.palletsprojects.com/',
                badge: 'Web Framework'
            },
            'django': {
                description: 'High-level Python web framework',
                docs: 'https://docs.djangoproject.com/',
                badge: 'Web Framework'
            },
            'requests': {
                description: 'Elegant and simple HTTP library for Python',
                docs: 'https://requests.readthedocs.io/',
                badge: 'HTTP Client'
            }
        };

        const info = moduleInfo[moduleName.toLowerCase()];
        if (info) {
            // Badge
            if (info.badge) {
                const badges = [{ text: info.badge, type: 'info' as const }];
                md.appendMarkdown(this.theme.formatBadgeGroup(badges));
            }

            // Description
            md.appendMarkdown(this.theme.formatContent(info.description));

            // Helpful tip
            md.appendMarkdown(this.theme.formatTip(`Hover over functions like \`${moduleName}.function()\` for detailed help`));

            md.appendMarkdown(this.theme.formatDivider());

            // Action links
            const links = [
                { text: 'Official Documentation', url: info.docs, icon: 'book' }
            ];
            md.appendMarkdown(this.theme.formatActionLinks(links));
        } else {
            // Unknown third-party library
            const badges = [{ text: 'Third-party Library', type: 'info' as const }];
            md.appendMarkdown(this.theme.formatBadgeGroup(badges));

            md.appendMarkdown(this.theme.formatTip('Hover over functions for detailed help'));
        }

        // Add Python version at the bottom
        this.appendVersionFooter(md, { version: pythonVersion, pythonPath });

        return new vscode.Hover(md);
    }

    private createThirdPartyHover(libDoc: any, symbolInfo: { symbol: string; type: string }, pythonVersionInfo?: { version: string; pythonPath?: string }): vscode.Hover {
        const md = this.theme.createMarkdown();

        // Header with theme - use 'function' for third-party methods
        const displayType = symbolInfo.type === 'method' ? 'function' : symbolInfo.type;
        md.appendMarkdown(this.theme.formatHeader(libDoc.name, displayType));

        // Description with proper spacing
        md.appendMarkdown(this.theme.formatContent(libDoc.description));

        // Example section
        if (libDoc.example) {
            md.appendMarkdown(this.theme.formatSectionHeader('Example'));
            md.appendMarkdown(this.theme.formatCodeBlock(libDoc.example));
        }

        // Add helpful tip
        if (libDoc.version) {
            md.appendMarkdown(this.theme.formatNote(`Available since version ${libDoc.version}`));
        }

        // Action links
        if (libDoc.url) {
            md.appendMarkdown(this.theme.formatDivider());
            const links = [
                { text: 'Official Documentation', url: libDoc.url, icon: 'book' }
            ];
            md.appendMarkdown(this.theme.formatActionLinks(links));
        }

        // Add Python version at the bottom
        this.appendVersionFooter(md, pythonVersionInfo);

        return new vscode.Hover(md)    /**
     * Create a hover for special dunder methods
     */
    return new vscode.Hover(md);
    }

    /**
     * Create a hover for special dunder methods
     */
    private createDunderMethodHover(methodName: string, dunderInfo: { description: string; example?: string }, pythonVersionInfo?: { version: string; pythonPath?: string }): vscode.Hover {
        const md = this.theme.createMarkdown();

        // Header for special method
        md.appendMarkdown(this.theme.formatHeader(`${methodName} — Special Method`, 'method'));

        // Badge for special method
        const badges = [
            { text: 'Special Method', type: 'info' as const },
            { text: 'Dunder', type: 'success' as const }
        ];
        md.appendMarkdown(this.theme.formatBadgeGroup(badges));

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

        md.appendMarkdown(this.theme.formatDivider());

        // Action links
        const docUrl = "https://docs.python.org/3/reference/datamodel.html#special-method-names";
        const encodedDocUrl = encodeURIComponent(JSON.stringify([docUrl]));
        const links = [
            { text: 'Open Documentation', command: `command:pythonHover.openDocs?${encodedDocUrl}`, icon: 'book' },
            { text: 'Copy URL', command: `command:pythonHover.copyUrl?${encodedDocUrl}`, icon: 'copy' }
        ];
        md.appendMarkdown(this.theme.formatActionLinks(links));

        // Add Python version at the bottom
        this.appendVersionFooter(md, pythonVersionInfo);

        return new vscode.Hover(md);
    }

    /**
     * Create a hover with enhanced examples
     */
    private createEnhancedExampleHover(symbolName: string, pythonVersionInfo?: { version: string; pythonPath?: string }): vscode.Hover {
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

        // Link to official docs
        const docUrl = `https://docs.python.org/3/reference/compound_stmts.html#${symbolName}`;
        const links = [
            { text: 'View in Python documentation', url: docUrl, icon: 'book' }
        ];
        md.appendMarkdown(this.theme.formatActionLinks(links));

        // Add Python version at the bottom
        this.appendVersionFooter(md, pythonVersionInfo);

        return new vscode.Hover(md);
    }

    private createRichHover(
        docSnippet: any,
        inventoryEntry: InventoryEntry | null,
        symbolInfo: { symbol: string; type: string; context?: string },
        pythonVersionInfo?: { version: string; pythonPath?: string }
    ): vscode.Hover {
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
            const maxLength = uiConfig.maxContentLength || 800;
            const summary = this.extractBestParagraph(docSnippet.content);
            
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
                const content = docSnippet.content.trim();
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
        } else if (docSnippet && docSnippet.url) {
            // Fallback message when content extraction fails
            md.appendMarkdown(this.theme.formatContent(`Documentation available at [docs.python.org](${docSnippet.url}). Click **Open Documentation** below for full details.`));
        }

        // ENHANCEMENT: Add examples with better formatting
        this.appendExamplesSection(md, bareSymbol, symbolInfo);

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

        // Examples section (f-strings should have examples in STATIC_EXAMPLES or ENHANCED_EXAMPLES)
        if (STATIC_EXAMPLES['f-string']) {
            md.appendMarkdown(this.theme.formatSectionHeader('Examples'));
            const examplesText = STATIC_EXAMPLES['f-string'].examples.join('\n');
            md.appendMarkdown(this.theme.formatCodeBlock(examplesText));
        }

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
     * Append examples section with enhanced formatting
     */
    private appendExamplesSection(
        md: vscode.MarkdownString,
        bareSymbol: string,
        symbolInfo: { symbol: string; type: string; context?: string }
    ): void {
        // Check for enhanced examples
        if (ENHANCED_EXAMPLES[bareSymbol]) {
            md.appendMarkdown(this.theme.formatSectionHeader('Examples'));
            md.appendMarkdown(ENHANCED_EXAMPLES[bareSymbol].content);
            md.appendMarkdown('\n\n');
        }
        // Check for static examples
        else if (STATIC_EXAMPLES[bareSymbol]) {
            md.appendMarkdown(this.theme.formatSectionHeader('Examples'));
            const examplesText = STATIC_EXAMPLES[bareSymbol].examples.join('\n');
            md.appendMarkdown(this.theme.formatCodeBlock(examplesText));
        }
        // Check for method-specific examples
        else if (symbolInfo.type === 'method' && symbolInfo.context) {
            const methodKey = `${symbolInfo.context}.${bareSymbol}`;
            if (ENHANCED_EXAMPLES[methodKey]) {
                md.appendMarkdown(this.theme.formatSectionHeader('Examples'));
                md.appendMarkdown(ENHANCED_EXAMPLES[methodKey].content);
                md.appendMarkdown('\n\n');
            }
        }
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
     */
    private isDeprecated(docContent: string): DeprecationInfo | null {
        // Look for deprecation warnings
        const deprecatedMatch = docContent.match(/(?:deprecated|DEPRECATED)(?:\s+(?:since|in)\s+(?:version\s+)?([0-9.]+))?[:\s]+(.+?)(?:\n|$)/i);

        if (deprecatedMatch) {
            const version = deprecatedMatch[1];
            let message = deprecatedMatch[2].trim();

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

        // Check for .. deprecated:: directive (Sphinx)
        const sphinxMatch = docContent.match(/\.\.\s+deprecated::\s*([0-9.]+)?\s*\n\s+(.+)/);
        if (sphinxMatch) {
            return {
                version: sphinxMatch[1],
                message: sphinxMatch[2].trim()
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
}
