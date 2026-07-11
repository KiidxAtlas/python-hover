import json


def greet(name: str) -> str:
    """Return a friendly greeting for name."""
    return f"Hello, {name}!"


result = json.dumps({"a": 1})
print(greet("world"))
