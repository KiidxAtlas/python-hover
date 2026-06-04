import * as vscode from 'vscode';

export type DocsLinkKind = 'docs' | 'devdocs'

export type DocsRoutingPayload = { url?: string; kind?: string }
export type PreferredDocsRoutingPayload = { url?: string; token?: string; kind?: string }

export type DocsRoutingDeps = {
  getBrowserForKind: (kind: DocsLinkKind) => 'integrated' | 'external'
  showDocsPanel: (url: string) => void
  logError: (message: string, error: unknown) => void
}

export function createDocsRouting(deps: DocsRoutingDeps) {
  const normalizeHttpUrl = (candidate: string): string | undefined => {
    const trimmed = candidate.trim()
    if (!trimmed) {
      return undefined
    }

    const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)
      ? trimmed
      : `https://${trimmed}`

    try {
      const parsed = new URL(withProtocol)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return undefined
      }
      return parsed.toString()
    } catch {
      return undefined
    }
  }

  const openIntegratedDocs = async (url: string) => {
    const normalized = normalizeHttpUrl(url)
    if (!normalized) {
      return
    }

    try {
      await vscode.commands.executeCommand('simpleBrowser.show', normalized)
    } catch (error) {
      deps.logError('Failed to open integrated browser. Falling back to docs panel.', error)
      deps.showDocsPanel(normalized)
    }
  }

  const openConfiguredLink = async (url: string, kind: DocsLinkKind = 'docs') => {
    const normalized = normalizeHttpUrl(url)
    if (!normalized) {
      return
    }

    const browser = deps.getBrowserForKind(kind)
    if (browser === 'integrated') {
      await openIntegratedDocs(normalized)
      return
    }

    await vscode.env.openExternal(vscode.Uri.parse(normalized))
  }

  const parseDocLinkPayload = (payload: unknown): { url?: string; kind: DocsLinkKind } => {
    if (typeof payload === 'string') {
      return { url: payload, kind: 'docs' }
    }

    if (!payload || typeof payload !== 'object') {
      return { url: undefined, kind: 'docs' }
    }

    const candidate = payload as DocsRoutingPayload
    return {
      url: typeof candidate.url === 'string' ? candidate.url : undefined,
      kind: candidate.kind === 'devdocs' ? 'devdocs' : 'docs',
    }
  }

  const parsePreferredDocsPayload = (
    payload: unknown,
  ): { url?: string; token?: string; kind: DocsLinkKind } => {
    if (typeof payload === 'string') {
      return { url: payload, token: undefined, kind: 'docs' }
    }

    if (!payload || typeof payload !== 'object') {
      return { url: undefined, token: undefined, kind: 'docs' }
    }

    const candidate = payload as PreferredDocsRoutingPayload
    return {
      url: typeof candidate.url === 'string' ? candidate.url : undefined,
      token: typeof candidate.token === 'string' ? candidate.token : undefined,
      kind: candidate.kind === 'devdocs' ? 'devdocs' : 'docs',
    }
  }

  return {
    openIntegratedDocs,
    openConfiguredLink,
    parseDocLinkPayload,
    parsePreferredDocsPayload,
  }
}
