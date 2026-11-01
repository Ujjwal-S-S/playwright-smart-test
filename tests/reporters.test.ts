import { describe, it, expect } from 'vitest';
import { GitHubReporter } from '../src/reporters/github-reporter.js';
import { FinalSelectionResult } from '../src/config/schema.js';

describe('GitHubReporter', () => {
  it('generates rich PR markdown summary with badges and tables', () => {
    const result: FinalSelectionResult = {
      isFullRegression: false,
      changedFiles: [{ path: 'src/pages/checkout.page.ts', status: 'modified', additions: 5, deletions: 1 }],
      changedComponents: ['checkout'],
      impactedComponents: ['payment', 'basket'],
      aiAnalysis: {
        changedComponents: ['checkout'],
        impactedComponents: ['payment', 'basket'],
        directReason: 'Modified promo discount calculation',
        rippleEffectReason: 'Altered order totals flow into payment tokenization',
        riskScore: 'HIGH',
        recommendedTests: [
          { specFile: 'tests/checkout.spec.ts', reason: 'Direct change', isIndirectImpact: false },
          { specFile: 'tests/payment.spec.ts', reason: 'Payload impact', isIndirectImpact: true },
          { specFile: 'tests/cart.spec.ts', reason: 'Total recalculation', isIndirectImpact: true },
        ],
      },
      selectedSpecs: ['tests/checkout.spec.ts', 'tests/payment.spec.ts', 'tests/cart.spec.ts'],
      directlyModifiedSpecs: ['tests/checkout.spec.ts'],
      componentRuleSpecs: [],
      aiRecommendedSpecs: ['tests/checkout.spec.ts', 'tests/payment.spec.ts', 'tests/cart.spec.ts'],
      playwrightCommand: 'npx playwright test "tests/checkout.spec.ts" "tests/payment.spec.ts" "tests/cart.spec.ts"',
    };

    const markdown = GitHubReporter.generateMarkdown(result);

    expect(markdown).toContain('## 🤖 Playwright Smart Regression Selection Report');
    expect(markdown).toContain('HIGH');
    expect(markdown).toContain('`checkout`');
    expect(markdown).toContain('`payment`');
    expect(markdown).toContain('tests/checkout.spec.ts');
    expect(markdown).toContain('tests/payment.spec.ts');
    expect(markdown).toContain('tests/cart.spec.ts');
    expect(markdown).toContain('npx playwright test');
  });
});
