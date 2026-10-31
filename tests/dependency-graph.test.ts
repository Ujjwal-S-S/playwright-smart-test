import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { ASTDependencyGraph } from '../src/graph/dependency-graph.js';

describe('ASTDependencyGraph', () => {
  it('builds dependency graph and detects tests importing modified page object', async () => {
    const fixtureCwd = path.resolve(__dirname, 'fixtures');
    const graph = new ASTDependencyGraph(fixtureCwd);

    await graph.buildGraph(['pages', 'tests']);

    const knownSpecs = ['tests/checkout.spec.ts', 'tests/unrelated.spec.ts'];

    // Simulate changing checkout.page.ts
    const impacted = graph.findImpactedTestSpecs(['pages/checkout.page.ts'], knownSpecs);
    expect(impacted).toContain('tests/checkout.spec.ts');
    expect(impacted).not.toContain('tests/unrelated.spec.ts');
  });
});
