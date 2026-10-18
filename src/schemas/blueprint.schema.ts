import { z } from 'zod';
import {
  BlueprintIdSchema,
  CommodityIdSchema,
  ItemCategorySchema,
  ItemUseEffectSchema,
  LimbSlotIdSchema,
  SocketTypeSchema,
  StratumIdSchema,
  VisualGlyphSpecSchema,
} from './primitives.schema.js';
import { EquipmentSpecSchema } from './equipment.schema.js';

export const ProstheticBlueprintSchema = z.object({
  id: BlueprintIdSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  targetLimbSlot: LimbSlotIdSchema,
  socketType: SocketTypeSchema,
  massGrams: z.number().int().positive(),
  volumeMl: z.number().int().positive(),
  steamConsumptionPerTurn: z.number().nonnegative().default(0),
  moveApModifier: z.number().int().default(0),
  fovRadiusBonus: z.number().int().default(0),
  pressureRatingKpa: z.number().positive(),
  visual: VisualGlyphSpecSchema,
});
export type ProstheticBlueprint = z.infer<typeof ProstheticBlueprintSchema>;

export const CommodityBlueprintSchema = z.object({
  id: BlueprintIdSchema,
  name: z.string().min(1),
  category: z.enum(['FUEL', 'METALLURGY', 'CLOCKWORK', 'AETHERIC', 'PROVISIONS']),
  basePricePence: z.number().int().positive(),
  volatility: z.number().min(0).max(1),
  massGrams: z.number().int().positive(),
  volumeMl: z.number().int().positive(),
  flammability: z.number().min(0).max(1).default(0),
  visual: VisualGlyphSpecSchema,
});
export type CommodityBlueprint = z.infer<typeof CommodityBlueprintSchema>;

export const GasFluidBlueprintSchema = z.object({
  id: BlueprintIdSchema,
  name: z.string().min(1),
  diffusionRate: z.number().min(0).max(1),
  dissipationPerTurn: z.number().min(0).max(1),
  ignitionThresholdTempC: z.number().optional(),
  scaldDamagePerTurn: z.number().int().nonnegative().default(0),
  toxicityPerTurn: z.number().int().nonnegative().default(0),
  risesAcrossPortals: z.boolean().default(false),
  visual: VisualGlyphSpecSchema,
});
export type GasFluidBlueprint = z.infer<typeof GasFluidBlueprintSchema>;

export const DistrictBlueprintSchema = z.object({
  id: BlueprintIdSchema,
  name: z.string().min(1),
  dominantStratum: StratumIdSchema,
  controllingFactionId: z.string().min(1),
  ambientSmogDensity: z.number().min(0).max(1),
  wealthIndex: z.number().min(0.1).max(5.0),
  floorVisual: VisualGlyphSpecSchema,
  wallVisual: VisualGlyphSpecSchema,
});
export type DistrictBlueprint = z.infer<typeof DistrictBlueprintSchema>;

export const ItemBlueprintSchema = z
  .object({
    id: BlueprintIdSchema,
    name: z.string().min(1),
    description: z.string().min(1),
    category: ItemCategorySchema,
    massGrams: z.number().int().positive(),
    volumeMl: z.number().int().positive(),
    stackable: z.boolean().default(true),
    commodityId: CommodityIdSchema.optional(),
    useEffect: ItemUseEffectSchema.optional(),
    unlocksRecipeId: BlueprintIdSchema.optional(),
    equipment: EquipmentSpecSchema.optional(),
    spawnStrata: z.array(StratumIdSchema).default([]),
    spawnWeight: z.number().int().nonnegative().default(0),
    spawnQuantityMax: z.number().int().positive().default(1),
    visual: VisualGlyphSpecSchema,
  })
  .refine((bp) => bp.category !== 'CONSUMABLE' || bp.useEffect !== undefined || bp.unlocksRecipeId !== undefined, {
    message: 'CONSUMABLE items must declare a useEffect or unlocksRecipeId',
  });
export type ItemBlueprint = z.infer<typeof ItemBlueprintSchema>;

export const RecipeIngredientSchema = z.object({
  blueprintId: BlueprintIdSchema,
  count: z.number().int().positive(),
});
export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>;

export const CraftingRecipeBlueprintSchema = z.object({
  id: BlueprintIdSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  outputBlueprintId: BlueprintIdSchema,
  outputQuantity: z.number().int().positive().default(1),
  ingredients: z.array(RecipeIngredientSchema).min(1),
  steamCostKpa: z.number().nonnegative().default(0),
  requiresWorkbench: z.boolean().default(true),
  requiresManual: z.boolean().default(false),
  stationType: z.enum(['ARTIFICER_BENCH', 'ALCHEMICAL_STILL']).optional(),
  apCost: z.number().int().positive().default(100),
});
export type CraftingRecipeBlueprint = z.infer<typeof CraftingRecipeBlueprintSchema>;

