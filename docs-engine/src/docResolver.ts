import { Logger } from '../../extension/src/logger';
import { DocKey, HoverDoc, IndexedSymbolSummary, ResolutionSource, StructuredHoverContent } from '../../shared/types';
import { DiskCache, PYHOVER_PYTHON_STDLIB_CORPUS_GROUP } from './cache/diskCache';
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

    getModuleSymbols(moduleName: string): IndexedSymbolSummary[] {
        return this.inventoryFetcher
            .getModuleSymbols(moduleName)
            .map(symbol => this.enrichIndexedSymbolSummary(symbol));
    }

    getIndexedPackages() {
        return this.inventoryFetcher.getIndexedPackages();
    }

    async hydrateCachedInventories(): Promise<string[]> {
        return this.inventoryFetcher.hydrateCachedInventories();
    }

    private enrichIndexedSymbolSummary(symbol: IndexedSymbolSummary): IndexedSymbolSummary {
        if ((!symbol.url || symbol.summary) && symbol.signature) {
            return symbol;
        }

        if (!symbol.url) {
            return symbol;
        }

        const corpusPackage = this.corpusPackageName(symbol.package, symbol.module, symbol.name);
        const corpusGroup = this.getCorpusGroupForIndexedSymbol(symbol);
        const cachedContent = this.scraper.getCachedContent(corpusPackage, symbol.url, corpusGroup) ?? undefined;
        const structuredContent = this.getStructuredContent(corpusPackage, symbol.url, corpusGroup, cachedContent);
        const summary = symbol.summary || this.extractSummaryFromStructuredOrContent(structuredContent, cachedContent);

        return {
            ...symbol,
            signature: symbol.signature || structuredContent?.signature,
            summary,
        };
    }

    private getCorpusGroupForIndexedSymbol(symbol: IndexedSymbolSummary): string | undefined {
        const root = symbol.package || symbol.name.split('.')[0] || '';
        const baseUrl = this.inventoryFetcher.getPackageBaseUrl(root) || this.inventoryFetcher.getPackageBaseUrl('builtins');
        return baseUrl?.includes('docs.python.org') ? PYHOVER_PYTHON_STDLIB_CORPUS_GROUP : undefined;
    }

    async buildPythonStdlibCorpus(
        onProgress?: (progress: { completed: number; total: number; current: string }) => void,
    ): Promise<{ targets: number; corpusPackages: number }> {
        await this.inventoryFetcher.ensurePackageLoaded('builtins', undefined, true);

        const targets = this.inventoryFetcher.getPackageSymbolTargets('builtins');
        const corpusPackages = new Set<string>();
        const BATCH = 4;
        let completed = 0;

        for (let i = 0; i < targets.length; i += BATCH) {
            const batch = targets.slice(i, i + BATCH);
            await Promise.all(batch.map(async target => {
                corpusPackages.add(target.corpusPackage);
                await this.scraper.fetchContent(target.corpusPackage, target.url, PYHOVER_PYTHON_STDLIB_CORPUS_GROUP, true).catch(() => null);
                await this.scraper.fetchSeeAlso(target.corpusPackage, target.url, PYHOVER_PYTHON_STDLIB_CORPUS_GROUP, true).catch(() => []);
                completed += 1;
                onProgress?.({ completed, total: targets.length, current: target.url });
            }));
        }

        return { targets: targets.length, corpusPackages: corpusPackages.size };
    }

    private corpusPackageName(packageName?: string, moduleName?: string, symbolName?: string): string {
        const publicPackage = symbolName?.includes('.') ? symbolName.split('.')[0] : undefined;
        return publicPackage || packageName || moduleName?.split('.')[0] || 'python';
    }

    private corpusLookupGroup(key: DocKey): string | undefined {
        return key.isStdlib || key.package === 'builtins'
            ? PYHOVER_PYTHON_STDLIB_CORPUS_GROUP
            : undefined;
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

        const withoutLeadingLabel = trimmed
            .replace(/^`{1,3}\s*[A-Za-z_][\w.]*\s*`{0,3}\s*\n\n(?=```)/, '')
            .replace(/^``\s+[A-Za-z_][\w.]*\s*\n\n(?=```)/, '');

        const withoutLeadingCodeFence = withoutLeadingLabel.replace(/^```[a-zA-Z]*\n[\s\S]*?\n```\s*/m, '');
        const paragraphs = withoutLeadingCodeFence
            .split(/\n\s*\n/)
            .map(part => part.trim())
            .filter(Boolean)
            .filter(part => !/^`{1,3}\s*[A-Za-z_][\w.]*\s*`{0,3}$/.test(part))
            .filter(part => !/^``\s+[A-Za-z_][\w.]*$/.test(part))
            .filter(part => !/^```/.test(part))
            .filter(part => !this.isSignatureLikeParagraph(part));

        return paragraphs[0] || undefined;
    }

    private extractSummaryFromStructuredOrContent(structuredContent?: StructuredHoverContent, content?: string): string | undefined {
        return structuredContent?.summary || this.extractSummaryFromContent(content);
    }

    private getStructuredContent(packageName: string, url?: string, group?: string, content?: string): StructuredHoverContent | undefined {
        const cached = url ? this.scraper.getCachedStructuredContent(packageName, url, group) ?? undefined : undefined;
        const derived = content ? this.scraper.deriveStructuredContent(content) : undefined;
        if (!cached) return derived;
        if (!derived) return cached;

        return this.shouldPreferDerivedStructuredContent(cached, derived)
            ? derived
            : cached;
    }

    private shouldPreferDerivedStructuredContent(cached: StructuredHoverContent, derived: StructuredHoverContent): boolean {
        const cachedCodeSections = cached.sections.filter(section => section.kind === 'code').length;
        const derivedCodeSections = derived.sections.filter(section => section.kind === 'code').length;
        const cachedExamples = cached.examples?.length ?? 0;
        const derivedExamples = derived.examples?.length ?? 0;

        if (!cached.signature && !!derived.signature) {
            return true;
        }

        if (cached.signature && !derived.signature && derivedExamples >= cachedExamples && derived.sections.length >= cached.sections.length) {
            return true;
        }

        if (derivedCodeSections > cachedCodeSections) {
            return true;
        }

        if (derivedExamples > cachedExamples) {
            return true;
        }

        if ((derived.sections.length ?? 0) > (cached.sections.length ?? 0)) {
            return true;
        }

        return false;
    }

    private getSeeAlso(packageName: string, url?: string, group?: string, content?: string): string[] | undefined {
        const cached = url ? this.scraper.getCachedSeeAlso(packageName, url, group) ?? undefined : undefined;
        if (cached && cached.length > 0) return cached;

        if (!content) return undefined;
        const derived = this.scraper.deriveSeeAlsoFromMarkdown(content);
        return derived.length > 0 ? derived : undefined;
    }

    private isSignatureLikeParagraph(paragraph: string): boolean {
        const normalized = paragraph
            .replace(/[`*_]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (!normalized) return false;

        if (/^(?:class|async\s+def|def)\s+[A-Za-z_][\w.]*\s*\(.*\)\s*(?:->\s*.+)?$/i.test(normalized)) {
            return true;
        }

        if (/^[A-Za-z_][\w.]*\s*\(.*\)\s*(?:->\s*.+)?$/.test(normalized)) {
            return true;
        }

        return false;
    }

    private buildResolvedInventoryDoc(
        key: DocKey,
        inventoryDoc: HoverDoc,
        content?: string,
        structuredContent?: StructuredHoverContent,
        summary?: string,
        seeAlso?: string[],
        links?: Record<string, string>,
    ): HoverDoc {
        return {
            ...inventoryDoc,
            content,
            structuredContent,
            summary: summary || this.extractSummaryFromStructuredOrContent(structuredContent, content),
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
                await new Promise<void>(resolve => {
                    const timer = globalThis as unknown as { setTimeout: (callback: () => void, ms: number) => unknown };
                    timer.setTimeout(resolve, DELAY_MS);
                });
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
        const corpusGroup = isStdlib ? PYHOVER_PYTHON_STDLIB_CORPUS_GROUP : undefined;
        let structuredContent: StructuredHoverContent | undefined;
        if (url) {
            content = this.scraper.getCachedContent(corpusPackage, url, corpusGroup) ?? undefined;
            structuredContent = this.getStructuredContent(corpusPackage, url, corpusGroup, content);
            if (!content && this.config?.onlineDiscovery !== false && this.enableDocScraping) {
                this.prefetchInventoryEnhancements(corpusPackage, url);
            }
            summary = summary || this.extractSummaryFromStructuredOrContent(structuredContent, content);
        }

        return {
            title: packageName,
            kind: 'module',
            summary,
            content,
            structuredContent,
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
            const corpusGroup = this.corpusLookupGroup(key);
            // 0. Static Data (Fastest, Offline)
            const staticDoc = this.staticResolver.resolve(key);
            const inventoryDoc = await this.resolveInventoryDoc(key);

            if (this.shouldUseImmediateBuiltinStaticPath(key, staticDoc)) {
                const builtinStaticDoc = staticDoc!;
                const bestUrl = builtinStaticDoc.url || inventoryDoc?.url;
                const cachedContent = builtinStaticDoc.url
                    ? (this.scraper.getCachedContent(corpusPackage, builtinStaticDoc.url, corpusGroup) ?? undefined)
                    : undefined;
                const cachedStructuredContent = this.getStructuredContent(corpusPackage, builtinStaticDoc.url, corpusGroup, cachedContent);
                const cachedSeeAlso = this.getSeeAlso(corpusPackage, builtinStaticDoc.url, corpusGroup, cachedContent);
                const needsImmediateScrape = this.shouldBuildCorpus()
                    && !!bestUrl
                    && !this.hasUsefulText(cachedContent)
                    && !this.hasUsefulText(inventoryDoc?.summary);
                const scrapedContent = needsImmediateScrape
                    ? await this.scraper.fetchContent(corpusPackage, bestUrl!, corpusGroup).catch(() => null) ?? undefined
                    : undefined;
                const content = cachedContent || scrapedContent;
                const structuredContent = cachedStructuredContent || this.getStructuredContent(corpusPackage, bestUrl, corpusGroup, content);

                if (!content && bestUrl) {
                    this.prefetchInventoryEnhancements(corpusPackage, bestUrl);
                }

                return {
                    ...(inventoryDoc ?? {}),
                    ...builtinStaticDoc,
                    url: bestUrl,
                    content,
                    structuredContent,
                    summary: inventoryDoc?.summary || this.extractSummaryFromStructuredOrContent(structuredContent, content),
                    seeAlso: cachedSeeAlso,
                    source: content ? ResolutionSource.Corpus : (inventoryDoc?.source ?? builtinStaticDoc.source),
                    confidence: content ? 1.0 : (inventoryDoc?.confidence ?? builtinStaticDoc.confidence),
                    devdocsUrl: this.fallback.getDevDocsUrl(key) ?? undefined,
                    module: key.module || key.package,
                };
            }

            // 1. Inventory lookup + corpus build
            // Inventory is only the symbol index / URL locator. Resolved docs should
            // come back through the corpus cache, not as a separate Sphinx source.
            // Fast return: static doc + inventory doc both found → use static URL with
            // inventory data.  Check the disk cache for previously scraped content (zero
            // network cost) so repeat hovers are richer.  If nothing is cached yet, kick
            // off a background scrape so the NEXT hover will have real content.
            if (staticDoc && inventoryDoc) {
                const bestUrl = staticDoc.url || inventoryDoc.url;
                const cachedContent = bestUrl
                    ? (this.scraper.getCachedContent(corpusPackage, bestUrl, corpusGroup) ?? undefined)
                    : undefined;
                const cachedStructuredContent = this.getStructuredContent(corpusPackage, bestUrl, corpusGroup, cachedContent);
                const needsImmediateScrape = this.shouldBuildCorpus()
                    && !!bestUrl
                    && !this.hasUsefulText(inventoryDoc.summary)
                    && !this.hasUsefulText(cachedContent);
                const scrapedContent = needsImmediateScrape
                    ? await this.scraper.fetchContent(corpusPackage, bestUrl!, corpusGroup).catch(() => null) ?? undefined
                    : undefined;
                const content = cachedContent || scrapedContent;
                const structuredContent = cachedStructuredContent || this.getStructuredContent(corpusPackage, bestUrl, corpusGroup, content);

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
                    structuredContent,
                    summary: inventoryDoc.summary || this.extractSummaryFromStructuredOrContent(structuredContent, content),
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
                    ? (this.scraper.getCachedContent(corpusPackage, staticDoc.url, corpusGroup) ?? undefined)
                    : undefined;
                const cachedStructuredContent = this.getStructuredContent(corpusPackage, staticDoc.url, corpusGroup, cachedContent);
                const cachedSeeAlsoForStatic = this.getSeeAlso(corpusPackage, staticDoc.url, corpusGroup, cachedContent);
                const needsImmediateScrape = this.shouldBuildCorpus()
                    && !!staticDoc.url
                    && !this.hasUsefulText(cachedContent);
                const scrapedContent = needsImmediateScrape
                    ? await this.scraper.fetchContent(corpusPackage, staticDoc.url!, corpusGroup).catch(() => null) ?? undefined
                    : undefined;
                const content = cachedContent || scrapedContent;
                const structuredContent = cachedStructuredContent || this.getStructuredContent(corpusPackage, staticDoc.url, corpusGroup, content);

                if (!content && staticDoc.url && this.enableDocScraping) {
                    this.prefetchInventoryEnhancements(corpusPackage, staticDoc.url);
                }

                return {
                    ...staticDoc,
                    content,
                    structuredContent,
                    summary: this.extractSummaryFromStructuredOrContent(structuredContent, content),
                    seeAlso: cachedSeeAlsoForStatic,
                    source: content ? ResolutionSource.Corpus : staticDoc.source,
                    devdocsUrl: this.fallback.getDevDocsUrl(key) ?? undefined,
                    module: key.module || key.package,
                };
            }

            const cachedScrapedContent = inventoryDoc?.url
                ? this.scraper.getCachedContent(corpusPackage, inventoryDoc.url, corpusGroup) ?? undefined
                : undefined;
            const cachedStructuredContent = inventoryDoc?.url
                ? this.getStructuredContent(corpusPackage, inventoryDoc.url, corpusGroup, cachedScrapedContent)
                : undefined;
            const cachedSeeAlso = inventoryDoc?.url
                ? this.getSeeAlso(corpusPackage, inventoryDoc.url, corpusGroup, cachedScrapedContent)
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
                    ? await this.scraper.fetchContent(corpusPackage, inventoryDoc.url!, corpusGroup).catch(() => null) ?? undefined
                    : undefined;
                const immediateContent = cachedScrapedContent || inventoryContent || scrapedContent;
                const structuredContent = cachedStructuredContent || this.getStructuredContent(corpusPackage, inventoryDoc.url, corpusGroup, immediateContent);
                const immediateSummary = inventoryDoc.summary || this.extractSummaryFromStructuredOrContent(structuredContent, immediateContent);

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
                    structuredContent,
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
