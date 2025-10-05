# 🚀 Quick Start Guide

## 🧪 Testing the Extension

1. **🔥 Start Development Mode**
   ```bash
   # Press F5 in VS Code to launch Extension Development Host
   # Or use the debug configuration "Run Extension"
   ```

2. **📂 Open Test File**
   - In the Extension Development Host window, open `test-examples/demo.py`
   - Or create a new Python file with some test code

3. **🔍 Test Hover Functionality**
   - Hover over built-in functions like `len`, `print`, `str`
   - Hover over string methods like `split`, `lower`, `upper`
   - Hover over list methods like `append`, `extend`
   - Hover over exceptions like `ValueError`, `TypeError`
   - Hover over keywords like `if`, `for`, `while`
   - Hover over dunder methods like `__init__`, `__str__`

## 💻 Example Test Code

```python
# Test this code by hovering over various symbols
text = "Hello, World!"
length = len(text)          # Hover over 'len'
words = text.split(", ")    # Hover over 'split'
print(words)                # Hover over 'print'

# Test context-aware type detection
numbers = [1, 2, 3, 4, 5]
numbers.append(6)           # Hover over 'append'
numbers.sort()              # Hover over 'sort'

# Test special methods
class Person:
    def __init__(self, name): # Hover over '__init__'
        self.name = name
    
    def __str__(self):      # Hover over '__str__'
        return self.name

numbers = [1, 2, 3]
numbers.append(4)           # Hover over 'append'

try:
    result = 10 / 0
except ZeroDivisionError:   # Hover over 'ZeroDivisionError'
    print("Division by zero!")
```

## Configuration

Add to your VS Code settings.json:

```json
{
  "pythonHover.docsVersion": "3.11",
  "pythonHover.maxSnippetLines": 15,
  "pythonHover.cacheTTL.inventoryDays": 7,
  "pythonHover.cacheTTL.snippetHours": 48
}
```

## Building and Testing

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode for development
npm run watch

# Run tests
npm test
```

## Packaging

```bash
# Install vsce globally
npm install -g vsce

# Package the extension
vsce package

# This creates a .vsix file you can install manually
```

## Troubleshooting

- **No hover appears**: Check that you're hovering over valid Python symbols
- **Network errors**: Ensure internet connection for initial documentation fetching
- **Version issues**: Check Python version detection in the workspace
- **Cache issues**: Clear cache directory if documentation seems outdated
