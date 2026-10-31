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
});
