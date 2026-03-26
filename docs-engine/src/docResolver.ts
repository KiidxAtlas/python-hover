import { Logger } from '../../extension/src/logger';
import { DocKey, HoverDoc, ResolutionSource } from '../../shared/types';
import { DiskCache } from './cache/diskCache';
import { InventoryFetcher } from './inventory/inventoryFetcher';
import { PyPiClient } from './pypi/pypiClient';
import { StaticDocResolver } from './resolvers/staticDocResolver';
import { SphinxScraper } from './scraping/sphinxScraper';
import { SearchFallback } from './search/searchFallback';

export interface ResolverConfig {
    cacheTTL?: {
        inventoryDays: number;
        snippetHours: number;
    };
    requestTimeout?: number;
    customLibraries?: any[];
    onlineDiscovery?: boolean;
    /** When true, scrape the full documentation for each package in the background
     *  on first hover — builds the local corpus all at once instead of symbol-by-symbol. */
    buildFullCorpus?: boolean;
    /** When true, prefetch HTML and extract narrative content (default off). */
    enableDocScraping?: boolean;
    /** When true, use bundled KNOWN_DOCS_URLS in InventoryFetcher (faster). */
    useKnownDocsUrls?: boolean;
}

export class DocResolver {
    private readonly inventoryFetcher: InventoryFetcher;
    private readonly pypiClient: PyPiClient;
    private readonly fallback: SearchFallback;
    private readonly scraper: SphinxScraper;
    private readonly staticResolver: StaticDocResolver;
    private readonly config?: ResolverConfig;
    private readonly enableDocScraping: boolean;

    /** Packages whose full corpus build has already been triggered this session. */
    private readonly fullCorpusBuilt = new Set<string>();
    /** Deduplicate background scrape kicks for the same package + URL pair. */
    private readonly prefetchInFlight = new Set<string>();

    constructor(diskCache: DiskCache, config?: ResolverConfig) {
        this.inventoryFetcher = new InventoryFetcher(
            diskCache,
            '3',
            config?.customLibraries || [],
            config?.onlineDiscovery !== false,
            config?.useKnownDocsUrls === true,
        );
        this.pypiClient = new PyPiClient(diskCache);
        this.fallback = new SearchFallback();
        this.scraper = new SphinxScraper(diskCache, config?.requestTimeout || 5000);
        this.staticResolver = new StaticDocResolver();
        this.config = config;
        this.enableDocScraping = config?.enableDocScraping === true;
    }

    setPythonVersion(version: string) {
        this.inventoryFetcher.setPythonVersion(version);
        this.staticResolver.setPythonVersion(version);
    }

    /** Start background inventory loads for the most common packages. */
    warmupInventories(packages?: string[]): void {
        this.inventoryFetcher.warmup(packages);
    }


    searchSymbols(query: string) {
        return this.inventoryFetcher.searchSymbols(query);
    }

    private corpusPackageName(packageName?: string, moduleName?: string, symbolName?: string): string {
        const publicPackage = symbolName?.includes('.') ? symbolName.split('.')[0] : undefined;
        return publicPackage || packageName || moduleName?.split('.')[0] || 'python';
    }

    private shouldBuildCorpus(): boolean {
        return this.config?.onlineDiscovery !== false;
    }

    private shouldBuildFullCorpus(): boolean {
        return this.shouldBuildCorpus() && this.config?.buildFullCorpus === true;
    }

    private buildAlternateInventoryKeys(key: DocKey): DocKey[] {
        const keys = [key];
        const publicPackage = key.name.includes('.') ? key.name.split('.')[0] : undefined;

        if (publicPackage && publicPackage !== key.package) {
            keys.push({
                ...key,
                package: publicPackage,
            });
        }

        return keys;
    }

