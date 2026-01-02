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

        // Build a helpful summary instead of "not found"
        const modulePart = key.module ? ` in \`${key.module}\`` : '';
        const summary = key.isStdlib
            ? `Python standard library symbol${modulePart}.`
            : `Symbol from \`${key.package}\`${modulePart}.`;

        return {
            title: key.qualname || key.name,
            summary: summary,
            url: url,
            source: ResolutionSource.DevDocs,
            confidence: 0.3
        };
    }
}
