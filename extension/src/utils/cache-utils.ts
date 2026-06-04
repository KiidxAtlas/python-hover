export function logWithCooldown(
  timestamps: Map<string, number>,
  key: string,
  cooldownMs: number,
  emit: () => void,
  evictIfNeeded: <K, V>(map: Map<K, V>) => void,
): void {
  const now = Date.now()
  const last = timestamps.get(key) ?? 0
  if (now - last < cooldownMs) {
    return
  }

  timestamps.set(key, now)
  evictIfNeeded(timestamps)
  emit()
}

export function cacheNegativeHover(
  negativeCache: Map<string, number>,
  cacheKey: string,
  evictIfNeeded: <K, V>(map: Map<K, V>) => void,
): void {
  negativeCache.set(cacheKey, Date.now())
  evictIfNeeded(negativeCache)
}

export function isNegativeHoverCached(
  negativeCache: Map<string, number>,
  cacheKey: string,
  ttlMs: number,
): boolean {
  const at = negativeCache.get(cacheKey)
  if (!at) {
    return false
  }
  if (Date.now() - at < ttlMs) {
    return true
  }
  negativeCache.delete(cacheKey)
  return false
}
