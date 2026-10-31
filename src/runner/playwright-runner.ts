import { spawn } from 'node:child_process';
import pc from 'picocolors';

export interface RunOptions {
  cwd?: string;
  command?: string;
}

export class PlaywrightRunner {
  public static async execute(command: string, cwd: string = process.cwd()): Promise<number> {
    console.log(pc.bold(pc.cyan(`\n🚀 Executing Playwright Regression Suite...`)));
    console.log(pc.gray(`$ ${command}\n`));

    return new Promise((resolve) => {
      // Split command into executable and args
      const parts = command.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
      const executable = parts[0] || 'npx';
      const args = parts.slice(1).map((a) => a.replace(/^"|"$/g, ''));

      const child = spawn(executable, args, {
        cwd,
        stdio: 'inherit',
        shell: true,
      });

      child.on('close', (code) => {
        resolve(code ?? 0);
      });

      child.on('error', (err) => {
        console.error(pc.red(`Failed to start Playwright runner: ${err.message}`));
        resolve(1);
      });
    });
  }
}
