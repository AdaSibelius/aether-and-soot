import { z } from 'zod';
import {
  ActorDefeatedEventSchema, ActorRestedEventSchema, CombatActionFailedEventSchema,
  CombatAttackResolvedEventSchema, ContainerLootedEventSchema, CraftingFailedEventSchema, DistrictTraveledEventSchema,
  DoorToggledEventSchema, FurnitureActionFailedEventSchema, InventoryActionFailedEventSchema,
  ItemCraftedEventSchema, ItemDroppedEventSchema, ItemPickedUpEventSchema,
  ItemSalvagedEventSchema, ItemUsedEventSchema, LimbRepairedEventSchema,
  MerchantTradeCompletedEventSchema, RecipeUnlockedEventSchema, TerrainSmashedEventSchema,
  TradeActionFailedEventSchema, TransitActionFailedEventSchema, SoundEmittedEventSchema,
  WallBreachedEventSchema, ActorFellStratumEventSchema, TrapTriggeredEventSchema,
} from './domain-events.schema.js';
import {
  ChirurgeonHealCompletedEventSchema, CompanionRecruitedEventSchema,
  ContractAcceptedEventSchema, ContractCompletedEventSchema,
  DialogueActionFailedEventSchema,
} from './contract-events.schema.js';
import {
  ActorWaitedEventSchema, CoalDustIgnitedEventSchema, EntityMovedEventSchema,
  LimbAmputatedEventSchema, LimbDamagedEventSchema, MacroTickCompletedEventSchema,
  MovementBlockedEventSchema, PedestalStockedEventSchema, PortalFailedEventSchema,
  ProstheticActionFailedEventSchema, ProstheticInstalledEventSchema,
  ProstheticRemovedEventSchema, SteamRefilledEventSchema, SteamRefillFailedEventSchema, SteamVentedEventSchema, SteamVentFailedEventSchema,
  StorefrontSaleCompletedEventSchema, StratumChangedEventSchema,
  SupplyShockTriggeredEventSchema, ThermalScaldEventSchema, VesselRupturedEventSchema,
  ProstheticActivatedEventSchema, GovernorOverloadedEventSchema,
  CyberneticHarvestedEventSchema, HarvestActionFailedEventSchema,
} from './core-events.schema.js';
import {
  EquipmentActionFailedEventSchema, ItemEquippedEventSchema,
  ItemUnequippedEventSchema, RangedAttackResolvedEventSchema,
} from './equipment.schema.js';
import {
  AlchemicalConsumedEventSchema, ToxicityOverdoseEventSchema,
  WithdrawalOnsetEventSchema, StaminaDepletedEventSchema,
} from './metabolism-events.schema.js';
import {
  PostureChangedEventSchema,
  EntityKnockedBackEventSchema,
  MomentumCollisionImpactEventSchema,
} from './momentum-events.schema.js';
import {
  WeaponModInstalledEventSchema,
  WeaponModUninstalledEventSchema,
  AmmoLoadedEventSchema,
  ObstaclePriedEventSchema,
  WeaponModActionFailedEventSchema,
} from './weapon-mod-events.schema.js';
import {
  LiquidSpilledEventSchema, LiquidIgnitedEventSchema, ItemCoatedEventSchema,
  AcidCorrosionTickEventSchema, SurfaceSlippedEventSchema, LiquidActionFailedEventSchema,
} from './liquid-events.schema.js';
import { HazardTriggeredEventSchema, type HazardTriggeredEvent, type HazardType } from './hazard-events.schema.js';
export { HazardTriggeredEventSchema };
export type { HazardTriggeredEvent, HazardType };
import {
  MonorailBoardedEventSchema, MonorailLaunchedEventSchema, MonorailArrivedEventSchema,
  CatacombsDepthDescendedEventSchema, CatacombsDepthAscendedEventSchema, TransitActionFailedEventSchema2,
} from './transit-events.schema.js';
export {
  MonorailBoardedEventSchema, MonorailLaunchedEventSchema, MonorailArrivedEventSchema,
  CatacombsDepthDescendedEventSchema, CatacombsDepthAscendedEventSchema, TransitActionFailedEventSchema2,
};
export type {
  MonorailBoardedEvent, MonorailLaunchedEvent, MonorailArrivedEvent,
  CatacombsDepthDescendedEvent, CatacombsDepthAscendedEvent, MonorailActionFailedEvent,
} from './transit-events.schema.js';

