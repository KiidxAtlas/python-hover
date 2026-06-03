import * as vscode from 'vscode'
import { HoverDoc, HoverHistoryEntry, SavedDocEntry } from '#shared/types'

type LibraryStateDeps = {
  globalState: vscode.Memento
  savedDocsStateKey: string
  recentPackagesStateKey: string
  maxSavedDocs: number
  normalizeSavedDocEntry: (entry: Partial<SavedDocEntry>) => SavedDocEntry | undefined
  buildSavedDocEntry: (doc: HoverDoc) => SavedDocEntry | undefined
  getDocByCommandToken: (token?: string) => HoverDoc | null
  getExactDocByCommandToken: (token: string) => HoverDoc | null
  getLastDoc: () => HoverDoc | null
  getHoverHistory: () => HoverHistoryEntry[]
  getIndexedPackageSummaries: () => Array<{ name: string; count: number }>
  onSavedDocsChanged: () => void
  onRecentPackagesChanged: () => void
}

type ToggleSavedDocResult =
  | { status: 'invalid' }
  | { status: 'added'; entry: SavedDocEntry }
  | { status: 'removed'; entry: SavedDocEntry }

function normalizeIndexedPackage(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) {
    return undefined
  }

  const normalized = trimmed.split('.')[0]?.trim()
  if (!normalized || normalized === '__python_stdlib__') {
    return undefined
  }

  return normalized
}

export function createLibraryState(deps: LibraryStateDeps) {
  const getSavedDocs = (): SavedDocEntry[] => {
    const stored = deps.globalState.get<Partial<SavedDocEntry>[]>(deps.savedDocsStateKey, [])
    return stored.flatMap(entry => {
      const normalized = deps.normalizeSavedDocEntry(entry)
      return normalized ? [normalized] : []
    })
  }

  const updateSavedDocs = async (entries: SavedDocEntry[]) => {
    await deps.globalState.update(deps.savedDocsStateKey, entries.slice(0, deps.maxSavedDocs))
    deps.onSavedDocsChanged()
  }

  const resolveSavedDocEntry = (payload?: string | Partial<SavedDocEntry>): SavedDocEntry | undefined => {
    if (typeof payload === 'string') {
      const doc = deps.getDocByCommandToken(payload)
      if (!doc) {
        return undefined
      }
      return deps.buildSavedDocEntry(doc)
    }

    if (payload && typeof payload === 'object') {
      const commandToken =
        typeof payload.commandToken === 'string' ? payload.commandToken : undefined
      const liveDoc = commandToken ? deps.getExactDocByCommandToken(commandToken) : null
      return liveDoc ? deps.buildSavedDocEntry(liveDoc) : deps.normalizeSavedDocEntry(payload)
    }

    const doc = deps.getLastDoc()
    if (!doc) {
      return undefined
    }
    return deps.buildSavedDocEntry(doc)
  }

  const toggleSavedDoc = async (
    payload?: string | Partial<SavedDocEntry>,
  ): Promise<ToggleSavedDocResult> => {
    const entry = resolveSavedDocEntry(payload)
    if (!entry) {
      return { status: 'invalid' }
    }

    const current = getSavedDocs()
    const existingIndex = current.findIndex(saved => saved.id === entry.id)
    if (existingIndex >= 0) {
      current.splice(existingIndex, 1)
      await updateSavedDocs(current)
      return { status: 'removed', entry }
    }

    await updateSavedDocs([entry, ...current.filter(saved => saved.id !== entry.id)])
    return { status: 'added', entry }
  }

  const removeSavedDoc = async (payload?: Partial<SavedDocEntry>) => {
    const entry = payload ? deps.normalizeSavedDocEntry(payload) : undefined
    if (!entry) {
      return
    }

    const next = getSavedDocs().filter(saved => saved.id !== entry.id)
    await updateSavedDocs(next)
  }

  const rememberRecentPackage = async (packageName: string | undefined) => {
    const normalized = normalizeIndexedPackage(packageName)
    if (!normalized) {
      return
    }

    const current = deps.globalState.get<string[]>(deps.recentPackagesStateKey, [])
    const next = [normalized, ...current.filter(entry => entry !== normalized)].slice(0, 8)
    await deps.globalState.update(deps.recentPackagesStateKey, next)
    deps.onRecentPackagesChanged()
  }

  const getRecentPackages = (): string[] => {
    const stored = deps.globalState.get<string[]>(deps.recentPackagesStateKey, [])
    const fromHistory = deps
      .getHoverHistory()
      .map(entry => normalizeIndexedPackage(entry.package ?? entry.module))
      .filter((entry): entry is string => !!entry)
    const ordered = [...stored, ...fromHistory]
      .map(entry => normalizeIndexedPackage(entry))
      .filter((entry): entry is string => !!entry)

    return [...new Set(ordered)].slice(0, 8)
  }

  const getRecentPackageSummaries = (limit = 6): Array<{ name: string; count: number }> => {
    const counts = new Map(deps.getIndexedPackageSummaries().map(summary => [summary.name, summary.count]))
    return getRecentPackages()
      .flatMap(name => (counts.has(name) ? [{ name, count: counts.get(name) ?? 0 }] : []))
      .slice(0, limit)
  }

  return {
    getSavedDocs,
    toggleSavedDoc,
    removeSavedDoc,
    rememberRecentPackage,
    getRecentPackages,
    getRecentPackageSummaries,
  }
}
