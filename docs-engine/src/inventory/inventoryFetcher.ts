import * as https from 'https';
import { Logger } from '../../../extension/src/logger';
import { DocKey, HoverDoc } from '../../../shared/types';
import { DiskCache } from '../cache/diskCache';
import { PyPiClient } from '../pypi/pypiClient';
import { InventoryParser } from './inventoryParser';

/**
 * Pre-verified Sphinx documentation base URLs for popular packages.
 * Skips PyPI lookup + HEAD probe for these, giving instant inventory resolution.
 * Format: packageName → base URL (without trailing slash, without /objects.inv).
 */
const KNOWN_DOCS_URLS: Record<string, string> = {
    // Scientific / data
    'numpy': 'https://numpy.org/doc/stable',
    'pandas': 'https://pandas.pydata.org/docs',
    'scipy': 'https://docs.scipy.org/doc/scipy',
    'matplotlib': 'https://matplotlib.org/stable',
    'seaborn': 'https://seaborn.pydata.org',
    'statsmodels': 'https://www.statsmodels.org/stable',
    'sympy': 'https://docs.sympy.org/latest',
    'networkx': 'https://networkx.org/documentation/stable',
    'pillow': 'https://pillow.readthedocs.io/en/stable',
    'pil': 'https://pillow.readthedocs.io/en/stable',
    // ML / AI
    'sklearn': 'https://scikit-learn.org/stable',
    'scikit-learn': 'https://scikit-learn.org/stable',
    'torch': 'https://pytorch.org/docs/stable',
    'tensorflow': 'https://www.tensorflow.org/api_docs/python',
    'keras': 'https://keras.io/api',
    'xgboost': 'https://xgboost.readthedocs.io/en/stable',
    'lightgbm': 'https://lightgbm.readthedocs.io/en/stable',
    // Web frameworks
    'flask': 'https://flask.palletsprojects.com/en/latest',
    'django': 'https://docs.djangoproject.com/en/stable',
    'fastapi': 'https://fastapi.tiangolo.com',
    'starlette': 'https://www.starlette.io',
    'aiohttp': 'https://docs.aiohttp.org/en/stable',
    'tornado': 'https://www.tornadoweb.org/en/stable',
    // HTTP / networking
    'requests': 'https://requests.readthedocs.io/en/latest',
    'httpx': 'https://www.python-httpx.org',
    'urllib3': 'https://urllib3.readthedocs.io/en/stable',
    // Data validation / settings
    'pydantic': 'https://docs.pydantic.dev/latest',
    'attrs': 'https://www.attrs.org/en/stable',
    'marshmallow': 'https://marshmallow.readthedocs.io/en/stable',
    // Database
    'sqlalchemy': 'https://docs.sqlalchemy.org/en/14',
    'alembic': 'https://alembic.sqlalchemy.org/en/latest',
    'pymongo': 'https://pymongo.readthedocs.io/en/stable',
    'redis': 'https://redis-py.readthedocs.io/en/stable',
    // CLI / config
    'click': 'https://click.palletsprojects.com/en/latest',
    'rich': 'https://rich.readthedocs.io/en/stable',
    'typer': 'https://typer.tiangolo.com',
    // Testing
    'pytest': 'https://docs.pytest.org/en/stable',
    'hypothesis': 'https://hypothesis.readthedocs.io/en/latest',
    // Async / concurrency
    'anyio': 'https://anyio.readthedocs.io/en/stable',
    'trio': 'https://trio.readthedocs.io/en/stable',
    // Utilities
    'arrow': 'https://arrow.readthedocs.io/en/latest',
    'pendulum': 'https://pendulum.eustace.io/docs',
    'boto3': 'https://boto3.amazonaws.com/v1/documentation/api/latest',
    'botocore': 'https://botocore.amazonaws.com/v1/documentation/api/latest',
    'cryptography': 'https://cryptography.readthedocs.io/en/latest',
    'paramiko': 'https://docs.paramiko.org/en/stable',
    'celery': 'https://docs.celeryq.dev/en/stable',
};

