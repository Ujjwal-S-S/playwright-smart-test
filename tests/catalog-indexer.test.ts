import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { TestCatalogIndexer } from '../src/catalog/test-catalog.js';

describe('TestCatalogIndexer', () => {
  it('indexes spec files, tags, and imported modules from e-commerce sample', async () => {
    const exampleCwd = path.resolve(__dirname, '../examples/e-commerce');
    const indexer = new TestCatalogIndexer(exampleCwd);

    const catalog = await indexer.scanTestFiles('tests', ['**/*.spec.ts']);
    expect(catalog.length).toBe(4);

    const checkoutSpec = catalog.find((c) => c.filePath.includes('checkout.spec.ts'));
    expect(checkoutSpec).toBeDefined();
    expect(checkoutSpec?.tags).toContain('@checkout');
    expect(checkoutSpec?.importedModules.some((m) => m.includes('checkout.page'))).toBe(true);

    const cartSpec = catalog.find((c) => c.filePath.includes('cart.spec.ts'));
    expect(cartSpec).toBeDefined();
    expect(cartSpec?.tags).toContain('@basket');
    expect(cartSpec?.tags).toContain('@cart');
  });
});
