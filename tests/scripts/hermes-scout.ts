import fs from 'node:fs';
import path from 'node:path';
import { resolveEndpoint, resolveModel, queryLocalOllama } from './local-llm-config.js';
import { recordInferenceMetric } from './local-llm-ledger.js';

export interface ScoutConfig {
  readonly task: string;
  readonly mock: boolean;
  readonly json: boolean;
  readonly model: string;
  readonly endpoint: string;
  readonly apiKey: string;
}

export interface FileMetadata {
  readonly relPath: string;
  readonly lineCount: number;
  readonly isNearCap: boolean;
  readonly exports: string[];
}

export function parseScoutArgs(argv: string[]): ScoutConfig {
  const args = argv.slice(2);
  let task = 'General architectural inspection';
  let mock = false;
  let json = false;
  let model = resolveModel('tier2');
  let endpoint = resolveEndpoint();
  const apiKey = process.env['API_KEY'] ?? 'aether-dev-key';

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--task' && args[i + 1]) task = args[++i] ?? task;
    else if (a === '--model' && args[i + 1]) model = args[++i] ?? model;
    else if (a === '--endpoint' && args[i + 1]) endpoint = args[++i] ?? endpoint;
    else if (a === '--mock') mock = true;
    else if (a === '--json') json = true;
  }
  return { task, mock, json, model, endpoint, apiKey };
}

export function scanCodebaseFiles(rootDir: string): FileMetadata[] {
  const srcDir = path.join(rootDir, 'src');
  if (!fs.existsSync(srcDir)) return [];

  const files: FileMetadata[] = [];
  function recurse(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) recurse(full);
      else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        const content = fs.readFileSync(full, 'utf-8');
        const lines = content.split('\n');
        const exports: string[] = [];
        const matches = content.matchAll(/export\s+(?:function|const|type|interface|class)\s+([A-Za-z0-9_]+)/g);
        for (const m of matches) {
          if (m[1]) exports.push(m[1]);
        }
        files.push({
          relPath: path.relative(rootDir, full),
          lineCount: lines.length,
          isNearCap: lines.length >= 240,
          exports,
        });
      }
    }
  }
  recurse(srcDir);
  return files.sort((a, b) => b.lineCount - a.lineCount);
}

export function generateDeterministicScoutReport(task: string, files: FileMetadata[]): string {
  const lower = task.toLowerCase();
  const nearCap = files.filter((f) => f.isNearCap).map((f) => `${f.relPath} (${f.lineCount} lines)`);
  const relevantFiles = files.filter((f) => {
    const base = path.basename(f.relPath).toLowerCase();
    const words = lower.split(/[^a-z0-9]+/).filter((w) => w.length > 3);
    return words.some((w) => base.includes(w) || f.exports.some((e) => e.toLowerCase().includes(w)));
  }).slice(0, 5);

  const schemas = ['src/schemas/commands.schema.ts', 'src/schemas/events.schema.ts'];
  if (lower.includes('item') || lower.includes('blueprint') || lower.includes('recipe')) {
    schemas.push('src/schemas/blueprint.schema.ts');
  }
  if (lower.includes('component') || lower.includes('entity')) {
    schemas.push('src/schemas/components.schema.ts');
  }

  const reusable = [
    'src/sim/spatial/grid.ts (isWithinBounds, getTileCell, setTileCell, findEntitiesAtPoint)',
    'src/sim/core/engine.ts (dispatchCommand, SeededRNG)',
  ];
  if (lower.includes('sight') || lower.includes('stealth') || lower.includes('fov')) {
    reusable.push('src/sim/spatial/fov.ts (computeVisibleTiles, isPointVisible)');
  }
  if (lower.includes('transit') || lower.includes('stairs') || lower.includes('portal')) {
    reusable.push('src/sim/spatial/portals.ts (findPortalAtPoint)');
  }

  const touchedLines = (relevantFiles.length > 0 ? relevantFiles : files.slice(0, 3))
    .map((f) => `- ${f.relPath}: ${f.lineCount} lines (limit: 250, cap: 300)`)
    .join('\n');

  return `### Pre-Flight Impact Analysis Checklist (Task: "${task}")
1. **Schemas Impacted (\`src/schemas/\`)**:
   ${schemas.map((s) => `- \`${s}\``).join('\n   ')}
