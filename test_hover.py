"""PyHover test file — hover over any of the symbols below to see the improved UI."""

import os
import os.path
import asyncio
from typing import Optional, List, Union

import numpy as np
import pandas as pd

# ── Builtins ──────────────────────────────────────────────────────────────────
x = [1, 2, 3]  # hover over [  →  list
y = {"a": 1}  # hover over {  →  dict
z = "hello"  # hover over "  →  str
n = None  # hover over None
e = ...  # hover over ...  →  Ellipsis

result = len(x)  # hover over len
items = list(range(10))  # hover over list, range
pairs = zip(x, x)  # hover over zip
evens = filter(None, x)  # hover over filter
mapped = map(str, x)  # hover over map
found = isinstance(x, list)  # hover over isinstance

# ── stdlib ────────────────────────────────────────────────────────────────────
joined = os.path.join("a", "b", "c")  # hover over join
exists = os.path.exists("/tmp")  # hover over exists
expanded = os.path.expanduser("~")  # hover over expanduser
listed = os.listdir(".")  # hover over listdir

# ── Keywords ──────────────────────────────────────────────────────────────────
for i in range(3):  # hover over for
    if i > 1:  # hover over if
        pass  # hover over pass


async def fetch():  # hover over async
    await asyncio.sleep(0)  # hover over await


def gen():
    yield 42  # hover over yield


# ── Third-party ───────────────────────────────────────────────────────────────
arr = np.array([1, 2, 3])  # hover over array
mean = np.mean(arr)  # hover over mean
df = pd.DataFrame({"a": [1]})  # hover over DataFrame
agg = df.agg("sum")  # hover over agg


# ── Typing ────────────────────────────────────────────────────────────────────
def greet(name: Optional[str] = None) -> str:  # hover over Optional
    return f"Hello {name}"


def process(items: List[Union[int, str]]) -> None:  # hover over Union
    pass


# ── Local code ────────────────────────────────────────────────────────────────
class Person:
    """A simple person class."""

    def __init__(self, name: str, age: int):
        self.name = name
        self.age = age

    def greet(self) -> str:
        """Return a greeting."""
        return f"Hi, I'm {self.name}"


p = Person("Alice", 30)
msg = p.greet()  # hover over greet
