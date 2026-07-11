/** Shared HTTP constants for the docs engine. */

/**
 * User-Agent string used for all documentation requests.
 * Version is intentionally generic to avoid enumeration attacks.
 */
export const DOCS_USER_AGENT =
  "Mozilla/5.0 (compatible; PyHover; +https://github.com/KiidxAtlas/python-hover)";

/** Default HTTP headers for documentation requests. */
export const DOCS_REQUEST_HEADERS: Record<string, string> = {
  "User-Agent": DOCS_USER_AGENT,
  Accept: "*/*",
};

/** Default HTML acceptance header (includes/xhtml+xml for documentation sites). */
export const DOCS_HTML_HEADERS: Record<string, string> = {
  "User-Agent": DOCS_USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

/** Rate-limit configuration: max concurrent requests and per-domain delay (ms). */
export const RATE_LIMIT_CONFIG = {
  /** Maximum concurrent in-flight HTTP requests (prevents resource exhaustion). */
  maxConcurrentRequests: 5,
  /** Minimum delay between requests to the same domain (prevents rate-limit bans). */
  perDomainDelayMs: 250,
};
