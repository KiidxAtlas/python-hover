import * as dns from "dns";
import * as https from "https";
import { getEngineLogger } from "../engineLogger";
import { RATE_LIMIT_CONFIG } from "../sharedConstants";

/** Per-domain request tracker for rate limiting. */
const domainLastRequest: Map<string, number> = new Map();

/** Currently in-flight requests counter. */
let activeRequestCount = 0;

/** Queue of pending request functions waiting for rate-limit slot. */
const requestQueue: Array<() => Promise<string>> = [];

/** Process the next queued request when a slot opens. */
function processQueue(): void {
  while (requestQueue.length > 0 && activeRequestCount < RATE_LIMIT_CONFIG.maxConcurrentRequests) {
    const next = requestQueue.shift();
    if (next) {
      activeRequestCount++;
      next().finally(() => {
        activeRequestCount--;
        processQueue();
      });
    }
  }
}

/** Wait for rate-limit slot to be available, then enqueue the request. */
function waitForSlot(url: string): Promise<void> {
  return new Promise((resolve) => {
    const checkSlot = () => {
      if (activeRequestCount < RATE_LIMIT_CONFIG.maxConcurrentRequests) {
        resolve();
        return;
      }
      setTimeout(checkSlot, 50);
    };
    checkSlot();
  });
}

/** Enforce per-domain delay between requests. */
function enforceDomainDelay(url: string): Promise<void> {
  try {
    const domain = new URL(url).hostname;
    const lastTime = domainLastRequest.get(domain) ?? 0;
    const now = Date.now();
    const elapsed = now - lastTime;
    if (elapsed < RATE_LIMIT_CONFIG.perDomainDelayMs) {
      return new Promise((resolve) => {
        setTimeout(resolve, RATE_LIMIT_CONFIG.perDomainDelayMs - elapsed);
      });
    }
  } catch {
    /* non-URL — skip domain delay */
  }
  return Promise.resolve();
}

/** Record the last request time for a domain. */
function recordDomainRequest(url: string): void {
  try {
    const domain = new URL(url).hostname;
    domainLastRequest.set(domain, Date.now());
  } catch {
    /* non-URL — skip */
  }
}

export type HttpClientOptions = {
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxRedirects?: number;
  maxAttempts?: number;
  forceHttps?: boolean;
  shouldRetryStatus?: (statusCode: number | undefined) => boolean;
};

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_MAX_ATTEMPTS = 2;

function normalizeUrl(url: string, forceHttps: boolean): string {
  if (forceHttps && url.startsWith("http://")) {
    return url.replace("http://", "https://");
  }
  return url;
}

/**
 * Check whether a raw IPv4/IPv6 address string falls in a private, loopback, or
 * link-local range — including the 169.254.0.0/16 range used by cloud instance-metadata
 * endpoints (AWS/GCP/Azure/DigitalOcean all serve credentials at 169.254.169.254).
 */
function isPrivateOrReservedIp(rawIp: string): boolean {
  const ip = rawIp.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();

  if (ip === "::1" || ip === "::") {
    return true;
  }
  // IPv6 unique-local (fc00::/7) and link-local (fe80::/10), including the
  // link-local range that also serves cloud metadata over IPv6.
  if (/^f[cd][0-9a-f]{2}:/.test(ip) || /^fe[89ab][0-9a-f]:/.test(ip)) {
    return true;
  }

  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts[0] === 127) return true; // loopback
    if (parts[0] === 10) return true; // RFC1918
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // RFC1918
    if (parts[0] === 192 && parts[1] === 168) return true; // RFC1918
    if (parts[0] === 169 && parts[1] === 254) return true; // link-local / cloud metadata
    if (parts[0] === 0) return true; // "this network"
    return false;
  }

  return false;
}

