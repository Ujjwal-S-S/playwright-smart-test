import path from 'node:path';
import {
  DiffFile,
  FinalSelectionResult,
  SmartRegressionConfig,
  SpecCatalogEntry,
} from '../config/schema.js';
import { AISemanticAnalyzer } from '../ai/ai-analyzer.js';
import { ASTDependencyGraph } from '../graph/dependency-graph.js';

export class TestSelector {
  private aiAnalyzer: AISemanticAnalyzer;
  private astGraph: ASTDependencyGraph;

  constructor(
    private config: SmartRegressionConfig,
    private cwd: string = process.cwd()
  ) {
    this.aiAnalyzer = new AISemanticAnalyzer(config);
    this.astGraph = new ASTDependencyGraph(cwd);
  }

  public async selectTests(
    changedFiles: DiffFile[],
    catalog: SpecCatalogEntry[]
  ): Promise<FinalSelectionResult> {
    const allKnownSpecs = catalog.map((c) => c.filePath);

    // 1. Check Safety Rules (e.g., config / infra changes require full run)
    const safetyTrigger = this.checkSafetyRules(changedFiles);
    if (safetyTrigger) {
      const aiAnalysis = await this.aiAnalyzer.analyzeImpact(changedFiles, catalog);
      return {
        isFullRegression: true,
        fullRegressionReason: safetyTrigger,
        changedFiles,
        changedComponents: aiAnalysis.changedComponents,
        impactedComponents: aiAnalysis.impactedComponents,
        aiAnalysis,
        selectedSpecs: allKnownSpecs,
        astDirectSpecs: allKnownSpecs,
        aiRecommendedSpecs: allKnownSpecs,
        playwrightCommand: 'npx playwright test',
      };
    }

    // 2. Mandatory AI Semantic Analysis
    const aiAnalysis = await this.aiAnalyzer.analyzeImpact(changedFiles, catalog);

    // 3. Build & Query AST Dependency Graph
    await this.astGraph.buildGraph([this.config.testDir, this.config.pageObjectsDir, 'src']);
    const changedPaths = changedFiles.map((f) => f.path);
    const astDirectSpecs = this.astGraph.findImpactedTestSpecs(changedPaths, allKnownSpecs);

    // 4. Merge AI Recommendations + AST Direct Specs
    const aiSpecs = aiAnalysis.recommendedTests.map((t) => t.specFile);
    const combinedSpecs = Array.from(new Set([...astDirectSpecs, ...aiSpecs]));

    // Normalize paths to match catalog paths
    const finalSelectedSpecs = this.normalizeAndFilterSpecs(combinedSpecs, allKnownSpecs);

    // 5. Evaluate Impact Ratio
    const totalSpecsCount = allKnownSpecs.length;
    const impactRatio = totalSpecsCount > 0 ? finalSelectedSpecs.length / totalSpecsCount : 0;
    const maxRatio = this.config.safetyRules?.maxImpactRatioForFullRun ?? 0.7;

    let isFullRegression = false;
    let fullRegressionReason: string | undefined;

    if (totalSpecsCount > 0 && impactRatio >= maxRatio && totalSpecsCount >= 4) {
      isFullRegression = true;
      fullRegressionReason = `Impacted specs (${finalSelectedSpecs.length}/${totalSpecsCount}, ${(impactRatio * 100).toFixed(0)}%) exceed threshold of ${(maxRatio * 100).toFixed(0)}%. Full regression triggered for safety.`;
    }

    // 6. Generate Playwright Command
    const playwrightCommand = this.buildPlaywrightCommand(
      isFullRegression ? allKnownSpecs : finalSelectedSpecs,
      isFullRegression
    );

    return {
      isFullRegression,
      fullRegressionReason,
      changedFiles,
      changedComponents: aiAnalysis.changedComponents,
      impactedComponents: aiAnalysis.impactedComponents,
      aiAnalysis,
      selectedSpecs: isFullRegression ? allKnownSpecs : finalSelectedSpecs,
      astDirectSpecs,
      aiRecommendedSpecs: aiSpecs,
      playwrightCommand,
    };
  }

  private checkSafetyRules(changedFiles: DiffFile[]): string | null {
    const patterns = this.config.safetyRules?.fullRunPatterns || [
      'playwright.config.*',
      'package.json',
      'package-lock.json',
    ];

    for (const file of changedFiles) {
      const fileName = path.basename(file.path);
      for (const pattern of patterns) {
        if (this.simpleGlobMatch(file.path, pattern) || this.simpleGlobMatch(fileName, pattern)) {
          return `Critical configuration file modified: '${file.path}'. Full test suite required.`;
        }
      }
    }

    return null;
  }

  private simpleGlobMatch(str: string, pattern: string): boolean {
    const regexStr = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '§§')
      .replace(/\*/g, '[^/]*')
      .replace(/§§/g, '.*');
    return new RegExp(`^${regexStr}$`).test(str);
  }

  private normalizeAndFilterSpecs(candidateSpecs: string[], knownSpecs: string[]): string[] {
    const knownSet = new Set(knownSpecs.map((s) => s.replace(/\\/g, '/')));
    const selected: string[] = [];

    for (const spec of candidateSpecs) {
      const norm = spec.replace(/\\/g, '/');
      if (knownSet.has(norm)) {
        selected.push(norm);
        continue;
      }

      // Check if partial filename matches any known spec
      const base = path.basename(norm);
      const match = knownSpecs.find((k) => k.endsWith(base));
      if (match && !selected.includes(match)) {
        selected.push(match);
      }
    }

    return selected;
  }

  private buildPlaywrightCommand(selectedSpecs: string[], isFull: boolean): string {
    if (isFull || selectedSpecs.length === 0) {
      return 'npx playwright test';
    }

    // Join spec file paths
    const filesArgs = selectedSpecs.map((s) => `"${s}"`).join(' ');
    return `npx playwright test ${filesArgs}`;
  }
}
