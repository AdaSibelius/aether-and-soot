import { z } from 'zod';
import { EntityIdSchema, LimbSlotIdSchema, Point3DSchema } from './primitives.schema.js';

export const MoveStepCommandSchema = z.object({
  type: z.literal('MOVE_STEP'),
  actorId: EntityIdSchema,
  dx: z.number().int().min(-1).max(1),
  dy: z.number().int().min(-1).max(1),
});

export const UsePortalCommandSchema = z.object({
  type: z.literal('USE_PORTAL'),
  actorId: EntityIdSchema,
});

export const WaitTurnCommandSchema = z.object({
  type: z.literal('WAIT_TURN'),
  actorId: EntityIdSchema,
});

export const VentSteamCommandSchema = z.object({
  type: z.literal('VENT_STEAM'),
  actorId: EntityIdSchema,
  target: Point3DSchema,
  pressureReleasedKpa: z.number().positive(),
});

export const DamageLimbCommandSchema = z.object({
  type: z.literal('DAMAGE_LIMB'),
  actorId: EntityIdSchema,
  targetId: EntityIdSchema,
  slot: LimbSlotIdSchema,
  damage: z.number().int().positive(),
});

export const InstallProstheticCommandSchema = z.object({
  type: z.literal('INSTALL_PROSTHETIC'),
  actorId: EntityIdSchema,
  prostheticEntityId: EntityIdSchema,
  slot: LimbSlotIdSchema,
});

export const RemoveProstheticCommandSchema = z.object({
  type: z.literal('REMOVE_PROSTHETIC'),
  actorId: EntityIdSchema,
  slot: LimbSlotIdSchema,
});

export const RefillSteamCommandSchema = z.object({
  type: z.literal('REFILL_STEAM'),
  actorId: EntityIdSchema,
  pressureAddedKpa: z.number().positive(),
});

export const GameCommandSchema = z.discriminatedUnion('type', [
  MoveStepCommandSchema,
  UsePortalCommandSchema,
  WaitTurnCommandSchema,
  VentSteamCommandSchema,
  DamageLimbCommandSchema,
  InstallProstheticCommandSchema,
  RemoveProstheticCommandSchema,
  RefillSteamCommandSchema,
]);
export type GameCommand = z.infer<typeof GameCommandSchema>;
