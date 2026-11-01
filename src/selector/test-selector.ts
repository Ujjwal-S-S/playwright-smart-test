import path from 'node:path';
import {
  DiffFile,
  FinalSelectionResult,
  SmartRegressionConfig,
  SpecCatalogEntry,
} from '../config/schema.js';
import { AISemanticAnalyzer } from '../ai/ai-analyzer.js';

export class TestSelector {
  private aiAnalyzer: AISemanticAnalyzer;

  constructor(
    private config: SmartRegressionConfig,
    private cwd: string = process.cwd()
  ) {
    this.aiAnalyzer = new AISemanticAnalyzer(config);
  }

  public async selectTests(
    changedFiles: DiffFile[],
    catalog: SpecCatalogEntry[]
  ): Promise<FinalSelectionResult> {
    const allKnownSpecs = catalog.map((c) => c.filePath.replace(/\\/g, '/'));
    const deletedPaths = new Set(
      changedFiles.filter((f) => f.status === 'deleted').map((f) => f.path.replace(/\\/g, '/'))
    );

    // Guardrail 1: Docs & Asset Fast-Path
    if (this.isDocsAndAssetsOnly(changedFiles)) {
      return {
        isFullRegression: false,
        fullRegressionReason: undefined,
        changedFiles,
        changedComponents: [],
        impactedComponents: [],
        aiAnalysis: {
          changedComponents: [],
          impactedComponents: [],
          directReason: 'Only documentation, assets, or markdown files modified.',
          rippleEffectReason: 'No regression test execution required.',
          riskScore: 'LOW',
          requiresFullRegression: false,
          confidenceScore: 'HIGH',
          recommendedTests: [],
        },
        selectedSpecs: [],
        directlyModifiedSpecs: [],
        componentRuleSpecs: [],
        aiRecommendedSpecs: [],
        playwrightCommand: 'npx playwright test',
      };
    }

    // Guardrail: Configured Full Run Patterns (if user explicitly provided any)
    const customPatternTrigger = this.checkCustomFullRunPatterns(changedFiles);
    if (customPatternTrigger) {
      const aiAnalysis = await this.aiAnalyzer.analyzeImpact(changedFiles, catalog);
      return {
        isFullRegression: true,
        fullRegressionReason: customPatternTrigger,
        changedFiles,
        changedComponents: aiAnalysis.changedComponents,
        impactedComponents: aiAnalysis.impactedComponents,
        aiAnalysis,
        selectedSpecs: allKnownSpecs,
        directlyModifiedSpecs: [],
        componentRuleSpecs: [],
        aiRecommendedSpecs: allKnownSpecs,
        playwrightCommand: 'npx playwright test',
      };
    }

    // Guardrail 2: Domain Scatter Guard (Arch blast radius)
    const scatterCheck = this.checkDomainScatter(changedFiles);
    if (scatterCheck) {
      const aiAnalysis = await this.aiAnalyzer.analyzeImpact(changedFiles, catalog);
      return {
        isFullRegression: true,
        fullRegressionReason: scatterCheck,
        changedFiles,
        changedComponents: aiAnalysis.changedComponents,
        impactedComponents: aiAnalysis.impactedComponents,
        aiAnalysis,
        selectedSpecs: allKnownSpecs,
        directlyModifiedSpecs: [],
        componentRuleSpecs: [],
        aiRecommendedSpecs: allKnownSpecs,
        playwrightCommand: 'npx playwright test',
      };
    }

    // Guardrail 3: Directly Modified Test Specs Invariant
    const directlyModifiedSpecs = this.findDirectlyModifiedSpecs(changedFiles, allKnownSpecs);

    // Guardrail 4: Component Configuration Rules Match
    const componentRuleSpecs = this.findComponentRuleSpecs(changedFiles, catalog);

    // The AI Brain: Semantic Ripple & Impact Analysis
    let aiAnalysis = await this.aiAnalyzer.analyzeImpact(changedFiles, catalog);

    // Guardrail 5: AI Safe Fallback on Uncertainty or Global Infrastructure Flag
    let isFullRegression = false;
    let fullRegressionReason: string | undefined;

    if (aiAnalysis.requiresFullRegression || aiAnalysis.confidenceScore === 'LOW') {
      isFullRegression = true;
      fullRegressionReason = `AI indicated global impact or uncertain blast radius: ${aiAnalysis.directReason}`;
    }

    // Guardrail 6: Catalog Whitelist & Deleted File Purge
    const rawAiSpecs = aiAnalysis.recommendedTests.map((t) => t.specFile.replace(/\\/g, '/'));
    const validatedAiSpecs = this.normalizeAndFilterSpecs(rawAiSpecs, allKnownSpecs, deletedPaths);

    // Combine candidate specs
    const combinedSpecs = Array.from(
      new Set([
        ...directlyModifiedSpecs.filter((s) => !deletedPaths.has(s)),
        ...componentRuleSpecs.filter((s) => !deletedPaths.has(s)),
        ...validatedAiSpecs,
      ])
    );

    // Guardrail 7: Impact Threshold Ratio
    const totalSpecsCount = allKnownSpecs.length;
    const impactRatio = totalSpecsCount > 0 ? combinedSpecs.length / totalSpecsCount : 0;
    const maxRatio = this.config.safetyRules?.maxImpactRatioForFullRun ?? 0.7;

    if (!isFullRegression && totalSpecsCount >= 4 && impactRatio >= maxRatio) {
      isFullRegression = true;
      fullRegressionReason = `Impacted specs (${combinedSpecs.length}/${totalSpecsCount}, ${(impactRatio * 100).toFixed(0)}%) exceed threshold of ${(maxRatio * 100).toFixed(0)}%. Full regression triggered for safety.`;
    }

    // Guardrail 8: Zero-Test Smoke Safety Net
    let isSmokeFallback = false;
    let smokeFallbackReason: string | undefined;
    let finalSelectedSpecs = isFullRegression ? allKnownSpecs : combinedSpecs;

    if (!isFullRegression && finalSelectedSpecs.length === 0 && this.hasApplicationCodeChanged(changedFiles)) {
      const smokeSpecs = this.findSmokeTests(catalog);
      if (smokeSpecs.length > 0) {
        finalSelectedSpecs = smokeSpecs;
        isSmokeFallback = true;
        smokeFallbackReason = 'Application code was modified but no specific test was selected. Executing smoke test suite as safety baseline.';
      }
    }

    const playwrightCommand = this.buildPlaywrightCommand(
      finalSelectedSpecs,
      isFullRegression
    );

    return {
      isFullRegression,
      fullRegressionReason,
      isSmokeFallback,
      smokeFallbackReason,
      changedFiles,
      changedComponents: aiAnalysis.changedComponents,
      impactedComponents: aiAnalysis.impactedComponents,
      aiAnalysis,
      selectedSpecs: finalSelectedSpecs,
      directlyModifiedSpecs,
      componentRuleSpecs,
      aiRecommendedSpecs: validatedAiSpecs,
      playwrightCommand,
    };
  }

