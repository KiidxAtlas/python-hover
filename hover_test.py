# Python Hover Test File
# Test built-in functions
result = len("hello")
print(f"Result: {result}")

# Test string methods
text = "Hello, World!"
words = text.split(", ")
lower_text = text.lower()

# Test list methods
numbers = [1, 2, 3]
numbers.append(4)
numbers.extend([5, 6])

# Test exceptions
try:
    x = 10 / 0
except ZeroDivisionError as e:
    print("Error!")

# Test dict methods
data = {"name": "John"}
keys = data.keys()
values = data.values()

# Test other builtins
my_str = str(42)
my_int = int("42")
my_list = list([1, 2, 3])
