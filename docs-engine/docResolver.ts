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
        this.pypiClient = new PyPiClient();
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

    async resolve(key: DocKey): Promise<HoverDoc> {
        try {
            // 0. Static Data (Fastest, Offline)
            const staticDoc = this.staticResolver.resolve(key);
            if (staticDoc) {
                return staticDoc;
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

            // 2. PyPI Docs / Homepage (Always fetch for links)
            let pypiDoc: HoverDoc | null = null;
            if (this.config?.onlineDiscovery !== false) {
                try {
                    pypiDoc = await this.pypiClient.findDocs(key);
                } catch (e) {
                    // Log but don't fail - continue with other sources
                    Logger.log(`PyPI fetch failed for ${key.name}: ${e}`);
                }
            }

            if (inventoryDoc) {
                // Try to scrape content if URL is available
                let scrapedContent: string | undefined;
                if (inventoryDoc.url && this.config?.onlineDiscovery !== false) {
                    const content = await this.scraper.fetchContent(inventoryDoc.url);
                    if (content) {
                        scrapedContent = content;
                    }
                }

                // Merge PyPI links into Inventory doc so we get the best of both worlds:
                // Specific deep-link from Sphinx, and project metadata from PyPI.
                const links = pypiDoc?.links || {};
                links['DevDocs'] = this.fallback.getDevDocsUrl(key);
                if (inventoryDoc.url) {
                    links['Documentation'] = inventoryDoc.url;
                }

                return {
                    ...inventoryDoc,
                    content: scrapedContent || inventoryDoc.content, // Prefer scraped content
                    source: ResolutionSource.Sphinx,
                    confidence: 1.0,
                    links: links
                };
            }

            // 3. PyPI Docs / Homepage (Fallback if no Sphinx)
            if (pypiDoc) {
                const links = pypiDoc.links || {};
                links['DevDocs'] = this.fallback.getDevDocsUrl(key);
                return { ...pypiDoc, links, source: ResolutionSource.PyPI, confidence: 0.8 };
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
