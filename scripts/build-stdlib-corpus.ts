/**
 * Build a prebuilt stdlib documentation corpus.
 *
 * Fetches content from docs.python.org for frequently-hovered stdlib symbols
 * (builtins, keywords, constants, common functions/classes) and serializes
 * structured JSON that the extension loads at startup.
 *
 * ALL content comes from official Python documentation — nothing is
 * repo-authored.
 *
 * Usage:
 *   npx tsx scripts/build-stdlib-corpus.ts [--version 3.13] [--output docs-engine/data/stdlibCorpus.json]
 */

import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

// ── Configuration ──────────────────────────────────────────────────────────

const DEFAULT_VERSION = '3.13';
const DEFAULT_OUTPUT = path.join(__dirname, '..', 'docs-engine', 'data', 'stdlibCorpus.ts');
const BASE_URL = 'https://docs.python.org';
const FETCH_TIMEOUT = 15000;
const CONCURRENCY = 4; // parallel fetches to not hammer docs.python.org
const DELAY_BETWEEN_BATCHES = 500; // ms

// ── Corpus entry type ──────────────────────────────────────────────────────

interface CorpusEntry {
    summary: string;
    content?: string;
    signature?: string;
    url: string;
    seeAlso?: string[];
}

// ── Symbols to include ─────────────────────────────────────────────────────
// These are the most commonly hovered stdlib symbols.  Each entry maps a
// qualname to its docs URL path + optional anchor.

interface SymbolSpec {
    urlPath: string;    // relative to docs.python.org/{version}/
    anchor?: string;    // HTML id for section extraction
}

function builtinFunc(name: string): SymbolSpec {
    return { urlPath: 'library/functions.html', anchor: name };
}

function builtinType(name: string): SymbolSpec {
    return { urlPath: 'library/stdtypes.html', anchor: name };
}

function builtinConst(name: string): SymbolSpec {
    return { urlPath: 'library/constants.html', anchor: name };
}

function keyword(name: string, anchor: string): SymbolSpec {
    return { urlPath: 'reference/compound_stmts.html', anchor };
}

function simpleKeyword(name: string, anchor: string): SymbolSpec {
    return { urlPath: 'reference/simple_stmts.html', anchor };
}

function exprKeyword(name: string, urlPath: string, anchor: string): SymbolSpec {
    return { urlPath, anchor };
}

