import { z } from 'zod';

export const AIConfigSchema = z.object({
  provider: z.literal('gemini').default('gemini'),
  apiKey: z.string().optional(),
  model: z.string().default('gemini-3.8-flash'),
  temperature: z.number().min(0).max(1).default(0.2),
});

export const ComponentRuleSchema = z.object({
  name: z.string(),
  patterns: z.array(z.string()),
  description: z.string().optional(),
});

export const SmartRegressionConfigSchema = z.object({
  testDir: z.string().default('tests'),
  testMatch: z.array(z.string()).default(['**/*.spec.ts', '**/*.test.ts']),
  pageObjectsDir: z.string().default('src/pages'),
  components: z.array(ComponentRuleSchema).default([]),
  safetyRules: z.object({
    fullRunPatterns: z.array(z.string()).default([]),
    maxImpactRatioForFullRun: z.number().min(0).max(1).default(0.7),
    maxChangedDomainsForFullRun: z.number().default(8),
    smokeTag: z.string().default('@smoke'),
    smokeSpecPattern: z.string().default('**/*smoke*.spec.ts'),
    docsOnlyPatterns: z.array(z.string()).default([
      '**/*.md',
      'docs/**',
      'LICENSE',
      '**/.gitignore',
      '**/assets/**',
      '**/*.png',
      '**/*.jpg',
      '**/*.svg',
    ]),
  }).default({
    fullRunPatterns: [],
    maxImpactRatioForFullRun: 0.7,
    maxChangedDomainsForFullRun: 8,
    smokeTag: '@smoke',
    smokeSpecPattern: '**/*smoke*.spec.ts',
    docsOnlyPatterns: [
      '**/*.md',
      'docs/**',
      'LICENSE',
      '**/.gitignore',
      '**/assets/**',
      '**/*.png',
      '**/*.jpg',
      '**/*.svg',
    ],
  }),
  ai: AIConfigSchema.default({
    provider: 'gemini',
    model: 'gemini-3.8-flash',
    temperature: 0.2,
  }),
});

export type SmartRegressionConfig = z.infer<typeof SmartRegressionConfigSchema>;

export const AISelectedTestSchema = z.object({
  specFile: z.string().describe('Relative path to the Playwright spec file'),
  testTitles: z.array(z.string()).optional().describe('Specific test titles or describe blocks to target'),
  reason: z.string().describe('Detailed rationale for why this test is affected'),
  isIndirectImpact: z.boolean().describe('True if impacted due to workflow/transitive side effect rather than direct import'),
});

export const AIImpactAnalysisSchema = z.object({
  changedComponents: z.array(z.string()).describe('Identified components directly modified in the diff (e.g. checkout, payment)'),
  impactedComponents: z.array(z.string()).describe('Upstream or downstream components impacted by this change (e.g. basket, order-summary)'),
  directReason: z.string().describe('Summary of the direct code changes and their purpose'),
  rippleEffectReason: z.string().describe('Explanation of the ripple effects across related business flows'),
  riskScore: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).describe('Risk level of the change'),
  requiresFullRegression: z.boolean().default(false).describe('True if changes affect global infrastructure or blast radius cannot be isolated'),
  confidenceScore: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('HIGH').describe('Confidence in isolating impact'),
  recommendedTests: z.array(AISelectedTestSchema).describe('List of recommended Playwright tests to execute'),
});

export type AIImpactAnalysis = z.infer<typeof AIImpactAnalysisSchema>;

export interface DiffFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  patch?: string;
}

export interface SpecCatalogEntry {
  filePath: string;
  testTitles: string[];
  tags: string[];
  importedModules: string[];
}

export interface FinalSelectionResult {
  isFullRegression: boolean;
  fullRegressionReason?: string;
  isSmokeFallback?: boolean;
  smokeFallbackReason?: string;
  changedFiles: DiffFile[];
  changedComponents: string[];
  impactedComponents: string[];
  aiAnalysis: AIImpactAnalysis;
  selectedSpecs: string[];
  directlyModifiedSpecs: string[];
  componentRuleSpecs: string[];
  aiRecommendedSpecs: string[];
  grepFilter?: string;
  playwrightCommand: string;
}
