# Python Hover: Codebase Structure Analysis & Refactoring Plan

## Current State Overview

```
extension/src/
├── cache/           (empty README)
├── config/          (1 file)
├── core/            (6 files - commands, mainly)
├── fetch/           (empty README)
├── hover/           (9 files - core hover logic)
├── integrations/    (3 files)
├── runtime/         (6 subfolders, ~10 files)
├── state/           (1 file)
├── symbols/         (3 files)
├── types/           (empty README)
├── ui/              (5 subfolders, ~14 files)
├── activate.ts
├── config.ts
├── configTarget.ts
└── logger.ts

docs-engine/
├── src/
│   ├── builder/     (1 file)
│   ├── cache/       (1 file)
│   ├── inventory/   (2 files)
│   ├── net/         (1 file)
│   ├── parsing/     (1 file)
│   ├── pypi/        (1 file)
│   ├── resolvers/   (1 file)
│   ├── scraping/    (1 file)
│   ├── search/      (2 files)
│   └── docResolver.ts
├── data/
└── package.json
```

---

## Issues Identified

### 🔴 High Priority Issues

**1. Empty Module README Files**

- `extension/src/cache/README.md` - states purpose but no implementation reference
- `extension/src/fetch/README.md` - states purpose but no implementation reference
- `extension/src/types/README.md` - states purpose but no implementation reference

**Action:** Either populate with actual module exports/interfaces OR these should consolidate into other modules.

**2. Unclear Module Boundaries**

- `extension/src/hover/` has 9 files but unclear what each does
  - `hoverProvider.ts` - probably the main orchestrator
  - `hoverContext.ts`, `hoverLayout.ts`, `hoverSessionState.ts`, `parameterLens.ts` - unclear relationship
  - `providerCacheUtils.ts`, `providerResolutionUtils.ts`, `providerBuiltinOwnerInference.ts` - utilities? should be in `utils/`?
- `extension/src/runtime/` is deeply nested (6 subfolders for ~10 files)
  - Too much folder depth for the number of files
  - Commands, state, browser, docs, context, studio - why 6 different folders?

**Action:** Flatten `runtime/` to 2-3 files max in root `runtime/` folder.

**3. Missing Central Utilities**

- No `utils/` folder for shared helpers
- Utilities scattered: `providerCacheUtils.ts`, `providerResolutionUtils.ts`, `providerBuiltinOwnerInference.ts`
- Config reads probably scattered across files

**Action:** Create `src/utils/` and consolidate shared code.

**4. `docs-engine/` is Reasonably Organized but Could Flatten**

- 9 subfolders for 13 files (mostly 1 file per folder)
- Merge related modules:
  - `inventory/` + `search/` → both doc finding
  - `parsing/` + `scraping/` → both text processing
  - `cache/` → keep separate (singleton pattern)

**5. Root Level Files Are Mixed Concerns**

- `activate.ts` - extension entry
- `config.ts` - config management
- `configTarget.ts` - unclear purpose
- `logger.ts` - logging

Should have a clear entry → initialization flow.

---

## Recommended New Structure

### **Extension (extension/src/)**

