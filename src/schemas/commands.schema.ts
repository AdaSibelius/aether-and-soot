import { z } from 'zod';
import {
  EntityIdSchema,
  LimbSlotIdSchema,
  Point3DSchema,
} from './primitives.schema.js';
import {
  EquipItemCommandSchema,
  UnequipItemCommandSchema,
  FireRangedWeaponCommandSchema,
} from './equipment.schema.js';
import {
  BoardMonorailCommandSchema,
  LaunchMonorailCommandSchema,
  DescendCatacombsCommandSchema,
} from './transit-commands.schema.js';
export {
  BoardMonorailCommandSchema,
  LaunchMonorailCommandSchema,
  DescendCatacombsCommandSchema,
} from './transit-commands.schema.js';
export type {
  BoardMonorailCommand,
  LaunchMonorailCommand,
  DescendCatacombsCommand,
} from './transit-commands.schema.js';
export type {
  EmitSquadCalloutCommand,
  ReportCrimeCommand,
  WitnessCommand,
} from './witness-commands.schema.js';
import {
  EmitSquadCalloutCommandSchema,
  ReportCrimeCommandSchema,
  WitnessCommandSchema,
} from './witness-commands.schema.js';
export {
  EmitSquadCalloutCommandSchema,
  ReportCrimeCommandSchema,
  WitnessCommandSchema,
};
export type {
  ActivateProstheticCommand,
  HarvestCorpseCommand,
  SetPostureCommand,
  ApplyMomentumVectorCommand,
  InstallWeaponModCommand,
  UninstallWeaponModCommand,
  LoadAmmoCommand,
  PryObstacleCommand,
  CoatWeaponCommand,
  ThrowFlaskCommand,
  CleanSpillCommand,
} from './domain-commands.schema.js';
import {
  AcceptContractCommandSchema,
  ActivateProstheticCommandSchema,
  ApplyMomentumVectorCommandSchema,
  BreachTileCommandSchema,
  BuyFromMerchantCommandSchema,
  CleanSpillCommandSchema,
  CoatWeaponCommandSchema,
  CompleteContractCommandSchema,
  CraftRecipeCommandSchema,
  DropItemCommandSchema,
  HarvestCorpseCommandSchema,
  HireCompanionCommandSchema,
  InstallWeaponModCommandSchema,
  LoadAmmoCommandSchema,
  LootContainerCommandSchema,
  PayChirurgeonHealCommandSchema,
  PickUpItemCommandSchema,
  PryObstacleCommandSchema,
  RepairLimbCommandSchema,
  RestAtBedCommandSchema,
  SalvageItemCommandSchema,
  SellToMerchantCommandSchema,
  SetPostureCommandSchema,
  SmashTerrainCommandSchema,
  StockPedestalCommandSchema,
  ThrowFlaskCommandSchema,
  ToggleDoorCommandSchema,
  TravelDistrictCommandSchema,
  TriggerSupplyShockCommandSchema,
  UninstallWeaponModCommandSchema,
  UseItemCommandSchema,
} from './domain-commands.schema.js';

export {
  EquipItemCommandSchema,
  UnequipItemCommandSchema,
  FireRangedWeaponCommandSchema,
  AcceptContractCommandSchema,
  ActivateProstheticCommandSchema,
  ApplyMomentumVectorCommandSchema,
  BreachTileCommandSchema,
  BuyFromMerchantCommandSchema,
  CleanSpillCommandSchema,
  CoatWeaponCommandSchema,
  CompleteContractCommandSchema,
  CraftRecipeCommandSchema,
  DropItemCommandSchema,
  HarvestCorpseCommandSchema,
  HireCompanionCommandSchema,
  InstallWeaponModCommandSchema,
  LoadAmmoCommandSchema,
  LootContainerCommandSchema,
  PayChirurgeonHealCommandSchema,
  PickUpItemCommandSchema,
  PryObstacleCommandSchema,
  RepairLimbCommandSchema,
  RestAtBedCommandSchema,
  SalvageItemCommandSchema,
  SellToMerchantCommandSchema,
  SetPostureCommandSchema,
  SmashTerrainCommandSchema,
  ThrowFlaskCommandSchema,
  UninstallWeaponModCommandSchema,
  StockPedestalCommandSchema,
  ToggleDoorCommandSchema,
  TravelDistrictCommandSchema,
  TriggerSupplyShockCommandSchema,
  UseItemCommandSchema,
};

export const MoveStepCommandSchema = z.object({
  type: z.literal('MOVE_STEP'),
  actorId: EntityIdSchema,
  dx: z.number().int().min(-1).max(1),
  dy: z.number().int().min(-1).max(1),
});

export const UsePortalCommandSchema = z.object({ type: z.literal('USE_PORTAL'), actorId: EntityIdSchema });
export const WaitTurnCommandSchema = z.object({ type: z.literal('WAIT_TURN'), actorId: EntityIdSchema });

export const VentSteamCommandSchema = z.object({
  type: z.literal('VENT_STEAM'),
  actorId: EntityIdSchema,
  target: Point3DSchema,
  pressureReleasedKpa: z.number().positive(),
  bypassReserveCheck: z.boolean().optional(),
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
  pressureAddedKpa: z.number().positive().default(50).optional(),
  bypassFuelRequirement: z.boolean().optional(),
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

export const AttackActorCommandSchema = z.object({
  type: z.literal('ATTACK_ACTOR'),
  attackerId: EntityIdSchema,
  targetId: EntityIdSchema,
  targetSlot: LimbSlotIdSchema.default('TORSO'),
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
  AcceptContractCommandSchema,
  CompleteContractCommandSchema,
  HireCompanionCommandSchema,
  PayChirurgeonHealCommandSchema,
  EquipItemCommandSchema,
  UnequipItemCommandSchema,
  FireRangedWeaponCommandSchema,
  LootContainerCommandSchema,
  BreachTileCommandSchema,
  ActivateProstheticCommandSchema,
  HarvestCorpseCommandSchema,
  SetPostureCommandSchema,
  ApplyMomentumVectorCommandSchema,
  InstallWeaponModCommandSchema,
  UninstallWeaponModCommandSchema,
  LoadAmmoCommandSchema,
  PryObstacleCommandSchema,
  CoatWeaponCommandSchema,
  ThrowFlaskCommandSchema,
  CleanSpillCommandSchema,
  EmitSquadCalloutCommandSchema,
  ReportCrimeCommandSchema,
  BoardMonorailCommandSchema,
  LaunchMonorailCommandSchema,
  DescendCatacombsCommandSchema,
]);
export type GameCommand = z.infer<typeof GameCommandSchema>;
