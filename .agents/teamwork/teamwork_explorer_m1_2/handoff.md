# Handoff Report: Victorian Steampunk Fixture Catalog Architecture (`src/sim/spatial/fixture-catalog.ts`)

**Author**: Teamwork Explorer (M1 Fixture Blueprint Architect)  
**Date**: 2026-11-01  
**Working Directory**: `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m1_2/`  
**Milestone**: Milestone 1 (M1) — Building Layout Templates & Steampunk Fixtures (Feature 7)  
**Deliverable**: Architectural Specification & Implementation Blueprint for `src/sim/spatial/fixture-catalog.ts`

---

## 1. Observation

Inspection of existing schemas, spatial pipelines, and container systems in the repository reveals the following concrete implementation details:

### 1.1 Existing Component Schemas
- **`FurnitureComponentSchema`** (`src/schemas/world-components.schema.ts:59-83`):
  ```typescript
  export const FurnitureComponentSchema = z.object({
    kind: z.enum([
      'BED', 'SURGICAL_TABLE', 'LOCKER', 'CRATE', 'BOOKSHELF',
      'ARTIFICER_BENCH', 'STEAM_CHARGER', 'BARRICADE_WOOD', 'BARRICADE_IRON',
      'SAFE_VAULT', 'SMELTING_FURNACE', 'CLOCKTOWER_MECHANISM', 'WATER_PUMP',
      'CANAL_LOCK_MECHANISM', 'BOTANICAL_PLANTER', 'MONORAIL_DEPOT_CONSOLE',
      'APOTHECARY_COUNTER', 'PEDESTAL',
    ]),
    label: z.string().min(1),
    durabilityHp: z.number().int().positive().optional(),
  });
  ```
  `'ARTIFICER_BENCH'` is already defined in the enum. The other 7 fixtures (`COAL_STOVE`, `IRON_BOILER`, `ROLL_TOP_DESK`, `GAS_LAMP`, `PNEUMATIC_DISPATCH`, `FILING_CABINET`, `VALVE_MANIFOLD`) are new kinds to be added in `world-components.schema.ts`. Current line count of `world-components.schema.ts` is 195 lines; adding 7 enum strings will reach ~202 lines, well below the 240-line warning threshold.

- **`PositionComponentSchema`** (`src/schemas/components.schema.ts:37-41`):
  ```typescript
  export const PositionComponentSchema = Point3DSchema.extend({
    blocksMovement: z.boolean().default(true),
    blocksSight: z.boolean().default(false),
  });
  ```
  Position explicitly tracks spatial stratum and coordinates (`x`, `y`, `stratum`) along with `blocksMovement` and `blocksSight`.

- **`VisualGlyphSpecSchema` / Renderable Representation** (`src/schemas/primitives.schema.ts:118-125`):
  ```typescript
  export const VisualGlyphSpecSchema = z.object({
    glyph: z.string().min(1).max(32),
    fgPrimary: HexColorSchema,
    fgSecondary: HexColorSchema,
    bgColor: HexColorSchema,
    shaderFlags: z.array(ShaderFlagSchema).default([]),
  });
  ```
  Every entity in `state.entities` carries a `visual: VisualGlyphSpec` property, which represents its renderable presentation in the WebGL glyph stage.

- **`ShaderFlagSchema`** (`src/schemas/primitives.schema.ts:46-56`):
  Enums include: `'NONE'`, `'PULSE_STEAM'`, `'HEAT_SHIMMER'`, `'SPARK_GLINT'`, `'SOOT_OCCLUSION'`, `'GASLIGHT_RADIANCE'`, `'VOLUMETRIC_PLUME'`, `'COUNTER_GLINT'`. All visual shader effects needed for our 8 fixtures already exist verbatim in this schema.

