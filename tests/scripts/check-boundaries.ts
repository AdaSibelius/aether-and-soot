import fs from 'node:fs';
import path from 'node:path';

export const ROOT_DIR = path.resolve(import.meta.dirname, '../..');
export const MAX_LINES_HARD_CEILING = 300;
export const WARN_LINES_THRESHOLD = 240;

export const FORBIDDEN_SIM_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  { pattern: /from\s+['"].*client\//, reason: 'src/sim/ must never import from src/client/' },
  { pattern: /from\s+['"]pixi\.js['"]/, reason: 'src/sim/ must never import pixi.js' },
  { pattern: /from\s+['"]preact['"]/, reason: 'src/sim/ must never import preact' },
  { pattern: /\bMath\.random\s*\(/, reason: 'Use SeededRNG instead of Math.random() in src/sim/' },
  { pattern: /\bDate\.now\s*\(/, reason: 'Date.now() is forbidden in deterministic src/sim/' },
  { pattern: /\bwindow\b|\bdocument\b/, reason: 'Browser globals are forbidden in src/sim/' },
];

export function collectTypeScriptFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const resolved = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectTypeScriptFiles(resolved));
    else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) files.push(resolved);
  }
  return files;
}

export function checkTeamworkLayoutCompliance(rootDir: string, violations: string[]): void {
  const teamworkDir = path.join(rootDir, '.agents/teamwork');
  if (!fs.existsSync(teamworkDir)) return;

  function scanDir(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const resolved = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(resolved);
      } else if (entry.isFile()) {
        const relPath = path.relative(rootDir, resolved);
        if (/\.(ts|tsx|js|json)$/i.test(entry.name)) {
          violations.push(`${relPath}: Illegal source/data file in .agents/teamwork/ (workspace must contain only metadata .md files)`);
        } else if (entry.name.toUpperCase() === 'AGENTS.MD' || entry.name.toUpperCase() === 'GEMINI.MD') {
          violations.push(`${relPath}: Forbidden rule filename in .agents/teamwork/ (AGENTS.md/GEMINI.md are reserved for root)`);
        }
      }
    }
  }
  scanDir(teamworkDir);
}

export interface BoundaryCheckResult {
  readonly violations: readonly string[];
  readonly warnings: readonly string[];
  readonly checkedFilesCount: number;
}

export function runBoundaryChecks(rootDir: string = ROOT_DIR): BoundaryCheckResult {
  const allFiles = [
    ...collectTypeScriptFiles(path.join(rootDir, 'src')),
    ...collectTypeScriptFiles(path.join(rootDir, 'tests')),
  ];
  const violations: string[] = [];
  const warnings: string[] = [];

  for (const filePath of allFiles) {
    const relPath = path.relative(rootDir, filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lineCount = content.split('\n').length;

    if (lineCount > MAX_LINES_HARD_CEILING) {
      violations.push(`${relPath}: ${lineCount} lines exceeds hard modularity ceiling (${MAX_LINES_HARD_CEILING})`);
    } else if (lineCount >= WARN_LINES_THRESHOLD) {
      warnings.push(`[check:boundaries] WARNING: ${relPath} is near cap (${lineCount}/${MAX_LINES_HARD_CEILING} lines)`);
    }

    if (relPath.startsWith('src/sim/') || relPath.startsWith('src/schemas/')) {
      for (const rule of FORBIDDEN_SIM_PATTERNS) {
        if (rule.pattern.test(content)) violations.push(`${relPath}: ${rule.reason}`);
      }
    }
  }

  checkTeamworkLayoutCompliance(rootDir, violations);
  return { violations, warnings, checkedFilesCount: allFiles.length };
}

if (process.argv[1]?.includes('check-boundaries')) {
  const { violations, warnings, checkedFilesCount } = runBoundaryChecks();
  for (const w of warnings) console.warn(w);

  if (violations.length > 0) {
    console.error('[check:boundaries] Architectural violations detected:');
    for (const v of violations) console.error(`  - ${v}`);
    process.exit(1);
  }
  console.log(`[check:boundaries] OK — Checked ${checkedFilesCount} files. Zero Core/Shell or modularity violations.`);
}
