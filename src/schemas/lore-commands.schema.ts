import { z } from 'zod';
import { EntityIdSchema, LimbSlotIdSchema } from './primitives.schema.js';
import { BarkTriggerContextSchema } from './blueprint.schema.js';

/** Dispatches a seed-grounded dynamic vernacular bark from an NPC into the acoustic field. */
export const EmitProceduralBarkCommandSchema = z.object({
  type: z.literal('EMIT_PROCEDURAL_BARK'),
  actorId: EntityIdSchema,
  trigger: BarkTriggerContextSchema,
  targetId: EntityIdSchema.optional(),
});
export type EmitProceduralBarkCommand = z.infer<typeof EmitProceduralBarkCommandSchema>;

/** Performs forensic dissection on a corpse, discovering scientific codex lore and salvage. */
export const DissectCorpseAnatomyCommandSchema = z.object({
  type: z.literal('DISSECT_CORPSE_ANATOMY'),
  actorId: EntityIdSchema,
  corpseEntityId: EntityIdSchema,
  toolEntityId: EntityIdSchema,
  targetSlot: LimbSlotIdSchema,
});
export type DissectCorpseAnatomyCommand = z.infer<typeof DissectCorpseAnatomyCommandSchema>;

/** Enforces a territorial tariff or interrogates an intruder within faction-controlled turf. */
export const EnforceTurfAuthorityCommandSchema = z.object({
  type: z.literal('ENFORCE_TURF_AUTHORITY'),
  guardId: EntityIdSchema,
  intruderId: EntityIdSchema,
  turfId: z.string().min(1),
  action: z.enum(['DEMAND_TARIFF', 'EXPEL_TRESPASSER', 'INITIATE_ARREST']),
});
export type EnforceTurfAuthorityCommand = z.infer<typeof EnforceTurfAuthorityCommandSchema>;