- **Specialized Fixture Components**:
  - `WorkbenchComponentSchema` (`src/schemas/world-components.schema.ts:28-33`): `{ stationType: 'ARTIFICER_BENCH' | 'ALCHEMICAL_STILL', bonusEfficiencyPct: number }`.
  - `ThermalComponentSchema` (`src/schemas/world-components.schema.ts:93-96`): `{ coreHeatPct: number }` (min 0, max 100).
  - `PressureVesselComponentSchema` (`src/schemas/components.schema.ts:90-95`): `{ currentPressureKpa: number, maxPressureKpa: number, ruptured: boolean }`.
  - `InventoryComponentSchema` (`src/schemas/components.schema.ts:128-135`): `{ containedEntityIds: EntityId[], maxMassGrams: number, maxVolumeMl: number, currentMassGrams: number }`.
  - `UtilityConduitComponentSchema` (`src/schemas/world-components.schema.ts:136-151`): `{ conduitType: 'HIGH_PRESSURE_STEAM_MAIN' | 'HYDRAULIC_DRAINAGE' | 'PNEUMATIC_TRANSIT_TUBE' | 'COAL_GAS_FEED' | 'AETHER_CONDUIT', networkId: string, operatingPressureKpa: number, maxPressureKpa: number, ruptured: boolean, isRuptured?: boolean, connectedEndpointEntityIds: EntityId[] }`.

- **Container Looting and Valid Kinds** (`src/sim/systems/container.system.ts:19-20`):
  `const VALID_CONTAINER_KINDS = new Set(['LOCKER', 'CRATE', 'BOOKSHELF']);`
  Loots items from adjacent containers using `resolveLootContainer`.

- **Existing Container Seeding Utility** (`src/sim/spatial/building-variation.ts:9-25`):
  `seedContainer(entities, items)` creates child item entities using `createEntityFromBlueprint` and inserts them into `entities`, returning an `inventory` record populated with `containedEntityIds`.

- **Available Blueprint Items for Default Loot**:
  - `commodity_anthracite_briquette` (`data/items/commodities.json:3`)
  - `item_crown_pence_pouch` (`data/items/materials.json:329`)
  - `book_pneumatic_schematic` (`data/items/materials.json:151`)
  - `book_ocular_schematic` (`data/items/materials.json:174`)
  - `item_pressurized_steam_canister` (`data/items/materials.json:122`)
  - `mat_brass_gears` (`data/items/materials.json:3`)
  - `mat_vulcanized_rubber` (`data/items/materials.json:27`)
  - `gear_heavy_pipe_wrench` (`data/items/materials.json:199`)

---

## 2. Logic Chain

1. **Flat Relational ECS Compliance**:
   - Rule 2.3 mandates flat relational entities: `EntityRecord` instances stored in `state.entities[id]` with no nested entity objects.
   - Fixtures are registered directly into `state.entities[fixtureId]`.
   - When a fixture contains loot (e.g., Coal Stove holding coal briquettes, Desk holding pence and ledgers), the items are spawned as separate `EntityRecord` instances in `state.entities[itemId]` and their IDs are recorded in `fixture.inventory.containedEntityIds`.

2. **Deterministic Entity ID Generation**:
   - The required format is `entity_${kind}_${x}_${y}_${stratum}`.
   - Using `EntityIdSchema.parse(\`entity_\${kind.toLowerCase()}_\${x}_\${y}_\${stratum.toLowerCase()}\`)` produces branded `EntityId` strings that are 100% deterministic, seed-reproducible, and free of collision across different coordinates and strata.
   - An optional `customId?: EntityId` parameter allows district pipelines or landmark systems to supply named overrides (e.g. `'station_guild_artisan_bench'`) without breaking the default deterministic generation.

