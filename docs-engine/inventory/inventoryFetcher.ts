import * as https from 'https';
import { Logger } from '../../extension/src/logger';
import { DocKey, HoverDoc } from '../../shared/types';
import { PyPiClient } from '../pypi/pypiClient';
import { DiskCache } from '../src/cache/diskCache';
import { InventoryParser } from './inventoryParser';

export class InventoryFetcher {
    private parser: InventoryParser;
    private pypiClient: PyPiClient;
    private cache: Map<string, Map<string, HoverDoc>>; // Map<Package, Map<Symbol, Doc>>
    private packageBaseUrls: Map<string, string>; // Cache for resolved base URLs
    private diskCache: DiskCache;
    private pythonVersion: string;
    private allowNetwork: boolean;

    constructor(diskCache: DiskCache, pythonVersion: string = '3', customLibraries: any[] = [], allowNetwork: boolean = true) {
        this.parser = new InventoryParser();
        this.pypiClient = new PyPiClient();
        this.cache = new Map();
        this.packageBaseUrls = new Map();
        this.diskCache = diskCache;
        this.pythonVersion = pythonVersion;
        this.allowNetwork = allowNetwork;

        // Initialize custom libraries
        for (const lib of customLibraries) {
            if (lib.name && lib.baseUrl) {
                this.packageBaseUrls.set(lib.name, lib.baseUrl);
                // We might also want to store the inventory URL if it's different from standard probing
                // But for now, base URL is a good start.
                // Ideally we should have a way to force inventory URL.
            }
        }
    }

    public setPythonVersion(version: string) {
        this.pythonVersion = version;
    }

    /**
     * Normalize a URL to use HTTPS protocol.
     * VS Code Remote environments require HTTPS connections.
     */
    private normalizeToHttps(url: string): string {
        if (url.startsWith('http://')) {
            return url.replace('http://', 'https://');
        }
        return url;
    }

    private async resolveBaseUrl(packageName: string, version?: string, isStdlib?: boolean): Promise<string> {
        // 1. Stdlib
        if (isStdlib || packageName === 'builtins' || packageName === 'python') {
            return `https://docs.python.org/${this.pythonVersion}`;
        }

        // 2. Check cache
        if (this.packageBaseUrls.has(packageName)) {
            return this.packageBaseUrls.get(packageName)!;
        }

        // 3. Dynamic PyPI Lookup + Probing
        const pypiUrl = await this.pypiClient.getPackageUrl(packageName);
        if (pypiUrl) {
            // Remove trailing slash and normalize to HTTPS
            const cleanUrl = this.normalizeToHttps(pypiUrl.replace(/\/$/, ''));

            // Probe common inventory locations
            const candidates = [
                `${cleanUrl}/objects.inv`,
                `${cleanUrl}/docs/objects.inv`,
                `${cleanUrl}/en/stable/objects.inv`,
                `${cleanUrl}/en/latest/objects.inv`,
                `${cleanUrl}/api/objects.inv`,
                // Common for numpy/scipy/matplotlib
                `${cleanUrl}/doc/stable/objects.inv`,
                `${cleanUrl}/doc/objects.inv`,
                `${cleanUrl}/stable/objects.inv`,
            ];

            for (const url of candidates) {
                if (await this.checkUrlExists(url)) {
                    const baseUrl = url.replace('/objects.inv', '');
                    this.packageBaseUrls.set(packageName, baseUrl);
                    return baseUrl;
                }
            }

            // If probing failed but we have a URL, maybe it's just the base?
            // But we need objects.inv.
            // Fallthrough to RTD.
        }

        // 5. ReadTheDocs Fallback
        const versionSegment = version ? version : 'latest';
        return `https://${packageName}.readthedocs.io/en/${versionSegment}`;
    }

    private checkUrlExists(url: string): Promise<boolean> {
        // Ensure URL uses HTTPS (required for VS Code Remote environments)
        const httpsUrl = this.normalizeToHttps(url);

        return new Promise((resolve) => {
            const req = https.request(httpsUrl, { method: 'HEAD', timeout: 5000 }, (res) => {
                // Accept 200 OK or 3xx Redirects (which fetchBuffer handles)
                if (res.statusCode && (res.statusCode === 200 || (res.statusCode >= 300 && res.statusCode < 400))) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });
            req.on('error', () => resolve(false));
            req.end();
        });
    }

