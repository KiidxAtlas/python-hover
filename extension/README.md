<div align="center">

# 🐍 Python Hover

### Stop alt-tabbing. Instant Python documentation on hover — docstrings, signatures, type hints, and examples, never leaving VS Code.

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/KiidxAtlas.python-hover?color=blue&label=VS%20Marketplace&logo=visual-studio-code&style=for-the-badge)](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/KiidxAtlas.python-hover?color=success&style=for-the-badge&logo=microsoft)](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/KiidxAtlas.python-hover?color=orange&style=for-the-badge)](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover&ssr=false#review-details)

<br />

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/kiidxatlas)
[![GitHub Sponsors](https://img.shields.io/badge/GitHub%20Sponsors-EA4AAA?style=for-the-badge&logo=github-sponsors&logoColor=white)](https://github.com/sponsors/KiidxAtlas)

<br />

[**⬇️ Install Free**](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover) &nbsp;·&nbsp; [**⭐ Rate It**](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover&ssr=false#review-details) &nbsp;·&nbsp; [**🐛 Report Bug**](https://github.com/KiidxAtlas/python-hover/issues) &nbsp;·&nbsp; [**💡 Request Feature**](https://github.com/KiidxAtlas/python-hover/discussions)

<br />

<img src="https://raw.githubusercontent.com/KiidxAtlas/python-hover/main/extension/media/media.gif" alt="Python Hover Demo" width="760" />

</div>

---

## 🔥 The Problem Every Python Developer Has

You're in the zone. Deep in a pandas pipeline, a NumPy reshape, an asyncio task. You forget one parameter. You have two choices:

**Option A:** Break your flow. Open a browser. Search. Scroll. Find it. Come back. Lose your train of thought. Repeat 20× a day.

**Option B:** Just hover.

```python
df.groupby('category').agg(???)          # hover → full signature + examples
np.einsum('ij,jk->ik', A, B)            # hover → subscript syntax explained
async with asyncio.timeout(???)          # hover → parameters, raises, version added
response = requests.get(url, headers=?)  # hover → complete parameter table
```

Python Hover is **Option B**. Zero configuration. Instant. Accurate.

---

## ✨ What Makes It Different

Most hover extensions show you a one-liner from PyPI. **Python Hover fetches from the actual Sphinx documentation** — the same source as the official docs site — and combines it with live runtime introspection (docstrings, `__init__` signatures, `@dataclass` fields, `asyncio` coroutine parameters) for true Python IntelliSense on hover.

| | Generic hover | **Python Hover** |
|---|---|---|
| `np.array` | "Create an array" | Full signature, dtype param, order, subok, copy — with types |
| `df.merge` | "`DataFrame.merge`" | All 10+ params, how/on/left_on/right_on explained |
| `typing.Union` | "Support for type hints" ✗ | "Union type; `Union[X, Y]` is equivalent to `X \| Y`" ✓ |
| `for` keyword | Nothing or wrong page | Exact anchor on the language reference |
| Any keyword | Nothing | BNF syntax, description, PEP links |
| Private library | Nothing | Works if the package has Sphinx docs |

---

## 🚀 Zero to Hover in 10 Seconds

```
1. Install from the VS Code Marketplace
2. Open any .py file
3. Hover over any symbol
```

**No API keys. No Python packages to install. No configuration. Just works.**

---

## 📖 Everything You Can Hover

### 🔑 All 37+ Keywords & Operators — with exact doc anchors

No more landing on the wrong page. Every keyword links to its precise section:

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

### ⚡ All 70+ Built-in Functions

`print()`, `len()`, `zip()`, `enumerate()`, `sorted()`, `map()`, `filter()`, `isinstance()`, `getattr()`, `open()`, `range()`, `type()`, `vars()`, `dir()`, `repr()`, `next()`, `iter()`, and every other built-in — all with complete parameter docs.

### 🔤 Built-in Constants

`None`, `True`, `False`, `Ellipsis`, `...`, `__debug__`, `__name__` — each linked to its anchor on `library/constants.html`.

### 🏷️ Typing Module — the right description, not the backport summary

`Optional`, `Union`, `Literal`, `TypeVar`, `Protocol`, `overload`, `Final`, `TypedDict`, `ParamSpec`, `Concatenate`, `Never`, `Annotated`, `Generic` — all with the actual Python runtime docstring, not PyPI's generic "Support for type hints" blurb.

### 📦 Third-Party Libraries — auto-discovered

Works out of the box with popular libraries, and auto-discovers thousands more:

<table>
<tr>
<td><b>Data Science</b></td>
<td><b>Web Frameworks</b></td>
<td><b>HTTP & Network</b></td>
<td><b>Data & Typing</b></td>
</tr>
<tr>
<td>NumPy · Pandas<br/>Matplotlib · SciPy<br/>PyTorch · scikit-learn</td>
<td>Django · Flask<br/>FastAPI · Starlette<br/>Litestar</td>
<td>Requests · HTTPX<br/>aiohttp · httpcore</td>
<td>SQLAlchemy · Pydantic<br/>attrs · Redis<br/>lxml · BeautifulSoup</td>
</tr>
</table>

**Using something not on this list?** If the package publishes Sphinx docs, Python Hover discovers it automatically via PyPI — no configuration needed.

---

## 🧠 How It Works (The Smart Part)

Python Hover uses a **6-layer resolution pipeline** so you always get the best answer:

```
Hover triggered
      │
      ▼
  Static MAP ──────── <1ms · offline · keywords, operators, constants, typing
      │ miss
      ▼
  LSP (Pylance) ────── qualified name, kind, signature, source path
      │
      ▼
  AST identifier ───── literal type detection even in unsaved files
      │
      ▼
  Python runtime ────── subprocess introspection: docstring, module, isStdlib
      │
      ▼
  Sphinx inventory ──── objects.inv lookup → exact versioned docs URL
      │ miss
      ▼
  DevDocs (scoped) ──── #q=docset search, never cross-language
```

**Context-aware alias resolution:** writes `import numpy as np` and hovers `np.array`? Python Hover resolves it to `numpy.array` automatically before looking anything up.

**Concurrent deduplication:** if you move the cursor quickly over multiple symbols, Python Hover deduplicates all in-flight requests so the Python subprocess never gets overwhelmed.

**Multi-tier caching:** Sphinx inventories cached to disk (7 days). Hover results cached per session. Position results cached per document version. Cold start after the first hover is instant.

---

## ⚙️ Configuration

Works with zero config. Everything below is optional:

| Setting | Default | Description |
|---|---|---|
| `python-hover.enable` | `true` | Enable or disable the extension |
| `python-hover.runtimeHelper` | `true` | Use the persistent Python helper for runtime introspection and better symbol identity |
| `python-hover.onlineDiscovery` | `true` | Fetch Sphinx inventories and docs from the web |
| `python-hover.docScraping` | `false` | Fetch richer third-party documentation prose, examples, and see-also sections |
| `python-hover.docsVersion` | `"auto"` | Python docs version (`"auto"`, `"3.11"`, `"3.12"`, ...) |
| `python-hover.ui.showSignatures` | `true` | Show function signatures in hover |
| `python-hover.ui.showParameters` | `true` | Show the parameters table in hover |
| `python-hover.ui.maxParameters` | `6` | Maximum number of parameters shown before truncating the table |
| `python-hover.showPracticalExamples` | `true` | Show code examples in hover |
| `python-hover.ui.showSeeAlso` | `true` | Show related links and see-also references |
| `python-hover.requestTimeout` | `10000` | Network timeout in milliseconds |
| `python-hover.cacheTTL.inventoryDays` | `7` | Retention hint for inventory downloads; cached inventories persist until you clear the cache |
| `python-hover.hoverActivationDelay` | `75` | Extra delay before resolution starts on slower machines |
| `python-hover.ui.maxContentLength` | `800` | Max characters before "Read more…" truncation |

<details>
<summary><b>🏢 Custom / Private Libraries</b></summary>

Point Python Hover at any internal package with a Sphinx inventory:

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

Works with ReadTheDocs, GitHub Pages, self-hosted docs — anywhere that serves a standard `objects.inv` file.

</details>

<details>
<summary><b>✈️ Offline / Air-Gapped Mode</b></summary>

```json
{
  "python-hover.onlineDiscovery": false
}
```

In offline mode you still get:
- All Python keywords, operators, and control flow (instant, static, zero network)
- All built-in constants (`None`, `True`, `False`, `Ellipsis`, …)
- All `typing` module constructs
- All previously cached library documentation

</details>

---

## 🔧 Troubleshooting

<details>
<summary><b>Hover not appearing?</b></summary>

1. Make sure the Python extension (`ms-python.python`) is installed and active
2. Check the `python-hover.enable` setting is still `true`
3. Reload VS Code: `Ctrl+Shift+P` → "Reload Window"
4. Run `PyHover: Show Actions` and choose `Show PyHover Logs`

</details>

<details>
<summary><b>Library documentation not found?</b></summary>

1. Make sure the library is imported in the file you are hovering
2. Check the library has Sphinx docs (most popular packages do)
3. Confirm `python-hover.onlineDiscovery` is enabled
4. Run `PyHover: Show Actions` and choose `Clear Documentation Cache (Keep Python Corpus)` if you want to force a fresh fetch
5. For private packages, use the `customLibraries` setting

</details>

<details>
<summary><b>Hover shows the wrong type or method?</b></summary>

Python Hover uses Pylance + AST + runtime introspection in layers. For best accuracy:

1. Ensure Pylance is installed and type-checking is enabled
2. Add type annotations so Pylance can infer the correct type
3. File a bug with the symbol and a minimal snippet: [GitHub Issues](https://github.com/KiidxAtlas/python-hover/issues)

</details>

---

## 📊 By the Numbers

| | |
|---|---|
| **37+** Python keywords & operators with exact doc anchors |
| **70+** built-in functions with complete parameter docs |
| **20+** third-party libraries pre-configured |
| **Thousands** of libraries auto-discoverable via Sphinx |
| **< 1 ms** for keywords/operators (fully offline, static) |
| **< 5 ms** for cached library lookups (session cache hit) |
| **153 KB** total installed size |
| **0** configuration required to get started |

---

## 💬 What Developers Say

> *"Finally I don't have to leave VS Code to check pandas documentation."*

> *"The context-awareness is incredible. It knows exactly which method I'm looking at."*

> *"Hover over `elif` and get the right docs page. Details matter."*

> *"Saved me hours of alt-tabbing. Worth every star."*

---

## 🤝 Contributing & Support

Love Python Hover? Here is how to help:

- ⭐ **Star the repo** — helps other Python developers find it
- 📝 **Leave a review** — on the VS Code Marketplace
- 🐛 **Report a bug** — [open an issue](https://github.com/KiidxAtlas/python-hover/issues)
- 💡 **Suggest a feature** — [start a discussion](https://github.com/KiidxAtlas/python-hover/discussions)

[View Contributing Guide →](CONTRIBUTING.md)

---

<div align="center">

### ☕ Keep the Coffee Coming

Python Hover is free and open source. If it saves you time every day, a coffee keeps the bugs squashed and the features shipping:

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/kiidxatlas)
[![GitHub Sponsors](https://img.shields.io/badge/GitHub%20Sponsors-EA4AAA?style=for-the-badge&logo=github-sponsors&logoColor=white)](https://github.com/sponsors/KiidxAtlas)

<br />

**Made with ❤️ by [KiidxAtlas](https://github.com/KiidxAtlas)**

MIT License · [Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md)

<br />

[⬆️ Back to Top](#-python-hover)

</div>