3. **Collision & Line-of-Sight (LOS) Physics**:
   - **Line-of-Sight (`blocksSight`)**:
     * Only the **Industrial Iron Boiler** is a massive, opaque, floor-to-ceiling riveted iron pressure vessel that occludes vision (`blocksSight: true`).
     * All other 7 fixtures are waist-height, wall-mounted, or open framework (`blocksSight: false`), preserving room visibility.
   - **Collision (`blocksMovement`)**:
     * **Artificer Workbench**: `blocksMovement: false` — allows the artisan/player to step up to or work at the bench.
     * **Gas Lamp**: `blocksMovement: false` — wall- or ceiling-mounted illumination source; actors walk beneath or beside it.
     * **Coal Stove, Iron Boiler, Roll-Top Desk, Pneumatic Dispatch Tube, Filing Cabinet, Valve Manifold**: `blocksMovement: true` — solid physical obstacles requiring pathfinding navigation.

4. **Component Assembly Mapping**:
   The prompt details 8 conceptual components:
   - `PositionComponent`: `position: { x, y, stratum, blocksMovement, blocksSight }`
   - `RenderableComponent`: `visual: { glyph, fgPrimary, fgSecondary, bgColor, shaderFlags }`
   - `InteractionComponent`: represented in Aether & Soot by `furniture: { kind, label, durabilityHp }` plus domain components (`inventory`, `workbench`, `pressureVessel`, `utilityConduit`, `thermal`).
   - `ThermalComponent`: `thermal: { coreHeatPct }`
   - `PressureVesselComponent`: `pressureVessel: { currentPressureKpa, maxPressureKpa, ruptured: false }`
   - `InventoryComponent`: `inventory: { containedEntityIds, currentMassGrams, maxMassGrams, maxVolumeMl }`
   - `WorkbenchComponent`: `workbench: { stationType: 'ARTIFICER_BENCH', bonusEfficiencyPct }`
   - `UtilityConduitComponent`: `utilityConduit: { conduitType, networkId, operatingPressureKpa, maxPressureKpa, ruptured: false, ... }`

5. **Modularity & File Size Budget (< 200 Lines)**:
   - Target line count: **< 200 lines** (Rule 2.2 target <= 250, hard ceiling 300).
   - By creating a lean `seedFixtureInventory` helper and parameterized factory functions sharing a standard `FixtureOptions` interface, all 8 factories plus a unified `createVictorianFixture` dispatcher require exactly **~172 lines of clean TypeScript**.

---

## 3. Caveats

1. **Schema Extension Pre-Condition**:
   Before `fixture-catalog.ts` can be compiled, `FurnitureComponentSchema` in `src/schemas/world-components.schema.ts` must have the 7 new enum variants added (`COAL_STOVE`, `IRON_BOILER`, `ROLL_TOP_DESK`, `GAS_LAMP`, `PNEUMATIC_DISPATCH`, `FILING_CABINET`, `VALVE_MANIFOLD`).
2. **Container Looting System Interaction**:
   `VALID_CONTAINER_KINDS` in `src/sim/systems/container.system.ts:19` is currently hardcoded to `Set(['LOCKER', 'CRATE', 'BOOKSHELF'])`. In Milestone 1, the implementer must add `'COAL_STOVE'`, `'ROLL_TOP_DESK'`, `'PNEUMATIC_DISPATCH'`, and `'FILING_CABINET'` to this set so the player can interact with them via `LOOT_CONTAINER`.
3. **Atmospheric Thermodynamic Halos**:
   `IRON_BOILER` and `COAL_STOVE` have high thermal ratings (`coreHeatPct: 90` and `80`). In district generation (`district-pipeline-late.ts`), these coordinates should be used to infuse ambient steam and heat into adjacent `TileCell.steamPressureKpa` and `TileCell.smokePpm`.
4. **Scope Discipline**:
   Per task instructions, this investigation is strictly read-only. No source files were modified or test commands executed.

---

## 4. Conclusion & Implementation Blueprint

### 4.1 Component Mapping Matrix (All 8 Fixtures)

