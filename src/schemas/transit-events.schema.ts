import { z } from 'zod';
import { BlueprintIdSchema, ConduitEdgeIdSchema, EntityIdSchema } from './primitives.schema.js';
import { ChunkCoordinateSchema } from './chunk-streaming.schema.js';

export const MonorailBoardedEventSchema = z.object({
  type: z.literal('MONORAIL_BOARDED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  monorailEntityId: EntityIdSchema,
  passengersCount: z.number().int().positive(),
});
export type MonorailBoardedEvent = z.infer<typeof MonorailBoardedEventSchema>;

export const MonorailLaunchedEventSchema = z.object({
  type: z.literal('MONORAIL_LAUNCHED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  monorailEntityId: EntityIdSchema,
  destinationDistrictId: BlueprintIdSchema,
  speedMph: z.number().nonnegative(),
  steamPressureKpa: z.number().nonnegative(),
});
export type MonorailLaunchedEvent = z.infer<typeof MonorailLaunchedEventSchema>;

export const MonorailArrivedEventSchema = z.object({
  type: z.literal('MONORAIL_ARRIVED'),
  turn: z.number().int().nonnegative(),
  monorailEntityId: EntityIdSchema,
  destinationDistrictId: BlueprintIdSchema,
  passengers: z.array(EntityIdSchema),
});
export type MonorailArrivedEvent = z.infer<typeof MonorailArrivedEventSchema>;

export const CatacombsDepthDescendedEventSchema = z.object({
  type: z.literal('CATACOMBS_DEPTH_DESCENDED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  fromDepth: z.number().int().nonnegative(),
  toDepth: z.number().int().positive(),
  tierName: z.string(),
});
export type CatacombsDepthDescendedEvent = z.infer<typeof CatacombsDepthDescendedEventSchema>;

export const CatacombsDepthAscendedEventSchema = z.object({
  type: z.literal('CATACOMBS_DEPTH_ASCENDED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  fromDepth: z.number().int().positive(),
  toDepth: z.number().int().nonnegative(),
  tierName: z.string(),
});
export type CatacombsDepthAscendedEvent = z.infer<typeof CatacombsDepthAscendedEventSchema>;

export const MonorailActionFailedEventSchema = z.object({
  type: z.literal('MONORAIL_ACTION_FAILED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  reason: z.string(),
});
export type MonorailActionFailedEvent = z.infer<typeof MonorailActionFailedEventSchema>;

export const CausalConduitModulatedEventSchema = z.object({
  type: z.literal('CAUSAL_CONDUIT_MODULATED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  edgeId: ConduitEdgeIdSchema,
  action: z.enum(['OPEN_VALVE', 'CLOSE_VALVE', 'SABOTAGE_CONDUIT', 'REPAIR_CONDUIT']),
  valveOpen: z.boolean(),
  integrityPct: z.number().min(0).max(100),
});
export type CausalConduitModulatedEvent = z.infer<typeof CausalConduitModulatedEventSchema>;

export const DistrictCausalCascadeTriggeredEventSchema = z.object({
  type: z.literal('DISTRICT_CAUSAL_CASCADE_TRIGGERED'),
  turn: z.number().int().nonnegative(),
  districtId: BlueprintIdSchema,
  cascadeType: z.enum(['STEAM_OUTAGE', 'CLINIC_STOCKOUT', 'WORKER_STRIKE', 'SLUICE_FLOODED']),
  detail: z.string(),
});
export type DistrictCausalCascadeTriggeredEvent = z.infer<
  typeof DistrictCausalCascadeTriggeredEventSchema
>;

export const ChunkWindowShiftedEventSchema = z.object({
  type: z.literal('CHUNK_WINDOW_SHIFTED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  fromCenter: ChunkCoordinateSchema.optional(),
  toCenter: ChunkCoordinateSchema,
  activeChunkCount: z.number().int().nonnegative(),
});
export type ChunkWindowShiftedEvent = z.infer<typeof ChunkWindowShiftedEventSchema>;

