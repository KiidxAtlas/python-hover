export const REGULAR_HOVER_SECTION_ORDER = [
  'signature',
  'parameterLens',
  'callouts',
  'description',
  'parameters',
  'returns',
  'raises',
  'examples',
  'seeAlso',
  'notes',
  'footer',
] as const

export type RegularHoverSectionId = (typeof REGULAR_HOVER_SECTION_ORDER)[number]

export type RegularHoverSectionMeta = {
  id: RegularHoverSectionId
  label: string
  description: string
  visibilitySettingKey: string
  compactAllowed: boolean
}

export const REGULAR_HOVER_SECTION_META: RegularHoverSectionMeta[] = [
  {
    id: 'signature',
    label: 'Signature',
    description: 'Function or method signature shown near the top of regular symbol hovers.',
    visibilitySettingKey: 'python-hover.ui.showSignatures',
    compactAllowed: true,
  },
  {
    id: 'parameterLens',
    label: 'Active parameter',
    description: 'Inline current-argument detail shown while editing function calls.',
    visibilitySettingKey: 'python-hover.ui.showParameterLens',
    compactAllowed: true,
  },
  {
    id: 'callouts',
    label: 'Callouts',
    description: 'Deprecation, version, and protocol hint callouts.',
    visibilitySettingKey: 'python-hover.ui.showCallouts',
    compactAllowed: true,
  },
  {
    id: 'description',
    label: 'Overview',
    description: 'Main documentation summary and narrative body.',
    visibilitySettingKey: 'python-hover.ui.showDescription',
    compactAllowed: true,
  },
  {
    id: 'parameters',
    label: 'Parameters',
    description: 'Structured parameter table for functions and methods.',
    visibilitySettingKey: 'python-hover.ui.showParameters',
    compactAllowed: false,
  },
  {
    id: 'returns',
    label: 'Returns',
    description: 'Return type and return-value notes.',
    visibilitySettingKey: 'python-hover.ui.showReturnTypes',
    compactAllowed: false,
  },
  {
    id: 'raises',
    label: 'Raises',
    description: 'Exceptions section when docs include error details.',
    visibilitySettingKey: 'python-hover.ui.showRaises',
    compactAllowed: false,
  },
  {
    id: 'examples',
    label: 'Examples',
    description: 'Inline examples and worked snippets.',
    visibilitySettingKey: 'python-hover.ui.showPracticalExamples',
    compactAllowed: false,
  },
  {
    id: 'seeAlso',
    label: 'See also',
    description: 'Related references and linked symbols.',
    visibilitySettingKey: 'python-hover.ui.showSeeAlso',
    compactAllowed: false,
  },
  {
    id: 'notes',
    label: 'Notes',
    description: 'Additional note blocks extracted from docs.',
    visibilitySettingKey: 'python-hover.ui.showNotes',
    compactAllowed: false,
  },
  {
    id: 'footer',
    label: 'Footer',
    description: 'Import hints and secondary hover tools footer.',
    visibilitySettingKey: 'python-hover.ui.showFooter',
    compactAllowed: true,
  },
]

const REGULAR_HOVER_SECTION_ID_SET = new Set<string>(REGULAR_HOVER_SECTION_ORDER)

export function isRegularHoverSectionId(value: string): value is RegularHoverSectionId {
  return REGULAR_HOVER_SECTION_ID_SET.has(value)
}

export function normalizeRegularHoverSectionOrder(value: unknown): RegularHoverSectionId[] {
  const normalized: RegularHoverSectionId[] = []
  const seen = new Set<RegularHoverSectionId>()
  const raw = Array.isArray(value) ? value : []

  for (const entry of raw) {
    if (typeof entry !== 'string' || !isRegularHoverSectionId(entry) || seen.has(entry)) {
      continue
    }
    normalized.push(entry)
    seen.add(entry)
  }

  for (const id of REGULAR_HOVER_SECTION_ORDER) {
    if (!seen.has(id)) {
      normalized.push(id)
      seen.add(id)
    }
  }

  return normalized
}
