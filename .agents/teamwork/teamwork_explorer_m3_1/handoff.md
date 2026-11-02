# Handoff Report: Multi-Layer Projection & Extended CP437 Box-Drawing Architecture (Milestone 3, Features 1 & 2)

**Author**: Explorer 1 (Multi-Layer Projection & Box-Drawing Architect)  
**Recipient**: Milestone 3 Orchestrator & Implementer Agents  
**Target Milestone**: Milestone 3 (Enhanced CP437 Glyphs & Graphical Tileset Presentation)  
**Status**: Ready for Implementation  

---

## 1. Observation

Direct inspection of existing codebase modules, line counts, and architectural contracts revealed the following concrete details:

### 1.1 Existing Projection Pipeline & Line Counts
- **`src/client/projection/frame-adapter.ts`** (197 lines):
  - Defines `RenderCellFrame` (lines 19–30) with a single flattened `visual: VisualGlyphSpec`:
    ```typescript
    export interface RenderCellFrame {
      readonly x: number;
      readonly y: number;
      readonly worldX: number;
      readonly worldY: number;
      readonly visual: VisualGlyphSpec;
      readonly visible: boolean;
      readonly explored: boolean;
      readonly steamPressureKpa: number;
      readonly coalDustDensity: number;
      readonly isUnderlay?: boolean;
    }
    ```
  - In `projectWorldToVisualFrame` (lines 55–196):
    - Terrain visual is resolved via `resolveBiomeTerrainVisual(tile.terrainType, ...)` (lines 115–117).
    - Connecting wall glyph is obtained via `resolveConnectingWallGlyph(grid, worldX, worldY)` (line 114).
    - Entities are sorted by `entityDrawPriority` (lines 45–49: ground items `0` < fixtures `1` < actors `2`).
    - When an entity occupies a cell (lines 167–182), `cells[idx].visual` is **completely overwritten** with the entity's visual glyph:
      ```typescript
      cells[idx] = {
        ...currentCell,
        visual: {
          ...gaslitVisual,
          bgColor: currentCell.visual.bgColor, // preserves tile background only
        },
      };
      ```
    - **Consequence**: Floor terrain glyphs (`·`, `=`, `≡`, etc.) and fixture glyphs (`T`, `s`, `+`, etc.) are completely obliterated whenever an actor or item stands on that cell. Multi-layer composition is currently impossible in the client renderer.

- **`src/client/projection/wall-connections.ts`** (137 lines):
  - Defines `WALL_BOX_GLYPHS` (lines 4–18): `CROSS: '╬'`, `VERTICAL: '║'`, `HORIZONTAL: '═'`, `CORNER_NW: '╔'`, `CORNER_NE: '╗'`, `CORNER_SW: '╚'`, `CORNER_SE: '╝'`, `TEE_NORTH: '╦'`, `TEE_SOUTH: '╩'`, `TEE_EAST: '╠'`, `TEE_WEST: '╣'`, `DEFAULT: '#'`, `SOLID_INTERIOR: '▓'`.
  - Line 97: `resolveConnectingWallGlyph(grid: StratumGrid, x: number, y: number): string` resolves 4 orthogonal wall neighbors (`n`, `s`, `e`, `w`).
  - **Limitations**:
    1. It only produces double-line walls (`║`, `═`, `╬`, `╦`, `╩`, `╠`, `╣`).
    2. It lacks single-line partitions (`│`, `─`, `┼`, `┬`, `┴`, `├`, `┤`).
    3. It lacks mixed-line junction glyphs (`╤`, `╧`, `╞`, `╡`, `╪`, `╫`, `╥`, `╨`, `╟`, `╢`, `╓`, `╒`, `╖`, `╕`, `╙`, `╘`, `╜`, `╛`).
    4. When interior partitions meet exterior template walls, it renders heavy double-line T-junctions, destroying architectural visual distinction.