  private isDocsAndAssetsOnly(changedFiles: DiffFile[]): boolean {
    if (changedFiles.length === 0) return true;
    const docsPatterns = this.config.safetyRules?.docsOnlyPatterns || [
      '**/*.md',
      'docs/**',
      'LICENSE',
      '**/.gitignore',
      '**/assets/**',
      '**/*.png',
      '**/*.jpg',
      '**/*.svg',
    ];

    return changedFiles.every((file) => {
      const p = file.path.replace(/\\/g, '/');
      const base = path.basename(p);
      return docsPatterns.some((pattern) => this.simpleGlobMatch(p, pattern) || this.simpleGlobMatch(base, pattern));
    });
  }

  private checkCustomFullRunPatterns(changedFiles: DiffFile[]): string | null {
    const patterns = this.config.safetyRules?.fullRunPatterns || [];
    if (patterns.length === 0) return null;

    for (const file of changedFiles) {
      const p = file.path.replace(/\\/g, '/');
      const fileName = path.basename(p);
      for (const pattern of patterns) {
        if (this.simpleGlobMatch(p, pattern) || this.simpleGlobMatch(fileName, pattern)) {
          return `Critical configuration file modified: '${file.path}'. Full test suite required.`;
        }
      }
    }

    return null;
  }

  private hasApplicationCodeChanged(changedFiles: DiffFile[]): boolean {
    return changedFiles.some((f) => {
      const p = f.path.replace(/\\/g, '/');
      if (p.startsWith('tests/') || p.startsWith('docs/')) return false;
      return (
        p.endsWith('.ts') ||
        p.endsWith('.tsx') ||
        p.endsWith('.js') ||
        p.endsWith('.jsx') ||
        p.endsWith('.vue') ||
        p.endsWith('.html') ||
        p.endsWith('.json')
      );
    });
  }

