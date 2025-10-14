/**
 * PyPI Service - Single source of truth for PyPI API interactions
 *
 * Responsibilities:
 * - Fetch package information from PyPI
 * - Extract documentation URLs from package metadata
 * - Parse PyPI JSON responses
 * - Cache PyPI requests
 *
 * @author KiidxAtlas
 * @copyright 2025 KiidxAtlas
 * @license MIT
 */

import { Logger } from './logger';

export interface PyPIPackageInfo {
    name: string;
    version: string;
    summary: string;
    author?: string;
    license?: string;
    requires_python?: string;
    docUrl?: string;
    homeUrl?: string;
    projectUrls?: Record<string, string>;
}

export class PyPIService {
    private logger: Logger;
    private cache: Map<string, { data: PyPIPackageInfo | null; timestamp: number }>;
    private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
    private readonly REQUEST_TIMEOUT = 5000; // 5 seconds

    constructor() {
        this.logger = Logger.getInstance();
        this.cache = new Map();
    }

    /**
     * Fetch complete package information from PyPI
     */
    public async fetchPackageInfo(packageName: string): Promise<PyPIPackageInfo | null> {
        // Check cache first
        const cached = this.cache.get(packageName);
        if (cached) {
            const age = Date.now() - cached.timestamp;
            if (age < this.CACHE_TTL) {
                this.logger.debug(`📦 Using cached PyPI data for ${packageName} (age: ${Math.round(age / 1000)}s)`);
                return cached.data;
            }
        }

        try {
            this.logger.debug(`📦 Fetching PyPI info for ${packageName}...`);

            const response = await fetch(`https://pypi.org/pypi/${packageName}/json`, {
                headers: { 'User-Agent': 'VSCode-Python-Hover-Extension' },
                signal: AbortSignal.timeout(this.REQUEST_TIMEOUT)
            });

            if (!response.ok) {
                this.logger.debug(`❌ PyPI returned ${response.status} for ${packageName}`);
                this.cache.set(packageName, { data: null, timestamp: Date.now() });
                return null;
            }

            const data: any = await response.json();
            const packageInfo = this.parsePackageInfo(packageName, data);

            // Cache the result
            this.cache.set(packageName, { data: packageInfo, timestamp: Date.now() });

            if (packageInfo) {
                this.logger.debug(`✅ Got PyPI info for ${packageName}: "${packageInfo.summary?.substring(0, 50)}..."${packageInfo.docUrl ? ` (${packageInfo.docUrl})` : ''}`);
            }

            return packageInfo;

        } catch (error) {
            this.logger.debug(`Failed to fetch PyPI info for ${packageName}:`, error as Error);
            this.cache.set(packageName, { data: null, timestamp: Date.now() });
            return null;
        }
    }

    /**
     * Get just the package summary (convenience method)
     */
    public async fetchSummary(packageName: string): Promise<string | null> {
        const info = await this.fetchPackageInfo(packageName);
        return info?.summary || null;
    }

    /**
     * Get just the documentation URL (convenience method)
     */
    public async fetchDocUrl(packageName: string): Promise<string | null> {
        const info = await this.fetchPackageInfo(packageName);
        return info?.docUrl || null;
    }

    /**
     * Parse PyPI JSON response into structured package info
     */
    private parsePackageInfo(packageName: string, data: any): PyPIPackageInfo | null {
        try {
            const info = data.info;
            if (!info) {
                return null;
            }

            const summary = info.summary || '';
            const version = info.version || 'unknown';
            const author = info.author || info.author_email?.split('<')[0].trim();
            const license = info.license;
            const requires_python = info.requires_python;

            // Extract all project URLs
            const projectUrls = info.project_urls || {};

            // Try to find documentation URL with multiple fallback strategies
            const docUrl = this.extractDocumentationUrl(projectUrls, info);

            // Try to find home page URL
            const homeUrl = info.home_page ||
                projectUrls.Homepage ||
                projectUrls.homepage ||
                projectUrls['Home Page'] ||
                info.project_url;

            // Only return if we have at least a summary
            if (summary && summary.length > 10) {
                return {
                    name: packageName,
                    version,
                    summary,
                    author,
                    license,
                    requires_python,
                    docUrl,
                    homeUrl,
                    projectUrls
                };
            }

            return null;
        } catch (error) {
            this.logger.debug(`Error parsing PyPI data for ${packageName}:`, error as Error);
            return null;
        }
    }

    /**
     * Extract documentation URL from project URLs with intelligent fallback
     */
    private extractDocumentationUrl(projectUrls: Record<string, string>, info: any): string | undefined {
        // Try exact matches first (case-insensitive)
        const docKeys = [
            'Documentation',
            'Docs',
            'documentation',
            'docs',
            'Read the Docs',
            'ReadTheDocs',
            'readthedocs'
        ];

        for (const key of docKeys) {
            if (projectUrls[key]) {
                return projectUrls[key];
            }
        }

        // Try partial matches
        for (const [key, url] of Object.entries(projectUrls)) {
            const lowerKey = key.toLowerCase();
            if (lowerKey.includes('doc') || lowerKey.includes('manual') || lowerKey.includes('guide')) {
                return url;
            }
        }

        // Fallback to info fields
        return info.docs_url || info.project_url;
    }

    /**
     * Clear the cache (useful for testing or when packages are updated)
     */
    public clearCache(): void {
        this.cache.clear();
        this.logger.debug('PyPI cache cleared');
    }

    /**
     * Get cache statistics
     */
    public getCacheStats(): { size: number; keys: string[] } {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}
