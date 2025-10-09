"""
Python Hover Extension - Demo File
===================================

This file demonstrates all the features of the Python Hover extension.
Hover over any symbol, method, class, or keyword to see rich documentation!

Features demonstrated:
1. Built-in Python functions and methods
2. Standard library modules and functions
3. Third-party library support (if installed and auto-detect enabled)
4. Keywords and control flow
5. Special methods (dunder methods)
6. Type hints and data structures
7. Custom libraries (if configured)
"""

# ============================================================================
# 1. BUILT-IN FUNCTIONS
# ============================================================================
print("Testing built-in functions...")

# Hover over these built-in functions to see documentation
result = len([1, 2, 3, 4, 5])
text = str(42)
numbers = list(range(10))
maximum = max([1, 5, 3, 9, 2])
minimum = min([1, 5, 3, 9, 2])
total = sum([1, 2, 3, 4, 5])

# More built-ins
opened_file = open("test.txt", "r")  # Hover over 'open'
formatted = format(3.14159, ".2f")  # Hover over 'format'
is_instance = isinstance(42, int)  # Hover over 'isinstance'
has_attr = hasattr(str, "upper")  # Hover over 'hasattr'


# ============================================================================
# 2. STRING METHODS
# ============================================================================
print("Testing string methods...")

text = "Hello, World!"
# Hover over each method to see documentation and examples
upper_text = text.upper()
lower_text = text.lower()
title_text = text.title()
stripped = text.strip()
replaced = text.replace("World", "Python")
split_text = text.split(",")
joined = "-".join(["a", "b", "c"])
starts = text.startswith("Hello")
ends = text.endswith("!")
found = text.find("World")


# ============================================================================
# 3. LIST METHODS
# ============================================================================
print("Testing list methods...")

numbers = [1, 2, 3, 4, 5]
# Hover over these list methods
numbers.append(6)  # Add to end
numbers.extend([7, 8, 9])  # Add multiple items
numbers.insert(0, 0)  # Insert at position
numbers.remove(5)  # Remove specific value
popped = numbers.pop()  # Remove and return last item
numbers.reverse()  # Reverse in place
numbers.sort()  # Sort in place
count = numbers.count(3)  # Count occurrences
index = numbers.index(4)  # Find index


# ============================================================================
# 4. DICTIONARY METHODS
# ============================================================================
print("Testing dictionary methods...")

data = {"name": "John", "age": 30, "city": "New York"}
# Hover over dict methods
keys = data.keys()
values = data.values()
items = data.items()
name = data.get("name", "Unknown")
data.update({"country": "USA"})
popped_value = data.pop("age")
data.setdefault("phone", "555-0100")
copied = data.copy()


# ============================================================================
# 5. KEYWORDS AND CONTROL FLOW
# ============================================================================
print("Testing keywords...")

# Hover over keywords to see documentation
if True:  # Hover over 'if'
    pass  # Hover over 'pass'
elif False:  # Hover over 'elif'
    pass
else:  # Hover over 'else'
    pass

# Loops
for i in range(5):  # Hover over 'for' and 'range'
    if i == 2:
        continue  # Hover over 'continue'
    if i == 4:
        break  # Hover over 'break'

while False:  # Hover over 'while'
    pass

# Try-except
try:  # Hover over 'try'
    x = 1 / 1
except ZeroDivisionError:  # Hover over 'except'
    print("Error")
finally:  # Hover over 'finally'
    print("Cleanup")

# With statement
with open("test.txt", "w") as f:  # Hover over 'with' and 'as'
    f.write("test")

# Lambda and comprehensions
square = lambda x: x**2  # Hover over 'lambda'
squares = [x**2 for x in range(10)]  # Hover over the list comprehension
is_even = {x: x % 2 == 0 for x in range(10)}  # Hover over dict comprehension


# ============================================================================
# 6. CLASSES AND SPECIAL METHODS (DUNDER METHODS)
# ============================================================================
print("Testing classes and special methods...")


