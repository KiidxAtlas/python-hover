# File Structure Refactoring Plan

## Current Problems

### 1. Flat Structure
All 24 TypeScript files are in `src/` root, making it hard to:
- Understand file relationships
- Find related functionality
- Navigate the codebase
- Distinguish between data, services, and business logic

### 2. Mixed Concerns
Files with different purposes are at the same level:
- **Data files** (staticExamples.ts - 2167 lines)
- **Service classes** (inventory.ts, cache.ts, config.ts)
- **Business logic** (hoverProvider.ts, documentationFetcher.ts)
- **Utilities** (already organized in utils/)

### 3. Large Data Files
Some files are primarily large data structures:
- `staticExamples.ts` - 2167 lines of example code
- `thirdPartyLibraries.ts` - 879 lines of library definitions
- `documentationUrls.ts` - 386 lines of URL mappings

## Proposed Structure

```
src/
├── data/                          # Pure data/constants (no logic)
│   ├── index.ts                   # Barrel export
│   ├── staticExamples.ts          # 2167 lines - Python code examples
│   ├── enhancedExamples.ts        # 111 lines - Rich formatted examples
│   ├── specialMethods.ts          # 97 lines - Dunder method descriptions
│   ├── typingConstructs.ts        # 32 lines - Type annotation data
│   └── documentationUrls.ts       # 386 lines - URL mappings
│
├── services/                      # Business services/managers
│   ├── index.ts                   # Barrel export
│   ├── cache.ts                   # CacheManager
│   ├── config.ts                  # ConfigurationManager
│   ├── logger.ts                  # Logger service
│   ├── inventory.ts               # InventoryManager (1362 lines)
│   ├── packageDetector.ts         # PackageDetector
│   ├── versionService.ts          # NEW: Combines version detection & comparison
│   ├── errorNotifier.ts           # ErrorNotifier (existing)
│   └── typeDetectionService.ts    # TypeDetectionService (existing)
│
├── resolvers/                     # Symbol/context resolution
│   ├── index.ts                   # Barrel export
│   ├── symbolResolver.ts          # 425 lines - Symbol resolution
│   ├── methodResolver.ts          # 255 lines - Method resolution
│   └── contextDetector.ts         # 153 lines - Context detection
│
├── documentation/                 # Documentation fetching/formatting
│   ├── index.ts                   # Barrel export
│   ├── documentationFetcher.ts    # 895 lines - Main fetcher
│   ├── customDocumentation.ts     # 173 lines - Custom doc loader
│   ├── thirdPartyLibraries.ts     # 879 lines - 3rd party lib defs
│   └── exampleEnricher.ts         # 68 lines - Example enrichment
│
├── utils/                         # Utility functions (existing)
│   ├── index.ts                   # Barrel export (NEW)
│   ├── fetchWithTimeout.ts        # Network utility
│   └── urlValidator.ts            # URL validation
│
├── ui/                            # User interface components
│   ├── index.ts                   # Barrel export
│   ├── hoverProvider.ts           # 1096 lines - Main hover provider
│   ├── hoverTheme.ts              # 280 lines - Theme formatting
│   └── smartSuggestions.ts        # 76 lines - Method suggestions
│
├── types.ts                       # Global type definitions (16 lines)
└── extension.ts                   # Entry point (378 lines)
```

## Benefits

