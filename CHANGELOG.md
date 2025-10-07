# Changelog

All notable changes to the Python Hover extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.3.0] - 2025-10-06

### 🚀 **Major Features**

#### **Dynamic Third-Party Library Support via Intersphinx**All notable changes to the Python Hover extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.4.0] - 2025-10-06

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
