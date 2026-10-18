import { z } from 'zod';
import { EntityIdSchema, FactionIdSchema } from './primitives.schema.js';

export const ContractAcceptedEventSchema = z.object({
  type: z.literal('CONTRACT_ACCEPTED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  contractId: z.string().min(1),
  title: z.string().min(1),
});
export type ContractAcceptedEvent = z.infer<typeof ContractAcceptedEventSchema>;

export const ContractCompletedEventSchema = z.object({
  type: z.literal('CONTRACT_COMPLETED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  contractId: z.string().min(1),
  title: z.string().min(1),
  rewardPence: z.number().int().positive(),
  rewardReputation: z.number().int(),
  factionId: FactionIdSchema,
});
export type ContractCompletedEvent = z.infer<typeof ContractCompletedEventSchema>;

export const CompanionRecruitedEventSchema = z.object({
  type: z.literal('COMPANION_RECRUITED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  companionId: EntityIdSchema,
  companionName: z.string().min(1),
  feePence: z.number().int().nonnegative(),
});
export type CompanionRecruitedEvent = z.infer<typeof CompanionRecruitedEventSchema>;

export const ChirurgeonHealCompletedEventSchema = z.object({
  type: z.literal('CHIRURGEON_HEAL_COMPLETED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  chirurgeonId: EntityIdSchema,
  feePence: z.number().int().nonnegative(),
  hpRestored: z.number().int().nonnegative(),
  bloodRestoredPct: z.number().nonnegative(),
});
export type ChirurgeonHealCompletedEvent = z.infer<typeof ChirurgeonHealCompletedEventSchema>;

export const DialogueActionFailedEventSchema = z.object({
  type: z.literal('DIALOGUE_ACTION_FAILED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  action: z.enum([
    'ACCEPT_CONTRACT',
    'COMPLETE_CONTRACT',
    'HIRE_COMPANION',
    'PAY_CHIRURGEON_HEAL',
  ]),
  reason: z.string().min(1),
});
export type DialogueActionFailedEvent = z.infer<typeof DialogueActionFailedEventSchema>;