import {
  WitnessCrimeReportedEventSchema, SquadCalloutEmittedEventSchema,
  SquadmateRalliedEventSchema, GrudgeAcquiredEventSchema, WitnessEventSchema,
} from './witness-events.schema.js';
export {
  WitnessCrimeReportedEventSchema, SquadCalloutEmittedEventSchema,
  SquadmateRalliedEventSchema, GrudgeAcquiredEventSchema, WitnessEventSchema,
};
export type {
  WitnessCrimeReportedEvent, SquadCalloutEmittedEvent,
  SquadmateRalliedEvent, GrudgeAcquiredEvent, WitnessEvent,
} from './witness-events.schema.js';

import {
  WorkshopDeedClaimedEventSchema, StructureBuiltEventSchema,
  StructureStorageUpdatedEventSchema, CodexEntryDiscoveredEventSchema,
  CodexConsultedEventSchema, NpcCodexReactionEventSchema, SafehouseActionFailedEventSchema,
} from './safehouse-events.schema.js';
export {
  WorkshopDeedClaimedEventSchema, StructureBuiltEventSchema,
  StructureStorageUpdatedEventSchema, CodexEntryDiscoveredEventSchema,
  CodexConsultedEventSchema, NpcCodexReactionEventSchema, SafehouseActionFailedEventSchema,
};
export type {
  WorkshopDeedClaimedEvent, StructureBuiltEvent,
  StructureStorageUpdatedEvent, CodexEntryDiscoveredEvent,
  CodexConsultedEvent, NpcCodexReactionEvent, SafehouseActionFailedEvent,
} from './safehouse-events.schema.js';

import {
  TurfContestedEventSchema, TurfControlChangedEventSchema,
  ActorTurfStateChangedEventSchema, TacticalManeuverRecordedEventSchema,
  ConvoyPreparationStartedEventSchema, ConvoyEscortAssignedEventSchema,
  ConvoyDeliveryConfirmedEventSchema, NpcGoalChangedEventSchema,
  SafehouseAuditCompletedEventSchema,
} from './skirmish-politics-events.schema.js';
export {
  TurfContestedEventSchema, TurfControlChangedEventSchema,
  ActorTurfStateChangedEventSchema, TacticalManeuverRecordedEventSchema,
  ConvoyPreparationStartedEventSchema, ConvoyEscortAssignedEventSchema,
  ConvoyDeliveryConfirmedEventSchema, NpcGoalChangedEventSchema,
  SafehouseAuditCompletedEventSchema,
};
export type {
  TurfContestedEvent, TurfControlChangedEvent,
  ActorTurfStateChangedEvent, TacticalManeuverRecordedEvent,
  ConvoyPreparationStartedEvent, ConvoyEscortAssignedEvent,
  ConvoyDeliveryConfirmedEvent, NpcGoalChangedEvent,
  SafehouseAuditCompletedEvent,
} from './skirmish-politics-events.schema.js';
import {
  ProceduralBarkEmittedEventSchema, TurfTariffEnforcedEventSchema,
  SmogChokingPulseEventSchema, CorpseDesecrationWitnessedEventSchema,
} from './lore-events.schema.js';
export {
  ProceduralBarkEmittedEventSchema, TurfTariffEnforcedEventSchema,
  SmogChokingPulseEventSchema, CorpseDesecrationWitnessedEventSchema,
} from './lore-events.schema.js';
export type {
  ProceduralBarkEmittedEvent, TurfTariffEnforcedEvent,
  SmogChokingPulseEvent, CorpseDesecrationWitnessedEvent,
} from './lore-events.schema.js';

