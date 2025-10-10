// CommonJS import for node-fetch
import * as nodeFetch from 'node-fetch';
const fetch = nodeFetch.default || nodeFetch;

/**
 * Utility for making HTTP requests with timeout support
 * Centralizes the AbortController + timeout pattern used throughout the codebase
 */

export interface FetchWithTimeoutOptions {
    timeoutMs?: number;
    headers?: Record<string, string>;
    signal?: AbortSignal;
}

export class FetchWithTimeout {
    /**
     * Default timeout in milliseconds
     */
    private static readonly DEFAULT_TIMEOUT_MS = 10000; // 10 seconds

    /**
     * Fetch a URL with automatic timeout handling
     * Ensures proper cleanup of timeout handlers in all code paths
     *
     * @param url - The URL to fetch
     * @param options - Fetch options including timeout
     * @returns Promise that resolves to the Response
     * @throws Error if request times out or fails
     */
    public static async fetch(
        url: string,
        options: FetchWithTimeoutOptions = {}
    ): Promise<nodeFetch.Response> {
        const timeoutMs = options.timeoutMs ?? this.DEFAULT_TIMEOUT_MS;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                signal: options.signal ?? controller.signal,
                headers: {
                    'User-Agent': 'VSCode-Python-Hover-Extension',
                    ...options.headers
                }
            });

            return response as nodeFetch.Response;
        } catch (error: any) {
            if (error.name === 'AbortError') {
                throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`);
            }
            throw error;
        } finally {
            // Always clear timeout to prevent memory leaks
            clearTimeout(timeoutId);
        }
    }

    /**
     * Fetch a URL and get the response text
     * Convenience method that handles both fetch and text parsing
     *
     * @param url - The URL to fetch
     * @param options - Fetch options including timeout
     * @returns Promise that resolves to the response text
     * @throws Error if request fails or times out
     */
    public static async fetchText(
        url: string,
        options: FetchWithTimeoutOptions = {}
    ): Promise<string> {
        const response = await this.fetch(url, options);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Failed to fetch ${url}`);
        }

        return await response.text();
    }

    /**
     * Fetch a URL and parse JSON response
     * Convenience method that handles both fetch and JSON parsing
     *
     * @param url - The URL to fetch
     * @param options - Fetch options including timeout
     * @returns Promise that resolves to the parsed JSON
     * @throws Error if request fails, times out, or JSON is invalid
     */
    public static async fetchJson<T = any>(
        url: string,
        options: FetchWithTimeoutOptions = {}
    ): Promise<T> {
        const response = await this.fetch(url, options);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Failed to fetch ${url}`);
        }

        return await response.json() as T;
    }

    /**
     * Check if a URL is reachable (HEAD request)
     * Useful for validation without downloading full content
     *
     * @param url - The URL to check
     * @param timeoutMs - Timeout in milliseconds (default: 5000)
     * @returns Promise that resolves to true if reachable, false otherwise
     */
    public static async isReachable(
        url: string,
        timeoutMs: number = 5000
    ): Promise<boolean> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                method: 'HEAD',
                signal: controller.signal,
                headers: { 'User-Agent': 'VSCode-Python-Hover-Extension' }
            });

            return response.ok;
        } catch {
            return false;
        } finally {
            clearTimeout(timeoutId);
        }
    }
}
