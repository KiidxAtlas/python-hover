import { strict as assert } from 'assert';
import * as path from 'path';
import { DocumentationFetcher } from '../../documentation/documentationFetcher';
import { CacheManager } from '../../services/cache';

// Minimal vscode Uri mock compatible with CacheManager
const mockGlobalStorage = { fsPath: path.join(process.cwd(), '.unit-cache') } as any;

suite('DocumentationFetcher (unit)', () => {
  test('direct mapping builds correct builtin URL with anchor (range → func-range)', async () => {
    const fetcher = new DocumentationFetcher(new CacheManager(mockGlobalStorage as any));
    const snippet = await fetcher.fetchDocumentationForSymbol('range');
    assert.ok(snippet.url.includes('https://docs.python.org/3/library/functions.html#func-range'));
    assert.equal(snippet.anchor, 'func-range');
    assert.ok(/Documentation for 'range'/.test(snippet.content));
  });

  test('dunder mapping points to datamodel with object.__init__ anchor', async () => {
    const fetcher = new DocumentationFetcher(new CacheManager(mockGlobalStorage as any));
    const snippet = await fetcher.fetchDocumentationForSymbol('__init__');
    assert.ok(snippet.url.includes('https://docs.python.org/3/reference/datamodel.html#object.__init__'));
    assert.equal(snippet.anchor, 'object.__init__');
  });

  test('keyword mapping builds compound statements URL (for)', async () => {
    const fetcher = new DocumentationFetcher(new CacheManager(mockGlobalStorage as any));
    const snippet = await fetcher.fetchDocumentationForSymbol('for');
    assert.ok(/reference\/compound_stmts\.html/.test(snippet.url));
  });
});
