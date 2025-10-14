/**
 * Bounded Cache - Size-limited cache with automatic eviction
 *
 * @author KiidxAtlas
 * @copyright 2025 KiidxAtlas. All rights reserved.
 * @license MIT
 *
 * Provides a cache with configurable size limits to prevent memory leaks.
 * Uses LRU (Least Recently Used) eviction strategy.
 */

import { Logger } from '../services/logger';

export interface CacheOptions {
    maxSize: number;
    ttl?: number; // Time-to-live in milliseconds (optional)
}

export interface CacheEntry<V> {
    value: V;
    timestamp: number;
    accessCount: number;
    lastAccessed: number;
}

/**
 * BoundedCache with LRU eviction and optional TTL support
 */
export class BoundedCache<K, V> {
    private cache = new Map<K, CacheEntry<V>>();
    private accessOrder: K[] = [];
    private logger: Logger;

    constructor(private options: CacheOptions) {
        this.logger = Logger.getInstance();
        this.logger.debug(`BoundedCache created with maxSize=${options.maxSize}, ttl=${options.ttl || 'none'}`);
    }

    /**
     * Get value from cache
     */
    get(key: K): V | undefined {
        const entry = this.cache.get(key);

        if (!entry) {
            return undefined;
        }

        // Check TTL if configured
        if (this.options.ttl) {
            const age = Date.now() - entry.timestamp;
            if (age > this.options.ttl) {
                this.logger.debug('Cache entry expired, removing');
                this.delete(key);
                return undefined;
            }
        }

        // Update access tracking
        entry.accessCount++;
        entry.lastAccessed = Date.now();

        // Move to end of access order (most recently used)
        this.updateAccessOrder(key);

        return entry.value;
    }

    /**
     * Set value in cache
     */
    set(key: K, value: V): this {
        const now = Date.now();

        // If key already exists, update it
        if (this.cache.has(key)) {
            const entry = this.cache.get(key)!;
            entry.value = value;
            entry.timestamp = now;
            entry.lastAccessed = now;
            this.updateAccessOrder(key);
            return this;
        }

        // Check if we need to evict
        if (this.cache.size >= this.options.maxSize) {
            this.evictLRU();
        }

        // Add new entry
        const entry: CacheEntry<V> = {
            value,
            timestamp: now,
            accessCount: 0,
            lastAccessed: now
        };

        this.cache.set(key, entry);
        this.accessOrder.push(key);

        return this;
    }

    /**
     * Check if key exists in cache
     */
    has(key: K): boolean {
        if (!this.cache.has(key)) {
            return false;
        }

        // Check TTL
        if (this.options.ttl) {
            const entry = this.cache.get(key)!;
            const age = Date.now() - entry.timestamp;
            if (age > this.options.ttl) {
                this.delete(key);
                return false;
            }
        }

        return true;
    }

    /**
     * Delete key from cache
     */
    delete(key: K): boolean {
        const result = this.cache.delete(key);
        if (result) {
            this.accessOrder = this.accessOrder.filter(k => k !== key);
        }
        return result;
    }

    /**
     * Clear all entries
     */
    clear(): void {
        this.cache.clear();
        this.accessOrder = [];
        this.logger.debug('Cache cleared');
    }

    /**
     * Get current cache size
     */
    get size(): number {
        return this.cache.size;
    }

    /**
     * Get all keys
     */
    keys(): IterableIterator<K> {
        return this.cache.keys();
    }

    /**
     * Get all values
     */
    values(): IterableIterator<V> {
        return Array.from(this.cache.values()).map(entry => entry.value)[Symbol.iterator]();
    }

    /**
     * Get cache statistics
     */
    getStats(): {
        size: number;
        maxSize: number;
        hitRate: number;
        oldestEntry: number;
        newestEntry: number;
    } {
        let totalAccesses = 0;
        let oldestTimestamp = Date.now();
        let newestTimestamp = 0;

        for (const entry of this.cache.values()) {
            totalAccesses += entry.accessCount;
            oldestTimestamp = Math.min(oldestTimestamp, entry.timestamp);
            newestTimestamp = Math.max(newestTimestamp, entry.timestamp);
        }

        return {
            size: this.cache.size,
            maxSize: this.options.maxSize,
            hitRate: this.cache.size > 0 ? totalAccesses / this.cache.size : 0,
            oldestEntry: oldestTimestamp,
            newestEntry: newestTimestamp
        };
    }

    /**
     * Clean up expired entries (if TTL is enabled)
     */
    cleanup(): number {
        if (!this.options.ttl) {
            return 0;
        }

        const now = Date.now();
        let removed = 0;

        for (const [key, entry] of this.cache.entries()) {
            const age = now - entry.timestamp;
            if (age > this.options.ttl) {
                this.delete(key);
                removed++;
            }
        }

        if (removed > 0) {
            this.logger.debug(`Cleaned up ${removed} expired cache entries`);
        }

        return removed;
    }

    /**
     * Evict least recently used entry
     */
    private evictLRU(): void {
        if (this.accessOrder.length === 0) {
            return;
        }

        // Get least recently used key (first in access order)
        const lruKey = this.accessOrder[0];

        this.logger.debug(`Evicting LRU entry: ${String(lruKey)}`);
        this.delete(lruKey);
    }

    /**
     * Update access order for a key (move to end)
     */
    private updateAccessOrder(key: K): void {
        this.accessOrder = this.accessOrder.filter(k => k !== key);
        this.accessOrder.push(key);
    }

    /**
     * Start periodic cleanup (if TTL is enabled)
     */
    startPeriodicCleanup(intervalMs: number = 60000): NodeJS.Timeout {
        if (!this.options.ttl) {
            throw new Error('TTL must be configured to use periodic cleanup');
        }

        this.logger.debug(`Starting periodic cleanup every ${intervalMs}ms`);

        return setInterval(() => {
            this.cleanup();
        }, intervalMs);
    }
}
