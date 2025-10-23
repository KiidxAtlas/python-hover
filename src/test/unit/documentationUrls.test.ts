import { strict as assert } from 'assert';
import { MAP, getDunderInfo } from '../../data/documentationUrls';

suite('documentationUrls (unit)', () => {
  test('range anchor is func-range', () => {
    const info = MAP['range'];
    assert.ok(info, 'range mapping exists');
    assert.equal(info.anchor, 'func-range');
    assert.equal(info.url, 'library/functions.html');
  });

  test('dunder info mapping', () => {
    const info = getDunderInfo('__init__');
    assert.ok(info, 'dunder mapping exists');
    assert.equal(info?.anchor, 'object.__init__');
    assert.equal(info?.url, 'reference/datamodel.html');
  });
});
