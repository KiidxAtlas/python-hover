import {
  CustomLibraryConfig,
  DocKey,
  HoverDoc,
  IndexedSymbolSummary,
  ResolutionSource,
} from "../../../shared/types";
import { DiskCache } from "../cache/diskCache";
import { httpGetBuffer, httpHeadExists } from "../discover/httpClient";
import { PyPiClient } from "../discover/pypiClient";
import { getEngineLogger } from "../engineLogger";
import { InventoryParser } from "./inventoryParser";
import { DOCS_REQUEST_HEADERS } from "../sharedConstants";

/**
 * Pre-verified Sphinx documentation base URLs for popular packages.
 * Skips PyPI lookup + HEAD probe for these, giving instant inventory resolution.
 * Format: packageName → base URL (without trailing slash, without /objects.inv).
 */
const KNOWN_DOCS_URLS: Record<string, string> = {
  // Scientific / data
  numpy: "https://numpy.org/doc/stable",
  pandas: "https://pandas.pydata.org/docs",
  scipy: "https://docs.scipy.org/doc/scipy",
  matplotlib: "https://matplotlib.org/stable",
  seaborn: "https://seaborn.pydata.org",
  statsmodels: "https://www.statsmodels.org/stable",
  sympy: "https://docs.sympy.org/latest",
  networkx: "https://networkx.org/documentation/stable",
  pillow: "https://pillow.readthedocs.io/en/stable",
  pil: "https://pillow.readthedocs.io/en/stable",
  // ML / AI
  sklearn: "https://scikit-learn.org/stable",
  "scikit-learn": "https://scikit-learn.org/stable",
  torch: "https://pytorch.org/docs/stable",
  tensorflow: "https://www.tensorflow.org/api_docs/python",
  keras: "https://keras.io/api",
  xgboost: "https://xgboost.readthedocs.io/en/stable",
  lightgbm: "https://lightgbm.readthedocs.io/en/stable",
  // Web frameworks
  flask: "https://flask.palletsprojects.com/en/latest",
  django: "https://docs.djangoproject.com/en/stable",
  fastapi: "https://fastapi.tiangolo.com",
  starlette: "https://www.starlette.io",
  aiohttp: "https://docs.aiohttp.org/en/stable",
  tornado: "https://www.tornadoweb.org/en/stable",
  // HTTP / networking
  requests: "https://requests.readthedocs.io/en/latest",
  httpx: "https://www.python-httpx.org",
  urllib3: "https://urllib3.readthedocs.io/en/stable",
  // Data validation / settings
  pydantic: "https://docs.pydantic.dev/latest",
  /** Rust core types — RTD underscore URL returns 400; same Sphinx site as pydantic */
  pydantic_core: "https://docs.pydantic.dev/latest",
  attrs: "https://www.attrs.org/en/stable",
  marshmallow: "https://marshmallow.readthedocs.io/en/stable",
  // Database
  sqlalchemy: "https://docs.sqlalchemy.org/en/14",
  alembic: "https://alembic.sqlalchemy.org/en/latest",
  pymongo: "https://pymongo.readthedocs.io/en/stable",
  redis: "https://redis-py.readthedocs.io/en/stable",
  // CLI / config
  click: "https://click.palletsprojects.com/en/latest",
  rich: "https://rich.readthedocs.io/en/stable",
  typer: "https://typer.tiangolo.com",
  // Testing
  pytest: "https://docs.pytest.org/en/stable",
  hypothesis: "https://hypothesis.readthedocs.io/en/latest",
  // Async / concurrency
  anyio: "https://anyio.readthedocs.io/en/stable",
  trio: "https://trio.readthedocs.io/en/stable",
  typing_extensions: "https://typing-extensions.readthedocs.io/en/stable",
  // Utilities
  arrow: "https://arrow.readthedocs.io/en/latest",
  pendulum: "https://pendulum.eustace.io/docs",
  boto3: "https://boto3.amazonaws.com/v1/documentation/api/latest",
  botocore: "https://botocore.amazonaws.com/v1/documentation/api/latest",
  cryptography: "https://cryptography.readthedocs.io/en/latest",
  paramiko: "https://docs.paramiko.org/en/stable",
  celery: "https://docs.celeryq.dev/en/stable",
  /** PyPI name `python-multipart` — avoid stale github.io probes + 404 spam */
  python_multipart: "https://multipart.fastapiexpert.com/en/latest",
  multipart: "https://multipart.fastapiexpert.com/en/latest",
  // GUI
  pyside6: "https://doc.qt.io/qtforpython-6",
};

/** Packages to eagerly load on warmup (most commonly used). */
const WARMUP_PACKAGES = [
  "numpy",
  "pandas",
  "requests",
  "flask",
  "django",
  "fastapi",
  "sklearn",
  "matplotlib",
  "sqlalchemy",
  "pydantic",
  "pytest",
  "click",
  // Load the Python stdlib inventory eagerly so typing, asyncio, etc.
  // are available on first hover without waiting for a network round-trip.
  "typing",
  "asyncio",
  "builtins",
];

