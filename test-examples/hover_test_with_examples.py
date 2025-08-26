# Test Examples for Python Hover with Examples

# Hover over these to see documentation WITH examples:

# Built-in functions with rich examples
result = len("hello world")  # Hover over 'len'
numbers = list(range(10))  # Hover over 'list' or 'range'
text = str.upper("hello")  # Hover over 'upper'

# String methods with examples
message = "Hello, World!"
upper_msg = message.upper()  # Hover over 'upper'
words = message.split(",")  # Hover over 'split'
new_msg = message.replace("Hello", "Hi")  # Hover over 'replace'

# List methods with examples
my_list = [1, 2, 3]
my_list.append(4)  # Hover over 'append'
my_list.extend([5, 6])  # Hover over 'extend'
item = my_list.pop()  # Hover over 'pop'

# Dictionary methods with examples
my_dict = {"a": 1, "b": 2}
keys = my_dict.keys()  # Hover over 'keys'
values = my_dict.values()  # Hover over 'values'
default_val = my_dict.get("c", 0)  # Hover over 'get'


# Special methods (dunder methods) with examples
class Example:
    def __init__(self, value):  # Hover over '__init__'
        self.value = value

    def __str__(self):  # Hover over '__str__'
        return f"Example({self.value})"

    def __len__(self):  # Hover over '__len__'
        return len(str(self.value))


# Test the extension with these hovers - you should now see examples!
