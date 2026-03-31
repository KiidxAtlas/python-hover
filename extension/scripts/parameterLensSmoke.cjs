'use strict';

const assert = require('assert');
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

const { extractActiveCallExpression } = require('../out/extension/src/parameterLens');
const { HoverParameterLensService } = require('../out/extension/src/hoverParameterLensService');
const { buildImportStatement, getVisibleStructuredDescriptionSections } = require('../out/extension/src/ui/docPresentation');
const { cleanContent } = require('../out/extension/src/ui/contentCleaner');
const { HoverRenderer } = require('../out/extension/src/ui/hoverRenderer');
const { ResolutionSource } = require('../out/shared/types');

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
    maxParameters: 8,
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
    maxContentLength: 1200,
    docsBrowser: 'integrated',
    devdocsBrowser: 'external',
    showDebugPinButton: false,
    docsVersion: '3.12',
};

function createDocument(lines) {
    return {
        lineAt(line) {
            return { text: lines[line] };
        },
    };
}

function runActiveCallExpressionTests() {
    const doc = createDocument([
        'with open(__file__, "r", encoding="utf-8") as handle:',
        'arr = np.array([1, 2, 3])',
        'grouped = df.groupby("a")',
        'value = outer(inner(x), flag=True)',
        'joined = os.path.join("a", "b", "c")',
        'renamed = df.rename(columns={"a": "value"})',
        'result = factory().build(name="atlas")',
    ]);

    assert.strictEqual(
        extractActiveCallExpression(doc, { line: 0, character: 34 }),
        'open',
        'expected encoding argument hover to resolve active call as open',
    );
    assert.strictEqual(
        extractActiveCallExpression(doc, { line: 1, character: 18 }),
        'np.array',
        'expected list literal inside np.array to resolve callable context',
    );
    assert.strictEqual(
        extractActiveCallExpression(doc, { line: 2, character: 22 }),
        'df.groupby',
        'expected groupby argument hover to resolve method context',
    );
    assert.strictEqual(
        extractActiveCallExpression(doc, { line: 3, character: 20 }),
        'inner',
        'expected nested positional argument to resolve innermost call',
    );
    assert.strictEqual(
        extractActiveCallExpression(doc, { line: 3, character: 30 }),
        'outer',
        'expected keyword argument to resolve outer call',
    );
    assert.strictEqual(
        extractActiveCallExpression(doc, { line: 4, character: 31 }),
        'os.path.join',
        'expected stdlib dotted call to resolve the full callable expression',
    );
    assert.strictEqual(
        extractActiveCallExpression(doc, { line: 5, character: 29 }),
        'df.rename',
        'expected keyword dict argument to resolve the surrounding method call',
    );
    assert.strictEqual(
        extractActiveCallExpression(doc, { line: 6, character: 30 }),
        'build',
        'expected chained call with immediate invocation to resolve the invoked member name',
    );
}

