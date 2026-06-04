# Python Hover Architecture (Refactor Baseline)

## Current Flow

1. Editor hover enters the provider runtime in extension/src/hover/hoverProvider.ts.
2. Symbol identity is resolved via LSP and Python helper integration.
3. Documentation metadata is resolved in docs-engine/src/docResolver.ts.
4. Content is rendered in extension/src/ui/rendering/hoverRenderer.ts.
5. Session state and history are updated and reflected in side views/status bar.

## Baseline Risk Areas

- Monolithic orchestrator: extension/src/activate.ts.
- Monolithic rendering logic: extension/src/ui/rendering/hoverRenderer.ts.
- Monolithic resolution pipeline: extension/src/hover/hoverProvider.ts.
- Data-source coupling in docs engine resolver/fetcher stack.

## Refactor Targets

- Keep activation orchestration in a thin entrypoint and move registrations into focused modules.
- Keep hover provider as coordinator and move independent stages into helpers.
- Preserve existing import aliases and command IDs.
- Maintain behavior and avoid user-facing regressions.
