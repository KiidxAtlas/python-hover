import { cleanContent, cleanSignature } from '../../extension/src/ui/contentCleaner';
import { HoverDoc, ResolutionSource, SymbolInfo } from '../../shared/types';
import { HoverDocBuilder } from '../src/builder/hoverDocBuilder';
import { DocstringParser } from '../src/parsing/docstringParser';

interface InspectCase {
    label: string;
    symbolInfo: SymbolInfo;
    docs?: HoverDoc | null;
}

function printBlock(title: string, value: unknown): void {
    const text = typeof value === 'string'
        ? value
        : JSON.stringify(value, null, 2);

    console.log(`\n=== ${title} ===`);
    console.log(text || '<empty>');
}

function legacyBuild(symbolInfo: SymbolInfo, docs: HoverDoc | null): Partial<HoverDoc> {
    const parser = new DocstringParser();
    const parsedDocstring = parser.parse(symbolInfo.docstring || '');

    let legacyContent = docs?.content;
    if (legacyContent && ['Documentation for', 'Documentation from', 'No documentation found.', 'Documentation lookup failed.']
        .some(p => legacyContent!.startsWith(p) || legacyContent === p)) {
        legacyContent = undefined;
    }

    let content = docs?.content;
    if (content && ['Documentation for', 'Documentation from', 'No documentation found.', 'Documentation lookup failed.']
        .some(p => content!.startsWith(p) || content === p)) {
        content = undefined;
    }
    if (content) {
        const isShort = content.length < 100;
        const docstring = symbolInfo.docstring || '';
        if (isShort && docstring.length > content.length * 1.5) {
            content = undefined;
        }
    }

    let summary: string | undefined;
    if (content) {
        summary = content;
    } else if (symbolInfo.kind === 'keyword') {
        summary = symbolInfo.docstring || undefined;
    } else if (parsedDocstring.summary) {
        summary = parsedDocstring.summary;
    } else if (symbolInfo.docstring) {
        summary = symbolInfo.docstring;
    }

    const badges: string[] = [];
    const doc = (symbolInfo.docstring || '').toLowerCase();
    const sig = symbolInfo.signature || '';
    if (symbolInfo.isStdlib) badges.push('stdlib');
    if (doc.includes('.. deprecated::') || /\bdeprecated\b/.test(doc)) badges.push('deprecated');
    if (sig.startsWith('async def') || sig.startsWith('async ')) badges.push('async');
    if (/[-:]\s*(Generator|Iterator|Iterable|AsyncGenerator|AsyncIterator)\b/.test(sig)) badges.push('generator');

    return {
        title: symbolInfo.qualname || symbolInfo.name,
        kind: symbolInfo.kind,
        module: symbolInfo.module || docs?.module,
        source: docs?.source || ResolutionSource.Runtime,
        signature: symbolInfo.signature,
        summary,
        badges: badges.map(label => ({ label })),
        content: legacyContent,
    };
}

function inspectCase(builder: HoverDocBuilder, testCase: InspectCase): void {
    const legacy = legacyBuild(testCase.symbolInfo, testCase.docs ?? null);
    const built = builder.build(testCase.symbolInfo, testCase.docs ?? null);
    const rawDocstring = testCase.symbolInfo.docstring || '';
    const rawSignature = testCase.symbolInfo.signature || '';
    const rawSummary = built.summary || built.content || '';

    console.log(`\n\n##### ${testCase.label} #####`);
    printBlock('Raw Signature', rawSignature);
    printBlock('Cleaned Signature', rawSignature ? cleanSignature(rawSignature) : '');
    printBlock('Raw Docstring', rawDocstring);
    printBlock('Legacy Summary', legacy.summary || legacy.content || '');
    printBlock('Built Summary', rawSummary);
    printBlock('Legacy Cleaned Summary', legacy.summary || legacy.content ? cleanContent((legacy.summary || legacy.content) as string) : '');
    printBlock('Cleaned Summary', rawSummary ? cleanContent(rawSummary) : '');
    printBlock('Legacy Badges', legacy.badges?.map(b => b.label) ?? []);
    printBlock('Badges', built.badges?.map(b => b.label) ?? []);
    printBlock('Notes', built.notes ?? []);
    printBlock('Legacy HoverDoc', {
        title: legacy.title,
        kind: legacy.kind,
        module: legacy.module,
        source: legacy.source,
        signature: legacy.signature,
        summary: legacy.summary,
        badges: legacy.badges,
    });
    printBlock('Built HoverDoc', {
        title: built.title,
        kind: built.kind,
        module: built.module,
        source: built.source,
        signature: built.signature,
        summary: built.summary,
        badges: built.badges,
    });
}

