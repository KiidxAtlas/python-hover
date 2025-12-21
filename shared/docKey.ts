import { DocKey, SymbolInfo } from './types';

export class DocKeyBuilder {
    static fromSymbol(symbolInfo: SymbolInfo): DocKey {
        let module = symbolInfo.module;
        const name = symbolInfo.name;
        let qualname = (symbolInfo as any).qualname || name;
        let pkg = '';

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
}
