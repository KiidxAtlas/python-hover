/**
 * Sphinx Documentation Parser
 * Dynamically parses Sphinx HTML documentation to extract structured information
 * Works with any library that uses Sphinx for documentation (pandas, numpy, scipy, etc.)
 */

import { Logger } from '../services/logger';

export interface ParsedParameter {
    name: string;
    type?: string;
    description: string;
    default?: string;
    required?: boolean;
    constraints?: string;  // e.g., "must be positive", "0-100"
}

export interface ParsedExample {
    title?: string;
    code: string;
    output?: string;
    description?: string;  // Additional context about the example
}

export interface ParsedDocumentation {
    summary?: string;       // One-line summary
    description: string;    // Full description
    parameters?: ParsedParameter[];
    returns?: string;
    returnType?: string;    // Specific return type
    examples?: ParsedExample[];
    seeAlso?: string[];
    notes?: string;
    warnings?: string;
    raises?: string[];      // Exceptions that can be raised
    yields?: string;        // For generators
    attributes?: ParsedParameter[];  // For classes
    versionAdded?: string;  // Version when added
    versionChanged?: string; // Version when changed
    deprecated?: string;    // Deprecation message
}

export class SphinxParser {
    private logger: Logger;

    constructor() {
        this.logger = Logger.getInstance();
    }

    /**
     * Parse Sphinx HTML documentation page to extract structured information
     */
    public parseDocumentation(html: string): ParsedDocumentation {
        const result: ParsedDocumentation = {
            description: '',
            parameters: [],
            examples: [],
            seeAlso: [],
        };

        try {
            // Extract summary (first sentence)
            result.summary = this.extractSummary(html);

            // Extract main description (first paragraph or summary)
            result.description = this.extractDescription(html);

            // Extract parameters section
            result.parameters = this.extractParameters(html);

            // Extract returns section
            result.returns = this.extractReturns(html);

            // Extract return type separately
            result.returnType = this.extractReturnType(html);

            // Extract code examples
            result.examples = this.extractExamples(html);

            // Extract "See Also" section
            result.seeAlso = this.extractSeeAlso(html);

            // Extract notes section
            result.notes = this.extractNotes(html);

            // Extract warnings section
            result.warnings = this.extractWarnings(html);

            // Extract raises/exceptions section
            result.raises = this.extractRaises(html);

            // Extract yields section (for generators)
            result.yields = this.extractYields(html);

            // Extract attributes section (for classes)
            result.attributes = this.extractAttributes(html);

            // Extract version metadata
            result.versionAdded = this.extractVersionAdded(html);
            result.versionChanged = this.extractVersionChanged(html);
            result.deprecated = this.extractDeprecated(html);

        } catch (error) {
            this.logger.debug(`Error parsing Sphinx documentation: ${error}`);
        }

        return result;
    }

    /**
     * Extract one-line summary (first sentence)
     */
    private extractSummary(html: string): string | undefined {
        const description = this.extractDescription(html);
        if (!description) return undefined;

        // Get first sentence (up to first period, exclamation, or question mark)
        const firstSentence = description.match(/^[^.!?]+[.!?]/);
        if (firstSentence) {
            return firstSentence[0].trim();
        }

        // Fall back to first 100 characters
        return description.substring(0, 100).trim() + (description.length > 100 ? '...' : '');
    }

    /**
     * Extract the main description/summary from the documentation
     */
    private extractDescription(html: string): string {
        const descriptions: string[] = [];

        // Try to find description in common Sphinx patterns
        const patterns = [
            // Description paragraph after signature
            /<p class="?[^"]*"?>([^<]+(?:<[^>]+>[^<]*<\/[^>]+>)*[^<]*)<\/p>/gi,
            // Summary in dd tag
            /<dd>(?:<p>)?([^<]+)(?:<\/p>)?/i,
            // First paragraph in main content
            /<div class="?body"?[^>]*>.*?<p>([^<]+)<\/p>/is
        ];

