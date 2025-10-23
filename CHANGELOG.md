# Changelog

All notable changes to the Python Hover extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.5.3] - 2025-10-22

### ✨ Improvements

- Operator hovers now show real reference content with correct anchors and versioned URLs
  - Mapped Python operators to precise docs pages/anchors (arithmetic, comparison, boolean, bitwise)
  - Extract and render anchored HTML sections to Markdown with caching for speed
  - Deterministic “Docs URL:” lines in tests for stable snapshots
- Standard library module hovers prefer curated module mapping for clearer descriptions and stable links
  - Version-aware links use `#module-<name>` anchors for consistency
  - Better fallback behavior when auto-detect is disabled

### 🧪 Testing

- Snapshot mode: tests capture the exact hover Markdown users see
  - Artifacts written under `artifacts/hover-snapshots/`
  - Expanded snapshot coverage across built-ins, keywords, stdlib, typing, operators, and popular third‑party libs

### 🔧 Cleanup

- Removed unused UI helpers and types; trimmed theme utilities
- Gated test-only commands to test environment
- Pruned non-shipping files (demo, old scripts) and tightened `.vscodeignore`

### 🐛 Fixes

- Prefer precise keyword mapping for specific terms (e.g., `finally`) over generic labels
- Improved itertools module hover by prioritizing curated MODULES entry for richer descriptions

---

## [0.4.2] - 2025-10-10

### �️ Cleanup

- Removed dumb author file

### �🐛 Bug Fixes

- **Method Hover Lookups**: Fixed critical bug where method hovers (e.g., `str.upper()`, `list.append()`, `dict.keys()`) were showing "no documentation found"
  - Issue: Symbol resolver returned qualified names like "text.upper" but documentation MAP used simple keys like "upper"
  - Solution: Added symbol extraction logic to update `primarySymbol.symbol` after method name extraction
  - Now correctly extracts method names from qualified symbols for MAP lookups
  - Fixes all built-in method hovers for str, list, dict, set, and other types

- **Cancellation Error Filtering**: Fixed annoying cancellation errors in status bar
  - ErrorNotifier now filters out VS Code cancellation errors (error code -32800)
  - Users no longer see "Canceled" messages when dismissing prompts
  - Cleaner error handling throughout extension

- **Generic Documentation Pages**: Fixed built-in functions showing generic "Built-in Functions" page
  - Added detection for generic documentation pages in `createRichHover()`
  - Now falls back to showing basic hover when generic page is detected
  - Improves documentation quality for built-in functions like `range()`, `len()`, `print()`

### ✨ Improvements

- **Enhanced Logging with Output Channel**: Added proper VS Code Output Channel support
  - Logger now creates "Python Hover" channel visible in Output panel dropdown
  - All logs visible in VS Code's Output panel (View → Output → Python Hover)
  - Dual logging to both Output Channel and console for debugging
  - Added `show()`, `getOutputChannel()`, and `dispose()` methods to Logger
  - Makes debugging and troubleshooting much easier for users

- **Improved Hover Content Formatting**: Enhanced hover tooltip presentation
  - Better code formatting with proper syntax highlighting
  - Improved example presentation with clear section separation
  - Enhanced visual styling for better readability
  - Consistent formatting across all hover types

- **Better Debug Capabilities**: Added comprehensive logging throughout hover pipeline
  - Logs hover triggers, symbol resolution, context detection
  - Tracks Python version detection and environment setup
  - Shows documentation fetching and MAP lookups
  - Method name extraction now fully logged
  - Helps identify and fix issues faster

### 🔧 Technical Improvements

- **Symbol Resolution**: Improved method name extraction logic
  - Handles qualified names like "obj.method" correctly
  - Preserves context information (str, list, dict, etc.)
  - Ensures MAP lookups use correct simple keys
  - Better handling of third-party library methods

- **Error Handling**: More robust error handling throughout extension
  - Filters out user-cancelled operations
  - Better error messages for debugging
  - Graceful fallbacks when documentation not found

---

## [0.4.1] - 2025-10-09

### ✨ New Features

- **Python Version Display**: Shows detected Python version at bottom-right of all hover tooltips
  - Displays version from active Python environment (e.g., "Python 3.13")
  - Updates automatically when switching Python interpreters
  - Helps identify which Python version documentation is being used
  - Added to all hover types: standard library, third-party, custom docs, and module hovers

### 🔧 Configuration Changes

