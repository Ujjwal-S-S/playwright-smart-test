# 🎭 Playwright Smart Test (`playwright-smart-test`)

[![npm version](https://img.shields.io/npm/v/playwright-smart-test.svg?style=flat-square&color=007acc)](https://www.npmjs.com/package/playwright-smart-test)
[![Playwright](https://img.shields.io/badge/Playwright-Tested-45ba4b?style=flat-square&logo=playwright&logoColor=white)](https://playwright.dev/)
[![Google Gemini](https://img.shields.io/badge/Powered%20By-Google%20Gemini-4285F4?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

> AI-powered regression test selection for Playwright test suites. Analyzes Pull Request diffs with Google Gemini, traces cross-component ripple effects, and executes only impacted tests with safety guardrails.

---

## Overview

In end-to-end Playwright testing, running every test on every Pull Request can take significant CI time.

Static AST import analyzers often fail in E2E environments because:
1. **App code is decoupled from E2E tests**: Tests drive a browser over CDP/WebSocket rather than importing application components directly.
2. **Playwright Fixtures**: Tests import shared `fixtures.ts` files, causing static tools to flag all tests on any change.

`playwright-smart-test` combines **Google Gemini** for semantic analysis with **safety guardrails** to select and run only the tests affected by your PR.

---

## 🏗️ Architecture

```
                       Pull Request Git Diff
                                 │
                                 ▼
    ┌─────────────────────────────────────────────────────────┐
    │              PHASE 1: PRE-AI SAFETY GATES               │
    │  • Docs/Asset Fast-Path (0 tests for markdown/images)   │
    │  • Domain Scatter Guard (>8 architectural domains)      │
    │  • Lockfile & Bundle Noise Sanitizer                    │
    └────────────────────────────┬────────────────────────────┘
                                 │
                    (If smart selection eligible)
                                 │
                                 ▼
    ┌─────────────────────────────────────────────────────────┐
    │                     THE LLM BRAIN                       │
    │  • Google Gemini analyzes code diffs & business logic   │
    │  • Evaluates catalog (specs, describe blocks, @tags)    │
    │  • Evaluates playwright.config diffs intelligently      │
    │  • Fail-safe fallback: If uncertain ──► Run Full Suite  │
    └────────────────────────────┬────────────────────────────┘
                                 │
                                 ▼
    ┌─────────────────────────────────────────────────────────┐
    │           PHASE 3: POST-AI GUARDRAILS & GATES           │
    │  • Direct Test Invariant (touched specs always run)     │
    │  • Deleted File Purge (prevents Playwright crashes)     │
    │  • Catalog Whitelist Filter (blocks hallucinations)     │
    │  • Zero-Test Smoke Safety Net (runs @smoke on 0 tests)  │
    └────────────────────────────┬────────────────────────────┘
                                 │
                                 ▼
                    Execute Targeted Playwright Tests
```

---

## 🛡️ Safety Guardrails

| Guardrail | Purpose | Behavior |
| :--- | :--- | :--- |
| **1. Docs Fast-Path** | Efficiency | If only documentation, markdown, or assets are modified, exits immediately with 0 tests run without calling Gemini. |
| **2. Domain Scatter Guard** | Blast radius | If changes touch more than 8 independent directories/domains, triggers full regression. Large PRs localized to a single feature folder remain targeted. |
| **3. Lockfile Sanitizer** | Prompt efficiency | Omits lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`) from Gemini prompts, sending version updates as brief summaries. |
| **4. Safe Default Fallback** | Reliability | If Gemini times out (20s), is unavailable, or indicates uncertain blast radius, safely defaults to running all tests. |
| **5. Direct Test Invariant** | Accuracy | Any `.spec.ts` modified in the PR is unconditionally included in the test run. |
| **6. Deleted File Purge** | Stability | Automatically excludes deleted test files from the execution list. |
| **7. Catalog Whitelist** | Validation | Cross-references recommendations against tests found on disk; unverified paths are discarded. |
| **8. Smoke Safety Net** | Safety net | If application code was changed but no specific test was matched, runs tests tagged `@smoke` as a baseline. |

---

## 📦 Installation & Quick Start

### 1. Install as a dev dependency

```bash
# npm
npm install --save-dev playwright-smart-test

# pnpm
pnpm add -D playwright-smart-test

# yarn
yarn add -D playwright-smart-test
```

### 2. Configure Gemini API Key
Obtain a free API key from [Google AI Studio](https://aistudio.google.com/). Set it in your environment or in a `.env` file in your project root:

```bash
export GEMINI_API_KEY="your-gemini-api-key"
```

### 3. Initialize Configuration
Generate `playwright-smart-test.config.json` in your repository root:

```bash
npx playwright-smart-test init
```

### 4. Run Analysis or Execute Tests

```bash
# Analyze PR diff against main branch (preview selection)
npx playwright-smart-test analyze --base origin/main

# Run only the impacted Playwright tests
npx playwright-smart-test run --base origin/main
```

---

## ⚙️ Configuration (`playwright-smart-test.config.json`)

Generate a starter configuration with `npx playwright-smart-test init` or create `playwright-smart-test.config.json` manually:

```json
{
  "testDir": "tests",
  "testMatch": ["**/*.spec.ts", "**/*.test.ts"],
  "pageObjectsDir": "src/pages",
  "components": [
    {
      "name": "checkout",
      "patterns": ["src/**/checkout*", "src/**/Checkout*"],
      "description": "Checkout flow, promo codes, and order calculation"
    },
    {
      "name": "payment",
      "patterns": ["src/**/payment*", "src/**/billing*"],
      "description": "Payment gateways, tokenization, and invoices"
    },
    {
      "name": "cart",
      "patterns": ["src/**/cart*", "src/**/basket*"],
      "description": "Shopping cart items, inventory checks, and quantities"
    }
  ],
  "safetyRules": {
    "maxChangedDomainsForFullRun": 8,
    "maxImpactRatioForFullRun": 0.7,
    "smokeTag": "@smoke",
    "smokeSpecPattern": "**/*smoke*.spec.ts",
    "docsOnlyPatterns": [
      "**/*.md",
      "docs/**",
      "LICENSE",
      "**/.gitignore",
      "**/assets/**"
    ],
    "fullRunPatterns": []
  },
  "ai": {
    "provider": "gemini",
    "model": "gemini-3.8-flash",
    "temperature": 0.2
  }
}
```

> **Model Flexibility**: You can configure any Gemini model (e.g. `gemini-3.8-flash`, `gemini-2.5-flash`, `gemini-1.5-pro`) or override it dynamically via the `GEMINI_MODEL` environment variable.

---

## 🚀 CLI Commands

| Command | Description |
| :--- | :--- |
| `playwright-smart-test analyze` | Analyzes Git diff and outputs terminal impact table without executing tests. |
| `playwright-smart-test run` | Analyzes Git diff and executes **only** the impacted Playwright specs. |
| `playwright-smart-test comment` | Analyzes diff, generates GitHub Flavored Markdown, and outputs PR report. |
| `playwright-smart-test init` | Generates a starter `playwright-smart-test.config.json` configuration file. |

### CLI Options
* `-b, --base <ref>`: Target Git branch or commit to diff against (e.g. `origin/main` or `HEAD~1`).
* `-h, --head <ref>`: Head Git commit/branch (default: working directory / `HEAD`).
* `--staged`: Analyze only staged git changes.
* `-c, --config <path>`: Path to custom configuration file.
* `-o, --output <path>`: Save report to `.md` or `.json` (e.g. `--output report.md`).
* `--dry-run`: Prints the generated Playwright test command without running it.

---

## 🔌 GitHub Actions CI/CD Integration

Add this step to your Pull Request workflow (`.github/workflows/regression.yml`):

```yaml
name: Playwright Smart Regression

on:
  pull_request:
    branches: [main, master]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Full history needed for git diff

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Install Playwright Browsers
        run: npx playwright install --with-deps

      - name: Run Smart Regression Analysis
        id: smart-regression
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
        run: |
          npx playwright-smart-test analyze --base "origin/${{ github.base_ref }}" --output pr-report.md
          npx playwright-smart-test run --base "origin/${{ github.base_ref }}"

      - name: Post PR Comment
        if: always()
        uses: thollander/actions-comment-pull-request@v2
        with:
          filePath: pr-report.md
          comment_tag: smart-regression-report
```

---

## 📊 Sample PR Impact Report

When running `playwright-smart-test comment` or saving with `--output`, the agent produces clean GitHub Flavored Markdown:

```markdown
## 🤖 Playwright Smart Regression Selection Report

**Risk Level:** 🟠 **HIGH**

| Scope | Identified Areas |
| :--- | :--- |
| **Changed Components** | `checkout`, `payment` |
| **Potentially Impacted Areas** | `cart`, `order-summary` |

### 🧠 AI Semantic Rationale
- **Direct Impact:** Modified voucher code calculation logic in CheckoutPage.
- **Ripple Effects:** Discount changes propagate into final payment charge payload.

### 🧪 Selected Regression Tests (3)

| Spec File | Selection Type | Rationale |
| :--- | :---: | :--- |
| `tests/checkout.spec.ts` | 🟢 Direct | Directly touches changed component 'checkout'. |
| `tests/payment.spec.ts` | 🟡 Ripple | Indirectly impacted by ripple effects on domain 'payment'. |
| `tests/cart.spec.ts` | 🟡 Ripple | Indirectly impacted by ripple effects on domain 'cart'. |

### ⚡ Playwright Execution Command
```bash
npx playwright test "tests/checkout.spec.ts" "tests/payment.spec.ts" "tests/cart.spec.ts"
```
```

---

## ❓ Frequently Asked Questions

#### What happens if the Gemini API goes down or times out?
The agent includes a **Safe Default Fallback**: if the API is unreachable, times out after 20 seconds, or encounters a quota limit, the agent safely runs the full Playwright regression suite so your CI pipeline is never blocked or compromised.

#### Does this work with custom Playwright fixtures?
Yes. Unlike static AST import tools that break on `test.extend<{ page }>`, the LLM Brain reads test files, test signatures, and tags directly. It understands fixture context without being tricked by shared `fixtures.ts` files.

#### Does it run tests if I only edit `README.md` or static assets?
No. **Guardrail 1 (Docs Fast-Path)** intercepts documentation and asset changes in 50ms, exiting with 0 tests run and 0 API calls.

---

## 📄 License

MIT © [Ujjwal S S](https://github.com/Ujjwal-S-S)