const SYMBOLS: Record<string, SymbolSpec> = {
    // ── Built-in functions ──────────────────────────────────────────────
    'abs': builtinFunc('abs'),
    'all': builtinFunc('all'),
    'any': builtinFunc('any'),
    'ascii': builtinFunc('ascii'),
    'bin': builtinFunc('bin'),
    'breakpoint': builtinFunc('breakpoint'),
    'callable': builtinFunc('callable'),
    'chr': builtinFunc('chr'),
    'classmethod': builtinFunc('classmethod'),
    'compile': builtinFunc('compile'),
    'complex': builtinFunc('complex'),
    'delattr': builtinFunc('delattr'),
    'dir': builtinFunc('dir'),
    'divmod': builtinFunc('divmod'),
    'enumerate': builtinFunc('enumerate'),
    'eval': builtinFunc('eval'),
    'exec': builtinFunc('exec'),
    'filter': builtinFunc('filter'),
    'format': builtinFunc('format'),
    'getattr': builtinFunc('getattr'),
    'globals': builtinFunc('globals'),
    'hasattr': builtinFunc('hasattr'),
    'hash': builtinFunc('hash'),
    'help': builtinFunc('help'),
    'hex': builtinFunc('hex'),
    'id': builtinFunc('id'),
    'input': builtinFunc('input'),
    'isinstance': builtinFunc('isinstance'),
    'issubclass': builtinFunc('issubclass'),
    'iter': builtinFunc('iter'),
    'len': builtinFunc('len'),
    'locals': builtinFunc('locals'),
    'map': builtinFunc('map'),
    'max': builtinFunc('max'),
    'min': builtinFunc('min'),
    'next': builtinFunc('next'),
    'oct': builtinFunc('oct'),
    'open': builtinFunc('open'),
    'ord': builtinFunc('ord'),
    'pow': builtinFunc('pow'),
    'print': builtinFunc('print'),
    'property': builtinFunc('property'),
    'repr': builtinFunc('repr'),
    'reversed': builtinFunc('reversed'),
    'round': builtinFunc('round'),
    'setattr': builtinFunc('setattr'),
    'slice': builtinFunc('slice'),
    'sorted': builtinFunc('sorted'),
    'staticmethod': builtinFunc('staticmethod'),
    'sum': builtinFunc('sum'),
    'super': builtinFunc('super'),
    'type': builtinFunc('type'),
    'vars': builtinFunc('vars'),
    'zip': builtinFunc('zip'),
    '__import__': builtinFunc('import__'),

    // ── Built-in types ──────────────────────────────────────────────────
    // Note: docs.python.org uses "func-" prefix for these type constructors
    'int': builtinFunc('int'),
    'float': builtinFunc('float'),
    'bool': builtinFunc('bool'),
    'str': builtinFunc('func-str'),
    'bytes': builtinFunc('func-bytes'),
    'bytearray': builtinFunc('func-bytearray'),
    'memoryview': builtinFunc('func-memoryview'),
    'list': builtinFunc('func-list'),
    'tuple': builtinFunc('func-tuple'),
    'dict': builtinFunc('func-dict'),
    'set': builtinFunc('func-set'),
    'frozenset': builtinFunc('func-frozenset'),
    'range': builtinFunc('func-range'),
    'object': builtinFunc('object'),

    // ── Constants ────────────────────────────────────────────────────────
    'None': builtinConst('None'),
    'True': builtinConst('True'),
    'False': builtinConst('False'),
    'Ellipsis': builtinConst('Ellipsis'),
    'NotImplemented': builtinConst('NotImplemented'),
    '__debug__': builtinConst('debug__'),

    // ── Keywords (compound statements) ──────────────────────────────────
    'if': keyword('if', 'the-if-statement'),
    'for': keyword('for', 'the-for-statement'),
    'while': keyword('while', 'the-while-statement'),
    'try': keyword('try', 'the-try-statement'),
    'with': keyword('with', 'the-with-statement'),
    'match': keyword('match', 'the-match-statement'),
    'case': keyword('case', 'the-match-statement'),
    'class': keyword('class', 'class-definitions'),
    'def': keyword('def', 'function-definitions'),
    'async': { urlPath: 'reference/compound_stmts.html', anchor: 'coroutines' },

    // ── Keywords (simple statements) ────────────────────────────────────
    'assert': simpleKeyword('assert', 'the-assert-statement'),
    'pass': simpleKeyword('pass', 'the-pass-statement'),
    'del': simpleKeyword('del', 'the-del-statement'),
    'return': simpleKeyword('return', 'the-return-statement'),
    'yield': simpleKeyword('yield', 'the-yield-statement'),
    'raise': simpleKeyword('raise', 'the-raise-statement'),
    'break': simpleKeyword('break', 'the-break-statement'),
    'continue': simpleKeyword('continue', 'the-continue-statement'),
    'import': simpleKeyword('import', 'the-import-statement'),
    'global': simpleKeyword('global', 'the-global-statement'),
    'nonlocal': simpleKeyword('nonlocal', 'the-nonlocal-statement'),

    // ── Expression keywords ─────────────────────────────────────────────
    'lambda': exprKeyword('lambda', 'reference/expressions.html', 'lambda'),
    'await': exprKeyword('await', 'reference/expressions.html', 'await-expression'),
    'in': exprKeyword('in', 'reference/expressions.html', 'membership-test-operations'),
    'is': exprKeyword('is', 'reference/expressions.html', 'is'),
    'not': exprKeyword('not', 'reference/expressions.html', 'not'),
    'and': exprKeyword('and', 'reference/expressions.html', 'and'),
    'or': exprKeyword('or', 'reference/expressions.html', 'or'),

    // ── Built-in exceptions (most common) ───────────────────────────────
    'Exception': { urlPath: 'library/exceptions.html', anchor: 'Exception' },
    'BaseException': { urlPath: 'library/exceptions.html', anchor: 'BaseException' },
    'TypeError': { urlPath: 'library/exceptions.html', anchor: 'TypeError' },
    'ValueError': { urlPath: 'library/exceptions.html', anchor: 'ValueError' },
    'KeyError': { urlPath: 'library/exceptions.html', anchor: 'KeyError' },
    'IndexError': { urlPath: 'library/exceptions.html', anchor: 'IndexError' },
    'AttributeError': { urlPath: 'library/exceptions.html', anchor: 'AttributeError' },
    'ImportError': { urlPath: 'library/exceptions.html', anchor: 'ImportError' },
    'ModuleNotFoundError': { urlPath: 'library/exceptions.html', anchor: 'ModuleNotFoundError' },
    'FileNotFoundError': { urlPath: 'library/exceptions.html', anchor: 'FileNotFoundError' },
    'PermissionError': { urlPath: 'library/exceptions.html', anchor: 'PermissionError' },
    'OSError': { urlPath: 'library/exceptions.html', anchor: 'OSError' },
    'IOError': { urlPath: 'library/exceptions.html', anchor: 'IOError' },
    'RuntimeError': { urlPath: 'library/exceptions.html', anchor: 'RuntimeError' },
    'NotImplementedError': { urlPath: 'library/exceptions.html', anchor: 'NotImplementedError' },
    'StopIteration': { urlPath: 'library/exceptions.html', anchor: 'StopIteration' },
    'StopAsyncIteration': { urlPath: 'library/exceptions.html', anchor: 'StopAsyncIteration' },
    'GeneratorExit': { urlPath: 'library/exceptions.html', anchor: 'GeneratorExit' },
    'ArithmeticError': { urlPath: 'library/exceptions.html', anchor: 'ArithmeticError' },
    'ZeroDivisionError': { urlPath: 'library/exceptions.html', anchor: 'ZeroDivisionError' },
    'OverflowError': { urlPath: 'library/exceptions.html', anchor: 'OverflowError' },
    'FloatingPointError': { urlPath: 'library/exceptions.html', anchor: 'FloatingPointError' },
    'LookupError': { urlPath: 'library/exceptions.html', anchor: 'LookupError' },
    'NameError': { urlPath: 'library/exceptions.html', anchor: 'NameError' },
    'UnboundLocalError': { urlPath: 'library/exceptions.html', anchor: 'UnboundLocalError' },
    'SyntaxError': { urlPath: 'library/exceptions.html', anchor: 'SyntaxError' },
    'IndentationError': { urlPath: 'library/exceptions.html', anchor: 'IndentationError' },
    'TabError': { urlPath: 'library/exceptions.html', anchor: 'TabError' },
    'SystemError': { urlPath: 'library/exceptions.html', anchor: 'SystemError' },
    'SystemExit': { urlPath: 'library/exceptions.html', anchor: 'SystemExit' },
    'UnicodeError': { urlPath: 'library/exceptions.html', anchor: 'UnicodeError' },
    'UnicodeDecodeError': { urlPath: 'library/exceptions.html', anchor: 'UnicodeDecodeError' },
    'UnicodeEncodeError': { urlPath: 'library/exceptions.html', anchor: 'UnicodeEncodeError' },
    'RecursionError': { urlPath: 'library/exceptions.html', anchor: 'RecursionError' },
    'MemoryError': { urlPath: 'library/exceptions.html', anchor: 'MemoryError' },
    'ConnectionError': { urlPath: 'library/exceptions.html', anchor: 'ConnectionError' },
    'TimeoutError': { urlPath: 'library/exceptions.html', anchor: 'TimeoutError' },
    'EOFError': { urlPath: 'library/exceptions.html', anchor: 'EOFError' },
    'AssertionError': { urlPath: 'library/exceptions.html', anchor: 'AssertionError' },
    'BufferError': { urlPath: 'library/exceptions.html', anchor: 'BufferError' },
    'Warning': { urlPath: 'library/exceptions.html', anchor: 'Warning' },
    'DeprecationWarning': { urlPath: 'library/exceptions.html', anchor: 'DeprecationWarning' },
    'FutureWarning': { urlPath: 'library/exceptions.html', anchor: 'FutureWarning' },
    'UserWarning': { urlPath: 'library/exceptions.html', anchor: 'UserWarning' },

    // ── Common stdlib functions/classes ──────────────────────────────────
    'dataclasses.dataclass': { urlPath: 'library/dataclasses.html', anchor: 'dataclasses.dataclass' },
    'dataclasses.field': { urlPath: 'library/dataclasses.html', anchor: 'dataclasses.field' },
    'functools.wraps': { urlPath: 'library/functools.html', anchor: 'functools.wraps' },
    'functools.lru_cache': { urlPath: 'library/functools.html', anchor: 'functools.lru_cache' },
    'functools.partial': { urlPath: 'library/functools.html', anchor: 'functools.partial' },
    'functools.reduce': { urlPath: 'library/functools.html', anchor: 'functools.reduce' },
    'functools.cache': { urlPath: 'library/functools.html', anchor: 'functools.cache' },
    'itertools.chain': { urlPath: 'library/itertools.html', anchor: 'itertools.chain' },
    'itertools.product': { urlPath: 'library/itertools.html', anchor: 'itertools.product' },
    'itertools.combinations': { urlPath: 'library/itertools.html', anchor: 'itertools.combinations' },
    'itertools.permutations': { urlPath: 'library/itertools.html', anchor: 'itertools.permutations' },
    'itertools.groupby': { urlPath: 'library/itertools.html', anchor: 'itertools.groupby' },
    'collections.defaultdict': { urlPath: 'library/collections.html', anchor: 'collections.defaultdict' },
    'collections.OrderedDict': { urlPath: 'library/collections.html', anchor: 'collections.OrderedDict' },
    'collections.Counter': { urlPath: 'library/collections.html', anchor: 'collections.Counter' },
    'collections.namedtuple': { urlPath: 'library/collections.html', anchor: 'collections.namedtuple' },
    'collections.deque': { urlPath: 'library/collections.html', anchor: 'collections.deque' },
    'collections.abc.Iterable': { urlPath: 'library/collections.abc.html', anchor: 'collections.abc.Iterable' },
    'collections.abc.Iterator': { urlPath: 'library/collections.abc.html', anchor: 'collections.abc.Iterator' },
    'collections.abc.Generator': { urlPath: 'library/collections.abc.html', anchor: 'collections.abc.Generator' },
    'collections.abc.Callable': { urlPath: 'library/collections.abc.html', anchor: 'collections.abc.Callable' },
    'collections.abc.Sequence': { urlPath: 'library/collections.abc.html', anchor: 'collections.abc.Sequence' },
    'collections.abc.Mapping': { urlPath: 'library/collections.abc.html', anchor: 'collections.abc.Mapping' },
    'pathlib.Path': { urlPath: 'library/pathlib.html', anchor: 'pathlib.Path' },
    'pathlib.PurePath': { urlPath: 'library/pathlib.html', anchor: 'pathlib.PurePath' },
    'os.path.join': { urlPath: 'library/os.path.html', anchor: 'os.path.join' },
    'os.path.exists': { urlPath: 'library/os.path.html', anchor: 'os.path.exists' },
    'os.path.isfile': { urlPath: 'library/os.path.html', anchor: 'os.path.isfile' },
    'os.path.isdir': { urlPath: 'library/os.path.html', anchor: 'os.path.isdir' },
    'os.path.dirname': { urlPath: 'library/os.path.html', anchor: 'os.path.dirname' },
    'os.path.basename': { urlPath: 'library/os.path.html', anchor: 'os.path.basename' },
    'os.path.abspath': { urlPath: 'library/os.path.html', anchor: 'os.path.abspath' },
    'os.listdir': { urlPath: 'library/os.html', anchor: 'os.listdir' },
    'os.makedirs': { urlPath: 'library/os.html', anchor: 'os.makedirs' },
    'os.environ': { urlPath: 'library/os.html', anchor: 'os.environ' },
    'os.getenv': { urlPath: 'library/os.html', anchor: 'os.getenv' },
    'json.dumps': { urlPath: 'library/json.html', anchor: 'json.dumps' },
    'json.loads': { urlPath: 'library/json.html', anchor: 'json.loads' },
    'json.dump': { urlPath: 'library/json.html', anchor: 'json.dump' },
    'json.load': { urlPath: 'library/json.html', anchor: 'json.load' },
    'json.JSONEncoder': { urlPath: 'library/json.html', anchor: 'json.JSONEncoder' },
    'json.JSONDecoder': { urlPath: 'library/json.html', anchor: 'json.JSONDecoder' },
    're.compile': { urlPath: 'library/re.html', anchor: 're.compile' },
    're.match': { urlPath: 'library/re.html', anchor: 're.match' },
    're.search': { urlPath: 'library/re.html', anchor: 're.search' },
    're.findall': { urlPath: 'library/re.html', anchor: 're.findall' },
    're.sub': { urlPath: 'library/re.html', anchor: 're.sub' },
    're.split': { urlPath: 'library/re.html', anchor: 're.split' },
    're.Pattern': { urlPath: 'library/re.html', anchor: 're.Pattern' },
    're.Match': { urlPath: 'library/re.html', anchor: 're.Match' },
    'datetime.datetime': { urlPath: 'library/datetime.html', anchor: 'datetime.datetime' },
    'datetime.date': { urlPath: 'library/datetime.html', anchor: 'datetime.date' },
    'datetime.time': { urlPath: 'library/datetime.html', anchor: 'datetime.time' },
    'datetime.timedelta': { urlPath: 'library/datetime.html', anchor: 'datetime.timedelta' },
    'logging.getLogger': { urlPath: 'library/logging.html', anchor: 'logging.getLogger' },
    'logging.Logger': { urlPath: 'library/logging.html', anchor: 'logging.Logger' },
    'logging.Handler': { urlPath: 'library/logging.html', anchor: 'logging.Handler' },
    'typing.Any': { urlPath: 'library/typing.html', anchor: 'typing.Any' },
    'typing.Union': { urlPath: 'library/typing.html', anchor: 'typing.Union' },
    'typing.Optional': { urlPath: 'library/typing.html', anchor: 'typing.Optional' },
    'typing.List': { urlPath: 'library/typing.html', anchor: 'typing.List' },
    'typing.Dict': { urlPath: 'library/typing.html', anchor: 'typing.Dict' },
    'typing.Tuple': { urlPath: 'library/typing.html', anchor: 'typing.Tuple' },
    'typing.Set': { urlPath: 'library/typing.html', anchor: 'typing.Set' },
    'typing.Literal': { urlPath: 'library/typing.html', anchor: 'typing.Literal' },
    'typing.TypeVar': { urlPath: 'library/typing.html', anchor: 'typing.TypeVar' },
    'typing.Generic': { urlPath: 'library/typing.html', anchor: 'typing.Generic' },
    'typing.Protocol': { urlPath: 'library/typing.html', anchor: 'typing.Protocol' },
    'typing.TypedDict': { urlPath: 'library/typing.html', anchor: 'typing.TypedDict' },
    'typing.Final': { urlPath: 'library/typing.html', anchor: 'typing.Final' },
    'typing.ClassVar': { urlPath: 'library/typing.html', anchor: 'typing.ClassVar' },
    'typing.Callable': { urlPath: 'library/typing.html', anchor: 'typing.Callable' },
    'typing.overload': { urlPath: 'library/typing.html', anchor: 'typing.overload' },
    'typing.cast': { urlPath: 'library/typing.html', anchor: 'typing.cast' },
    'typing.TYPE_CHECKING': { urlPath: 'library/typing.html', anchor: 'typing.TYPE_CHECKING' },
    'typing.NamedTuple': { urlPath: 'library/typing.html', anchor: 'typing.NamedTuple' },
    'typing.TypeAlias': { urlPath: 'library/typing.html', anchor: 'typing.TypeAlias' },
    'abc.ABC': { urlPath: 'library/abc.html', anchor: 'abc.ABC' },
    'abc.ABCMeta': { urlPath: 'library/abc.html', anchor: 'abc.ABCMeta' },
    'abc.abstractmethod': { urlPath: 'library/abc.html', anchor: 'abc.abstractmethod' },
    'contextlib.contextmanager': { urlPath: 'library/contextlib.html', anchor: 'contextlib.contextmanager' },
    'contextlib.asynccontextmanager': { urlPath: 'library/contextlib.html', anchor: 'contextlib.asynccontextmanager' },
    'contextlib.suppress': { urlPath: 'library/contextlib.html', anchor: 'contextlib.suppress' },
    'copy.copy': { urlPath: 'library/copy.html', anchor: 'copy.copy' },
    'copy.deepcopy': { urlPath: 'library/copy.html', anchor: 'copy.deepcopy' },
    'subprocess.run': { urlPath: 'library/subprocess.html', anchor: 'subprocess.run' },
    'subprocess.Popen': { urlPath: 'library/subprocess.html', anchor: 'subprocess.Popen' },
    'threading.Thread': { urlPath: 'library/threading.html', anchor: 'threading.Thread' },
    'threading.Lock': { urlPath: 'library/threading.html', anchor: 'threading.Lock' },
    'asyncio.run': { urlPath: 'library/asyncio-runner.html', anchor: 'asyncio.run' },
    'asyncio.sleep': { urlPath: 'library/asyncio-task.html', anchor: 'asyncio.sleep' },
    'asyncio.gather': { urlPath: 'library/asyncio-task.html', anchor: 'asyncio.gather' },
    'asyncio.create_task': { urlPath: 'library/asyncio-task.html', anchor: 'asyncio.create_task' },
    'asyncio.Task': { urlPath: 'library/asyncio-task.html', anchor: 'asyncio.Task' },
    'asyncio.Queue': { urlPath: 'library/asyncio-queue.html', anchor: 'asyncio.Queue' },
    'asyncio.Event': { urlPath: 'library/asyncio-sync.html', anchor: 'asyncio.Event' },
    'asyncio.Semaphore': { urlPath: 'library/asyncio-sync.html', anchor: 'asyncio.Semaphore' },
    'unittest.TestCase': { urlPath: 'library/unittest.html', anchor: 'unittest.TestCase' },
    'unittest.mock.Mock': { urlPath: 'library/unittest.mock.html', anchor: 'unittest.mock.Mock' },
    'unittest.mock.patch': { urlPath: 'library/unittest.mock.html', anchor: 'unittest.mock.patch' },
    'enum.Enum': { urlPath: 'library/enum.html', anchor: 'enum.Enum' },
    'enum.IntEnum': { urlPath: 'library/enum.html', anchor: 'enum.IntEnum' },
    'enum.StrEnum': { urlPath: 'library/enum.html', anchor: 'enum.StrEnum' },
    'enum.Flag': { urlPath: 'library/enum.html', anchor: 'enum.Flag' },
    'sys.argv': { urlPath: 'library/sys.html', anchor: 'sys.argv' },
    'sys.path': { urlPath: 'library/sys.html', anchor: 'sys.path' },
    'sys.exit': { urlPath: 'library/sys.html', anchor: 'sys.exit' },
    'sys.stdout': { urlPath: 'library/sys.html', anchor: 'sys.stdout' },
    'sys.stderr': { urlPath: 'library/sys.html', anchor: 'sys.stderr' },
    'sys.stdin': { urlPath: 'library/sys.html', anchor: 'sys.stdin' },
    'sys.modules': { urlPath: 'library/sys.html', anchor: 'sys.modules' },
    'sys.version': { urlPath: 'library/sys.html', anchor: 'sys.version' },
    'sys.platform': { urlPath: 'library/sys.html', anchor: 'sys.platform' },
};

