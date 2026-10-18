import { z } from 'zod';

export const EntityIdSchema = z.string().min(1).brand<'EntityId'>();
export type EntityId = z.infer<typeof EntityIdSchema>;

export const BlueprintIdSchema = z.string().min(1).brand<'BlueprintId'>();
export type BlueprintId = z.infer<typeof BlueprintIdSchema>;

export const StratumIdSchema = z.enum(['UNDERCROFT', 'STREET', 'SPIRE']);
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
});
export type Point3D = z.infer<typeof Point3DSchema>;

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

export const ItemCategorySchema = z.enum(['MATERIAL', 'CONSUMABLE', 'PROSTHETIC', 'COMMODITY', 'EQUIPMENT']);
export type ItemCategory = z.infer<typeof ItemCategorySchema>;

export const ItemUseEffectSchema = z.object({
  kind: z.enum(['RESTORE_BLOOD', 'RESTORE_STEAM']),
  magnitude: z.number().positive(),
});
export type ItemUseEffect = z.infer<typeof ItemUseEffectSchema>;
