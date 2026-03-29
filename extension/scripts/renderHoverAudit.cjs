'use strict';

/**
 * Headless preview of what users see in hovers (MarkdownString value).
 * Run from extension/:  node scripts/renderHoverAudit.cjs
 */

const Module = require('module');
const path = require('path');
const origResolve = Module._resolveFilename;
const stubPath = path.join(__dirname, 'vscode-stub.cjs');
Module._resolveFilename = function (request, parent, isMain) {
    if (request === 'vscode') {
        return stubPath;
    }
    return origResolve.call(this, request, parent, isMain);
};

const { HoverRenderer } = require('../out/extension/src/ui/hoverRenderer');
const { ResolutionSource } = require('../out/shared/types');

/** Minimal Config shape used by HoverRenderer */
const baseConfig = {
    showSignatures: true,
    showReturnTypes: true,
    showPracticalExamples: true,
    showBadges: true,
    showMetadataChips: true,
    showProvenance: true,
    showToolbar: true,
    showCallouts: true,
    showParameters: true,
    maxParameters: 6,
    showSeeAlso: true,
    showRaises: true,
    showModuleExports: true,
    showModuleStats: true,
    showFooter: true,
    showImportHints: true,
    showUpdateWarning: true,
    compactMode: false,
    maxExamples: 2,
    maxModuleExports: 20,
    maxSeeAlsoItems: 8,
    maxSnippetLines: 12,
    maxContentLength: 800,
    docsBrowser: 'integrated',
    devdocsBrowser: 'external',
    showDebugPinButton: false,
    docsVersion: '3.12',
};

function printSample(title, doc) {
    const renderer = new HoverRenderer(baseConfig);
    renderer.setDetectedVersion('3.11');
    const hover = renderer.render(doc);
    const md = hover.contents;
    const text = typeof md === 'string' ? md : md.value;
    console.log('\n' + '='.repeat(72));
    console.log('SAMPLE: ' + title);
    console.log('='.repeat(72));
    console.log(text);
    console.log('-'.repeat(72));
    console.log('(Theme icons like $(book) render as icons in VS Code; here they are raw.)');
}

// ── Library symbol (stdlib-style) ─────────────────────────────────────────
printSample('Stdlib-style API (corpus + URL)', {
    title: 'str.upper',
    kind: 'method',
    // Raw Pylance-style line — renderer must strip (method) and avoid double prefix
    signature: '(method) str.upper() -> str',
    summary: 'Return a copy of the string with all cased characters converted to uppercase.',
    parameters: [
        { name: 'self', description: 'implicit string instance' },
    ],
    returns: { type: 'str', description: 'uppercased copy' },
    url: 'https://docs.python.org/3/library/stdtypes.html#str.upper',
    devdocsUrl: 'https://devdocs.io/python~3.11/library/stdtypes/#str.upper',
    source: ResolutionSource.Corpus,
    badges: [{ label: 'stdlib', color: 'blue' }],
    module: 'builtins',
    metadata: { docsProvider: 'sphinx' },
});

// ── Third-party with long signature ───────────────────────────────────────
printSample('Third-party method (corpus source chip)', {
    title: 'FastAPI.get',
    kind: 'method',
    signature: '(self, path: str) -> Callable[..., Any]',
    summary: 'Add a path operation using HTTP GET.',
    url: 'https://fastapi.tiangolo.com/reference/fastapi/#fastapi.FastAPI.get',
    devdocsUrl: 'https://devdocs.io/fastapi/',
    source: ResolutionSource.Corpus,
    module: 'fastapi',
    metadata: { docsProvider: 'mkdocs' },
});

printSample('Inventory-backed symbol provenance (Click)', {
    title: 'click.File',
    kind: 'class',
    signature: 'class click.File(mode: str = "r", encoding: str | None = None)',
    summary: 'Declares a parameter that opens a file and converts it into a readable or writable stream.',
    url: 'https://click.palletsprojects.com/en/stable/api/#click.File',
    source: ResolutionSource.Corpus,
    module: 'click',
    metadata: { docsProvider: 'sphinx' },
});

