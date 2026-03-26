# Python Hover Extension Breakdown

## Scope Of This Document

This file explains the full implementation that powers the Python Hover extension in this workspace.

It covers:

- what the extension is trying to do
- what happens when a user hovers a Python symbol
- how information is discovered, refined, cached, and rendered
- which parts are runtime-critical and which parts are developer tooling
- the role of every important file in the workspace

This breakdown is based on a full audit of the current code in:

- `extension/src`
- `extension/python-helper`
- `docs-engine/src`
- `docs-engine/data`
- `docs-engine/test`
- `shared`
- `scripts`
- `test_hover.py`

## What The Extension Does

The extension provides richer Python hover documentation inside VS Code.

At a high level, it tries to answer a hover request by combining several sources of truth:

1. VS Code language-server data from Pylance or another Python language server.
2. Runtime Python inspection through a persistent helper process.
3. Static official-doc mappings for keywords, operators, and some stdlib module pages.
4. A prebuilt stdlib corpus generated from official Python docs.
5. Sphinx `objects.inv` inventories from package documentation sites.
6. Scraped documentation content from those documentation pages.
7. PyPI metadata for package summaries and documentation URLs.
8. DevDocs scoped search as a fallback.

The goal is not just to show a raw docstring. The extension tries to identify the hovered symbol accurately, locate the best documentation source, structure the result, and then render a hover that is easier to read and act on.

One important design choice in this codebase is that visible hover content is intended to come from extracted or fetched documentation sources, not handwritten repo summaries. The prebuilt stdlib corpus is also generated from official docs rather than authored manually.

## Top-Level Architecture

The repository is split into four main runtime layers and one supporting developer layer.

### 1. VS Code Extension Layer

Location: `extension/src`

This layer handles:

- activation
- command registration
- hover-provider registration
- configuration access
- language-server interaction
- orchestration of the full hover pipeline
- rendering hover UI and related panels

This layer knows about VS Code APIs. The docs engine does not.

### 2. Documentation Engine

Location: `docs-engine`

Structure:

- `docs-engine/src` contains executable resolver, inventory, scraping, cache, builder, and search code
- `docs-engine/data` contains generated or static documentation data
- `docs-engine/test` contains probe and audit scripts for the docs pipeline

This layer handles:

- resolver strategy ordering
- static docs lookup
- stdlib corpus lookup
- inventory fetching and parsing
- page scraping
- PyPI lookup
- search fallback
- cache-backed documentation retrieval

This is the core content-resolution layer.

### 3. Python Runtime Helper Layer

Location: `extension/python-helper`

This layer handles:

- AST-based symbol identification from source code
- runtime symbol inspection with `inspect`, `importlib`, and `pydoc`
- Python version discovery
- installed package version lookup

This is the single runtime helper implementation used by the extension.

### 4. Shared Contract Layer

Location: `shared`

This layer defines shared data structures and normalization rules so the extension layer and docs engine can exchange data consistently.

### 5. Developer Support Layer

Locations:

- `docs-engine/test`
- `scripts`
- `test_hover.py`

This layer is not part of the live extension runtime. It exists to:

- generate corpora
- inspect hover resolution quality
- audit content quality
- manually test hover behavior

## End-To-End Runtime Flow

This is the main path from user action to displayed hover.

### Step 1: Extension Activation

File: `extension/src/activate.ts`

On activation, the extension does the following:

1. Initializes logging.
2. Loads configuration through `Config`.
3. Creates `LspClient`.
4. Creates `StatusBarManager`.
5. Creates `DiskCache` using the extension's global storage path.
6. Wires the status bar clear-cache action to the real cache clear function.
7. Creates `HoverProvider`, which internally creates the docs resolver, renderer, builder, alias resolver, and Python helper.
8. Creates a diagnostic collection.
9. Registers the hover provider for Python files.
10. Checks whether a Python language extension is active.
11. Warms documentation inventories for imported third-party packages in active Python files.
12. Registers commands such as search, pin, open docs, browse module, clear cache, and toggle online discovery.

