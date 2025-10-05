/**
 * Special methods (dunder methods) information provider
 */

export interface SpecialMethodEntry {
    name: string;
    kind?: 'object' | 'type';
    desc?: string;
}

/**
 * Descriptions for special methods
 */
export const SPECIAL_METHOD_DESCRIPTIONS: Record<string, string> = {
    '__init__': 'Constructor; called to initialize a newly created instance.',
    '__repr__': 'Official string representation used for debugging.',
    '__str__': 'User-friendly string representation.',
    '__len__': 'Return the length of the container.',
    '__iter__': 'Return an iterator over the container.',
    '__contains__': 'Check membership (in operator).',
    '__getitem__': 'Return item indexed by key.',
    '__setitem__': 'Assign item for a key.',
    '__enter__': 'Context manager entry (with).',
    '__exit__': 'Context manager exit (with).',
    '__call__': 'Make an instance callable like a function.',
    '__new__': 'Low-level constructor; allocates instance.',
    '__eq__': 'Equality comparison.',
    '__lt__': 'Less-than comparison.',
    '__getattr__': 'Fallback attribute access.',
    '__getattribute__': 'Primary attribute access implementation.',
    '__setattr__': 'Attribute assignment handler.',
    '__delattr__': 'Attribute deletion handler.',
    '__bool__': 'Boolean value of the instance.',
    '__hash__': 'Hash value for dictionary keys.',
    '__add__': 'Implement addition (+).',
    '__sub__': 'Implement subtraction (-).',
    '__mul__': 'Implement multiplication (*).',
    '__truediv__': 'Implement division (/).',
    '__floordiv__': 'Implement integer division (//).',
    '__mod__': 'Implement modulo (%).',
    '__pow__': 'Implement power (**).',
    '__del__': 'Destructor; called when instance is about to be destroyed.',
};

/**
 * Default list of common special methods
 */
export const DEFAULT_SPECIAL_METHODS: SpecialMethodEntry[] = [
    { name: '__init__' }, 
    { name: '__repr__' }, 
    { name: '__str__' }, 
    { name: '__len__' }, 
    { name: '__iter__' }, 
    { name: '__contains__' }, 
    { name: '__getitem__' }, 
    { name: '__setitem__' }, 
    { name: '__delitem__' }, 
    { name: '__enter__' }, 
    { name: '__exit__' }, 
    { name: '__call__' }, 
    { name: '__new__' }, 
    { name: '__del__' }
];

/**
 * Builds a formatted section with information about special methods
 */
export function buildSpecialMethodsSection(className: string, methods: SpecialMethodEntry[] = DEFAULT_SPECIAL_METHODS): string {
    const lines = [
        `## Special Methods for \`${className}\` class`,
        '',
        'These methods have special meaning in Python:',
        ''
    ];

    for (const method of methods) {
        const desc = method.desc || SPECIAL_METHOD_DESCRIPTIONS[method.name] || 'Special method';
        lines.push(`- \`${method.name}\`: ${desc}`);
    }

    lines.push('', 'Override these methods to customize class behavior.');
    return lines.join('\n');
}

/**
 * Gets information about a specific dunder method
 */
export function getDunderInfo(methodName: string): { description: string; example?: string } | undefined {
    if (!methodName.startsWith('__') || !methodName.endsWith('__')) {
        return undefined;
    }

    return {
        description: SPECIAL_METHOD_DESCRIPTIONS[methodName] || 'Special method',
        example: `class MyClass:\n    def ${methodName}(self, ...):\n        # Your implementation\n        pass`
    };
}