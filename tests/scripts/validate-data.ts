import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import {
  CommodityBlueprintSchema,
  DistrictBlueprintSchema,
  GasFluidBlueprintSchema,
  ItemBlueprintSchema,
  ProstheticBlueprintSchema,
} from '../../src/schemas/blueprint.schema.js';

const ROOT_DIR = path.resolve(import.meta.dirname, '../..');

function validateJsonFile<T>(relPath: string, schema: z.ZodType<T>): T {
  const fullPath = path.join(ROOT_DIR, relPath);
  const rawContent = fs.readFileSync(fullPath, 'utf-8');
  const parsed: unknown = JSON.parse(rawContent);
  return schema.parse(parsed);
}

function runDataValidation(): void {
  const prosthetics = validateJsonFile(
    'data/items/prosthetics.json',
    z.array(ProstheticBlueprintSchema).min(1),
  );
  const commodities = validateJsonFile(
    'data/items/commodities.json',
    z.array(CommodityBlueprintSchema).min(1),
  );
  const gases = validateJsonFile(
    'data/hazards/gases_and_fluids.json',
    z.array(GasFluidBlueprintSchema).min(1),
  );
  const districts = validateJsonFile(
    'data/districts/soot_works.json',
    z.array(DistrictBlueprintSchema).min(1),
  );
  const materials = validateJsonFile(
    'data/items/materials.json',
    z.array(ItemBlueprintSchema).min(1),
  );
  const materialIds = new Set(materials.map((m) => m.id));
  if (materialIds.size !== materials.length) {
    throw new Error('[validate:data] Duplicate item blueprint ids in data/items/materials.json');
  }

  console.log(
    `[validate:data] OK — Validated ${prosthetics.length} prosthetics, ${commodities.length} commodities, ${materials.length} materials/consumables, ${gases.length} gases/fluids, ${districts.length} districts.`,
  );
}

runDataValidation();
