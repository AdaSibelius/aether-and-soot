import { z } from 'zod';
import {
  BlueprintIdSchema,
  CommodityIdSchema,
  EntityIdSchema,
  FactionIdSchema,
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
    'NO_ACTIVE_ABILITY',
    'GOVERNOR_OVERLOADED',
    'INSUFFICIENT_STEAM',
    'ABILITY_ON_COOLDOWN',
    'INVALID_TARGET',
  ]),
});

export const ProstheticActivatedEventSchema = z.object({
  type: z.literal('PROSTHETIC_ACTIVATED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  slot: LimbSlotIdSchema,
  abilityId: z.string().min(1),
  steamCost: z.number().nonnegative(),
  details: z.string().optional(),
});

export const GovernorOverloadedEventSchema = z.object({
  type: z.literal('GOVERNOR_OVERLOADED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  governorCapacityKw: z.number(),
  strainLoadKw: z.number(),
});

export const CyberneticHarvestedEventSchema = z.object({
  type: z.literal('CYBERNETIC_HARVESTED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  corpseEntityId: EntityIdSchema,
  prostheticEntityId: EntityIdSchema,
  prostheticBlueprintId: BlueprintIdSchema,
  slot: LimbSlotIdSchema,
  itemDamagePct: z.number().nonnegative().default(0),
  toolQuality: z.string().optional(),
});

export const HarvestActionFailedEventSchema = z.object({
  type: z.literal('HARVEST_ACTION_FAILED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  corpseEntityId: EntityIdSchema,
  reason: z.enum([
    'CORPSE_NOT_FOUND',
    'NOT_DEAD',
    'NO_PROSTHETIC',
    'LACKS_SURGICAL_TOOL',
    'TOO_DISTANT',
  ]),
});

export const SteamRefilledEventSchema = z.object({
  type: z.literal('STEAM_REFILLED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  newReserveKpa: z.number().nonnegative(),
  stokedFromBoiler: z.boolean().optional(),
  fuelBlueprintId: z.string().optional(),
});

export const SteamRefillFailedEventSchema = z.object({
  type: z.literal('STEAM_REFILL_FAILED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  reason: z.string(),
});

export const SteamVentFailedEventSchema = z.object({
  type: z.literal('STEAM_VENT_FAILED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  reason: z.string(),
});

export const VesselRupturedEventSchema = z.object({
  type: z.literal('VESSEL_RUPTURED'),
  turn: z.number().int().nonnegative(),
  vesselEntityId: EntityIdSchema,
  origin: Point3DSchema,
  releasedPressureKpa: z.number().positive(),
});

export const CoalDustIgnitedEventSchema = z.object({
  type: z.literal('COAL_DUST_IGNITED'),
  turn: z.number().int().nonnegative(),
  epicenter: Point3DSchema,
  ignitedTileCount: z.number().int().positive(),
});

export const ThermalScaldEventSchema = z.object({
  type: z.literal('THERMAL_SCALD'),
  turn: z.number().int().nonnegative(),
  targetId: EntityIdSchema,
  slot: LimbSlotIdSchema,
  steamPressureKpa: z.number().positive(),
  damage: z.number().int().positive(),
});

export const PedestalStockedEventSchema = z.object({
  type: z.literal('PEDESTAL_STOCKED'),
  turn: z.number().int().nonnegative(),
  commodity: CommodityIdSchema,
  quantity: z.number().int().positive(),
});

export const SupplyShockTriggeredEventSchema = z.object({
  type: z.literal('SUPPLY_SHOCK_TRIGGERED'),
  turn: z.number().int().nonnegative(),
  commodity: CommodityIdSchema,
  newPricePence: z.number().int().positive(),
  factionAffected: FactionIdSchema,
  newReputation: z.number().int(),
});

export const StorefrontSaleCompletedEventSchema = z.object({
  type: z.literal('STOREFRONT_SALE_COMPLETED'),
  turn: z.number().int().nonnegative(),
  commodity: CommodityIdSchema,
  unitsSold: z.number().int().positive(),
  revenuePence: z.number().int().positive(),
});

export const MacroTickCompletedEventSchema = z.object({
  type: z.literal('MACRO_TICK_COMPLETED'),
  turn: z.number().int().nonnegative(),
  macroTickIndex: z.number().int().positive(),
});
