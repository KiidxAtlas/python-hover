"""
🐍 Python Hover Extension - Complete Feature Showcase
=====================================================
This demo file showcases ALL features of Python Hover v0.3.0+
Hover over any highlighted method/function to see rich documentation!

📹 Perfect for creating GIFs/demos showing:
   ✨ Instant documentation
   🎯 Smart context detection
   💡 Practical code examples
   📚 Third-party library support
   ⚡ Quick actions (Copy/Insert/Docs)
"""

# ============================================================================
# 1️⃣ STRING METHODS - Context-Aware Documentation
# ============================================================================
print("=== STRING METHODS ===")

# Basic transformations - Hover over each method!
text = "hello world"
upper_text = text.upper()  # → "HELLO WORLD" (immutable example)
title_text = text.title()  # → "Hello World" (capitalize each word)
swapped = text.swapcase()  # → "HELLO WORLD" (inverse case)

# String searching - Compare similar methods
sentence = "Python is awesome, Python rocks!"
position = sentence.find("Python")  # Returns index or -1
count = sentence.count("Python")  # Counts occurrences (shows vs find)
has_python = "Python" in sentence  # Boolean check

# String manipulation - See practical examples
padded = text.center(20, "-")  # → "----hello world-----"
cleaned = "  spaces  ".strip()  # Removes whitespace
parts = "a,b,c".split(",")  # → ["a", "b", "c"]

# Python 3.9+ methods - Version info shown!
url = "https://example.com"
domain = url.removeprefix("https://")  # New in 3.9
clean_url = domain.removesuffix(".com")  # New in 3.9


# ============================================================================
# 2️⃣ LIST METHODS - Smart Alternatives & Comparisons
# ============================================================================
print("\n=== LIST METHODS ===")

# List modification - Hover to see differences!
numbers = [3, 1, 4, 1, 5, 9]
numbers.append(2)  # Adds single item (vs extend)
numbers.extend([6, 5, 3])  # Adds multiple items (vs append)
numbers.insert(0, 0)  # Insert at specific position

# List organization - In-place vs return new
numbers.sort()  # Sorts in-place (vs sorted())
numbers.reverse()  # Reverses in-place (vs reversed())
sorted_copy = sorted(numbers)  # Returns new sorted list

# List analysis - Finding and counting
first_five = numbers.index(5)  # Find first occurrence
count_ones = numbers.count(1)  # Count occurrences
popped = numbers.pop()  # Remove and return last item


# ============================================================================
# 3️⃣ DICTIONARY METHODS - Safe Access Patterns
# ============================================================================
print("\n=== DICTIONARY METHODS ===")

# Dictionary creation and access
user = {"name": "Alice", "age": 25}
name = user.get("name")  # Safe get (vs direct access)
email = user.get("email", "N/A")  # Get with default (compare setdefault)
user.setdefault("city", "NYC")  # Set if not exists (modifies dict!)

# Dictionary operations
keys = user.keys()  # Get all keys
values = user.values()  # Get all values
items = user.items()  # Get key-value pairs

# Dictionary updates
user.update({"age": 26, "job": "Developer"})  # Update multiple at once
removed = user.pop("job", None)  # Remove and return (safe with default)


# ============================================================================
# 4️⃣ SET METHODS - Mathematical Operations
# ============================================================================
print("\n=== SET METHODS ===")

# Set creation and operations
set_a = {1, 2, 3, 4, 5}
set_b = {4, 5, 6, 7, 8}

# Set operations - See mathematical explanations!
union = set_a.union(set_b)  # All unique items from both
intersection = set_a.intersection(set_b)  # Items in both sets
difference = set_a.difference(set_b)  # Items in A but not B
symmetric = set_a.symmetric_difference(set_b)  # Items in A or B, not both

# Set modifications
set_a.add(10)  # Add single item
set_a.update([11, 12, 13])  # Add multiple items
set_a.discard(1)  # Remove if exists (safe)


# ============================================================================
# 5️⃣ LANGUAGE CONSTRUCTS - Classes, Functions, Decorators
# ============================================================================
print("\n=== LANGUAGE CONSTRUCTS ===")


# Hover over 'class' keyword for modern class patterns!
class Person:
    """Person class with type hints and special methods"""

    def __init__(self, name: str, age: int):  # Hover __init__ for constructor info
        self.name = name
        self.age = age

    def __str__(self) -> str:  # Hover __str__ for string representation
        return f"{self.name} ({self.age})"

    def __repr__(self) -> str:  # Hover __repr__ for debugging representation
        return f"Person(name={self.name!r}, age={self.age})"


# Hover over 'lambda' for inline function examples
square = lambda x: x**2
add = lambda a, b: a + b

# Comprehensions - Hover for syntax and examples
squares = [x**2 for x in range(10)]  # List comprehension
even_squares = {x**2 for x in range(10) if x % 2 == 0}  # Set comprehension
square_dict = {x: x**2 for x in range(5)}  # Dict comprehension


# ============================================================================
# 6️⃣ THIRD-PARTY LIBRARIES - NumPy, Pandas, Requests & More!
# ============================================================================
print("\n=== THIRD-PARTY LIBRARIES ===")

# NumPy - Scientific Computing
import numpy as np

arr = np.array([1, 2, 3, 4, 5])  # Create array (hover for examples!)
zeros = np.zeros((3, 3))  # Create array of zeros
ones = np.ones(10)  # Create array of ones
random = np.random.rand(5)  # Random array
reshaped = arr.reshape(5, 1)  # Reshape array

# Pandas - Data Analysis
import pandas as pd