This file is the startup wiring layer. It does not do the heavy hover logic itself.

### Step 2: User Hovers A Symbol

File: `extension/src/hoverProvider.ts`

The `HoverProvider` is the central orchestrator.

When VS Code asks for a hover, it:

1. Waits for Python version initialization to complete.
2. Performs bounded eviction on in-memory caches.
3. Exits early if the extension is disabled.
4. Computes a stable segment range so the hover stays pinned to the relevant token range.
5. Checks whether the same document version and cursor position were already resolved.

If the result is already known, it returns a cached hover quickly.

### Step 3: Fast Paths Before The Full Pipeline

Still in `extension/src/hoverProvider.ts`

The provider includes several fast paths:

- Structural Python keywords like `class`, `def`, `for`, `if`, and `match` bypass normal symbol resolution and go straight to keyword documentation.
- Import-line hovers such as `import pandas` or `from pandas import DataFrame` can return a module-overview card instead of trying to resolve a member symbol.
- Repeated position-based hovers can reuse previous cache keys and rendered hover objects.

These fast paths reduce latency and avoid incorrect symbol resolution in cases where the language server would otherwise point at the wrong thing.

### Step 4: Symbol Resolution

The provider gathers symbol information from multiple sources.

#### 4a. Language-Server Resolution

File: `extension/src/lspClient.ts`

`LspClient` does several important things:

- Builds the dotted expression around the cursor.
- Looks left to reconstruct chains like `df.groupby`.
- Peeks one segment right so hovering the left segment can still resolve a call target.
- Calls `vscode.executeDefinitionProvider` and `vscode.executeHoverProvider` in parallel.
- Parses Pylance hover code blocks to extract kind, signature, and better-qualified names.
- Uses definition locations and `vscode.executeDocumentSymbolProvider` to recover module-qualified names.

This is the first major source of symbol identity.

#### 4b. Signature-Based Name Refinement

File: `extension/src/nameRefinement.ts`

If the language server gives a weak or incomplete symbol name, `NameRefinement` tries to fix it by reading the `self` type from the signature.

Example intent:

- turn `append` into `list.append`
- normalize import-module names like `os.path.path` to `os.path`

This improves the chance that later resolvers find the correct documentation entry.

#### 4c. Alias Resolution

File: `extension/src/aliasResolver.ts`

This module parses the document text and expands import aliases.

Examples:

- `np.array` becomes `numpy.array`
- `pd.DataFrame` becomes `pandas.DataFrame`
- `from x import y as z` maps `z` back to `x.y`

This is important because inventories and docs resolvers usually index canonical names, not local aliases.

#### 4d. Python AST Identification

Files:

- `extension/src/pythonHelper.ts`
- `extension/python-helper/helper.py`
- `extension/python-helper/identifier.py`

If LSP resolution is missing or incomplete, the extension asks the Python helper to inspect the source text itself.

The helper:

- parses the document with `ast`
- finds the smallest AST node containing the cursor position
- classifies literals and containers
- reconstructs function and class names for nested definitions

This is especially useful for things the language server cannot fully qualify quickly.

### Step 5: Symbol Normalization Into A Lookup Key

File: `shared/docKey.ts`

Once the extension has a runtime-oriented `SymbolInfo`, it converts it into a normalized `DocKey`.

That key includes:

- package
- module
- name
- qualname
- stdlib flag

The `DocKeyBuilder` is responsible for edge cases like:

- builtin symbols
- dotted names with missing module prefixes
- dunder methods that should map to object docs

This step matters because all content resolvers operate on the normalized key rather than on raw cursor text.

### Step 6: Documentation Resolution Cascade

File: `docs-engine/src/docResolver.ts`

`DocResolver` is the content-resolution orchestrator. It tries multiple strategies in order.

#### 6a. Static Resolver

File: `docs-engine/src/resolvers/staticDocResolver.ts`

This handles the fastest possible cases:

- Python keywords
- operators and syntax entries
- stdlib module overview URLs

