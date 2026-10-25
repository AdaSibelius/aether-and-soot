import { z } from 'zod';
import { EntityIdSchema, LimbSlotIdSchema,  } from './primitives.schema.js';

export const CombatAttackResolvedEventSchema = z.object({
  type: z.literal('COMBAT_ATTACK_RESOLVED'),
  turn: z.number().int().nonnegative(),
  attackerId: EntityIdSchema,
  targetId: EntityIdSchema,
  targetSlot: LimbSlotIdSchema,
  hit: z.boolean(),
  damageDealt: z.number().int().nonnegative(),
});

export const ActorDefeatedEventSchema = z.object({
  type: z.literal('ACTOR_DEFEATED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  actorName: z.string().min(1),
  defeatedById: EntityIdSchema,
  droppedEntityIds: z.array(EntityIdSchema),
});

export const CombatActionFailedEventSchema = z.object({
  type: z.literal('COMBAT_ACTION_FAILED'),
  turn: z.number().int().nonnegative(),
  attackerId: EntityIdSchema,
  targetId: EntityIdSchema.optional(),
  reason: z.enum(['ATTACKER_NOT_FOUND', 'TARGET_NOT_FOUND', 'OUT_OF_RANGE', 'BOTH_ARMS_AMPUTATED', 'INVALID_TARGET_SLOT']),
});