- **Auto-Detect Libraries Default Changed**: `pythonHover.experimental.autoDetectLibraries` now defaults to `false`
  - Changed from `true` to `false` to prevent performance impact by default
  - Users can enable manually if needed for third-party library auto-detection
  - Reduces startup time and improves responsiveness for most users
  - Custom libraries still work without enabling this setting

### 📚 Documentation

- **Demo File Added**: New `demo.py` file showcasing all extension features
  - 18 comprehensive sections covering built-ins, standard library, third-party libs
  - Testing instructions for all features
  - Library discovery section to check installed/supported libraries
  - Interactive examples for keywords, methods, classes, and special methods
  - Type hints, decorators, file operations, and more

### 📈 Improvements

- Better visual separation of Python version info in hover tooltips
- Consistent version display across all hover types
- Improved hover tooltip formatting with right-aligned version info

---

## [0.4.0] - 2025-10-08

### 🎉 Major Features

- **Custom Library Support**: Add documentation for any Python library with Intersphinx inventory
  - New configuration: `pythonHover.customLibraries` (array of library configs)
  - Each library requires: `name`, `inventoryUrl`, `baseUrl`
  - Works with any Sphinx-documented library (ReadTheDocs, GitHub Pages, self-hosted)
  - Automatic caching and version detection
  - See [CUSTOM_LIBRARIES.md](CUSTOM_LIBRARIES.md) for complete guide

- **🧪 Experimental: Auto-Detect Libraries**: Automatically discover and document third-party imports
  - New setting: `pythonHover.experimental.autoDetectLibraries` (default: false)
  - Detects imports like `from jupyter_client import KernelManager`
  - Automatically fetches Intersphinx inventories from documentation sites
  - Provides hover docs for any library with published `objects.inv` files
  - Works with installed packages in your Python environment
  - Supports thousands of libraries (jupyter, black, mypy, httpx, etc.)
  - **Note:** Disabled by default to avoid performance impact; enable if needed

- **Package Detection System**: Automatic version detection for installed libraries
  - Uses pip metadata to find installed package versions
  - Matches documentation versions to installed versions when available
  - Falls back gracefully to latest/stable docs
  - Caches version info for performance

### ✨ New Features

- **Python Version Display**: Shows detected Python version at bottom-right of hover tooltips
  - Displays version from active Python environment
  - Updates automatically when switching Python interpreters
  - Helps identify which Python version documentation is being used

- **Module Hover Support**: Hover over module names in import statements
  - Example: Hover over `jupyter_client` in `from jupyter_client import KernelManager`
  - Shows module description and documentation links
  - Works with all third-party libraries (auto-detect or custom)

- **Enhanced Symbol Resolution**: Improved detection for imported symbols
  - Better handling of `from X import Y` statements
  - Fixed method context detection for dotted access (e.g., `paths.jupyter_data_dir()`)
  - Added heuristics to prevent hover spam on comments and variables
  - Smart detection of PascalCase classes vs regular words

- **Show Supported Libraries Command**: New command to view all supported libraries
  - Access via Command Palette: `Python Hover: Show Supported Libraries`
  - Displays organized list by category (Data Science, Web, Testing, etc.)
  - Shows built-in vs custom library counts
  - Indicates auto-detect status
  - Provides quick links to configuration

### 🔧 Configuration

- **Version Cache TTL**: New setting `pythonHover.versionCacheTTL` (default: 30 seconds)
  - Controls how long Python version detection is cached
  - Lower values detect environment changes faster
  - Higher values improve performance

- **Debounce Delay**: New setting `pythonHover.debounceDelay` (default: 150ms)
  - Delays hover display to reduce flicker when moving cursor quickly
  - Configurable from 0-1000ms

### 🐛 Bug Fixes

- Fixed duplicate library entries in import tracking
- Fixed symbol resolver treating imported symbols as modules
- Fixed method context detection for third-party library methods
- Improved comment detection to skip hover in comment blocks
- Fixed webpack output path configuration for proper compilation

### 📈 Improvements

- Hover provider now checks auto-detect setting before scanning imports
- Import map is always built for method context detection (even when auto-detect is off)
- Better error handling for missing or invalid inventory files
- Improved logging with context tags for debugging
- More efficient caching strategy with version-aware keys

### 📚 Documentation

- Added comprehensive [CUSTOM_LIBRARIES.md](CUSTOM_LIBRARIES.md) guide
  - How to find Intersphinx URLs
  - Configuration examples
  - Testing tips
  - Common patterns for ReadTheDocs, GitHub Pages, etc.
