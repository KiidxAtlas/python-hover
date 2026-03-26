import { DocKey, HoverDoc, ResolutionSource } from '../../../shared/types';
import { MAP } from '../../data/documentationUrls';
import { STDLIB_MODULES } from '../../data/stdlibModules';

const BUILTIN_CONSTANTS = new Set([
    'None',
    'True',
    'False',
    'NotImplemented',
    'Ellipsis',
    '__debug__',
]);

const BUILTIN_EXCEPTION_PATTERN = /^[A-Z][A-Za-z0-9]+(?:Error|Exception|Warning|Exit)$/;

/** Actual Python builtin functions — only these should get a functions.html URL. */
const KNOWN_BUILTIN_FUNCTIONS = new Set([
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
            return {
                title: key.qualname || key.name,
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
}