The mapping data comes from:

- `docs-engine/data/documentationUrls.ts`
- `docs-engine/data/stdlibModules.ts`

These are offline lookups with no network dependency.

#### 6b. Prebuilt Stdlib Corpus Resolver

File: `docs-engine/src/resolvers/stdlibCorpusResolver.ts`

If the symbol is from the stdlib or builtins, the resolver tries the generated stdlib corpus.

The corpus lives in:

- `docs-engine/data/stdlibCorpus.ts`

That file contains summary, content, signature, URL, and see-also data harvested from official Python docs. This gives rich stdlib hovers without requiring live network fetches.

#### 6c. Sphinx Inventory Resolution

Files:

- `docs-engine/src/inventory/inventoryFetcher.ts`
- `docs-engine/src/inventory/inventoryParser.ts`

If static and corpus resolution are not enough, the resolver tries package documentation inventories.

`InventoryFetcher` does the following:

1. Chooses a documentation base URL.
2. Uses hardcoded verified docs URLs for many popular packages.
3. Falls back to PyPI metadata for unknown packages.
4. Probes likely `objects.inv` locations.
5. Downloads and caches inventory data.
6. Uses multiple matching strategies to map a `DocKey` to the best inventory symbol.

`InventoryParser` inflates the zlib-compressed `objects.inv` file and turns its entries into `HoverDoc` records with URLs.

#### 6d. Scraped Content Enrichment

File: `docs-engine/src/scraping/sphinxScraper.ts`

Inventory entries provide URLs, but not necessarily enough visible content. `SphinxScraper` fills that gap.

It can:

- fetch raw HTML pages
- cache HTML in memory
- cache extracted content on disk
- extract content for a specific anchor or module page
- extract Sphinx `seealso` links

This allows the extension to upgrade an inventory hit into a richer hover with real documentation content.

#### 6e. Module Overview Resolution

Still in `docs-engine/src/docResolver.ts`

When hovering a package name on an import line, the docs engine can build a module-overview hover that includes:

- a package summary
- a docs URL
- indexed exports
- export count
- installed version if known

This is a distinct path from symbol-level resolution.

#### 6f. PyPI Metadata Lookup

File: `docs-engine/src/pypi/pypiClient.ts`

PyPI is used mainly for discovery and package summaries, not as the preferred content source.

It provides:

- project URLs
- summary text
- a best-guess docs URL
- negative caching when a package is not useful for docs discovery

#### 6g. DevDocs Fallback

File: `docs-engine/src/search/searchFallback.ts`

If no better source is available, the extension can still produce a scoped DevDocs search URL. That keeps the hover actionable even when the extension cannot produce a rich extracted document yet.

### Step 7: Runtime Reflection For Live Python Details

Files:

- `extension/src/pythonHelper.ts`
- `extension/python-helper/resolver.py`

In addition to external docs, the extension asks the Python helper to inspect actual Python objects.

The TypeScript side:

- resolves an interpreter path
- starts one persistent Python subprocess on first use
- sends newline-delimited JSON requests
- caches results in memory and on disk
- restarts the process if it dies

The Python side can:

- resolve builtins
- resolve dotted import paths
- inspect signatures
- capture keyword help text through `pydoc.help`
- determine whether a symbol belongs to the stdlib
- build official docs URLs for stdlib symbols

This is what gives the extension direct runtime awareness.

### Step 8: Hover Document Assembly

Files:

- `docs-engine/src/builder/hoverDocBuilder.ts`
- `docs-engine/src/parsing/docstringParser.ts`

Once docs and runtime metadata have both been found, they are merged into a final `HoverDoc`.

`HoverDocBuilder` is responsible for:

- choosing the visible title
- choosing the best summary source
- parsing parameters, returns, raises, examples, and notes from docstrings
- suppressing placeholder content
- inferring badges such as `stdlib`, `deprecated`, `async`, and `generator`

`DocstringParser` supports several styles:

- NumPy style
- Google style
- ReST-style fallback
- help-text normalization for pydoc-like content

