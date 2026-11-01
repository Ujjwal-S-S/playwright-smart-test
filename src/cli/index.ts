#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import pc from 'picocolors';
import { loadConfig } from '../config/index.js';
import { GitDiffAnalyzer } from '../diff/git-diff-analyzer.js';
import { TestCatalogIndexer } from '../catalog/test-catalog.js';
import { TestSelector } from '../selector/test-selector.js';
import { TerminalReporter } from '../reporters/terminal-reporter.js';
import { GitHubReporter } from '../reporters/github-reporter.js';
import { PlaywrightRunner } from '../runner/playwright-runner.js';

const program = new Command();

program
  .name('playwright-smart-test')
  .description('AI-Powered Smart Regression Test Selection Agent for Playwright')
  .version('1.0.1');

async function executeAnalysis(options: {
  base?: string;
  head?: string;
  staged?: boolean;
  config?: string;
  cwd?: string;
}) {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const config = loadConfig(cwd, options.config);

  console.log(pc.cyan(`\n🔍 Scanning repository at ${cwd}...`));

  const diffAnalyzer = new GitDiffAnalyzer(cwd);
  const changedFiles = await diffAnalyzer.getChangedFiles({
    base: options.base,
    head: options.head,
    staged: options.staged,
  });

  console.log(`Detected ${pc.yellow(changedFiles.length.toString())} modified files.`);

  const catalogIndexer = new TestCatalogIndexer(cwd);
  const catalog = await catalogIndexer.scanTestFiles(config.testDir, config.testMatch);
  console.log(`Indexed ${pc.yellow(catalog.length.toString())} Playwright spec files in '${config.testDir}'.`);

  const selector = new TestSelector(config, cwd);
  const result = await selector.selectTests(changedFiles, catalog);

  return { result, cwd, config };
}

program
  .command('analyze')
  .description('Analyze PR diff and identify impacted Playwright regression tests')
  .option('-b, --base <ref>', 'Base git commit/branch (e.g. origin/main or HEAD~1)')
  .option('-h, --head <ref>', 'Head git commit/branch (e.g. HEAD)')
  .option('--staged', 'Analyze only staged changes')
  .option('-c, --config <path>', 'Path to custom config file')
  .option('-o, --output <path>', 'Save analysis result to file (.json or .md)')
  .option('--cwd <dir>', 'Working directory', process.cwd())
  .action(async (options) => {
    try {
      const { result } = await executeAnalysis(options);
      TerminalReporter.report(result);

      if (options.output) {
        const outPath = path.resolve(options.cwd || process.cwd(), options.output);
        if (outPath.endsWith('.json')) {
          fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
          console.log(pc.green(`✓ Analysis saved to JSON: ${outPath}`));
        } else {
          const md = GitHubReporter.generateMarkdown(result);
          fs.writeFileSync(outPath, md, 'utf8');
          console.log(pc.green(`✓ Markdown PR report saved to: ${outPath}`));
        }
      }
    } catch (err) {
      console.error(pc.red(`Error during analysis: ${err instanceof Error ? err.message : String(err)}`));
      process.exit(1);
    }
  });

program
  .command('run')
  .description('Analyze PR diff and run the selected Playwright tests')
  .option('-b, --base <ref>', 'Base git commit/branch')
  .option('-h, --head <ref>', 'Head git commit/branch')
  .option('--staged', 'Analyze only staged changes')
  .option('-c, --config <path>', 'Path to custom config file')
  .option('--cwd <dir>', 'Working directory', process.cwd())
  .option('--dry-run', 'Print the command without executing')
  .action(async (options) => {
    try {
      const { result, cwd } = await executeAnalysis(options);
      TerminalReporter.report(result);

      if (options.dryRun) {
        console.log(pc.yellow(`[Dry-run] Would execute: ${result.playwrightCommand}`));
        return;
      }

      if (result.selectedSpecs.length === 0 && !result.isFullRegression) {
        console.log(pc.green('No regression tests required for this change. Exiting.'));
        return;
      }

      const exitCode = await PlaywrightRunner.execute(result.playwrightCommand, cwd);
      process.exit(exitCode);
    } catch (err) {
      console.error(pc.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
      process.exit(1);
    }
  });

program
  .command('comment')
  .description('Generate GitHub PR comment markdown')
  .option('-b, --base <ref>', 'Base git commit/branch')
  .option('-h, --head <ref>', 'Head git commit/branch')
  .option('--staged', 'Analyze only staged changes')
  .option('-c, --config <path>', 'Path to custom config file')
  .option('--cwd <dir>', 'Working directory', process.cwd())
  .action(async (options) => {
    try {
      const { result } = await executeAnalysis(options);
      const markdown = GitHubReporter.generateMarkdown(result);
      console.log(markdown);
    } catch (err) {
      console.error(pc.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Create a sample smart-regression.config.json file')
  .option('--cwd <dir>', 'Target directory', process.cwd())
  .action((options) => {
    const targetDir = options.cwd ? path.resolve(options.cwd) : process.cwd();
    const filePath = path.join(targetDir, 'smart-regression.config.json');

    const sample = {
      testDir: 'tests',
      testMatch: ['**/*.spec.ts'],
      pageObjectsDir: 'src/pages',
      components: [
        { name: 'checkout', patterns: ['src/**/checkout*'] },
        { name: 'payment', patterns: ['src/**/payment*'] },
        { name: 'basket', patterns: ['src/**/basket*', 'src/**/cart*'] }
      ],
      safetyRules: {
        maxChangedDomainsForFullRun: 8,
        maxImpactRatioForFullRun: 0.7,
        smokeTag: '@smoke',
        smokeSpecPattern: '**/*smoke*.spec.ts',
        fullRunPatterns: []
      },
      ai: {
        provider: 'gemini',
        model: 'gemini-3.8-flash',
        temperature: 0.2
      }
    };

    fs.writeFileSync(filePath, JSON.stringify(sample, null, 2), 'utf8');
    console.log(pc.green(`✓ Initialized configuration file at: ${filePath}`));
  });

program.parse(process.argv);
