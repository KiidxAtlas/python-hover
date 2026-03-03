# Changelog

All notable changes to Python Hover will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.6.7] - 2026-03-03

### ✨ New Features

- **Keyword & operator hovers now link to the correct docs.python.org section** — Every Python keyword and operator (`if`, `elif`, `else`, `for`, `while`, `try`, `except`, `finally`, `with`, `def`, `class`, `async`, `match`, `case`, `pass`, `del`, `return`, `raise`, `break`, `continue`, `import`, `from`, `global`, `nonlocal`, `assert`, `yield`, `lambda`, `await`, `not`, `and`, `or`, `in`, `is`) links directly to its specific section anchor, not just the top of the page.
- **Operator hovers** — `not`, `and`, `or`, `in`, `is` now link to `expressions.html#boolean-operations` / `membership-test-operations` / `identity-comparisons` respectively.
- **Built-in constant hovers** — `None`, `True`, `False`, `Ellipsis`, `...`, `__debug__`, `__name__` link to `library/constants.html#<name>`.

### 🔗 DevDocs Improvements

- **Scoped DevDocs links** — Completely rewrote DevDocs URL generation. URLs now use the `#q=docset term` format which scopes the search to a **single documentation set** only, eliminating cross-language results (e.g. Haxe's Python-target API docs no longer bleed through).
- **`devdocsUrl` field** — Added a dedicated `devdocsUrl` field to `HoverDoc` so the primary URL and DevDocs URL are independent; both buttons (`[Docs]` and `[DevDocs]`) now appear side-by-side when available.
- **Fixed DevDocs button not appearing** — `hoverDocBuilder` was manually reconstructing the `HoverDoc` return object field-by-field and silently dropping `devdocsUrl`. Fixed.
- **Known package map** — Added `DEVDOCS_DOC_SETS` mapping for numpy, pandas, scipy, matplotlib, scikit-learn, flask, django, fastapi, tensorflow, pytorch, sqlalchemy, redis, requests, httpx, aiohttp, beautifulsoup, lxml, pydantic, attrs. Unknown packages return `null` (no DevDocs button) rather than a potentially wrong URL.

### 🐛 Bug Fixes

- **Keyword URL was hardcoded** — The keyword fast-path in `hoverProvider` was building `simple_stmts.html#<keyword>` for every keyword (sending `elif`, `for`, `while`, `not` etc. to `simple_stmts.html#elif` which has no anchor). Now calls the doc resolver to get the correct page and anchor from the static MAP.
- **Duplicate `PLACEHOLDER_MSGS`** — Removed duplicate constant defined twice in `hoverDocBuilder`.

---

## [0.6.6] - 2026-01-02

### 🐛 Critical Fix

- **Fixed Python helper not found** — The python-helper folder was missing from the packaged extension, causing "No such file or directory" errors for all hover lookups.

---

## [0.6.5] - 2026-01-02

### ✨ UI/UX Improvements

- **Redesigned Hover UI** — Clean visual hierarchy with section headers, icons, and better spacing
- **New Status Bar** — Minimal design with quick-pick menu for all actions
- **Improved Keyword Docs** — Rich formatting for Python keywords with BNF syntax, examples, and PEP links
- **DevDocs Integration** — More reliable search-based links to DevDocs

### 🐛 Bug Fixes

- Fixed DevDocs links returning wrong results for common names like `from`, `class`
- Fixed VS Code Remote/SSH compatibility issues with HTTPS protocol
- Removed unused code and test files for cleaner package

### 📝 Documentation

- Completely rewritten README with better onboarding and feature highlights
- Added "What Developers Say" section and clearer CTAs

---

## [0.6.3] - 2025-12-21

### 🐛 Import Hover Fix

- Fixed module hovers like `import base64` resolving to duplicated names (e.g. `base64.base64`) which broke DevDocs search.
- Improved module name normalization for stdlib paths that include `python3.x` prefixes.

## [0.6.2] - 2025-12-21

### 🐛 Remote/SSH Fix

- Fixed Python helper failing on SSH/remote hosts when the configured interpreter path points to a Windows `C:\...python.exe`.
- Added interpreter probing and fast-fail behavior so missing Python doesn’t cause hover timeouts.

## [0.6.0] - 2025-12-20

### 🚀 **Complete Architecture Rewrite**

This release represents a **ground-up rewrite** of Python Hover with a new modular architecture designed for reliability, speed, and extensibility.

### ✨ New Features

#### **Hybrid Resolution Engine**
- **LSP + Runtime + Static** — Three-layer symbol resolution for maximum accuracy
- **AST-based Type Detection** — Identifies literal types (`list`, `dict`, `str`, etc.) even in unsaved files
- **Typeshed Parsing** — Extracts precise signatures and overloads from `.pyi` stub files
- **Protocol Hints** — Shows structural typing information (e.g., "Supports `__iter__`")

#### **Automatic Python Version Detection**
- Detects your active Python interpreter version (e.g., 3.11, 3.12, 3.13)
- Documentation URLs automatically point to the correct Python version docs
- No more seeing Python 3.9 docs when you're on 3.12!

#### **Static Data Layer (Instant, Offline)**
- **100+ Operators & Keywords** — Instant docs for `def`, `class`, `lambda`, `==`, `is`, `in`, and all Python operators
- **Typing Constructs** — Rich explanations for `Optional`, `Union`, `Literal`, `Protocol`, `TypeVar`, etc.
- Curated examples that appear instantly—no network required

#### **Smart Signature Refinement**
- Infers class context from `self` parameter type hints
- Fixes common LSP misresolutions (e.g., `append` → `list.append`)
- Handles Pylance's `Self@ClassName` format automatically

#### **Improved Alias Resolution**
- Detects import aliases like `import pandas as pd`
- Resolves `pd.DataFrame` → `pandas.DataFrame` for correct documentation lookup

#### **Configurable Online Discovery**
- New `python-hover.onlineDiscovery` setting to disable network requests
- Perfect for air-gapped environments or when you want pure offline mode
- Static data layer still provides rich documentation when offline

#### **Custom Library Support**
- Define custom Sphinx inventory URLs for internal/private libraries
- Configure via `python-hover.customLibraries` setting

### 🏗️ Architecture Changes

#### **Modular Codebase**
- **`docs-engine/`** — Standalone documentation resolution engine
  - `inventory/` — Sphinx `objects.inv` fetching, parsing, caching
  - `pypi/` — PyPI metadata and documentation URL discovery
  - `src/cache/` — Persistent disk caching with TTL support
  - `src/scraping/` — HTML → Markdown conversion for Sphinx pages
  - `src/resolvers/` — Static documentation resolver
  - `data/` — Curated keyword, operator, and typing construct mappings
- **`extension/`** — VS Code extension layer
  - `src/` — Activation, hover provider, LSP client, config
  - `ui/` — Hover rendering, status bar
  - `python-helper/` — Python scripts for runtime introspection
- **`shared/`** — Common types and utilities

#### **Python Helper Scripts**
- `resolver.py` — Runtime symbol resolution via `inspect` module
- `identifier.py` — AST-based literal type detection
- `safe_import.py` — Timeout-protected module imports (prevents hangs)
- `helper.py` — CLI entry point for all Python-side operations

### ⚡ Performance Improvements

- **Static-First Resolution** — Keywords/operators return in <1ms (no network)
- **Aggressive Disk Caching** — Inventories cached for days, snippets for hours
- **Reduced LSP Chatter** — AST identification handles many cases locally
- **Cancellation Support** — Long-running requests can be cancelled

### 🐛 Bug Fixes

- Fixed method hovers showing wrong class (e.g., `object.method` instead of `str.method`)
- Fixed dunder methods (`__init__`, `__str__`) not resolving correctly
- Fixed f-string detection and documentation
- Fixed operator hovers returning generic pages
- Improved error handling for malformed Sphinx inventories
- Fixed status bar command registration

### 🔧 Configuration

New settings added:

| Setting | Default | Description |
|---------|---------|-------------|
| `python-hover.onlineDiscovery` | `true` | Enable/disable network requests |
| `python-hover.docsVersion` | `"auto"` | Python version for docs (`"auto"`, `"3.11"`, etc.) |
| `python-hover.inventoryCacheDays` | `7` | Days to cache Sphinx inventories |
| `python-hover.snippetCacheHours` | `24` | Hours to cache documentation snippets |
| `python-hover.requestTimeout` | `5000` | Network request timeout in ms |
| `python-hover.customLibraries` | `[]` | Custom library inventory definitions |

### 📦 Dependencies

- Minimum VS Code version: `1.85.0`
- No external runtime dependencies (Python helper uses stdlib only)

### 🙏 Acknowledgments

This rewrite was driven by community feedback requesting better offline support, faster responses, and more accurate type detection. Thank you to everyone who filed issues and suggestions!

---

## [0.5.3] - 2025-10-22

### ✨ Improvements

- Operator hovers now show real reference content with correct anchors and versioned URLs
- Standard library module hovers prefer curated module mapping for clearer descriptions

### 🧪 Testing

- Snapshot mode: tests capture the exact hover Markdown users see
- Expanded snapshot coverage across built-ins, keywords, stdlib, typing, operators

### 🐛 Fixes

- Prefer precise keyword mapping for specific terms (e.g., `finally`)
- Improved itertools module hover

---

## [0.4.2] - 2025-10-10

### 🐛 Bug Fixes

- Fixed method hover lookups (str.upper, list.append, etc.)
- Fixed cancellation error filtering in status bar
- Fixed generic documentation pages for built-in functions

### ✨ Improvements

- Enhanced logging with VS Code Output Channel
- Improved hover content formatting
- Better debug capabilities

---

## [0.3.0] - 2025-09-15

### ✨ Features

- Auto-discovery for ANY library with Sphinx documentation
- PyPI integration for documentation URL discovery
- Aggressive caching for offline use

---

## [0.2.0] - 2025-08-01

### ✨ Features

- 19+ pre-configured third-party libraries
- Smart context detection for DataFrames, strings, lists
- Rich Sphinx documentation parsing

---

## [0.1.0] - 2025-07-01

### 🎉 Initial Release

- 300+ Python built-in constructs
- Practical, copyable examples
- Offline support with caching
