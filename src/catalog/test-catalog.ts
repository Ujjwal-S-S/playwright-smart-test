import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import ts from 'typescript';
import { SpecCatalogEntry } from '../config/schema.js';

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
    const sourceFile = ts.createSourceFile(
      fullPath,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    const testTitles: string[] = [];
    const tags: string[] = [];
    const importedModules: string[] = [];

    const visit = (node: ts.Node) => {
      // 1. Extract import statements
      if (ts.isImportDeclaration(node)) {
        if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
          importedModules.push(node.moduleSpecifier.text);
        }
      }

      // 2. Extract Playwright test('...', ...) and test.describe('...', ...) calls
      if (ts.isCallExpression(node)) {
        const expr = node.expression;
        let callName = '';

        if (ts.isIdentifier(expr)) {
          callName = expr.text;
        } else if (ts.isPropertyAccessExpression(expr)) {
          callName = `${expr.expression.getText(sourceFile)}.${expr.name.text}`;
        }

        if (
          callName === 'test' ||
          callName === 'test.describe' ||
          callName === 'test.only' ||
          callName === 'it' ||
          callName === 'describe'
        ) {
          const firstArg = node.arguments[0];
          if (firstArg && (ts.isStringLiteral(firstArg) || ts.isNoSubstitutionTemplateLiteral(firstArg))) {
            testTitles.push(firstArg.text);
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    // Extract tags like @checkout, @payment from code comments and titles
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
