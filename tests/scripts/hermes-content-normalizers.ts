import { z } from 'zod';
import {
  CraftingRecipeBlueprint,
  CraftingRecipeBlueprintSchema,
  DistrictBlueprint,
  DistrictBlueprintSchema,
  GasFluidBlueprint,
  GasFluidBlueprintSchema,
  ItemBlueprint,
  ItemBlueprintSchema,
  ProstheticBlueprint,
  ProstheticBlueprintSchema,
} from '../../src/schemas/blueprint.schema.js';

export const BuildingPrefabSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  width: z.number().int().min(4).max(20),
  height: z.number().int().min(4).max(20),
  layout: z.array(z.string()).min(4),
});
export type BuildingPrefab = z.infer<typeof BuildingPrefabSchema>;

export type ContentType = 'materials' | 'consumables' | 'recipes' | 'prosthetics' | 'districts' | 'gases' | 'prefabs';
export type ValidatedContent = ItemBlueprint | CraftingRecipeBlueprint | ProstheticBlueprint | DistrictBlueprint | GasFluidBlueprint | BuildingPrefab;

const VALID_STRATA = new Set(['UNDERCROFT', 'STREET', 'SPIRE']);
const VALID_SHADERS = new Set(['NONE', 'PULSE_STEAM', 'HEAT_SHIMMER', 'SPARK_GLINT', 'SOOT_OCCLUSION']);
const VALID_LIMBS = new Set(['HEAD', 'TORSO', 'LEFT_ARM', 'RIGHT_ARM', 'LEFT_LEG', 'RIGHT_LEG', 'OCULAR_MOUNT', 'CHASSIS_CORE']);
const VALID_SOCKETS = new Set(['ACTUATOR', 'PLATING', 'OPTIC_SENSOR', 'PNEUMATIC_VALVE', 'ORGANIC_GRAFT']);

