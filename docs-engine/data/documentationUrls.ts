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
    kind?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Compound statements   reference/compound_stmts.html
// ─────────────────────────────────────────────────────────────────────────────
const COMPOUND: Record<string, Info> = {
    'if': { title: 'if statement', url: 'reference/compound_stmts.html', anchor: 'the-if-statement', kind: 'keyword' },
    'elif': { title: 'elif clause', url: 'reference/compound_stmts.html', anchor: 'the-if-statement', kind: 'keyword' },
    'else': { title: 'else clause', url: 'reference/compound_stmts.html', anchor: 'the-if-statement', kind: 'keyword' },
    'for': { title: 'for statement', url: 'reference/compound_stmts.html', anchor: 'the-for-statement', kind: 'keyword' },
    'while': { title: 'while statement', url: 'reference/compound_stmts.html', anchor: 'the-while-statement', kind: 'keyword' },
    'try': { title: 'try statement', url: 'reference/compound_stmts.html', anchor: 'the-try-statement', kind: 'keyword' },
    'except': { title: 'except clause', url: 'reference/compound_stmts.html', anchor: 'the-try-statement', kind: 'keyword' },
    'finally': { title: 'finally clause', url: 'reference/compound_stmts.html', anchor: 'the-try-statement', kind: 'keyword' },
    'with': { title: 'with statement', url: 'reference/compound_stmts.html', anchor: 'the-with-statement', kind: 'keyword' },
    'def': { title: 'function definition', url: 'reference/compound_stmts.html', anchor: 'function-definitions', kind: 'keyword' },
    'class': { title: 'class definition', url: 'reference/compound_stmts.html', anchor: 'class-definitions', kind: 'keyword' },
    'async': { title: 'async statement', url: 'reference/compound_stmts.html', anchor: 'coroutine-function-definition', kind: 'keyword' },
    'match': { title: 'match statement', url: 'reference/compound_stmts.html', anchor: 'the-match-statement', kind: 'keyword' },
    'case': { title: 'case clause', url: 'reference/compound_stmts.html', anchor: 'the-match-statement', kind: 'keyword' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Simple statements   reference/simple_stmts.html
// ─────────────────────────────────────────────────────────────────────────────
const SIMPLE: Record<string, Info> = {
    'pass': { title: 'pass statement', url: 'reference/simple_stmts.html', anchor: 'the-pass-statement', kind: 'keyword' },
    'del': { title: 'del statement', url: 'reference/simple_stmts.html', anchor: 'the-del-statement', kind: 'keyword' },
    'return': { title: 'return statement', url: 'reference/simple_stmts.html', anchor: 'the-return-statement', kind: 'keyword' },
    'raise': { title: 'raise statement', url: 'reference/simple_stmts.html', anchor: 'the-raise-statement', kind: 'keyword' },
    'break': { title: 'break statement', url: 'reference/simple_stmts.html', anchor: 'the-break-statement', kind: 'keyword' },
    'continue': { title: 'continue statement', url: 'reference/simple_stmts.html', anchor: 'the-continue-statement', kind: 'keyword' },
    'import': { title: 'import statement', url: 'reference/simple_stmts.html', anchor: 'the-import-statement', kind: 'keyword' },
    'from': { title: 'from import', url: 'reference/simple_stmts.html', anchor: 'the-import-statement', kind: 'keyword' },
    'as': { title: 'as (import alias)', url: 'reference/simple_stmts.html', anchor: 'the-import-statement', kind: 'keyword' },
    'global': { title: 'global statement', url: 'reference/simple_stmts.html', anchor: 'the-global-statement', kind: 'keyword' },
    'nonlocal': { title: 'nonlocal statement', url: 'reference/simple_stmts.html', anchor: 'the-nonlocal-statement', kind: 'keyword' },
    'assert': { title: 'assert statement', url: 'reference/simple_stmts.html', anchor: 'the-assert-statement', kind: 'keyword' },
    'yield': { title: 'yield statement', url: 'reference/simple_stmts.html', anchor: 'the-yield-statement', kind: 'keyword' },
    'type': { title: 'type statement', url: 'reference/simple_stmts.html', anchor: 'type', kind: 'keyword' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Expressions / operators   reference/expressions.html
// ─────────────────────────────────────────────────────────────────────────────
const EXPRESSIONS: Record<string, Info> = {
    'lambda': { title: 'lambda expression', url: 'reference/expressions.html', anchor: 'lambda', kind: 'keyword' },
    'await': { title: 'await expression', url: 'reference/expressions.html', anchor: 'await-expression', kind: 'keyword' },
    'not': { title: 'not operator', url: 'reference/expressions.html', anchor: 'boolean-operations', kind: 'operator' },
    'and': { title: 'and operator', url: 'reference/expressions.html', anchor: 'boolean-operations', kind: 'operator' },
    'or': { title: 'or operator', url: 'reference/expressions.html', anchor: 'boolean-operations', kind: 'operator' },
    'in': { title: 'in operator', url: 'reference/expressions.html', anchor: 'membership-test-operations', kind: 'operator' },
    'not in': { title: 'not in operator', url: 'reference/expressions.html', anchor: 'membership-test-operations', kind: 'operator' },
    'is': { title: 'is operator', url: 'reference/expressions.html', anchor: 'identity-comparisons', kind: 'operator' },
    'is not': { title: 'is not operator', url: 'reference/expressions.html', anchor: 'identity-comparisons', kind: 'operator' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Built-in constants   library/constants.html
// ─────────────────────────────────────────────────────────────────────────────
const CONSTANTS: Record<string, Info> = {
    'None': { title: 'None', url: 'library/constants.html', anchor: 'None', kind: 'constant' },
    'True': { title: 'True', url: 'library/constants.html', anchor: 'True', kind: 'constant' },
    'False': { title: 'False', url: 'library/constants.html', anchor: 'False', kind: 'constant' },
    'Ellipsis': { title: 'Ellipsis', url: 'library/constants.html', anchor: 'Ellipsis', kind: 'constant' },
    '...': { title: 'Ellipsis', url: 'library/constants.html', anchor: 'Ellipsis', kind: 'constant' },
    '__debug__': { title: '__debug__', url: 'library/constants.html', anchor: '__debug__', kind: 'constant' },
    '__name__': { title: '__name__', url: 'library/__main__.html', anchor: '__name__', kind: 'constant' },
};

// ─────────────────────────────────────────────────────────────────────────────
// typing module   library/typing.html
// Anchors verified against docs.python.org/3/library/typing.html
// ─────────────────────────────────────────────────────────────────────────────
const TYPING: Record<string, Info> = {
    // Core special forms
    'typing.Any':            { title: 'typing.Any',            url: 'library/typing.html', anchor: 'typing.Any',            kind: 'class' },
    'typing.Union':          { title: 'typing.Union',          url: 'library/typing.html', anchor: 'typing.Union',          kind: 'class' },
    'typing.Optional':       { title: 'typing.Optional',       url: 'library/typing.html', anchor: 'typing.Optional',       kind: 'class' },
    'typing.Literal':        { title: 'typing.Literal',        url: 'library/typing.html', anchor: 'typing.Literal',        kind: 'class' },
    'typing.Final':          { title: 'typing.Final',          url: 'library/typing.html', anchor: 'typing.Final',          kind: 'class' },
    'typing.ClassVar':       { title: 'typing.ClassVar',       url: 'library/typing.html', anchor: 'typing.ClassVar',       kind: 'class' },
    'typing.Annotated':      { title: 'typing.Annotated',      url: 'library/typing.html', anchor: 'typing.Annotated',      kind: 'class' },
    'typing.TypeAlias':      { title: 'typing.TypeAlias',      url: 'library/typing.html', anchor: 'typing.TypeAlias',      kind: 'class' },
    // Never / NoReturn
    'typing.NoReturn':       { title: 'typing.NoReturn',       url: 'library/typing.html', anchor: 'typing.NoReturn',       kind: 'class' },
    'typing.Never':          { title: 'typing.Never',          url: 'library/typing.html', anchor: 'typing.Never',          kind: 'class' },
    'typing.LiteralString':  { title: 'typing.LiteralString',  url: 'library/typing.html', anchor: 'typing.LiteralString',  kind: 'class' },
    'typing.Self':           { title: 'typing.Self',           url: 'library/typing.html', anchor: 'typing.Self',           kind: 'class' },
    // Type variables
    'typing.TypeVar':        { title: 'typing.TypeVar',        url: 'library/typing.html', anchor: 'typing.TypeVar',        kind: 'class' },
    'typing.TypeVarTuple':   { title: 'typing.TypeVarTuple',   url: 'library/typing.html', anchor: 'typing.TypeVarTuple',   kind: 'class' },
    'typing.ParamSpec':      { title: 'typing.ParamSpec',      url: 'library/typing.html', anchor: 'typing.ParamSpec',      kind: 'class' },
    'typing.Concatenate':    { title: 'typing.Concatenate',    url: 'library/typing.html', anchor: 'typing.Concatenate',    kind: 'class' },
    'typing.Unpack':         { title: 'typing.Unpack',         url: 'library/typing.html', anchor: 'typing.Unpack',         kind: 'class' },
    // Structural subtyping
    'typing.Protocol':       { title: 'typing.Protocol',       url: 'library/typing.html', anchor: 'typing.Protocol',       kind: 'class' },
    'typing.runtime_checkable': { title: 'typing.runtime_checkable', url: 'library/typing.html', anchor: 'typing.runtime_checkable', kind: 'function' },
    'typing.Generic':        { title: 'typing.Generic',        url: 'library/typing.html', anchor: 'typing.Generic',        kind: 'class' },
    // Named structured types
    'typing.TypedDict':      { title: 'typing.TypedDict',      url: 'library/typing.html', anchor: 'typing.TypedDict',      kind: 'class' },
    'typing.NamedTuple':     { title: 'typing.NamedTuple',     url: 'library/typing.html', anchor: 'typing.NamedTuple',     kind: 'class' },
    // Generic aliases (deprecated since 3.9 — builtins preferred)
    'typing.List':           { title: 'typing.List',           url: 'library/typing.html', anchor: 'typing.List',           kind: 'class' },
    'typing.Dict':           { title: 'typing.Dict',           url: 'library/typing.html', anchor: 'typing.Dict',           kind: 'class' },
    'typing.Set':            { title: 'typing.Set',            url: 'library/typing.html', anchor: 'typing.Set',            kind: 'class' },
    'typing.FrozenSet':      { title: 'typing.FrozenSet',      url: 'library/typing.html', anchor: 'typing.FrozenSet',      kind: 'class' },
    'typing.Tuple':          { title: 'typing.Tuple',          url: 'library/typing.html', anchor: 'typing.Tuple',          kind: 'class' },
    'typing.Type':           { title: 'typing.Type',           url: 'library/typing.html', anchor: 'typing.Type',           kind: 'class' },
    'typing.Callable':       { title: 'typing.Callable',       url: 'library/typing.html', anchor: 'typing.Callable',       kind: 'class' },
    // Abstract container aliases
    'typing.Sequence':       { title: 'typing.Sequence',       url: 'library/typing.html', anchor: 'typing.Sequence',       kind: 'class' },
    'typing.MutableSequence':{ title: 'typing.MutableSequence',url: 'library/typing.html', anchor: 'typing.MutableSequence',kind: 'class' },
    'typing.Mapping':        { title: 'typing.Mapping',        url: 'library/typing.html', anchor: 'typing.Mapping',        kind: 'class' },
    'typing.MutableMapping': { title: 'typing.MutableMapping', url: 'library/typing.html', anchor: 'typing.MutableMapping', kind: 'class' },
    'typing.Iterable':       { title: 'typing.Iterable',       url: 'library/typing.html', anchor: 'typing.Iterable',       kind: 'class' },
    'typing.Iterator':       { title: 'typing.Iterator',       url: 'library/typing.html', anchor: 'typing.Iterator',       kind: 'class' },
    'typing.Generator':      { title: 'typing.Generator',      url: 'library/typing.html', anchor: 'typing.Generator',      kind: 'class' },
    'typing.AsyncIterable':  { title: 'typing.AsyncIterable',  url: 'library/typing.html', anchor: 'typing.AsyncIterable',  kind: 'class' },
    'typing.AsyncIterator':  { title: 'typing.AsyncIterator',  url: 'library/typing.html', anchor: 'typing.AsyncIterator',  kind: 'class' },
    'typing.AsyncGenerator': { title: 'typing.AsyncGenerator', url: 'library/typing.html', anchor: 'typing.AsyncGenerator', kind: 'class' },
    'typing.Awaitable':      { title: 'typing.Awaitable',      url: 'library/typing.html', anchor: 'typing.Awaitable',      kind: 'class' },
    'typing.Coroutine':      { title: 'typing.Coroutine',      url: 'library/typing.html', anchor: 'typing.Coroutine',      kind: 'class' },
    // Helper functions
    'typing.overload':       { title: 'typing.overload',       url: 'library/typing.html', anchor: 'typing.overload',       kind: 'function' },
    'typing.cast':           { title: 'typing.cast',           url: 'library/typing.html', anchor: 'typing.cast',           kind: 'function' },
    'typing.assert_type':    { title: 'typing.assert_type',    url: 'library/typing.html', anchor: 'typing.assert_type',    kind: 'function' },
    'typing.get_type_hints': { title: 'typing.get_type_hints', url: 'library/typing.html', anchor: 'typing.get_type_hints', kind: 'function' },
    'typing.get_origin':     { title: 'typing.get_origin',     url: 'library/typing.html', anchor: 'typing.get_origin',     kind: 'function' },
    'typing.get_args':       { title: 'typing.get_args',       url: 'library/typing.html', anchor: 'typing.get_args',       kind: 'function' },
    'typing.is_typeddict':   { title: 'typing.is_typeddict',   url: 'library/typing.html', anchor: 'typing.is_typeddict',   kind: 'function' },
    // Constants
    'typing.TYPE_CHECKING':  { title: 'typing.TYPE_CHECKING',  url: 'library/typing.html', anchor: 'typing.TYPE_CHECKING',  kind: 'constant' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Common stdlib symbols   (most frequently hovered, quick offline resolution)
// ─────────────────────────────────────────────────────────────────────────────
const STDLIB_SYMBOLS: Record<string, Info> = {
    // functools
    'functools.wraps':            { title: 'functools.wraps',            url: 'library/functools.html', anchor: 'functools.wraps',            kind: 'function' },
    'functools.lru_cache':        { title: 'functools.lru_cache',        url: 'library/functools.html', anchor: 'functools.lru_cache',        kind: 'function' },
    'functools.cache':            { title: 'functools.cache',            url: 'library/functools.html', anchor: 'functools.cache',            kind: 'function' },
    'functools.partial':          { title: 'functools.partial',          url: 'library/functools.html', anchor: 'functools.partial',          kind: 'class' },
    'functools.reduce':           { title: 'functools.reduce',           url: 'library/functools.html', anchor: 'functools.reduce',           kind: 'function' },
    'functools.cached_property':  { title: 'functools.cached_property',  url: 'library/functools.html', anchor: 'functools.cached_property',  kind: 'class' },
    'functools.total_ordering':   { title: 'functools.total_ordering',   url: 'library/functools.html', anchor: 'functools.total_ordering',   kind: 'function' },
    'functools.singledispatch':   { title: 'functools.singledispatch',   url: 'library/functools.html', anchor: 'functools.singledispatch',   kind: 'function' },
    // contextlib
    'contextlib.contextmanager':  { title: 'contextlib.contextmanager',  url: 'library/contextlib.html', anchor: 'contextlib.contextmanager',  kind: 'function' },
    'contextlib.asynccontextmanager': { title: 'contextlib.asynccontextmanager', url: 'library/contextlib.html', anchor: 'contextlib.asynccontextmanager', kind: 'function' },
    'contextlib.suppress':        { title: 'contextlib.suppress',        url: 'library/contextlib.html', anchor: 'contextlib.suppress',        kind: 'function' },
    'contextlib.AbstractContextManager': { title: 'contextlib.AbstractContextManager', url: 'library/contextlib.html', anchor: 'contextlib.AbstractContextManager', kind: 'class' },
    // dataclasses
    'dataclasses.dataclass':      { title: 'dataclasses.dataclass',      url: 'library/dataclasses.html', anchor: 'dataclasses.dataclass',      kind: 'function' },
    'dataclasses.field':          { title: 'dataclasses.field',          url: 'library/dataclasses.html', anchor: 'dataclasses.field',          kind: 'function' },
    'dataclasses.fields':         { title: 'dataclasses.fields',         url: 'library/dataclasses.html', anchor: 'dataclasses.fields',         kind: 'function' },
    'dataclasses.asdict':         { title: 'dataclasses.asdict',         url: 'library/dataclasses.html', anchor: 'dataclasses.asdict',         kind: 'function' },
    'dataclasses.astuple':        { title: 'dataclasses.astuple',        url: 'library/dataclasses.html', anchor: 'dataclasses.astuple',        kind: 'function' },
    'dataclasses.replace':        { title: 'dataclasses.replace',        url: 'library/dataclasses.html', anchor: 'dataclasses.replace',        kind: 'function' },
    'dataclasses.Field':          { title: 'dataclasses.Field',          url: 'library/dataclasses.html', anchor: 'dataclasses.Field',          kind: 'class' },
    // pathlib
    'pathlib.Path':               { title: 'pathlib.Path',               url: 'library/pathlib.html', anchor: 'pathlib.Path',               kind: 'class' },
    'pathlib.PurePath':           { title: 'pathlib.PurePath',           url: 'library/pathlib.html', anchor: 'pathlib.PurePath',           kind: 'class' },
    'pathlib.PosixPath':          { title: 'pathlib.PosixPath',          url: 'library/pathlib.html', anchor: 'pathlib.PosixPath',          kind: 'class' },
    'pathlib.WindowsPath':        { title: 'pathlib.WindowsPath',        url: 'library/pathlib.html', anchor: 'pathlib.WindowsPath',        kind: 'class' },
    // collections
    'collections.namedtuple':     { title: 'collections.namedtuple',     url: 'library/collections.html', anchor: 'collections.namedtuple',     kind: 'function' },
    'collections.OrderedDict':    { title: 'collections.OrderedDict',    url: 'library/collections.html', anchor: 'collections.OrderedDict',    kind: 'class' },
    'collections.defaultdict':    { title: 'collections.defaultdict',    url: 'library/collections.html', anchor: 'collections.defaultdict',    kind: 'class' },
    'collections.Counter':        { title: 'collections.Counter',        url: 'library/collections.html', anchor: 'collections.Counter',        kind: 'class' },
    'collections.deque':          { title: 'collections.deque',          url: 'library/collections.html', anchor: 'collections.deque',          kind: 'class' },
    'collections.ChainMap':       { title: 'collections.ChainMap',       url: 'library/collections.html', anchor: 'collections.ChainMap',       kind: 'class' },
    // abc
    'abc.ABC':                    { title: 'abc.ABC',                    url: 'library/abc.html', anchor: 'abc.ABC',                    kind: 'class' },
    'abc.ABCMeta':                { title: 'abc.ABCMeta',                url: 'library/abc.html', anchor: 'abc.ABCMeta',                kind: 'class' },
    'abc.abstractmethod':         { title: 'abc.abstractmethod',         url: 'library/abc.html', anchor: 'abc.abstractmethod',         kind: 'function' },
    // enum
    'enum.Enum':                  { title: 'enum.Enum',                  url: 'library/enum.html', anchor: 'enum.Enum',                  kind: 'class' },
    'enum.IntEnum':               { title: 'enum.IntEnum',               url: 'library/enum.html', anchor: 'enum.IntEnum',               kind: 'class' },
    'enum.Flag':                  { title: 'enum.Flag',                  url: 'library/enum.html', anchor: 'enum.Flag',                  kind: 'class' },
    'enum.IntFlag':               { title: 'enum.IntFlag',               url: 'library/enum.html', anchor: 'enum.IntFlag',               kind: 'class' },
    'enum.StrEnum':               { title: 'enum.StrEnum',               url: 'library/enum.html', anchor: 'enum.StrEnum',               kind: 'class' },
    'enum.auto':                  { title: 'enum.auto',                  url: 'library/enum.html', anchor: 'enum.auto',                  kind: 'function' },
    // asyncio
    'asyncio.run':                { title: 'asyncio.run',                url: 'library/asyncio-runner.html', anchor: 'asyncio.run',                kind: 'function' },
    'asyncio.gather':             { title: 'asyncio.gather',             url: 'library/asyncio-task.html', anchor: 'asyncio.gather',             kind: 'function' },
    'asyncio.create_task':        { title: 'asyncio.create_task',        url: 'library/asyncio-task.html', anchor: 'asyncio.create_task',        kind: 'function' },
    'asyncio.sleep':              { title: 'asyncio.sleep',              url: 'library/asyncio-task.html', anchor: 'asyncio.sleep',              kind: 'function' },
    'asyncio.wait':               { title: 'asyncio.wait',               url: 'library/asyncio-task.html', anchor: 'asyncio.wait',               kind: 'function' },
    'asyncio.wait_for':           { title: 'asyncio.wait_for',           url: 'library/asyncio-task.html', anchor: 'asyncio.wait_for',           kind: 'function' },
    'asyncio.Task':               { title: 'asyncio.Task',               url: 'library/asyncio-task.html', anchor: 'asyncio.Task',               kind: 'class' },
    'asyncio.Event':              { title: 'asyncio.Event',              url: 'library/asyncio-sync.html', anchor: 'asyncio.Event',              kind: 'class' },
    'asyncio.Lock':               { title: 'asyncio.Lock',               url: 'library/asyncio-sync.html', anchor: 'asyncio.Lock',               kind: 'class' },
    'asyncio.Queue':              { title: 'asyncio.Queue',              url: 'library/asyncio-queue.html', anchor: 'asyncio.Queue',              kind: 'class' },
    // itertools
    'itertools.chain':            { title: 'itertools.chain',            url: 'library/itertools.html', anchor: 'itertools.chain',            kind: 'class' },
    'itertools.product':          { title: 'itertools.product',          url: 'library/itertools.html', anchor: 'itertools.product',          kind: 'class' },
    'itertools.combinations':     { title: 'itertools.combinations',     url: 'library/itertools.html', anchor: 'itertools.combinations',     kind: 'class' },
    'itertools.permutations':     { title: 'itertools.permutations',     url: 'library/itertools.html', anchor: 'itertools.permutations',     kind: 'class' },
    'itertools.groupby':          { title: 'itertools.groupby',          url: 'library/itertools.html', anchor: 'itertools.groupby',          kind: 'class' },
    'itertools.islice':           { title: 'itertools.islice',           url: 'library/itertools.html', anchor: 'itertools.islice',           kind: 'class' },
    'itertools.count':            { title: 'itertools.count',            url: 'library/itertools.html', anchor: 'itertools.count',            kind: 'class' },
    'itertools.repeat':           { title: 'itertools.repeat',           url: 'library/itertools.html', anchor: 'itertools.repeat',           kind: 'class' },
    'itertools.zip_longest':      { title: 'itertools.zip_longest',      url: 'library/itertools.html', anchor: 'itertools.zip_longest',      kind: 'class' },
    // os
    'os.path.join':               { title: 'os.path.join',               url: 'library/os.path.html', anchor: 'os.path.join',               kind: 'function' },
    'os.path.exists':             { title: 'os.path.exists',             url: 'library/os.path.html', anchor: 'os.path.exists',             kind: 'function' },
    'os.path.dirname':            { title: 'os.path.dirname',            url: 'library/os.path.html', anchor: 'os.path.dirname',            kind: 'function' },
    'os.path.basename':           { title: 'os.path.basename',           url: 'library/os.path.html', anchor: 'os.path.basename',           kind: 'function' },
    'os.path.abspath':            { title: 'os.path.abspath',            url: 'library/os.path.html', anchor: 'os.path.abspath',            kind: 'function' },
    'os.path.splitext':           { title: 'os.path.splitext',           url: 'library/os.path.html', anchor: 'os.path.splitext',           kind: 'function' },
};

export const MAP: Record<string, Info> = {
    ...COMPOUND,
    ...SIMPLE,
    ...EXPRESSIONS,
    ...CONSTANTS,
    ...TYPING,
    ...STDLIB_SYMBOLS,
};
