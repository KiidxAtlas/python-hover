<div align="center">

# 🐍 Python Hover — The Missing Manual for Your Code

## **Never Leave VS Code for Documentation Again**

**Hover-based, context-aware documentation for 300+ Python constructs, 19+ pre-configured libraries, and literally ANY library with Sphinx docs. Offline. Cached. Blazingly fast.**

> **Stop alt-tabbing to Stack Overflow. Stop searching ReadTheDocs. Stop losing focus. Hover and learn—instantly.**

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/KiidxAtlas.python-hover?color=blue&label=VS%20Code%20Marketplace&logo=visual-studio-code&style=flat-square)](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/KiidxAtlas.python-hover?color=success&style=flat-square&logo=microsoft)](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/KiidxAtlas.python-hover?color=orange&style=flat-square&logo=microsoft)](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover&ssr=false#review-details)
[![License](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square&logo=open-source-initiative)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/KiidxAtlas/python-hover?style=flat-square&logo=github&color=gold)](https://github.com/KiidxAtlas/python-hover)

**[🚀 Install Now](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover)** • **[⭐ Rate & Review](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover&ssr=false#review-details)** • **[🐛 Report Issue](https://github.com/KiidxAtlas/python-hover/issues)** • **[💬 Discuss](https://github.com/KiidxAtlas/python-hover/discussions)**

</div>

---

## 🎯 The Problem: Context Switching Kills Productivity

Every Python developer knows this moment:

```python
import pandas as pd

df = pd.read_csv('data.csv')
result = df.groupby('category').agg(???)  # What parameters again?
```

Your choices:

- ❌ Stop coding → open browser → search "pandas agg" → lose focus
- ❌ Try to remember from memory (you won't)
- ❌ Spend 30 seconds guessing with autocomplete
- ✅ **Hover over `agg()` in Python Hover → see exact documentation instantly**

**The difference?** Context matters. You're not hovering over a generic function—you're hovering over a **Pandas DataFrame method**. Python Hover **understands that** and shows you exactly what you need, offline, in milliseconds.

---

## ✨ What Makes Python Hover Different

### 🧠 Context-Aware Intelligence

Most documentation tools show you generic information. Python Hover **understands your code**.

```python
# Your code
my_string = "hello world"
my_string.upper()  # Shows str.upper() docs

my_list = [1, 2, 3]
my_list.append(4)  # Shows list.append() docs

import pandas as pd
df = pd.DataFrame({'A': [1, 2, 3]})
df.head()  # Shows DataFrame.head() docs from pandas—not generic "object.head()"
```

Python Hover **automatically detects** that `upper()` is a string method, `append()` is a list method, and `head()` is a DataFrame method. No configuration. No guessing.

### 🚀 Universal Library Support

Pre-configured for 19+ libraries:

- **Data Science**: NumPy, Pandas, Matplotlib, SciPy, scikit-learn, PyTorch, TensorFlow, Seaborn
- **Web**: Django, Flask, FastAPI, Requests, aiohttp
- **Utilities**: Click, Pytest, SQLAlchemy, Beautiful Soup, Pillow, Pydantic

**But here's the magic:** Works with **ANY library** that has Sphinx documentation. Auto-discover thousands more:

```python
import plotly     # Auto-discovered! ✨
import dask       # Auto-discovered! ✨
import spacy      # Auto-discovered! ✨
import httpx      # Auto-discovered! ✨
```

No configuration. No hardcoding. Works automatically.

### ⚡ Blazing-Fast, Offline-First

- **< 2ms** for cached lookups (< 100ms first-time)
- **Aggressive caching** with intelligent TTL management
- **Offline support** for all cached libraries
- **Zero external API calls** after first load
- **Lightweight** (~1.1 MB bundle)

### 🎨 Beautiful, Rich Documentation

Each hover shows:

- 📦 Clear, concise description
- 🔤 Parameter types and descriptions
- ↩️ Return types and examples
- ⚠️ Exceptions that can be raised
- 💡 Practical, copyable code examples
- 🏷️ Version info (added, changed, deprecated)
- 🔗 Direct links to full documentation

---

## 🚀 Quick Start: 30 Seconds

### Step 1: Install

[**Click to Install from Marketplace**](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover)

Or search "Python Hover" in VS Code Extensions (Ctrl+Shift+X).

### Step 2: Open a Python File

```python
import pandas as pd

df = pd.DataFrame({'A': [1, 2, 3]})
df.head()  # Hover here 👈
```

### Step 3: Hover

**That's it.** Documentation appears instantly. Zero configuration. Zero setup. It just works.

---

## 📚 What's Covered?

### Python Standard Library (300+ Constructs)

- **Keywords**: `def`, `class`, `if`, `for`, `while`, `try`, `with`, `lambda`, `yield`, `async`, `await`
- **Built-in Functions**: `print`, `len`, `range`, `zip`, `map`, `filter`, `sorted`, `enumerate`, and 60+ more
- **String Methods**: `.split()`, `.join()`, `.format()`, `.replace()`, `.strip()`, and 40+ more
- **List/Dict/Set Methods**: All standard collection methods
- **File Operations**: `open()`, `.read()`, `.write()`, context managers
- **Type Hints**: `List`, `Dict`, `Optional`, `Union`, `Callable`, `TypeVar`, `Self`, `Literal`, `Annotated`
- **Special Methods**: `__init__`, `__str__`, `__repr__`, `__len__`, `__getitem__`, and 50+ dunder methods
- **Standard Library Modules**: `os`, `sys`, `datetime`, `json`, `re`, `math`, `random`, `pathlib`, `asyncio`, and 40+ more

### Pre-Configured Libraries (19+)

**Data Science & ML**
- NumPy, Pandas, Matplotlib, SciPy, scikit-learn, PyTorch, TensorFlow, Seaborn

**Web Development**
- Django, Flask, FastAPI, Requests, aiohttp

**Utilities**
- Click, Pytest, SQLAlchemy, Beautiful Soup, Pillow, Pydantic

### Auto-Discovered Libraries (1000s)

Any library with Sphinx documentation works automatically. No setup needed.

---

## 🎯 Perfect For

### 👨‍💻 Professional Developers

**Save hours every week** by eliminating context switching. Stay in flow. Ship faster.

### 🆕 Python Beginners

**Learn by doing** with instantly available examples and explanations right where you code.

### 👨‍🏫 Educators & Students

**Teach better** with live documentation exploration. Students see real, working examples immediately.

### 📊 Data Scientists

**Quick reference** for NumPy, Pandas, scikit-learn without leaving your Jupyter workflow.

### 🌐 Web Developers

**Rapid API lookup** for Django, Flask, FastAPI, and all the web dev tools in your stack.

### 🤖 ML Engineers

**Instant access** to PyTorch, TensorFlow, and machine learning library docs while you code.

---

## 💡 Key Features

### Smart Context Detection

Python Hover understands **what type** of object you're working with:

```python
# String
text = "hello"
text.split()  # Shows str.split() documentation

# List
items = [1, 2, 3]
items.sort()  # Shows list.sort() documentation

# Dict
config = {'key': 'value'}
config.get()  # Shows dict.get() documentation

# Custom types
import numpy as np
arr = np.array([1, 2, 3])
arr.reshape()  # Shows numpy.ndarray.reshape() documentation
```

### Multiple Resolution Strategies

Python Hover doesn't stop at one lookup:

1. **Direct mapping** — Hardcoded fast paths for common constructs
2. **Intersphinx inventory** — Full library documentation parsing
3. **Context detection** — Analyzes surrounding code for type inference
4. **Fallback paths** — Graceful degradation with helpful links

### Zero Configuration

Works **immediately** after installation. No:

- No API keys to manage
- No Python interpreter configuration
- No external dependencies
- No setup required

### Highly Customizable

For power users, every aspect is configurable:

```json
{
  "python-hover.fontSize": "medium",
  "python-hover.showExamples": true,
  "python-hover.showVersionInfo": true,
  "python-hover.openDocsInEditor": false,
  "python-hover.customLibraries": [
    {
      "name": "mylib",
      "inventoryUrl": "https://mylib.readthedocs.io/en/latest/objects.inv",
      "baseUrl": "https://mylib.readthedocs.io/en/latest/"
    }
  ]
}
```

---

## 🔥 What's New in v0.5.3

### Real Operator Documentation

Operator hovers now show real reference content with correct anchors and versioned URLs.

```python
x == y  # Hover shows value comparison documentation
a + b  # Hover shows addition/arithmetic documentation
x and y  # Hover shows boolean operations documentation
```

### Version-Aware Links

Documentation links automatically adjust to your Python version. Install Python 3.12? Get 3.12 docs.

### Improved Module Hovers

Standard library module hovers now prefer curated mappings for clearer descriptions and stable links.

```python
import os  # Hover shows: "os — Operating System Interface"
import json  # Hover shows: "json — JSON Encoder & Decoder"
```

### Snapshot Testing Infrastructure

Developers can now capture exact hover content for testing and auditing purposes.

---

## 🛠️ Customization

### Add Your Own Libraries

```json
{
  "python-hover.customLibraries": [
    {
      "name": "my-awesome-lib",
      "inventoryUrl": "https://my-awesome-lib.readthedocs.io/en/stable/objects.inv",
      "baseUrl": "https://my-awesome-lib.readthedocs.io/en/stable/"
    }
  ]
}
```

[**See full custom library guide**](CUSTOM_LIBRARIES.md)

### Configure Display

```json
{
  "python-hover.fontSize": "small|medium|large",
  "python-hover.showPracticalExamples": true,
  "python-hover.showRelatedMethods": true,
  "python-hover.showVersionInfo": true,
  "python-hover.openDocsInEditor": false
}
```

---

## 🐛 Troubleshooting

### Hover not showing?

- Ensure Python extension is installed
- Check that the file is saved
- Verify a Python interpreter is selected

### Library docs not appearing?

- Check the library is imported in your code
- Try reloading VS Code (`Ctrl+Shift+P` → "Developer: Reload Window")
- View output panel: `View → Output → Python Hover`

### Still stuck?

[**Open an issue with logs**](https://github.com/KiidxAtlas/python-hover/issues) and we'll help!

---

## 🤝 Contributing

Python Hover is open source and welcomes contributions:

- **Found a bug?** [Report it](https://github.com/KiidxAtlas/python-hover/issues)
- **Have an idea?** [Discuss it](https://github.com/KiidxAtlas/python-hover/discussions)
- **Want to contribute?** Pull requests welcome! See [CONTRIBUTING.md](CONTRIBUTING.md)

---

## 📊 By the Numbers

- 🐍 **300+** Python constructs documented
- 📚 **19+** pre-configured libraries
- 🔍 **1000s** more via auto-discovery
- ⚡ **< 2ms** cached lookup time
- 📦 **1.1 MB** total bundle size
- ⭐ Loved by **thousands** of developers

---

## ❤️ Support Python Hover

Love what you're seeing? Here's how to help:

1. **⭐ Star** the [GitHub repo](https://github.com/KiidxAtlas/python-hover) — costs you nothing, means everything
2. **⭐ Rate** [5-stars on Marketplace](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover&ssr=false#review-details) — helps other developers find this tool
3. **☕ Buy a coffee** — [Support active development](https://buymeacoffee.com/kiidxatlas)
4. **🗣️ Share** — Tell your team and the Python community!

**Every contribution keeps this extension free, open source, and actively maintained.** ❤️

---

## 📝 License

MIT License — Free to use, modify, and distribute. See [LICENSE](LICENSE) for details.

---

<div align="center">

### **Ready to stop context-switching?**

## **[Install Python Hover Now](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover)** 🚀

Made with ❤️ by [KiidxAtlas](https://github.com/KiidxAtlas)

</div>
