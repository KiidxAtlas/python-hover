import { DocKey, HoverDoc, ResolutionSource } from '../shared/types';

export class SearchFallback {
    getDevDocsUrl(key: DocKey): string {
        const query = key.isStdlib ? `python ${key.name}` : `${key.package} ${key.name}`;
        return `https://devdocs.io/#q=${encodeURIComponent(query)}`;
    }

    async search(key: DocKey): Promise<HoverDoc> {
        // Use DevDocs.io as a smart fallback
        // It aggregates docs for Python, Pandas, NumPy, etc.
        const url = this.getDevDocsUrl(key);

        return {
            title: key.name,
            content: `Documentation not found in local inventory.`,
            url: url,
            source: ResolutionSource.DevDocs,
            confidence: 0.5
        };
    }
}