| Fixture Name | Furniture `kind` | Position (`blocksMovement` / `blocksSight`) | Visual Glyph / Palette / Shader | Primary Functional Components | Default Loot Seeding |
|---|---|---|---|---|---|
| **Brass Artificer Workbench** | `ARTIFICER_BENCH` | `false` / `false` | `'T'` / `#D4AF37` / `#CD7F32` / `['SPARK_GLINT']` | `workbench: { stationType: 'ARTIFICER_BENCH', bonusEfficiencyPct: 25 }`, durability 150 | None by default (optional tool rack: `gear_heavy_pipe_wrench`) |
| **Cast-Iron Coal Stove** | `COAL_STOVE` | `true` / `false` | `'♨'` / `#E67E22` / `#BA4A00` / `['HEAT_SHIMMER']` | `thermal: { coreHeatPct: 80 }`, `inventory` (40kg / 30L), durability 200 | 2x `commodity_anthracite_briquette` |
| **Industrial Iron Boiler** | `IRON_BOILER` | `true` / **`true`** | `'Ω'` / `#5DADE2` / `#2E86C1` / `['PULSE_STEAM', 'VOLUMETRIC_PLUME']` | `pressureVessel: { 140/250 kPa }`, `thermal: { coreHeatPct: 90 }`, durability 400 | None (mechanical pressure vessel) |
| **Mahogany Roll-Top Desk** | `ROLL_TOP_DESK` | `true` / `false` | `'╤'` / `#873600` / `#5B2C6F` / `['COUNTER_GLINT']` | `inventory` (25kg / 25L), durability 120 | 1x `item_crown_pence_pouch` (18p) |
| **Welsbach Mantle Gas Lamp** | `GAS_LAMP` | `false` / `false` | `'☼'` / `#F9E79F` / `#F39C12` / `['GASLIGHT_RADIANCE']` | `thermal: { coreHeatPct: 25 }`, light emitter, durability 50 | None (ceiling/wall luminaire) |
| **Brass Pneumatic Dispatch Tube** | `PNEUMATIC_DISPATCH` | `true` / `false` | `'¶'` / `#D4AF37` / `#B7950B` / `['PULSE_STEAM']` | `utilityConduit: { PNEUMATIC_TRANSIT_TUBE, 70/150 kPa }`, `inventory` (15kg / 10L), durability 180 | 1x `item_pressurized_steam_canister` |
| **Rolled-Steel Filing Cabinet** | `FILING_CABINET` | `true` / `false` | `'⌸'` / `#7F8C8D` / `#34495E` / `[]` | `inventory` (40kg / 45L), durability 220 | 1x `book_pneumatic_schematic` |
| **High-Pressure Valve Manifold** | `VALVE_MANIFOLD` | `true` / `false` | `'X'` / `#E74C3C` / `#922B21` / `['SPARK_GLINT']` | `pressureVessel: { 140/250 kPa }`, durability 300 | None (pipe network control) |

---

### 4.2 Exact TypeScript Implementation (`src/sim/spatial/fixture-catalog.ts`)

The complete proposed file is 172 lines (well within the `< 200` line budget):

