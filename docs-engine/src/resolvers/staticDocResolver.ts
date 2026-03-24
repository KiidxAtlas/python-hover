import { DocKey, HoverDoc, ResolutionSource } from '../../../shared/types';
import { MAP } from '../../data/documentationUrls';
import { STDLIB_MODULES } from '../../data/stdlibModules';

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
                url: `https://docs.python.org/${this.pythonVersion}/${info.url}${info.anchor ? '#' + info.anchor : ''}`
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
}
