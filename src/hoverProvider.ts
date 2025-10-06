import * as vscode from 'vscode';
import { CacheManager } from './cache';
import { ConfigurationManager } from './config';
import { ContextDetector } from './contextDetector';
import { CustomDocumentationLoader, formatCustomDoc } from './customDocumentation';
import { DocumentationFetcher } from './documentationFetcher';
import { ENHANCED_EXAMPLES } from './enhancedExamples';
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

        // Load custom docs when initialized
        this.loadCustomDocs();
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

    public async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Hover | null> {
        // Check if cancellation was requested
        if (token.isCancellationRequested) {
            return null;
        }

        try {
            // Detect Python version for this document
            const pythonVersion = await this.versionDetector.detectPythonVersion();
            console.log(`[PythonHover] Detected Python version: ${pythonVersion}`);

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
                return this.createCustomDocHover(customDoc, primarySymbol);
            }

            // NEW: Check for third-party library documentation
            const documentText = document.getText();
            const importedLibs = getImportedLibraries(documentText);

            // Check if we're hovering over a module import (like 'numpy')
            if (importedLibs.has(primarySymbol.symbol)) {
                // Create module-level docs
                return this.createModuleHover(primarySymbol.symbol);
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
                    return this.createThirdPartyHover(thirdPartyDoc, primarySymbol);
                }
            }

            // Also check all imported libraries
            for (const lib of importedLibs) {
                const thirdPartyDoc = getThirdPartyDoc(lib, methodName);
                if (thirdPartyDoc) {
                    console.log(`[PythonHover] Found third-party docs for ${lib}.${methodName}`);
                    return this.createThirdPartyHover(thirdPartyDoc, primarySymbol);
                }
            }

            // ENHANCEMENT: Check for method context
            if (primarySymbol.type === 'method') {
                // If symbol contains a dot (like "my_list.append"), extract just the method name
                let methodName = primarySymbol.symbol;
                let receiverType = primarySymbol.context;

                if (methodName.includes('.')) {
                    const parts = methodName.split('.');
                    methodName = parts[parts.length - 1]; // Get just "append"
                    console.log(`[PythonHover] Extracted method name: ${methodName}`);
                }

                // Detect the method's object type for better context if not already provided
                if (!receiverType) {
                    receiverType = this.contextDetector.detectMethodContext(document, position, methodName);
                }

                if (receiverType) {
                    console.log(`[PythonHover] Detected method context: ${receiverType}.${methodName}`);

                    // Resolve method with context
                    const methodInfo = this.methodResolver.resolveMethodInfo(document, position, methodName, receiverType);
                    if (methodInfo) {
                        primarySymbol.context = receiverType;
                        // Store as "type.method" for display, but we'll look up just the method
                        primarySymbol.symbol = methodName;
                    } else {
                        primarySymbol.symbol = methodName;
                    }
                } else {
                    // No context found, just use the method name
                    primarySymbol.symbol = methodName;
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
                lookupSymbol = `${primarySymbol.context}.${primarySymbol.symbol}`;
                console.log(`[PythonHover] Looking up method as: ${lookupSymbol}`);
            }

            const inventoryEntry = await this.inventoryManager.resolveSymbol(
                lookupSymbol,
                pythonVersion
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

            return this.createRichHover(docSnippet, inventoryEntry, primarySymbol);

        } catch (error) {
            // Log error but don't show it to user
            console.error('Python hover provider error:', error);
            return null;
        }
    }

    private createCustomDocHover(customDoc: any, symbolInfo: { symbol: string; type: string }): vscode.Hover {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        md.supportHtml = true;
        md.supportThemeIcons = true;

        // Format custom documentation
        md.appendMarkdown(formatCustomDoc(customDoc));

        return new vscode.Hover(md);
    }

    private createModuleHover(moduleName: string): vscode.Hover {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        md.supportHtml = true;
        md.supportThemeIcons = true;

        md.appendMarkdown(`## 📦 \`${moduleName}\` module\n\n`);

        // Add description based on module
        const moduleInfo: { [key: string]: { description: string; docs: string } } = {
            'numpy': {
                description: 'Fundamental package for scientific computing with Python',
                docs: 'https://numpy.org/doc/'
            },
            'pandas': {
                description: 'Powerful data analysis and manipulation library',
                docs: 'https://pandas.pydata.org/docs/'
            },
            'flask': {
                description: 'Lightweight WSGI web application framework',
                docs: 'https://flask.palletsprojects.com/'
            },
            'django': {
                description: 'High-level Python web framework',
                docs: 'https://docs.djangoproject.com/'
            },
            'requests': {
                description: 'Elegant and simple HTTP library for Python',
                docs: 'https://requests.readthedocs.io/'
            }
        };

        const info = moduleInfo[moduleName.toLowerCase()];
        if (info) {
            md.appendMarkdown(`${info.description}\n\n`);
            md.appendMarkdown(`📚 [Official Documentation](${info.docs})\n\n`);
            md.appendMarkdown(`💡 *Hover over functions like \`${moduleName}.function()\` for detailed help*\n`);
        } else {
            md.appendMarkdown(`Third-party library\n\n`);
            md.appendMarkdown(`💡 *Hover over functions for detailed help*\n`);
        }

        return new vscode.Hover(md);
    }

    private createThirdPartyHover(libDoc: any, symbolInfo: { symbol: string; type: string }): vscode.Hover {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        md.supportHtml = true;
        md.supportThemeIcons = true;

        // Header
        md.appendMarkdown(`## 📦 \`${libDoc.name}\`\n\n`);

        // Description
        md.appendMarkdown(`${libDoc.description}\n\n`);

        // Signature
        if (libDoc.signature) {
            md.appendMarkdown(`### Signature\n\`\`\`python\n${libDoc.signature}\n\`\`\`\n\n`);
        }

        // Parameters
        if (libDoc.parameters && libDoc.parameters.length > 0) {
            md.appendMarkdown(`### Parameters\n`);
            libDoc.parameters.forEach((param: any) => {
                md.appendMarkdown(`- **${param.name}**: ${param.description}\n`);
            });
            md.appendMarkdown(`\n`);
        }

        // Returns
        if (libDoc.returns) {
            md.appendMarkdown(`### Returns\n${libDoc.returns}\n\n`);
        }

        // Example
        if (libDoc.example) {
            md.appendMarkdown(`### Example\n\`\`\`python\n${libDoc.example}\n\`\`\`\n\n`);
        }

        // Official docs link
        if (libDoc.url) {
            md.appendMarkdown(`\n📚 [Official Documentation](${libDoc.url})\n`);
        }

        return new vscode.Hover(md);
    }

    private createBasicHover(symbolInfo: { symbol: string; type: string }): vscode.Hover {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;  // Enable command URIs
        md.supportHtml = true;
        md.supportThemeIcons = true;

        // Header with emoji
        const emoji = this.getSymbolEmoji(symbolInfo.type);
        md.appendMarkdown(`## ${emoji} \`${symbolInfo.symbol}\`\n\n`);

        // Type hint
        const typeHint = (() => {
            switch (symbolInfo.type) {
                case 'keyword': return '🔑 Keyword';
                case 'builtin': return '🐍 Built-in function/constant';
                case 'exception': return '⚠️ Exception';
                default: return '📝 Symbol';
            }
        })();

        md.appendMarkdown(`**${typeHint}**\n\n`);
        md.appendMarkdown(`---\n\n`);

        // Helpful pointer with blockquote
        md.appendMarkdown('> 💡 See the official Python documentation for complete details.\n\n');

        // Link to Python docs with command URI
        const docsUrl = 'https://docs.python.org/3/';
        const encodedUrl = encodeURIComponent(JSON.stringify([docsUrl]));
        md.appendMarkdown(
            `[📖 Open Python Docs](command:pythonHover.openDocs?${encodedUrl})\n`
        );

        return new vscode.Hover(md);
    }

    /**
     * Create a hover for special dunder methods
     */
    private createDunderMethodHover(methodName: string, dunderInfo: { description: string; example?: string }): vscode.Hover {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;  // CRITICAL: Enable command URIs
        md.supportHtml = true;
        md.supportThemeIcons = true;

        // Eye-catching header with emoji
        md.appendMarkdown(`## 🔮 \`${methodName}\` — Special Method\n\n`);
        md.appendMarkdown(`---\n\n`);

        // Description with emphasis
        md.appendMarkdown(`**${dunderInfo.description}**\n\n`);

        // Example code if available
        if (ENHANCED_EXAMPLES[methodName]) {
            md.appendMarkdown(`### 💡 Example\n\n`);
            md.appendMarkdown(ENHANCED_EXAMPLES[methodName].content);
            md.appendMarkdown('\n\n');
        } else if (dunderInfo.example) {
            md.appendMarkdown(`### 💡 Example\n\n`);
            md.appendMarkdown('```python\n' + dunderInfo.example + '\n```');
            md.appendMarkdown('\n\n');
        }

        // Informative note with blockquote
        md.appendMarkdown('> 💡 **Note:** Special methods are invoked implicitly by Python syntax and built-in operations.\n\n');
        md.appendMarkdown(`---\n\n`);

        // Action links with command URIs for better reliability
        const docUrl = "https://docs.python.org/3/reference/datamodel.html#special-method-names";
        const encodedUrl = encodeURIComponent(JSON.stringify([docUrl]));

        md.appendMarkdown(
            `[📖 Open Documentation](command:pythonHover.openDocs?${encodedUrl}) · ` +
            `[📋 Copy URL](command:pythonHover.copyUrl?${encodedUrl})\n`
        );

        return new vscode.Hover(md);
    }

    /**
     * Create a hover with enhanced examples
     */
    private createEnhancedExampleHover(symbolName: string): vscode.Hover {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        md.supportHtml = true;
        md.supportThemeIcons = true;

        // Header with symbol name
        md.appendMarkdown(`### \`${symbolName}\` - Python ${symbolName === 'class' ? 'Class Definition' : 'Keyword'}`);
        md.appendMarkdown('\n\n');

        // Description if available
        if (ENHANCED_EXAMPLES[symbolName].description) {
            md.appendMarkdown(`**${ENHANCED_EXAMPLES[symbolName].description}**`);
            md.appendMarkdown('\n\n');
        }

        // Rich example content
        md.appendMarkdown(ENHANCED_EXAMPLES[symbolName].content);
        md.appendMarkdown('\n\n');

        // Link to official docs
        md.appendMarkdown(`[View in Python documentation](https://docs.python.org/3/reference/compound_stmts.html#${symbolName})`);

        return new vscode.Hover(md);
    }

    private createRichHover(
        docSnippet: any,
        inventoryEntry: InventoryEntry | null,
        symbolInfo: { symbol: string; type: string; context?: string }
    ): vscode.Hover {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;  // CRITICAL: Enable command URIs for clickable links
        md.supportHtml = true;
        md.supportThemeIcons = true;

        // Determine display name - for methods with context, show "type.method"
        let displayName: string;
        if (symbolInfo.type === 'method' && symbolInfo.context) {
            displayName = `${symbolInfo.context}.${symbolInfo.symbol}`;
        } else {
            displayName = inventoryEntry?.name || symbolInfo.symbol;
        }

        const bareSymbol = symbolInfo.symbol.split('.').pop() || symbolInfo.symbol;

        // Prominent header with emoji based on type
        const emoji = this.getSymbolEmoji(symbolInfo.type);
        md.appendMarkdown(`## ${emoji} \`${displayName}\`\n\n`);

        // Type badge
        const roleBadge = inventoryEntry ? `**${inventoryEntry.domain}:${inventoryEntry.role}**` : `**${symbolInfo.type}**`;
        md.appendMarkdown(`${roleBadge}\n\n`);
        md.appendMarkdown(`---\n\n`);

        // Signature block (if available)
        if (docSnippet && docSnippet.signature) {
            md.appendMarkdown('```python\n' + docSnippet.signature + '\n```\n\n');
        }

        // Short summary / excerpt
        if (docSnippet && docSnippet.summary && docSnippet.summary.trim()) {
            md.appendMarkdown(docSnippet.summary.trim());
            md.appendMarkdown('\n\n');
        } else if (docSnippet && docSnippet.content && docSnippet.content.trim()) {
            const summary = this.extractBestParagraph(docSnippet.content);
            if (summary) {
                md.appendMarkdown(summary);
                md.appendMarkdown('\n\n');
            }
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

        for (const p of paragraphs) {
            // Skip headers
            if (/^#{1,6}\s+/.test(p)) continue;
            // Skip standalone links
            if (/^\[.*\]\(.*\)$/.test(p)) continue;
            // Prefer paragraphs with text
            if (/[A-Za-z]/.test(p)) {
                return p;
            }
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
            md.appendMarkdown('### 💡 Examples\n\n');
            md.appendMarkdown(ENHANCED_EXAMPLES[bareSymbol].content);
            md.appendMarkdown('\n\n');
            exampleCode = this.extractFirstExample(ENHANCED_EXAMPLES[bareSymbol].content);
            exampleAdded = true;
        }
        // Check for static examples
        else if (STATIC_EXAMPLES[bareSymbol]) {
            md.appendMarkdown('### 💡 Examples\n\n');
            const examplesText = STATIC_EXAMPLES[bareSymbol].examples.join('\n');
            md.appendMarkdown('```python\n');
            md.appendMarkdown(examplesText);
            md.appendMarkdown('\n```\n\n');
            exampleCode = examplesText;
            exampleAdded = true;
        }
        // Check for method-specific examples
        else if (symbolInfo.type === 'method' && symbolInfo.context) {
            const methodKey = `${symbolInfo.context}.${bareSymbol}`;
            if (ENHANCED_EXAMPLES[methodKey]) {
                md.appendMarkdown('### 💡 Examples\n\n');
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
        const relatedMethods = getRelatedMethodsForMethod(context, methodName);

        if (relatedMethods.length > 0) {
            md.appendMarkdown('### 🔗 Related Methods\n\n');
            const methodsToShow = relatedMethods.slice(0, 5);

            for (const method of methodsToShow) {
                md.appendMarkdown(`- \`${context}.${method.name}()\` — ${method.description}\n`);
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

            md.appendMarkdown(`---\n\n`);
            md.appendMarkdown(`**Source:** [${displayUrl}](${docUrl})\n\n`);
            md.appendMarkdown(
                `[📖 Open Documentation](command:pythonHover.openDocs?${encodedUrl}) · ` +
                `[📋 Copy URL](command:pythonHover.copyUrl?${encodedUrl})\n`
            );
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
     * Append quick action buttons for running/copying/inserting code
     */
    private appendQuickActions(md: vscode.MarkdownString, example: string, symbolName: string): void {
        const config = vscode.workspace.getConfiguration('pythonHover');
        if (!config.get('enableQuickActions', true)) {
            return;
        }

        // Encode example for command URI
        const encodedExample = encodeURIComponent(JSON.stringify([example, symbolName]));

        md.appendMarkdown(`\n---\n\n`);
        md.appendMarkdown(`**Quick Actions:** `);
        md.appendMarkdown(`[▶️ Run](command:pythonHover.runExample?${encodedExample}) · `);
        md.appendMarkdown(`[📋 Copy](command:pythonHover.copyExample?${encodedExample}) · `);
        md.appendMarkdown(`[📝 Insert](command:pythonHover.insertExample?${encodedExample})\n`);
    }

    /**
     * Append version information if available
     */
    private appendVersionInfo(md: vscode.MarkdownString, symbolName: string): void {
        const config = vscode.workspace.getConfiguration('pythonHover');
        if (!config.get('enableVersionComparison', true)) {
            return;
        }

        const versionInfo = getVersionInfo(symbolName);
        if (versionInfo) {
            md.appendMarkdown('\n');
            md.appendMarkdown(formatVersionInfo(versionInfo));
        }
    }

    /**
     * Append method comparison if available
     */
    private appendMethodComparison(md: vscode.MarkdownString, methodName: string): void {
        const config = vscode.workspace.getConfiguration('pythonHover');
        if (!config.get('enableVersionComparison', true)) {
            return;
        }

        const comparison = getMethodComparison(methodName);
        if (comparison) {
            md.appendMarkdown('\n');
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
