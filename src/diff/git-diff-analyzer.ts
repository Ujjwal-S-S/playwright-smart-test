import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DiffFile } from '../config/schema.js';

const execFileAsync = promisify(execFile);

export interface DiffOptions {
  base?: string;
  head?: string;
  staged?: boolean;
}

export class GitDiffAnalyzer {
  constructor(private cwd: string = process.cwd()) {}

  private async runGit(args: string[]): Promise<string> {
    try {
      const { stdout } = await execFileAsync('git', args, {
        cwd: this.cwd,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });
      return stdout;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Git command failed [git ${args.join(' ')}]: ${message}`);
    }
  }

  public async getChangedFiles(options: DiffOptions = {}): Promise<DiffFile[]> {
    // 1. Verify repository
    await this.runGit(['rev-parse', '--is-inside-work-tree']);

    // 2. Determine diff arguments
    let diffRangeArgs: string[];
    if (options.base && options.head) {
      diffRangeArgs = [`${options.base}...${options.head}`];
    } else if (options.base) {
      diffRangeArgs = [options.base];
    } else if (options.staged) {
      diffRangeArgs = ['--cached'];
    } else {
      diffRangeArgs = ['HEAD'];
    }

    // 3. Get numstat summary (additions, deletions, path)
    const numstatOutput = await this.runGit(['diff', '--numstat', ...diffRangeArgs]);
    const numstatMap = this.parseNumstat(numstatOutput);

    // 4. Get full unified diff patch
    const rawDiff = await this.runGit(['diff', ...diffRangeArgs]);
    const patchesByFile = this.splitPatches(rawDiff);

    // 5. Build structured DiffFile list
    const allPaths = Array.from(new Set([...numstatMap.keys(), ...patchesByFile.keys()]));
    const files: DiffFile[] = allPaths.map((filePath) => {
      const numstat = numstatMap.get(filePath) || { additions: 0, deletions: 0 };
      const patch = patchesByFile.get(filePath) || '';

      let status: DiffFile['status'] = 'modified';
      if (patch.includes('new file mode')) {
        status = 'added';
      } else if (patch.includes('deleted file mode')) {
        status = 'deleted';
      }

      return {
        path: filePath.replace(/\\/g, '/'),
        status,
        additions: numstat.additions,
        deletions: numstat.deletions,
        patch,
      };
    });

    return files;
  }

  /**
   * Parse git diff --numstat output:
   * <additions>\t<deletions>\t<file>
   */
  public parseNumstat(output: string): Map<string, { additions: number; deletions: number }> {
    const map = new Map<string, { additions: number; deletions: number }>();
    const lines = output.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const parts = trimmed.split(/\s+/);
      if (parts.length >= 3) {
        const additions = parts[0] === '-' ? 0 : parseInt(parts[0], 10) || 0;
        const deletions = parts[1] === '-' ? 0 : parseInt(parts[1], 10) || 0;
        const filePath = parts.slice(2).join(' ').replace(/\\/g, '/');
        map.set(filePath, { additions, deletions });
      }
    }

    return map;
  }

  /**
   * Split unified diff output into per-file patches
   */
  public splitPatches(rawDiff: string): Map<string, string> {
    const filePatches = new Map<string, string>();
    if (!rawDiff.trim()) return filePatches;

    const diffSections = rawDiff.split(/(?=^diff --git )/m);

    for (const section of diffSections) {
      if (!section.trim()) continue;
      const match = section.match(/^diff --git a\/(.+?) b\/(.+?)$/m);
      if (match) {
        const filePath = match[2] || match[1];
        filePatches.set(filePath.replace(/\\/g, '/'), section.trim());
      }
    }

    return filePatches;
  }
}