### 1. Clear Organization
- **data/**: Look here for constants and mappings
- **services/**: Look here for business logic and managers
- **resolvers/**: Look here for symbol/context resolution
- **documentation/**: Look here for documentation fetching
- **ui/**: Look here for UI-related code
- **utils/**: Look here for reusable utilities

### 2. Better Discoverability
New developers can quickly understand:
- Where to find specific functionality
- What each directory's purpose is
- Which files are related

### 3. Easier Maintenance
- Related files are grouped together
- Imports clearly show dependencies
- Easier to refactor specific areas
- Reduces cognitive load when navigating

### 4. Scalability
- Easy to add new services/resolvers/utilities
- Clear patterns for where new code belongs
- Prevents "junk drawer" accumulation

## Migration Steps

### Phase 1: Create Directories and Move Data Files
```bash
mkdir src/data
mv src/staticExamples.ts src/data/
mv src/enhancedExamples.ts src/data/
mv src/specialMethods.ts src/data/
mv src/typingConstructs.ts src/data/
mv src/documentationUrls.ts src/data/
```

### Phase 2: Move Services
```bash
mv src/cache.ts src/services/
mv src/config.ts src/services/
mv src/logger.ts src/services/
mv src/inventory.ts src/services/
mv src/packageDetector.ts src/services/
```

### Phase 3: Create Resolvers Directory
```bash
mkdir src/resolvers
mv src/symbolResolver.ts src/resolvers/
mv src/methodResolver.ts src/resolvers/
mv src/contextDetector.ts src/resolvers/
```

### Phase 4: Create Documentation Directory
```bash
mkdir src/documentation
mv src/documentationFetcher.ts src/documentation/
mv src/customDocumentation.ts src/documentation/
mv src/thirdPartyLibraries.ts src/documentation/
mv src/exampleEnricher.ts src/documentation/
```

### Phase 5: Create UI Directory
```bash
mkdir src/ui
mv src/hoverProvider.ts src/ui/
mv src/hoverTheme.ts src/ui/
mv src/smartSuggestions.ts src/ui/
```

### Phase 6: Create Barrel Exports
Create `index.ts` in each directory to export main functionality:

**src/data/index.ts:**
```typescript
export * from './staticExamples';
export * from './enhancedExamples';
export * from './specialMethods';
export * from './typingConstructs';
export * from './documentationUrls';
```

**src/services/index.ts:**
```typescript
export { CacheManager } from './cache';
export { ConfigurationManager } from './config';
export { Logger } from './logger';
export { InventoryManager } from './inventory';
export { PackageDetector } from './packageDetector';
export { ErrorNotifier } from './errorNotifier';
export { TypeDetectionService } from './typeDetectionService';
```

Similar for other directories.

### Phase 7: Update All Imports
Use automated find/replace:
```typescript
// Before
import { STATIC_EXAMPLES } from './staticExamples';
// After
import { STATIC_EXAMPLES } from './data';

// Before
import { CacheManager } from './cache';
// After
import { CacheManager } from './services';
```

### Phase 8: Update webpack.config.js
May need to update webpack configuration if it has specific path references.

### Phase 9: Test Everything
```bash
npm run compile
npm test
```

## Considerations

### Version Service Consolidation
Combine `versionDetector.ts` and `versionComparison.ts`:

**Why?**
- Both deal with Python version information
- 210 + 212 = 422 lines combined (manageable size)
- Would eliminate duplication of version-related logic
- Cleaner API: one service for all version operations

**New structure:**
```typescript
// src/services/versionService.ts
export class VersionService {
    // From versionDetector.ts
    async detectPythonVersion(document): Promise<VersionInfo>

    // From versionComparison.ts
    getVersionInfo(symbol: string): VersionInfo | null
    getMethodComparison(method: string): MethodComparison | null
    formatVersionInfo(info: VersionInfo): string
    formatComparison(comparison: MethodComparison): string
}
```

### Alternative: Keep Flat for Some Files
If consolidation is too risky initially, could keep:
- `extension.ts` at root (entry point)
- `types.ts` at root (global types)
- `hoverProvider.ts` at root (main provider)

## Timeline

- **Phase 1-2**: 30 minutes (data + services)
- **Phase 3-5**: 30 minutes (resolvers + docs + ui)
- **Phase 6**: 15 minutes (barrel exports)
- **Phase 7**: 45 minutes (update imports - most time-consuming)
- **Phase 8**: 5 minutes (webpack config if needed)
- **Phase 9**: 15 minutes (testing and fixes)

**Total: ~2.5 hours**

## Rollback Plan

If issues arise:
1. Git reset to before refactoring
2. Or manually reverse moves using git history
3. Imports are the main risk - compile errors will show what needs fixing

## Success Metrics

After refactoring:
- ✅ All files organized in logical directories
- ✅ Barrel exports allow clean imports
- ✅ Zero compilation errors
- ✅ All tests pass
- ✅ Bundle size unchanged or smaller
- ✅ Documentation updated

---
**Status**: Ready to execute
**Risk Level**: Medium (mainly import path updates)
**Reversibility**: High (git history + clear migration steps)
