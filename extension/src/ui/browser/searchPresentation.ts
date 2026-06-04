import { IndexedSymbolSummary } from '#shared/types'

function clipText(value: string | undefined, maxLength: number): string | undefined {
  const normalized = value?.replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return undefined
  }

  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

export function formatSymbolKindLabel(kind?: string): string {
  if (!kind) {
    return 'Symbol'
  }

  return kind.charAt(0).toUpperCase() + kind.slice(1).toLowerCase()
}

export function iconForSymbolKind(kind?: string): string {
  switch ((kind ?? '').toLowerCase()) {
    case 'class':
      return '$(symbol-class)'
    case 'method':
      return '$(symbol-method)'
    case 'function':
      return '$(symbol-function)'
    case 'module':
      return '$(symbol-module)'
    case 'property':
      return '$(symbol-property)'
    case 'attribute':
    case 'field':
      return '$(symbol-field)'
    case 'keyword':
      return '$(symbol-key)'
    case 'exception':
      return '$(error)'
    default:
      return '$(symbol-misc)'
  }
}

export function buildSearchResultDescription(result: IndexedSymbolSummary): string {
  const parts = [formatSymbolKindLabel(result.kind)]
  if (result.package) {
    parts.push(result.package)
  }
  if (result.module && result.module !== result.package) {
    parts.push(result.module)
  }
  return parts.join(' • ')
}

export function buildSearchResultDetail(result: IndexedSymbolSummary): string {
  const headline = [clipText(result.signature, 100)].filter(Boolean).join(' • ')
  const summary = clipText(result.summary ?? result.title, 180)
  return [headline, summary].filter(Boolean).join(' — ')
}
