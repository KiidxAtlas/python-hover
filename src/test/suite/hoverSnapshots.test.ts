import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

// When SNAPSHOT env var is set, this suite captures the actual Markdown content
// of hovers and writes them to artifacts/hover-snapshots for inspection.

suite('Hover Snapshots (real content)', function () {
  // Allow a bit more time when fetching real content
  this.timeout(20000);

  const artifactsDir = path.resolve(__dirname, '../../../artifacts/hover-snapshots');

  let doc: vscode.TextDocument;

  setup(async () => {
    if (!process.env.SNAPSHOT) {
      // Skip entire suite unless explicitly requested
      return;
    }
    const ext = vscode.extensions.getExtension('KiidxAtlas.python-hover');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    // Force real hover pipeline
    await vscode.commands.executeCommand('pythonHover.__test_setBypassShortcut', true);

    // Ensure artifacts directory exists
    fs.mkdirSync(artifactsDir, { recursive: true });

    doc = await vscode.workspace.openTextDocument({ language: 'python', content: '' });
    await vscode.window.showTextDocument(doc);
  });

  teardown(async () => {
    if (!process.env.SNAPSHOT) {
      return;
    }
    await vscode.commands.executeCommand('pythonHover.__test_setBypassShortcut', false);
    // Close all editors to avoid piling up untitled documents across tests
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  async function getHoverMarkdown(content: string, match: string): Promise<string | null> {
    const updated = await vscode.workspace.openTextDocument({ language: 'python', content });
    await vscode.window.showTextDocument(updated);
    const lines = content.split('\n');
    const line = lines.findIndex(l => l.includes(match));
    if (line < 0) return null;
    const char = lines[line].indexOf(match) + Math.floor(match.length / 2);
    const position = new vscode.Position(line, char);
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>('vscode.executeHoverProvider', updated.uri, position);
    if (!hovers || !hovers.length) return null;
    const md = hovers[0].contents[0] as vscode.MarkdownString;
    return (md && md.value) || null;
  }

  function sanitizeFilename(name: string): string {
    return name.replace(/[^a-z0-9._-]+/gi, '-').replace(/-+/g, '-');
  }

  function writeSnapshot(name: string, content: string) {
    const file = path.join(artifactsDir, `${sanitizeFilename(name)}.md`);
    fs.writeFileSync(file, content, 'utf8');
  }

  function itSnapshot(title: string, code: string, hoverOn: string) {
    test(title, async function () {
      if (!process.env.SNAPSHOT) {
        this.skip();
      }
      const md = await getHoverMarkdown(code, hoverOn);
      assert.ok(md, 'Expected a hover result');
      // Write the raw markdown as produced by the provider
      writeSnapshot(title, md!);
    });
  }

  // Core cases mirroring the demo.py examples
  itSnapshot('builtin-range', 'nums = list(range(10))', 'range');
  itSnapshot('keyword-for', 'for i in range(2):\n    pass', 'for');
  itSnapshot('dunder-__init__', 'class A:\n    def __init__(self):\n        pass', '__init__');
  itSnapshot('numpy-array', 'import numpy as np\narr = np.array([1,2,3])', 'array');
  itSnapshot('operator-eq', 'a = 1\nb = 2\n_ = a == b', '==');
  itSnapshot('f-string', 'name = "Ada"\nmsg = f"Hello {name}!"', 'f"Hello');

  // Builtins
  itSnapshot('builtin-len', 'n = len([1,2,3])', 'len');
  itSnapshot('builtin-print', 'print("hello")', 'print');
  itSnapshot('builtin-open', 'with open("demo_test.txt", "w") as f:\n    f.write("x")', 'open');
  itSnapshot('builtin-isinstance', 'is_instance = isinstance(42, int)', 'isinstance');
  itSnapshot('builtin-hasattr', 'has_attr = hasattr(str, "upper")', 'hasattr');
  itSnapshot('builtin-sum', 'total = sum([1,2,3])', 'sum');
  itSnapshot('builtin-max', 'm = max([1,5,3])', 'max');
  itSnapshot('builtin-min', 'm = min([1,5,3])', 'min');

  // Keywords and control flow
  itSnapshot('keyword-if', 'x=1\nif x:\n    pass', 'if');
  itSnapshot('keyword-elif', 'x=1\nif x==0:\n    pass\nelif x==1:\n    pass', 'elif');
  itSnapshot('keyword-else', 'x=0\nif x:\n    pass\nelse:\n    pass', 'else');
  itSnapshot('keyword-while', 'i=0\nwhile i<2:\n    i+=1', 'while');
  itSnapshot('keyword-continue', 'for i in range(3):\n    if i==1:\n        continue', 'continue');
  itSnapshot('keyword-break', 'for i in range(3):\n    if i==1:\n        break', 'break');
  itSnapshot('keyword-try-except-finally', 'try:\n    1/0\nexcept ZeroDivisionError:\n    pass\nfinally:\n    pass', 'try');
  itSnapshot('keyword-with-as', 'with open("x.txt","w") as f:\n    f.write("x")', 'with');
  itSnapshot('keyword-lambda', 'square = lambda x: x*x', 'lambda');
  itSnapshot('keyword-raise', 'def f():\n    raise ValueError("err")', 'raise');
  itSnapshot('keyword-assert', 'assert 2+2 == 4', 'assert');
  itSnapshot('keyword-import', 'import json', 'import');
  itSnapshot('keyword-from', 'from math import sqrt\nsqrt(4)', 'from');
  itSnapshot('keyword-def', 'def foo(x):\n    return x', 'def');
  itSnapshot('keyword-class', 'class C: pass', 'class');
  itSnapshot('keyword-return', 'def g():\n    return 1', 'return');
  itSnapshot('keyword-global', 'global x\nx = 1', 'global');
  itSnapshot('keyword-nonlocal', 'def outer():\n  x=0\n  def inner():\n    nonlocal x\n    x=1\n  inner()', 'nonlocal');

  // Exceptions
  itSnapshot('exc-ValueError', 'try:\n    int("x")\nexcept ValueError:\n    pass', 'ValueError');
  itSnapshot('exc-TypeError', 'try:\n    (1+"a")\nexcept TypeError:\n    pass', 'TypeError');
  itSnapshot('exc-KeyError', 'd={}\ntry:\n    d["k"]\nexcept KeyError:\n    pass', 'KeyError');
  itSnapshot('exc-ZeroDivisionError', 'try:\n    1/0\nexcept ZeroDivisionError:\n    pass', 'ZeroDivisionError');

  // Stdlib modules and functions
  itSnapshot('os-path-join', 'import os\np = os.path.join("a","b")', 'join');
  itSnapshot('math-sqrt', 'import math\nval = math.sqrt(16)', 'sqrt');
  itSnapshot('json-dumps', 'import json\ns = json.dumps({"a":1})', 'dumps');
  itSnapshot('json-loads', "import json\nd = json.loads('{\"a\":1}')", 'loads');
  itSnapshot('datetime-date', 'from datetime import date\ntoday = date.today()', 'today(');
  itSnapshot('datetime-timedelta', 'from datetime import timedelta\ndelta = timedelta(days=7)', 'timedelta');
  itSnapshot('re-findall', 'import re\nre.findall(r"\\d+", "a1b2")', 'findall');
  itSnapshot('re-sub', 'import re\nre.sub(r"x","y","x x")', 'sub');

  // Typing
  itSnapshot('typing-List', 'from typing import List\nxs: List[int] = []', 'List');
  itSnapshot('typing-Optional', 'from typing import Optional\nx: Optional[int] = None', 'Optional');
  itSnapshot('typing-Union', 'from typing import Union\nx: Union[int,str] = 1', 'Union');
  itSnapshot('typing-Annotated', 'from typing import Annotated\nT = Annotated[int, "meta"]', 'Annotated');
  itSnapshot('typing-Literal', 'from typing import Literal\ncolor: Literal["red","green"] = "red"', 'Literal');
  itSnapshot('typing-TypedDict', 'from typing import TypedDict\nclass Movie(TypedDict):\n  title: str\n  year: int', 'TypedDict');
  itSnapshot('typing-Self', 'from typing import Self\nclass Node:\n  def set_next(self, nxt: Self) -> Self:\n    return self', 'Self');

  // More dunders
  itSnapshot('dunder-__str__', 'class A:\n    def __str__(self):\n        return "A"', '__str__');
  itSnapshot('dunder-__repr__', 'class A:\n    def __repr__(self):\n        return "A()"', '__repr__');
  itSnapshot('dunder-__eq__', 'class A:\n    def __eq__(self, other):\n        return True', '__eq__');
  itSnapshot('dunder-__len__', 'class A:\n    def __len__(self):\n        return 0', '__len__');
  itSnapshot('dunder-__call__', 'class A:\n    def __call__(self):\n        return 0', '__call__');
  itSnapshot('dunder-__getitem__', 'class A:\n    def __getitem__(self, key):\n        return 1\na = A()\n_ = a[0]', '__getitem__');
  itSnapshot('dunder-__enter__-__exit__', 'class M:\n  def __enter__(self): return self\n  def __exit__(self, *args): return False\nwith M() as m:\n  pass', '__enter__');
  itSnapshot('dunder-__iter__', 'class A:\n  def __iter__(self):\n    yield 1\nfor x in A():\n  pass', '__iter__');
  itSnapshot('dunder-__contains__', 'class A:\n  def __contains__(self, x): return True\n_ = 1 in A()', '__contains__');

  // Operators (a representative set)
  itSnapshot('op-plus', 'a=1\nb=2\n_ = a + b', '+');
  itSnapshot('op-mult', 'a=2\nb=3\n_ = a * b', '*');
  itSnapshot('op-div', 'a=4\nb=2\n_ = a / b', '/');
  itSnapshot('op-floor-div', 'a=5\nb=2\n_ = a // b', '//');
  itSnapshot('op-mod', 'a=5\nb=2\n_ = a % b', '%');
  itSnapshot('op-pow', 'a=2\nb=3\n_ = a ** b', '**');
  itSnapshot('op-lt', 'a=1\nb=2\n_ = a < b', '<');
  itSnapshot('op-ge', 'a=2\nb=2\n_ = a >= b', '>=');
  itSnapshot('op-in', 'xs=[1,2]\n_ = 1 in xs', 'in');
  itSnapshot('op-is', 'a=None\n_ = a is None', 'is');
  itSnapshot('op-not', 'a=False\n_ = not a', 'not');
  itSnapshot('op-and', 'a=True\nb=False\n_ = a and b', 'and');
  itSnapshot('op-or', 'a=True\nb=False\n_ = a or b', 'or');

  // Decorators via builtins
  itSnapshot('decorator-property', 'class A:\n    @property\n    def x(self):\n        return 1', 'property');
  itSnapshot('decorator-staticmethod', 'class A:\n    @staticmethod\n    def x():\n        return 1', 'staticmethod');
  itSnapshot('decorator-classmethod', 'class A:\n    @classmethod\n    def x(cls):\n        return 1', 'classmethod');

  // More stdlib modules
  itSnapshot('pathlib-Path', 'from pathlib import Path\np = Path(".")', 'Path');
  itSnapshot('pathlib-Path-glob', 'from pathlib import Path\nfor p in Path(".").glob("*.py"):\n    pass', 'glob');
  itSnapshot('itertools-product', 'import itertools\nfor a,b in itertools.product([1,2],[3,4]):\n    pass', 'product');
  itSnapshot('functools-lru_cache', 'from functools import lru_cache\n@lru_cache(maxsize=128)\ndef fib(n):\n  return n if n<2 else fib(n-1)+fib(n-2)', 'lru_cache');
  itSnapshot('operator-itemgetter', 'from operator import itemgetter\nget2 = itemgetter(1)\n_ = get2([10,20,30])', 'itemgetter');
  itSnapshot('dataclasses-dataclass', 'from dataclasses import dataclass\n@dataclass\nclass Point:\n  x: int\n  y: int', 'dataclass');

  // Third-party examples
  itSnapshot('pandas-DataFrame-head', 'import pandas as pd\ndf = pd.DataFrame({"a":[1,2]})\n_ = df.head()', 'head');
  itSnapshot('requests-get', 'import requests\nresp = requests.get("https://example.com")', 'get');
  itSnapshot('fastapi-FastAPI', 'from fastapi import FastAPI\napp = FastAPI()', 'FastAPI');
  itSnapshot('torch-tensor', 'import torch\nx = torch.tensor([1,2,3])', 'tensor');
});
