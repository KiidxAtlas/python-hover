import * as https from 'https';
import { DocKey, HoverDoc, ResolutionSource } from '../../../shared/types';
import { DiskCache } from '../cache/diskCache';

/**
 * Pick the best docs/home URL from PyPI `project_urls` + optional home_page.
 * Documentation links are preferred over source repos.
 */
function pickBestProjectUrl(links: Record<string, string>, homePage: string | null): string | null {
    const entries = Object.entries(links).filter(([, v]) => typeof v === 'string' && v.trim().length > 0);
    const labelScore = (label: string): number => {
        const l = label.toLowerCase();
        if (l === 'documentation' || l === 'docs') return 0;
        if (l.includes('documentation') || l.includes('doc ') || l === 'doc') return 1;
        if (l.includes('readthedocs') || l.includes('rtd')) return 2;
        if (l.includes('homepage') || l === 'home' || l === 'home page' || l === 'website') return 3;
        if (l.includes('changelog') || l.includes('release')) return 6;
        if (l.includes('repository') || l.includes('source') || l.includes('github') || l.includes('gitlab')) return 8;
        return 5;
    };
    if (entries.length > 0) {
        entries.sort((a, b) => labelScore(a[0]) - labelScore(b[0]) || a[0].localeCompare(b[0]));
        return entries[0][1];
    }
    const h = homePage?.trim();
    return h || null;
}

export class PyPiClient {
    private diskCache: DiskCache | null;

    constructor(diskCache?: DiskCache) {
        this.diskCache = diskCache ?? null;
    }

    async getPackageMetadata(packageName: string): Promise<{ url: string | null, summary: string | null, links: Record<string, string> }> {
        const EMPTY: { url: null, summary: null, links: Record<string, string> } = { url: null, summary: null, links: {} };

        if (this.diskCache) {
            const cached = this.diskCache.getCorpusPackageMetadata(packageName);
            if (cached) {
                if (cached.negative) return EMPTY;
                return {
                    url: cached.url ?? null,
                    summary: cached.summary ?? null,
                    links: cached.links ?? {},
                };
            }
        }

        try {
            const metadata = await this.fetchJson(`https://pypi.org/pypi/${packageName}/json`);
            if (!metadata || !metadata.info) {
                if (this.diskCache) {
                    this.diskCache.setCorpusPackageMetadata(packageName, { negative: true });
                }
                return EMPTY;
            }

            const info = metadata.info;
            const links: Record<string, string> = {};

            if (info.project_urls) {
                for (const [key, value] of Object.entries(info.project_urls)) {
                    if (typeof value === 'string') links[key] = value;
                }
            }

            if (info.home_page && !Object.values(links).includes(info.home_page)) {
                links['Homepage'] = info.home_page;
            }

            // Prefer explicit documentation URLs from PyPI metadata (PEP 621 / core metadata).
            const bestUrl = pickBestProjectUrl(links, typeof info.home_page === 'string' ? info.home_page : null);

            // One-line description from PyPI metadata
            const summary: string | null = (typeof info.summary === 'string' && info.summary.trim())
                ? info.summary.trim()
                : null;

            const result = { url: bestUrl, summary, links };

            if (this.diskCache) {
                if (!bestUrl && !summary) {
                    this.diskCache.setCorpusPackageMetadata(packageName, { negative: true });
                } else {
                    this.diskCache.setCorpusPackageMetadata(packageName, result);
                }
            }

            return result;
        } catch {
            // Treat transport failures as transient so later hovers can retry.
            return EMPTY;
        }
    }

    async getPackageUrl(packageName: string): Promise<string | null> {
        const { url } = await this.getPackageMetadata(packageName);
        return url;
    }

    async findDocs(key: DocKey): Promise<HoverDoc | null> {
        const { url, summary, links } = await this.getPackageMetadata(key.package);
        if (url || summary) {
            return {
                title: key.package,
                summary: summary ?? undefined,
                content: summary ?? undefined,
                url: url ?? undefined,
                links: links,
                source: ResolutionSource.PyPI,
                confidence: 0.7
            };
        }
        return null;
    }

    private fetchJson(url: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const req = https.get(url, { timeout: 5000 }, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Status code: ${res.statusCode}`));
                    return;
                }
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timed out'));
            });

            req.on('error', reject);
        });
    }
}