class Person:
    """Example class to demonstrate special methods."""

    def __init__(self, name: str, age: int):  # Hover over __init__
        """Initialize a Person instance."""
        self.name = name
        self.age = age

    def __str__(self):  # Hover over __str__
        """String representation."""
        return f"{self.name} ({self.age})"

    def __repr__(self):  # Hover over __repr__
        """Developer-friendly representation."""
        return f"Person(name={self.name!r}, age={self.age})"

    def __eq__(self, other):  # Hover over __eq__
        """Check equality."""
        return self.name == other.name and self.age == other.age

    def __len__(self):  # Hover over __len__
        """Return length (name length for demo)."""
        return len(self.name)

    def __call__(self):  # Hover over __call__
        """Make instance callable."""
        return f"Hello from {self.name}"


person = Person("Alice", 30)
print(str(person))  # Triggers __str__
print(repr(person))  # Triggers __repr__
print(len(person))  # Triggers __len__
print(person())  # Triggers __call__


# ============================================================================
# 7. STANDARD LIBRARY - os module
# ============================================================================
print("Testing os module...")

import os

# Hover over os and its methods
current_dir = os.getcwd()  # Get current directory
files = os.listdir(".")  # List directory contents
path_exists = os.path.exists(".")  # Check if path exists
is_file = os.path.isfile(__file__)  # Check if file
is_dir = os.path.isdir(".")  # Check if directory
joined_path = os.path.join("dir", "file.txt")  # Join paths
basename = os.path.basename(__file__)  # Get filename
dirname = os.path.dirname(__file__)  # Get directory


# ============================================================================
# 8. STANDARD LIBRARY - math module
# ============================================================================
print("Testing math module...")

import math

# Hover over math constants and functions
pi = math.pi  # Mathematical constant π
e = math.e  # Mathematical constant e
sqrt_value = math.sqrt(16)  # Square root
pow_value = math.pow(2, 10)  # Power function
log_value = math.log(100, 10)  # Logarithm
sin_value = math.sin(math.pi / 2)  # Sine
cos_value = math.cos(0)  # Cosine
ceil_value = math.ceil(3.2)  # Ceiling
floor_value = math.floor(3.8)  # Floor
factorial = math.factorial(5)  # Factorial


# ============================================================================
# 9. STANDARD LIBRARY - datetime module
# ============================================================================
print("Testing datetime module...")

from datetime import date, datetime, time, timedelta

# Hover over datetime classes and methods
now = datetime.now()  # Current datetime
today = date.today()  # Current date
current_time = time(12, 30, 0)  # Time object
delta = timedelta(days=7)  # Time difference
week_later = now + delta  # Date arithmetic
formatted = now.strftime("%Y-%m-%d %H:%M:%S")  # Format datetime


# ============================================================================
# 10. STANDARD LIBRARY - json module
# ============================================================================
print("Testing json module...")

import json

# Hover over json methods
data_dict = {"name": "Alice", "age": 30, "active": True}
json_string = json.dumps(data_dict)  # Dict to JSON string
parsed_data = json.loads(json_string)  # JSON string to dict


# ============================================================================
# 11. STANDARD LIBRARY - re module (Regular Expressions)
# ============================================================================
print("Testing re module...")

import re

# Hover over re functions
pattern = r"\d+"
text = "There are 42 apples and 15 oranges"
matches = re.findall(pattern, text)  # Find all matches
match = re.search(pattern, text)  # Search for first match
replaced = re.sub(pattern, "X", text)  # Replace matches
split_text = re.split(r"\s+", text)  # Split by pattern


# ============================================================================
# 12. THIRD-PARTY LIBRARIES (if installed and auto-detect enabled)
# ============================================================================
print("Testing third-party libraries...")

# NumPy examples (if installed)
try:
    import numpy as np

    # Hover over numpy functions and methods
    array = np.array([1, 2, 3, 4, 5])
    zeros = np.zeros((3, 3))
    ones = np.ones((2, 4))
    arange = np.arange(0, 10, 2)
    linspace = np.linspace(0, 1, 5)
    mean = np.mean(array)
    std = np.std(array)
    reshaped = array.reshape(5, 1)
except ImportError:
    print("NumPy not installed - enable auto-detect and install to see docs")

# Pandas examples (if installed)
try:
    import pandas as pd

    # Hover over pandas functions and methods
    df = pd.DataFrame({"A": [1, 2, 3], "B": [4, 5, 6]})
    series = pd.Series([1, 2, 3, 4, 5])
    csv_data = pd.read_csv("data.csv")  # Hover over read_csv
    head = df.head()
    tail = df.tail()
    describe = df.describe()
