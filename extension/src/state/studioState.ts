import { Config } from '#src/config'
import { StudioActivePreset, StudioPreset, StudioState } from '#src/ui/panels/studioPanel'

type OverviewStats = {
  generalBytes: number
  pythonStdlibCorpusBytes: number
  totalBytes: number
  pythonStdlibCorpusPackages: number
  pythonStdlibCorpusEntries: number
  hasPythonStdlibCorpus: boolean
}

export function getStudioPresetEntries(
  preset: StudioPreset,
): Array<[string, boolean | string | number]> {
  switch (preset) {
    case 'focused':
      return [
        ['ui.compactMode', true],
        ['ui.showMetadataChips', true],
        ['ui.showProvenance', true],
        ['ui.showToolbar', true],
        ['ui.showFooter', false],
        ['ui.showImportHints', false],
        ['ui.showParameters', false],
        ['ui.showRaises', false],
        ['ui.showSeeAlso', false],
        ['ui.showModuleExports', false],
        ['showPracticalExamples', false],
        ['ui.maxContentLength', 420],
        ['ui.maxExamples', 1],
        ['ui.maxModuleExports', 8],
      ]
    case 'deepDocs':
      return [
        ['ui.compactMode', false],
        ['ui.showMetadataChips', true],
        ['ui.showProvenance', true],
        ['ui.showToolbar', true],
        ['ui.showFooter', true],
        ['ui.showImportHints', true],
        ['ui.showParameters', true],
        ['ui.showRaises', true],
        ['ui.showSeeAlso', true],
        ['ui.showModuleExports', true],
        ['ui.showModuleStats', true],
        ['ui.showCallouts', true],
        ['showPracticalExamples', true],
        ['docScraping', true],
        ['buildFullCorpus', true],
        ['ui.maxContentLength', 1400],
        ['maxSnippetLines', 18],
        ['ui.maxParameters', 10],
        ['ui.maxExamples', 4],
        ['ui.maxModuleExports', 32],
        ['ui.maxSeeAlsoItems', 14],
      ]
    case 'balanced':
    default:
      return [
        ['ui.compactMode', false],
        ['ui.showMetadataChips', true],
        ['ui.showProvenance', true],
        ['ui.showToolbar', true],
        ['ui.showFooter', true],
        ['ui.showImportHints', true],
        ['ui.showParameters', true],
        ['ui.showRaises', true],
        ['ui.showSeeAlso', true],
        ['ui.showModuleExports', true],
        ['ui.showModuleStats', true],
        ['ui.showCallouts', true],
        ['showPracticalExamples', true],
        ['docScraping', false],
        ['buildFullCorpus', false],
        ['ui.maxContentLength', 800],
        ['maxSnippetLines', 12],
        ['ui.maxParameters', 6],
        ['ui.maxExamples', 2],
        ['ui.maxModuleExports', 20],
        ['ui.maxSeeAlsoItems', 8],
      ]
  }
}

function getCurrentStudioSettingValues(config: Config): Map<string, boolean | string | number> {
  return new Map<string, boolean | string | number>([
    ['ui.compactMode', config.compactMode],
    ['ui.showMetadataChips', config.showMetadataChips],
    ['ui.showProvenance', config.showProvenance],
    ['ui.showToolbar', config.showToolbar],
    ['ui.showFooter', config.showFooter],
    ['ui.showImportHints', config.showImportHints],
    ['ui.showParameters', config.showParameters],
    ['ui.showRaises', config.showRaises],
    ['ui.showSeeAlso', config.showSeeAlso],
    ['ui.showModuleExports', config.showModuleExports],
    ['ui.showModuleStats', config.showModuleStats],
    ['ui.showCallouts', config.showCallouts],
    ['showPracticalExamples', config.showPracticalExamples],
    ['docScraping', config.docScrapingEnabled],
    ['buildFullCorpus', config.buildFullCorpus],
    ['ui.maxContentLength', config.maxContentLength],
    ['maxSnippetLines', config.maxSnippetLines],
    ['ui.maxParameters', config.maxParameters],
    ['ui.maxExamples', config.maxExamples],
    ['ui.maxModuleExports', config.maxModuleExports],
    ['ui.maxSeeAlsoItems', config.maxSeeAlsoItems],
  ])
}

function inferActiveStudioPreset(config: Config): StudioActivePreset {
  const currentValues = getCurrentStudioSettingValues(config)
  for (const preset of ['focused', 'balanced', 'deepDocs'] as StudioPreset[]) {
    const matches = getStudioPresetEntries(preset).every(
      ([key, value]) => currentValues.get(key) === value,
    )
    if (matches) {
      return preset
    }
  }

  return 'custom'
}

