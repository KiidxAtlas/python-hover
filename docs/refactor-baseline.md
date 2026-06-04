# Refactor Baseline Report

## Baseline Build State

- Compile: pass (`cd extension && npm run compile`)
- Lint: pass (`cd extension && npm run lint`)
- Tests: `npm test` script is not defined in extension/package.json

## Source Inventory Snapshot

- Files scanned under extension/src + docs-engine/src: 53

## Files Over 500 Lines (Initial Snapshot)

- extension/src/ui/rendering/hoverRenderer.ts (2553)
- extension/src/hover/hoverProvider.ts (2366)
- extension/src/activate.ts (1743)
- extension/src/ui/panels/studioPanel.ts (1300)
- docs-engine/src/inventory/inventoryFetcher.ts (1226)
- docs-engine/src/scraping/sphinxScraper.ts (1159)
- extension/src/ui/panels/hoverPanel.ts (1091)
- docs-engine/src/docResolver.ts (1081)
- extension/src/ui/panels/moduleBrowserPanel.ts (985)
- docs-engine/src/builder/hoverDocBuilder.ts (803)
- extension/src/ui/views/hoverInspectorView.ts (801)
- extension/src/ui/panels/docsPanel.ts (651)
- extension/src/integrations/lspClient.ts (647)
- extension/src/integrations/pythonHelper.ts (640)
- docs-engine/src/parsing/docstringParser.ts (542)
- extension/src/config.ts (501)

## Pain Point Summary

- Activation monolith combines bootstrap, settings lifecycle, command registry, panel wiring, and state updates.
- Hover provider coordinates too many concerns in one class: AST/LSP, aliasing, source fallbacks, cache, render orchestration.
- Renderer monolith couples all sections and markdown assembly in a single file.
- Docs engine resolver and fetch stack have strong coupling between inventories, scraping, fallback, and package metadata.

## Refactor Execution Progress

Completed in this pass:

1. Created target folder skeleton:

- extension/src/core
- extension/src/fetch
- extension/src/cache
- extension/src/types
- extension/src/config

2. Added architecture/development docs:

- docs/architecture.md
- docs/development.md

3. Config layer decomposition started:

- extracted dependency fingerprint logic to extension/src/config/workspaceFingerprint.ts
- kept extension/src/config.ts public API stable

4. Activation decomposition started:

- extracted command/setting guard constants and helper into extension/src/core/studioGuards.ts
- activate.ts now delegates guard definitions

5. Hover-provider decomposition started:

- extracted resolution utility helpers to extension/src/hover/providerResolutionUtils.ts
- hover provider now delegates module path normalization and source-fallback heuristics

6. Activation orchestration decomposition expanded:

- extracted primary command registration to extension/src/core/registerPrimaryCommands.ts
- extracted history/docs-link/source commands to extension/src/core/registerHistoryAndLinkCommands.ts
- extracted module browse/indexed command set to extension/src/core/registerModuleBrowseCommands.ts
- extracted runtime/search/cache command set to extension/src/core/registerRuntimeCommands.ts
- extracted saved-doc/pin-panel command set to extension/src/core/registerSavedAndPanelCommands.ts

7. Hover-provider decomposition expanded:

- extracted builtin-owner inference helpers to extension/src/hover/providerBuiltinOwnerInference.ts
- extracted cache/log cooldown helpers to extension/src/hover/providerCacheUtils.ts

## Current Size Snapshot

- extension/src/activate.ts: 1743 -> 896
- extension/src/hover/hoverProvider.ts: 2366 -> 1972
- extension/src/config.ts: 501 -> 390

## Quality Gate Snapshot (Current)

- Compile: pass (`cd extension && npm run compile`)
- Lint: pass (`cd extension && npm run lint`)

## Next High-Impact Moves

- Split activation command registration into separate core modules (status, docs routing, cache commands, studio bindings).
- Split hover provider stages into resolver pipeline modules (classification, doc resolution, local fallback, history/telemetry hooks).
- Split renderer into section renderers and shared markdown utilities.
- Introduce central cache manager facade that wraps disk + session cache contracts.
