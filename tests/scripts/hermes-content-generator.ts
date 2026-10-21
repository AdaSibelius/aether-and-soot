import fs from 'node:fs';
import path from 'node:path';
import { ItemBlueprint, ItemBlueprintSchema, CraftingRecipeBlueprintSchema, CraftingRecipeBlueprint } from '../../src/schemas/blueprint.schema.js';

export interface ContentGeneratorConfig {
  readonly type: 'materials' | 'consumables' | 'recipes';
  readonly count: number;
  readonly theme: string;
  readonly mock: boolean;
  readonly append: boolean;
  readonly endpoint?: string;
  readonly apiKey?: string;
  readonly model?: string;
}

export function parseGeneratorArgs(argv: string[]): ContentGeneratorConfig {
  const args = argv.slice(2);
  let type: 'materials' | 'consumables' | 'recipes' = 'materials';
  let count = 3;
  let theme = 'Victorian Steampunk Industrial';
  let mock = false;
  let append = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--type' && args[i + 1]) type = args[++i] as any;
    else if (a === '--count' && args[i + 1]) count = Math.max(1, parseInt(args[++i] ?? '3', 10));
    else if (a === '--theme' && args[i + 1]) theme = args[++i] ?? theme;
    else if (a === '--mock') mock = true;
    else if (a === '--append') append = true;
  }

  return {
    type,
    count,
    theme,
    mock,
    append,
    endpoint: process.env['LLM_ENDPOINT'] ?? 'http://localhost:8642/v1/chat/completions',
    apiKey: process.env['API_KEY'] ?? 'aether-dev-key',
    model: process.env['LLM_MODEL'] ?? 'hermes-agent',
  };
}