This is the layer that turns raw strings into a structured hover document.

### Step 9: Rendering The Hover

File: `extension/src/ui/hoverRenderer.ts`

The renderer converts a `HoverDoc` into a VS Code markdown hover.

It handles:

- header and symbol icon
- badges and source chips
- toolbar actions
- optional signature block
- description formatting
- parameters, returns, raises, examples, module exports, and see-also sections
- docs links and DevDocs links
- truncation and formatting cleanup

It also warns when the docs indicate a Python version newer than the detected runtime.

### Step 10: Related UI Surfaces

Several other UI modules support the hover experience.

#### `extension/src/ui/statusBar.ts`

Provides a PyHover status-bar item and quick menu for:

- toggling online discovery
- opening search
- pinning the last hover
- viewing logs
- clearing cache
- opening settings

#### `extension/src/ui/docsPanel.ts`

Provides a persistent webview-based side-panel browser for opening docs URLs inside VS Code.

#### `extension/src/ui/hoverPanel.ts`

Provides an HTML pin panel showing the last hover in a larger side view.

#### `extension/src/ui/hoverDebugPanel.ts`

Provides a debug view showing the raw `HoverDoc` payload and rendered hover markdown.

#### `extension/src/ui/contentCleaner.ts`

Provides shared cleanup utilities used by the renderers and test tools. It removes pydoc dump artifacts, RST directives, and `Annotated[...]` wrappers.

## Where Content Comes From

The extension uses multiple content sources, but they are not all equal.

### Highest-Quality And Fastest Offline Sources

- generated stdlib corpus from official docs
- static keyword and module URL maps

### Strong Online Sources

- Sphinx inventories plus scraped docs content
- PyPI metadata for package-level discovery

### Runtime Python Sources

- `inspect.getdoc`
- `inspect.signature`
- `pydoc.help` for keywords

### Last-Resort Fallback Source

- DevDocs scoped search URL

The codebase is careful about not treating a placeholder message as useful content. Both `DocResolver` and `HoverDocBuilder` contain filtering logic to avoid surfacing empty or misleading placeholder text.

## Cache Strategy

File: `docs-engine/src/cache/diskCache.ts`

Caching is a major part of the extension because documentation lookups can otherwise be slow and repetitive.

The cache stores several categories:

- inventory data
- scraped corpus content
- scraped see-also links
- PyPI metadata
- negative PyPI results
- other metadata entries

The cache uses:

- in-memory maps for fast repeated lookups
- disk persistence for cross-session reuse
- separate TTL behavior for inventory and scraped-content lifetimes
- lazy expiration on read

The hover provider also maintains its own in-memory session caches for:

- rendered hovers
- identify results
- position-to-key mappings
- installed package versions

This is why repeated hovers feel much faster than the initial lookup.

## Configuration Surface

File: `extension/src/config.ts`

The extension reads the `python-hover.*` configuration namespace and exposes strongly typed accessors for:

- enable or disable
- online discovery
- full corpus background building
- docs version override
- snippet length
- cache TTLs
- request timeout
- official docs browser mode
- DevDocs browser mode
- custom libraries
- signature and return-type visibility
- debug-pin button visibility
- max content length
- Python interpreter path

This class is simple on purpose. It isolates settings access from the rest of the code.

## Commands And User Actions

The main commands registered by `activate.ts` are:

- `python-hover.copyUrl`
- `python-hover.copySignature`
- `python-hover.clearCache`
- `python-hover.searchDocs`
- `python-hover.pinHover`
- `python-hover.debugPinHover`
- `python-hover.openDocsSide`
- `python-hover.browseModule`
- `python-hover.toggleOnlineDiscovery`
- `python-hover.showStatusNotification`

These commands let the extension function as more than a passive hover provider. The user can search the indexed symbol space, pin content, browse module exports, and manage cache or online behavior.

## Shared Data Contracts

File: `shared/types.ts`

The most important shared contract is `HoverDoc`, which is the structured object passed to the renderer.

