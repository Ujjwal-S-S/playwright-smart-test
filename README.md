# 🤖 Smart Regression Agent (`@ujjwal-s-s/smart-regression-agent`)

> AI-Powered Smart Regression Test Selection Agent for Playwright test suites.
> Analyzes Pull Request diffs using **Google Gemini**, traces cross-component ripple effects, and executes only the impacted Playwright tests.

---

## 📦 Installation

Install as a dev dependency in your Playwright project:

```bash
npm install --save-dev @ujjwal-s-s/smart-regression-agent
```

Or run directly with `npx`:

```bash
npx smart-test analyze
```

---

## ⚙️ Configuration (`smart-regression.config.json`)

Add `smart-regression.config.json` to the root of your Playwright project:

```json
{
  "testDir": "playwright/e2e/tests",
  "testMatch": ["**/*.spec.ts"],
  "pageObjectsDir": "playwright/e2e/pages",
  "components": [
    {
      "name": "checkout",
      "patterns": ["src/**/Checkout*", "playwright/e2e/**/checkout*"]
    },
    {
      "name": "payment",
      "patterns": ["src/**/Payment*", "playwright/e2e/**/payment*"]
    },
    {
      "name": "cart",
      "patterns": ["src/**/Cart*", "playwright/e2e/**/cart*"]
    }
  ],
  "safetyRules": {
    "fullRunPatterns": ["playwright.config.*", "package.json"],
    "maxImpactRatioForFullRun": 0.8
  },
  "ai": {
    "provider": "gemini",
    "model": "gemini-3.5-flash-lite",
    "temperature": 0.2
  }
}
```

> **Note**: Any Gemini model can be configured in `"ai.model"` (e.g., `gemini-3.5-flash-lite`, `gemini-2.5-flash`, `gemini-1.5-pro`) or overridden dynamically via the `GEMINI_MODEL` environment variable.

---

## 🚀 CLI Commands

| Command | Description |
| :--- | :--- |
| `smart-test analyze` | Analyzes Git diff and outputs impact analysis table without running tests. |
| `smart-test run` | Analyzes Git diff and executes **only** the impacted Playwright specs. |
| `smart-test comment` | Analyzes diff, generates markdown report, and posts comment on GitHub PR. |

### CLI Options
- `--base <branch>`: Target Git branch to diff against (default: `origin/main` or `main`).
- `--output <file>`: Export report markdown to a file (e.g. `--output pr-report.md`).

---

## 🔌 Plug & Play GitHub Actions CI

Add this step to your project's GitHub Actions workflow:

```yaml
- name: Run Smart Regression Tests
  env:
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    npx @ujjwal-s-s/smart-regression-agent comment --base "origin/${{ github.base_ref || 'main' }}"
    npx @ujjwal-s-s/smart-regression-agent run --base "origin/${{ github.base_ref || 'main' }}"
```

---

## 📄 License
MIT © Ujjwal S S
