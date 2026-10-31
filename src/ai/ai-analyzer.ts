import { GoogleGenAI } from '@google/genai';
import {
  AIConfigSchema,
  AIImpactAnalysis,
  AIImpactAnalysisSchema,
  DiffFile,
  SpecCatalogEntry,
  SmartRegressionConfig,
} from '../config/schema.js';

export class AISemanticAnalyzer {
  private genAI?: GoogleGenAI;
  private apiKey?: string;
  private modelName: string;

  constructor(private config: SmartRegressionConfig) {
    this.apiKey = config.ai.apiKey || process.env.GEMINI_API_KEY;
    this.modelName = config.ai.model || 'gemini-3.8-flash';

    if (this.apiKey) {
      this.genAI = new GoogleGenAI({ apiKey: this.apiKey });
    }
  }

  public async analyzeImpact(
    changedFiles: DiffFile[],
    catalog: SpecCatalogEntry[]
  ): Promise<AIImpactAnalysis> {
    if (changedFiles.length === 0) {
      return {
        changedComponents: [],
        impactedComponents: [],
        directReason: 'No changed files detected in PR diff.',
        rippleEffectReason: 'No regression tests needed.',
        riskScore: 'LOW',
        recommendedTests: [],
      };
    }

    // Try AI generation if API key is configured
    if (this.genAI && this.apiKey) {
      try {
        return await this.callGemini(changedFiles, catalog);
      } catch (err) {
        console.warn(`[smart-test] AI Provider error (${err instanceof Error ? err.message : String(err)}). Falling back to built-in semantic inference.`);
      }
    }

    // Fallback semantic inference engine (ensures offline reliability & unit test reproducibility)
    return this.inferSemanticImpactLocally(changedFiles, catalog);
  }

  private async callGemini(
    changedFiles: DiffFile[],
    catalog: SpecCatalogEntry[]
  ): Promise<AIImpactAnalysis> {
    const prompt = this.buildPrompt(changedFiles, catalog);

    const response = await this.genAI!.models.generateContent({
      model: this.modelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: this.config.ai.temperature ?? 0.2,
      },
    });

    const responseText = response.text || '';
    const parsedJson = JSON.parse(responseText);

