import * as vscode from 'vscode';
import { OPERATORS } from '../data/documentationUrls';
import { Logger } from '../services/logger';
import { TYPING_CONSTRUCTS } from '../data/typingConstructs';

export interface SymbolInfo {
    symbol: string;
    type: 'builtin' | 'module' | 'method' | 'exception' | 'keyword' | 'decorator' | 'operator' | 'class' | 'f-string' | 'typing';
    context?: string;
    documentation?: string;
}

export class SymbolResolver {
    private static readonly PYTHON_KEYWORDS = new Set([
        'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break',
        'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally',
        'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal',
        'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield'
    ]);

    private static readonly PYTHON_BUILTINS = new Set([
        'abs', 'all', 'any', 'ascii', 'bin', 'bool', 'bytearray', 'bytes',
        'callable', 'chr', 'classmethod', 'compile', 'complex', 'delattr',
        'dict', 'dir', 'divmod', 'enumerate', 'eval', 'exec', 'filter',
        'float', 'format', 'frozenset', 'getattr', 'globals', 'hasattr',
        'hash', 'help', 'hex', 'id', 'input', 'int', 'isinstance',
        'issubclass', 'iter', 'len', 'list', 'locals', 'map', 'max',
        'memoryview', 'min', 'next', 'object', 'oct', 'open', 'ord',
        'pow', 'print', 'property', 'range', 'repr', 'reversed', 'round',
        'set', 'setattr', 'slice', 'sorted', 'staticmethod', 'str', 'sum',
        'super', 'tuple', 'type', 'vars', 'zip'
    ]);

    private static readonly PYTHON_EXCEPTIONS = new Set([
        'ArithmeticError', 'AssertionError', 'AttributeError', 'BaseException',
        'BlockingIOError', 'BrokenPipeError', 'BufferError', 'BytesWarning',
        'ChildProcessError', 'ConnectionAbortedError', 'ConnectionError',
        'ConnectionRefusedError', 'ConnectionResetError', 'DeprecationWarning',
        'EOFError', 'Ellipsis', 'EnvironmentError', 'Exception', 'FileExistsError',
        'FileNotFoundError', 'FloatingPointError', 'FutureWarning', 'GeneratorExit',
        'IOError', 'ImportError', 'ImportWarning', 'IndentationError', 'IndexError',
        'InterruptedError', 'IsADirectoryError', 'KeyError', 'KeyboardInterrupt',
        'LookupError', 'MemoryError', 'ModuleNotFoundError', 'NameError',
        'NotADirectoryError', 'NotImplemented', 'NotImplementedError', 'OSError',
        'OverflowError', 'PendingDeprecationWarning', 'PermissionError',
        'ProcessLookupError', 'RecursionError', 'ReferenceError', 'ResourceWarning',
        'RuntimeError', 'RuntimeWarning', 'StopAsyncIteration', 'StopIteration',
        'SyntaxError', 'SyntaxWarning', 'SystemError', 'SystemExit', 'TabError',
        'TimeoutError', 'TypeError', 'UnboundLocalError', 'UnicodeDecodeError',
        'UnicodeEncodeError', 'UnicodeError', 'UnicodeTranslateError', 'UnicodeWarning',
        'UserWarning', 'ValueError', 'Warning', 'ZeroDivisionError'
    ]);

    public resolveSymbolAtPosition(
        document: vscode.TextDocument,
        position: vscode.Position
    ): SymbolInfo[] {
        const line = document.lineAt(position);
        const text = line.text;
        const wordRange = document.getWordRangeAtPosition(position);
        const word = wordRange ? document.getText(wordRange) : '';
        const results: SymbolInfo[] = [];

        // Get the full line for context
        const lineText = text.trim();

        // Early exit for empty or non-identifier words
        if (!word) {
            return [];
        }

        // Must look like a Python identifier (starts with letter or underscore)
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(word)) {
            return [];
        }

        // Avoid numeric literals
        if (/^[0-9]+(?:\.[0-9]+)?$/.test(word)) {
            return [];
        }

        Logger.getInstance().debug(`Raw line: ${text}`);
        Logger.getInstance().debug(`Cursor position: ${position.character}`);

        // Skip if we're inside a comment
        const commentStart = text.indexOf('#');
        if (commentStart !== -1 && position.character > commentStart) {
            Logger.getInstance().debug(`Inside comment, skipping`);
            return [];
        }