export {
  ActorDefeatedEventSchema, ActorRestedEventSchema, CombatActionFailedEventSchema,
  CombatAttackResolvedEventSchema, ContainerLootedEventSchema, CraftingFailedEventSchema, DistrictTraveledEventSchema,
  DoorToggledEventSchema, FurnitureActionFailedEventSchema, InventoryActionFailedEventSchema,
  ItemCraftedEventSchema, ItemDroppedEventSchema, ItemPickedUpEventSchema,
  ItemSalvagedEventSchema, ItemUsedEventSchema, LimbRepairedEventSchema,
  MerchantTradeCompletedEventSchema, RecipeUnlockedEventSchema, TerrainSmashedEventSchema,
  TradeActionFailedEventSchema, TransitActionFailedEventSchema, SoundEmittedEventSchema,
  WallBreachedEventSchema, ActorFellStratumEventSchema, TrapTriggeredEventSchema,
  ChirurgeonHealCompletedEventSchema, CompanionRecruitedEventSchema,
  ContractAcceptedEventSchema, ContractCompletedEventSchema,
  DialogueActionFailedEventSchema,
  ActorWaitedEventSchema, CoalDustIgnitedEventSchema, EntityMovedEventSchema,
  LimbAmputatedEventSchema, LimbDamagedEventSchema, MacroTickCompletedEventSchema,
  MovementBlockedEventSchema, PedestalStockedEventSchema, PortalFailedEventSchema,
  ProstheticActionFailedEventSchema, ProstheticInstalledEventSchema,
  ProstheticRemovedEventSchema, SteamRefilledEventSchema, SteamRefillFailedEventSchema, SteamVentedEventSchema, SteamVentFailedEventSchema,
  StorefrontSaleCompletedEventSchema, StratumChangedEventSchema,
  SupplyShockTriggeredEventSchema, ThermalScaldEventSchema, VesselRupturedEventSchema,
  EquipmentActionFailedEventSchema, ItemEquippedEventSchema,
  ItemUnequippedEventSchema, RangedAttackResolvedEventSchema,
  ProstheticActivatedEventSchema, GovernorOverloadedEventSchema,
  CyberneticHarvestedEventSchema, HarvestActionFailedEventSchema,
  AlchemicalConsumedEventSchema, ToxicityOverdoseEventSchema,
  WithdrawalOnsetEventSchema, StaminaDepletedEventSchema,
  PostureChangedEventSchema,
  EntityKnockedBackEventSchema,
  MomentumCollisionImpactEventSchema,
  WeaponModInstalledEventSchema,
  WeaponModUninstalledEventSchema,
  AmmoLoadedEventSchema,
  ObstaclePriedEventSchema,
  WeaponModActionFailedEventSchema,
  LiquidSpilledEventSchema,
  LiquidIgnitedEventSchema,
  ItemCoatedEventSchema,
  AcidCorrosionTickEventSchema,
  SurfaceSlippedEventSchema,
  LiquidActionFailedEventSchema,
};

