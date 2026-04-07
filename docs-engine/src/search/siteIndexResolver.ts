import { createHash } from 'crypto';
import * as https from 'https';
import { Logger } from '../../../extension/src/logger';
import { DocKey, HoverDoc, ResolutionSource } from '../../../shared/types';
import { DiskCache } from '../cache/diskCache';

type SiteIndexEntry = {
    title: string;
    url: string;
    summary?: string;
    kind?: string;
    symbolName?: string;
    provider: 'mkdocs' | 'sphinx';
};

type SphinxSearchIndex = {
    docnames?: string[];
    filenames?: string[];
    titles?: string[];
    objects?: Record<string, Record<string, unknown>>;
};

const INDEX_REQUEST_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; PyHover/0.7; +https://github.com/KiidxAtlas/python-hover)',
    'Accept': 'application/json,text/javascript,*/*',
};

export class SiteIndexResolver {
    private readonly memoryCache = new Map<string, SiteIndexEntry[] | null>();
    private readonly inflight = new Map<string, Promise<SiteIndexEntry[] | null>>();

    constructor(
        private readonly diskCache: DiskCache,
        private readonly timeout: number = 5000,
    ) { }

    async resolve(key: DocKey, baseUrl: string): Promise<HoverDoc | null> {
        const entries = await this.loadEntries(baseUrl);
        if (!entries || entries.length === 0) {
            return null;
        }

        const best = this.pickBestEntry(entries, key);
        if (!best) {
            return null;
        }

        return {
            title: best.symbolName || best.title || key.qualname || key.name,
            kind: best.kind,
            summary: best.summary,
            url: best.url,
            source: ResolutionSource.SearchIndex,
            confidence: 0.78,
            module: key.module || key.package,
            metadata: {
                docsProvider: best.provider,
            },
        };
    }

    private async loadEntries(baseUrl: string): Promise<SiteIndexEntry[] | null> {
        const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
        const cached = this.memoryCache.get(normalizedBaseUrl);
        if (cached !== undefined) {
            return cached;
        }

        const inflight = this.inflight.get(normalizedBaseUrl);
        if (inflight) {
            return inflight;
        }

        const loader = this.loadEntriesUncached(normalizedBaseUrl);
        this.inflight.set(normalizedBaseUrl, loader);

        try {
            const entries = await loader;
            this.memoryCache.set(normalizedBaseUrl, entries);
            return entries;
        } finally {
            this.inflight.delete(normalizedBaseUrl);
        }
    }

    private async loadEntriesUncached(baseUrl: string): Promise<SiteIndexEntry[] | null> {
        const cacheKey = this.cacheKey(baseUrl);
        const negativeKey = `${cacheKey}:negative`;

        const cached = this.diskCache.get(cacheKey);
        if (cached) {
            try {
                return JSON.parse(cached) as SiteIndexEntry[];
            } catch {
                Logger.log(`SiteIndexResolver: failed to parse cached index for ${baseUrl}`);
            }
        }

        if (this.diskCache.get(negativeKey)) {
            return null;
        }

        const mkdocsUrl = `${baseUrl}/search/search_index.json`;
        try {
            const mkdocsBody = await this.fetchText(mkdocsUrl);
            const mkdocsEntries = this.parseMkDocsIndex(mkdocsBody, baseUrl);
            if (mkdocsEntries.length > 0) {
                this.diskCache.set(cacheKey, JSON.stringify(mkdocsEntries));
                return mkdocsEntries;
            }
        } catch {
            // Try Sphinx next.
        }

        const sphinxUrl = `${baseUrl}/searchindex.js`;
        try {
            const sphinxBody = await this.fetchText(sphinxUrl);
            const sphinxEntries = this.parseSphinxIndex(sphinxBody, baseUrl);
            if (sphinxEntries.length > 0) {
                this.diskCache.set(cacheKey, JSON.stringify(sphinxEntries));
                return sphinxEntries;
            }
        } catch {
            // Negative-cache below.
        }

        this.diskCache.set(negativeKey, '1');
        return null;
    }