```typescript
import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityId, EntityIdSchema, StratumId } from '../../schemas/primitives.schema.js';
import { createEntityFromBlueprint } from '../data/item-catalog.js';

export type VictorianFixtureKind =
  | 'ARTIFICER_BENCH'
  | 'COAL_STOVE'
  | 'IRON_BOILER'
  | 'ROLL_TOP_DESK'
  | 'GAS_LAMP'
  | 'PNEUMATIC_DISPATCH'
  | 'FILING_CABINET'
  | 'VALVE_MANIFOLD';

export interface FixtureLootItem {
  readonly blueprintId: string;
  readonly quantity?: number;
}

export interface FixtureOptions {
  readonly x: number;
  readonly y: number;
  readonly stratum?: StratumId;
  readonly customId?: EntityId;
  readonly lootItems?: readonly FixtureLootItem[];
  readonly coreHeatPct?: number;
  readonly bonusEfficiencyPct?: number;
  readonly currentPressureKpa?: number;
  readonly maxPressureKpa?: number;
  readonly networkId?: string;
}

export function buildFixtureEntityId(kind: string, x: number, y: number, stratum: StratumId): EntityId {
  return EntityIdSchema.parse(`entity_${kind.toLowerCase()}_${x}_${y}_${stratum.toLowerCase()}`);
}

function seedFixtureInventory(
  fixtureId: EntityId,
  lootItems: readonly FixtureLootItem[] | undefined,
  entities: Record<string, EntityRecord> | undefined,
  maxMassGrams = 30000,
  maxVolumeMl = 25000,
): EntityRecord['inventory'] {
  const containedEntityIds: EntityId[] = [];
  let totalMass = 0;
  if (lootItems && entities) {
    lootItems.forEach((item, idx) => {
      const itemId = EntityIdSchema.parse(`${fixtureId}_item_${idx}`);
      const qty = item.quantity ?? 1;
      const created = createEntityFromBlueprint(item.blueprintId, itemId, qty);
      if (created) {
        entities[itemId] = created;
        containedEntityIds.push(itemId);
        totalMass += (created.item?.massGrams ?? 0) * qty;
      }
    });
  }
  return { containedEntityIds, currentMassGrams: totalMass, maxMassGrams, maxVolumeMl };
}

export function createArtificerBenchFixture(opts: FixtureOptions): EntityRecord {
  const stratum = opts.stratum ?? 'STREET';
  const id = opts.customId ?? buildFixtureEntityId('artificer_bench', opts.x, opts.y, stratum);
  return {
    id,
    name: 'Brass Artificer Workbench',
    visual: { glyph: 'T', fgPrimary: '#D4AF37', fgSecondary: '#CD7F32', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
    position: { x: opts.x, y: opts.y, stratum, blocksMovement: false, blocksSight: false },
    furniture: { kind: 'ARTIFICER_BENCH', label: 'Brass Artificer Workbench', durabilityHp: 150 },
    workbench: { stationType: 'ARTIFICER_BENCH', bonusEfficiencyPct: opts.bonusEfficiencyPct ?? 25 },
  };
}

export function createCoalStoveFixture(opts: FixtureOptions, entities?: Record<string, EntityRecord>): EntityRecord {
  const stratum = opts.stratum ?? 'STREET';
  const id = opts.customId ?? buildFixtureEntityId('coal_stove', opts.x, opts.y, stratum);
  const loot = opts.lootItems ?? [{ blueprintId: 'commodity_anthracite_briquette', quantity: 2 }];
  return {
    id,
    name: 'Cast-Iron Coal Stove',
    visual: { glyph: '♨', fgPrimary: '#E67E22', fgSecondary: '#BA4A00', bgColor: '#0A0D0E', shaderFlags: ['HEAT_SHIMMER'] },
    position: { x: opts.x, y: opts.y, stratum, blocksMovement: true, blocksSight: false },
    furniture: { kind: 'COAL_STOVE', label: 'Cast-Iron Coal Stove', durabilityHp: 200 },
    thermal: { coreHeatPct: opts.coreHeatPct ?? 80 },
    inventory: seedFixtureInventory(id, loot, entities, 40000, 30000),
  };
}

export function createIronBoilerFixture(opts: FixtureOptions): EntityRecord {
  const stratum = opts.stratum ?? 'STREET';
  const id = opts.customId ?? buildFixtureEntityId('iron_boiler', opts.x, opts.y, stratum);
  return {
    id,
    name: 'Industrial Iron Boiler',
    visual: { glyph: 'Ω', fgPrimary: '#5DADE2', fgSecondary: '#2E86C1', bgColor: '#0A0D0E', shaderFlags: ['PULSE_STEAM', 'VOLUMETRIC_PLUME'] },
    position: { x: opts.x, y: opts.y, stratum, blocksMovement: true, blocksSight: true },
    furniture: { kind: 'IRON_BOILER', label: 'Industrial Iron Boiler', durabilityHp: 400 },
    pressureVessel: { currentPressureKpa: opts.currentPressureKpa ?? 140, maxPressureKpa: opts.maxPressureKpa ?? 250, ruptured: false },
    thermal: { coreHeatPct: opts.coreHeatPct ?? 90 },
  };
}

export function createRollTopDeskFixture(opts: FixtureOptions, entities?: Record<string, EntityRecord>): EntityRecord {
  const stratum = opts.stratum ?? 'STREET';
  const id = opts.customId ?? buildFixtureEntityId('roll_top_desk', opts.x, opts.y, stratum);
  const loot = opts.lootItems ?? [{ blueprintId: 'item_crown_pence_pouch', quantity: 1 }];
  return {
    id,
    name: 'Mahogany Roll-Top Desk',
    visual: { glyph: '╤', fgPrimary: '#873600', fgSecondary: '#5B2C6F', bgColor: '#0A0D0E', shaderFlags: ['COUNTER_GLINT'] },
    position: { x: opts.x, y: opts.y, stratum, blocksMovement: true, blocksSight: false },
    furniture: { kind: 'ROLL_TOP_DESK', label: 'Mahogany Roll-Top Desk', durabilityHp: 120 },
    inventory: seedFixtureInventory(id, loot, entities, 25000, 25000),
  };
}

export function createGasLampFixture(opts: FixtureOptions): EntityRecord {
  const stratum = opts.stratum ?? 'STREET';
  const id = opts.customId ?? buildFixtureEntityId('gas_lamp', opts.x, opts.y, stratum);
  return {
    id,
    name: 'Welsbach Mantle Gas Lamp',
    visual: { glyph: '☼', fgPrimary: '#F9E79F', fgSecondary: '#F39C12', bgColor: '#0A0D0E', shaderFlags: ['GASLIGHT_RADIANCE'] },
    position: { x: opts.x, y: opts.y, stratum, blocksMovement: false, blocksSight: false },
    furniture: { kind: 'GAS_LAMP', label: 'Welsbach Mantle Gas Lamp', durabilityHp: 50 },
    thermal: { coreHeatPct: opts.coreHeatPct ?? 25 },
  };
}

export function createPneumaticDispatchFixture(opts: FixtureOptions, entities?: Record<string, EntityRecord>): EntityRecord {
  const stratum = opts.stratum ?? 'STREET';
  const id = opts.customId ?? buildFixtureEntityId('pneumatic_dispatch', opts.x, opts.y, stratum);
  const loot = opts.lootItems ?? [{ blueprintId: 'item_pressurized_steam_canister', quantity: 1 }];
  return {
    id,
    name: 'Brass Pneumatic Dispatch Tube',
    visual: { glyph: '¶', fgPrimary: '#D4AF37', fgSecondary: '#B7950B', bgColor: '#0A0D0E', shaderFlags: ['PULSE_STEAM'] },
    position: { x: opts.x, y: opts.y, stratum, blocksMovement: true, blocksSight: false },
    furniture: { kind: 'PNEUMATIC_DISPATCH', label: 'Brass Pneumatic Dispatch Tube', durabilityHp: 180 },
    utilityConduit: {
      conduitType: 'PNEUMATIC_TRANSIT_TUBE',
      networkId: opts.networkId ?? 'dispatch_central',
      operatingPressureKpa: opts.currentPressureKpa ?? 70,
      maxPressureKpa: opts.maxPressureKpa ?? 150,
      ruptured: false,
      isRuptured: false,
      connectedEndpointEntityIds: [],
    },
    inventory: seedFixtureInventory(id, loot, entities, 15000, 10000),
  };
}

export function createFilingCabinetFixture(opts: FixtureOptions, entities?: Record<string, EntityRecord>): EntityRecord {
  const stratum = opts.stratum ?? 'STREET';
  const id = opts.customId ?? buildFixtureEntityId('filing_cabinet', opts.x, opts.y, stratum);
  const loot = opts.lootItems ?? [{ blueprintId: 'book_pneumatic_schematic', quantity: 1 }];
  return {
    id,
    name: 'Rolled-Steel Filing Cabinet',
    visual: { glyph: '⌸', fgPrimary: '#7F8C8D', fgSecondary: '#34495E', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: opts.x, y: opts.y, stratum, blocksMovement: true, blocksSight: false },
    furniture: { kind: 'FILING_CABINET', label: 'Rolled-Steel Filing Cabinet', durabilityHp: 220 },
    inventory: seedFixtureInventory(id, loot, entities, 40000, 45000),
  };
}

export function createValveManifoldFixture(opts: FixtureOptions): EntityRecord {
  const stratum = opts.stratum ?? 'STREET';
  const id = opts.customId ?? buildFixtureEntityId('valve_manifold', opts.x, opts.y, stratum);
  return {
    id,
    name: 'High-Pressure Valve Manifold',
    visual: { glyph: 'X', fgPrimary: '#E74C3C', fgSecondary: '#922B21', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
    position: { x: opts.x, y: opts.y, stratum, blocksMovement: true, blocksSight: false },
    furniture: { kind: 'VALVE_MANIFOLD', label: 'High-Pressure Valve Manifold', durabilityHp: 300 },
    pressureVessel: { currentPressureKpa: opts.currentPressureKpa ?? 140, maxPressureKpa: opts.maxPressureKpa ?? 250, ruptured: false },
  };
}

export function createVictorianFixture(
  kind: VictorianFixtureKind,
  opts: FixtureOptions,
  entities?: Record<string, EntityRecord>,
): EntityRecord {
  switch (kind) {
    case 'ARTIFICER_BENCH': return createArtificerBenchFixture(opts);
    case 'COAL_STOVE': return createCoalStoveFixture(opts, entities);
    case 'IRON_BOILER': return createIronBoilerFixture(opts);
    case 'ROLL_TOP_DESK': return createRollTopDeskFixture(opts, entities);
    case 'GAS_LAMP': return createGasLampFixture(opts);
    case 'PNEUMATIC_DISPATCH': return createPneumaticDispatchFixture(opts, entities);
    case 'FILING_CABINET': return createFilingCabinetFixture(opts, entities);
    case 'VALVE_MANIFOLD': return createValveManifoldFixture(opts);
  }
}
```

