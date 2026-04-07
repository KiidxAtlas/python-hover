import { BUILTIN_CONSTANTS, BUILTIN_EXCEPTION_PATTERN, KNOWN_BUILTIN_FUNCTIONS } from '../../../shared/pythonBuiltins';
import { DocKey, HoverDoc, ResolutionSource } from '../../../shared/types';
import { MAP } from '../../data/documentationUrls';
import { STDLIB_MODULES } from '../../data/stdlibModules';

/** Builtin types that are documented in the richer stdtypes page. */
const BUILTIN_STD_TYPES = new Set([
    'bool', 'bytearray', 'bytes', 'complex', 'dict', 'float', 'frozenset',
    'int', 'list', 'memoryview', 'range', 'set', 'slice', 'str', 'tuple',
]);

export class StaticDocResolver {
    private pythonVersion: string;

    constructor(pythonVersion: string = '3') {
        this.pythonVersion = pythonVersion;
    }

    setPythonVersion(version: string) {
        this.pythonVersion = version;
    }

    resolve(key: DocKey): HoverDoc | null {
        // 1. Keywords / operators / builtins
        if (MAP[key.name]) {
            const info = MAP[key.name];
            return {
                title: key.name,
                source: ResolutionSource.Static,
                confidence: 1.0,
                summary: info.summary,
                url: `https://docs.python.org/${this.pythonVersion}/${info.url}${info.anchor ? '#' + info.anchor : ''}`
            };
        }

        const builtinUrl = this.resolveBuiltinUrl(key);
        if (builtinUrl) {
            const builtinKind = this.resolveBuiltinKind(key);
            return {
                title: key.qualname || key.name,
                kind: builtinKind,
                source: ResolutionSource.Static,
                confidence: 0.7,
                url: builtinUrl,
            };
        }

        // 2. Stdlib modules — instant offline hover for `import os`, `import pathlib`, etc.
        // Only match the exact name — never fall back to key.module, which would
        // incorrectly return the MODULE page for any symbol inside that module
        // (e.g. list → builtins.html, typing.List → "Support for type hints…").
        if (key.isStdlib) {
            const modInfo = STDLIB_MODULES[key.name];
            if (modInfo) {
                return {
                    title: key.name,
                    kind: 'module',
                    source: ResolutionSource.Static,
                    confidence: 1.0,
                    url: `https://docs.python.org/${this.pythonVersion}/${modInfo.url}`
                };
            }
        }

        return null;
    }

    private resolveBuiltinUrl(key: DocKey): string | undefined {
        if (key.package !== 'builtins' && key.module !== 'builtins') {
            return undefined;
        }

        const qualname = (key.qualname || key.name).replace(/^builtins\./, '');
        if (!qualname) {
            return undefined;
        }

        if (qualname.includes('.')) {
            // Dunder (magic) methods on `object` are documented on the data model
            // reference page, not stdtypes.html.  Route them correctly so the corpus
            // scraper fetches the right anchor on first hover.
            if (/^object\.__\w+__$/.test(qualname)) {
                return `https://docs.python.org/${this.pythonVersion}/reference/datamodel.html#${qualname}`;
            }
            return `https://docs.python.org/${this.pythonVersion}/library/stdtypes.html#${qualname}`;
        }

        if (BUILTIN_STD_TYPES.has(qualname)) {
            return `https://docs.python.org/${this.pythonVersion}/library/stdtypes.html#${qualname}`;
        }

        if (BUILTIN_CONSTANTS.has(qualname)) {
            return `https://docs.python.org/${this.pythonVersion}/library/constants.html#${qualname}`;
        }

        if (BUILTIN_EXCEPTION_PATTERN.test(qualname)) {
            return `https://docs.python.org/${this.pythonVersion}/library/exceptions.html#${qualname}`;
        }

        if (KNOWN_BUILTIN_FUNCTIONS.has(qualname)) {
            return `https://docs.python.org/${this.pythonVersion}/library/functions.html#${qualname}`;
        }

        // Unknown bare name in builtins — don't guess functions.html for method
        // names like "upper" that leaked through without their owner type.
        return undefined;
    }

    private resolveBuiltinKind(key: DocKey): string | undefined {
        const qualname = (key.qualname || key.name).replace(/^builtins\./, '');
        if (!qualname) {return undefined;}

        if (qualname.includes('.')) {
            return 'method';
        }

        if (BUILTIN_STD_TYPES.has(qualname)) {
            return 'class';
        }

        if (BUILTIN_CONSTANTS.has(qualname)) {
            return 'constant';
        }

        if (BUILTIN_EXCEPTION_PATTERN.test(qualname)) {
            return 'class';
        }

        if (KNOWN_BUILTIN_FUNCTIONS.has(qualname)) {
            return 'function';
        }

        return undefined;
    }
}
