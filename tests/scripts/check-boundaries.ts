import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = path.resolve(import.meta.dirname, '../..');
const MAX_LINES_HARD_CEILING = 300;

const FORBIDDEN_SIM_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  { pattern: /from\s+['"].*client\//, reason: 'src/sim/ must never import from src/client/' },
  { pattern: /from\s+['"]pixi\.js['"]/, reason: 'src/sim/ must never import pixi.js' },
  { pattern: /from\s+['"]preact['"]/, reason: 'src/sim/ must never import preact' },
  { pattern: /\bMath\.random\s*\(/, reason: 'Use SeededRNG instead of Math.random() in src/sim/' },
  { pattern: /\bDate\.now\s*\(/, reason: 'Date.now() is forbidden in deterministic src/sim/' },
  { pattern: /\bwindow\b|\bdocument\b/, reason: 'Browser globals are forbidden in src/sim/' },
];

function collectTypeScriptFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const resolved = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTypeScriptFiles(resolved));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(resolved);
    }
  }
  return files;
}

function runBoundaryChecks(): void {
  const allFiles = [
    ...collectTypeScriptFiles(path.join(ROOT_DIR, 'src')),
    ...collectTypeScriptFiles(path.join(ROOT_DIR, 'tests')),
  ];

  const violations: string[] = [];

  for (const filePath of allFiles) {
    const relPath = path.relative(ROOT_DIR, filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lineCount = content.split('\n').length;

    if (lineCount > MAX_LINES_HARD_CEILING) {
      violations.push(
        `${relPath}: ${lineCount} lines exceeds hard modularity ceiling (${MAX_LINES_HARD_CEILING})`,
      );
    }

    if (relPath.startsWith('src/sim/') || relPath.startsWith('src/schemas/')) {
      for (const rule of FORBIDDEN_SIM_PATTERNS) {
        if (rule.pattern.test(content)) {
          violations.push(`${relPath}: ${rule.reason}`);
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error('[check:boundaries] Architectural violations detected:');
    for (const v of violations) {
      console.error(`  - ${v}`);
    }
    process.exit(1);
  }

  console.log(
    `[check:boundaries] OK — Checked ${allFiles.length} files. Zero Core/Shell or modularity violations.`,
  );
}

runBoundaryChecks();