// ── HTML fetcher ───────────────────────────────────────────────────────────

function fetchUrl(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const get = (currentUrl: string, redirects = 0) => {
            if (redirects > 3) {
                reject(new Error(`Too many redirects for ${url}`));
                return;
            }
            https.get(currentUrl, { timeout: FETCH_TIMEOUT }, res => {
                if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    get(res.headers.location, redirects + 1);
                    return;
                }
                if (res.statusCode !== 200) {
                    res.resume();
                    reject(new Error(`HTTP ${res.statusCode} for ${currentUrl}`));
                    return;
                }
                const chunks: Buffer[] = [];
                res.on('data', (chunk: Buffer) => chunks.push(chunk));
                res.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    const encoding = res.headers['content-encoding'];
                    if (encoding === 'gzip') {
                        zlib.gunzip(buffer, (err, decoded) => {
                            if (err) reject(err);
                            else resolve(decoded.toString('utf8'));
                        });
                    } else if (encoding === 'br') {
                        zlib.brotliDecompress(buffer, (err, decoded) => {
                            if (err) reject(err);
                            else resolve(decoded.toString('utf8'));
                        });
                    } else {
                        resolve(buffer.toString('utf8'));
                    }
                });
                res.on('error', reject);
            }).on('error', reject);
        };
        get(url);
    });
}

