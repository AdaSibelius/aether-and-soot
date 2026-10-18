import { z } from 'zod';
import { EntityIdSchema, FactionIdSchema } from './primitives.schema.js';

export const ContractKindSchema = z.enum([
  'DELIVER_ITEM',
  'SLAY_HOSTILE',
  'PRESSURIZE_BOILER',
]);
export type ContractKind = z.infer<typeof ContractKindSchema>;

export const ContractStatusSchema = z.enum([
  'AVAILABLE',
  'ACTIVE',
  'COMPLETED',
]);
export type ContractStatus = z.infer<typeof ContractStatusSchema>;

export const FactionContractSchema = z.object({
  id: z.string().min(1),
  issuerNpcId: EntityIdSchema,
  factionId: FactionIdSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  kind: ContractKindSchema,
  targetBlueprintOrEntityId: z.string().min(1),
  rewardPence: z.number().int().positive(),
  rewardReputation: z.number().int(),
  status: ContractStatusSchema,
});
export type FactionContract = z.infer<typeof FactionContractSchema>;