```
extension/src/
├── activate.ts              # Entry point only
├── logger.ts                # Logging singleton (keep)
│
├── config/                  # All configuration
│   ├── settings.ts          # Read vscode.workspace.get... (SINGLE source)
│   ├── defaults.ts          # Default config values
│   └── types.ts             # ConfigSchema, ConfigOptions
│
├── cache/                   # Caching abstraction
│   ├── manager.ts           # CacheManager class (all cache ops)
│   ├── inventory-cache.ts   # Sphinx inventory caching
│   ├── result-cache.ts      # Hover result caching
│   └── types.ts             # CacheEntry, CacheKey types
│
├── core/                    # Symbol resolution + LSP integration
│   ├── resolver.ts          # Symbol resolution pipeline
│   ├── python-helper.ts     # Python subprocess management
│   └── lsp-client.ts        # Pylance/LSP integration (moved from integrations/)
│
├── fetch/                   # Documentation fetching
│   ├── sphinx-fetcher.ts    # Sphinx inventory + docs
│   ├── devdocs-fetcher.ts   # DevDocs fallback search
│   ├── runtime-fetcher.ts   # Python runtime introspection
│   └── types.ts             # Fetch request/result types
│
├── hover/                   # Hover provider & display
│   ├── provider.ts          # Main HoverProvider class
│   ├── formatter.ts         # Format hover content (HTML/markdown)
│   ├── layout.ts            # Hover section reordering logic
│   ├── parameter-lens.ts    # Active parameter highlighting
│   └── types.ts             # HoverMetadata, HoverResult types
│
├── ui/                      # UI components & panels
│   ├── panels/
│   │   ├── docs-panel.ts
│   │   ├── hover-panel.ts
│   │   ├── module-browser-panel.ts
│   │   ├── studio-panel.ts
│   │   └── debug-panel.ts
│   ├── views/
│   │   ├── hover-history-view.ts
│   │   ├── saved-docs-view.ts
│   │   ├── recent-packages-view.ts
│   │   └── base-tree-view.ts
│   ├── rendering/
│   │   ├── hover-renderer.ts      # Render hover to HTML
│   │   ├── doc-presenter.ts       # Format docs for display
│   │   └── content-cleaner.ts     # Sanitize/clean HTML
│   ├── webview/
│   │   ├── webview-nonce.ts
│   │   └── webview-allowlist.ts
│   ├── shell/
│   │   └── status-bar.ts
│   └── types.ts             # UI type definitions
│
├── symbols/                 # Symbol classification & aliasing
│   ├── classifier.ts        # Classify symbol types
│   ├── alias-resolver.ts    # Resolve aliases (numpy as np)
│   ├── name-refinement.ts   # Clean/normalize names
│   └── types.ts
│
├── types/                   # Shared type definitions (index re-exports)
│   ├── hover.ts             # HoverResult, HoverMetadata
│   ├── symbol.ts            # SymbolInfo, SymbolKind
│   ├── config.ts            # ConfigOptions
│   ├── cache.ts             # CacheEntry
│   ├── fetch.ts             # FetchRequest, FetchResult
│   └── index.ts             # Re-export all for convenience
│
├── utils/                   # Shared utilities
│   ├── string-utils.ts
│   ├── path-utils.ts
│   ├── async-utils.ts
│   └── index.ts             # Re-export common helpers
│
├── state/                   # Application state management
│   ├── library-state.ts     # Library discovery state
│   ├── telemetry-state.ts   # Usage telemetry
│   ├── saved-docs.ts        # Saved docs persistence
│   └── types.ts
│
├── commands/                # Command registration (moved from core/)
│   ├── cache-commands.ts
│   ├── primary-commands.ts
│   ├── module-browse-commands.ts
│   ├── runtime-commands.ts
│   ├── saved-and-panel-commands.ts
│   └── history-and-link-commands.ts
│
└── integrations/            # External integrations (keep minimal)
    └── indexed-symbol-actions.ts
```

### **Docs Engine (docs-engine/src/)**

```
docs-engine/src/
├── docResolver.ts           # Main entry point
├── engineLogger.ts          # Logging
│
├── cache/
│   └── disk-cache.ts        # Sphinx inventory disk caching
│
├── fetch/                   # Rename from inventory/ + search/
│   ├── inventory-fetcher.ts (from inventory/)
│   ├── inventory-parser.ts  (from inventory/)
│   └── site-index-resolver.ts (from search/ — find docs)
│
├── process/                 # Rename from parsing/ + scraping/
│   ├── docstring-parser.ts  (from parsing/)
│   ├── sphinx-scraper.ts    (from scraping/)
│   └── doc-builder.ts       (from builder/)
│
├── discover/                # Library discovery
│   ├── pypi-client.ts       (from pypi/)
│   └── http-client.ts       (from net/)
│
├── static/
│   ├── static-doc-resolver.ts (from resolvers/)
│   └── stdlib-modules.ts    (static data)
│
├── types.ts                 # Shared types for docs-engine
└── types/ (optional)
    ├── fetch.ts
    ├── cache.ts
    └── builder.ts
```

