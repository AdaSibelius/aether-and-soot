# Handoff Report: Milestone 1 Schema Specifications (Building Templates & Steampunk Fixtures)

**Author**: Teamwork Explorer (M1 Schema Architect)  
**Date**: 2026-11-01  
**Working Directory**: `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m1_1/`  
**Milestone**: M1 — Building Layout Templates & Steampunk Fixtures  

---

## 1. Observation

Direct code and schema inspection across the repository revealed the existing structures and boundaries:

### 1.1 `src/schemas/primitives.schema.ts` (205 lines)
- **`TerrainTypeSchema`** (`src/schemas/primitives.schema.ts:79-116`):
  ```typescript
  export const TerrainTypeSchema = z.enum([
    'COBBLESTONE_FLOOR',
    'SOOT_BRICK_WALL',
    'IRON_GRATE',
    'BRASS_CATWALK',
    'WOODEN_DOOR_CLOSED',
    'WOODEN_DOOR_OPEN',
    'DISTRICT_GATE',
    'GLASS_WINDOW',
    'SMASHED_WINDOW_FRAME',
    'RUBBLE_PILE',
    'ABYSS_DROP',
    'WROUGHT_IRON_FENCE',
    'BRASS_STEAM_PIPE',
    'GASLAMP_POST',
    'TIMBER_PIER',
    'SLAG_MOUND',
    'CANAL_SLUICE',
    'GOTHIC_COLONNADE',
    'WALL_CROSS',
    'WALL_VERTICAL',
    'WALL_HORIZONTAL',
    'WALL_CORNER_NW',
    'WALL_CORNER_NE',
    'WALL_CORNER_SW',
    'WALL_CORNER_SE',
    'WALL_TEE_NORTH',
    'WALL_TEE_SOUTH',
    'WALL_TEE_EAST',
    'WALL_TEE_WEST',
    'COUNTER_BARRIER',
    'CONVEYOR_TRACK',
    'SLAG_PIT',
    'RAIL_TRACK',
    'BOARDING_PLATFORM',
    'SCORCHED_STONE',
  ]);
  export type TerrainType = z.infer<typeof TerrainTypeSchema>;
  ```
  *Missing variant*: `'TIMBER_STRUT'` (mine shoring and interior structural timbers).
- **`InteriorZoneTypeSchema`** (`src/schemas/primitives.schema.ts:163-176`):
  ```typescript
  export const InteriorZoneTypeSchema = z.enum([
    'NONE',
    'RECEPTION',
    'WORKSHOP',
    'VAULT',
    'SURGICAL_BAY',
    'STORAGE',
    'LOADING_DOCK',
    'ASSEMBLY_LINE',
    'PLATFORM',
    'TICKET_BOOTH',
    'BACKROOM',
  ]);
  export type InteriorZoneType = z.infer<typeof InteriorZoneTypeSchema>;
  ```
  *Missing variants*: `'CORRIDOR'`, `'LIVING_QUARTERS'`, `'SCULLERY'`, `'CELLAR'`, `'PUBLIC_BAR'`, `'HOLDING_CELL'`, `'INSPECTOR_OFFICE'`.
- **`BuildingArchetypeIdSchema`** (`src/schemas/primitives.schema.ts:178-186`):
  ```typescript
  export const BuildingArchetypeIdSchema = z.enum([
    'VICTORIAN_APOTHECARY_CLINIC',
    'CLOCKWORK_PAWNSHOP_BANK',
    'STEAM_BOILERHOUSE_FURNACE',
    'TENEMENT_ROOKERIES',
    'PNEUMATIC_MONORAIL_DEPOT',
    'GUILD_ARTISAN_WORKSHOP',
  ]);
  export type BuildingArchetypeId = z.infer<typeof BuildingArchetypeIdSchema>;
  ```
  *Missing variants*: `'VICTORIAN_TAVERN'`, `'CONSTABULARY_OFFICE'`, `'TENEMENT_HOUSE'`.

