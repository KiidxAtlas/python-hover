/**
 * Python Documentation URLs and Mappings
 *
 * Each entry maps a Python keyword / constant to its authoritative
 * docs.python.org URL.  The static resolver checks this map first so keyword
 * hovers never fall through to the Sphinx inventory (whose per-keyword anchors
 * are unreliable — e.g. `else` has no standalone anchor, and `not` points to
 * the wrong section).
 *
 * URL format:
 *   url    — relative path under docs.python.org/3/
 *   anchor — the HTML fragment (#anchor) for the exact section
 *
 * Version-specific pages (static resolver prepends the detected Python version).
 */

export interface Info {
    title: string;
    url: string;
    anchor?: string;
    /** Fallback description for soft keywords Python's runtime can't introspect. */
    summary?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Compound statements   reference/compound_stmts.html
// ─────────────────────────────────────────────────────────────────────────────
const COMPOUND: Record<string, Info> = {
    'if': { title: 'if statement', url: 'reference/compound_stmts.html', anchor: 'the-if-statement' },
    'elif': { title: 'elif clause', url: 'reference/compound_stmts.html', anchor: 'the-if-statement' },
    'else': { title: 'else clause', url: 'reference/compound_stmts.html', anchor: 'the-if-statement' },
    'for': { title: 'for statement', url: 'reference/compound_stmts.html', anchor: 'the-for-statement' },
    'while': { title: 'while statement', url: 'reference/compound_stmts.html', anchor: 'the-while-statement' },
    'try': { title: 'try statement', url: 'reference/compound_stmts.html', anchor: 'the-try-statement' },
    'except': { title: 'except clause', url: 'reference/compound_stmts.html', anchor: 'the-try-statement' },
    'finally': { title: 'finally clause', url: 'reference/compound_stmts.html', anchor: 'the-try-statement' },
    'with': { title: 'with statement', url: 'reference/compound_stmts.html', anchor: 'the-with-statement' },
    'def': { title: 'function definition', url: 'reference/compound_stmts.html', anchor: 'function-definitions' },
    'class': { title: 'class definition', url: 'reference/compound_stmts.html', anchor: 'class-definitions' },
    'async': { title: 'async statement', url: 'reference/compound_stmts.html', anchor: 'coroutine-function-definition' },
    'match': { title: 'match statement', url: 'reference/compound_stmts.html', anchor: 'the-match-statement', summary: 'Structural pattern matching — matches a value against a series of patterns. Added in Python 3.10.' },
    'case': { title: 'case clause', url: 'reference/compound_stmts.html', anchor: 'the-match-statement', summary: 'A pattern clause in a `match` statement. Each `case` specifies a pattern and optional guard condition.' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Simple statements   reference/simple_stmts.html
// ─────────────────────────────────────────────────────────────────────────────
const SIMPLE: Record<string, Info> = {
    'pass': { title: 'pass statement', url: 'reference/simple_stmts.html', anchor: 'the-pass-statement' },
    'del': { title: 'del statement', url: 'reference/simple_stmts.html', anchor: 'the-del-statement' },
    'return': { title: 'return statement', url: 'reference/simple_stmts.html', anchor: 'the-return-statement' },
    'raise': { title: 'raise statement', url: 'reference/simple_stmts.html', anchor: 'the-raise-statement' },
    'break': { title: 'break statement', url: 'reference/simple_stmts.html', anchor: 'the-break-statement' },
    'continue': { title: 'continue statement', url: 'reference/simple_stmts.html', anchor: 'the-continue-statement' },
    'import': { title: 'import statement', url: 'reference/simple_stmts.html', anchor: 'the-import-statement' },
    'from': { title: 'from import', url: 'reference/simple_stmts.html', anchor: 'the-import-statement' },
    'as': { title: 'as (import alias)', url: 'reference/simple_stmts.html', anchor: 'the-import-statement' },
    'global': { title: 'global statement', url: 'reference/simple_stmts.html', anchor: 'the-global-statement' },
    'nonlocal': { title: 'nonlocal statement', url: 'reference/simple_stmts.html', anchor: 'the-nonlocal-statement' },
    'assert': { title: 'assert statement', url: 'reference/simple_stmts.html', anchor: 'the-assert-statement' },
    'yield': { title: 'yield statement', url: 'reference/simple_stmts.html', anchor: 'the-yield-statement' },
    'type': { title: 'type statement', url: 'reference/simple_stmts.html', anchor: 'type' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Expressions / operators   reference/expressions.html
// ─────────────────────────────────────────────────────────────────────────────
const EXPRESSIONS: Record<string, Info> = {
    'lambda': { title: 'lambda expression', url: 'reference/expressions.html', anchor: 'lambda' },
    'await': { title: 'await expression', url: 'reference/expressions.html', anchor: 'await-expression' },
    'not': { title: 'not operator', url: 'reference/expressions.html', anchor: 'boolean-operations' },
    'and': { title: 'and operator', url: 'reference/expressions.html', anchor: 'boolean-operations' },
    'or': { title: 'or operator', url: 'reference/expressions.html', anchor: 'boolean-operations' },
    'in': { title: 'in operator', url: 'reference/expressions.html', anchor: 'membership-test-operations' },
    'not in': { title: 'not in operator', url: 'reference/expressions.html', anchor: 'membership-test-operations' },
    'is': { title: 'is operator', url: 'reference/expressions.html', anchor: 'identity-comparisons' },
    'is not': { title: 'is not operator', url: 'reference/expressions.html', anchor: 'identity-comparisons' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Built-in constants   library/constants.html
// ─────────────────────────────────────────────────────────────────────────────
const CONSTANTS: Record<string, Info> = {
    'None': { title: 'None', url: 'library/constants.html', anchor: 'None' },
    'True': { title: 'True', url: 'library/constants.html', anchor: 'True' },
    'False': { title: 'False', url: 'library/constants.html', anchor: 'False' },
    'Ellipsis': { title: 'Ellipsis', url: 'library/constants.html', anchor: 'Ellipsis' },
    '...': { title: 'Ellipsis', url: 'library/constants.html', anchor: 'Ellipsis' },
    '__debug__': { title: '__debug__', url: 'library/constants.html', anchor: '__debug__' },
    '__name__': { title: '__name__', url: 'library/__main__.html', anchor: '__name__' },
};

// ─────────────────────────────────────────────────────────────────────────────
// typing module   library/typing.html
// Anchors verified against docs.python.org/3/library/typing.html
// ─────────────────────────────────────────────────────────────────────────────
const TYPING: Record<string, Info> = {
    // Core special forms
    'typing.Any':            { title: 'typing.Any',            url: 'library/typing.html', anchor: 'typing.Any' },
    'typing.Union':          { title: 'typing.Union',          url: 'library/typing.html', anchor: 'typing.Union' },
    'typing.Optional':       { title: 'typing.Optional',       url: 'library/typing.html', anchor: 'typing.Optional' },
    'typing.Literal':        { title: 'typing.Literal',        url: 'library/typing.html', anchor: 'typing.Literal' },
    'typing.Final':          { title: 'typing.Final',          url: 'library/typing.html', anchor: 'typing.Final' },
    'typing.ClassVar':       { title: 'typing.ClassVar',       url: 'library/typing.html', anchor: 'typing.ClassVar' },
    'typing.Annotated':      { title: 'typing.Annotated',      url: 'library/typing.html', anchor: 'typing.Annotated' },
    'typing.TypeAlias':      { title: 'typing.TypeAlias',      url: 'library/typing.html', anchor: 'typing.TypeAlias' },
    // Never / NoReturn
    'typing.NoReturn':       { title: 'typing.NoReturn',       url: 'library/typing.html', anchor: 'typing.NoReturn' },
    'typing.Never':          { title: 'typing.Never',          url: 'library/typing.html', anchor: 'typing.Never' },
    'typing.LiteralString':  { title: 'typing.LiteralString',  url: 'library/typing.html', anchor: 'typing.LiteralString' },
    'typing.Self':           { title: 'typing.Self',           url: 'library/typing.html', anchor: 'typing.Self' },
    // Type variables
    'typing.TypeVar':        { title: 'typing.TypeVar',        url: 'library/typing.html', anchor: 'typing.TypeVar' },
    'typing.TypeVarTuple':   { title: 'typing.TypeVarTuple',   url: 'library/typing.html', anchor: 'typing.TypeVarTuple' },
    'typing.ParamSpec':      { title: 'typing.ParamSpec',      url: 'library/typing.html', anchor: 'typing.ParamSpec' },
    'typing.Concatenate':    { title: 'typing.Concatenate',    url: 'library/typing.html', anchor: 'typing.Concatenate' },
    'typing.Unpack':         { title: 'typing.Unpack',         url: 'library/typing.html', anchor: 'typing.Unpack' },
    // Structural subtyping
    'typing.Protocol':       { title: 'typing.Protocol',       url: 'library/typing.html', anchor: 'typing.Protocol' },
    'typing.runtime_checkable': { title: 'typing.runtime_checkable', url: 'library/typing.html', anchor: 'typing.runtime_checkable' },
    'typing.Generic':        { title: 'typing.Generic',        url: 'library/typing.html', anchor: 'typing.Generic' },
    // Named structured types
    'typing.TypedDict':      { title: 'typing.TypedDict',      url: 'library/typing.html', anchor: 'typing.TypedDict' },
    'typing.NamedTuple':     { title: 'typing.NamedTuple',     url: 'library/typing.html', anchor: 'typing.NamedTuple' },
    // Generic aliases (deprecated since 3.9 — builtins preferred)
    'typing.List':           { title: 'typing.List',           url: 'library/typing.html', anchor: 'typing.List' },
    'typing.Dict':           { title: 'typing.Dict',           url: 'library/typing.html', anchor: 'typing.Dict' },
    'typing.Set':            { title: 'typing.Set',            url: 'library/typing.html', anchor: 'typing.Set' },
    'typing.FrozenSet':      { title: 'typing.FrozenSet',      url: 'library/typing.html', anchor: 'typing.FrozenSet' },
    'typing.Tuple':          { title: 'typing.Tuple',          url: 'library/typing.html', anchor: 'typing.Tuple' },
    'typing.Type':           { title: 'typing.Type',           url: 'library/typing.html', anchor: 'typing.Type' },
    'typing.Callable':       { title: 'typing.Callable',       url: 'library/typing.html', anchor: 'typing.Callable' },
    // Abstract container aliases
    'typing.Sequence':       { title: 'typing.Sequence',       url: 'library/typing.html', anchor: 'typing.Sequence' },
    'typing.MutableSequence':{ title: 'typing.MutableSequence',url: 'library/typing.html', anchor: 'typing.MutableSequence' },
    'typing.Mapping':        { title: 'typing.Mapping',        url: 'library/typing.html', anchor: 'typing.Mapping' },
    'typing.MutableMapping': { title: 'typing.MutableMapping', url: 'library/typing.html', anchor: 'typing.MutableMapping' },
    'typing.Iterable':       { title: 'typing.Iterable',       url: 'library/typing.html', anchor: 'typing.Iterable' },
    'typing.Iterator':       { title: 'typing.Iterator',       url: 'library/typing.html', anchor: 'typing.Iterator' },
    'typing.Generator':      { title: 'typing.Generator',      url: 'library/typing.html', anchor: 'typing.Generator' },
    'typing.AsyncIterable':  { title: 'typing.AsyncIterable',  url: 'library/typing.html', anchor: 'typing.AsyncIterable' },
    'typing.AsyncIterator':  { title: 'typing.AsyncIterator',  url: 'library/typing.html', anchor: 'typing.AsyncIterator' },
    'typing.AsyncGenerator': { title: 'typing.AsyncGenerator', url: 'library/typing.html', anchor: 'typing.AsyncGenerator' },
    'typing.Awaitable':      { title: 'typing.Awaitable',      url: 'library/typing.html', anchor: 'typing.Awaitable' },
    'typing.Coroutine':      { title: 'typing.Coroutine',      url: 'library/typing.html', anchor: 'typing.Coroutine' },
    // Helper functions
    'typing.overload':       { title: 'typing.overload',       url: 'library/typing.html', anchor: 'typing.overload' },
    'typing.cast':           { title: 'typing.cast',           url: 'library/typing.html', anchor: 'typing.cast' },
    'typing.assert_type':    { title: 'typing.assert_type',    url: 'library/typing.html', anchor: 'typing.assert_type' },
    'typing.get_type_hints': { title: 'typing.get_type_hints', url: 'library/typing.html', anchor: 'typing.get_type_hints' },
    'typing.get_origin':     { title: 'typing.get_origin',     url: 'library/typing.html', anchor: 'typing.get_origin' },
    'typing.get_args':       { title: 'typing.get_args',       url: 'library/typing.html', anchor: 'typing.get_args' },
    'typing.is_typeddict':   { title: 'typing.is_typeddict',   url: 'library/typing.html', anchor: 'typing.is_typeddict' },
    // Constants
    'typing.TYPE_CHECKING':  { title: 'typing.TYPE_CHECKING',  url: 'library/typing.html', anchor: 'typing.TYPE_CHECKING' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Common stdlib symbols   (most frequently hovered, quick offline resolution)
// ─────────────────────────────────────────────────────────────────────────────
const STDLIB_SYMBOLS: Record<string, Info> = {
    // functools
    'functools.wraps':            { title: 'functools.wraps',            url: 'library/functools.html', anchor: 'functools.wraps' },
    'functools.lru_cache':        { title: 'functools.lru_cache',        url: 'library/functools.html', anchor: 'functools.lru_cache' },
    'functools.cache':            { title: 'functools.cache',            url: 'library/functools.html', anchor: 'functools.cache' },
    'functools.partial':          { title: 'functools.partial',          url: 'library/functools.html', anchor: 'functools.partial' },
    'functools.reduce':           { title: 'functools.reduce',           url: 'library/functools.html', anchor: 'functools.reduce' },
    'functools.cached_property':  { title: 'functools.cached_property',  url: 'library/functools.html', anchor: 'functools.cached_property' },
    'functools.total_ordering':   { title: 'functools.total_ordering',   url: 'library/functools.html', anchor: 'functools.total_ordering' },
    'functools.singledispatch':   { title: 'functools.singledispatch',   url: 'library/functools.html', anchor: 'functools.singledispatch' },
    // contextlib
    'contextlib.contextmanager':  { title: 'contextlib.contextmanager',  url: 'library/contextlib.html', anchor: 'contextlib.contextmanager' },
    'contextlib.asynccontextmanager': { title: 'contextlib.asynccontextmanager', url: 'library/contextlib.html', anchor: 'contextlib.asynccontextmanager' },
    'contextlib.suppress':        { title: 'contextlib.suppress',        url: 'library/contextlib.html', anchor: 'contextlib.suppress' },
    'contextlib.AbstractContextManager': { title: 'contextlib.AbstractContextManager', url: 'library/contextlib.html', anchor: 'contextlib.AbstractContextManager' },
    // dataclasses
    'dataclasses.dataclass':      { title: 'dataclasses.dataclass',      url: 'library/dataclasses.html', anchor: 'dataclasses.dataclass' },
    'dataclasses.field':          { title: 'dataclasses.field',          url: 'library/dataclasses.html', anchor: 'dataclasses.field' },
    'dataclasses.fields':         { title: 'dataclasses.fields',         url: 'library/dataclasses.html', anchor: 'dataclasses.fields' },
    'dataclasses.asdict':         { title: 'dataclasses.asdict',         url: 'library/dataclasses.html', anchor: 'dataclasses.asdict' },
    'dataclasses.astuple':        { title: 'dataclasses.astuple',        url: 'library/dataclasses.html', anchor: 'dataclasses.astuple' },
    'dataclasses.replace':        { title: 'dataclasses.replace',        url: 'library/dataclasses.html', anchor: 'dataclasses.replace' },
    'dataclasses.Field':          { title: 'dataclasses.Field',          url: 'library/dataclasses.html', anchor: 'dataclasses.Field' },
    // pathlib
    'pathlib.Path':               { title: 'pathlib.Path',               url: 'library/pathlib.html', anchor: 'pathlib.Path' },
    'pathlib.PurePath':           { title: 'pathlib.PurePath',           url: 'library/pathlib.html', anchor: 'pathlib.PurePath' },
    'pathlib.PosixPath':          { title: 'pathlib.PosixPath',          url: 'library/pathlib.html', anchor: 'pathlib.PosixPath' },
    'pathlib.WindowsPath':        { title: 'pathlib.WindowsPath',        url: 'library/pathlib.html', anchor: 'pathlib.WindowsPath' },
    // collections
    'collections.namedtuple':     { title: 'collections.namedtuple',     url: 'library/collections.html', anchor: 'collections.namedtuple' },
    'collections.OrderedDict':    { title: 'collections.OrderedDict',    url: 'library/collections.html', anchor: 'collections.OrderedDict' },
    'collections.defaultdict':    { title: 'collections.defaultdict',    url: 'library/collections.html', anchor: 'collections.defaultdict' },
    'collections.Counter':        { title: 'collections.Counter',        url: 'library/collections.html', anchor: 'collections.Counter' },
    'collections.deque':          { title: 'collections.deque',          url: 'library/collections.html', anchor: 'collections.deque' },
    'collections.ChainMap':       { title: 'collections.ChainMap',       url: 'library/collections.html', anchor: 'collections.ChainMap' },
    // abc
    'abc.ABC':                    { title: 'abc.ABC',                    url: 'library/abc.html', anchor: 'abc.ABC' },
    'abc.ABCMeta':                { title: 'abc.ABCMeta',                url: 'library/abc.html', anchor: 'abc.ABCMeta' },
    'abc.abstractmethod':         { title: 'abc.abstractmethod',         url: 'library/abc.html', anchor: 'abc.abstractmethod' },
    // enum
    'enum.Enum':                  { title: 'enum.Enum',                  url: 'library/enum.html', anchor: 'enum.Enum' },
    'enum.IntEnum':               { title: 'enum.IntEnum',               url: 'library/enum.html', anchor: 'enum.IntEnum' },
    'enum.Flag':                  { title: 'enum.Flag',                  url: 'library/enum.html', anchor: 'enum.Flag' },
    'enum.IntFlag':               { title: 'enum.IntFlag',               url: 'library/enum.html', anchor: 'enum.IntFlag' },
    'enum.StrEnum':               { title: 'enum.StrEnum',               url: 'library/enum.html', anchor: 'enum.StrEnum' },
    'enum.auto':                  { title: 'enum.auto',                  url: 'library/enum.html', anchor: 'enum.auto' },
    // asyncio
    'asyncio.run':                { title: 'asyncio.run',                url: 'library/asyncio-runner.html', anchor: 'asyncio.run' },
    'asyncio.gather':             { title: 'asyncio.gather',             url: 'library/asyncio-task.html', anchor: 'asyncio.gather' },
    'asyncio.create_task':        { title: 'asyncio.create_task',        url: 'library/asyncio-task.html', anchor: 'asyncio.create_task' },
    'asyncio.sleep':              { title: 'asyncio.sleep',              url: 'library/asyncio-task.html', anchor: 'asyncio.sleep' },
    'asyncio.wait':               { title: 'asyncio.wait',               url: 'library/asyncio-task.html', anchor: 'asyncio.wait' },
    'asyncio.wait_for':           { title: 'asyncio.wait_for',           url: 'library/asyncio-task.html', anchor: 'asyncio.wait_for' },
    'asyncio.Task':               { title: 'asyncio.Task',               url: 'library/asyncio-task.html', anchor: 'asyncio.Task' },
    'asyncio.Event':              { title: 'asyncio.Event',              url: 'library/asyncio-sync.html', anchor: 'asyncio.Event' },
    'asyncio.Lock':               { title: 'asyncio.Lock',               url: 'library/asyncio-sync.html', anchor: 'asyncio.Lock' },
    'asyncio.Queue':              { title: 'asyncio.Queue',              url: 'library/asyncio-queue.html', anchor: 'asyncio.Queue' },
    // itertools
    'itertools.chain':            { title: 'itertools.chain',            url: 'library/itertools.html', anchor: 'itertools.chain' },
    'itertools.product':          { title: 'itertools.product',          url: 'library/itertools.html', anchor: 'itertools.product' },
    'itertools.combinations':     { title: 'itertools.combinations',     url: 'library/itertools.html', anchor: 'itertools.combinations' },
    'itertools.permutations':     { title: 'itertools.permutations',     url: 'library/itertools.html', anchor: 'itertools.permutations' },
    'itertools.groupby':          { title: 'itertools.groupby',          url: 'library/itertools.html', anchor: 'itertools.groupby' },
    'itertools.islice':           { title: 'itertools.islice',           url: 'library/itertools.html', anchor: 'itertools.islice' },
    'itertools.count':            { title: 'itertools.count',            url: 'library/itertools.html', anchor: 'itertools.count' },
    'itertools.repeat':           { title: 'itertools.repeat',           url: 'library/itertools.html', anchor: 'itertools.repeat' },
    'itertools.zip_longest':      { title: 'itertools.zip_longest',      url: 'library/itertools.html', anchor: 'itertools.zip_longest' },
    // os
    'os.path.join':               { title: 'os.path.join',               url: 'library/os.path.html', anchor: 'os.path.join' },
    'os.path.exists':             { title: 'os.path.exists',             url: 'library/os.path.html', anchor: 'os.path.exists' },
    'os.path.dirname':            { title: 'os.path.dirname',            url: 'library/os.path.html', anchor: 'os.path.dirname' },
    'os.path.basename':           { title: 'os.path.basename',           url: 'library/os.path.html', anchor: 'os.path.basename' },
    'os.path.abspath':            { title: 'os.path.abspath',            url: 'library/os.path.html', anchor: 'os.path.abspath' },
    'os.path.splitext':           { title: 'os.path.splitext',           url: 'library/os.path.html', anchor: 'os.path.splitext' },
};

export const MAP: Record<string, Info> = {
    ...COMPOUND,
    ...SIMPLE,
    ...EXPRESSIONS,
    ...CONSTANTS,
    ...TYPING,
    ...STDLIB_SYMBOLS,
};
