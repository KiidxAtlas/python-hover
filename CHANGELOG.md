# Change Log

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
