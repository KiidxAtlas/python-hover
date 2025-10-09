# Custom Library Documentation Configuration

## Overview

Python Hover allows you to add documentation for any Python library that uses Sphinx with Intersphinx inventory files (most modern Python libraries do!). This feature lets you extend the extension with documentation for your own libraries or third-party libraries not yet included.

## 🧪 Experimental: Auto-Detect Libraries

**New in v0.4.0!** Python Hover can automatically detect third-party libraries imported in your code and fetch their documentation. This feature is **enabled by default**.

### How Auto-Detection Works

When you import a third-party library, the extension:
1. Detects the import statement (e.g., `from jupyter_client import KernelManager`)
2. Checks if the library is installed in your Python environment
3. Automatically searches for and downloads the library's Intersphinx inventory
4. Provides hover documentation for all imported symbols

### Supported Libraries

Auto-detection works with any library that:
- Has Sphinx-generated documentation
- Publishes an `objects.inv` file (Intersphinx inventory)
- Is installed in your Python environment

Common examples: `jupyter_client`, `jupyter_core`, `black`, `mypy`, `httpx`, and thousands more!

### Configuration

```json
{
  "pythonHover.experimental.autoDetectLibraries": true  // Default: true
}
```

**When to disable:**
- You're working with many third-party imports and notice performance issues
- You only want to see documentation for specific libraries (use custom libraries instead)
- You're working offline

### Custom Libraries vs Auto-Detect

| Feature | Auto-Detect | Custom Libraries |
|---------|------------|------------------|
| Setup | Automatic | Manual configuration |
| Coverage | Any installed library with docs | Only configured libraries |
| Performance | May impact with many imports | Fast, pre-configured |
| Offline | Requires initial internet connection | Works offline after cache |
| Use Case | General development | Company libraries, specific versions |

**Pro tip:** Use both! Configure custom libraries for your internal/company libraries, and let auto-detect handle public libraries.

---

## How It Works

The extension uses **Intersphinx inventory files** (`objects.inv`) - a standardized format used by Sphinx documentation. When you hover over a symbol, the extension:

1. Detects which library the symbol belongs to
2. Fetches the library's `objects.inv` file (cached for 7 days)
3. Parses the inventory to find documentation URLs
4. Displays rich hover information with links to the actual documentation

## Configuration

Add custom libraries in your VS Code settings (`.vscode/settings.json` or User Settings):

```json
{
  "pythonHover.customLibraries": [
    {
      "name": "mylib",
      "inventoryUrl": "https://mylib.readthedocs.io/en/latest/objects.inv",
      "baseUrl": "https://mylib.readthedocs.io/en/latest/"
    }
  ]
}
```

### Configuration Fields

- **`name`** (required): The library name as it appears in Python imports
  - Example: `"requests"`, `"mycompany_utils"`, `"torch"`

- **`inventoryUrl`** (required): URL to the Intersphinx `objects.inv` file
  - Common patterns:
    - ReadTheDocs: `https://yourproject.readthedocs.io/en/latest/objects.inv`
    - GitHub Pages: `https://yourorg.github.io/yourproject/objects.inv`
    - Custom: `https://docs.yoursite.com/api/objects.inv`

- **`baseUrl`** (required): Base URL for documentation pages
  - Must end with `/`
  - Used to construct full URLs from inventory entries
  - Example: `"https://mylib.readthedocs.io/en/latest/"`

## Finding Intersphinx URLs

### For ReadTheDocs Projects

Most Python projects on ReadTheDocs follow this pattern:

```
https://yourproject.readthedocs.io/en/latest/objects.inv
https://yourproject.readthedocs.io/en/latest/
```

Or for specific versions:
```
https://yourproject.readthedocs.io/en/stable/objects.inv
https://yourproject.readthedocs.io/en/v2.0/objects.inv
```

### Testing if Intersphinx is Available

Try accessing the `objects.inv` URL in your browser:
- If it downloads a binary file → ✅ Correct URL
- If you get 404 → ❌ Wrong URL or Intersphinx not enabled

You can also use Python to inspect inventories:

```python
import urllib.request
import zlib

url = "https://yourproject.readthedocs.io/en/latest/objects.inv"
with urllib.request.urlopen(url) as response:
    data = response.read()
    # Skip header (first 4 lines)
    lines = data.split(b'\n', 4)
    # Decompress the rest
    decompressed = zlib.decompress(lines[4])
    print(decompressed.decode('utf-8'))
```

### For GitHub Pages

If your docs are hosted on GitHub Pages:

```json
{
  "name": "myproject",
  "inventoryUrl": "https://username.github.io/myproject/objects.inv",
  "baseUrl": "https://username.github.io/myproject/"
}
```

### For Self-Hosted Documentation

If you host your own Sphinx docs:

