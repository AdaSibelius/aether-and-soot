import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

export interface SplitConfig {
  readonly source: string;
  readonly target: string;
  readonly extract: string[];
  readonly model: string;
  readonly dryRun: boolean;
  readonly mock: boolean;
}

export function parseSplitArgs(argv: string[]): SplitConfig {
  const args = argv.slice(2);
  let source = 'src/sim/systems/economy.system.ts';
  let target = 'src/sim/systems/economy-macro.system.ts';
  let extract: string[] = ['advanceDistrictEconomyMacroTick'];
  let dryRun = false;
  let mock = false;
  let model = process.env['LLM_MODEL'] ?? 'gemma4:12b-extended';

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--source' && args[i + 1]) source = args[++i] ?? source;
    else if (a === '--target' && args[i + 1]) target = args[++i] ?? target;
    else if (a === '--extract' && args[i + 1]) extract = (args[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--model' && args[i + 1]) model = args[++i] ?? model;
    else if (a === '--dry-run') dryRun = true;
    else if (a === '--mock') mock = true;
  }
  return { source, target, extract, model, dryRun, mock };
}

export function extractFunctionBlock(content: string, name: string): { block: string; start: number; end: number } | undefined {
  const pattern = new RegExp(`(?:export\\s+(?:async\\s+)?function\\s+${name}|export\\s+const\\s+${name}\\s*=|export\\s+type\\s+${name}\\s*=|export\\s+interface\\s+${name})`);
  const match = pattern.exec(content);
  if (!match) return undefined;

  const start = match.index;
  const isFunction = content.slice(start, start + 50).includes('function');
  let bodyBrace = -1;

  if (isFunction) {
    const paramStart = content.indexOf('(', start);
    if (paramStart === -1) return undefined;
    let pDepth = 0, paramEnd = -1;
    for (let i = paramStart; i < content.length; i++) {
      if (content[i] === '(') pDepth++;
      else if (content[i] === ')') {
        pDepth--;
        if (pDepth === 0) { paramEnd = i; break; }
      }
    }
    if (paramEnd === -1) return undefined;

    let typeDepth = 0;
    for (let i = paramEnd + 1; i < content.length; i++) {
      const ch = content[i];
      if (ch === '{') {
        if (typeDepth === 0) {
          const trimmed = content.slice(paramEnd + 1, i).trim();
          const isTypeLiteral = /[:<&|,]\s*$/.test(trimmed) || trimmed.endsWith('=>') || trimmed.endsWith('readonly');
          if (isTypeLiteral) {
            typeDepth++;
            continue;
          }
          bodyBrace = i;
          break;
        } else {
          typeDepth++;
        }
      } else if (ch === '}') {
        typeDepth--;
      }
    }
  } else {
    bodyBrace = content.indexOf('{', start);
  }

  if (bodyBrace === -1) return undefined;

  let depth = 0, inString = false, quote = '', escape = false;
  for (let i = bodyBrace; i < content.length; i++) {
    const ch = content[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (inString) {
      if (ch === quote) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inString = true; quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        let end = i + 1;
        if (content[end] === ';') end++;
        if (content[end] === '\n') end++;
        return { block: content.slice(start, end).trim(), start, end };
      }
    }
  }
  return undefined;
}

export function reconcileTargetImports(sourceImports: string[], code: string, _relSourcePath?: string): string[] {
  const needed: string[] = [];
  for (const imp of sourceImports) {
    const names = imp.match(/\{([^}]+)\}/);
    if (names && names[1]) {
      const symbols = names[1].split(',').map((s) => s.trim());
      const used = symbols.filter((s) => new RegExp(`\\b${s}\\b`).test(code));
      if (used.length > 0) {
        const fromPath = imp.match(/from\s+['"]([^'"]+)['"]/)?.[1];
        if (fromPath) needed.push(`import { ${used.join(', ')} } from '${fromPath}';`);
      }
    }
  }
  return needed;
}

