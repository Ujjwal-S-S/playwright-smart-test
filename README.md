# 🤖 Smart Regression Selection Agent for Playwright

> **AI-Powered Predictive Test Impact Analysis (TIA)** for Playwright E2E suites.
> Automatically analyzes Git PR diffs, determines modified components, traces cross-domain ripple effects using **mandatory AI semantic reasoning**, and selects only the necessary Playwright tests to execute.

[![CI Status](https://img.shields.io/badge/CI-GitHub_Actions-blue.svg)](https://github.com)
[![Playwright](https://img.shields.io/badge/Playwright-v1.64+-green.svg)](https://playwright.dev)
[![Vulnerabilities](https://img.shields.io/badge/Vulnerabilities-0_Audit_Clean-brightgreen.svg)](https://github.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-ES2022-blue.svg)](https://www.typescriptlang.org)

---

## 🌟 Key Capabilities

- **Mandatory AI Semantic Analysis**: Uses Google Gemini (via `@google/genai`) or structured inference to deeply analyze code diffs, semantic intent, data contracts, and cross-feature side effects.
- **Transitive Ripple Detection**: Automatically identifies upstream and downstream impacts (e.g., changing **checkout** &rarr; impacts **payment**, **cart/basket**, and **order summary**).
- **AST Dependency Verification**: Uses TypeScript compiler AST (`ts-morph`) to trace exact imports across Tests &rarr; Page Objects (POM) &rarr; Components &rarr; Shared Utilities.
- **Authentic Playwright Test Native**: Built from the ground up for Playwright (`@playwright/test`), supporting `test.describe()`, `test()`, tags (`@checkout`, `@payment`), and POM encapsulation with Playwright `Page` and `Locator` instances.
- **Three-Tier CI Visibility**:
  1. 💬 **Interactive GitHub PR Comment**: Formatted markdown with risk badges, changed components, impacted areas, and execution commands.
  2. 📊 **GitHub Actions Job Summary Tab**: Native summary card on the Actions build overview (`$GITHUB_STEP_SUMMARY`).
  3. 🖥️ **Console ASCII Tables**: Colorized terminal output for CLI and CI runner logs.
- **Safety Guardrails**: Automatically triggers full regression when critical files change (`playwright.config.ts`, `package.json`, global setup) or when impacted tests exceed safe threshold.
- **0-Vulnerability Security Guarantee**: Verified clean against `npm audit` with 0 vulnerabilities and zero secret leaks.

---

## ⚡ Real-World Example

```
PR changes `src/pages/checkout.page.ts`
           │
           ▼
[Smart Regression Selection Agent]
  ├── Identifies changed component: `checkout`
  ├── Traces semantic ripple effects: `payment`, `cart/basket`
  ├── Filters 4 total tests down to 3 required specs:
  │     - tests/checkout.spec.ts  (🟢 Direct AST dependency)
  │     - tests/payment.spec.ts   (🟡 Ripple effect on payment flow)
  │     - tests/cart.spec.ts      (🟡 Ripple effect on basket calculation)
  └── Safely omits `tests/profile.spec.ts` (0% impact)
```

---

## 📁 Repository Structure

```
smart-regression-agent/
├── .github/
│   └── workflows/
│       └── smart-regression.yml       # Ready-to-use GitHub Actions workflow
├── examples/
│   └── e-commerce/                   # End-to-end verification demo
│       ├── playwright.config.ts      # Playwright runner configuration
│       ├── smart-regression.config.json
│       ├── src/pages/                # CheckoutPage, CartPage, PaymentPage, ProfilePage
│       └── tests/                    # Playwright test specs using @playwright/test
├── src/
│   ├── ai/
│   │   └── ai-analyzer.ts            # Mandatory AI semantic reasoning engine
│   ├── catalog/
│   │   └── test-catalog.ts           # Spec file, test title & tag indexer
│   ├── cli/
│   │   └── index.ts                  # CLI commands (analyze, run, comment, init)
│   ├── config/
│   │   ├── index.ts
│   │   └── schema.ts                 # Zod configuration & output schemas
│   ├── diff/
│   │   └── git-diff-analyzer.ts      # Git diff & hunk analyzer
│   ├── graph/
│   │   └── dependency-graph.ts       # AST dependency graph (ts-morph)
│   ├── reporters/
│   │   ├── github-reporter.ts        # Markdown PR comment generator
│   │   └── terminal-reporter.ts      # CLI colorized table report
│   ├── runner/
│   │   └── playwright-runner.ts      # Playwright command executor
│   └── index.ts                      # Library export
├── tests/                            # Vitest automated test suite
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

---

## 🧪 Authentic Playwright Test Example

The demo suite in `examples/e-commerce/tests` uses authentic `@playwright/test` structures:

```typescript
import { test, expect } from '@playwright/test';
import { CheckoutPage } from '../src/pages/checkout.page.js';
import { CartPage } from '../src/pages/cart.page.js';

test.describe('Checkout Workflow @checkout', () => {
  test('should apply promo discount and submit order summary', async ({ page }) => {
    const cart = new CartPage(page);
    const checkout = new CheckoutPage(page, cart);

    await checkout.fillShippingAddress({ street: '123 Test St', city: 'Playwright City' });
    const discountedTotal = await checkout.applyPromoDiscount('VIP25');
    expect(discountedTotal).toBeLessThan(150);

    const summary = await checkout.submitOrderSummary();
    expect(summary.orderId).toBe('ORD-9912');
    expect(summary.payableAmount).toBe(135.00);
  });
});
```

---

## 🚀 Quick Start

### 1. Installation

```bash
cd smart-regression-agent
npm install
npm run build
```

Link CLI globally (optional):
```bash
npm link
```

### 2. Configure Environment

Set your Gemini API key:
```bash
export GEMINI_API_KEY="your-gemini-api-key"
```

### 3. Initialize Configuration

In your Playwright test repository root:
```bash
smart-test init
```

Generates `smart-regression.config.json`:
```json
{
  "testDir": "tests",
  "testMatch": ["**/*.spec.ts"],
  "pageObjectsDir": "src/pages",
  "components": [
    { "name": "checkout", "patterns": ["src/**/checkout*"] },
    { "name": "payment", "patterns": ["src/**/payment*"] },
    { "name": "basket", "patterns": ["src/**/cart*", "src/**/basket*"] }
  ],
  "safetyRules": {
    "fullRunPatterns": ["playwright.config.*", "package.json"],
    "maxImpactRatioForFullRun": 0.7
  },
  "ai": {
    "provider": "gemini",
    "model": "gemini-2.5-flash",
    "temperature": 0.2
  }
}
```

---

## 💻 CLI Commands

### 1. Analyze PR Changes
Inspect the PR diff against base branch and view the impact report:
```bash
smart-test analyze --base origin/main --head HEAD
```
Save report to markdown for CI:
```bash
smart-test analyze --base origin/main --head HEAD --output pr-report.md
```

### 2. Run Selected Playwright Tests
Selects and immediately runs only the impacted Playwright specs:
```bash
smart-test run --base origin/main --head HEAD
```
Dry-run mode to inspect the command without launching browsers:
```bash
smart-test run --base origin/main --head HEAD --dry-run
```

### 3. Generate PR Comment Markdown
Outputs Markdown suitable for posting to GitHub PR comments:
```bash
smart-test comment --base origin/main --head HEAD
```

---

## 🤖 GitHub Actions CI Workflow

Add `.github/workflows/smart-regression.yml` to your repository:

```yaml
name: Smart Playwright Regression CI

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write

jobs:
  smart-regression:
    name: AI Regression Selection & Execution
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Full history for accurate base...head diff

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Install Playwright Browsers
        run: npx playwright install --with-deps chromium

      - name: Install Smart Regression Agent
        run: npm install -g smart-regression-agent

      - name: Run Smart Regression Analysis
        id: selector
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
        run: |
          smart-test analyze --base origin/${{ github.base_ref }} --head ${{ github.sha }} --output pr-report.md
          # Stream summary to the GitHub Actions Job Summary tab
          cat pr-report.md >> $GITHUB_STEP_SUMMARY

      - name: Post PR Comment
        uses: actions/github-script@v7
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          script: |
            const fs = require('fs');
            if (fs.existsSync('pr-report.md')) {
              const body = fs.readFileSync('pr-report.md', 'utf8');
              const { data: comments } = await github.rest.issues.listComments({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.issue.number,
              });
              const botComment = comments.find(c => c.body.includes('🤖 Playwright Smart Regression Selection Report'));
              if (botComment) {
                await github.rest.issues.updateComment({
                  owner: context.repo.owner,
                  repo: context.repo.repo,
                  comment_id: botComment.id,
                  body,
                });
              } else {
                await github.rest.issues.createComment({
                  owner: context.repo.owner,
                  repo: context.repo.repo,
                  issue_number: context.issue.number,
                  body,
                });
              }
            }

      - name: Execute Selected Regression Tests
        run: |
          smart-test run --base origin/${{ github.base_ref }} --head ${{ github.sha }}
```

---

## 🛡️ Security & Zero-Vulnerability Guarantee

The repository is built following strict enterprise security standards:
- **`npm audit` verified clean**: **0 vulnerabilities** across all direct and transitive dependencies.
- **Zero hardcoded credentials**: All secret tokens use environment variables (`GEMINI_API_KEY`, `GITHUB_TOKEN`).
- **Strict Zod schema validation**: AI model outputs are strictly parsed and typed at runtime, rejecting any malformed responses.
- **Dependency Overrides**: Pinned modern patched sub-dependencies (`minimatch >= 11.0.3`, `vitest >= 5.0.5`, `zod >= 4.6.7`).
- **Native Git Integration**: Uses Node.js native `child_process.execFile` directly instead of third-party wrappers, eliminating wrapper vulnerability vectors completely.

---

## 🧪 Testing

Run unit & integration test suites:
```bash
npm test
```

All 6 test files run with Vitest and verify:
- Git diff hunk splitting & patch extraction
- Spec catalog, test titles, and tag indexer
- AST bidirectional dependency graph
- Mandatory AI Semantic Analyzer and schema validation
- Multi-component ripple effect aggregator
- GitHub & Terminal reporters
