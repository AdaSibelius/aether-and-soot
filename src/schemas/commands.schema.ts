import { z } from 'zod';
import { EntityIdSchema, Point3DSchema } from './primitives.schema.js';

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

export const GameCommandSchema = z.discriminatedUnion('type', [
  MoveStepCommandSchema,
  UsePortalCommandSchema,
  WaitTurnCommandSchema,
  VentSteamCommandSchema,
]);
export type GameCommand = z.infer<typeof GameCommandSchema>;
