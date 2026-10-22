import fs from 'node:fs';
import path from 'node:path';
import { ContentType, validateAndFormatContent, ValidatedContent } from './hermes-content-normalizers.js';
import { resolveEndpoint, resolveModel, queryLocalOllama } from './local-llm-config.js';

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
  let endpointOverride: string | undefined;
  let modelOverride: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--type' && args[i + 1]) type = args[++i] as ContentType;
    else if (a === '--count' && args[i + 1]) count = Math.max(1, parseInt(args[++i] ?? '2', 10));
    else if (a === '--theme' && args[i + 1]) theme = args[++i] ?? theme;
    else if (a === '--mock') mock = true;
    else if (a === '--append') append = true;
    else if (a === '--endpoint' && args[i + 1]) endpointOverride = args[++i];
    else if (a === '--model' && args[i + 1]) modelOverride = args[++i];
  }
  return {
    type, count, theme, mock, append,
    endpoint: resolveEndpoint(endpointOverride),
    apiKey: process.env['API_KEY'] ?? 'aether-dev-key',
    model: resolveModel('tier3', modelOverride),
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
    const combatAlchemicals = [
      {
        id: 'item_laudanum_tincture',
        name: 'Laudanum Tincture',
        description: 'A dark, bitter opiate tincture. Dulces acute pain and shock while courting toxic dependency.',
        category: 'CONSUMABLE',
        massGrams: 180, volumeMl: 150, stackable: true,
        useEffect: { kind: 'ALCHEMICAL', magnitude: 15, toxicityDelta: 20, painRelief: 40, appliedEffectId: 'laudanum_sedation' },
        spawnStrata: ['UNDERCROFT', 'STREET', 'SPIRE'], spawnWeight: 14, spawnQuantityMax: 2,
        visual: { glyph: '!', fgPrimary: '#8E44AD', fgSecondary: '#5B2C6F', bgColor: '#0A0D0E', shaderFlags: [] },
      },
      {
        id: 'item_aether_salt_stimulant',
        name: 'Aether-Salt Stimulant',
        description: 'Volatile crystalline salts suspended in spirit. Overclocks physical stamina, courting rapid toxicity and withdrawal tremors.',
        category: 'CONSUMABLE',
        massGrams: 160, volumeMl: 120, stackable: true,
        useEffect: { kind: 'ALCHEMICAL', magnitude: 25, toxicityDelta: 25, staminaRestore: 50, appliedEffectId: 'stim_aether_rush' },
        spawnStrata: ['STREET', 'SPIRE'], spawnWeight: 12, spawnQuantityMax: 2,
        visual: { glyph: '!', fgPrimary: '#3498DB', fgSecondary: '#1B4F72', bgColor: '#0A0D0E', shaderFlags: ['PULSE_STEAM'] },
      },
      {
        id: 'item_quicksilver_reflex_draught',
        name: 'Quicksilver Reflex Draught',
        description: 'Metallic mercury suspension accelerating synaptic twitch reflexes under dangerous metabolic strain.',
        category: 'CONSUMABLE',
        massGrams: 220, volumeMl: 140, stackable: true,
        useEffect: { kind: 'ALCHEMICAL', magnitude: 30, toxicityDelta: 30, staminaRestore: 40, appliedEffectId: 'stim_quicksilver_haste' },
        spawnStrata: ['STREET', 'SPIRE'], spawnWeight: 10, spawnQuantityMax: 1,
        visual: { glyph: '!', fgPrimary: '#BDC3C7', fgSecondary: '#7F8C8D', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
      },
      {
        id: 'item_black_bile_emetic',
        name: 'Black-Bile Emetic',
        description: 'Violent apothecary purgative that expels systemic toxins at the price of raw physical exhaustion.',
        category: 'CONSUMABLE',
        massGrams: 200, volumeMl: 180, stackable: true,
        useEffect: { kind: 'ALCHEMICAL', magnitude: 0, toxicityDelta: -40, staminaRestore: -20, painRelief: -10 },
        spawnStrata: ['UNDERCROFT', 'STREET'], spawnWeight: 15, spawnQuantityMax: 2,
        visual: { glyph: '!', fgPrimary: '#17202A', fgSecondary: '#2C3E50', bgColor: '#0A0D0E', shaderFlags: [] },
      },
    ];

    return combatAlchemicals.slice(0, config.count);
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
    const rawText = await queryLocalOllama(prompt, {
      model: config.model,
      endpoint: config.endpoint,
      systemPrompt: 'You are the lead content artificer for Aether & Soot. Return ONLY a valid JSON array starting with [ and ending with ] without any markdown quotes or introductory remarks.',
      temperature: 0.7,
      formatJson: true,
    });
    return extractJsonArray(rawText);
  } catch {
    console.error('FATAL: Local LLM connection failed. Aborting to prevent paid token burn.');
    process.exit(1);
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
