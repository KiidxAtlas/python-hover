"""
Python Hover Extension - Feature Demo
Test all the new features added in v0.3.0
"""

# 1. Quick Actions Demo - Hover over 'upper' to see Run/Copy/Insert buttons
text = "hello world"
result = text.upper()

# 2. Third-Party Library Support - Import numpy and hover over 'array'
import numpy as np
import pandas as pd

# Hover over 'array' to see NumPy documentation
arr = np.array([1, 2, 3, 4, 5])
zeros = np.zeros(10)

# Hover over 'DataFrame' to see Pandas documentation
df = pd.DataFrame({
    'name': ['Alice', 'Bob'],
    'age': [25, 30]
})

# 3. Version Comparison - Hover over 'removeprefix' to see version info
text = "Hello World"
result = text.removeprefix("Hello")  # New in Python 3.9

# 4. Method Comparison - Hover over 'append' to see comparison with extend
my_list = [1, 2, 3]
my_list.append(4)  # See comparison with extend, insert

# 5. Custom Documentation - Create .python-hover.json and add custom symbols
# Then hover over your custom symbols to see project-specific docs

# 6. Built-in methods with examples
numbers = [3, 1, 4, 1, 5, 9, 2, 6]
numbers.sort()  # Hover to see comparison with sorted()

# 7. Dictionary methods
data = {'a': 1, 'b': 2}
value = data.get('c', 0)  # Hover to see comparison with setdefault

# 8. String methods
sentence = "  hello world  "
cleaned = sentence.strip()  # Hover for examples

# 9. Flask support (if imported)
try:
    from flask import Flask, render_template
    # Hover over Flask or render_template for documentation
except ImportError:
    pass

# 10. Requests library support
try:
    import requests
    # Hover over 'get' or 'post' for documentation
    # response = requests.get('https://api.github.com')
except ImportError:
    pass
