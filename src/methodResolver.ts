import * as vscode from 'vscode';
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
     * Resolves method information based on context
     */
    public resolveMethodInfo(document: vscode.TextDocument, position: vscode.Position, 
                           methodName: string, receiverType?: string): SymbolInfo | undefined {
        
        if (!this.isKnownMethod(methodName)) {
            return undefined;
        }

        const methodInfo = METHOD_TO_TYPE_MAP[methodName];
        const type = receiverType || methodInfo.types[0];
        
        // Return symbol info with appropriate context
        return {
            symbol: type ? `${type}.${methodName}` : methodName,
            type: 'method',
            context: type,
            documentation: methodInfo.title
        };
    }
}