        // CHECK KEYWORDS FIRST (before filtering by length)
        // This ensures short keywords like 'if', 'or', 'as', 'in', 'is' are not skipped
        if (SymbolResolver.PYTHON_KEYWORDS.has(word)) {
            Logger.getInstance().debug(`Detected Python keyword: ${word}`);
            results.push({
                symbol: word,
                type: 'keyword'
            });
            // For keywords, don't continue looking for other interpretations
            return results;
        }

        // CHECK BUILTINS EARLY (before filtering by length)
        // This ensures short builtins are not skipped
        if (SymbolResolver.PYTHON_BUILTINS.has(word)) {
            Logger.getInstance().debug(`Detected Python builtin: ${word}`);
            results.push({
                symbol: word,
                type: 'builtin'
            });
        }

        // CHECK EXCEPTIONS EARLY
        if (SymbolResolver.PYTHON_EXCEPTIONS.has(word)) {
            Logger.getInstance().debug(`Detected Python exception: ${word}`);
            results.push({
                symbol: word,
                type: 'exception'
            });
        }

        // Now apply heuristic filtering for other symbols
        // Skip very short identifiers UNLESS they're already identified above
        if (results.length === 0 && word.length < 2) {
            return [];
        }

        // Skip common English stopwords only if not already identified
        const stopwords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'if', 'else', 'for', 'to', 'of', 'in', 'on', 'with', 'by', 'as', 'is', 'it', 'this', 'that', 'these', 'those']);
        if (results.length === 0 && stopwords.has(word.toLowerCase())) {
            return [];
        }

        // Detect if inside an f-string (simple heuristic: quote before cursor with an 'f' prefix)
        const cursorIndex = position.character;
        const rawLine = text; // preserve original spacing for index calculations
        const lastSingleQuote = rawLine.lastIndexOf("'", cursorIndex - 1);
        const lastDoubleQuote = rawLine.lastIndexOf('"', cursorIndex - 1);
        const quotePos = Math.max(lastSingleQuote, lastDoubleQuote);
        if (quotePos !== -1) {
            const quoteChar = rawLine[quotePos];
            // look back up to 2 chars for prefixes like f, fr, rf
            const prefixStart = Math.max(0, quotePos - 2);
            const prefix = rawLine.slice(prefixStart, quotePos).toLowerCase();
            const hasF = prefix.indexOf('f') !== -1;
            const closingQuote = rawLine.indexOf(quoteChar, cursorIndex);
            if (hasF && closingQuote !== -1) {
                Logger.getInstance().debug(`Detected f-string at position: ${quotePos}`);
                results.push({ symbol: 'f-string', type: 'f-string' });
                return results;
            }
        }

        // Don't resolve inside plain strings (not just f-strings)
        const singleQuoteBefore = rawLine.lastIndexOf("'", position.character - 1);
        const doubleQuoteBefore = rawLine.lastIndexOf('"', position.character - 1);
        const quoteBefore = Math.max(singleQuoteBefore, doubleQuoteBefore);
        if (quoteBefore !== -1) {
            const quoteChar = rawLine[quoteBefore];
            const closingQuote = rawLine.indexOf(quoteChar, position.character);
            if (closingQuote !== -1) {
                // inside a quoted string -> skip
                return [];
            }
        }

        // Detect operators at the cursor by scanning a small window around the position
        const maxOpLen = Math.max(...OPERATORS.map(o => o.length));
        const winStart = Math.max(0, position.character - maxOpLen);
        const winEnd = Math.min(text.length, position.character + maxOpLen);
        const window = text.slice(winStart, winEnd);

        // sort operators by length to match longest first (e.g., '**=')
        const sortedOps = [...OPERATORS].sort((a, b) => b.length - a.length);
        for (const op of sortedOps) {
            let idx = window.indexOf(op);
            while (idx !== -1) {
                const absIdx = winStart + idx;
                if (position.character >= absIdx && position.character < absIdx + op.length) {
                    Logger.getInstance().debug(`Detected operator: ${op} at position: ${absIdx}`);
                    results.push({ symbol: op, type: 'operator' });
                    return results;
                }
                idx = window.indexOf(op, idx + 1);
            }
        }

        // Check if it's a decorator
        if (lineText.startsWith('@') && lineText.includes(word)) {
            results.push({
                symbol: word,
                type: 'decorator'
            });
        }

        // Check if it's a typing construct
        if (word in TYPING_CONSTRUCTS) {
            results.push({
                symbol: word,
                type: 'typing',
                documentation: TYPING_CONSTRUCTS[word]
            });
        }

        // Check if it's a dunder method
        if (word.startsWith('__') && word.endsWith('__')) {
            Logger.getInstance().debug(`Detected potential dunder method: ${word}`);
            results.push({
                symbol: word,
                type: 'method' // Keep as 'method' type - the hover provider will handle it
            });
        }

        // Check for dotted access (method calls)
        const dottedMatch = wordRange ? this.findDottedAccess(text, wordRange) : null;
        if (dottedMatch) {
            Logger.getInstance().debug(`Detected dotted access: ${dottedMatch.fullPath}`);
            results.push({
                symbol: dottedMatch.fullPath,
                type: 'method',
                context: dottedMatch.baseType
            });
        }

        // Check for module imports
        const moduleMatch = this.findModuleContext(document, position, word);
        Logger.getInstance().debug(`findModuleContext for "${word}" returned: ${moduleMatch || 'null'}`);
        if (moduleMatch) {
            Logger.getInstance().debug(`Adding as module: ${moduleMatch}`);
            results.push({
                symbol: moduleMatch,
                type: 'module'
            });
        }

        // Check for std:label class
        if (word === 'std:label') {
            results.push({
                symbol: 'std:label',
                type: 'class',
                documentation: 'A class definition defines a class object (see section The standard type hierarchy):\n\nSource: docs.python.org/3.12/reference/compound_stmts.html'
            });
        }

        // Only return as a generic symbol if it might be a third-party import
        // Check if the word is likely to be an imported symbol (not a local variable)
        if (results.length === 0) {
            // Only treat as potential imported symbol if:
            // 1. It's in an import statement (definitely an import)
            // 2. It's a class-like name (PascalCase) followed by () or . (likely class instantiation/access)
            // 3. It's on the LEFT side of a dot (module/object access like "np.array" or "paths.something")
            const isInImportContext = /\b(import|from)\b/.test(lineText);
            const isLikelyClassName = /^[A-Z]/.test(word);
            const isFollowedByDotOrParen = wordRange && (
                text.charAt(wordRange.end.character) === '(' ||
                text.charAt(wordRange.end.character) === '.'
            );

            // Check if this word is followed by a dot (left side of attribute access)
            const isLeftOfDot = wordRange && text.charAt(wordRange.end.character) === '.';

            // Only proceed if it looks like an imported symbol
            if (isInImportContext || (isLikelyClassName && isFollowedByDotOrParen) || isLeftOfDot) {
                Logger.getInstance().debug(`Word "${word}" might be an imported symbol (import: ${isInImportContext}, class+call: ${isLikelyClassName && isFollowedByDotOrParen}, leftOfDot: ${isLeftOfDot})`);
                results.push({
                    symbol: word,
                    type: 'class'
                });
            } else {
                Logger.getInstance().debug(`Word "${word}" doesn't look like an imported symbol, skipping`);
                return [];
            }
        }

        return results;
    }

    private findDottedAccess(
        text: string,
        wordRange: vscode.Range
    ): { fullPath: string; baseType: string } | null {
        const startChar = wordRange.start.character;

        // Look backwards for dots
        let dotPos = startChar - 1;
        while (dotPos >= 0 && text[dotPos] === ' ') {
            dotPos--;
        }

        if (dotPos >= 0 && text[dotPos] === '.') {
            // Found a dot, now find the base object
            let baseStart = dotPos - 1;
            while (baseStart >= 0 && /[a-zA-Z0-9_]/.test(text[baseStart])) {
                baseStart--;
            }
            baseStart++;

            const baseObject = text.substring(baseStart, dotPos);
            const method = text.substring(wordRange.start.character, wordRange.end.character);

            if (baseObject && method) {
                return {
                    fullPath: `${baseObject}.${method}`,
                    baseType: this.inferBaseType(baseObject)
                };
            }
        }

        return null;
    }

    private inferBaseType(baseObject: string): string {
        // Enhanced heuristics to infer the type of the base object

        // Check for common standard library modules
        const stdlibModules = [
            'os', 'sys', 'math', 'random', 'datetime', 'json', 're', 'pathlib',
            'typing', 'collections', 'itertools', 'functools', 'csv', 'sqlite3',
            'threading', 'multiprocessing', 'subprocess', 'argparse', 'logging',
            'unittest', 'pickle', 'copy', 'time', 'calendar', 'decimal', 'fractions',
            'statistics', 'heapq', 'bisect', 'array', 'enum', 'dataclasses', 'abc',
            'contextlib', 'tempfile', 'shutil', 'glob', 'fnmatch', 'zipfile', 'tarfile',
            'gzip', 'bz2', 'hashlib', 'hmac', 'secrets', 'uuid', 'urllib', 'http',
            'email', 'base64', 'struct', 'codecs', 'io', 'socket', 'ssl', 'asyncio'
        ];

        if (stdlibModules.includes(baseObject)) {
            return baseObject; // Return module name as the type
        }

        // Check for common third-party library aliases
        const libraryAliases: { [key: string]: string } = {
            'np': 'numpy',
            'pd': 'pandas',
            'plt': 'matplotlib',
            'tf': 'tensorflow',
            'torch': 'torch',  // torch is the module name
            'sk': 'sklearn'
        };

        if (baseObject in libraryAliases) {
            return libraryAliases[baseObject];
        }

        // Check if it's a known builtin type
        if (['str', 'list', 'dict', 'set', 'tuple', 'int', 'float', 'bytes', 'bool'].includes(baseObject)) {
            return baseObject;
        }

        // Check common patterns with more comprehensive naming conventions
        if (baseObject.endsWith('_list') || baseObject.includes('list') ||
            baseObject.endsWith('List') || (baseObject.endsWith('s') && !baseObject.endsWith('ss') &&
                !baseObject.endsWith('us') && !baseObject.endsWith('is'))) {
            return 'list';
        }
        if (baseObject.endsWith('_dict') || baseObject.includes('dict') ||
            baseObject.endsWith('Dict') || baseObject.endsWith('Map') ||
            baseObject.includes('mapping') || baseObject.includes('config')) {
            return 'dict';
        }
        if (baseObject.endsWith('_str') || baseObject.includes('string') ||
            baseObject.endsWith('String') || baseObject.endsWith('name') ||
            baseObject.endsWith('text') || baseObject.endsWith('message')) {
            return 'str';
        }
        if (baseObject.endsWith('_set') || baseObject.includes('set') || baseObject.endsWith('Set')) {
            return 'set';
        }
        if (baseObject.endsWith('_int') || baseObject.includes('int') || baseObject.endsWith('Int') ||
            baseObject.includes('count') || baseObject.includes('index') ||
            baseObject.endsWith('_id') || baseObject.endsWith('Id')) {
            return 'int';
        }
        if (baseObject.endsWith('_float') || baseObject.includes('float') || baseObject.endsWith('Float') ||
            baseObject.includes('price') || baseObject.includes('rate') ||
            baseObject.includes('value') || baseObject.includes('amount')) {
            return 'float';
        }

        // Default to object (which will resolve to general methods)
        return 'object';
    }

    private findModuleContext(
        document: vscode.TextDocument,
        _position: vscode.Position,
        word: string
    ): string | null {
        // Look for import statements in the document to see if this word is a module
        const text = document.getText();
        const lines = text.split('\n');

        for (const line of lines) {
            // Check for "from module import ..."
            const fromImportMatch = line.match(/^from\s+(\S+)\s+import\s+(.+)$/);
            if (fromImportMatch) {
                const moduleName = fromImportMatch[1];

                // Check if we're hovering over the module name itself (e.g., 'jupyter_client' in 'from jupyter_client import ...')
                if (word === moduleName || moduleName.endsWith('.' + word)) {
                    Logger.getInstance().debug(`Detected module name in from statement: ${moduleName}`);
                    return moduleName;
                }

                // Otherwise, skip - don't treat "Y" in "from X import Y" as a module
                // Let the hover provider handle it with the import tracking
                continue;
            }

            // Check for "import module as alias"
            const aliasMatch = line.match(/^import\s+(\S+)(?:\s+as\s+(\S+))?$/);
            if (aliasMatch) {
                const moduleName = aliasMatch[1];
                const alias = aliasMatch[2];

                if ((alias && alias === word) || (!alias && moduleName.split('.').pop() === word)) {
                    return moduleName;
                }
            }
        }

        return null;
    }
}