- **`src/client/renderer/glyph-atlas-extended.ts`** (114 lines):
  - Exports `CP437_EXTENDED_GLYPHS` (lines 5–27).
  - Lines 17–20 confirm that **ALL** single-line (`│`, `┤`, `┐`, `└`, `┴`, `┬`, `├`, `─`, `┼`, `┘`, `┌`), double-line (`║`, `╗`, `╝`, `╚`, `╩`, `╦`, `╠`, `═`, `╬`), and mixed junction characters (`╤`, `╧`, `╞`, `╡`, `╪`, `╫`, `╥`, `╨`, `╟`, `╢`, `╓`, `╒`, `╖`, `╕`, `╙`, `╘`, `╜`, `╛`) are **already present** in the raster atlas! Zero font or canvas changes are needed to display them.

- **`src/client/renderer/glyph-stage.ts`** (240 lines):
  - Is currently at the 240-line warning threshold (Rule 2.2).
  - Renders single-layer glyph sprites `glyphSprites[i]` (lines 148–152) and UI overlay sprites `uiGlyphSprites[i]` (lines 186–190).
  - Feature 3 (`TacticalLayerComposer`) will handle multi-layer sprite pooling; `frame-adapter.ts` must provide the underlying `layers: RenderCellLayers` data structure.

- **`src/sim/spatial/building-templates.ts`** (236 lines) & **`template-instantiator.ts`** (237 lines):
  - Building templates define exterior walls (`#`), interior doors (`+`), windows (`"`), counters (`=`), and room zones (`TemplateRoomDefinition`: `RECEPTION`, `PUBLIC_BAR`, `SCULLERY`, `INSPECTOR_OFFICE`, `HOLDING_CELL`, etc.).
  - Instantiator stamps `interiorZone` into each `TileCell` (`grid.cells[idx].interiorZone`).
  - Cells outside buildings have `interiorZone: 'NONE'`.

---

## 2. Logic Chain

### 2.1 Feature 1: Multi-Layer Glyph Projection Design

#### 2.1.1 Architectural Rationale
In classic CDDA and roguelikes, visual readability depends on layered glyph hierarchy:
1. **Floor Layer**: The grounding surface (cobblestone, decking, abyss underlay, liquid pools, soot residue). Always present.
2. **Fixture Layer**: Static structural elements and apparatus (doors, windows, pipes, workbenches, stoves, boilers, filing cabinets).
3. **Item Layer**: Loose inventory items, scrap, and ground loot lying on the floor/fixture.
4. **Actor Layer**: Dynamic entities (player `@`, hostile constructs `&`, constables, citizens).
5. **Indicator Layer**: Ephemeral targeting reticles (`⌖`), look cursor (`X`), path previews, and FOV highlights.

#### 2.1.2 Discrete Layer Interfaces (`RenderCellLayers` & `GlyphLayerVisual`)
To preserve strict modularity and keep `src/client/projection/frame-adapter.ts` below 220 lines, layer interfaces and utility functions should reside in `src/client/projection/layer-projection.ts`:

```typescript
// src/client/projection/layer-projection.ts
import { ShaderFlag, VisualGlyphSpec } from '../../schemas/primitives.schema.js';
import { EntityRecord } from '../../schemas/components.schema.js';
import { TerrainType } from '../../schemas/primitives.schema.js';

export interface GlyphLayerVisual {
  readonly glyph: string;
  readonly fgPrimary: string;
  readonly fgSecondary?: string;
  readonly bgColor?: string;
  readonly alpha?: number;
  readonly shaderFlags?: readonly ShaderFlag[];
  readonly tileKey?: string;
}

export interface RenderCellLayers {
  readonly floor: GlyphLayerVisual;
  readonly fixture?: GlyphLayerVisual;
  readonly item?: GlyphLayerVisual;
  readonly actor?: GlyphLayerVisual;
  readonly indicator?: GlyphLayerVisual;
}
```

#### 2.1.3 Backward-Compatibility Contract
`RenderCellFrame` in `src/client/projection/frame-adapter.ts` is updated to include `layers`:
```typescript
export interface RenderCellFrame {
  readonly x: number;
  readonly y: number;
  readonly worldX: number;
  readonly worldY: number;
  readonly visual: VisualGlyphSpec; // 100% backward compatible composite
  readonly layers: RenderCellLayers;  // Discrete layer breakdown
  readonly visible: boolean;
  readonly explored: boolean;
  readonly steamPressureKpa: number;
  readonly coalDustDensity: number;
  readonly isUnderlay?: boolean;
}
```