```json
{
  "name": "internal_lib",
  "inventoryUrl": "https://docs.mycompany.com/internal_lib/objects.inv",
  "baseUrl": "https://docs.mycompany.com/internal_lib/"
}
```

## Complete Example

Here's a real-world configuration with multiple custom libraries:

```json
{
  "pythonHover.customLibraries": [
    {
      "name": "mycompany_core",
      "inventoryUrl": "https://docs.mycompany.internal/core/objects.inv",
      "baseUrl": "https://docs.mycompany.internal/core/"
    },
    {
      "name": "experimental_ml",
      "inventoryUrl": "https://ml-team.github.io/experimental/objects.inv",
      "baseUrl": "https://ml-team.github.io/experimental/"
    },
    {
      "name": "custom_fastapi",
      "inventoryUrl": "https://my-custom-fork.readthedocs.io/en/stable/objects.inv",
      "baseUrl": "https://my-custom-fork.readthedocs.io/en/stable/"
    }
  ]
}
```

## Overriding Built-in Libraries

You can override the built-in library configurations. For example, to use a different version of NumPy docs:

```json
{
  "pythonHover.customLibraries": [
    {
      "name": "numpy",
      "inventoryUrl": "https://numpy.org/doc/1.24/objects.inv",
      "baseUrl": "https://numpy.org/doc/1.24/"
    }
  ]
}
```

## Workspace vs User Settings

### User Settings (Global)
Configure in: **Settings → Python Hover → Custom Libraries**
- Applies to all projects
- Good for: Company libraries, personal utilities

### Workspace Settings (Project-specific)
Add to `.vscode/settings.json` in your project:
- Only applies to this project
- Good for: Project-specific dependencies
- Committed to version control for team sharing

```json
// .vscode/settings.json
{
  "pythonHover.customLibraries": [
    {
      "name": "our_project_lib",
      "inventoryUrl": "https://docs.ourproject.com/objects.inv",
      "baseUrl": "https://docs.ourproject.com/"
    }
  ]
}
```

## Troubleshooting

### Library Not Working

1. **Check the inventory URL**
   - Try opening it in a browser - should download a file
   - Common mistake: Missing `/objects.inv` at the end

2. **Check the base URL**
   - Must end with `/`
   - Should be the URL prefix for all documentation pages

3. **Check the library name**
   - Must match the import name in Python
   - Case-sensitive
   - Example: Use `"PIL"` not `"pillow"` if you import as `from PIL import Image`

4. **Enable debug logging**
   ```json
   {
     "pythonHover.enableDebugLogging": true
   }
   ```
   Then check **Output → Python Hover** for diagnostic messages

5. **Clear cache**
   - Command Palette → "Python Hover: Clear Documentation Cache"
   - Extension will re-fetch all inventories

### No Documentation Appearing

1. Ensure the library is imported in your Python file
2. Wait a moment after hovering - first fetch can take a few seconds
3. Check that Intersphinx is enabled in the library's Sphinx configuration
4. Verify the library name matches your Python import

## Performance Notes

- **First hover**: 1-5 seconds (downloads and caches inventory)
- **Subsequent hovers**: <100ms (uses cache)
- **Cache duration**: 7 days for third-party libraries
- **Cache size**: Typically 10-100KB per library inventory

## Enabling Intersphinx in Your Own Projects

If you maintain a Sphinx-documented Python library, ensure Intersphinx is enabled:

```python
# conf.py
extensions = [
    'sphinx.ext.intersphinx',
    # ... other extensions
]

# Enable inventory generation (on by default)
html_use_opensearch = True
```

Build your docs and verify `objects.inv` exists in the output directory.

## Advanced: Multiple Versions

You can configure different versions for different projects:

```json
// Project A - uses old version
{
  "pythonHover.customLibraries": [
    {
      "name": "mylib",
      "inventoryUrl": "https://mylib.readthedocs.io/en/v1.0/objects.inv",
      "baseUrl": "https://mylib.readthedocs.io/en/v1.0/"
    }
  ]
}

// Project B - uses new version
{
  "pythonHover.customLibraries": [
    {
      "name": "mylib",
      "inventoryUrl": "https://mylib.readthedocs.io/en/v2.0/objects.inv",
      "baseUrl": "https://mylib.readthedocs.io/en/v2.0/"
    }
  ]
}
```

## Support

For issues with custom library configuration:

1. Verify the library uses Sphinx with Intersphinx
2. Test the `objects.inv` URL directly
3. Enable debug logging
4. File an issue on GitHub with:
   - Library name and docs URL
   - Your configuration
   - Debug logs from Output panel

## Built-in Libraries

The extension already includes these libraries (no configuration needed):

- numpy, pandas, scipy, matplotlib
- requests, beautifulsoup4, selenium
- flask, django, fastapi
- pytorch, scikit-learn
- sqlalchemy, pydantic
- pytest, sphinx
- aiohttp, click, pillow

You can override any of these if you need a different version or custom fork.
