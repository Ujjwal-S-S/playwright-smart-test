# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x.x   | ✅ Active  |

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Use [GitHub Private Vulnerability Reporting](https://github.com/Ujjwal-S-S/playwright-smart-test/security/advisories/new) or email the maintainer directly. We will investigate all reports but cannot guarantee a specific response or fix timeline.

---

## What This Package Does

`playwright-smart-test` is a **CLI dev tool** — it runs locally or in CI pipelines to analyze a git diff and select the minimal set of Playwright tests to run. It is **never installed as a runtime server-side dependency** in production applications.

Key behaviours:

- Reads your local git history (`git diff`) to detect changed files
- Scans your local `tests/` directory to build a test catalog
- Optionally calls the Google Gemini API to perform AI-powered impact analysis
- Spawns `playwright test` with the selected test files

---

## Dependency Chain

Direct runtime dependencies:

| Package | Purpose |
|---------|---------|
| `@google/genai` | Gemini API client — used only when an API key is configured |
| `commander` | CLI argument parsing |
| `dotenv` | Loads `.env` file for the API key |
| `glob` | File pattern matching to find spec files |
| `picocolors` | Terminal colour output |
| `zod` | Config and AI response schema validation |
