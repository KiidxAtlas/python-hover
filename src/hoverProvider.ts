import * as vscode from 'vscode';
import { CacheManager } from './cache';
import { ConfigurationManager } from './config';
import { ContextDetector } from './contextDetector';
import { CustomDocumentationLoader, formatCustomDoc } from './customDocumentation';
import { DocumentationFetcher } from './documentationFetcher';
import { ENHANCED_EXAMPLES } from './enhancedExamples';
import { HoverTheme } from './hoverTheme';
import { InventoryEntry, InventoryManager } from './inventory';
import { MethodResolver } from './methodResolver';
import { getRelatedMethodsForMethod } from './smartSuggestions';
import { SPECIAL_METHOD_DESCRIPTIONS } from './specialMethods';
import { STATIC_EXAMPLES } from './staticExamples';
import { SymbolResolver } from './symbolResolver';
import { getImportedLibraries, getThirdPartyDoc } from './thirdPartyLibraries';
import { formatComparison, formatVersionInfo, getMethodComparison, getVersionInfo } from './versionComparison';
import { VersionDetector } from './versionDetector';

export class PythonHoverProvider implements vscode.HoverProvider {
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
            console.error('[PythonHover] Error loading custom docs:', error);
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
            console.log(`[PythonHover] Using cached Python version: ${cached.version}`);
            return { version: cached.version, pythonPath: (cached as any).pythonPath };
        }

        // Detect version and cache it
        console.log(`[PythonHover] Detecting Python version for workspace: ${cacheKey}`);
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
        console.log('[PythonHover] Version cache cleared');
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
            console.log(`[PythonHover] Reusing pending request for ${requestKey}`);
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
                    console.error('[PythonHover] Error in hover provider:', error);
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
        token: vscode.CancellationToken
    ): Promise<vscode.Hover | null> {
        try {
            // Detect Python version for this document (with caching)
            const versionInfo = await this.getCachedPythonVersion(document);
            const pythonVersion = versionInfo.version;
            const pythonPath = versionInfo.pythonPath;
            console.log(`[PythonHover] Using Python version: ${pythonVersion}${pythonPath ? ` (${pythonPath})` : ''}`);

            // Resolve symbols at the current position
            const symbols = this.symbolResolver.resolveSymbolAtPosition(document, position);
            console.log(`[PythonHover] Symbols resolved: ${JSON.stringify(symbols)}`);
            if (symbols.length === 0) {
                return null;
            }

            // Try to resolve the first symbol
            const primarySymbol = symbols[0];
            console.log(`[PythonHover] Resolving symbol: ${primarySymbol.symbol} (type: ${primarySymbol.type})`);

            // NEW: Check for custom documentation first
            const customDoc = this.customDocsLoader.getCustomDoc(primarySymbol.symbol);
            if (customDoc) {
                console.log(`[PythonHover] Found custom documentation for ${primarySymbol.symbol}`);
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
                    console.log(`[PythonHover] Symbol '${primarySymbol.symbol}' imported from library '${sourceLibrary}', looking up in inventory`);

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
                        console.log(`[PythonHover] Found inventory entry for ${primarySymbol.symbol} from ${sourceLibrary}: ${entry.uri}#${entry.anchor}`);

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

                    console.log(`[PythonHover] No inventory entry found for ${primarySymbol.symbol} from ${sourceLibrary}, continuing with other lookups`);
                    // Fall through to other lookups if not found
                }
            } else {
                console.log(`[PythonHover] Auto-detect libraries is disabled, skipping third-party library auto-detection`);
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
                    console.log(`[PythonHover] Found third-party docs for ${primarySymbol.context}.${methodName}`);
                    return this.createThirdPartyHover(thirdPartyDoc, primarySymbol, versionInfo);
                }
            }

            // Also check all imported libraries by their actual names
            for (const lib of importedLibsSet) {
                const thirdPartyDoc = getThirdPartyDoc(lib, methodName);
                if (thirdPartyDoc) {
                    console.log(`[PythonHover] Found third-party docs for ${lib}.${methodName}`);
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
                    console.log(`[PythonHover] Extracted method name: ${methodName}`);
                    console.log(`[PythonHover] Checking if base symbol "${baseSymbol}" is an imported module...`);

                    // Check if the base symbol is an imported third-party module
                    if (importedLibsMap.has(baseSymbol)) {
                        const library = importedLibsMap.get(baseSymbol);
                        console.log(`[PythonHover] Base symbol "${baseSymbol}" is imported from: ${library}`);
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
                    console.log(`[PythonHover] Detected method context: ${receiverType}.${methodName}`);

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
                console.log(`[PythonHover] Detected special method: ${primarySymbol.symbol}`);

                // Log available special method descriptions for debugging
                console.log(`[PythonHover] Available special method descriptions: ${Object.keys(SPECIAL_METHOD_DESCRIPTIONS).join(', ')}`);

                // Extract pure dunder method name if it's part of a qualified name (e.g., "MyClass.__init__")
                let dunderMethodName = primarySymbol.symbol;
                if (dunderMethodName.includes('.')) {
                    dunderMethodName = dunderMethodName.split('.').pop() || dunderMethodName;
                    console.log(`[PythonHover] Extracted dunder method name: ${dunderMethodName}`);
                }

                // Use SPECIAL_METHOD_DESCRIPTIONS directly
                const description = SPECIAL_METHOD_DESCRIPTIONS[dunderMethodName];
                console.log(`[PythonHover] Found description: ${description || 'none'}`);

                if (description) {
                    // Create custom hover for dunder methods
                    const dunderInfo = { description };
                    return this.createDunderMethodHover(dunderMethodName, dunderInfo);
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
                console.log(`[PythonHover] Looking up method as: ${lookupSymbol}`);
            }

            const inventoryEntry = await this.inventoryManager.resolveSymbol(
                lookupSymbol,
                pythonVersion,
                primarySymbol.context, // Pass context for third-party library support
                pythonPath // Pass Python path for version-aware inventory
            );

            console.log(`[PythonHover] Inventory entry result: ${inventoryEntry ? `${inventoryEntry.name} -> ${inventoryEntry.uri}#${inventoryEntry.anchor}` : 'not found'}`);

            // Check for f-strings
            if (primarySymbol.type === 'f-string') {
                console.log(`[PythonHover] Handling f-string: ${primarySymbol.symbol}`);
                // Reuse the unified fetcher for the f-string pseudo-symbol so it benefits
                // from static examples and direct mapping logic.
                const docSnippet = await this.documentationFetcher.fetchDocumentationForSymbol(
                    'f-string',
                    undefined,
                    this.configManager.maxSnippetLines
                );
                console.log(`[PythonHover] F-string documentation fetched: ${JSON.stringify(docSnippet)}`);
                return new vscode.Hover(new vscode.MarkdownString(docSnippet.content));
            }

            // Handle operators
            if (primarySymbol.type === 'operator') {
                console.log(`[PythonHover] Handling operator: ${primarySymbol.symbol}`);
                const operatorDocumentation = await (this.documentationFetcher as any).fetchOperatorDocumentation(primarySymbol.symbol);
                console.log(`[PythonHover] Operator documentation fetched: ${JSON.stringify(operatorDocumentation)}`);
                return new vscode.Hover(new vscode.MarkdownString(operatorDocumentation.content));
            }

            // ENHANCEMENT: Handle language keywords with enhanced examples
            if (primarySymbol.type === 'keyword' && ENHANCED_EXAMPLES[primarySymbol.symbol]) {
                console.log(`[PythonHover] Found enhanced example for keyword: ${primarySymbol.symbol}`);
                return this.createEnhancedExampleHover(primarySymbol.symbol);
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

            console.log(`[PythonHover] Generated documentation URL: ${docSnippet.url}`);

            return this.createRichHover(docSnippet, inventoryEntry, primarySymbol, versionInfo);

        } catch (error: any) {
            // Better error handling with user feedback
            console.error('[PythonHover] Error in hover provider:', error);

            // Check if it's a network error
            if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
                const md = new vscode.MarkdownString();
                md.isTrusted = true;
                md.appendMarkdown('⚠️ **Network Error**\n\n');
                md.appendMarkdown('Could not fetch documentation. Please check your internet connection.\n\n');
                md.appendMarkdown('[Clear Cache](command:pythonHover.clearCache) to retry.');
                return new vscode.Hover(md);
            }

            // For other errors, fail silently
            return null;
        }
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

        console.log('[PythonHover] Hover provider disposed');
    }

    private createCustomDocHover(customDoc: any, symbolInfo: { symbol: string; type: string }, pythonVersionInfo?: { version: string; pythonPath?: string }): vscode.Hover {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        md.supportHtml = true;
        md.supportThemeIcons = true;

        // Format custom documentation
        md.appendMarkdown(formatCustomDoc(customDoc));

        // Add Python version at the bottom
        if (pythonVersionInfo) {
            md.appendMarkdown('\n\n---\n\n');
            md.appendMarkdown(`<div style="text-align: right; font-size: 0.85em; color: #888;">Python ${pythonVersionInfo.version}</div>`);
        }

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
            console.log(`[PythonHover] Found inventory entry for module ${moduleName}: ${entry.uri}#${entry.anchor}`);

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
        md.appendMarkdown('\n\n---\n\n');
        md.appendMarkdown(`<div style="text-align: right; font-size: 0.85em; color: #888;">Python ${pythonVersion}</div>`);

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
        if (pythonVersionInfo) {
            md.appendMarkdown('\n\n---\n\n');
            md.appendMarkdown(`<div style="text-align: right; font-size: 0.85em; color: #888;">Python ${pythonVersionInfo.version}</div>`);
        }

        return new vscode.Hover(md);
    }

    private createBasicHover(symbolInfo: { symbol: string; type: string }): vscode.Hover {
        const md = this.theme.createMarkdown();

        // Header with theme
        md.appendMarkdown(this.theme.formatHeader(symbolInfo.symbol, symbolInfo.type));

        // Type badge
        const typeBadges = [
            { text: symbolInfo.type, type: 'info' as const }
        ];
        md.appendMarkdown(this.theme.formatBadgeGroup(typeBadges));

        md.appendMarkdown(this.theme.formatDivider());

        // Helpful tip with blockquote
        md.appendMarkdown(this.theme.formatTip('See the official Python documentation for complete details.'));

        // Action links
        const docsUrl = 'https://docs.python.org/3/';
        const encodedUrl = encodeURIComponent(JSON.stringify([docsUrl]));
        const links = [
            { text: 'Open Python Docs', command: `command:pythonHover.openDocs?${encodedUrl}`, icon: 'book' }
        ];
        md.appendMarkdown(this.theme.formatActionLinks(links));

        return new vscode.Hover(md);
    }

    /**
     * Create a hover for special dunder methods
     */
    private createDunderMethodHover(methodName: string, dunderInfo: { description: string; example?: string }): vscode.Hover {
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

        return new vscode.Hover(md);
    }

    /**
     * Create a hover with enhanced examples
     */
    private createEnhancedExampleHover(symbolName: string): vscode.Hover {
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

        return new vscode.Hover(md);
    }

    private createRichHover(
        docSnippet: any,
        inventoryEntry: InventoryEntry | null,
        symbolInfo: { symbol: string; type: string; context?: string },
        pythonVersionInfo?: { version: string; pythonPath?: string }
    ): vscode.Hover {
        const md = this.theme.createMarkdown();

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

        md.appendMarkdown(this.theme.formatDivider());

        // Description section
        if (docSnippet && docSnippet.content && docSnippet.content.trim()) {
            const summary = this.extractBestParagraph(docSnippet.content);
            if (summary) {
                md.appendMarkdown(this.theme.formatContent(summary));
            } else {
                // If extractBestParagraph returns nothing, show the raw content
                md.appendMarkdown(this.theme.formatContent(docSnippet.content.trim()));
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

        // Add related methods (smart suggestions) for method calls
        if (symbolInfo.type === 'method' && symbolInfo.context) {
            this.appendRelatedMethodsSection(md, symbolInfo.context, bareSymbol);
        }

        // Source line with clickable action links
        this.appendActionLinks(md, docSnippet, inventoryEntry);

        // Add Python version at the bottom
        if (pythonVersionInfo) {
            md.appendMarkdown('\n\n---\n\n');
            md.appendMarkdown(`<div style="text-align: right; font-size: 0.85em; color: #888;">Python ${pythonVersionInfo.version}</div>`);
        }

        return new vscode.Hover(md);
    }

    /**
     * Get emoji for symbol type to make hover stand out
     */
    private getSymbolEmoji(type: string): string {
        const emojiMap: Record<string, string> = {
            'function': '🔧',
            'method': '⚙️',
            'class': '📦',
            'module': '📚',
            'keyword': '🔑',
            'builtin': '🐍',
            'exception': '⚠️',
            'constant': '💎',
            'variable': '📊'
        };
        return emojiMap[type] || '📝';
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
        let exampleAdded = false;
        let exampleCode: string | null = null;

        // Check for enhanced examples
        if (ENHANCED_EXAMPLES[bareSymbol]) {
            md.appendMarkdown(this.theme.formatSectionHeader('Examples'));
            md.appendMarkdown(ENHANCED_EXAMPLES[bareSymbol].content);
            md.appendMarkdown('\n\n');
            exampleCode = this.extractFirstExample(ENHANCED_EXAMPLES[bareSymbol].content);
            exampleAdded = true;
        }
        // Check for static examples
        else if (STATIC_EXAMPLES[bareSymbol]) {
            md.appendMarkdown(this.theme.formatSectionHeader('Examples'));
            const examplesText = STATIC_EXAMPLES[bareSymbol].examples.join('\n');
            md.appendMarkdown(this.theme.formatCodeBlock(examplesText));
            exampleCode = examplesText;
            exampleAdded = true;
        }
        // Check for method-specific examples
        else if (symbolInfo.type === 'method' && symbolInfo.context) {
            const methodKey = `${symbolInfo.context}.${bareSymbol}`;
            if (ENHANCED_EXAMPLES[methodKey]) {
                md.appendMarkdown(this.theme.formatSectionHeader('Examples'));
                md.appendMarkdown(ENHANCED_EXAMPLES[methodKey].content);
                md.appendMarkdown('\n\n');
                exampleCode = this.extractFirstExample(ENHANCED_EXAMPLES[methodKey].content);
                exampleAdded = true;
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

    private async searchForAlternatives(
        symbol: string,
        version: string
    ): Promise<InventoryEntry[]> {
        // Search for similar symbols to provide alternatives
        try {
            return await this.inventoryManager.searchSymbols(symbol, version, 3);
        } catch (error) {
            return [];
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
     * Extract first code example from markdown content
     */
    private extractFirstExample(content: string): string | null {
        // Match ```python code blocks
        const codeBlockMatch = content.match(/```python\n([\s\S]*?)\n```/);
        if (codeBlockMatch) {
            return codeBlockMatch[1].trim();
        }

        // Match inline code examples
        const inlineMatch = content.match(/`([^`]+)`/);
        if (inlineMatch) {
            return inlineMatch[1].trim();
        }

        return null;
    }
}
