# Architecture Documentation

## Overview

The Python Documentation Hover extension provides real-time documentation for Python symbols by dynamically fetching content from the official Python documentation. This document outlines the key architectural decisions and implementation details.

## Core Design Principles

### 1. Runtime Resolution
- **No Static Content**: The extension never embeds documentation text
- **Dynamic Fetching**: Resolves symbols → URLs at runtime using Python's intersphinx inventory
- **Anchor Preservation**: Maintains exact documentation anchors for seamless navigation

### 2. Intelligent Caching
- **Multi-layer Cache**: Separate caching for inventories and documentation snippets
- **HTTP Semantics**: Respects ETag and Last-Modified headers
- **Configurable TTL**: User-configurable cache expiration times

### 3. Version Awareness
- **Automatic Detection**: Detects Python version from project files and interpreter
- **Fallback Strategy**: Graceful degradation with sensible defaults
- **Future-proof**: Designed to work with new Python versions without code changes

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     VS Code Extension Host                      │
├─────────────────────────────────────────────────────────────────┤
│  PythonHoverProvider (implements vscode.HoverProvider)         │
│  ├── Handles hover requests                                    │
│  ├── Coordinates symbol resolution and documentation fetching  │
│  └── Formats markdown content for display                      │
├─────────────────────────────────────────────────────────────────┤
│  SymbolResolver                                                │
│  ├── Analyzes Python code at cursor position                   │
│  ├── Identifies symbol types (builtin, method, exception, etc) │
│  └── Extracts context (dotted access, imports, etc)           │
├─────────────────────────────────────────────────────────────────┤
│  VersionDetector                                               │
│  ├── Detects Python version from Python extension             │
│  ├── Parses project files (pyproject.toml, Pipfile, etc)      │
│  └── Provides version fallbacks                                │
├─────────────────────────────────────────────────────────────────┤
│  InventoryManager                                              │
│  ├── Fetches and parses intersphinx inventory files           │
│  ├── Builds symbol → URL + anchor mappings                    │
│  └── Provides symbol resolution and search                     │
├─────────────────────────────────────────────────────────────────┤
│  DocumentationFetcher                                          │
│  ├── Fetches documentation pages                              │
│  ├── Extracts relevant sections using anchors                 │
│  └── Converts HTML to clean markdown                           │
├─────────────────────────────────────────────────────────────────┤
│  CacheManager                                                  │
│  ├── Handles file-based caching with JSON storage             │
│  ├── Supports ETag and Last-Modified headers                  │
│  └── Implements configurable TTL                               │
├─────────────────────────────────────────────────────────────────┤
│  ConfigurationManager                                          │
│  ├── Reads VS Code configuration settings                     │
│  ├── Provides type-safe access to settings                    │
│  └── Handles configuration changes                             │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Hover Request Flow
```
User hovers over Python symbol
    ↓
PythonHoverProvider.provideHover()
    ↓
SymbolResolver.resolveSymbolAtPosition()
    ↓ (symbol candidates)
VersionDetector.detectPythonVersion()
    ↓ (Python version)
InventoryManager.resolveSymbol()
    ↓ (InventoryEntry with URL + anchor)
DocumentationFetcher.fetchDocumentation()
    ↓ (DocumentationSnippet)
Format as VS Code Hover markdown
    ↓
Display hover popup
```

### 2. Symbol Resolution Strategy
```
Text at cursor position
    ↓
Extract word and context
    ↓
Check if decorator (@property, @staticmethod)
    ↓
Check if Python keyword (if, for, while)
    ↓
Check if builtin function (len, print, str)
    ↓
Check if exception (ValueError, TypeError)
    ↓
Check for dotted access (str.split, list.append)
    ↓
Check for module context (from imports)
    ↓
Return symbol candidates with types
```

### 3. Inventory Resolution
```
Symbol name (e.g., "str.split")
    ↓
Check cache for inventory-{version}
    ↓ (if expired or missing)
Fetch https://docs.python.org/{version}/objects.inv
    ↓
Parse zlib-compressed intersphinx format
    ↓
Build Map<string, InventoryEntry>
    ↓
Cache result with ETag
    ↓
Return InventoryEntry for symbol
```

