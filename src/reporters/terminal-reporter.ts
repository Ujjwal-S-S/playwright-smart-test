import pc from 'picocolors';
import { FinalSelectionResult } from '../config/schema.js';

// Lightweight table renderer — replaces cli-table3 (which pulled in the
// deprecated @colors/colors package, flagged by Socket supply-chain checks).

function padEnd(str: string, len: number): string {
  // Strip ANSI escape codes for accurate length measurement
  const visible = str.replace(/\x1B\[[0-9;]*m/g, '');
  const pad = Math.max(0, len - visible.length);
  return str + ' '.repeat(pad);
}

function renderTable(
  headers: string[],
  rows: string[][],
  colWidths: number[]
): string {
  const sep = '─';
  const buildDivider = (left: string, mid: string, right: string) =>
    left + colWidths.map((w) => sep.repeat(w + 2)).join(mid) + right;

  const renderRow = (cells: string[]) =>
    '│ ' + cells.map((c, i) => padEnd(c, colWidths[i])).join(' │ ') + ' │';

  const top    = buildDivider('┌', '┬', '┐');
  const middle = buildDivider('├', '┼', '┤');
  const bottom = buildDivider('└', '┴', '┘');

  const lines = [
    top,
    renderRow(headers),
    middle,
    ...rows.map(renderRow),
    bottom,
  ];
  return lines.join('\n');
}

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

    const headers = [pc.cyan('Spec File'), pc.cyan('Type'), pc.cyan('Reason')];
    const colWidths = [35, 10, 35];
    const rows: string[][] = [];

    if (result.selectedSpecs.length === 0) {
      rows.push([
        pc.gray('No tests selected'),
        pc.gray('-'),
        pc.gray('PR changes do not impact any existing tests'),
      ]);
    } else {
      for (const spec of result.selectedSpecs) {
        const aiRec = result.aiAnalysis.recommendedTests.find(
          (t) => t.specFile.endsWith(spec) || spec.endsWith(t.specFile)
        );
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

        rows.push([spec, typeLabel, reason]);
      }
    }

    console.log(renderTable(headers, rows, colWidths));

    console.log(`\n${pc.bold('⚡ Playwright Execution Command:')}`);
    console.log(`  ${pc.green(result.playwrightCommand)}\n`);
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
