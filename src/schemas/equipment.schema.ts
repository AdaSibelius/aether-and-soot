import { z } from 'zod';
import { BlueprintIdSchema, EntityIdSchema, LimbSlotIdSchema } from './primitives.schema.js';

export const EquipmentSlotSchema = z.enum([
  'WIELD',
  'HEAD_WEAR',
  'TORSO_WEAR',
  'BACK_WEAR',
]);
export type EquipmentSlot = z.infer<typeof EquipmentSlotSchema>;

export const WeaponModSpecSchema = z.object({
  modType: z.enum(['BARREL', 'SILENCER', 'RECEIVER', 'CHAMBER']),
  rangeModifier: z.number().int().default(0),
  damageModifier: z.number().int().default(0),
  noiseDecibelModifier: z.number().int().default(0),
  steamCostModifier: z.number().int().default(0),
});
export type WeaponModSpec = z.infer<typeof WeaponModSpecSchema>;

export const EquipmentSpecSchema = z.object({
  equipSlot: EquipmentSlotSchema,
  meleeDamageBonus: z.number().int().nonnegative().default(0),
  armorBonus: z.number().int().nonnegative().default(0),
  storageVolumeBonusMl: z.number().int().nonnegative().default(0),
  steamResistanceKpa: z.number().int().nonnegative().default(0),
  rangedRange: z.number().int().nonnegative().default(0),
  rangedDamage: z.number().int().nonnegative().default(0),
  rangedSteamCostKpa: z.number().int().nonnegative().default(0),
  modSlots: z.number().int().nonnegative().default(0).optional(),
  installedModBlueprintIds: z.array(BlueprintIdSchema).default([]).optional(),
  loadedAmmo: z.object({ blueprintId: BlueprintIdSchema, count: z.number().int().nonnegative() }).optional(),
  weaponModSpec: WeaponModSpecSchema.optional(),
});
export type EquipmentSpec = z.infer<typeof EquipmentSpecSchema>;

export const EquipItemCommandSchema = z.object({
  type: z.literal('EQUIP_ITEM'),
  actorId: EntityIdSchema,
  itemEntityId: EntityIdSchema,
});
export type EquipItemCommand = z.infer<typeof EquipItemCommandSchema>;

export const UnequipItemCommandSchema = z.object({
  type: z.literal('UNEQUIP_ITEM'),
  actorId: EntityIdSchema,
  slot: EquipmentSlotSchema,
});
export type UnequipItemCommand = z.infer<typeof UnequipItemCommandSchema>;

export const FireRangedWeaponCommandSchema = z.object({
  type: z.literal('FIRE_RANGED_WEAPON'),
  actorId: EntityIdSchema,
  targetId: EntityIdSchema,
  targetSlot: LimbSlotIdSchema,
});
export type FireRangedWeaponCommand = z.infer<typeof FireRangedWeaponCommandSchema>;

export const ItemEquippedEventSchema = z.object({
  type: z.literal('ITEM_EQUIPPED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  itemEntityId: EntityIdSchema,
  slot: EquipmentSlotSchema,
  itemName: z.string(),
});
export type ItemEquippedEvent = z.infer<typeof ItemEquippedEventSchema>;

export const ItemUnequippedEventSchema = z.object({
  type: z.literal('ITEM_UNEQUIPPED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  itemEntityId: EntityIdSchema,
  slot: EquipmentSlotSchema,
  itemName: z.string(),
});
export type ItemUnequippedEvent = z.infer<typeof ItemUnequippedEventSchema>;

export const RangedAttackResolvedEventSchema = z.object({
  type: z.literal('RANGED_ATTACK_RESOLVED'),
  turn: z.number().int().nonnegative(),
  attackerId: EntityIdSchema,
  targetId: EntityIdSchema,
  targetSlot: LimbSlotIdSchema,
  weaponName: z.string(),
  hit: z.boolean(),
  damageDealt: z.number().int().nonnegative(),
  remainingTargetHp: z.number().int().nonnegative(),
  steamSpentKpa: z.number().int().nonnegative(),
});
export type RangedAttackResolvedEvent = z.infer<typeof RangedAttackResolvedEventSchema>;

export const EquipmentActionFailedEventSchema = z.object({
  type: z.literal('EQUIPMENT_ACTION_FAILED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  reason: z.string(),
});
export type EquipmentActionFailedEvent = z.infer<typeof EquipmentActionFailedEventSchema>;
