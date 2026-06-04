import { HoverDoc, SavedDocEntry } from '#shared/types'
import { HoverProvider } from '#src/hover/hoverProvider'
import { HoverPanel } from '#src/ui/panels/hoverPanel'
import { HoverInspectorView } from '#src/ui/views/hoverInspectorView'
import * as vscode from 'vscode'

type RegisterSavedAndPanelCommandsDeps = {
  hoverProvider: HoverProvider
  hoverInspectorView: HoverInspectorView
  toggleSavedDoc: (payload?: string | Partial<SavedDocEntry>) => Promise<void>
  removeSavedDoc: (payload?: Partial<SavedDocEntry>) => Promise<void>
  normalizeSavedDocEntry: (entry: Partial<SavedDocEntry>) => SavedDocEntry | undefined
  openConfiguredLink: (url: string, kind?: 'docs' | 'devdocs') => Promise<void>
  openSourceTarget: (
    target: string,
    openUrl: (url: string) => Promise<void>,
  ) => Promise<boolean>
  refreshStudio: () => void
  showLogs: () => void
}

export function registerSavedAndPanelCommands(
  context: vscode.ExtensionContext,
  deps: RegisterSavedAndPanelCommandsDeps,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'python-hover.toggleSavedHover',
      async (payload?: string | Partial<SavedDocEntry>) => {
        await deps.toggleSavedDoc(payload)
      },
    ),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'python-hover.removeSavedHover',
      async (payload?: Partial<SavedDocEntry>) => {
        await deps.removeSavedDoc(payload)
      },
    ),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'python-hover.openSavedHoverEntry',
      async (entry?: Partial<SavedDocEntry>) => {
        const savedEntry = entry ? deps.normalizeSavedDocEntry(entry) : undefined
        if (!savedEntry) {
          vscode.window.showInformationMessage('That saved doc entry is no longer available.')
          return
        }

        const commandToken =
          typeof savedEntry.commandToken === 'string' ? savedEntry.commandToken : undefined
        const doc = commandToken
          ? deps.hoverProvider.getExactDocByCommandToken(commandToken)
          : null
        if (doc) {
          deps.hoverInspectorView.showDoc(doc)
          void vscode.commands
            .executeCommand(`${HoverInspectorView.viewType}.focus`)
            .then(undefined, () => undefined)
          return
        }

        if (savedEntry.url) {
          await deps.openConfiguredLink(savedEntry.url, 'docs')
          return
        }

        if (savedEntry.module) {
          await vscode.commands.executeCommand('python-hover.browseModule', savedEntry.module)
          return
        }

        if (savedEntry.sourceUrl) {
          await deps.openSourceTarget(savedEntry.sourceUrl, url => deps.openConfiguredLink(url, 'docs'))
          return
        }

        vscode.window.showInformationMessage('That saved doc entry no longer has an openable target.')
      },
    ),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('python-hover.openStudio', () => {
      deps.refreshStudio()
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('python-hover.showLogs', () => {
      deps.showLogs()
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'python-hover.pinDocReference',
      async (payload?: {
        label?: string
        url?: string
        currentModule?: string
        currentPackage?: string
        currentTitle?: string
      }) => {
        const label = typeof payload?.label === 'string' ? payload.label.trim() : ''
        const url = typeof payload?.url === 'string' ? payload.url.trim() : undefined

        const doc = label
          ? await deps.hoverProvider.resolvePinnedReference({
              label,
              url,
              currentModule:
                typeof payload?.currentModule === 'string' ? payload.currentModule : undefined,
              currentPackage:
                typeof payload?.currentPackage === 'string' ? payload.currentPackage : undefined,
              currentTitle:
                typeof payload?.currentTitle === 'string' ? payload.currentTitle : undefined,
            })
          : null

        if (doc) {
          HoverPanel.push(doc)
          return
        }

        if (url) {
          await deps.openConfiguredLink(url, 'docs')
          return
        }

        if (label) {
          vscode.window.showInformationMessage(
            `No related documentation is indexed for "${label}" yet.`,
          )
        }
      },
    ),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('python-hover.pinPanelBack', () => {
      HoverPanel.goBack()
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('python-hover.pinPanelForward', () => {
      HoverPanel.goForward()
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('python-hover.pinPanelJump', (index?: number) => {
      if (typeof index !== 'number') {
        return
      }
      HoverPanel.jumpTo(index)
    }),
  )
}
