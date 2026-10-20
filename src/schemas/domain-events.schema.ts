import { z } from 'zod';
import {
  BlueprintIdSchema,
  EntityIdSchema,
  ItemUseEffectSchema,
  LimbSlotIdSchema,
  Point3DSchema,
} from './primitives.schema.js';

export const ItemPickedUpEventSchema = z.object({
  type: z.literal('ITEM_PICKED_UP'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  itemEntityId: EntityIdSchema,
  itemName: z.string().min(1),
  quantity: z.number().int().positive(),
  stackedIntoEntityId: EntityIdSchema.optional(),
});

export const ItemDroppedEventSchema = z.object({
  type: z.literal('ITEM_DROPPED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  itemEntityId: EntityIdSchema,
  itemName: z.string().min(1),
  quantity: z.number().int().positive(),
  at: Point3DSchema,
});

export const ItemUsedEventSchema = z.object({
  type: z.literal('ITEM_USED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  itemEntityId: EntityIdSchema,
  itemName: z.string().min(1),
  effect: ItemUseEffectSchema.shape.kind,
  amountRestored: z.number().nonnegative(),
  remainingQuantity: z.number().int().nonnegative(),
});

export const InventoryActionFailedEventSchema = z.object({
  type: z.literal('INVENTORY_ACTION_FAILED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  action: z.enum(['PICK_UP', 'DROP', 'USE']),
  itemEntityId: EntityIdSchema.optional(),
  reason: z.enum([
    'NO_INVENTORY',
    'MISSING_ANATOMY',
    'NO_ITEM_HERE',
    'ITEM_NOT_FOUND',
    'NOT_ON_TILE',
    'NOT_IN_INVENTORY',
    'NOT_CARRYABLE',
    'VOLUME_EXCEEDED',
    'MASS_EXCEEDED',
    'ITEM_INSTALLED',
    'NOT_CONSUMABLE',
    'INVALID_QUANTITY',
  ]),
});

export const DoorToggledEventSchema = z.object({
  type: z.literal('DOOR_TOGGLED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  at: Point3DSchema,
  newState: z.enum(['OPEN', 'CLOSED']),
});

export const DistrictTraveledEventSchema = z.object({
  type: z.literal('DISTRICT_TRAVELED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  fromDistrictId: BlueprintIdSchema,
  toDistrictId: BlueprintIdSchema,
});

export const TransitActionFailedEventSchema = z.object({
  type: z.literal('TRANSIT_ACTION_FAILED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  action: z.enum(['TOGGLE_DOOR', 'TRAVEL_DISTRICT']),
  reason: z.enum([
    'NOT_A_DOOR',
    'OUT_OF_RANGE',
    'BLOCKED_BY_ENTITY',
    'UNKNOWN_DISTRICT',
    'ALREADY_IN_DISTRICT',
    'NO_GATE_AT_POSITION',
  ]),
});

export const ItemCraftedEventSchema = z.object({
  type: z.literal('ITEM_CRAFTED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  recipeId: BlueprintIdSchema,
  outputEntityId: EntityIdSchema,
  outputName: z.string().min(1),
  quantity: z.number().int().positive(),
  steamSpentKpa: z.number().nonnegative(),
});

export const ItemSalvagedEventSchema = z.object({
  type: z.literal('ITEM_SALVAGED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  salvagedItemEntityId: EntityIdSchema,
  salvagedItemName: z.string().min(1),
  recoveredMaterialBlueprintId: BlueprintIdSchema,
  recoveredQuantity: z.number().int().positive(),
});

export const LimbRepairedEventSchema = z.object({
  type: z.literal('LIMB_REPAIRED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  slot: LimbSlotIdSchema,
  hpRestored: z.number().int().positive(),
  newHp: z.number().int().positive(),
  steamSpentKpa: z.number().nonnegative(),
});

export const CraftingFailedEventSchema = z.object({
  type: z.literal('CRAFTING_FAILED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  action: z.enum(['CRAFT_RECIPE', 'SALVAGE_ITEM', 'REPAIR_LIMB']),
  reason: z.enum([
    'UNKNOWN_RECIPE',
    'NO_INVENTORY',
    'MISSING_ANATOMY',
    'WORKBENCH_REQUIRED',
    'MISSING_INGREDIENTS',
    'INSUFFICIENT_STEAM',
    'VOLUME_EXCEEDED',
    'MASS_EXCEEDED',
    'ITEM_NOT_IN_INVENTORY',
    'ITEM_INSTALLED',
    'NOT_SALVAGEABLE',
    'LIMB_AMPUTATED',
    'LIMB_AT_FULL_HP',
    'RECIPE_LOCKED',
  ]),
});

export const CombatAttackResolvedEventSchema = z.object({
  type: z.literal('COMBAT_ATTACK_RESOLVED'),
  turn: z.number().int().nonnegative(),
  attackerId: EntityIdSchema,
  targetId: EntityIdSchema,
  targetSlot: LimbSlotIdSchema,
  hit: z.boolean(),
  damageDealt: z.number().int().nonnegative(),
});

export const ActorDefeatedEventSchema = z.object({
  type: z.literal('ACTOR_DEFEATED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  actorName: z.string().min(1),
  defeatedById: EntityIdSchema,
  droppedEntityIds: z.array(EntityIdSchema),
});

export const CombatActionFailedEventSchema = z.object({
  type: z.literal('COMBAT_ACTION_FAILED'),
  turn: z.number().int().nonnegative(),
  attackerId: EntityIdSchema,
  targetId: EntityIdSchema.optional(),
  reason: z.enum(['ATTACKER_NOT_FOUND', 'TARGET_NOT_FOUND', 'OUT_OF_RANGE', 'BOTH_ARMS_AMPUTATED', 'INVALID_TARGET_SLOT']),
});

export const MerchantTradeCompletedEventSchema = z.object({
  type: z.literal('MERCHANT_TRADE_COMPLETED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  merchantId: EntityIdSchema,
  tradeType: z.enum(['BUY', 'SELL']),
  itemEntityId: EntityIdSchema,
  itemName: z.string().min(1),
  quantity: z.number().int().positive(),
  totalPence: z.number().int().nonnegative(),
  playerTreasuryAfter: z.number().int().nonnegative(),
});

export const TradeActionFailedEventSchema = z.object({
  type: z.literal('TRADE_ACTION_FAILED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  merchantId: EntityIdSchema.optional(),
  action: z.enum(['BUY', 'SELL', 'STOCK_PEDESTAL']),
  reason: z.enum([
    'NO_INVENTORY',
    'MERCHANT_NOT_FOUND',
    'NOT_A_MERCHANT',
    'MERCHANT_HOSTILE',
    'OUT_OF_RANGE',
    'ITEM_NOT_FOUND',
    'ITEM_INSTALLED',
    'INSUFFICIENT_FUNDS',
    'VOLUME_EXCEEDED',
    'MASS_EXCEEDED',
    'INSUFFICIENT_COMMODITY',
  ]),
});

export const TerrainSmashedEventSchema = z.object({
  type: z.literal('TERRAIN_SMASHED'), turn: z.number().int().nonnegative(), actorId: EntityIdSchema,
  target: Point3DSchema, fromTerrain: z.string().min(1), toTerrain: z.string().min(1),
});

export const ActorRestedEventSchema = z.object({
  type: z.literal('ACTOR_RESTED'), turn: z.number().int().nonnegative(), actorId: EntityIdSchema,
  hpRestored: z.number().int().nonnegative(), bloodRestoredPct: z.number().nonnegative(),
});

export const RecipeUnlockedEventSchema = z.object({
  type: z.literal('RECIPE_UNLOCKED'), turn: z.number().int().nonnegative(), actorId: EntityIdSchema,
  recipeId: BlueprintIdSchema, itemName: z.string().min(1),
});

export const FurnitureActionFailedEventSchema = z.object({
  type: z.literal('FURNITURE_ACTION_FAILED'), turn: z.number().int().nonnegative(), actorId: EntityIdSchema,
  action: z.enum(['SMASH_TERRAIN', 'REST_AT_BED', 'LOOT_CONTAINER']),
  reason: z.enum(['OUT_OF_RANGE', 'NOT_SMASHABLE', 'NO_BED_NEARBY', 'ALREADY_RESTED', 'CONTAINER_NOT_FOUND', 'NOT_A_CONTAINER', 'CONTAINER_EMPTY', 'VOLUME_EXCEEDED', 'MASS_EXCEEDED']),
});

export const ContainerLootedEventSchema = z.object({
  type: z.literal('CONTAINER_LOOTED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  containerId: EntityIdSchema,
  containerName: z.string().min(1),
  itemIds: z.array(EntityIdSchema),
  penceGained: z.number().int().nonnegative(),
});

export const SoundEmittedEventSchema = z.object({
  type: z.literal('SOUND_EMITTED'),
  turn: z.number().int().nonnegative(),
  origin: Point3DSchema,
  decibels: z.number().int().nonnegative(),
  sourceActorId: EntityIdSchema.optional(),
});