---

## Refactoring Checklist

### Phase 1: Prepare & Analyze

- [ ] Count lines per file in `extension/src/`
- [ ] Identify which files >300 lines (candidates for splitting)
- [ ] Map all imports to understand dependencies
- [ ] Document circular dependencies (if any)

### Phase 2: Create New Folder Structure

- [ ] Create `extension/src/config/` structure
- [ ] Create `extension/src/cache/` structure
- [ ] Create `extension/src/utils/` folder
- [ ] Create `extension/src/types/` with index.ts
- [ ] Create `extension/src/commands/` folder
- [ ] Flatten `extension/src/runtime/` into root + subfolders as needed
- [ ] Do NOT move code yet—just folders

### Phase 3: Consolidate Utilities

- [ ] Move `providerCacheUtils.ts` → `utils/cache-utils.ts`
- [ ] Move `providerResolutionUtils.ts` → `utils/resolution-utils.ts`
- [ ] Move `providerBuiltinOwnerInference.ts` → `utils/builtin-inference.ts`
- [ ] Create `utils/index.ts` re-exporting common helpers

### Phase 4: Move Config

- [ ] Create `config/settings.ts` — centralize ALL vscode.workspace.getConfiguration() calls
- [ ] Create `config/defaults.ts` — all default values
- [ ] Create `config/types.ts` — ConfigSchema, ConfigOptions types
- [ ] Update all imports from `config.ts` to `config/settings.ts`
- [ ] Update all imports from scattered config reads to `config/settings.ts`

### Phase 5: Consolidate Cache

- [ ] Create `cache/manager.ts` — CacheManager class for all cache ops
- [ ] Create `cache/inventory-cache.ts` — Sphinx inventory caching
- [ ] Create `cache/result-cache.ts` — Hover result caching
- [ ] Update all cache imports to use `cache/manager.ts`

### Phase 6: Organize Hover Provider

- [ ] Break `hoverProvider.ts` into:
  - `hover/provider.ts` — Main class
  - `hover/formatter.ts` — Content formatting
  - `hover/layout.ts` — Section layout logic
- [ ] Move `parameterLens.ts` → `hover/` (if not already)
- [ ] Move `hoverSessionState.ts` → `hover/`
- [ ] Move `hoverContext.ts` → `hover/`

### Phase 7: Flatten Runtime

- [ ] Move all files from `runtime/commands/` → `commands/`
- [ ] Move all files from `runtime/browser/` → `ui/browser/` OR consolidate to `ui/`
- [ ] Move all files from `runtime/state/` → `state/`
- [ ] Move all files from `runtime/docs/` → `fetch/` OR `ui/docs/`
- [ ] Move all files from `runtime/context/` → `ui/context/`
- [ ] Move all files from `runtime/studio/` → `ui/studio/`
- [ ] Delete empty `runtime/` folder when done

### Phase 8: Move Integrations

- [ ] Move `integrations/lspClient.ts` → `core/lsp-client.ts`
- [ ] Move `integrations/pythonHelper.ts` → `core/python-helper.ts`
- [ ] Keep `indexedSymbolActions.ts` in `integrations/` (or consolidate if tiny)

### Phase 9: Organize Types

- [ ] Create `types/hover.ts` — HoverResult, HoverMetadata
- [ ] Create `types/symbol.ts` — SymbolInfo, SymbolKind
- [ ] Create `types/config.ts` — ConfigOptions
- [ ] Create `types/cache.ts` — CacheEntry
- [ ] Create `types/fetch.ts` — FetchRequest, FetchResult
- [ ] Create `types/ui.ts` — UI types
- [ ] Create `types/index.ts` — Re-export all

### Phase 10: Update Docs Engine

- [ ] Rename `docs-engine/src/inventory/` → `docs-engine/src/fetch/`
- [ ] Merge `docs-engine/src/search/` into `fetch/`
- [ ] Rename `docs-engine/src/parsing/` + `docs-engine/src/scraping/` → `process/`
- [ ] Rename `docs-engine/src/resolvers/` → `static/`
- [ ] Rename `docs-engine/src/pypi/` + `docs-engine/src/net/` → `discover/`
- [ ] Consolidate `builder/` into `process/doc-builder.ts`

