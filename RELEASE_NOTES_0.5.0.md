# 🚀 Python Hover v0.5.0 — Auto-Discovery Release

## **Stop Hardcoding Libraries. Start Discovering.**

We're excited to announce **Python Hover v0.5.0** — a major update that revolutionizes how you get Python documentation!

---

## 🎯 **What's New**

### 🔍 **Auto-Discovery for ANY Python Library**

**The game changer:** Python Hover now automatically discovers and provides documentation for **ANY Python library** with Sphinx or ReadTheDocs documentation!

```python
import seaborn as sns
import plotly.express as px
import dask.dataframe as dd
from beautifulsoup4 import BeautifulSoup

# Hover over ANY of these — instant docs!
sns.lineplot()      # ✅ Works!
px.scatter()        # ✅ Works!
dd.read_csv()       # ✅ Works!
BeautifulSoup()     # ✅ Works!
```

**No configuration needed. Just import and hover.**

#### How It Works

- **Smart PyPI Integration**: Fetches documentation URLs from PyPI metadata
- **Pattern Matching**: Tests 6 different ReadTheDocs URL patterns
- **Quality Validation**: Ensures inventory files are real docs (>1KB)
- **Intelligent Caching**: 24-hour cache for both successes and failures
- **Works Offline**: After first fetch, works without internet

#### Supported Libraries

scikit-learn, seaborn, plotly, dask, beautifulsoup4, SQLAlchemy, Keras, TensorFlow, Scrapy, and **thousands more** with Sphinx/ReadTheDocs documentation!

---

### ✨ **Enhanced Keyword Documentation**

Keywords now show **BOTH** official documentation AND practical examples in one hover:

**Before**: Only showed syntax or only showed examples
**Now**: Combined view with complete context

```python
import os  # ← Hover shows: official import docs + practical usage patterns
```

Better learning experience = faster development!

---

### 🐛 **Bug Fixes & Improvements**

#### Fixed

- **Import Detection**: Inline comments in import statements now handled correctly
  ```python
  import sklearn  # machine learning library  ← Now properly detected
  ```

- **`import` Keyword URL**: Now links to correct Python docs section (simple_stmts)

- **Context Preservation**: Dotted expressions (e.g., `np.array`) maintain context correctly

- **Third-Party Tracking**: All non-stdlib libraries tracked, enabling auto-discovery fallback

#### Improved

- **Cleaner Architecture**: Single source of truth for all documentation URLs
- **Reduced Logging**: Production-ready log levels (detailed logs at DEBUG)
- **Better Performance**: Smarter caching and validation

---

## 📊 **By The Numbers**

- **19+ Pre-Configured Libraries**: NumPy, Pandas, FastAPI, Django, PyTorch, etc.
- **Thousands More via Auto-Discovery**: scikit-learn, seaborn, plotly, dask, and more
- **300+ Built-in Constructs**: Complete Python language coverage
- **24-Hour Cache TTL**: Fast repeated lookups
- **3-Second Validation**: Quick checks don't slow you down

---

## 🚀 **Get Started**

1. **Update** to v0.5.0 from VS Code Extensions
2. **Open** any Python file
3. **Import** any library with Sphinx/ReadTheDocs docs
4. **Hover** and see instant documentation!

---

## 🎯 **What's Next**

We're constantly improving Python Hover. Coming soon:

- Custom library configuration improvements
- Enhanced caching strategies
- More intelligent pattern matching
- Support for private/enterprise documentation

---

## 💛 **Support Development**

If Python Hover saves you time every day:

- ⭐ [Leave a 5-star review](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover&ssr=false#review-details)
- ☕ [Buy me a coffee](https://buymeacoffee.com/kiidxatlas)
- 🐛 [Report bugs](https://github.com/KiidxAtlas/python-hover/issues)
- 💡 [Request features](https://github.com/KiidxAtlas/python-hover/issues)

---

## 📚 **Learn More**

- [Full Changelog](CHANGELOG.md)
- [Custom Library Setup](CUSTOM_LIBRARIES.md)
- [GitHub Repository](https://github.com/KiidxAtlas/python-hover)

---

**Made with ❤️ for the Python community**
