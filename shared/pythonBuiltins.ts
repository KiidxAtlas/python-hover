const BUILTIN_TYPE_NAMES = [
    'str', 'list', 'dict', 'set', 'tuple', 'int', 'float',
    'bytes', 'bytearray', 'frozenset', 'complex', 'bool', 'object',
];

const BUILTIN_OWNER_TYPE_NAMES = [
    ...BUILTIN_TYPE_NAMES,
    'None',
];

const SELF_TYPE_ALIASES: Record<string, string> = {
    'LiteralString': 'str',
    'AnyStr': 'str',
    'Text': 'str',
    'ByteString': 'bytes',
    'NoneType': 'None',
};

export const BUILTIN_TYPES = new Set(BUILTIN_TYPE_NAMES);

export const BUILTIN_OWNER_TYPES = new Set(BUILTIN_OWNER_TYPE_NAMES);

export const BUILTIN_CONSTANTS = new Set([
    'None',
    'True',
    'False',
    'NotImplemented',
    'Ellipsis',
    '__debug__',
]);

export const KNOWN_BUILTIN_FUNCTIONS = new Set([
    'abs', 'aiter', 'all', 'anext', 'any', 'ascii',
    'bin', 'bool', 'breakpoint', 'bytearray', 'bytes',
    'callable', 'chr', 'classmethod', 'compile', 'complex',
    'delattr', 'dict', 'dir', 'divmod',
    'enumerate', 'eval', 'exec',
    'filter', 'float', 'format', 'frozenset',
    'getattr', 'globals',
    'hasattr', 'hash', 'help', 'hex',
    'id', 'input', 'int', 'isinstance', 'issubclass', 'iter',
    'len', 'list', 'locals',
    'map', 'max', 'memoryview', 'min',
    'next',
    'object', 'oct', 'open', 'ord',
    'pow', 'print', 'property',
    'range', 'repr', 'reversed', 'round',
    'set', 'setattr', 'slice', 'sorted', 'staticmethod', 'str', 'sum', 'super',
    'tuple', 'type',
    'vars',
    'zip',
    '__import__',
]);

export const BUILTIN_EXCEPTION_PATTERN = /^[A-Z][A-Za-z0-9]+(?:Error|Exception|Warning|Exit)$/;

export function normalizeSelfTypeAlias(typeName: string): string {
    const normalized = typeName.startsWith('builtins.')
        ? typeName.slice('builtins.'.length)
        : typeName;
    return SELF_TYPE_ALIASES[normalized] ?? normalized;
}

export function isKnownTopLevelBuiltin(name: string): boolean {
    return BUILTIN_CONSTANTS.has(name)
        || KNOWN_BUILTIN_FUNCTIONS.has(name)
        || BUILTIN_EXCEPTION_PATTERN.test(name);
}