### 1.2 `src/schemas/world-components.schema.ts` (195 lines)
- **`FurnitureComponentSchema`** (`src/schemas/world-components.schema.ts:59-83`):
  ```typescript
  export const FurnitureComponentSchema = z.object({
    kind: z.enum([
      'BED',
      'SURGICAL_TABLE',
      'LOCKER',
      'CRATE',
      'BOOKSHELF',
      'ARTIFICER_BENCH',
      'STEAM_CHARGER',
      'BARRICADE_WOOD',
      'BARRICADE_IRON',
      'SAFE_VAULT',
      'SMELTING_FURNACE',
      'CLOCKTOWER_MECHANISM',
      'WATER_PUMP',
      'CANAL_LOCK_MECHANISM',
      'BOTANICAL_PLANTER',
      'MONORAIL_DEPOT_CONSOLE',
      'APOTHECARY_COUNTER',
      'PEDESTAL',
    ]),
    label: z.string().min(1),
    durabilityHp: z.number().int().positive().optional(),
  });
  export type FurnitureComponent = z.infer<typeof FurnitureComponentSchema>;
  ```
  *Missing variants*: `'COAL_STOVE'`, `'IRON_BOILER'`, `'ROLL_TOP_DESK'`, `'GAS_LAMP'`, `'PNEUMATIC_DISPATCH'`, `'FILING_CABINET'`, `'VALVE_MANIFOLD'`, `'BAR_COUNTER'`, `'CELL_BENCH'`.

### 1.3 World Serialization & ECS Architecture
- **`src/sim/core/world.ts:42-69`**: `WorldStateSchema` defines:
  ```typescript
  strata: z.record(StratumIdSchema, StratumGridSchema),
  entities: z.record(z.string(), EntityComponentsSchema),
  ```
- **`src/sim/spatial/grid.ts:5-16`**: `TileCellSchema` defines:
  ```typescript
  export const TileCellSchema = z.object({
    terrainType: TerrainTypeSchema,
    blocksMovement: z.boolean(),
    blocksSight: z.boolean(),
    steamPressureKpa: z.number().nonnegative().default(0),
    coalDustDensity: z.number().min(0).max(1).default(0),
    liquidType: LiquidTypeIdSchema.default('NONE').optional(),
    liquidVolumeMl: z.number().int().nonnegative().default(0).optional(),
    smokePpm: z.number().int().nonnegative().default(0).optional(),
    interiorZone: InteriorZoneTypeSchema.default('NONE').optional(),
    explored: z.boolean().default(false),
  });
  ```
- **`src/schemas/components.schema.ts:158-190`**: `EntityComponentsSchema` defines flat relational components with `furniture: FurnitureComponentSchema.optional()`.

### 1.4 Modularity Ceilings
- Enforced by `tests/scripts/check-boundaries.ts:5`: `MAX_LINES_HARD_CEILING = 300` (target `<= 250`).
- Current line counts:
  * `src/schemas/primitives.schema.ts`: 205 lines
  * `src/schemas/world-components.schema.ts`: 195 lines
  * `src/schemas/building-template.schema.ts`: new file (~85 lines)

---

## 2. Logic Chain

1. **Additive Union Compatibility (Observation 1.1 & 1.2 → Serialization Invariance)**:
   - In Zod, extending `z.enum([...])` with additional string literal variants is strictly additive.
   - Any historical or existing save JSON payload contains values from the prior subset. When parsed against the expanded enum, `z.enum([...]).safeParse(oldValue)` succeeds.
   - When new games or tests emit the new variants (`'VICTORIAN_TAVERN'`, `'CORRIDOR'`, `'COAL_STOVE'`, etc.), `safeParse` also succeeds.
   - `WorldStateSchema` has zero required new fields. `CURRENT_WORLD_VERSION` remains `1`, with no migration pipeline transform needed.