        for (const pattern of patterns) {
            const matches = html.match(pattern);
            if (matches && matches.length > 0) {
                // Get first few paragraphs
                for (let i = 0; i < Math.min(3, matches.length); i++) {
                    const cleaned = this.cleanHtml(matches[i]);
                    if (cleaned.length > 20 && !cleaned.startsWith('Parameters') && !cleaned.startsWith('Returns')) {
                        descriptions.push(cleaned);
                    }
                }
                if (descriptions.length > 0) break;
            }
        }

        return descriptions.join('\n\n').substring(0, 500); // Limit description length
    }

    /**
     * Extract parameter documentation
     */
    private extractParameters(html: string): ParsedParameter[] {
        const parameters: ParsedParameter[] = [];

        // Look for Parameters section in various Sphinx formats
        const paramsSection = html.match(/(?:Parameters|Arguments)[:\s]*(?:<\/[^>]+>)*([\s\S]*?)(?:Returns|Raises|See Also|Examples|Notes|$)/i);

        if (paramsSection) {
            const content = paramsSection[1];

            // Match parameter entries in format: name : type, description
            const paramPattern = /<dt[^>]*>(?:<[^>]*>)*([a-zA-Z_][a-zA-Z0-9_]*)(?:<[^>]*>)*\s*:\s*(?:<[^>]*>)*([^<\n]+)?(?:<[^>]*>)*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;

            let match;
            while ((match = paramPattern.exec(content)) !== null) {
                const param: ParsedParameter = {
                    name: match[1].trim(),
                    type: match[2] ? this.cleanHtml(match[2]).trim() : undefined,
                    description: this.cleanHtml(match[3]).trim().substring(0, 200)
                };

                // Extract default value if present
                const defaultMatch = param.description.match(/default[:\s]+([^\s,\.]+)/i);
                if (defaultMatch) {
                    param.default = defaultMatch[1];
                }

                parameters.push(param);
            }

            // Alternative format: table-based parameters
            if (parameters.length === 0) {
                const tableParams = this.extractParametersFromTable(content);
                parameters.push(...tableParams);
            }
        }

        return parameters;
    }

    /**
     * Extract parameters from table format
     */
    private extractParametersFromTable(html: string): ParsedParameter[] {
        const parameters: ParsedParameter[] = [];
        const rowPattern = /<tr[^>]*>(?:<td[^>]*>(?:<[^>]*>)*([^<]+)(?:<[^>]*>)*<\/td>)+/gi;

        let match;
        while ((match = rowPattern.exec(html)) !== null && parameters.length < 10) {
            const cells = match[0].match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
            if (cells && cells.length >= 2) {
                parameters.push({
                    name: this.cleanHtml(cells[0]),
                    type: cells.length > 2 ? this.cleanHtml(cells[1]) : undefined,
                    description: this.cleanHtml(cells[cells.length - 1]).substring(0, 150)
                });
            }
        }

        return parameters;
    }

    /**
     * Extract return value documentation
     */
    private extractReturns(html: string): string | undefined {
        const returnsSection = html.match(/Returns[:\s]*(?:<\/[^>]+>)*([\s\S]*?)(?:Raises|See Also|Examples|Notes|Parameters|$)/i);

        if (returnsSection) {
            const content = this.cleanHtml(returnsSection[1]);
            return content.substring(0, 300);
        }

        return undefined;
    }

    /**
     * Extract code examples from the documentation
     */
    private extractExamples(html: string): ParsedExample[] {
        const examples: ParsedExample[] = [];

        // Look for Examples section
        const examplesSection = html.match(/Examples[:\s]*(?:<\/[^>]+>)*([\s\S]*?)(?:See Also|Notes|Raises|$)/i);

        if (examplesSection) {
            const content = examplesSection[1];

            // Find code blocks (usually in <pre> or highlight div)
            const codeBlockPatterns = [
                /<pre[^>]*>([\s\S]*?)<\/pre>/gi,
                /<div class="?highlight[^"]*"?[^>]*>(?:<pre>)?([\s\S]*?)(?:<\/pre>)?<\/div>/gi,
                /<code class="?[^"]*doctest[^"]*"?[^>]*>([\s\S]*?)<\/code>/gi
            ];

            for (const pattern of codeBlockPatterns) {
                let match;
                while ((match = pattern.exec(content)) !== null && examples.length < 5) {
                    const code = this.cleanCodeBlock(match[1]);
                    if (code.length > 10) {
                        // Try to find preceding description
                        const precedingText = content.substring(Math.max(0, match.index - 200), match.index);
                        const titleMatch = precedingText.match(/<p>([^<]+)<\/p>\s*$/);

                        examples.push({
                            title: titleMatch ? this.cleanHtml(titleMatch[1]) : undefined,
                            code: code
                        });
                    }
                }
            }
        }

        return examples;
    }

    /**
     * Extract "See Also" references
     */
    private extractSeeAlso(html: string): string[] {
        const seeAlso: string[] = [];

        const seeAlsoSection = html.match(/See Also[:\s]*(?:<\/[^>]+>)*([\s\S]*?)(?:Examples|Notes|References|$)/i);

        if (seeAlsoSection) {
            const content = seeAlsoSection[1];

            // Extract function/class references
            const refPattern = /(?:<code[^>]*>|<tt>)([a-zA-Z0-9_.]+)(?:<\/code>|<\/tt>)/gi;
            let match;
            while ((match = refPattern.exec(content)) !== null && seeAlso.length < 10) {
                const ref = match[1];
                // Try to find description
                const descMatch = content.substring(match.index).match(/(?:<\/[^>]+>)\s*[:\-]?\s*([^<\n]{10,100})/);
                if (descMatch) {
                    seeAlso.push(`${ref} - ${this.cleanHtml(descMatch[1])}`);
                } else {
                    seeAlso.push(ref);
                }
            }

            // Also look for list items
            if (seeAlso.length === 0) {
                const listPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
                let listMatch;
                while ((listMatch = listPattern.exec(content)) !== null && seeAlso.length < 10) {
                    const cleaned = this.cleanHtml(listMatch[1]);
                    if (cleaned.length > 5 && cleaned.length < 150) {
                        seeAlso.push(cleaned);
                    }
                }
            }
        }

        return seeAlso;
    }

    /**
     * Extract notes section
     */
    private extractNotes(html: string): string | undefined {
        const notesSection = html.match(/Notes[:\s]*(?:<\/[^>]+>)*([\s\S]*?)(?:Examples|References|See Also|$)/i);

        if (notesSection) {
            const content = this.cleanHtml(notesSection[1]);
            return content.substring(0, 400);
        }

        return undefined;
    }

    /**
     * Extract warnings section
     */
    private extractWarnings(html: string): string | undefined {
        const warningsSection = html.match(/(?:Warning|Warnings|Caution)[:\s]*(?:<\/[^>]+>)*([\s\S]*?)(?:Examples|Notes|See Also|$)/i);

        if (warningsSection) {
            const content = this.cleanHtml(warningsSection[1]);
            return content.substring(0, 300);
        }

        return undefined;
    }

    /**
     * Clean HTML tags and decode entities
     */
    private cleanHtml(html: string): string {
        return html
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Clean code block preserving formatting
     */
    private cleanCodeBlock(code: string): string {
        return code
            .replace(/<span[^>]*>/gi, '')
            .replace(/<\/span>/gi, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/^\s*>>>\s*/gm, '') // Remove doctest prompts
            .replace(/^\s*\.\.\.\s*/gm, '') // Remove continuation prompts
            .trim();
    }

    /**
     * Extract return type separately from returns description
     */
    private extractReturnType(html: string): string | undefined {
        // Look for return type in type annotations
        const returnTypePattern = /->[\s]*(?:<[^>]+>)*([A-Za-z_][A-Za-z0-9_\[\],\s]*?)(?:<[^>]+>)*(?::|<br|$)/i;
        const match = html.match(returnTypePattern);
        if (match) {
            return this.cleanHtml(match[1]).trim();
        }

        return undefined;
    }

    /**
     * Extract raises/exceptions section
     */
    private extractRaises(html: string): string[] | undefined {
        const raises: string[] = [];
        const raisesSection = html.match(/(?:Raises|Exceptions)[:\s]*(?:<\/[^>]+>)*([\s\S]*?)(?:Returns|See Also|Examples|Notes|$)/i);

        if (raisesSection) {
            const content = raisesSection[1];

            // Extract exception names
            const exceptionPattern = /([A-Z][a-zA-Z]*Error|[A-Z][a-zA-Z]*Exception)/g;
            let match;
            while ((match = exceptionPattern.exec(content)) !== null && raises.length < 10) {
                if (!raises.includes(match[1])) {
                    raises.push(match[1]);
                }
            }
        }

        return raises.length > 0 ? raises : undefined;
    }

    /**
     * Extract yields section (for generators)
     */
    private extractYields(html: string): string | undefined {
        const yieldsSection = html.match(/Yields[:\s]*(?:<\/[^>]+>)*([\s\S]*?)(?:Returns|Raises|See Also|Examples|$)/i);

        if (yieldsSection) {
            const content = this.cleanHtml(yieldsSection[1]);
            return content.substring(0, 250);
        }

        return undefined;
    }

    /**
     * Extract attributes section (for classes)
     */
    private extractAttributes(html: string): ParsedParameter[] | undefined {
        const attributes: ParsedParameter[] = [];
        const attributesSection = html.match(/Attributes[:\s]*(?:<\/[^>]+>)*([\s\S]*?)(?:Methods|Examples|Notes|$)/i);

        if (attributesSection) {
            const content = attributesSection[1];

            // Similar parsing to parameters
            const attrPattern = /<dt[^>]*>(?:<[^>]*>)*([a-zA-Z_][a-zA-Z0-9_]*)(?:<[^>]*>)*\s*:\s*(?:<[^>]*>)*([^<\n]+)?(?:<[^>]*>)*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;

            let match;
            while ((match = attrPattern.exec(content)) !== null && attributes.length < 20) {
                attributes.push({
                    name: match[1].trim(),
                    type: match[2] ? this.cleanHtml(match[2]).trim() : undefined,
                    description: this.cleanHtml(match[3]).trim().substring(0, 150)
                });
            }
        }

        return attributes.length > 0 ? attributes : undefined;
    }

    /**
     * Extract version added metadata
     */
    private extractVersionAdded(html: string): string | undefined {
        const versionPattern = /(?:versionadded|new in version)[:\s]*(?:<[^>]+>)*([0-9]+\.[0-9]+(?:\.[0-9]+)?)/i;
        const match = html.match(versionPattern);
        if (match) {
            return match[1];
        }
        return undefined;
    }

    /**
     * Extract version changed metadata
     */
    private extractVersionChanged(html: string): string | undefined {
        const versionPattern = /(?:versionchanged|changed in version)[:\s]*(?:<[^>]+>)*([0-9]+\.[0-9]+(?:\.[0-9]+)?)/i;
        const match = html.match(versionPattern);
        if (match) {
            return match[1];
        }
        return undefined;
    }

    /**
     * Extract deprecation information
     * Only matches explicit Sphinx deprecated directives, not casual mentions
     */
    private extractDeprecated(html: string): string | undefined {
        // Only match Sphinx deprecated directives: .. deprecated:: or explicit deprecated sections
        // This prevents false positives from documentation that merely mentions deprecation

        // Match Sphinx deprecated directive
        const sphinxDirective = html.match(/<div class="?(?:deprecated|admonition-deprecated)[^"]*"?[^>]*>([\s\S]*?)<\/div>/i);
        if (sphinxDirective) {
            return this.cleanHtml(sphinxDirective[1]).substring(0, 150);
        }

        // Match explicit "Deprecated:" section at start of line/paragraph
        const explicitSection = html.match(/(?:^|<p[^>]*>|<div[^>]*>)\s*(?:<strong>)?Deprecated(?:<\/strong>)?[:\s]+([^<\n]{20,200})/i);
        if (explicitSection) {
            return this.cleanHtml(explicitSection[1]).substring(0, 150);
        }

        return undefined;
    }
}
