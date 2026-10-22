import { z } from 'zod';
import { EntityIdSchema, Point3DSchema, StratumIdSchema } from './primitives.schema.js';

export const StructureTypeSchema = z.enum([
  'SURGICAL_TABLE',
  'ARTIFICER_BENCH',
  'STEAM_CHARGER',
  'BARRICADE_WOOD',
  'BARRICADE_IRON',
]);
export type StructureType = z.infer<typeof StructureTypeSchema>;

export const ClaimWorkshopDeedCommandSchema = z.object({
  type: z.literal('CLAIM_WORKSHOP_DEED'),
  actorId: EntityIdSchema,
  deedItemId: EntityIdSchema.optional(),
  claimVault: z.boolean().optional(),
  targetStratum: StratumIdSchema.optional(),
});
export type ClaimWorkshopDeedCommand = z.infer<typeof ClaimWorkshopDeedCommandSchema>;

export const BuildStructureCommandSchema = z.object({
  type: z.literal('BUILD_STRUCTURE'),
  actorId: EntityIdSchema,
  structureType: StructureTypeSchema,
  target: Point3DSchema,
});
export type BuildStructureCommand = z.infer<typeof BuildStructureCommandSchema>;

export const StoreItemInStructureCommandSchema = z.object({
  type: z.literal('STORE_ITEM_IN_STRUCTURE'),
  actorId: EntityIdSchema,
  structureEntityId: EntityIdSchema,
  itemEntityId: EntityIdSchema,
});
export type StoreItemInStructureCommand = z.infer<typeof StoreItemInStructureCommandSchema>;

export const RetrieveItemFromStructureCommandSchema = z.object({
  type: z.literal('RETRIEVE_ITEM_FROM_STRUCTURE'),
  actorId: EntityIdSchema,
  structureEntityId: EntityIdSchema,
  itemEntityId: EntityIdSchema,
});
export type RetrieveItemFromStructureCommand = z.infer<typeof RetrieveItemFromStructureCommandSchema>;

export const ConsultCodexCommandSchema = z.object({
  type: z.literal('CONSULT_CODEX'),
  actorId: EntityIdSchema,
  entryId: z.string().optional(),
});
export type ConsultCodexCommand = z.infer<typeof ConsultCodexCommandSchema>;
