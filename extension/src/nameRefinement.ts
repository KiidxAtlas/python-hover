import { Logger } from './logger';

/**
 * All symbol-name fixup logic in one place.
 *
 * LSP gives us imperfect symbol names (e.g. "append", "builtins.join",
 * "ntpath.join").  This module runs a series of refinement passes to produce
 * the most accurate fully-qualified name for documentation lookup.
 */
export class NameRefinement {

    /**
     * Fix names where the LSP resolves a method as a top-level function.
     * E.g. signature "def join(self: str, ...)" tells us it's str.join, not builtins.join.
     */
    static fromSignature(name: string, signature: string | undefined): string {
        if (!signature) return name;

        // Match "self: ClassName" or "self: Self@ClassName"
        const selfMatch = /\bself\s*:\s*([a-zA-Z0-9_.]+(?:@[a-zA-Z0-9_.]+)?)/.exec(signature);
        if (!selfMatch) return name;

        let className = selfMatch[1];
        if (className.includes('@')) className = className.split('@')[1]; // "Self@ClassName" → "ClassName"
        if (className === 'Unknown') return name;

        const methodName = name.split('.').pop();
        const expectedSuffix = `${className}.${methodName}`;
        if (name.endsWith(expectedSuffix)) return name; // already correct

        const lastDot = name.lastIndexOf('.');
        const newName = lastDot !== -1
            ? `${name.substring(0, lastDot)}.${className}.${methodName}`  // builtins.join → builtins.str.join
            : `${className}.${methodName}`;                                // append → list.append

        Logger.log(`NameRefinement.fromSignature: ${name} → ${newName}`);
        return newName;
    }

    /**
     * Infer a qualified name from the definition file path.
     * E.g. a symbol "join" defined in ".../site-packages/numpy/core/..." → "numpy.core.join"
     */
    static fromPath(name: string, filePath: string | undefined, skipIfImportHover: boolean): string {
        if (!filePath || skipIfImportHover || name.includes('.')) return name;

        const normalizedPath = filePath.replace(/\\/g, '/');
        const markers = ['/site-packages/', '/dist-packages/', '/Lib/', '/lib/'];

        for (const marker of markers) {
            const index = normalizedPath.lastIndexOf(marker);
            if (index === -1) continue;

            let relative = normalizedPath.substring(index + marker.length);
            relative = relative.replace(/^python\d+(?:\.\d+)?\//, '');
            relative = relative.replace(/^\d+\.\d+\//, '');
            relative = relative.replace(/\.(py|pyi)$/, '');
            if (relative.endsWith('/__init__')) relative = relative.slice(0, -'/__init__'.length);

            let moduleName = relative.replace(/\//g, '.');
            if (moduleName === 'ntpath' || moduleName === 'posixpath' || moduleName === 'macpath') {
                moduleName = 'os.path';
            }

            if (moduleName && moduleName !== name) {
                const newName = `${moduleName}.${name}`;
                Logger.log(`NameRefinement.fromPath (${marker}): ${name} → ${newName}`);
                return newName;
            }
            break;
        }

        return name;
    }

    /**
     * Normalize import module names — strips duplicate segments and version prefixes.
     * E.g. "os.path.path" → "os.path",  "python3.11.base64" → "base64"
     */
    static normalizeImportModule(name: string): string {
        const parts = name.split('.').filter(Boolean);

        // Remove trailing duplicate (os.path.path → os.path)
        if (parts.length >= 2 && parts[parts.length - 1] === parts[parts.length - 2]) {
            parts.pop();
        }

        // Strip interpreter-version prefixes like python3.11 or 3.11
        if (parts.length >= 2 && /^python\d+$/.test(parts[0]) && /^\d+$/.test(parts[1])) {
            parts.splice(0, 2);
        }
        if (parts.length >= 2 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1])) {
            parts.splice(0, 2);
        }

        return parts.join('.');
    }

    /**
     * Fix runtime name vs LSP name mismatch.
     * When LSP gives a qualified name (e.g. "os.chdir") but runtime only knows the short name
     * ("chdir"), we prefer the qualified LSP name — and handle the os.path platform alias case.
     */
    static mergeRuntimeName(
        lspName: string,
        runtimeName: string | undefined,
        runtimeModule: string | undefined,
    ): string {
        if (!runtimeName || !lspName.includes('.') || runtimeName.includes('.')) return lspName;

        // os.path platform aliasing: ntpath/posixpath → os.path
        // Python returns the implementation module name (posixpath/ntpath) as __module__,
        // not the public 'os.path' alias.
        const PATH_IMPL_MODULES = new Set(['os.path', 'posixpath', 'ntpath', 'genericpath', 'macpath']);
        const isPathImplModule = PATH_IMPL_MODULES.has(runtimeModule ?? '');
        const isPathImplLspName = /^(?:posixpath|ntpath|genericpath|macpath)\./.test(lspName);
        if (isPathImplModule && (isPathImplLspName || lspName.startsWith('os.path.'))) {
            return `os.path.${runtimeName}`;
        }

        return lspName;
    }
}