export function performFileSplit(
  sourceContent: string,
  targetRelPath: string,
  functionNames: string[],
): { updatedSource: string; targetContent: string; extractedCount: number } {
  const importMatches = sourceContent.matchAll(/import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];/g);
  const sourceImports: string[] = [];
  for (const m of importMatches) sourceImports.push(m[0].replace(/\s+/g, ' '));

  const extractedBlocks: string[] = [];
  let currentSource = sourceContent;
  const sortedNames = [...functionNames];

  for (const name of sortedNames) {
    const blockData = extractFunctionBlock(currentSource, name);
    if (blockData) {
      extractedBlocks.push(blockData.block);
      currentSource = currentSource.slice(0, blockData.start) + currentSource.slice(blockData.end);
    }
  }

  const combinedExtracted = extractedBlocks.join('\n\n');
  const targetImports = reconcileTargetImports(sourceImports, combinedExtracted, targetRelPath);
  const targetContent = `${targetImports.join('\n')}\n\n${combinedExtracted}\n`;

  const relImport = targetRelPath.startsWith('.') ? targetRelPath : './' + targetRelPath;
  const barrelExport = `\nexport { ${functionNames.join(', ')} } from '${relImport.replace(/\.ts$/, '.js')}';\n`;
  const updatedSource = currentSource.trim() + '\n' + barrelExport;

  return { updatedSource, targetContent, extractedCount: extractedBlocks.length };
}

export async function runSplit(config: SplitConfig, rootDir: string): Promise<{
  sourceLinesBefore: number;
  sourceLinesAfter: number;
  targetLines: number;
  extractedCount: number;
}> {
  const sourceFullPath = path.resolve(rootDir, config.source);
  const targetFullPath = path.resolve(rootDir, config.target);
  const sourceContent = fs.readFileSync(sourceFullPath, 'utf-8');
  const sourceLinesBefore = sourceContent.split('\n').length;

  const relTargetFromSource = path.relative(path.dirname(sourceFullPath), targetFullPath).replace(/\\/g, '/');
  const { updatedSource, targetContent, extractedCount } = performFileSplit(sourceContent, relTargetFromSource, config.extract);

  const sourceLinesAfter = updatedSource.split('\n').length;
  const targetLines = targetContent.split('\n').length;

  console.log(`[hermes-split] Source: ${config.source} (${sourceLinesBefore} -> ${sourceLinesAfter} lines).`);
  console.log(`[hermes-split] Target: ${config.target} (${targetLines} lines). Extracted ${extractedCount} symbols.`);

  if (config.dryRun) {
    console.log('[hermes-split] Dry-run complete. No files written.');
    return { sourceLinesBefore, sourceLinesAfter, targetLines, extractedCount };
  }

  fs.mkdirSync(path.dirname(targetFullPath), { recursive: true });
  fs.writeFileSync(targetFullPath, targetContent, 'utf-8');
  fs.writeFileSync(sourceFullPath, updatedSource, 'utf-8');

  try {
    execSync('npx tsc --noEmit && tsx tests/scripts/check-boundaries.ts', { cwd: rootDir, stdio: 'pipe' });
    console.log('[hermes-split] Verified 0 type regressions and boundary compliance.');
  } catch (err: unknown) {
    fs.writeFileSync(sourceFullPath, sourceContent, 'utf-8');
    if (fs.existsSync(targetFullPath)) fs.unlinkSync(targetFullPath);
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`[hermes-split] Verification failed after split, reverted files: ${msg}`);
  }

  return { sourceLinesBefore, sourceLinesAfter, targetLines, extractedCount };
}

if (process.argv[1]?.endsWith('hermes-split.ts')) {
  const config = parseSplitArgs(process.argv);
  const root = path.resolve(import.meta.dirname, '../..');
  runSplit(config, root).catch((err) => {
    console.error(`[hermes-split] Error: ${err.message}`);
    process.exit(1);
  });
}
