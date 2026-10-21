import { z } from 'zod';
import { BlueprintIdSchema, EntityIdSchema } from './primitives.schema.js';

export const AlchemicalConsumedEventSchema = z.object({
  type: z.literal('ALCHEMICAL_CONSUMED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  itemEntityId: EntityIdSchema.optional(),
  blueprintId: BlueprintIdSchema.optional(),
  toxicityDelta: z.number(),
  staminaDelta: z.number(),
  painRelief: z.number(),
  appliedEffectId: z.string().optional(),
});
export type AlchemicalConsumedEvent = z.infer<typeof AlchemicalConsumedEventSchema>;

export const ToxicityOverdoseEventSchema = z.object({
  type: z.literal('TOXICITY_OVERDOSE'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  toxicityPct: z.number().min(0).max(100),
  bloodVolumeLost: z.number().nonnegative().default(0),
  damageInflicted: z.number().nonnegative().default(0),
});
export type ToxicityOverdoseEvent = z.infer<typeof ToxicityOverdoseEventSchema>;

export const WithdrawalOnsetEventSchema = z.object({
  type: z.literal('WITHDRAWAL_ONSET'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  effectId: z.string().min(1),
  penaltyAp: z.number().nonnegative().default(0),
});
export type WithdrawalOnsetEvent = z.infer<typeof WithdrawalOnsetEventSchema>;

export const StaminaDepletedEventSchema = z.object({
  type: z.literal('STAMINA_DEPLETED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
});
export type StaminaDepletedEvent = z.infer<typeof StaminaDepletedEventSchema>;
