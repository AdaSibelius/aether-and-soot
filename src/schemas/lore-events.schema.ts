import { z } from 'zod';
import { EntityIdSchema, FactionIdSchema, Point3DSchema } from './primitives.schema.js';
import { BarkTriggerContextSchema } from './blueprint.schema.js';

export const ProceduralBarkEmittedEventSchema = z.object({
  type: z.literal('PROCEDURAL_BARK_EMITTED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  actorName: z.string().min(1),
  trigger: BarkTriggerContextSchema,
  interpolatedText: z.string().min(1),
  acousticNoiseDb: z.number().int().nonnegative(),
  position: Point3DSchema,
});
export type ProceduralBarkEmittedEvent = z.infer<typeof ProceduralBarkEmittedEventSchema>;

export const TurfTariffEnforcedEventSchema = z.object({
  type: z.literal('TURF_TARIFF_ENFORCED'),
  turn: z.number().int().nonnegative(),
  guardId: EntityIdSchema,
  intruderId: EntityIdSchema,
  turfId: z.string().min(1),
  controllingFactionId: FactionIdSchema,
  tariffPenceCharged: z.number().int().nonnegative(),
  refused: z.boolean(),
});
export type TurfTariffEnforcedEvent = z.infer<typeof TurfTariffEnforcedEventSchema>;

export const SmogChokingPulseEventSchema = z.object({
  type: z.literal('SMOG_CHOKING_PULSE'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  smokePpm: z.number().nonnegative(),
  acousticNoiseDb: z.number().int().default(35),
  staminaLoss: z.number().int().default(10),
  position: Point3DSchema,
});
export type SmogChokingPulseEvent = z.infer<typeof SmogChokingPulseEventSchema>;

export const CorpseDesecrationWitnessedEventSchema = z.object({
  type: z.literal('CORPSE_DESECRATION_WITNESSED'),
  turn: z.number().int().nonnegative(),
  witnessId: EntityIdSchema,
  perpetratorId: EntityIdSchema,
  corpseEntityId: EntityIdSchema,
  victimFactionId: FactionIdSchema,
  reputationPenalty: z.number().int().negative(),
});
export type CorpseDesecrationWitnessedEvent = z.infer<typeof CorpseDesecrationWitnessedEventSchema>;
