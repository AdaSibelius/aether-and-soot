import { z } from 'zod';
import {
  BlueprintIdSchema,
  LimbSlotIdSchema,
  SocketTypeSchema,
  StratumIdSchema,
  VisualGlyphSpecSchema,
} from './primitives.schema.js';

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
