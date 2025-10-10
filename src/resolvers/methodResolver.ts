import * as vscode from 'vscode';
import { Logger } from '../services/logger';
import { SymbolInfo } from './symbolResolver';

/**
 * Maps methods to their common container types with documentation anchors
 */
export const METHOD_TO_TYPE_MAP: Record<string, { types: string[]; anchor: string; title: string }> = {
    // String methods
    'strip': { types: ['str'], anchor: 'str.strip', title: 'str.strip() — Remove Whitespace' },
    'split': { types: ['str'], anchor: 'str.split', title: 'str.split() — Split String' },
    'join': { types: ['str'], anchor: 'str.join', title: 'str.join() — Join Iterable' },
    'replace': { types: ['str'], anchor: 'str.replace', title: 'str.replace() — Replace Substring' },
    'find': { types: ['str'], anchor: 'str.find', title: 'str.find() — Find Substring' },
    'startswith': { types: ['str'], anchor: 'str.startswith', title: 'str.startswith() — Check Prefix' },
    'endswith': { types: ['str'], anchor: 'str.endswith', title: 'str.endswith() — Check Suffix' },
    'upper': { types: ['str'], anchor: 'str.upper', title: 'str.upper() — Uppercase' },
    'lower': { types: ['str'], anchor: 'str.lower', title: 'str.lower() — Lowercase' },
    'capitalize': { types: ['str'], anchor: 'str.capitalize', title: 'str.capitalize() — First Letter' },
    'title': { types: ['str'], anchor: 'str.title', title: 'str.title() — Title Case' },
    'isdigit': { types: ['str'], anchor: 'str.isdigit', title: 'str.isdigit() — Check Digits' },
    'isalpha': { types: ['str'], anchor: 'str.isalpha', title: 'str.isalpha() — Check Letters' },
    'isalnum': { types: ['str'], anchor: 'str.isalnum', title: 'str.isalnum() — Check Alphanumeric' },
    'count': { types: ['str', 'list'], anchor: 'str.count', title: 'count() — Count Occurrences' },
    'format': { types: ['str'], anchor: 'str.format', title: 'str.format() — Format String' },

    // List methods
    'append': { types: ['list'], anchor: 'mutable-sequence-types', title: 'list.append() — Add Item' },
    'extend': { types: ['list'], anchor: 'mutable-sequence-types', title: 'list.extend() — Extend List' },
    'insert': { types: ['list'], anchor: 'mutable-sequence-types', title: 'list.insert() — Insert Item' },
    'remove': { types: ['list'], anchor: 'mutable-sequence-types', title: 'list.remove() — Remove Item' },
    'pop': { types: ['list', 'dict'], anchor: 'mutable-sequence-types', title: 'pop() — Remove & Return' },
    'clear': { types: ['list', 'dict', 'set'], anchor: 'mutable-sequence-types', title: 'clear() — Remove All Items' },
    'copy': { types: ['list', 'dict', 'set'], anchor: 'mutable-sequence-types', title: 'copy() — Shallow Copy' },
    'reverse': { types: ['list'], anchor: 'mutable-sequence-types', title: 'list.reverse() — Reverse In Place' },
    'sort': { types: ['list'], anchor: 'mutable-sequence-types', title: 'list.sort() — Sort In Place' },
    'index': { types: ['list', 'tuple', 'str'], anchor: 'common-sequence-operations', title: 'index() — Find Index' },

    // Dictionary methods
    'keys': { types: ['dict'], anchor: 'dict.keys', title: 'dict.keys() — Dictionary Keys' },
    'values': { types: ['dict'], anchor: 'dict.values', title: 'dict.values() — Dictionary Values' },
    'items': { types: ['dict'], anchor: 'dict.items', title: 'dict.items() — Dictionary Items' },
    'get': { types: ['dict'], anchor: 'dict.get', title: 'dict.get() — Get Value' },
    'setdefault': { types: ['dict'], anchor: 'dict.setdefault', title: 'dict.setdefault() — Get or Set Default' },
    'update': { types: ['dict'], anchor: 'dict.update', title: 'dict.update() — Update Dictionary' },
    'popitem': { types: ['dict'], anchor: 'dict.popitem', title: 'dict.popitem() — Remove & Return Item' },
    'fromkeys': { types: ['dict'], anchor: 'dict.fromkeys', title: 'dict.fromkeys() — Create from Keys' },

    // Set methods
    'add': { types: ['set'], anchor: 'set.add', title: 'set.add() — Add Element' },
    'discard': { types: ['set'], anchor: 'set.discard', title: 'set.discard() — Remove If Present' },
    'union': { types: ['set'], anchor: 'set.union', title: 'set.union() — Union of Sets' },
    'intersection': { types: ['set'], anchor: 'set.intersection', title: 'set.intersection() — Intersection of Sets' },
    'difference': { types: ['set'], anchor: 'set.difference', title: 'set.difference() — Set Difference' },
    'symmetric_difference': { types: ['set'], anchor: 'set.symmetric_difference', title: 'set.symmetric_difference() — Symmetric Difference' },
    'issubset': { types: ['set'], anchor: 'set.issubset', title: 'set.issubset() — Test Subset' },
    'issuperset': { types: ['set'], anchor: 'set.issuperset', title: 'set.issuperset() — Test Superset' },

    // File methods
    'read': { types: ['file'], anchor: 'io-methods', title: 'read() — Read Contents' },
    'readline': { types: ['file'], anchor: 'io-methods', title: 'readline() — Read Single Line' },
    'readlines': { types: ['file'], anchor: 'io-methods', title: 'readlines() — Read All Lines' },
    'write': { types: ['file'], anchor: 'io-methods', title: 'write() — Write String' },
    'writelines': { types: ['file'], anchor: 'io-methods', title: 'writelines() — Write Lines' },
    'close': { types: ['file'], anchor: 'io-methods', title: 'close() — Close File' },
};