export function normalizePrefabGrid(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  const copy = { ...raw };
  const width = Math.min(20, Math.max(4, Number(copy.width) || 8));
  const height = Math.min(20, Math.max(4, Number(copy.height) || 6));
  copy.width = width;
  copy.height = height;
  copy.id = String(copy.id ?? 'prefab_room');
  copy.name = String(copy.name ?? 'Victorian Room Prefab');

  let rows: string[] = Array.isArray(copy.layout) ? copy.layout.map(String) : [];
  while (rows.length < height) rows.push('#' + '.'.repeat(width - 2) + '#');
  if (rows.length > height) rows = rows.slice(0, height);

  rows = rows.map((row, rIdx) => {
    let r = row.padEnd(width, '.').slice(0, width);
    if (rIdx === 0 || rIdx === height - 1) {
      r = '#' + r.slice(1, width - 1).replace(/[^#+=]/g, '#') + '#';
    } else {
      r = '#' + r.slice(1, width - 1) + '#';
    }
    return r;
  });

  const hasDoor = rows.some((r) => r.includes('+'));
  if (!hasDoor) {
    const lastRow = rows[height - 1]!;
    const doorX = Math.floor(width / 2);
    rows[height - 1] = lastRow.substring(0, doorX) + '+' + lastRow.substring(doorX + 1);
  }

  copy.layout = rows;
  return copy;
}

export function normalizeRawItem(item: any, type: ContentType): any {
  if (!item || typeof item !== 'object') return item;
  if (type === 'prefabs') return normalizePrefabGrid(item);
  const copy = { ...item };
  if (!copy.name || typeof copy.name !== 'string' || copy.name.trim() === '') {
    copy.name = 'Victorian Mechanical Relic';
  }
  if (!copy.id || typeof copy.id !== 'string' || copy.id.trim() === '') {
    const slug = copy.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const prefix = type === 'materials' ? 'mat_' : type === 'consumables' ? 'con_' : type === 'recipes' ? 'rec_' : type === 'prosthetics' ? 'pros_' : type === 'districts' ? 'dist_' : type === 'gases' ? 'gas_' : 'item_';
    copy.id = `${prefix}${slug || 'relic'}`;
  }
  if (!copy.description || typeof copy.description !== 'string' || copy.description.trim() === '') {
    copy.description = `A specialized Victorian artifact forged for ${copy.name ?? 'urban survival'}.`;
  }

  const flags = Array.isArray(copy.visual?.shaderFlags) ? copy.visual.shaderFlags.filter((f: string) => VALID_SHADERS.has(f)) : [];
  const hexRegex = /^#[0-9A-Fa-f]{6}$/;
  const fgPrimary = typeof copy.visual?.fgPrimary === 'string' && hexRegex.test(copy.visual.fgPrimary) ? copy.visual.fgPrimary : '#D4AF37';
  const fgSecondary = typeof copy.visual?.fgSecondary === 'string' && hexRegex.test(copy.visual.fgSecondary) ? copy.visual.fgSecondary : '#8B6914';
  const bgColor = typeof copy.visual?.bgColor === 'string' && hexRegex.test(copy.visual.bgColor) ? copy.visual.bgColor : '#0A0D0E';
  copy.visual = {
    glyph: typeof copy.visual?.glyph === 'string' && copy.visual.glyph.length === 1 ? copy.visual.glyph : '%',
    fgPrimary,
    fgSecondary,
    bgColor,
    shaderFlags: flags,
  };

  if (type === 'prosthetics') {
    copy.targetLimbSlot = VALID_LIMBS.has(copy.targetLimbSlot) ? copy.targetLimbSlot : 'LEFT_ARM';
    copy.socketType = VALID_SOCKETS.has(copy.socketType) ? copy.socketType : 'ACTUATOR';
    copy.massGrams = Math.max(100, Math.round(Number(copy.massGrams) || 2500));
    copy.volumeMl = Math.max(100, Math.round(Number(copy.volumeMl) || 2000));
    copy.pressureRatingKpa = Math.max(50, Math.round(Number(copy.pressureRatingKpa) || 200));
    copy.steamConsumptionPerTurn = Math.max(0, Number(copy.steamConsumptionPerTurn) || 0);
    copy.moveApModifier = Number(copy.moveApModifier) || 0;
    copy.noiseDb = Math.max(0, Number(copy.noiseDb) || 15);
  } else if (type === 'districts') {
    copy.dominantStratum = VALID_STRATA.has(copy.dominantStratum) ? copy.dominantStratum : 'STREET';
    copy.controllingFactionId = String(copy.controllingFactionId ?? 'CROWN_CONSTABULARY');
    copy.ambientSmogDensity = Math.min(1, Math.max(0, Number(copy.ambientSmogDensity) || 0.2));
    copy.wealthIndex = Math.min(5, Math.max(0.1, Number(copy.wealthIndex) || 1.0));
    copy.floorVisual = { glyph: '.', fgPrimary: '#5D6D7E', fgSecondary: '#34495E', bgColor: '#0A0D0E', shaderFlags: [] };
    copy.wallVisual = { glyph: '#', fgPrimary: '#85929E', fgSecondary: '#2C3E50', bgColor: '#0A0D0E', shaderFlags: [] };
  } else if (type === 'gases') {
    copy.diffusionRate = Math.min(1, Math.max(0, Number(copy.diffusionRate) || 0.4));
    copy.dissipationPerTurn = Math.min(1, Math.max(0, Number(copy.dissipationPerTurn) || 0.1));
    copy.scaldDamagePerTurn = Math.max(0, Math.round(Number(copy.scaldDamagePerTurn) || 0));
    copy.toxicityPerTurn = Math.max(0, Math.round(Number(copy.toxicityPerTurn) || 0));
    copy.risesAcrossPortals = Boolean(copy.risesAcrossPortals ?? false);
  } else if (type === 'materials' || type === 'consumables') {
    if (!copy.category || (copy.category !== 'MATERIAL' && copy.category !== 'CONSUMABLE')) {
      copy.category = type === 'materials' ? 'MATERIAL' : 'CONSUMABLE';
    }
    if (copy.category === 'CONSUMABLE' && !copy.useEffect && !copy.unlocksRecipeId) {
      copy.useEffect = { kind: 'RESTORE_BLOOD', magnitude: 20 };
    }
    const mass = Math.max(10, Math.round(Number(copy.massGrams) || 120));
    copy.massGrams = mass;
    copy.volumeMl = Math.max(10, Math.round(Number(copy.volumeMl) || mass * 0.8));
    const strata = Array.isArray(copy.spawnStrata) ? copy.spawnStrata.filter((s: string) => VALID_STRATA.has(s)) : [];
    copy.spawnStrata = strata.length > 0 ? strata : ['STREET'];
    copy.spawnWeight = Math.max(1, Math.round(Number(copy.spawnWeight) || 20));
    copy.spawnQuantityMax = Math.max(1, Math.round(Number(copy.spawnQuantityMax) || 3));
    copy.stackable = Boolean(copy.stackable ?? true);
  }
  return copy;
}

export function validateAndFormatContent(type: ContentType, rawItems: unknown[]): {
  valid: ValidatedContent[];
  errors: string[];
} {
  let schema: z.ZodTypeAny = ItemBlueprintSchema;
  if (type === 'recipes') schema = CraftingRecipeBlueprintSchema;
  else if (type === 'prosthetics') schema = ProstheticBlueprintSchema;
  else if (type === 'districts') schema = DistrictBlueprintSchema;
  else if (type === 'gases') schema = GasFluidBlueprintSchema;
  else if (type === 'prefabs') schema = BuildingPrefabSchema;

  const valid: ValidatedContent[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rawItems.length; i++) {
    const normalized = normalizeRawItem(rawItems[i], type);
    const parsed = schema.safeParse(normalized);
    if (parsed.success) {
      valid.push(parsed.data as ValidatedContent);
    } else {
      errors.push(`Item [${i}]: ${parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
  }
  return { valid, errors };
}
