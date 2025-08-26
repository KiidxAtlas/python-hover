import fetch from 'node-fetch';
import { CacheManager } from './cache';
import { getDunderInfo, IMPORT_INFO, MAP, MODULES, OPERATORS } from './documentationUrls';
import { InventoryEntry } from './inventory';
import { Info } from './types';

export interface DocumentationSnippet {
    title: string;
    content: string;
    url: string;
    anchor: string;
}

/**
 * Helper functions for working with documentation mappings
 */

/**
 * Check if a symbol has a direct documentation mapping
 */
function hasDocumentationMapping(symbol: string): boolean {
    return symbol in MAP || symbol in MODULES || !!getDunderInfo(symbol);
}

/**
 * Get the documentation info for a symbol
 */
function getDocumentationInfo(symbol: string): Info | null {
    // First check main MAP
    if (symbol in MAP) {
        return MAP[symbol];
    }

    // Map 'import' and 'from' keywords to the import system documentation
    if (symbol === 'from' || symbol === 'import') {
        return IMPORT_INFO;
    }

    // Then check MODULES
    if (symbol in MODULES) {
        return MODULES[symbol];
    }

    // Finally check for dunder methods
    const dungerInfo = getDunderInfo(symbol);
    if (dungerInfo) {
        return dungerInfo;
    }

    return null;
}

/**
 * Build full URL from Info object
 */
function buildFullUrlFromInfo(info: Info): string {
    const baseUrl = 'https://docs.python.org/3/';
    const fullUrl = baseUrl + info.url;
    return info.anchor ? `${fullUrl}#${info.anchor}` : fullUrl;
}

export class DocumentationFetcher {
    constructor(private cacheManager: CacheManager) { }

    /**
     * Primary method that first tries direct URL mapping, then falls back to intersphinx
     */
    public async fetchDocumentationForSymbol(
        symbol: string,
        entry?: InventoryEntry,
        maxLines: number = 25
    ): Promise<DocumentationSnippet> {
        console.log(`[PythonHover] Fetching documentation for symbol: ${symbol}`);

        // First, try the direct URL mapping system
        if (hasDocumentationMapping(symbol)) {
            console.log(`[PythonHover] Using direct URL mapping for symbol: ${symbol}`);
            return await this.fetchFromDirectMapping(symbol, maxLines);
        }

        // Fall back to intersphinx inventory entry if provided
        if (entry) {
            console.log(`[PythonHover] Using intersphinx inventory for symbol: ${symbol}`);
            return await this.fetchDocumentation(entry, maxLines);
        }

        // No documentation source available
        console.log(`[PythonHover] No documentation source found for symbol: ${symbol}`);
        return {
            title: symbol,
            content: `No documentation found for '${symbol}'. See the official Python documentation for details.`,
            url: 'https://docs.python.org/3/',
            anchor: ''
        };
    }

