import { z } from 'zod';
import { EntityIdSchema, Point3DSchema, StratumIdSchema } from './primitives.schema.js';
import { StructureTypeSchema } from './safehouse-commands.schema.js';

export const CodexCategorySchema = z.enum(['AUTOMATON', 'SCHEMATIC', 'REACTION', 'THERMODYNAMICS', 'INFRASTRUCTURE']);
export type CodexCategory = z.infer<typeof CodexCategorySchema>;

export const WorkshopDeedClaimedEventSchema = z.object({
  type: z.literal('WORKSHOP_DEED_CLAIMED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  deedId: z.string(),
  stratum: StratumIdSchema,
  vaultClaimed: z.boolean(),
  safehouseName: z.string(),
});
export type WorkshopDeedClaimedEvent = z.infer<typeof WorkshopDeedClaimedEventSchema>;

export const StructureBuiltEventSchema = z.object({
  type: z.literal('STRUCTURE_BUILT'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  structureType: StructureTypeSchema,
  structureEntityId: EntityIdSchema,
  position: Point3DSchema,
});
export type StructureBuiltEvent = z.infer<typeof StructureBuiltEventSchema>;

export const StructureStorageUpdatedEventSchema = z.object({
  type: z.literal('STRUCTURE_STORAGE_UPDATED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  structureEntityId: EntityIdSchema,
  itemEntityId: EntityIdSchema,
  action: z.enum(['STORE', 'RETRIEVE']),
  itemCount: z.number().int().nonnegative(),
});
export type StructureStorageUpdatedEvent = z.infer<typeof StructureStorageUpdatedEventSchema>;

export const CodexEntryDiscoveredEventSchema = z.object({
  type: z.literal('CODEX_ENTRY_DISCOVERED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  entryId: z.string(),
  category: CodexCategorySchema,
  title: z.string(),
  description: z.string(),
});
export type CodexEntryDiscoveredEvent = z.infer<typeof CodexEntryDiscoveredEventSchema>;

export const CodexConsultedEventSchema = z.object({
  type: z.literal('CODEX_CONSULTED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  entryId: z.string().optional(),
  totalDiscovered: z.number().int().nonnegative(),
});
export type CodexConsultedEvent = z.infer<typeof CodexConsultedEventSchema>;

export const NpcCodexReactionEventSchema = z.object({
  type: z.literal('NPC_CODEX_REACTION'),
  turn: z.number().int().nonnegative(),
  npcId: EntityIdSchema,
  actorId: EntityIdSchema,
  reactionType: z.enum(['CURIOSITY', 'HOSTILITY', 'TRADE']),
  entryId: z.string(),
  dialogueText: z.string(),
});
export type NpcCodexReactionEvent = z.infer<typeof NpcCodexReactionEventSchema>;

export const SafehouseActionFailedEventSchema = z.object({
  type: z.literal('SAFEHOUSE_ACTION_FAILED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  action: z.enum(['CLAIM_DEED', 'BUILD_STRUCTURE', 'STORE_ITEM', 'RETRIEVE_ITEM', 'CONSULT_CODEX']),
  reason: z.string(),
});
export type SafehouseActionFailedEvent = z.infer<typeof SafehouseActionFailedEventSchema>;
