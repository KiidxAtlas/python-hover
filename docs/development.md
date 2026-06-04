# Development Notes

## Baseline Commands

- Build: cd extension && npm run compile
- Lint: cd extension && npm run lint
- Tests: no npm test script currently defined in extension/package.json

## Refactor Guidance

- Make small moves and compile after each change.
- Preserve command identifiers and configuration keys.
- Prefer additive wrappers and staged migration for import stability.
