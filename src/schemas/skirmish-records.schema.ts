import { z } from 'zod';
import {
  EntityIdSchema,
  FactionIdSchema,
  Point3DSchema,
  StratumIdSchema,
} from './primitives.schema.js';

export const TurfSectorBoundsSchema = z.object({
  xMin: z.number().int(),
  xMax: z.number().int(),
  yMin: z.number().int(),
  yMax: z.number().int(),
});
export type TurfSectorBounds = z.infer<typeof TurfSectorBoundsSchema>;

export const TurfSectorRecordSchema = z.object({
  turfId: z.string(),
  districtId: z.string(),
  name: z.string(),
  stratum: StratumIdSchema,
  bounds: TurfSectorBoundsSchema,
  controllingFactionId: FactionIdSchema.optional(),
  contested: z.boolean().default(false),
  controlScores: z.record(z.string(), z.number()).default({}),
  lastSkirmishTurn: z.number().int().nonnegative().optional(),
});
export type TurfSectorRecord = z.infer<typeof TurfSectorRecordSchema>;

export const EscortConvoyRecordSchema = z.object({
  convoyId: z.string(),
  clientFactionId: FactionIdSchema,
  destinationDistrictId: z.string(),
  destinationPos: Point3DSchema.optional(),
  cargoItemId: EntityIdSchema,
  stage: z.enum(['PREPARATION', 'ESCORT_ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'FAILED']).default('PREPARATION'),
  escortCompanionIds: z.array(EntityIdSchema).default([]),
  rewardPence: z.number().int().nonnegative().default(50),
  startedTurn: z.number().int().nonnegative(),
  completedTurn: z.number().int().nonnegative().optional(),
});
export type EscortConvoyRecord = z.infer<typeof EscortConvoyRecordSchema>;

export const GuildAuditRecordSchema = z.object({
  auditId: z.string(),
  inspectorId: EntityIdSchema,
  deedId: z.string(),
  status: z.enum(['SCHEDULED', 'INSPECTING', 'PASSED', 'CITATION_ISSUED']).default('SCHEDULED'),
  infractions: z.array(z.string()).default([]),
  scheduledTurn: z.number().int().nonnegative(),
  resolvedTurn: z.number().int().nonnegative().optional(),
});
export type GuildAuditRecord = z.infer<typeof GuildAuditRecordSchema>;
