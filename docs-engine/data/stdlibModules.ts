/**
 * Curated one-line descriptions for the most commonly imported stdlib modules.
 *
 * Used by StaticDocResolver to return instant, offline hover content for
 * module-level hovers (e.g. `import os`, `import pathlib`).
 *
 * Keys match the top-level module name (or dotted sub-module) as it appears
 * after name resolution.  URL is relative to docs.python.org/{version}/.
 */
export interface StdlibModuleInfo {
    summary: string;
    url: string;
}

export const STDLIB_MODULES: Record<string, StdlibModuleInfo> = {
    // ── OS / filesystem ───────────────────────────────────────────────
    'os':                   { summary: 'Miscellaneous operating system interfaces', url: 'library/os.html' },
    'os.path':              { summary: 'Common pathname manipulations', url: 'library/os.path.html' },
    'pathlib':              { summary: 'Object-oriented filesystem paths', url: 'library/pathlib.html' },
    'shutil':               { summary: 'High-level file operations — copy, move, rmtree, disk_usage', url: 'library/shutil.html' },
    'glob':                 { summary: 'Unix-style pathname pattern expansion', url: 'library/glob.html' },
    'fnmatch':              { summary: 'Unix filename pattern matching', url: 'library/fnmatch.html' },
    'tempfile':             { summary: 'Generate temporary files and directories', url: 'library/tempfile.html' },

    // ── System ────────────────────────────────────────────────────────
    'sys':                  { summary: 'System-specific parameters and functions', url: 'library/sys.html' },
    'platform':             { summary: 'Access to underlying platform identifying data', url: 'library/platform.html' },
    'signal':               { summary: 'Set handlers for asynchronous events (Unix signals)', url: 'library/signal.html' },
    'gc':                   { summary: 'Garbage Collector interface', url: 'library/gc.html' },
    'weakref':              { summary: 'Weak references', url: 'library/weakref.html' },

    // ── Data structures ───────────────────────────────────────────────
    'collections':          { summary: 'Container datatypes — deque, Counter, OrderedDict, defaultdict, namedtuple', url: 'library/collections.html' },
    'collections.abc':      { summary: 'Abstract Base Classes for containers', url: 'library/collections.abc.html' },
    'heapq':                { summary: 'Heap queue algorithm (priority queue)', url: 'library/heapq.html' },
    'bisect':               { summary: 'Array bisection algorithm (binary search)', url: 'library/bisect.html' },
    'array':                { summary: 'Efficient arrays of numeric values', url: 'library/array.html' },
    'queue':                { summary: 'Synchronized queue classes for thread-safe producer/consumer', url: 'library/queue.html' },
    'deque':                { summary: 'Double-ended queue from collections', url: 'library/collections.html' },

    // ── Functional / iterators ────────────────────────────────────────
    'itertools':            { summary: 'Functions creating iterators for efficient looping', url: 'library/itertools.html' },
    'functools':            { summary: 'Higher-order functions — lru_cache, partial, reduce, wraps', url: 'library/functools.html' },
    'operator':             { summary: 'Standard operators as functions', url: 'library/operator.html' },

    // ── Types / typing ────────────────────────────────────────────────
    'typing':               { summary: 'Support for type hints — List, Dict, Optional, Union, Callable, Protocol', url: 'library/typing.html' },
    'types':                { summary: 'Dynamic type creation and names for built-in types', url: 'library/types.html' },
    'abc':                  { summary: 'Abstract Base Classes', url: 'library/abc.html' },
    'dataclasses':          { summary: '@dataclass decorator — auto-generates __init__, __repr__, __eq__ and more', url: 'library/dataclasses.html' },
    'enum':                 { summary: 'Support for enumerations', url: 'library/enum.html' },

    // ── Math / numbers ────────────────────────────────────────────────
    'math':                 { summary: 'Mathematical functions — sin, cos, sqrt, log, pi, e, floor, ceil', url: 'library/math.html' },
    'cmath':                { summary: 'Mathematical functions for complex numbers', url: 'library/cmath.html' },
    'decimal':              { summary: 'Decimal fixed-point and floating-point arithmetic', url: 'library/decimal.html' },
    'fractions':            { summary: 'Rational numbers', url: 'library/fractions.html' },
    'statistics':           { summary: 'Mathematical statistics — mean, median, stdev, variance', url: 'library/statistics.html' },
    'random':               { summary: 'Generate pseudo-random numbers and random selections', url: 'library/random.html' },

    // ── Strings / text ────────────────────────────────────────────────
    're':                   { summary: 'Regular expression operations', url: 'library/re.html' },
    'string':               { summary: 'Common string operations and string constants', url: 'library/string.html' },
    'textwrap':             { summary: 'Text wrapping and filling', url: 'library/textwrap.html' },
    'difflib':              { summary: 'Helpers for computing deltas between sequences', url: 'library/difflib.html' },
    'unicodedata':          { summary: 'Unicode Database — character properties, names, normalization', url: 'library/unicodedata.html' },
    'codecs':               { summary: 'Codec registry and base classes for encodings', url: 'library/codecs.html' },

    // ── Dates / time ──────────────────────────────────────────────────
    'datetime':             { summary: 'Basic date and time types — date, time, datetime, timedelta, timezone', url: 'library/datetime.html' },
    'time':                 { summary: 'Time access, conversions and performance measurement', url: 'library/time.html' },
    'calendar':             { summary: 'General calendar-related functions', url: 'library/calendar.html' },
    'zoneinfo':             { summary: 'IANA time zone support (Python 3.9+)', url: 'library/zoneinfo.html' },

    // ── Serialization / data formats ──────────────────────────────────
    'json':                 { summary: 'JSON encoder and decoder', url: 'library/json.html' },
    'csv':                  { summary: 'CSV file reading and writing', url: 'library/csv.html' },
    'pickle':               { summary: 'Python object serialization', url: 'library/pickle.html' },
    'shelve':               { summary: 'Python object persistence — dictionary-like, backed by a file', url: 'library/shelve.html' },
    'struct':               { summary: 'Interpret bytes as packed binary data', url: 'library/struct.html' },
    'base64':               { summary: 'Base16, Base32, Base64, Base85 data encodings', url: 'library/base64.html' },
    'hashlib':              { summary: 'Secure hash and message digest algorithms — SHA, MD5, BLAKE2', url: 'library/hashlib.html' },
    'hmac':                 { summary: 'Keyed-hashing for message authentication', url: 'library/hmac.html' },
    'configparser':         { summary: 'Configuration file parser (INI format)', url: 'library/configparser.html' },
    'tomllib':              { summary: 'Parse TOML files (Python 3.11+)', url: 'library/tomllib.html' },
    'xml':                  { summary: 'XML processing modules', url: 'library/xml.html' },
    'xml.etree.ElementTree': { summary: 'The ElementTree XML API', url: 'library/xml.etree.elementtree.html' },

    // ── I/O / streams ─────────────────────────────────────────────────
    'io':                   { summary: 'Core tools for working with streams — BytesIO, StringIO, BufferedReader', url: 'library/io.html' },
    'zipfile':              { summary: 'Work with ZIP archives', url: 'library/zipfile.html' },
    'tarfile':              { summary: 'Read and write tar archive files', url: 'library/tarfile.html' },
    'gzip':                 { summary: 'Support for gzip files', url: 'library/gzip.html' },

    // ── Concurrency ───────────────────────────────────────────────────
    'asyncio':              { summary: 'Asynchronous I/O — event loop, coroutines, tasks, streams', url: 'library/asyncio.html' },
    'threading':            { summary: 'Thread-based parallelism', url: 'library/threading.html' },
    'multiprocessing':      { summary: 'Process-based parallelism — spawn processes sharing no memory', url: 'library/multiprocessing.html' },
    'concurrent':           { summary: 'Launching parallel tasks (concurrent.futures)', url: 'library/concurrent.futures.html' },
    'concurrent.futures':   { summary: 'High-level interface for asynchronously executing callables', url: 'library/concurrent.futures.html' },

    // ── Networking ────────────────────────────────────────────────────
    'socket':               { summary: 'Low-level networking interface', url: 'library/socket.html' },
    'ssl':                  { summary: 'TLS/SSL wrapper for socket objects', url: 'library/ssl.html' },
    'urllib':               { summary: 'URL handling modules', url: 'library/urllib.html' },
    'urllib.parse':         { summary: 'Parse URLs into components and compose URLs', url: 'library/urllib.parse.html' },
    'urllib.request':       { summary: 'Open and read URLs', url: 'library/urllib.request.html' },
    'http':                 { summary: 'HTTP modules (http.client, http.server, http.cookies)', url: 'library/http.html' },
    'http.client':          { summary: 'HTTP and HTTPS protocol client', url: 'library/http.client.html' },
    'http.server':          { summary: 'HTTP server base classes', url: 'library/http.server.html' },
    'email':                { summary: 'Email and MIME handling package', url: 'library/email.html' },

    // ── Subprocess / shell ────────────────────────────────────────────
    'subprocess':           { summary: 'Subprocess management — spawn processes and connect to their I/O', url: 'library/subprocess.html' },

    // ── Context / utilities ───────────────────────────────────────────
    'contextlib':           { summary: 'Utilities for with-statement contexts — contextmanager, suppress, nullcontext', url: 'library/contextlib.html' },
    'copy':                 { summary: 'Shallow and deep copy operations', url: 'library/copy.html' },
    'pprint':               { summary: 'Data pretty printer', url: 'library/pprint.html' },
    'warnings':             { summary: 'Warning control', url: 'library/warnings.html' },
    'traceback':            { summary: 'Print or retrieve a stack traceback', url: 'library/traceback.html' },

    // ── Introspection / import ────────────────────────────────────────
    'inspect':              { summary: 'Inspect live objects — signatures, source code, members, frames', url: 'library/inspect.html' },
    'ast':                  { summary: 'Abstract Syntax Trees — parse, visit, and transform Python code', url: 'library/ast.html' },
    'dis':                  { summary: 'Disassembler for Python bytecode', url: 'library/dis.html' },
    'importlib':            { summary: 'The implementation of the Python import system', url: 'library/importlib.html' },
    'builtins':             { summary: 'Built-in functions, exceptions and other objects', url: 'library/builtins.html' },

    // ── CLI / logging ─────────────────────────────────────────────────
    'argparse':             { summary: 'Parser for command-line options, arguments and sub-commands', url: 'library/argparse.html' },
    'logging':              { summary: 'Logging facility for Python', url: 'library/logging.html' },

    // ── Testing ───────────────────────────────────────────────────────
    'unittest':             { summary: 'Unit testing framework', url: 'library/unittest.html' },
    'unittest.mock':        { summary: 'Mock object library for testing', url: 'library/unittest.mock.html' },

    // ── Database ──────────────────────────────────────────────────────
    'sqlite3':              { summary: 'DB-API 2.0 interface for SQLite databases', url: 'library/sqlite3.html' },
};
