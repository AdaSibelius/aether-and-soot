import { z } from 'zod';
import {
  BlueprintIdSchema,
  BuildingArchetypeIdSchema,
  InteriorZoneTypeSchema,
  Point2DSchema,
  StratumIdSchema,
  TerrainTypeSchema,
  VisualGlyphSpecSchema,
} from './primitives.schema.js';
import { FurnitureKindSchema } from './world-components.schema.js';

export const TemplateCellRuleSchema = z.object({
  /** Base terrain type to stamp into TileCell. */
  terrain: TerrainTypeSchema,
  /** Interior room zone semantic (e.g. PUBLIC_BAR, SCULLERY, LIVING_QUARTERS, HOLDING_CELL). */
  interiorZone: InteriorZoneTypeSchema.optional(),
  /** Interactive furniture fixture kind to spawn at this cell. */
  furnitureKind: FurnitureKindSchema.optional(),
  /** Optional custom display label for the spawned furniture entity. */
  furnitureLabel: z.string().min(1).optional(),
  /** Optional custom visual glyph override for the spawned furniture entity. */
  furnitureVisual: VisualGlyphSpecSchema.optional(),
  /** Whether the spawned fixture possesses an InventoryComponent. */
  isContainer: z.boolean().default(false).optional(),
  /** Optional loot table ID or blueprint ID to seed container contents. */
  lootTableId: z.string().min(1).optional(),
  /** Collision override for TileCell and PositionComponent. */
  blocksMovement: z.boolean().optional(),
  /** Vision obstruction override for TileCell and PositionComponent. */
  blocksSight: z.boolean().optional(),
  /** Thermodynamic initial steam pressure in kPa. */
  steamPressureKpa: z.number().nonnegative().optional(),
  /** Thermodynamic initial smoke particulate density in ppm. */
  smokePpm: z.number().int().nonnegative().optional(),
  /** Thermal core heat percentage (0-100) for radiant fixtures. */
  thermalCoreHeatPct: z.number().min(0).max(100).optional(),
  /** Cross-stratum portal connection (e.g. cellar hatch leading down to UNDERCROFT). */
  crossStratumPortal: z
    .object({
      targetStratum: StratumIdSchema,
      portalLabel: z.string().min(1),
    })
    .optional(),
});
export type TemplateCellRule = z.infer<typeof TemplateCellRuleSchema>;

export const TemplateRoomDefinitionSchema = z.object({
  /** Interior zone semantic for the room enclosure. */
  zone: InteriorZoneTypeSchema,
  /** Human-readable room title (e.g. "Public Drinking Concourse", "Lockup Cells"). */
  label: z.string().min(1),
  /** Minimum bounding coordinate x in template-local space. */
  x1: z.number().int().nonnegative(),
  /** Minimum bounding coordinate y in template-local space. */
  y1: z.number().int().nonnegative(),
  /** Maximum bounding coordinate x in template-local space. */
  x2: z.number().int().nonnegative(),
  /** Maximum bounding coordinate y in template-local space. */
  y2: z.number().int().nonnegative(),
  /** Ambient smoke particulate density across the room. */
  ambientSmokePpm: z.number().int().nonnegative().default(0).optional(),
  /** Ambient steam pressure across the room. */
  ambientSteamKpa: z.number().nonnegative().default(0).optional(),
});
export type TemplateRoomDefinition = z.infer<typeof TemplateRoomDefinitionSchema>;

export const TemplatePlacementSchema = z.object({
  /** Target origin coordinate on the destination stratum grid. */
  origin: Point2DSchema,
  /** Horizontal mirroring across local X axis. */
  mirrorX: z.boolean().default(false).optional(),
  /** Vertical flipping across local Y axis. */
  flipY: z.boolean().default(false).optional(),
  /** Orthogonal rotation in degrees (0, 90, 180, 270). */
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).default(0).optional(),
  /** Orthogonal rotation in degrees alias (0, 90, 180, 270). */
  rotationDeg: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).default(0).optional(),
  /** Target stratum ID for grid stamping and portal binding. */
  targetStratum: StratumIdSchema.optional(),
});
export type TemplatePlacement = z.infer<typeof TemplatePlacementSchema>;

export const BuildingTemplateSchema = z
  .object({
    /** Unique blueprint ID (e.g. 'building_victorian_tavern'). */
    id: BlueprintIdSchema,
    /** Architectural archetype classification. */
    archetypeId: BuildingArchetypeIdSchema,
    /** Descriptive title for chronicle and tooltips. */
    name: z.string().min(1),
    /** Template matrix width in cells. */
    width: z.number().int().positive(),
    /** Template matrix height in cells. */
    height: z.number().int().positive(),
    /** Default wall terrain for perimeter and unmapped solid cells. */
    defaultWallTerrain: TerrainTypeSchema.default('SOOT_BRICK_WALL'),
    /** Default walkable floor terrain. */
    defaultFloorTerrain: TerrainTypeSchema.default('COBBLESTONE_FLOOR'),
    /** CDDA matrix row strings (height rows, each of width length). */
    rows: z.array(z.string().min(1)),
    /** Legend mapping ASCII characters in `rows` to concrete cell generation rules. */
    legend: z.record(z.string().min(1), TemplateCellRuleSchema),
    /** Partitioned interior room zones with bounding boxes. */
    rooms: z.array(TemplateRoomDefinitionSchema).default([]),
    /** Character representing exterior entrance doors (defaults to '+'). */
    exteriorDoorChar: z.string().length(1).default('+'),
    /** Character representing exterior windows (defaults to '"'). */
    windowsChar: z.string().length(1).default('"'),
  })
  .refine(
    (tpl) =>
      tpl.rows.length === tpl.height &&
      tpl.rows.every((row) => row.length === tpl.width),
    {
      message: 'Template rows length must match height and each row string length must match width',
    },
  );
export type BuildingTemplate = z.infer<typeof BuildingTemplateSchema>;
