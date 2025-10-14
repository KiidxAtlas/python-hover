/**
 * Data Loader Service - Lazy loading for data files
 *
 * @author KiidxAtlas
 * @copyright 2025 KiidxAtlas. All rights reserved.
 * @license MIT
 *
 * This service implements lazy loading for large data files to improve
 * extension activation time and reduce initial memory footprint.
 */

import { Logger } from './logger';

/**
 * DataLoader provides lazy loading and caching for data modules.
 * Data is loaded only when first requested and cached for subsequent use.
 */
export class DataLoader {
    private cache = new Map<string, any>();
    private logger: Logger;
    private loadingPromises = new Map<string, Promise<any>>();

    constructor() {
        this.logger = Logger.getInstance();
    }

    /**
     * Load enhanced examples (lazy)
     */
    async loadEnhancedExamples(): Promise<any> {
        return this.loadModule('enhancedExamples', async () => {
            this.logger.debug('Lazy loading enhanced examples...');
            const module = await import('../data/enhancedExamples');
            return module.ENHANCED_EXAMPLES;
        });
    }

    /**
     * Load static examples (lazy)
     */
    async loadStaticExamples(): Promise<any> {
        return this.loadModule('staticExamples', async () => {
            this.logger.debug('Lazy loading static examples...');
            const module = await import('../data/staticExamples');
            return module.STATIC_EXAMPLES;
        });
    }

    /**
     * Load special methods (lazy)
     */
    async loadSpecialMethods(): Promise<any> {
        return this.loadModule('specialMethods', async () => {
            this.logger.debug('Lazy loading special methods...');
            const module = await import('../data/specialMethods');
            return module.SPECIAL_METHOD_DESCRIPTIONS;
        });
    }

    /**
     * Load documentation URLs (lazy)
     */
    async loadDocumentationUrls(): Promise<any> {
        return this.loadModule('documentationUrls', async () => {
            this.logger.debug('Lazy loading documentation URLs...');
            const module = await import('../data/documentationUrls');
            return {
                MAP: module.MAP,
                MODULES: module.MODULES,
                OPERATORS: module.OPERATORS,
                getDunderInfo: module.getDunderInfo
            };
        });
    }

    /**
     * Load typing constructs (lazy)
     */
    async loadTypingConstructs(): Promise<any> {
        return this.loadModule('typingConstructs', async () => {
            this.logger.debug('Lazy loading typing constructs...');
            const module = await import('../data/typingConstructs');
            return module.TYPING_CONSTRUCTS;
        });
    }

    /**
     * Generic module loader with caching and deduplication
     */
    private async loadModule<T>(key: string, loader: () => Promise<T>): Promise<T> {
        // Return cached data if available
        if (this.cache.has(key)) {
            this.logger.debug(`Using cached data for: ${key}`);
            return this.cache.get(key);
        }

        // If already loading, return existing promise to avoid duplicate loads
        if (this.loadingPromises.has(key)) {
            this.logger.debug(`Reusing in-flight load for: ${key}`);
            return this.loadingPromises.get(key)!;
        }

        // Start loading
        const loadPromise = (async () => {
            try {
                const startTime = Date.now();
                const data = await loader();
                const loadTime = Date.now() - startTime;

                this.cache.set(key, data);
                this.logger.debug(`Loaded ${key} in ${loadTime}ms`);

                return data;
            } catch (error) {
                this.logger.error(`Failed to load ${key}:`, error as Error);
                throw error;
            } finally {
                this.loadingPromises.delete(key);
            }
        })();

        this.loadingPromises.set(key, loadPromise);
        return loadPromise;
    }

    /**
     * Preload all data modules (optional, for performance tuning)
     * Can be called in background after extension activates
     */
    async preloadAll(): Promise<void> {
        this.logger.info('Preloading all data modules...');

        const startTime = Date.now();

        await Promise.all([
            this.loadEnhancedExamples(),
            this.loadStaticExamples(),
            this.loadSpecialMethods(),
            this.loadDocumentationUrls(),
            this.loadTypingConstructs()
        ]);

        const totalTime = Date.now() - startTime;
        this.logger.info(`Preloaded all data modules in ${totalTime}ms`);
    }

    /**
     * Clear cache (useful for testing or memory management)
     */
    clearCache(): void {
        this.cache.clear();
        this.logger.debug('Data loader cache cleared');
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { modulesLoaded: number; modulesInFlight: number } {
        return {
            modulesLoaded: this.cache.size,
            modulesInFlight: this.loadingPromises.size
        };
    }
}