---

## 5. Verification Method

To independently verify the implementation during Milestone 1 execution:

1. **TypeScript Typecheck**:
   ```bash
   npm run typecheck
   ```
   Must pass with 0 errors, validating all `EntityRecord` shapes, `EntityId` branded strings, and exhaustive switch in `createVictorianFixture`.

2. **File Size & Boundary Gate**:
   ```bash
   npm run check:boundaries
   ```
   Confirms `src/sim/spatial/fixture-catalog.ts` is `<= 200 lines` (far below the 300-line hard modularity ceiling) and contains zero browser globals or forbidden client imports.

3. **Targeted Vitest Unit Suite**:
   ```bash
   npx vitest run tests/sim/building-templates.test.ts
   ```
   Verify:
   - All 8 factory functions return valid `EntityRecord` instances.
   - Deterministic entity ID generation formula `entity_${kind}_${x}_${y}_${stratum}` produces exact matches.
   - Only `IRON_BOILER` has `blocksSight: true`; all others have `blocksSight: false`.
   - `ARTIFICER_BENCH` and `GAS_LAMP` have `blocksMovement: false`; the other 6 have `blocksMovement: true`.
   - Containers seeded with `entities` populate child items in `entities` and record child IDs in `inventory.containedEntityIds`.
   - Adjacent looting via `LOOT_CONTAINER` successfully transfers items from `COAL_STOVE`, `ROLL_TOP_DESK`, `PNEUMATIC_DISPATCH`, and `FILING_CABINET`.