- Updated README with experimental features section
- Added comparison table: Auto-Detect vs Custom Libraries
- Updated commands list with new "Show Supported Libraries" command

### 🏗️ Development

- Improved TypeScript strict null checks
- Better error handling for optional chaining
- Updated webpack configuration for production builds
- Added null safety for config manager properties

---

## [0.3.2] - 2025-10-06

### ✨ Added

- **Status Bar Integration**: Real-time cache size indicator in VS Code status bar
  - Shows cache size (e.g., "5.2MB") with automatic updates every 30 seconds
  - Click to view detailed cache statistics (file count, size, location)
  - Quick actions: Clear Cache, Open Location
- **Request Timeouts**: All HTTP requests now timeout after 10 seconds (configurable)
  - New setting: `pythonHover.requestTimeout` (1-60 seconds, default: 10)
  - Prevents extension from hanging on slow/offline documentation sites
  - User-Agent header added to all requests
- **Centralized Logging**: New logger infrastructure with debug control
  - New setting: `pythonHover.enableDebugLogging` (boolean, default: false)
  - Replaces console.log statements with controlled logging
- **Test Infrastructure**: Complete test suite with 10 passing tests
  - SymbolResolver tests (6 tests): dotted access, builtins, keywords, dunder methods
  - InventoryManager tests (4 tests): third-party libraries, stdlib fallback
- **PyTorch Support**: Added Intersphinx inventory for PyTorch deep learning framework (torch alias)
- **aiohttp Support**: Added Intersphinx inventory for async HTTP client/server
- **Click Support**: Added Intersphinx inventory for CLI creation framework

### 🔧 Fixed

- **PyTorch URL**: Fixed Intersphinx URL (now uses pytorch.org/docs/stable)
- **Click URL**: Fixed Intersphinx URL (now uses /en/stable/ path)
- **Removed Broken Libraries**: Removed TensorFlow, OpenCV, and httpx (no Intersphinx support available)
- Fixed duplicate configManager declaration in extension.ts

### 📈 Improvements

- Enhanced fallback URLs for verified working libraries
- Updated library count to 19+ total third-party libraries (all tested and working)
- Improved README documentation with accurate library categorization
- Removed deprecated `collapseLongExamples` configuration reference
- All Intersphinx URLs verified and functional
- Status bar updates automatically after cache operations
- Graceful error handling for network timeouts

### 📚 Documentation

- Fixed version inconsistencies in README
- Added GIF demo to README (media/media.gif)
- Removed duplicate sections in README
- Clarified asyncio as standard library (not third-party)
- Updated library categories: Machine Learning, HTTP & Async, CLI
- Comprehensive test documentation

---

## [0.3.1] - 2025-01-06

### ✨ **Added**

- **FastAPI Support**: Added Intersphinx inventory for FastAPI framework (`https://fastapi.tiangolo.com/objects.inv`)
- **Pydantic Support**: Added Intersphinx inventory for Pydantic validation library (`https://docs.pydantic.dev/latest/objects.inv`)
- **SQLAlchemy Support**: Added Intersphinx inventory for SQLAlchemy ORM (`https://docs.sqlalchemy.org/en/20/objects.inv`)
- **BeautifulSoup4 Support**: Added Intersphinx inventory for web scraping (`https://www.crummy.com/software/BeautifulSoup/bs4/doc/objects.inv`)
- **Selenium Support**: Added Intersphinx inventory for browser automation (`https://www.selenium.dev/selenium/docs/api/py/objects.inv`)
- **Pillow/PIL Support**: Added Intersphinx inventory for image processing (`https://pillow.readthedocs.io/en/stable/objects.inv`)

### 🔧 **Improvements**

- Enhanced fallback URLs for all newly supported libraries
- Added module name aliases (bs4, pil) for common import patterns
- Complete coverage of all advertised third-party libraries

---

## [0.3.0] - 2025-10-06

### 🚀 **Major Features**

#### **Dynamic Third-Party Library Support via Intersphinx**All notable changes to the Python Hover extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.3.0] - 2025-10-06

### � **Major Features**

#### **Dynamic Third-Party Library Support via Intersphinx**

