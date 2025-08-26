import * as vscode from 'vscode';
import { CacheManager } from './cache';
import { ConfigurationManager } from './config';
import { DocumentationFetcher } from './documentationFetcher';
import { InventoryEntry, InventoryManager } from './inventory';
import { SymbolResolver } from './symbolResolver';
import { VersionDetector } from './versionDetector';

export class PythonHoverProvider implements vscode.HoverProvider {
    private symbolResolver: SymbolResolver;
    private documentationFetcher: DocumentationFetcher;

    constructor(
        private configManager: ConfigurationManager,
        private inventoryManager: InventoryManager,
        private versionDetector: VersionDetector,
        cacheManager: CacheManager
    ) {
        this.symbolResolver = new SymbolResolver();
        this.documentationFetcher = new DocumentationFetcher(cacheManager);
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

            const inventoryEntry = await this.inventoryManager.resolveSymbol(
                primarySymbol.symbol,
                pythonVersion
            );

            console.log(`[PythonHover] Inventory entry result: ${inventoryEntry ? `${inventoryEntry.name} -> ${inventoryEntry.uri}#${inventoryEntry.anchor}` : 'not found'}`);

            // Check for f-strings
            if (((primarySymbol as any).type) === 'f-string') {
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
            if (((primarySymbol as any).type) === 'operator') {
                console.log(`[PythonHover] Handling operator: ${primarySymbol.symbol}`);
                const operatorDocumentation = await (this.documentationFetcher as any).fetchOperatorDocumentation(primarySymbol.symbol);
                console.log(`[PythonHover] Operator documentation fetched: ${JSON.stringify(operatorDocumentation)}`);
                return new vscode.Hover(new vscode.MarkdownString(operatorDocumentation.content));
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
                maxLines
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

    private createRichHover(
        docSnippet: any,
        inventoryEntry: InventoryEntry | null,
        symbolInfo: { symbol: string; type: string }
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

        // Append one or two extra paragraphs from the full content to give the hover
        // more context (the static examples feature was removed per user request).
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

        // Source line with link to the precise anchor (if available)
        if (inventoryEntry) {
            const fullUrl = inventoryEntry.anchor ? `${inventoryEntry.uri}#${inventoryEntry.anchor}` : inventoryEntry.uri;
            md.appendMarkdown(`**Source:** [${inventoryEntry.uri.replace(/^https?:\/\//, '')}](${fullUrl})`);
            md.appendMarkdown('\n\n');
        } else if (docSnippet && docSnippet.url) {
            md.appendMarkdown(`**Source:** [${docSnippet.url.replace(/^https?:\/\//, '')}](${docSnippet.url})`);
            md.appendMarkdown('\n\n');
        }

        // Helpful quick actions: open full docs, copy link
        if (docSnippet && docSnippet.url) {
            md.appendMarkdown(`<a href="${docSnippet.url}">Open full docs</a> • [Copy link](${docSnippet.url})`);
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