export function buildStudioState(args: {
  config: Config
  version: string
  overview: OverviewStats
  indexedSymbols: number
  isBuildingPythonStdlibCorpus: boolean
  lastHoverTitle?: string
}): StudioState {
  const { config, version, overview, indexedSymbols, isBuildingPythonStdlibCorpus, lastHoverTitle } =
    args

  return {
    version,
    activePreset: inferActiveStudioPreset(config),
    indexedSymbols,
    cacheSizeLabel: `${(overview.generalBytes / 1_048_576).toFixed(1)} MB`,
    corpusSizeLabel: `${(overview.pythonStdlibCorpusBytes / 1_048_576).toFixed(1)} MB`,
    fullCacheSizeLabel: `${(overview.totalBytes / 1_048_576).toFixed(1)} MB`,
    pythonStdlibCorpusPackages: overview.pythonStdlibCorpusPackages,
    pythonStdlibCorpusEntries: overview.pythonStdlibCorpusEntries,
    hasPythonStdlibCorpus: overview.hasPythonStdlibCorpus,
    isBuildingPythonStdlibCorpus,
    lastHoverTitle,
    onlineDiscovery: config.onlineDiscovery,
    runtimeHelper: config.runtimeHelperEnabled,
    astFallback: config.astFallbackEnabled,
    docScraping: config.docScrapingEnabled,
    buildFullCorpus: config.buildFullCorpus,
    warmupImports: config.warmupImports,
    useKnownDocsUrls: config.useKnownDocsUrls,
    enableDebugLogging: config.enableDebugLogging,
    diagnosticsEnabled: config.diagnosticsEnabled,
    showStatusBar: config.showStatusBar,
    showDebugPinButton: config.showDebugPinButton,
    showBadges: config.showBadges,
    showMetadataChips: config.showMetadataChips,
    showSignatures: config.showSignatures,
    showParameterLens: config.showParameterLens,
    showReturnTypes: config.showReturnTypes,
    compactMode: config.compactMode,
    showProvenance: config.showProvenance,
    showToolbar: config.showToolbar,
    showCallouts: config.showCallouts,
    showDescription: config.showDescription,
    showParameters: config.showParameters,
    showSeeAlso: config.showSeeAlso,
    showRaises: config.showRaises,
    showNotes: config.showNotes,
    showModuleExports: config.showModuleExports,
    showModuleStats: config.showModuleStats,
    showFooter: config.showFooter,
    showImportHints: config.showImportHints,
    showPracticalExamples: config.showPracticalExamples,
    docsBrowser: config.docsBrowser,
    devdocsBrowser: config.devdocsBrowser,
    redirectIntegratedHoverToDocsPage: config.redirectIntegratedHoverToDocsPage,
    autoOpenCurrentHoverInIntegratedDocs: config.autoOpenCurrentHoverInIntegratedDocs,
    maxContentLength: config.maxContentLength,
    maxSnippetLines: config.maxSnippetLines,
    maxParameters: config.maxParameters,
    maxExamples: config.maxExamples,
    maxModuleExports: config.maxModuleExports,
    maxSeeAlsoItems: config.maxSeeAlsoItems,
    requestTimeout: config.requestTimeout,
    hoverActivationDelay: config.hoverActivationDelay,
    inventoryCacheDays: config.inventoryCacheDays,
    snippetCacheHours: config.snippetCacheHours,
    moduleBrowserDefaultView: config.moduleBrowserDefaultView,
    moduleBrowserDefaultSort: config.moduleBrowserDefaultSort,
    moduleBrowserDefaultDensity: config.moduleBrowserDefaultDensity,
    moduleBrowserShowPrivateSymbols: config.moduleBrowserShowPrivateSymbols,
    moduleBrowserAutoLoadPreviews: config.moduleBrowserAutoLoadPreviews,
    moduleBrowserShowHierarchyHints: config.moduleBrowserShowHierarchyHints,
    contextMenuEnabled: config.showEditorContextMenu,
    contextMenuSearchDocs: config.showSearchDocsContextMenu,
    contextMenuBrowseModule: config.showBrowseModuleContextMenu,
    contextMenuPinHover: config.showPinHoverContextMenu,
    contextMenuDebugPinHover: config.showDebugPinHoverContextMenu,
    contextMenuOpenStudio: config.showOpenStudioContextMenu,
    hoverSectionOrder: config.hoverSectionOrder,
  }
}

export async function applyStudioPreset(
  preset: StudioPreset,
  updateSetting: (key: string, value: boolean | string | number) => Promise<void>,
): Promise<void> {
  const entries = getStudioPresetEntries(preset)
  for (const [setting, value] of entries) {
    await updateSetting(setting, value)
  }
}
