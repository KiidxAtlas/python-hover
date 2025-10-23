/**
 * Python Documentation URLs and Mappings
 *
 * @author KiidxAtlas
 * @copyright 2025 KiidxAtlas. All rights reserved.
 * @license MIT
 *
 * This file contains comprehensive documentation URLs for Python keywords,
 * built-in functions, operators, and standard library modules.
 *
 * Original compilation and curation by KiidxAtlas - 2025
 */

import { Info } from '../types';

// Documentation mapping signature - KiidxAtlas
const _DOC_MAP_AUTHOR = 'KiidxAtlas-2025';

export const MAP: Record<string, Info> = {
    class: { title: 'class — Class Definitions', url: 'reference/compound_stmts.html', anchor: 'class-definitions' },
    def: { title: 'def — Function Definitions', url: 'reference/compound_stmts.html', anchor: 'function-definitions' },
    return: { title: 'return — Return Statement', url: 'reference/simple_stmts.html', anchor: 'the-return-statement' },
    with: { title: 'with — Context Managers', url: 'reference/compound_stmts.html', anchor: 'the-with-statement' },
    yield: { title: 'yield — Yield Expressions', url: 'reference/expressions.html', anchor: 'yield-expressions' },
    async: { title: 'async — Asynchronous Functions', url: 'reference/compound_stmts.html', anchor: 'the-async-for-statement' },
    await: { title: 'await — Await Expressions', url: 'reference/expressions.html', anchor: 'await-expression' },
    // 'import' and 'from' map to the import system documentation. See IMPORT_INFO below.
    try: { title: 'try — Exception Handling', url: 'reference/compound_stmts.html', anchor: 'the-try-statement' },
    if: { title: 'if — Conditional Statements', url: 'reference/compound_stmts.html', anchor: 'the-if-statement' },
    for: { title: 'for — For Loops', url: 'reference/compound_stmts.html', anchor: 'the-for-statement' },
    while: { title: 'while — While Loops', url: 'reference/compound_stmts.html', anchor: 'the-while-statement' },
    except: { title: 'except — Exception Handlers', url: 'reference/executionmodel.html', anchor: 'exceptions' },
    finally: { title: 'finally — Cleanup Code', url: 'reference/compound_stmts.html', anchor: 'finally-clause' },
    else: { title: 'else — Alternative Execution', url: 'reference/compound_stmts.html', anchor: 'else-clause' },
    elif: { title: 'elif — Else If', url: 'reference/compound_stmts.html', anchor: 'the-if-statement' },
    break: { title: 'break — Loop Termination', url: 'reference/simple_stmts.html', anchor: 'the-break-statement' },
    continue: { title: 'continue — Loop Continuation', url: 'reference/simple_stmts.html', anchor: 'the-continue-statement' },
    pass: { title: 'pass — No Operation', url: 'reference/simple_stmts.html', anchor: 'the-pass-statement' },
    lambda: { title: 'lambda — Anonymous Functions', url: 'reference/expressions.html', anchor: 'lambda' },
    'f-string': { title: 'f-strings — Formatted String Literals', url: 'reference/lexical_analysis.html', anchor: 'formatted-string-literals' },
    global: { title: 'global — Global Variables', url: 'reference/simple_stmts.html', anchor: 'the-global-statement' },
    nonlocal: { title: 'nonlocal — Nonlocal Variables', url: 'reference/simple_stmts.html', anchor: 'the-nonlocal-statement' },
    raise: { title: 'raise — Raise Exception', url: 'reference/simple_stmts.html', anchor: 'the-raise-statement' },
    assert: { title: 'assert — Debug Assertion', url: 'reference/simple_stmts.html', anchor: 'the-assert-statement' },
    del: { title: 'del — Delete Statement', url: 'reference/simple_stmts.html', anchor: 'the-del-statement' },
    match: { title: 'match — Pattern Matching (Python 3.10+)', url: 'reference/compound_stmts.html', anchor: 'the-match-statement' },
    case: { title: 'case — Match Case (Python 3.10+)', url: 'reference/compound_stmts.html', anchor: 'the-match-statement' },

    // Logical operators and keywords
    and: { title: 'and — Logical AND', url: 'reference/expressions.html', anchor: 'boolean-operations' },
    or: { title: 'or — Logical OR', url: 'reference/expressions.html', anchor: 'boolean-operations' },
    not: { title: 'not — Logical NOT', url: 'reference/expressions.html', anchor: 'unary-arithmetic-and-bitwise-operations' },
    is: { title: 'is — Identity Comparison', url: 'reference/expressions.html', anchor: 'identity-comparisons' },
    in: { title: 'in — Membership Test', url: 'reference/expressions.html', anchor: 'membership-test-operations' },

    // Comparison operators (using string keys for special characters)
    '==': { title: '== — Equality Comparison', url: 'reference/expressions.html', anchor: 'value-comparisons' },
    '!=': { title: '!= — Inequality Comparison', url: 'reference/expressions.html', anchor: 'value-comparisons' },
    '<': { title: '< — Less Than', url: 'reference/expressions.html', anchor: 'value-comparisons' },
    '>': { title: '> — Greater Than', url: 'reference/expressions.html', anchor: 'value-comparisons' },
    '<=': { title: '<= — Less Than or Equal', url: 'reference/expressions.html', anchor: 'value-comparisons' },
    '>=': { title: '>= — Greater Than or Equal', url: 'reference/expressions.html', anchor: 'value-comparisons' },

    // Arithmetic operators
    '+': { title: '+ — Addition', url: 'reference/expressions.html', anchor: 'binary-arithmetic-operations' },
    '-': { title: '- — Subtraction', url: 'reference/expressions.html', anchor: 'binary-arithmetic-operations' },
    '*': { title: '* — Multiplication', url: 'reference/expressions.html', anchor: 'binary-arithmetic-operations' },
    '/': { title: '/ — Division', url: 'reference/expressions.html', anchor: 'binary-arithmetic-operations' },
    '//': { title: '// — Floor Division', url: 'reference/expressions.html', anchor: 'binary-arithmetic-operations' },
    '%': { title: '% — Modulo', url: 'reference/expressions.html', anchor: 'binary-arithmetic-operations' },
    '**': { title: '** — Exponentiation', url: 'reference/expressions.html', anchor: 'the-power-operator' },

    // Bitwise operators
    '&': { title: '& — Bitwise AND', url: 'reference/expressions.html', anchor: 'binary-bitwise-operations' },
    '|': { title: '| — Bitwise OR', url: 'reference/expressions.html', anchor: 'binary-bitwise-operations' },
    '^': { title: '^ — Bitwise XOR', url: 'reference/expressions.html', anchor: 'binary-bitwise-operations' },
    '~': { title: '~ — Bitwise NOT', url: 'reference/expressions.html', anchor: 'unary-arithmetic-and-bitwise-operations' },
    '<<': { title: '<< — Left Shift', url: 'reference/expressions.html', anchor: 'shifting-operations' },
    '>>': { title: '>> — Right Shift', url: 'reference/expressions.html', anchor: 'shifting-operations' },

    // Assignment operators
    '=': { title: '= — Assignment', url: 'reference/simple_stmts.html', anchor: 'assignment-statements' },
    '+=': { title: '+= — Addition Assignment', url: 'reference/simple_stmts.html', anchor: 'augmented-assignment-statements' },
    '-=': { title: '-= — Subtraction Assignment', url: 'reference/simple_stmts.html', anchor: 'augmented-assignment-statements' },
    '*=': { title: '*= — Multiplication Assignment', url: 'reference/simple_stmts.html', anchor: 'augmented-assignment-statements' },
    '/=': { title: '/= — Division Assignment', url: 'reference/simple_stmts.html', anchor: 'augmented-assignment-statements' },
    '//=': { title: '//= — Floor Division Assignment', url: 'reference/simple_stmts.html', anchor: 'augmented-assignment-statements' },
    '%=': { title: '%= — Modulo Assignment', url: 'reference/simple_stmts.html', anchor: 'augmented-assignment-statements' },
    '**=': { title: '**= — Exponentiation Assignment', url: 'reference/simple_stmts.html', anchor: 'augmented-assignment-statements' },
    '&=': { title: '&= — Bitwise AND Assignment', url: 'reference/simple_stmts.html', anchor: 'augmented-assignment-statements' },
    '|=': { title: '|= — Bitwise OR Assignment', url: 'reference/simple_stmts.html', anchor: 'augmented-assignment-statements' },
    '^=': { title: '^= — Bitwise XOR Assignment', url: 'reference/simple_stmts.html', anchor: 'augmented-assignment-statements' },
    '<<=': { title: '<<= — Left Shift Assignment', url: 'reference/simple_stmts.html', anchor: 'augmented-assignment-statements' },
    '>>=': { title: '>>= — Right Shift Assignment', url: 'reference/simple_stmts.html', anchor: 'augmented-assignment-statements' },

    // Built-ins
    print: { title: 'print() — Print Objects', url: 'library/functions.html', anchor: 'print' },
    len: { title: 'len() — Return Length', url: 'library/functions.html', anchor: 'len' },
    range: { title: 'range() — Range Object', url: 'library/functions.html', anchor: 'func-range' },
    enumerate: { title: 'enumerate() — Enumerate Object', url: 'library/functions.html', anchor: 'enumerate' },
    zip: { title: 'zip() — Zip Iterator', url: 'library/functions.html', anchor: 'zip' },
    map: { title: 'map() — Apply Function', url: 'library/functions.html', anchor: 'map' },
    filter: { title: 'filter() — Filter Elements', url: 'library/functions.html', anchor: 'filter' },
    sorted: { title: 'sorted() — Return Sorted List', url: 'library/functions.html', anchor: 'sorted' },
    reversed: { title: 'reversed() — Reverse Iterator', url: 'library/functions.html', anchor: 'reversed' },
    sum: { title: 'sum() — Sum Iterable', url: 'library/functions.html', anchor: 'sum' },
    max: { title: 'max() — Maximum Value', url: 'library/functions.html', anchor: 'max' },
    min: { title: 'min() — Minimum Value', url: 'library/functions.html', anchor: 'min' },
    abs: { title: 'abs() — Absolute Value', url: 'library/functions.html', anchor: 'abs' },
    round: { title: 'round() — Round Number', url: 'library/functions.html', anchor: 'round' },
    any: { title: 'any() — Any True', url: 'library/functions.html', anchor: 'any' },
    all: { title: 'all() — All True', url: 'library/functions.html', anchor: 'all' },
    open: { title: 'open() — Open File', url: 'library/functions.html', anchor: 'open' },
    isinstance: { title: 'isinstance() — Type Check', url: 'library/functions.html', anchor: 'isinstance' },
    issubclass: { title: 'issubclass() — Subclass Check', url: 'library/functions.html', anchor: 'issubclass' },
    getattr: { title: 'getattr() — Get Attribute', url: 'library/functions.html', anchor: 'getattr' },
    setattr: { title: 'setattr() — Set Attribute', url: 'library/functions.html', anchor: 'setattr' },
    hasattr: { title: 'hasattr() — Has Attribute', url: 'library/functions.html', anchor: 'hasattr' },
    delattr: { title: 'delattr() — Delete Attribute', url: 'library/functions.html', anchor: 'delattr' },
    id: { title: 'id() — Identity', url: 'library/functions.html', anchor: 'id' },
    pow: { title: 'pow() — Exponentiation', url: 'library/functions.html', anchor: 'pow' },
    iter: { title: 'iter() — Iterator', url: 'library/functions.html', anchor: 'iter' },
    next: { title: 'next() — Next Item', url: 'library/functions.html', anchor: 'next' },
    type: { title: 'type() — Return Type', url: 'library/functions.html', anchor: 'type' },
    vars: { title: 'vars() — Object Variables', url: 'library/functions.html', anchor: 'vars' },
    dir: { title: 'dir() — List Attributes', url: 'library/functions.html', anchor: 'dir' },
    help: { title: 'help() — Interactive Help', url: 'library/functions.html', anchor: 'help' },
    input: { title: 'input() — Read Input', url: 'library/functions.html', anchor: 'input' },
    eval: { title: 'eval() — Evaluate Expression', url: 'library/functions.html', anchor: 'eval' },
    exec: { title: 'exec() — Execute Code', url: 'library/functions.html', anchor: 'exec' },
    compile: { title: 'compile() — Compile Source', url: 'library/functions.html', anchor: 'compile' },
    hash: { title: 'hash() — Hash Value', url: 'library/functions.html', anchor: 'hash' },
    hex: { title: 'hex() — Hexadecimal', url: 'library/functions.html', anchor: 'hex' },
    oct: { title: 'oct() — Octal', url: 'library/functions.html', anchor: 'oct' },
    bin: { title: 'bin() — Binary', url: 'library/functions.html', anchor: 'bin' },
    ord: { title: 'ord() — Unicode Point', url: 'library/functions.html', anchor: 'ord' },
    chr: { title: 'chr() — Character', url: 'library/functions.html', anchor: 'chr' },
    ascii: { title: 'ascii() — ASCII Representation', url: 'library/functions.html', anchor: 'ascii' },
    repr: { title: 'repr() — String Representation', url: 'library/functions.html', anchor: 'repr' },
    format: { title: 'format() — Format Value', url: 'library/functions.html', anchor: 'format' },
    divmod: { title: 'divmod() — Division & Modulo', url: 'library/functions.html', anchor: 'divmod' },
    callable: { title: 'callable() — Check if Callable', url: 'library/functions.html', anchor: 'callable' },
    super: { title: 'super() — Access Parent Class', url: 'library/functions.html', anchor: 'super' },
    staticmethod: { title: 'staticmethod() — Static Method', url: 'library/functions.html', anchor: 'staticmethod' },
    classmethod: { title: 'classmethod() — Class Method', url: 'library/functions.html', anchor: 'classmethod' },
    property: { title: 'property() — Property Descriptor', url: 'library/functions.html', anchor: 'property' },
    slice: { title: 'slice() — Slice Object', url: 'library/functions.html', anchor: 'slice' },
    object: { title: 'object() — Base Object', url: 'library/functions.html', anchor: 'object' },
    bytes: { title: 'bytes() — Bytes Type', url: 'library/functions.html', anchor: 'bytes' },
    bytearray: { title: 'bytearray() — Mutable Bytes', url: 'library/functions.html', anchor: 'bytearray' },
    memoryview: { title: 'memoryview() — Memory View', url: 'library/functions.html', anchor: 'memoryview' },
    frozenset: { title: 'frozenset() — Immutable Set', url: 'library/functions.html', anchor: 'frozenset' },
    complex: { title: 'complex() — Complex Number', url: 'library/functions.html', anchor: 'complex' },
    locals: { title: 'locals() — Local Variables', url: 'library/functions.html', anchor: 'locals' },
    globals: { title: 'globals() — Global Variables', url: 'library/functions.html', anchor: 'globals' },
    breakpoint: { title: 'breakpoint() — Debug Breakpoint', url: 'library/functions.html', anchor: 'breakpoint' },
    // Python 3.10+ additions
    __import__: { title: '__import__() — Import Function', url: 'library/functions.html', anchor: 'import__' },
    aiter: { title: 'aiter() — Async Iterator (3.10+)', url: 'library/functions.html', anchor: 'aiter' },
    anext: { title: 'anext() — Async Next (3.10+)', url: 'library/functions.html', anchor: 'anext' },
    // Data types
    str: { title: 'str — String Type', url: 'library/stdtypes.html', anchor: 'text-sequence-type-str' },
    int: { title: 'int — Integer Type', url: 'library/functions.html', anchor: 'int' },
    float: { title: 'float — Floating Point', url: 'library/functions.html', anchor: 'float' },
    bool: { title: 'bool — Boolean Type', url: 'library/functions.html', anchor: 'bool' },
    list: { title: 'list — List Type', url: 'library/stdtypes.html', anchor: 'list' },
    dict: { title: 'dict — Dictionary Type', url: 'library/stdtypes.html', anchor: 'dict' },
    set: { title: 'set — Set Type', url: 'library/stdtypes.html', anchor: 'set' },
    tuple: { title: 'tuple — Tuple Type', url: 'library/stdtypes.html', anchor: 'tuple' },
    // Constants
    None: { title: 'None — Null Value', url: 'library/constants.html', anchor: 'None' },
    True: { title: 'True — Boolean True', url: 'library/constants.html', anchor: 'True' },
    False: { title: 'False — Boolean False', url: 'library/constants.html', anchor: 'False' },
    // Exceptions (partial list)
    Exception: { title: 'Exception — Base Exception', url: 'library/exceptions.html', anchor: 'Exception' },
    BaseException: { title: 'BaseException — Root of Exceptions', url: 'library/exceptions.html', anchor: 'BaseException' },
    ValueError: { title: 'ValueError — Invalid Value', url: 'library/exceptions.html', anchor: 'ValueError' },
    TypeError: { title: 'TypeError — Invalid Type', url: 'library/exceptions.html', anchor: 'TypeError' },
    KeyError: { title: 'KeyError — Missing Mapping Key', url: 'library/exceptions.html', anchor: 'KeyError' },
    IndexError: { title: 'IndexError — Sequence Index Out of Range', url: 'library/exceptions.html', anchor: 'IndexError' },
    StopIteration: { title: 'StopIteration — Iterator Exhausted', url: 'library/exceptions.html', anchor: 'StopIteration' },
    ImportError: { title: 'ImportError — Import Failed', url: 'library/exceptions.html', anchor: 'ImportError' },
    AttributeError: { title: 'AttributeError — Attribute Error', url: 'library/exceptions.html', anchor: 'AttributeError' },
    NameError: { title: 'NameError — Name Not Found', url: 'library/exceptions.html', anchor: 'NameError' },
    RuntimeError: { title: 'RuntimeError — Runtime Error', url: 'library/exceptions.html', anchor: 'RuntimeError' },
    NotImplementedError: { title: 'NotImplementedError — Not Implemented', url: 'library/exceptions.html', anchor: 'NotImplementedError' },
    FileNotFoundError: { title: 'FileNotFoundError — File Not Found', url: 'library/exceptions.html', anchor: 'FileNotFoundError' },
    PermissionError: { title: 'PermissionError — Permission Denied', url: 'library/exceptions.html', anchor: 'PermissionError' },

    // String methods
    strip: { title: 'str.strip() — Remove Whitespace', url: 'library/stdtypes.html', anchor: 'str.strip' },
    lstrip: { title: 'str.lstrip() — Remove Left Whitespace', url: 'library/stdtypes.html', anchor: 'str.lstrip' },
    rstrip: { title: 'str.rstrip() — Remove Right Whitespace', url: 'library/stdtypes.html', anchor: 'str.rstrip' },
    split: { title: 'str.split() — Split String', url: 'library/stdtypes.html', anchor: 'str.split' },
    rsplit: { title: 'str.rsplit() — Right Split String', url: 'library/stdtypes.html', anchor: 'str.rsplit' },
    join: { title: 'str.join() — Join Iterable', url: 'library/stdtypes.html', anchor: 'str.join' },
    replace: { title: 'str.replace() — Replace Substring', url: 'library/stdtypes.html', anchor: 'str.replace' },
    find: { title: 'str.find() — Find Substring', url: 'library/stdtypes.html', anchor: 'str.find' },
    rfind: { title: 'str.rfind() — Find Substring (Right)', url: 'library/stdtypes.html', anchor: 'str.rfind' },
    index: { title: 'str.index() — Index of Substring', url: 'library/stdtypes.html', anchor: 'str.index' },
    rindex: { title: 'str.rindex() — Index of Substring (Right)', url: 'library/stdtypes.html', anchor: 'str.rindex' },
    startswith: { title: 'str.startswith() — Check Prefix', url: 'library/stdtypes.html', anchor: 'str.startswith' },
    endswith: { title: 'str.endswith() — Check Suffix', url: 'library/stdtypes.html', anchor: 'str.endswith' },
    upper: { title: 'str.upper() — Uppercase', url: 'library/stdtypes.html', anchor: 'str.upper' },
    lower: { title: 'str.lower() — Lowercase', url: 'library/stdtypes.html', anchor: 'str.lower' },
    capitalize: { title: 'str.capitalize() — Capitalize First', url: 'library/stdtypes.html', anchor: 'str.capitalize' },
    title: { title: 'str.title() — Title Case', url: 'library/stdtypes.html', anchor: 'str.title' },
    swapcase: { title: 'str.swapcase() — Swap Case', url: 'library/stdtypes.html', anchor: 'str.swapcase' },
    casefold: { title: 'str.casefold() — Case Folding', url: 'library/stdtypes.html', anchor: 'str.casefold' },
    isdigit: { title: 'str.isdigit() — Check Digits', url: 'library/stdtypes.html', anchor: 'str.isdigit' },
    isalpha: { title: 'str.isalpha() — Check Letters', url: 'library/stdtypes.html', anchor: 'str.isalpha' },
    isalnum: { title: 'str.isalnum() — Check Alphanumeric', url: 'library/stdtypes.html', anchor: 'str.isalnum' },
    isspace: { title: 'str.isspace() — Check Whitespace', url: 'library/stdtypes.html', anchor: 'str.isspace' },
    islower: { title: 'str.islower() — Check Lowercase', url: 'library/stdtypes.html', anchor: 'str.islower' },
    isupper: { title: 'str.isupper() — Check Uppercase', url: 'library/stdtypes.html', anchor: 'str.isupper' },
    istitle: { title: 'str.istitle() — Check Title Case', url: 'library/stdtypes.html', anchor: 'str.istitle' },
    count: { title: 'str.count() — Count Occurrences', url: 'library/stdtypes.html', anchor: 'str.count' },
    encode: { title: 'str.encode() — Encode to Bytes', url: 'library/stdtypes.html', anchor: 'str.encode' },
    str_format: { title: 'str.format() — Format String', url: 'library/stdtypes.html', anchor: 'str.format' },
    format_map: { title: 'str.format_map() — Format with Mapping', url: 'library/stdtypes.html', anchor: 'str.format_map' },
    center: { title: 'str.center() — Center String', url: 'library/stdtypes.html', anchor: 'str.center' },
    ljust: { title: 'str.ljust() — Left Justify', url: 'library/stdtypes.html', anchor: 'str.ljust' },
    rjust: { title: 'str.rjust() — Right Justify', url: 'library/stdtypes.html', anchor: 'str.rjust' },
    zfill: { title: 'str.zfill() — Zero Fill', url: 'library/stdtypes.html', anchor: 'str.zfill' },
    partition: { title: 'str.partition() — Partition String', url: 'library/stdtypes.html', anchor: 'str.partition' },
    rpartition: { title: 'str.rpartition() — Right Partition', url: 'library/stdtypes.html', anchor: 'str.rpartition' },
    splitlines: { title: 'str.splitlines() — Split by Lines', url: 'library/stdtypes.html', anchor: 'str.splitlines' },
    expandtabs: { title: 'str.expandtabs() — Expand Tabs', url: 'library/stdtypes.html', anchor: 'str.expandtabs' },
    translate: { title: 'str.translate() — Translate Characters', url: 'library/stdtypes.html', anchor: 'str.translate' },
    maketrans: { title: 'str.maketrans() — Make Translation Table', url: 'library/stdtypes.html', anchor: 'str.maketrans' },
    removeprefix: { title: 'str.removeprefix() — Remove Prefix (Python 3.9+)', url: 'library/stdtypes.html', anchor: 'str.removeprefix' },
    removesuffix: { title: 'str.removesuffix() — Remove Suffix (Python 3.9+)', url: 'library/stdtypes.html', anchor: 'str.removesuffix' },
    isascii: { title: 'str.isascii() — Check ASCII (3.7+)', url: 'library/stdtypes.html', anchor: 'str.isascii' },
    isprintable: { title: 'str.isprintable() — Check Printable', url: 'library/stdtypes.html', anchor: 'str.isprintable' },
    isidentifier: { title: 'str.isidentifier() — Check Identifier', url: 'library/stdtypes.html', anchor: 'str.isidentifier' },
    isnumeric: { title: 'str.isnumeric() — Check Numeric', url: 'library/stdtypes.html', anchor: 'str.isnumeric' },
    isdecimal: { title: 'str.isdecimal() — Check Decimal', url: 'library/stdtypes.html', anchor: 'str.isdecimal' },

    // List methods
    append: { title: 'list.append() — Add Item', url: 'library/stdtypes.html', anchor: 'mutable-sequence-types' },
    extend: { title: 'list.extend() — Extend List', url: 'library/stdtypes.html', anchor: 'mutable-sequence-types' },
    insert: { title: 'list.insert() — Insert Item', url: 'library/stdtypes.html', anchor: 'mutable-sequence-types' },
    remove: { title: 'list.remove() — Remove Item', url: 'library/stdtypes.html', anchor: 'mutable-sequence-types' },
    pop: { title: 'list.pop() — Remove & Return', url: 'library/stdtypes.html', anchor: 'mutable-sequence-types' },
    clear: { title: 'list.clear() — Remove All Items', url: 'library/stdtypes.html', anchor: 'mutable-sequence-types' },
    copy: { title: 'list.copy() — Shallow Copy', url: 'library/stdtypes.html', anchor: 'mutable-sequence-types' },
    reverse: { title: 'list.reverse() — Reverse In Place', url: 'library/stdtypes.html', anchor: 'mutable-sequence-types' },
    sort: { title: 'list.sort() — Sort In Place', url: 'library/stdtypes.html', anchor: 'mutable-sequence-types' },

    // Dictionary methods
    keys: { title: 'dict.keys() — Dictionary Keys', url: 'library/stdtypes.html', anchor: 'dict.keys' },
    values: { title: 'dict.values() — Dictionary Values', url: 'library/stdtypes.html', anchor: 'dict.values' },
    items: { title: 'dict.items() — Dictionary Items', url: 'library/stdtypes.html', anchor: 'dict.items' },
    get: { title: 'dict.get() — Get Value', url: 'library/stdtypes.html', anchor: 'dict.get' },
    setdefault: { title: 'dict.setdefault() — Get or Set Default', url: 'library/stdtypes.html', anchor: 'dict.setdefault' },
    update: { title: 'dict.update() — Update Dictionary', url: 'library/stdtypes.html', anchor: 'dict.update' },
    popitem: { title: 'dict.popitem() — Remove & Return Item', url: 'library/stdtypes.html', anchor: 'dict.popitem' },
    fromkeys: { title: 'dict.fromkeys() — Create from Keys', url: 'library/stdtypes.html', anchor: 'dict.fromkeys' },

    // Set methods
    add: { title: 'set.add() — Add Element', url: 'library/stdtypes.html', anchor: 'frozenset.add' },
    discard: { title: 'set.discard() — Remove Element', url: 'library/stdtypes.html', anchor: 'frozenset.discard' },
    union: { title: 'set.union() — Union of Sets', url: 'library/stdtypes.html', anchor: 'frozenset.union' },
    intersection: { title: 'set.intersection() — Intersection', url: 'library/stdtypes.html', anchor: 'frozenset.intersection' },
    difference: { title: 'set.difference() — Difference', url: 'library/stdtypes.html', anchor: 'frozenset.difference' },
    symmetric_difference: { title: 'set.symmetric_difference() — Symmetric Difference', url: 'library/stdtypes.html', anchor: 'frozenset.symmetric_difference' },
    issubset: { title: 'set.issubset() — Check Subset', url: 'library/stdtypes.html', anchor: 'frozenset.issubset' },
    issuperset: { title: 'set.issuperset() — Check Superset', url: 'library/stdtypes.html', anchor: 'frozenset.issuperset' },
    isdisjoint: { title: 'set.isdisjoint() — Check Disjoint', url: 'library/stdtypes.html', anchor: 'frozenset.isdisjoint' },
    intersection_update: { title: 'set.intersection_update() — Update Intersection', url: 'library/stdtypes.html', anchor: 'frozenset.intersection_update' },
    difference_update: { title: 'set.difference_update() — Update Difference', url: 'library/stdtypes.html', anchor: 'frozenset.difference_update' },
    symmetric_difference_update: { title: 'set.symmetric_difference_update() — Update Symmetric Difference', url: 'library/stdtypes.html', anchor: 'frozenset.symmetric_difference_update' },

    // Typing module constructs
    Generic: { title: 'typing.Generic — Generic Types', url: 'library/typing.html', anchor: 'typing.Generic' },
    TypeVar: { title: 'typing.TypeVar — Type Variables', url: 'library/typing.html', anchor: 'typing.TypeVar' },
    Protocol: { title: 'typing.Protocol — Structural Subtyping', url: 'library/typing.html', anchor: 'typing.Protocol' },
    Union: { title: 'typing.Union — Union Types', url: 'library/typing.html', anchor: 'typing.Union' },
    Optional: { title: 'typing.Optional — Optional Types', url: 'library/typing.html', anchor: 'typing.Optional' },
    List: { title: 'typing.List — List Type Hint', url: 'library/typing.html', anchor: 'typing.List' },
    Dict: { title: 'typing.Dict — Dictionary Type Hint', url: 'library/typing.html', anchor: 'typing.Dict' },
    Set: { title: 'typing.Set — Set Type Hint', url: 'library/typing.html', anchor: 'typing.Set' },
    Tuple: { title: 'typing.Tuple — Tuple Type Hint', url: 'library/typing.html', anchor: 'typing.Tuple' },
    Callable: { title: 'typing.Callable — Callable Types', url: 'library/typing.html', anchor: 'typing.Callable' },
    Type: { title: 'typing.Type — Class Types', url: 'library/typing.html', anchor: 'typing.Type' },
    ClassVar: { title: 'typing.ClassVar — Class Variables', url: 'library/typing.html', anchor: 'typing.ClassVar' },
    Final: { title: 'typing.Final — Final Variables', url: 'library/typing.html', anchor: 'typing.Final' },
    Literal: { title: 'typing.Literal — Literal Types', url: 'library/typing.html', anchor: 'typing.Literal' },
    Annotated: { title: 'typing.Annotated — Annotated Types', url: 'library/typing.html', anchor: 'typing.Annotated' },
    Any: { title: 'typing.Any — Any Type', url: 'library/typing.html', anchor: 'typing.Any' },
    NoReturn: { title: 'typing.NoReturn — No Return Type', url: 'library/typing.html', anchor: 'typing.NoReturn' },
    overload: { title: 'typing.overload — Function Overloading', url: 'library/typing.html', anchor: 'typing.overload' }
};

