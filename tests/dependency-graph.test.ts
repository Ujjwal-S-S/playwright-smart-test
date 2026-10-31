import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { ASTDependencyGraph } from '../src/graph/dependency-graph.js';

describe('ASTDependencyGraph', () => {
  it('builds dependency graph and detects tests importing modified page object', async () => {
    const exampleCwd = path.resolve(__dirname, '../examples/e-commerce');
    const graph = new ASTDependencyGraph(exampleCwd);

    await graph.buildGraph(['src', 'tests']);

    const knownSpecs = [
      'tests/checkout.spec.ts',
      'tests/cart.spec.ts',
      'tests/payment.spec.ts',
      'tests/profile.spec.ts',
    ];

    // Simulate changing checkout.page.ts
    const impacted = graph.findImpactedTestSpecs(['src/pages/checkout.page.ts'], knownSpecs);
    expect(impacted).toContain('tests/checkout.spec.ts');
    expect(impacted).not.toContain('tests/profile.spec.ts');
  });
});