    private async resolveInventoryDoc(key: DocKey): Promise<HoverDoc | null> {
        for (const candidate of this.buildAlternateInventoryKeys(key)) {
            try {
                const doc = await this.inventoryFetcher.findInInventory(candidate);
                if (doc) {
                    return doc;
                }
            } catch (e) {
                Logger.log(`Inventory fetch failed for ${candidate.name}: ${e}`);
            }
        }

        return null;
    }

    private isPlaceholderContent(text?: string): boolean {
        if (!text) return false;
        return text.startsWith('Documentation from')
            || text.startsWith('Documentation for')
            || text === 'No documentation found.'
            || text === 'Documentation lookup failed.';
    }

    private hasUsefulText(text?: string, minLength = 32): boolean {
        const trimmed = text?.trim();
        if (!trimmed || this.isPlaceholderContent(trimmed)) return false;
        return trimmed.length >= minLength;
    }

    private extractSummaryFromContent(content?: string): string | undefined {
        const trimmed = content?.trim();
        if (!trimmed) return undefined;

        const paragraph = trimmed.split(/\n\s*\n/).find(part => part.trim().length > 0)?.trim();
        return paragraph || undefined;
    }

    private buildResolvedInventoryDoc(
        key: DocKey,
        inventoryDoc: HoverDoc,
        content?: string,
        summary?: string,
        seeAlso?: string[],
        links?: Record<string, string>,
    ): HoverDoc {
        return {
            ...inventoryDoc,
            content,
            summary: summary || this.extractSummaryFromContent(content),
            source: ResolutionSource.Corpus,
            confidence: 1.0,
            links,
            devdocsUrl: this.fallback.getDevDocsUrl(key) ?? undefined,
            seeAlso: seeAlso && seeAlso.length > 0 ? seeAlso : undefined,
            module: key.module || key.package,
        };
    }

    private prefetchInventoryEnhancements(packageName: string, url?: string): void {
        if (!url || !this.enableDocScraping) return;

        const prefetchKey = `${packageName}:${url}`;
        if (this.prefetchInFlight.has(prefetchKey)) return;
        this.prefetchInFlight.add(prefetchKey);

        void Promise.all([
            this.scraper.fetchContent(packageName, url).catch(e => {
                Logger.log(`Background scrape failed for ${url}: ${e}`);
            }),
            this.scraper.fetchSeeAlso(packageName, url).catch(() => {
            // See-also data is non-critical; ignore failures.
            }),
        ]).finally(() => {
            this.prefetchInFlight.delete(prefetchKey);
        });
    }

    private shouldUseImmediateBuiltinStaticPath(key: DocKey, staticDoc: HoverDoc | null): boolean {
        if (!staticDoc?.url) return false;
        if (key.package !== 'builtins' && key.module !== 'builtins') return false;
        return (key.qualname || key.name).replace(/^builtins\./, '').includes('.');
    }

    /**
     * Trigger a full background corpus build for `pkg` — scrapes every unique
     * documentation page in the package's inventory.  Runs at most once per
     * session per package regardless of how many times it is called.
     */
    private triggerFullCorpusBuild(pkg: string): void {
        if (!this.shouldBuildFullCorpus()) return;
        if (!pkg || this.fullCorpusBuilt.has(pkg)) return;
        this.fullCorpusBuilt.add(pkg);

        const urls = this.inventoryFetcher.getPackageSymbolUrls(pkg);
        if (urls.length === 0) return;

        Logger.log(`[corpus] Full build triggered for ${pkg}: ${urls.length} pages`);
        void this.scrapeUrlsThrottled(pkg, urls);
    }

    /** Scrape a list of page URLs in small concurrent batches with a delay between
     *  each batch to avoid overwhelming documentation servers. */
    private async scrapeUrlsThrottled(pkg: string, urls: string[]): Promise<void> {
        const BATCH = 3;
        const DELAY_MS = 300;

        for (let i = 0; i < urls.length; i += BATCH) {
            await Promise.all(
                urls.slice(i, i + BATCH).map(url =>
                    this.scraper.fetchContent(pkg, url).catch(() => { })
                )
            );
            if (i + BATCH < urls.length) {
                await new Promise<void>(resolve => setTimeout(resolve, DELAY_MS));
            }
        }

        Logger.log(`[corpus] Full build complete for ${pkg}`);
    }

