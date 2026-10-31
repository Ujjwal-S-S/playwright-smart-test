import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { TestCatalogIndexer } from '../src/catalog/test-catalog.js';

describe('TestCatalogIndexer', () => {
  it('indexes spec files, tags, and imported modules from fixtures', async () => {
    const fixtureCwd = path.resolve(__dirname, 'fixtures');
    const indexer = new TestCatalogIndexer(fixtureCwd);

    const catalog = await indexer.scanTestFiles('tests', ['**/*.spec.ts']);
    expect(catalog.length).toBe(1);

    const checkoutSpec = catalog.find((c) => c.filePath.includes('checkout.spec.ts'));
    expect(checkoutSpec).toBeDefined();
    expect(checkoutSpec?.tags).toContain('@checkout');
    expect(checkoutSpec?.importedModules.some((m) => m.includes('checkout.page'))).toBe(true);
  });
});
