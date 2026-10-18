import { z } from 'zod';
import {
  EntityIdSchema,
  LimbSlotIdSchema,
  Point3DSchema,
  StratumIdSchema,
} from './primitives.schema.js';

export const EntityMovedEventSchema = z.object({
  type: z.literal('ENTITY_MOVED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  from: Point3DSchema,
  to: Point3DSchema,
  apSpent: z.number().int().positive(),
});

export const MovementBlockedEventSchema = z.object({
  type: z.literal('MOVEMENT_BLOCKED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  target: Point3DSchema,
  reason: z.enum(['OUT_OF_BOUNDS', 'SOLID_TILE', 'OCCUPIED_BY_ENTITY']),
  blockerEntityId: EntityIdSchema.optional(),
});

export const StratumChangedEventSchema = z.object({
  type: z.literal('STRATUM_CHANGED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  portalEntityId: EntityIdSchema,
  fromStratum: StratumIdSchema,
  toStratum: StratumIdSchema,
  destination: Point3DSchema,
});

export const PortalFailedEventSchema = z.object({
  type: z.literal('PORTAL_FAILED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  reason: z.enum(['NO_PORTAL_AT_POSITION', 'DESTINATION_BLOCKED']),
});

export const ActorWaitedEventSchema = z.object({
  type: z.literal('ACTOR_WAITED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  apSpent: z.number().int().positive(),
});

export const SteamVentedEventSchema = z.object({
  type: z.literal('STEAM_VENTED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  origin: Point3DSchema,
  pressureReleasedKpa: z.number().positive(),
});

export const LimbDamagedEventSchema = z.object({
  type: z.literal('LIMB_DAMAGED'),
  turn: z.number().int().nonnegative(),
  targetId: EntityIdSchema,
  slot: LimbSlotIdSchema,
  damage: z.number().int().positive(),
  remainingHp: z.number().int().nonnegative(),
});

export const LimbAmputatedEventSchema = z.object({
  type: z.literal('LIMB_AMPUTATED'),
  turn: z.number().int().nonnegative(),
  targetId: EntityIdSchema,
  slot: LimbSlotIdSchema,
});

export const ProstheticInstalledEventSchema = z.object({
  type: z.literal('PROSTHETIC_INSTALLED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  prostheticEntityId: EntityIdSchema,
  slot: LimbSlotIdSchema,
});

export const ProstheticRemovedEventSchema = z.object({
  type: z.literal('PROSTHETIC_REMOVED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  prostheticEntityId: EntityIdSchema,
  slot: LimbSlotIdSchema,
});

export const ProstheticActionFailedEventSchema = z.object({
  type: z.literal('PROSTHETIC_ACTION_FAILED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  slot: LimbSlotIdSchema,
  reason: z.enum([
    'MISSING_ANATOMY',
    'PROSTHETIC_NOT_FOUND',
    'SLOT_MISMATCH',
    'SLOT_ALREADY_OCCUPIED',
    'NO_PROSTHETIC_INSTALLED',
  ]),
});

export const SteamRefilledEventSchema = z.object({
  type: z.literal('STEAM_REFILLED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  newReserveKpa: z.number().nonnegative(),
});

export const MacroTickCompletedEventSchema = z.object({
  type: z.literal('MACRO_TICK_COMPLETED'),
  turn: z.number().int().nonnegative(),
  macroTickIndex: z.number().int().positive(),
});

export const SimEventSchema = z.discriminatedUnion('type', [
  EntityMovedEventSchema,
  MovementBlockedEventSchema,
  StratumChangedEventSchema,
  PortalFailedEventSchema,
  ActorWaitedEventSchema,
  SteamVentedEventSchema,
  LimbDamagedEventSchema,
  LimbAmputatedEventSchema,
  ProstheticInstalledEventSchema,
  ProstheticRemovedEventSchema,
  ProstheticActionFailedEventSchema,
  SteamRefilledEventSchema,
  MacroTickCompletedEventSchema,
]);
export type SimEvent = z.infer<typeof SimEventSchema>;
