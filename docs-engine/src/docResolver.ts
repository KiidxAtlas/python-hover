import { Logger } from '../../extension/src/logger';
import { DocKey, HoverDoc, ResolutionSource } from '../../shared/types';
import { DiskCache } from './cache/diskCache';
import { InventoryFetcher } from './inventory/inventoryFetcher';
import { PyPiClient } from './pypi/pypiClient';
import { StaticDocResolver } from './resolvers/staticDocResolver';
import { StdlibCorpusResolver } from './resolvers/stdlibCorpusResolver';
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
}

export class DocResolver {
    private readonly inventoryFetcher: InventoryFetcher;
    private readonly pypiClient: PyPiClient;
    private readonly fallback: SearchFallback;
    private readonly scraper: SphinxScraper;
    private readonly staticResolver: StaticDocResolver;
    private readonly corpusResolver: StdlibCorpusResolver;
    private readonly config?: ResolverConfig;

    /** Packages whose full corpus build has already been triggered this session. */
    private readonly fullCorpusBuilt = new Set<string>();

    constructor(diskCache: DiskCache, config?: ResolverConfig) {
        this.inventoryFetcher = new InventoryFetcher(
            diskCache,
            '3',
            config?.customLibraries || [],
            config?.onlineDiscovery !== false
        );
        this.pypiClient = new PyPiClient(diskCache);
        this.fallback = new SearchFallback();
        this.scraper = new SphinxScraper(diskCache, config?.requestTimeout || 5000);
        this.staticResolver = new StaticDocResolver();
        this.corpusResolver = new StdlibCorpusResolver();
        this.config = config;
    }

    setPythonVersion(version: string) {
        this.inventoryFetcher.setPythonVersion(version);
        this.staticResolver.setPythonVersion(version);
        this.corpusResolver.setPythonVersion(version);
    }

    /** Start background inventory loads for the most common packages. */
    warmupInventories(packages?: string[]): void {
        this.inventoryFetcher.warmup(packages);
    }


    searchSymbols(query: string) {
        return this.inventoryFetcher.searchSymbols(query);
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
        // If we have rich content from the local disk cache (user's corpus), label
        // it "corpus".  Without content we only have raw inventory metadata → "sphinx".
        const source = content ? ResolutionSource.Corpus : ResolutionSource.Sphinx;
        return {
            ...inventoryDoc,
            content,
            summary,
            source,
            confidence: 1.0,
            links,
            devdocsUrl: this.fallback.getDevDocsUrl(key) ?? undefined,
            seeAlso: seeAlso && seeAlso.length > 0 ? seeAlso : undefined,
            module: key.module || key.package,
        };
    }

    private prefetchInventoryEnhancements(url?: string): void {
        if (!url) return;

        void this.scraper.fetchContent(url).catch(e => {
            Logger.log(`Background scrape failed for ${url}: ${e}`);
        });

        void this.scraper.fetchSeeAlso(url).catch(() => {
            // See-also data is non-critical; ignore failures.
        });
    }

