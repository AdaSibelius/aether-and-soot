import { z } from 'zod';

export const EntityIdSchema = z.string().min(1).brand<'EntityId'>();
export type EntityId = z.infer<typeof EntityIdSchema>;

export const BlueprintIdSchema = z.string().min(1).brand<'BlueprintId'>();
export type BlueprintId = z.infer<typeof BlueprintIdSchema>;

export const StratumIdSchema = z.enum(['UNDERCROFT', 'STREET', 'SPIRE', 'CATACOMBS']);
export type StratumId = z.infer<typeof StratumIdSchema>;

export const FactionIdSchema = z.enum([
  'IRONMONGERS_CARTEL',
  'CLOCKWORK_GUILD',
  'UNDERCROFT_SYNDICATE',
  'CROWN_CONSTABULARY',
]);
export type FactionId = z.infer<typeof FactionIdSchema>;

export const CommodityIdSchema = z.enum([
  'ANTHRACITE_COAL',
  'PHOSPHOR_BRONZE',
  'AETHER_VIAL',
  'CLOCKWORK_MAINSPRING',
]);
export type CommodityId = z.infer<typeof CommodityIdSchema>;

export const HexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
export type HexColor = z.infer<typeof HexColorSchema>;

export const ShaderFlagSchema = z.enum([
  'NONE',
  'PULSE_STEAM',
  'HEAT_SHIMMER',
  'SPARK_GLINT',
  'SOOT_OCCLUSION',
]);
export type ShaderFlag = z.infer<typeof ShaderFlagSchema>;

export const Point2DSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
});
export type Point2D = z.infer<typeof Point2DSchema>;

export const Point3DSchema = Point2DSchema.extend({
  stratum: StratumIdSchema,
  depthLevel: z.number().int().positive().optional(),
});
export type Point3D = z.infer<typeof Point3DSchema>;

export const TerrainTypeSchema = z.enum([
  'COBBLESTONE_FLOOR',
  'SOOT_BRICK_WALL',
  'IRON_GRATE',
  'BRASS_CATWALK',
  'WOODEN_DOOR_CLOSED',
  'WOODEN_DOOR_OPEN',
  'DISTRICT_GATE',
  'GLASS_WINDOW',
  'SMASHED_WINDOW_FRAME',
  'RUBBLE_PILE',
  'ABYSS_DROP',
]);
export type TerrainType = z.infer<typeof TerrainTypeSchema>;

export const VisualGlyphSpecSchema = z.object({
  glyph: z.string().min(1).max(32),
  fgPrimary: HexColorSchema,
  fgSecondary: HexColorSchema,
  bgColor: HexColorSchema,
  shaderFlags: z.array(ShaderFlagSchema).default([]),
});
export type VisualGlyphSpec = z.infer<typeof VisualGlyphSpecSchema>;

export const LimbSlotIdSchema = z.enum([
  'HEAD',
  'TORSO',
  'LEFT_ARM',
  'RIGHT_ARM',
  'LEFT_LEG',
  'RIGHT_LEG',
  'OCULAR_MOUNT',
  'CHASSIS_CORE',
]);
export type LimbSlotId = z.infer<typeof LimbSlotIdSchema>;

export const SocketTypeSchema = z.enum(['POWER_SOURCE', 'ACTUATOR', 'OPTIC_SENSOR']);
export type SocketType = z.infer<typeof SocketTypeSchema>;

export const ToolQualityIdSchema = z.enum([
  'SURGERY',
  'WRENCHING',
  'PRYING',
  'ALCHEMICAL',
  'LOCKPICKING',
]);
export type ToolQualityId = z.infer<typeof ToolQualityIdSchema>;

export const LiquidTypeIdSchema = z.enum([
  'NONE',
  'BLOOD',
  'WHALE_OIL',
  'NITRIC_ACID',
  'SLUICE_SLUDGE',
]);
export type LiquidTypeId = z.infer<typeof LiquidTypeIdSchema>;

export const ItemCategorySchema = z.enum(['MATERIAL', 'CONSUMABLE', 'PROSTHETIC', 'COMMODITY', 'EQUIPMENT']);
export type ItemCategory = z.infer<typeof ItemCategorySchema>;

export const ItemUseEffectSchema = z.object({
  kind: z.enum(['RESTORE_BLOOD', 'RESTORE_STEAM', 'ALCHEMICAL']),
  magnitude: z.number().default(0),
  toxicityDelta: z.number().optional(),
  staminaRestore: z.number().optional(),
  painRelief: z.number().optional(),
  appliedEffectId: z.string().optional(),
});
export type ItemUseEffect = z.infer<typeof ItemUseEffectSchema>;
