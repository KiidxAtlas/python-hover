import * as vscode from 'vscode';
import { CacheManager } from './cache';
import { ConfigurationManager } from './config';
import { ContextDetector } from './contextDetector';
import { DocumentationFetcher } from './documentationFetcher';
import { ENHANCED_EXAMPLES } from './enhancedExamples';
import { InventoryEntry, InventoryManager } from './inventory';
import { MethodResolver } from './methodResolver';
import { getRelatedMethodsForMethod } from './smartSuggestions';
import { SPECIAL_METHOD_DESCRIPTIONS } from './specialMethods';
import { STATIC_EXAMPLES } from './staticExamples';
import { SymbolResolver } from './symbolResolver';
import { VersionDetector } from './versionDetector';

export class PythonHoverProvider implements vscode.HoverProvider {
    private symbolResolver: SymbolResolver;
    private documentationFetcher: DocumentationFetcher;
    private contextDetector: ContextDetector;
    private methodResolver: MethodResolver;

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

        // Check for enhanced examples
        if (ENHANCED_EXAMPLES[bareSymbol]) {
            md.appendMarkdown('### 💡 Examples\n\n');
            md.appendMarkdown(ENHANCED_EXAMPLES[bareSymbol].content);
            md.appendMarkdown('\n\n');
            exampleAdded = true;
        }
        // Check for static examples
        else if (STATIC_EXAMPLES[bareSymbol]) {
            md.appendMarkdown('### 💡 Examples\n\n');
            md.appendMarkdown('```python\n');
            md.appendMarkdown(STATIC_EXAMPLES[bareSymbol].examples.join('\n'));
            md.appendMarkdown('\n```\n\n');
            exampleAdded = true;
        }
        // Check for method-specific examples
        else if (symbolInfo.type === 'method' && symbolInfo.context) {
            const methodKey = `${symbolInfo.context}.${bareSymbol}`;
            if (ENHANCED_EXAMPLES[methodKey]) {
                md.appendMarkdown('### 💡 Examples\n\n');
                md.appendMarkdown(ENHANCED_EXAMPLES[methodKey].content);
                md.appendMarkdown('\n\n');
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
}
