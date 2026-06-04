import * as https from 'https'

export type HttpClientOptions = {
  headers?: Record<string, string>
  timeoutMs?: number
  maxRedirects?: number
  maxAttempts?: number
  forceHttps?: boolean
  shouldRetryStatus?: (statusCode: number | undefined) => boolean
}

const DEFAULT_TIMEOUT_MS = 5000
const DEFAULT_MAX_REDIRECTS = 5
const DEFAULT_MAX_ATTEMPTS = 2

function normalizeUrl(url: string, forceHttps: boolean): string {
  if (forceHttps && url.startsWith('http://')) {
    return url.replace('http://', 'https://')
  }
  return url
}

function defaultShouldRetryStatus(statusCode: number | undefined): boolean {
  return statusCode === 429 || (typeof statusCode === 'number' && statusCode >= 500)
}

function resolveOptions(options?: HttpClientOptions): Required<HttpClientOptions> {
  return {
    headers: options?.headers ?? {},
    timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxRedirects: options?.maxRedirects ?? DEFAULT_MAX_REDIRECTS,
    maxAttempts: options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    forceHttps: options?.forceHttps ?? true,
    shouldRetryStatus: options?.shouldRetryStatus ?? defaultShouldRetryStatus,
  }
}

export function httpGetBuffer(url: string, options?: HttpClientOptions): Promise<Buffer> {
  const opts = resolveOptions(options)

  const attemptRequest = (
    requestUrl: string,
    redirectCount: number,
    attempt: number,
  ): Promise<Buffer> => {
    if (redirectCount > opts.maxRedirects) {
      return Promise.reject(new Error('Too many redirects'))
    }

    const normalizedUrl = normalizeUrl(requestUrl, opts.forceHttps)

    return new Promise((resolve, reject) => {
      const req = https.get(
        normalizedUrl,
        { timeout: opts.timeoutMs, headers: opts.headers },
        res => {
          if (
            res.statusCode &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            const redirectUrl = normalizeUrl(
              new URL(res.headers.location, normalizedUrl).toString(),
              opts.forceHttps,
            )
            attemptRequest(redirectUrl, redirectCount + 1, attempt).then(resolve).catch(reject)
            return
          }

          if (res.statusCode !== 200) {
            if (attempt + 1 < opts.maxAttempts && opts.shouldRetryStatus(res.statusCode)) {
              attemptRequest(normalizedUrl, redirectCount, attempt + 1)
                .then(resolve)
                .catch(reject)
              return
            }

            reject(new Error(`Status code: ${res.statusCode}`))
            return
          }

          const chunks: Buffer[] = []
          res.on('data', chunk => chunks.push(chunk))
          res.on('end', () => resolve(Buffer.concat(chunks)))
          res.on('error', reject)
        },
      )

      req.on('timeout', () => {
        req.destroy()
        if (attempt + 1 < opts.maxAttempts) {
          attemptRequest(normalizedUrl, redirectCount, attempt + 1).then(resolve).catch(reject)
          return
        }
        reject(new Error('Request timed out'))
      })

      req.on('error', err => {
        if (attempt + 1 < opts.maxAttempts) {
          attemptRequest(normalizedUrl, redirectCount, attempt + 1).then(resolve).catch(reject)
          return
        }
        reject(err)
      })
    })
  }

  return attemptRequest(url, 0, 0)
}

export async function httpGetText(url: string, options?: HttpClientOptions): Promise<string> {
  const buffer = await httpGetBuffer(url, options)
  return buffer.toString('utf8')
}

export async function httpGetJson<T>(url: string, options?: HttpClientOptions): Promise<T> {
  const body = await httpGetText(url, options)
  return JSON.parse(body) as T
}

export function httpHeadExists(url: string, options?: HttpClientOptions): Promise<boolean> {
  const opts = resolveOptions(options)
  const normalizedUrl = normalizeUrl(url, opts.forceHttps)

  return new Promise(resolve => {
    const req = https.request(
      normalizedUrl,
      {
        method: 'HEAD',
        timeout: opts.timeoutMs,
        headers: opts.headers,
      },
      res => {
        resolve(
          !!res.statusCode &&
            (res.statusCode === 200 || (res.statusCode >= 300 && res.statusCode < 400)),
        )
      },
    )

    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
    req.on('error', () => resolve(false))
    req.end()
  })
}
