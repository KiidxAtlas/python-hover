# 🐍 Python Hover - Enhanced Python Documentation Assistant

> **Instant Python documentation at your fingertips**
>
> Get comprehensive examples, type hints, and practical code snippets without leaving your editor.

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-maSee [CHANGELOG.md](CHANGELOG.md) for a detailed history of changes and version updates.

**Latest Version: 0.3.0**
- 🚀 Dynamic third-party library support via Intersphinx inventories
- 🎯 Automatic documentation for NumPy, Pandas, Matplotlib, SciPy, Flask, Django, pytest, and more
- ✨ Enhanced standard library support with better content extraction
- 🔧 Removed 515 lines of manual stdlib documentation (now dynamic)
- 📦 Smart symbol resolution for complex module hierarchies (e.g., matplotlib.pyplot)e/v/KiidxAtlas.python-hover?color=blue&label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/KiidxAtlas.python-hover?color=success)](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/KiidxAtlas.python-hover?color=orange)](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/KiidxAtlas/python-hover?style=social)](https://github.com/KiidxAtlas/python-hover)
[![GitHub Issues](https://img.shields.io/github/issues/KiidxAtlas/python-hover)](https://github.com/KiidxAtlas/python-hover/issues)

![Python Hover Demo](media/demo.gif)

---

## ✨ **What Makes This Special**

🚀 **300+ Python Constructs** - Complete coverage of built-ins, methods, and language features

🎯 **Smart Context Detection** - Knows when you're working with strings, lists, dicts, or sets

💡 **Practical Examples** - Real, copyable code with expected outputs

📚 **Import Intelligence** - Hover support for 40+ standard library modules

⚙️ **Fully Customizable** - Multiple configuration options to match your workflow

---

## 🎥 **See It In Action**

### **String Methods with Smart Context**

```python
text = "hello world"
text.upper()  # Hover shows: "HELLO WORLD" with practical examples
```

### **Enhanced Language Constructs**

```python
class Person:  # Hover shows modern class examples with type hints
    def __init__(self, name: str, age: int):
        self.name = name
```

### **Import Statement Intelligence**

```python
import os  # Hover shows comprehensive OS module documentation
from datetime import datetime  # Hover shows datetime-specific info
```

### **Smart List Method Comparisons**

```python
my_list = [1, 2, 3]
my_list.append(4)  # ← Hover shows: list method with examples and comparison with extend()
# Result: [1, 2, 3, 4]
```

---

## 🚀 **Quick Start**

1. **Install** the extension from the VS Code marketplace
2. **Open** any Python file
3. **Hover** over any Python keyword, function, or method
4. **Get instant** documentation with practical examples!

---

## 🛠 **Perfect For**

- 🆕 **Python Beginners** - Learn by example with comprehensive documentation
- 👨‍💻 **Experienced Developers** - Quick reference without context switching
- 🏫 **Educators** - Teaching tool with practical, modern Python examples
- 🔄 **Code Reviewers** - Understand unfamiliar methods instantly

---

## 📚 **Massive Library Support**

### **Dynamic Third-Party Library Support**

Third-party libraries now use **Intersphinx inventories** for automatic, comprehensive documentation coverage:

- **Data Science**: NumPy, Pandas, SciPy, Matplotlib, scikit-learn
- **Web Frameworks**: FastAPI, Django, Flask
- **HTTP**: Requests
- **Testing**: pytest, Sphinx
- **Async**: asyncio
- **Web Scraping**: BeautifulSoup4
- **Database**: SQLAlchemy
- **Validation**: Pydantic
- **Automation**: Selenium
- **Images**: Pillow/PIL
- ...and all Python built-ins!

> 🚀 **No manual maintenance required!** All library functions are automatically documented with links to official sources.

### 💡 **Practical Examples**

Every hover includes **real, runnable code** with expected outputs:

```python
import pandas as pd

df = pd.DataFrame({'A': [1, 2, 3]})
df.head()  # ← Hover shows DataFrame examples
```

---

## 📊 **Comprehensive Coverage**

### **Built-in Functions (70+)**

`type`, `len`, `dir`, `help`, `enumerate`, `zip`, `map`, `filter`, `sorted`, `reversed`, `sum`, `max`, `min`, `abs`, `round`, `input`, `eval`, `compile`, `hash`, `hex`, `oct`, `bin`, `ord`, `chr`, `ascii`, `repr`, `format`, `divmod`, `callable`, `super`, `locals`, `globals`, `breakpoint`, and many more...

### **String Methods (42+)**

`strip`, `split`, `join`, `replace`, `find`, `upper`, `lower`, `startswith`, `endswith`, `capitalize`, `title`, `isdigit`, `isalpha`, `count`, `encode`, `center`, `ljust`, `rjust`, `zfill`, `removeprefix`, `removesuffix`, and more...

### **Collection Methods**

- **List (11)**: `append`, `extend`, `insert`, `remove`, `pop`, `clear`, `copy`, `reverse`, `sort`, `count`, `index`
- **Dict (12)**: `keys`, `values`, `items`, `get`, `setdefault`, `update`, `pop`, `popitem`, `clear`, `copy`, `fromkeys`, `__getitem__`
- **Set (15)**: `add`, `remove`, `discard`, `clear`, `copy`, `union`, `intersection`, `difference`, `symmetric_difference`, and more...

### **Language Constructs**

`class`, `def`, `try`, `with`, `for`, `while`, `if`, `import`, `lambda`, `async`, `await`, `yield`, `return`, `break`, `continue`, `pass`, `raise`, `assert`, `match`, `case`

### **Special Methods & Dunder Methods**

`__init__`, `__str__`, `__repr__`, `__len__`, `__getitem__`, `__setitem__`, `__contains__`, `__iter__`, `__next__`, `__enter__`, `__exit__`, and many more...

### **Standard Library Modules (40+)**

`os`, `sys`, `math`, `random`, `datetime`, `json`, `re`, `asyncio`, `pathlib`, `typing`, `collections`, `itertools`, `csv`, `sqlite3`, `threading`, `multiprocessing`, and more...

---

## 🎨 **Beautiful, Customizable Interface**

## 🎨 **Beautiful, Customizable Interface**

- ✅ VS Code theme icon integration
- ✅ Colored badges and visual hierarchy
- ✅ Customizable font sizes
- ✅ Toggle emojis, colors, borders
- ✅ Open docs in-editor or external browser

---

## ⚙️ **Configuration**

Customize to match your workflow:

```json
{
  "pythonHover.docsVersion": "auto",              // Python version (auto-detect or specify)
  "pythonHover.maxSnippetLines": 12,              // Max lines in hover snippets
  "pythonHover.openDocsInEditor": false,          // Open docs in VS Code or browser
  "pythonHover.fontSize": "medium",               // small | medium | large
  "pythonHover.showEmojis": true,                 // Show emoji icons
  "pythonHover.showColors": true,                 // Colored badges
  "pythonHover.showBorders": true,                // Section dividers
  "pythonHover.showPracticalExamples": true,      // Show code examples
  "pythonHover.showRelatedMethods": true,         // Show related methods
  "pythonHover.showVersionInfo": true,            // Show Python version info
  "pythonHover.enableKeywordDocs": true,          // Keyword documentation
  "pythonHover.enhancedMethodResolution": true,   // Smart context detection
  "pythonHover.cacheTTL.inventoryDays": 7,        // Cache inventory (days)
  "pythonHover.cacheTTL.snippetHours": 48,        // Cache snippets (hours)
  "pythonHover.telemetry": false                  // Telemetry (disabled by default)
}
```

---

  "pythonHover.showVersionInfo": true,            // Show Python version info

  "pythonHover.enableKeywordDocs": true,          // Keyword documentation- VS Code ^1.80.0

  "pythonHover.enhancedMethodResolution": true,   // Smart context detection- Python files in the workspace



  // Cache (for offline use)## 📄 **License**

  "pythonHover.cacheTTL.inventoryDays": 7,        // Cache inventory (days)

  "pythonHover.cacheTTL.snippetHours": 48         // Cache snippets (hours)MIT License - see [LICENSE](LICENSE) for details.

}
```

---

## 🎨 **Commands**

Access via Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`):

- `Python Hover: Clear Documentation Cache` - Clear cached docs
- `Python Hover: Open Documentation` - Open docs in browser
- `Python Hover: Copy Documentation URL` - Copy URL to clipboard
- `Python Hover: Insert Example at Cursor` - Insert code example
- `Python Hover: Increase Hover Font Size` - Larger font
- `Python Hover: Decrease Hover Font Size` - Smaller font

---

## 🔥 **Pro Tips**

### **Tip 1: Keep Docs Open While Coding**

Enable `"pythonHover.openDocsInEditor": true` to open documentation in VS Code's Simple Browser - no context switching!

### **Tip 2: Customize Visual Style**

Use font size commands or adjust settings for your preferred look:

```json
{
  "pythonHover.fontSize": "large",
  "pythonHover.showEmojis": false,  // Minimal look
  "pythonHover.showBorders": false
}
```

### **Tip 3: Learn Third-Party Libraries**

Import a library and hover over its functions:

```python
import numpy as np
np.zeros()  # ← Instant NumPy documentation
```

---

## 🆚 **Why Choose Python Hover?**

| Feature                           | Python Hover                    | Other Extensions         |
| --------------------------------- | ------------------------------- | ------------------------ |
| **Offline Support**         | ✅ Full offline with cache      | ⚠️ Limited             |
| **Third-Party Libraries**   | ✅ 15+ major libraries          | ❌ Python built-ins only |
| **Practical Examples**      | ✅ Real, runnable code          | ⚠️ Basic examples      |
| **Visual Customization**    | ✅ Themes, colors, icons        | ❌ No customization      |
| **Smart Context Detection** | ✅ Knows list vs string vs dict | ⚠️ Generic             |
| **Related Methods**         | ✅ Suggests alternatives        | ❌ No suggestions        |
| **Active Development**      | ✅ Regular updates              | ⚠️ Varies              |

---

## 🤝 **Contributing**

We welcome contributions! Here's how:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** changes: `git commit -m 'Add amazing feature'`
4. **Push** to branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

### **Ideas for Contributions:**

- Add more third-party library support
- Improve examples and documentation
- Translate to other languages
- Report bugs or suggest features

---

## 📝 **License**

MIT License - see [LICENSE](LICENSE) for details.

---

## 📋 **Changelog**

See [CHANGELOG.md](CHANGELOG.md) for a detailed history of changes and version updates.

**Latest Version: 0.4.0**
- 🚀 Dynamic third-party library support via Intersphinx inventories
- 🎯 Automatic documentation for NumPy, Pandas, Matplotlib, SciPy, Flask, Django, pytest, and more
- ✨ Enhanced standard library support with better content extraction
- 🔧 Removed 515 lines of manual stdlib documentation (now dynamic)
- � Smart symbol resolution for complex module hierarchies (e.g., matplotlib.pyplot)

---

## 🙏 **Acknowledgments**

- Community contributors and users

---

## � **Support This Project**

If you find Python Hover helpful, consider supporting its development!

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support%20Development-orange?style=for-the-badge&logo=buy-me-a-coffee)](https://buymeacoffee.com/kiidxatlas)

Your support helps me:

- 🚀 Add more library support
- 🐛 Fix bugs faster
- ✨ Develop new features
- 📚 Create better documentation

Every coffee ☕ makes a difference!

---

## 🀽� **Support & Feedback**

- 🐛 **Report bugs**: [GitHub Issues](https://github.com/KiidxAtlas/python-hover/issues)
- 💡 **Request features**: [GitHub Issues](https://github.com/KiidxAtlas/python-hover/issues)
- ⭐ **Rate us**: [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover)
- 📧 **Contact**: Create an issue on GitHub

---

<div align="center">

**Made with ❤️ for the Python community**

[⭐ Star on GitHub](https://github.com/KiidxAtlas/python-hover) • [📦 VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover) • [📝 Report Issue](https://github.com/KiidxAtlas/python-hover/issues)

</div>
