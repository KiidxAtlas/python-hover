import { DocumentationSnippet } from './documentationFetcher';

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
        _symbol: string,
        _context?: string
    ): DocumentationSnippet {
        // Do not mutate content here. Examples are rendered in hoverProvider
        // via appendExamplesSection to avoid duplication and formatting issues.
        return docSnippet;
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
