import * as https from 'https';
import { DocKey, HoverDoc, ResolutionSource } from '../../../shared/types';
import { DiskCache } from '../cache/diskCache';

export class PyPiClient {
    private diskCache: DiskCache | null;

    constructor(diskCache?: DiskCache) {
        this.diskCache = diskCache ?? null;
    }

    async getPackageMetadata(packageName: string): Promise<{ url: string | null, summary: string | null, links: Record<string, string> }> {
        const EMPTY: { url: null, summary: null, links: Record<string, string> } = { url: null, summary: null, links: {} };

        // Check disk cache — positive results under 'pypi:', negative under 'pypi-negative:'
        if (this.diskCache) {
            const negative = this.diskCache.get(`pypi-negative:${packageName}`);
            if (negative) return EMPTY;

            const cached = this.diskCache.get(`pypi:${packageName}`);
            if (cached) {
                try { return JSON.parse(cached); } catch { /* stale/corrupt — refetch */ }
            }
        }

        try {
            const metadata = await this.fetchJson(`https://pypi.org/pypi/${packageName}/json`);
            if (!metadata || !metadata.info) {
                // Cache the miss so we don't query PyPI on every hover for unknown packages
                if (this.diskCache) this.diskCache.set(`pypi-negative:${packageName}`, '1');
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

            // Determine best URL for "url" field
            let bestUrl: string | null = null;
            const docKey = Object.keys(links).find(k => k.toLowerCase() === 'documentation');
            if (docKey) {
                bestUrl = links[docKey];
            } else if (info.home_page) {
                bestUrl = info.home_page;
            } else if (Object.keys(links).length > 0) {
                bestUrl = Object.values(links)[0];
            }

            // One-line description from PyPI metadata
            const summary: string | null = (typeof info.summary === 'string' && info.summary.trim())
                ? info.summary.trim()
                : null;

            const result = { url: bestUrl, summary, links };

            if (this.diskCache) {
                if (!bestUrl && !summary) {
                    // Package exists on PyPI but has no useful docs — treat as negative
                    this.diskCache.set(`pypi-negative:${packageName}`, '1');
                } else {
                    this.diskCache.set(`pypi:${packageName}`, JSON.stringify(result));
                }
            }

            return result;
        } catch {
            // Network error or 404 — cache as negative so we don't retry on every hover
            if (this.diskCache) this.diskCache.set(`pypi-negative:${packageName}`, '1');
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