The composite `visual: VisualGlyphSpec` is derived deterministically from the top-most active layer, preserving the floor's background color:
```typescript
export function composeLayersToVisualSpec(layers: RenderCellLayers): VisualGlyphSpec {
  const topVisual = layers.indicator ?? layers.actor ?? layers.item ?? layers.fixture ?? layers.floor;
  return {
    glyph: topVisual.glyph,
    fgPrimary: topVisual.fgPrimary,
    fgSecondary: topVisual.fgSecondary ?? topVisual.fgPrimary,
    bgColor: layers.floor.bgColor ?? '#0A0D0E',
    shaderFlags: topVisual.shaderFlags ? [...topVisual.shaderFlags] : [],
  };
}
```
This guarantees:
1. Single-layer consumers (`glyph-stage.ts` and existing simulation tests in `tests/sim/`) see identical `cell.visual.glyph`, `cell.visual.fgPrimary`, and `cell.visual.bgColor`.
2. Multi-layer consumers (`TacticalLayerComposer` and graphical tileset managers) read `cell.layers` to draw unoccluded multi-pass sprite batches.

#### 2.1.4 Entity-to-Layer Classification Mapping
```typescript
export type EntityVisualLayer = 'actor' | 'item' | 'fixture';

export function classifyEntityLayer(entity: EntityRecord): EntityVisualLayer {
  if (entity.actor) return 'actor';
  if (entity.item || entity.prostheticSpec) return 'item';
  return 'fixture'; // furniture, workbench, portal, conduit, landmark, trap, etc.
}
```

#### 2.1.5 Fixture Terrain Extraction
When `tile.terrainType` is an aperture or fixture (e.g. `WOODEN_DOOR_CLOSED`, `WOODEN_DOOR_OPEN`, `GLASS_WINDOW`, `SMASHED_WINDOW_FRAME`, `DISTRICT_GATE`, `BRASS_STEAM_PIPE`, `GASLAMP_POST`, `COUNTER_BARRIER`, `CANAL_SLUICE`):
- `layers.floor`: Set to the base district floor visual (`COBBLESTONE_FLOOR` or `BRASS_CATWALK` with floor background).
- `layers.fixture`: Set to the door/pipe/window fixture visual with transparent background.

---

### 2.2 Feature 2: Extended CP437 Box-Drawing Resolver Design

#### 2.2.1 Problem Formulation & Style Determination
Every wall cell `(x, y)` has 4 orthogonal neighbors (North, East, South, West). Each connection can be in one of three states:
- `0: NONE` — No wall or opening connection.
- `1: SINGLE` — Connection to an interior partition, timber strut, or counter barrier.
- `2: DOUBLE` — Connection to an exterior building perimeter wall, fortress facade, or district gate.

Total connection states: $3^4 = 81$ deterministic states.

#### 2.2.2 Wall Style Classification Logic
A wall cell `(x, y)` is classified as an **interior partition** (`SINGLE`) if:
1. Its terrain is explicitly single-line: `TIMBER_STRUT` or `COUNTER_BARRIER`.
2. Its cell has an interior room zone (`cell.interiorZone !== 'NONE'`).
3. It has interior room spaces on both opposing sides (e.g. `isInteriorZone(north) && isInteriorZone(south)` or `isInteriorZone(east) && isInteriorZone(west)`).

Otherwise, the cell borders the outdoor street / perimeter (`interiorZone === 'NONE'`), and is classified as an **exterior wall** (`DOUBLE`).

When checking neighbor connections:
- `COUNTER_BARRIER`, `TIMBER_STRUT`: Connect as `SINGLE`.
- `DISTRICT_GATE`: Connects as `DOUBLE`.
- `WOODEN_DOOR_CLOSED` / `WOODEN_DOOR_OPEN` / `GLASS_WINDOW`: If touching exterior street (`interiorZone === 'NONE'`), connects as `DOUBLE` (exterior facade aperture); if between interior rooms, connects as `SINGLE` (interior doorway).
- `SOOT_BRICK_WALL`: Uses `isInteriorPartition(grid, nx, ny)` to determine `SINGLE` vs `DOUBLE`.

