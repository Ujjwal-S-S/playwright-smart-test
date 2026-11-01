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

  it('fast-paths documentation and markdown files to 0 tests', async () => {
    const selector = new TestSelector(config, exampleCwd);
    const diff: DiffFile[] = [
      { path: 'README.md', status: 'modified', additions: 10, deletions: 2 },
      { path: 'docs/architecture.md', status: 'added', additions: 50, deletions: 0 },
    ];

    const result = await selector.selectTests(diff, catalog);
    expect(result.isFullRegression).toBe(false);
    expect(result.selectedSpecs.length).toBe(0);
    expect(result.aiAnalysis.directReason).toContain('documentation');
    expect(result.aiAnalysis.directReason).toContain('README.md');
  });

  it('handles empty diff gracefully with clear zero modified files rationale', async () => {
    const selector = new TestSelector(config, exampleCwd);
    const result = await selector.selectTests([], catalog);
    expect(result.isFullRegression).toBe(false);
    expect(result.selectedSpecs.length).toBe(0);
    expect(result.aiAnalysis.directReason).toContain('Zero modified files detected');
  });

  it('guarantees directly modified test specs are included', async () => {
    const selector = new TestSelector(config, exampleCwd);
    const diff: DiffFile[] = [
      { path: 'tests/profile.spec.ts', status: 'modified', additions: 5, deletions: 1 },
    ];

    const result = await selector.selectTests(diff, catalog);
    expect(result.selectedSpecs).toContain('tests/profile.spec.ts');
    expect(result.directlyModifiedSpecs).toContain('tests/profile.spec.ts');
  });

  it('triggers full regression when domain scatter threshold is exceeded', async () => {
    const selector = new TestSelector(config, exampleCwd);
    const diff: DiffFile[] = [
      { path: 'src/auth/login.ts', status: 'modified', additions: 1, deletions: 1 },
      { path: 'src/checkout/flow.ts', status: 'modified', additions: 1, deletions: 1 },
      { path: 'src/billing/invoice.ts', status: 'modified', additions: 1, deletions: 1 },
      { path: 'src/cart/items.ts', status: 'modified', additions: 1, deletions: 1 },
      { path: 'src/shipping/tracker.ts', status: 'modified', additions: 1, deletions: 1 },
      { path: 'src/notifications/email.ts', status: 'modified', additions: 1, deletions: 1 },
      { path: 'src/analytics/events.ts', status: 'modified', additions: 1, deletions: 1 },
      { path: 'src/inventory/stock.ts', status: 'modified', additions: 1, deletions: 1 },
      { path: 'src/admin/users.ts', status: 'modified', additions: 1, deletions: 1 },
    ];

    const result = await selector.selectTests(diff, catalog);
    expect(result.isFullRegression).toBe(true);
    expect(result.fullRegressionReason).toContain('architectural domains');
  });

  it('falls back to smoke tests when app code changed but no specific test was selected', async () => {
    const catalogWithSmoke: SpecCatalogEntry[] = [
      ...catalog,
      {
        filePath: 'tests/smoke.spec.ts',
        testTitles: ['Core Smoke Test'],
        tags: ['@smoke'],
        importedModules: [],
      },
    ];

    const selector = new TestSelector(config, exampleCwd);
    // An unknown app utility with no direct domain match
    const diff: DiffFile[] = [
      { path: 'src/utils/math-helper.ts', status: 'modified', additions: 4, deletions: 1 },
    ];

    const result = await selector.selectTests(diff, catalogWithSmoke);
    expect(result.isSmokeFallback).toBe(true);
    expect(result.selectedSpecs).toContain('tests/smoke.spec.ts');
  });
});
