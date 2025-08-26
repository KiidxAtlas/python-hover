"use strict";
/**
 * Static examples for Python built-in functions, methods, and classes
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.STATIC_EXAMPLES = void 0;
exports.getStaticExamples = getStaticExamples;
exports.STATIC_EXAMPLES = {
    // Built-in functions
    'len': {
        examples: [
            'len("hello")  # 5',
            'len([1, 2, 3, 4])  # 4',
            'len({"a": 1, "b": 2})  # 2'
        ],
        description: 'Returns the number of items in an object'
    },
    'str': {
        examples: [
            'str(42)  # "42"',
            'str(3.14)  # "3.14"',
            'str([1, 2, 3])  # "[1, 2, 3]"'
        ],
        description: 'Converts objects to string representation'
    },
    'int': {
        examples: [
            'int("42")  # 42',
            'int(3.14)  # 3',
            'int("1010", 2)  # 10 (binary to decimal)'
        ],
        description: 'Converts to integer'
    },
    'float': {
        examples: [
            'float("3.14")  # 3.14',
            'float(42)  # 42.0',
            'float("inf")  # inf'
        ],
        description: 'Converts to floating point number'
    },
    'list': {
        examples: [
            'list("abc")  # ["a", "b", "c"]',
            'list(range(3))  # [0, 1, 2]',
            'list((1, 2, 3))  # [1, 2, 3]'
        ],
        description: 'Creates a list from an iterable'
    },
    'dict': {
        examples: [
            'dict(a=1, b=2)  # {"a": 1, "b": 2}',
            'dict([("x", 1), ("y", 2)])  # {"x": 1, "y": 2}',
            'dict({"a": 1})  # {"a": 1}'
        ],
        description: 'Creates a dictionary'
    },
    'set': {
        examples: [
            'set([1, 2, 2, 3])  # {1, 2, 3}',
            'set("hello")  # {"h", "e", "l", "o"}',
            'set()  # empty set'
        ],
        description: 'Creates a set from an iterable'
    },
    'range': {
        examples: [
            'list(range(5))  # [0, 1, 2, 3, 4]',
            'list(range(1, 6))  # [1, 2, 3, 4, 5]',
            'list(range(0, 10, 2))  # [0, 2, 4, 6, 8]'
        ],
        description: 'Creates a sequence of numbers'
    },
    'max': {
        examples: [
            'max(1, 3, 2)  # 3',
            'max([1, 3, 2])  # 3',
            'max("abc", key=len)  # "abc"'
        ],
        description: 'Returns the largest item'
    },
    'min': {
        examples: [
            'min(1, 3, 2)  # 1',
            'min([1, 3, 2])  # 1',
            'min("hello", "hi", key=len)  # "hi"'
        ],
        description: 'Returns the smallest item'
    },
    'sum': {
        examples: [
            'sum([1, 2, 3])  # 6',
            'sum([1, 2, 3], 10)  # 16',
            'sum(range(1, 5))  # 10'
        ],
        description: 'Sums numeric values in an iterable'
    },
    'print': {
        examples: [
            'print("Hello, World!")',
            'print("Value:", 42)',
            'print("A", "B", "C", sep="-")  # A-B-C'
        ],
        description: 'Prints objects to console'
    },
    'round': {
        examples: [
            'round(3.14159, 2)  # 3.14',
            'round(3.7)  # 4',
            'round(1234.5, -1)  # 1230.0'
        ],
        description: 'Rounds a number to given precision'
    },
    'abs': {
        examples: [
            'abs(-5)  # 5',
            'abs(3.14)  # 3.14',
            'abs(-2.7)  # 2.7'
        ],
        description: 'Returns the absolute value'
    },
    'all': {
        examples: [
            'all([True, True, True])  # True',
            'all([True, False, True])  # False',
            'all([1, 2, 3])  # True (all truthy)'
        ],
        description: 'Returns True if all elements are true'
    },
    'any': {
        examples: [
            'any([False, False, True])  # True',
            'any([False, False, False])  # False',
            'any([0, 1, 2])  # True (at least one truthy)'
        ],
        description: 'Returns True if any element is true'
    },
    'bool': {
        examples: [
            'bool(1)  # True',
            'bool(0)  # False',
            'bool("hello")  # True'
        ],
        description: 'Converts to boolean value'
    },
    'next': {
        examples: [
            'it = iter([1, 2, 3]); next(it)  # 1',
            'next(it, "default")  # returns "default" if exhausted',
            'for item in my_list: break  # next() used internally'
        ],
        description: 'Gets next item from iterator'
    },
    'object': {
        examples: [
            'obj = object()  # creates empty object',
            'class MyClass(object): pass',
            'isinstance([], object)  # True (everything inherits from object)'
        ],
        description: 'Base class for all Python classes'
    },
    'oct': {
        examples: [
            'oct(8)  # "0o10"',
            'oct(255)  # "0o377"',
            'oct(-8)  # "-0o10"'
        ],
        description: 'Converts integer to octal string'
    },
    'open': {
        examples: [
            'with open("file.txt", "r") as f: content = f.read()',
            'with open("data.txt", "w") as f: f.write("Hello")',
            'f = open("file.txt", "r", encoding="utf-8")'
        ],
        description: 'Opens a file and returns a file object'
    },
    'input': {
        examples: [
            'name = input("Enter name: ")',
            'age = int(input("Enter age: "))',
            'data = input().strip()'
        ],
        description: 'Reads a line of input from user'
    },
    'type': {
        examples: [
            'type(42)  # <class "int">',
            'type("hello")  # <class "str">',
            'type([1, 2, 3])  # <class "list">'
        ],
        description: 'Returns the type of an object'
    },
    'isinstance': {
        examples: [
            'isinstance(42, int)  # True',
            'isinstance("hello", str)  # True',
            'isinstance([1, 2], (list, tuple))  # True'
        ],
        description: 'Checks if object is instance of class'
    },
    'hasattr': {
        examples: [
            'hasattr("hello", "upper")  # True',
            'hasattr([1, 2], "append")  # True',
            'hasattr(42, "split")  # False'
        ],
        description: 'Checks if object has an attribute'
    },
    'getattr': {
        examples: [
            'getattr("hello", "upper")  # <method "upper">',
            'getattr(obj, "name", "default")',
            'getattr([1, 2], "append")'
        ],
        description: 'Gets an attribute from an object'
    },
    'zip': {
        examples: [
            'list(zip([1, 2], ["a", "b"]))  # [(1, "a"), (2, "b")]',
            'list(zip("abc", "123"))  # [("a", "1"), ("b", "2"), ("c", "3")]',
            'dict(zip(["x", "y"], [1, 2]))  # {"x": 1, "y": 2}'
        ],
        description: 'Combines multiple iterables'
    },
    'enumerate': {
        examples: [
            'list(enumerate(["a", "b", "c"]))  # [(0, "a"), (1, "b"), (2, "c")]',
            'list(enumerate("abc", 1))  # [(1, "a"), (2, "b"), (3, "c")]',
            'for i, val in enumerate(items): ...'
        ],
        description: 'Returns enumerated pairs of index and value'
    },
    'sorted': {
        examples: [
            'sorted([3, 1, 2])  # [1, 2, 3]',
            'sorted("hello")  # ["e", "h", "l", "l", "o"]',
            'sorted(["apple", "pie"], key=len)  # ["pie", "apple"]'
        ],
        description: 'Returns a sorted list'
    },
    'reversed': {
        examples: [
            'list(reversed([1, 2, 3]))  # [3, 2, 1]',
            'list(reversed("hello"))  # ["o", "l", "l", "e", "h"]',
            '"".join(reversed("hello"))  # "olleh"'
        ],
        description: 'Returns a reverse iterator'
    },
    'filter': {
        examples: [
            'list(filter(lambda x: x > 0, [-1, 0, 1, 2]))  # [1, 2]',
            'list(filter(str.isdigit, ["a", "1", "b", "2"]))  # ["1", "2"]',
            'list(filter(None, [0, 1, "", "hello"]))  # [1, "hello"]'
        ],
        description: 'Filters items based on a function'
    },
    'map': {
        examples: [
            'list(map(str.upper, ["a", "b", "c"]))  # ["A", "B", "C"]',
            'list(map(len, ["hi", "hello"]))  # [2, 5]',
            'list(map(lambda x: x * 2, [1, 2, 3]))  # [2, 4, 6]'
        ],
        description: 'Applies function to all items'
    },
    // String methods
    'str.upper': {
        examples: [
            '"hello".upper()  # "HELLO"',
            '"Hello World".upper()  # "HELLO WORLD"',
            'name.upper()'
        ],
        description: 'Converts to uppercase'
    },
    'str.lower': {
        examples: [
            '"HELLO".lower()  # "hello"',
            '"Hello World".lower()  # "hello world"',
            'text.lower()'
        ],
        description: 'Converts to lowercase'
    },
    'str.strip': {
        examples: [
            '"  hello  ".strip()  # "hello"',
            '"...hello...".strip(".")  # "hello"',
            'user_input.strip()'
        ],
        description: 'Removes whitespace or specified characters'
    },
    'str.split': {
        examples: [
            '"a,b,c".split(",")  # ["a", "b", "c"]',
            '"hello world".split()  # ["hello", "world"]',
            '"a:b:c".split(":", 1)  # ["a", "b:c"]'
        ],
        description: 'Splits string into list'
    },
    'str.join': {
        examples: [
            '",".join(["a", "b", "c"])  # "a,b,c"',
            '" ".join(["hello", "world"])  # "hello world"',
            '"".join(["a", "b", "c"])  # "abc"'
        ],
        description: 'Joins iterable with separator'
    },
    'str.replace': {
        examples: [
            '"hello world".replace("world", "Python")  # "hello Python"',
            '"aaa".replace("a", "b", 2)  # "bba"',
            'text.replace(" ", "_")'
        ],
        description: 'Replaces occurrences of substring'
    },
    'str.find': {
        examples: [
            '"hello".find("ll")  # 2',
            '"hello".find("x")  # -1',
            '"hello world".find("world")  # 6'
        ],
        description: 'Finds index of substring (-1 if not found)'
    },
    'str.startswith': {
        examples: [
            '"hello".startswith("he")  # True',
            '"hello".startswith("world")  # False',
            'filename.startswith("data_")'
        ],
        description: 'Checks if string starts with prefix'
    },
    'str.endswith': {
        examples: [
            '"hello.txt".endswith(".txt")  # True',
            '"hello.txt".endswith(".py")  # False',
            'filename.endswith((".txt", ".csv"))'
        ],
        description: 'Checks if string ends with suffix'
    },
    'str.format': {
        examples: [
            '"Hello, {}!".format("World")  # "Hello, World!"',
            '"{0} {1}".format("Hello", "World")  # "Hello World"',
            '"{name} is {age}".format(name="Alice", age=30)'
        ],
        description: 'Formats string with placeholders'
    },
    // List methods
    'list.append': {
        examples: [
            'lst = [1, 2]; lst.append(3)  # [1, 2, 3]',
            'fruits.append("apple")',
            'numbers.append(len(data))'
        ],
        description: 'Adds item to end of list'
    },
    'list.extend': {
        examples: [
            'lst = [1, 2]; lst.extend([3, 4])  # [1, 2, 3, 4]',
            'fruits.extend(["apple", "banana"])',
            'numbers.extend(range(5))'
        ],
        description: 'Extends list with items from iterable'
    },
    'list.insert': {
        examples: [
            'lst = [1, 3]; lst.insert(1, 2)  # [1, 2, 3]',
            'fruits.insert(0, "apple")',
            'data.insert(len(data), item)'
        ],
        description: 'Inserts item at specified index'
    },
    'list.remove': {
        examples: [
            'lst = [1, 2, 3]; lst.remove(2)  # [1, 3]',
            'fruits.remove("apple")',
            'if item in lst: lst.remove(item)'
        ],
        description: 'Removes first occurrence of item'
    },
    'list.pop': {
        examples: [
            'lst = [1, 2, 3]; lst.pop()  # 3, lst becomes [1, 2]',
            'lst = [1, 2, 3]; lst.pop(0)  # 1, lst becomes [2, 3]',
            'last_item = stack.pop()'
        ],
        description: 'Removes and returns item at index (last by default)'
    },
    'list.index': {
        examples: [
            '[1, 2, 3].index(2)  # 1',
            'fruits.index("apple")  # position of "apple"',
            'data.index(target, start, end)'
        ],
        description: 'Returns index of first occurrence'
    },
    'list.count': {
        examples: [
            '[1, 2, 2, 3].count(2)  # 2',
            'text.count("a")  # count of "a" in text',
            'votes.count("yes")'
        ],
        description: 'Counts occurrences of item'
    },
    'list.sort': {
        examples: [
            'lst = [3, 1, 2]; lst.sort()  # [1, 2, 3]',
            'names.sort(key=str.lower)',
            'data.sort(reverse=True)'
        ],
        description: 'Sorts list in place'
    },
    'list.reverse': {
        examples: [
            'lst = [1, 2, 3]; lst.reverse()  # [3, 2, 1]',
            'numbers.reverse()',
            'words[::-1]  # alternative reversal'
        ],
        description: 'Reverses list in place'
    },
    'list.copy': {
        examples: [
            'original = [1, 2, 3]; copy = original.copy()',
            'backup = data.copy()',
            'new_list = old_list.copy()'
        ],
        description: 'Creates shallow copy of list'
    },
    'list.clear': {
        examples: [
            'lst = [1, 2, 3]; lst.clear()  # []',
            'cache.clear()',
            'temporary_data.clear()'
        ],
        description: 'Removes all items from list'
    },
    // Dictionary methods
    'dict.get': {
        examples: [
            'data = {"name": "Alice"}; data.get("name")  # "Alice"',
            'data.get("age", 0)  # 0 (default)',
            'config.get("debug", False)'
        ],
        description: 'Gets value for key with optional default'
    },
    'dict.keys': {
        examples: [
            'data = {"a": 1, "b": 2}; list(data.keys())  # ["a", "b"]',
            'for key in data.keys(): ...',
            'set(config.keys())'
        ],
        description: 'Returns view of dictionary keys'
    },
    'dict.values': {
        examples: [
            'data = {"a": 1, "b": 2}; list(data.values())  # [1, 2]',
            'for value in data.values(): ...',
            'sum(scores.values())'
        ],
        description: 'Returns view of dictionary values'
    },
    'dict.items': {
        examples: [
            'data = {"a": 1, "b": 2}; list(data.items())  # [("a", 1), ("b", 2)]',
            'for key, value in data.items(): ...',
            'dict(reversed(data.items()))'
        ],
        description: 'Returns view of key-value pairs'
    },
    'dict.update': {
        examples: [
            'data = {"a": 1}; data.update({"b": 2})  # {"a": 1, "b": 2}',
            'config.update(new_settings)',
            'data.update(b=2, c=3)'
        ],
        description: 'Updates dictionary with key-value pairs'
    },
    'dict.pop': {
        examples: [
            'data = {"a": 1, "b": 2}; data.pop("a")  # 1',
            'value = cache.pop("key", None)',
            'last_item = data.pop("last", "default")'
        ],
        description: 'Removes and returns value for key'
    },
    'dict.setdefault': {
        examples: [
            'data = {}; data.setdefault("count", 0)  # 0',
            'groups.setdefault(key, []).append(item)',
            'cache.setdefault(url, fetch_data(url))'
        ],
        description: 'Gets value or sets default if key missing'
    },
    // Set methods
    'set.add': {
        examples: [
            'data = {1, 2}; data.add(3)  # {1, 2, 3}',
            'seen.add(item)',
            'valid_ids.add(user_id)'
        ],
        description: 'Adds element to set'
    },
    'set.remove': {
        examples: [
            'data = {1, 2, 3}; data.remove(2)  # {1, 3}',
            'active_users.remove(user_id)',
            'if item in data: data.remove(item)'
        ],
        description: 'Removes element from set (raises KeyError if not found)'
    },
    'set.discard': {
        examples: [
            'data = {1, 2, 3}; data.discard(2)  # {1, 3}',
            'data.discard(999)  # no error if not found',
            'seen.discard(old_item)'
        ],
        description: 'Removes element from set (no error if not found)'
    },
    'set.union': {
        examples: [
            '{1, 2}.union({2, 3})  # {1, 2, 3}',
            'set1 | set2  # alternative syntax',
            'all_items = set1.union(set2, set3)'
        ],
        description: 'Returns union of sets'
    },
    'set.intersection': {
        examples: [
            '{1, 2, 3}.intersection({2, 3, 4})  # {2, 3}',
            'set1 & set2  # alternative syntax',
            'common = users1.intersection(users2)'
        ],
        description: 'Returns intersection of sets'
    },
    'set.difference': {
        examples: [
            '{1, 2, 3}.difference({2, 4})  # {1, 3}',
            'set1 - set2  # alternative syntax',
            'unique = all_items.difference(common)'
        ],
        description: 'Returns elements in set but not in others'
    },
    // Special/dunder methods
    '__init__': {
        examples: [
            'def __init__(self, name): self.name = name',
            'def __init__(self, x, y=0): ...',
            'super().__init__(args)'
        ],
        description: 'Constructor method called when creating instances'
    },
    '__str__': {
        examples: [
            'def __str__(self): return f"Person({self.name})"',
            'def __str__(self): return str(self.value)',
            'str(obj)  # calls obj.__str__()'
        ],
        description: 'Returns string representation for humans'
    },
    '__repr__': {
        examples: [
            'def __repr__(self): return f"Point({self.x}, {self.y})"',
            'def __repr__(self): return f"{self.__class__.__name__}({self.data!r})"',
            'repr(obj)  # calls obj.__repr__()'
        ],
        description: 'Returns unambiguous string representation for developers'
    },
    '__len__': {
        examples: [
            'def __len__(self): return len(self.items)',
            'def __len__(self): return self.size',
            'len(obj)  # calls obj.__len__()'
        ],
        description: 'Returns length when len() is called'
    },
    '__getitem__': {
        examples: [
            'def __getitem__(self, key): return self.data[key]',
            'def __getitem__(self, index): return self.items[index]',
            'obj[key]  # calls obj.__getitem__(key)'
        ],
        description: 'Enables indexing with []'
    },
    '__setitem__': {
        examples: [
            'def __setitem__(self, key, value): self.data[key] = value',
            'def __setitem__(self, index, value): self.items[index] = value',
            'obj[key] = value  # calls obj.__setitem__(key, value)'
        ],
        description: 'Enables item assignment with []'
    },
    '__contains__': {
        examples: [
            'def __contains__(self, item): return item in self.data',
            'def __contains__(self, value): return value in self.items',
            'item in obj  # calls obj.__contains__(item)'
        ],
        description: 'Enables membership testing with "in"'
    },
    '__iter__': {
        examples: [
            'def __iter__(self): return iter(self.items)',
            'def __iter__(self): yield from self.data',
            'for item in obj:  # calls obj.__iter__()'
        ],
        description: 'Makes object iterable'
    },
    '__call__': {
        examples: [
            'def __call__(self, *args): return self.func(*args)',
            'def __call__(self, x): return self.multiplier * x',
            'obj()  # calls obj.__call__()'
        ],
        description: 'Makes object callable like a function'
    },
    '__enter__': {
        examples: [
            'def __enter__(self): return self',
            'def __enter__(self): self.file = open(self.filename); return self.file',
            'with obj:  # calls obj.__enter__()'
        ],
        description: 'Context manager entry'
    },
    '__exit__': {
        examples: [
            'def __exit__(self, exc_type, exc_val, exc_tb): return False',
            'def __exit__(self, *args): self.cleanup(); return False',
            '# called when exiting "with" statement'
        ],
        description: 'Context manager exit'
    },
    // More built-in functions
    'bin': {
        examples: [
            'bin(8)  # "0b1000"',
            'bin(255)  # "0b11111111"',
            'bin(-8)  # "-0b1000"'
        ],
        description: 'Converts integer to binary string'
    },
    'hex': {
        examples: [
            'hex(255)  # "0xff"',
            'hex(16)  # "0x10"',
            'hex(-255)  # "-0xff"'
        ],
        description: 'Converts integer to hexadecimal string'
    },
    'ord': {
        examples: [
            'ord("A")  # 65',
            'ord("a")  # 97',
            'ord("€")  # 8364'
        ],
        description: 'Returns Unicode code point of character'
    },
    'chr': {
        examples: [
            'chr(65)  # "A"',
            'chr(97)  # "a"',
            'chr(8364)  # "€"'
        ],
        description: 'Returns character for Unicode code point'
    },
    'id': {
        examples: [
            'x = [1, 2, 3]; id(x)  # unique object ID',
            'id("hello")  # memory address',
            'a = b = []; id(a) == id(b)  # True'
        ],
        description: 'Returns unique identifier of an object'
    },
    'hash': {
        examples: [
            'hash("hello")  # hash value of string',
            'hash(42)  # hash value of integer',
            'hash((1, 2, 3))  # hash value of tuple'
        ],
        description: 'Returns hash value of an object'
    },
    'pow': {
        examples: [
            'pow(2, 3)  # 8',
            'pow(2, 3, 5)  # 3 (2**3 % 5)',
            'pow(10, -2)  # 0.01'
        ],
        description: 'Returns x to the power of y, optionally modulo z'
    },
    'divmod': {
        examples: [
            'divmod(10, 3)  # (3, 1)',
            'divmod(9, 4)  # (2, 1)',
            'divmod(20, 6)  # (3, 2)'
        ],
        description: 'Returns quotient and remainder as tuple'
    },
    'callable': {
        examples: [
            'callable(len)  # True',
            'callable(42)  # False',
            'callable(lambda x: x)  # True'
        ],
        description: 'Checks if object is callable'
    },
    'iter': {
        examples: [
            'it = iter([1, 2, 3])',
            'it = iter("hello")',
            'it = iter({"a": 1, "b": 2})'
        ],
        description: 'Creates an iterator from an iterable'
    },
    'globals': {
        examples: [
            'globals()  # dict of global variables',
            'globals()["__name__"]  # module name',
            '"my_var" in globals()  # check if exists'
        ],
        description: 'Returns dictionary of global variables'
    },
    'locals': {
        examples: [
            'def func(): print(locals())  # local variables',
            'locals()  # current local scope',
            'x = 5; "x" in locals()  # True'
        ],
        description: 'Returns dictionary of local variables'
    },
    'vars': {
        examples: [
            'vars()  # same as locals()',
            'vars(obj)  # obj.__dict__',
            'class C: pass; vars(C())  # {}'
        ],
        description: 'Returns __dict__ attribute of object'
    },
    'dir': {
        examples: [
            'dir([])  # list methods and attributes',
            'dir(str)  # string class methods',
            'dir()  # names in current scope'
        ],
        description: 'Lists attributes of an object'
    },
    'eval': {
        examples: [
            'eval("2 + 3")  # 5',
            'eval("len([1, 2, 3])")  # 3',
            'x = 5; eval("x * 2")  # 10'
        ],
        description: 'Evaluates a string as Python expression'
    },
    'exec': {
        examples: [
            'exec("print(\'Hello\')")  # Hello',
            'exec("x = 5\\nprint(x)")  # 5',
            'code = "for i in range(3): print(i)"; exec(code)'
        ],
        description: 'Executes Python code from string'
    },
    'compile': {
        examples: [
            'code = compile("2 + 3", "<string>", "eval")',
            'compiled = compile("print(x)", "<string>", "exec")',
            'eval(compile("1 + 1", "<string>", "eval"))  # 2'
        ],
        description: 'Compiles source into code object'
    },
    'repr': {
        examples: [
            'repr("hello")  # "\'hello\'"',
            'repr([1, 2, 3])  # "[1, 2, 3]"',
            'repr({"a": 1})  # "{\'a\': 1}"'
        ],
        description: 'Returns unambiguous string representation'
    },
    'ascii': {
        examples: [
            'ascii("hello")  # "\'hello\'"',
            'ascii("café")  # "\'caf\\xe9\'"',
            'ascii("🐍")  # "\'\\U0001f40d\'"'
        ],
        description: 'Returns ASCII-only string representation'
    },
    'format': {
        examples: [
            'format(42, "d")  # "42"',
            'format(3.14159, ".2f")  # "3.14"',
            'format(255, "x")  # "ff"'
        ],
        description: 'Formats a value using format specification'
    },
    'slice': {
        examples: [
            's = slice(1, 5); [1,2,3,4,5,6][s]  # [2,3,4,5]',
            'slice(None, 3)  # equivalent to [:3]',
            'slice(1, None, 2)  # equivalent to [1::2]'
        ],
        description: 'Creates a slice object'
    },
    'memoryview': {
        examples: [
            'mv = memoryview(b"hello")',
            'mv = memoryview(bytearray(b"hello"))',
            'list(memoryview(b"abc"))  # [97, 98, 99]'
        ],
        description: 'Creates a memory view object'
    },
    'bytearray': {
        examples: [
            'bytearray(b"hello")  # mutable bytes',
            'bytearray([65, 66, 67])  # bytearray(b"ABC")',
            'bytearray(5)  # 5 zero bytes'
        ],
        description: 'Creates a mutable byte array'
    },
    'bytes': {
        examples: [
            'bytes("hello", "utf-8")  # b"hello"',
            'bytes([65, 66, 67])  # b"ABC"',
            'bytes(5)  # b"\\x00\\x00\\x00\\x00\\x00"'
        ],
        description: 'Creates immutable bytes object'
    },
    'complex': {
        examples: [
            'complex(3, 4)  # (3+4j)',
            'complex("3+4j")  # (3+4j)',
            'complex(2.5)  # (2.5+0j)'
        ],
        description: 'Creates complex number'
    },
    'frozenset': {
        examples: [
            'frozenset([1, 2, 3, 2])  # frozenset({1, 2, 3})',
            'frozenset("hello")  # frozenset({"h", "e", "l", "o"})',
            'frozenset()  # empty frozenset'
        ],
        description: 'Creates immutable set'
    },
    'property': {
        examples: [
            '@property\\ndef name(self): return self._name',
            'name = property(get_name, set_name)',
            'class C: x = property(lambda self: self._x)'
        ],
        description: 'Creates a property attribute'
    },
    'staticmethod': {
        examples: [
            '@staticmethod\\ndef add(x, y): return x + y',
            'add = staticmethod(lambda x, y: x + y)',
            'class Math: add = staticmethod(lambda x, y: x + y)'
        ],
        description: 'Creates static method'
    },
    'classmethod': {
        examples: [
            '@classmethod\\ndef from_string(cls, s): return cls(s)',
            'from_str = classmethod(lambda cls, s: cls(s))',
            'class Person: create = classmethod(lambda cls, name: cls(name))'
        ],
        description: 'Creates class method'
    },
    'super': {
        examples: [
            'super().__init__(args)',
            'super(Child, self).method()',
            'class Child(Parent): def __init__(self): super().__init__()'
        ],
        description: 'Returns proxy object for method calls to parent'
    },
    // Keywords and control structures
    'if': {
        examples: [
            'if x > 0: print("positive")',
            'if condition: do_something() else: do_other()',
            'value = x if x > 0 else 0  # ternary operator'
        ],
        description: 'Conditional statement'
    },
    'else': {
        examples: [
            '# If-else statement',
            'if age >= 18:',
            '    print("Adult")',
            'else:',
            '    print("Minor")',
            '',
            '# Multiple conditions',
            'if score >= 90:',
            '    grade = "A"',
            'elif score >= 80:',
            '    grade = "B"',
            'else:',
            '    grade = "C"',
            '',
            '# For-else loop',
            'for item in search_list:',
            '    if item == target:',
            '        print("Found!")',
            '        break',
            'else:',
            '    print("Not found")',
            '',
            '# While-else loop',
            'while attempts < max_attempts:',
            '    if try_operation():',
            '        print("Success!")',
            '        break',
            '    attempts += 1',
            'else:',
            '    print("Failed after all attempts")',
            '',
            '# Try-else (no exception)',
            'try:',
            '    result = risky_operation()',
            'except ValueError:',
            '    print("Error occurred")',
            'else:',
            '    print("No exception, result:", result)',
            '',
            '# Ternary operator with else',
            'status = "pass" if score >= 60 else "fail"',
            'max_val = a if a > b else b'
        ],
        description: 'Else clause used with if, for, while, and try statements'
    },
    'for': {
        examples: [
            '# Basic iteration',
            'for i in range(5): print(i)  # 0, 1, 2, 3, 4',
            'for item in [1, 2, 3]: print(item)',
            'for char in "hello": print(char)',
            '',
            '# Dictionary iteration',
            'for key in my_dict: print(key)',
            'for key, value in my_dict.items(): print(key, value)',
            'for value in my_dict.values(): print(value)',
            '',
            '# Enumerate with index',
            'for i, item in enumerate(my_list): print(i, item)',
            'for i, char in enumerate("abc", 1): print(i, char)  # start=1',
            '',
            '# Multiple iterables',
            'for x, y in zip(list1, list2): print(x, y)',
            'for item in itertools.chain(list1, list2): print(item)',
            '',
            '# List comprehensions',
            'squares = [x**2 for x in range(5)]',
            'evens = [x for x in range(10) if x % 2 == 0]',
            'pairs = [(x, y) for x in range(3) for y in range(3)]',
            '',
            '# Nested loops',
            'for i in range(3):',
            '    for j in range(3):',
            '        print(f"({i}, {j})")',
            '',
            '# With else clause',
            'for item in my_list:',
            '    if condition(item): break',
            'else:',
            '    print("No item found")',
            '',
            '# Advanced patterns',
            'for line in open("file.txt"): print(line.strip())',
            'for match in re.finditer(pattern, text): print(match.group())',
            'for item in reversed(my_list): print(item)'
        ],
        description: 'For loop statement with comprehensive iteration patterns'
    },
    'while': {
        examples: [
            '# Basic while loop',
            'x = 5',
            'while x > 0:',
            '    print(x)',
            '    x -= 1',
            '',
            '# Infinite loop with break',
            'while True:',
            '    user_input = input("Enter command: ")',
            '    if user_input == "quit":',
            '        break',
            '    process_command(user_input)',
            '',
            '# While with else clause',
            'while condition:',
            '    if found_what_we_need:',
            '        break',
            '    do_something()',
            'else:',
            '    print("Loop completed without break")',
            '',
            '# Common patterns',
            'while items:  # while list is not empty',
            '    item = items.pop()',
            '    process(item)',
            '',
            'while line := file.readline():  # walrus operator',
            '    process_line(line)'
        ],
        description: 'While loop with comprehensive patterns'
    },
    'def': {
        examples: [
            '# Basic function',
            'def greet(name):',
            '    return f"Hello, {name}!"',
            '',
            '# Function with default arguments',
            'def power(base, exponent=2):',
            '    return base ** exponent',
            '',
            '# Function with *args and **kwargs',
            'def flexible_func(*args, **kwargs):',
            '    print(f"Args: {args}, Kwargs: {kwargs}")',
            '',
            '# Type hints',
            'def add_numbers(a: int, b: int) -> int:',
            '    return a + b',
            '',
            '# Nested functions',
            'def outer_func(x):',
            '    def inner_func(y):',
            '        return x + y',
            '    return inner_func',
            '',
            '# Decorators',
            '@staticmethod',
            'def utility_func():',
            '    return "I am a static method"',
            '',
            '# Lambda functions',
            'square = lambda x: x ** 2',
            'sorted(items, key=lambda x: x.name)',
            '',
            '# Generator functions',
            'def countdown(n):',
            '    while n > 0:',
            '        yield n',
            '        n -= 1'
        ],
        description: 'Function definition with comprehensive patterns'
    },
    'class': {
        examples: [
            '# Basic class',
            'class Person:',
            '    def __init__(self, name, age):',
            '        self.name = name',
            '        self.age = age',
            '',
            '    def greet(self):',
            '        return f"Hi, I\'m {self.name}"',
            '',
            '# Class with inheritance',
            'class Student(Person):',
            '    def __init__(self, name, age, student_id):',
            '        super().__init__(name, age)',
            '        self.student_id = student_id',
            '',
            '# Class with properties',
            'class Circle:',
            '    def __init__(self, radius):',
            '        self._radius = radius',
            '',
            '    @property',
            '    def area(self):',
            '        return 3.14159 * self._radius ** 2',
            '',
            '# Class with class methods',
            'class MathUtils:',
            '    PI = 3.14159',
            '',
            '    @classmethod',
            '    def from_diameter(cls, diameter):',
            '        return cls(diameter / 2)',
            '',
            '    @staticmethod',
            '    def degrees_to_radians(degrees):',
            '        return degrees * MathUtils.PI / 180',
            '',
            '# Abstract base class',
            'from abc import ABC, abstractmethod',
            '',
            'class Shape(ABC):',
            '    @abstractmethod',
            '    def area(self):',
            '        pass',
            '',
            '# Data classes (Python 3.7+)',
            'from dataclasses import dataclass',
            '',
            '@dataclass',
            'class Point:',
            '    x: float',
            '    y: float',
            '',
            '    def distance(self, other):',
            '        return ((self.x - other.x)**2 + (self.y - other.y)**2)**0.5'
        ],
        description: 'Class definition with comprehensive patterns'
    },
    'try': {
        examples: [
            'try: risky_operation() except Exception: handle_error()',
            'try: x = int(s) except ValueError: x = 0',
            'try: do_something() finally: cleanup()'
        ],
        description: 'Exception handling'
    },
    'except': {
        examples: [
            'except ValueError: print("Invalid value")',
            'except (TypeError, ValueError): handle_error()',
            'except Exception as e: print(f"Error: {e}")'
        ],
        description: 'Exception handler'
    },
    'finally': {
        examples: [
            'try: do_work() finally: cleanup()',
            'finally: close_file()',
            'try: risky() except: handle() finally: cleanup()'
        ],
        description: 'Always executed cleanup code'
    },
    'with': {
        examples: [
            'with open("file.txt") as f: content = f.read()',
            'with lock: critical_section()',
            'with context_manager as cm: use(cm)'
        ],
        description: 'Context manager statement'
    },
    'import': {
        examples: [
            'import os',
            'import json as js',
            'import sys, os, re'
        ],
        description: 'Module import statement'
    },
    'from': {
        examples: [
            'from os import path',
            'from json import loads, dumps',
            'from . import module  # relative import'
        ],
        description: 'Selective import statement'
    },
    'return': {
        examples: [
            'def func(): return 42',
            'return x + y',
            'return  # returns None'
        ],
        description: 'Function return statement'
    },
    'yield': {
        examples: [
            'def gen(): yield 1; yield 2',
            'yield from range(5)',
            'result = yield value  # generator receives value'
        ],
        description: 'Generator yield statement'
    },
    'lambda': {
        examples: [
            'square = lambda x: x ** 2',
            'sorted(items, key=lambda x: x.name)',
            'map(lambda x: x * 2, [1, 2, 3])'
        ],
        description: 'Anonymous function expression'
    },
    'pass': {
        examples: [
            'if condition: pass  # placeholder',
            'def todo(): pass  # not implemented yet',
            'class EmptyClass: pass'
        ],
        description: 'No-operation placeholder'
    },
    'break': {
        examples: [
            'for i in range(10): if i == 5: break',
            'while True: if done: break',
            'for item in items: if item is None: break'
        ],
        description: 'Exit from loop'
    },
    'continue': {
        examples: [
            'for i in range(10): if i % 2: continue; print(i)',
            'while True: if skip_condition: continue',
            'for item in items: if not valid(item): continue'
        ],
        description: 'Skip to next loop iteration'
    },
    'raise': {
        examples: [
            'raise ValueError("Invalid input")',
            'raise  # re-raise current exception',
            'raise CustomError("Something went wrong") from e'
        ],
        description: 'Raise an exception'
    },
    'assert': {
        examples: [
            'assert x > 0, "x must be positive"',
            'assert len(items) == 5',
            'assert callable(func), "func must be callable"'
        ],
        description: 'Debug assertion statement'
    },
    'del': {
        examples: [
            'del my_list[0]  # delete first element',
            'del my_dict["key"]  # delete dictionary entry',
            'del variable  # delete variable'
        ],
        description: 'Delete statement'
    },
    'global': {
        examples: [
            'def func(): global x; x = 10',
            'global counter; counter += 1',
            'def reset(): global data; data = []'
        ],
        description: 'Declare global variable'
    },
    'nonlocal': {
        examples: [
            'def outer(): x = 1; def inner(): nonlocal x; x = 2',
            'nonlocal counter; counter += 1',
            'def closure(): nonlocal state; state = "changed"'
        ],
        description: 'Declare nonlocal variable'
    },
    // Boolean and None
    'True': {
        examples: [
            'x = True',
            'if True: print("always runs")',
            'bool(1) == True  # True'
        ],
        description: 'Boolean true value'
    },
    'False': {
        examples: [
            'x = False',
            'if not False: print("runs")',
            'bool(0) == False  # True'
        ],
        description: 'Boolean false value'
    },
    'None': {
        examples: [
            'x = None',
            'if x is None: print("x is None")',
            'def func(): return None  # implicit'
        ],
        description: 'Null value'
    },
    // Common exceptions
    'Exception': {
        examples: [
            'try: risky() except Exception: handle()',
            'raise Exception("Generic error")',
            'class CustomError(Exception): pass'
        ],
        description: 'Base exception class'
    },
    'ValueError': {
        examples: [
            'try: int("not_a_number") except ValueError: handle()',
            'raise ValueError("Invalid value provided")',
            'if x < 0: raise ValueError("x must be non-negative")'
        ],
        description: 'Invalid value exception'
    },
    'TypeError': {
        examples: [
            'try: "string" + 5 except TypeError: handle()',
            'raise TypeError("Expected string, got int")',
            'if not isinstance(x, str): raise TypeError("x must be string")'
        ],
        description: 'Type-related exception'
    },
    'KeyError': {
        examples: [
            'try: my_dict["missing_key"] except KeyError: handle()',
            'raise KeyError("Key not found")',
            'if key not in my_dict: raise KeyError(f"Missing key: {key}")'
        ],
        description: 'Dictionary key not found exception'
    },
    'IndexError': {
        examples: [
            'try: my_list[100] except IndexError: handle()',
            'raise IndexError("List index out of range")',
            'if i >= len(my_list): raise IndexError("Index too large")'
        ],
        description: 'Sequence index out of range exception'
    },
    'AttributeError': {
        examples: [
            'try: obj.missing_attr except AttributeError: handle()',
            'raise AttributeError("Object has no attribute \'x\'")',
            'if not hasattr(obj, "attr"): raise AttributeError("Missing attr")'
        ],
        description: 'Attribute not found exception'
    },
    'FileNotFoundError': {
        examples: [
            'try: open("missing.txt") except FileNotFoundError: handle()',
            'raise FileNotFoundError("File does not exist")',
            'if not os.path.exists(path): raise FileNotFoundError(path)'
        ],
        description: 'File not found exception'
    },
    'ImportError': {
        examples: [
            'try: import missing_module except ImportError: handle()',
            'raise ImportError("Cannot import required module")',
            'try: from module import func except ImportError: func = None'
        ],
        description: 'Module import failed exception'
    },
    'ZeroDivisionError': {
        examples: [
            'try: x / 0 except ZeroDivisionError: handle()',
            'raise ZeroDivisionError("Division by zero")',
            'if divisor == 0: raise ZeroDivisionError("Cannot divide by zero")'
        ],
        description: 'Division by zero exception'
    },
    'StopIteration': {
        examples: [
            'try: next(iterator) except StopIteration: handle()',
            'raise StopIteration("Iterator exhausted")',
            'def my_generator(): yield 1; raise StopIteration'
        ],
        description: 'Iterator exhausted exception'
    },
    // File operations (comprehensive)
    'file-operations': {
        examples: [
            '# Reading files',
            'with open("file.txt", "r") as f: content = f.read()',
            'with open("file.txt", "r", encoding="utf-8") as f: lines = f.readlines()',
            'with open("data.json", "r") as f: data = json.load(f)',
            '',
            '# Writing files',
            'with open("output.txt", "w") as f: f.write("Hello")',
            'with open("data.json", "w") as f: json.dump(data, f)',
            'with open("log.txt", "a") as f: f.write("New entry\\n")',
            '',
            '# Binary files',
            'with open("image.jpg", "rb") as f: data = f.read()',
            'with open("output.bin", "wb") as f: f.write(bytes_data)',
            '',
            '# Advanced modes',
            'f = open("file.txt", "r+")  # read and write',
            'f = open("file.txt", "x")   # exclusive creation'
        ],
        description: 'Comprehensive file operation patterns'
    },
    // String formatting
    'f-string': {
        examples: [
            'name = "Alice"; f"Hello, {name}!"  # "Hello, Alice!"',
            'x = 42; f"The answer is {x}"  # "The answer is 42"',
            'pi = 3.14159; f"Pi is {pi:.2f}"  # "Pi is 3.14"',
            'items = [1, 2, 3]; f"Items: {items}"  # "Items: [1, 2, 3]"',
            '',
            '# Expressions in f-strings',
            'f"{2 + 3}"  # "5"',
            'f"{len([1, 2, 3])}"  # "3"',
            'f"{\'hello\'.upper()}"  # "HELLO"',
            '',
            '# Format specifiers',
            'f"{42:05d}"  # "00042" (zero-padded)',
            'f"{3.14159:.3f}"  # "3.142" (3 decimal places)',
            'f"{255:x}"  # "ff" (hexadecimal)',
            'f"{1000000:,}"  # "1,000,000" (thousands separator)'
        ],
        description: 'F-string literal for formatted string expressions'
    },
    // Comprehensions
    'list-comprehension': {
        examples: [
            '# Basic list comprehensions',
            '[x**2 for x in range(5)]  # [0, 1, 4, 9, 16]',
            '[x for x in range(10) if x % 2 == 0]  # [0, 2, 4, 6, 8]',
            '[len(word) for word in ["hello", "world"]]  # [5, 5]',
            '',
            '# Nested comprehensions',
            '[[x*y for x in range(3)] for y in range(3)]',
            '[x for sublist in lists for x in sublist]  # flatten',
            '',
            '# With functions',
            '[word.upper() for word in words]',
            '[int(x) for x in "12345"]  # [1, 2, 3, 4, 5]',
            '',
            '# Complex conditions',
            '[x for x in range(20) if x % 2 == 0 if x % 3 == 0]',
            '[x if x > 0 else 0 for x in numbers]  # conditional expression'
        ],
        description: 'List comprehension syntax for creating lists'
    },
    'dict-comprehension': {
        examples: [
            '# Basic dict comprehensions',
            '{x: x**2 for x in range(5)}  # {0: 0, 1: 1, 2: 4, 3: 9, 4: 16}',
            '{word: len(word) for word in ["hello", "world"]}',
            '{k: v.upper() for k, v in my_dict.items()}',
            '',
            '# With conditions',
            '{x: x**2 for x in range(10) if x % 2 == 0}',
            '{k: v for k, v in my_dict.items() if v is not None}',
            '',
            '# From sequences',
            '{i: chr(65+i) for i in range(26)}  # {0: "A", 1: "B", ...}',
            'dict(enumerate(["a", "b", "c"]))  # {0: "a", 1: "b", 2: "c"}'
        ],
        description: 'Dictionary comprehension syntax for creating dictionaries'
    },
    'set-comprehension': {
        examples: [
            '# Basic set comprehensions',
            '{x**2 for x in range(5)}  # {0, 1, 4, 9, 16}',
            '{len(word) for word in words}',
            '{x % 3 for x in range(10)}  # {0, 1, 2}',
            '',
            '# With conditions',
            '{x for x in range(20) if x % 2 == 0}',
            '{word.lower() for word in words if len(word) > 3}'
        ],
        description: 'Set comprehension syntax for creating sets'
    },
    // Generator expressions
    'generator-expression': {
        examples: [
            '# Basic generator expressions',
            'gen = (x**2 for x in range(5))',
            'sum(x for x in range(100) if x % 2 == 0)',
            'max(len(line) for line in file)',
            '',
            '# Memory efficient',
            'total = sum(x**2 for x in huge_list)  # no intermediate list',
            'any(x > 100 for x in numbers)  # stops at first True',
            'all(x > 0 for x in numbers)  # stops at first False',
            '',
            '# Chaining',
            'words = (line.strip() for line in file)',
            'lengths = (len(word) for word in words)',
            'result = list(lengths)'
        ],
        description: 'Generator expression for memory-efficient iteration'
    },
    // Advanced string methods
    'str.format_map': {
        examples: [
            'template = "Hello {name}, you are {age} years old"',
            'data = {"name": "Alice", "age": 30}',
            'template.format_map(data)  # "Hello Alice, you are 30 years old"',
            '',
            'class SafeDict(dict):',
            '    def __missing__(self, key): return "{" + key + "}"',
            'template.format_map(SafeDict(name="Bob"))  # missing keys safe'
        ],
        description: 'Formats string using mapping object'
    },
    'str.partition': {
        examples: [
            '"hello-world-python".partition("-")  # ("hello", "-", "world-python")',
            '"no-separator".partition("-")  # ("no-separator", "", "")',
            'email = "user@domain.com"',
            'username, sep, domain = email.partition("@")'
        ],
        description: 'Splits string into three parts around separator'
    },
    'str.rpartition': {
        examples: [
            '"hello-world-python".rpartition("-")  # ("hello-world", "-", "python")',
            'path = "/home/user/file.txt"',
            'directory, sep, filename = path.rpartition("/")'
        ],
        description: 'Splits string into three parts around last separator'
    },
    'str.expandtabs': {
        examples: [
            '"hello\\tworld".expandtabs()  # "hello   world" (8 spaces)',
            '"hello\\tworld".expandtabs(4)  # "hello   world" (4 spaces)',
            'code = "def\\tfunc():\\n\\tpass"',
            'print(code.expandtabs(4))  # proper indentation'
        ],
        description: 'Expands tabs to spaces'
    },
    'str.translate': {
        examples: [
            '# Create translation table',
            'table = str.maketrans("aeiou", "12345")',
            '"hello world".translate(table)  # "h2ll4 w4rld"',
            '',
            '# Remove characters',
            'table = str.maketrans("", "", "aeiou")',
            '"hello world".translate(table)  # "hll wrld"',
            '',
            '# Unicode translation',
            'table = str.maketrans("αβγ", "abc")',
            '"αβγδε".translate(table)  # "abcδε"'
        ],
        description: 'Translates characters using translation table'
    },
    // Advanced list operations
    'list-advanced': {
        examples: [
            '# Shallow copy',
            'original = [1, [2, 3], 4]',
            'copy = original.copy()',
            'copy[0] = 99  # original unchanged',
            'copy[1][0] = 99  # original[1] also changes!',
            '',
            '# Alternative methods',
            'copy = original[:]  # slice copy',
            'copy = list(original)  # constructor copy',
            '',
            '# Deep copy (for nested structures)',
            'import copy',
            'deep_copy = copy.deepcopy(original)'
        ],
        description: 'Advanced list operations and copying'
    },
    // Dictionary advanced methods
    'dict.fromkeys': {
        examples: [
            '# Create dict with same value',
            'dict.fromkeys(["a", "b", "c"], 0)  # {"a": 0, "b": 0, "c": 0}',
            'dict.fromkeys("abc")  # {"a": None, "b": None, "c": None}',
            'dict.fromkeys(range(3), [])  # {0: [], 1: [], 2: []}',
            '',
            '# Warning: mutable defaults share reference!',
            'd = dict.fromkeys(["a", "b"], [])',
            'd["a"].append(1)  # d becomes {"a": [1], "b": [1]}',
            '',
            '# Safe pattern for mutable defaults',
            'd = {k: [] for k in ["a", "b"]}  # each gets own list'
        ],
        description: 'Creates dictionary from keys with same default value'
    },
    // Advanced iteration tools
    'itertools.chain': {
        examples: [
            'import itertools',
            'list1 = [1, 2, 3]',
            'list2 = [4, 5, 6]',
            'list(itertools.chain(list1, list2))  # [1, 2, 3, 4, 5, 6]',
            '',
            '# Chain multiple iterables',
            'itertools.chain([1, 2], "abc", [3, 4])  # 1, 2, "a", "b", "c", 3, 4',
            '',
            '# Chain from iterable of iterables',
            'lists = [[1, 2], [3, 4], [5, 6]]',
            'list(itertools.chain.from_iterable(lists))  # [1, 2, 3, 4, 5, 6]'
        ],
        description: 'Chains multiple iterables together'
    },
    'itertools.combinations': {
        examples: [
            'import itertools',
            'items = ["A", "B", "C", "D"]',
            'list(itertools.combinations(items, 2))',
            '# [("A", "B"), ("A", "C"), ("A", "D"), ("B", "C"), ("B", "D"), ("C", "D")]',
            '',
            '# All possible pairs',
            'for pair in itertools.combinations(range(4), 2):',
            '    print(pair)  # (0,1), (0,2), (0,3), (1,2), (1,3), (2,3)',
            '',
            '# Combinations of different lengths',
            'list(itertools.combinations("abc", 1))  # [("a",), ("b",), ("c",)]'
        ],
        description: 'Returns combinations of elements'
    },
    'itertools.permutations': {
        examples: [
            'import itertools',
            'items = ["A", "B", "C"]',
            'list(itertools.permutations(items))',
            '# [("A","B","C"), ("A","C","B"), ("B","A","C"), ("B","C","A"), ("C","A","B"), ("C","B","A")]',
            '',
            '# Permutations of specific length',
            'list(itertools.permutations("abc", 2))',
            '# [("a","b"), ("a","c"), ("b","a"), ("b","c"), ("c","a"), ("c","b")]',
            '',
            '# Generate all arrangements',
            'for perm in itertools.permutations(range(3)):',
            '    print(perm)'
        ],
        description: 'Returns permutations of elements'
    },
    'itertools.product': {
        examples: [
            'import itertools',
            'colors = ["red", "blue"]',
            'sizes = ["S", "M", "L"]',
            'list(itertools.product(colors, sizes))',
            '# [("red","S"), ("red","M"), ("red","L"), ("blue","S"), ("blue","M"), ("blue","L")]',
            '',
            '# Cartesian product with repeat',
            'list(itertools.product("AB", repeat=2))  # [("A","A"), ("A","B"), ("B","A"), ("B","B")]',
            '',
            '# Multiple iterables',
            'list(itertools.product([1, 2], ["a", "b"], [10, 20]))'
        ],
        description: 'Cartesian product of iterables'
    },
    // More advanced built-ins
    'setattr': {
        examples: [
            '# Set attribute on object',
            'setattr(obj, "name", "Alice")',
            'setattr(obj, "age", 30)',
            '',
            '# Dynamic attribute setting',
            'attr_name = "dynamic_attr"',
            'setattr(obj, attr_name, "dynamic_value")',
            '',
            '# Set method on class',
            'def new_method(self): return "hello"',
            'setattr(MyClass, "greet", new_method)'
        ],
        description: 'Sets attribute on object'
    },
    'delattr': {
        examples: [
            '# Delete attribute from object',
            'delattr(obj, "name")',
            '',
            '# Conditional deletion',
            'if hasattr(obj, "temp_attr"):',
            '    delattr(obj, "temp_attr")',
            '',
            '# Dynamic attribute deletion',
            'attr_to_delete = "unwanted_attr"',
            'delattr(obj, attr_to_delete)'
        ],
        description: 'Deletes attribute from object'
    },
    // Type checking (comprehensive)
    'type-checking': {
        examples: [
            '# Basic type checking',
            'isinstance(42, int)  # True',
            'isinstance("hello", str)  # True',
            'isinstance([1, 2, 3], list)  # True',
            '',
            '# Multiple types',
            'isinstance(value, (int, float))  # True if int OR float',
            'isinstance(obj, (list, tuple, set))  # True if any sequence type',
            '',
            '# Class inheritance',
            'class Animal: pass',
            'class Dog(Animal): pass',
            'my_dog = Dog()',
            'isinstance(my_dog, Animal)  # True (inheritance)',
            'isinstance(my_dog, Dog)     # True (exact type)'
        ],
        description: 'Comprehensive type checking with isinstance'
    },
    'issubclass': {
        examples: [
            '# Check inheritance',
            'class Animal: pass',
            'class Dog(Animal): pass',
            'issubclass(Dog, Animal)  # True',
            'issubclass(Animal, Dog)  # False',
            '',
            '# Multiple parent classes',
            'issubclass(bool, int)  # True (bool inherits from int)',
            'issubclass(Dog, (Animal, object))  # True if subclass of any',
            '',
            '# Built-in types',
            'issubclass(list, object)  # True (everything inherits from object)',
            'issubclass(int, (int, float))  # True'
        ],
        description: 'Checks if class is subclass of another class'
    },
    // Context managers
    'contextlib.contextmanager': {
        examples: [
            'from contextlib import contextmanager',
            '',
            '@contextmanager',
            'def my_context():',
            '    print("Entering context")',
            '    try:',
            '        yield "resource"',
            '    finally:',
            '        print("Exiting context")',
            '',
            '# Usage',
            'with my_context() as resource:',
            '    print(f"Using {resource}")',
            '',
            '# Error handling context',
            '@contextmanager',
            'def database_transaction():',
            '    try:',
            '        db.begin()',
            '        yield db',
            '        db.commit()',
            '    except Exception:',
            '        db.rollback()',
            '        raise'
        ],
        description: 'Decorator to create context managers from generators'
    },
    // Decorators
    'functools.wraps': {
        examples: [
            'from functools import wraps',
            '',
            'def my_decorator(func):',
            '    @wraps(func)',
            '    def wrapper(*args, **kwargs):',
            '        print(f"Calling {func.__name__}")',
            '        return func(*args, **kwargs)',
            '    return wrapper',
            '',
            '@my_decorator',
            'def greet(name):',
            '    """Greets a person"""',
            '    return f"Hello, {name}!"',
            '',
            '# Preserves original function metadata',
            'print(greet.__name__)  # "greet" (not "wrapper")',
            'print(greet.__doc__)   # "Greets a person"'
        ],
        description: 'Preserves function metadata when decorating'
    },
    'functools.lru_cache': {
        examples: [
            'from functools import lru_cache',
            '',
            '@lru_cache(maxsize=128)',
            'def fibonacci(n):',
            '    if n < 2:',
            '        return n',
            '    return fibonacci(n-1) + fibonacci(n-2)',
            '',
            '# Faster recursive calls due to caching',
            'print(fibonacci(100))',
            '',
            '# Cache info',
            'print(fibonacci.cache_info())  # hits, misses, maxsize, currsize',
            'fibonacci.cache_clear()  # clear cache'
        ],
        description: 'LRU (Least Recently Used) cache decorator'
    },
    // Pattern matching (Python 3.10+)
    'match': {
        examples: [
            '# Basic pattern matching',
            'match value:',
            '    case 1:',
            '        print("one")',
            '    case 2:',
            '        print("two")',
            '    case _:',
            '        print("other")',
            '',
            '# Pattern with conditions',
            'match point:',
            '    case (x, y) if x == y:',
            '        print("Diagonal")',
            '    case (x, 0):',
            '        print("On x-axis")',
            '    case (0, y):',
            '        print("On y-axis")',
            '',
            '# Class patterns',
            'match shape:',
            '    case Circle(radius=r):',
            '        print(f"Circle with radius {r}")',
            '    case Rectangle(width=w, height=h):',
            '        print(f"Rectangle {w}x{h}")'
        ],
        description: 'Structural pattern matching (Python 3.10+)'
    },
    // Additional operators and keywords
    'and': {
        examples: [
            '# Logical AND',
            'if age >= 18 and has_license:',
            '    print("Can drive")',
            '',
            '# Multiple conditions',
            'if x > 0 and x < 100 and x % 2 == 0:',
            '    print("Even number between 0 and 100")',
            '',
            '# Short-circuit evaluation',
            'if user and user.is_active():',
            '    print("Active user")',
            '',
            '# In expressions',
            'result = condition1 and condition2 and condition3',
            'valid = name and email and password'
        ],
        description: 'Logical AND operator'
    },
    'or': {
        examples: [
            '# Logical OR',
            'if is_admin or is_moderator:',
            '    print("Has elevated privileges")',
            '',
            '# Default values',
            'name = user_name or "Anonymous"',
            'config = custom_config or default_config',
            '',
            '# Multiple conditions',
            'if status == "error" or status == "failed" or status == "timeout":',
            '    handle_error()',
            '',
            '# Function parameters',
            'def greet(name=None):',
            '    name = name or "World"',
            '    print(f"Hello, {name}!")'
        ],
        description: 'Logical OR operator'
    },
    'not': {
        examples: [
            '# Logical NOT',
            'if not is_empty(list):',
            '    process(list)',
            '',
            '# Negating conditions',
            'if not (age < 18 or age > 65):',
            '    print("Working age")',
            '',
            '# Boolean negation',
            'active = not inactive',
            'visible = not hidden',
            '',
            '# Membership testing',
            'if item not in forbidden_items:',
            '    allow_item(item)',
            '',
            '# Identity testing',
            'if response is not None:',
            '    process_response(response)'
        ],
        description: 'Logical NOT operator'
    },
    'in': {
        examples: [
            '# List membership',
            'if item in shopping_list:',
            '    print("Already in cart")',
            '',
            '# String containment',
            'if "error" in log_message:',
            '    handle_error()',
            '',
            '# Dictionary keys',
            'if "name" in user_data:',
            '    name = user_data["name"]',
            '',
            '# Range checking',
            'if score in range(90, 101):',
            '    grade = "A"',
            '',
            '# Multiple containers',
            'valid_extensions = [".txt", ".csv", ".json"]',
            'if file_extension in valid_extensions:',
            '    process_file()'
        ],
        description: 'Membership testing operator'
    },
    'is': {
        examples: [
            '# Identity comparison',
            'if value is None:',
            '    print("No value provided")',
            '',
            '# Boolean literals',
            'if flag is True:',
            '    activate_feature()',
            'if status is False:',
            '    show_error()',
            '',
            '# Same object check',
            'if current_user is admin_user:',
            '    print("Admin logged in")',
            '',
            '# Type checking',
            'if type(obj) is list:',
            '    process_list(obj)',
            '',
            '# Singleton comparison',
            'if result is not None:',
            '    return result'
        ],
        description: 'Identity comparison operator'
    },
    // Async/await keywords for modern Python
    'async': {
        examples: [
            '# Async function definition',
            'async def fetch_data():',
            '    response = await http_client.get(url)',
            '    return response.json()',
            '',
            '# Async context manager',
            'async def process_file():',
            '    async with aiofiles.open("file.txt") as f:',
            '        content = await f.read()',
            '        return content',
            '',
            '# Async generator',
            'async def async_range(n):',
            '    for i in range(n):',
            '        await asyncio.sleep(0.1)',
            '        yield i',
            '',
            '# Async comprehension',
            'results = [item async for item in async_generator()]'
        ],
        description: 'Async function and coroutine definition'
    },
    'await': {
        examples: [
            '# Await coroutine',
            'async def main():',
            '    result = await fetch_data()',
            '    return result',
            '',
            '# Await with error handling',
            'async def safe_operation():',
            '    try:',
            '        result = await risky_async_operation()',
            '        return result',
            '    except Exception as e:',
            '        print(f"Error: {e}")',
            '        return None',
            '',
            '# Multiple awaits',
            'async def parallel_tasks():',
            '    task1 = asyncio.create_task(fetch_data())',
            '    task2 = asyncio.create_task(process_data())',
            '    result1 = await task1',
            '    result2 = await task2',
            '    return result1, result2'
        ],
        description: 'Await expression for coroutines'
    }
};
/**
 * Get static examples for a given symbol name
 */
function getStaticExamples(symbolName) {
    // Direct match
    if (exports.STATIC_EXAMPLES[symbolName]) {
        return exports.STATIC_EXAMPLES[symbolName];
    }
    // Try without module prefix (e.g., "builtins.len" -> "len")
    const withoutModule = symbolName.split('.').pop();
    if (withoutModule && exports.STATIC_EXAMPLES[withoutModule]) {
        return exports.STATIC_EXAMPLES[withoutModule];
    }
    // Try common method patterns
    const methodPatterns = [
        symbolName,
        symbolName.replace(/^object\./, ''), // object.__str__ -> __str__
        symbolName.replace(/^.*\./, '') // any.module.method -> method
    ];
    for (const pattern of methodPatterns) {
        if (exports.STATIC_EXAMPLES[pattern]) {
            return exports.STATIC_EXAMPLES[pattern];
        }
    }
    return null;
}
//# sourceMappingURL=staticExamples.js.map