#### 2.2.3 Exact 81-State Resolver Lookup Table
We encode the 4 neighbor connection styles into an 8-bit key:
$$\text{key} = (n \ll 6) \mid (e \ll 4) \mid (s \ll 2) \mid w$$
where $n, e, s, w \in \{0, 1, 2\}$.

```typescript
// src/client/projection/extended-box-drawing.ts

export const enum WallStyle {
  NONE = 0,
  SINGLE = 1,
  DOUBLE = 2,
}

export const SINGLE_BOX_GLYPHS = {
  VERTICAL: '│',     // CP437 179
  HORIZONTAL: '─',   // CP437 196
  CORNER_NW: '┌',    // CP437 218 (down & right)
  CORNER_NE: '┐',    // CP437 191 (down & left)
  CORNER_SW: '└',    // CP437 192 (up & right)
  CORNER_SE: '┘',    // CP437 217 (up & left)
  TEE_NORTH: '┬',    // CP437 194 (down, left, right)
  TEE_SOUTH: '┴',    // CP437 193 (up, left, right)
  TEE_EAST: '├',     // CP437 195 (up, down, right)
  TEE_WEST: '┤',     // CP437 180 (up, down, left)
  CROSS: '┼',        // CP437 197
} as const;

export const DOUBLE_BOX_GLYPHS = {
  VERTICAL: '║',     // CP437 186
  HORIZONTAL: '═',   // CP437 205
  CORNER_NW: '╔',    // CP437 201
  CORNER_NE: '╗',    // CP437 187
  CORNER_SW: '╚',    // CP437 200
  CORNER_SE: '╝',    // CP437 188
  TEE_NORTH: '╦',    // CP437 203
  TEE_SOUTH: '╩',    // CP437 202
  TEE_EAST: '╠',     // CP437 204
  TEE_WEST: '╣',     // CP437 185
  CROSS: '╬',        // CP437 206
  SOLID_INTERIOR: '▓', // CP437 178
  DEFAULT: '#',
} as const;

export const MIXED_BOX_GLYPHS = {
  // Double horizontal with single vertical
  TEE_DOWN_DOUBLE_HORIZ: '╤',  // CP437 209: E:2, W:2, S:1
  TEE_UP_DOUBLE_HORIZ: '╧',    // CP437 207: E:2, W:2, N:1
  CROSS_DOUBLE_HORIZ: '╪',     // CP437 216: E:2, W:2, N:1, S:1

  // Double vertical with single horizontal
  TEE_RIGHT_DOUBLE_VERT: '╞',  // CP437 198: N:2, S:2, E:1
  TEE_LEFT_DOUBLE_VERT: '╡',   // CP437 181: N:2, S:2, W:1
  CROSS_DOUBLE_VERT: '╫',      // CP437 215: N:2, S:2, E:1, W:1

  // Single horizontal with double vertical
  TEE_DOWN_SINGLE_HORIZ: '╥',  // CP437 210: E:1, W:1, S:2
  TEE_UP_SINGLE_HORIZ: '╨',    // CP437 208: E:1, W:1, N:2

  // Single vertical with double horizontal
  TEE_RIGHT_SINGLE_VERT: '╟',  // CP437 199: N:1, S:1, E:2
  TEE_LEFT_SINGLE_VERT: '╢',   // CP437 182: N:1, S:1, W:2

  // Mixed corners
  CORNER_NW_DOUBLE_V: '╓',     // CP437 214: S:2, E:1
  CORNER_NW_DOUBLE_H: '╒',     // CP437 213: S:1, E:2
  CORNER_NE_DOUBLE_V: '╖',     // CP437 184: S:2, W:1
  CORNER_NE_DOUBLE_H: '╕',     // CP437 183: S:1, W:2
  CORNER_SW_DOUBLE_V: '╙',     // CP437 211: N:2, E:1
  CORNER_SW_DOUBLE_H: '╘',     // CP437 212: N:1, E:2
  CORNER_SE_DOUBLE_V: '╜',     // CP437 189: N:2, W:1
  CORNER_SE_DOUBLE_H: '╛',     // CP437 190: N:1, W:2
} as const;
```

