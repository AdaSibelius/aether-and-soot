import fs from 'node:fs';
import path from 'node:path';
import { ContentType, validateAndFormatContent, ValidatedContent } from './hermes-content-normalizers.js';

export interface ContentGeneratorConfig {
  readonly type: ContentType;
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
  let type: ContentType = 'materials';
  let count = 2;
  let theme = 'Victorian Steampunk Industrial';
  let mock = false;
  let append = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--type' && args[i + 1]) type = args[++i] as ContentType;
    else if (a === '--count' && args[i + 1]) count = Math.max(1, parseInt(args[++i] ?? '2', 10));
    else if (a === '--theme' && args[i + 1]) theme = args[++i] ?? theme;
    else if (a === '--mock') mock = true;
    else if (a === '--append') append = true;
  }
  return {
    type, count, theme, mock, append,
    endpoint: process.env['LLM_ENDPOINT'] ?? 'http://localhost:8642/v1/chat/completions',
    apiKey: process.env['API_KEY'] ?? 'aether-dev-key',
    model: process.env['LLM_MODEL'] ?? 'hermes3:8b',
  };
}

export function generateMockContent(config: ContentGeneratorConfig): unknown[] {
  if (config.type === 'prosthetics') {
    return Array.from({ length: config.count }, (_, i) => ({
      id: `prosthetic_pneumatic_wrist_${i + 1}`,
      name: `Pneumatic Clockwork Wrist Mk.${i + 1}`,
      description: `Hydraulic reinforced wrist socket calibrated for ${config.theme}.`,
      targetLimbSlot: 'LEFT_ARM', socketType: 'ACTUATOR', massGrams: 1200, volumeMl: 900,
      steamConsumptionPerTurn: 1, moveApModifier: -5, fovRadiusBonus: 0, pressureRatingKpa: 250, noiseDb: 20,
      visual: { glyph: 'w', fgPrimary: '#D4AF37', fgSecondary: '#8B4513', bgColor: '#0A0D0E', shaderFlags: ['PULSE_STEAM'] },
    }));
  }
  if (config.type === 'districts') {
    return Array.from({ length: config.count }, (_, i) => ({
      id: `district_foundry_reach_${i + 1}`,
      name: `Foundry Reach Ward #${i + 1}`,
      dominantStratum: 'STREET', controllingFactionId: 'IRONMONGERS_CARTEL',
      ambientSmogDensity: 0.35, wealthIndex: 1.2,
      floorVisual: { glyph: '.', fgPrimary: '#5D6D7E', fgSecondary: '#2C3E50', bgColor: '#0A0D0E', shaderFlags: [] },
      wallVisual: { glyph: '#', fgPrimary: '#85929E', fgSecondary: '#1C2833', bgColor: '#0A0D0E', shaderFlags: [] },
    }));
  }
  if (config.type === 'gases') {
    return Array.from({ length: config.count }, (_, i) => ({
      id: `gas_aether_vapour_${i + 1}`,
      name: `Volatile Aether Vapour #${i + 1}`,
      diffusionRate: 0.45, dissipationPerTurn: 0.08, scaldDamagePerTurn: 8, toxicityPerTurn: 12, risesAcrossPortals: true,
      visual: { glyph: '~', fgPrimary: '#5DADE2', fgSecondary: '#2874A6', bgColor: '#0A0D0E', shaderFlags: ['HEAT_SHIMMER'] },
    }));
  }
  if (config.type === 'prefabs') {
    return Array.from({ length: config.count }, (_, i) => ({
      id: `prefab_workshop_cell_${i + 1}`,
      name: `Artificer Workshop Cell #${i + 1}`,
      width: 8, height: 6,
      layout: ['########', '#......#', '#..C...#', '#......#', '#......#', '###+####'],
    }));
  }
  if (config.type === 'materials') {
    return Array.from({ length: config.count }, (_, i) => ({
      id: `mat_hermes_brass_${i + 1}`, name: `Precision Brass Fitting #${i + 1}`,
      description: `Pneumatic brass fitting for ${config.theme}.`, category: 'MATERIAL',
      massGrams: 150 + i * 20, volumeMl: 100, stackable: true, spawnStrata: ['STREET'],
      spawnWeight: 20, spawnQuantityMax: 4, visual: { glyph: '%', fgPrimary: '#D4AF37', fgSecondary: '#8B6914', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
    }));
  }
  if (config.type === 'consumables') {
    return Array.from({ length: config.count }, (_, i) => ({
      id: `item_hermes_tonic_${i + 1}`, name: `Alchemical Tincture #${i + 1}`,
      description: `Victorian phial for ${config.theme}.`, category: 'CONSUMABLE',
      massGrams: 200, volumeMl: 200, stackable: true, useEffect: { kind: 'RESTORE_BLOOD', magnitude: 25 },
      spawnStrata: ['STREET'], spawnWeight: 15, spawnQuantityMax: 2,
      visual: { glyph: '!', fgPrimary: '#E74C3C', fgSecondary: '#922B21', bgColor: '#0A0D0E', shaderFlags: [] },
    }));
  }
  return Array.from({ length: config.count }, (_, i) => ({
    id: `recipe_hermes_fitting_${i + 1}`, name: `Craft Precision Fitting #${i + 1}`,
    description: `Assemble fittings for ${config.theme}.`, outputBlueprintId: `mat_hermes_brass_${i + 1}`,
    outputQuantity: 1, ingredients: [{ blueprintId: 'mat_brass_gears', count: 2 }],
    steamCostKpa: 10, requiresWorkbench: true, requiresManual: false, apCost: 100,
  }));
}

export function extractJsonArray(text: string): unknown[] {
  const start = text.indexOf('[');
  if (start === -1) throw new Error(`No JSON array start '[' found in response: ${text}`);
  let depth = 0, inString = false, escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (!inString) {
      if (ch === '[') depth++;
      else if (ch === ']') {
        depth--;
        if (depth === 0) return JSON.parse(text.slice(start, i + 1));
      }
    }
  }
  throw new Error(`Unbalanced JSON array in response: ${text}`);
}

