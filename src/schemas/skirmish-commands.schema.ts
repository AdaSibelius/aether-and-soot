import { z } from 'zod';
import {
  EntityIdSchema,
  FactionIdSchema,
  Point3DSchema,
} from './primitives.schema.js';

export const InitiateTurfSkirmishCommandSchema = z.object({
  type: z.literal('INITIATE_TURF_SKIRMISH'),
  actorId: EntityIdSchema,
  turfId: z.string(),
});
export type InitiateTurfSkirmishCommand = z.infer<typeof InitiateTurfSkirmishCommandSchema>;

export const PrepareSupplyConvoyCommandSchema = z.object({
  type: z.literal('PREPARE_SUPPLY_CONVOY'),
  actorId: EntityIdSchema,
  cargoItemId: EntityIdSchema,
  clientFactionId: FactionIdSchema,
  destinationDistrictId: z.string(),
  destinationPos: Point3DSchema.optional(),
  rewardPence: z.number().int().nonnegative().optional(),
});
export type PrepareSupplyConvoyCommand = z.infer<typeof PrepareSupplyConvoyCommandSchema>;

export const AuditSafehouseDeedCommandSchema = z.object({
  type: z.literal('AUDIT_SAFEHOUSE_DEED'),
  actorId: EntityIdSchema,
  inspectorId: EntityIdSchema,
  deedId: z.string(),
});
export type AuditSafehouseDeedCommand = z.infer<typeof AuditSafehouseDeedCommandSchema>;
