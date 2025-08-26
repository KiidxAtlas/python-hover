# Python Documentation Hover

A VS Code extension that provides rich hover documentation for Python code by dynamically fetching content from the official Python documentation at runtime.

## Features

- **Runtime Documentation Resolution**: Fetches documentation from docs.python.org based on detected Python version
- **Intelligent Symbol Detection**: Recognizes builtins, stdlib modules, exceptions, keywords, decorators, and methods
- **Anchor Preservation**: Maintains exact documentation anchors for seamless navigation
- **Smart Caching**: Respects ETag/Last-Modified headers with configurable cache TTL
- **Version Detection**: Automatically detects Python version from project files or Python extension
- **Configurable**: Customizable documentation version, snippet length, and cache behavior

## Supported Python Elements

- **Built-in functions**: `len()`, `print()`, `str()`, etc.
- **Built-in types and their methods**: `str.split()`, `list.append()`, etc.
- **Standard library modules**: `os`, `sys`, `json`, etc.
- **Exceptions**: `ValueError`, `TypeError`, etc.
- **Keywords**: `if`, `for`, `while`, etc.
- **Decorators**: `@property`, `@staticmethod`, etc.

## Configuration

```json
{
  "pythonHover.docsVersion": "auto",          // Python version to use for docs
  "pythonHover.maxSnippetLines": 12,          // Max lines in hover snippets
  "pythonHover.cacheTTL.inventoryDays": 7,    // Days to cache inventory files
  "pythonHover.cacheTTL.snippetHours": 48,    // Hours to cache doc snippets
  "pythonHover.enableKeywordDocs": true,      // Enable keyword documentation
  "pythonHover.telemetry": false              // Telemetry (disabled by default)
}
```

## Version Detection

The extension detects the appropriate Python version in this order:

1. Active interpreter from the Python extension (if available)
2. `pyproject.toml` / `poetry.lock` / `Pipfile` / `runtime.txt` hints
3. Workspace setting `pythonHover.docsVersion`
4. Fallback to latest stable version

## Architecture

- **Symbol Resolution**: Analyzes code context to identify Python symbols
- **Intersphinx Integration**: Parses Python's objects.inv files for symbol → URL mapping
- **Documentation Fetching**: Extracts relevant sections from official docs
- **Intelligent Caching**: Multi-layer cache with ETags and expiry

## Development

### Build

```bash
npm install
npm run compile
```

### Test

```bash
npm test
```

### Package

```bash
vsce package
```

## Privacy

- No telemetry by default
- Only fetches from https://docs.python.org/
- No data collection or external analytics

## Requirements

- VS Code ^1.80.0
- Python files in the workspace

## Known Limitations

- Currently supports only official Python documentation
- Requires internet connection for initial documentation fetching
- Third-party library support not yet implemented

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.
