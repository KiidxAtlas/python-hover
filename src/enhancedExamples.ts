/**
 * Enhanced examples with practical code snippets and type hints
 * Imported from the deprecated version of python-hover
 */

export interface EnhancedExampleEntry {
    content: string;
    description?: string;
}

export const ENHANCED_EXAMPLES: Record<string, EnhancedExampleEntry> = {
    // Language constructs
    'class': {
        content: '```python\n# Basic class definition\nclass Person:\n    def __init__(self, name: str, age: int):\n        self.name = name\n        self.age = age\n    \n    def __repr__(self) -> str:\n        return f"Person(\'{self.name}\', {self.age})"\n    \n    def greet(self) -> str:\n        return f"Hello, I\'m {self.name}"\n\n# Inheritance\nclass Student(Person):\n    def __init__(self, name: str, age: int, student_id: str):\n        super().__init__(name, age)\n        self.student_id = student_id\n\n# Usage\nperson = Person("Alice", 30)\nstudent = Student("Bob", 20, "S123")\n```',
        description: 'Define a new class'
    },

    'def': {
        content: '```python\n# Function with type hints\ndef calculate_area(length: float, width: float) -> float:\n    """Calculate the area of a rectangle."""\n    return length * width\n\n# Function with default parameters\ndef greet(name: str, greeting: str = "Hello") -> str:\n    return f"{greeting}, {name}!"\n\n# Function with *args and **kwargs\ndef flexible_function(*args, **kwargs):\n    print(f"Args: {args}")\n    print(f"Kwargs: {kwargs}")\n\n# Async function\nasync def fetch_data(url: str) -> dict:\n    # Simulated async operation\n    return {"data": "example"}\n```',
        description: 'Define a function'
    },

    'import': {
        content: '```python\n# Basic imports\nimport os\nimport sys\nimport math\n\n# Import with alias\nimport numpy as np\nimport pandas as pd\n\n# Import specific items\nfrom datetime import datetime, timedelta\nfrom collections import defaultdict, Counter\n\n# Import all (use sparingly)\nfrom math import *\n\n# Conditional imports\ntry:\n    import ujson as json\nexcept ImportError:\n    import json\n\n# Relative imports (in packages)\nfrom . import utils\nfrom ..models import User\n```',
        description: 'Import modules'
    },

    'try': {
        content: '```python\n# Basic exception handling\ntry:\n    result = 10 / 0\nexcept ZeroDivisionError as e:\n    print(f"Error: {e}")\nexcept Exception as e:\n    print(f"Unexpected error: {e}")\nelse:\n    print("No exceptions occurred")\nfinally:\n    print("Cleanup code")\n\n# Multiple exception types\ntry:\n    data = json.loads(user_input)\n    value = data[\'key\']\nexcept (json.JSONDecodeError, KeyError) as e:\n    print(f"Data processing error: {e}")\n\n# Re-raising exceptions\ntry:\n    risky_operation()\nexcept ValueError:\n    log_error("ValueError occurred")\n    raise  # Re-raise the same exception\n```',
        description: 'Handle exceptions'
    },

    'with': {
        content: '```python\n# File handling\nwith open(\'file.txt\', \'r\') as f:\n    content = f.read()\n\n# Multiple context managers\nwith open(\'input.txt\', \'r\') as infile, open(\'output.txt\', \'w\') as outfile:\n    data = infile.read()\n    outfile.write(data.upper())\n\n# Custom context manager\nfrom contextlib import contextmanager\n\n@contextmanager\ndef timer():\n    start = time.time()\n    try:\n        yield\n    finally:\n        print(f"Elapsed: {time.time() - start:.2f}s")\n\nwith timer():\n    time.sleep(1)\n\n# Async context manager\nasync with aiohttp.ClientSession() as session:\n    async with session.get(\'https://api.example.com\') as response:\n        data = await response.json()\n```',
        description: 'Context manager'
    },

    'for': {
        content: '```python\n# Iterating over sequences\nfruits = [\'apple\', \'banana\', \'cherry\']\nfor fruit in fruits:\n    print(fruit)\n\n# With enumerate for indices\nfor i, fruit in enumerate(fruits):\n    print(f"{i}: {fruit}")\n\n# Dictionary iteration\nuser = {\'name\': \'Alice\', \'age\': 30, \'city\': \'New York\'}\nfor key, value in user.items():\n    print(f"{key}: {value}")\n\n# Range iterations\nfor i in range(5):        # 0, 1, 2, 3, 4\n    print(i)\n\nfor i in range(2, 8, 2):  # 2, 4, 6\n    print(i)\n\n# List comprehensions (alternative to loops)\nsquares = [x**2 for x in range(10)]\neven_squares = [x**2 for x in range(10) if x % 2 == 0]\n```',
        description: 'Loop over a sequence'
    },

    'lambda': {
        content: '```python\n# Basic lambda functions\nsquare = lambda x: x**2\nadd = lambda x, y: x + y\n\n# Using with built-in functions\nnumbers = [1, 2, 3, 4, 5]\nsquared = list(map(lambda x: x**2, numbers))\nevens = list(filter(lambda x: x % 2 == 0, numbers))\n\n# Sorting with lambda\nstudents = [(\'Alice\', 85), (\'Bob\', 90), (\'Charlie\', 78)]\nstudents.sort(key=lambda x: x[1])  # Sort by grade\n\n# Conditional lambda\nmax_val = lambda a, b: a if a > b else b\n```',
        description: 'Create anonymous function'
    },

    // String methods
    'str.upper': {
        content: '```python\n# Convert string to uppercase\n"hello".upper()  # Returns "HELLO"\n\n# Useful for case-insensitive comparisons\nuser_input = "yes"\nif user_input.upper() == "YES":\n    print("User agreed")\n\n# Works with any string, including variables\nname = "alice"\ngreeting = f"Hello, {name.upper()}!"  # "Hello, ALICE!"\n```',
        description: 'Convert string to uppercase'
    },

    'str.lower': {
        content: '```python\n# Convert string to lowercase\n"HELLO".lower()  # Returns "hello"\n\n# Case normalization for comparison\nemail = "User@Example.COM"\nnormalized = email.lower()  # "user@example.com"\n\n# Case-insensitive validation\nresponse = "YES"\nif response.lower() == "yes":\n    print("Affirmative response")\n```',
        description: 'Convert string to lowercase'
    },

    'str.split': {
        content: '```python\n# Split by whitespace (default)\n"hello world".split()  # ["hello", "world"]\n\n# Split by specific delimiter\n"apple,banana,cherry".split(",")  # ["apple", "banana", "cherry"]\n\n# Limit splits with maxsplit parameter\n"a-b-c-d".split("-", maxsplit=2)  # ["a", "b", "c-d"]\n\n# Practical example: parsing CSV data\ndata = "John,25,New York"\nname, age, city = data.split(",")\n```',
        description: 'Split string into list by delimiter'
    },

    'str.join': {
        content: '```python\n# Join list elements into string\n"-".join(["apple", "banana", "cherry"])  # "apple-banana-cherry"\n\n# Empty separator for concatenation\n"".join(["a", "b", "c"])  # "abc"\n\n# Newline separator for multi-line text\nlines = ["First line", "Second line", "Third line"]\ntext = "\\n".join(lines)\n\n# Joining path components\npath = "/".join(["home", "user", "documents", "file.txt"])  # "home/user/documents/file.txt"\n```',
        description: 'Join iterable elements with string'
    },

    // List methods
    'list.append': {
        content: '```python\n# Add single element to end of list\nfruits = ["apple", "banana"]\nfruits.append("cherry")  # fruits becomes ["apple", "banana", "cherry"]\n\n# Append any type of object\nnumbers = [1, 2, 3]\nnumbers.append(4)  # [1, 2, 3, 4]\n\n# Note: Appending a list adds it as a single element\nlist1 = [1, 2]\nlist1.append([3, 4])  # list1 becomes [1, 2, [3, 4]]\n\n# To add multiple items individually, use extend() instead\n```',
        description: 'Add item to end of list'
    },

    'list.extend': {
        content: '```python\n# Add multiple items from iterable\nfruits = ["apple", "banana"]\nfruits.extend(["cherry", "date"])  # fruits becomes ["apple", "banana", "cherry", "date"]\n\n# Works with any iterable, not just lists\nnumbers = [1, 2]\nnumbers.extend(range(3, 6))  # numbers becomes [1, 2, 3, 4, 5]\n\n# Extend with string (adds each character)\nchars = ["A", "B"]\nchars.extend("CD")  # chars becomes ["A", "B", "C", "D"]\n\n# Equivalent to: for item in iterable: list.append(item)\n```',
        description: 'Extend list with items from iterable'
    },

    // Dictionary methods
    'dict.keys': {
        content: '```python\n# Get view of dictionary keys\nuser = {"name": "Alice", "age": 30, "city": "New York"}\nkeys = user.keys()  # dict_keys(["name", "age", "city"])\n\n# Convert to list if needed\nkey_list = list(user.keys())  # ["name", "age", "city"]\n\n# Iterate over keys\nfor key in user.keys():\n    print(f"Key: {key}, Value: {user[key]}")\n\n# Views are dynamic - they reflect dictionary changes\nuser["email"] = "alice@example.com"\n# Now keys contains "email" too\n```',
        description: 'Get view of dictionary keys'
    },

    'dict.values': {
        content: '```python\n# Get view of dictionary values\nuser = {"name": "Alice", "age": 30, "city": "New York"}\nvalues = user.values()  # dict_values(["Alice", 30, "New York"])\n\n# Convert to list if needed\nvalue_list = list(user.values())  # ["Alice", 30, "New York"]\n\n# Iterate over values\nfor value in user.values():\n    print(f"Value: {value}")\n\n# Calculate statistics\nnumbers = {"a": 10, "b": 20, "c": 30}\ntotal = sum(numbers.values())  # 60\naverage = total / len(numbers)  # 20.0\n```',
        description: 'Get view of dictionary values'
    },

    'dict.items': {
        content: '```python\n# Get view of (key, value) pairs\nuser = {"name": "Alice", "age": 30, "city": "New York"}\nitems = user.items()  # dict_items([("name", "Alice"), ("age", 30), ("city", "New York")])\n\n# Iterate over key-value pairs\nfor key, value in user.items():\n    print(f"{key}: {value}")\n\n# Unpack in list comprehension\nupper_items = {k.upper(): v for k, v in user.items()}\n# {"NAME": "Alice", "AGE": 30, "CITY": "New York"}\n\n# Filter dictionary based on values\nfiltered = {k: v for k, v in user.items() if isinstance(v, str)}\n# {"name": "Alice", "city": "New York"}\n```',
        description: 'Get view of dictionary key-value pairs'
    },

    // Special dunder methods
    '__init__': {
        content: '```python\n# Basic constructor\nclass Person:\n    def __init__(self, name, age):\n        self.name = name\n        self.age = age\n\n# Constructor with type hints\nclass Rectangle:\n    def __init__(self, width: float, height: float):\n        self.width = width\n        self.height = height\n\n# Constructor with default values\nclass Config:\n    def __init__(self, path=None, defaults=None, **kwargs):\n        self.path = path or "config.ini"\n        self.defaults = defaults or {}\n        self.options = kwargs\n\n# Constructor with validation\nclass Circle:\n    def __init__(self, radius):\n        if radius <= 0:\n            raise ValueError("Radius must be positive")\n        self.radius = radius\n```',
        description: 'Initialize a new instance'
    },

    '__str__': {
        content: '```python\n# User-friendly string representation\nclass Person:\n    def __init__(self, name, age):\n        self.name = name\n        self.age = age\n    \n    def __str__(self) -> str:\n        return f"{self.name}, {self.age} years old"\n\n# Usage:\nperson = Person("Alice", 30)\nprint(person)  # "Alice, 30 years old"\nstr(person)    # "Alice, 30 years old"\n\n# Called by print() and str()\n```',
        description: 'User-friendly string representation'
    },

    '__repr__': {
        content: '```python\n# Official string representation\nclass Point:\n    def __init__(self, x, y):\n        self.x = x\n        self.y = y\n    \n    def __repr__(self) -> str:\n        return f"Point({self.x}, {self.y})"\n\n# Usage:\npoint = Point(3, 4)\nrepr(point)  # "Point(3, 4)"\npoint        # Point(3, 4)  - in interactive console\n\n# Fallback for __str__ if not defined\n# Good practice: output should be valid Python code\n```',
        description: 'Official string representation'
    }
};