export async function requestHermesContent(config: ContentGeneratorConfig): Promise<unknown[]> {
  if (config.mock) return generateMockContent(config);
  const prompt = `Lead content artificer for "Aether & Soot" (Victorian Steampunk roguelike).
Generate ${config.count} blueprints of type "${config.type}" (theme: "${config.theme}"). Return ONLY a valid JSON array.`;

  try {
    const res = await fetch(config.endpoint!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model: config.model, messages: [{ role: 'user', content: prompt }], temperature: 0.7 }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }>; response?: string };
    const rawText = data.choices?.[0]?.message?.content ?? data.response ?? '[]';
    return extractJsonArray(rawText);
  } catch (err) {
    console.warn(`[hermes-generator] Local LLM unavailable (${err}), using mock fallback.`);
    return generateMockContent(config);
  }
}

export async function runContentGeneration(config: ContentGeneratorConfig): Promise<ValidatedContent[]> {
  console.log(`[hermes-generator] Requesting ${config.count} ${config.type} (theme: "${config.theme}", mock: ${config.mock})...`);
  const raw = await requestHermesContent(config);
  const { valid, errors } = validateAndFormatContent(config.type, raw);
  if (errors.length > 0) console.warn(`[hermes-generator] ${errors.length} schema errors:\n` + errors.join('\n'));
  console.log(`[hermes-generator] Successfully validated ${valid.length} items.`);

  if (!config.append) {
    console.log(JSON.stringify(valid, null, 2));
    return valid;
  }

  const root = path.resolve(import.meta.dirname, '../..');
  let targetFile = path.join(root, 'data/items/materials.json');
  if (config.type === 'recipes') targetFile = path.join(root, 'data/items/recipes.json');
  else if (config.type === 'prosthetics') targetFile = path.join(root, 'data/items/prosthetics.json');
  else if (config.type === 'gases') targetFile = path.join(root, 'data/hazards/gases_and_fluids.json');

  if (fs.existsSync(targetFile)) {
    const existing: any[] = JSON.parse(fs.readFileSync(targetFile, 'utf-8'));
    const existingIds = new Set(existing.map((e) => e.id));
    let added = 0;
    for (const item of valid) {
      if ('id' in item && !existingIds.has((item as any).id)) {
        existing.push(item);
        existingIds.add((item as any).id);
        added++;
      }
    }
    fs.writeFileSync(targetFile, JSON.stringify(existing, null, 2) + '\n');
    console.log(`[hermes-generator] Appended ${added} new blueprints to ${path.relative(root, targetFile)}.`);
  }
  return valid;
}

if (process.argv[1]?.endsWith('hermes-content-generator.ts')) {
  const config = parseGeneratorArgs(process.argv);
  runContentGeneration(config).catch((err) => {
    console.error(`[hermes-generator] Error: ${err.message}`);
    process.exit(1);
  });
}