2. **Standalone CDDA Matrix Schema (`src/schemas/building-template.schema.ts`)**:
   - The CDDA layout pattern maps ASCII character grids to rich multi-property cell rules (terrain, interior zone, interactive fixtures, loot, portals, thermodynamic halos).
   - Placing `TemplateCellRuleSchema`, `TemplateRoomDefinitionSchema`, `TemplatePlacementSchema`, and `BuildingTemplateSchema` in a dedicated new file in `src/schemas/` ensures clean separation of concerns and avoids modifying unrelated schemas.
   - Adding a Zod `.refine()` check directly validates matrix integrity: `tpl.rows.length === tpl.height && tpl.rows.every((row) => row.length === tpl.width)`.

3. **Modularity Budgeting (Observation 1.4 → Rule 2.2 Compliance)**:
   - In `primitives.schema.ts`: adding 1 (`TIMBER_STRUT`), 7 (`InteriorZoneType`), and 3 (`BuildingArchetypeId`) items adds 11 lines. `205 + 11 = 216 lines`, comfortably below the 250 warning threshold and 300 hard ceiling.
   - In `world-components.schema.ts`: extracting `FurnitureKindSchema` and adding 9 new fixtures adds 12 lines. `195 + 12 = 207 lines`, comfortably below the 250 warning threshold and 300 hard ceiling.
   - In `building-template.schema.ts`: the entire schema is ~85 lines, well below 250 lines.

---

## 3. Caveats

1. **No Source Modification In Explorer Phase**:
   - As an explorer agent, no repository source files or tests were modified or executed during this turn. All specifications below are prepared as ready-to-apply drop-in implementations for the Worker.
2. **Matrix Character Width Invariant**:
   - The legend keys in `BuildingTemplateSchema` are single characters (`z.string().min(1)`), and each string in `rows` represents exactly one row where `row[x]` is the single character at `(x, y)`. Multi-character tokens (like `"C1"`) cannot be stamped in single-character CDDA matrices without displacing columns. Each cell must be represented by a unique single character in `rows` (e.g. `'1'`, `'2'`, `'c'`, `'C'`).

---

## 4. Conclusion & Concrete Code Specifications

Here are the exact TypeScript and Zod definitions ready for the Worker to implement:

### 4.1 Changes to `src/schemas/primitives.schema.ts`

#### A. Extend `TerrainTypeSchema` (around line 79):
Add `'TIMBER_STRUT'` to `TerrainTypeSchema`:
```typescript
export const TerrainTypeSchema = z.enum([
  'COBBLESTONE_FLOOR',
  'SOOT_BRICK_WALL',
  'IRON_GRATE',
  'BRASS_CATWALK',
  'WOODEN_DOOR_CLOSED',
  'WOODEN_DOOR_OPEN',
  'DISTRICT_GATE',
  'GLASS_WINDOW',
  'SMASHED_WINDOW_FRAME',
  'RUBBLE_PILE',
  'ABYSS_DROP',
  'WROUGHT_IRON_FENCE',
  'BRASS_STEAM_PIPE',
  'GASLAMP_POST',
  'TIMBER_PIER',
  'SLAG_MOUND',
  'CANAL_SLUICE',
  'GOTHIC_COLONNADE',
  'WALL_CROSS',
  'WALL_VERTICAL',
  'WALL_HORIZONTAL',
  'WALL_CORNER_NW',
  'WALL_CORNER_NE',
  'WALL_CORNER_SW',
  'WALL_CORNER_SE',
  'WALL_TEE_NORTH',
  'WALL_TEE_SOUTH',
  'WALL_TEE_EAST',
  'WALL_TEE_WEST',
  'COUNTER_BARRIER',
  'CONVEYOR_TRACK',
  'SLAG_PIT',
  'RAIL_TRACK',
  'BOARDING_PLATFORM',
  'SCORCHED_STONE',
  'TIMBER_STRUT',
]);
export type TerrainType = z.infer<typeof TerrainTypeSchema>;
```

