<div align="center">

# 🐍 Python Hover

### **Instant Documentation. Zero Context Switching.**

The missing manual for Python—right where you code.

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/KiidxAtlas.python-hover?color=blue&label=VS%20Marketplace&logo=visual-studio-code&style=for-the-badge)](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/KiidxAtlas.python-hover?color=success&style=for-the-badge&logo=microsoft)](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/KiidxAtlas.python-hover?color=orange&style=for-the-badge)](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover&ssr=false#review-details)

[**Install**](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover) · [**Report Bug**](https://github.com/KiidxAtlas/python-hover/issues) · [**Request Feature**](https://github.com/KiidxAtlas/python-hover/discussions)

<br />

If this helps you: [⭐ Star](https://github.com/KiidxAtlas/python-hover) · [☕ Buy me a coffee](https://buymeacoffee.com/kiidxatlas)

<br />

![Python Hover Demo](media/media.gif)

</div>

---

## Why Python Hover?

```python
result = df.groupby('category').agg(???)  # What parameters does agg() take?
```

**Your options:**

- ❌ Alt-tab to browser, search, lose focus
- ❌ Try to remember from memory
- ✅ **Hover → See docs instantly**

Python Hover understands context. It knows `agg()` is a DataFrame method—not a generic function—and shows you exactly what you need.

---

## ✨ What's New in v0.6

<table>
<tr>
<td width="50%">

---

## 🚀 Quick Start

1. **Install** from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover)
2. **Open** any Python file
3. **Hover** over any symbol

That's it. No configuration required.

---

## 📚 Coverage

<details>
<summary><b>300+ Python Constructs</b></summary>

| Category                     | Examples                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| **Keywords**           | `def`, `class`, `async`, `await`, `yield`, `lambda`, `match`, `case`   |
| **Operators**          | `==`, `is`, `in`, `not`, `and`, `or`, `//`, `**`, `@`                |
| **Built-ins**          | `print`, `len`, `range`, `zip`, `map`, `filter`, `sorted`, `enumerate` |
| **String Methods**     | `.split()`, `.join()`, `.format()`, `.replace()`, `.strip()`                 |
| **Collection Methods** | `.append()`, `.extend()`, `.get()`, `.keys()`, `.items()`                    |
| **Typing**             | `List`, `Dict`, `Optional`, `Union`, `Callable`, `TypeVar`, `Protocol`   |
| **Dunder Methods**     | `__init__`, `__str__`, `__repr__`, `__len__`, `__getitem__`                  |

</details>

<details>
<summary><b>19+ Pre-configured Libraries</b></summary>

**Data Science**

- NumPy, Pandas, Matplotlib, SciPy, scikit-learn, PyTorch, TensorFlow, Seaborn

**Web Development**

- Django, Flask, FastAPI, Requests, aiohttp

**Utilities**

- Click, Pytest, SQLAlchemy, BeautifulSoup, Pillow, Pydantic

</details>

<details>
<summary><b>Auto-Discovery for Any Library</b></summary>

Works with **any library** that has Sphinx documentation:

```python
import plotly     # ✓ Auto-discovered
import dask       # ✓ Auto-discovered
import httpx      # ✓ Auto-discovered
import polars     # ✓ Auto-discovered
```

**How it works:**

1. Detects your imports
2. Checks PyPI for docs URL
3. Fetches Sphinx inventory
4. Caches for offline use

</details>

---

## ⚙️ Configuration

Access via: **Settings → Extensions → Python Hover**

| Setting             | Default    | Description                                        |
| ------------------- | ---------- | -------------------------------------------------- |
| `enable`          | `true`   | Enable/disable the extension                       |
| `onlineDiscovery` | `true`   | Allow network requests for library docs            |
| `docsVersion`     | `"auto"` | Python version for docs (`"auto"` or `"3.11"`) |
| `showSignatures`  | `true`   | Display function signatures                        |
| `showExamples`    | `true`   | Show code examples                                 |
| `maxSnippetLines` | `12`     | Max lines in code snippets                         |

<details>
<summary><b>Custom Libraries</b></summary>

Add documentation for internal or private libraries:

```json
{
  "python-hover.customLibraries": [
    {
      "name": "mylib",
      "inventoryUrl": "https://mylib.company.com/docs/objects.inv",
      "baseUrl": "https://mylib.company.com/docs"
    }
  ]
}
```

</details>

<details>
<summary><b>Offline Mode</b></summary>

For air-gapped environments:

```json
{
  "python-hover.onlineDiscovery": false
}
```

You'll still get:

- All Python keywords and operators
- Typing construct explanations
- Previously cached library docs

</details>

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    VS Code Extension                     │
├─────────────────────────────────────────────────────────┤
│  HoverProvider                                           │
│  ├── LSP Client (Pylance integration)                   │
│  ├── Python Helper (runtime introspection)              │
│  └── Alias Resolver (pd → pandas)                       │
├─────────────────────────────────────────────────────────┤
│  Documentation Engine                                    │
│  ├── Static Resolver (keywords, operators, typing)      │
│  ├── Inventory Fetcher (Sphinx objects.inv)             │
│  ├── Sphinx Scraper (HTML → Markdown)                   │
│  └── Disk Cache (persistent, TTL-based)                 │
├─────────────────────────────────────────────────────────┤
│  Python Helper Scripts                                   │
│  ├── resolver.py (runtime symbol lookup)                │
│  ├── identifier.py (AST type detection)                 │
│  └── safe_import.py (timeout-protected imports)         │
└─────────────────────────────────────────────────────────┘
```

**Resolution Order:**

1. **Static Data** → Instant (operators, keywords, typing)
2. **Disk Cache** → Fast (previously fetched docs)
3. **Sphinx Inventory** → Best (precise symbol → URL mapping)
4. **PyPI Discovery** → Fallback (find docs for new libraries)
5. **DevDocs** → Last resort (search link)

---

## 🔧 Troubleshooting

<details>
<summary><b>Hover not appearing?</b></summary>

1. Ensure the Python extension is installed
2. Check if Python Hover is enabled in settings
3. Try reloading VS Code (`Ctrl+Shift+P` → "Reload Window")
4. Check Output panel: View → Output → "Python Hover"

</details>

<details>
<summary><b>Library docs not found?</b></summary>

1. Ensure the library is imported in your file
2. Check if the library has Sphinx documentation
3. Try: `Ctrl+Shift+P` → "Python Hover: Clear Cache"
4. If using a private library, configure `customLibraries`

</details>

<details>
<summary><b>Wrong Python version docs?</b></summary>

1. Ensure your Python interpreter is correctly selected
2. Check `python-hover.docsVersion` setting
3. Set to `"auto"` for automatic detection or specify manually

</details>

---

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

- 🐛 [Report a bug](https://github.com/KiidxAtlas/python-hover/issues)
- 💡 [Request a feature](https://github.com/KiidxAtlas/python-hover/discussions)
- 📖 [Improve docs](https://github.com/KiidxAtlas/python-hover/pulls)

---

## 📊 Stats

| Metric                      | Value               |
| --------------------------- | ------------------- |
| Python constructs           | **300+**      |
| Pre-configured libraries    | **19+**       |
| Auto-discoverable libraries | **Thousands** |
| Cached lookup time          | **< 5ms**     |
| Minimum VS Code             | **1.85.0**    |

---

<div align="center">

**Made with ❤️ by [KiidxAtlas](https://github.com/KiidxAtlas)**

MIT License

</div>
