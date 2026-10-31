import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import { Project } from 'ts-morph';
import { SpecCatalogEntry } from '../config/schema.js';

export class TestCatalogIndexer {
  private project: Project;

  constructor(private cwd: string = process.cwd()) {
    this.project = new Project({
      skipAddingFilesFromTsConfig: true,
      compilerOptions: { allowJs: true },
    });
  }

  public async scanTestFiles(
    testDir: string = 'tests',
    testMatch: string[] = ['**/*.spec.ts', '**/*.test.ts']
  ): Promise<SpecCatalogEntry[]> {
    const fullTestDir = path.resolve(this.cwd, testDir);
    if (!fs.existsSync(fullTestDir)) {
      return [];
    }

    const matches: string[] = [];
    for (const pattern of testMatch) {
      const found = await glob(pattern, {
        cwd: fullTestDir,
        nodir: true,
        posix: true,
      });
      matches.push(...found);
    }

    const uniqueFiles = Array.from(new Set(matches)).map((rel) =>
      path.join(testDir, rel).replace(/\\/g, '/')
    );

    const catalog: SpecCatalogEntry[] = [];

    for (const fileRelPath of uniqueFiles) {
      const fullPath = path.resolve(this.cwd, fileRelPath);
      const entry = this.indexSpecFile(fullPath, fileRelPath);
      catalog.push(entry);
    }

    return catalog;
  }

  private indexSpecFile(fullPath: string, relativePath: string): SpecCatalogEntry {
    const sourceFile = this.project.addSourceFileAtPathIfExists(fullPath) ||
      this.project.createSourceFile(fullPath, fs.readFileSync(fullPath, 'utf8'), { overwrite: true });

    const content = sourceFile.getFullText();
    const testTitles: string[] = [];
    const tags: string[] = [];
    const importedModules: string[] = [];

    // Extract import declarations
    for (const imp of sourceFile.getImportDeclarations()) {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      importedModules.push(moduleSpecifier);
    }

    // Extract test names and describe blocks
    sourceFile.forEachDescendant((node) => {
      const text = node.getText();
      // Match test('...', or test.describe('...',
      if (node.getKindName() === 'CallExpression') {
        const expressionText = (node as any).getExpression?.()?.getText?.() || '';
        if (
          expressionText === 'test' ||
          expressionText === 'test.describe' ||
          expressionText === 'test.only' ||
          expressionText === 'it' ||
          expressionText === 'describe'
        ) {
          const args = (node as any).getArguments?.() || [];
          if (args.length > 0) {
            const firstArg = args[0].getText().replace(/^['"`]|['"`]$/g, '');
            testTitles.push(firstArg);
          }
        }
      }
    });

    // Extract tags like @checkout, @smoke, { tag: '@payment' }
    const tagMatches = content.match(/@[a-zA-Z0-9_\-]+/g);
    if (tagMatches) {
      for (const t of tagMatches) {
        if (!tags.includes(t)) {
          tags.push(t);
        }
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