except ImportError:
    print("Pandas not installed - enable auto-detect and install to see docs")

# Requests examples (if installed)
try:
    import requests

    # Hover over requests methods
    response = requests.get("https://api.example.com")
    json_data = response.json()
    status = response.status_code
except ImportError:
    print("Requests not installed - enable auto-detect and install to see docs")


# ============================================================================
# 13. TYPE HINTS AND ANNOTATIONS
# ============================================================================
print("Testing type hints...")

from typing import Any, Dict, List, Optional, Tuple, Union


def greet(name: str, age: int) -> str:
    """Function with type hints - hover over types."""
    return f"Hello {name}, you are {age} years old"


def process_items(items: List[int]) -> Dict[str, int]:
    """Process a list of items."""
    return {"count": len(items), "sum": sum(items)}


def maybe_value(value: Optional[int] = None) -> Union[int, str]:
    """Function with Optional and Union types."""
    if value is None:
        return "No value"
    return value * 2


# ============================================================================
# 14. COMPREHENSIONS
# ============================================================================
print("Testing comprehensions...")

# List comprehension - hover over 'for', 'in', 'if'
squares = [x**2 for x in range(10) if x % 2 == 0]

# Dict comprehension
square_dict = {x: x**2 for x in range(5)}

# Set comprehension
unique_squares = {x**2 for x in range(-5, 6)}

# Generator expression
square_gen = (x**2 for x in range(10))


# ============================================================================
# 15. ERROR HANDLING
# ============================================================================
print("Testing error handling...")

# Hover over exception types
try:
    result = 10 / 0
except ZeroDivisionError as e:  # Hover over ZeroDivisionError
    print(f"Error: {e}")
except ValueError:  # Hover over ValueError
    print("Value error")
except (TypeError, KeyError):  # Multiple exceptions
    print("Type or Key error")
except Exception as e:  # Hover over Exception
    print(f"Unexpected: {e}")
finally:
    print("Cleanup")

# Raising exceptions
try:
    raise ValueError("Custom error message")  # Hover over 'raise'
except ValueError:
    pass


# ============================================================================
# 16. DECORATORS AND ADVANCED FEATURES
# ============================================================================
print("Testing decorators...")


def decorator(func):
    """Simple decorator."""

    def wrapper(*args, **kwargs):
        print(f"Calling {func.__name__}")
        return func(*args, **kwargs)

    return wrapper


@decorator  # Hover over the decorator
def hello(name: str):
    return f"Hello, {name}!"


# Property decorator
class Circle:
    def __init__(self, radius):
        self._radius = radius

    @property  # Hover over @property
    def radius(self):
        return self._radius

    @radius.setter  # Hover over @radius.setter
    def radius(self, value):
        if value < 0:
            raise ValueError("Radius cannot be negative")
        self._radius = value

    @property
    def area(self):
        return math.pi * self._radius**2


# ============================================================================
# 17. FILE OPERATIONS
# ============================================================================
print("Testing file operations...")

# File methods - hover over each
try:
    with open("demo_test.txt", "w") as f:
        f.write("Hello, World!\n")  # Hover over write
        f.writelines(["Line 1\n", "Line 2\n"])  # Hover over writelines

    with open("demo_test.txt", "r") as f:
        content = f.read()  # Hover over read
        f.seek(0)  # Hover over seek
        lines = f.readlines()  # Hover over readlines
        f.close()  # Hover over close
except Exception as e:
    print(f"File operation error: {e}")


# ============================================================================
# 18. ITERTOOLS (Advanced iteration)
# ============================================================================
print("Testing itertools...")

import itertools

# Hover over itertools functions
counter = itertools.count(start=0, step=2)
cycled = itertools.cycle([1, 2, 3])
repeated = itertools.repeat(10, times=3)
chained = itertools.chain([1, 2], [3, 4])
combined = list(itertools.combinations([1, 2, 3], 2))
permuted = list(itertools.permutations([1, 2, 3], 2))


# ============================================================================
# 19. DISCOVERING SUPPORTED LIBRARIES
# ============================================================================
print("Discovering supported libraries...")

