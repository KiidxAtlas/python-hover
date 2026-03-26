import * as fs from 'fs';
import { cleanContent, cleanSignature } from '../../extension/src/ui/contentCleaner';
import { DocKeyBuilder } from '../../shared/docKey';
import { HoverDoc, ResolutionSource, SymbolInfo } from '../../shared/types';
import { HoverDocBuilder } from '../src/builder/hoverDocBuilder';
import { DiskCache } from '../src/cache/diskCache';
import { DocResolver } from '../src/docResolver';

interface CorpusEntry {
    line: number;
    target: string;
    expression: string;
    identified: string | null;
    resolved: {
        module?: string | null;
        qualname?: string | null;
        signature?: string | null;
        docstring?: string | null;
        is_stdlib?: boolean | null;
        kind?: string | null;
        error?: string | null;
    } | null;
    status: string;
}

function toSymbolInfo(entry: CorpusEntry): SymbolInfo {
    const resolved = entry.resolved ?? {};
    return {
        name: entry.identified || entry.expression || entry.target,
        module: resolved.module || undefined,
        qualname: resolved.qualname || undefined,
        signature: resolved.signature || undefined,
        docstring: resolved.docstring || undefined,
        isStdlib: Boolean(resolved.is_stdlib),
        kind: resolved.kind || undefined,
    };
}

function inferSource(entry: CorpusEntry): ResolutionSource {
    if (entry.status === 'local') return ResolutionSource.Local;
    if (entry.resolved?.module === 'builtins' || entry.resolved?.is_stdlib) return ResolutionSource.Runtime;
    return ResolutionSource.Runtime;
}

function buildPreview(doc: HoverDoc): string[] {
    const lines: string[] = [];
    lines.push(`Title: ${doc.title}`);
    lines.push(`Kind: ${doc.kind ?? 'symbol'}`);
    lines.push(`Source: ${doc.source}`);
    if (doc.url) {
        lines.push(`URL: ${doc.url}`);
    }
    if (doc.signature) {
        lines.push(`Signature: ${cleanSignature(doc.signature)}`);
    }
    if (doc.summary) {
        lines.push(`Summary: ${cleanContent(doc.summary)}`);
    }
    if (doc.content) {
        lines.push(`Content: ${cleanContent(doc.content)}`);
    }
    if (doc.notes && doc.notes.length > 0) {
        lines.push(`Notes: ${doc.notes.join(' | ')}`);
    }
    if (doc.seeAlso && doc.seeAlso.length > 0) {
        lines.push(`See Also: ${doc.seeAlso.join(' | ')}`);
    }
    return lines;
}

function auditEntry(entry: CorpusEntry, doc: HoverDoc): string[] {
    const findings: string[] = [];
    const visible = cleanContent(doc.summary || doc.content || '');

    if (!visible.trim()) {
        findings.push('missing-visible-description');
    } else {
        if (visible.length < 50 && doc.source !== ResolutionSource.Local && doc.kind !== 'keyword') {
            findings.push('thin-description');
        }
        if (/^No Python documentation found for/i.test(visible)) {
            findings.push('bad-runtime-fallback');
        }
        if (/^Help on \w+ object:/i.test(visible)) {
            findings.push('raw-pydoc-dump');
        }
        if (/^(?:Documentation for\b|Documentation from\b)/i.test(visible)) {
            findings.push('placeholder-description');
        }
        if (/\b##\s+Example\b/.test(visible) || /```python[\s\S]*```/.test(visible.slice(0, 180))) {
            findings.push('summary-contains-example-block');
        }
    }

    if (doc.kind === 'keyword' && visible.length < 80) {
        findings.push('keyword-too-thin');
    }

    if (doc.source === ResolutionSource.Local && !doc.summary && !doc.content) {
        findings.push('local-no-docstring');
    }

    if (doc.url?.includes('docs.python.org') && doc.source === ResolutionSource.Static) {
        findings.push('static-link-without-extracted-content');
    }

    return findings;
}

async function main(): Promise<void> {
    const inputPath = process.argv[2] || '/tmp/pyhover_test_hover_results.json';
    const raw = fs.readFileSync(inputPath, 'utf8');
    const entries = JSON.parse(raw) as CorpusEntry[];
    const builder = new HoverDocBuilder();
    const storagePath = require('path').join(require('os').tmpdir(), 'pyhover-audit-cache');
    require('fs').mkdirSync(storagePath, { recursive: true });
    const resolver = new DocResolver(new DiskCache(storagePath, () => { }, { inventoryDays: 1, snippetHours: 1 }), { onlineDiscovery: true, requestTimeout: 10000, enableDocScraping: true });
    resolver.setPythonVersion('3');

    for (const entry of entries) {
        const symbolInfo = toSymbolInfo(entry);
        const docKey = DocKeyBuilder.fromSymbol(symbolInfo);
        const docs = await resolver.resolve(docKey);
        const hoverDoc = builder.build(symbolInfo, docs);
        if (!hoverDoc.source) {
            hoverDoc.source = inferSource(entry);
        }

        const findings = auditEntry(entry, hoverDoc);
        const heading = `L${entry.line} ${entry.target} [${entry.status}]${findings.length > 0 ? ` findings=${findings.join(',')}` : ''}`;
        console.log(`\n### ${heading}`);
        for (const line of buildPreview(hoverDoc)) {
            console.log(line);
        }
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
