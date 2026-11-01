import pc from 'picocolors';
import Table from 'cli-table3';
import { FinalSelectionResult } from '../config/schema.js';

export class TerminalReporter {
  public static report(result: FinalSelectionResult): void {
    console.log('\n' + pc.bold(pc.cyan('🤖 Smart Regression Selection Agent — Impact Analysis')));
    console.log(pc.gray('═'.repeat(65)));

    const riskBadge = this.formatRisk(result.aiAnalysis.riskScore);
    console.log(`${pc.bold('Risk Score:')} ${riskBadge}`);

    if (result.isFullRegression) {
      console.log(
        pc.yellow(`\n⚠️  FULL REGRESSION TRIGGERED: ${result.fullRegressionReason || 'Safety threshold reached.'}`)
      );
    } else if (result.isSmokeFallback) {
      console.log(
        pc.yellow(`\n⚠️  SMOKE SAFETY NET TRIGGERED: ${result.smokeFallbackReason}`)
      );
    }

    console.log(
      `\n${pc.bold('Changed Components:')} ${
        result.changedComponents.length > 0
          ? result.changedComponents.map((c) => pc.magenta(c)).join(', ')
          : pc.gray('None identified')
      }`
    );
    console.log(
      `${pc.bold('Potentially Impacted Areas:')} ${
        result.impactedComponents.length > 0
          ? result.impactedComponents.map((c) => pc.yellow(c)).join(', ')
          : pc.gray('None')
      }`
    );

    console.log(`\n${pc.bold('🧠 AI Impact Rationale:')}`);
    console.log(`  ${pc.white(result.aiAnalysis.directReason)}`);
    if (result.aiAnalysis.rippleEffectReason) {
      console.log(`  ${pc.italic(pc.gray(result.aiAnalysis.rippleEffectReason))}`);
    }

    console.log(`\n${pc.bold('🧪 Selected Playwright Regression Tests:')}`);
    const table = new Table({
      head: [pc.cyan('Spec File'), pc.cyan('Type'), pc.cyan('Reason')],
      colWidths: [35, 12, 35],
      wordWrap: true,
    });

    if (result.selectedSpecs.length === 0) {
      table.push([pc.gray('No tests selected'), pc.gray('-'), pc.gray('PR changes do not impact any existing tests')]);
    } else {
      for (const spec of result.selectedSpecs) {
        const aiRec = result.aiAnalysis.recommendedTests.find((t) => t.specFile.endsWith(spec) || spec.endsWith(t.specFile));
        const isIndirect = aiRec ? aiRec.isIndirectImpact : false;
        const typeLabel = isIndirect ? pc.yellow('Ripple') : pc.green('Direct');
        const reason = aiRec
          ? aiRec.reason
          : result.directlyModifiedSpecs?.includes(spec)
          ? 'Directly modified spec'
          : result.componentRuleSpecs?.includes(spec)
          ? 'Component mapping rule'
          : result.isSmokeFallback
          ? 'Smoke safety net fallback'
          : 'Impacted area';

        table.push([spec, typeLabel, reason]);
      }
    }

    console.log(table.toString());

    console.log(`\n${pc.bold('⚡ Playwright Execution Command:')}`);
    if (result.selectedSpecs.length === 0 && !result.isFullRegression) {
      console.log(`  ${pc.gray('No tests required for this change (0 impacted tests identified).')}\n`);
    } else {
      console.log(`  ${pc.green(result.playwrightCommand)}\n`);
    }
  }

  private static formatRisk(score: string): string {
    switch (score) {
      case 'CRITICAL':
        return pc.bgRed(pc.white(` ${score} `));
      case 'HIGH':
        return pc.red(pc.bold(score));
      case 'MEDIUM':
        return pc.yellow(pc.bold(score));
      case 'LOW':
      default:
        return pc.green(pc.bold(score));
    }
  }
}
