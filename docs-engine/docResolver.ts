import { Logger } from '../extension/src/logger';
import { DocKey, HoverDoc, ResolutionSource } from '../shared/types';
import { InventoryFetcher } from './inventory/inventoryFetcher';
import { PyPiClient } from './pypi/pypiClient';
import { SearchFallback } from './searchFallback';
import { DiskCache } from './src/cache/diskCache';
import { StaticDocResolver } from './src/resolvers/staticDocResolver';
import { SphinxScraper } from './src/scraping/sphinxScraper';

export interface ResolverConfig {
    cacheTTL?: {
        inventoryDays: number;
        snippetHours: number;
    };
    requestTimeout?: number;
    customLibraries?: any[];
    onlineDiscovery?: boolean;
}

export class DocResolver {
    private inventoryFetcher: InventoryFetcher;
    private pypiClient: PyPiClient;
    private fallback: SearchFallback;
    private scraper: SphinxScraper;
    private staticResolver: StaticDocResolver;

    constructor(diskCache: DiskCache, config?: ResolverConfig) {
        this.inventoryFetcher = new InventoryFetcher(
            diskCache,
            '3',
            config?.customLibraries || [],
            config?.onlineDiscovery !== false // Default to true
        );
        this.pypiClient = new PyPiClient(diskCache);
        this.fallback = new SearchFallback();
        this.scraper = new SphinxScraper(diskCache, config?.requestTimeout || 5000);
        this.staticResolver = new StaticDocResolver();
        this.config = config;
    }

    private config?: ResolverConfig;

    setPythonVersion(version: string) {
        this.inventoryFetcher.setPythonVersion(version);
        this.staticResolver.setPythonVersion(version);
    }

    /** Start background inventory loads for the most common packages. */
    warmupInventories(): void {
        this.inventoryFetcher.warmup();
    }

    searchSymbols(query: string) {
        return this.inventoryFetcher.searchSymbols(query);
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
            const version = this.inventoryFetcher['pythonVersion'] || '3';
            url = `https://docs.python.org/${version}/library/${packageName}.html`;
        }

        return {
            title: packageName,
            kind: 'module',
            summary,
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
            if (staticDoc) {
                return { ...staticDoc, devdocsUrl: this.fallback.getDevDocsUrl(key) ?? undefined };
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

            // 2. PyPI metadata + Sphinx scraping in parallel (both only if online discovery enabled)
            let pypiDoc: HoverDoc | null = null;
            let scrapedContent: string | undefined;

            // Never query PyPI for stdlib symbols — backport packages on PyPI (e.g. the
            // `typing` backport) have unrelated summaries that would be shown as content.
            const isStdlib = key.isStdlib || key.package === 'builtins';

            let seeAlso: string[] = [];

            if (this.config?.onlineDiscovery !== false) {
                const [pypiResult, scraped, seeAlsoResult] = await Promise.all([
                    !isStdlib
                        ? this.pypiClient.findDocs(key).catch(e => {
                            Logger.log(`PyPI fetch failed for ${key.name}: ${e}`);
                            return null;
                        })
                        : Promise.resolve(null),
                    inventoryDoc?.url
                        ? this.scraper.fetchContent(inventoryDoc.url).catch(e => {
                            Logger.log(`Scrape failed for ${inventoryDoc!.url}: ${e}`);
                            return null;
                        })
                        : Promise.resolve(null),
                    inventoryDoc?.url
                        ? this.scraper.fetchSeeAlso(inventoryDoc.url).catch(() => [] as string[])
                        : Promise.resolve([] as string[]),
                ]);
                pypiDoc = pypiResult;
                scrapedContent = scraped ?? undefined;
                seeAlso = seeAlsoResult;
            }

            if (inventoryDoc) {
                // Use PyPI one-line summary as fallback when scraping returns nothing.
                // Inventory content is a placeholder ("Documentation from Sphinx Inventory…")
                // that the builder will strip — treat it as absent for this purpose.
                const pypiSummary = pypiDoc?.summary;
                const isInventoryPlaceholder = inventoryDoc.content?.startsWith('Documentation from');
                const finalContent = scrapedContent || (!isInventoryPlaceholder ? inventoryDoc.content : undefined) || pypiSummary;

                return {
                    ...inventoryDoc,
                    content: finalContent,
                    summary: inventoryDoc.summary || pypiSummary,
                    source: ResolutionSource.Sphinx,
                    confidence: 1.0,
                    links: pypiDoc?.links,
                    devdocsUrl: this.fallback.getDevDocsUrl(key) ?? undefined,
                    seeAlso: seeAlso.length > 0 ? seeAlso : undefined,
                    module: key.module || key.package,
                };
            }

            // 3. PyPI Docs / Homepage (Fallback if no Sphinx)
            if (pypiDoc) {
                return {
                    ...pypiDoc,
                    source: ResolutionSource.PyPI,
                    confidence: 0.8,
                    devdocsUrl: this.fallback.getDevDocsUrl(key) ?? undefined,
                };
            }

            // 3. Fallback Search (DevDocs, etc.)
            const fallbackDoc = await this.fallback.search(key);
            if (fallbackDoc) {
                return { ...fallbackDoc, source: ResolutionSource.Fallback, confidence: 0.5 };
            }

            // 4. Return empty/unknown if nothing found
            return {
                title: key.name,
                content: 'No documentation found.',
                source: ResolutionSource.Fallback,
                confidence: 0.0
            };
        } catch (e) {
            // Top-level error boundary - never let resolve() throw
            Logger.error(`DocResolver.resolve failed for ${key.name}`, e);
            return {
                title: key.name,
                content: 'Documentation lookup failed.',
                source: ResolutionSource.Fallback,
                confidence: 0.0
            };
        }
    }
}
