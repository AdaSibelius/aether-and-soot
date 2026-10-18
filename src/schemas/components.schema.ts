import { z } from 'zod';
import {
  BlueprintIdSchema,
  CommodityIdSchema,
  EntityIdSchema,
  ItemCategorySchema,
  ItemUseEffectSchema,
  LimbSlotIdSchema,
  Point3DSchema,
  SocketTypeSchema,
  VisualGlyphSpecSchema,
} from './primitives.schema.js';

export const PositionComponentSchema = Point3DSchema.extend({
  blocksMovement: z.boolean().default(true),
  blocksSight: z.boolean().default(false),
});
export type PositionComponent = z.infer<typeof PositionComponentSchema>;

export const ActorEnergyComponentSchema = z.object({
  energy: z.number().int(),
  speed: z.number().int().min(10).default(100),
  isPlayer: z.boolean().default(false),
});
export type ActorEnergyComponent = z.infer<typeof ActorEnergyComponentSchema>;

export const PortalComponentSchema = z.object({
  target: Point3DSchema,
  bidirectional: z.boolean().default(true),
  conductsGas: z.boolean().default(true),
  apCost: z.number().int().positive().default(100),
  portalLabel: z.string().min(1),
});
export type PortalComponent = z.infer<typeof PortalComponentSchema>;

export const ProstheticSpecComponentSchema = z.object({
  blueprintId: BlueprintIdSchema,
  targetLimbSlot: LimbSlotIdSchema,
  socketType: SocketTypeSchema,
  massGrams: z.number().int().positive(),
  volumeMl: z.number().int().positive(),
  steamConsumptionPerTurn: z.number().nonnegative().default(0),
  moveApModifier: z.number().int().default(0),
  fovRadiusBonus: z.number().int().default(0),
  pressureRatingKpa: z.number().positive(),
});
export type ProstheticSpecComponent = z.infer<typeof ProstheticSpecComponentSchema>;

export const PressureVesselComponentSchema = z.object({
  currentPressureKpa: z.number().nonnegative(),
  maxPressureKpa: z.number().positive(),
  ruptured: z.boolean().default(false),
});
export type PressureVesselComponent = z.infer<typeof PressureVesselComponentSchema>;

export const LimbStatusSchema = z.object({
  slot: LimbSlotIdSchema,
  hp: z.number().int().nonnegative(),
  maxHp: z.number().int().positive(),
  amputated: z.boolean().default(false),
  installedProstheticEntityId: EntityIdSchema.optional(),
});
export type LimbStatus = z.infer<typeof LimbStatusSchema>;

export const AnatomyComponentSchema = z.object({
  limbs: z.record(LimbSlotIdSchema, LimbStatusSchema),
  bloodVolumePct: z.number().min(0).max(100).default(100),
  steamReserveKpa: z.number().nonnegative().default(100),
  maxSteamReserveKpa: z.number().positive().default(100),
});
export type AnatomyComponent = z.infer<typeof AnatomyComponentSchema>;

export const InventoryComponentSchema = z.object({
  containedEntityIds: z.array(EntityIdSchema).default([]),
  maxMassGrams: z.number().int().positive().default(25000),
  maxVolumeMl: z.number().int().positive().default(30000),
  currentMassGrams: z.number().int().nonnegative().default(0),
});
export type InventoryComponent = z.infer<typeof InventoryComponentSchema>;

/** Physical carryable item. `massGrams` and `volumeMl` are PER UNIT (multiply by `quantity`). */
export const ItemComponentSchema = z.object({
  blueprintId: BlueprintIdSchema,
  category: ItemCategorySchema,
  massGrams: z.number().int().positive(),
  volumeMl: z.number().int().positive(),
  quantity: z.number().int().positive().default(1),
  stackable: z.boolean().default(true),
  commodityId: CommodityIdSchema.optional(),
  useEffect: ItemUseEffectSchema.optional(),
});
export type ItemComponent = z.infer<typeof ItemComponentSchema>;

export const EntityComponentsSchema = z.object({
  id: EntityIdSchema,
  name: z.string().min(1),
  visual: VisualGlyphSpecSchema,
  position: PositionComponentSchema.optional(),
  actor: ActorEnergyComponentSchema.optional(),
  portal: PortalComponentSchema.optional(),
  anatomy: AnatomyComponentSchema.optional(),
  inventory: InventoryComponentSchema.optional(),
  prostheticSpec: ProstheticSpecComponentSchema.optional(),
  pressureVessel: PressureVesselComponentSchema.optional(),
  item: ItemComponentSchema.optional(),
});
export type EntityRecord = z.infer<typeof EntityComponentsSchema>;
