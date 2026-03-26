import { DocKey, SymbolInfo } from './types';

const SELF_TYPE_ALIASES: Record<string, string> = {
    'LiteralString': 'str',
    'AnyStr': 'str',
    'Text': 'str',
    'ByteString': 'bytes',
    'NoneType': 'None',
};

const BUILTIN_OWNER_TYPES = new Set([
    'str', 'list', 'dict', 'set', 'tuple', 'int', 'float', 'bool',
    'bytes', 'bytearray', 'frozenset', 'complex', 'object', 'None',
]);

export class DocKeyBuilder {
    static fromSymbol(symbolInfo: SymbolInfo): DocKey {
        let module = symbolInfo.module;
        const name = symbolInfo.name;
        // If module is set and name starts with "module.", strip the module prefix
        // to get the qualname (e.g. "builtins.str.upper" → qualname "str.upper").
        // Without this, 3-part fully-qualified names like "builtins.str.upper" produce
        // qualname "upper" (just the last segment), which misses in the inventory.
        let qualname: string;
        if (module && name.startsWith(module + '.')) {
            qualname = (symbolInfo as any).qualname || name.slice(module.length + 1);
        } else {
            qualname = (symbolInfo as any).qualname || name;
        }
        let pkg = '';

        if (!module && symbolInfo.path === 'builtins') {
            module = 'builtins';
            pkg = 'builtins';
            qualname = name.replace(/^builtins\./, '');
        }

        if (module && module !== 'builtins') {
            pkg = module.split('.')[0];
        } else if (module === 'builtins') {
            pkg = 'builtins';
            // Generic handling for dunder methods on 'module' type
            // The runtime reports them as module.__init__, module.__str__, etc.
            // But in the docs they are typically under object.__init__, object.__str__
            if (qualname.startsWith('module.__') && qualname.endsWith('__')) {
                qualname = qualname.replace('module.', 'object.');
            }

            const ownerType = this.inferBuiltinOwnerType(symbolInfo.signature);
            if (ownerType && !qualname.includes('.')) {
                qualname = `${ownerType}.${qualname}`;
            }

            const qualnameRoot = qualname.split('.')[0];
            if (qualname.includes('.') && !BUILTIN_OWNER_TYPES.has(qualnameRoot) && qualnameRoot !== 'module') {
                if (ownerType) {
                    const leaf = qualname.split('.').pop() ?? qualname;
                    qualname = `${ownerType}.${leaf}`;
                }
                // Without a known owner, leave qualname as-is so inventory
                // can attempt a match rather than producing a bare method name
                // that StaticDocResolver would wrongly map to functions.html.
            }
        } else {
            // Fallback: try to guess from the name if it looks like a dotted path
            if (name.includes('.')) {
                const parts = name.split('.');
                pkg = parts[0];
                // If name is "pandas.DataFrame", pkg is "pandas"
                module = parts.slice(0, -1).join('.');
                qualname = parts[parts.length - 1];
            } else {
                // If it's a dunder method (e.g. __iter__, __len__) and runtime failed,
                // assume it's a standard object method documented in builtins/object
                if (name.startsWith('__') && name.endsWith('__')) {
                    pkg = 'builtins';
                    module = 'builtins';
                    qualname = `object.${name}`;
                } else {
                    // If it's a single word and runtime failed, assume it's a top-level package
                    // e.g. "pandas", "aiohttp"
                    pkg = name;
                    module = name;
                    qualname = name;
                }
            }
        }

        return {
            package: pkg,
            module: module,
            name: name,
            qualname: qualname,
            isStdlib: symbolInfo.isStdlib
        };
    }

    private static inferBuiltinOwnerType(signature?: string): string | null {
        if (!signature) return null;

        const selfMatch = /\bself\s*:\s*([a-zA-Z0-9_.]+(?:@[a-zA-Z0-9_.]+)?)/.exec(signature);
        if (!selfMatch) return null;

        let ownerType = selfMatch[1];
        if (ownerType.includes('@')) {
            ownerType = ownerType.split('@')[1];
        }
        if (ownerType.startsWith('builtins.')) {
            ownerType = ownerType.slice('builtins.'.length);
        }

        return SELF_TYPE_ALIASES[ownerType] ?? ownerType;
    }
}
