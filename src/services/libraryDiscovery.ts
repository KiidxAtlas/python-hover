/**
 * Library Discovery Service - Automatically discover documentation for Python libraries
 *
 * Simple, efficient approach:
 * 1. Try PyPI metadata for documentation URLs
 * 2. Try common ReadTheDocs patterns
 * 3. Validate with simple file size check (>1KB = real docs)
 * 4. Cache everything (24 hours)
 */

import { Logger } from './logger';
import { PackageDetector } from './packageDetector';
import { PyPIService } from './pypiService';

export interface DiscoveredLibrary {
    name: string;
    version: string;
    inventoryUrl: string;
    docBaseUrl: string;
    discoveredAt: number;
    source: 'pypi' | 'readthedocs' | 'pattern';
}

export class LibraryDiscovery {
    private logger: Logger;
    private packageDetector: PackageDetector;
    private pypiService: PyPIService;
    private cache: Map<string, DiscoveredLibrary | null> = new Map();
    private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
    private readonly MIN_INVENTORY_SIZE = 1024; // 1KB - real docs are always bigger

    constructor(packageDetector: PackageDetector, pypiService?: PyPIService) {
        this.logger = Logger.getInstance();
        this.packageDetector = packageDetector;
        this.pypiService = pypiService || new PyPIService();
    }

    /**
     * Discover documentation for a library
     */
    public async discoverLibrary(libraryName: string, pythonPath?: string): Promise<DiscoveredLibrary | null> {
        // Skip Python built-in types
        const builtins = ['object', 'str', 'int', 'float', 'list', 'dict', 'tuple', 'set', 'frozenset',
            'bool', 'bytes', 'bytearray', 'type', 'None', 'Exception', 'BaseException'];
        if (builtins.includes(libraryName)) {
            this.logger.debug(`Skipping built-in type: ${libraryName}`);
            return null;
        }

        // Check cache
        const cached = this.cache.get(libraryName);
        if (cached !== undefined) {
            const age = Date.now() - (cached?.discoveredAt || 0);
            if (age < this.CACHE_TTL) {
                this.logger.debug(`Using cached discovery for ${libraryName}`);
                return cached;
            }
        }

        this.logger.info(`Discovering documentation for ${libraryName}`);

        try {
            // 1. Try PyPI metadata first
            const pypiResult = await this.tryPyPI(libraryName);
            if (pypiResult) {
                this.cache.set(libraryName, pypiResult);
                return pypiResult;
            }

            // 2. Try common ReadTheDocs patterns
            const readtheDocsResult = await this.tryReadTheDocs(libraryName);
            if (readtheDocsResult) {
                this.cache.set(libraryName, readtheDocsResult);
                return readtheDocsResult;
            }

            // 3. Not found - cache null to avoid repeated attempts
            this.logger.info(`Could not discover documentation for ${libraryName}`);
            this.cache.set(libraryName, null);
            return null;

        } catch (error) {
            this.logger.debug(`Discovery error for ${libraryName}:`, error as Error);
            this.cache.set(libraryName, null);
            return null;
        }
    }

    /**
     * Try to find documentation from PyPI metadata
     */
    private async tryPyPI(libraryName: string): Promise<DiscoveredLibrary | null> {
        try {
            this.logger.debug(`  📦 Trying PyPI for ${libraryName}...`);
            const info = await this.pypiService.fetchPackageInfo(libraryName);

            if (!info) {
                this.logger.debug(`  ❌ No PyPI info found for ${libraryName}`);
                return null;
            }

            // Collect all possible documentation URLs
            const docUrls: string[] = [];
            if (info.docUrl) {
                docUrls.push(info.docUrl);
            }
            if (info.homeUrl) {
                docUrls.push(info.homeUrl);
            }
            if (info.projectUrls) {
                Object.values(info.projectUrls).forEach(url => {
                    if (url && !docUrls.includes(url)) {
                        docUrls.push(url);
                    }
                });
            }

            this.logger.debug(`  📄 Found ${docUrls.length} doc URL(s) in PyPI metadata`);
            if (docUrls.length > 0) {
                this.logger.debug(`  🔗 URLs: ${docUrls.join(', ')}`);
            }

            for (const url of docUrls) {
                this.logger.debug(`  🔍 Checking ${url}...`);
                const inventoryUrl = await this.findInventory(url);
                if (inventoryUrl) {
                    this.logger.debug(`  ✅ Found ${libraryName} from PyPI: ${inventoryUrl}`);
                    return {
                        name: libraryName,
                        version: info.version,
                        inventoryUrl,
                        docBaseUrl: this.extractBaseUrl(inventoryUrl),
                        discoveredAt: Date.now(),
                        source: 'pypi'
                    };
                }
            }
        } catch (error) {
            this.logger.debug(`  ❌ PyPI lookup failed for ${libraryName}: ${error}`);
        }
        return null;
    }