#### 2.2.4 The Resolution Mapping Function
```typescript
export function resolveBoxDrawingGlyph(
  n: WallStyle,
  e: WallStyle,
  s: WallStyle,
  w: WallStyle,
  isSurroundedBySolidWalls = false,
): string {
  // 1. 4-way junctions
  if (n && e && s && w) {
    if (n === WallStyle.DOUBLE && e === WallStyle.DOUBLE && s === WallStyle.DOUBLE && w === WallStyle.DOUBLE) {
      return isSurroundedBySolidWalls ? DOUBLE_BOX_GLYPHS.SOLID_INTERIOR : DOUBLE_BOX_GLYPHS.CROSS;
    }
    if (n === WallStyle.SINGLE && e === WallStyle.SINGLE && s === WallStyle.SINGLE && w === WallStyle.SINGLE) {
      return SINGLE_BOX_GLYPHS.CROSS;
    }
    if (n === WallStyle.DOUBLE && s === WallStyle.DOUBLE && e === WallStyle.SINGLE && w === WallStyle.SINGLE) {
      return MIXED_BOX_GLYPHS.CROSS_DOUBLE_VERT; // ╫
    }
    if (n === WallStyle.SINGLE && s === WallStyle.SINGLE && e === WallStyle.DOUBLE && w === WallStyle.DOUBLE) {
      return MIXED_BOX_GLYPHS.CROSS_DOUBLE_HORIZ; // ╪
    }
    return DOUBLE_BOX_GLYPHS.CROSS;
  }

  // 2. 3-way T-junctions
  // East Tees (N + S + E)
  if (n && s && e && !w) {
    if (n === WallStyle.DOUBLE && s === WallStyle.DOUBLE) {
      return e === WallStyle.SINGLE ? MIXED_BOX_GLYPHS.TEE_RIGHT_DOUBLE_VERT : DOUBLE_BOX_GLYPHS.TEE_EAST; // ╞ or ╠
    }
    if (n === WallStyle.SINGLE && s === WallStyle.SINGLE) {
      return e === WallStyle.DOUBLE ? MIXED_BOX_GLYPHS.TEE_RIGHT_SINGLE_VERT : SINGLE_BOX_GLYPHS.TEE_EAST; // ╟ or ├
    }
    return DOUBLE_BOX_GLYPHS.TEE_EAST;
  }

  // West Tees (N + S + W)
  if (n && s && !e && w) {
    if (n === WallStyle.DOUBLE && s === WallStyle.DOUBLE) {
      return w === WallStyle.SINGLE ? MIXED_BOX_GLYPHS.TEE_LEFT_DOUBLE_VERT : DOUBLE_BOX_GLYPHS.TEE_WEST; // ╡ or ╣
    }
    if (n === WallStyle.SINGLE && s === WallStyle.SINGLE) {
      return w === WallStyle.DOUBLE ? MIXED_BOX_GLYPHS.TEE_LEFT_SINGLE_VERT : SINGLE_BOX_GLYPHS.TEE_WEST; // ╢ or ┤
    }
    return DOUBLE_BOX_GLYPHS.TEE_WEST;
  }

  // North Tees (pointing down: S + E + W)
  if (!n && s && e && w) {
    if (e === WallStyle.DOUBLE && w === WallStyle.DOUBLE) {
      return s === WallStyle.SINGLE ? MIXED_BOX_GLYPHS.TEE_DOWN_DOUBLE_HORIZ : DOUBLE_BOX_GLYPHS.TEE_NORTH; // ╤ or ╦
    }
    if (e === WallStyle.SINGLE && w === WallStyle.SINGLE) {
      return s === WallStyle.DOUBLE ? MIXED_BOX_GLYPHS.TEE_DOWN_SINGLE_HORIZ : SINGLE_BOX_GLYPHS.TEE_NORTH; // ╥ or ┬
    }
    return DOUBLE_BOX_GLYPHS.TEE_NORTH;
  }

  // South Tees (pointing up: N + E + W)
  if (n && !s && e && w) {
    if (e === WallStyle.DOUBLE && w === WallStyle.DOUBLE) {
      return n === WallStyle.SINGLE ? MIXED_BOX_GLYPHS.TEE_UP_DOUBLE_HORIZ : DOUBLE_BOX_GLYPHS.TEE_SOUTH; // ╧ or ╩
    }
    if (e === WallStyle.SINGLE && w === WallStyle.SINGLE) {
      return n === WallStyle.DOUBLE ? MIXED_BOX_GLYPHS.TEE_UP_SINGLE_HORIZ : SINGLE_BOX_GLYPHS.TEE_SOUTH; // ╨ or ┴
    }
    return DOUBLE_BOX_GLYPHS.TEE_SOUTH;
  }

  // 3. 2-way Corners
  if (!n && s && e && !w) {
    if (s === WallStyle.DOUBLE && e === WallStyle.DOUBLE) return DOUBLE_BOX_GLYPHS.CORNER_NW; // ╔
    if (s === WallStyle.SINGLE && e === WallStyle.SINGLE) return SINGLE_BOX_GLYPHS.CORNER_NW; // ┌
    return s === WallStyle.DOUBLE ? MIXED_BOX_GLYPHS.CORNER_NW_DOUBLE_V : MIXED_BOX_GLYPHS.CORNER_NW_DOUBLE_H; // ╓ or ╒
  }
  if (!n && s && !e && w) {
    if (s === WallStyle.DOUBLE && w === WallStyle.DOUBLE) return DOUBLE_BOX_GLYPHS.CORNER_NE; // ╗
    if (s === WallStyle.SINGLE && w === WallStyle.SINGLE) return SINGLE_BOX_GLYPHS.CORNER_NE; // ┐
    return s === WallStyle.DOUBLE ? MIXED_BOX_GLYPHS.CORNER_NE_DOUBLE_V : MIXED_BOX_GLYPHS.CORNER_NE_DOUBLE_H; // ╖ or ╕
  }
  if (n && !s && e && !w) {
    if (n === WallStyle.DOUBLE && e === WallStyle.DOUBLE) return DOUBLE_BOX_GLYPHS.CORNER_SW; // ╚
    if (n === WallStyle.SINGLE && e === WallStyle.SINGLE) return SINGLE_BOX_GLYPHS.CORNER_SW; // └
    return n === WallStyle.DOUBLE ? MIXED_BOX_GLYPHS.CORNER_SW_DOUBLE_V : MIXED_BOX_GLYPHS.CORNER_SW_DOUBLE_H; // ╙ or ╘
  }
  if (n && !s && !e && w) {
    if (n === WallStyle.DOUBLE && w === WallStyle.DOUBLE) return DOUBLE_BOX_GLYPHS.CORNER_SE; // ╝
    if (n === WallStyle.SINGLE && w === WallStyle.SINGLE) return SINGLE_BOX_GLYPHS.CORNER_SE; // ┘
    return n === WallStyle.DOUBLE ? MIXED_BOX_GLYPHS.CORNER_SE_DOUBLE_V : MIXED_BOX_GLYPHS.CORNER_SE_DOUBLE_H; // ╜ or ╛
  }

  // 4. Straights
  if (n || s) {
    return (n === WallStyle.DOUBLE || s === WallStyle.DOUBLE) ? DOUBLE_BOX_GLYPHS.VERTICAL : SINGLE_BOX_GLYPHS.VERTICAL; // ║ or │
  }
  if (e || w) {
    return (e === WallStyle.DOUBLE || w === WallStyle.DOUBLE) ? DOUBLE_BOX_GLYPHS.HORIZONTAL : SINGLE_BOX_GLYPHS.HORIZONTAL; // ═ or ─
  }

  return DOUBLE_BOX_GLYPHS.DEFAULT;
}
```