export class MethodResolver {
    /**
     * Determines if a method name is a known method of a built-in type
     */
    public isKnownMethod(methodName: string): boolean {
        return METHOD_TO_TYPE_MAP.hasOwnProperty(methodName);
    }

    /**
     * Resolves method information based on context with scoring for ambiguous cases
     */
    public resolveMethodInfo(document: vscode.TextDocument, position: vscode.Position,
        methodName: string, receiverType?: string): SymbolInfo | undefined {

        if (!this.isKnownMethod(methodName)) {
            return undefined;
        }

        const methodInfo = METHOD_TO_TYPE_MAP[methodName];

        // If we have explicit receiver type information, use it
        if (receiverType) {
            // Check if the receiver type is in the list of possible types
            if (methodInfo.types.includes(receiverType)) {
                return {
                    symbol: `${receiverType}.${methodName}`,
                    type: 'method',
                    context: receiverType,
                    documentation: methodInfo.title
                };
            }
            // If receiver type doesn't match, but we have it, still use it
            // This handles cases where context detector might infer a more specific type
            return {
                symbol: `${receiverType}.${methodName}`,
                type: 'method',
                context: receiverType,
                documentation: methodInfo.title
            };
        }

        // No explicit receiver type - need to score candidates
        if (methodInfo.types.length === 1) {
            // Only one possible type, no ambiguity
            const type = methodInfo.types[0];
            return {
                symbol: `${type}.${methodName}`,
                type: 'method',
                context: type,
                documentation: methodInfo.title
            };
        }

        // Multiple possible types - score them based on context
        const bestType = this.scoreAndSelectBestType(document, position, methodName, methodInfo.types);

        return {
            symbol: `${bestType}.${methodName}`,
            type: 'method',
            context: bestType,
            documentation: methodInfo.title
        };
    }

