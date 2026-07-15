import { HoverDoc, HoverHistoryEntry } from '#shared/types'
import * as vscode from 'vscode'

export class HoverSessionState {
  private static readonly MAX_COMMAND_DOCS = 500
  private static readonly MAX_HISTORY_ENTRIES = 25

  private lastDoc: HoverDoc | null = null
  private commandDocCache = new Map<string, HoverDoc>()
  private hoverHistory: HoverHistoryEntry[] = []
  private readonly sidebarDidChangeEmitter = new vscode.EventEmitter<void>()
  readonly onDidChangeSidebarState = this.sidebarDidChangeEmitter.event

  /** @param keepIndefinitely When true, skip eviction — the user opted into unbounded session caches. */
  constructor(private readonly keepIndefinitely: () => boolean = () => false) {}

  getLastDoc(): HoverDoc | null {
    return this.lastDoc
  }

  getDocByCommandToken(token?: string): HoverDoc | null {
    if (!token) {
      return this.lastDoc
    }
    return this.commandDocCache.get(token) ?? this.lastDoc
  }

  getExactDocByCommandToken(token: string): HoverDoc | null {
    return this.commandDocCache.get(token) ?? null
  }

  /**
   * Re-affirm a previously-cached doc as "currently displayed" — call this whenever a
   * hover is served from `HoverProvider`'s own `hoverCache` (rendered-markdown cache)
   * rather than freshly resolved. Two things this fixes:
   *  1. Recency: `hoverCache` and `commandDocCache` are separate maps, each evicted
   *     independently by insertion order. Without this touch, a symbol hovered once
   *     early in a session and then repeatedly re-hovered from cache would still see
   *     its `commandDocCache` entry age out (since only fresh resolutions used to
   *     touch it), silently breaking that hover's embedded Debug/Pin token.
   *  2. Staleness: `lastDoc` previously only got set by fresh resolutions, so it could
   *     point at whatever the last cache MISS happened to resolve — not necessarily
   *     the hover the user is currently looking at — making the Debug button's
   *     "?? this.lastDoc" fallback show the wrong symbol when a token lookup missed.
   */
  touchCommandDoc(token: string): HoverDoc | null {
    const doc = this.commandDocCache.get(token)
    if (!doc) {
      return null
    }
    // Map re-insertion moves the key to the end — i.e. "most recently used".
    this.commandDocCache.delete(token)
    this.commandDocCache.set(token, doc)
    const changed = this.lastDoc !== doc
    this.lastDoc = doc
    if (changed) {
      this.sidebarDidChangeEmitter.fire()
    }
    return doc
  }

  getHoverHistory(): HoverHistoryEntry[] {
    return [...this.hoverHistory]
  }

  rememberCommandDoc(doc: HoverDoc, commandToken: string): HoverDoc {
    doc.metadata = {
      ...(doc.metadata ?? {}),
      commandToken,
      indexedPackage:
        typeof doc.metadata?.indexedPackage === 'string'
          ? doc.metadata.indexedPackage
          : doc.module?.split('.')[0],
      indexedModule:
        typeof doc.metadata?.indexedModule === 'string' ? doc.metadata.indexedModule : doc.module,
      indexedName:
        typeof doc.metadata?.indexedName === 'string' ? doc.metadata.indexedName : doc.title,
    }
    this.commandDocCache.set(commandToken, doc)
    this.evictIfNeeded(this.commandDocCache)
    this.lastDoc = doc
    this.sidebarDidChangeEmitter.fire()
    return doc
  }

  rememberHoverHistoryEntry(entry: HoverHistoryEntry): void {
    const normalizedTitle = entry.title.trim()
    if (!normalizedTitle) {
      return
    }

    const normalizedEntry: HoverHistoryEntry = {
      ...entry,
      title: normalizedTitle,
    }
    const dedupeKey = `${normalizedEntry.title}|${normalizedEntry.kind ?? ''}|${normalizedEntry.module ?? ''}|${normalizedEntry.url ?? ''}`
    this.hoverHistory = [
      normalizedEntry,
      ...this.hoverHistory.filter(
        existing =>
          `${existing.title}|${existing.kind ?? ''}|${existing.module ?? ''}|${existing.url ?? ''}` !==
          dedupeKey,
      ),
    ]
    if (this.hoverHistory.length > HoverSessionState.MAX_HISTORY_ENTRIES) {
      this.hoverHistory.length = HoverSessionState.MAX_HISTORY_ENTRIES
    }
    this.sidebarDidChangeEmitter.fire()
  }

  fireSidebarDidChange(): void {
    this.sidebarDidChangeEmitter.fire()
  }

  dispose(): void {
    this.sidebarDidChangeEmitter.dispose()
  }

  private evictIfNeeded<K, V>(map: Map<K, V>): void {
    if (this.keepIndefinitely() || map.size <= HoverSessionState.MAX_COMMAND_DOCS) {
      return
    }

    const excess = map.size - HoverSessionState.MAX_COMMAND_DOCS
    for (const key of Array.from(map.keys()).slice(0, excess)) {
      map.delete(key)
    }
  }
}
