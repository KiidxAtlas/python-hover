import * as assert from 'assert';
import { CacheManager } from '../../cache';
import { InventoryManager } from '../../inventory';

suite('InventoryManager Test Suite', () => {
    test('Should resolve torch.zeros correctly', async () => {
        const cache = new CacheManager({ fsPath: '/tmp/test-cache' } as any);
        const inventory = new InventoryManager(cache);

        // This tests the fix we made - torch should map to torch, not pytorch
        const entry = await inventory.resolveSymbol('zeros', '3.11', 'torch');

        assert.ok(entry, 'Should find torch.zeros');
        assert.ok(entry!.uri.includes('pytorch.org'), 'Should point to PyTorch docs');
    });

    test('Should resolve numpy.array correctly', async () => {
        const cache = new CacheManager({ fsPath: '/tmp/test-cache' } as any);
        const inventory = new InventoryManager(cache);

        const entry = await inventory.resolveSymbol('array', '3.11', 'numpy');

        assert.ok(entry, 'Should find numpy.array');
        assert.ok(entry!.uri.includes('numpy.org'), 'Should point to NumPy docs');
    });

    test('Should fallback to stdlib for unknown libraries', async () => {
        const cache = new CacheManager({ fsPath: '/tmp/test-cache' } as any);
        const inventory = new InventoryManager(cache);

        const entry = await inventory.resolveSymbol('open', '3.11', 'unknown_lib');

        assert.ok(entry, 'Should find builtin open() via fallback');
        assert.ok(entry!.uri.includes('docs.python.org'), 'Should point to Python docs');
    });

    test('Should handle special methods', async () => {
        const cache = new CacheManager({ fsPath: '/tmp/test-cache' } as any);
        const inventory = new InventoryManager(cache);

        const entry = await inventory.resolveSymbol('__init__', '3.11');

        assert.ok(entry, 'Should find __init__ special method');
    });
});