function runPresentationTests() {
    assert.strictEqual(
        buildImportStatement({
            title: 'pandas.DataFrame.groupby',
            kind: 'function',
            module: 'pandas.DataFrame',
            source: ResolutionSource.Corpus,
        }),
        'from pandas import DataFrame',
        'expected DataFrame member import hint to import the owner class',
    );

    assert.strictEqual(
        buildImportStatement({
            title: 'numpy.array',
            kind: 'function',
            module: 'numpy',
            source: ResolutionSource.Corpus,
        }),
        'from numpy import array',
        'expected top-level function import hint to import the callable',
    );

    assert.strictEqual(
        buildImportStatement({
            title: 'FastAPI.get',
            kind: 'method',
            module: 'fastapi',
            source: ResolutionSource.Corpus,
        }),
        'from fastapi import FastAPI',
        'expected top-level class member import hint to import the owner class',
    );

    assert.strictEqual(
        buildImportStatement({
            title: 'open',
            kind: 'function',
            module: 'builtins',
            source: ResolutionSource.Corpus,
        }),
        undefined,
        'expected builtin function hovers to omit invalid import hints',
    );

    assert.strictEqual(
        buildImportStatement({
            title: 'pandas',
            kind: 'module',
            module: 'pandas',
            source: ResolutionSource.Corpus,
        }),
        'import pandas',
        'expected module hovers to preserve import module hints',
    );

    const visibleSections = getVisibleStructuredDescriptionSections({
        title: 'pandas.DataFrame.groupby',
        kind: 'function',
        module: 'pandas.DataFrame',
        source: ResolutionSource.Corpus,
        parameters: [
            { name: 'by', type: 'mapping, function, label, pd.Grouper or list of such', description: 'Used to determine the groups.' },
        ],
        structuredContent: {
            sections: [
                { kind: 'paragraph', role: 'summary', title: 'Overview', content: 'Group DataFrame using a mapper or by a Series of columns.' },
                { kind: 'paragraph', content: 'by: Used to determine the groups for the groupby.' },
                { kind: 'paragraph', content: 'Additional details about split-apply-combine.' },
            ],
        },
    });

    assert.strictEqual(visibleSections.length, 2, 'expected parameter-like prose to be removed from overview sections');
    assert.ok(
        visibleSections.every(section => !/^by:/i.test(section.content ?? '')),
        'expected parameter-like overview paragraph to be filtered',
    );

    const titledSections = getVisibleStructuredDescriptionSections({
        title: 'open',
        kind: 'function',
        module: 'builtins',
        source: ResolutionSource.Corpus,
        parameters: [
            { name: 'encoding', type: 'str | None', description: 'Encoding used to decode or encode the file.' },
        ],
        structuredContent: {
            sections: [
                { kind: 'paragraph', role: 'summary', title: 'Overview', content: 'Open file and return a corresponding file object.' },
                { kind: 'paragraph', title: 'Parameters', content: 'encoding: Encoding used to decode or encode the file.' },
                { kind: 'paragraph', title: 'Notes', content: 'This function returns a file object.' },
            ],
        },
    });

    assert.deepStrictEqual(
        titledSections.map(section => section.title || ''),
        ['Overview', 'Notes'],
        'expected titled parameter sections to be filtered while preserving later prose sections',
    );
}

