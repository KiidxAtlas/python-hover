# Contributing

## Project layout

```
shared/          Zero-dependency types and utilities used by both layers
docs-engine/     Documentation resolution library (no VS Code dependency)
extension/       VS Code extension — wires the editor API to docs-engine
```

The dependency rule is strict: `shared` ← `docs-engine` ← `extension`. Nothing in `docs-engine` may import from `extension`.

## Setup

```bash
# Install all workspace dependencies
cd docs-engine && npm install
cd ../extension && npm install
```

## Building

```bash
# Compile the extension (output goes to extension/out/)
cd extension && npm run compile
```

## Running locally

1. Open the repo root in VS Code.
2. Press `F5` to launch the Extension Development Host.

## Code style

- TypeScript strict mode is enabled in both packages.
- Run `npm run lint` inside either package to check for ESLint violations.
- Keep `docs-engine` free of VS Code imports — use the `ILogger` interface from `shared/logger.ts` for any logging needs, injected via `setEngineLogger` at activation time.

## Adding a new resolution strategy

1. Add a new value to `ResolutionSource` in `shared/types.ts`.
2. Implement the strategy inside `docs-engine/src/`.
3. Wire it into the fallback chain in `docs-engine/src/docResolver.ts`.
4. Update `extension/src/ui/hoverRenderer.ts` if the new source needs a distinct UI treatment.

## Submitting changes

- Open a pull request against `main`.
- Describe what changed and why in the PR body.
- If the change affects hover output, include a before/after screenshot.
