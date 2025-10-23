import { strict as assert } from 'assert';
import { SymbolResolver } from '../../resolvers/symbolResolver';

// Minimal document mock compatible with resolver
function docOf(text: string): any {
  return {
    lineAt: (_pos: any) => ({ text }),
    getWordRangeAtPosition: (pos: any) => {
      // Create a small range around the position to simulate VS Code behavior
      const start = Math.max(0, pos.character - 1);
      const end = Math.min(text.length, pos.character + 1);
      return { start: { character: start }, end: { character: end } };
    },
    getText: (_range?: any) => text
  };
}

suite('SymbolResolver operators and strings (unit)', () => {
  const resolver = new SymbolResolver();

  test('detects equality operator ==', () => {
    const text = 'if a == b: pass';
    const document = docOf(text);
    const position = { line: 0, character: text.indexOf('==') + 1 } as any;
    const symbols = resolver.resolveSymbolAtPosition(document as any, position);
    assert.ok(symbols.find(s => s.type === 'operator' && s.symbol === '=='));
  });

  test('detects f-string context', () => {
    const text = 'msg = f"Hello {name}"';
    const document = docOf(text);
    const position = { line: 0, character: text.indexOf('name') } as any;
    const symbols = resolver.resolveSymbolAtPosition(document as any, position);
    assert.equal(symbols[0]?.type, 'f-string');
  });
});
