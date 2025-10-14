/**
 * Application Constants - Centralized configuration values
 *
 * @author KiidxAtlas
 * @copyright 2025 KiidxAtlas. All rights reserved.
 * @license MIT
 *
 * Centralized constants for easier tuning and maintenance.
 * All time values are in milliseconds unless otherwise specified.
 */

/**
 * Performance-related constants
 */
export const PERFORMANCE = {
    /** How often to update status bar (ms) */
    STATUS_BAR_UPDATE_INTERVAL: 30_000,

    /** Debounce delay for hover requests (ms) */
    DEBOUNCE_DELAY: 150,

    /** How long to cache Python version detection (ms) */
    VERSION_CACHE_TTL: 30_000,

    /** Default HTTP request timeout (ms) */
    REQUEST_TIMEOUT: 10_000,

    /** Timeout for quick health checks (ms) */
    HEALTH_CHECK_TIMEOUT: 3_000,

    /** Maximum lines to scan for context detection */
    MAX_CONTEXT_SCAN_LINES: 100,

    /** Maximum concurrent network requests */
    MAX_CONCURRENT_REQUESTS: 5,
} as const;

/**
 * Cache-related constants
 */
export const CACHE = {
    /** Inventory cache TTL (days) */
    INVENTORY_TTL_DAYS: 7,

    /** Snippet cache TTL (hours) */
    SNIPPET_TTL_HOURS: 48,

    /** Documentation history cache (hours) */
    HISTORY_TTL_HOURS: 168, // 7 days

    /** Maximum cache size (MB) */
    MAX_CACHE_SIZE_MB: 100,

    /** Health check interval (ms) */
    HEALTH_CHECK_INTERVAL: 3_600_000, // 1 hour

    /** Auto-cleanup interval (ms) */
    CLEANUP_INTERVAL: 3_600_000, // 1 hour

    /** Library discovery cache (ms) */
    LIBRARY_DISCOVERY_TTL: 24 * 60 * 60 * 1000, // 24 hours

    /** Minimum inventory file size (bytes) */
    MIN_INVENTORY_SIZE: 1024, // 1KB
} as const;

/**
 * UI/UX constants
 */
export const UI = {
    /** Maximum hover content length before truncation */
    MAX_HOVER_LENGTH: 800,

    /** Maximum snippet lines to display */
    MAX_SNIPPET_LINES: 12,

    /** Recent documentation history limit */
    RECENT_DOCS_LIMIT: 50,

    /** Maximum parameter table rows before collapsing */
    MAX_PARAM_TABLE_ROWS: 10,

    /** Loading indicator delay (ms) */
    LOADING_INDICATOR_DELAY: 200,

    /** Search results limit */
    SEARCH_RESULTS_LIMIT: 50,

    /** Minimum word length for hover */
    MIN_WORD_LENGTH: 2,
} as const;

/**
 * Network/Reliability constants
 */
export const NETWORK = {
    /** Circuit breaker failure threshold */
    CB_FAILURE_THRESHOLD: 5,

    /** Circuit breaker success threshold */
    CB_SUCCESS_THRESHOLD: 2,

    /** Circuit breaker timeout (ms) */
    CB_TIMEOUT: 60_000, // 1 minute

    /** Circuit breaker reset timeout (ms) */
    CB_RESET_TIMEOUT: 120_000, // 2 minutes

    /** Retry attempts for failed requests */
    MAX_RETRY_ATTEMPTS: 3,

    /** Retry delay (ms) */
    RETRY_DELAY: 1_000,

    /** Exponential backoff multiplier */
    RETRY_BACKOFF_MULTIPLIER: 2,
} as const;

/**
 * Memory/Performance limits
 */
export const LIMITS = {
    /** Maximum version cache entries */
    MAX_VERSION_CACHE_SIZE: 10,

    /** Maximum pending hover requests */
    MAX_PENDING_REQUESTS: 20,

    /** Maximum regex cache entries */
    MAX_REGEX_CACHE_SIZE: 100,

    /** Maximum documentation history entries */
    MAX_HISTORY_SIZE: 50,

    /** Maximum symbol inventory size per library */
    MAX_INVENTORY_ENTRIES: 10_000,

    /** Maximum data loader cache size */
    MAX_DATA_LOADER_CACHE: 10,
} as const;

/**
 * Feature flags
 */
export const FEATURES = {
    /** Enable progressive disclosure */
    ENABLE_PROGRESSIVE_DISCLOSURE: true,

    /** Enable theme adaptation */
    ENABLE_THEME_ADAPTATION: true,

    /** Enable circuit breaker */
    ENABLE_CIRCUIT_BREAKER: true,

    /** Enable request deduplication */
    ENABLE_REQUEST_DEDUP: true,

    /** Enable lazy loading */
    ENABLE_LAZY_LOADING: true,

    /** Enable cache health checks */
    ENABLE_CACHE_HEALTH_CHECKS: true,
} as const;

/**
 * Debug/Logging constants
 */
export const DEBUG = {
    /** Log performance metrics */
    LOG_PERFORMANCE: false,

    /** Log cache hits/misses */
    LOG_CACHE_STATS: false,

    /** Log network requests */
    LOG_NETWORK_REQUESTS: false,

    /** Verbose symbol resolution */
    VERBOSE_SYMBOL_RESOLUTION: false,
} as const;

/**
 * Convert days to milliseconds
 */
export function daysToMs(days: number): number {
    return days * 24 * 60 * 60 * 1000;
}

/**
 * Convert hours to milliseconds
 */
export function hoursToMs(hours: number): number {
    return hours * 60 * 60 * 1000;
}

/**
 * Convert minutes to milliseconds
 */
export function minutesToMs(minutes: number): number {
    return minutes * 60 * 1000;
}

/**
 * Convert seconds to milliseconds
 */
export function secondsToMs(seconds: number): number {
    return seconds * 1000;
}

/**
 * Get all constants as a single object
 */
export const CONSTANTS = {
    PERFORMANCE,
    CACHE,
    UI,
    NETWORK,
    LIMITS,
    FEATURES,
    DEBUG,
} as const;

/**
 * Type-safe constant access
 */
export type Constants = typeof CONSTANTS;
