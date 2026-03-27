import * as https from 'https';
import { Logger } from '../../../extension/src/logger';
import { DocKey, HoverDoc, IndexedSymbolSummary } from '../../../shared/types';
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
    /** Rust core types — RTD underscore URL returns 400; same Sphinx site as pydantic */
    'pydantic_core': 'https://docs.pydantic.dev/latest',
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
    'typing_extensions': 'https://typing-extensions.readthedocs.io/en/stable',
    // Utilities
    'arrow': 'https://arrow.readthedocs.io/en/latest',
    'pendulum': 'https://pendulum.eustace.io/docs',
    'boto3': 'https://boto3.amazonaws.com/v1/documentation/api/latest',
    'botocore': 'https://botocore.amazonaws.com/v1/documentation/api/latest',
    'cryptography': 'https://cryptography.readthedocs.io/en/latest',
    'paramiko': 'https://docs.paramiko.org/en/stable',
    'celery': 'https://docs.celeryq.dev/en/stable',
    /** PyPI name `python-multipart` — avoid stale github.io probes + 404 spam */
    'python_multipart': 'https://multipart.fastapiexpert.com/en/latest',
    'multipart': 'https://multipart.fastapiexpert.com/en/latest',
};

/** Packages to eagerly load on warmup (most commonly used). */
const WARMUP_PACKAGES = [
    'numpy', 'pandas', 'requests', 'flask', 'django', 'fastapi',
    'sklearn', 'matplotlib', 'sqlalchemy', 'pydantic', 'pytest', 'click',
    // Load the Python stdlib inventory eagerly so typing, asyncio, etc.
    // are available on first hover without waiting for a network round-trip.
    'typing', 'asyncio', 'builtins',
];

const DOCS_REQUEST_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; PyHover/0.6; +https://github.com/KiidxAtlas/python-hover)',
    'Accept': '*/*',
};

export class InventoryFetcher {
    private static readonly STDLIB_INVENTORY_CACHE = '__python_stdlib__';
    private static readonly CORPUS_META_PAGE_PATTERNS = [
        /\/py-modindex\/?$/i,
        /\/genindex\/?$/i,
        /\/search\/?$/i,
        /\/search\.html$/i,
        /\/modindex\/?$/i,
        /\/objects\.inv$/i,
        /\/welcome\/?$/i,
    ];

    private parser: InventoryParser;
    private pypiClient: PyPiClient;
    private cache: Map<string, Map<string, HoverDoc>>; // Map<Package, Map<Symbol, Doc>>
    private packageBaseUrls: Map<string, string>; // Cache for resolved base URLs
    /** In-flight load promises — concurrent callers share one promise instead of spawning duplicates. */
    private loadingPromises: Map<string, Promise<void>> = new Map();
    /** Log each failed package at most once per session (avoid hover-stampedes). */
    private failedInventoryLog = new Set<string>();
    /** Log each redirect chain at most once per session. */
    private redirectLogSeen = new Set<string>();
    /** Cache resolved inventory lookups so fallback strategy scans are not repeated. */
    private inventoryLookupCache = new Map<string, HoverDoc | null>();
    /** Cache query-derived symbol lists until inventories change. */
    private searchCache = new Map<string, IndexedSymbolSummary[]>();
    private moduleSymbolsCache = new Map<string, IndexedSymbolSummary[]>();
    private indexedPackagesCache: string[] | undefined;
    private indexedPackageSummariesCache: Array<{ name: string; count: number }> | undefined;
    private indexedSymbolCountCache: number | undefined;
    private diskCache: DiskCache;
    private pythonVersion: string;
    private allowNetwork: boolean;
    /** When false, skip KNOWN_DOCS_URLS — resolve via PyPI + probes + RTD fallback only. */
    private readonly useKnownDocsUrls: boolean;

    constructor(
        diskCache: DiskCache,
        pythonVersion: string = '3',
        customLibraries: any[] = [],
        allowNetwork: boolean = true,
        useKnownDocsUrls = false,
    ) {
        this.parser = new InventoryParser();
        this.pypiClient = new PyPiClient(diskCache);
        this.cache = new Map();
        this.packageBaseUrls = new Map();
        this.diskCache = diskCache;
        this.pythonVersion = pythonVersion;
        this.allowNetwork = allowNetwork;
        this.useKnownDocsUrls = useKnownDocsUrls;

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

    private invalidateDerivedCaches(): void {
        this.inventoryLookupCache.clear();
        this.searchCache.clear();
        this.moduleSymbolsCache.clear();
        this.indexedPackagesCache = undefined;
        this.indexedPackageSummariesCache = undefined;
        this.indexedSymbolCountCache = undefined;
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
            if (this.cache.has(pkg)) continue;
            const isStdlibWarmup = pkg === 'typing' || pkg === 'asyncio' || pkg === 'builtins';
            void this.ensureInventoryLoaded(pkg, undefined, isStdlibWarmup ? true : undefined).catch(() => { });
        }
    }