/**
 * Fast, string-only pre-check: validates scheme and rejects obviously-unsafe literal
 * hostnames (localhost, literal private/loopback/link-local IPs). This alone does NOT
 * defend against DNS rebinding — a hostname that only *resolves* to a private address
 * passes this check. Use `resolveSafeAddress` for the real, connection-time guarantee.
 */
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Block file://, ftp://, and other non-HTTP schemes.
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === "localhost") {
      return false;
    }
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.includes(":")) {
      return !isPrivateOrReservedIp(hostname);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves `hostname` via DNS and validates the *actual address that will be connected
 * to*, closing the gap where a hostname passes `isSafeUrl` (because it isn't a literal
 * private IP) but resolves to one — the standard SSRF-via-DNS-rebinding bypass. Returns
 * the resolved address to pin the subsequent `https` connection to (via a custom
 * `lookup` option), so a second, later DNS resolution can't return a different address
 * than the one that was validated.
 */
/** DNS lookups have no built-in timeout — if the resolver hangs (unreachable DNS
 *  server, no network), `dns.lookup`'s callback simply never fires. Without this race,
 *  every await further up the chain (all the way up through hover resolution) would
 *  hang indefinitely instead of failing fast like every other network call here does. */
const DNS_LOOKUP_TIMEOUT_MS = 3000;

function resolveSafeAddress(
  hostname: string,
): Promise<{ address: string; family: number } | null> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, DNS_LOOKUP_TIMEOUT_MS);

    dns.lookup(hostname, (err, address, family) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (err || !address || isPrivateOrReservedIp(address)) {
        resolve(null);
        return;
      }
      resolve({ address, family });
    });
  });
}

/**
 * A `dns.lookup`-compatible function that always returns a pre-validated address.
 *
 * Node's HTTP client defaults to Happy Eyeballs (RFC 8305) for connections, which
 * calls `lookup` with `{ all: true }` and expects the callback to receive a single
 * *array* of `{address, family}` — not the classic 3-argument `(err, address, family)`
 * form. Passing the wrong shape doesn't error immediately; Node accepts the call and
 * fails later trying to read `.address`/`.family` off what it assumes is an array,
 * producing an opaque "Invalid IP address: undefined" with no indication the real
 * cause is a lookup-callback shape mismatch.
 */
function pinnedLookup(
  resolved: { address: string; family: number },
): typeof dns.lookup {
  return ((_hostname: string, optionsOrCallback: unknown, maybeCallback?: unknown) => {
    const isOptionsForm = typeof optionsOrCallback !== "function";
    const callback = (
      isOptionsForm ? maybeCallback : optionsOrCallback
    ) as (...args: unknown[]) => void;
    const wantsAll =
      isOptionsForm &&
      !!optionsOrCallback &&
      typeof optionsOrCallback === "object" &&
      (optionsOrCallback as { all?: boolean }).all === true;

    if (wantsAll) {
      callback(null, [{ address: resolved.address, family: resolved.family }]);
    } else {
      callback(null, resolved.address, resolved.family);
    }
  }) as typeof dns.lookup;
}

function defaultShouldRetryStatus(statusCode: number | undefined): boolean {
  return (
    statusCode === 429 || (typeof statusCode === "number" && statusCode >= 500)
  );
}

function resolveOptions(
  options?: HttpClientOptions,
): Required<HttpClientOptions> {
  return {
    headers: options?.headers ?? {},
    timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxRedirects: options?.maxRedirects ?? DEFAULT_MAX_REDIRECTS,
    maxAttempts: options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    forceHttps: options?.forceHttps ?? true,
    shouldRetryStatus: options?.shouldRetryStatus ?? defaultShouldRetryStatus,
  };
}

