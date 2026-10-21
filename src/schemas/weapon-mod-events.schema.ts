import { z } from 'zod';
import { BlueprintIdSchema, EntityIdSchema, Point3DSchema } from './primitives.schema.js';

export const WeaponModInstalledEventSchema = z.object({
  type: z.literal('WEAPON_MOD_INSTALLED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  weaponEntityId: EntityIdSchema,
  modBlueprintId: BlueprintIdSchema,
  remainingModSlots: z.number().int().nonnegative(),
});
export type WeaponModInstalledEvent = z.infer<typeof WeaponModInstalledEventSchema>;

export const WeaponModUninstalledEventSchema = z.object({
  type: z.literal('WEAPON_MOD_UNINSTALLED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  weaponEntityId: EntityIdSchema,
  modBlueprintId: BlueprintIdSchema,
  restoredEntityId: EntityIdSchema,
});
export type WeaponModUninstalledEvent = z.infer<typeof WeaponModUninstalledEventSchema>;

export const AmmoLoadedEventSchema = z.object({
  type: z.literal('AMMO_LOADED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  weaponEntityId: EntityIdSchema,
  ammoBlueprintId: BlueprintIdSchema,
  ammoCount: z.number().int().positive(),
});
export type AmmoLoadedEvent = z.infer<typeof AmmoLoadedEventSchema>;

export const ObstaclePriedEventSchema = z.object({
  type: z.literal('OBSTACLE_PRIED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  target: Point3DSchema,
  toolEntityId: EntityIdSchema,
  toolQuality: z.number().int().positive(),
  fromTerrain: z.string().min(1),
  toTerrain: z.string().min(1),
});
export type ObstaclePriedEvent = z.infer<typeof ObstaclePriedEventSchema>;

export const WeaponModActionFailedEventSchema = z.object({
  type: z.literal('WEAPON_MOD_ACTION_FAILED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  action: z.enum(['INSTALL_MOD', 'UNINSTALL_MOD', 'LOAD_AMMO', 'PRY_OBSTACLE']),
  reason: z.string().min(1),
});
export type WeaponModActionFailedEvent = z.infer<typeof WeaponModActionFailedEventSchema>;
