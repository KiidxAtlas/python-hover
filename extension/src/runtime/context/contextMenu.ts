import * as vscode from 'vscode'

export type ContextMenuFlags = {
  enabled: boolean
  searchDocs: boolean
  browseModule: boolean
  pinHover: boolean
  debugPinHover: boolean
  openStudio: boolean
}

export function applyContextMenuContexts(flags: ContextMenuFlags): void {
  void Promise.all([
    vscode.commands.executeCommand('setContext', 'pyhover.contextMenu.enabled', flags.enabled),
    vscode.commands.executeCommand('setContext', 'pyhover.contextMenu.searchDocs', flags.searchDocs),
    vscode.commands.executeCommand(
      'setContext',
      'pyhover.contextMenu.browseModule',
      flags.browseModule,
    ),
    vscode.commands.executeCommand('setContext', 'pyhover.contextMenu.pinHover', flags.pinHover),
    vscode.commands.executeCommand(
      'setContext',
      'pyhover.contextMenu.debugPinHover',
      flags.debugPinHover,
    ),
    vscode.commands.executeCommand(
      'setContext',
      'pyhover.contextMenu.openStudio',
      flags.openStudio,
    ),
  ])
}