#### B. Extend `InteriorZoneTypeSchema` (around line 163):
Add `'CORRIDOR'`, `'LIVING_QUARTERS'`, `'SCULLERY'`, `'CELLAR'`, `'PUBLIC_BAR'`, `'HOLDING_CELL'`, `'INSPECTOR_OFFICE'`:
```typescript
export const InteriorZoneTypeSchema = z.enum([
  'NONE',
  'RECEPTION',
  'WORKSHOP',
  'VAULT',
  'SURGICAL_BAY',
  'STORAGE',
  'LOADING_DOCK',
  'ASSEMBLY_LINE',
  'PLATFORM',
  'TICKET_BOOTH',
  'BACKROOM',
  'CORRIDOR',
  'LIVING_QUARTERS',
  'SCULLERY',
  'CELLAR',
  'PUBLIC_BAR',
  'HOLDING_CELL',
  'INSPECTOR_OFFICE',
]);
export type InteriorZoneType = z.infer<typeof InteriorZoneTypeSchema>;
```

#### C. Extend `BuildingArchetypeIdSchema` (around line 178):
Add `'VICTORIAN_TAVERN'`, `'CONSTABULARY_OFFICE'`, `'TENEMENT_HOUSE'`:
```typescript
export const BuildingArchetypeIdSchema = z.enum([
  'VICTORIAN_APOTHECARY_CLINIC',
  'CLOCKWORK_PAWNSHOP_BANK',
  'STEAM_BOILERHOUSE_FURNACE',
  'TENEMENT_ROOKERIES',
  'PNEUMATIC_MONORAIL_DEPOT',
  'GUILD_ARTISAN_WORKSHOP',
  'VICTORIAN_TAVERN',
  'CONSTABULARY_OFFICE',
  'TENEMENT_HOUSE',
]);
export type BuildingArchetypeId = z.infer<typeof BuildingArchetypeIdSchema>;
```

---

### 4.2 Changes to `src/schemas/world-components.schema.ts`

Extract `FurnitureKindSchema` and add the 9 new fixtures (around line 59):
```typescript
export const FurnitureKindSchema = z.enum([
  'BED',
  'SURGICAL_TABLE',
  'LOCKER',
  'CRATE',
  'BOOKSHELF',
  'ARTIFICER_BENCH',
  'STEAM_CHARGER',
  'BARRICADE_WOOD',
  'BARRICADE_IRON',
  'SAFE_VAULT',
  'SMELTING_FURNACE',
  'CLOCKTOWER_MECHANISM',
  'WATER_PUMP',
  'CANAL_LOCK_MECHANISM',
  'BOTANICAL_PLANTER',
  'MONORAIL_DEPOT_CONSOLE',
  'APOTHECARY_COUNTER',
  'PEDESTAL',
  'COAL_STOVE',
  'IRON_BOILER',
  'ROLL_TOP_DESK',
  'GAS_LAMP',
  'PNEUMATIC_DISPATCH',
  'FILING_CABINET',
  'VALVE_MANIFOLD',
  'BAR_COUNTER',
  'CELL_BENCH',
]);
export type FurnitureKind = z.infer<typeof FurnitureKindSchema>;

/** Interactive furniture fixture (e.g. Bed, Surgical Table, Locker, Crate, Stoves, Boilers). */
export const FurnitureComponentSchema = z.object({
  kind: FurnitureKindSchema,
  label: z.string().min(1),
  durabilityHp: z.number().int().positive().optional(),
});
export type FurnitureComponent = z.infer<typeof FurnitureComponentSchema>;
```

---

### 4.3 New File: `src/schemas/building-template.schema.ts`