"""
TO SEE ALL INTERSPHINX-ENABLED LIBRARIES:
=========================================

COMMAND PALETTE METHOD (Recommended):
1. Press Ctrl+Shift+P (Cmd+Shift+P on Mac)
2. Type: "Python Hover: Show Supported Libraries"
3. Press Enter
4. View organized list of all supported libraries by category

This shows:
- Built-in libraries (always available)
- Custom libraries (from your settings)
- Auto-detect status
- Total count of supported libraries

CATEGORIES SHOWN:
- Data Science & ML: numpy, pandas, scipy, matplotlib, sklearn, torch, etc.
- Web Development: flask, django, fastapi, aiohttp, requests, etc.
- Testing: pytest, selenium
- Database: sqlalchemy, pydantic
- Utilities: beautifulsoup4, pillow, click, sphinx
- Custom: Any you've added via pythonHover.customLibraries

CHECKING IF A SPECIFIC LIBRARY IS SUPPORTED:
1. Import the library in this file (e.g., "import mylib")
2. Hover over the module name after import
3. If you see documentation, it's supported!
4. If auto-detect is enabled, it will try to fetch docs automatically

COMMON INTERSPHINX-ENABLED LIBRARIES:
(These work if installed and auto-detect is enabled or pre-configured)
"""

# Test if common libraries are installed and have hover support
libraries_to_test = [
    "numpy",
    "pandas",
    "scipy",
    "matplotlib",
    "sklearn",
    "requests",
    "flask",
    "django",
    "fastapi",
    "sqlalchemy",
    "pydantic",
    "pytest",
    "click",
    "sphinx",
    "black",
    "mypy",
    "httpx",
    "aiohttp",
]

print("\nTesting which libraries are installed:")
print("-" * 50)

for lib_name in libraries_to_test:
    try:
        __import__(lib_name)
        print(f"✓ {lib_name:20s} - INSTALLED (try hovering over it!)")
    except ImportError:
        print(f"✗ {lib_name:20s} - Not installed")

print("-" * 50)
print("\nTo enable hover docs for installed libraries:")
print("1. Set pythonHover.experimental.autoDetectLibraries = true")
print("2. Or add to pythonHover.customLibraries in settings")
print("\nUse Command Palette: 'Python Hover: Show Supported Libraries'")
print("=" * 50)


# ============================================================================
# TESTING INSTRUCTIONS
# ============================================================================
"""
HOW TO USE THIS DEMO FILE:
=========================

1. Basic Testing:
   - Hover over any Python keyword (if, for, while, try, etc.)
   - Hover over built-in functions (len, str, print, etc.)
   - Hover over method calls (text.upper(), list.append(), etc.)

2. Standard Library:
   - Import modules are shown at each section
   - Hover over module names (os, math, json, etc.)
   - Hover over module functions (os.path.join, math.sqrt, etc.)

3. Third-Party Libraries (if auto-detect enabled):
   - Install libraries: pip install numpy pandas requests
   - Enable: Set pythonHover.experimental.autoDetectLibraries = true
   - Hover over np.array(), pd.DataFrame(), requests.get(), etc.

4. Custom Libraries:
   - Configure in settings: pythonHover.customLibraries
   - See CUSTOM_LIBRARIES.md for detailed instructions

5. Python Version Display:
   - Look at the bottom-right of each hover tooltip
   - Should show "Python X.Y" (e.g., "Python 3.13")

6. Commands to Test:
   - Ctrl+Shift+P (Cmd+Shift+P on Mac)
   - Try: "Python Hover: Show Supported Libraries"
   - Try: "Python Hover: Clear Cache"
   - Try: "Python Hover: Increase/Decrease Font Size"

7. Configuration to Try:
   - pythonHover.fontSize: "small", "medium", "large"
   - pythonHover.theme: "default", "minimal", "rich"
   - pythonHover.showEmojis: true/false
   - pythonHover.maxSnippetLines: adjust content length
   - pythonHover.debounceDelay: adjust hover delay
"""

print("\n" + "=" * 70)
print("Demo Complete! Hover over any symbol to test the extension.")
print("Check the docstring at the bottom for testing instructions.")
print("=" * 70)
