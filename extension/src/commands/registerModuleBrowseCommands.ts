import { IndexedSymbolSummary } from '#shared/types'
import { HoverProvider } from '#src/hover/hoverProvider'
import { HoverPanel } from '#src/ui/panels/hoverPanel'
import { isStdlibTopLevelModule } from '#src/symbols/symbolClassifier'
import { ModuleBrowserSettings } from '#src/ui/panels/moduleBrowserPanel'
import * as vscode from 'vscode'

type ModuleBrowserPanelPort = {
  show: (
    moduleName: string,
    symbols: IndexedSymbolSummary[],
    settings: ModuleBrowserSettings,
  ) => void
}

type RegisterModuleBrowseCommandsDeps = {
  hoverProvider: HoverProvider
  moduleBrowserPanel: ModuleBrowserPanelPort
  buildModuleBrowserSettings: () => ModuleBrowserSettings
  configOnlineDiscovery: () => boolean
  getRecentPackages: () => string[]
  rememberRecentPackage: (packageName: string | undefined) => Promise<void>
}

export function registerModuleBrowseCommands(
  context: vscode.ExtensionContext,
  deps: RegisterModuleBrowseCommandsDeps,
): void {
  const ensureIndexedPackageLoaded = async (packageName: string) => {
    const normalized = packageName.trim()
    if (!normalized) {
      return
    }

    await deps.hoverProvider.ensureIndexedPackage(
      normalized,
      normalized === 'builtins' || normalized === 'python' || isStdlibTopLevelModule(normalized),
    )
  }

  const getBrowseablePackages = async (): Promise<string[]> => {
    let packages = deps.hoverProvider.getIndexedPackages()
    if (packages.length > 0) {
      return packages
    }

    packages = await deps.hoverProvider.hydrateCachedInventories()
    if (packages.length > 0) {
      return packages
    }

    await Promise.all([
      ensureIndexedPackageLoaded('builtins'),
      ensureIndexedPackageLoaded('typing'),
      ensureIndexedPackageLoaded('asyncio'),
    ])

    return deps.hoverProvider.getIndexedPackages()
  }

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'python-hover.getIndexedSymbolPreviews',
      async (symbols: IndexedSymbolSummary[]) => {
        return deps.hoverProvider.getIndexedSymbolPreviews(Array.isArray(symbols) ? symbols : [])
      },
    ),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('python-hover.pinIndexedSymbol', async (symbol: IndexedSymbolSummary) => {
      if (!symbol?.name) {
        return
      }

      const doc = await deps.hoverProvider.resolveIndexedSymbolDoc(symbol)
      if (!doc) {
        vscode.window.showInformationMessage(
          `No pinned hover content is available for "${symbol.name}" yet.`,
        )
        return
      }

      HoverPanel.show(doc)
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('python-hover.browseModule', async (moduleName: string) => {
      let targetModule = moduleName?.trim()
      if (!targetModule) {
        type ModulePickItem = vscode.QuickPickItem & {
          moduleName?: string
        }

        const packages = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Window,
            title: 'PyHover: Preparing module index…',
          },
          getBrowseablePackages,
        )

        if (packages.length === 0) {
          const online = deps.configOnlineDiscovery()
          const action = await vscode.window.showInformationMessage(
            online
              ? 'PyHover could not prepare a module index. You can still search docs or inspect resolver logs.'
              : 'Browse Modules needs cached indexes. Enable online discovery to fetch them, or search the docs already available.',
            online ? 'Search Docs' : 'Enable Online Discovery',
            'Show Logs',
          )
          if (action === 'Search Docs') {
            await vscode.commands.executeCommand('python-hover.searchDocs')
          } else if (action === 'Enable Online Discovery') {
            await vscode.commands.executeCommand('python-hover.toggleOnlineDiscovery')
          } else if (action === 'Show Logs') {
            await vscode.commands.executeCommand('python-hover.showLogs')
          }
          return
        }

        const summaryByName = new Map(
          deps.hoverProvider
            .getIndexedPackageSummaries()
            .map(summary => [summary.name, summary.count]),
        )
        const recentPackageNames = new Set(deps.getRecentPackages())
        const packageItems = packages
          .map(pkg => ({
            label: `${isStdlibTopLevelModule(pkg) || pkg === 'builtins' ? '$(library)' : '$(package)'} ${pkg}`,
            description: summaryByName.has(pkg)
              ? `${(summaryByName.get(pkg) ?? 0).toLocaleString()} indexed symbols`
              : 'Indexed module/package',
            detail: recentPackageNames.has(pkg)
              ? isStdlibTopLevelModule(pkg) || pkg === 'builtins'
                ? 'Recent standard-library package'
                : 'Recent package'
              : isStdlibTopLevelModule(pkg) || pkg === 'builtins'
                ? 'Python standard library'
                : 'Indexed third-party or custom library',
            moduleName: pkg,
          }))
          .sort((left, right) => {
            const leftRecent = left.moduleName ? recentPackageNames.has(left.moduleName) : false
            const rightRecent = right.moduleName ? recentPackageNames.has(right.moduleName) : false
            if (leftRecent !== rightRecent) {
              return leftRecent ? -1 : 1
            }
            return (left.moduleName ?? left.label).localeCompare(right.moduleName ?? right.label)
          })

        const items: ModulePickItem[] = []
        const recentItems = packageItems.filter(
          item => item.moduleName && recentPackageNames.has(item.moduleName),
        )
        const stdlibItems = packageItems.filter(
          item =>
            item.moduleName &&
            !recentPackageNames.has(item.moduleName) &&
            (isStdlibTopLevelModule(item.moduleName) || item.moduleName === 'builtins'),
        )
        const libraryItems = packageItems.filter(
          item =>
            item.moduleName &&
            !recentPackageNames.has(item.moduleName) &&
            !isStdlibTopLevelModule(item.moduleName) &&
            item.moduleName !== 'builtins',
        )

        if (recentItems.length > 0) {
          items.push({
            label: 'Recent Packages',
            kind: vscode.QuickPickItemKind.Separator,
          })
          items.push(...recentItems)
        }
        if (stdlibItems.length > 0) {
          items.push({
            label: 'Standard Library',
            kind: vscode.QuickPickItemKind.Separator,
          })
          items.push(...stdlibItems)
        }
        if (libraryItems.length > 0) {
          items.push({
            label: 'Libraries',
            kind: vscode.QuickPickItemKind.Separator,
          })
          items.push(...libraryItems)
        }

        const picked = await vscode.window.showQuickPick(items, {
          title: 'Browse Indexed Module',
          placeHolder: 'Select or search for an indexed module or package',
          matchOnDescription: true,
          matchOnDetail: true,
        })

        if (!picked) {
          return
        }
        const selectedModuleName = (picked as ModulePickItem).moduleName
        if (!selectedModuleName) {
          return
        }
        targetModule = selectedModuleName
      }

      let moduleSymbols = deps.hoverProvider.getModuleSymbols(targetModule)

      if (moduleSymbols.length === 0) {
        const requestedPackage = targetModule.split('.')[0] || targetModule
        await ensureIndexedPackageLoaded(requestedPackage)

        moduleSymbols = deps.hoverProvider.getModuleSymbols(targetModule)
      }

      if (moduleSymbols.length === 0) {
        await deps.hoverProvider.hydrateCachedInventories()
        moduleSymbols = deps.hoverProvider.getModuleSymbols(targetModule)
        if (moduleSymbols.length > 0) {
          await deps.rememberRecentPackage(targetModule)
          deps.moduleBrowserPanel.show(targetModule, moduleSymbols, deps.buildModuleBrowserSettings())
          return
        }

        const failedDiscovery = deps.hoverProvider.hasFailedDiscovery(
          targetModule.split('.')[0] || targetModule,
        )
        const action = await vscode.window.showInformationMessage(
          failedDiscovery
            ? `No browsable documentation index was found for "${targetModule}". Individual symbol hovers may still work from runtime docstrings.`
            : `No indexed symbols are available for "${targetModule}" yet.`,
          'Search Docs',
          'Show Logs',
        )
        if (action === 'Search Docs') {
          await vscode.commands.executeCommand('python-hover.searchDocs', targetModule)
        } else if (action === 'Show Logs') {
          await vscode.commands.executeCommand('python-hover.showLogs')
        }
        return
      }

      await deps.rememberRecentPackage(targetModule)
      deps.moduleBrowserPanel.show(targetModule, moduleSymbols, deps.buildModuleBrowserSettings())
    }),
  )
}
