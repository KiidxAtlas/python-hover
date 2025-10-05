/**
 * Provides smart suggestions for related methods and functions
 */

export interface RelatedMethod {
    name: string;
    description: string;
}

/**
 * Map of types to their commonly used methods
 */
export const TYPE_METHOD_MAP: Record<string, RelatedMethod[]> = {
    // String methods
    'str': [
        { name: 'upper', description: 'Convert to uppercase' },
        { name: 'lower', description: 'Convert to lowercase' },
        { name: 'strip', description: 'Remove leading/trailing whitespace' },
        { name: 'split', description: 'Split into list by delimiter' },
        { name: 'join', description: 'Join iterable with string as delimiter' },
        { name: 'replace', description: 'Replace substring' },
        { name: 'startswith', description: 'Check if string starts with prefix' },
        { name: 'endswith', description: 'Check if string ends with suffix' }
    ],
    
    // List methods
    'list': [
        { name: 'append', description: 'Add item to end' },
        { name: 'extend', description: 'Add items from iterable to end' },
        { name: 'insert', description: 'Insert item at position' },
        { name: 'remove', description: 'Remove first occurrence of value' },
        { name: 'pop', description: 'Remove and return item at index' },
        { name: 'sort', description: 'Sort in place' },
        { name: 'reverse', description: 'Reverse in place' }
    ],
    
    // Dictionary methods
    'dict': [
        { name: 'get', description: 'Get value for key with optional default' },
        { name: 'items', description: 'View of (key, value) pairs' },
        { name: 'keys', description: 'View of dictionary keys' },
        { name: 'values', description: 'View of dictionary values' },
        { name: 'update', description: 'Update with key/value pairs from another mapping' },
        { name: 'pop', description: 'Remove and return value for key' }
    ],
    
    // Set methods
    'set': [
        { name: 'add', description: 'Add element to set' },
        { name: 'remove', description: 'Remove element; raises KeyError if not found' },
        { name: 'discard', description: 'Remove element if present' },
        { name: 'union', description: 'Return union of sets' },
        { name: 'intersection', description: 'Return intersection of sets' },
        { name: 'difference', description: 'Return set difference' }
    ]
};

/**
 * Gets related methods for a given type
 */
export function getRelatedMethods(type: string): RelatedMethod[] {
    return TYPE_METHOD_MAP[type] || [];
}

/**
 * Gets related methods based on current method
 * For example, if using str.upper(), might suggest str.lower()
 */
export function getRelatedMethodsForMethod(type: string, method: string): RelatedMethod[] {
    if (!type || !method || !(type in TYPE_METHOD_MAP)) {
        return [];
    }
    
    // Return all methods for this type except the current one
    return TYPE_METHOD_MAP[type].filter(m => m.name !== method);
}