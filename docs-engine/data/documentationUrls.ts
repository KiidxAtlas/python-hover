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

export const MAP: Record<string, Info> = {
    ...COMPOUND,
    ...SIMPLE,
    ...EXPRESSIONS,
    ...CONSTANTS,
};
