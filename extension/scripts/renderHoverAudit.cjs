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
});

// ── Third-party with long signature ───────────────────────────────────────
printSample('Third-party method (Sphinx source chip)', {
    title: 'FastAPI.get',
    kind: 'method',
    signature: '(self, path: str) -> Callable[..., Any]',
    summary: 'Add a path operation using HTTP GET.',
    url: 'https://fastapi.tiangolo.com/reference/fastapi/#fastapi.FastAPI.get',
    devdocsUrl: 'https://devdocs.io/fastapi/',
    source: ResolutionSource.Sphinx,
    module: 'fastapi',
});

// ── Local user symbol ─────────────────────────────────────────────────────
printSample('Local code (local chip + go to def)', {
    title: 'myproject.services.fetch_user',
    kind: 'function',
    signature: 'async def fetch_user(user_id: int) -> User',
    summary: 'Load a user from the database by primary key.',
    source: ResolutionSource.Local,
    sourceUrl: '/home/user/proj/services.py',
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
    source: ResolutionSource.Sphinx,
    module: 'pandas',
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
