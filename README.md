# 🤖 Smart Regression Selection Agent for Playwright

> **AI-Powered Predictive Test Impact Analysis (TIA)** for Playwright E2E suites.
> Automatically analyzes Git PR diffs, determines modified components, traces cross-domain ripple effects using **mandatory AI semantic reasoning**, and selects only the necessary tests to execute.

---

## 🌟 Features

- **Mandatory AI Semantic Analysis**: Uses Google Gemini (via `@google/genai`) or structured inference to deeply analyze code diffs, semantic intent, data contracts, and cross-feature side effects.
- **Transitive Ripple Detection**: Automatically identifies upstream and downstream impacts (e.g. changing **checkout** &rarr; impacts **payment**, **cart/basket**, and **order summary**).
- **AST Dependency Verification**: Uses TypeScript compiler AST (`ts-morph`) to trace exact imports across Tests &rarr; Page Objects (POM) &rarr; Components &rarr; Shared Utilities.
- **Safety Guardrails**: Automatically triggers full regression when critical files change (`playwright.config.ts`, `package.json`, global setup) or when impacted tests exceed safe threshold.
- **GitHub PR Integration**: Posts rich PR comments with risk badges, changed components, impacted areas, AI rationale, and execution commands.
- **Drop-in CLI**: Run `smart-test analyze`, `smart-test run`, and `smart-test comment`.

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
    name: AI Regression Selection
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci
      - run: npx playwright install --with-deps chromium

      - name: Analyze & Post PR Report
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
        run: |
          npx smart-test analyze --base origin/${{ github.base_ref }} --head ${{ github.sha }} --output pr-report.md

      - name: Run Selected Tests
        run: |
          npx smart-test run --base origin/${{ github.base_ref }} --head ${{ github.sha }}
```

---

## 🧪 Testing

Run unit & integration test suites:
```bash
npm test
```

All tests run with Vitest and verify:
- Git diff hunk splitting & patch extraction
- Spec catalog and tag indexer
- AST bidirectional dependency graph
- Mandatory AI Semantic Analyzer and schema validation
- Multi-component ripple effect aggregator
- GitHub & Terminal reporters