  private checkDomainScatter(changedFiles: DiffFile[]): string | null {
    const maxDomains = this.config.safetyRules?.maxChangedDomainsForFullRun ?? 8;
    const domains = new Set<string>();

    for (const file of changedFiles) {
      const normalized = file.path.replace(/\\/g, '/');
      const parts = normalized.split('/').filter(Boolean);
      if (parts.length >= 2) {
        domains.add(`${parts[0]}/${parts[1]}`);
      } else if (parts.length === 1) {
        domains.add(parts[0]);
      }
    }

    if (domains.size > maxDomains) {
      return `Changes scattered across ${domains.size} architectural domains (exceeds threshold of ${maxDomains}). Full regression triggered for safety.`;
    }

    return null;
  }

  private findDirectlyModifiedSpecs(changedFiles: DiffFile[], allKnownSpecs: string[]): string[] {
    const knownSet = new Set(allKnownSpecs);
    const result: string[] = [];

    for (const file of changedFiles) {
      if (file.status === 'deleted') continue;
      const normalized = file.path.replace(/\\/g, '/');
      if (
        (normalized.endsWith('.spec.ts') || normalized.endsWith('.test.ts')) &&
        (knownSet.has(normalized) || allKnownSpecs.some((k) => k.endsWith(path.basename(normalized))))
      ) {
        const match = knownSet.has(normalized)
          ? normalized
          : allKnownSpecs.find((k) => k.endsWith(path.basename(normalized)))!;
        if (!result.includes(match)) {
          result.push(match);
        }
      }
    }

    return result;
  }

  private findComponentRuleSpecs(changedFiles: DiffFile[], catalog: SpecCatalogEntry[]): string[] {
    const components = this.config.components || [];
    if (components.length === 0) return [];

    const matchedComponents = new Set<string>();

    for (const file of changedFiles) {
      const p = file.path.replace(/\\/g, '/');
      for (const comp of components) {
        for (const pattern of comp.patterns) {
          if (this.simpleGlobMatch(p, pattern)) {
            matchedComponents.add(comp.name);
          }
        }
      }
    }

    const matchedSpecs: string[] = [];

    for (const compName of Array.from(matchedComponents)) {
      for (const spec of catalog) {
        const p = spec.filePath.replace(/\\/g, '/').toLowerCase();
        if (p.includes(compName.toLowerCase()) || spec.tags.some((t) => t.toLowerCase().includes(compName.toLowerCase()))) {
          if (!matchedSpecs.includes(spec.filePath)) {
            matchedSpecs.push(spec.filePath);
          }
        }
      }
    }

    return matchedSpecs;
  }

  private findSmokeTests(catalog: SpecCatalogEntry[]): string[] {
    const smokeTag = (this.config.safetyRules?.smokeTag || '@smoke').toLowerCase();
    const smokePattern = this.config.safetyRules?.smokeSpecPattern || '**/*smoke*.spec.ts';

    const smokeSpecs: string[] = [];

    for (const spec of catalog) {
      const p = spec.filePath.replace(/\\/g, '/');
      const hasSmokeTag = spec.tags.some((t) => t.toLowerCase() === smokeTag);
      const matchesPattern = this.simpleGlobMatch(p, smokePattern);

      if (hasSmokeTag || matchesPattern) {
        smokeSpecs.push(p);
      }
    }

    return smokeSpecs;
  }

  private normalizeAndFilterSpecs(
    candidateSpecs: string[],
    knownSpecs: string[],
    deletedPaths: Set<string>
  ): string[] {
    const knownSet = new Set(knownSpecs.map((s) => s.replace(/\\/g, '/')));
    const selected: string[] = [];

    for (const spec of candidateSpecs) {
      const norm = spec.replace(/\\/g, '/');
      if (deletedPaths.has(norm)) continue;

      if (knownSet.has(norm)) {
        selected.push(norm);
        continue;
      }

      const base = path.basename(norm);
      const match = knownSpecs.find((k) => k.endsWith(base));
      if (match && !deletedPaths.has(match) && !selected.includes(match)) {
        selected.push(match);
      }
    }

    return selected;
  }

  private simpleGlobMatch(str: string, pattern: string): boolean {
    let p = pattern;
    if (p.startsWith('**/')) {
      p = '(?:.+/)?' + p.slice(3);
    }
    if (p.endsWith('/**')) {
      p = p.slice(0, -3) + '(?:/.*)?';
    }

    const regexStr = p
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '§§')
      .replace(/\*/g, '[^/]*')
      .replace(/§§/g, '.*');
    return new RegExp(`^${regexStr}$`, 'i').test(str);
  }

  private buildPlaywrightCommand(selectedSpecs: string[], isFull: boolean): string {
    if (isFull || selectedSpecs.length === 0) {
      return 'npx playwright test';
    }

    const filesArgs = selectedSpecs.map((s) => `"${s}"`).join(' ');
    return `npx playwright test ${filesArgs}`;
  }
}