    getIndexedSymbolCount() {
        return this.inventoryFetcher.getIndexedSymbolCount();
    }

    /**
     * Build a module overview HoverDoc — used when the user hovers an import line.
     * Loads the package inventory (if not already cached) then returns a card showing
     * the module description and its top exported names.
     */
    async resolveModuleOverview(packageName: string, isStdlib = false): Promise<HoverDoc> {
        const docKey: DocKey = {
            name: packageName,
            qualname: packageName,
            package: packageName,
            module: packageName,
            isStdlib,
        };

        // Trigger inventory load (no-op if already cached)
        try {
            await this.inventoryFetcher.findInInventory(docKey);
        } catch { /* swallow — we'll still show what we have */ }

        const moduleExports = this.inventoryFetcher.getModuleExports(packageName, 16);
        const exportCount = this.inventoryFetcher.getPackageExportCount(packageName);
        const baseUrl = this.inventoryFetcher.getPackageBaseUrl(packageName);

        // Get PyPI summary for third-party packages
        let summary: string | undefined;
        if (this.config?.onlineDiscovery !== false && !isStdlib) {
            try {
                const pypiDoc = await this.pypiClient.findDocs(docKey).catch(() => null);
                summary = pypiDoc?.summary;
            } catch { /* ignore */ }
        }

        // Derive a useful docs URL: prefer the package index page
        let url = baseUrl ? `${baseUrl}/index.html` : undefined;
        if (isStdlib) {
            const version = this.inventoryFetcher.getPythonVersion();
            url = `https://docs.python.org/${version}/library/${packageName}.html`;
        }

        // Use cached scraped content if available; otherwise fire background scrape
        let content: string | undefined;
        const corpusPackage = this.corpusPackageName(packageName, packageName, packageName);
        if (url) {
            content = this.scraper.getCachedContent(corpusPackage, url) ?? undefined;
            if (!content && this.config?.onlineDiscovery !== false && this.enableDocScraping) {
                this.prefetchInventoryEnhancements(corpusPackage, url);
            }
            summary = summary || this.extractSummaryFromContent(content);
        }

        return {
            title: packageName,
            kind: 'module',
            summary,
            content,
            url,
            devdocsUrl: this.fallback.getDevDocsUrl(docKey) ?? undefined,
            source: moduleExports.length > 0 ? ResolutionSource.Corpus : ResolutionSource.PyPI,
            confidence: 0.9,
            module: packageName,
            moduleExports: moduleExports.length > 0 ? moduleExports : undefined,
            exportCount: exportCount > 0 ? exportCount : undefined,
        };
    }

