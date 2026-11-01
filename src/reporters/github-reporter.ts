import { FinalSelectionResult } from '../config/schema.js';

export class GitHubReporter {
  public static generateMarkdown(result: FinalSelectionResult): string {
    const riskBadge = this.getRiskBadge(result.aiAnalysis.riskScore);

    const changedBadges = result.changedComponents.length > 0
      ? result.changedComponents.map((c) => `\`${c}\``).join(', ')
      : '_None identified_';

    const impactedBadges = result.impactedComponents.length > 0
      ? result.impactedComponents.map((c) => `\`${c}\``).join(', ')
      : '_None_';

    let markdown = `## 🤖 Playwright Smart Regression Selection Report\n\n`;
    markdown += `**Risk Level:** ${riskBadge}\n\n`;

    if (result.isFullRegression) {
      markdown += `> [!WARNING]\n`;
      markdown += `> **Full Regression Suite Triggered**: ${result.fullRegressionReason || 'Critical configuration or high impact threshold reached.'}\n\n`;
    } else if (result.isSmokeFallback) {
      markdown += `> [!NOTE]\n`;
      markdown += `> **Smoke Safety Net Activated**: ${result.smokeFallbackReason}\n\n`;
    }

    markdown += `| Scope | Identified Areas |\n`;
    markdown += `| :--- | :--- |\n`;
    markdown += `| **Changed Components** | ${changedBadges} |\n`;
    markdown += `| **Potentially Impacted Areas** | ${impactedBadges} |\n\n`;

    markdown += `### 🧠 AI Semantic Rationale\n`;
    markdown += `- **Direct Impact:** ${result.aiAnalysis.directReason}\n`;
    if (result.aiAnalysis.rippleEffectReason) {
      markdown += `- **Ripple Effects:** ${result.aiAnalysis.rippleEffectReason}\n`;
    }
    markdown += `\n`;

    markdown += `### 🧪 Selected Regression Tests (${result.selectedSpecs.length})\n\n`;

    if (result.selectedSpecs.length === 0) {
      markdown += `_No tests selected. Changes do not impact any existing test suites._\n\n`;
    } else {
      markdown += `| Spec File | Selection Type | Rationale |\n`;
      markdown += `| :--- | :---: | :--- |\n`;

      for (const spec of result.selectedSpecs) {
        const aiRec = result.aiAnalysis.recommendedTests.find(
          (t) => t.specFile.endsWith(spec) || spec.endsWith(t.specFile)
        );
        const isIndirect = aiRec ? aiRec.isIndirectImpact : false;
        const typeBadge = isIndirect ? '🟡 Ripple' : '🟢 Direct';
        const reason = aiRec
          ? aiRec.reason
          : result.directlyModifiedSpecs?.includes(spec)
          ? 'Directly modified spec'
          : result.componentRuleSpecs?.includes(spec)
          ? 'Component mapping rule'
          : result.isSmokeFallback
          ? 'Smoke safety net fallback'
          : 'Impacted area';

        markdown += `| \`${spec}\` | ${typeBadge} | ${reason} |\n`;
      }
      markdown += `\n`;
    }

    markdown += `### ⚡ Playwright Execution Command\n`;
    markdown += `\`\`\`bash\n${result.playwrightCommand}\n\`\`\`\n\n`;
    markdown += `---\n*Generated automatically by Smart Regression Selection Agent*`;

    return markdown;
  }

  private static getRiskBadge(score: string): string {
    switch (score) {
      case 'CRITICAL':
        return '🔴 **CRITICAL**';
      case 'HIGH':
        return '🟠 **HIGH**';
      case 'MEDIUM':
        return '🟡 **MEDIUM**';
      case 'LOW':
      default:
        return '🟢 **LOW**';
    }
  }
}