### Phase 11: Verify & Test

- [ ] Run `npm run build` — should compile without errors
- [ ] Run `npm test` — all tests pass
- [ ] Run `npm run lint` — no warnings
- [ ] Check bundle size hasn't grown significantly

---

## File-by-File Refactoring Map

### extension/src/hover/

**Current:**

```
hoverContext.ts
hoverLayout.ts
hoverParameterLensService.ts
hoverProvider.ts (LARGE — likely 300+ lines)
hoverSessionState.ts
parameterLens.ts
providerBuiltinOwnerInference.ts (MOVE to utils/)
providerCacheUtils.ts (MOVE to utils/)
providerResolutionUtils.ts (MOVE to utils/)
```

**After:**

```
provider.ts          (hoverProvider.ts, split if >400 lines)
formatter.ts         (new — format hover content)
layout.ts            (hoverLayout.ts)
parameter-lens.ts    (merge hoverParameterLensService + parameterLens)
context.ts           (hoverContext.ts)
session-state.ts     (hoverSessionState.ts)
types.ts             (HoverResult, HoverMetadata, etc.)
```

---

### extension/src/runtime/ → FLATTEN

**Current (too nested):**

```
runtime/
├── browser/
│   ├── searchDocsCommand.ts
│   └── searchPresentation.ts
├── commands/
│   └── cacheCommands.ts
├── context/
│   └── contextMenu.ts
├── docs/
│   └── docsRouting.ts
├── state/
│   ├── libraryState.ts
│   └── telemetryState.ts
├── studio/
│   └── studioState.ts
```

**After:**

```
commands/
├── cache-commands.ts
├── primary-commands.ts
├── search-docs-command.ts  (from browser/)
├── module-browse-commands.ts
├── runtime-commands.ts
├── saved-and-panel-commands.ts
└── history-and-link-commands.ts

state/
├── library-state.ts
├── telemetry-state.ts
├── studio-state.ts
└── saved-docs.ts

ui/
├── browser/
│   └── search-presentation.ts
├── context/
│   └── context-menu.ts
└── studio/
    └── studio-panel.ts  (or merge into panels/)

fetch/ (or ui/)
└── docs-routing.ts
```

---

## Expected Outcomes

After refactoring:

✅ **No file >400 lines** (most <300)

✅ **Max 3 folder levels** (most 2)

✅ **Clear module responsibilities:**

- `config/` — all configuration
- `cache/` — all caching
- `core/` — symbol resolution + LSP
- `fetch/` — documentation fetching
- `hover/` — hover provider & UI
- `ui/` — all UI components
- `state/` — application state
- `commands/` — command registration
- `utils/` — shared utilities
- `types/` — type definitions

✅ **Dependency flow is clean:**

- No circular imports
- UI imports from core, but core doesn't import UI
- Config is a singleton accessed everywhere
- Cache is a singleton accessed everywhere

✅ **New developers can:**

- Add a config option → edit `config/settings.ts`
- Add a cache type → edit `cache/types.ts`
- Fix hover formatting → edit `hover/formatter.ts`
- Add a command → edit `commands/`
- Add a UI panel → edit `ui/panels/`

---

## Implementation Order (Most Effective)

1. **Create new folder structure** (no code moves yet)
2. **Consolidate utilities** → `utils/`
3. **Flatten runtime** → `commands/`, `state/`, `ui/`
4. **Reorganize hover** → split & move to `hover/`
5. **Centralize config** → `config/`
6. **Centralize cache** → `cache/`
7. **Organize types** → `types/`
8. **Update docs-engine structure**
9. **Run tests & verify**

---

## Dos & Don'ts

✅ **DO:**

- Use `git mv` when moving files (preserves history)
- Commit after each logical step
- Test after moving each module group
- Update imports as you go

❌ **DON'T:**

- Move 10 files at once then test
- Rename files AND move them in same commit
- Leave old files around as backups
- Change code logic during refactoring (pure moves only)