    /**
     * Try common ReadTheDocs URL patterns
     */
    private async tryReadTheDocs(libraryName: string): Promise<DiscoveredLibrary | null> {
        this.logger.debug(`  📚 Trying ReadTheDocs patterns for ${libraryName}...`);

        // Clean library name for URL (e.g., 'scikit-learn' stays as is, 'beautifulsoup4' → 'beautifulsoup')
        const urlName = libraryName.toLowerCase().replace(/_/g, '-');

        const patterns = [
            // ReadTheDocs patterns
            `https://${urlName}.readthedocs.io/en/stable/objects.inv`,
            `https://${urlName}.readthedocs.io/en/latest/objects.inv`,
            // Common custom domains
            `https://docs.${urlName}.org/en/stable/objects.inv`,
            `https://docs.${urlName}.io/en/stable/objects.inv`,
            `https://${urlName}.org/en/stable/objects.inv`,
            `https://${urlName}.org/objects.inv`,
        ];

        for (const url of patterns) {
            this.logger.debug(`  🔍 Trying: ${url}`);
            if (await this.validateInventory(url)) {
                this.logger.debug(`  ✅ Found ${libraryName} at: ${url}`);
                return {
                    name: libraryName,
                    version: 'latest',
                    inventoryUrl: url,
                    docBaseUrl: this.extractBaseUrl(url),
                    discoveredAt: Date.now(),
                    source: 'readthedocs'
                };
            }
        }

        this.logger.debug(`  ❌ No ReadTheDocs patterns worked for ${libraryName}`);
        return null;
    }

    /**
     * Find objects.inv at a given base URL
     */
    private async findInventory(baseUrl: string): Promise<string | null> {
        const paths = [
            '/objects.inv',
            '/en/stable/objects.inv',
            '/en/latest/objects.inv',
            '/docs/objects.inv',
        ];

        for (const path of paths) {
            const url = baseUrl.replace(/\/$/, '') + path;
            if (await this.validateInventory(url)) {
                return url;
            }
        }

        return null;
    }

    /**
     * Validate that a URL contains a real inventory file
     * Simple check: file size must be > 1KB (placeholders are tiny)
     */
    private async validateInventory(url: string): Promise<boolean> {
        try {
            const response = await fetch(url, {
                method: 'HEAD',
                headers: { 'User-Agent': 'VSCode-Python-Hover-Extension' },
                signal: AbortSignal.timeout(3000)
            });

            if (!response.ok) {
                this.logger.debug(`    ❌ ${url} returned ${response.status}`);
                return false;
            }

            // Check Content-Length header
            const contentLength = response.headers.get('content-length');
            if (contentLength) {
                const size = parseInt(contentLength, 10);
                if (size < this.MIN_INVENTORY_SIZE) {
                    this.logger.debug(`    ❌ ${url}: too small (${size} bytes, need >${this.MIN_INVENTORY_SIZE})`);
                    return false;
                }
                this.logger.debug(`    ✅ ${url}: valid (${size} bytes)`);
            }

            // If no Content-Length, do a partial GET to check
            if (!contentLength) {
                this.logger.debug(`    🔍 No Content-Length, fetching first 2KB...`);
                const getResponse = await fetch(url, {
                    headers: {
                        'User-Agent': 'VSCode-Python-Hover-Extension',
                        'Range': 'bytes=0-2047' // Get first 2KB
                    },
                    signal: AbortSignal.timeout(3000)
                });

                if (!getResponse.ok) {
                    this.logger.debug(`    ❌ GET request failed: ${getResponse.status}`);
                    return false;
                }

                const data = await getResponse.arrayBuffer();
                if (data.byteLength < this.MIN_INVENTORY_SIZE) {
                    this.logger.debug(`    ❌ Too small (${data.byteLength} bytes, need >${this.MIN_INVENTORY_SIZE})`);
                    return false;
                }
                this.logger.debug(`    ✅ Valid (${data.byteLength} bytes fetched)`);
            }

            return true;

        } catch (error) {
            this.logger.debug(`    ❌ Error: ${error}`);
            return false;
        }
    }

    /**
     * Extract base documentation URL from inventory URL
     */
    private extractBaseUrl(inventoryUrl: string): string {
        try {
            const url = new URL(inventoryUrl);
            const pathParts = url.pathname.split('/');
            pathParts.pop(); // Remove 'objects.inv'
            return `${url.origin}${pathParts.join('/')}/`;
        } catch {
            return inventoryUrl;
        }
    }

    /**
     * Clear the discovery cache
     */
    public clearCache(): void {
        this.cache.clear();
        this.logger.info('Discovery cache cleared');
    }

    /**
     * Get cache statistics
     */
    public getCacheStats(): { total: number; successful: number; failed: number } {
        let successful = 0;
        let failed = 0;

        for (const value of this.cache.values()) {
            if (value === null) {
                failed++;
            } else {
                successful++;
            }
        }

        return {
            total: this.cache.size,
            successful,
            failed
        };
    }
}
