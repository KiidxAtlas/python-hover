import { strict as assert } from 'assert';
import * as vscode from 'vscode';
import { ContextDetector } from '../../resolvers/contextDetector';
import { createMockDocument } from './helpers/mockDocument';

suite('ContextDetector (unit)', () => {
  test('detects list from multiline assignment', () => {
    const doc = createMockDocument('nums = [\n  1,\n  2,\n  3\n]\nprint(nums)');
    const pos = new (vscode as any).Position(4, 3);
    const detector = new ContextDetector();
    const t = detector.detectVariableTypeFromContext(doc, pos, 'nums');
    assert.equal(t, 'list');
  });

  test('detects dict from comprehension', () => {
    const doc = createMockDocument('m = {k: v for k, v in pairs}');
    const pos = new (vscode as any).Position(0, 5);
    const detector = new ContextDetector();
    const t = detector.detectVariableTypeFromContext(doc, pos, 'm');
    assert.equal(t, 'dict');
  });

  test('detects walrus assignment', () => {
    const doc = createMockDocument('if (n := 42):\n    pass');
    const pos = new (vscode as any).Position(0, 6);
    const detector = new ContextDetector();
    const t = detector.detectVariableTypeFromContext(doc, pos, 'n');
    assert.equal(t, 'int');
  });
});
