const Module = require('module') as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const fs = require('fs') as typeof import('fs');
const os = require('os') as typeof import('os');
const path = require('path') as typeof import('path');

const originalLoad = Module._load;
Module._load = function patchedLoad(request: string, parent: unknown, isMain: boolean) {
    if (request === 'vscode') {
        return {
            workspace: { workspaceFolders: [{ uri: { fsPath: process.cwd() } }] },
            window: {
                createOutputChannel() {
                    return { appendLine() { }, show() { }, clear() { } };
                },
            },
        };
    }
    return originalLoad.apply(this, [request, parent, isMain]);
};

const { DocResolver } = require('../src/docResolver') as typeof import('../src/docResolver');
const { HoverDocBuilder } = require('../src/builder/hoverDocBuilder') as typeof import('../src/builder/hoverDocBuilder');
const { DiskCache } = require('../src/cache/diskCache') as typeof import('../src/cache/diskCache');
const { cleanContent, cleanSignature } = require('../../extension/src/ui/contentCleaner') as typeof import('../../extension/src/ui/contentCleaner');
const { DocKeyBuilder } = require('../../shared/docKey') as typeof import('../../shared/docKey');
const { ResolutionSource } = require('../../shared/types') as typeof import('../../shared/types');

type ProbeCase = {
    name: string;
    module?: string;
    qualname?: string;
    kind?: string;
    signature?: string;
    docstring?: string;
    isStdlib?: boolean;
};

function getProbeCases(): ProbeCase[] {
    return [
        {
            name: 'match',
            module: 'builtins',
            qualname: 'match',
            kind: 'keyword',
            isStdlib: true,
            docstring: "No Python documentation found for 'match'.\nUse help() to get the interactive help utility.\nUse help(str) for help on the str class.\n",
        },
        {
            name: 'case',
            module: 'builtins',
            qualname: 'case',
            kind: 'keyword',
            isStdlib: true,
            docstring: "No Python documentation found for 'case'.\nUse help() to get the interactive help utility.\nUse help(str) for help on the str class.\n",
        },
        {
            name: 'fastapi.FastAPI.get',
            module: 'fastapi.applications',
            qualname: 'FastAPI.get',
            kind: 'method',
            signature: '(self, path: str) -> collections.abc.Callable[[~DecoratedCallable], ~DecoratedCallable]',
            docstring: 'Add a *path operation* using an HTTP GET operation.\n\n## Example\n\n```python\nfrom fastapi import FastAPI\n```',
        },
        {
            name: 'fastapi.FastAPI.add_middleware',
            module: 'starlette.applications',
            qualname: 'Starlette.add_middleware',
            kind: 'method',
            signature: '(self, middleware_class, *args, **kwargs) -> None',
        },
        {
            name: 'None',
            module: 'builtins',
            qualname: 'None',
            kind: 'constant',
            isStdlib: true,
            docstring: 'The type of the None singleton.',
        },
        // ── Package corpus cases ──────────────────────────────────────
        {
            name: 'numpy.array',
            module: 'numpy',
            qualname: 'numpy.array',
            kind: 'function',
        },
        {
            name: 'pandas.DataFrame',
            module: 'pandas',
            qualname: 'pandas.DataFrame',
            kind: 'class',
        },
        {
            name: 'requests.get',
            module: 'requests',
            qualname: 'requests.get',
            kind: 'function',
        },
        {
            name: 'flask.Flask.route',
            module: 'flask',
            qualname: 'flask.Flask.route',
            kind: 'method',
        },
        {
            name: 'sqlalchemy.select',
            module: 'sqlalchemy',
            qualname: 'sqlalchemy.select',
            kind: 'function',
        },
        {
            name: 'click.command',
            module: 'click',
            qualname: 'click.command',
            kind: 'function',
        },
    ];
}

async function main(): Promise<void> {
    const storagePath = path.join(os.tmpdir(), 'pyhover-probe-cache');
    fs.mkdirSync(storagePath, { recursive: true });

    const resolver = new DocResolver(
        new DiskCache(storagePath, () => { }, { inventoryDays: 1, snippetHours: 1 }),
        { onlineDiscovery: true, requestTimeout: 10000 },
    );
    resolver.setPythonVersion('3');

    const builder = new HoverDocBuilder();
    const cases = getProbeCases();

    for (const probeCase of cases) {
        const docs = await resolver.resolve(DocKeyBuilder.fromSymbol(probeCase));
        const doc = builder.build(probeCase, docs);

        console.log(`CASE ${probeCase.name}`);
        console.log(`source=${doc.source || ResolutionSource.Runtime}`);
        console.log(`url=${doc.url || ''}`);
        console.log(`summary=${cleanContent(doc.summary || '')}`);
        console.log(`content=${cleanContent(doc.content || '')}`);
        console.log(`notes=${(doc.notes || []).join(' | ')}`);
        if (doc.signature) {
            console.log(`sig=${cleanSignature(doc.signature)}`);
        }
        console.log('---');
    }
}

const keepAlive = setInterval(() => { }, 1000);

main()
    .then(() => {
        clearInterval(keepAlive);
    })
    .catch(error => {
        clearInterval(keepAlive);
        console.error(error);
        process.exitCode = 1;
    });
