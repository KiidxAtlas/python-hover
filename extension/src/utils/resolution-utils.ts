import { BUILTIN_OWNER_TYPES, BUILTIN_TYPES } from '#shared/pythonBuiltins'
import { LspSymbol } from '#shared/types'
import { isLibraryPath } from '#src/symbols/symbolClassifier'

export function moduleFromLibraryPath(fsPath: string): string | null {
  const normalizedPath = fsPath.replace(/\\/g, '/')
  const markers = [
    '/site-packages/',
    '/dist-packages/',
    '/bundled/stubs/',
    '/typeshed-fallback/stdlib/',
    '/stdlib/',
    '/stubs/',
  ]

  for (const marker of markers) {
    const markerIndex = normalizedPath.lastIndexOf(marker)
    if (markerIndex === -1) {
      continue
    }

    let relative = normalizedPath.slice(markerIndex + marker.length)
    relative = relative.replace(/^python\d+(?:\.\d+)?\//, '')
    relative = relative.replace(/^\d+\.\d+\//, '')
    relative = relative.replace(/\.(py|pyi)$/, '')
    if (relative.endsWith('/__init__')) {
      relative = relative.slice(0, -9)
    }

    let moduleName = relative.replace(/\//g, '.')
    moduleName = moduleName.replace(/^([^.]+)-stubs/, '$1')
    if (['ntpath', 'posixpath', 'macpath'].includes(moduleName)) {
      moduleName = 'os.path'
    }

    return moduleName || null
  }

  return null
}

export function normalizeBuiltinDunderAlias(name: string): string {
  const normalized = name.replace(/^builtins\./, '')
  const explicitAliases: Record<string, string> = {
    'type.__instancecheck__': 'isinstance',
    'type.__subclasscheck__': 'issubclass',
    'type.__call__': 'type',
  }
  if (explicitAliases[normalized]) {
    return explicitAliases[normalized]
  }

  const dotted = /^([A-Za-z_][A-Za-z0-9_.]*)\.(__[A-Za-z0-9_]+__)$/.exec(normalized)
  if (!dotted) {
    return name
  }

  const owner = dotted[1]
  const dunder = dotted[2]
  const ownerLeaf = owner.split('.').pop() ?? owner
  const isBuiltinOwner = BUILTIN_OWNER_TYPES.has(ownerLeaf) || BUILTIN_TYPES.has(ownerLeaf)
  if (!isBuiltinOwner) {
    return name
  }

  const dunderToBuiltin: Record<string, string> = {
    __len__: 'len',
    __iter__: 'iter',
    __next__: 'next',
    __reversed__: 'reversed',
    __bool__: 'bool',
    __int__: 'int',
    __float__: 'float',
    __complex__: 'complex',
    __bytes__: 'bytes',
    __str__: 'str',
    __repr__: 'repr',
    __format__: 'format',
    __hash__: 'hash',
    __abs__: 'abs',
    __round__: 'round',
    __dir__: 'dir',
  }

  return dunderToBuiltin[dunder] ?? name
}

export function shouldUseInstalledSourceFallback(
  runtimeHelperEnabled: boolean,
  symbolInfo: LspSymbol,
  libraryPath?: string,
): boolean {
  if (!runtimeHelperEnabled || !libraryPath || !isLibraryPath(libraryPath)) {
    return false
  }

  if (!/\.(?:py|pyi)$/i.test(libraryPath)) {
    return false
  }

  if (!symbolInfo.docstring?.trim()) {
    return true
  }

  return isWeakLibrarySignature(symbolInfo.signature)
}

export function isWeakLibrarySignature(signature?: string): boolean {
  const normalized = signature?.trim()
  if (!normalized) {
    return true
  }

  return /^\(\*args,?\s*\*\*(?:kwargs|kwds)\)$/.test(normalized) || /^\(\.\.\.\)$/.test(normalized)
}

export function buildInstalledSourceCandidates(
  symbolInfo: LspSymbol,
  libraryPath: string,
): string[] {
  const candidates: string[] = []
  const seen = new Set<string>()
  const push = (value?: string) => {
    const normalized = value?.trim().replace(/^builtins\./, '')
    if (!normalized || seen.has(normalized)) {
      return
    }
    seen.add(normalized)
    candidates.push(normalized)
  }

  const fullName = symbolInfo.name.replace(/^builtins\./, '')
  push(fullName)

  const moduleCandidates = new Set<string>()
  if (symbolInfo.module) {
    moduleCandidates.add(symbolInfo.module)
  }
  const moduleFromPath = moduleFromLibraryPath(libraryPath)
  if (moduleFromPath) {
    moduleCandidates.add(moduleFromPath)
  }

  for (const moduleName of moduleCandidates) {
    if (fullName.startsWith(`${moduleName}.`)) {
      push(fullName.slice(moduleName.length + 1))
    }
  }

  const parts = fullName.split('.').filter(Boolean)
  if (parts.length >= 3) {
    push(parts.slice(-3).join('.'))
  }
  if (parts.length >= 2) {
    push(parts.slice(-2).join('.'))
  }
  if (
    parts.length === 1 ||
    symbolInfo.kind === 'function' ||
    symbolInfo.kind === 'class' ||
    symbolInfo.kind === 'module'
  ) {
    push(parts[parts.length - 1])
  }

  return candidates
}