function main(): void {
    const builder = new HoverDocBuilder();

    const cases: InspectCase[] = [
        {
            label: 'FastAPI constructor should not be deprecated',
            symbolInfo: {
                name: 'fastapi.FastAPI',
                qualname: 'fastapi.applications.FastAPI',
                module: 'fastapi.applications',
                kind: 'class',
                signature: 'class FastAPI(*, middleware: Sequence[Middleware] | None = None, deprecated: bool | None = None, **extra: Any)',
                docstring: [
                    'Initializes the application.',
                    '',
                    'Parameters:',
                    '    middleware: A list of middleware to run for every request.',
                    '    deprecated: Mark all path operations as deprecated.',
                ].join('\n'),
            },
            docs: {
                title: 'fastapi.applications.FastAPI',
                content: 'Initializes the application.',
                source: ResolutionSource.Sphinx,
                confidence: 1,
            },
        },
        {
            label: 'Explicit deprecation notice should be detected',
            symbolInfo: {
                name: 'typing.List',
                qualname: 'typing.List',
                module: 'typing',
                kind: 'class',
                signature: 'typing.List',
                docstring: [
                    'Deprecated since version 3.9: Use list instead.',
                    '',
                    'A generic version of list.',
                ].join('\n'),
            },
        },
        {
            label: 'RST directives and Annotated wrappers clean correctly',
            symbolInfo: {
                name: 'fastapi.Query',
                qualname: 'fastapi.param_functions.Query',
                module: 'fastapi.param_functions',
                kind: 'function',
                signature: "Query(default: Annotated[str | None, Doc('query text')] = None) -> Annotated[str | None, Doc('result')]",
                docstring: [
                    '.. note:: Query params support validation.',
                    '.. versionchanged:: 0.100',
                    '',
                    'Use :class:`fastapi.Query` to declare metadata.',
                ].join('\n'),
            },
        },
        {
            label: 'Pydoc dump for constants is reduced',
            symbolInfo: {
                name: 'None',
                qualname: 'None',
                module: 'builtins',
                kind: 'constant',
                docstring: [
                    'Help on NoneType object:',
                    '',
                    'class NoneType(object)',
                    ' |  The type of the None singleton.',
                    ' |  Methods defined here:',
                    ' |  __bool__(self, /)',
                ].join('\n'),
                isStdlib: true,
            },
        },
        {
            label: 'Async method summary remains readable',
            symbolInfo: {
                name: 'httpx.AsyncClient.get',
                qualname: 'AsyncClient.get',
                module: 'httpx',
                kind: 'method',
                signature: 'async def get(self, url: str, *, follow_redirects: bool = False) -> Response',
                docstring: [
                    'Send a `GET` request.',
                    '',
                    'Example:',
                    '    response = await client.get("https://example.com")',
                ].join('\n'),
            },
        },
        {
            label: 'Inherited FastAPI method keeps FastAPI title',
            symbolInfo: {
                name: 'fastapi.FastAPI.add_middleware',
                qualname: 'Starlette.add_middleware',
                module: 'starlette.applications',
                kind: 'method',
                signature: "(self, middleware_class: '_MiddlewareFactory[P]', *args: 'P.args', **kwargs: 'P.kwargs') -> 'None'",
            },
        },
        {
            label: 'Aliased pandas method keeps hovered alias title',
            symbolInfo: {
                name: 'pandas.core.frame.DataFrame.agg',
                qualname: 'DataFrame.aggregate',
                module: 'pandas.core.frame',
                kind: 'method',
                signature: "(self, func=None, axis: 'Axis' = 0, *args, **kwargs)",
                docstring: '`agg` is an alias for `aggregate`. Use the alias.',
            },
        },
        {
            label: 'Section-heavy docstring keeps concise summary',
            symbolInfo: {
                name: 'pandas.DataFrame.agg',
                qualname: 'DataFrame.aggregate',
                module: 'pandas.core.frame',
                kind: 'method',
                signature: "(self, func=None, axis: 'Axis' = 0, *args, **kwargs)",
                docstring: [
                    'Aggregate using one or more operations over the specified axis.',
                    '',
                    'Parameters',
                    '----------',
                    'func : function, str, list or dict',
                    '    Function to use for aggregating the data.',
                    'axis : {0 or \"index\", 1 or \"columns\"}, default 0',
                    '    Axis to aggregate over.',
                    '',
                    'Examples',
                    '--------',
                    '>>> df.agg(["sum", "min"])',
                ].join('\n'),
            },
        },
        {
            label: 'Inherited pandas base method keeps public title with implementation note',
            symbolInfo: {
                name: 'pandas.DataFrame.astype',
                qualname: 'NDFrame.astype',
                module: 'pandas.core.generic',
                kind: 'method',
                signature: "(self, dtype, copy: 'bool_t | None' = None, errors: 'IgnoreRaise' = 'raise') -> 'Self'",
                docstring: 'Cast a pandas object to a specified dtype `dtype`.',
            },
        },
        {
            label: 'Path method keeps public owner with implementation note',
            symbolInfo: {
                name: 'pathlib.Path.with_suffix',
                qualname: 'PurePath.with_suffix',
                module: 'pathlib',
                kind: 'method',
                signature: '(self, suffix)',
                docstring: 'Return a new path with the file suffix changed.',
            },
        },
    ];

    for (const testCase of cases) {
        inspectCase(builder, testCase);
    }
}

main();
