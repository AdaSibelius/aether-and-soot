import { z } from 'zod';
import { EntityIdSchema, FactionIdSchema } from './primitives.schema.js';

export const WitnessCrimeReportedEventSchema = z.object({
  type: z.literal('WITNESS_CRIME_REPORTED'),
  turn: z.number().int().nonnegative(),
  witnessId: EntityIdSchema,
  perpetratorId: EntityIdSchema,
  crime: z.enum(['THEFT', 'ASSAULT', 'TRESPASS']),
  factionId: FactionIdSchema,
  reputationPenalty: z.number().int(),
});
export type WitnessCrimeReportedEvent = z.infer<typeof WitnessCrimeReportedEventSchema>;

export const SquadCalloutEmittedEventSchema = z.object({
  type: z.literal('SQUAD_CALLOUT_EMITTED'),
  turn: z.number().int().nonnegative(),
  callerId: EntityIdSchema,
  targetId: EntityIdSchema,
  squadId: z.string(),
  noiseDb: z.number().int().positive(),
  calloutMessage: z.string(),
});
export type SquadCalloutEmittedEvent = z.infer<typeof SquadCalloutEmittedEventSchema>;

export const SquadmateRalliedEventSchema = z.object({
  type: z.literal('SQUADMATE_RALLIED'),
  turn: z.number().int().nonnegative(),
  squadmateId: EntityIdSchema,
  callerId: EntityIdSchema,
  targetId: EntityIdSchema,
  squadId: z.string(),
});
export type SquadmateRalliedEvent = z.infer<typeof SquadmateRalliedEventSchema>;

export const GrudgeAcquiredEventSchema = z.object({
  type: z.literal('GRUDGE_ACQUIRED'),
  turn: z.number().int().nonnegative(),
  holderId: EntityIdSchema,
  targetId: EntityIdSchema,
  reason: z.string(),
});
export type GrudgeAcquiredEvent = z.infer<typeof GrudgeAcquiredEventSchema>;

export const WitnessEventSchema = z.discriminatedUnion('type', [
  WitnessCrimeReportedEventSchema,
  SquadCalloutEmittedEventSchema,
  SquadmateRalliedEventSchema,
  GrudgeAcquiredEventSchema,
]);
export type WitnessEvent = z.infer<typeof WitnessEventSchema>;
