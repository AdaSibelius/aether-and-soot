import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import {
  CommodityBlueprintSchema,
  DistrictBlueprintSchema,
  GasFluidBlueprintSchema,
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

  console.log(
    `[validate:data] OK — Validated ${prosthetics.length} prosthetics, ${commodities.length} commodities, ${gases.length} gases/fluids, ${districts.length} districts.`,
  );
}

runDataValidation();