// ── HTML to markdown extraction ────────────────────────────────────────────
// Lightweight extraction — we reuse the SphinxScraper's approach but
// simplified for this build script.

function decodeHtmlEntities(text: string): string {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function stripTags(html: string): string {
    return decodeHtmlEntities(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

interface ExtractedSection {
    content: string;
    /** First non-signature paragraph — used for summary */
    firstParagraph?: string;
    /** Signature line from dt element */
    signature?: string;
}

function extractSection(html: string, anchor: string): ExtractedSection | undefined {
    // Strategy 1: Find a <dt> or element with the exact id
    const anchorEscaped = anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Try dt/dd pattern (function/class definitions)
    const dtPattern = new RegExp(
        `<dt[^>]*\\bid="${anchorEscaped}"[^>]*>([\\s\\S]*?)</dt>\\s*<dd[^>]*>([\\s\\S]*?)</dd>`,
        'i',
    );
    const dtMatch = html.match(dtPattern);
    if (dtMatch) {
        const signature = stripTags(dtMatch[1]).replace(/\s*[¶#]\s*$/, '').trim();
        const body = dtMatch[2];
        const extracted = extractBodyContent(body, signature);
        return { ...extracted, signature };
    }

    // Try section pattern (for reference pages like keyword docs)
    const sectionPattern = new RegExp(
        `<section[^>]*\\bid="${anchorEscaped}"[^>]*>([\\s\\S]*?)(?:</section>)`,
        'i',
    );
    const sectionMatch = html.match(sectionPattern);
    if (sectionMatch) {
        const content = extractSectionContent(sectionMatch[1]);
        return { content, firstParagraph: extractSummary(content) };
    }

    // Try generic id pattern
    const idPattern = new RegExp(
        `id="${anchorEscaped}"[^>]*>([\\s\\S]{0,5000})`,
        'i',
    );
    const idMatch = html.match(idPattern);
    if (idMatch) {
        const afterAnchor = idMatch[1];
        const ddMatch = afterAnchor.match(/<dd[^>]*>([\s\S]*?)<\/dd>/i);
        if (ddMatch) {
            const extracted = extractBodyContent(ddMatch[1]);
            return extracted;
        }
        const paragraphs = afterAnchor.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
        if (paragraphs && paragraphs.length > 0) {
            const texts = paragraphs.slice(0, 3).map(p => stripTags(p)).filter(t => t.length > 10);
            return { content: texts.join('\n\n'), firstParagraph: texts[0] };
        }
    }

    return undefined;
}

interface ExtractedBody {
    content: string;
    /** First non-signature paragraph — used for summary */
    firstParagraph?: string;
}

function extractBodyContent(html: string, signature?: string): ExtractedBody {
    const parts: string[] = [];
    if (signature) {
        parts.push(signature);
    }

    let firstParagraph: string | undefined;

    // Extract paragraphs
    const paragraphs = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
    for (const p of paragraphs.slice(0, 4)) {
        const text = stripTags(p);
        if (text.length > 10) {
            parts.push(text);
            if (!firstParagraph) {
                firstParagraph = text;
            }
        }
    }

    // Extract code examples
    const codeBlocks = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/gi) || [];
    for (const block of codeBlocks.slice(0, 2)) {
        const code = stripTags(block).trim();
        if (code.length > 5 && code.length < 500) {
            parts.push('```python\n' + code + '\n```');
        }
    }

    return { content: parts.join('\n\n'), firstParagraph };
}

function extractSectionContent(html: string): string {
    const parts: string[] = [];

    // Get heading
    const headingMatch = html.match(/<h\d[^>]*>([\s\S]*?)<\/h\d>/i);
    if (headingMatch) {
        const heading = stripTags(headingMatch[1]).replace(/¶$/, '').trim();
        parts.push(`**${heading}**`);
    }

    // Get paragraphs (skip first if it's just "New in version X.Y")
    const paragraphs = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
    let collected = 0;
    for (const p of paragraphs) {
        if (collected >= 5) break;
        const text = stripTags(p);
        if (text.length < 10) continue;
        if (/^(?:New|Changed|Deprecated) in version/i.test(text) && collected === 0) {
            parts.push(text);
            continue;
        }
        parts.push(text);
        collected++;
    }

    return parts.join('\n\n');
}

function extractSummary(fullContent: string): string {
    if (!fullContent) return '';

    const lines = fullContent.split('\n\n');
    // Skip heading lines (bold), signature lines, and version notes
    const contentLines = lines.filter(l => {
        const t = l.trim();
        if (!t || t.length < 10) return false;
        if (t.startsWith('**')) return false;
        // Skip lines that look like "funcname ( args ) ¶"
        if (/^\w[\w.]*\s*\(.*\)\s*[¶#]?\s*$/.test(t)) return false;
        // Skip lines that look like "exception ExceptionName ¶"
        if (/^exception\s+\w+\s*[¶#]?\s*$/.test(t)) return false;
        // Skip lines that look like "class ClassName ¶"
        if (/^class\s+\w[\w.]*\s*(\(.*\))?\s*[¶#]?\s*$/.test(t)) return false;
        // Skip "Added/Changed/New in version X.Y" as a standalone summary
        if (/^(?:New|Changed|Deprecated|Added) in version/i.test(t)) return false;
        return true;
    });

    if (contentLines.length === 0) return '';

    // First meaningful paragraph
    let summary = contentLines[0].trim();

    // Truncate to first sentence if very long
    if (summary.length > 300) {
        const sentenceEnd = summary.indexOf('. ', 80);
        if (sentenceEnd > 0 && sentenceEnd < 280) {
            summary = summary.slice(0, sentenceEnd + 1);
        }
    }

    return summary;
}

function extractSignature(fullContent: string): string | undefined {
    // Look for a function/class signature pattern
    const sigMatch = fullContent.match(/^(\w[\w.]*\s*\([^)]*\))/);
    if (sigMatch) return sigMatch[1];
    return undefined;
}

// ── Main build logic ───────────────────────────────────────────────────────

async function buildCorpus(version: string, outputPath: string): Promise<void> {
    const corpus: Record<string, CorpusEntry> = {};
    const symbolNames = Object.keys(SYMBOLS);
    const totalSymbols = symbolNames.length;

    console.log(`Building stdlib corpus for Python ${version}`);
    console.log(`${totalSymbols} symbols to process`);
    console.log(`Output: ${outputPath}`);
    console.log('');

    // Group symbols by URL to avoid re-fetching the same page
    const urlGroups = new Map<string, { name: string; spec: SymbolSpec }[]>();
    for (const [name, spec] of Object.entries(SYMBOLS)) {
        const fullUrl = `${BASE_URL}/${version}/${spec.urlPath}`;
        const group = urlGroups.get(fullUrl) || [];
        group.push({ name, spec });
        urlGroups.set(fullUrl, group);
    }

    console.log(`${urlGroups.size} unique pages to fetch`);
    console.log('');

    let pagesProcessed = 0;
    let symbolsExtracted = 0;
    let symbolsFailed = 0;

    const urlEntries = Array.from(urlGroups.entries());

    for (let i = 0; i < urlEntries.length; i += CONCURRENCY) {
        const batch = urlEntries.slice(i, i + CONCURRENCY);

        await Promise.all(batch.map(async ([url, symbols]) => {
            let html: string;
            try {
                html = await fetchUrl(url);
            } catch (e) {
                console.error(`  FAILED to fetch ${url}: ${e}`);
                for (const { name, spec } of symbols) {
                    symbolsFailed++;
                    // Still create an entry with just the URL
                    corpus[name] = {
                        summary: '',
                        url: `${url}${spec.anchor ? '#' + spec.anchor : ''}`,
                    };
                }
                return;
            }

            pagesProcessed++;
            process.stdout.write(`  [${pagesProcessed}/${urlGroups.size}] ${url}\n`);

            for (const { name, spec } of symbols) {
                const fullUrl = `${url}${spec.anchor ? '#' + spec.anchor : ''}`;

                if (spec.anchor) {
                    const extracted = extractSection(html, spec.anchor);
                    if (extracted && extracted.content.trim().length > 10) {
                        const summary = extracted.firstParagraph || extractSummary(extracted.content);
                        const content = extracted.content;
                        corpus[name] = {
                            summary,
                            content: content.length > 1500 ? content.slice(0, 1500) + '…' : content,
                            signature: extracted.signature,
                            url: fullUrl,
                        };
                        symbolsExtracted++;
                    } else {
                        corpus[name] = { summary: '', url: fullUrl };
                        symbolsFailed++;
                        console.error(`    WARN: no content for ${name} (anchor: ${spec.anchor})`);
                    }
                } else {
                    // No anchor — use page-level summary
                    const paragraphs = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
                    const firstUseful = paragraphs
                        .map(p => stripTags(p))
                        .find(t => t.length > 30);

                    corpus[name] = {
                        summary: firstUseful || '',
                        url: fullUrl,
                    };
                    if (firstUseful) symbolsExtracted++;
                    else symbolsFailed++;
                }
            }
        }));

        if (i + CONCURRENCY < urlEntries.length) {
            await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES));
        }
    }

    // Write corpus as TypeScript module
    const header = `/**
 * Prebuilt stdlib documentation corpus.
 *
 * AUTO-GENERATED — do not edit manually.
 * Source: docs.python.org/${version}
 * Generated: ${new Date().toISOString().split('T')[0]}
 *
 * All content is from official Python documentation.
 * Regenerate with: npx tsx scripts/build-stdlib-corpus.ts
 */

export interface StdlibCorpusEntry {
    summary: string;
    content?: string;
    signature?: string;
    url: string;
    seeAlso?: string[];
}

export const STDLIB_CORPUS: Record<string, StdlibCorpusEntry> = `;

    const json = JSON.stringify(corpus, null, 2);
    const tsContent = header + json + ';\n';
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, tsContent, 'utf8');

    const sizeKB = (Buffer.byteLength(tsContent, 'utf8') / 1024).toFixed(1);

    console.log('');
    console.log(`Done.`);
    console.log(`  Symbols: ${totalSymbols} total, ${symbolsExtracted} extracted, ${symbolsFailed} failed/empty`);
    console.log(`  Pages fetched: ${pagesProcessed}`);
    console.log(`  Output size: ${sizeKB} KB`);
    console.log(`  Written to: ${outputPath}`);
}

// ── CLI ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
let version = DEFAULT_VERSION;
let output = DEFAULT_OUTPUT;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--version' && args[i + 1]) {
        version = args[i + 1];
        i++;
    } else if (args[i] === '--output' && args[i + 1]) {
        output = args[i + 1];
        i++;
    }
}

buildCorpus(version, output).catch(e => {
    console.error('Build failed:', e);
    process.exit(1);
});
