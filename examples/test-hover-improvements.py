"""
Test file for comprehensive hover improvements

Hover over different items to see enhanced documentation:

1. Module imports - Rich module summaries with metadata
2. Third-party functions - Dynamic Sphinx-parsed documentation
3. Dunder methods - Related methods and comprehensive examples
4. Standard library - All existing features maintained
"""

# Test 1: Module Hovers (hover over the module names)
import pandas  # Should show comprehensive module summary with version, category, exports
import numpy  # Should show NumPy module info with key exports
import flask  # Should show Flask web framework info
import requests  # Should show HTTP client info

# Test 2: Third-Party Library Functions (hover over these)
df = pandas.DataFrame({'A': [1, 2], 'B': [3, 4]})  # Hover over DataFrame
arr = numpy.array([1, 2, 3])  # Hover over array
series = pandas.Series([1, 2, 3])  # Hover over Series

# Test 3: Third-Party Methods (hover over the method names)
df.head()  # Should show rich Sphinx docs with parameters, examples
df.describe()  # Should show statistical summary docs
arr.reshape(3, 1)  # Should show NumPy reshape docs

# Test 4: Dunder Methods (hover over these special methods)
class Person:
    def __init__(self, name, age):  # Should show related: __new__, __del__, __repr__, __str__
        self.name = name
        self.age = age

    def __str__(self):  # Should show related: __repr__, __format__, __bytes__
        return f"{self.name}, {self.age}"

    def __repr__(self):  # Should show related: __str__, __format__
        return f"Person('{self.name}', {self.age})"

    def __eq__(self, other):  # Should show related: __ne__, __lt__, __le__, __gt__, __ge__
        return self.name == other.name and self.age == other.age

    def __add__(self, other):  # Should show related: __radd__, __iadd__, __sub__, __mul__
        return Person(self.name, self.age + other.age)

# Test 5: Standard Library (existing features maintained)
my_list = [1, 2, 3]
my_list.append(4)  # Should show rich stdlib docs with signature, parameters
my_dict = {'a': 1, 'b': 2}
my_dict.get('a')  # Should show get() docs with default parameter
my_str = "hello"
my_str.split(',')  # Should show split() docs

# Test 6: Built-in Functions (existing features)
print("Hello")  # Should show print() signature and parameters
len(my_list)  # Should show len() docs
isinstance(df, pandas.DataFrame)  # Should show isinstance docs

# Test 7: Keywords with Enhanced Examples (existing features)
for i in range(10):  # Hover over 'for'
    if i > 5:  # Hover over 'if'
        break  # Hover over 'break'
    else:  # Hover over 'else'
        continue  # Hover over 'continue'

# Test 8: Context Managers
with open('file.txt', 'r') as f:  # Hover over 'with'
    content = f.read()

# Test 9: Lambda and Comprehensions
squares = [x**2 for x in range(10)]  # Hover over 'for'
filtered = lambda x: x > 5  # Hover over 'lambda'

# Test 10: Exception Handling
try:  # Hover over 'try'
    result = 10 / 0
except ZeroDivisionError:  # Hover over 'except'
    print("Error")
finally:  # Hover over 'finally'
    print("Done")

"""
Expected Improvements in Each Hover:

✅ Module Hovers (pandas, numpy, flask):
   - Version badges (e.g., v1.24.0)
   - Category badges (Data Science, Scientific Computing, Web Framework)
   - Quick actions bar (Docs, PyPI, Copy URL)
   - Rich descriptions from PyPI
   - Package metadata (author, license, Python version)
   - Key exports list (DataFrame, Series, array, etc.)
   - Multiple documentation links
   - Keyboard hints

✅ Third-Party Functions (DataFrame, array, Series):
   - Rich Sphinx-parsed documentation
   - Enhanced parameter tables with types and defaults
   - Return type documentation
   - Multiple examples with titles
   - See Also sections with related functions
   - Notes and warnings sections
   - Deprecation detection
   - Quick actions bar
   - Smart content truncation

✅ Dunder Methods (__init__, __str__, __eq__):
   - Special Method and Dunder badges
   - Quick actions to Python datamodel docs
   - Related methods by category:
     * __init__ shows __new__, __del__, __repr__, __str__
     * __str__ shows __repr__, __format__, __bytes__
     * __eq__ shows __ne__, __lt__, __le__, __gt__, __ge__, __hash__
     * __add__ shows __radd__, __iadd__, __sub__, __mul__
   - Comprehensive usage examples
   - Note about implicit invocation
   - Keyboard hints

✅ All Hovers Now Include:
   - Smart truncation with "Read More" links
   - Consistent badge styling
   - Keyboard hints (F12, Ctrl+Space)
   - Python version footer
   - Theme-aware formatting
   - Configurable features via settings
"""
