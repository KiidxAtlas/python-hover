# 🐍 Python Hover - Enhanced Documentation Assistant

> **Instant Python documentation at your fingertips**
> Get comprehensive examples, type hints, and practical code snippets without leaving your editor.

![Python Hover Demo](media/demo.gif)

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/KiidxAtlas.python-hover)](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/KiidxAtlas.python-hover)](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/KiidxAtlas.python-hover)](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover)

## ✨ **What Makes This Special**

🚀 **300+ Python Constructs** - Complete coverage of built-ins, methods, and language features  
🎯 **Smart Context Detection** - Knows when you're working with strings, lists, dicts, or sets  
💡 **Practical Examples** - Real, copyable code with expected outputs  
📚 **Import Intelligence** - Hover support for 40+ standard library modules  
⚙️ **Fully Customizable** - Multiple configuration options to match your workflow  

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
        self.age = age
```

### **Import Statement Intelligence**

```python
import os  # Hover shows comprehensive OS module documentation
from datetime import datetime  # Hover shows datetime-specific info
```

## 🚀 **Quick Start**

1. **Install** the extension from the VS Code marketplace
2. **Open** any Python file
3. **Hover** over any Python keyword, function, or method
4. **Get instant** documentation with practical examples!

## 🛠 **Perfect For**

- 🆕 **Python Beginners** - Learn by example with comprehensive documentation
- 👨‍💻 **Experienced Developers** - Quick reference without context switching
- 🏫 **Educators** - Teaching tool with practical, modern Python examples
- 🔄 **Code Reviewers** - Understand unfamiliar methods instantly

## 📊 **Comprehensive Coverage**

### **Built-in Functions (70+)**

`type`, `len`, `dir`, `help`, `enumerate`, `zip`, `map`, `filter`, `sorted`, `reversed`, `sum`, `max`, `min`, `abs`, `round`, `input`, `eval`, `compile`, `hash`, `hex`, `oct`, `bin`, `ord`, `chr`, `ascii`, `repr`, `format`, `divmod`, `callable`, `super`, `locals`, `globals`, `breakpoint`, and many more...

### **String Methods (42+)**

`strip`, `split`, `join`, `replace`, `find`, `upper`, `lower`, `startswith`, `endswith`, `capitalize`, `title`, `isdigit`, `isalpha`, `count`, `encode`, `center`, `ljust`, `rjust`, `zfill`, `removeprefix`, `removesuffix`, and more...

### **Collection Methods**

- **List (9)**: `append`, `extend`, `insert`, `remove`, `pop`, `clear`, `copy`, `reverse`, `sort`
- **Dict (8)**: `keys`, `values`, `items`, `get`, `setdefault`, `update`, `popitem`, `fromkeys`
- **Set (12)**: `add`, `discard`, `union`, `intersection`, `difference`, `symmetric_difference`, and more...

### **Language Constructs**

`class`, `def`, `try`, `with`, `for`, `while`, `if`, `import`, `lambda`, `async`, `await`, `yield`, `return`, `break`, `continue`, `pass`, `raise`, `assert`, `match`, `case`

### **Special Methods & Dunder Methods**

`__init__`, `__str__`, `__repr__`, `__len__`, `__getitem__`, `__setitem__`, `__contains__`, `__iter__`, `__next__`, `__enter__`, `__exit__`, and many more...

### **Standard Library Modules (40+)**

`os`, `sys`, `math`, `random`, `datetime`, `json`, `re`, `asyncio`, `pathlib`, `typing`, `collections`, `itertools`, `csv`, `sqlite3`, `threading`, `multiprocessing`, and more...

## ⚙️ **Configuration**

```json
{
  "pythonHover.docsVersion": "auto",          // Python version to use for docs
  "pythonHover.maxSnippetLines": 12,          // Max lines in hover snippets
  "pythonHover.cacheTTL.inventoryDays": 7,    // Days to cache inventory files
  "pythonHover.cacheTTL.snippetHours": 48,    // Hours to cache doc snippets
  "pythonHover.enableKeywordDocs": true,      // Enable keyword documentation
  "pythonHover.enhancedMethodResolution": true, // Enable smart method resolution
  "pythonHover.showPracticalExamples": true,   // Show practical code examples
  "pythonHover.telemetry": false              // Telemetry (disabled by default)
}
```

## 🔍 **Version Detection**

The extension intelligently detects the appropriate Python version:

1. Active interpreter from the Python extension
2. Project configuration files (`pyproject.toml`, `poetry.lock`, etc.)
3. User-specified version in settings
4. Latest stable Python version as fallback

## 📚 **Architecture**

- **Smart Symbol Resolution**: Advanced code context analysis
- **Intersphinx Integration**: Precise documentation mapping
- **Context-aware Type Detection**: Knows variable types from context
- **Enhanced Method Resolution**: Automatically links methods to correct types
- **Intelligent Caching**: Optimized multi-layer caching system

## 🔒 **Privacy**

- No telemetry by default
- Only fetches from the official Python documentation site
- No data collection or external analytics

## 🧰 **Development**

```bash
# Install dependencies
npm install

# Compile extension
npm run compile

# Run tests
npm test

# Package extension
vsce package
```

## 📋 **Requirements**

- VS Code ^1.80.0
- Python files in the workspace

## 📄 **License**

MIT License - see [LICENSE](LICENSE) for details.
