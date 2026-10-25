import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { resolveModel } from './local-llm-config.js';
import {
  extractFunctionBlock,
  reconcileTargetImports,
  performFileSplit,
  type ExtractedBlock,
} from './hermes-split-ast.js';

export {
  extractFunctionBlock,
  reconcileTargetImports,
  performFileSplit,
  type ExtractedBlock,
};

export interface SplitConfig {
  readonly source: string;
  readonly target: string;
  readonly extract: readonly string[];
  readonly model: string;
  readonly dryRun: boolean;
  readonly mock: boolean;
  readonly listCandidates: boolean;
}

export function parseSplitArgs(argv: readonly string[]): SplitConfig {
  const args = argv.slice(2);
  let source = 'src/sim/systems/economy.system.ts';
  let target = 'src/sim/systems/economy-macro.system.ts';
  let extract: string[] = ['advanceDistrictEconomyMacroTick'];
  let dryRun = false;
  let mock = false;
  let listCandidates = false;
  let model = resolveModel('tier2');

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--source' && args[i + 1]) source = args[++i] ?? source;
    else if (a === '--target' && args[i + 1]) target = args[++i] ?? target;
    else if (a === '--extract' && args[i + 1]) extract = (args[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--model' && args[i + 1]) model = args[++i] ?? model;
    else if (a === '--dry-run') dryRun = true;
    else if (a === '--mock') mock = true;
    else if (a === '--list-candidates') listCandidates = true;
  }
  return { source, target, extract, model, dryRun, mock, listCandidates };
}

export interface SplitCandidate {
  readonly name: string;
  readonly kind: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly lines: number;
}

export function listSplitCandidates(sourceContent: string): SplitCandidate[] {
  const candidates: SplitCandidate[] = [];
  const pattern = /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?(function|const|type|interface)\s+([a-zA-Z0-9_$]+)/g;
  for (const match of sourceContent.matchAll(pattern)) {
    const kind = match[1] ?? 'unknown';
    const name = match[2];
    if (!name || candidates.some((c) => c.name === name)) continue;
    const blockData = extractFunctionBlock(sourceContent, name);
    if (blockData) {
      const startLine = sourceContent.slice(0, blockData.start).split('\n').length;
      const endLine = sourceContent.slice(0, blockData.end).split('\n').length;
      candidates.push({
        name,
        kind,
        startLine,
        endLine,
        lines: endLine - startLine + 1,
      });
    }
  }
  return candidates;
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

  if (config.listCandidates) {
    const candidates = listSplitCandidates(sourceContent);
    console.log(`[hermes-split] Candidates in ${config.source} (${sourceLinesBefore} lines):`);
    for (const c of candidates) {
      console.log(`  - ${c.name} (${c.kind}): L${c.startLine}-L${c.endLine} (${c.lines} lines)`);
    }
    return { sourceLinesBefore, sourceLinesAfter: sourceLinesBefore, targetLines: 0, extractedCount: 0 };
  }

  const relTargetFromSource = path.relative(path.dirname(sourceFullPath), targetFullPath).replace(/\\/g, '/');
  let relSourceFromTarget = path.relative(path.dirname(targetFullPath), sourceFullPath)
    .replace(/\\/g, '/')
    .replace(/\.(ts|tsx)$/, '.js');
  if (!relSourceFromTarget.startsWith('.')) relSourceFromTarget = './' + relSourceFromTarget;

  const { updatedSource, targetContent, extractedCount } = performFileSplit(
    sourceContent,
    relTargetFromSource,
    config.extract,
    relSourceFromTarget,
  );

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
    const execErr = err as { stdout?: Buffer | string; stderr?: Buffer | string };
    const detail = execErr.stdout?.toString() || execErr.stderr?.toString() || '';
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`[hermes-split] Verification failed after split, reverted files: ${msg} ${detail}`);
  }

  return { sourceLinesBefore, sourceLinesAfter, targetLines, extractedCount };
}

if (process.argv[1]?.endsWith('hermes-split.ts')) {
  const config = parseSplitArgs(process.argv);
  const root = path.resolve(import.meta.dirname, '../..');
  runSplit(config, root).catch((err) => {
    console.error(`[hermes-split] Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
