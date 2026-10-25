import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import {
  BarkCorpusBlueprintSchema,
  CodexLoreBlueprintSchema,
  CommodityBlueprintSchema,
  CraftingRecipeBlueprintSchema,
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
  const districtFiles = ['soot_works.json', 'whitechapel_ward.json', 'limehouse_docks.json'];
  const districts = districtFiles.flatMap((f) =>
    validateJsonFile(`data/districts/${f}`, z.array(DistrictBlueprintSchema).min(1)),
  );
  const materials = validateJsonFile(
    'data/items/materials.json',
    z.array(ItemBlueprintSchema).min(1),
  );
  const materialIds = new Set(materials.map((m) => m.id));
  if (materialIds.size !== materials.length) {
    throw new Error('[validate:data] Duplicate item blueprint ids in data/items/materials.json');
  }

  const recipes = validateJsonFile(
    'data/items/recipes.json',
    z.array(CraftingRecipeBlueprintSchema).min(1),
  );
  const recipeIds = new Set(recipes.map((r) => r.id));
  if (recipeIds.size !== recipes.length) {
    throw new Error('[validate:data] Duplicate recipe ids in data/items/recipes.json');
  }

  const allCraftableOutputs = new Set([
    ...materials.map((m) => m.id),
    ...prosthetics.map((p) => p.id),
    ...commodities.map((c) => c.id),
  ]);
  for (const recipe of recipes) {
    if (!allCraftableOutputs.has(recipe.outputBlueprintId)) {
      throw new Error(
        `[validate:data] Recipe ${recipe.id} references unknown outputBlueprintId: ${recipe.outputBlueprintId}`,
      );
    }
    for (const ing of recipe.ingredients) {
      if (!materialIds.has(ing.blueprintId)) {
        throw new Error(
          `[validate:data] Recipe ${recipe.id} references unknown ingredient blueprintId: ${ing.blueprintId}`,
        );
      }
    }
  }

  const barks = validateJsonFile(
    'data/corpora/barks.json',
    z.array(BarkCorpusBlueprintSchema).min(1),
  );
  const codexLore = validateJsonFile(
    'data/corpora/codex_lore.json',
    z.array(CodexLoreBlueprintSchema).min(1),
  );

  console.log(
    `[validate:data] OK — Validated ${prosthetics.length} prosthetics, ${commodities.length} commodities, ${materials.length} materials/consumables, ${recipes.length} recipes, ${gases.length} gases/fluids, ${districts.length} districts, ${barks.length} bark corpora, ${codexLore.length} codex entries.`,
  );
}

runDataValidation();
