/**
 * Symbol-name fixup logic.
 *
 * Pylance sometimes gives imperfect names (e.g. "append" instead of
 * "list.append").  These refinements run after lspClient and correct
 * remaining edge cases using the signature's `self` parameter.
 */
export class NameRefinement {
    private static readonly SELF_TYPE_ALIASES: Record<string, string> = {
        'LiteralString': 'str',
        'AnyStr': 'str',
        'Text': 'str',
        'ByteString': 'bytes',
        'NoneType': 'None',
    };

    private static readonly BUILTIN_OWNER_TYPES = new Set([
        'str', 'list', 'dict', 'set', 'tuple', 'int', 'float', 'bool',
        'bytes', 'bytearray', 'frozenset', 'complex', 'object', 'None',
    ]);

    /**
     * Fix names where the LSP resolves a method as a top-level function.
     * E.g. signature "def join(self: str, ...)" tells us it's str.join, not builtins.join.
     */
    static fromSignature(name: string, signature: string | undefined): string {
        if (!signature) return name;

        const selfMatch = /\bself\s*:\s*([a-zA-Z0-9_.]+(?:@[a-zA-Z0-9_.]+)?)/.exec(signature);
        if (!selfMatch) return name;

        let className = selfMatch[1];
        if (className.includes('@')) className = className.split('@')[1];
        className = this.normalizeSelfType(className);
        if (className === 'Unknown') return name;

        const methodName = name.split('.').pop();
        const expectedSuffix = `${className}.${methodName}`;
        if (name.endsWith(expectedSuffix)) return name;

        const lastDot = name.lastIndexOf('.');
        const useBuiltinOwner = this.BUILTIN_OWNER_TYPES.has(className);
        if (lastDot === -1 || useBuiltinOwner) {
            return `${className}.${methodName}`;
        }

        const prefix = name.substring(0, lastDot);
        return prefix.includes('.')
            ? `${prefix}.${className}.${methodName}`
            : `${className}.${methodName}`;
    }

    private static normalizeSelfType(className: string): string {
        const normalized = className.startsWith('builtins.')
            ? className.slice('builtins.'.length)
            : className;
        return this.SELF_TYPE_ALIASES[normalized] ?? normalized;
    }

    /**
     * Normalize import module names — strips duplicate segments and version prefixes.
     * E.g. "os.path.path" → "os.path",  "python3.11.base64" → "base64"
     */
    static normalizeImportModule(name: string): string {
        const parts = name.split('.').filter(Boolean);

        if (parts.length >= 2 && parts[parts.length - 1] === parts[parts.length - 2]) {
            parts.pop();
        }

        if (parts.length >= 2 && /^python\d+$/.test(parts[0]) && /^\d+$/.test(parts[1])) {
            parts.splice(0, 2);
        }
        if (parts.length >= 2 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1])) {
            parts.splice(0, 2);
        }

        return parts.join('.');
    }
}
