import { DocKey, HoverDoc, ResolutionSource } from '../../../shared/types';

/**
 * Maps Python package names to their DevDocs doc-set names.
 *
 * DevDocs scoped search format: `#q=docset_name search_term`
 * This limits the search to ONLY that doc set — no cross-language results.
 *
 * To add a new package: find its doc-set name at https://devdocs.io (the
 * slug that appears in the URL when you browse that package's docs).
 */
const DEVDOCS_DOC_SETS: Record<string, string> = {
    // Scientific stack
    'numpy': 'numpy',
    'pandas': 'pandas',
    'scipy': 'scipy',
    'matplotlib': 'matplotlib',
    'scikit-learn': 'scikit_learn',
    'sklearn': 'scikit_learn',
    // Web frameworks
    'flask': 'flask',
    'django': 'django',
    'fastapi': 'fastapi',
    // ML / DL
    'tensorflow': 'tensorflow',
    'torch': 'pytorch',
    'pytorch': 'pytorch',
    // Data / DB
    'sqlalchemy': 'sqlalchemy',
    'redis': 'redis',
    // HTTP
    'requests': 'requests',
    'httpx': 'httpx',
    'aiohttp': 'aiohttp',
    // Async
    'asyncio': 'python~3',   // stdlib module — scope to Python docs
    // DOM / HTML parsing
    'bs4': 'beautiful_soup',
    'beautifulsoup4': 'beautiful_soup',
    'lxml': 'lxml',
    // Typing / runtime
    'pydantic': 'pydantic',
    'attrs': 'attrs',
};

export class SearchFallback {
    /**
     * Returns a DevDocs URL that is scoped to a single documentation set.
     *
     * Format:  https://devdocs.io/#q=<docset> <term>
     *
     * DevDocs treats `<docset> <term>` (docset name + space + term) as a
     * single-documentation search — identical to typing the docset name and
     * pressing Tab in the DevDocs UI.  This prevents cross-language results
     * (e.g. Haxe's Python-target API docs) from appearing.
     *
     * stdlib  → scoped to `python~3`
     * known 3rd-party → scoped to its registered DevDocs doc-set name
     * unknown 3rd-party → unscoped search (symbol name only)
     */
    getDevDocsUrl(key: DocKey): string | null {
        const cleanName = (key.qualname || key.name).replace(/^builtins\./, '');
        const leafTerm = cleanName.split('.').slice(-2).join('.') || cleanName;

        // ── stdlib / builtins ─────────────────────────────────────────────
        if (key.isStdlib || !key.package || key.package === 'builtins') {
            return `https://devdocs.io/#q=${encodeURIComponent(`python~3 ${leafTerm}`)}`;
        }

        // ── known third-party ─────────────────────────────────────────────
        const docSet = DEVDOCS_DOC_SETS[key.package.toLowerCase()];
        if (docSet) {
            return `https://devdocs.io/#q=${encodeURIComponent(`${docSet} ${leafTerm}`)}`;
        }

        // ── unknown third-party ───────────────────────────────────────────
        // No registered doc set — use an unscoped DevDocs search so the button
        // still resolves to something useful.
        return `https://devdocs.io/#q=${encodeURIComponent(leafTerm)}`;
    }

    async search(key: DocKey): Promise<HoverDoc> {
        const devdocsUrl = this.getDevDocsUrl(key);

        // For stdlib symbols, construct the module page URL so the hover always
        // shows a working Docs link even when the Sphinx inventory fails to load.
        let url: string | undefined;
        if (key.isStdlib && key.module && key.module !== 'builtins') {
            const topModule = key.module.split('.')[0];
            url = `https://docs.python.org/3/library/${topModule}.html`;
        }

        return {
            title: key.qualname || key.name,
            url,
            devdocsUrl: devdocsUrl ?? undefined,
            source: ResolutionSource.DevDocs,
            confidence: 0.3
        };
    }
}
