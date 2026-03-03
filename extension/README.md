<div align="center">

# 🐍 Python Hover

### **Instant Python Documentation. Inside VS Code. Zero Context Switching.**

The only Python documentation extension that gets the details right — correct anchors for every keyword, scoped DevDocs links, and smart library context detection.

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/KiidxAtlas.python-hover?color=blue&label=VS%20Marketplace&logo=visual-studio-code&style=for-the-badge)](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/KiidxAtlas.python-hover?color=success&style=for-the-badge&logo=microsoft)](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/KiidxAtlas.python-hover?color=orange&style=for-the-badge)](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover&ssr=false#review-details)

<br />

[**⬇️ Install Now**](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover) &nbsp;·&nbsp; [**⭐ Rate It**](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover&ssr=false#review-details) &nbsp;·&nbsp; [**🐛 Report Bug**](https://github.com/KiidxAtlas/python-hover/issues) &nbsp;·&nbsp; [**💡 Request Feature**](https://github.com/KiidxAtlas/python-hover/discussions)

<br />

<img src="https://raw.githubusercontent.com/KiidxAtlas/python-hover/main/extension/media/media.gif" alt="Python Hover Demo" width="760" />

<br />

</div>

---

## 💡 The Problem

```python
result = df.groupby('category').agg(???)   # What does agg() take again?
x = np.einsum('ij,jk->ik', A, B)          # What is the subscript syntax?
with contextlib.suppress(???)              # What exceptions can I pass?
```

You are in the zone and you need to check docs. Every alt-tab costs you 2-5 minutes of focus.

| Without Python Hover | With Python Hover |
|---|---|
| 🔀 Alt-tab to browser | ✨ Just hover |
| 🔍 Search "pandas DataFrame.agg parameters" | 📖 See the full signature instantly |
| 📄 Scan through Stack Overflow answers | 🎯 Context-aware: knows it's `DataFrame.agg`, not generic `agg` |
| ⏱️ **2-5 minutes lost every time** | ⚡ **2 seconds, never leave the editor** |

---

## ⚡ Features

<table>
<tr>
<td align="center" width="33%">
<h3>🎯 Context-Aware</h3>
Knows <code>df.merge()</code> is <code>pandas.DataFrame.merge</code>. Resolves import aliases automatically (<code>pd</code> → <code>pandas</code>).
</td>
<td align="center" width="33%">
<h3>📚 Rich Documentation</h3>
Full signatures, parameters with types, return types, exceptions, and code examples — all in the hover panel.
</td>
<td align="center" width="33%">
<h3>🌐 Auto-Discovery</h3>
Works with <b>any</b> library that publishes Sphinx docs. Fetches and caches <code>objects.inv</code> automatically.
</td>
</tr>
<tr>
<td align="center">
<h3>🔑 Every Keyword & Operator</h3>
Hover <code>elif</code>, <code>not</code>, <code>match</code>, <code>yield</code>, <code>lambda</code> — each links to the <b>exact section</b> of the Python language reference.
</td>
<td align="center">
<h3>🔗 Scoped DevDocs Links</h3>
DevDocs button scoped to a single doc set. No more landing on Haxe or C++ docs when searching a Python symbol.
</td>
<td align="center">
<h3>📴 Offline Ready</h3>
Inventories cached to disk. All keywords, operators, typing constructs, and built-in constants work with no network.
</td>
</tr>
</table>

---

## 🚀 Get Started in 10 Seconds

```
1. Install from VS Code Marketplace
2. Open any .py file
3. Hover over any symbol
```

**No configuration. No API keys. No Python packages to install. Just works.**

---

## 📖 What You Can Hover

### Keywords & Control Flow

Every Python keyword links to its precise `docs.python.org` reference section — not just the page top:

| Keyword | Correct anchor |
|---|---|
| `if` / `elif` / `else` | `compound_stmts.html#the-if-statement` |
| `for` / `while` | `compound_stmts.html#the-for-statement` |
| `try` / `except` / `finally` | `compound_stmts.html#the-try-statement` |
| `with` | `compound_stmts.html#the-with-statement` |
| `match` / `case` | `compound_stmts.html#the-match-statement` |
| `async` / `await` | `compound_stmts.html#coroutine-function-definition` |
| `yield` | `simple_stmts.html#the-yield-statement` |
| `lambda` | `expressions.html#lambda` |
| `not` / `and` / `or` | `expressions.html#boolean-operations` |
| `in` / `not in` | `expressions.html#membership-test-operations` |
| `is` / `is not` | `expressions.html#identity-comparisons` |

### Built-in Constants

`None`, `True`, `False`, `Ellipsis`, `...`, `__debug__`, `__name__` — each links to its anchor on `library/constants.html`.

### Built-in Functions

All 70+ built-ins: `print()`, `len()`, `zip()`, `enumerate()`, `sorted()`, `map()`, `filter()`, `isinstance()`, `getattr()`, `hasattr()`, `setattr()`, `open()`, `range()`, `type()`, and more.

### Third-Party Libraries

Works with **pre-configured libraries** and **auto-discovers thousands more** via Sphinx inventories:

| Data Science | Web Frameworks | HTTP & Async | Data & Typing |
|---|---|---|---|
| NumPy | Django | Requests | SQLAlchemy |
| Pandas | Flask | HTTPX | Pydantic |
| Matplotlib | FastAPI | aiohttp | attrs |
| PyTorch | | | Redis |
| scikit-learn | | | lxml |
| SciPy | | | BeautifulSoup |

**Using something not listed?** If the package has Sphinx docs, Python Hover discovers it automatically via PyPI.

### Typing Module

`Optional`, `Union`, `Literal`, `TypeVar`, `Protocol`, `overload`, `Final`, `TypedDict`, `ParamSpec`, `Concatenate`, `Never`, `Annotated` — all with rich context.

---

## ✨ What's New in v0.6.7

- 🔑 **Keyword anchor precision** — `elif`, `not`, `match`, `for` etc. now each link to their exact language reference section (never just the page top again)
- 🔗 **Scoped DevDocs links** — Rewrote URL generation using `#q=docset term` format, locking search to one doc set and eliminating cross-language bleed-through
- 🔘 **DevDocs button always visible** — Fixed a silent bug where `devdocsUrl` was dropped by the hover builder
- 📦 **Expanded package map** — numpy, pandas, flask, django, fastapi, tensorflow, pytorch, sqlalchemy, requests, pydantic, aiohttp, lxml, beautifulsoup4 all get scoped DevDocs links
- 📋 **Copy Signature** — One-click copy of any function/method signature to clipboard

---

## ⚙️ Configuration

Works out of the box. Customize only what you need:

| Setting | Default | Description |
|---|---|---|
| `python-hover.enable` | `true` | Enable or disable the extension |
| `python-hover.onlineDiscovery` | `true` | Fetch Sphinx inventories and docs from the web |
| `python-hover.docsVersion` | `"auto"` | Python docs version (`"auto"`, `"3.11"`, `"3.12"`, ...) |
| `python-hover.showSignatures` | `true` | Show function signatures in hover |
| `python-hover.showExamples` | `true` | Show code examples in hover |
| `python-hover.requestTimeout` | `5000` | Network timeout in milliseconds |
| `python-hover.inventoryCacheDays` | `7` | Days to keep Sphinx inventories cached on disk |

<details>
<summary><b>🏢 Custom Libraries (Enterprise / Private Packages)</b></summary>

Add hover documentation for internal packages by pointing to their Sphinx inventory:

```json
{
  "python-hover.customLibraries": [
    {
      "name": "my-internal-lib",
      "inventoryUrl": "https://docs.internal.company.com/objects.inv",
      "baseUrl": "https://docs.internal.company.com"
    }
  ]
}
```

</details>

<details>
<summary><b>✈️ Offline Mode</b></summary>

For air-gapped environments or working without internet:

```json
{
  "python-hover.onlineDiscovery": false
}
```

Offline you still get:
- All Python keywords, operators, and control flow statements with correct anchor links
- All built-in constants (`None`, `True`, `False`, `Ellipsis`, ...)
- All `typing` module constructs
- All previously cached library documentation

</details>

---

## 🔧 Troubleshooting

<details>
<summary><b>Hover not appearing?</b></summary>

1. Make sure the Python extension (`ms-python.python`) is installed and active
2. Check Python Hover is enabled: `Ctrl+Shift+P` → "Python Hover: Enable"
3. Reload VS Code: `Ctrl+Shift+P` → "Reload Window"
4. Check the output log: View → Output → "Python Hover"

</details>

<details>
<summary><b>Library documentation not found?</b></summary>

1. Make sure the library is imported in the file you are hovering
2. Check that the library has Sphinx documentation (most popular packages do)
3. Clear the cache and retry: `Ctrl+Shift+P` → "Python Hover: Clear Cache"
4. For private/internal packages, use the `customLibraries` setting

</details>

<details>
<summary><b>Hover shows the wrong method or type?</b></summary>

Python Hover uses Pylance (LSP) + AST + runtime introspection in layers. For best results:

1. Ensure Pylance is installed and type-checking is enabled
2. Add type annotations so Pylance and Python Hover can infer the correct type
3. File a bug with the symbol and a minimal snippet: [GitHub Issues](https://github.com/KiidxAtlas/python-hover/issues)

</details>

---

## 🏗️ How It Works

Python Hover uses a **multi-layer resolution pipeline** to give you the most accurate hover possible:

```
Hover triggered
      │
      ▼
  Static MAP ──── Instant, offline: keywords, operators, constants, typing
      │ (miss)
      ▼
  LSP (Pylance) ── Qualified name, kind, signature, source path
      │
      ▼
  AST identifier ── Literal type detection even in unsaved files
      │
      ▼
  Runtime introspect ── Python subprocess: docstring, module, isStdlib
      │
      ▼
  Sphinx inventory ── objects.inv lookup → exact versioned docs URL
      │ (miss)
      ▼
  PyPI metadata ── Discover docs URL from package metadata
      │ (miss)
      ▼
  DevDocs (scoped) ── Last resort: #q=docset search, never cross-language
```

---

## 📊 By the Numbers

| | |
|---|---|
| **37** Python keywords & operators with exact doc anchors |
| **70+** built-in functions documented |
| **20+** third-party libraries pre-configured |
| **Thousands** of libraries auto-discoverable via Sphinx |
| **< 1ms** for keywords/operators (static, fully offline) |
| **< 5ms** for cached library lookups |
| **0** configuration required to get started |

---

## 💬 What Developers Say

> *"Finally, I do not have to leave VS Code to check pandas documentation."*

> *"The context-awareness is incredible. It knows exactly which method I am looking at."*

> *"Hover over `elif` and actually get the right docs page. The details matter."*

> *"Saved me hours of alt-tabbing. Worth every star."*

---

## 🤝 Contributing

Love Python Hover? Here is how to help:

- ⭐ **Star the repo** — Helps other Python developers discover the extension
- 📝 **Leave a review** — Share your experience on the VS Code Marketplace
- 🐛 **Report bugs** — Open an issue on GitHub
- 💡 **Suggest features** — Start a GitHub Discussion

[View Contributing Guide →](CONTRIBUTING.md)

---

<div align="center">

### ☕ Support Development

If Python Hover saves you time every day, consider supporting its development:

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/kiidxatlas)
[![GitHub Sponsors](https://img.shields.io/badge/GitHub%20Sponsors-EA4AAA?style=for-the-badge&logo=github-sponsors&logoColor=white)](https://github.com/sponsors/KiidxAtlas)

<br />

**Made with ❤️ by [KiidxAtlas](https://github.com/KiidxAtlas)**

MIT License · [Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md)

<br />

[⬆️ Back to Top](#-python-hover)

</div>
