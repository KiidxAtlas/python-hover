<div align="center">

# 🐍 Python Hover

## **Enhanced Documentation for Modern Python Development**

**Instant, intelligent documentation for 300+ Python constructs and ANY library with Sphinx docs — right in your editor. No more context switching.**

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/KiidxAtlas.python-hover?color=blue&label=VS%20Code%20Marketplace&logo=visual-studio-code&style=flat-square)](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/KiidxAtlas.python-hover?color=success&style=flat-square&logo=microsoft)](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/KiidxAtlas.python-hover?color=orange&style=flat-square&logo=microsoft)](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover&ssr=false#review-details)
[![License](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square&logo=open-source-initiative)](LICENSE)
[![GitHub](https://img.shields.io/github/stars/KiidxAtlas/python-hover?style=flat-square&logo=github)](https://github.com/KiidxAtlas/python-hover)

**[📦 Install Now](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover)** • **[⭐ Rate & Review](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover&ssr=false#review-details)** • **[🐛 Report Issue](https://github.com/KiidxAtlas/python-hover/issues)** • **[📖 Documentation](https://github.com/KiidxAtlas/python-hover)**

</div>

---

<div align="center">

## ⚡ **Save Hours Every Week**

If this extension boosts your productivity, consider supporting its development!

[![Buy Me A Coffee](https://img.shields.io/badge/☕_Buy_Me_A_Coffee-Support_Development-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/kiidxatlas)

**Every contribution helps maintain this free tool and add powerful new features!** 🚀

---

## 💛 **Love Python Hover?**

⭐ **[Leave a 5-star review](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover&ssr=false#review-details)** — Takes 30 seconds, helps thousands of developers discover this tool!

</div>

---

![Python Hover Demo](media/media.gif)

## ✨ **What Makes Python Hover Special**

### 🎯 **Universal Python Support**

- **300+ Built-in Constructs** — Complete coverage of Python's standard library
- **19+ Pre-Configured Libraries** — NumPy, Pandas, FastAPI, Django, PyTorch, Flask, Matplotlib, and more
- **🚀 Auto-Discovery for ANY Library** — Works with scikit-learn, TensorFlow, requests, beautifulsoup4, and thousands more!
- **Smart Context Detection** — Automatically determines if you're working with strings, lists, dicts, DataFrames, or custom objects
- **Dynamic Type Resolution** — Intelligently identifies which library a class belongs to without hardcoding

### 💡 **Instant Access to Information**

- **Practical, Copyable Examples** — Real code you can use immediately
- **Rich Sphinx Documentation** — Beautiful formatting with parameters, return types, and examples
- **Offline Support** — Aggressive caching for blazing-fast offline access
- **Zero Configuration** — Works instantly after installation

### 🎨 **Beautiful & Customizable**

- **Clean, Modern Interface** — Easy to read, aesthetically pleasing
- **Fully Themeable** — Customize colors, fonts, and styles to match your setup
- **Version-Aware** — Shows the exact documentation for your installed library versions

---

## � **Quick Start**

### Installation

1. **Install from Marketplace**
   Open VS Code → Extensions (Ctrl+Shift+X) → Search "Python Hover" → Install

   Or [**click here to install**](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover)

2. **Open any Python file**

3. **Hover over any code** — That's it! 🎉

**No configuration, no setup, no hassle. It just works.**

---

## 📚 **Coverage**

### Built-in Python

<details>
<summary><b>300+ Language Constructs & Standard Library</b></summary>

- **Keywords**: `def`, `class`, `if`, `for`, `while`, `try`, `with`, `lambda`, `yield`, `async`, `await`, and all others
- **Built-in Functions**: `print`, `len`, `range`, `zip`, `map`, `filter`, `sorted`, `enumerate`, and 60+ more
- **String Methods**: `.split()`, `.join()`, `.format()`, `.replace()`, `.strip()`, and 40+ more
- **List Methods**: `.append()`, `.extend()`, `.sort()`, `.pop()`, `.remove()`, and all others
- **Dict Methods**: `.get()`, `.keys()`, `.values()`, `.items()`, `.pop()`, and more
- **Set Operations**: `.add()`, `.union()`, `.intersection()`, `.difference()`, and all set methods
- **File Operations**: `open()`, `.read()`, `.write()`, `.readline()`, context managers
- **Type Hints**: `List`, `Dict`, `Optional`, `Union`, `Tuple`, `Callable`, `TypeVar`, and all typing constructs
- **Special Methods**: `__init__`, `__str__`, `__repr__`, `__len__`, `__getitem__`, and 50+ dunder methods
- **Standard Library Modules**: `os`, `sys`, `datetime`, `json`, `re`, `math`, `random`, and more

</details>

### Pre-Configured Libraries

<details>
<summary><b>19+ Popular Third-Party Libraries</b></summary>

#### Data Science & ML
- **NumPy** — Array operations, linear algebra, mathematical functions
- **Pandas** — DataFrames, Series, data manipulation and analysis
- **Matplotlib** — Plotting and visualization
- **SciPy** — Scientific computing and optimization
- **scikit-learn** — Machine learning algorithms (auto-discovered)
- **PyTorch** — Deep learning framework
- **TensorFlow** — Machine learning platform (auto-discovered)
- **Seaborn** — Statistical data visualization (auto-discovered)

#### Web Development
- **Django** — Full-featured web framework
- **Flask** — Lightweight web framework
- **FastAPI** — Modern, fast API framework
- **Requests** — HTTP library for humans
- **aiohttp** — Async HTTP client/server (auto-discovered)

#### Utilities
- **Click** — Command-line interface creation
- **Pytest** — Testing framework
- **SQLAlchemy** — SQL toolkit and ORM
- **Beautiful Soup** — Web scraping library (auto-discovered)
- **Pillow** — Image processing library
- **Pydantic** — Data validation using type hints

**+ Thousands more through auto-discovery!**

</details>

### 🔍 **Auto-Discovery Magic**

Python Hover automatically discovers documentation for **ANY** library with Sphinx/ReadTheDocs documentation:

```python
import plotly  # Auto-discovered!
import dask    # Auto-discovered!
import spacy   # Auto-discovered!
import httpx   # Auto-discovered!

# Hover over any of their methods — instant documentation!
```

**How it works:**
1. Detects your imports automatically
2. Checks PyPI for documentation URLs
3. Fetches Sphinx inventory files
4. Caches everything for offline use
5. Shows rich documentation on hover

No configuration needed — it's **completely automatic**! 🪄

---

## 🎯 **Key Features**

### 🧠 **Smart Context Detection**

Python Hover understands your code context:

```python
import pandas as pd

df = pd.DataFrame({'A': [1, 2, 3]})
df.head()  # Shows DataFrame.head() documentation, NOT generic object

result = "hello world"
result.upper()  # Shows str.upper() documentation

my_list = [1, 2, 3]
my_list.append(4)  # Shows list.append() documentation
```

**Before v0.5.1**: Might show "object.head()"
**Now**: Correctly shows "DataFrame.head()" with full pandas documentation! ✨

### 🎨 **Rich Documentation Display**

- **📦 Summary boxes** with clear descriptions
- **📝 Parameter details** with type annotations
- **↩️ Return types** clearly highlighted
- **⚠️ Exceptions** that might be raised
- **📊 Examples** with expected outputs
- **🏷️ Version info** (added/changed/deprecated)
- **🔗 Links** to full documentation

### ⚡ **Performance**

- **< 10ms** for cached lookups
- **< 100ms** for first-time fetches
- **Offline-first** architecture
- **Intelligent caching** (24 hours for libraries)
- **Early exit optimization** in dynamic resolution

### 🛠️ **Developer Experience**

- **Zero configuration** — works immediately
- **No API keys** required
- **No external dependencies** — everything bundled
- **Works offline** after initial cache
- **Lightweight** — minimal impact on VS Code performance
- **Highly customizable** — extensive settings for power users

---

## 🎨 **Customization**

### Settings

Access settings via: `Preferences > Settings > Extensions > Python Hover`

```json
{
  // Display settings
  "python-hover.fontSize": 14,
  "python-hover.fontFamily": "Consolas, 'Courier New', monospace",
  "python-hover.maxSnippetLines": 20,

  // Feature toggles
  "python-hover.enableExamples": true,
  "python-hover.enableVersionInfo": true,
  "python-hover.enableLinks": true,

  // Library configuration
  "python-hover.customLibraries": {
    "mylib": {
      "inventoryUrl": "https://mylib.readthedocs.io/en/latest/objects.inv",
      "docBaseUrl": "https://mylib.readthedocs.io/en/latest"
    }
  }
}
```

### Custom Libraries

Add your own libraries with Sphinx documentation:

1. Find your library's `objects.inv` URL (usually on ReadTheDocs)
2. Add to settings:

```json
{
  "python-hover.customLibraries": {
    "your-library": {
      "inventoryUrl": "https://your-library.readthedocs.io/en/stable/objects.inv",
      "docBaseUrl": "https://your-library.readthedocs.io/en/stable"
    }
  }
}
```

3. **Done!** Hover over your library's code to see documentation.

📖 **[Full custom library guide](CUSTOM_LIBRARIES.md)**

---

## 💼 **Perfect For**

### 🆕 **Python Beginners**
Learn by example with comprehensive, easy-to-understand documentation right where you code.

### 👨‍💻 **Professional Developers**
Save time by eliminating constant tab-switching to documentation websites.

### 👨‍🏫 **Educators & Students**
Teach and learn Python with instant access to documentation and examples.

### 🔬 **Data Scientists**
Quick reference for NumPy, Pandas, scikit-learn, and other data science libraries.

### 🌐 **Web Developers**
Instant docs for Django, Flask, FastAPI, and all web development tools.

### 🤖 **ML Engineers**
Rapid access to PyTorch, TensorFlow, and machine learning library documentation.

---

## 🔥 **What's New in v0.5.1**

### � **Dynamic Library Resolution**
- **Works with ANY library automatically** — no more hardcoded mappings!
- Intelligently determines which library a class belongs to
- Scales infinitely with your project's dependencies
- Handles pandas, numpy, sklearn, tensorflow, and custom libraries seamlessly

### �️ **Robust Error Handling**
- Gracefully handles libraries with missing or invalid documentation
- No more crashes from malformed inventory files
- Silently skips problematic libraries and continues working
- Better logging for troubleshooting

### � **Enhanced Context Detection**
- Fixed "object.method" issue — now shows correct qualified names
- Better type detection from code assignments
- Improved handling of inline comments
- More accurate method-to-type resolution

### ✨ **Visual Improvements**
- Enhanced Sphinx documentation parsing
- Better formatting for parameters and return types
- Version metadata display (added/changed/deprecated)
- Cleaner, more readable hover content

**[See full changelog](CHANGELOG.md)**

---

## 🤝 **Contributing**

Contributions are welcome! Whether it's bug reports, feature requests, or code contributions.

- **Found a bug?** [Open an issue](https://github.com/KiidxAtlas/python-hover/issues)
- **Have an idea?** [Start a discussion](https://github.com/KiidxAtlas/python-hover/discussions)
- **Want to contribute code?** [Read the contributing guide](CONTRIBUTING.md)

---

## 📝 **Troubleshooting**

### Hover not showing?

1. **Ensure Python extension is installed** — Python Hover requires the official Python extension
2. **Check file is saved** — Hover works best on saved files
3. **Verify Python environment** — Make sure a Python interpreter is selected

### Library documentation not appearing?

1. **Check library is imported** — Python Hover detects imported libraries
2. **Try reloading VS Code** — `Ctrl+Shift+P` → "Developer: Reload Window"
3. **Check Output panel** — View → Output → Select "Python Hover" for debug logs
4. **Ensure library has Sphinx docs** — Most popular libraries do

### Custom library not working?

1. **Verify inventory URL** — Try opening the URL in a browser
2. **Check JSON syntax** — Ensure settings JSON is valid
3. **See custom library guide** — [Detailed instructions here](CUSTOM_LIBRARIES.md)

Still having issues? [Open an issue](https://github.com/KiidxAtlas/python-hover/issues) with:
- VS Code version
- Python version
- Extension version
- Output panel logs

---

## 📊 **Stats**

- 🐍 **300+** Python constructs covered
- 📚 **19+** pre-configured libraries
- 🔍 **1000s** of libraries via auto-discovery
- ⚡ **< 10ms** cached lookup time
- 📦 **1.07 MB** bundle size
- ⭐ Loved by **thousands** of developers

---

## � **License**

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🌟 **Show Your Support**

If Python Hover saves you time and makes you more productive:

1. ⭐ **[Star the repository](https://github.com/KiidxAtlas/python-hover)** on GitHub
2. ⭐ **[Rate it 5-stars](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover&ssr=false#review-details)** on the marketplace
3. ☕ **[Buy me a coffee](https://buymeacoffee.com/kiidxatlas)** to support development
4. � **Share it** with your team and the Python community!

**Every bit of support helps keep this extension free and actively maintained!** ❤️

---

<div align="center">

**Made with ❤️ by [KiidxAtlas](https://github.com/KiidxAtlas)**

**[Install Python Hover Today](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover)** 🚀

</div>

---

## 🧪 Testing

Run fast unit tests (no VS Code needed):

```bash
npm run test:unit
```

Watch mode for rapid iteration:

```bash
npm run test:unit:watch
```

Full integration tests (spins up VS Code test host):

```bash
npm test
```

Notes:

- Unit tests stub the VS Code API and run in Node for speed.
- Integration tests validate activation, hover performance, and inventory resolution end-to-end.

### Snapshot hover tests (real content)

Want to see the exact Markdown users see in the hover? Run the snapshot suite to generate reviewable artifacts:

```bash
npm run test:snapshots
```

What this does:

- Spins up the full VS Code test host and forces the real hover pipeline (no test shortcuts)
- Captures the actual Markdown from dozens of representative hovers
- Writes files to `artifacts/hover-snapshots/*.md` for hands-on review

Tips:

- Open a few files like `artifacts/hover-snapshots/builtin-range.md` or `artifacts/hover-snapshots/keyword-for.md` to inspect content
- Add new cases in `src/test/suite/hoverSnapshots.test.ts` to expand coverage
- Snapshot mode skips strict perf checks to keep runs stable and focused on content