---

## 3. Caveats

1. **Map Perimeter vs Open Borders**:
   In `wall-connections.ts`, coords outside the grid (`x < 0 || x >= grid.width`) returned `true` for wall connectivity so border walls connect visually. In `extended-box-drawing.ts`, coordinates outside the grid are treated as `WallStyle.DOUBLE` so perimeter walls seal cleanly against map borders.
2. **Backward-Compatibility with Non-Zoned Stratum Maps**:
   In procedural sewers or drift mines where all cells currently default to `interiorZone === 'NONE'`, all walls evaluate to `WallStyle.DOUBLE`. This preserves 100% of existing behavior and ensures `tests/sim/phase47-biome-topography.test.ts` and `tests/sim/wall-autotile-closure.test.ts` pass without modification.
3. **Visual Priority Order**:
   In `composeLayersToVisualSpec`, the precedence is strictly:
   $$\text{indicator (4)} > \text{actor (3)} > \text{item (2)} > \text{fixture (1)} > \text{floor (0)}$$
   The background color is **ALWAYS** taken from `layers.floor.bgColor`. This maintains the engine invariant that entity glyphs never stamp opaque black background rectangles over ambient lighting or liquid surfaces.
4. **Modularity Ceilings**:
   - `src/client/projection/frame-adapter.ts` is 197 lines. If layer projection code were placed directly in `frame-adapter.ts`, it would reach ~295 lines (dangerously near the 300-line ceiling).
   - **Resolution**: Extract `src/client/projection/layer-projection.ts` (~130 lines) and `src/client/projection/extended-box-drawing.ts` (~180 lines). `frame-adapter.ts` will stay at ~205 lines.
