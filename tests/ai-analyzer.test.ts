import { describe, it, expect } from 'vitest';
import { AISemanticAnalyzer } from '../src/ai/ai-analyzer.js';
import { SmartRegressionConfigSchema, DiffFile, SpecCatalogEntry } from '../src/config/schema.js';

describe('AISemanticAnalyzer', () => {
  const config = SmartRegressionConfigSchema.parse({
    ai: {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
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

  it('generates prompt with diffs and catalog', () => {
    const analyzer = new AISemanticAnalyzer(config);
    const diff: DiffFile[] = [
      {
        path: 'src/pages/checkout.page.ts',
        status: 'modified',
        additions: 10,
        deletions: 2,
        patch: '+ const newDiscount = 0.20;',
      },
    ];

    const prompt = analyzer.buildPrompt(diff, catalog);
    expect(prompt).toContain('PR MODIFIED FILES & DIFFS');
    expect(prompt).toContain('checkout.page.ts');
    expect(prompt).toContain('tests/checkout.spec.ts');
  });

  it('infers ripple effects for checkout change: checkout + payment + basket/cart', async () => {
    const analyzer = new AISemanticAnalyzer(config);
    const diff: DiffFile[] = [
      {
        path: 'src/pages/checkout.page.ts',
        status: 'modified',
        additions: 15,
        deletions: 1,
        patch: '+ public async applyPromoDiscount(code: string) {}',
      },
    ];

    const analysis = await analyzer.analyzeImpact(diff, catalog);
    expect(analysis.changedComponents).toContain('checkout');
    expect(analysis.impactedComponents).toContain('payment');
    expect(analysis.impactedComponents.some((c) => c === 'basket' || c === 'cart')).toBe(true);

    const recommended = analysis.recommendedTests.map((t) => t.specFile);
    expect(recommended).toContain('tests/checkout.spec.ts');
    expect(recommended).toContain('tests/payment.spec.ts');
    expect(recommended).toContain('tests/cart.spec.ts');
    expect(recommended).not.toContain('tests/profile.spec.ts');
  });
});
