import fs from 'node:fs';
import path from 'node:path';
import { Project, SourceFile } from 'ts-morph';
import { glob } from 'glob';

export class ASTDependencyGraph {
  private project: Project;
  // file -> files that this file imports (outgoing)
  private dependencies: Map<string, Set<string>> = new Map();
  // file -> files that import this file (incoming)
  private dependents: Map<string, Set<string>> = new Map();

  constructor(private cwd: string = process.cwd()) {
    this.project = new Project({
      skipAddingFilesFromTsConfig: true,
      compilerOptions: { allowJs: true },
    });
  }

  public async buildGraph(scanDirs: string[] = ['src', 'tests', 'pages']): Promise<void> {
    this.dependencies.clear();
    this.dependents.clear();

    const allFiles: string[] = [];
    for (const dir of scanDirs) {
      const fullDir = path.resolve(this.cwd, dir);
      if (fs.existsSync(fullDir)) {
        const files = await glob('**/*.{ts,tsx,js,jsx}', {
          cwd: fullDir,
          nodir: true,
          posix: true,
        });
        allFiles.push(...files.map((f) => path.join(dir, f).replace(/\\/g, '/')));
      }
    }

    for (const fileRel of allFiles) {
      const fullPath = path.resolve(this.cwd, fileRel);
      try {
        const sf = this.project.addSourceFileAtPathIfExists(fullPath) ||
          this.project.createSourceFile(fullPath, fs.readFileSync(fullPath, 'utf8'), { overwrite: true });
        this.indexImports(sf, fileRel);
      } catch (err) {
        // Skip unparseable files
      }
    }
  }

  private indexImports(sourceFile: SourceFile, sourceRelPath: string): void {
    const normSource = this.normalize(sourceRelPath);
    if (!this.dependencies.has(normSource)) {
      this.dependencies.set(normSource, new Set());
    }

    for (const imp of sourceFile.getImportDeclarations()) {
      const specifier = imp.getModuleSpecifierValue();
      if (!specifier.startsWith('.')) {
        // External node_module import
        continue;
      }

      const dir = path.dirname(path.resolve(this.cwd, sourceRelPath));
      const resolved = this.resolveModulePath(dir, specifier);
      if (resolved) {
        const normTarget = this.normalize(resolved);
        this.dependencies.get(normSource)!.add(normTarget);

        if (!this.dependents.has(normTarget)) {
          this.dependents.set(normTarget, new Set());
        }
        this.dependents.get(normTarget)!.add(normSource);
      }
    }
  }

  private resolveModulePath(fromDir: string, specifier: string): string | null {
    const candidateBase = path.resolve(fromDir, specifier);

    if (fs.existsSync(candidateBase) && fs.statSync(candidateBase).isFile()) {
      return path.relative(this.cwd, candidateBase).replace(/\\/g, '/');
    }

    // Handle ESM TypeScript imports ending with .js or .jsx
    if (candidateBase.endsWith('.js')) {
      const tsCandidate = candidateBase.slice(0, -3) + '.ts';
      if (fs.existsSync(tsCandidate)) {
        return path.relative(this.cwd, tsCandidate).replace(/\\/g, '/');
      }
      const tsxCandidate = candidateBase.slice(0, -3) + '.tsx';
      if (fs.existsSync(tsxCandidate)) {
        return path.relative(this.cwd, tsxCandidate).replace(/\\/g, '/');
      }
    }

    const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];
    for (const ext of extensions) {
      const candidate = candidateBase + ext;
      if (fs.existsSync(candidate)) {
        return path.relative(this.cwd, candidate).replace(/\\/g, '/');
      }
    }

    return null;
  }

  private normalize(filePath: string): string {
    return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
  }

  /**
   * Find all files that transitively import any of the modified files
   */
  public findImpactedDependents(changedFiles: string[]): Set<string> {
    const impacted = new Set<string>();
    const queue = [...changedFiles.map((f) => this.normalize(f))];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const directDependents = this.dependents.get(current);
      if (directDependents) {
        for (const dep of directDependents) {
          impacted.add(dep);
          if (!visited.has(dep)) {
            queue.push(dep);
          }
        }
      }
    }

    return impacted;
  }

  /**
   * Filter impacted files down to only test spec files
   */
  public findImpactedTestSpecs(changedFiles: string[], knownSpecs: string[]): string[] {
    const impacted = this.findImpactedDependents(changedFiles);
    const knownSpecSet = new Set(knownSpecs.map((s) => this.normalize(s)));

    const result: string[] = [];
    for (const imp of impacted) {
      if (knownSpecSet.has(imp) || imp.endsWith('.spec.ts') || imp.endsWith('.test.ts')) {
        result.push(imp);
      }
    }

    // Also include test specs that were themselves directly modified
    for (const changed of changedFiles) {
      const norm = this.normalize(changed);
      if ((knownSpecSet.has(norm) || norm.endsWith('.spec.ts') || norm.endsWith('.test.ts')) && !result.includes(norm)) {
        result.push(norm);
      }
    }

    return result;
  }
}