function runRendererSmokeTest() {
    const renderer = new HoverRenderer(baseConfig);
    renderer.setDetectedVersion('3.11');
    const hover = renderer.render({
        title: 'open',
        kind: 'function',
        module: 'builtins',
        source: ResolutionSource.Corpus,
        signature: 'open(file: FileDescriptorOrPath, mode: OpenTextMode = "r", buffering: int = -1, encoding: str | None = None, errors: str | None = None, newline: str | None = None, closefd: bool = True, opener: _Opener | None = None) -> TextIOWrapper[_WrappedBuffer]',
        summary: 'Open file and return a corresponding file object.',
        url: 'https://docs.python.org/3/library/functions.html#open',
        devdocsUrl: 'https://devdocs.io/python~3.11/functions#open',
        parameters: [
            { name: 'file', type: 'FileDescriptorOrPath' },
            { name: 'mode', type: 'OpenTextMode', default: '"r"' },
            { name: 'buffering', type: 'int', default: '-1' },
            { name: 'encoding', type: 'str | None', default: 'None' },
        ],
        parameterLens: {
            callable: 'open',
            signature: 'open(file: FileDescriptorOrPath, mode: OpenTextMode = "r", buffering: int = -1, encoding: str | None = None, errors: str | None = None, newline: str | None = None, closefd: bool = True, opener: _Opener | None = None) -> TextIOWrapper[_WrappedBuffer]',
            parameterLabel: 'encoding',
            parameter: { name: 'encoding', type: 'str | None', default: 'None', description: 'Encoding used to decode or encode the file.' },
            parameterIndex: 3,
            parameterCount: 8,
            source: 'merged',
        },
    });

    const markdown = typeof hover.contents === 'string' ? hover.contents : hover.contents.value;
    assert.ok(markdown.includes('Active parameter'), 'expected inline hover to render the active parameter section');
    assert.ok(markdown.includes('Current argument'), 'expected parameter table to highlight the focused parameter');
    assert.ok(!markdown.includes('Import:'), 'expected builtin function hover to omit invalid import hint');
    assert.strictEqual(
        markdown.split('open(file: FileDescriptorOrPath').length - 1,
        1,
        'expected the callable signature to appear once instead of duplicating in the inline hover',
    );
    assert.ok(!markdown.includes('implicit string instance'), 'expected unrelated receiver hints to stay out of function hovers');

    const methodHover = renderer.render({
        title: 'str.upper',
        kind: 'method',
        module: 'builtins',
        source: ResolutionSource.Corpus,
        signature: 'str.upper() -> str',
        summary: 'Return a copy of the string with all cased characters converted to uppercase.',
        url: 'https://docs.python.org/3/library/stdtypes.html#str.upper',
        parameters: [
            { name: 'self', description: 'implicit string instance' },
        ],
        returns: {
            type: 'str',
            description: 'uppercased copy',
        },
    });

    const methodMarkdown = typeof methodHover.contents === 'string' ? methodHover.contents : methodHover.contents.value;
    assert.ok(!methodMarkdown.includes('implicit string instance'), 'expected implicit self/cls receiver parameters to stay out of displayed parameter tables');

    const groupbyHover = renderer.render({
        title: 'pandas.DataFrame.groupby',
        kind: 'function',
        module: 'pandas.DataFrame',
        source: ResolutionSource.Corpus,
        signature: 'pandas.DataFrame.groupby(by: Scalar, level: IndexLabel | None = None, *, as_index: Literal[True] = True) -> DataFrameGroupBy[Scalar, Literal[True]]',
        summary: 'Group DataFrame using a mapper or by a Series of columns.',
        url: 'https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.groupby.html',
        parameters: [
            { name: 'by', type: 'mapping, function, label, pd.Grouper or list of such', description: 'Used to determine the groups.' },
            { name: 'level', type: 'int, level name, or sequence of such, default None', description: 'Group by a particular level.' },
        ],
        parameterLens: {
            callable: 'df.groupby',
            signature: 'pandas.DataFrame.groupby(by: Scalar, level: IndexLabel | None = None, *, as_index: Literal[True] = True) -> DataFrameGroupBy[Scalar, Literal[True]]',
            parameterLabel: 'by',
            parameter: { name: 'by', type: 'mapping, function, label, pd.Grouper or list of such', description: 'Used to determine the groups.' },
            parameterIndex: 0,
            parameterCount: 4,
            source: 'merged',
        },
    });

    const groupbyMarkdown = typeof groupbyHover.contents === 'string' ? groupbyHover.contents : groupbyHover.contents.value;
    assert.ok(
        groupbyMarkdown.includes('from pandas import DataFrame'),
        'expected member call hovers to suggest importing the owner class instead of an invalid member import',
    );
}

function runModuleBoilerplateSmokeTest() {
    const renderer = new HoverRenderer(baseConfig);
    const noisyModuleBody = [
        'pandas is a fast, powerful, flexible and easy to use open source data analysis and manipulation tool.',
        'Copyright (c) 2008-2011, AQR Capital Management, LLC, Lambda Foundry, Inc. and PyData Development Team',
        'All rights reserved.',
        'Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:',
        'Download documentation: Zipped HTML',
        'Previous versions: Documentation of previous pandas versions is available at pandas.pydata.org.',
    ].join('\n\n');

    const cleaned = cleanContent(noisyModuleBody);
    assert.strictEqual(
        cleaned,
        'pandas is a fast, powerful, flexible and easy to use open source data analysis and manipulation tool.',
        'expected shared content cleaning to drop license and docs-site boilerplate from module overviews',
    );

    const hover = renderer.render({
        title: 'pandas',
        kind: 'module',
        summary: 'pandas is a fast, powerful, flexible and easy to use open source data analysis and manipulation tool.',
        content: noisyModuleBody,
        structuredContent: {
            sections: [
                { kind: 'paragraph', role: 'summary', title: 'Overview', content: 'pandas is a fast, powerful, flexible and easy to use open source data analysis and manipulation tool.' },
                { kind: 'paragraph', role: 'description', content: 'Copyright (c) 2008-2011, AQR Capital Management, LLC, Lambda Foundry, Inc. and PyData Development Team\n\nAll rights reserved.\n\nRedistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:' },
                { kind: 'paragraph', role: 'description', content: 'Download documentation: Zipped HTML' },
            ],
        },
        moduleExports: ['DataFrame', 'Series'],
        exportCount: 2218,
        latestVersion: '3.0.1',
        url: 'https://pandas.pydata.org/docs/index.html',
        source: ResolutionSource.Corpus,
        module: 'pandas',
        license: 'BSD 3-Clause License',
        requiresPython: '>=3.11',
    });

    const markdown = typeof hover.contents === 'string' ? hover.contents : hover.contents.value;
    assert.ok(markdown.includes('pandas is a fast, powerful, flexible and easy to use open source data analysis and manipulation tool.'), 'expected module overview summary to remain visible');
    assert.ok(!markdown.includes('Redistribution and use in source and binary forms'), 'expected module hover to suppress legal boilerplate');
    assert.ok(!markdown.includes('Download documentation: Zipped HTML'), 'expected module hover to suppress docs-site chrome lines');
}

