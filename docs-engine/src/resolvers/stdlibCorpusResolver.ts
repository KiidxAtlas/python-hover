/**
 * Resolves symbols using the prebuilt stdlib documentation corpus,
 * scraped from docs.python.org at build time.
 *
 * All content originates from official Python documentation —
 * nothing is repo-authored.
 *
 * Third-party package content is handled dynamically via the
 * inventory + background scrape + disk cache pipeline in DocResolver.
 */

import { DocKey, HoverDoc, ResolutionSource } from '../../../shared/types';
import { STDLIB_CORPUS, StdlibCorpusEntry } from '../../data/stdlibCorpus';

export class StdlibCorpusResolver {
    private pythonVersion = '3';

    setPythonVersion(version: string) {
        this.pythonVersion = version;
    }

    /**
     * Look up a symbol in the prebuilt stdlib corpus.
     *
     * Returns a HoverDoc with pre-extracted summary, content, and signature
     * from docs.python.org — no network calls needed.
     *
     * Returns null if the symbol is not in the corpus, in which case
     * the caller should fall through to dynamic resolution.
     */
    resolve(key: DocKey): HoverDoc | null {
        // Try exact qualname first (e.g., "functools.lru_cache")
        let entry: StdlibCorpusEntry | null = STDLIB_CORPUS[key.qualname || ''] || null;

        // Try module.name (e.g., "json.dumps")
        if (!entry && key.module && key.name) {
            entry = STDLIB_CORPUS[`${key.module}.${key.name}`] || null;
        }

        // Try bare name (e.g., "print", "None", "TypeError")
        if (!entry && key.name) {
            entry = STDLIB_CORPUS[key.name] || null;
        }

        if (!entry || (!entry.summary && !entry.content)) {
            return null;
        }

        // Rewrite the URL to use the user's configured Python version
        let url = entry.url;
        if (url && this.pythonVersion !== '3') {
            url = url.replace(/\/3\.\d+\//, `/${this.pythonVersion}/`);
        }

        return {
            title: key.name,
            summary: entry.summary || undefined,
            content: entry.content || undefined,
            signature: entry.signature || undefined,
            url,
            seeAlso: entry.seeAlso,
            source: ResolutionSource.Corpus,
            confidence: 1.0,
            module: key.module || key.package,
        };
    }
}
