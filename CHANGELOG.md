# Change Log

## [0.2.3] - 2025-10-05

### 🔧 **Bug Fixes & Improvements**

- **Fixed Missing Dependencies**: Resolved `node-fetch` and `pako` module loading errors
- **Cleaned Hover Display**: Removed raw HTML tags and improved markdown formatting
- **Fixed Broken Links**: All documentation links now display and work correctly
- **Improved Click-ability**: Converted HTML anchors to proper Markdown links
- **Package Optimization**: Properly included runtime dependencies in VSIX package
- **Code Cleanup**: Removed development artifacts and test files from repository

### 📦 **Technical Details**

- Fixed `.vscodeignore` to include `node_modules` production dependencies
- Removed raw `<a>` and `<sub>` HTML tags from hover content
- Simplified "No docs found" messaging with clean fallback links
- Updated extension activation and initialization logic

## [0.3.0] - 2025-10-04

### 🔧 **Bug Fixes & Improvements**

- **Fixed Dunder Method Hovers**: Improved detection and display of special methods
- **Enhanced Documentation Links**: Fixed and improved links to Python documentation
- **Better Symbol Resolution**: Enhanced symbol detection for special Python constructs
- **Added Debugging Information**: Improved logging for easier troubleshooting

## [0.2.1] - 2025-10-04

### 🐛 **Bug Fixes**

- **CommonJS Compatibility**: Fixed node-fetch import issues for proper CommonJS compatibility
- **Configuration Settings**: Added missing configuration settings in package.json
- **Cleaner Package**: Removed duplicate entries in .vscodeignore
- **Type Definitions**: Added proper type definitions for dependencies

## [0.2.0] - 2023-07-15

### ✨ **Major Enhancement Release**

#### 🚀 **New Features**

- **Smart Context Detection**: Added context-aware type detection for Python variables
- **Enhanced Method Resolution**: Automatically maps methods to their
  containing types
- **Rich Examples**: Added comprehensive practical code examples for Python constructs
- **Special Method Support**: Added full support for dunder methods
  like `__init__`, `__str__`, etc.
- **Smart Suggestions**: Related method suggestions for enhanced discovery
- **Example Enrichment**: Integration of examples with official documentation

#### 🔧 **Technical Improvements**

- **Type Resolution**: Better detection of variable and parameter types
- **Method Mapping**: Comprehensive method-to-type mapping for builtin types
- **Enhanced Symbol Resolution**: Improved identification of Python symbols
- **Documentation Integration**: Seamless combination of examples with official docs
- **Performance**: Optimized caching and reduced documentation fetching overhead

#### 📝 **Documentation**

- **Updated README**: Comprehensive documentation of features and capabilities
- **Enhanced Marketplace Presence**: Improved icon, badges, and presentation
- **Usage Examples**: Added real-world usage examples and screenshots

## [0.1.0] - 2023-06-01

### 🎉 **Initial Release**

#### 🌟 **Core Features**

- **Runtime Documentation Resolution**: Fetches documentation from docs.python.org
- **Intelligent Symbol Detection**: Recognizes builtins, modules, exceptions, etc.
- **Anchor Preservation**: Maintains documentation anchors for navigation
- **Smart Caching**: Respects ETag/Last-Modified headers with configurable TTL
- **Version Detection**: Automatically detects Python version from project files
- **Configurable**: Customizable documentation version and snippet length
