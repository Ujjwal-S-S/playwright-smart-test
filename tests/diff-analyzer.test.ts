import { describe, it, expect } from 'vitest';
import { GitDiffAnalyzer } from '../src/diff/git-diff-analyzer.js';

describe('GitDiffAnalyzer', () => {
  it('splits multi-file git diff patch correctly', () => {
    const analyzer = new GitDiffAnalyzer();
    const rawDiff = `
diff --git a/src/pages/checkout.page.ts b/src/pages/checkout.page.ts
index 1234567..89abcdef 100644
--- a/src/pages/checkout.page.ts
+++ b/src/pages/checkout.page.ts
@@ -10,2 +10,4 @@
+  // New discount logic
+  const discount = 0.15;
diff --git a/src/pages/cart.page.ts b/src/pages/cart.page.ts
index 2345678..9abcdef0 100644
--- a/src/pages/cart.page.ts
+++ b/src/pages/cart.page.ts
@@ -5,1 +5,2 @@
+  // updated
`.trim();

    const patches = analyzer.splitPatches(rawDiff);
    expect(patches.size).toBe(2);
    expect(patches.has('src/pages/checkout.page.ts')).toBe(true);
    expect(patches.has('src/pages/cart.page.ts')).toBe(true);
  });

  it('safely handles adversarial input without polynomial ReDoS (CWE-1333)', () => {
    const analyzer = new GitDiffAnalyzer();
    // Pattern that would trigger ReDoS on polynomial regexes
    const adversarial = 'diff --git a/' + 'a b/'.repeat(500) + 'test.ts b/' + 'a b/'.repeat(500) + 'test.ts\nindex 123..456\n+added';
    const start = performance.now();
    const patches = analyzer.splitPatches(adversarial);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(50); // Completes in sub-millisecond without backtracking
    expect(patches.size).toBe(1);
  });

  it('parses git diff --numstat output accurately', () => {
    const analyzer = new GitDiffAnalyzer();
    const numstat = `
12\t2\tsrc/pages/checkout.page.ts
5\t0\tsrc/pages/cart.page.ts
-\t-\tassets/logo.png
`.trim();

    const result = analyzer.parseNumstat(numstat);
    expect(result.get('src/pages/checkout.page.ts')).toEqual({ additions: 12, deletions: 2 });
    expect(result.get('src/pages/cart.page.ts')).toEqual({ additions: 5, deletions: 0 });
    expect(result.get('assets/logo.png')).toEqual({ additions: 0, deletions: 0 });
  });
});