- **Automatic Documentation**: Third-party libraries now use Intersphinx inventories for automatic, comprehensive documentation coverage
- **Zero Manual Maintenance**: No need to manually add documentation for thousands of library functions
- **Official Sources**: All documentation links point directly to official library documentation with proper anchors
- **Supported Libraries**:
  - NumPy - Full API coverage via `https://numpy.org/doc/stable/objects.inv`
  - Pandas - Complete DataFrame/Series methods via `https://pandas.pydata.org/docs/objects.inv`
  - Matplotlib - All pyplot functions via `https://matplotlib.org/stable/objects.inv`
  - Requests - HTTP library methods via `https://docs.python-requests.org/objects.inv`
  - SciPy - Scientific computing via `https://docs.scipy.org/doc/scipy/objects.inv`
  - Flask - Web framework via `https://flask.palletsprojects.com/objects.inv`
  - Django - Web framework via `https://docs.djangoproject.com/objects.inv`

#### **Enhanced Standard Library Support**

- **Improved Content Extraction**: Better paragraph extraction showing multiple paragraphs (up to 400 chars) instead of single sentences
- **Smart Fallback Messages**: When content extraction fails, shows helpful message with link to full documentation
- **Better Module Detection**: Enhanced symbol resolver recognizes 40+ standard library modules (os, sys, math, json, datetime, pathlib, etc.)

### 🔧 **Improvements**

- **Removed Manual Stdlib Entries**: Deleted 515 lines of manual math.* and os.* documentation to rely on dynamic Intersphinx system
- **Fixed Interface Mismatches**: Removed checks for non-existent `summary` and `signature` fields in DocumentationSnippet
- **Better Third-Party Fallback URLs**: When documentation not found, links to appropriate library docs instead of generic Python docs
- **Matplotlib Alias Support**: `plt.plot()` correctly resolves to `matplotlib.pyplot.plot` documentation
- **Smart Symbol Lookup**: Multiple search patterns for complex module structures (e.g., matplotlib.pyplot)

### � **Technical Details**

