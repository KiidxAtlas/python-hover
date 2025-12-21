# Changelog

All notable changes to Python Hover will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

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
