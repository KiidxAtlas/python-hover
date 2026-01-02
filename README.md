<div align="center">

# 🐍 Python Hover

### **Instant Documentation. Zero Context Switching.**

Stop alt-tabbing. Start shipping.

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/KiidxAtlas.python-hover?color=blue&label=VS%20Marketplace&logo=visual-studio-code&style=for-the-badge)](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover)
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
result = df.groupby('category').agg(???)  # What parameters does agg() take again?
```

**Sound familiar?** You're in the zone, writing code, and suddenly—you need to check documentation.

| Without Python Hover | With Python Hover |
|---------------------|-------------------|
| 🔀 Alt-tab to browser | ✨ Just hover |
| 🔍 Search "pandas agg parameters" | 📖 See docs instantly |
| 📄 Scan through results | 🎯 Context-aware: knows it's DataFrame.agg |
| 🧠 Try to remember context | 💾 Stay in flow |
| ⏱️ **2-5 minutes lost** | ⚡ **2 seconds** |

**Python Hover brings the documentation to you.**

---

## ⚡ Features at a Glance

<table>
<tr>
<td align="center" width="33%">
<h3>🎯 Context-Aware</h3>
Knows <code>df.merge()</code> is pandas, not a generic function
</td>
<td align="center" width="33%">
<h3>📚 Rich Documentation</h3>
Signatures, parameters, examples, return types—all in hover
</td>
<td align="center" width="33%">
<h3>🌐 Auto-Discovery</h3>
Works with <b>any</b> library that has Sphinx docs
</td>
</tr>
<tr>
<td align="center">
<h3>⚡ Blazing Fast</h3>
< 5ms cached lookups, intelligent prefetching
</td>
<td align="center">
<h3>📴 Offline Ready</h3>
Cache docs for flights, commutes, or air-gapped envs
</td>
<td align="center">
<h3>🔧 Zero Config</h3>
Install → Open Python file → Hover. That's it.
</td>
</tr>
</table>

---

## 🚀 Get Started in 10 Seconds

```
1. Install from VS Code Marketplace
2. Open any Python file
3. Hover over any symbol
```

**No configuration. No API keys. Just works.**

---

## 📖 What You Get

### Keywords & Syntax
Hover over `async`, `yield`, `match`, `lambda`, `with`—get instant explanations with syntax and examples.

### Built-in Functions
`print()`, `len()`, `zip()`, `enumerate()`, `sorted()`—all 70+ built-ins documented.

### Your Libraries
Works automatically with **19+ pre-configured libraries** and **auto-discovers thousands more**:

| Data Science | Web | Utilities |
|-------------|-----|-----------|
| NumPy | Django | Click |
| Pandas | Flask | Pytest |
| Matplotlib | FastAPI | SQLAlchemy |
| PyTorch | Requests | Pydantic |
| scikit-learn | aiohttp | BeautifulSoup |

**Using something else?** If it has Sphinx docs, Python Hover finds it automatically.

---

## ✨ What's New in v0.6

- 🎨 **Beautiful new hover UI** — Clean visual hierarchy with icons
- 🔗 **One-click links** — Jump to full docs, DevDocs, or copy URL
- 📝 **Better examples** — Syntax-highlighted code snippets
- 🐍 **Keyword documentation** — Rich docs for all Python keywords
- ⚡ **Faster resolution** — Improved caching and prefetching
- 🔧 **VS Code Remote support** — Works seamlessly in remote environments

---

## ⚙️ Configuration

Works out of the box, but here's what you can customize:

| Setting | Default | Description |
|---------|---------|-------------|
| `onlineDiscovery` | `true` | Fetch docs from the web |
| `docsVersion` | `"auto"` | Python version for docs |
| `showSignatures` | `true` | Show function signatures |
| `showExamples` | `true` | Include code examples |

<details>
<summary><b>🏢 Custom Libraries (Enterprise)</b></summary>

Add documentation for internal or private libraries:

```json
{
  "python-hover.customLibraries": [
    {
      "name": "internal-lib",
      "inventoryUrl": "https://docs.company.com/objects.inv",
      "baseUrl": "https://docs.company.com"
    }
  ]
}
```

</details>

<details>
<summary><b>✈️ Offline Mode</b></summary>

For air-gapped environments or when traveling:

```json
{
  "python-hover.onlineDiscovery": false
}
```

You'll still have access to:
- All Python keywords and operators
- Typing construct explanations
- All previously cached library docs

</details>

---

## 🔧 Troubleshooting

<details>
<summary><b>Hover not appearing?</b></summary>

1. Ensure Python extension is installed
2. Check Python Hover is enabled in settings
3. Reload VS Code: `Ctrl+Shift+P` → "Reload Window"
4. Check logs: View → Output → "Python Hover"

</details>

<details>
<summary><b>Library docs not found?</b></summary>

1. Make sure the library is imported in your file
2. Check if the library has Sphinx documentation
3. Clear cache: `Ctrl+Shift+P` → "Python Hover: Clear Cache"

</details>

---

## 📊 By the Numbers

| | |
|-|-|
| **300+** Python constructs documented |
| **19+** libraries pre-configured |
| **Thousands** of libraries auto-discoverable |
| **< 5ms** cached lookup time |
| **0** configuration required |

---

## 💬 What Developers Say

> *"Finally, I don't have to leave VS Code to check pandas documentation."*

> *"The context-awareness is incredible. It knows exactly which method I'm looking at."*

> *"Saved me hours of alt-tabbing. Worth every star."*

---

## 🤝 Contributing

Love Python Hover? Here's how to help:

- ⭐ **Star the repo** — Helps others discover us
- 📝 **Leave a review** — Share your experience on the Marketplace
- 🐛 **Report bugs** — Help us improve
- 💡 **Suggest features** — We're listening

[View Contributing Guide →](CONTRIBUTING.md)

---

<div align="center">

### ☕ Support Development

If Python Hover saves you time, consider supporting its development:

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/kiidxatlas)
[![GitHub Sponsors](https://img.shields.io/badge/GitHub%20Sponsors-EA4AAA?style=for-the-badge&logo=github-sponsors&logoColor=white)](https://github.com/sponsors/KiidxAtlas)

<br />

**Made with ❤️ by [KiidxAtlas](https://github.com/KiidxAtlas)**

MIT License

<br />

[⬆️ Back to Top](#-python-hover)

</div>