## Key Implementation Details

### Intersphinx Inventory Parsing

The extension parses Python's `objects.inv` files, which are in a custom format:
- Header: 4 lines of metadata
- Body: zlib-compressed tab-separated values
- Format: `name domain:role priority uri anchor`

```typescript
// Example inventory entry:
// str.split py:method 1 library/stdtypes.html#str.split
```

### HTML to Markdown Conversion

Documentation snippets are extracted from HTML and converted to clean markdown:
- Removes `<script>` and `<style>` tags
- Converts headers, paragraphs, code blocks, and lists
- Preserves inline code formatting
- Truncates to configured line limit

### Caching Strategy

Two-level caching system:
1. **Inventory Cache**: Per-version, 7-day TTL (configurable)
2. **Documentation Cache**: Per-URL+anchor, 48-hour TTL (configurable)

Cache keys are sanitized for filesystem compatibility:
```typescript
const sanitized = key.replace(/[^a-zA-Z0-9.-]/g, '_');
```

## Configuration

### Settings Schema
```json
{
  "pythonHover.docsVersion": {
    "type": "string",
    "enum": ["auto", "3.8", "3.9", "3.10", "3.11", "3.12", "3.13"],
    "default": "auto"
  },
  "pythonHover.maxSnippetLines": {
    "type": "number",
    "default": 12
  },
  "pythonHover.cacheTTL.inventoryDays": {
    "type": "number",
    "default": 7
  },
  "pythonHover.cacheTTL.snippetHours": {
    "type": "number",
    "default": 48
  }
}
```

### Version Detection Priority
1. Python extension active interpreter
2. `pyproject.toml` python requirement
3. `Pipfile` python_version
4. `runtime.txt` python version
5. Workspace setting
6. Default (3.12)

## Error Handling

### Graceful Degradation
- Network failures → Use cached content if available
- Parse errors → Show basic symbol info with documentation link
- Version detection failures → Fall back to default version
- Missing symbols → No hover (fails silently)

### Offline Support
The extension works offline when:
- Inventory files are cached
- Documentation snippets are cached
- Shows links even without snippet content

## Security Considerations

### Data Sources
- Only fetches from `https://docs.python.org/`
- No external dependencies or analytics
- No telemetry by default

### Content Sanitization
- HTML content is stripped and converted to markdown
- No executable content (scripts, styles) is preserved
- MarkdownString has `isTrusted = false`

## Performance Optimizations

### Network Efficiency
- HTTP compression (gzip) enabled
- ETag and Last-Modified headers respected
- Concurrent request limiting
- Exponential backoff on errors

### Memory Management
- Streaming inventory parsing
- Truncated documentation snippets
- JSON-based file cache (no in-memory retention)

### Background Processing
- Inventory fetching doesn't block hover display
- Async/await throughout for non-blocking operation

## Testing Strategy

### Unit Tests
- Symbol resolution accuracy
- Version detection logic
- Cache behavior
- HTML to markdown conversion

### Integration Tests
- End-to-end hover scenarios
- Network failure simulation
- Configuration changes
- Python extension integration

### Snapshot Tests
- Hover content formatting
- Markdown output consistency
- URL and anchor preservation

## Future Extensibility

### Third-party Library Support
The architecture supports adding more intersphinx inventories:
```typescript
// Future: numpy, pandas, django inventories
const inventories = [
  'https://docs.python.org/3.12/objects.inv',
  'https://numpy.org/doc/stable/objects.inv',
  'https://pandas.pydata.org/docs/objects.inv'
];
```

### Additional Language Features
- Go-to-definition via inventory URLs
- Signature help from documentation
- Inlay hints for return types

## Development Workflow

### Build Process
```bash
npm install          # Install dependencies
npm run compile      # TypeScript compilation
npm run watch        # Watch mode for development
npm test            # Run test suite
npm run lint        # ESLint checks
```

### Debugging
- Use F5 to launch Extension Development Host
- Set breakpoints in TypeScript source
- Test with `test-examples/demo.py`

### Packaging
```bash
npm install -g vsce
vsce package        # Creates .vsix file
```