df = pd.DataFrame(
    {  # Create DataFrame (hover for practical examples!)
        "name": ["Alice", "Bob", "Charlie"],
        "age": [25, 30, 35],
        "city": ["NYC", "LA", "Chicago"],
    }
)
series = pd.Series([1, 2, 3, 4, 5])  # Create Series
grouped = df.groupby("city")  # Group data

# Matplotlib - Data Visualization
import matplotlib.pyplot as plt

plt.plot([1, 2, 3, 4], [1, 4, 9, 16])  # Create plot
plt.scatter([1, 2, 3], [4, 5, 6])  # Scatter plot
plt.figure(figsize=(10, 6))  # Create figure

# Requests - HTTP Library
import requests

# response = requests.get("https://api.github.com")    # GET request (hover!)
# data = requests.post("https://api.example.com", json={"key": "value"})  # POST request

# SciPy - Scientific Computing (if installed)
try:
    from scipy import integrate, stats

    # mean = stats.norm.rvs(size=100)     # Random normal distribution
except ImportError:
    pass

# scikit-learn - Machine Learning (if installed)
try:
    from sklearn.linear_model import LinearRegression
    from sklearn.model_selection import train_test_split

    # model = LinearRegression()           # Create model (hover for usage!)
except ImportError:
    pass

# FastAPI - Modern Web Framework (if installed)
try:
    from fastapi import FastAPI

    app = FastAPI()  # Hover to see decorator examples!
except ImportError:
    pass

# Flask - Web Framework (if installed)
try:
    from flask import Flask, jsonify, render_template

    flask_app = Flask(__name__)  # Hover for route examples!
except ImportError:
    pass


# ============================================================================
# 7️⃣ STANDARD LIBRARY - Powerful Built-in Modules
# ============================================================================
print("\n=== STANDARD LIBRARY ===")

import datetime
import json
import math
import os
import random

# OS Module - File system operations
current_dir = os.getcwd()  # Get current directory
file_exists = os.path.exists("demo.py")  # Check file exists
file_list = os.listdir(".")  # List directory contents

# JSON Module - Data serialization
data = {"name": "Python Hover", "version": "0.3.0"}
json_str = json.dumps(data, indent=2)  # Convert to JSON string
parsed = json.loads(json_str)  # Parse JSON string

# DateTime Module - Date and time operations
now = datetime.datetime.now()  # Current datetime
today = datetime.date.today()  # Current date
delta = datetime.timedelta(days=7)  # Time difference

# Random Module - Random number generation
rand_num = random.random()  # Random float [0.0, 1.0)
rand_int = random.randint(1, 100)  # Random integer
choice = random.choice([1, 2, 3, 4])  # Random choice from list

# Math Module - Mathematical functions
sqrt_val = math.sqrt(16)  # Square root
ceil_val = math.ceil(4.2)  # Ceiling function
floor_val = math.floor(4.8)  # Floor function


# ============================================================================
# 8️⃣ FILE OPERATIONS - Context Managers & I/O
# ============================================================================
print("\n=== FILE OPERATIONS ===")

# Hover over 'with' for context manager examples!
# with open("example.txt", "w") as f:
#     f.write("Hello, World!")
#     f.writelines(["Line 1\n", "Line 2\n"])

# with open("example.txt", "r") as f:
#     content = f.read()
#     lines = f.readlines()


# ============================================================================
# 9️⃣ ERROR HANDLING - Exceptions & Try-Catch
# ============================================================================
print("\n=== ERROR HANDLING ===")

# Hover over 'try' for exception handling patterns!
try:
    risky_operation = 10 / 0
except ZeroDivisionError as e:
    print(f"Error: {e}")
except Exception as e:
    print(f"Unexpected error: {e}")
finally:
    print("Cleanup code here")


# ============================================================================
# 🔟 ASYNC/AWAIT - Modern Python Async (if asyncio installed)
# ============================================================================
print("\n=== ASYNC PROGRAMMING ===")

import asyncio


async def fetch_data():
    """Hover over 'async' and 'await' for async patterns!"""
    await asyncio.sleep(1)
    return "Data fetched!"


# asyncio.run(fetch_data())              # Run async function


# ============================================================================
# 📝 QUICK TIPS FOR DEMO/GIF CREATION
# ============================================================================
"""
🎬 BEST SECTIONS TO SHOWCASE IN YOUR GIF:

1. STRING METHODS (lines 20-35)
   - Shows practical examples with outputs
   - Demonstrates context-aware suggestions

2. THIRD-PARTY LIBRARIES (lines 105-145)
   - Highlight NumPy array creation
   - Show Pandas DataFrame documentation
   - Demonstrates major library support

3. SMART COMPARISONS (lines 41-55)
   - Hover over 'append' vs 'extend'
   - Show 'sort()' vs 'sorted()'
   - Demonstrates intelligent suggestions

4. VERSION INFO (lines 36-39)
   - Hover over 'removeprefix'
   - Shows Python version requirements

5. QUICK ACTIONS
   - Show Copy Example button
   - Show Insert Example action
   - Show Open Docs link

📹 GIF RECORDING TIPS:
- Use slow, deliberate mouse movements
- Hover for 2-3 seconds on each method
- Show scrolling through hover content
- Demonstrate clicking quick action buttons
- Record at 1920x1080 for clarity
- Keep GIF under 30 seconds for README
"""

print(
    "\n✅ Demo file loaded! Hover over ANY highlighted method to see Python Hover in action!"
)
print("🎯 Perfect for creating promotional GIFs and screenshots!")