Other important types include:

- `DocKey`
- `ResolutionSource`
- `LspSymbol`
- `SymbolInfo`
- `ParameterInfo`
- `ReturnInfo`
- `ExceptionInfo`
- `Badge`

These contracts keep the extension layer and docs engine aligned without mixing VS Code types into the docs engine.

## Python Helper Implementation

The repository now maintains a single Python helper tree under `extension/python-helper`.

It provides:

- IPC server entry point in `helper.py`
- AST hover-target identification in `identifier.py`
- runtime reflection in `resolver.py`
- safe import behavior in `safe_import.py`

The current helper includes the stronger inference-oriented identifier logic and explicit soft-keyword handling, so the extension no longer carries a second helper implementation with overlapping responsibility.

## Build-Time And Developer-Only Tooling

### `scripts/build-stdlib-corpus.ts`

This script generates `docs-engine/data/stdlibCorpus.ts` by fetching and extracting content from official Python documentation.

That means the repo's stdlib corpus is generated data, not handwritten hover content.

### `docs-engine/test/auditHoverCorpus.ts`

Audits resolved hover content and flags thin descriptions, raw pydoc dumps, placeholder text, and other quality issues.

### `docs-engine/test/inspectHoverPipeline.ts`

Compares older summary-building behavior against the current `HoverDocBuilder` behavior using representative cases.

### `docs-engine/test/probeResolvedHoverContent.ts`

Runs a probe set through `DocResolver` and `HoverDocBuilder` and prints the resulting content for inspection.

### `test_hover.py`

A manual hover playground with examples for:

- builtins
- stdlib
- keywords
- typing symbols
- third-party libraries
- local code

This is the main manual testing surface for live VS Code hovers.

## Architectural Boundaries

The repository mostly keeps boundaries clean.

### Good Boundaries

- VS Code API usage stays in the extension layer.
- The docs engine runtime code now lives under `docs-engine/src`, while generated data and probes stay outside it.
- Shared data contracts live in `shared` instead of being duplicated.
- The Python helper stays in Python and communicates over a small JSON protocol.
- Cache code is centralized in `DiskCache` rather than scattered.

### Areas To Be Aware Of

- Placeholder filtering exists in more than one place because the resolver layer and builder layer both defend against low-value content.
- Content cleaning is shared well now, but rendering and cleanup are still naturally coupled in a few places because markdown and HTML output need different formatting.

These are not necessarily bugs, but they are important to understand if the codebase evolves.

## File-By-File Appendix

This appendix summarizes the role of each relevant source file.

### Extension Runtime Files

- `extension/src/activate.ts`: Extension entry point. Wires together config, caches, hover provider, diagnostics, warmup behavior, commands, and side panels.
- `extension/src/hoverProvider.ts`: Main orchestration layer for hover resolution. Owns session caches, fast paths, LSP coordination, Python helper coordination, docs resolution, and final rendering.
- `extension/src/pythonHelper.ts`: Persistent Python subprocess manager. Resolves interpreter path, launches the helper, performs JSON IPC, and caches runtime results.
- `extension/src/lspClient.ts`: Language-server adapter. Builds hover context, asks VS Code for hover and definition data, and derives qualified symbol names.
- `extension/src/aliasResolver.ts`: Expands import aliases from document text back to canonical symbol paths.
- `extension/src/nameRefinement.ts`: Fixes or improves names using signature analysis, especially around method ownership.
- `extension/src/config.ts`: Wraps VS Code configuration access for the extension's settings.
- `extension/src/logger.ts`: Provides a VS Code output channel for debug and error logging.

### Extension UI Files

- `extension/src/ui/hoverRenderer.ts`: Primary hover markdown renderer.
- `extension/src/ui/contentCleaner.ts`: Shared content cleanup utilities for renderer and support tools.
- `extension/src/ui/statusBar.ts`: Status-bar and quick-menu UI.
- `extension/src/ui/docsPanel.ts`: Persistent in-editor docs browser panel.
- `extension/src/ui/hoverPanel.ts`: Pinned HTML panel for a hover document.
- `extension/src/ui/hoverDebugPanel.ts`: Debug panel showing raw hover payload and markdown.

