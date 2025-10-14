/**
 * Service for detecting Python types from code patterns
 * Centralizes type detection logic used across multiple components
 */

export interface TypeDetectionResult {
    type: string;
    confidence: 'high' | 'medium' | 'low';
}

export class TypeDetectionService {
    /**
     * Detect type from an assignment value (right-hand side of =  or :=)
     * Returns the detected type or undefined if cannot determine
     */
    public static detectTypeFromValue(value: string): string | undefined {
        // Strip inline comments first
        const commentIndex = value.indexOf('#');
        const cleanValue = commentIndex >= 0 ? value.substring(0, commentIndex) : value;
        const trimmedValue = cleanValue.trim();

        // String literals (including raw, formatted, bytes)
        if (this.isStringLiteral(trimmedValue)) {
            return 'str';
        }

        // Comprehensions (must check before regular literals)
        if (this.isListComprehension(trimmedValue)) {
            return 'list';
        }

        if (this.isDictComprehension(trimmedValue)) {
            return 'dict';
        }

        if (this.isSetComprehension(trimmedValue)) {
            return 'set';
        }

        if (this.isGeneratorExpression(trimmedValue)) {
            return 'generator';
        }

        // Collection literals
        if (trimmedValue.startsWith('[')) {
            return 'list';
        }

        if (trimmedValue.startsWith('{') && trimmedValue.includes(':')) {
            return 'dict';
        }

        if (trimmedValue.startsWith('{')) {
            return 'set';
        }

        if (trimmedValue.startsWith('(')) {
            return 'tuple';
        }

        // Lambda expressions
        if (this.isLambdaExpression(trimmedValue)) {
            return 'function';
        }

        // Numeric literals
        if (/^-?\d+$/.test(trimmedValue)) {
            return 'int';
        }

        if (/^-?\d+\.\d+$/.test(trimmedValue)) {
            return 'float';
        }

        // Boolean literals
        if (trimmedValue === 'True' || trimmedValue === 'False') {
            return 'bool';
        }

        // None
        if (trimmedValue === 'None') {
            return 'NoneType';
        }

        // Constructor calls
        const constructorType = this.detectConstructorCall(trimmedValue);
        if (constructorType) {
            return constructorType;
        }

        return undefined;
    }

    /**
     * Check if value is a string literal
     */
    private static isStringLiteral(value: string): boolean {
        return (
            value.startsWith('"') || value.startsWith("'") ||
            value.startsWith('r"') || value.startsWith("r'") ||
            value.startsWith('f"') || value.startsWith("f'") ||
            value.startsWith('b"') || value.startsWith("b'")
        );
    }

    /**
     * Check if value is a list comprehension
     */
    private static isListComprehension(value: string): boolean {
        return value.startsWith('[') && value.includes(' for ');
    }

    /**
     * Check if value is a dict comprehension
     */
    private static isDictComprehension(value: string): boolean {
        return value.startsWith('{') && value.includes(':') && value.includes(' for ');
    }

    /**
     * Check if value is a set comprehension
     */
    private static isSetComprehension(value: string): boolean {
        return value.startsWith('{') && !value.includes(':') && value.includes(' for ');
    }

    /**
     * Check if value is a generator expression
     */
    private static isGeneratorExpression(value: string): boolean {
        return value.startsWith('(') && value.includes(' for ');
    }

    /**
     * Check if value is a lambda expression
     */
    private static isLambdaExpression(value: string): boolean {
        return value.startsWith('lambda ') || /^lambda\s*:/.test(value);
    }

    /**
     * Detect constructor call type
     */
    private static detectConstructorCall(value: string): string | undefined {
        // Match simple constructors: ClassName(...) or module.ClassName(...)
        const constructorMatch = value.match(/^([\w.]+)\(/);
        if (constructorMatch) {
            const constructorName = constructorMatch[1];

            // Check for built-in types
            if (['str', 'int', 'float', 'list', 'dict', 'set', 'tuple', 'bool'].includes(constructorName)) {
                return constructorName;
            }

            // Check for third-party library constructors (e.g., pandas.DataFrame, numpy.array)
            if (constructorName.includes('.')) {
                // Return the full qualified name (e.g., "pandas.DataFrame")
                return constructorName;
            }

            // For simple class names (e.g., DataFrame, Series), also return them
            // The context will be resolved later by the symbol resolver
            return constructorName;
        }
        return undefined;
    }

    /**
     * Common Python built-in types
     */
    public static readonly BUILTIN_TYPES = [
        'str', 'int', 'float', 'list', 'dict', 'set', 'tuple', 'bool',
        'bytes', 'bytearray', 'frozenset', 'complex', 'NoneType',
        'generator', 'function'
    ];

    /**
     * Check if a type name is a built-in type
     */
    public static isBuiltinType(typeName: string): boolean {
        return this.BUILTIN_TYPES.includes(typeName);
    }
}