    /**
     * Fetch documentation using direct URL mappings
     */
    private async fetchFromDirectMapping(
        symbol: string,
        maxLines: number
    ): Promise<DocumentationSnippet> {
        const mapping = getDocumentationInfo(symbol);
        if (!mapping) {
            throw new Error(`No mapping found for symbol: ${symbol}`);
        }

        const fullUrl = buildFullUrlFromInfo(mapping);
        const cacheKey = `direct-doc-v1-${symbol}-${fullUrl}`;
        const maxAge = CacheManager.hoursToMs(48); // 48 hours cache

        // Check cache first
        const cached = await this.cacheManager.get<DocumentationSnippet>(cacheKey);
        if (cached && !await this.cacheManager.isExpired(cacheKey, maxAge)) {
            console.log(`[PythonHover] Returning cached direct mapping for symbol: ${symbol}`);
            return cached.data;
        }

        try {
            const baseUrl = 'https://docs.python.org/3/' + mapping.url;
            console.log(`[PythonHover] Fetching from direct URL: ${baseUrl}`);
            const response = await fetch(baseUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch documentation: ${response.status}`);
            }

            const html = await response.text();
            const snippet = await this.extractDirectMappingContent(html, mapping, symbol, maxLines);

            await this.cacheManager.set(cacheKey, snippet);
            return snippet;
        } catch (error) {
            console.error(`[PythonHover] Error fetching direct mapping for ${symbol}:`, error);

            // Return cached data if available
            if (cached) {
                return cached.data;
            }

            // Return minimal snippet
            return {
                title: symbol,
                content: `Documentation for '${symbol}' - ${mapping.title}`,
                url: fullUrl,
                anchor: mapping.anchor || ''
            };
        }
    }

    /**
     * Legacy method for intersphinx inventory entries
     */
    public async fetchDocumentation(
        entry: InventoryEntry,
        maxLines: number
    ): Promise<DocumentationSnippet> {
        const cacheKey = `doc-v11-${entry.uri}#${entry.anchor}`; // v11 with examples support
        const maxAge = CacheManager.hoursToMs(48); // 48 hours cache

        // Check cache first
        const cached = await this.cacheManager.get<DocumentationSnippet>(cacheKey);
        if (cached && !await this.cacheManager.isExpired(cacheKey, maxAge)) {
            return cached.data;
        }

        try {
            const snippet = await this.fetchAndExtractSnippet(entry, maxLines);
            await this.cacheManager.set(cacheKey, snippet);
            return snippet;
        } catch (error) {
            // If fetch fails but we have cached data, use it
            if (cached) {
                return cached.data;
            }

            // Return a minimal snippet with just the link
            return {
                title: entry.name,
                content: `See the official documentation for details.`,
                url: this.buildFullUrl(entry),
                anchor: entry.anchor
            };
        }
    }

    private async fetchAndExtractSnippet(
        entry: InventoryEntry,
        maxLines: number
    ): Promise<DocumentationSnippet> {
        const url = this.buildFullUrl(entry);
        console.log(`[PythonHover] Fetching documentation from: ${url}`);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch documentation: ${response.status}`);
        }

        const html = await response.text();
        console.log(`[PythonHover] Fetched HTML length: ${html.length} characters`);

        const snippet = this.extractRelevantSection(html, entry.anchor, maxLines, url, entry.name);
        console.log(`[PythonHover] Extracted snippet length: ${snippet.length} characters`);
        console.log(`[PythonHover] Snippet preview: ${snippet.substring(0, 200)}...`);

        return {
            title: entry.name,
            content: snippet,
            url: url,
            anchor: entry.anchor
        };
    }

    private buildFullUrl(entry: InventoryEntry): string {
        if (entry.anchor) {
            return `${entry.uri}#${entry.anchor}`;
        }
        return entry.uri;
    }

    private extractRelevantSection(html: string, anchor: string, maxLines: number, baseUrl: string, symbolName: string): string {
        try {
            // If there's an anchor, try to find the specific section
            if (anchor) {
                const section = this.extractAnchoredSection(html, anchor);
                if (section) {
                    const md = this.htmlToMarkdown(section, maxLines, baseUrl, symbolName);
                    // If the extracted markdown is very short (e.g. only a heading), try a paragraph fallback
                    if (md.trim().length < 40) {
                        console.log(`[PythonHover] Extracted markdown very short (${md.trim().length} chars), attempting paragraph fallback for anchor: ${anchor}`);
                        const paraFallback = this.extractParagraphsAfterAnchor(html, anchor, 2);
                        if (paraFallback) {
                            return this.htmlToMarkdown(paraFallback, maxLines, baseUrl, symbolName);
                        }
                    }
                    return md;
                }
            }

            // Fallback: try to extract just the main content
            const extracted = this.extractMainContent(html);
            return this.htmlToMarkdown(extracted, maxLines, baseUrl, symbolName);
        } catch (error) {
            console.error(`[PythonHover] Error extracting section:`, error);
            return '';
        }
    }

    /**
     * When anchored extraction yields too little content (common for std:label entries),
     * try to pull the first N paragraph elements immediately after the anchor occurrence.
     */
    private extractParagraphsAfterAnchor(html: string, anchor: string, count = 2): string | null {
        try {
            // Find anchor as an id attribute first
            const idRegex = new RegExp(`id=["']${this.escapeRegex(anchor)}["']`, 'i');
            const idMatch = html.match(idRegex);
            let startPos = -1;

            if (idMatch && typeof idMatch.index === 'number') {
                startPos = idMatch.index;
            } else {
                // Try to find anchor in href fragments (<a href="#anchor">)
                const hrefRegex = new RegExp(`<a[^>]+href=["'][^"']*#${this.escapeRegex(anchor)}["'][^>]*>`, 'i');
                const hrefMatch = html.match(hrefRegex);
                if (hrefMatch && typeof hrefMatch.index === 'number') {
                    startPos = hrefMatch.index;
                }
            }

            if (startPos === -1) {
                console.log(`[PythonHover] Paragraph fallback: anchor '${anchor}' not found by id or href`);
                return null;
            }

            // Search forward for paragraph tags after the anchor position
            const searchArea = html.substring(startPos, Math.min(html.length, startPos + 8000));
            const paraRegex = /<p[^>]*>[\s\S]*?<\/p>/gi;
            const paragraphs: string[] = [];
            let match;
            while ((match = paraRegex.exec(searchArea)) !== null && paragraphs.length < count) {
                paragraphs.push(match[0]);
            }

            if (paragraphs.length === 0) {
                console.log(`[PythonHover] Paragraph fallback: no <p> found after anchor '${anchor}'`);
                return null;
            }

            const combined = paragraphs.join('\n\n');
            console.log(`[PythonHover] Paragraph fallback: extracted ${paragraphs.length} paragraphs for anchor '${anchor}'`);
            return combined;
        } catch (error) {
            console.error(`[PythonHover] Error in paragraph fallback for anchor '${anchor}':`, error);
            return null;
        }
    }

    /**
     * Fetch documentation for Python operators
     */
    public async fetchOperatorDocumentation(symbol: string): Promise<DocumentationSnippet> {
        const operatorInfo = OPERATORS.find(op => op === symbol);
        if (!operatorInfo) {
            return {
                title: symbol,
                content: `No documentation found for operator '${symbol}'.`,
                url: 'https://docs.python.org/3/reference/expressions.html',
                anchor: ''
            };
        }

        return {
            title: operatorInfo,
            content: `Documentation for operator '${operatorInfo}'.`,
            url: 'https://docs.python.org/3/reference/expressions.html',
            anchor: ''
        };
    }

    /**
     * Extract content from HTML using direct URL mapping
     */
    private async extractDirectMappingContent(
        html: string,
        mapping: Info,
        symbol: string,
        maxLines: number
    ): Promise<DocumentationSnippet> {
        const fullUrl = buildFullUrlFromInfo(mapping);

        try {
            let content: string;

            if (mapping.anchor) {
                // Try to extract the anchored section
                const section = this.extractAnchoredSection(html, mapping.anchor);
                if (section) {
                    const baseUrl = 'https://docs.python.org/3/' + mapping.url;
                    content = this.htmlToMarkdown(section, maxLines, baseUrl, symbol);
                } else {
                    // Fallback to main content if anchor not found
                    console.log(`[PythonHover] Anchor ${mapping.anchor} not found, using main content`);
                    const extracted = this.extractMainContent(html);
                    const baseUrl = 'https://docs.python.org/3/' + mapping.url;
                    content = this.htmlToMarkdown(extracted, maxLines, baseUrl, symbol);
                }
            } else {
                // No anchor, extract main content
                const extracted = this.extractMainContent(html);
                const baseUrl = 'https://docs.python.org/3/' + mapping.url;
                content = this.htmlToMarkdown(extracted, maxLines, baseUrl, symbol);
            }

            return {
                title: symbol,
                content: content || `Documentation for '${symbol}' - ${mapping.title}`,
                url: fullUrl,
                anchor: mapping.anchor || ''
            };
        } catch (error) {
            console.error(`[PythonHover] Error extracting direct mapping content for ${symbol}:`, error);
            return {
                title: symbol,
                content: `Documentation for '${symbol}' - ${mapping.title}`,
                url: fullUrl,
                anchor: mapping.anchor || ''
            };
        }
    }

    private extractAnchoredSection(html: string, anchor: string): string | null {
        console.log(`[PythonHover] Looking for anchor: ${anchor}`);

        // Look for the anchored element
        const anchorRegex = new RegExp(`<[^>]+id=["']${this.escapeRegex(anchor)}["'][^>]*>`, 'i');
        const match = html.match(anchorRegex);

        if (!match) {
            console.log(`[PythonHover] Anchor ${anchor} not found in HTML`);
            // Try to find the anchor in href attributes as well
            const hrefRegex = new RegExp(`<a[^>]+href=["'][^"']*#${this.escapeRegex(anchor)}["'][^>]*>`, 'i');
            const hrefMatch = html.match(hrefRegex);
            if (hrefMatch) {
                console.log(`[PythonHover] Found anchor in href, but not as id`);
            }

            // Fallback: try to find a header that matches a readable form of the anchor
            // e.g. 'the-with-statement' -> 'with statement' or 'with statement' -> header text
            try {
                const readable = anchor.replace(/[-_]+/g, ' ').replace(/^the\s+/i, '').trim();
                if (readable.length > 2) {
                    const headerSearch = new RegExp(`<h[1-6][^>]*>[^<]*${this.escapeRegex(readable)}[^<]*<\/h[1-6]>`, 'i');
                    const headerMatch = html.match(headerSearch);
                    if (headerMatch) {
                        console.log(`[PythonHover] Found header by readable anchor fallback: ${readable}`);
                        const headerIndex = headerMatch.index!;
                        const startIndex = headerIndex;

                        // Extract from header forward similar to the header-based extraction above
                        const headerEnd = startIndex + headerMatch[0].length;
                        const remainingHtml = html.substring(headerEnd);
                        const nextHeaderRegex = /<h[1-6][^>]*>/i;
                        const nextMatch = remainingHtml.match(nextHeaderRegex);
                        const sectionEndPos = nextMatch ? headerEnd + nextMatch.index! : Math.min(html.length, headerEnd + 3500);
                        const sectionContent = headerMatch[0] + html.substring(headerEnd, sectionEndPos);
                        return sectionContent;
                    }
                }
            } catch (e) {
                console.log(`[PythonHover] Readable anchor fallback failed for '${anchor}':`, e);
            }

            return null;
        }

        console.log(`[PythonHover] Found anchor at position ${match.index}`);
        const startIndex = match.index!;

        // For data model special methods, we need a very precise approach
        if (html.includes('datamodel.html') && anchor.startsWith('object.')) {
            return this.extractDataModelMethod(html, anchor, startIndex);
        }

        // Special handling for compound statement keywords that share sections
        if (html.includes('compound_stmts.html') && ['else', 'elif', 'finally', 'except', 'break', 'continue', 'for', 'while', 'if', 'try'].includes(anchor)) {
            return this.extractCompoundStatementKeyword(html, anchor, startIndex);
        }

        // The anchor might be on a small element like <span> or <a>
        // We need to find the containing section or meaningful content block
        let sectionStart = this.findSectionStart(html, startIndex, anchor);
        let sectionEnd = this.findSectionEnd(html, startIndex);

        console.log(`[PythonHover] Section from ${sectionStart} to ${sectionEnd} (length: ${sectionEnd - sectionStart})`);
        console.log(`[PythonHover] Section start preview: ${html.substring(sectionStart, sectionStart + 200)}...`);

        const extractedHtml = html.substring(sectionStart, sectionEnd);
        console.log(`[PythonHover] Extracted HTML length: ${extractedHtml.length}`);
        console.log(`[PythonHover] Extracted HTML preview: ${extractedHtml.substring(0, 500)}...`);

        return extractedHtml;
    }

    private extractDataModelMethod(html: string, anchor: string, anchorPosition: number): string | null {
        console.log(`[PythonHover] Using specialized data model extraction for: ${anchor}`);

        // Look backwards from the anchor to find the <dt> tag that defines this method
        let searchStart = Math.max(0, anchorPosition - 2000);
        let searchEnd = anchorPosition + 500;
        let searchArea = html.substring(searchStart, searchEnd);

        // Find all <dt> tags in the search area
        const dtRegex = /<dt[^>]*>/gi;
        let dtMatch;
        let methodStart = searchStart;

        while ((dtMatch = dtRegex.exec(searchArea)) !== null) {
            const dtPosition = searchStart + dtMatch.index;
            const dtEndPosition = searchStart + dtMatch.index + dtMatch[0].length;

            // Check if this dt contains our anchor or if the anchor is shortly after
            if (dtPosition <= anchorPosition && anchorPosition <= dtEndPosition + 200) {
                methodStart = dtPosition;
                console.log(`[PythonHover] Found method definition dt at position: ${methodStart}`);
                break;
            }
        }

        // Find the end of this method definition (next <dt> or major section)
        const endPatterns = [
            /<dt[^>]*>/gi,        // Next method definition
            /<\/dl>/gi,           // End of method list
            /<h[2-6][^>]*>/gi     // Next heading
        ];

        let methodEnd = Math.min(html.length, anchorPosition + 5000);
        const searchAreaForEnd = html.substring(anchorPosition + 100); // Start after current anchor

        for (const pattern of endPatterns) {
            pattern.lastIndex = 0;
            const endMatch = pattern.exec(searchAreaForEnd);
            if (endMatch) {
                const endPosition = anchorPosition + 100 + endMatch.index;
                methodEnd = Math.min(methodEnd, endPosition);
            }
        }

        console.log(`[PythonHover] Data model method section from ${methodStart} to ${methodEnd} (length: ${methodEnd - methodStart})`);
        console.log(`[PythonHover] Data model section start preview: ${html.substring(methodStart, methodStart + 200)}...`);

        const extractedHtml = html.substring(methodStart, methodEnd);
        return extractedHtml;
    }

    private extractCompoundStatementKeyword(html: string, anchor: string, anchorPosition: number): string | null {
        console.log(`[PythonHover] Using specialized compound statement extraction for: ${anchor}`);

        // Look ONLY forward from the anchor position to find content specifically about this keyword
        const searchArea = html.substring(anchorPosition, anchorPosition + 20000);

        // First, try to find the exact section header that mentions this keyword
        // Look for patterns like "8.3. The for statement" or "7.10. The continue statement"
        const sectionHeaderRegex = new RegExp(`<h[1-6][^>]*>([^<]*\\b${anchor}\\b[^<]*statement[^<]*)<\/h[1-6]>`, 'gi');
        const headerMatch = sectionHeaderRegex.exec(searchArea);

        if (headerMatch) {
            console.log(`[PythonHover] Found section header for ${anchor}: ${headerMatch[1]}`);

            // Extract content ONLY from this header forward until the next section
            const headerStartPos = anchorPosition + headerMatch.index!;
            const headerEndPos = headerStartPos + headerMatch[0].length;
            const remainingHtml = html.substring(headerEndPos);

            // Find where this section ends - look for next numbered section (like "8.4" or "7.11")
            const nextNumberedSectionRegex = /<h[1-6][^>]*>[^<]*\d+\.\d+\.[^<]*<\/h[1-6]>/i;
            const nextSectionMatch = remainingHtml.match(nextNumberedSectionRegex);

            const sectionEndPos = nextSectionMatch ?
                headerEndPos + nextSectionMatch.index! :
                headerEndPos + 3500; // Reasonable limit for one section

            const sectionContent = headerMatch[0] + html.substring(headerEndPos, sectionEndPos);

            console.log(`[PythonHover] Extracted section content length: ${sectionContent.length}`);
            console.log(`[PythonHover] Section content preview: ${sectionContent.substring(0, 200)}...`);
            return sectionContent;
        }

        // Fallback: Look for alternative header patterns
        const alternativeHeaderRegex = new RegExp(`<h[1-6][^>]*>([^<]*\\b${anchor}\\b[^<]*)<\/h[1-6]>`, 'gi');
        const altHeaderMatch = alternativeHeaderRegex.exec(searchArea);

        if (altHeaderMatch) {
            console.log(`[PythonHover] Found alternative header for ${anchor}: ${altHeaderMatch[1]}`);

            const headerStartPos = anchorPosition + altHeaderMatch.index!;
            const headerEndPos = headerStartPos + altHeaderMatch[0].length;
            const remainingHtml = html.substring(headerEndPos);

            // Find the next header of same or higher level
            const headerLevel = altHeaderMatch[0].match(/<h([1-6])/)?.[1];
            const nextHeaderRegex = new RegExp(`<h[1-${headerLevel}][^>]*>`, 'i');
            const nextHeaderMatch = remainingHtml.match(nextHeaderRegex);

            const sectionEndPos = nextHeaderMatch ?
                headerEndPos + nextHeaderMatch.index! :
                headerEndPos + 3000;

            const sectionContent = altHeaderMatch[0] + html.substring(headerEndPos, sectionEndPos);

            console.log(`[PythonHover] Extracted alternative section content length: ${sectionContent.length}`);
            return sectionContent;
        }

        // Last resort: Look for specific content patterns
        console.log(`[PythonHover] No header found, looking for specific content patterns for ${anchor}`);
        const relevantContent: string[] = [];

        // Look for the syntax definition first
        const syntaxRegex = new RegExp(`${anchor}_stmt\\s*::=`, 'i');
        const syntaxMatch = searchArea.match(syntaxRegex);
        if (syntaxMatch) {
            console.log(`[PythonHover] Found syntax definition for ${anchor}`);
            const syntaxPos = syntaxMatch.index!;
            const syntaxArea = searchArea.substring(Math.max(0, syntaxPos - 100), syntaxPos + 800);
            const syntaxBlockRegex = /<(?:p|pre|div)[^>]*>[\s\S]*?<\/(?:p|pre|div)>/gi;
            let syntaxBlockMatch;
            while ((syntaxBlockMatch = syntaxBlockRegex.exec(syntaxArea)) !== null) {
                if (syntaxBlockMatch[0].includes(syntaxMatch[0])) {
                    relevantContent.push(syntaxBlockMatch[0]);
                    break;
                }
            }
        }

        // Find paragraphs that specifically discuss this statement
        const paragraphRegex = /<p[^>]*>[\s\S]*?<\/p>/gi;
        let match;
        let paragraphCount = 0;

        while ((match = paragraphRegex.exec(searchArea)) !== null && paragraphCount < 2) {
            const paragraph = match[0];
            const paragraphText = paragraph.replace(/<[^>]*>/g, '').trim();

            // Only include paragraphs that clearly discuss this specific statement
            const isRelevant =
                paragraphText.toLowerCase().includes(`the ${anchor} statement is used`) ||
                paragraphText.toLowerCase().includes(`${anchor} statement is used`) ||
                paragraphText.toLowerCase().startsWith(`the ${anchor} statement`) ||
                paragraphText.toLowerCase().startsWith(`${anchor} may only`);

            if (isRelevant) {
                // Skip if too close to anchor (navigation elements)
                if (match.index < 200) continue;

                relevantContent.push(paragraph);
                paragraphCount++;
                console.log(`[PythonHover] Found relevant paragraph for ${anchor}: ${paragraphText.substring(0, 100)}...`);
            }
        }

        if (relevantContent.length === 0) {
            console.log(`[PythonHover] No specific content found for ${anchor}, falling back to null`);
            return null;
        }

        // Combine relevant content
        const combinedContent = relevantContent.join('\n\n');
        console.log(`[PythonHover] Final fallback content length: ${combinedContent.length}`);
        return combinedContent;
    }

    private findSectionStart(html: string, anchorPosition: number, anchor: string): number {
        // Always start from the anchor position - never look backwards
        // The anchor marks where the content for this symbol begins
        console.log(`[PythonHover] Starting section from anchor position: ${anchorPosition} (forward-only)`);
        return anchorPosition;
    }

    private findSectionEnd(html: string, anchorPosition: number): number {
        // For compound statements, we need to look for the NEXT section or major heading
        // The structure is: <section><span id="keyword"></span>..content..</section>

        // First, check if we're in a compound statements page or data model page
        const isCompoundStmt = html.includes('compound_stmts.html') || html.includes('Compound statements');
        const isDataModel = html.includes('datamodel.html') || html.includes('Data model');

        if (isCompoundStmt) {
            // For compound statements, find the next major section boundary
            const endPatterns = [
                /<section[^>]*id="[^"]*"[^>]*>/gi,  // Next section with id
                /<h[2-4][^>]*>/gi,                  // Next major heading
            ];

            let earliestEnd = Math.min(html.length, anchorPosition + 20000); // Look much further for compound statements

            for (const pattern of endPatterns) {
                pattern.lastIndex = 0;
                const searchText = html.substring(anchorPosition + 200); // Skip past current anchor area
                const match = pattern.exec(searchText);
                if (match) {
                    const matchPosition = anchorPosition + 200 + match.index;
                    earliestEnd = Math.min(earliestEnd, matchPosition);
                }
            }

            return earliestEnd;
        } else if (isDataModel) {
            // For data model documentation, find the next method or major heading
            const endPatterns = [
                /<\/dd>/gi,                        // End of method description
                /<dt[^>]*id="[^"]*"[^>]*>/gi,     // Next method definition
                /<h[2-6][^>]*>/gi,                // Next heading
                /<\/dl>/gi                        // End of method list
            ];

            let earliestEnd = Math.min(html.length, anchorPosition + 8000); // Reasonable size for method docs

            for (const pattern of endPatterns) {
                pattern.lastIndex = 0;
                const searchText = html.substring(anchorPosition + 100); // Skip past current anchor area
                const match = pattern.exec(searchText);
                if (match) {
                    const matchPosition = anchorPosition + 100 + match.index;
                    if (match[0].includes('</dd>')) {
                        earliestEnd = Math.min(earliestEnd, matchPosition + match[0].length);
                    } else {
                        earliestEnd = Math.min(earliestEnd, matchPosition);
                    }
                }
            }

            return earliestEnd;
        } else {
            // Original logic for function documentation
            const endPatterns = [
                /<\/section>/gi,
                /<h[1-6][^>]*>/gi,
                /<div[^>]+class="[^"]*section[^"]*"[^>]*>/gi,
                /<section[^>]*>/gi,
                /<\/article>/gi,
                /<\/main>/gi
            ];

            let earliestEnd = Math.min(html.length, anchorPosition + 10000);

            for (const pattern of endPatterns) {
                pattern.lastIndex = 0;
                const searchText = html.substring(anchorPosition + 1);
                const match = pattern.exec(searchText);
                if (match) {
                    const matchPosition = anchorPosition + 1 + match.index;
                    if (match[0].includes('</section>')) {
                        earliestEnd = Math.min(earliestEnd, matchPosition + match[0].length);
                    } else {
                        earliestEnd = Math.min(earliestEnd, matchPosition);
                    }
                }
            }

            return earliestEnd;
        }
    }

    private extractMainContent(html: string): string {
        // Try to find the main content area
        const contentSelectors = [
            /<div[^>]+class="[^"]*body[^"]*"[^>]*>(.*?)<\/div>/is,
            /<main[^>]*>(.*?)<\/main>/is,
            /<article[^>]*>(.*?)<\/article>/is,
            /<div[^>]+class="[^"]*content[^"]*"[^>]*>(.*?)<\/div>/is,
            /<section[^>]*>(.*?)<\/section>/is
        ];

        for (const regex of contentSelectors) {
            const match = html.match(regex);
            if (match) {
                return match[1];
            }
        }

        // Fallback: take the body content
        const bodyMatch = html.match(/<body[^>]*>(.*?)<\/body>/is);
        return bodyMatch ? bodyMatch[1] : html;
    }

    private htmlToMarkdown(html: string, maxLines: number, baseUrl: string, symbolName: string): string {
        // Note: static example support was removed. We still convert HTML to Markdown
        // and return a substantive excerpt; hover rendering will include additional
        // contextual paragraphs to avoid barren tooltips.

        // Simple HTML to markdown conversion
        let text = html
            // Remove script and style tags
            .replace(/<(?:script|style)[^>]*>.*?<\/(?:script|style)>/gis, '')
            // Convert links BEFORE removing other tags
            .replace(/<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, (match, href, content) => {
                // Convert relative URLs to absolute URLs using baseUrl context
                let resolvedUrl = href;

                // Log specific examples we care about
                const cleanContent = this.stripTags(content);
                if (cleanContent === 'if' || cleanContent === 'else' || cleanContent === 'break' || cleanContent === 'continue') {
                    console.log(`[PythonHover] IMPORTANT LINK - content: "${cleanContent}", href: "${href}", baseUrl: "${baseUrl}"`);
                }

                if (href.startsWith('#')) {
                    // Fragment-only URLs - resolve relative to base page (remove any existing fragment from baseUrl)
                    const baseUrlWithoutFragment = baseUrl.split('#')[0];
                    resolvedUrl = `${baseUrlWithoutFragment}${href}`;

                    if (cleanContent === 'if' || cleanContent === 'else' || cleanContent === 'break' || cleanContent === 'continue') {
                        console.log(`[PythonHover] IMPORTANT LINK RESOLVED - "${cleanContent}": ${resolvedUrl}`);
                    }
                } else if (href.startsWith('/')) {
                    // Root-relative URLs - make absolute to docs.python.org
                    resolvedUrl = `https://docs.python.org${href}`;
                } else if (href.startsWith('http')) {
                    // Already absolute
                    resolvedUrl = href;
                } else if (href.startsWith('../')) {
                    // Parent directory relative URLs - resolve relative to current page directory
                    // For these, use the base URL without fragment for proper resolution
                    const baseUrlWithoutFragment = baseUrl.split('#')[0];
                    const baseUrlParts = baseUrlWithoutFragment.split('/');
                    const pathParts = baseUrlParts.slice(0, -1); // Remove current file name
                    const relativeParts = href.split('/');

                    for (const part of relativeParts) {
                        if (part === '..') {
                            pathParts.pop(); // Go up one directory
                        } else if (part !== '.') {
                            pathParts.push(part);
                        }
                    }
                    resolvedUrl = pathParts.join('/');
                } else {
                    // Same directory relative URLs - resolve relative to current page directory
                    const baseUrlWithoutFragment = baseUrl.split('#')[0];
                    const basePath = baseUrlWithoutFragment.substring(0, baseUrlWithoutFragment.lastIndexOf('/') + 1);
                    resolvedUrl = `${basePath}${href}`;
                }

                return `[${cleanContent}](${resolvedUrl})`;
            })
            // Convert headers
            .replace(/<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi, (_, level, content) => {
                const hashes = '#'.repeat(parseInt(level));
                return `\n${hashes} ${this.stripTags(content)}\n`;
            })
            // Convert paragraphs
            .replace(/<p[^>]*>(.*?)<\/p>/gi, '\n$1\n')
            // Convert code blocks
            .replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, '\n```\n$1\n```\n')
            // Convert inline code
            .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
            // Convert lists
            .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
            // Convert line breaks
            .replace(/<br\s*\/?>/gi, '\n')
            // Remove all other HTML tags
            .replace(/<[^>]*>/g, '')
            // Decode HTML entities
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            // Clean up whitespace
            .replace(/\n\s*\n\s*\n/g, '\n\n')
            .trim();

        // Limit to max lines
        const lines = text.split('\n');
        if (lines.length > maxLines) {
            const truncated = lines.slice(0, maxLines).join('\n');
            return `${truncated}\n\n*[Truncated - see full documentation for more details]*`;
        }

        return text;
    }

    private stripTags(html: string): string {
        return html.replace(/<[^>]*>/g, '').trim();
    }

    private escapeRegex(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
