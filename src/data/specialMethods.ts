/**
 * Special methods (dunder methods) information provider
 */

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
