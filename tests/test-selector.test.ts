import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { TestSelector } from '../src/selector/test-selector.js';
import { SmartRegressionConfigSchema, DiffFile, SpecCatalogEntry } from '../src/config/schema.js';

describe('TestSelector', () => {
  const exampleCwd = path.resolve(__dirname, '../examples/e-commerce');
  const config = SmartRegressionConfigSchema.parse({
    testDir: 'tests',
    pageObjectsDir: 'src/pages',
    safetyRules: {
      fullRunPatterns: ['playwright.config.*'],
      maxImpactRatioForFullRun: 0.85,
    },
  });

  const catalog: SpecCatalogEntry[] = [
    {
      filePath: 'tests/checkout.spec.ts',
      testTitles: ['Checkout Workflow'],
      tags: ['@checkout'],
      importedModules: ['../src/pages/checkout.page.js'],
    },
    {
      filePath: 'tests/cart.spec.ts',
      testTitles: ['Basket & Cart Operations'],
      tags: ['@basket', '@cart'],
      importedModules: ['../src/pages/cart.page.js'],
    },
    {
      filePath: 'tests/payment.spec.ts',
      testTitles: ['Payment Processing Gateway'],
      tags: ['@payment'],
      importedModules: ['../src/pages/payment.page.js'],
    },
    {
      filePath: 'tests/profile.spec.ts',
      testTitles: ['User Profile Settings'],
      tags: ['@profile'],
      importedModules: ['../src/pages/profile.page.js'],
    },
  ];

  it('selects checkout + payment + basket tests when checkout is modified', async () => {
    const selector = new TestSelector(config, exampleCwd);
    const diff: DiffFile[] = [
      {
        path: 'src/pages/checkout.page.ts',
        status: 'modified',
        additions: 12,
        deletions: 2,
        patch: '+ export class CheckoutPage { applyPromoDiscount() {} }',
      },
    ];

    const result = await selector.selectTests(diff, catalog);

    expect(result.isFullRegression).toBe(false);
    expect(result.changedComponents).toContain('checkout');
    expect(result.selectedSpecs).toContain('tests/checkout.spec.ts');
    expect(result.selectedSpecs).toContain('tests/payment.spec.ts');
    expect(result.selectedSpecs).toContain('tests/cart.spec.ts');
    // Crucially: profile should NOT be selected
    expect(result.selectedSpecs).not.toContain('tests/profile.spec.ts');

    expect(result.playwrightCommand).toContain('npx playwright test');
    expect(result.playwrightCommand).toContain('tests/checkout.spec.ts');
  });

  it('triggers full regression when critical config is modified', async () => {
    const selector = new TestSelector(config, exampleCwd);
    const diff: DiffFile[] = [
      {
        path: 'playwright.config.ts',
        status: 'modified',
        additions: 2,
        deletions: 1,
        patch: '+ timeout: 60000',
      },
    ];

    const result = await selector.selectTests(diff, catalog);
    expect(result.isFullRegression).toBe(true);
    expect(result.fullRegressionReason).toContain('playwright.config.ts');
    expect(result.selectedSpecs.length).toBe(4);
    expect(result.playwrightCommand).toBe('npx playwright test');
  });
});