// Separate export for import system documentation (avoids using 'import' as a MAP key)
export const IMPORT_INFO: Info = { title: 'import — Import System', url: 'reference/import.html', anchor: 'the-import-system' };

// Built-in modules mapping (separate from main MAP to avoid conflicts)

export const MODULES: Record<string, Info> = {
    os: { title: 'os — Operating System Interface', url: 'library/os.html' },
    sys: { title: 'sys — System Parameters & Functions', url: 'library/sys.html' },
    math: { title: 'math — Mathematical Functions', url: 'library/math.html' },
    random: { title: 'random — Random Number Generation', url: 'library/random.html' },
    datetime: { title: 'datetime — Date & Time Handling', url: 'library/datetime.html' },
    time: { title: 'time — Time Access & Conversions', url: 'library/time.html' },
    json: { title: 'json — JSON Encoder & Decoder', url: 'library/json.html' },
    re: { title: 're — Regular Expression Operations', url: 'library/re.html' },
    urllib: { title: 'urllib — URL Handling Modules', url: 'library/urllib.html' },
    http: { title: 'http — HTTP Modules', url: 'library/http.html' },
    pathlib: { title: 'pathlib — Object-oriented Filesystem Paths', url: 'library/pathlib.html' },
    typing: { title: 'typing — Type Hints Support', url: 'library/typing.html' },
    collections: { title: 'collections — Container Data Types', url: 'library/collections.html' },
    itertools: { title: 'itertools — Iterator Building Functions', url: 'library/itertools.html' },
    functools: { title: 'functools — Higher-order Functions & Utilities', url: 'library/functools.html' },
    operator: { title: 'operator — Standard Operators as Functions', url: 'library/operator.html' },
    copy: { title: 'copy — Shallow & Deep Copy Operations', url: 'library/copy.html' },
    pickle: { title: 'pickle — Python Object Serialization', url: 'library/pickle.html' },
    csv: { title: 'csv — CSV File Reading & Writing', url: 'library/csv.html' },
    sqlite3: { title: 'sqlite3 — SQLite Database Interface', url: 'library/sqlite3.html' },
    threading: { title: 'threading — Thread-based Parallelism', url: 'library/threading.html' },
    multiprocessing: { title: 'multiprocessing — Process-based Parallelism', url: 'library/multiprocessing.html' },
    concurrent: { title: 'concurrent — Concurrent Execution', url: 'library/concurrent.html' },
    asyncio: { title: 'asyncio — Asynchronous I/O', url: 'library/asyncio.html' },
    subprocess: { title: 'subprocess — Subprocess Management', url: 'library/subprocess.html' },
    shutil: { title: 'shutil — High-level File Operations', url: 'library/shutil.html' },
    glob: { title: 'glob — Unix Pathname Pattern Expansion', url: 'library/glob.html' },
    tempfile: { title: 'tempfile — Temporary Files & Directories', url: 'library/tempfile.html' },
    io: { title: 'io — Core Tools for Working with Streams', url: 'library/io.html' },
    logging: { title: 'logging — Logging Facility', url: 'library/logging.html' },
    argparse: { title: 'argparse — Command-line Argument Parser', url: 'library/argparse.html' },
    configparser: { title: 'configparser — Configuration File Parser', url: 'library/configparser.html' },
    xml: { title: 'xml — XML Processing Modules', url: 'library/xml.html' },
    html: { title: 'html — HTML Support', url: 'library/html.html' },
    email: { title: 'email — Email Handling Package', url: 'library/email.html' },
    base64: { title: 'base64 — Base16, Base32, Base64 Data Encodings', url: 'library/base64.html' },
    hashlib: { title: 'hashlib — Secure Hash & Message Digest', url: 'library/hashlib.html' },
    hmac: { title: 'hmac — Keyed-Hashing for Message Authentication', url: 'library/hmac.html' },
    secrets: { title: 'secrets — Cryptographically Strong Random Numbers', url: 'library/secrets.html' },
    ssl: { title: 'ssl — TLS/SSL Wrapper for Socket Objects', url: 'library/ssl.html' },
    socket: { title: 'socket — Low-level Networking Interface', url: 'library/socket.html' },
    select: { title: 'select — Waiting for I/O Completion', url: 'library/select.html' },
    signal: { title: 'signal — Signal Handling', url: 'library/signal.html' },
    struct: { title: 'struct — Binary Data Structures', url: 'library/struct.html' },
    array: { title: 'array — Efficient Arrays of Numeric Values', url: 'library/array.html' },
    queue: { title: 'queue — Synchronized Queue Class', url: 'library/queue.html' },
    heapq: { title: 'heapq — Heap Queue Algorithm', url: 'library/heapq.html' },
    bisect: { title: 'bisect — Array Bisection Algorithm', url: 'library/bisect.html' },
    weakref: { title: 'weakref — Weak References', url: 'library/weakref.html' },
    gc: { title: 'gc — Garbage Collector Interface', url: 'library/gc.html' },
    inspect: { title: 'inspect — Inspect Live Objects', url: 'library/inspect.html' },
    traceback: { title: 'traceback — Print or Retrieve Stack Traceback', url: 'library/traceback.html' },
    warnings: { title: 'warnings — Warning Control', url: 'library/warnings.html' },
    contextlib: { title: 'contextlib — Context Manager Utilities', url: 'library/contextlib.html' },
    abc: { title: 'abc — Abstract Base Classes', url: 'library/abc.html' },
    numbers: { title: 'numbers — Numeric Abstract Base Classes', url: 'library/numbers.html' },
    decimal: { title: 'decimal — Decimal Fixed Point & Floating Point', url: 'library/decimal.html' },
    fractions: { title: 'fractions — Rational Numbers', url: 'library/fractions.html' },
    statistics: { title: 'statistics — Mathematical Statistics Functions', url: 'library/statistics.html' },
    enum: { title: 'enum — Enumerations', url: 'library/enum.html' },
    dataclasses: { title: 'dataclasses — Data Classes', url: 'library/dataclasses.html' },
    calendar: { title: 'calendar — Calendar-related Functions', url: 'library/calendar.html' },
    locale: { title: 'locale — Internationalization Services', url: 'library/locale.html' },
    gettext: { title: 'gettext — Multilingual Internationalization', url: 'library/gettext.html' },
    string: { title: 'string — Common String Operations', url: 'library/string.html' },
    textwrap: { title: 'textwrap — Text Wrapping & Filling', url: 'library/textwrap.html' },
    unicodedata: { title: 'unicodedata — Unicode Database', url: 'library/unicodedata.html' },
    codecs: { title: 'codecs — Codec Registry & Base Classes', url: 'library/codecs.html' },
    keyword: { title: 'keyword — Testing for Python Keywords', url: 'library/keyword.html' },
    token: { title: 'token — Constants for Python Parse Trees', url: 'library/token.html' },
    tokenize: { title: 'tokenize — Tokenizer for Python Source', url: 'library/tokenize.html' },
    ast: { title: 'ast — Abstract Syntax Trees', url: 'library/ast.html' },
    symtable: { title: 'symtable — Symbol Table Generation', url: 'library/symtable.html' },
    dis: { title: 'dis — Disassembler for Python Bytecode', url: 'library/dis.html' },
    importlib: { title: 'importlib — Import System', url: 'library/importlib.html' },
    pkgutil: { title: 'pkgutil — Package Extension Utilities', url: 'library/pkgutil.html' },
    modulefinder: { title: 'modulefinder — Find Modules Used by Script', url: 'library/modulefinder.html' },
    runpy: { title: 'runpy — Locating & Executing Python Modules', url: 'library/runpy.html' },
    types: { title: 'types — Dynamic Type Creation & Names for Built-in Types', url: 'library/types.html' },
    platform: { title: 'platform — Access Underlying Platform Data', url: 'library/platform.html' },
    errno: { title: 'errno — Standard errno System Symbols', url: 'library/errno.html' },
    ctypes: { title: 'ctypes — Foreign Function Library', url: 'library/ctypes.html' }
};

