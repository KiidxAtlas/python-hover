import * as vscode from 'vscode'

export type CacheCommandsDeps = {
  context: vscode.ExtensionContext
  config: {
    onlineDiscovery: boolean
  }
  diskCache: {
    clear: (options: { preservePythonStdlibCorpus: boolean }) => void
    clearPythonStdlibCorpus: () => void
  }
  hoverProvider: {
    buildPythonCorpus: (
      onProgress?: (progress: { completed: number; total: number; current: string }) => void,
      shouldCancel?: () => boolean,
    ) => Promise<{ cancelled: boolean; completed: number; targets: number; corpusPackages: number }>
  }
  activeCorpusBuild: () => vscode.CancellationTokenSource | undefined
  setActiveCorpusBuild: (value: vscode.CancellationTokenSource | undefined) => void
  updateStudio: () => void
  statusBarUpdate: () => void
  refreshAfterCacheMutation: (message: string) => void
}

export function createCacheCommands(deps: CacheCommandsDeps) {
  const clearCache = () => {
    deps.diskCache.clear({ preservePythonStdlibCorpus: true })
    vscode.window.showInformationMessage('PyHover cache cleared. Python stdlib corpus preserved.')
    void vscode.commands.executeCommand('python-hover.showLogs')
    deps.refreshAfterCacheMutation('Cache cleared. Recreating hover provider.')
  }

  const clearStdlibCorpus = () => {
    deps.diskCache.clearPythonStdlibCorpus()
    vscode.window.showInformationMessage('PyHover stdlib corpus cleared.')
    deps.refreshAfterCacheMutation('Stdlib corpus cleared. Recreating hover provider.')
  }

  const clearAllCache = () => {
    deps.diskCache.clear({ preservePythonStdlibCorpus: false })
    vscode.window.showInformationMessage('PyHover cleared all cached docs, inventories, and stdlib corpus data.')
    deps.refreshAfterCacheMutation('Full cache cleared. Recreating hover provider.')
  }

  const openCacheFolder = () => {
    const cacheUri = vscode.Uri.joinPath(deps.context.globalStorageUri, 'pyhover-cache')
    void vscode.workspace.fs.createDirectory(cacheUri).then(() => {
      void vscode.commands.executeCommand('revealFileInOS', cacheUri)
    })
  }

  const cancelPythonCorpusBuild = () => {
    const active = deps.activeCorpusBuild()
    if (!active) {
      vscode.window.showInformationMessage('No Python stdlib corpus build is currently running.')
      return
    }

    active.cancel()
    deps.updateStudio()
    vscode.window.showInformationMessage('Cancelling the Python stdlib corpus build…')
  }

  const buildPythonCorpus = async () => {
    if (!deps.config.onlineDiscovery) {
      vscode.window.showWarningMessage('Enable python-hover.onlineDiscovery to build the Python corpus.')
      return
    }

    if (deps.activeCorpusBuild()) {
      vscode.window.showInformationMessage('A Python stdlib corpus build is already running.')
      return
    }

    const cancellation = new vscode.CancellationTokenSource()
    deps.setActiveCorpusBuild(cancellation)
    deps.updateStudio()

    try {
      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'PyHover: Building Python stdlib corpus',
          cancellable: true,
        },
        async (progress, token) => {
          const cancellationSubscription = token.onCancellationRequested(() => {
            cancellation.cancel()
          })

          try {
            let lastReported = 0
            return await deps.hoverProvider.buildPythonCorpus(
              ({ completed, total, current }) => {
                const percent = total > 0 ? Math.floor((completed / total) * 100) : 0
                const increment = Math.max(0, percent - lastReported)
                lastReported = percent
                progress.report({
                  increment,
                  message: `${completed}/${total} ${current.split('#')[0]}`,
                })
              },
              () => cancellation.token.isCancellationRequested,
            )
          } finally {
            cancellationSubscription.dispose()
          }
        },
      )

      if (result.cancelled) {
        vscode.window.showWarningMessage(
          `PyHover: cancelled stdlib corpus build after ${result.completed.toLocaleString()} of ${result.targets.toLocaleString()} targets.`,
        )
      } else {
        vscode.window.showInformationMessage(
          `PyHover: built Python corpus for ${result.targets.toLocaleString()} stdlib targets across ${result.corpusPackages.toLocaleString()} buckets.`,
        )
      }
    } finally {
      cancellation.dispose()
      deps.setActiveCorpusBuild(undefined)
      deps.updateStudio()
      deps.statusBarUpdate()
    }
  }

  return {
    clearCache,
    clearStdlibCorpus,
    clearAllCache,
    cancelPythonCorpusBuild,
    buildPythonCorpus,
    openCacheFolder,
  }
}
