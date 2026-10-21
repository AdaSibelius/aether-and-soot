import { z } from 'zod';
import { EntityIdSchema, LiquidTypeIdSchema, Point3DSchema } from './primitives.schema.js';

export const LiquidSpilledEventSchema = z.object({
  type: z.literal('LIQUID_SPILLED'),
  turn: z.number().int().nonnegative(),
  target: Point3DSchema,
  liquidType: LiquidTypeIdSchema,
  volumeMl: z.number().int().positive(),
  sourceActorId: EntityIdSchema.optional(),
});
export type LiquidSpilledEvent = z.infer<typeof LiquidSpilledEventSchema>;

export const LiquidIgnitedEventSchema = z.object({
  type: z.literal('LIQUID_IGNITED'),
  turn: z.number().int().nonnegative(),
  target: Point3DSchema,
  liquidType: LiquidTypeIdSchema,
  burnedVolumeMl: z.number().int().positive(),
  thermalDamage: z.number().int().nonnegative(),
});
export type LiquidIgnitedEvent = z.infer<typeof LiquidIgnitedEventSchema>;

export const ItemCoatedEventSchema = z.object({
  type: z.literal('ITEM_COATED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  itemEntityId: EntityIdSchema,
  liquidType: LiquidTypeIdSchema,
  volumeMl: z.number().int().positive(),
});
export type ItemCoatedEvent = z.infer<typeof ItemCoatedEventSchema>;

export const AcidCorrosionTickEventSchema = z.object({
  type: z.literal('ACID_CORROSION_TICK'),
  turn: z.number().int().nonnegative(),
  targetId: EntityIdSchema,
  damageInflicted: z.number().int().positive(),
  at: Point3DSchema,
});
export type AcidCorrosionTickEvent = z.infer<typeof AcidCorrosionTickEventSchema>;

export const SurfaceSlippedEventSchema = z.object({
  type: z.literal('SURFACE_SLIPPED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  liquidType: LiquidTypeIdSchema,
  at: Point3DSchema,
});
export type SurfaceSlippedEvent = z.infer<typeof SurfaceSlippedEventSchema>;

export const LiquidActionFailedEventSchema = z.object({
  type: z.literal('LIQUID_ACTION_FAILED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  action: z.enum(['COAT_WEAPON', 'THROW_FLASK', 'CLEAN_SPILL']),
  reason: z.string().min(1),
});
export type LiquidActionFailedEvent = z.infer<typeof LiquidActionFailedEventSchema>;