// Additional direct mappings for common stdlib callables and classes used in snapshots
// Typing additions
MAP['Self'] = { title: 'typing.Self — Self type', url: 'library/typing.html', anchor: 'typing.Self' };

// itertools
MAP['product'] = { title: 'itertools.product — Cartesian product', url: 'library/itertools.html', anchor: 'itertools.product' };

// functools
MAP['lru_cache'] = { title: 'functools.lru_cache — LRU cache decorator', url: 'library/functools.html', anchor: 'functools.lru_cache' };

// operator
MAP['itemgetter'] = { title: 'operator.itemgetter — Construct item-getting callable', url: 'library/operator.html', anchor: 'operator.itemgetter' };

// dataclasses
MAP['dataclass'] = { title: 'dataclasses.dataclass — Dataclass decorator', url: 'library/dataclasses.html', anchor: 'dataclasses.dataclass' };

// pathlib
MAP['Path'] = { title: 'pathlib.Path — Filesystem path class', url: 'library/pathlib.html', anchor: 'pathlib.Path' };
MAP['glob'] = { title: 'pathlib.Path.glob — Glob entries in a directory', url: 'library/pathlib.html', anchor: 'pathlib.Path.glob' };

export const BUILTIN_KEYWORDS = ['print', 'len', 'range', 'enumerate', 'zip', 'map', 'filter', 'sorted', 'reversed', 'sum', 'max', 'min', 'abs', 'round', 'type', 'vars', 'dir', 'help', 'input', 'eval', 'exec', 'compile', 'hash', 'hex', 'oct', 'bin', 'ord', 'chr', 'ascii', 'repr', 'format', 'divmod', 'callable', 'super', 'staticmethod', 'classmethod', 'property', 'slice', 'object', 'bytes', 'bytearray', 'memoryview', 'frozenset', 'complex', 'locals', 'globals', 'breakpoint', 'and', 'or', 'not', 'is', 'in'];
export const DATA_TYPES = ['str', 'int', 'float', 'bool', 'list', 'dict', 'set', 'tuple'];
export const CONSTANTS = ['None', 'True', 'False'];
export const TYPING_CONSTRUCTS = ['Generic', 'TypeVar', 'Protocol', 'Union', 'Optional', 'List', 'Dict', 'Set', 'Tuple', 'Callable', 'Type', 'ClassVar', 'Final', 'Literal', 'Annotated', 'Any', 'NoReturn', 'overload'];

// Operators that need special regex handling due to special characters
export const OPERATORS = ['==', '!=', '<=', '>=', '<', '>', '+', '-', '*', '/', '//', '%', '**', '&', '|', '^', '~', '<<', '>>', '=', '+=', '-=', '*=', '/=', '//=', '%=', '**=', '&=', '|=', '^=', '<<=', '>>='];

// Helper to map dunder names to the Data Model special method anchor
export function getDunderInfo(name: string): Info | undefined {
    if (!/^__.*__$/.test(name)) return undefined;
    // Most special methods have anchors like object.__init__, object.__getitem__, etc.
    const anchor = `object.${name}`;
    return { title: `${name} — Special method`, url: 'reference/datamodel.html', anchor };
}
