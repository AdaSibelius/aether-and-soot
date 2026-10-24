import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';

export interface AstFileMetadata {
  readonly relPath: string;
  readonly lineCount: number;
  readonly isNearCap: boolean;
  readonly exports: string[];
  readonly functionSignatures: string[];
  readonly imports: string[];
  readonly importedSymbols: string[];
  readonly hash: string;
}

export function computeFileHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

export function parseSourceFileAst(filePath: string, content: string, rootDir: string): AstFileMetadata {
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

  const exports: string[] = [];
  const functionSignatures: string[] = [];
  const imports: string[] = [];
  const importedSymbols: string[] = [];

  function visit(node: ts.Node): void {
    if (ts.isFunctionDeclaration(node)) {
      const hasExport = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (hasExport && node.name) {
        const fnName = node.name.text;
        exports.push(fnName);
        const params = node.parameters
          .map((p) => {
            const pName = p.name.getText(sourceFile);
            const pType = p.type ? p.type.getText(sourceFile).replace(/\s+/g, ' ') : 'unknown';
            return `${pName}: ${pType}`;
          })
          .join(', ');
        const retType = node.type ? node.type.getText(sourceFile).replace(/\s+/g, ' ') : 'void';
        functionSignatures.push(`${fnName}(${params}): ${retType}`);
      }
    } else if (ts.isVariableStatement(node)) {
      const hasExport = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (hasExport) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) exports.push(decl.name.text);
        }
      }
    } else if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) {
      const hasExport = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (hasExport && node.name) exports.push(node.name.text);
    } else if (ts.isImportDeclaration(node)) {
      if (ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
      if (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
        for (const el of node.importClause.namedBindings.elements) importedSymbols.push(el.name.text);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  const lines = content.split('\n');
  return {
    relPath: path.relative(rootDir, filePath),
    lineCount: lines.length,
    isNearCap: lines.length >= 240,
    exports,
    functionSignatures,
    imports,
    importedSymbols,
    hash: computeFileHash(content),
  };
}

export function loadAstCache(cachePath: string): Record<string, AstFileMetadata> {
  try {
    if (fs.existsSync(cachePath)) return JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  } catch {
    // Corrupt cache ignored
  }
  return {};
}

export function saveAstCache(cachePath: string, cache: Record<string, AstFileMetadata>): void {
  try {
    const dir = path.dirname(cachePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
  } catch {
    // Non-fatal cache write
  }
}

export function indexCodebaseAst(rootDir: string, useCache = true): AstFileMetadata[] {
  const srcDir = path.join(rootDir, 'src');
  if (!fs.existsSync(srcDir)) return [];

  const cachePath = path.resolve(rootDir, '.cache/ast-scout-cache.json');
  const cache = useCache ? loadAstCache(cachePath) : {};
  let cacheModified = false;
  const files: AstFileMetadata[] = [];

  function recurse(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) recurse(full);
      else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        const content = fs.readFileSync(full, 'utf-8');
        const hash = computeFileHash(content);
        const rel = path.relative(rootDir, full);
        const cached = cache[rel];
        if (cached && cached.hash === hash) {
          files.push(cached);
        } else {
          const fresh = parseSourceFileAst(full, content, rootDir);
          cache[rel] = fresh;
          cacheModified = true;
          files.push(fresh);
        }
      }
    }
  }

  recurse(srcDir);
  if (useCache && cacheModified) saveAstCache(cachePath, cache);
  return files;
}

export function rankFilesForTask(task: string, files: AstFileMetadata[]): AstFileMetadata[] {
  const tokens = task.toLowerCase().split(/[^a-z0-9_]+/).filter((t) => t.length >= 3);
  const scored = files.map((f) => {
    let score = 0;
    const base = path.basename(f.relPath).toLowerCase();
    const fullLower = f.relPath.toLowerCase();

    for (const t of tokens) {
      if (base.includes(t)) score += 12;
      else if (fullLower.includes(t)) score += 5;
      if (f.exports.some((e) => e.toLowerCase().includes(t))) score += 8;
      if (f.functionSignatures.some((s) => s.toLowerCase().includes(t))) score += 7;
      if (f.importedSymbols.some((s) => s.toLowerCase().includes(t))) score += 3;
    }
    return { file: f, score };
  });

  const topScoredFiles = scored.filter((s) => s.score > 0).map((s) => s.file);
  const directImports = new Set<string>();
  for (const tf of topScoredFiles) {
    for (const imp of tf.imports) {
      directImports.add(path.basename(imp).replace(/\.(js|ts)$/, ''));
    }
  }

  for (const s of scored) {
    const baseWithoutExt = path.basename(s.file.relPath).replace(/\.(ts|tsx)$/, '');
    if (directImports.has(baseWithoutExt)) scoreBoost(s, 4);
  }

  function scoreBoost(item: { file: AstFileMetadata; score: number }, bonus: number): void {
    item.score += bonus;
  }

  return scored
    .sort((a, b) => b.score - a.score || b.file.lineCount - a.file.lineCount)
    .map((s) => s.file);
}

export function extractFunctionSignaturesViaAst(filePath: string): { functions: string[]; imports: string[] } {
  if (!fs.existsSync(filePath)) return { functions: [], imports: [] };
  const content = fs.readFileSync(filePath, 'utf-8');
  const root = path.dirname(filePath);
  const meta = parseSourceFileAst(filePath, content, root);
  return { functions: meta.functionSignatures, imports: meta.imports };
}