export function generateMockContent(config: ContentGeneratorConfig): unknown[] {
  if (config.type === 'materials') {
    return Array.from({ length: config.count }, (_, i) => ({
      id: `mat_hermes_brass_fitting_${i + 1}`,
      name: `Precision Brass Fitting #${i + 1}`,
      description: `Finely threaded Victorian brass pneumatic fitting forged for ${config.theme}.`,
      category: 'MATERIAL',
      massGrams: 150 + i * 20,
      volumeMl: 100 + i * 15,
      stackable: true,
      spawnStrata: ['STREET', 'SPIRE'],
      spawnWeight: 20,
      spawnQuantityMax: 4,
      visual: { glyph: '%', fgPrimary: '#D4AF37', fgSecondary: '#8B6914', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
    }));
  }
  if (config.type === 'consumables') {
    return Array.from({ length: config.count }, (_, i) => ({
      id: `item_hermes_tincture_${i + 1}`,
      name: `Alchemical Tincture #${i + 1}`,
      description: `A bubbling Victorian phial prepared according to ${config.theme}.`,
      category: 'CONSUMABLE',
      massGrams: 200,
      volumeMl: 200,
      stackable: true,
      useEffect: { kind: 'RESTORE_BLOOD', magnitude: 25 },
      spawnStrata: ['STREET', 'UNDERCROFT'],
      spawnWeight: 15,
      spawnQuantityMax: 2,
      visual: { glyph: '!', fgPrimary: '#E74C3C', fgSecondary: '#922B21', bgColor: '#0A0D0E', shaderFlags: [] },
    }));
  }
  return Array.from({ length: config.count }, (_, i) => ({
    id: `recipe_hermes_fitting_${i + 1}`,
    name: `Craft Precision Fitting #${i + 1}`,
    description: `Assemble Victorian brass fittings for ${config.theme}.`,
    outputBlueprintId: `mat_hermes_brass_fitting_${i + 1}`,
    outputQuantity: 1,
    ingredients: [{ blueprintId: 'mat_brass_gears', count: 2 }],
    steamCostKpa: 10,
    requiresWorkbench: true,
    requiresManual: false,
    apCost: 100,
  }));
}

export async function requestHermesContent(config: ContentGeneratorConfig): Promise<unknown[]> {
  if (config.mock) return generateMockContent(config);

  const example = config.type === 'recipes'
    ? `[{"id":"recipe_copper_valve","name":"Forge Copper Valve","description":"Turn raw copper into a high-pressure pneumatic valve.","outputBlueprintId":"mat_copper_valve","outputQuantity":1,"ingredients":[{"blueprintId":"mat_brass_gears","count":2}],"steamCostKpa":15,"requiresWorkbench":true,"requiresManual":false,"apCost":100}]`
    : `[{"id":"mat_gas_mantle","name":"Soot-Stained Gas Mantle","description":"A perforated ceramic burner mantle salvaged from a Victorian lantern.","category":"${config.type === 'consumables' ? 'CONSUMABLE' : 'MATERIAL'}","massGrams":90,"volumeMl":75,"stackable":true,"spawnStrata":["STREET","UNDERCROFT"],"spawnWeight":20,"spawnQuantityMax":3,"visual":{"glyph":"*","fgPrimary":"#F4D03F","fgSecondary":"#B7950B","bgColor":"#0A0D0E","shaderFlags":["SPARK_GLINT"]}${config.type === 'consumables' ? ',"useEffect":{"kind":"RESTORE_BLOOD","magnitude":25}' : ''}}]`;

  const prompt = `You are the lead content artificer for "Aether & Soot", a Victorian Steampunk 2D roguelike.
Generate exactly ${config.count} new blueprints of type "${config.type}" matching theme: "${config.theme}".
Return ONLY a valid JSON array of objects. Do not include markdown preamble.
Follow this exact example structure:
${example}`;

  const res = await fetch(config.endpoint!, {
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

  if (!res.ok) throw new Error(`Hermes API error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }>; response?: string };
  const rawText = data.choices?.[0]?.message?.content ?? data.response ?? '[]';
  return extractJsonArray(rawText);
}

export function extractJsonArray(text: string): unknown[] {
  const start = text.indexOf('[');
  if (start === -1) throw new Error(`No JSON array start '[' found in response: ${text}`);
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === '[') depth++;
      else if (ch === ']') {
        depth--;
        if (depth === 0) {
          return JSON.parse(text.slice(start, i + 1));
        }
      }
    }
  }
  throw new Error(`Unbalanced JSON array in response: ${text}`);
}

const VALID_STRATA = new Set(['UNDERCROFT', 'STREET', 'SPIRE']);
const VALID_SHADERS = new Set(['NONE', 'PULSE_STEAM', 'HEAT_SHIMMER', 'SPARK_GLINT', 'SOOT_OCCLUSION']);

function normalizeRawItem(item: any, type: ContentGeneratorConfig['type']): any {
  if (!item || typeof item !== 'object') return item;
  const copy = { ...item };
  if (!copy.description || typeof copy.description !== 'string' || copy.description.trim() === '') {
    copy.description = `A specialized Victorian artifact forged for ${copy.name ?? 'urban survival'}.`;
  }
  if (type !== 'recipes') {
    const mass = Math.max(10, Math.round(Number(copy.massGrams) || 120));
    copy.massGrams = mass;
    copy.volumeMl = Math.max(10, Math.round(Number(copy.volumeMl) || mass * 0.8));
    const strata = Array.isArray(copy.spawnStrata) ? copy.spawnStrata.filter((s: string) => VALID_STRATA.has(s)) : [];
    copy.spawnStrata = strata.length > 0 ? strata : ['STREET'];
    copy.spawnWeight = Math.max(1, Math.round(Number(copy.spawnWeight) || 20));
    copy.spawnQuantityMax = Math.max(1, Math.round(Number(copy.spawnQuantityMax) || 3));
    copy.stackable = Boolean(copy.stackable ?? true);

    const flags = Array.isArray(copy.visual?.shaderFlags) ? copy.visual.shaderFlags.filter((f: string) => VALID_SHADERS.has(f)) : [];
    copy.visual = {
      glyph: typeof copy.visual?.glyph === 'string' && copy.visual.glyph.length === 1 ? copy.visual.glyph : '%',
      fgPrimary: copy.visual?.fgPrimary ?? '#D4AF37',
      fgSecondary: copy.visual?.fgSecondary ?? '#8B6914',
      bgColor: copy.visual?.bgColor ?? '#0A0D0E',
      shaderFlags: flags,
    };
  }
  return copy;
}

export function validateAndFormatContent(type: ContentGeneratorConfig['type'], rawItems: unknown[]): {
  valid: (ItemBlueprint | CraftingRecipeBlueprint)[];
  errors: string[];
} {
  const schema = type === 'recipes' ? CraftingRecipeBlueprintSchema : ItemBlueprintSchema;
  const valid: (ItemBlueprint | CraftingRecipeBlueprint)[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rawItems.length; i++) {
    const normalized = normalizeRawItem(rawItems[i], type);
    const parsed = schema.safeParse(normalized);
    if (parsed.success) {
      valid.push(parsed.data as any);
    } else {
      errors.push(`Item [${i}]: ${parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
  }

  return { valid, errors };
}

export async function runContentGeneration(config: ContentGeneratorConfig): Promise<void> {
  console.log(`[hermes-generator] Requesting ${config.count} ${config.type} (theme: "${config.theme}", mock: ${config.mock})...`);
  const raw = await requestHermesContent(config);
  const { valid, errors } = validateAndFormatContent(config.type, raw);

  if (errors.length > 0) {
    console.warn(`[hermes-generator] Encountered ${errors.length} schema validation errors:\n` + errors.join('\n'));
  }

  console.log(`[hermes-generator] Successfully validated ${valid.length} items.`);
  if (!config.append) {
    console.log(JSON.stringify(valid, null, 2));
    return;
  }

  const root = path.resolve(import.meta.dirname, '../..');
  const targetFile = config.type === 'recipes' ? path.join(root, 'data/items/recipes.json') : path.join(root, 'data/items/materials.json');
  const existing: any[] = JSON.parse(fs.readFileSync(targetFile, 'utf-8'));
  const existingIds = new Set(existing.map((e) => e.id));

  let added = 0;
  for (const item of valid) {
    if (!existingIds.has(item.id)) {
      existing.push(item);
      existingIds.add(item.id);
      added++;
    } else {
      console.warn(`[hermes-generator] Skipping duplicate id: ${item.id}`);
    }
  }

  fs.writeFileSync(targetFile, JSON.stringify(existing, null, 2) + '\n');
  console.log(`[hermes-generator] Appended ${added} new blueprints to ${path.relative(root, targetFile)}.`);
}

if (process.argv[1]?.endsWith('hermes-content-generator.ts')) {
  const config = parseGeneratorArgs(process.argv);
  runContentGeneration(config).catch((err) => {
    console.error(`[hermes-generator] Error: ${err.message}`);
    process.exit(1);
  });
}
