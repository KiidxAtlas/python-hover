import * as https from 'https';
import { DocKey, HoverDoc, ResolutionSource } from '../../../shared/types';
import { DiskCache } from '../cache/diskCache';

interface PyPiPackageInfo {
    project_urls?: Record<string, unknown>;
    home_page?: string | null;
    summary?: string | null;
    version?: string | null;
    license?: string | null;
    requires_python?: string | null;
}

interface PyPiPackageResponse {
    info?: PyPiPackageInfo | null;
}

function normalizeUrl(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    if (!trimmed) return null;
    return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

function isLikelyRepositoryUrl(value: string | null | undefined): boolean {
    const normalized = normalizeUrl(value);
    if (!normalized) return false;

    try {
        const parsed = new URL(normalized);
        const host = parsed.hostname.toLowerCase();
        const path = parsed.pathname.replace(/\/+$/, '');
        if (!/github\.com$|gitlab\.com$|bitbucket\.org$|codeberg\.org$|sourcehut\.org$/.test(host)) {
            return false;
        }

        const segments = path.split('/').filter(Boolean);
        if (segments.length < 2) {
            return false;
        }

        if (segments[0].startsWith('@')) {
            return segments.length >= 2;
        }

        return true;
    } catch {
        return false;
    }
}

function canonicalizeRepositoryUrl(value: string | null | undefined): string | null {
    const normalized = normalizeUrl(value);
    if (!normalized) return null;

    try {
        const parsed = new URL(normalized);
        const host = parsed.hostname.toLowerCase();
        if (!/github\.com$|gitlab\.com$|bitbucket\.org$|codeberg\.org$|sourcehut\.org$/.test(host)) {
            return normalized;
        }

        const segments = parsed.pathname.split('/').filter(Boolean);
        if (segments.length < 2) {
            return normalized;
        }

        const rootSegments = segments[0].startsWith('@')
            ? segments.slice(0, 2)
            : segments.slice(0, 2);
        parsed.pathname = `/${rootSegments.join('/')}`;
        parsed.search = '';
        parsed.hash = '';
        return parsed.toString().replace(/\/$/, '');
    } catch {
        return normalized;
    }
}

function scoreRepoCandidate(label: string, url: string): number {
    const normalizedUrl = normalizeUrl(url);
    if (!normalizedUrl) return Number.NEGATIVE_INFINITY;

    const lowerLabel = label.toLowerCase();
    let score = 0;

    if (lowerLabel === 'source' || lowerLabel === 'source code' || lowerLabel === 'repository' || lowerLabel === 'code') {
        score += 100;
    }
    if (lowerLabel.includes('source') || lowerLabel.includes('repository') || lowerLabel.includes('github') || lowerLabel.includes('gitlab') || lowerLabel.includes('bitbucket')) {
        score += 70;
    }
    if (lowerLabel.includes('homepage') || lowerLabel === 'home' || lowerLabel === 'home page' || lowerLabel === 'website') {
        score += 15;
    }
    if (lowerLabel.includes('bug') || lowerLabel.includes('issue') || lowerLabel.includes('changelog') || lowerLabel.includes('release')) {
        score -= 40;
    }
    if (isLikelyRepositoryUrl(normalizedUrl)) {
        score += 50;
    }

    return score;
}

/**
 * Pick the best docs/home URL from PyPI `project_urls` + optional home_page.
 * Documentation links are preferred over source repos.
 */
function pickRepoUrlFromLinks(links: Record<string, string>): string | null {
    let bestUrl: string | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const [label, value] of Object.entries(links)) {
        const url = normalizeUrl(value);
        if (!url) continue;
        const score = scoreRepoCandidate(label, url);
        if (score > bestScore) {
            bestScore = score;
            bestUrl = url;
        }
    }

    return bestScore > 0 ? canonicalizeRepositoryUrl(bestUrl) : null;
}

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

    async getPackageMetadata(packageName: string): Promise<{ url: string | null, summary: string | null, links: Record<string, string>, version: string | null, license: string | null, requiresPython: string | null }> {
        const EMPTY = { url: null, summary: null, links: {} as Record<string, string>, version: null, license: null, requiresPython: null };

        if (this.diskCache) {
            const cached = this.diskCache.getCorpusPackageMetadata(packageName);
            if (cached) {
                if (cached.negative) return EMPTY;
                return {
                    url: cached.url ?? null,
                    summary: cached.summary ?? null,
                    links: cached.links ?? {},
                    version: cached.version ?? null,
                    license: cached.license ?? null,
                    requiresPython: cached.requiresPython ?? null,
                };
            }
        }

        try {
            const metadata = await this.fetchJson<PyPiPackageResponse>(`https://pypi.org/pypi/${packageName}/json`);
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

            const version: string | null = typeof info.version === 'string' && info.version.trim()
                ? info.version.trim() : null;
            const rawLicense = typeof info.license === 'string' ? info.license.trim() : '';
            const license: string | null = rawLicense && rawLicense !== 'UNKNOWN' && rawLicense !== 'NOASSERTION'
                ? rawLicense : null;
            const requiresPython: string | null = typeof info.requires_python === 'string' && info.requires_python.trim()
                ? info.requires_python.trim() : null;

            const result = { url: bestUrl, summary, links, version, license, requiresPython };

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

    async getPackageRepoUrl(packageName: string | undefined): Promise<string | null> {
        if (!packageName) return null;

        const cached = this.getCachedRepoUrl(packageName);
        if (cached) {
            return cached;
        }

        const metadata = await this.getPackageMetadata(packageName);
        return pickRepoUrlFromLinks(metadata.links);
    }

    async findDocs(key: DocKey): Promise<HoverDoc | null> {
        const { url, summary, links, version, license, requiresPython } = await this.getPackageMetadata(key.package);
        if (url || summary) {
            return {
                title: key.package,
                summary: summary ?? undefined,
                content: summary ?? undefined,
                url: url ?? undefined,
                links: links,
                latestVersion: version ?? undefined,
                license: license ?? undefined,
                requiresPython: requiresPython ?? undefined,
                source: ResolutionSource.PyPI,
                confidence: 0.7
            };
        }
        return null;
    }

    getCachedRepoUrl(packageName: string | undefined): string | null {
        if (!this.diskCache || !packageName) return null;
        const meta = this.diskCache.getCorpusPackageMetadata(packageName);
        if (!meta?.links) return null;
        return pickRepoUrlFromLinks(meta.links);
    }

    private fetchJson<T>(url: string): Promise<T> {
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
                        resolve(JSON.parse(data) as T);
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