    async ensurePackageLoaded(packageName: string, version?: string, isStdlib?: boolean): Promise<void> {
        await this.ensureInventoryLoaded(packageName, version, isStdlib);
    }

    async hydrateCachedInventories(): Promise<string[]> {
        const cachedPackages = this.diskCache.listCachedInventoryPackages();
        if (cachedPackages.length === 0) {
            return this.getIndexedPackages();
        }

        await Promise.all(
            cachedPackages.map(packageName =>
                this.ensurePackageLoaded(packageName, undefined, packageName === 'builtins').catch(() => undefined)
            )
        );

        return this.getIndexedPackages();
    }

    /**
     * Single entry for kicking off loads — shares the same promise as findInInventory so
     * warmup + hovers never download the same objects.inv twice in parallel.
     */
    private ensureInventoryLoaded(packageName: string, version?: string, isStdlib?: boolean): Promise<void> {
        const inventoryCacheName = this.getInventoryCacheName(packageName, isStdlib);
        if (this.cache.has(packageName) || this.cache.has(inventoryCacheName)) {
            if (!this.cache.has(packageName) && this.cache.has(inventoryCacheName)) {
                this.cache.set(packageName, this.cache.get(inventoryCacheName)!);
            }
            return Promise.resolve();
        }
        let p = this.loadingPromises.get(inventoryCacheName);
        if (!p) {
            p = this.loadInventory(packageName, version, isStdlib);
            this.loadingPromises.set(inventoryCacheName, p);
            p.finally(() => this.loadingPromises.delete(inventoryCacheName));
        }
        return p;
    }

