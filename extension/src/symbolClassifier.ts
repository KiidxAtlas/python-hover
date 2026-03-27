import { LspSymbol } from '../../shared/types';

const BUILTIN_TYPES = new Set([
    'str', 'list', 'dict', 'set', 'tuple', 'int', 'float',
    'bytes', 'bytearray', 'frozenset', 'complex', 'bool', 'object',
]);

/**
 * Top-level Python stdlib module names. Used to skip inventory warmup for
 * stdlib imports because stdlib is already covered by the generated corpus.
 */
const STDLIB_TOP_LEVEL_MODULES = new Set([
    'abc', 'aifc', 'argparse', 'array', 'ast', 'asynchat', 'asyncio',
    'asyncore', 'atexit', 'audioop', 'base64', 'bdb', 'binascii', 'binhex',
    'bisect', 'builtins', 'bz2', 'calendar', 'cgi', 'cgitb', 'chunk',
    'cmath', 'cmd', 'code', 'codecs', 'codeop', 'collections', 'colorsys',
    'compileall', 'concurrent', 'configparser', 'contextlib', 'contextvars',
    'copy', 'copyreg', 'cProfile', 'csv', 'ctypes', 'curses', 'dataclasses',
    'datetime', 'dbm', 'decimal', 'difflib', 'dis', 'doctest', 'email',
    'encodings', 'enum', 'errno', 'faulthandler', 'fcntl', 'filecmp',
    'fileinput', 'fnmatch', 'fractions', 'ftplib', 'functools', 'gc',
    'getopt', 'getpass', 'gettext', 'glob', 'grp', 'gzip', 'hashlib',
    'heapq', 'hmac', 'html', 'http', 'idlelib', 'imaplib', 'imghdr',
    'importlib', 'inspect', 'io', 'ipaddress', 'itertools', 'json',
    'keyword', 'lib2to3', 'linecache', 'locale', 'logging', 'lzma',
    'mailbox', 'math', 'mimetypes', 'mmap', 'modulefinder', 'multiprocessing',
    'netrc', 'nis', 'nntplib', 'numbers', 'operator', 'optparse', 'os',
    'ossaudiodev', 'pathlib', 'pdb', 'pickle', 'pickletools', 'pipes',
    'pkgutil', 'platform', 'plistlib', 'poplib', 'posix', 'posixpath',
    'pprint', 'profile', 'pstats', 'pty', 'pwd', 'py_compile', 'pyclbr',
    'pydoc', 'queue', 'quopri', 'random', 're', 'readline', 'reprlib',
    'resource', 'rlcompleter', 'runpy', 'sched', 'secrets', 'select',
    'selectors', 'shelve', 'shlex', 'shutil', 'signal', 'site', 'smtpd',
    'smtplib', 'sndhdr', 'socket', 'socketserver', 'spwd', 'sqlite3',
    'sre_compile', 'sre_constants', 'sre_parse', 'ssl', 'stat', 'statistics',
    'string', 'stringprep', 'struct', 'subprocess', 'sunau', 'symtable',
    'sys', 'sysconfig', 'syslog', 'tabnanny', 'tarfile', 'telnetlib',
    'tempfile', 'termios', 'test', 'textwrap', 'threading', 'time',
    'timeit', 'tkinter', 'token', 'tokenize', 'tomllib', 'trace',
    'traceback', 'tracemalloc', 'tty', 'turtle', 'turtledemo', 'types',
    'typing', 'unicodedata', 'unittest', 'urllib', 'uu', 'uuid', 'venv',
    'warnings', 'wave', 'weakref', 'webbrowser', 'wsgiref', 'xdrlib',
    'xml', 'xmlrpc', 'zipapp', 'zipfile', 'zipimport', 'zlib', 'zoneinfo',
]);

export function isStdlibTopLevelModule(name: string | undefined): boolean {
    if (!name) return false;
    return STDLIB_TOP_LEVEL_MODULES.has(name.split('.')[0]);
}