    /**
     * Trigger a full background corpus build for `pkg` — scrapes every unique
     * documentation page in the package's inventory.  Runs at most once per
     * session per package regardless of how many times it is called.
     */
    private triggerFullCorpusBuild(pkg: string): void {
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
                    this.scraper.fetchContent(url).catch(() => { })
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
        if (url) {
            content = this.scraper.getCachedContent(url) ?? undefined;
            if (!content && this.config?.onlineDiscovery !== false) {
                this.prefetchInventoryEnhancements(url);
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
            source: moduleExports.length > 0 ? ResolutionSource.Sphinx : ResolutionSource.PyPI,
            confidence: 0.9,
            module: packageName,
            moduleExports: moduleExports.length > 0 ? moduleExports : undefined,
            exportCount: exportCount > 0 ? exportCount : undefined,
        };
    }

    async resolve(key: DocKey): Promise<HoverDoc> {
        try {
            // 0. Static Data (Fastest, Offline)
            const staticDoc = this.staticResolver.resolve(key);

            // 0.5. Prebuilt stdlib corpus — instant, offline, high-quality content
            // sourced from docs.python.org at build time.
            // Third-party packages build their own local cache via background scraping.
            if (key.isStdlib || key.package === 'builtins' || !key.package) {
                const corpusDoc = this.corpusResolver.resolve(key);
                if (corpusDoc && (corpusDoc.summary || corpusDoc.content)) {
                    const url = staticDoc?.url || corpusDoc.url;
                    return {
                        ...corpusDoc,
                        url,
                        devdocsUrl: this.fallback.getDevDocsUrl(key) ?? undefined,
                    };
                }
            }

            // 1. Sphinx objects.inv (Best)
            // Checks local cache first, then downloads if needed
            let inventoryDoc: HoverDoc | null = null;
            try {
                inventoryDoc = await this.inventoryFetcher.findInInventory(key);
            } catch (e) {
                // Log but don't fail - continue with other sources
                Logger.log(`Inventory fetch failed for ${key.name}: ${e}`);
            }

            // Fast return: static doc + inventory doc both found → use static URL with
            // inventory data.  Check the disk cache for previously scraped content (zero
            // network cost) so repeat hovers are richer.  If nothing is cached yet, kick
            // off a background scrape so the NEXT hover will have real content.
            if (staticDoc && inventoryDoc) {
                const bestUrl = staticDoc.url || inventoryDoc.url;
                const cachedContent = bestUrl
                    ? (this.scraper.getCachedContent(bestUrl) ?? undefined)
                    : undefined;

                if (this.config?.onlineDiscovery !== false) {
                    if (!cachedContent && bestUrl) {
                        this.prefetchInventoryEnhancements(bestUrl);
                    }
                    if (this.config?.buildFullCorpus && key.package) {
                        this.triggerFullCorpusBuild(key.package);
                    }
                }

                return {
                    ...inventoryDoc,
                    url: bestUrl,
                    content: cachedContent,
                    summary: inventoryDoc.summary || this.extractSummaryFromContent(cachedContent),
                    source: cachedContent ? ResolutionSource.Corpus : ResolutionSource.Sphinx,
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
                    ? (this.scraper.getCachedContent(staticDoc.url) ?? undefined)
                    : undefined;
                const cachedSeeAlsoForStatic = staticDoc.url
                    ? (this.scraper.getCachedSeeAlso(staticDoc.url) ?? undefined)
                    : undefined;

                if (!cachedContent && staticDoc.url && this.config?.onlineDiscovery !== false) {
                    this.prefetchInventoryEnhancements(staticDoc.url);
                }

                return {
                    ...staticDoc,
                    content: cachedContent,
                    summary: this.extractSummaryFromContent(cachedContent),
                    seeAlso: cachedSeeAlsoForStatic,
                    source: cachedContent ? ResolutionSource.Corpus : staticDoc.source,
                    devdocsUrl: this.fallback.getDevDocsUrl(key) ?? undefined,
                    module: key.module || key.package,
                };
            }

            const cachedScrapedContent = inventoryDoc?.url
                ? this.scraper.getCachedContent(inventoryDoc.url) ?? undefined
                : undefined;
            const cachedSeeAlso = inventoryDoc?.url
                ? this.scraper.getCachedSeeAlso(inventoryDoc.url) ?? undefined
                : undefined;

            if (inventoryDoc) {
                const inventoryContent = this.isPlaceholderContent(inventoryDoc.content)
                    ? undefined
                    : inventoryDoc.content;
                const immediateContent = cachedScrapedContent || inventoryContent;
                const immediateSummary = inventoryDoc.summary;

                if (this.config?.onlineDiscovery !== false) {
                    // Always fire background scrape if we don't have cached content yet
                    if (inventoryDoc.url && !cachedScrapedContent) {
                        this.prefetchInventoryEnhancements(inventoryDoc.url);
                    }
                    // Full corpus build: scrape every page in the package at once
                    if (this.config?.buildFullCorpus && key.package) {
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
                        return {
                            title: key.name,
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
