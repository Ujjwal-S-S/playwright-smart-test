import { simpleGit, SimpleGit } from 'simple-git';
import { DiffFile } from '../config/schema.js';

export interface DiffOptions {
  base?: string;
  head?: string;
  staged?: boolean;
}

export class GitDiffAnalyzer {
  private git: SimpleGit;

  constructor(private cwd: string = process.cwd()) {
    this.git = simpleGit(cwd);
  }

  public async getChangedFiles(options: DiffOptions = {}): Promise<DiffFile[]> {
    try {
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        throw new Error(`Directory ${this.cwd} is not a git repository.`);
      }

      let diffSummary;
      let rawDiff = '';

      if (options.base && options.head) {
        diffSummary = await this.git.diffSummary([`${options.base}...${options.head}`]);
        rawDiff = await this.git.diff([`${options.base}...${options.head}`]);
      } else if (options.base) {
        diffSummary = await this.git.diffSummary([options.base]);
        rawDiff = await this.git.diff([options.base]);
      } else if (options.staged) {
        diffSummary = await this.git.diffSummary(['--cached']);
        rawDiff = await this.git.diff(['--cached']);
      } else {
        // Unstaged + staged working tree changes vs HEAD
        diffSummary = await this.git.diffSummary(['HEAD']);
        rawDiff = await this.git.diff(['HEAD']);
      }

      const patchesByFile = this.splitPatches(rawDiff);

      const files: DiffFile[] = diffSummary.files.map((file) => {
        let status: DiffFile['status'] = 'modified';
        if ('binary' in file && file.binary) {
          status = 'modified';
        }

        const patch = patchesByFile.get(file.file) || '';
        if (patch.includes('new file mode')) {
          status = 'added';
        } else if (patch.includes('deleted file mode')) {
          status = 'deleted';
        }

        return {
          path: file.file.replace(/\\/g, '/'),
          status,
          additions: 'insertions' in file ? file.insertions : 0,
          deletions: 'deletions' in file ? file.deletions : 0,
          patch,
        };
      });

      return files;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to analyze git diff: ${message}`);
    }
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
