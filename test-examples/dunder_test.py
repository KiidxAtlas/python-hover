# Dunder method test file

class MyClass:
    def __init__(self, value):
        # Hover over __init__ to test dunder method hover
        self.value = value
        
    def __str__(self):
        # Hover over __str__ to test dunder method hover
        return f"MyClass({self.value})"
        
    def __repr__(self):
        # Hover over __repr__ to test dunder method hover
        return f"MyClass({repr(self.value)})"
        
    def __len__(self):
        # Hover over __len__ to test dunder method hover
        return len(str(self.value))
        
    def __call__(self, arg):
        # Hover over __call__ to test dunder method hover
        return f"{self.value} called with {arg}"
        
    def __eq__(self, other):
        # Hover over __eq__ to test dunder method hover
        if isinstance(other, MyClass):
            return self.value == other.value
        return False

# Create an instance
obj = MyClass("test")

# Test various dunder methods
print(obj)  # Uses __str__
print(repr(obj))  # Uses __repr__
print(len(obj))  # Uses __len__
print(obj("argument"))  # Uses __call__
print(obj == MyClass("test"))  # Uses __eq__