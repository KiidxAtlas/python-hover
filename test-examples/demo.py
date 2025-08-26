# Test file to demonstrate Python hover documentation
import json
import os
from collections import defaultdict

# Test builtin functions
result = len("hello world")
print(f"Length: {result}")

# Test string methods
text = "Hello, World!"
words = text.split(", ")
lowercase = text.lower()

# Test list methods
numbers = [1, 2, 3]
numbers.append(4)
numbers.extend([5, 6])

# Test dict methods
data = {"name": "John", "age": 30}
keys = data.keys()
values = data.values()

# Test exceptions
try:
    result = 10 / 0
except ZeroDivisionError as e:
    print(f"Error: {e}")

# Test keywords and control flow
for i in range(5):
    if i % 2 == 0:
        continue
    else:
        break


# Test decorators
class MyClass:
    def __init__(self, value):
        self._value = value

    @property
    def value(self):
        return self._value

    @staticmethod
    def static_method():
        return "static"

    @classmethod
    def class_method(cls):
        return cls


# Test module functions
json_data = json.dumps({"key": "value"})
parsed = json.loads(json_data)

# Test os module
current_dir = os.getcwd()
files = os.listdir(".")

# Test type conversions
num_str = str(42)
num_int = int("42")
num_float = float("3.14")

# Test built-in types
my_set = set([1, 2, 3, 2])
my_tuple = tuple([1, 2, 3])
my_dict = dict(a=1, b=2)