    private getInventoryCacheName(packageName: string, isStdlib?: boolean): string {
        return (isStdlib || packageName === 'builtins' || packageName === 'python')
            ? InventoryFetcher.STDLIB_INVENTORY_CACHE
            : packageName;
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

        // 3. Optional bundled URL map (fast path; off by default)
        if (this.useKnownDocsUrls) {
            const knownUrl = KNOWN_DOCS_URLS[packageName.toLowerCase()];
            if (knownUrl) {
                this.packageBaseUrls.set(packageName, knownUrl);
                return knownUrl;
            }
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
            const req = https.request(httpsUrl, { method: 'HEAD', timeout: 5000, headers: DOCS_REQUEST_HEADERS }, (res) => {
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
        const lookupKey = [
            packageName,
            key.version || '',
            key.isStdlib ? '1' : '0',
            key.module,
            key.qualname,
            key.name,
        ].join('|');
        if (this.inventoryLookupCache.has(lookupKey)) {
            return this.inventoryLookupCache.get(lookupKey) ?? null;
        }

        // 1. Check in-memory cache; if missing, load — but share the in-flight promise so
        //    concurrent callers don't each trigger a separate download/parse.
        if (!this.cache.has(packageName)) {
            await this.ensureInventoryLoaded(packageName, key.version, key.isStdlib);
        }

        const packageInventory = this.cache.get(packageName);
        if (packageInventory) {
            // Strategy 1: Exact match on qualname (e.g. "DataFrame" -> "DataFrame")
            if (packageInventory.has(key.qualname)) {
                const exact = packageInventory.get(key.qualname)!;
                this.inventoryLookupCache.set(lookupKey, exact);
                return exact;
            }

            // Strategy 2: Module + Qualname (e.g. "pandas.DataFrame")
            const moduleQualname = `${key.module}.${key.qualname}`;
            if (packageInventory.has(moduleQualname)) {
                const moduleExact = packageInventory.get(moduleQualname)!;
                this.inventoryLookupCache.set(lookupKey, moduleExact);
                return moduleExact;
            }

            // Strategy 3: Name as provided (e.g. "pandas.DataFrame")
            if (packageInventory.has(key.name)) {
                const named = packageInventory.get(key.name)!;
                this.inventoryLookupCache.set(lookupKey, named);
                return named;
            }

            // Strategy 4: Strip 'builtins.' prefix for builtins package
            // Python docs usually index 'str', 'int', 'len' directly, not 'builtins.str'
            if (packageName === 'builtins') {
                const simpleName = key.qualname.replace(/^builtins\./, '');
                if (packageInventory.has(simpleName)) {
                    const builtinSimple = packageInventory.get(simpleName)!;
                    this.inventoryLookupCache.set(lookupKey, builtinSimple);
                    return builtinSimple;
                }

                // Also try without any prefix if name has one
                const nameSimple = key.name.replace(/^builtins\./, '');
                if (packageInventory.has(nameSimple)) {
                    const builtinName = packageInventory.get(nameSimple)!;
                    this.inventoryLookupCache.set(lookupKey, builtinName);
                    return builtinName;
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
                        const suffixMatch = packageInventory.get(candidate)!;
                        this.inventoryLookupCache.set(lookupKey, suffixMatch);
                        return suffixMatch;
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
                        this.inventoryLookupCache.set(lookupKey, candidates[0].doc);
                        return candidates[0].doc;
                    } else if (candidates.length > 1) {
                        candidates.sort((a, b) => a.depth - b.depth || a.name.length - b.name.length);
                        Logger.log(`Inventory: Strategy 6 matched ${key.name} → ${candidates[0].name} (${candidates.length} candidates)`);
                        this.inventoryLookupCache.set(lookupKey, candidates[0].doc);
                        return candidates[0].doc;
                    }
                }
            }
        }

        this.inventoryLookupCache.set(lookupKey, null);
        return null;
    }

    private async loadInventory(packageName: string, version?: string, isStdlib?: boolean): Promise<void> {
        const inventoryCacheName = this.getInventoryCacheName(packageName, isStdlib);
        const cacheKey = `inventory:${inventoryCacheName}:${version || 'latest'}`;

        // 1. Try Disk Cache
        const cached = this.diskCache.get(cacheKey);
        if (cached) {
            try {
                const data = JSON.parse(cached);
                const inventory = new Map<string, HoverDoc>(Object.entries(data));
                this.cache.set(inventoryCacheName, inventory);
                if (packageName !== inventoryCacheName) {
                    this.cache.set(packageName, inventory);
                }
                this.invalidateDerivedCaches();

                // Restore the base URL so module-overview hovers can build a Docs link.
                // When loading from disk cache we return early and never call resolveBaseUrl,
                // so packageBaseUrls would stay empty without this.
                if (!this.packageBaseUrls.has(packageName) && !this.packageBaseUrls.has(inventoryCacheName)) {
                    const knownUrl = this.useKnownDocsUrls ? KNOWN_DOCS_URLS[packageName.toLowerCase()] : undefined;
                    if (knownUrl) {
                        this.packageBaseUrls.set(inventoryCacheName, knownUrl);
                        this.packageBaseUrls.set(packageName, knownUrl);
                    } else if (isStdlib || packageName === 'builtins' || packageName === 'python') {
                        const stdlibUrl = `https://docs.python.org/${this.pythonVersion}`;
                        this.packageBaseUrls.set(inventoryCacheName, stdlibUrl);
                        this.packageBaseUrls.set(packageName, stdlibUrl);
                    }
                }

                Logger.log(`Loaded inventory for ${packageName} from disk cache`);
                return;
            } catch (e) {
                Logger.log(`Failed to parse cached inventory for ${packageName}`);
            }
        }

        const negKey = `inv-fail:${inventoryCacheName}`;
        if (this.diskCache.get(negKey)) {
            const empty = new Map<string, HoverDoc>();
            this.cache.set(inventoryCacheName, empty);
            if (packageName !== inventoryCacheName) {
                this.cache.set(packageName, empty);
            }
            return;
        }

        // 2. Fetch from Network
        if (!this.allowNetwork) {
            Logger.log(`Network disabled, skipping inventory fetch for ${packageName}`);
            const empty = new Map<string, HoverDoc>();
            this.cache.set(inventoryCacheName, empty);
            if (packageName !== inventoryCacheName) {
                this.cache.set(packageName, empty);
            }
            return;
        }

        const baseUrl = await this.resolveBaseUrl(packageName, version, isStdlib);
        const inventoryUrl = `${baseUrl}/objects.inv`;

        try {
            const buffer = await this.fetchBuffer(inventoryUrl);
            const inventory = this.parser.parse(buffer, baseUrl);
            this.cache.set(inventoryCacheName, inventory);
            if (packageName !== inventoryCacheName) {
                this.cache.set(packageName, inventory);
            }
            this.invalidateDerivedCaches();
            this.packageBaseUrls.set(inventoryCacheName, baseUrl);
            this.packageBaseUrls.set(packageName, baseUrl);
            Logger.log(`Loaded inventory for ${packageName}: ${inventory.size} items`);

            // 3. Save to Disk Cache
            const obj = Object.fromEntries(inventory);
            this.diskCache.set(cacheKey, JSON.stringify(obj));
        } catch (e) {
            if (!this.failedInventoryLog.has(packageName)) {
                this.failedInventoryLog.add(packageName);
                Logger.log(`Failed to load inventory for ${packageName} from ${inventoryUrl}: ${e}`);
            }

            // For stdlib, retry with the canonical /3/ URL in case the versioned URL
            // is unavailable (e.g. pre-release Python where docs aren't published yet).
            if (isStdlib && !inventoryUrl.includes('/docs.python.org/3/')) {
                const fallbackBase = 'https://docs.python.org/3';
                const fallbackUrl = `${fallbackBase}/objects.inv`;
                try {
                    Logger.log(`Retrying stdlib inventory with canonical URL: ${fallbackUrl}`);
                    const buffer = await this.fetchBuffer(fallbackUrl);
                    const inventory = this.parser.parse(buffer, fallbackBase);
                    this.cache.set(inventoryCacheName, inventory);
                    if (packageName !== inventoryCacheName) {
                        this.cache.set(packageName, inventory);
                    }
                    this.invalidateDerivedCaches();
                    this.packageBaseUrls.set(inventoryCacheName, fallbackBase);
                    this.packageBaseUrls.set(packageName, fallbackBase);
                    Logger.log(`Loaded stdlib inventory from canonical URL: ${inventory.size} items`);
                    const obj = Object.fromEntries(inventory);
                    this.diskCache.set(cacheKey, JSON.stringify(obj));
                    return;
                } catch (fallbackErr) {
                    Logger.log(`Canonical stdlib inventory also failed: ${fallbackErr}`);
                }
            }

            const empty = new Map<string, HoverDoc>();
            this.cache.set(inventoryCacheName, empty);
            if (packageName !== inventoryCacheName) {
                this.cache.set(packageName, empty);
            }
            this.invalidateDerivedCaches();
            this.diskCache.set(negKey, '1');
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

    searchSymbols(query: string): IndexedSymbolSummary[] {
        const q = query.toLowerCase().trim();
        if (!q) return [];
        const cached = this.searchCache.get(q);
        if (cached) {
            return cached;
        }
        const results: IndexedSymbolSummary[] = [];
        const seen = new Set<string>();
        for (const [pkg, inventory] of this.cache) {
            for (const [name, doc] of inventory) {
                if (name.toLowerCase().includes(q)) {
                    const key = `${name}|${doc.url || ''}|${doc.kind || 'symbol'}`;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    results.push(this.toIndexedSymbolSummary(name, doc, pkg));
                }
            }
        }
        const finalResults = results
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
        this.searchCache.set(q, finalResults);
        return finalResults;
    }

    getModuleSymbols(moduleName: string, maxSymbols = 5000): IndexedSymbolSummary[] {
        const normalized = moduleName.trim();
        if (!normalized) return [];

        const cacheKey = `${normalized}:${maxSymbols}`;
        const cached = this.moduleSymbolsCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        const results: IndexedSymbolSummary[] = [];
        const seen = new Set<string>();
        const exactInventory = this.cache.get(normalized);
        const inventories = exactInventory
            ? [[normalized, exactInventory] as const]
            : [...this.cache.entries()];

        for (const [pkg, inventory] of inventories) {
            for (const [name, doc] of inventory) {
                if (name === normalized || name.startsWith(`${normalized}.`) || pkg === normalized) {
                    const symbolKey = `${name}|${doc.url || ''}|${doc.kind || 'symbol'}`;
                    if (seen.has(symbolKey)) continue;
                    seen.add(symbolKey);
                    results.push(this.toIndexedSymbolSummary(name, doc, pkg));
                }
            }
        }

        const finalResults = results
            .sort((a, b) => a.name.localeCompare(b.name))
            .slice(0, maxSymbols);
        this.moduleSymbolsCache.set(cacheKey, finalResults);
        return finalResults;
    }

    getIndexedPackages(): string[] {
        if (this.indexedPackagesCache) {
            return this.indexedPackagesCache;
        }

        this.indexedPackagesCache = [...this.cache.keys()]
            .filter(name => name !== InventoryFetcher.STDLIB_INVENTORY_CACHE)
            .sort((a, b) => a.localeCompare(b));
        return this.indexedPackagesCache;
    }

    getIndexedPackageSummaries(): Array<{ name: string; count: number }> {
        if (this.indexedPackageSummariesCache) {
            return this.indexedPackageSummariesCache;
        }

        this.indexedPackageSummariesCache = this.getIndexedPackages().map(name => ({
            name,
            count: this.cache.get(name)?.size ?? 0,
        }));
        return this.indexedPackageSummariesCache;
    }

    private toIndexedSymbolSummary(name: string, doc: HoverDoc, pkg: string): IndexedSymbolSummary {
        return {
            name,
            url: doc.url || '',
            kind: doc.kind || 'symbol',
            package: pkg,
            title: doc.title || name,
            module: doc.module,
            signature: doc.signature,
            summary: this.extractPreviewText(doc),
            sourceUrl: doc.sourceUrl,
        };
    }

    private extractPreviewText(doc: HoverDoc): string | undefined {
        const candidate = doc.summary
            || doc.structuredContent?.summary
            || doc.structuredContent?.description
            || doc.content;
        const cleaned = candidate
            ?.replace(/```[\s\S]*?```/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (!cleaned) return undefined;
        if (
            cleaned.startsWith('Documentation for')
            || cleaned.startsWith('Documentation from')
            || cleaned === 'No documentation found.'
            || cleaned === 'Documentation lookup failed.'
        ) {
            return undefined;
        }

        return cleaned;
    }

    getIndexedSymbolCount(): number {
        if (this.indexedSymbolCountCache !== undefined) {
            return this.indexedSymbolCountCache;
        }

        let n = 0;
        for (const inv of this.cache.values()) n += inv.size;
        this.indexedSymbolCountCache = n;
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
            if (!pageUrl || this.shouldSkipCorpusPageUrl(pageUrl)) continue;
            if (pageUrl) pages.add(pageUrl);
            if (pages.size >= maxPages) break;
        }

        return [...pages];
    }

    getPackageSymbolTargets(packageName: string, maxTargets = 20_000): Array<{ corpusPackage: string; url: string }> {
        const inventory = this.cache.get(packageName);
        if (!inventory) return [];

        const targets: Array<{ corpusPackage: string; url: string }> = [];
        const seen = new Set<string>();

        for (const [name, doc] of inventory) {
            if (!doc.url || this.shouldSkipCorpusPageUrl(doc.url.split('#')[0])) continue;

            const corpusPackage = name.includes('.') ? name.split('.')[0] : packageName;
            const targetKey = `${corpusPackage}:${doc.url}`;
            if (seen.has(targetKey)) continue;
            seen.add(targetKey);
            targets.push({ corpusPackage, url: doc.url });
            if (targets.length >= maxTargets) break;
        }

        return targets;
    }

    private shouldSkipCorpusPageUrl(url: string): boolean {
        return InventoryFetcher.CORPUS_META_PAGE_PATTERNS.some(pattern => pattern.test(url));
    }

    private fetchBuffer(url: string, redirectCount = 0): Promise<Buffer> {
        if (redirectCount > 5) {
            return Promise.reject(new Error('Too many redirects'));
        }

        // Ensure URL uses HTTPS (required for VS Code Remote environments)
        const httpsUrl = this.normalizeToHttps(url);

        return new Promise((resolve, reject) => {
            const req = https.get(httpsUrl, { timeout: 5000, headers: DOCS_REQUEST_HEADERS }, (res) => {
                if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    // Normalize redirect URL to HTTPS as well
                    const newUrl = this.normalizeToHttps(new URL(res.headers.location, httpsUrl).toString());
                    const redirectKey = `${httpsUrl}→${newUrl}`;
                    if (!this.redirectLogSeen.has(redirectKey)) {
                        this.redirectLogSeen.add(redirectKey);
                        Logger.log(`Following redirect for ${httpsUrl} to ${newUrl}`);
                    }
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
