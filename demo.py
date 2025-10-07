"""
🐍 Python Hover - Demo File for GIF Recording
==============================================
Keep this file clean and focused for demo recordings.
Hover over highlighted code to see documentation!
"""

# ============================================================================
# 🎯 STRING METHODS - Smart Documentation
# ============================================================================

text = "hello world"
result = text.upper()  # Hover: See transformation example
cleaned = text.strip()  # Hover: Compare with other methods
parts = text.split()  # Hover: See practical examples


# ============================================================================
# 📊 COLLECTION METHODS - Intelligent Suggestions
# ============================================================================

# Lists - Hover to see differences between similar methods
numbers = [3, 1, 4, 1, 5, 9]
numbers.append(2)  # Hover: append vs extend
numbers.sort()  # Hover: sort() vs sorted()

# Dictionaries - Safe access patterns
user = {"name": "Alice", "age": 25}
email = user.get("email", "N/A")  # Hover: get() with default
user.setdefault("city", "NYC")  # Hover: setdefault vs get


# ============================================================================
# 📚 THIRD-PARTY LIBRARIES - NumPy, Pandas, PyTorch & More
# ============================================================================

# NumPy - Scientific Computing
import numpy as np

arr = np.zeros((3, 3))  # Hover: See array creation examples
ones = np.ones(10)  # Hover: Documentation from numpy.org

# Pandas - Data Analysis
import pandas as pd

df = pd.DataFrame({"A": [1, 2, 3]})  # Hover: See DataFrame usage
series = pd.Series([10, 20, 30])  # Hover: Official pandas docs

# PyTorch - Deep Learning (if installed)
try:
    import torch

    tensor = torch.zeros(2, 3)  # Hover: PyTorch tensor operations
except ImportError:
    pass


# ============================================================================
# 🔧 STANDARD LIBRARY - Built-in Modules
# ============================================================================

import json
import random

# Random numbers
rand_num = random.random()  # Hover: See usage examples
choice = random.choice([1, 2, 3])  # Hover: Pick random item

# JSON operations
data = {"name": "Python", "version": "3.11"}
json_str = json.dumps(data, indent=2)  # Hover: Convert to JSON


# ============================================================================
# 📝 GIF RECORDING TIPS
# ============================================================================
"""
🎬 PERFECT DEMO SEQUENCE (30 seconds):

1. Hover over text.upper() - Show string method docs (3s)
2. Hover over numbers.append() - Show vs extend comparison (3s)
3. Hover over np.zeros() - Show NumPy third-party support (4s)
4. Hover over pd.DataFrame() - Show Pandas documentation (4s)
5. Show clicking "Open Documentation" link (2s)

✨ Keep it simple, focused, and impressive!
"""