    // Validate strictly with Zod schema
    return AIImpactAnalysisSchema.parse(parsedJson);
  }

  public buildPrompt(changedFiles: DiffFile[], catalog: SpecCatalogEntry[]): string {
    const diffsSummary = changedFiles.map((f) => {
      const patchPreview = f.patch ? f.patch.slice(0, 3000) : '(No patch content)';
      return `File: ${f.path} [${f.status}] (+${f.additions}/-${f.deletions})\nDiff:\n${patchPreview}`;
    }).join('\n\n--- FILE BREAK ---\n\n');

    const catalogSummary = catalog.map((s) => {
      return `- Spec: ${s.filePath}\n  Tests: ${s.testTitles.slice(0, 5).join(', ') || 'N/A'}\n  Tags: ${s.tags.join(', ') || 'none'}\n  Imports: ${s.importedModules.join(', ')}`;
    }).join('\n');

    return `You are a Principal Test Automation Architect and AI Regression Agent for Playwright.
Analyze the following Pull Request Git diff and determine the exact regression test suite required.

PR MODIFIED FILES & DIFFS:
${diffsSummary}

AVAILABLE PLAYWRIGHT TEST SPECS IN THE REPOSITORY:
${catalogSummary}

DOMAIN & WORKFLOW HEURISTICS TO EVALUATE:
1. Identify all functional components changed (e.g. checkout, cart/basket, payment, auth, dashboard).
2. Trace ripple effects:
   - For example: if 'checkout' changes, examine if upstream pre-conditions (basket/cart validation, order calculations) and downstream steps (payment processing, order confirmation) are impacted.
   - If an auth token or session logic changes, examine checkout, user profile, and protected dashboards.
3. Select the minimal necessary Playwright test specs from the catalog that MUST run to guarantee no regression.
4. Assess the overall risk score (LOW, MEDIUM, HIGH, CRITICAL).

CRITICAL REQUIREMENT:
Respond ONLY with a valid JSON object matching this schema:
{
  "changedComponents": string[],
  "impactedComponents": string[],
  "directReason": string,
  "rippleEffectReason": string,
  "riskScore": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "recommendedTests": [
    {
      "specFile": string (must match an existing spec from the catalog),
      "testTitles": string[] (optional specific tests),
      "reason": string,
      "isIndirectImpact": boolean
    }
  ]
}`;
  }

  /**
   * Deterministic semantic heuristic engine
   * Applied when no network/API key is provided or as offline fallback.
   * Understands domain relationships like checkout -> payment + basket.
   */
  public inferSemanticImpactLocally(
    changedFiles: DiffFile[],
    catalog: SpecCatalogEntry[]
  ): AIImpactAnalysis {
    const changedComponents = new Set<string>();
    const impactedComponents = new Set<string>();
    const recommendedTests: AIImpactAnalysis['recommendedTests'] = [];

    // Predefined domain relationship graph for common web workflows
    const domainRippleMap: Record<string, string[]> = {
      checkout: ['payment', 'cart', 'basket', 'order'],
      payment: ['checkout', 'order', 'billing'],
      cart: ['checkout', 'basket', 'inventory'],
      basket: ['checkout', 'cart', 'inventory'],
      auth: ['login', 'profile', 'checkout', 'dashboard'],
      login: ['auth', 'dashboard', 'checkout'],
      product: ['catalog', 'search', 'cart'],
    };

    // Extract changed component names from file paths and patches
    for (const file of changedFiles) {
      const lower = file.path.toLowerCase();
      for (const domain of Object.keys(domainRippleMap)) {
        if (lower.includes(domain)) {
          changedComponents.add(domain);
        }
      }
    }

    // If no specific domains matched, extract base folder or filename
    if (changedComponents.size === 0) {
      for (const file of changedFiles) {
        const parts = file.path.split('/');
        const name = parts[parts.length - 1].replace(/\.[^/.]+$/, '');
        changedComponents.add(name);
      }
    }

    // Expand ripple effects
    for (const comp of Array.from(changedComponents)) {
      const ripples = domainRippleMap[comp] || [];
      for (const r of ripples) {
        impactedComponents.add(r);
      }
    }

    // Match catalog tests to changed and impacted components
    const specMap = new Map<string, SpecCatalogEntry>();
    for (const spec of catalog) {
      specMap.set(spec.filePath, spec);
    }

    for (const spec of catalog) {
      const lowerSpec = spec.filePath.toLowerCase();
      let matchedDirect = false;
      let matchedIndirect = false;
      let reason = '';

      // Check direct matches
      for (const comp of Array.from(changedComponents)) {
        if (lowerSpec.includes(comp) || spec.tags.some((t) => t.toLowerCase().includes(comp))) {
          matchedDirect = true;
          reason = `Directly touches changed component '${comp}'.`;
          break;
        }
      }

      // Check ripple matches
      if (!matchedDirect) {
        for (const ripple of Array.from(impactedComponents)) {
          if (lowerSpec.includes(ripple) || spec.tags.some((t) => t.toLowerCase().includes(ripple))) {
            matchedIndirect = true;
            reason = `Indirectly impacted by ripple effects on domain '${ripple}'.`;
            break;
          }
        }
      }

      if (matchedDirect || matchedIndirect) {
        recommendedTests.push({
          specFile: spec.filePath,
          testTitles: spec.testTitles.slice(0, 3),
          reason,
          isIndirectImpact: matchedIndirect,
        });
      }
    }

    const changedList = Array.from(changedComponents);
    const impactedList = Array.from(impactedComponents);

    return {
      changedComponents: changedList,
      impactedComponents: impactedList,
      directReason: `PR modified files in component(s): ${changedList.join(', ')}.`,
      rippleEffectReason: impactedList.length > 0
        ? `Workflow analysis identified potential ripple effects across connected business flows: ${impactedList.join(', ')}.`
        : 'Isolated component changes without cross-domain ripple effects.',
      riskScore: changedList.includes('checkout') || changedList.includes('payment') ? 'HIGH' : 'MEDIUM',
      recommendedTests,
    };
  }
}