printSample('Method provenance (FastAPI.middleware)', {
    title: 'FastAPI.middleware',
    kind: 'method',
    signature: '(self, middleware_type: str) -> Callable[[DecoratedCallable], DecoratedCallable]',
    summary: 'Add a function as a middleware handler for requests.',
    url: 'https://fastapi.tiangolo.com/reference/fastapi/#fastapi.FastAPI.middleware',
    source: ResolutionSource.Corpus,
    module: 'fastapi',
    metadata: { docsProvider: 'mkdocs' },
});

// ── Local user symbol ─────────────────────────────────────────────────────
printSample('Local code (local chip + go to def)', {
    title: 'myproject.services.fetch_user',
    kind: 'function',
    signature: 'async def fetch_user(user_id: int) -> User',
    summary: 'Load a user from the database by primary key.',
    source: ResolutionSource.Local,
});

// ── Import / module overview ─────────────────────────────────────────────
printSample('Import line module card', {
    title: 'pandas',
    kind: 'module',
    summary: 'Powerful data structures for data analysis, time series, and statistics.',
    moduleExports: ['DataFrame', 'Series', 'read_csv', 'read_json', 'merge', 'concat'],
    exportCount: 1842,
    installedVersion: '2.2.0',
    url: 'https://pandas.pydata.org/docs/index.html',
    devdocsUrl: 'https://devdocs.io/pandas~2/',
    source: ResolutionSource.Corpus,
    module: 'pandas',
    license: 'BSD-3-Clause',
    requiresPython: '>=3.9',
    metadata: { docsProvider: 'sphinx' },
});

printSample('Structured docs dedupe', {
    title: 'demo.parse',
    kind: 'function',
    signature: 'parse(value: str, *, strict: bool = True) -> Result',
    summary: 'Parse a raw value into a structured result.',
    parameters: [
        { name: 'value', type: 'str', description: 'Raw incoming value.' },
        { name: 'strict', type: 'bool', description: 'Raise on invalid input.' },
    ],
    returns: { type: 'Result', description: 'Structured parse result.' },
    structuredContent: {
        sections: [
            { kind: 'paragraph', role: 'summary', title: 'Overview', content: 'Parse a raw value into a structured result.' },
            { kind: 'paragraph', title: 'Description', content: 'Use this helper when you want validated parsing with a predictable error surface.' },
            { kind: 'list', title: 'Parameters', content: '', items: ['value: Raw incoming value.', 'strict: Raise on invalid input.'] },
            { kind: 'paragraph', title: 'Returns', content: 'Structured parse result.' },
            { kind: 'paragraph', title: 'Description', content: 'Use this helper when you want validated parsing with a predictable error surface.' },
        ],
    },
    source: ResolutionSource.Static,
    url: 'https://example.com/docs/parse',
});

// ── Keyword-style body (renderer uses keyword branch when kind=keyword) ───
printSample('Keyword `for` (pydoc-like blob)', {
    title: 'for',
    kind: 'keyword',
    content:
        'The "for" statement\n\n' +
        'for_stmt ::=  "for" target_list "in" expression_list ":" suite\n' +
        '              ["else" ":" suite]\n\n' +
        'The for statement repeats execution of a suite for each item in a sequence.\n\n' +
        'See also: while break continue\n',
    url: 'https://docs.python.org/3/reference/compound_stmts.html#the-for-statement',
    source: ResolutionSource.Static,
});

const longBody = ('One two three four five. '.repeat(50)).trim();
printSample('Truncated description shows “Continue reading” link', {
    title: 'demo.long_doc',
    kind: 'function',
    summary: longBody,
    url: 'https://docs.python.org/3/library/functions.html#print',
    source: ResolutionSource.Static,
});

console.log('\nDone. Compare with live editor: icons render; command: links work in VS Code only.\n');
