<div align="center">

# 🐍 Python Hover - Enhanced Documentation

## **Stop Googling. Start Coding.**

**Instant Python documentation with 300+ constructs, 19+ libraries, and practical examples — right in your editor.**

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/KiidxAtlas.python-hover?color=blue&label=VS%20Code%20Marketplace&style=flat-square)](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/KiidxAtlas.python-hover?color=success&style=flat-square)](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/KiidxAtlas.python-hover?color=orange&style=flat-square)](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover&ssr=false#review-details)
[![License](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)](LICENSE)

**[Install Now](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover)** • **[⭐ Rate It](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover&ssr=false#review-details)** • **[Report Issue](https://github.com/KiidxAtlas/python-hover/issues)**

</div>

---

<div align="center">

## ⚡ **Save Hours Every Week?**

**If this extension saves you time, keep the updates coming!**

[![Buy Me A Coffee](https://img.shields.io/badge/☕_Buy_Me_A_Coffee-Support_Development-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/kiidxatlas)

**Every coffee helps maintain this free tool and add new features!** 🚀

---

## 💛 **Loving Python Hover? Show It!**

⭐ **[Leave a 5-star review](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover&ssr=false#review-details)** — Takes 30 seconds, means the world!

**Your rating helps other developers discover this tool.**

</div>

---

![Python Hover in Action](media/media.gif)

## 🎯 **What You Get**

**Hover over ANY Python code and get:**

✨ **Instant Documentation** — No more alt-tabbing to docs
💡 **Practical Examples** — Real, runnable code you can copy
🎯 **Smart Context** — Knows if you're using strings, lists, or dicts
📚 **19+ Libraries** — NumPy, Pandas, FastAPI, PyTorch, Flask, and more
🚀 **300+ Built-ins** — Every Python keyword, method, and function
⚡ **Lightning Fast** — Cached for offline use
🎨 **Fully Customizable** — Match your coding style

---

## 🚀 **Why Developers Love It**

> "Stopped me from context-switching 20 times a day. Game changer!" — *Python Developer*

> "Perfect for teaching Python. Students learn by seeing examples instantly." — *CS Educator*

> "Finally, library docs that actually help. No more digging through ReadTheDocs." — *Data Scientist*

---

## ⚡ **Quick Start** (30 Seconds)

1. **Install** from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover)
2. **Open** any Python file
3. **Hover** over any code
4. **Done!** Instant documentation appears

**That's it. No configuration needed.**

---

## ✨ **What Makes This Special**

🚀 **300+ Python Constructs** — Complete coverage of built-ins, methods, and language features

🎯 **Smart Context Detection** — Knows when you're working with strings, lists, dicts, or sets

💡 **Practical Examples** — Real, copyable code with expected outputs

📚 **19+ Major Libraries** — NumPy, Pandas, FastAPI, Django, PyTorch, Flask, and more

⚙️ **Add Your Own Libraries** — Configure custom documentation for any Sphinx-documented library ([Learn how](CUSTOM_LIBRARIES.md))

🎨 **Fully Customizable** — Themes, colors, font sizes — make it yours

---

## 🛠 **Perfect For**

**🆕 Python Beginners** — Learn by example with comprehensive documentation

**👨‍💻 Experienced Developers** — Quick reference without context switching

**🏫 Educators** — Teaching tool with practical, modern Python examples

**🔄 Code Reviewers** — Understand unfamiliar methods instantly

**🏢 Teams** — Share custom library docs across your organization

---

## 📚 **Massive Coverage**

### **Third-Party Libraries (19+)**

**Data Science & ML:**

- NumPy, Pandas, SciPy, Matplotlib, scikit-learn, PyTorch

**Web Development:**

- FastAPI, Django, Flask, Requests, aiohttp

**Automation & Testing:**

- Selenium, pytest, Click

**Database & Validation:**

- SQLAlchemy, Pydantic

**Utilities:**

- BeautifulSoup4, Pillow/PIL, Sphinx

> 🎉 **NEW:** Configure your own libraries! Works with any Sphinx-documented package. [Learn how →](CUSTOM_LIBRARIES.md)

### **Python Built-ins (300+)**

✅ **70+ Built-in Functions** — `type`, `len`, `enumerate`, `zip`, `map`, `filter`, `sorted`, and more

✅ **42+ String Methods** — `strip`, `split`, `join`, `replace`, `upper`, `lower`, and more

✅ **Collection Methods** — Lists, Dicts, Sets, Tuples — everything covered

✅ **Language Constructs** — `class`, `def`, `for`, `if`, `try`, `with`, `async`, `await`

✅ **Special Methods** — `__init__`, `__str__`, `__len__`, `__getitem__`, and all dunders

✅ **40+ Standard Library Modules** — `os`, `sys`, `json`, `datetime`, `pathlib`, `asyncio`, and more

---

## 🎥 **Real Examples**

**String Methods with Smart Context:**

```python
text = "hello world"
text.upper()  # ← Hover shows: "HELLO WORLD" + practical examples
```

**Third-Party Libraries:**

```python
import pandas as pd
df = pd.DataFrame({'A': [1, 2, 3]})
df.head()  # ← Instant DataFrame documentation
```

**Language Constructs:**

```python
class Person:  # ← Hover shows modern class patterns with type hints
    def __init__(self, name: str, age: int):
        self.name = name
        self.age = age
```

**Smart Method Comparisons:**

```python
my_list = [1, 2, 3]
my_list.append(4)  # ← Shows examples + comparison with extend()
```

---

## ⚙️ **Powerful Configuration**

### **Quick Settings**

```json
{
  "pythonHover.fontSize": "medium",              // small | medium | large
  "pythonHover.showPracticalExamples": true,     // Show code examples
  "pythonHover.showRelatedMethods": true,        // Show alternatives
  "pythonHover.openDocsInEditor": false          // In-editor vs browser
}
```

### **🧪 Experimental Features**

```json
{
  "pythonHover.experimental.autoDetectLibraries": true  // Auto-detect third-party imports
}
```

**Auto-detect Libraries** (enabled by default):
- Automatically detects third-party libraries imported in your code
- Fetches Intersphinx inventories from common documentation sites
- Provides hover documentation for imported symbols
- Disable if you experience performance issues with many imports

### **Add Custom Libraries**

Works with ANY Sphinx-documented library:

```json
{
  "pythonHover.customLibraries": [
    {
      "name": "your_library",
      "inventoryUrl": "https://your-lib.readthedocs.io/en/latest/objects.inv",
      "baseUrl": "https://your-lib.readthedocs.io/en/latest/"
    }
  ]
}
```

**Perfect for:**

- Company internal libraries
- Custom forks
- Unreleased packages
- Specific version overrides

📖 **[Full Configuration Guide →](CUSTOM_LIBRARIES.md)**

---

## 🎨 **Commands**

Access via Command Palette (`Cmd/Ctrl + Shift + P`):

| Command | Description |
|---------|-------------|
| `Python Hover: Show Supported Libraries` | View all supported libraries (19+ built-in) |
| `Python Hover: Clear Cache` | Clear all cached documentation |
| `Python Hover: Open Documentation` | Open docs in browser |
| `Python Hover: Copy Documentation URL` | Copy URL to clipboard |
| `Python Hover: Insert Example` | Insert code example at cursor |
| `Python Hover: Increase Font Size` | Make hover text larger |
| `Python Hover: Decrease Font Size` | Make hover text smaller |

---

## 🔥 **Pro Tips**

💡 **Keep Docs Open:** Set `"pythonHover.openDocsInEditor": true` to view docs in VS Code's Simple Browser

🎨 **Customize Style:** Adjust font size, toggle emojis/colors/borders to match your preferences

📚 **Learn Libraries Faster:** Import a library and hover over its functions for instant learning

🏢 **Share with Team:** Add custom library configs to `.vscode/settings.json` for the whole team

---

## 🆚 **Why Choose Python Hover?**

| Feature | Python Hover | Others |
|---------|--------------|--------|
| **Offline Support** | ✅ Full (cached) | ⚠️ Limited |
| **Third-Party Libraries** | ✅ 19+ built-in | ❌ Few or none |
| **Custom Libraries** | ✅ Unlimited | ❌ Not supported |
| **Practical Examples** | ✅ Real code | ⚠️ Basic only |
| **Smart Context** | ✅ List/String/Dict aware | ⚠️ Generic |
| **Visual Customization** | ✅ Themes & styles | ❌ Fixed style |
| **Related Methods** | ✅ Shows alternatives | ❌ No suggestions |
| **Active Development** | ✅ Regular updates | ⚠️ Varies |

---

## 🤝 **Contributing**

We welcome contributions! Here's how:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** changes: `git commit -m 'Add amazing feature'`
4. **Push** to branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

### **Ideas for Contributions**

- Add more third-party library support
- Improve examples and documentation
- Translate to other languages
- Report bugs or suggest features

---

## 📋 **What's New**

### **Version 0.3.2**

🚀 Enhanced third-party library coverage with 19+ libraries

🤖 Added PyTorch, aiohttp, Click support with verified Intersphinx

🎯 All library integrations tested and working

✨ Enhanced documentation with better library categorization

📊 Added status bar showing cache size and quick access to cache management

⏱️ Request timeouts (10 seconds) for better reliability

🐛 Centralized logging system with debug control

See [CHANGELOG.md](CHANGELOG.md) for complete version history.

---

## 📄 **License**

MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 **Support & Feedback**

<div align="center">

### 💖 **Like Python Hover?**

⭐ **[Rate it on the Marketplace](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover&ssr=false#review-details)** — Help others discover it!

☕ **[Buy me a coffee](https://buymeacoffee.com/kiidxatlas)** — Support continued development

🐛 **[Report a bug](https://github.com/KiidxAtlas/python-hover/issues)** — Help us improve

💡 **[Request a feature](https://github.com/KiidxAtlas/python-hover/issues)** — Share your ideas

⭐ **[Star on GitHub](https://github.com/KiidxAtlas/python-hover)** — Show your support

---

**Made with ❤️ for the Python community**

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