/** Packages to eagerly load on warmup (most commonly used). */
const WARMUP_PACKAGES = [
    'numpy', 'pandas', 'requests', 'flask', 'django', 'fastapi',
    'sklearn', 'matplotlib', 'sqlalchemy', 'pydantic', 'pytest', 'click',
    // Load the Python stdlib inventory eagerly so typing, asyncio, etc.
    // are available on first hover without waiting for a network round-trip.
    'typing', 'asyncio', 'builtins',
];

export class InventoryFetcher {
    private parser: InventoryParser;
    private pypiClient: PyPiClient;
    private cache: Map<string, Map<string, HoverDoc>>; // Map<Package, Map<Symbol, Doc>>
    private packageBaseUrls: Map<string, string>; // Cache for resolved base URLs
    /** In-flight load promises — concurrent callers share one promise instead of spawning duplicates. */
    private loadingPromises: Map<string, Promise<void>> = new Map();
    private diskCache: DiskCache;
    private pythonVersion: string;
    private allowNetwork: boolean;

    constructor(diskCache: DiskCache, pythonVersion: string = '3', customLibraries: any[] = [], allowNetwork: boolean = true) {
        this.parser = new InventoryParser();
        this.pypiClient = new PyPiClient(diskCache);
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

    /**
     * Eagerly load inventories for a set of packages in the background.
     * Call this after extension activation so first-hover latency is near zero
     * for the most common packages.
     */
    warmup(packages: string[] = WARMUP_PACKAGES): void {
        for (const pkg of packages) {
            if (this.cache.has(pkg)) continue; // already loaded
            // Fire-and-forget: errors are swallowed inside loadInventory
            this.loadInventory(pkg).catch(() => { });
        }
    }

    private async resolveBaseUrl(packageName: string, version?: string, isStdlib?: boolean): Promise<string> {
        // 1. Stdlib
        if (isStdlib || packageName === 'builtins' || packageName === 'python') {
            return `https://docs.python.org/${this.pythonVersion}`;
        }

        // 2. Check in-memory URL cache
        if (this.packageBaseUrls.has(packageName)) {
            return this.packageBaseUrls.get(packageName)!;
        }

        // 3. Known pre-verified URLs (skips PyPI lookup + HEAD probing)
        const knownUrl = KNOWN_DOCS_URLS[packageName.toLowerCase()];
        if (knownUrl) {
            this.packageBaseUrls.set(packageName, knownUrl);
            return knownUrl;
        }

        // 4. Dynamic PyPI Lookup + Probing
        const pypiUrl = await this.pypiClient.getPackageUrl(packageName);
        if (pypiUrl) {
            // Remove trailing slash and normalize to HTTPS
            const cleanUrl = this.normalizeToHttps(pypiUrl.replace(/\/$/, ''));

            // Probe all candidate inventory locations concurrently (vs sequential 5s × 8)
            const candidates = [
                `${cleanUrl}/objects.inv`,
                `${cleanUrl}/docs/objects.inv`,
                `${cleanUrl}/en/stable/objects.inv`,
                `${cleanUrl}/en/latest/objects.inv`,
                `${cleanUrl}/api/objects.inv`,
                `${cleanUrl}/doc/stable/objects.inv`,
                `${cleanUrl}/doc/objects.inv`,
                `${cleanUrl}/stable/objects.inv`,
            ];

            try {
                const baseUrl = await Promise.any(
                    candidates.map(url =>
                        this.checkUrlExists(url).then(exists => {
                            if (!exists) throw new Error('not found');
                            return url.replace('/objects.inv', '');
                        })
                    )
                );
                this.packageBaseUrls.set(packageName, baseUrl);
                return baseUrl;
            } catch {
                // All probes failed — fall through to ReadTheDocs fallback
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

        // 1. Check in-memory cache; if missing, load — but share the in-flight promise so
        //    concurrent callers don't each trigger a separate download/parse.
        if (!this.cache.has(packageName)) {
            if (!this.loadingPromises.has(packageName)) {
                const p = this.loadInventory(packageName, key.version, key.isStdlib);
                this.loadingPromises.set(packageName, p);
                p.finally(() => this.loadingPromises.delete(packageName));
            }
            await this.loadingPromises.get(packageName);
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

            // Strategy 5: Suffix matching for deep module paths.
            // Sphinx inventories use public API names (e.g. `pandas.DataFrame.agg`)
            // but LSP/stubs resolve to internal paths (e.g. `pandas.core.frame.DataFrame.agg`).
            // Try progressively shorter suffixes until we find a match.
            if (key.name.includes('.')) {
                const nameParts = key.name.split('.');
                for (let i = nameParts.length - 2; i >= 1; i--) {
                    const suffix = nameParts.slice(i).join('.');
                    const candidate = `${packageName}.${suffix}`;
                    if (packageInventory.has(candidate)) {
                        Logger.log(`Inventory: Strategy 5 matched ${key.name} → ${candidate}`);
                        return packageInventory.get(candidate)!;
                    }
                }
            }

            // Strategy 6: Class-method scan for deep internal paths.
            // When LSP gives 'pandas.core.frame.agg' but the inventory has
            // 'pandas.DataFrame.agg', we scan for short entries ending with '.qualname'.
            // Only fires for names with deep module paths (3+ segments) to avoid false positives.
            if (key.qualname && !key.qualname.includes('.') && key.module) {
                const moduleDepth = key.module.split('.').length;
                if (moduleDepth >= 2) {
                    const dotQual = `.${key.qualname}`;
                    const candidates: Array<{ name: string; doc: HoverDoc; depth: number }> = [];
                    for (const [entryName, doc] of packageInventory) {
                        if (entryName.endsWith(dotQual) && entryName.startsWith(packageName + '.')) {
                            const entryParts = entryName.split('.');
                            if (entryParts.length <= 3) {
                                candidates.push({ name: entryName, doc, depth: entryParts.length });
                            }
                        }
                    }
                    if (candidates.length === 1) {
                        Logger.log(`Inventory: Strategy 6 matched ${key.name} → ${candidates[0].name}`);
                        return candidates[0].doc;
                    } else if (candidates.length > 1) {
                        candidates.sort((a, b) => a.depth - b.depth || a.name.length - b.name.length);
                        Logger.log(`Inventory: Strategy 6 matched ${key.name} → ${candidates[0].name} (${candidates.length} candidates)`);
                        return candidates[0].doc;
                    }
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

                // Restore the base URL so module-overview hovers can build a Docs link.
                // When loading from disk cache we return early and never call resolveBaseUrl,
                // so packageBaseUrls would stay empty without this.
                if (!this.packageBaseUrls.has(packageName)) {
                    const knownUrl = KNOWN_DOCS_URLS[packageName.toLowerCase()];
                    if (knownUrl) {
                        this.packageBaseUrls.set(packageName, knownUrl);
                    } else if (isStdlib || packageName === 'builtins' || packageName === 'python') {
                        this.packageBaseUrls.set(packageName, `https://docs.python.org/${this.pythonVersion}`);
                    }
                }

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

            // For stdlib, retry with the canonical /3/ URL in case the versioned URL
            // is unavailable (e.g. pre-release Python where docs aren't published yet).
            if (isStdlib && !inventoryUrl.includes('/docs.python.org/3/')) {
                const fallbackBase = 'https://docs.python.org/3';
                const fallbackUrl = `${fallbackBase}/objects.inv`;
                try {
                    Logger.log(`Retrying stdlib inventory with canonical URL: ${fallbackUrl}`);
                    const buffer = await this.fetchBuffer(fallbackUrl);
                    const inventory = this.parser.parse(buffer, fallbackBase);
                    this.cache.set(packageName, inventory);
                    this.packageBaseUrls.set(packageName, fallbackBase);
                    Logger.log(`Loaded stdlib inventory from canonical URL: ${inventory.size} items`);
                    const obj = Object.fromEntries(inventory);
                    this.diskCache.set(cacheKey, JSON.stringify(obj));
                    return;
                } catch (fallbackErr) {
                    Logger.log(`Canonical stdlib inventory also failed: ${fallbackErr}`);
                }
            }

            // Mark as empty to avoid repeated failures
            this.cache.set(packageName, new Map());
        }
    }

    /**
     * Returns the resolved base docs URL for a package (available after inventory is loaded).
     */
    getPythonVersion(): string {
        return this.pythonVersion;
    }

    getPackageBaseUrl(packageName: string): string | undefined {
        return this.packageBaseUrls.get(packageName);
    }

    /**
     * Returns up to `limit` notable export names from a loaded inventory.
     * Prefers short (top-level), public (no underscore) names, classes first.
     */
    getModuleExports(packageName: string, limit = 16): string[] {
        const inventory = this.cache.get(packageName);
        if (!inventory) return [];

        const seen = new Set<string>();
        const entries: Array<{ label: string; depth: number; kindScore: number }> = [];

        for (const [name, doc] of inventory) {
            const parts = name.split('.');
            const label = parts[parts.length - 1];
            if (!label || label.startsWith('_')) continue;
            // Skip C-extension macros / constants: all-caps with underscores (e.g. NPY_ARRAY_C_CONTIGUOUS)
            if (/^[A-Z][A-Z0-9_]{2,}$/.test(label)) continue;
            if (seen.has(label)) continue;
            seen.add(label);
            const kindScore = doc.kind === 'class' ? 0 : doc.kind === 'function' ? 1 : 2;
            entries.push({ label, depth: parts.length, kindScore });
        }

        return entries
            .sort((a, b) =>
                a.depth !== b.depth ? a.depth - b.depth : a.kindScore - b.kindScore
            )
            .slice(0, limit)
            .map(e => e.label);
    }

    /** Total number of indexed symbols for a loaded package. */
    getPackageExportCount(packageName: string): number {
        return this.cache.get(packageName)?.size ?? 0;
    }

    searchSymbols(query: string): Array<{ name: string; url: string; kind: string; package: string }> {
        const q = query.toLowerCase().trim();
        if (!q) return [];
        const results: Array<{ name: string; url: string; kind: string; package: string }> = [];
        for (const [pkg, inventory] of this.cache) {
            for (const [name, doc] of inventory) {
                if (name.toLowerCase().includes(q)) {
                    results.push({ name, url: doc.url || '', kind: doc.kind || 'symbol', package: pkg });
                }
            }
        }
        return results
            .sort((a, b) => {
                const aq = a.name.toLowerCase(), bq = b.name.toLowerCase();
                if (aq === q && bq !== q) return -1;
                if (bq === q && aq !== q) return 1;
                if (aq.startsWith(q) && !bq.startsWith(q)) return -1;
                if (bq.startsWith(q) && !aq.startsWith(q)) return 1;
                if (a.name.length !== b.name.length) return a.name.length - b.name.length;
                return a.name.localeCompare(b.name);
            })
            .slice(0, 200);
    }

    getIndexedSymbolCount(): number {
        let n = 0;
        for (const inv of this.cache.values()) n += inv.size;
        return n;
    }

    /**
     * Returns unique documentation page URLs for all symbols in a loaded package.
     * Anchors are stripped so each HTML page appears only once, regardless of how
     * many symbols it contains.  Capped at `maxPages` to keep corpus builds sane
     * for very large packages (numpy has 8k+ symbols but far fewer unique pages).
     */
    getPackageSymbolUrls(packageName: string, maxPages = 500): string[] {
        const inventory = this.cache.get(packageName);
        if (!inventory) return [];

        const pages = new Set<string>();
        for (const doc of inventory.values()) {
            if (!doc.url) continue;
            const pageUrl = doc.url.split('#')[0];
            if (pageUrl) pages.add(pageUrl);
            if (pages.size >= maxPages) break;
        }

        return [...pages];
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