    /**
     * Score and select the best type for an ambiguous method
     * Uses heuristics based on surrounding code context
     */
    private scoreAndSelectBestType(
        document: vscode.TextDocument,
        position: vscode.Position,
        methodName: string,
        candidateTypes: string[]
    ): string {
        const scores = new Map<string, number>();

        // Initialize scores
        for (const type of candidateTypes) {
            scores.set(type, 0);
        }

        // Look at current line and nearby lines for type hints
        const lineText = document.lineAt(position.line).text;
        const maxContextLines = 5;
        const startLine = Math.max(0, position.line - maxContextLines);
        const endLine = Math.min(document.lineCount - 1, position.line + maxContextLines);

        // Collect context from surrounding lines
        const contextLines: string[] = [];
        for (let i = startLine; i <= endLine; i++) {
            contextLines.push(document.lineAt(i).text);
        }
        const context = contextLines.join('\n');

        // Scoring heuristics
        for (const type of candidateTypes) {
            let score = 0;

            // Check for type annotations mentioning this type
            const annotationPattern = new RegExp(`:\\s*${type}\\b`, 'i');
            if (annotationPattern.test(context)) {
                score += 10;
            }

            // Check for constructor calls
            const constructorPattern = new RegExp(`=\\s*${type}\\s*\\(`, 'i');
            if (constructorPattern.test(context)) {
                score += 8;
            }

            // Check for type-specific literals in current line
            if (type === 'list' && /\[.*\]/.test(lineText)) {
                score += 5;
            }
            if (type === 'dict' && /\{.*:.*\}/.test(lineText)) {
                score += 5;
            }
            if (type === 'set' && /\{.*\}/.test(lineText) && !/\{.*:.*\}/.test(lineText)) {
                score += 5;
            }
            if (type === 'str' && /['"].*['"]/.test(lineText)) {
                score += 3;
            }

            // Check for common patterns indicating specific types
            if (type === 'list' && /\.(append|extend|insert)\s*\(/.test(context)) {
                score += 7;
            }
            if (type === 'dict' && /\.(keys|values|items|get)\s*\(/.test(context)) {
                score += 7;
            }
            if (type === 'set' && /\.(add|discard|union|intersection)\s*\(/.test(context)) {
                score += 7;
            }
            if (type === 'str' && /\.(strip|split|replace|format)\s*\(/.test(context)) {
                score += 7;
            }

            // Default priorities for ambiguous methods
            // 'pop' is more common on list than dict
            if (methodName === 'pop') {
                if (type === 'list') score += 2;
                if (type === 'dict') score += 1;
            }
            // 'clear' is equally common, slight preference for list in general code
            if (methodName === 'clear') {
                if (type === 'list') score += 2;
                if (type === 'dict') score += 1;
                if (type === 'set') score += 1;
            }
            // 'copy' slight preference for list
            if (methodName === 'copy') {
                if (type === 'list') score += 2;
                if (type === 'dict') score += 1;
                if (type === 'set') score += 1;
            }
            // 'count' more common on strings than lists
            if (methodName === 'count') {
                if (type === 'str') score += 3;
                if (type === 'list') score += 1;
            }
            // 'index' most common on lists
            if (methodName === 'index') {
                if (type === 'list') score += 3;
                if (type === 'tuple') score += 2;
                if (type === 'str') score += 1;
            }

            scores.set(type, score);
        }

        // Find type with highest score
        let bestType = candidateTypes[0];
        let bestScore = scores.get(bestType) || 0;

        for (const [type, score] of scores.entries()) {
            if (score > bestScore) {
                bestScore = score;
                bestType = type;
            }
        }

        Logger.getInstance().debug(`Scored types for "${methodName}": ${Array.from(scores.entries()).map(([k, v]) => `${k}=${v}`).join(', ')}`);
        Logger.getInstance().debug(`Selected best type: ${bestType} (score: ${bestScore})`);

        return bestType;
    }
}
