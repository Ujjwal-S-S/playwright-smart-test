import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import { SpecCatalogEntry } from '../config/schema.js';

// Regex-based test/import extractor — no TypeScript compiler dependency at runtime.
// Handles the common Playwright patterns: test(), test.describe(), it(), describe()
// and standard ESM import declarations.

const TEST_TITLE_RE = /(?:^|\n)\s*(?:test|it|describe)(?:\.(?:describe|only|skip))?\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
const IMPORT_FROM_RE = /^\s*import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]/gm;
const TAG_RE = /@[a-zA-Z0-9_\-]+/g;

export class TestCatalogIndexer {
  constructor(private cwd: string = process.cwd()) {}

  public async scanTestFiles(
    testDir: string = 'tests',
    testMatch: string[] = ['**/*.spec.ts', '**/*.test.ts']
  ): Promise<SpecCatalogEntry[]> {
    const fullTestDir = path.resolve(this.cwd, testDir);
    if (!fs.existsSync(fullTestDir)) {
      return [];
    }

    const matchedFiles: string[] = [];

    for (const pattern of testMatch) {
      try {
        const found = await glob(pattern, {
          cwd: fullTestDir,
          nodir: true,
          posix: true,
        });
        matchedFiles.push(...found);
      } catch {
        const files = this.recursiveScan(fullTestDir);
        for (const f of files) {
          if (f.endsWith('.spec.ts') || f.endsWith('.test.ts')) {
            matchedFiles.push(path.relative(fullTestDir, f).replace(/\\/g, '/'));
          }
        }
      }
    }

    const uniqueFiles = Array.from(new Set(matchedFiles)).map((rel) =>
      path.join(testDir, rel).replace(/\\/g, '/')
    );

    const catalog: SpecCatalogEntry[] = [];

    for (const fileRelPath of uniqueFiles) {
      const fullPath = path.resolve(this.cwd, fileRelPath);
      if (fs.existsSync(fullPath)) {
        const entry = this.indexSpecFile(fullPath, fileRelPath);
        catalog.push(entry);
      }
    }

    return catalog;
  }

  private recursiveScan(dir: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...this.recursiveScan(full));
      } else if (entry.isFile()) {
        results.push(full);
      }
    }
    return results;
  }

  private indexSpecFile(fullPath: string, relativePath: string): SpecCatalogEntry {
    const content = fs.readFileSync(fullPath, 'utf8');

    const testTitles: string[] = [];
    let m: RegExpExecArray | null;

    TEST_TITLE_RE.lastIndex = 0;
    while ((m = TEST_TITLE_RE.exec(content)) !== null) {
      const title = m[2].replace(/\\(['"`\\])/g, '$1');
      if (title && !testTitles.includes(title)) {
        testTitles.push(title);
      }
    }

    const importedModules: string[] = [];
    IMPORT_FROM_RE.lastIndex = 0;
    while ((m = IMPORT_FROM_RE.exec(content)) !== null) {
      const mod = m[1];
      if (mod && !importedModules.includes(mod)) {
        importedModules.push(mod);
      }
    }

    const tags: string[] = [];
    TAG_RE.lastIndex = 0;
    while ((m = TAG_RE.exec(content)) !== null) {
      const tag = m[0];
      if (!tags.includes(tag)) {
        tags.push(tag);
      }
    }

    return {
      filePath: relativePath,
      testTitles,
      tags,
      importedModules,
    };
  }
}
