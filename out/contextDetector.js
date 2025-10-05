"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextDetector = void 0;
/**
 * Provides context-aware type detection for Python variables and expressions
 * Based on the implementation from the deprecated version
 */
class ContextDetector {
    constructor() {
        // Cache for compiled regex patterns to improve performance
        this.regexCache = new Map();
    }
    /**
     * Get a cached regex pattern or create and cache it
     */
    getCachedRegex(pattern, flags) {
        const key = `${pattern}:${flags || ''}`;
        if (!this.regexCache.has(key)) {
            try {
                this.regexCache.set(key, new RegExp(pattern, flags));
            }
            catch (error) {
                console.error('Invalid regex pattern:', pattern, error);
                // Return a safe fallback regex that never matches
                return /(?!)/;
            }
        }
        return this.regexCache.get(key);
    }
    /**
     * Determines the likely type of a variable based on context
     */
    detectVariableTypeFromContext(document, position, variableName) {
        if (!variableName)
            return undefined;
        const maxLines = 100; // Limit search to prevent performance issues
        const startLine = Math.max(0, position.line - maxLines);
        const endLine = Math.min(document.lineCount - 1, position.line + 5);
        // Search backward for variable assignments
        for (let i = position.line; i >= startLine; i--) {
            const line = document.lineAt(i).text;
            // Check for variable assignments (var = value)
            const assignmentRegex = this.getCachedRegex(`${variableName}\\s*=\\s*(.+)$`);
            const assignmentMatch = line.match(assignmentRegex);
            if (assignmentMatch) {
                const value = assignmentMatch[1].trim();
                // Check for string literals
                if (value.startsWith('"') || value.startsWith("'") ||
                    value.startsWith('r"') || value.startsWith("r'") ||
                    value.startsWith('f"') || value.startsWith("f'")) {
                    return 'str';
                }
                // Check for list literals
                if (value.startsWith('[')) {
                    return 'list';
                }
                // Check for dict literals
                if (value.startsWith('{') && value.includes(':')) {
                    return 'dict';
                }
                // Check for set literals
                if (value.startsWith('{') && !value.includes(':')) {
                    return 'set';
                }
                // Check for tuple literals
                if (value.startsWith('(')) {
                    return 'tuple';
                }
                // Check for numeric literals
                if (/^-?\d+$/.test(value)) {
                    return 'int';
                }
                // Check for float literals
                if (/^-?\d+\.\d+$/.test(value)) {
                    return 'float';
                }
                // Check for bool literals
                if (value === 'True' || value === 'False') {
                    return 'bool';
                }
                // Check for constructor calls (e.g., str(), list(), etc.)
                const constructorMatch = value.match(/^(\w+)\(/);
                if (constructorMatch) {
                    const constructorName = constructorMatch[1];
                    if (['str', 'int', 'float', 'list', 'dict', 'set', 'tuple', 'bool'].includes(constructorName)) {
                        return constructorName;
                    }
                }
            }
            // Check for type annotations (var: Type)
            const annotationRegex = this.getCachedRegex(`${variableName}\\s*:\\s*(\\w+)`);
            const annotationMatch = line.match(annotationRegex);
            if (annotationMatch) {
                const typeName = annotationMatch[1];
                if (['str', 'int', 'float', 'list', 'dict', 'set', 'tuple', 'bool'].includes(typeName)) {
                    return typeName;
                }
            }
        }
        // If we reach here, we couldn't determine the type
        return undefined;
    }
    /**
     * Detects if we are in a method call context and identifies the object type
     */
    detectMethodContext(document, position, methodName) {
        const line = document.lineAt(position.line).text;
        const beforePosition = line.substring(0, position.character);
        // Check for method calls (obj.method)
        const dotMatch = beforePosition.match(this.getCachedRegex(`(\\w+)\\s*\\.\\s*${methodName}\\s*$`));
        if (dotMatch) {
            const objectName = dotMatch[1];
            return this.detectVariableTypeFromContext(document, position, objectName);
        }
        // Common method-to-type inference as a fallback
        if (['strip', 'split', 'join', 'replace', 'find', 'startswith', 'endswith', 'upper', 'lower',
            'capitalize', 'title', 'isdigit', 'isalpha', 'isalnum', 'format'].includes(methodName)) {
            return 'str';
        }
        else if (['append', 'extend', 'insert', 'remove', 'pop', 'clear', 'copy', 'reverse', 'sort'].includes(methodName)) {
            return 'list';
        }
        else if (['keys', 'values', 'items', 'get', 'setdefault', 'update', 'popitem', 'fromkeys'].includes(methodName)) {
            return 'dict';
        }
        else if (['add', 'update', 'remove', 'discard', 'clear', 'copy', 'union', 'intersection'].includes(methodName)) {
            return 'set';
        }
        return undefined;
    }
}
exports.ContextDetector = ContextDetector;
//# sourceMappingURL=contextDetector.js.map