export const SimEventSchema = z.discriminatedUnion('type', [
  EntityMovedEventSchema,
  MovementBlockedEventSchema,
  StratumChangedEventSchema,
  PortalFailedEventSchema,
  ActorWaitedEventSchema,
  SteamVentedEventSchema,
  SteamVentFailedEventSchema,
  LimbDamagedEventSchema,
  LimbAmputatedEventSchema,
  ProstheticInstalledEventSchema,
  ProstheticRemovedEventSchema,
  ProstheticActionFailedEventSchema,
  SteamRefilledEventSchema,
  SteamRefillFailedEventSchema,
  VesselRupturedEventSchema,
  CoalDustIgnitedEventSchema,
  ThermalScaldEventSchema,
  PedestalStockedEventSchema,
  SupplyShockTriggeredEventSchema,
  StorefrontSaleCompletedEventSchema,
  MacroTickCompletedEventSchema,
  ItemPickedUpEventSchema,
  ItemDroppedEventSchema,
  ItemUsedEventSchema,
  InventoryActionFailedEventSchema,
  DoorToggledEventSchema,
  DistrictTraveledEventSchema,
  TransitActionFailedEventSchema,
  ItemCraftedEventSchema,
  ItemSalvagedEventSchema,
  LimbRepairedEventSchema,
  CraftingFailedEventSchema,
  CombatAttackResolvedEventSchema, ActorDefeatedEventSchema, CombatActionFailedEventSchema,
  MerchantTradeCompletedEventSchema, TradeActionFailedEventSchema, TerrainSmashedEventSchema,
  ActorRestedEventSchema, RecipeUnlockedEventSchema, FurnitureActionFailedEventSchema,
  ContractAcceptedEventSchema, ContractCompletedEventSchema, CompanionRecruitedEventSchema,
  ChirurgeonHealCompletedEventSchema, DialogueActionFailedEventSchema,
  ItemEquippedEventSchema, ItemUnequippedEventSchema, RangedAttackResolvedEventSchema,
  EquipmentActionFailedEventSchema, ContainerLootedEventSchema, SoundEmittedEventSchema,
  WallBreachedEventSchema, ActorFellStratumEventSchema, TrapTriggeredEventSchema,
  ProstheticActivatedEventSchema, GovernorOverloadedEventSchema,
  CyberneticHarvestedEventSchema, HarvestActionFailedEventSchema,
  AlchemicalConsumedEventSchema, ToxicityOverdoseEventSchema,
  WithdrawalOnsetEventSchema, StaminaDepletedEventSchema,
  PostureChangedEventSchema, EntityKnockedBackEventSchema, MomentumCollisionImpactEventSchema,
  WeaponModInstalledEventSchema, WeaponModUninstalledEventSchema,
  AmmoLoadedEventSchema, ObstaclePriedEventSchema, WeaponModActionFailedEventSchema,
  LiquidSpilledEventSchema, LiquidIgnitedEventSchema, ItemCoatedEventSchema,
  AcidCorrosionTickEventSchema, SurfaceSlippedEventSchema, LiquidActionFailedEventSchema,
  WitnessCrimeReportedEventSchema, SquadCalloutEmittedEventSchema,
  SquadmateRalliedEventSchema, GrudgeAcquiredEventSchema,
  MonorailBoardedEventSchema, MonorailLaunchedEventSchema, MonorailArrivedEventSchema,
  CatacombsDepthDescendedEventSchema, CatacombsDepthAscendedEventSchema, TransitActionFailedEventSchema2,
  WorkshopDeedClaimedEventSchema, StructureBuiltEventSchema,
  StructureStorageUpdatedEventSchema, CodexEntryDiscoveredEventSchema,
  CodexConsultedEventSchema, NpcCodexReactionEventSchema, SafehouseActionFailedEventSchema,
  TurfContestedEventSchema, TurfControlChangedEventSchema,
  ActorTurfStateChangedEventSchema, TacticalManeuverRecordedEventSchema,
  ConvoyPreparationStartedEventSchema, ConvoyEscortAssignedEventSchema,
  ConvoyDeliveryConfirmedEventSchema, NpcGoalChangedEventSchema, SafehouseAuditCompletedEventSchema,
  HazardTriggeredEventSchema,
  ProceduralBarkEmittedEventSchema, TurfTariffEnforcedEventSchema,
  SmogChokingPulseEventSchema, CorpseDesecrationWitnessedEventSchema,
]);
export type SimEvent = z.infer<typeof SimEventSchema>;
