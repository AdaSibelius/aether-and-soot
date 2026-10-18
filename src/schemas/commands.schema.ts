import { z } from 'zod';
import {
  BlueprintIdSchema,
  CommodityIdSchema,
  EntityIdSchema,
  FactionIdSchema,
  LimbSlotIdSchema,
  Point3DSchema,
} from './primitives.schema.js';

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

export const PressurizeVesselCommandSchema = z.object({
  type: z.literal('PRESSURIZE_VESSEL'),
  actorId: EntityIdSchema,
  vesselEntityId: EntityIdSchema,
  pressureAddedKpa: z.number().positive(),
});

export const EmitSparkCommandSchema = z.object({
  type: z.literal('EMIT_SPARK'),
  actorId: EntityIdSchema,
  target: Point3DSchema,
});

export const StockPedestalCommandSchema = z.object({
  type: z.literal('STOCK_PEDESTAL'),
  actorId: EntityIdSchema,
  commodity: CommodityIdSchema,
  quantity: z.number().int().positive(),
  askingPriceMarkupPct: z.number().min(-50).max(100).default(0),
});

export const TriggerSupplyShockCommandSchema = z.object({
  type: z.literal('TRIGGER_SUPPLY_SHOCK'),
  actorId: EntityIdSchema,
  commodity: CommodityIdSchema,
  supplyDelta: z.number().int(),
  factionAffected: FactionIdSchema,
  reputationDelta: z.number().int(),
});

/** Omit `itemEntityId` to pick up the first carryable item on the actor's tile (sorted by id). */
export const PickUpItemCommandSchema = z.object({
  type: z.literal('PICK_UP_ITEM'),
  actorId: EntityIdSchema,
  itemEntityId: EntityIdSchema.optional(),
});

/** Omit `quantity` to drop the entire stack. */
export const DropItemCommandSchema = z.object({
  type: z.literal('DROP_ITEM'),
  actorId: EntityIdSchema,
  itemEntityId: EntityIdSchema,
  quantity: z.number().int().positive().optional(),
});

export const UseItemCommandSchema = z.object({
  type: z.literal('USE_ITEM'),
  actorId: EntityIdSchema,
  itemEntityId: EntityIdSchema,
});

export const ToggleDoorCommandSchema = z.object({
  type: z.literal('TOGGLE_DOOR'),
  actorId: EntityIdSchema,
  target: Point3DSchema,
});

export const TravelDistrictCommandSchema = z.object({
  type: z.literal('TRAVEL_DISTRICT'),
  actorId: EntityIdSchema,
  targetDistrictId: BlueprintIdSchema,
});

export const CraftRecipeCommandSchema = z.object({
  type: z.literal('CRAFT_RECIPE'),
  actorId: EntityIdSchema,
  recipeId: BlueprintIdSchema,
});

export const SalvageItemCommandSchema = z.object({
  type: z.literal('SALVAGE_ITEM'),
  actorId: EntityIdSchema,
  itemEntityId: EntityIdSchema,
});

export const RepairLimbCommandSchema = z.object({
  type: z.literal('REPAIR_LIMB'),
  actorId: EntityIdSchema,
  slot: LimbSlotIdSchema,
});

export const AttackActorCommandSchema = z.object({
  type: z.literal('ATTACK_ACTOR'),
  attackerId: EntityIdSchema,
  targetId: EntityIdSchema,
  targetSlot: LimbSlotIdSchema.default('TORSO'),
});

export const BuyFromMerchantCommandSchema = z.object({
  type: z.literal('BUY_FROM_MERCHANT'),
  actorId: EntityIdSchema,
  merchantId: EntityIdSchema,
  itemEntityId: EntityIdSchema,
  quantity: z.number().int().positive().optional(),
});

export const SellToMerchantCommandSchema = z.object({
  type: z.literal('SELL_TO_MERCHANT'),
  actorId: EntityIdSchema,
  merchantId: EntityIdSchema,
  itemEntityId: EntityIdSchema,
  quantity: z.number().int().positive().optional(),
});

export const SmashTerrainCommandSchema = z.object({
  type: z.literal('SMASH_TERRAIN'),
  actorId: EntityIdSchema,
  target: Point3DSchema,
});

export const RestAtBedCommandSchema = z.object({
  type: z.literal('REST_AT_BED'),
  actorId: EntityIdSchema,
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
  PressurizeVesselCommandSchema,
  EmitSparkCommandSchema,
  StockPedestalCommandSchema,
  TriggerSupplyShockCommandSchema,
  PickUpItemCommandSchema,
  DropItemCommandSchema,
  UseItemCommandSchema,
  ToggleDoorCommandSchema,
  TravelDistrictCommandSchema,
  CraftRecipeCommandSchema,
  SalvageItemCommandSchema,
  RepairLimbCommandSchema,
  AttackActorCommandSchema,
  BuyFromMerchantCommandSchema,
  SellToMerchantCommandSchema,
  SmashTerrainCommandSchema,
  RestAtBedCommandSchema,
]);
export type GameCommand = z.infer<typeof GameCommandSchema>;