### Runtime Python Helper Files

- `extension/python-helper/helper.py`: Python IPC server entry point and command dispatcher.
- `extension/python-helper/identifier.py`: Inference-oriented AST hovered-node identification for literals, aliases, assignments, and class attributes.
- `extension/python-helper/resolver.py`: Runtime symbol inspection and stdlib URL construction.
- `extension/python-helper/safe_import.py`: Import-safety helper used by the Python side.

### Docs Engine Core Files

- `docs-engine/src/docResolver.ts`: Central resolver cascade and module-overview builder.
- `docs-engine/src/search/searchFallback.ts`: Builds scoped DevDocs fallback URLs.

### Docs Engine Resolver Files

- `docs-engine/src/resolvers/staticDocResolver.ts`: Handles direct static lookups for keywords, operators, and stdlib module pages.
- `docs-engine/src/resolvers/stdlibCorpusResolver.ts`: Handles stdlib lookups from the generated official-doc corpus.

### Docs Engine Builder And Parsing Files

- `docs-engine/src/builder/hoverDocBuilder.ts`: Builds the final structured hover document from runtime and fetched sources.
- `docs-engine/src/parsing/docstringParser.ts`: Parses different docstring styles into structured fields.

### Docs Engine Infrastructure Files

- `docs-engine/src/cache/diskCache.ts`: Persistent cache layer for inventories, scraped corpus content, and PyPI metadata.
- `docs-engine/src/scraping/sphinxScraper.ts`: Fetches and extracts documentation content and see-also links from Sphinx HTML pages.
- `docs-engine/src/inventory/inventoryFetcher.ts`: Loads package inventories, resolves docs base URLs, and matches symbol keys against inventory entries.
- `docs-engine/src/inventory/inventoryParser.ts`: Inflates and parses Sphinx `objects.inv` files.
- `docs-engine/src/pypi/pypiClient.ts`: Fetches PyPI package metadata and caches positive and negative results.

### Docs Engine Data Files

- `docs-engine/data/documentationUrls.ts`: Static map of Python keyword and operator documentation entries.
- `docs-engine/data/stdlibModules.ts`: Static map of stdlib module names to official docs URLs.
- `docs-engine/data/stdlibCorpus.ts`: Generated corpus of stdlib documentation content extracted from official docs.

### Shared Files

- `shared/types.ts`: Core shared types such as `HoverDoc`, `DocKey`, `LspSymbol`, and `SymbolInfo`.
- `shared/docKey.ts`: Normalizer that turns symbol info into lookup keys for the docs engine.

### Scripts And Developer Probes

- `scripts/build-stdlib-corpus.ts`: Generates the stdlib corpus from official docs.
- `docs-engine/test/auditHoverCorpus.ts`: Audits hover-content quality and flags weak outputs.
- `docs-engine/test/inspectHoverPipeline.ts`: Compares pipeline behavior on representative cases.
- `docs-engine/test/probeResolvedHoverContent.ts`: Runs probe cases through resolver and builder logic.
- `test_hover.py`: Manual test fixture for real hover interactions in VS Code.

## Practical Summary

If you want the shortest accurate mental model of the extension, it is this:

1. VS Code calls `HoverProvider`.
2. The provider gathers symbol identity from LSP, alias parsing, and Python AST inspection.
3. The symbol is normalized into a `DocKey`.
4. `DocResolver` tries static docs, stdlib corpus, Sphinx inventory, scraped content, PyPI discovery, and DevDocs fallback.
5. The Python helper provides runtime docstrings, signatures, version info, and installed package versions.
6. `HoverDocBuilder` merges everything into a structured `HoverDoc`.
7. `HoverRenderer` turns that into the final markdown hover, with links and actions.
8. Cache layers at several points make later hovers faster.

That is how the extension works end to end.
