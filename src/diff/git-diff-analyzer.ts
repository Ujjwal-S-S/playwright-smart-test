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

  private sanitizeGitRef(ref: string | undefined): string | null {
    if (!ref) {
      return null;
    }

    const safeRef = ref.trim();
    if (!safeRef || safeRef.includes('\0') || safeRef.includes('\n') || safeRef.includes('\r')) {
      return null;
    }

    if (safeRef.startsWith('-') || safeRef.includes(' ') || safeRef.includes('..')) {
      return null;
    }

    if (safeRef.startsWith('/') || safeRef.endsWith('/')) {
      return null;
    }

    const validPattern = /^(?:HEAD|[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*|refs\/(?:heads|remotes|tags)\/[A-Za-z0-9._/-]+)$/;
    if (!validPattern.test(safeRef)) {
      return null;
    }

    return safeRef;
  }

  private parseRemoteRef(ref: string): { remote: string; branch: string } | null {
    const safeRef = this.sanitizeGitRef(ref);
    if (!safeRef) {
      return null;
    }

    const match = safeRef.match(/^([A-Za-z0-9._-]+)\/([A-Za-z0-9._/-]+)$/);
    if (!match) {
      return null;
    }

    const remote = match[1];
    const branch = match[2];
    if (!remote || !branch || branch.includes('..') || branch.startsWith('/') || branch.endsWith('/')) {
      return null;
    }

    return { remote, branch };
  }

  public async getChangedFiles(options: DiffOptions = {}): Promise<DiffFile[]> {
    await this.runGit(['rev-parse', '--is-inside-work-tree']);

    const safeBase = this.sanitizeGitRef(options.base);
    const safeHead = this.sanitizeGitRef(options.head) ?? 'HEAD';

    if (safeBase) {
      try {
        await this.runGit(['rev-parse', '--verify', safeBase]);
      } catch {
        const remoteRef = this.parseRemoteRef(safeBase) ?? { remote: 'origin', branch: safeBase };
        const { remote, branch } = remoteRef;
        try {
          await this.runGit(['fetch', '--depth=100', remote, `+refs/heads/${branch}:refs/remotes/${remote}/${branch}`]);
        } catch {
          try {
            await this.runGit(['fetch', '--depth=100', remote, `+${branch}:refs/remotes/${remote}/${branch}`]);
          } catch {
            // Ignore fetch failure and proceed with available refs.
          }
        }
      }
    }

    let diffRangeArgs: string[];
    if (safeBase && safeHead) {
      diffRangeArgs = [`${safeBase}...${safeHead}`];
    } else if (safeBase) {
      diffRangeArgs = [safeBase];
    } else if (options.staged) {
      diffRangeArgs = ['--cached'];
    } else {
      diffRangeArgs = ['HEAD'];
    }

    let numstatOutput: string;
    try {
      numstatOutput = await this.runGit(['diff', '--numstat', ...diffRangeArgs]);
    } catch (diffErr) {
      const fallbackArgs = safeBase ? [safeBase] : ['HEAD'];
      try {
        numstatOutput = await this.runGit(['diff', '--numstat', ...fallbackArgs]);
        diffRangeArgs = fallbackArgs;
      } catch (fallbackErr) {
        const diffMessage = diffErr instanceof Error ? diffErr.message : String(diffErr);
        console.warn(`[playwright-smart-test] Warning: git diff failed for [${diffRangeArgs.join(' ')}] and fallback [${fallbackArgs.join(' ')}]: ${diffMessage}`);
        numstatOutput = '';
      }
    }
    const numstatMap = this.parseNumstat(numstatOutput);

    let rawDiff: string;
    try {
      rawDiff = await this.runGit(['diff', ...diffRangeArgs]);
    } catch {
      rawDiff = '';
    }
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

      const newlineIndex = trimmed.indexOf('\n');
      const headerLine = (newlineIndex === -1 ? trimmed : trimmed.slice(0, newlineIndex)).trim();

      if (!headerLine.startsWith('diff --git ')) continue;

      const line = headerLine.slice(11);
      const sepIndex = line.lastIndexOf(' b/');

      if (sepIndex !== -1) {
        let filePath = line.slice(sepIndex + 3).trim();
        if (filePath === '/dev/null' || filePath === 'dev/null') {
          const aPath = line.slice(0, sepIndex).trim();
          filePath = aPath.startsWith('a/') ? aPath.slice(2) : aPath;
        }

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