    async resolve(key: DocKey): Promise<HoverDoc> {
        try {
            const corpusPackage = this.corpusPackageName(key.package, key.module, key.name);
            // 0. Static Data (Fastest, Offline)
            const staticDoc = this.staticResolver.resolve(key);

            if (this.shouldUseImmediateBuiltinStaticPath(key, staticDoc)) {
                const builtinStaticDoc = staticDoc!;
                const cachedContent = builtinStaticDoc.url
                    ? (this.scraper.getCachedContent(corpusPackage, builtinStaticDoc.url) ?? undefined)
                    : undefined;
                const cachedSeeAlso = builtinStaticDoc.url
                    ? (this.scraper.getCachedSeeAlso(corpusPackage, builtinStaticDoc.url) ?? undefined)
                    : undefined;

                if (!cachedContent && builtinStaticDoc.url) {
                    this.prefetchInventoryEnhancements(corpusPackage, builtinStaticDoc.url);
                }

                return {
                    ...builtinStaticDoc,
                    content: cachedContent,
                    summary: this.extractSummaryFromContent(cachedContent),
                    seeAlso: cachedSeeAlso,
                    source: cachedContent ? ResolutionSource.Corpus : builtinStaticDoc.source,
                    devdocsUrl: this.fallback.getDevDocsUrl(key) ?? undefined,
                    module: key.module || key.package,
                };
            }

            // 1. Inventory lookup + corpus build
            // Inventory is only the symbol index / URL locator. Resolved docs should
            // come back through the corpus cache, not as a separate Sphinx source.
            const inventoryDoc = await this.resolveInventoryDoc(key);

            // Fast return: static doc + inventory doc both found → use static URL with
            // inventory data.  Check the disk cache for previously scraped content (zero
            // network cost) so repeat hovers are richer.  If nothing is cached yet, kick
            // off a background scrape so the NEXT hover will have real content.
            if (staticDoc && inventoryDoc) {
                const bestUrl = staticDoc.url || inventoryDoc.url;
                const cachedContent = bestUrl
                    ? (this.scraper.getCachedContent(corpusPackage, bestUrl) ?? undefined)
                    : undefined;
                const needsImmediateScrape = this.shouldBuildCorpus()
                    && !!bestUrl
                    && !this.hasUsefulText(inventoryDoc.summary)
                    && !this.hasUsefulText(cachedContent);
                const scrapedContent = needsImmediateScrape
                    ? await this.scraper.fetchContent(corpusPackage, bestUrl!).catch(() => null) ?? undefined
                    : undefined;
                const content = cachedContent || scrapedContent;

                if (this.shouldBuildCorpus()) {
                    if (!content && bestUrl) {
                        if (this.enableDocScraping) {
                            this.prefetchInventoryEnhancements(corpusPackage, bestUrl);
                        }
                    }
                    if (this.shouldBuildFullCorpus() && key.package) {
                        this.triggerFullCorpusBuild(key.package);
                    }
                }

                return {
                    ...inventoryDoc,
                    url: bestUrl,
                    content,
                    summary: inventoryDoc.summary || this.extractSummaryFromContent(content),
                    source: ResolutionSource.Corpus,
                    confidence: 1.0,
                    devdocsUrl: this.fallback.getDevDocsUrl(key) ?? undefined,
                    module: key.module || key.package,
                };
            }

            // Static match but no inventory — use cached scraped content if available,
            // otherwise return immediately with the static URL and fire background scrape
            // so the NEXT hover gets rich content.
            if (staticDoc && !inventoryDoc) {
                const cachedContent = staticDoc.url
                    ? (this.scraper.getCachedContent(corpusPackage, staticDoc.url) ?? undefined)
                    : undefined;
                const cachedSeeAlsoForStatic = staticDoc.url
                    ? (this.scraper.getCachedSeeAlso(corpusPackage, staticDoc.url) ?? undefined)
                    : undefined;
                const needsImmediateScrape = this.shouldBuildCorpus()
                    && !!staticDoc.url
                    && !this.hasUsefulText(cachedContent);
                const scrapedContent = needsImmediateScrape
                    ? await this.scraper.fetchContent(corpusPackage, staticDoc.url!).catch(() => null) ?? undefined
                    : undefined;
                const content = cachedContent || scrapedContent;

                if (!content && staticDoc.url && this.enableDocScraping) {
                    this.prefetchInventoryEnhancements(corpusPackage, staticDoc.url);
                }

                return {
                    ...staticDoc,
                    content,
                    summary: this.extractSummaryFromContent(content),
                    seeAlso: cachedSeeAlsoForStatic,
                    source: content ? ResolutionSource.Corpus : staticDoc.source,
                    devdocsUrl: this.fallback.getDevDocsUrl(key) ?? undefined,
                    module: key.module || key.package,
                };
            }

            const cachedScrapedContent = inventoryDoc?.url
                ? this.scraper.getCachedContent(corpusPackage, inventoryDoc.url) ?? undefined
                : undefined;
            const cachedSeeAlso = inventoryDoc?.url
                ? this.scraper.getCachedSeeAlso(corpusPackage, inventoryDoc.url) ?? undefined
                : undefined;

            if (inventoryDoc) {
                const inventoryContent = this.isPlaceholderContent(inventoryDoc.content)
                    ? undefined
                    : inventoryDoc.content;
                const needsImmediateScrape = this.shouldBuildCorpus()
                    && !!inventoryDoc.url
                    && !this.hasUsefulText(inventoryDoc.summary)
                    && !this.hasUsefulText(cachedScrapedContent)
                    && !this.hasUsefulText(inventoryContent);
                const scrapedContent = needsImmediateScrape
                    ? await this.scraper.fetchContent(corpusPackage, inventoryDoc.url!).catch(() => null) ?? undefined
                    : undefined;
                const immediateContent = cachedScrapedContent || inventoryContent || scrapedContent;
                const immediateSummary = inventoryDoc.summary || this.extractSummaryFromContent(immediateContent);

                if (this.shouldBuildCorpus()) {
                    // Always fire background scrape if we don't have cached content yet
                    if (inventoryDoc.url && !immediateContent) {
                        if (this.enableDocScraping) {
                            this.prefetchInventoryEnhancements(corpusPackage, inventoryDoc.url);
                        }
                    }
                    // Full corpus build: scrape every page in the package at once
                    if (this.shouldBuildFullCorpus() && key.package) {
                        this.triggerFullCorpusBuild(key.package);
                    }
                }

                // Return immediately with whatever we have — never block on scraping.
                // Background prefetch ensures the next hover gets richer content.
                return this.buildResolvedInventoryDoc(
                    key,
                    inventoryDoc,
                    immediateContent,
                    immediateSummary,
                    cachedSeeAlso,
                );
            }

            // 2. PyPI metadata (only if online discovery enabled, no inventory match)
            // Never query PyPI for stdlib symbols — backport packages on PyPI (e.g. the
            // `typing` backport) have unrelated summaries that would be shown as content.
            const isStdlib = key.isStdlib || key.package === 'builtins';

            if (this.config?.onlineDiscovery !== false && !isStdlib) {
                const pypiDoc = await this.pypiClient.findDocs(key).catch(e => {
                    Logger.log(`PyPI fetch failed for ${key.name}: ${e}`);
                    return null;
                });

                if (pypiDoc) {
                    // Only use PyPI data for package-level symbols.  For individual
                    // methods/classes the PyPI tagline describes the *package*, not
                    // the symbol, and would mislead the user.
                    const isPackageLevel = !key.qualname || key.qualname === key.package
                        || key.qualname === key.name;
                    if (isPackageLevel) {
                        return {
                            ...pypiDoc,
                            source: ResolutionSource.PyPI,
                            confidence: 0.8,
                            devdocsUrl: this.fallback.getDevDocsUrl(key) ?? undefined,
                        };
                    }
                    if (pypiDoc.links) {
                        const url = pypiDoc.url || Object.values(pypiDoc.links).find(value => typeof value === 'string' && value.trim().length > 0);
                        return {
                            title: key.name,
                            url,
                            source: ResolutionSource.PyPI,
                            confidence: 0.3,
                            links: pypiDoc.links,
                            devdocsUrl: this.fallback.getDevDocsUrl(key) ?? undefined,
                        };
                    }
                }
            }

            // 3. Fallback Search (DevDocs, etc.)
            const fallbackDoc = await this.fallback.search(key);
            if (fallbackDoc) {
                return { ...fallbackDoc, source: ResolutionSource.Fallback, confidence: 0.5 };
            }

            // 4. Return empty/unknown if nothing found
            return {
                title: key.name,
                source: ResolutionSource.Fallback,
                confidence: 0.0
            };
        } catch (e) {
            // Top-level error boundary - never let resolve() throw
            Logger.error(`DocResolver.resolve failed for ${key.name}`, e);
            return {
                title: key.name,
                source: ResolutionSource.Fallback,
                confidence: 0.0
            };
        }
    }
}
