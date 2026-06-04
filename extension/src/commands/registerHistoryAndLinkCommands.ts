import {
  HoverHistoryEntry,
  HoverDoc,
  IndexedSymbolSummary,
} from '#shared/types'
import { HoverProvider } from '#src/hover/hoverProvider'
import { HoverInspectorView } from '#src/ui/views/hoverInspectorView'
import * as vscode from 'vscode'

type RegisterHistoryAndLinkCommandsDeps = {
  hoverProvider: HoverProvider
  hoverInspectorView: HoverInspectorView
  openConfiguredLink: (url: string, kind?: 'docs' | 'devdocs') => Promise<void>
  openIntegratedDocs: (url: string) => Promise<void>
  parseDocLinkPayload: (
    payload?: string | { url?: string; kind?: string },
  ) => { url?: string; kind: 'docs' | 'devdocs' }
  parsePreferredDocsPayload: (
    payload?: string | { url?: string; token?: string; kind?: string },
  ) => { url?: string; token?: string; kind: 'docs' | 'devdocs' }
  openHoverDocSource: (
    doc: HoverDoc,
    openUrl: (url: string) => Promise<void>,
  ) => Promise<boolean>
  openSourceTarget: (
    target: string,
    openUrl: (url: string) => Promise<void>,
  ) => Promise<boolean>
  openIndexedSymbolSource: (
    symbol: IndexedSymbolSummary,
    hoverProvider: HoverProvider,
    openUrl: (url: string) => Promise<void>,
  ) => Promise<boolean>
  liveRedirectIntegratedHoverToDocsPage: () => boolean
  docsBrowserMode: () => 'integrated' | 'external'
}

export function registerHistoryAndLinkCommands(
  context: vscode.ExtensionContext,
  deps: RegisterHistoryAndLinkCommandsDeps,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('python-hover.showHistory', async () => {
      const history = deps.hoverProvider.getHoverHistory()
      if (history.length === 0) {
        vscode.window.showInformationMessage(
          'No hover history yet — hover over Python symbols to populate it.',
        )
        return
      }

      type HistoryItem = vscode.QuickPickItem & { entry: HoverHistoryEntry }
      const liveEntries = history.filter(entry => !!entry.commandToken)
      const linkedEntries = history.filter(entry => !entry.commandToken && !!entry.url)
      const makeHistoryItem = (entry: HoverHistoryEntry, detail: string): HistoryItem => ({
        label: entry.title,
        description: [entry.kind, entry.module ?? entry.package].filter(Boolean).join(' • '),
        detail,
        entry,
      })

      const items: Array<HistoryItem | vscode.QuickPickItem> = []
      if (liveEntries.length > 0) {
        items.push({
          label: `Live Session (${liveEntries.length})`,
          kind: vscode.QuickPickItemKind.Separator,
        })
        items.push(
          ...liveEntries.map(entry =>
            makeHistoryItem(entry, 'Reopen this symbol in the PyHover inspector.'),
          ),
        )
      }
      if (linkedEntries.length > 0) {
        items.push({
          label: `Docs Links (${linkedEntries.length})`,
          kind: vscode.QuickPickItemKind.Separator,
        })
        items.push(
          ...linkedEntries.map(entry =>
            makeHistoryItem(entry, 'Open the stored documentation target.'),
          ),
        )
      }

      const picked = (await vscode.window.showQuickPick(items, {
        title: 'PyHover: Hover History',
        placeHolder: 'Recent symbols grouped by live session entries and stored docs links',
        matchOnDescription: true,
        matchOnDetail: true,
      })) as HistoryItem | undefined
      if (picked?.entry) {
        void vscode.commands.executeCommand('python-hover.openSidebarHistoryEntry', picked.entry)
      }
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('python-hover.openSidebarHistoryEntry', async (entry?: HoverHistoryEntry) => {
      const commandToken =
        typeof entry?.commandToken === 'string' ? entry.commandToken : undefined
      const doc = commandToken
        ? deps.hoverProvider.getExactDocByCommandToken(commandToken)
        : null

      if (doc) {
        deps.hoverInspectorView.showDoc(doc)
        void vscode.commands.executeCommand(`${HoverInspectorView.viewType}.focus`).then(undefined, () => undefined)
        return
      }

      if (entry?.url) {
        await deps.openConfiguredLink(entry.url, 'docs')
        return
      }

      vscode.window.showInformationMessage(
        'That history entry is no longer available in the current session.',
      )
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('python-hover.openDocsSide', (url: string) => {
      void deps.openIntegratedDocs(url)
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'python-hover.openDocLink',
      async (payload?: string | { url?: string; kind?: string }) => {
        const { url, kind } = deps.parseDocLinkPayload(payload)
        if (!url) {
          return
        }
        await deps.openConfiguredLink(url, kind)
      },
    ),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'python-hover.openPreferredDocs',
      async (payload?: string | { url?: string; token?: string; kind?: string }) => {
        const { url, token, kind } = deps.parsePreferredDocsPayload(payload)
        if (!url) {
          return
        }

        if (
          kind === 'docs' &&
          deps.docsBrowserMode() === 'integrated' &&
          deps.liveRedirectIntegratedHoverToDocsPage() &&
          token
        ) {
          const doc = deps.hoverProvider.getDocByCommandToken(token)
          if (doc) {
            await vscode.commands.executeCommand('python-hover.pinHover', token)
            return
          }
        }

        await deps.openConfiguredLink(url, kind)
      },
    ),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'python-hover.openHoverSource',
      async (payload?: string | { token?: string; target?: string }) => {
        const token =
          typeof payload === 'string'
            ? payload
            : typeof payload?.token === 'string'
              ? payload.token
              : undefined
        const fallbackTarget =
          typeof payload === 'object' && payload && typeof payload.target === 'string'
            ? payload.target
            : undefined

        const doc = deps.hoverProvider.getDocByCommandToken(token)
        const opened = doc
          ? await deps.openHoverDocSource(doc, url => deps.openConfiguredLink(url, 'docs'))
          : fallbackTarget
            ? await deps.openSourceTarget(fallbackTarget, url => deps.openConfiguredLink(url, 'docs'))
            : false

        if (!opened) {
          vscode.window.showInformationMessage('No source location is available for this hover.')
        }
      },
    ),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'python-hover.openIndexedSymbolSource',
      async (symbol: IndexedSymbolSummary) => {
        if (!symbol?.name) {
          return
        }

        const opened = await deps.openIndexedSymbolSource(
          symbol,
          deps.hoverProvider,
          url => deps.openConfiguredLink(url, 'docs'),
        )
        if (!opened) {
          vscode.window.showInformationMessage(
            `No source location is available for "${symbol.name}".`,
          )
        }
      },
    ),
  )
}
