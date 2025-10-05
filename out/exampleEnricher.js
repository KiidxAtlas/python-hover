"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExampleEnricher = void 0;
const enhancedExamples_1 = require("./enhancedExamples");
const staticExamples_1 = require("./staticExamples");
/**
 * Enriches documentation snippets with examples from staticExamples and enhancedExamples
 */
class ExampleEnricher {
    /**
     * Adds examples to a documentation snippet if they exist
     * @param docSnippet The original documentation snippet
     * @param symbol The symbol to find examples for
     * @param context Optional context (like 'str' for str.upper)
     */
    enrichWithExamples(docSnippet, symbol, context) {
        // Make a copy to avoid modifying the original
        const enrichedSnippet = {
            ...docSnippet,
            content: docSnippet.content
        };
        // Try to find examples for this symbol
        const bareSymbol = symbol.split('.').pop() || symbol;
        let exampleContent = '';
        let exampleFound = false;
        // First check enhanced examples
        if (context && enhancedExamples_1.ENHANCED_EXAMPLES[`${context}.${bareSymbol}`]) {
            // Method with context (e.g., "str.upper")
            exampleContent = this.formatEnhancedExample(enhancedExamples_1.ENHANCED_EXAMPLES[`${context}.${bareSymbol}`].content);
            exampleFound = true;
        }
        else if (enhancedExamples_1.ENHANCED_EXAMPLES[bareSymbol]) {
            // Direct symbol match (e.g., "for", "class", "__init__")
            exampleContent = this.formatEnhancedExample(enhancedExamples_1.ENHANCED_EXAMPLES[bareSymbol].content);
            exampleFound = true;
        }
        else if (staticExamples_1.STATIC_EXAMPLES[bareSymbol]) {
            // Fall back to static examples
            exampleContent = this.formatStaticExample(staticExamples_1.STATIC_EXAMPLES[bareSymbol].examples);
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
    formatEnhancedExample(content) {
        // Enhanced examples are already properly formatted
        return content;
    }
    /**
     * Format static examples for display
     */
    formatStaticExample(examples) {
        return '```python\n' + examples.join('\n') + '\n```';
    }
}
exports.ExampleEnricher = ExampleEnricher;
//# sourceMappingURL=exampleEnricher.js.map