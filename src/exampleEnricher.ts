import { DocumentationSnippet } from './documentationFetcher';
import { ENHANCED_EXAMPLES } from './enhancedExamples';
import { STATIC_EXAMPLES } from './staticExamples';

/**
 * Enriches documentation snippets with examples from staticExamples and enhancedExamples
 */
export class ExampleEnricher {
    /**
     * Adds examples to a documentation snippet if they exist
     * @param docSnippet The original documentation snippet
     * @param symbol The symbol to find examples for
     * @param context Optional context (like 'str' for str.upper)
     */
    public enrichWithExamples(
        docSnippet: DocumentationSnippet,
        symbol: string,
        context?: string
    ): DocumentationSnippet {
        // Make a copy to avoid modifying the original
        const enrichedSnippet: DocumentationSnippet = {
            ...docSnippet,
            content: docSnippet.content
        };

        // Try to find examples for this symbol
        const bareSymbol = symbol.split('.').pop() || symbol;
        let exampleContent = '';
        let exampleFound = false;

        // First check enhanced examples
        if (context && ENHANCED_EXAMPLES[`${context}.${bareSymbol}`]) {
            // Method with context (e.g., "str.upper")
            exampleContent = this.formatEnhancedExample(ENHANCED_EXAMPLES[`${context}.${bareSymbol}`].content);
            exampleFound = true;
        } else if (ENHANCED_EXAMPLES[bareSymbol]) {
            // Direct symbol match (e.g., "for", "class", "__init__")
            exampleContent = this.formatEnhancedExample(ENHANCED_EXAMPLES[bareSymbol].content);
            exampleFound = true;
        } else if (STATIC_EXAMPLES[bareSymbol]) {
            // Fall back to static examples
            exampleContent = this.formatStaticExample(STATIC_EXAMPLES[bareSymbol].examples);
            exampleFound = true;
        }

        // Add examples if found
        if (exampleFound) {
            enrichedSnippet.content += '\n\n## Examples\n\n' + exampleContent;
        }

        return enrichedSnippet;
    }

    /**
     * Format an enhanced example for display
     */
    private formatEnhancedExample(content: string): string {
        // Enhanced examples are already properly formatted
        return content;
    }

    /**
     * Format static examples for display
     */
    private formatStaticExample(examples: string[]): string {
        return '```python\n' + examples.join('\n') + '\n```';
    }
}