- Added `LibraryInventoryConfig` interface for third-party library configuration
- New methods: `getThirdPartyInventory()`, `fetchThirdPartyInventory()`, `parseThirdPartyInventory()`
- 7-day cache for third-party inventories (more stable than stdlib's 24h)
- Partial name matching for finding symbols in complex module hierarchies
- Context-aware symbol resolution passing library context through the resolution chain

---

## [0.3.0] - 2025-10-06

- Requests (get, post methods)- **Enhanced Documentation Links**: Fixed and improved links to Python documentation
- **Testing**: pytest (fixture, mark decorators)- **Better Symbol Resolution**: Enhanced symbol detection for special Python constructs
- **Async**: asyncio (run, gather, sleep)- **Added Debugging Information**: Improved logging for easier troubleshooting
- **Data Parsing**: BeautifulSoup4 (BeautifulSoup class)
- **Database**: SQLAlchemy (create_engine, ORM)## [0.2.1] - 2025-10-04
- **Validation**: Pydantic (BaseModel)
- **Automation**: Selenium (webdriver)### 🐛 **Bug Fixes**
- **Image Processing**: Pillow/PIL (Image class)
- **CommonJS Compatibility**: Fixed node-fetch import issues for proper CommonJS compatibility

#### **New Visual Features**- **Configuration Settings**: Added missing configuration settings in package.json

- VS Code theme icon integration throughout hovers- **Cleaner Package**: Removed duplicate entries in .vscodeignore
- Colored badge system using emoji circles (🔵🟢🟡🔴)- **Type Definitions**: Added proper type definitions for dependencies
- Consistent formatting across all hover types
- Enhanced section headers with icons## [0.2.0] - 2023-07-15
- Blockquote styling for tips, notes, and warnings

### ✨ **Major Enhancement Release**

#### **New Configuration Options**

- `pythonHover.fontSize`: Choose small/medium/large font sizes#### 🚀 **New Features**
- `pythonHover.showEmojis`: Toggle emoji icons
- `pythonHover.showColors`: Enable/disable colored badges- **Smart Context Detection**: Added context-aware type detection for Python variables
- `pythonHover.showBorders`: Toggle section dividers- **Enhanced Method Resolution**: Automatically maps methods to their
- `pythonHover.collapseLongExamples`: Auto-collapse long code examples  containing types
- `pythonHover.openDocsInEditor`: Open docs in VS Code Simple Browser instead of external browser- **Rich Examples**: Added comprehensive practical code examples for Python constructs
- **Special Method Support**: Added full support for dunder methods

#### **New Commands**  like `__init__`, `__str__`, etc.

- `Python Hover: Increase Font Size` - Enlarge hover font- **Smart Suggestions**: Related method suggestions for enhanced discovery
- `Python Hover: Decrease Font Size` - Reduce hover font- **Example Enrichment**: Integration of examples with official documentation
- `Python Hover: Insert Example at Cursor` - Copy example code to editor

#### 🔧 **Technical Improvements**

### 🎨 **Changed**

- **Type Resolution**: Better detection of variable and parameter types
- **Complete Visual Overhaul**- **Method Mapping**: Comprehensive method-to-type mapping for builtin types

  - Unified all hovers to use new theme system- **Enhanced Symbol Resolution**: Improved identification of Python symbols
  - Consistent formatting for third-party, builtin, and keyword hovers- **Documentation Integration**: Seamless combination of examples with official docs
  - Better visual hierarchy with VS Code icons- **Performance**: Optimized caching and reduced documentation fetching overhead
  - Improved spacing and readability

#### 📝 **Documentation**

- **Enhanced Hover Content**

  - Standardized section order across all hover types- **Updated README**: Comprehensive documentation of features and capabilities
  - Added blockquote tips and notes- **Enhanced Marketplace Presence**: Improved icon, badges, and presentation
  - Improved action links with icons- **Usage Examples**: Added real-world usage examples and screenshots
  - Better code block formatting

## [0.1.0] - 2023-06-01

- **Theme System**

  - Removed minimal and compact themes (simplified to single rich theme)### 🎉 **Initial Release**
  - Fixed double emoji/icon display issue
  - Better integration with VS Code's color theme#### 🌟 **Core Features**

### 🐛 **Fixed**- **Runtime Documentation Resolution**: Fetches documentation from docs.python.org

- **Intelligent Symbol Detection**: Recognizes builtins, modules, exceptions, etc.
- Fixed third-party library detection not working for aliased imports (e.g., `np.zeros`)- **Anchor Preservation**: Maintains documentation anchors for navigation
- Fixed documentation URL links not displaying correctly- **Smart Caching**: Respects ETag/Last-Modified headers with configurable TTL
- Fixed double emoji issue in headers- **Version Detection**: Automatically detects Python version from project files
- Fixed theme consistency across different hover types- **Configurable**: Customizable documentation version and snippet length
- Removed dead code (`codeRunner.ts` - 223 lines)

### ⚡ **Performance**

- Added request deduplication to prevent multiple concurrent hover requests
- Improved error handling with user-friendly network error messages
- Better resource cleanup with proper disposal methods
- Optimized caching strategy

### 📝 **Documentation**

- Complete README overhaul with marketplace-friendly content
- Added comprehensive feature list
- Added comparison table with other extensions
- Added pro tips and configuration examples
- Updated all examples to be practical and runnable

---

## [0.2.4] - 2024

### 🔧 **Bug Fixes & Improvements**

- Enhanced method resolution for better context detection
- Improved hover performance and caching
- Better error handling for network requests

---

## [0.2.3] - 2024

### ✨ **Features**

- Added smart suggestions for related methods
- Enhanced examples for built-in functions
- Improved type hint support

### 🔧 **Bug Fixes & Improvements**

- Fixed caching issues with documentation
- Improved inventory management
- Better handling of special methods
- Added debugging information for troubleshooting

---

## [0.2.0] - 2024

### 🐛 **Bug Fixes**

- Fixed hover not showing for certain methods
- Improved symbol resolution
- Better context detection

---

## [0.1.0] - Initial Release

### ✨ **Features**

- Python hover documentation for 300+ constructs
- Support for built-in functions and methods
- String, List, Dict, Set method documentation
- Special method (dunder) support
- Standard library module documentation
- Practical code examples
- Smart context detection
- Offline caching
- Customizable configuration

---

## **Roadmap**

### Future Enhancements

- [ ] More third-party library support (TensorFlow, PyTorch, etc.)
- [ ] Interactive code execution from hovers
- [ ] Multilingual support
- [ ] Custom project documentation indexing
- [ ] GitHub code examples integration
- [ ] Keyboard shortcuts for common actions
- [ ] Hover preview panel for persistent documentation
- [ ] AI-powered smart suggestions

---

## **Contributing**

See [README.md](README.md) for contribution guidelines.

---

## **Links**

- [GitHub Repository](https://github.com/KiidxAtlas/python-hover)
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover)
- [Report Issues](https://github.com/KiidxAtlas/python-hover/issues)
