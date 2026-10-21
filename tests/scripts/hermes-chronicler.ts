import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

export interface ChroniclerConfig {
  readonly target: string;
  readonly model: string;
  readonly endpoint: string;
  readonly apiKey: string;
  readonly dryRun: boolean;
  readonly mock: boolean;
}

export function parseChroniclerArgs(argv: string[]): ChroniclerConfig {
  const args = argv.slice(2);
  let target = 'src/client/ui/EventFormatter.ts';
  let dryRun = false;
  let mock = false;
  let model = process.env['LLM_MODEL'] ?? 'hermes3:8b';
  const endpoint = process.env['LLM_ENDPOINT'] ?? 'http://localhost:8642/v1/chat/completions';
  const apiKey = process.env['API_KEY'] ?? 'aether-dev-key';

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--target' && args[i + 1]) target = args[++i] ?? target;
    else if (a === '--model' && args[i + 1]) model = args[++i] ?? model;
    else if (a === '--dry-run') dryRun = true;
    else if (a === '--mock') mock = true;
  }
  return { target, model, endpoint, apiKey, dryRun, mock };
}

export function extractAllSimEventTypes(schemasDir: string): string[] {
  const eventsFile = path.join(schemasDir, 'events.schema.ts');
  if (!fs.existsSync(eventsFile)) return [];

  const eventsContent = fs.readFileSync(eventsFile, 'utf-8');
  const unionMatch = eventsContent.match(/z\.discriminatedUnion\('type',\s*\[([\s\S]*?)\]\)/);
  if (!unionMatch || !unionMatch[1]) return [];

  const schemaNames = unionMatch[1]
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.endsWith('Schema'));

  const schemaToType = new Map<string, string>();
  const schemaFiles = fs.readdirSync(schemasDir).filter((f) => f.endsWith('.ts'));

  for (const sf of schemaFiles) {
    const content = fs.readFileSync(path.join(schemasDir, sf), 'utf-8');
    const matches = content.matchAll(/export\s+const\s+([A-Za-z0-9_]+)\s*=\s*z\.object\(\{[\s\S]*?type:\s*z\.literal\(['"]([A-Z0-9_]+)['"]\)/g);
    for (const m of matches) {
      if (m[1] && m[2]) {
        schemaToType.set(m[1], m[2]);
      }
    }
  }

  const types = new Set<string>();
  for (const name of schemaNames) {
    const eventType = schemaToType.get(name);
    if (eventType) types.add(eventType);
  }
  return Array.from(types).sort();
}

export function extractHandledCases(formatterContent: string): Set<string> {
  const handled = new Set<string>();
  const matches = formatterContent.matchAll(/case\s+['"]([A-Z0-9_]+)['"]:/g);
  for (const m of matches) {
    if (m[1]) handled.add(m[1]);
  }
  return handled;
}

export function findMissingEvents(allEvents: string[], handled: Set<string>): string[] {
  return allEvents.filter((ev) => !handled.has(ev));
}

export function generateMockCase(eventType: string): string {
  const words = eventType.toLowerCase().split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return `    case '${eventType}':\n      return \`[T\${ev.turn}] Victorian chronicle: ${words}.\`;`;
}

export async function requestHermesCase(eventType: string, config: ChroniclerConfig): Promise<string> {
  if (config.mock) return generateMockCase(eventType);

  const prompt = `You are the Victorian chronicler for "Aether & Soot" (Victorian Steampunk roguelike).
Write a single TypeScript switch case for formatEventMessage(ev: SimEvent) handling event type "${eventType}".
Requirements:
1. Return format: case '${eventType}':\\n      return \`[T\${ev.turn}] <Flavor text>\`;
2. Tone: Gritty Victorian Steampunk, atmospheric, concise (1 sentence).
3. Do NOT include markdown code fences, comments, or extra text. Output ONLY the case statement.`;

  try {
    const res = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }>; response?: string };
    const raw = data.choices?.[0]?.message?.content ?? data.response ?? '';
    const clean = raw.trim().replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
    return clean.includes(`case '${eventType}':`) ? clean : generateMockCase(eventType);
  } catch (err) {
    console.warn(`[hermes-chronicler] Local LLM unavailable (${err}), using mock template.`);
    return generateMockCase(eventType);
  }
}

export function injectCasesIntoFormatter(content: string, newCases: string[]): string {
  if (newCases.length === 0) return content;
  const lastCaseIndex = content.lastIndexOf('    case ');
  if (lastCaseIndex === -1) return content;

  const returnIndex = content.indexOf(';\n', lastCaseIndex);
  if (returnIndex === -1) return content;

  const insertPos = returnIndex + 2;
  const block = '\n' + newCases.join('\n');
  return content.slice(0, insertPos) + block + content.slice(insertPos);
}

export async function runChronicler(config: ChroniclerConfig, rootDir: string): Promise<{
  missing: string[];
  injectedCount: number;
}> {
  const schemasDir = path.join(rootDir, 'src/schemas');
  const targetPath = path.resolve(rootDir, config.target);
  const content = fs.readFileSync(targetPath, 'utf-8');

  const allEvents = extractAllSimEventTypes(schemasDir);
  const handled = extractHandledCases(content);
  const missing = findMissingEvents(allEvents, handled);

  console.log(`[hermes-chronicler] Found ${allEvents.length} total events, ${handled.size} handled, ${missing.length} missing.`);

  if (missing.length === 0) {
    console.log('[hermes-chronicler] All SimEvent variants are exhaustively handled.');
    return { missing: [], injectedCount: 0 };
  }

  const generatedCases: string[] = [];
  for (const m of missing) {
    console.log(`[hermes-chronicler] Generating case for missing event: ${m}`);
    const caseCode = await requestHermesCase(m, config);
    generatedCases.push(caseCode);
  }

  if (config.dryRun) {
    console.log('[hermes-chronicler] Dry-run enabled. Generated cases:\n' + generatedCases.join('\n'));
    return { missing, injectedCount: 0 };
  }

  const updated = injectCasesIntoFormatter(content, generatedCases);
  fs.writeFileSync(targetPath, updated, 'utf-8');

  try {
    execSync('npx tsc --noEmit', { cwd: rootDir, stdio: 'pipe' });
    console.log(`[hermes-chronicler] Successfully injected ${generatedCases.length} cases into ${config.target} and verified tsc.`);
  } catch (err) {
    fs.writeFileSync(targetPath, content, 'utf-8');
    const execErr = err as { stdout?: Buffer | string; stderr?: Buffer | string };
    const detail = execErr.stdout?.toString() || execErr.stderr?.toString() || '';
    throw new Error(`[hermes-chronicler] tsc --noEmit failed after injection, reverted: ${err} ${detail}`);
  }

  return { missing, injectedCount: generatedCases.length };
}

if (process.argv[1]?.endsWith('hermes-chronicler.ts')) {
  const config = parseChroniclerArgs(process.argv);
  const root = path.resolve(import.meta.dirname, '../..');
  runChronicler(config, root).catch((err) => {
    console.error(`[hermes-chronicler] Error: ${err.message}`);
    process.exit(1);
  });
}
