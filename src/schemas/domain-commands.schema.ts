import { z } from 'zod';
import {
  BlueprintIdSchema,
  CommodityIdSchema,
  EntityIdSchema,
  FactionIdSchema,
  LimbSlotIdSchema,
  Point3DSchema,
} from './primitives.schema.js';
import { PostureSchema } from './components.schema.js';

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

export const PickUpItemCommandSchema = z.object({
  type: z.literal('PICK_UP_ITEM'),
  actorId: EntityIdSchema,
  itemEntityId: EntityIdSchema.optional(),
});

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

export const AcceptContractCommandSchema = z.object({
  type: z.literal('ACCEPT_CONTRACT'),
  actorId: EntityIdSchema,
  contractId: z.string().min(1),
});

export const CompleteContractCommandSchema = z.object({
  type: z.literal('COMPLETE_CONTRACT'),
  actorId: EntityIdSchema,
  contractId: z.string().min(1),
});

export const HireCompanionCommandSchema = z.object({
  type: z.literal('HIRE_COMPANION'),
  actorId: EntityIdSchema,
  npcId: EntityIdSchema,
});

export const PayChirurgeonHealCommandSchema = z.object({
  type: z.literal('PAY_CHIRURGEON_HEAL'),
  actorId: EntityIdSchema,
  chirurgeonId: EntityIdSchema,
});

export const LootContainerCommandSchema = z.object({
  type: z.literal('LOOT_CONTAINER'),
  actorId: EntityIdSchema,
  containerId: EntityIdSchema,
  itemId: EntityIdSchema.optional(),
});

export const BreachTileCommandSchema = z.object({
  type: z.literal('BREACH_TILE'),
  actorId: EntityIdSchema,
  target: Point3DSchema,
});

export const ActivateProstheticCommandSchema = z.object({
  type: z.literal('ACTIVATE_PROSTHETIC'),
  actorId: EntityIdSchema,
  slot: LimbSlotIdSchema,
  direction: z.object({ dx: z.number().int().min(-1).max(1), dy: z.number().int().min(-1).max(1) }).optional(),
  target: Point3DSchema.optional(),
  targetEntityId: EntityIdSchema.optional(),
});
export type ActivateProstheticCommand = z.infer<typeof ActivateProstheticCommandSchema>;

export const HarvestCorpseCommandSchema = z.object({
  type: z.literal('HARVEST_CORPSE'),
  actorId: EntityIdSchema,
  corpseEntityId: EntityIdSchema,
  slot: LimbSlotIdSchema.optional(),
  toolEntityId: EntityIdSchema,
});
export type HarvestCorpseCommand = z.infer<typeof HarvestCorpseCommandSchema>;

export const SetPostureCommandSchema = z.object({
  type: z.literal('SET_POSTURE'),
  actorId: EntityIdSchema,
  posture: PostureSchema,
});
export type SetPostureCommand = z.infer<typeof SetPostureCommandSchema>;

export const ApplyMomentumVectorCommandSchema = z.object({
  type: z.literal('APPLY_MOMENTUM_VECTOR'),
  targetId: EntityIdSchema,
  dx: z.number().int().min(-1).max(1),
  dy: z.number().int().min(-1).max(1),
  distanceTiles: z.number().int().min(1),
  massKg: z.number().positive().optional(),
  sourceEntityId: EntityIdSchema.optional(),
});
export type ApplyMomentumVectorCommand = z.infer<typeof ApplyMomentumVectorCommandSchema>;

export const InstallWeaponModCommandSchema = z.object({
  type: z.literal('INSTALL_WEAPON_MOD'),
  actorId: EntityIdSchema,
  weaponEntityId: EntityIdSchema,
  modEntityId: EntityIdSchema,
});
export type InstallWeaponModCommand = z.infer<typeof InstallWeaponModCommandSchema>;

export const UninstallWeaponModCommandSchema = z.object({
  type: z.literal('UNINSTALL_WEAPON_MOD'),
  actorId: EntityIdSchema,
  weaponEntityId: EntityIdSchema,
  modBlueprintId: BlueprintIdSchema,
});
export type UninstallWeaponModCommand = z.infer<typeof UninstallWeaponModCommandSchema>;

export const LoadAmmoCommandSchema = z.object({
  type: z.literal('LOAD_AMMO'),
  actorId: EntityIdSchema,
  weaponEntityId: EntityIdSchema,
  ammoEntityId: EntityIdSchema,
});
export type LoadAmmoCommand = z.infer<typeof LoadAmmoCommandSchema>;

export const PryObstacleCommandSchema = z.object({
  type: z.literal('PRY_OBSTACLE'),
  actorId: EntityIdSchema,
  target: Point3DSchema,
  toolEntityId: EntityIdSchema,
});
export type PryObstacleCommand = z.infer<typeof PryObstacleCommandSchema>;

export const CoatWeaponCommandSchema = z.object({
  type: z.literal('COAT_WEAPON'),
  actorId: EntityIdSchema,
  weaponEntityId: EntityIdSchema,
  liquidContainerId: EntityIdSchema,
});
export type CoatWeaponCommand = z.infer<typeof CoatWeaponCommandSchema>;

export const ThrowFlaskCommandSchema = z.object({
  type: z.literal('THROW_FLASK'),
  actorId: EntityIdSchema,
  target: Point3DSchema,
  flaskEntityId: EntityIdSchema,
});
export type ThrowFlaskCommand = z.infer<typeof ThrowFlaskCommandSchema>;

export const CleanSpillCommandSchema = z.object({
  type: z.literal('CLEAN_SPILL'),
  actorId: EntityIdSchema,
  target: Point3DSchema,
  toolEntityId: EntityIdSchema,
});
export type CleanSpillCommand = z.infer<typeof CleanSpillCommandSchema>;
