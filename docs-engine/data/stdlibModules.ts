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
    url: string;
}

export const STDLIB_MODULES: Record<string, StdlibModuleInfo> = {
    // ── OS / filesystem ───────────────────────────────────────────────
    'os': { url: 'library/os.html' },
    'os.path': { url: 'library/os.path.html' },
    'pathlib': { url: 'library/pathlib.html' },
    'shutil': { url: 'library/shutil.html' },
    'glob': { url: 'library/glob.html' },
    'fnmatch': { url: 'library/fnmatch.html' },
    'tempfile': { url: 'library/tempfile.html' },

    // ── System ────────────────────────────────────────────────────────
    'sys': { url: 'library/sys.html' },
    'platform': { url: 'library/platform.html' },
    'signal': { url: 'library/signal.html' },
    'gc': { url: 'library/gc.html' },
    'weakref': { url: 'library/weakref.html' },

    // ── Data structures ───────────────────────────────────────────────
    'collections': { url: 'library/collections.html' },
    'collections.abc': { url: 'library/collections.abc.html' },
    'heapq': { url: 'library/heapq.html' },
    'bisect': { url: 'library/bisect.html' },
    'array': { url: 'library/array.html' },
    'queue': { url: 'library/queue.html' },
    'deque': { url: 'library/collections.html' },

    // ── Functional / iterators ────────────────────────────────────────
    'itertools': { url: 'library/itertools.html' },
    'functools': { url: 'library/functools.html' },
    'operator': { url: 'library/operator.html' },

    // ── Types / typing ────────────────────────────────────────────────
    'typing': { url: 'library/typing.html' },
    'types': { url: 'library/types.html' },
    'abc': { url: 'library/abc.html' },
    'dataclasses': { url: 'library/dataclasses.html' },
    'enum': { url: 'library/enum.html' },

    // ── Math / numbers ────────────────────────────────────────────────
    'math': { url: 'library/math.html' },
    'cmath': { url: 'library/cmath.html' },
    'decimal': { url: 'library/decimal.html' },
    'fractions': { url: 'library/fractions.html' },
    'statistics': { url: 'library/statistics.html' },
    'random': { url: 'library/random.html' },

    // ── Strings / text ────────────────────────────────────────────────
    're': { url: 'library/re.html' },
    'string': { url: 'library/string.html' },
    'textwrap': { url: 'library/textwrap.html' },
    'difflib': { url: 'library/difflib.html' },
    'unicodedata': { url: 'library/unicodedata.html' },
    'codecs': { url: 'library/codecs.html' },

    // ── Dates / time ──────────────────────────────────────────────────
    'datetime': { url: 'library/datetime.html' },
    'time': { url: 'library/time.html' },
    'calendar': { url: 'library/calendar.html' },
    'zoneinfo': { url: 'library/zoneinfo.html' },

    // ── Serialization / data formats ──────────────────────────────────
    'json': { url: 'library/json.html' },
    'csv': { url: 'library/csv.html' },
    'pickle': { url: 'library/pickle.html' },
    'shelve': { url: 'library/shelve.html' },
    'struct': { url: 'library/struct.html' },
    'base64': { url: 'library/base64.html' },
    'hashlib': { url: 'library/hashlib.html' },
    'hmac': { url: 'library/hmac.html' },
    'configparser': { url: 'library/configparser.html' },
    'tomllib': { url: 'library/tomllib.html' },
    'xml': { url: 'library/xml.html' },
    'xml.etree.ElementTree': { url: 'library/xml.etree.elementtree.html' },

    // ── I/O / streams ─────────────────────────────────────────────────
    'io': { url: 'library/io.html' },
    'zipfile': { url: 'library/zipfile.html' },
    'tarfile': { url: 'library/tarfile.html' },
    'gzip': { url: 'library/gzip.html' },

    // ── Concurrency ───────────────────────────────────────────────────
    'asyncio': { url: 'library/asyncio.html' },
    'threading': { url: 'library/threading.html' },
    'multiprocessing': { url: 'library/multiprocessing.html' },
    'concurrent': { url: 'library/concurrent.futures.html' },
    'concurrent.futures': { url: 'library/concurrent.futures.html' },

    // ── Networking ────────────────────────────────────────────────────
    'socket': { url: 'library/socket.html' },
    'ssl': { url: 'library/ssl.html' },
    'urllib': { url: 'library/urllib.html' },
    'urllib.parse': { url: 'library/urllib.parse.html' },
    'urllib.request': { url: 'library/urllib.request.html' },
    'http': { url: 'library/http.html' },
    'http.client': { url: 'library/http.client.html' },
    'http.server': { url: 'library/http.server.html' },
    'email': { url: 'library/email.html' },

    // ── Subprocess / shell ────────────────────────────────────────────
    'subprocess': { url: 'library/subprocess.html' },

    // ── Context / utilities ───────────────────────────────────────────
    'contextlib': { url: 'library/contextlib.html' },
    'copy': { url: 'library/copy.html' },
    'pprint': { url: 'library/pprint.html' },
    'warnings': { url: 'library/warnings.html' },
    'traceback': { url: 'library/traceback.html' },

    // ── Introspection / import ────────────────────────────────────────
    'inspect': { url: 'library/inspect.html' },
    'ast': { url: 'library/ast.html' },
    'dis': { url: 'library/dis.html' },
    'importlib': { url: 'library/importlib.html' },
    'builtins': { url: 'library/builtins.html' },

    // ── CLI / logging ─────────────────────────────────────────────────
    'argparse': { url: 'library/argparse.html' },
    'logging': { url: 'library/logging.html' },

    // ── Testing ───────────────────────────────────────────────────────
    'unittest': { url: 'library/unittest.html' },
    'unittest.mock': { url: 'library/unittest.mock.html' },

    // ── Database ──────────────────────────────────────────────────────
    'sqlite3': { url: 'library/sqlite3.html' },
};

export const STDLIB_MOD5ULES = STDLIB_MODULES;