export function httpGetBuffer(
  url: string,
  options?: HttpClientOptions,
): Promise<Buffer> {
  const opts = resolveOptions(options);
  const requestStartedAt = Date.now();
  return (async () => {
    const waitStartedAt = Date.now();
    await waitForSlot(url);
    await enforceDomainDelay(url);
    const waitedMs = Date.now() - waitStartedAt;
    if (waitedMs > 50) {
      getEngineLogger().debug(
        `httpGetBuffer: waited ${waitedMs}ms for rate-limit slot/domain delay`,
        { url },
      );
    }
    recordDomainRequest(url);

    const normalizedUrl = normalizeUrl(url, opts.forceHttps);
    if (!isSafeUrl(normalizedUrl)) {
      getEngineLogger().debug("httpGetBuffer: blocked unsafe URL", { url: normalizedUrl });
      throw new Error("URL blocked: SSRF protection");
    }

    getEngineLogger().debug(`httpGetBuffer: request started`, { url: normalizedUrl });

    return new Promise<Buffer>((resolve, reject) => {
      let redirectCount = 0;
      let attempt = 0;

      const performRequest = async (requestUrl: string) => {
        if (redirectCount > opts.maxRedirects) {
          getEngineLogger().debug("httpGetBuffer: too many redirects", { url: requestUrl });
          reject(new Error("Too many redirects"));
          return;
        }

        const finalUrl = normalizeUrl(requestUrl, opts.forceHttps);
        if (redirectCount > 0) {
          recordDomainRequest(finalUrl);
        }

        const hostname = new URL(finalUrl).hostname;
        const resolved = await resolveSafeAddress(hostname);
        if (!resolved) {
          getEngineLogger().debug("httpGetBuffer: blocked — resolved address is private/reserved", {
            url: finalUrl,
          });
          reject(new Error("URL blocked: SSRF protection (resolved address)"));
          return;
        }

        const req = https.get(
          finalUrl,
          { timeout: opts.timeoutMs, headers: opts.headers, lookup: pinnedLookup(resolved) },
          (res) => {
            if (
              res.statusCode &&
              res.statusCode >= 300 &&
              res.statusCode < 400 &&
              res.headers.location
            ) {
              redirectCount++;
              const redirectUrl = normalizeUrl(
                new URL(res.headers.location, finalUrl).toString(),
                opts.forceHttps,
              );
              getEngineLogger().debug(
                `httpGetBuffer: redirect ${res.statusCode}`,
                { from: finalUrl, to: redirectUrl },
              );
              if (!isSafeUrl(redirectUrl)) {
                reject(new Error("Redirect blocked: SSRF protection"));
                return;
              }
              performRequest(redirectUrl);
              return;
            }

            if (res.statusCode !== 200) {
              if (
                attempt + 1 < opts.maxAttempts &&
                opts.shouldRetryStatus(res.statusCode)
              ) {
                attempt++;
                getEngineLogger().debug(
                  `httpGetBuffer: retrying after status ${res.statusCode} (attempt ${attempt + 1}/${opts.maxAttempts})`,
                  { url: finalUrl },
                );
                performRequest(finalUrl);
                return;
              }

              getEngineLogger().debug(
                `httpGetBuffer: failed with status ${res.statusCode} after ${Date.now() - requestStartedAt}ms`,
                { url: finalUrl },
              );
              reject(new Error(`Status code: ${res.statusCode}`));
              return;
            }

            const chunks: Buffer[] = [];
            res.on("data", (chunk) => chunks.push(chunk));
            res.on("end", () => {
              const body = Buffer.concat(chunks);
              getEngineLogger().debug(
                `httpGetBuffer: completed in ${Date.now() - requestStartedAt}ms (${body.length} bytes)`,
                { url: finalUrl },
              );
              resolve(body);
            });
            res.on("error", reject);
          },
        );

        req.on("timeout", () => {
          req.destroy();
          if (attempt + 1 < opts.maxAttempts) {
            attempt++;
            getEngineLogger().debug(
              `httpGetBuffer: timed out after ${opts.timeoutMs}ms, retrying (attempt ${attempt + 1}/${opts.maxAttempts})`,
              { url: finalUrl },
            );
            performRequest(finalUrl);
            return;
          }
          getEngineLogger().debug(
            `httpGetBuffer: timed out after ${opts.timeoutMs}ms, no attempts left`,
            { url: finalUrl },
          );
          reject(new Error("Request timed out"));
        });

        req.on("error", (err) => {
          if (attempt + 1 < opts.maxAttempts) {
            attempt++;
            getEngineLogger().debug(
              `httpGetBuffer: request error, retrying (attempt ${attempt + 1}/${opts.maxAttempts}): ${err.message}`,
              { url: finalUrl },
            );
            performRequest(finalUrl);
            return;
          }
          getEngineLogger().debug(
            `httpGetBuffer: request error, no attempts left: ${err.message}`,
            { url: finalUrl },
          );
          reject(err);
        });
      };

      performRequest(normalizedUrl);
    });
  })();
}

