import { z } from 'zod';
import {
  EntityIdSchema,
  FactionIdSchema,
  Point3DSchema,
} from './primitives.schema.js';

export const TurfContestedEventSchema = z.object({
  type: z.literal('TURF_CONTESTED'),
  turn: z.number().int().nonnegative(),
  turfId: z.string(),
  districtId: z.string(),
  controllingFactionId: FactionIdSchema.optional(),
  contestingFactionId: FactionIdSchema,
  position: Point3DSchema,
});
export type TurfContestedEvent = z.infer<typeof TurfContestedEventSchema>;

export const TurfControlChangedEventSchema = z.object({
  type: z.literal('TURF_CONTROL_CHANGED'),
  turn: z.number().int().nonnegative(),
  turfId: z.string(),
  districtId: z.string(),
  previousFactionId: FactionIdSchema.optional(),
  newFactionId: FactionIdSchema,
});
export type TurfControlChangedEvent = z.infer<typeof TurfControlChangedEventSchema>;

export const ActorTurfStateChangedEventSchema = z.object({
  type: z.literal('ACTOR_TURF_STATE_CHANGED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  turfId: z.string().optional(),
  contested: z.boolean(),
  factionId: FactionIdSchema.optional(),
});
export type ActorTurfStateChangedEvent = z.infer<typeof ActorTurfStateChangedEventSchema>;

export const TacticalManeuverRecordedEventSchema = z.object({
  type: z.literal('TACTICAL_MANEUVER_RECORDED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  maneuverType: z.enum(['VENT_STEAM_COVER', 'PORTAL_TACTICAL_ESCAPE']),
  turfId: z.string().optional(),
  details: z.string().optional(),
});
export type TacticalManeuverRecordedEvent = z.infer<typeof TacticalManeuverRecordedEventSchema>;

export const ConvoyPreparationStartedEventSchema = z.object({
  type: z.literal('CONVOY_PREPARATION_STARTED'),
  turn: z.number().int().nonnegative(),
  convoyId: z.string(),
  actorId: EntityIdSchema,
  cargoItemId: EntityIdSchema,
  recipeId: z.string().optional(),
  clientFactionId: FactionIdSchema,
});
export type ConvoyPreparationStartedEvent = z.infer<typeof ConvoyPreparationStartedEventSchema>;

export const ConvoyEscortAssignedEventSchema = z.object({
  type: z.literal('CONVOY_ESCORT_ASSIGNED'),
  turn: z.number().int().nonnegative(),
  convoyId: z.string(),
  companionId: EntityIdSchema,
  role: z.string(),
});
export type ConvoyEscortAssignedEvent = z.infer<typeof ConvoyEscortAssignedEventSchema>;

export const ConvoyDeliveryConfirmedEventSchema = z.object({
  type: z.literal('CONVOY_DELIVERY_CONFIRMED'),
  turn: z.number().int().nonnegative(),
  convoyId: z.string(),
  actorId: EntityIdSchema,
  cargoItemId: EntityIdSchema,
  targetLocation: Point3DSchema,
  success: z.boolean(),
  rewardPence: z.number().int().nonnegative(),
  escortSurvival: z.boolean(),
});
export type ConvoyDeliveryConfirmedEvent = z.infer<typeof ConvoyDeliveryConfirmedEventSchema>;

export const NpcGoalChangedEventSchema = z.object({
  type: z.literal('NPC_GOAL_CHANGED'),
  turn: z.number().int().nonnegative(),
  npcId: EntityIdSchema,
  role: z.string(),
  previousGoal: z.string(),
  newGoal: z.string(),
  targetId: z.string().optional(),
  factionId: FactionIdSchema.optional(),
});
export type NpcGoalChangedEvent = z.infer<typeof NpcGoalChangedEventSchema>;

export const SafehouseAuditCompletedEventSchema = z.object({
  type: z.literal('SAFEHOUSE_AUDIT_COMPLETED'),
  turn: z.number().int().nonnegative(),
  auditId: z.string(),
  inspectorId: EntityIdSchema,
  deedId: z.string(),
  passed: z.boolean(),
  infractions: z.array(z.string()),
  factionReputationDelta: z.number().int(),
});
export type SafehouseAuditCompletedEvent = z.infer<typeof SafehouseAuditCompletedEventSchema>;
