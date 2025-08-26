"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SymbolResolver = void 0;
const documentationUrls_1 = require("./documentationUrls");
class SymbolResolver {
    resolveSymbolAtPosition(document, position) {
        const line = document.lineAt(position);
        const text = line.text;
        const wordRange = document.getWordRangeAtPosition(position);
        const word = wordRange ? document.getText(wordRange) : '';
        const results = [];
        // Get the full line for context
        const lineText = text.trim();
        // Quick heuristics to avoid running resolution for irrelevant hovers
        //  - empty or very short identifiers (single-letter loop vars)
        //  - numeric literals
        //  - not an identifier (contains punctuation)
        // We'll still allow Python keywords/builtins/exceptions later.
        if (!word || word.length < 2) {
            return [];
        }
        // Avoid numeric literals
        if (/^[0-9]+(?:\.[0-9]+)?$/.test(word)) {
            return [];
        }
        // Must look like a Python identifier (starts with letter or underscore)
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(word)) {
            return [];
        }
        console.log(`[SymbolResolver] Raw line: ${text}`);
        console.log(`[SymbolResolver] Cursor position: ${position.character}`);
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
                console.log(`[SymbolResolver] Detected f-string at position: ${quotePos}`);
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
        const maxOpLen = Math.max(...documentationUrls_1.OPERATORS.map(o => o.length));
        const winStart = Math.max(0, position.character - maxOpLen);
        const winEnd = Math.min(text.length, position.character + maxOpLen);
        const window = text.slice(winStart, winEnd);
        // sort operators by length to match longest first (e.g., '**=')
        const sortedOps = [...documentationUrls_1.OPERATORS].sort((a, b) => b.length - a.length);
        for (const op of sortedOps) {
            let idx = window.indexOf(op);
            while (idx !== -1) {
                const absIdx = winStart + idx;
                if (position.character >= absIdx && position.character < absIdx + op.length) {
                    console.log(`[SymbolResolver] Detected operator: ${op} at position: ${absIdx}`);
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
        // If this word is a very common English stopword (and we haven't matched it as a Python keyword/builtin/exception), skip further resolution.
        const stopwords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'if', 'else', 'for', 'to', 'of', 'in', 'on', 'with', 'by', 'as', 'is', 'it', 'this', 'that', 'these', 'those']);
        // Check if it's a keyword
        if (SymbolResolver.PYTHON_KEYWORDS.has(word)) {
            results.push({
                symbol: word,
                type: 'keyword'
            });
            // For keywords, don't continue looking for other interpretations
            return results;
        }
        // Early stop: common stopwords should not trigger documentation lookups
        if (stopwords.has(word.toLowerCase())) {
            return [];
        }
        // Check if it's a builtin
        if (SymbolResolver.PYTHON_BUILTINS.has(word)) {
            results.push({
                symbol: word,
                type: 'builtin'
            });
        }
        // Check if it's an exception
        if (SymbolResolver.PYTHON_EXCEPTIONS.has(word)) {
            results.push({
                symbol: word,
                type: 'exception'
            });
        }
        // Check for dotted access (method calls)
        const dottedMatch = wordRange ? this.findDottedAccess(text, wordRange) : null;
        if (dottedMatch) {
            results.push({
                symbol: dottedMatch.fullPath,
                type: 'method',
                context: dottedMatch.baseType
            });
        }
        // Check for module imports
        const moduleMatch = this.findModuleContext(document, position, word);
        if (moduleMatch) {
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
        // If no specific type found, return nothing — avoid querying docs for arbitrary words
        if (results.length === 0) {
            return [];
        }
        return results;
    }
    findDottedAccess(text, wordRange) {
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
    inferBaseType(baseObject) {
        // Simple heuristics to infer the type of the base object
        // This could be enhanced with more sophisticated analysis
        // Check if it's a known builtin type
        if (['str', 'list', 'dict', 'set', 'tuple', 'int', 'float', 'bytes'].includes(baseObject)) {
            return baseObject;
        }
        // Check common patterns
        if (baseObject.endsWith('_list') || baseObject.includes('list')) {
            return 'list';
        }
        if (baseObject.endsWith('_dict') || baseObject.includes('dict')) {
            return 'dict';
        }
        if (baseObject.endsWith('_str') || baseObject.includes('string')) {
            return 'str';
        }
        // Default to object (which will resolve to general methods)
        return 'object';
    }
    findModuleContext(document, position, word) {
        // Look for import statements in the document to see if this word is a module
        const text = document.getText();
        const lines = text.split('\n');
        for (const line of lines) {
            // Check for "import module" or "from module import ..."
            const importMatch = line.match(/^(?:from\s+(\S+)\s+)?import\s+(.+)$/);
            if (importMatch) {
                const fromModule = importMatch[1];
                const importedItems = importMatch[2];
                if (importedItems.includes(word)) {
                    return fromModule ? `${fromModule}.${word}` : word;
                }
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
exports.SymbolResolver = SymbolResolver;
SymbolResolver.PYTHON_KEYWORDS = new Set([
    'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break',
    'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally',
    'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal',
    'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield'
]);
SymbolResolver.PYTHON_BUILTINS = new Set([
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
SymbolResolver.PYTHON_EXCEPTIONS = new Set([
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
//# sourceMappingURL=symbolResolver.js.map