    private cacheKey(baseUrl: string): string {
        const hash = createHash('sha256').update(baseUrl).digest('hex').slice(0, 16);
        return `site-index:${hash}`;
    }

    private parseMkDocsIndex(text: string, baseUrl: string): SiteIndexEntry[] {
        const parsed = JSON.parse(text) as { docs?: Array<{ location?: string; title?: string; text?: string }> };
        const docs = Array.isArray(parsed.docs) ? parsed.docs : [];
        const entries = docs
            .map<SiteIndexEntry | null>(doc => {
                const location = doc.location?.trim();
                if (!location) {return null;}
                const title = doc.title?.trim() || location;
                return {
                    title,
                    url: new URL(location, this.withTrailingSlash(baseUrl)).toString(),
                    summary: this.sanitizeSummary(doc.text),
                    kind: this.inferKindFromTitle(title),
                    symbolName: this.extractSymbolName(title),
                    provider: 'mkdocs',
                };
            })
            .filter((entry): entry is SiteIndexEntry => entry !== null);
        return entries;
    }

    private parseSphinxIndex(text: string, baseUrl: string): SiteIndexEntry[] {
        const json = this.extractSphinxJson(text);
        if (!json) {return [];}

        const parsed = JSON.parse(json) as SphinxSearchIndex;
        const filenames = Array.isArray(parsed.filenames) ? parsed.filenames : [];
        const titles = Array.isArray(parsed.titles) ? parsed.titles : [];
        const entries: SiteIndexEntry[] = [];

        for (let index = 0; index < filenames.length; index++) {
            const filename = filenames[index];
            if (!filename) {continue;}
            entries.push({
                title: titles[index] || filename,
                url: new URL(filename, this.withTrailingSlash(baseUrl)).toString(),
                summary: undefined,
                kind: 'module',
                provider: 'sphinx',
            });
        }

        const objects = parsed.objects ?? {};
        for (const [prefix, value] of Object.entries(objects)) {
            if (!value || typeof value !== 'object') {continue;}
            for (const [name, rawMeta] of Object.entries(value as Record<string, unknown>)) {
                if (!Array.isArray(rawMeta) || rawMeta.length === 0) {continue;}
                const docIndex = typeof rawMeta[0] === 'number' ? rawMeta[0] : Number(rawMeta[0]);
                if (!Number.isInteger(docIndex) || docIndex < 0 || docIndex >= filenames.length) {continue;}

                const filename = filenames[docIndex];
                if (!filename) {continue;}

                const anchor = typeof rawMeta[3] === 'string' && rawMeta[3] && rawMeta[3] !== '-'
                    ? `#${rawMeta[3]}`
                    : '';
                const symbolName = prefix ? `${prefix}.${name}` : name;
                entries.push({
                    title: symbolName,
                    symbolName,
                    url: new URL(`${filename}${anchor}`, this.withTrailingSlash(baseUrl)).toString(),
                    summary: undefined,
                    kind: this.inferSphinxKind(rawMeta[1]),
                    provider: 'sphinx',
                });
            }
        }

        return this.dedupeEntries(entries);
    }

    private extractSphinxJson(text: string): string | null {
        const trimmed = text.trim();
        const open = trimmed.indexOf('{');
        const close = trimmed.lastIndexOf('}');
        if (open === -1 || close === -1 || close <= open) {
            return null;
        }
        return trimmed.slice(open, close + 1);
    }

    private inferSphinxKind(rawType: unknown): string | undefined {
        if (typeof rawType !== 'string') {return undefined;}
        const normalized = rawType.toLowerCase();
        if (normalized.includes('class')) {return 'class';}
        if (normalized.includes('function')) {return 'function';}
        if (normalized.includes('method')) {return 'method';}
        if (normalized.includes('module')) {return 'module';}
        if (normalized.includes('attribute') || normalized.includes('property')) {return 'attribute';}
        return undefined;
    }

    private dedupeEntries(entries: SiteIndexEntry[]): SiteIndexEntry[] {
        const seen = new Set<string>();
        const deduped: SiteIndexEntry[] = [];
        for (const entry of entries) {
            const key = `${entry.title}|${entry.url}`;
            if (seen.has(key)) {continue;}
            seen.add(key);
            deduped.push(entry);
        }
        return deduped;
    }