    async findInInventory(key: DocKey): Promise<HoverDoc | null> {
        const packageName = key.package;

        // 1. Check in-memory cache
        if (!this.cache.has(packageName)) {
            await this.loadInventory(packageName, key.version, key.isStdlib);
        }

        const packageInventory = this.cache.get(packageName);
        if (packageInventory) {
            // Strategy 1: Exact match on qualname (e.g. "DataFrame" -> "DataFrame")
            if (packageInventory.has(key.qualname)) {
                return packageInventory.get(key.qualname)!;
            }

            // Strategy 2: Module + Qualname (e.g. "pandas.DataFrame")
            const moduleQualname = `${key.module}.${key.qualname}`;
            if (packageInventory.has(moduleQualname)) {
                return packageInventory.get(moduleQualname)!;
            }

            // Strategy 3: Name as provided (e.g. "pandas.DataFrame")
            if (packageInventory.has(key.name)) {
                return packageInventory.get(key.name)!;
            }

            // Strategy 4: Strip 'builtins.' prefix for builtins package
            // Python docs usually index 'str', 'int', 'len' directly, not 'builtins.str'
            if (packageName === 'builtins') {
                const simpleName = key.qualname.replace(/^builtins\./, '');
                if (packageInventory.has(simpleName)) {
                    return packageInventory.get(simpleName)!;
                }

                // Also try without any prefix if name has one
                const nameSimple = key.name.replace(/^builtins\./, '');
                if (packageInventory.has(nameSimple)) {
                    return packageInventory.get(nameSimple)!;
                }
            }
        }

        return null;
    }

    private async loadInventory(packageName: string, version?: string, isStdlib?: boolean): Promise<void> {
        const cacheKey = `inventory:${packageName}:${version || 'latest'}`;

        // 1. Try Disk Cache
        const cached = this.diskCache.get(cacheKey);
        if (cached) {
            try {
                const data = JSON.parse(cached);
                const inventory = new Map<string, HoverDoc>(Object.entries(data));
                this.cache.set(packageName, inventory);
                Logger.log(`Loaded inventory for ${packageName} from disk cache`);
                return;
            } catch (e) {
                Logger.log(`Failed to parse cached inventory for ${packageName}`);
            }
        }

        // 2. Fetch from Network
        if (!this.allowNetwork) {
            Logger.log(`Network disabled, skipping inventory fetch for ${packageName}`);
            this.cache.set(packageName, new Map());
            return;
        }

        const baseUrl = await this.resolveBaseUrl(packageName, version, isStdlib);
        const inventoryUrl = `${baseUrl}/objects.inv`;

        try {
            const buffer = await this.fetchBuffer(inventoryUrl);
            const inventory = this.parser.parse(buffer, baseUrl);
            this.cache.set(packageName, inventory);
            Logger.log(`Loaded inventory for ${packageName}: ${inventory.size} items`);

            // 3. Save to Disk Cache
            const obj = Object.fromEntries(inventory);
            this.diskCache.set(cacheKey, JSON.stringify(obj));
        } catch (e) {
            Logger.log(`Failed to load inventory for ${packageName} from ${inventoryUrl}: ${e}`);
            // Mark as empty to avoid repeated failures
            this.cache.set(packageName, new Map());
        }
    }

    private fetchBuffer(url: string, redirectCount = 0): Promise<Buffer> {
        if (redirectCount > 5) {
            return Promise.reject(new Error('Too many redirects'));
        }

        // Ensure URL uses HTTPS (required for VS Code Remote environments)
        const httpsUrl = this.normalizeToHttps(url);

        return new Promise((resolve, reject) => {
            const req = https.get(httpsUrl, { timeout: 5000 }, (res) => {
                if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    // Normalize redirect URL to HTTPS as well
                    const newUrl = this.normalizeToHttps(new URL(res.headers.location, httpsUrl).toString());
                    Logger.log(`Following redirect for ${httpsUrl} to ${newUrl}`);
                    this.fetchBuffer(newUrl, redirectCount + 1).then(resolve).catch(reject);
                    return;
                }

                if (res.statusCode !== 200) {
                    reject(new Error(`Status code: ${res.statusCode}`));
                    return;
                }

                const chunks: Buffer[] = [];
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => resolve(Buffer.concat(chunks)));
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
