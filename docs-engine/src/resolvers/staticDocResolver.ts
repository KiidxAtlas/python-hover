import { DocKey, HoverDoc, ResolutionSource } from '../../../shared/types';
import { MAP } from '../../data/documentationUrls';

export class StaticDocResolver {
    private pythonVersion: string;

    constructor(pythonVersion: string = '3') {
        this.pythonVersion = pythonVersion;
    }

    setPythonVersion(version: string) {
        this.pythonVersion = version;
    }

    resolve(key: DocKey): HoverDoc | null {
        // 1. Check for Keywords/Operators/Builtins in MAP
        if (MAP[key.name]) {
            const info = MAP[key.name];
            const doc: HoverDoc = {
                title: info.title,
                // content: info.title, // Removed to allow runtime docstring to take precedence for summary
                source: ResolutionSource.Static,
                confidence: 1.0,
                url: `https://docs.python.org/${this.pythonVersion}/${info.url}${info.anchor ? '#' + info.anchor : ''}`
            };

            return doc;
        }

        return null;
    }
}