    private pickBestEntry(entries: SiteIndexEntry[], key: DocKey): SiteIndexEntry | null {
        const ranked = entries
            .map(entry => ({ entry, score: this.scoreEntry(entry, key) }))
            .filter(result => result.score > 0)
            .sort((a, b) => b.score - a.score || a.entry.title.length - b.entry.title.length);

        return ranked[0]?.entry ?? null;
    }

    private scoreEntry(entry: SiteIndexEntry, key: DocKey): number {
        const title = entry.title.toLowerCase();
        const symbolName = entry.symbolName?.toLowerCase();
        const summary = entry.summary?.toLowerCase() || '';
        const qualname = (key.qualname || key.name).toLowerCase();
        const fullName = key.name.toLowerCase();
        const leaf = qualname.split('.').pop() || qualname;
        const moduleName = key.module.toLowerCase();
        const packageName = key.package.toLowerCase();
        let score = 0;

        if (symbolName === fullName || symbolName === qualname) {score = Math.max(score, 1000);}
        if (title === fullName || title === qualname) {score = Math.max(score, 960);}
        if (symbolName === `${moduleName}.${leaf}`) {score = Math.max(score, 920);}
        if (title === `${moduleName}.${leaf}`) {score = Math.max(score, 880);}
        if (symbolName === leaf || title === leaf) {score = Math.max(score, 820);}
        if (leaf && (symbolName?.endsWith(`.${leaf}`) || title.endsWith(`.${leaf}`))) {score = Math.max(score, 720);}
        if (qualname === packageName && (title === packageName || symbolName === packageName)) {score = Math.max(score, 900);}
        if (title.includes(qualname)) {score = Math.max(score, 680);}
        if (summary.includes(qualname)) {score = Math.max(score, 580);}
        if (title.includes(leaf)) {score = Math.max(score, 520);}
        if (summary.includes(leaf)) {score = Math.max(score, 420);}
        if (moduleName && title.includes(moduleName) && (title.includes(leaf) || summary.includes(leaf))) {
            score += 40;
        }
        if (packageName && entry.url.toLowerCase().includes(`/${packageName}`)) {
            score += 20;
        }

        return score;
    }

    private sanitizeSummary(text?: string): string | undefined {
        const cleaned = text
            ?.replace(/\s+/g, ' ')
            .trim();
        if (!cleaned) {return undefined;}
        return cleaned.length > 320 ? `${cleaned.slice(0, 317).trimEnd()}...` : cleaned;
    }

    private inferKindFromTitle(title: string): string | undefined {
        const normalized = title.trim();
        if (!normalized) {return undefined;}
        if (/\bmodule\b/i.test(normalized)) {return 'module';}
        if (/^[A-Z][A-Za-z0-9_]+(?:\.[A-Z][A-Za-z0-9_]+)*$/.test(normalized)) {return 'class';}
        if (/\(\)$/.test(normalized) || /\bfunction\b/i.test(normalized)) {return 'function';}
        return undefined;
    }

    private extractSymbolName(title: string): string | undefined {
        const normalized = title.trim();
        if (!normalized) {return undefined;}
        const codeMatch = /`([^`]+)`/.exec(normalized);
        if (codeMatch) {return codeMatch[1];}
        const leadingWord = /^([A-Za-z_][\w.]+)/.exec(normalized);
        return leadingWord?.[1];
    }

    private withTrailingSlash(url: string): string {
        return url.endsWith('/') ? url : `${url}/`;
    }

    private fetchText(url: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const req = https.get(url, { timeout: this.timeout, headers: INDEX_REQUEST_HEADERS }, (res) => {
                if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    const redirectUrl = new URL(res.headers.location, url).toString();
                    this.fetchText(redirectUrl).then(resolve).catch(reject);
                    return;
                }

                if (res.statusCode !== 200) {
                    reject(new Error(`Status code ${res.statusCode}`));
                    return;
                }

                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
                res.on('error', reject);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timed out'));
            });
            req.on('error', reject);
        });
    }
}