Complete implementation ready for creation:
```typescript
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
  isContainer: z.boolean().default(false),
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
  ambientSmokePpm: z.number().int().nonnegative().default(0),
  /** Ambient steam pressure across the room. */
  ambientSteamKpa: z.number().nonnegative().default(0),
});
export type TemplateRoomDefinition = z.infer<typeof TemplateRoomDefinitionSchema>;

export const TemplatePlacementSchema = z.object({
  /** Target origin coordinate on the destination stratum grid. */
  origin: Point2DSchema,
  /** Horizontal mirroring across local X axis. */
  mirrorX: z.boolean().default(false),
  /** Vertical flipping across local Y axis. */
  flipY: z.boolean().default(false),
  /** Orthogonal rotation in degrees (0, 90, 180, 270). */
  rotationDeg: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).default(0),
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
```

---

### 4.4 Impact Analysis Summary

1. **Schemas Impacted (`src/schemas/`)**:
   - `src/schemas/primitives.schema.ts`: 3 enums extended (`TerrainTypeSchema`, `InteriorZoneTypeSchema`, `BuildingArchetypeIdSchema`).
   - `src/schemas/world-components.schema.ts`: `FurnitureKindSchema` extracted and 9 new fixture variants added; `FurnitureComponentSchema` reuses `FurnitureKindSchema`.
   - `src/schemas/building-template.schema.ts`: New file (~85 lines).
2. **Serialization & Save-State Impact (`WorldStateSchema`)**:
   - `WorldStateSchema` is unchanged.
   - All enum extensions are 100% backward- and forward-compatible. Existing saves deserialize without errors.
   - Save version remains `CURRENT_WORLD_VERSION = 1`.
3. **Existing Infrastructure Reused**:
   - Reuses `BlueprintIdSchema`, `BuildingArchetypeIdSchema`, `InteriorZoneTypeSchema`, `Point2DSchema`, `StratumIdSchema`, `TerrainTypeSchema`, `VisualGlyphSpecSchema` from `src/schemas/primitives.schema.ts`.
4. **File Size & Modularity Check**:
   - `src/schemas/primitives.schema.ts`: 205 → 216 lines (target `<= 250`, limit 300).
   - `src/schemas/world-components.schema.ts`: 195 → 207 lines (target `<= 250`, limit 300).
   - `src/schemas/building-template.schema.ts`: ~85 lines (target `<= 250`, limit 300).
5. **Client / HUD Impact (`src/client/`)**:
   - `resolveBiomeTerrainVisual` in `src/client/projection/biome-palette.ts` handles unknown terrains safely via `default: glyph = '·'`.
   - `wall-connections.ts` non-matching terrains default safely to `false`.
   - Event formatting and client projection remain 100% operational.
6. **Roadmap & STATE.md Reconciliation**:
   - Fulfills Milestone 1 Feature 6 requirements from `PROJECT.md`.

---

## 5. Verification Method

Once the Worker implements the above schema changes, they can independently verify using:

1. **Strict TypeScript Compilation**:
   ```bash
   npm run typecheck
   ```
   *Expected outcome*: 0 errors. Exhaustive switches and Zod type inference remain intact.

2. **Blueprint & Data Validation**:
   ```bash
   npm run validate:data
   ```
   *Expected outcome*: 0 errors. All JSON records in `data/` continue to validate.

3. **Modularity & Architectural Boundary Check**:
   ```bash
   npm run check:boundaries
   ```
   *Expected outcome*: 0 errors. All files remain strictly below 250 lines (with zero files exceeding the 300-line hard ceiling), and zero forbidden imports or non-deterministic tokens.

4. **Targeted Vitest Unit Tests**:
   A dedicated test file (e.g. `tests/sim/building-templates-schema.test.ts` or `tests/sim/building-templates.test.ts`) can verify:
   ```bash
   npx vitest run tests/sim/building-templates-schema.test.ts
   ```
   - Assert `BuildingTemplateSchema.parse(...)` succeeds with valid CDDA matrix rows and matching legend.
   - Assert `BuildingTemplateSchema.parse(...)` throws when row lengths or count mismatch template dimensions.
   - Assert all 9 new `FurnitureKind` variants parse in `FurnitureComponentSchema`.
   - Assert all new `InteriorZoneType` variants parse in `TileCellSchema`.
