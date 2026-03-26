"""PyHover test file — hover over any of the symbols below to see the improved UI."""

import asyncio
import os
import os.path
from pathlib import Path
from typing import List, Optional, Union

import click
import fastapi
import numpy as np
import pandas as pd

# ── Builtins ──────────────────────────────────────────────────────────────────
x = [1, 2, 3]  # hover over [  →  list
y = {"a": 1}  # hover over {  →  dict
z = "hello"  # hover over "  →  str
template = f"value={z}"  # hover over the leading f / opening quote  →  f-string docs
n = None  # hover over None
e = ...  # hover over ...  →  Ellipsis

click.File

fastapi.FastAPI().middleware  # hover over FastAPI
fastapi.FastAPI().add_middleware  # hover over add_middleware
fastapi.FastAPI().get  # hover over get

result = len(x)  # hover over len
items = list(range(10))  # hover over list, range
pairs = zip(x, x)  # hover over zip
evens = filter(None, x)  # hover over filter
mapped = map(str, x)  # hover over map
found = isinstance(x, list)  # hover over isinstance
joined_text = ", ".join(["a", "b"])  # hover over join
lookup = {"name": "atlas"}.get("name")  # hover over get
appended = x.copy()  # hover over copy
appended.append(4)  # hover over append

# ── stdlib ────────────────────────────────────────────────────────────────────
joined = os.path.join("a", "b", "c")  # hover over join
exists = os.path.exists("/tmp")  # hover over exists
expanded = os.path.expanduser("~")  # hover over expanduser
listed = os.listdir(".")  # hover over listdir
path_exists = Path(".").exists()  # hover over exists
path_name = Path("file.txt").with_suffix(".md")  # hover over with_suffix

# ── Keywords ──────────────────────────────────────────────────────────────────
for i in range(3):  # hover over for
    if i > 1:  # hover over if
        pass  # hover over pass

match x:  # hover over match
    case [first, *rest]:  # hover over case
        matched = first, rest

value = 1 if x else 0  # hover over if / else
nums = [item for item in x if item % 2 == 0]  # hover over for / if
mapping = {item: item * 2 for item in x}  # hover over for
frozen = {item for item in x}  # hover over for
generator = (item * 2 for item in x)  # hover over for

with open(__file__, "r", encoding="utf-8") as handle:  # hover over with / as / open
    preview = handle.readline()  # hover over readline


async def fetch():  # hover over async
    await asyncio.sleep(0)  # hover over await


def gen():
    yield 42  # hover over yield


# ── Third-party ───────────────────────────────────────────────────────────────
arr = np.array([1, 2, 3])  # hover over array
mean = np.mean(arr)  # hover over mean
df = pd.DataFrame({"a": [1]})  # hover over DataFrame
agg = df.agg("sum")  # hover over agg
grouped = df.groupby("a")  # hover over groupby
renamed = df.rename(columns={"a": "value"})  # hover over rename
series_text = df["a"].astype(str)  # hover over astype


# ── Typing ────────────────────────────────────────────────────────────────────
def greet(name: Optional[str] = None) -> str:  # hover over Optional
    return f"Hello {name}"


debug_label = f"{x=} {joined_text}"  # hover over the f-string prefix / opening quote


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
person_name = p.name.upper()  # hover over upper
person_badge = f"{p.name=} ({p.age})"  # hover over the f-string prefix / opening quote


@staticmethod
class Employee(Person):
    """A simple employee class."""