5. **Tile Key Conventions for Future Graphical Tileset (Feature 4)**:
   `tileKey` strings must follow snake_case category prefixes:
   - Floors: `floor_cobblestone`, `floor_brass_catwalk`, `floor_iron_grate`
   - Walls: `wall_soot_brick_double`, `wall_partition_single`
   - Fixtures: `fixture_door_closed`, `fixture_artificer_bench`, `fixture_coal_stove`, `fixture_steam_pipe`
   - Items: `item_scrap`, `item_prosthetic`, `item_consumable`
   - Actors: `actor_player`, `actor_npc_guard`, `actor_automaton`
   - Indicators: `indicator_target_reticle`, `indicator_look_cursor`

---

## 4. Conclusion

Features 1 & 2 provide a complete architectural foundation for Milestone 3 presentation:

### File Implementation Blueprint
1. **`src/client/projection/extended-box-drawing.ts`** (NEW, ~180 lines):
   - Contains `WallStyle`, `SINGLE_BOX_GLYPHS`, `DOUBLE_BOX_GLYPHS`, `MIXED_BOX_GLYPHS`.
   - Exports `resolveBoxDrawingGlyph(n, e, s, w, isSurrounded)`.
   - Exports `resolveExtendedConnectingWallGlyph(grid: StratumGrid, x: number, y: number): string`.
   - Exports `isInteriorPartition(grid: StratumGrid, x: number, y: number): boolean`.
   - Re-exports `WALL_BOX_GLYPHS` for backwards compatibility.

2. **`src/client/projection/layer-projection.ts`** (NEW, ~130 lines):
   - Exports `GlyphLayerVisual` and `RenderCellLayers` interfaces.
   - Exports `classifyEntityLayer(entity: EntityRecord): EntityVisualLayer`.
   - Exports `isFixtureTerrain(terrain: TerrainType): boolean`.
   - Exports `composeLayersToVisualSpec(layers: RenderCellLayers): VisualGlyphSpec`.
   - Exports `buildCellLayers(...)` helper function.

3. **`src/client/projection/frame-adapter.ts`** (MODIFIED, ~205 lines):
   - Imports from `layer-projection.ts` and `extended-box-drawing.ts`.
   - Extends `RenderCellFrame` with `layers: RenderCellLayers`.
   - Calls `resolveExtendedConnectingWallGlyph` for wall autotiling.
   - Populates `layers` and computes backward-compatible `visual`.

4. **`src/client/projection/wall-connections.ts`** (MODIFIED, ~50 lines):
   - Re-exports `WALL_BOX_GLYPHS` and `resolveConnectingWallGlyph` delegating to `resolveExtendedConnectingWallGlyph`.

