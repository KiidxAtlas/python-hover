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
                // Detect the method's object type for better context
                const receiverType = this.contextDetector.detectMethodContext(document, position, primarySymbol.symbol);
                if (receiverType) {
                    console.log(`[PythonHover] Detected method context: ${receiverType}.${primarySymbol.symbol}`);

                    // Resolve method with context
                    const methodInfo = this.methodResolver.resolveMethodInfo(document, position, primarySymbol.symbol, receiverType);
                    if (methodInfo) {
                        primarySymbol.context = receiverType;
                        primarySymbol.symbol = `${receiverType}.${primarySymbol.symbol}`;
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

            const inventoryEntry = await this.inventoryManager.resolveSymbol(
                primarySymbol.symbol,
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
        md.isTrusted = true; // allow clicking links
        md.supportHtml = true;
        md.supportThemeIcons = true;

        // Header
        md.appendMarkdown(`### \`${symbolInfo.symbol}\``);
        md.appendMarkdown('\n\n');

        // One-line hint about the type
        const typeHint = (() => {
            switch (symbolInfo.type) {
                case 'keyword': return 'Keyword';
                case 'builtin': return 'Built-in function/constant';
                case 'exception': return 'Exception';
                default: return 'Symbol';
            }
        })();

        md.appendMarkdown(`**${typeHint}**`);
        md.appendMarkdown('\n\n');

        // Helpful pointer
        md.appendMarkdown('Quick reference: see the official Python docs for authoritative details.');
        md.appendMarkdown('\n\n');

        // Small link to docs.python.org
        md.appendMarkdown(`[Open Python docs](https://docs.python.org/)`);

        return new vscode.Hover(md);
    }

    /**
     * Create a hover for special dunder methods
     */
    private createDunderMethodHover(methodName: string, dunderInfo: { description: string; example?: string }): vscode.Hover {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        md.supportHtml = true;
        md.supportThemeIcons = true;

        // Header with method name
        md.appendMarkdown(`### \`${methodName}\` - Special Method`);
        md.appendMarkdown('\n\n');

        // Description
        md.appendMarkdown(`**${dunderInfo.description}**`);
        md.appendMarkdown('\n\n');

        // Example code if available
        if (ENHANCED_EXAMPLES[methodName]) {
            md.appendMarkdown(ENHANCED_EXAMPLES[methodName].content);
            md.appendMarkdown('\n\n');
        } else if (dunderInfo.example) {
            md.appendMarkdown('```python\n' + dunderInfo.example + '\n```');
            md.appendMarkdown('\n\n');
        }

        // Additional information about special methods
        md.appendMarkdown('*Special methods are invoked by Python\'s syntax and built-in functions.*');
        md.appendMarkdown('\n\n');

        // Add documentation links for dunder methods
        // Most dunder methods are documented in the "Data Model" section of the Python docs
        const docUrl = "https://docs.python.org/3/reference/datamodel.html#special-method-names";
        md.appendMarkdown(`**Source:** [docs.python.org/.../datamodel.html](${docUrl})`);
        md.appendMarkdown('\n\n');
        md.appendMarkdown(`<a href="${docUrl}">Open full docs</a> • [Copy link](${docUrl})`);

        console.log(`[PythonHover] Created dunder method documentation link: ${docUrl}`);

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
        md.isTrusted = true;
        md.supportHtml = true;
        md.supportThemeIcons = true;

        const symbolName = inventoryEntry?.name || symbolInfo.symbol;

        // Header with small role badge
        const roleBadge = inventoryEntry ? `**${inventoryEntry.domain}:${inventoryEntry.role}**` : `**${symbolInfo.type}**`;
        md.appendMarkdown(`### \`${symbolName}\`  `);
        md.appendMarkdown(`${roleBadge}`);
        md.appendMarkdown('\n\n');

        // Signature block (if available)
        if (docSnippet && docSnippet.signature) {
            // Render signature as a fenced code block for clarity
            md.appendMarkdown('```python\n' + docSnippet.signature + '\n```\n\n');
        }

        // Short summary / excerpt: prefer the first non-header paragraph
        if (docSnippet && docSnippet.summary && docSnippet.summary.trim()) {
            md.appendMarkdown(docSnippet.summary.trim());
            md.appendMarkdown('\n\n');
        } else if (docSnippet && docSnippet.content && docSnippet.content.trim()) {
            // Split into paragraphs and skip leading header-only paragraphs
            const paragraphs = docSnippet.content.split(/\n\s*\n/).map((p: string) => p.trim()).filter((p: string) => p.length > 0);
            let chosen = '';
            for (const p of paragraphs) {
                // skip Markdown headers and tiny fragments
                if (/^#{1,6}\s+/.test(p)) continue;
                // skip single-line links or source-only lines
                if (/^\[.*\]\(.*\)$/.test(p)) continue;
                // prefer paragraphs with some alpha characters
                if (/[A-Za-z]/.test(p)) {
                    chosen = p;
                    break;
                }
            }
            // If none matched, fall back to the first paragraph
            if (!chosen && paragraphs.length > 0) chosen = paragraphs[0];

            if (chosen) {
                md.appendMarkdown(chosen);
                md.appendMarkdown('\n\n');
            }
        }

        // ENHANCEMENT: Add examples from STATIC_EXAMPLES or ENHANCED_EXAMPLES
        const bareSymbol = symbolName.split('.').pop() || symbolName;
        if (ENHANCED_EXAMPLES[bareSymbol]) {
            md.appendMarkdown('## Examples\n\n');
            md.appendMarkdown(ENHANCED_EXAMPLES[bareSymbol].content);
            md.appendMarkdown('\n\n');
        } else if (STATIC_EXAMPLES[bareSymbol]) {
            md.appendMarkdown('## Examples\n\n');
            md.appendMarkdown('```python\n');
            md.appendMarkdown(STATIC_EXAMPLES[bareSymbol].examples.join('\n'));
            md.appendMarkdown('\n```\n\n');
        } else if (symbolInfo.type === 'method' && symbolInfo.context) {
            // For methods with context like str.upper, try to find examples for the method
            const methodKey = `${symbolInfo.context}.${bareSymbol}`;
            if (ENHANCED_EXAMPLES[methodKey]) {
                md.appendMarkdown('## Examples\n\n');
                md.appendMarkdown(ENHANCED_EXAMPLES[methodKey].content);
                md.appendMarkdown('\n\n');
            }
        }

        // Append one or two extra paragraphs from the full content to give the hover
        // more context
        try {
            if (docSnippet && docSnippet.content && typeof docSnippet.content === 'string') {
                const paragraphs = docSnippet.content.split(/\n\s*\n/).map((p: string) => p.trim()).filter((p: string) => p.length > 0);
                // Find index of the paragraph already shown (chosen) and append the next 1-2 paragraphs
                let startIndex = 0;
                if (paragraphs.length > 0) {
                    // If the heading/summary was used, find its index to append next paragraphs
                    startIndex = 0;
                }
                const extras = paragraphs.slice(startIndex + 1, startIndex + 3).join('\n\n');
                if (extras) {
                    md.appendMarkdown(extras);
                    md.appendMarkdown('\n\n');
                }
            }
        } catch (e) {
            console.error('[PythonHover] Error while appending extra content to hover:', e);
        }

        // Add related methods (smart suggestions) for method calls
        if (symbolInfo.type === 'method' && symbolInfo.context) {
            const bareMethod = symbolName.split('.').pop() || '';
            const relatedMethods = getRelatedMethodsForMethod(symbolInfo.context, bareMethod);

            if (relatedMethods.length > 0) {
                md.appendMarkdown('## Related Methods\n\n');

                // Show up to 5 related methods
                const methodsToShow = relatedMethods.slice(0, 5);
                for (const method of methodsToShow) {
                    md.appendMarkdown(`- \`${symbolInfo.context}.${method.name}()\` — ${method.description}\n`);
                }
                md.appendMarkdown('\n');
            }
        }

        // Source line with link to the precise anchor (if available)
        if (inventoryEntry) {
            const fullUrl = inventoryEntry.anchor ? `${inventoryEntry.uri}#${inventoryEntry.anchor}` : inventoryEntry.uri;
            // Ensure URL is absolute and properly formatted
            const displayUrl = inventoryEntry.uri.replace(/^https?:\/\//, '');
            md.appendMarkdown(`**Source:** [${displayUrl}](${fullUrl})`);
            md.appendMarkdown('\n\n');

            // Log the URL for debugging
            console.log(`[PythonHover] Created documentation link from inventory: ${fullUrl}`);
        } else if (docSnippet && docSnippet.url) {
            // Ensure URL is absolute
            const docUrl = docSnippet.url.startsWith('http') ? docSnippet.url : `https://docs.python.org/3/${docSnippet.url}`;
            const displayUrl = docUrl.replace(/^https?:\/\//, '');
            md.appendMarkdown(`**Source:** [${displayUrl}](${docUrl})`);
            md.appendMarkdown('\n\n');

            // Log the URL for debugging
            console.log(`[PythonHover] Created documentation link from docSnippet: ${docUrl}`);
        }

        // Helpful quick actions: open full docs, copy link
        if (docSnippet && docSnippet.url) {
            // Ensure URL is absolute
            const docUrl = docSnippet.url.startsWith('http') ? docSnippet.url : `https://docs.python.org/3/${docSnippet.url}`;
            md.appendMarkdown(`<a href="${docUrl}">Open full docs</a> • [Copy link](${docUrl})`);
            md.appendMarkdown('\n\n');
        }

        // If no inventory entry, show alternatives (best effort)
        if (!inventoryEntry) {
            // Synchronous call is not possible here, but we can show a small hint
            md.appendMarkdown('*No exact docs found — try these nearby terms:*  \n');
            // Use symbolResolver/search outside if available; show placeholder suggestions
            if (docSnippet && Array.isArray(docSnippet.alternatives) && docSnippet.alternatives.length > 0) {
                const list = docSnippet.alternatives.slice(0, 5).map((a: any) => `- [${a.name}](${a.url || '#'})`).join('\n');
                md.appendMarkdown(list);
                md.appendMarkdown('\n\n');
            } else {
                md.appendMarkdown('- Try the Python docs search: [Search docs](https://docs.python.org/search.html)\n\n');
            }
        }

        // Final small footer
        md.appendMarkdown('<sub>Hover provided by Python Hover — documentation snippets are extracted from docs.python.org</sub>');

        return new vscode.Hover(md);
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
