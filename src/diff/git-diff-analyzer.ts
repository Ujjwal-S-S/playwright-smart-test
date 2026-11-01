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
    await this.runGit(['rev-parse', '--is-inside-work-tree']);

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

    const numstatOutput = await this.runGit(['diff', '--numstat', ...diffRangeArgs]);
    const numstatMap = this.parseNumstat(numstatOutput);

    const rawDiff = await this.runGit(['diff', ...diffRangeArgs]);
    const patchesByFile = this.splitPatches(rawDiff);

    const allPaths = Array.from(new Set([...numstatMap.keys(), ...patchesByFile.keys()]));
    const files: DiffFile[] = allPaths.map((filePath) => {
      const numstat = numstatMap.get(filePath) || { additions: 0, deletions: 0 };
      const patch = patchesByFile.get(filePath) || '';

      let status: DiffFile['status'] = 'modified';
      if (patch.includes('new file mode')) {
        status = 'added';
      } else if (patch.includes('deleted file mode')) {
        status = 'deleted';
      } else if (patch.includes('rename from ') || patch.includes('similarity index')) {
        status = 'renamed';
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
   * Split unified diff output into per-file patches.
   * Uses safe deterministic string operations to prevent polynomial regular expression DoS (CWE-1333).
   */
  public splitPatches(rawDiff: string): Map<string, string> {
    const filePatches = new Map<string, string>();
    if (!rawDiff.trim()) return filePatches;

    const diffSections = rawDiff.split(/(?=^diff --git )/m);

    for (const section of diffSections) {
      const trimmed = section.trim();
      if (!trimmed) continue;

      // Extract the header line without regex backtracking
      const newlineIndex = trimmed.indexOf('\n');
      const headerLine = (newlineIndex === -1 ? trimmed : trimmed.slice(0, newlineIndex)).trim();

      if (!headerLine.startsWith('diff --git ')) continue;

      const line = headerLine.slice(11); // Remove 'diff --git '
      const sepIndex = line.lastIndexOf(' b/');

      if (sepIndex !== -1) {
        let filePath = line.slice(sepIndex + 3).trim();
        // Fallback for deleted files where b/ is /dev/null
        if (filePath === '/dev/null' || filePath === 'dev/null') {
          const aPath = line.slice(0, sepIndex).trim();
          filePath = aPath.startsWith('a/') ? aPath.slice(2) : aPath;
        }

        // Clean quotes if path was enclosed in quotes by git
        if (filePath.startsWith('"') && filePath.endsWith('"')) {
          filePath = filePath.slice(1, -1);
        }

        if (filePath) {
          filePatches.set(filePath.replace(/\\/g, '/'), trimmed);
        }
      }
    }

    return filePatches;
  }
}