---

## 5. Verification Method

To independently verify the implementation, the following automated test suites in `tests/sim/` must be authored and executed with `npm run verify`:

### 5.1 Box-Drawing Resolver Verification (`tests/sim/extended-box-drawing.test.ts`)
Run:
```bash
npx vitest run tests/sim/extended-box-drawing.test.ts
```
Assertions to execute:
1. **Single-line 4-bit autotiling**:
   - Verify all 16 masks (0x0 to 0xF) of `WallStyle.SINGLE` produce exact single-line characters (`│`, `─`, `┌`, `┐`, `└`, `┘`, `┬`, `┴`, `├`, `┤`, `┼`).
2. **Double-line 4-bit autotiling**:
   - Verify all 16 masks (0x0 to 0xF) of `WallStyle.DOUBLE` produce exact double-line characters (`║`, `═`, `╔`, `╗`, `╚`, `╝`, `╦`, `╩`, `╠`, `╣`, `╬`).
   - Verify 8-way enclosed wall produces `▓` (CP437 178).
3. **Mixed T-junctions**:
   - Exterior double wall + interior single partition:
     - North single partition meeting South double wall $\to$ `╧` (CP437 207)
     - South single partition meeting North double wall $\to$ `╤` (CP437 209)
     - East single partition meeting West double wall $\to$ `╞` (CP437 198)
     - West single partition meeting East double wall $\to$ `╡` (CP437 181)
4. **Mixed Crosses & Corners**:
   - N/S double + E/W single cross $\to$ `╫` (CP437 215)
   - N/S single + E/W double cross $\to$ `╪` (CP437 216)
   - Mixed corners: `╓`, `╒`, `╖`, `╕`, `╙`, `╘`, `╜`, `╛`
5. **CDDA Template Stamping Integration**:
   - Stamp `TEMPLATE_VICTORIAN_TAVERN` into a `StratumGrid`.
   - Verify exterior walls at (0, 0) $\to$ `╔`, (11, 0) $\to$ `╗`, perimeter straights $\to$ `═` / `║`.
   - Verify snug partition divider walls resolve to single lines `│` and `─`.
   - Verify junction where snug partition meets the North/West perimeter resolves to mixed T-junction glyphs `╤` or `╞`.
   - Verify interior door connects to single-line partition walls without disconnection (`#`).

### 5.2 Multi-Layer Glyph Projection Verification (`tests/sim/multi-layer-projection.test.ts`)
Run:
```bash
npx vitest run tests/sim/multi-layer-projection.test.ts
```
Assertions to execute:
1. **Base floor cell**:
   - Empty floor: `layers.floor` is populated with `glyph: '·'`; `fixture`, `item`, `actor`, `indicator` are `undefined`.
2. **Fixture stacking**:
   - Cell with `WOODEN_DOOR_CLOSED`: `layers.floor.glyph === '·'`, `layers.fixture.glyph === '+'`.
   - Cell with `ARTIFICER_BENCH`: `layers.floor.glyph === '·'`, `layers.fixture.glyph === 'T'`.
3. **Item and Actor multi-layer preservation**:
   - Place a loot item and an actor on top of the workbench.
   - Assert all 4 layers are simultaneously populated:
     - `layers.floor.glyph === '·'`
     - `layers.fixture.glyph === 'T'`
     - `layers.item.glyph === '!'`
     - `layers.actor.glyph === '@'`
   - Assert `cell.visual.glyph === '@'` (top-most layer).
   - Assert `cell.visual.bgColor === layers.floor.bgColor` (floor background preserved).
4. **Indicator overlay**:
   - Pass a targeting reticle coordinate to `projectWorldToVisualFrame`.
   - Assert `layers.indicator.glyph === '⌖'` and `cell.visual.glyph === '⌖'`.
5. **Full Verification Suite Gate**:
   ```bash
   npm run verify
   ```
   Must pass typecheck (`tsc --noEmit`), boundary check (`check-boundaries.ts`), schema validation, and all deterministic simulation tests with 0 errors.