function runSeeAlsoLinkSmokeTest() {
    const renderer = new HoverRenderer(baseConfig);

    const keywordHover = renderer.render({
        title: 'for',
        kind: 'keyword',
        summary: 'The for statement repeats execution of a suite for each item in a sequence.',
        content: [
            'for_stmt ::= "for" target_list "in" expression_list ":" suite',
            '',
            'The for statement repeats execution of a suite for each item in a sequence.',
            '',
            'See also: while, break',
            'Related help topics: continue',
            'PEP 234',
        ].join('\n'),
        url: 'https://docs.python.org/3/reference/compound_stmts.html#the-for-statement',
        source: ResolutionSource.Static,
    });

    const markdown = typeof keywordHover.contents === 'string' ? keywordHover.contents : keywordHover.contents.value;
    assert.ok(
        markdown.includes('python-hover.pinDocReference'),
        'expected inline see-also references to become actionable related-reference links',
    );
}

async function runPromotedCallableSmokeTest() {
    const renderer = new HoverRenderer(baseConfig);
    let capturedKey;

    const service = new HoverParameterLensService(
        renderer,
        {
            resolve(key) {
                capturedKey = key;
                return Promise.resolve({ ok: true });
            },
        },
        {
            build(symbolInfo) {
                return {
                    title: symbolInfo.name,
                    kind: 'function',
                    module: symbolInfo.module,
                    source: ResolutionSource.Corpus,
                    confidence: 1,
                };
            },
        },
        {
            rememberCommandDoc(doc) {
                return doc;
            },
            getExactDocByCommandToken() {
                return null;
            },
        },
        {
            resolveAliasForDocument() {
                return 'os.path.join';
            },
        },
    );

    const doc = await service.buildPromotedCallableDoc(
        {},
        '',
        {
            callable: 'join',
            signature: 'os.path.join(path: str, *paths: str) -> str',
            parameterLabel: 'path',
            parameter: { name: 'path', type: 'str' },
            parameterIndex: 0,
            parameterCount: 2,
            source: 'signatureHelp',
        },
        'smoke-token',
    );

    assert.ok(doc, 'expected promoted callable smoke test to build a hover doc');
    assert.strictEqual(doc.module, 'os.path', 'expected stdlib module callables to keep their module context during promotion');
    assert.strictEqual(capturedKey.module, 'os.path', 'expected promoted stdlib module callables to resolve against the stdlib module, not builtins');
    assert.strictEqual(capturedKey.qualname, 'join', 'expected promoted stdlib module callables to keep the member qualname');
}

(async function main() {
    runActiveCallExpressionTests();
    runPresentationTests();
    runRendererSmokeTest();
    runModuleBoilerplateSmokeTest();
    runSeeAlsoLinkSmokeTest();
    await runPromotedCallableSmokeTest();
    console.log('parameterLensSmoke: all checks passed');
}().catch(error => {
    console.error(error);
    process.exitCode = 1;
}));