const PYTHON_DOTTED_NAME_RE = /^[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*$/;

export class InventoryFetcher {
  private static readonly STDLIB_INVENTORY_CACHE = "__python_stdlib__";
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
  /** Packages for which an online inventory lookup actually ran and failed. */
  private failedDiscoveries = new Set<string>();
  /** Cache resolved inventory lookups so fallback strategy scans are not repeated. */
  private inventoryLookupCache = new Map<string, HoverDoc | null>();
  /** Cache query-derived symbol lists until inventories change. */
  private searchCache = new Map<string, IndexedSymbolSummary[]>();
  private moduleSymbolsCache = new Map<string, IndexedSymbolSummary[]>();
  private indexedPackagesCache: string[] | undefined;
  private indexedPackageSummariesCache:
    | Array<{ name: string; count: number }>
    | undefined;
  private indexedSymbolCountCache: number | undefined;
  private docsProviderCache = new Map<string, "mkdocs" | "sphinx">();
  private invalidPackageNames = new Set<string>();
  private diskCache: DiskCache;
  private pythonVersion: string;
  private allowNetwork: boolean;
  private customInventoryUrls: Map<string, string>;
  /** When false, skip KNOWN_DOCS_URLS — resolve via PyPI + probes + RTD fallback only. */
  private readonly useKnownDocsUrls: boolean;

  constructor(
    diskCache: DiskCache,
    pythonVersion: string = "3",
    customLibraries: CustomLibraryConfig[] = [],
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
    this.customInventoryUrls = new Map();
    this.useKnownDocsUrls = useKnownDocsUrls;

    // Initialize custom libraries
    for (const lib of customLibraries) {
      if (lib.name && lib.baseUrl) {
        this.packageBaseUrls.set(lib.name, lib.baseUrl);
        if (typeof lib.inventoryUrl === "string" && lib.inventoryUrl.trim()) {
          this.customInventoryUrls.set(lib.name, lib.inventoryUrl.trim());
        }
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
    if (url.startsWith("http://")) {
      return url.replace("http://", "https://");
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
      if (this.cache.has(pkg)) {
        continue;
      }
      const isStdlibWarmup =
        pkg === "typing" || pkg === "asyncio" || pkg === "builtins";
      void this.ensureInventoryLoaded(
        pkg,
        undefined,
        isStdlibWarmup ? true : undefined,
      ).catch((e) => {
        getEngineLogger().log(`Warmup failed for ${pkg}: ${e}`);
      });
    }
  }

  async ensurePackageLoaded(
    packageName: string,
    version?: string,
    isStdlib?: boolean,
  ): Promise<void> {
    await this.ensureInventoryLoaded(packageName, version, isStdlib);
  }

  async hydrateCachedInventories(): Promise<string[]> {
    const cachedPackages = this.diskCache.listCachedInventoryPackages();
    if (cachedPackages.length === 0) {
      return this.getIndexedPackages();
    }

    await Promise.all(
      cachedPackages
        .filter((packageName) => this.isLikelyPythonPackageName(packageName))
        .map((packageName) =>
          this.ensurePackageLoaded(
            packageName,
            undefined,
            packageName === "builtins",
          ).catch(() => undefined),
        ),
    );

    return this.getIndexedPackages();
  }

  /**
   * Single entry for kicking off loads — shares the same promise as findInInventory so
   * warmup + hovers never download the same objects.inv twice in parallel.
   */
  private async ensureInventoryLoaded(
    packageName: string,
    version?: string,
    isStdlib?: boolean,
  ): Promise<void> {
    if (!this.isLikelyPythonPackageName(packageName)) {
      this.invalidPackageNames.add(packageName);
      return;
    }

    const inventoryCacheName = this.getInventoryCacheName(
      packageName,
      isStdlib,
    );
    if (this.cache.has(packageName) || this.cache.has(inventoryCacheName)) {
      if (!this.cache.has(packageName) && this.cache.has(inventoryCacheName)) {
        this.cache.set(packageName, this.cache.get(inventoryCacheName)!);
      }
      return;
    }
    let p = this.loadingPromises.get(inventoryCacheName);
    if (!p) {
      p = this.loadInventory(packageName, version, isStdlib);
      this.loadingPromises.set(inventoryCacheName, p);
      p.finally(() => this.loadingPromises.delete(inventoryCacheName));
    }
    await p;
    // Every stdlib package shares one inventory fetch keyed by
    // `inventoryCacheName` (STDLIB_INVENTORY_CACHE) — e.g. seeding
    // "builtins"/"typing"/"asyncio" concurrently all ride the same load.
    // Only the *first* caller's own `packageName` gets set by loadInventory
    // itself; without this, every later rider's package never appears in
    // `getIndexedPackages()` even though its content genuinely loaded,
    // making Module Browser silently under-report (or entirely miss) the
    // seeded starter packages.
    if (!this.cache.has(packageName) && this.cache.has(inventoryCacheName)) {
      this.cache.set(packageName, this.cache.get(inventoryCacheName)!);
    }
  }

  private getInventoryCacheName(
    packageName: string,
    isStdlib?: boolean,
  ): string {
    return isStdlib || packageName === "builtins" || packageName === "python"
      ? InventoryFetcher.STDLIB_INVENTORY_CACHE
      : packageName;
  }

  /**
   * Whether online discovery has already been *attempted* for `packageName` and came
   * back with nothing — as opposed to simply never having been tried yet. Package-
   * agnostic by design (no hardcoded allowlist): any package whose docs aren't
   * Sphinx-discoverable (Doxygen-only sites, no hosted docs, unusual hosting, …) ends
   * up here identically, since `loadInventory` caches an empty result for all of them.
   */
  hasFailedDiscovery(packageName: string): boolean {
    const inventoryCacheName = this.getInventoryCacheName(packageName, false);
    return (
      this.failedDiscoveries.has(packageName) ||
      this.failedDiscoveries.has(inventoryCacheName) ||
      this.diskCache.get(`inv-fail:${inventoryCacheName}`) !== null
    );
  }

  private isLikelyPythonPackageName(packageName: string | undefined): boolean {
    if (!packageName) {
      return false;
    }

    return (
      packageName === "builtins" ||
      packageName === "python" ||
      PYTHON_DOTTED_NAME_RE.test(packageName)
    );
  }

  private isLikelyPythonSymbolName(name: string | undefined): boolean {
    return !!name && PYTHON_DOTTED_NAME_RE.test(name.trim());
  }

  private sanitizeInventory(
    inventory: Map<string, HoverDoc>,
  ): Map<string, HoverDoc> {
    const sanitized = new Map<string, HoverDoc>();

    for (const [name, doc] of inventory) {
      if (!this.isLikelyPythonSymbolName(name)) {
        continue;
      }
      sanitized.set(name, doc);
    }

    return sanitized;
  }

  private buildInventoryUrl(packageName: string, baseUrl: string): string {
    const customInventoryUrl = this.customInventoryUrls.get(packageName);
    if (customInventoryUrl) {
      return customInventoryUrl;
    }

    const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    return new URL("objects.inv", normalizedBaseUrl).toString();
  }

  private withTrailingSlash(url: string): string {
    return url.endsWith("/") ? url : `${url}/`;
  }

  private async resolveDocsProvider(
    baseUrl: string,
  ): Promise<"mkdocs" | "sphinx"> {
    const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
    const cached = this.docsProviderCache.get(normalizedBaseUrl);
    if (cached) {
      return cached;
    }

    const mkdocsUrl = new URL(
      "search/search_index.json",
      this.withTrailingSlash(normalizedBaseUrl),
    ).toString();
    if (await this.checkUrlExists(mkdocsUrl)) {
      this.docsProviderCache.set(normalizedBaseUrl, "mkdocs");
      return "mkdocs";
    }

    const sphinxUrl = new URL(
      "searchindex.js",
      this.withTrailingSlash(normalizedBaseUrl),
    ).toString();
    if (await this.checkUrlExists(sphinxUrl)) {
      this.docsProviderCache.set(normalizedBaseUrl, "sphinx");
      return "sphinx";
    }

    this.docsProviderCache.set(normalizedBaseUrl, "sphinx");
    return "sphinx";
  }

  private async resolveDocsProviderForPackage(
    packageName: string,
    version?: string,
    isStdlib?: boolean,
  ): Promise<"mkdocs" | "sphinx"> {
    let baseUrl = this.packageBaseUrls.get(packageName);
    if (!baseUrl) {
      const inventoryCacheName = this.getInventoryCacheName(
        packageName,
        isStdlib,
      );
      baseUrl = this.packageBaseUrls.get(inventoryCacheName);
    }
    if (!baseUrl) {
      if (isStdlib || packageName === "builtins" || packageName === "python") {
        baseUrl = `https://docs.python.org/${this.pythonVersion}`;
      } else if (this.allowNetwork) {
        try {
          baseUrl = await this.resolveBaseUrl(packageName, version, isStdlib);
        } catch {
          baseUrl = undefined;
        }
      }
    }

    if (!baseUrl) {
      return "sphinx";
    }

    return this.resolveDocsProvider(baseUrl).catch(() => "sphinx");
  }

  /**
   * Checks the bundled KNOWN_DOCS_URLS map for `packageName`, falling back to its
   * root package (first dot-segment) when there's no exact match — e.g. a dotted
   * submodule name like "PySide6.QtCore" still resolves via the "pyside6" entry,
   * since submodules of a package always share the same documentation site.
   */
  private lookupKnownDocsUrl(packageName: string): string | undefined {
    const lower = packageName.toLowerCase();
    if (KNOWN_DOCS_URLS[lower]) {
      return KNOWN_DOCS_URLS[lower];
    }
    const root = lower.split(".")[0];
    return KNOWN_DOCS_URLS[root];
  }

  /**
   * Best-effort "what documentation site does this package use", for callers
   * (like SearchFallback) that want a real docs link even when they have no
   * inventory match for the specific symbol. Checks whatever's already been
   * discovered this session (from a prior successful inventory resolution — the
   * most accurate, since it's a URL that's actually been verified to work) before
   * falling back to the static bundled map. Never triggers network I/O itself.
   */
  getKnownBaseUrl(packageName: string | undefined): string | undefined {
    if (!packageName) {
      return undefined;
    }
    return (
      this.packageBaseUrls.get(packageName) ??
      this.packageBaseUrls.get(packageName.split(".")[0]) ??
      this.lookupKnownDocsUrl(packageName)
    );
  }

  private async resolveBaseUrl(
    packageName: string,
    version?: string,
    isStdlib?: boolean,
  ): Promise<string> {
    // 1. Stdlib
    if (isStdlib || packageName === "builtins" || packageName === "python") {
      return `https://docs.python.org/${this.pythonVersion}`;
    }

    if (!this.isLikelyPythonPackageName(packageName)) {
      throw new Error(`Invalid package name: ${packageName}`);
    }

    // 2. Check in-memory URL cache
    if (this.packageBaseUrls.has(packageName)) {
      return this.packageBaseUrls.get(packageName)!;
    }

    // 3. Optional bundled URL map (fast path; off by default)
    if (this.useKnownDocsUrls) {
      const knownUrl = this.lookupKnownDocsUrl(packageName);
      if (knownUrl) {
        this.packageBaseUrls.set(packageName, knownUrl);
        return knownUrl;
      }
    }

    // 4. Dynamic PyPI Lookup + Probing
    // Try the full dotted name first (correct for the common case where the import
    // root *is* the PyPI package name), then fall back to just the root package —
    // dotted submodule names like "PySide6.QtCore" are never themselves a real PyPI
    // package, so looking up "PySide6.QtCore" always 404s even though "PySide6" is
    // exactly right. Without this fallback, any package organized this way (Qt
    // bindings are not the only example) permanently misses live discovery too.
    const rootPackageName = packageName.split(".")[0];
    const pypiUrl =
      (await this.pypiClient.getPackageUrl(packageName)) ||
      (rootPackageName !== packageName
        ? await this.pypiClient.getPackageUrl(rootPackageName)
        : null);
    if (pypiUrl) {
      // Remove trailing slash and normalize to HTTPS
      const cleanUrl = this.normalizeToHttps(pypiUrl.replace(/\/$/, ""));

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
          candidates.map((url) =>
            this.checkUrlExists(url).then((resolvedUrl) => {
              if (!resolvedUrl) {
                throw new Error("not found");
              }
              // Use the RESOLVED final URL (post-redirect), not the original candidate
              // string — a candidate that 301s to a different path would otherwise
              // produce a base URL that was never actually verified to work.
              return resolvedUrl.replace(/\/objects\.inv$/, "");
            }),
          ),
        );
        this.packageBaseUrls.set(packageName, baseUrl);
        return baseUrl;
      } catch {
        // All probes failed — fall through to the bundled map (if not already
        // tried above) and then ReadTheDocs.
      }

      // If probing failed but we have a URL, maybe it's just the base?
      // But we need objects.inv.
      // Fallthrough to RTD.
    }

    // 4b. Bundled URL map as a *fallback*, not just an opt-in fast path.
    // useKnownDocsUrls=false (the default) means live discovery runs first for
    // freshness — but when live discovery genuinely finds nothing (as happens for
    // sites like Qt's docs, whose PyPI-listed homepage doesn't match any of the
    // probe patterns above), the curated map is strictly better than guessing
    // ReadTheDocs blindly, which is almost always wrong for non-RTD-hosted projects.
    // Root-package lookup also covers dotted submodule names (e.g. "PySide6.QtCore")
    // that wouldn't match an exact-key entry keyed on just the top-level package.
    if (!this.useKnownDocsUrls) {
      const knownUrl = this.lookupKnownDocsUrl(packageName);
      if (knownUrl) {
        this.packageBaseUrls.set(packageName, knownUrl);
        return knownUrl;
      }
    }

    // 5. ReadTheDocs Fallback — this is an unverified guess (readthedocs.io/en/<pkg>
    // isn't a real convention any package is guaranteed to follow), so confirm it
    // actually has an objects.inv before committing to it. Packages with no
    // discoverable Sphinx docs anywhere (Doxygen-only sites, no hosted docs, unusual
    // hosting, …) all end up here identically and fail this same quick check —
    // there's no need to special-case any of them by name.
    const versionSegment = version ? version : "latest";
    const guessedBase = `https://${packageName}.readthedocs.io/en/${versionSegment}`;
    const verifiedUrl = await this.checkUrlExists(`${guessedBase}/objects.inv`);
    if (!verifiedUrl) {
      throw new Error(`No discoverable documentation for ${packageName}`);
    }
    return verifiedUrl.replace(/\/objects\.inv$/, "");
  }

  /** Returns the resolved final URL (after following redirects) if it exists, else null. */
  private checkUrlExists(url: string): Promise<string | null> {
    return httpHeadExists(this.normalizeToHttps(url), {
      timeoutMs: 3000,
      headers: DOCS_REQUEST_HEADERS,
      maxRedirects: 5,
      maxAttempts: 1,
    });
  }

  async findInInventory(key: DocKey): Promise<HoverDoc | null> {
    const packageName = key.package;
    const lookupKey = [
      packageName,
      key.version || "",
      key.isStdlib ? "1" : "0",
      key.module,
      key.qualname,
      key.name,
    ].join("|");
    if (this.inventoryLookupCache.has(lookupKey)) {
      return this.inventoryLookupCache.get(lookupKey) ?? null;
    }

    if (!this.isLikelyPythonPackageName(packageName)) {
      this.invalidPackageNames.add(packageName);
      this.inventoryLookupCache.set(lookupKey, null);
      return null;
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
      if (packageName === "builtins") {
        const simpleName = key.qualname.replace(/^builtins\./, "");
        if (packageInventory.has(simpleName)) {
          const builtinSimple = packageInventory.get(simpleName)!;
          this.inventoryLookupCache.set(lookupKey, builtinSimple);
          return builtinSimple;
        }

        // Also try without any prefix if name has one
        const nameSimple = key.name.replace(/^builtins\./, "");
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
      if (key.name.includes(".")) {
        const nameParts = key.name.split(".");
        for (let i = nameParts.length - 2; i >= 1; i--) {
          const suffix = nameParts.slice(i).join(".");
          const candidate = `${packageName}.${suffix}`;
          if (packageInventory.has(candidate)) {
            getEngineLogger().log(
              `Inventory: Strategy 5 matched ${key.name} → ${candidate}`,
            );
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
      if (key.qualname && !key.qualname.includes(".") && key.module) {
        const moduleDepth = key.module.split(".").length;
        if (moduleDepth >= 2) {
          const dotQual = `.${key.qualname}`;
          const candidates: Array<{
            name: string;
            doc: HoverDoc;
            depth: number;
          }> = [];
          for (const [entryName, doc] of packageInventory) {
            if (
              entryName.endsWith(dotQual) &&
              entryName.startsWith(packageName + ".")
            ) {
              const entryParts = entryName.split(".");
              if (entryParts.length <= 3) {
                candidates.push({
                  name: entryName,
                  doc,
                  depth: entryParts.length,
                });
              }
            }
          }
          if (candidates.length === 1) {
            getEngineLogger().log(
              `Inventory: Strategy 6 matched ${key.name} → ${candidates[0].name}`,
            );
            this.inventoryLookupCache.set(lookupKey, candidates[0].doc);
            return candidates[0].doc;
          } else if (candidates.length > 1) {
            candidates.sort(
              (a, b) => a.depth - b.depth || a.name.length - b.name.length,
            );
            getEngineLogger().log(
              `Inventory: Strategy 6 matched ${key.name} → ${candidates[0].name} (${candidates.length} candidates)`,
            );
            this.inventoryLookupCache.set(lookupKey, candidates[0].doc);
            return candidates[0].doc;
          }
        }
      }
    }

    this.inventoryLookupCache.set(lookupKey, null);
    return null;
  }

  private async loadInventory(
    packageName: string,
    version?: string,
    isStdlib?: boolean,
  ): Promise<void> {
    const inventoryCacheName = this.getInventoryCacheName(
      packageName,
      isStdlib,
    );
    // Stdlib docs genuinely differ per Python version (docs.python.org/3.10 vs 3.12),
    // so — now that the disk cache root is shared across interpreters/workspaces
    // rather than segmented by interpreter path — the stdlib entry must fold the
    // Python version into its own cache key, or switching interpreters would silently
    // keep serving whichever version's inventory was fetched first.
    const versionSegment = version || (isStdlib ? this.pythonVersion : "latest");
    const cacheKey = `inventory:${inventoryCacheName}:${versionSegment}`;

    // 1. Try Disk Cache
    const cached = this.diskCache.get(cacheKey);
    if (cached) {
      try {
        const data = JSON.parse(cached) as Record<string, HoverDoc>;
        const docsProvider = await this.resolveDocsProviderForPackage(
          packageName,
          version,
          isStdlib,
        );
        const inventory = this.sanitizeInventory(
          new Map<string, HoverDoc>(
            Object.entries(data).map(([name, doc]) => [
              name,
              doc?.source === ResolutionSource.Corpus
                ? {
                    ...doc,
                    metadata: {
                      ...(doc.metadata ?? {}),
                      docsProvider,
                    },
                  }
                : doc,
            ]),
          ),
        );
        this.cache.set(inventoryCacheName, inventory);
        if (packageName !== inventoryCacheName) {
          this.cache.set(packageName, inventory);
        }
        this.invalidateDerivedCaches();

        // Restore the base URL so module-overview hovers can build a Docs link.
        // When loading from disk cache we return early and never call resolveBaseUrl,
        // so packageBaseUrls would stay empty without this.
        if (
          !this.packageBaseUrls.has(packageName) &&
          !this.packageBaseUrls.has(inventoryCacheName)
        ) {
          const knownUrl = this.lookupKnownDocsUrl(packageName);
          if (knownUrl) {
            this.packageBaseUrls.set(inventoryCacheName, knownUrl);
            this.packageBaseUrls.set(packageName, knownUrl);
          } else if (
            isStdlib ||
            packageName === "builtins" ||
            packageName === "python"
          ) {
            const stdlibUrl = `https://docs.python.org/${this.pythonVersion}`;
            this.packageBaseUrls.set(inventoryCacheName, stdlibUrl);
            this.packageBaseUrls.set(packageName, stdlibUrl);
          }
        }

        getEngineLogger().log(
          `Loaded inventory for ${packageName} from disk cache`,
        );
        return;
      } catch (e) {
        getEngineLogger().log(
          `Failed to parse cached inventory for ${packageName}`,
        );
      }
    }

    // DiskCache.get() already returns null once an `inv-fail:` entry is older than
    // the configured inventoryDays TTL, so a truthy result here is always still fresh —
    // no need to separately parse/compare a stored timestamp against a second, hardcoded
    // TTL that used to be disconnected from the user-configured inventoryDays setting.
    const negKey = `inv-fail:${inventoryCacheName}`;
    const negCached = this.diskCache.get(negKey);
    if (negCached) {
      this.failedDiscoveries.add(inventoryCacheName);
      this.failedDiscoveries.add(packageName);
      const empty = new Map<string, HoverDoc>();
      this.cache.set(inventoryCacheName, empty);
      if (packageName !== inventoryCacheName) {
        this.cache.set(packageName, empty);
      }
      return;
    }

    // 2. Fetch from Network
    if (!this.allowNetwork) {
      getEngineLogger().log(
        `Network disabled, skipping inventory fetch for ${packageName}`,
      );
      const empty = new Map<string, HoverDoc>();
      this.cache.set(inventoryCacheName, empty);
      if (packageName !== inventoryCacheName) {
        this.cache.set(packageName, empty);
      }
      return;
    }

    // `inventoryUrl` starts empty so the catch block below can safely reference it
    // (in its log message and canonical-URL check) even when resolveBaseUrl itself
    // is what threw, before any URL was ever computed.
    let inventoryUrl = "";

    try {
      const baseUrl = await this.resolveBaseUrl(packageName, version, isStdlib);
      inventoryUrl = this.buildInventoryUrl(packageName, baseUrl);
      const buffer = await this.fetchBuffer(inventoryUrl);
      const docsProvider = await this.resolveDocsProvider(baseUrl);
      const inventory = this.sanitizeInventory(
        this.parser.parse(buffer, baseUrl, docsProvider),
      );
      this.failedDiscoveries.delete(inventoryCacheName);
      this.failedDiscoveries.delete(packageName);
      this.cache.set(inventoryCacheName, inventory);
      if (packageName !== inventoryCacheName) {
        this.cache.set(packageName, inventory);
      }
      this.invalidateDerivedCaches();
      this.packageBaseUrls.set(inventoryCacheName, baseUrl);
      this.packageBaseUrls.set(packageName, baseUrl);
      getEngineLogger().log(
        `Loaded inventory for ${packageName}: ${inventory.size} items`,
      );

      // 3. Save to Disk Cache
      const obj = Object.fromEntries(inventory);
      this.diskCache.set(cacheKey, JSON.stringify(obj));
    } catch (e) {
      if (!this.failedInventoryLog.has(packageName)) {
        this.failedInventoryLog.add(packageName);
        getEngineLogger().log(
          `Failed to load inventory for ${packageName} from ${inventoryUrl}: ${e}`,
        );
      }

      // For stdlib, retry with the canonical /3/ URL in case the versioned URL
      // is unavailable (e.g. pre-release Python where docs aren't published yet).
      let isPythonDocsCanonical = false;
      try {
        const parsed = new URL(inventoryUrl);
        isPythonDocsCanonical =
          parsed.hostname === "docs.python.org" &&
          parsed.pathname.startsWith("/3/");
      } catch {
        /* non-URL format */
      }
      if (isStdlib && !isPythonDocsCanonical) {
        const fallbackBase = "https://docs.python.org/3";
        const fallbackUrl = `${fallbackBase}/objects.inv`;
        try {
          getEngineLogger().log(
            `Retrying stdlib inventory with canonical URL: ${fallbackUrl}`,
          );
          const buffer = await this.fetchBuffer(fallbackUrl);
          const docsProvider = await this.resolveDocsProvider(
            fallbackBase,
          ).catch((): "sphinx" => "sphinx");
          const inventory = this.sanitizeInventory(
            this.parser.parse(buffer, fallbackBase, docsProvider),
          );
          this.failedDiscoveries.delete(inventoryCacheName);
          this.failedDiscoveries.delete(packageName);
          this.cache.set(inventoryCacheName, inventory);
          if (packageName !== inventoryCacheName) {
            this.cache.set(packageName, inventory);
          }
          this.invalidateDerivedCaches();
          this.packageBaseUrls.set(inventoryCacheName, fallbackBase);
          this.packageBaseUrls.set(packageName, fallbackBase);
          getEngineLogger().log(
            `Loaded stdlib inventory from canonical URL: ${inventory.size} items`,
          );
          const obj = Object.fromEntries(inventory);
          this.diskCache.set(cacheKey, JSON.stringify(obj));
          return;
        } catch (fallbackErr) {
          getEngineLogger().log(
            `Canonical stdlib inventory also failed: ${fallbackErr}`,
          );
        }
      }

      const empty = new Map<string, HoverDoc>();
      this.cache.set(inventoryCacheName, empty);
      if (packageName !== inventoryCacheName) {
        this.cache.set(packageName, empty);
      }
      this.invalidateDerivedCaches();
      this.failedDiscoveries.add(inventoryCacheName);
      this.failedDiscoveries.add(packageName);
      this.diskCache.set(negKey, Date.now().toString());
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

  getSuggestedBaseUrl(
    packageName: string,
    isStdlib?: boolean,
  ): string | undefined {
    if (isStdlib || packageName === "builtins" || packageName === "python") {
      const stdlibUrl = `https://docs.python.org/${this.pythonVersion}`;
      this.packageBaseUrls.set(packageName, stdlibUrl);
      return stdlibUrl;
    }

    const cached = this.packageBaseUrls.get(packageName);
    if (cached) {
      return cached;
    }

    const knownUrl = this.lookupKnownDocsUrl(packageName);
    if (knownUrl) {
      this.packageBaseUrls.set(packageName, knownUrl);
      return knownUrl;
    }

    return undefined;
  }

  /**
   * Returns up to `limit` notable export names from a loaded inventory.
   * Prefers short (top-level), public (no underscore) names, classes first.
   */
  getModuleExports(
    packageName: string,
    limit = 16,
    moduleName = packageName,
  ): string[] {
    const inventory = this.cache.get(packageName);
    if (!inventory) {
      return [];
    }

    const seen = new Set<string>();
    const entries: Array<{ label: string; depth: number; kindScore: number }> =
      [];

    for (const [name, doc] of inventory) {
      const normalizedName = name.replace(/^builtins\./, '');
      const modulePrefix = `${moduleName}.`;
      if (
        normalizedName !== moduleName &&
        !normalizedName.startsWith(modulePrefix)
      ) {
        continue;
      }
      if (normalizedName === moduleName) {
        continue;
      }
      const relativeName = normalizedName.startsWith(modulePrefix)
        ? normalizedName.slice(modulePrefix.length)
        : normalizedName;
      const parts = relativeName.split(".");
      // "Key exports" means names available directly from the module. Nested
      // methods and exception attributes remain searchable in the browser but
      // should not fill this concise preview.
      if (parts.length !== 1) {
        continue;
      }
      const label = parts[parts.length - 1];
      if (!label || label.startsWith("_")) {
        continue;
      }
      // Skip C-extension macros / constants: all-caps with underscores (e.g. NPY_ARRAY_C_CONTIGUOUS)
      if (/^[A-Z][A-Z0-9_]{2,}$/.test(label)) {
        continue;
      }
      if (seen.has(label)) {
        continue;
      }
      seen.add(label);
      const kindScore =
        doc.kind === "class" ? 0 : doc.kind === "function" ? 1 : 2;
      entries.push({ label, depth: parts.length, kindScore });
    }

    return entries
      .sort((a, b) =>
        a.depth !== b.depth ? a.depth - b.depth : a.kindScore - b.kindScore,
      )
      .slice(0, limit)
      .map((e) => e.label);
  }

  /** Total number of indexed symbols for a loaded package. */
  getPackageExportCount(
    packageName: string,
    moduleName = packageName,
  ): number {
    const inventory = this.cache.get(packageName);
    if (!inventory) return 0;
    const modulePrefix = `${moduleName}.`;
    let count = 0;
    for (const name of inventory.keys()) {
      const normalizedName = name.replace(/^builtins\./, '');
      if (
        normalizedName === moduleName ||
        normalizedName.startsWith(modulePrefix)
      ) {
        count += 1;
      }
    }
    return count;
  }

  searchSymbols(query: string): IndexedSymbolSummary[] {
    const q = query.toLowerCase().trim();
    if (!q) {
      return [];
    }
    const cached = this.searchCache.get(q);
    if (cached) {
      return cached;
    }
    const results: IndexedSymbolSummary[] = [];
    const seen = new Set<string>();
    for (const [pkg, inventory] of this.cache) {
      for (const [name, doc] of inventory) {
        if (name.toLowerCase().includes(q)) {
          const key = `${name}|${doc.url || ""}|${doc.kind || "symbol"}`;
          if (seen.has(key)) {
            continue;
          }
          seen.add(key);
          results.push(this.toIndexedSymbolSummary(name, doc, pkg));
        }
      }
    }
    const finalResults = results
      .sort((a, b) => {
        const aq = a.name.toLowerCase(),
          bq = b.name.toLowerCase();
        if (aq === q && bq !== q) {
          return -1;
        }
        if (bq === q && aq !== q) {
          return 1;
        }
        if (aq.startsWith(q) && !bq.startsWith(q)) {
          return -1;
        }
        if (bq.startsWith(q) && !aq.startsWith(q)) {
          return 1;
        }
        if (a.name.length !== b.name.length) {
          return a.name.length - b.name.length;
        }
        return a.name.localeCompare(b.name);
      })
      .slice(0, 200);
    this.searchCache.set(q, finalResults);
    return finalResults;
  }

  findSymbolReference(reference: {
    label: string;
    url?: string;
    currentModule?: string;
    currentPackage?: string;
    currentTitle?: string;
  }): IndexedSymbolSummary | null {
    const label = reference.label.trim();
    const url = reference.url?.trim();
    if (!label && !url) {
      return null;
    }

    const preferredPackage = reference.currentPackage?.trim();
    const currentModule = reference.currentModule?.trim();
    const currentOwner = this.extractOwnerName(reference.currentTitle);
    const candidateInventories =
      preferredPackage && this.cache.has(preferredPackage)
        ? [
            [preferredPackage, this.cache.get(preferredPackage)!] as const,
            ...[...this.cache.entries()].filter(
              ([pkg]) => pkg !== preferredPackage,
            ),
          ]
        : [...this.cache.entries()];

    let best: { score: number; summary: IndexedSymbolSummary } | null = null;
    for (const [pkg, inventory] of candidateInventories) {
      for (const [name, doc] of inventory) {
        const score = this.scoreReferenceCandidate({
          label,
          url,
          currentModule,
          currentOwner,
          preferredPackage,
          packageName: pkg,
          name,
          doc,
        });
        if (score <= 0) {
          continue;
        }

        const summary = this.toIndexedSymbolSummary(name, doc, pkg);
        if (
          !best ||
          score > best.score ||
          (score === best.score &&
            summary.name.length < best.summary.name.length)
        ) {
          best = { score, summary };
        }
      }
    }

    return best?.summary ?? null;
  }

  getModuleSymbols(
    moduleName: string,
    maxSymbols = 5000,
  ): IndexedSymbolSummary[] {
    const normalized = moduleName.trim();
    if (!normalized) {
      return [];
    }

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
        if (!this.isModuleSymbolMatch(normalized, name, doc)) {
          continue;
        }
        const symbolKey = `${name}|${doc.url || ""}|${doc.kind || "symbol"}`;
        if (seen.has(symbolKey)) {
          continue;
        }
        seen.add(symbolKey);
        results.push(this.toIndexedSymbolSummary(name, doc, pkg));
      }
    }

    const finalResults = results
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, maxSymbols);
    this.moduleSymbolsCache.set(cacheKey, finalResults);
    return finalResults;
  }

  private isModuleSymbolMatch(
    moduleName: string,
    symbolName: string,
    doc: HoverDoc,
  ): boolean {
    if (symbolName === moduleName || symbolName.startsWith(`${moduleName}.`)) {
      return true;
    }

    const docModule = doc.module?.trim();
    if (docModule === moduleName) {
      return true;
    }

    const title = doc.title?.trim().replace(/^builtins\./, "");
    if (title === moduleName || title?.startsWith(`${moduleName}.`)) {
      return true;
    }

    return false;
  }

  getIndexedPackages(): string[] {
    if (this.indexedPackagesCache) {
      return this.indexedPackagesCache;
    }

    this.indexedPackagesCache = [...this.cache.keys()]
      .filter((name) => name !== InventoryFetcher.STDLIB_INVENTORY_CACHE)
      .filter((name) => !this.invalidPackageNames.has(name))
      .filter((name) => this.isLikelyPythonPackageName(name))
      .sort((a, b) => a.localeCompare(b));
    return this.indexedPackagesCache;
  }

  getIndexedPackageSummaries(): Array<{ name: string; count: number }> {
    if (this.indexedPackageSummariesCache) {
      return this.indexedPackageSummariesCache;
    }

    this.indexedPackageSummariesCache = this.getIndexedPackages().map(
      (name) => ({
        name,
        count: this.cache.get(name)?.size ?? 0,
      }),
    );
    return this.indexedPackageSummariesCache;
  }

  private toIndexedSymbolSummary(
    name: string,
    doc: HoverDoc,
    pkg: string,
  ): IndexedSymbolSummary {
    return {
      name,
      url: doc.url || "",
      kind: doc.kind || "symbol",
      package: pkg,
      title: doc.title || name,
      module: doc.module,
      signature: doc.signature,
      summary: this.extractPreviewText(doc),
      sourceUrl: doc.sourceUrl,
    };
  }

  private extractOwnerName(title?: string): string | undefined {
    const normalized = title?.trim().replace(/^builtins\./, "");
    if (!normalized) {
      return undefined;
    }

    const parts = normalized.split(".").filter(Boolean);
    if (parts.length < 2) {
      return undefined;
    }
    return parts[parts.length - 2];
  }

  private scoreReferenceCandidate(candidate: {
    label: string;
    url?: string;
    currentModule?: string;
    currentOwner?: string;
    preferredPackage?: string;
    packageName: string;
    name: string;
    doc: HoverDoc;
  }): number {
    const {
      label,
      url,
      currentModule,
      currentOwner,
      preferredPackage,
      packageName,
      name,
      doc,
    } = candidate;
    const normalizedLabel = label.toLowerCase();
    const normalizedName = name.toLowerCase();
    const normalizedTitle = (doc.title || "").toLowerCase();
    const leaf = normalizedName.split(".").pop() || normalizedName;
    const titleLeaf = normalizedTitle.split(".").pop() || normalizedTitle;
    let score = 0;

    if (url && doc.url === url) {
      score = Math.max(score, 1000);
    }
    if (url && doc.url?.split("#")[0] === url.split("#")[0]) {
      score = Math.max(score, 550);
    }

    if (!normalizedLabel) {
      return score;
    }

    if (
      normalizedName === normalizedLabel ||
      normalizedTitle === normalizedLabel
    ) {
      score = Math.max(score, 900);
    }

    if (
      currentModule &&
      normalizedName === `${currentModule.toLowerCase()}.${normalizedLabel}`
    ) {
      score = Math.max(score, 850);
    }

    if (
      currentOwner &&
      normalizedName.endsWith(
        `.${currentOwner.toLowerCase()}.${normalizedLabel}`,
      )
    ) {
      score = Math.max(score, 800);
    }

    if (leaf === normalizedLabel || titleLeaf === normalizedLabel) {
      score = Math.max(
        score,
        preferredPackage && packageName === preferredPackage ? 760 : 680,
      );
    }

    if (
      normalizedName.endsWith(`.${normalizedLabel}`) ||
      normalizedTitle.endsWith(`.${normalizedLabel}`)
    ) {
      score = Math.max(
        score,
        preferredPackage && packageName === preferredPackage ? 640 : 520,
      );
    }

    if (preferredPackage && packageName === preferredPackage) {
      score += 25;
    }

    return score;
  }

  private extractPreviewText(doc: HoverDoc): string | undefined {
    const candidate =
      doc.summary ||
      doc.structuredContent?.summary ||
      doc.structuredContent?.description ||
      doc.content;
    const cleaned = candidate
      ?.replace(/```[\s\S]*?```/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleaned) {
      return undefined;
    }
    if (
      cleaned.startsWith("Documentation for") ||
      cleaned.startsWith("Documentation from") ||
      cleaned === "No documentation found." ||
      cleaned === "Documentation lookup failed."
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
    for (const inv of this.cache.values()) {
      n += inv.size;
    }
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
    if (!inventory) {
      return [];
    }

    const pages = new Set<string>();
    for (const doc of inventory.values()) {
      if (!doc.url) {
        continue;
      }
      const pageUrl = doc.url.split("#")[0];
      if (!pageUrl || this.shouldSkipCorpusPageUrl(pageUrl)) {
        continue;
      }
      if (pageUrl) {
        pages.add(pageUrl);
      }
      if (pages.size >= maxPages) {
        break;
      }
    }

    return [...pages];
  }

  getPackageSymbolTargets(
    packageName: string,
    maxTargets = 20_000,
  ): Array<{ corpusPackage: string; url: string }> {
    const inventory = this.cache.get(packageName);
    if (!inventory) {
      return [];
    }

    const targets: Array<{ corpusPackage: string; url: string }> = [];
    const seen = new Set<string>();

    for (const [name, doc] of inventory) {
      if (!doc.url || this.shouldSkipCorpusPageUrl(doc.url.split("#")[0])) {
        continue;
      }

      const corpusPackage = name.includes(".")
        ? name.split(".")[0]
        : packageName;
      const targetKey = `${corpusPackage}:${doc.url}`;
      if (seen.has(targetKey)) {
        continue;
      }
      seen.add(targetKey);
      targets.push({ corpusPackage, url: doc.url });
      if (targets.length >= maxTargets) {
        break;
      }
    }

    return targets;
  }

  private shouldSkipCorpusPageUrl(url: string): boolean {
    return InventoryFetcher.CORPUS_META_PAGE_PATTERNS.some((pattern) =>
      pattern.test(url),
    );
  }

  private fetchBuffer(
    url: string,
    redirectCount = 0,
    attempt = 0,
  ): Promise<Buffer> {
    void redirectCount;
    void attempt;
    return httpGetBuffer(this.normalizeToHttps(url), {
      timeoutMs: 5000,
      headers: DOCS_REQUEST_HEADERS,
      maxRedirects: 5,
      maxAttempts: 2,
    });
  }
}