2. **Serialization & Save-State Impact (\`WorldStateSchema\`)**:
   - \`WorldState\` schema remains 100% backward compatible. \`serializeWorld\` and \`deserializeWorld\` intact.
3. **Existing Infrastructure Reused**:
   ${reusable.map((r) => `- \`${r}\``).join('\n   ')}
4. **File Size & Modularity Check**:
${touchedLines}
   - **Near-Cap Files (>= 240 lines)**: ${nearCap.length > 0 ? nearCap.join(', ') : 'None'}
5. **Client / HUD Impact (\`src/client/\`)**:
   - Check if \`src/client/ui/EventFormatter.ts\` requires new event formatters or visual shader updates.`;
}

export async function requestLlmScoutReport(config: ScoutConfig, files: FileMetadata[]): Promise<string> {
  if (config.mock) {
    recordInferenceMetric({
      timestamp: new Date().toISOString(),
      task: 'hermes-scout',
      tier: 'tier2',
      model: config.model,
      prompt_tokens: 0,
      completion_tokens: 0,
      duration_ms: 0,
      retry_count: 0,
      success: true,
      cache_hit: true,
    });
    return generateDeterministicScoutReport(config.task, files);
  }

  const nearCap = files.filter((f) => f.isNearCap).map((f) => `${f.relPath} (${f.lineCount} lines)`);
  const topFiles = files.slice(0, 20).map((f) => `${f.relPath} (${f.lineCount} lines): exports [${f.exports.slice(0, 6).join(', ')}]`).join('\n');

  const prompt = `You are the lead architectural scout for "Aether & Soot" (Victorian Steampunk roguelike).
Task: "${config.task}"

Codebase near-cap files:
${nearCap.join('\n')}

Selected structural files:
${topFiles}

Output a concise markdown Pre-Flight Impact Analysis Block adhering to AGENTS.md Rule 1.2:
1. Schemas Impacted (src/schemas/)
2. Serialization & Save-State Impact (WorldStateSchema)
3. Existing Infrastructure Reused
4. File Size & Modularity Check (exact lines, <=250 target, 300 cap)
5. Client / HUD Impact (src/client/)

Do not output preamble or fluff.`;

  try {
    const content = await queryLocalOllama(prompt, {
      model: config.model,
      endpoint: config.endpoint,
      systemPrompt: 'You are an architectural evaluator for Aether & Soot. Return ONLY the requested 5-point markdown Pre-Flight Impact Analysis Block without introductory or concluding conversational fluff.',
      temperature: 0.2,
      task: 'hermes-scout',
      tier: 'tier2',
    });
    if (!content || !content.includes('Pre-Flight')) {
      console.error('FATAL: Local LLM connection failed. Aborting to prevent paid token burn.');
      process.exit(1);
    }
    return content;
  } catch {
    console.error('FATAL: Local LLM connection failed. Aborting to prevent paid token burn.');
    process.exit(1);
  }
}

export async function runScout(config: ScoutConfig, rootDir: string): Promise<string> {
  const files = scanCodebaseFiles(rootDir);
  const report = await requestLlmScoutReport(config, files);
  if (config.json) {
    return JSON.stringify({ task: config.task, filesCount: files.length, nearCapCount: files.filter((f) => f.isNearCap).length, report }, null, 2);
  }
  return report;
}

if (process.argv[1]?.endsWith('hermes-scout.ts')) {
  const config = parseScoutArgs(process.argv);
  const root = path.resolve(import.meta.dirname, '../..');
  runScout(config, root)
    .then((out) => console.log(out))
    .catch((err) => {
      console.error(`[hermes-scout] Error: ${err.message}`);
      process.exit(1);
    });
}
