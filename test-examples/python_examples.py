"""
Python Documentation Hover Examples

This file contains comprehensive examples to test and demonstrate
the Python hover documentation extension. Hover over any Python
keyword, function, class, or method to see the documentation.
"""

# =============================================================================
# BUILT-IN FUNCTIONS
# =============================================================================

# Basic built-ins - hover over these function names
result = len([1, 2, 3, 4, 5])
maximum = max(10, 20, 30)
minimum = min(5, 15, 25)
text = str(42)
number = int("123")
decimal = float("3.14")

# Collections and iteration
items = list(range(10))
unique_items = set([1, 2, 2, 3, 3, 4])
pairs = dict(a=1, b=2, c=3)
filtered = filter(lambda x: x > 5, items)
mapped = map(lambda x: x * 2, items)

# Advanced built-ins
is_instance = isinstance(text, str)
has_attr = hasattr(text, "upper")
obj_id = id(text)
obj_type = type(text)


# =============================================================================
# CLASSES WITH DUNDER METHODS AND DECORATORS
# =============================================================================


class Person:
    """A simple person class demonstrating common dunder methods."""

    def __init__(self, name, age):
        """Initialize a new person."""
        self.name = name
        self.age = age

    def __str__(self):
        """Return string representation."""
        return f"Person(name='{self.name}', age={self.age})"

    def __repr__(self):
        """Return official string representation."""
        return f"Person('{self.name}', {self.age})"

    def __eq__(self, other):
        """Check equality with another person."""
        if not isinstance(other, Person):
            return False
        return self.name == other.name and self.age == other.age

    def __lt__(self, other):
        """Compare persons by age."""
        return self.age < other.age

    def __len__(self):
        """Return length of name."""
        return len(self.name)

    def __call__(self, greeting="Hello"):
        """Make person callable."""
        return f"{greeting}, I'm {self.name}!"


class Container:
    """A container class demonstrating item access dunder methods."""

    def __init__(self):
        self._items = {}

    def __getitem__(self, key):
        """Get item by key."""
        return self._items[key]

    def __setitem__(self, key, value):
        """Set item by key."""
        self._items[key] = value

    def __delitem__(self, key):
        """Delete item by key."""
        del self._items[key]

    def __contains__(self, key):
        """Check if key exists."""
        return key in self._items

    def __iter__(self):
        """Return iterator."""
        return iter(self._items)

    def __len__(self):
        """Return number of items."""
        return len(self._items)


class MathOperations:
    """Class demonstrating arithmetic dunder methods."""

    def __init__(self, value):
        self.value = value

    def __add__(self, other):
        """Addition operator."""
        return MathOperations(self.value + other.value)

    def __sub__(self, other):
        """Subtraction operator."""
        return MathOperations(self.value - other.value)

    def __mul__(self, other):
        """Multiplication operator."""
        return MathOperations(self.value * other.value)

    def __truediv__(self, other):
        """Division operator."""
        return MathOperations(self.value / other.value)

    def __pow__(self, other):
        """Power operator."""
        return MathOperations(self.value**other.value)


class ContextManager:
    """Class demonstrating context manager protocol."""

    def __enter__(self):
        """Enter context manager."""
        print("Entering context")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Exit context manager."""
        print("Exiting context")
        return False


# =============================================================================
# DECORATORS
# =============================================================================


class DecoratedClass:
    """Class demonstrating various decorators."""

    @property
    def name(self):
        """Name property getter."""
        return self._name

    @name.setter
    def name(self, value):
        """Name property setter."""
        self._name = value

    @staticmethod
    def utility_function():
        """Static method example."""
        return "This is a static method"

    @classmethod
    def create_default(cls):
        """Class method example."""
        return cls()

    def __init__(self):
        self._name = "Default"


# =============================================================================
# KEYWORDS AND CONTROL FLOW
# =============================================================================


# Class definition
class SimpleClass:
    """Simple class for keyword demonstration."""

    pass


# Function definition
def sample_function():
    """Sample function for keyword demonstration."""
    pass


# Control flow keywords
for i in range(5):
    if i == 2:
        continue
    elif i == 4:
        break
    else:
        pass

# Exception handling
try:
    result = 10 / 0
except ZeroDivisionError:
    print("Division by zero!")
finally:
    print("Cleanup")

# Context manager usage
with open(__file__) as f:
    content = f.read(100)

# Lambda functions
square = lambda x: x**2

# List comprehension with conditionals
numbers = [x for x in range(10) if x % 2 == 0]


# Generator function
def count_up():
    """Generator function example."""
    i = 0
    while i < 5:
        yield i
        i += 1


# Async function (hover over async/await)
async def async_function():
    """Async function example."""
    await some_async_operation()


async def some_async_operation():
    """Mock async operation."""
    pass


# =============================================================================
# SPECIAL METHODS USAGE EXAMPLES
# =============================================================================

# Create instances to test dunder methods
person1 = Person("Alice", 30)
person2 = Person("Bob", 25)

# Test string representations (__str__, __repr__)
print(str(person1))  # Hover over 'str'
print(repr(person1))  # Hover over 'repr'

# Test comparison methods (__eq__, __lt__)
are_equal = person1 == person2
is_younger = person2 < person1

# Test length (__len__)
name_length = len(person1)

# Test callable (__call__)
greeting = person1("Hi")

# Test container operations
container = Container()
container["key"] = "value"  # __setitem__
value = container["key"]  # __getitem__
has_key = "key" in container  # __contains__
del container["key"]  # __delitem__

# Test arithmetic operations
math1 = MathOperations(10)
math2 = MathOperations(5)
sum_result = math1 + math2  # __add__
diff_result = math1 - math2  # __sub__
product = math1 * math2  # __mul__
quotient = math1 / math2  # __truediv__
power = math1**math2  # __pow__

# Test context manager
with ContextManager() as cm:  # __enter__, __exit__
    print("Inside context")


# =============================================================================
# DATA TYPES AND COLLECTIONS
# =============================================================================

# Basic types - hover over type names and methods
text = "Hello, World!"
text_upper = text.upper()
text_split = text.split(",")
text_replace = text.replace("World", "Python")

# Lists - hover over methods
my_list = [1, 2, 3, 4, 5]
my_list.append(6)
my_list.extend([7, 8, 9])
my_list.insert(0, 0)
popped = my_list.pop()
my_list.reverse()
my_list.sort()

# Dictionaries - hover over methods
my_dict = {"a": 1, "b": 2, "c": 3}
keys = my_dict.keys()
values = my_dict.values()
items = my_dict.items()
value = my_dict.get("a", 0)
my_dict.update({"d": 4})

# Sets - hover over methods
my_set = {1, 2, 3, 4, 5}
my_set.add(6)
my_set.remove(1)
my_set.discard(10)  # Won't raise error if not found
union_set = my_set.union({7, 8, 9})
intersection = my_set.intersection({3, 4, 5, 6, 7})


# =============================================================================
# TESTING EXAMPLES
# =============================================================================

if __name__ == "__main__":
    # Test all the examples
    print("Testing Python hover documentation...")

    # Test person class
    alice = Person("Alice", 30)
    print(f"Created person: {alice}")
    print(f"Person length: {len(alice)}")
    print(f"Person callable: {alice('Hey')}")

    # Test container
    container = Container()
    container["test"] = "value"
    print(f"Container has 'test': {'test' in container}")

    # Test math operations
    a = MathOperations(10)
    b = MathOperations(3)
    print(f"10 + 3 = {(a + b).value}")

    print("All examples ready for hover testing!")