export async function httpGetText(
  url: string,
  options?: HttpClientOptions,
): Promise<string> {
  const buffer = await httpGetBuffer(url, options);
  return buffer.toString("utf8");
}

export async function httpGetJson<T>(
  url: string,
  options?: HttpClientOptions,
): Promise<T> {
  const body = await httpGetText(url, options);
  return JSON.parse(body) as T;
}

/**
 * Checks whether `url` exists, following redirects (up to `opts.maxRedirects`) to the
 * real final destination rather than trusting the pre-redirect candidate string. A 3xx
 * response is NOT "exists" on its own — many real docs sites (e.g. PyPI's advertised
 * "Documentation" URL) redirect to a different path or an unrelated landing page, so
 * only a genuine 200 at the end of the redirect chain counts. Returns the resolved
 * final URL on success (which callers should use as "the working URL", since it may
 * differ from the original candidate), or `null` if nothing 200s.
 */
export async function httpHeadExists(
  url: string,
  options?: HttpClientOptions,
): Promise<string | null> {
  const opts = resolveOptions(options);
  const startedAt = Date.now();
  await waitForSlot(url);
  await enforceDomainDelay(url);
  const normalizedUrl = normalizeUrl(url, opts.forceHttps);

  if (!isSafeUrl(normalizedUrl)) {
    getEngineLogger().debug("httpHeadExists: blocked unsafe URL", { url: normalizedUrl });
    return null;
  }

  recordDomainRequest(url);

  return new Promise<string | null>((resolve) => {
    let redirectCount = 0;

    const performRequest = async (requestUrl: string) => {
      if (redirectCount > opts.maxRedirects) {
        getEngineLogger().debug("httpHeadExists: too many redirects", { url: requestUrl });
        resolve(null);
        return;
      }

      const finalUrl = normalizeUrl(requestUrl, opts.forceHttps);
      if (!isSafeUrl(finalUrl)) {
        getEngineLogger().debug("httpHeadExists: blocked unsafe redirect URL", { url: finalUrl });
        resolve(null);
        return;
      }
      if (redirectCount > 0) {
        recordDomainRequest(finalUrl);
      }

      const resolved = await resolveSafeAddress(new URL(finalUrl).hostname);
      if (!resolved) {
        getEngineLogger().debug("httpHeadExists: blocked — resolved address is private/reserved", {
          url: finalUrl,
        });
        resolve(null);
        return;
      }

      const req = https.request(
        finalUrl,
        {
          method: "HEAD",
          timeout: opts.timeoutMs,
          headers: opts.headers,
          lookup: pinnedLookup(resolved),
        },
        (res) => {
          if (
            res.statusCode &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            redirectCount++;
            const redirectUrl = normalizeUrl(
              new URL(res.headers.location, finalUrl).toString(),
              opts.forceHttps,
            );
            getEngineLogger().debug(`httpHeadExists: redirect ${res.statusCode}`, {
              from: finalUrl,
              to: redirectUrl,
            });
            performRequest(redirectUrl);
            return;
          }

          const exists = res.statusCode === 200;
          getEngineLogger().debug(
            `httpHeadExists: ${res.statusCode} (${exists ? "exists" : "missing"}) in ${Date.now() - startedAt}ms`,
            { url: finalUrl },
          );
          resolve(exists ? finalUrl : null);
        },
      );

      req.on("timeout", () => {
        req.destroy();
        getEngineLogger().debug(`httpHeadExists: timed out after ${opts.timeoutMs}ms`, { url: finalUrl });
        resolve(null);
      });
      req.on("error", (err) => {
        getEngineLogger().debug(`httpHeadExists: request error: ${err.message}`, { url: finalUrl });
        resolve(null);
      });
      req.end();
    };

    performRequest(normalizedUrl);
  });
}