export interface SymbolClassification {
    isDotted: boolean;
    isBuiltinMethod: boolean;
    isLibrary: boolean;
    isLocal: boolean;
}

export function classifyHoverSymbol(
    symbol: LspSymbol,
    importedRoots: ReadonlySet<string>,
    wasAliasResolved: boolean,
): SymbolClassification {
    const hasLibPath = !!(symbol.path && isLibraryPath(symbol.path));
    const hasUserPath = !!(symbol.path && !hasLibPath);

    const rawName = symbol.name || '';
    const cleanedName = rawName.replace(/^builtins\./, '');
    const nameRoot = cleanedName.split('.')[0];
    const isDotted = cleanedName.includes('.');
    const isBuiltinMethod = isDotted && BUILTIN_TYPES.has(nameRoot);
    const isBuiltinType = !isDotted && BUILTIN_TYPES.has(cleanedName);
    const isExplicitBuiltins = (symbol.module === 'builtins' || nameRoot === 'builtins') && !hasUserPath;
    const isImportedRoot = isDotted && importedRoots.has(nameRoot);
    const isCapClassMethod = isDotted && /^[A-Z]/.test(nameRoot) && !!symbol.signature;

    const isLibrary = hasLibPath
        || wasAliasResolved
        || isBuiltinMethod
        || isBuiltinType
        || isExplicitBuiltins
        || isImportedRoot
        || isCapClassMethod;

    return {
        isDotted,
        isBuiltinMethod,
        isLibrary,
        isLocal: hasUserPath || !isLibrary,
    };
}

/**
 * True when the path is a Python stdlib file (inside lib/pythonX.Y but not
 * site-packages). Used to suppress third-party discovery for stdlib symbols.
 */
export function isStdlibPath(p: string): boolean {
    const normalizedPath = p.replace(/\\/g, '/').toLowerCase();
    if (normalizedPath.includes('/site-packages/') || normalizedPath.includes('/dist-packages/')) {
        return false;
    }

    return (
        /\/lib\/python\d/.test(normalizedPath)
        || normalizedPath.includes('/typeshed/')
        || normalizedPath.includes('/typeshed-fallback/')
        || normalizedPath.includes('/stdlib/')
    );
}

export function extractImportedRoots(text: string): string[] {
    const roots = new Set<string>();
    const addRoot = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed || trimmed.startsWith('.')) return;

        const root = trimmed.split('.')[0];
        if (!root || root.startsWith('_')) return;
        if (isStdlibTopLevelModule(root)) return;
        roots.add(root);
    };

    const importRegex = /^\s*import\s+([^\n#]+)/gm;
    let importMatch: RegExpExecArray | null;
    while ((importMatch = importRegex.exec(text)) !== null) {
        const modules = importMatch[1].split(',');
        for (const moduleText of modules) {
            addRoot(moduleText.split(/\s+as\s+/i)[0]);
        }
    }

    const fromRegex = /^\s*from\s+([A-Za-z_][\w.]*|\.+[A-Za-z_][\w.]*)\s+import\b/gm;
    let fromMatch: RegExpExecArray | null;
    while ((fromMatch = fromRegex.exec(text)) !== null) {
        addRoot(fromMatch[1]);
    }

    return [...roots].slice(0, 24);
}

export function isLibraryPath(p: string): boolean {
    const normalizedPath = p.replace(/\\/g, '/').toLowerCase();
    return (
        normalizedPath.includes('/site-packages/')
        || normalizedPath.includes('/dist-packages/')
        || /\/lib\/python\d/.test(normalizedPath)
        || /\/lib\/python\//.test(normalizedPath)
        || /\/libs\//.test(normalizedPath)
        || /[/\\]lib[/\\]/i.test(p)
        || normalizedPath.includes('/typeshed/')
        || normalizedPath.includes('/typeshed-fallback/')
        || normalizedPath.includes('/stubs/')
    );
}
