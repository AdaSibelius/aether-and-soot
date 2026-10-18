# ARCHITECTURE.md — AI System Map & Architectural Guardrails (Aether & Soot)

> **PURPOSE OF THIS DOCUMENT**: This file is a machine-readable, strictly typed architectural blueprint for AI coding agents modifying *Aether & Soot*. Read this entire file before proposing any structural refactors or creating new systems.

---

## 1. System Boundaries & The "Why"

```
+-----------------------------------------------------------------------------------+
|                           THE ARCHITECTURAL FIREWALL                              |
+-----------------------------------------------------------------------------------+
|  HEADLESS SIMULATION CORE (src/sim/ & src/schemas/)                               |
|  - 100% deterministic, zero DOM dependencies, headless-testable via Vitest       |
|  - Source of Truth: Immutable WorldState hydrated and validated by Zod schemas    |
|  - PRNG: Pure xoshiro128** with serializable tuple state (rngState)               |
|  - Dispatched via pure reducer: dispatchCommand(state, cmd) -> { state, events }  |
|                                                                                   |
|  >>> ABSOLUTE FORBIDDEN BOUNDARY: ZERO PixiJS, Preact, DOM, or Web APIs here <<<  |
+-----------------------------------------------------------------------------------+
                                         |
                                         | (Pure One-Way Read Projection)
                                         v
+-----------------------------------------------------------------------------------+
|  PRESENTATION & UI SHELL (src/client/)                                            |
|  - PixiJS v8 Canvas: RenderCellFrame pipeline, GLSL CRT scanline post-processing  |
|  - Preact HUD: Telemetry, Anatomy Paperdoll, Satchel inventory, Commodity Ledger  |
|  - Pure consumer: Read-only projection from WorldState via frame-adapter.ts       |
|  - Dispatches GameCommand payloads into the simulation core — NEVER mutates state |
+-----------------------------------------------------------------------------------+
```

### Why This Boundary Exists
1. **AI Autonomy & Testing Velocity**: 95% of gameplay mechanics (thermodynamics, energy scheduling, limb amputations, procedural generation, market shocks) can be verified in milliseconds inside headless Node/Vitest environments (`tests/sim/`) without spawning a browser canvas.
2. **Deterministic Multiplayer & Replayability**: Complete game runs are serialized as a seed + command stream. Any model refactoring gameplay code cannot introduce non-deterministic desyncs caused by browser timings or visual animation callbacks.
3. **Model Safety**: Smaller LLMs easily conflate UI state with simulation state. By strictly confining visual rendering to `src/client/`, the core rules cannot be corrupted by client-side bugs.

---

## 2. State Management & Data Flow

### The Source of Truth: `WorldState`
The simulation state is fully encapsulated by `WorldStateSchema` in `src/sim/core/world.ts`:
- `version`: Schema migration version (currently `1`).
- `seed`: The world generation seed.
- `rngState`: `[number, number, number, number]` — Deterministic PRNG tuple.
- `turnCount`: Total atomic turns elapsed.
- `macroTickCount`: Number of 100-turn economic intervals completed.
- `currentDistrictId`: `BlueprintId` — Active district blueprint id (defaults to `district_spitalfields_soot_works`).
- `strata`: `Record<StratumId, StratumGrid>` — Discrete 2D grids for each vertical layer:
  - `UNDERCROFT`: Flooded sewer vaults, iron grates, and coal dust hazard pools.
  - `STREET`: Cobblestone roads, foundry courtyards, shopfronts, and high-pressure steam pipes.
  - `SPIRE`: Clockwork towers, brass catwalks, and aerial sky-bridges.
- `entities`: `Record<EntityId, EntityRecord>` — Relational flat Entity-Component-System (ECS) dictionary.
- `economy`: `DistrictEconomyLedger` — Macro-economic market state (quotes, volatility, merchant inventories, faction reputation).
- `eventLog`: `SimEvent[]` — Append-only chronological log of every state mutation.

### Exact Execution Order of a Turn (`dispatchCommand` in `src/sim/core/engine.ts`)
When a command is dispatched via `dispatchCommand(currentState, rawCommand)`:
1. **Runtime Validation**: `GameCommandSchema.parse(rawCommand)` validates the command payload.
2. **PRNG Hydration**: `new SeededRNG(currentState.rngState)` restores the deterministic PRNG.
3. **Domain System Execution**: The `switch (command.type)` block invokes the corresponding pure function in `src/sim/systems/*.system.ts`, returning `{ state, events, apSpent }`.
4. **Environmental Thermodynamics Tick**: `advanceThermodynamicsTick(nextState)` (`src/sim/systems/thermo.system.ts`) runs double-buffered cellular automata for steam and coal dust across all 3 strata, transfers rising steam upward through portals (`conductsGas: true`), and applies `THERMAL_SCALD` limb damage to actors in high-pressure steam (`>= 25 kPa`).
5. **Energy & Macro-Tick Scheduling**: `advanceTurnSchedule(...)` (`src/sim/core/scheduler.ts`) deducts `apSpent` from `actor.energy`, adds `actor.speed`, increments `turnCount`, and—if `turnCount % 100 === 0`—invokes `advanceDistrictEconomyMacroTick(...)` (`src/sim/systems/economy.system.ts`) and appends `MACRO_TICK_COMPLETED`.
6. **Client Projection (Browser Only)**: `src/client/main.tsx` passes the new `WorldState` to `projectWorldToVisualFrame(worldState)` (`src/client/projection/frame-adapter.ts`), which computes 8-octant shadowcasting FOV (`computeVisibleTiles` in `src/sim/spatial/fov.ts` + prosthetic FOV bonuses) and updates both `GlyphStageRenderer` and Preact `<HudLayout />`.

---

## 3. Component & System Registry (Where Everything Lives)

Use this lookup table to locate existing logic before writing any code.

### A. Schemas & Contracts (`src/schemas/`)
| File | Exports & Responsibility |
| :--- | :--- |
| `src/schemas/primitives.schema.ts` | `EntityIdSchema`, `BlueprintIdSchema`, `StratumIdSchema` (`UNDERCROFT` \| `STREET` \| `SPIRE`), `FactionIdSchema`, `CommodityIdSchema`, `ItemCategorySchema`, `ItemUseEffectSchema`, `HexColorSchema`, `ShaderFlagSchema`, `Point2DSchema`, `Point3DSchema`, `VisualGlyphSpecSchema`, `LimbSlotIdSchema`, `SocketTypeSchema` |
| `src/schemas/blueprint.schema.ts` | Declarative JSON schemas: `ProstheticBlueprintSchema`, `CommodityBlueprintSchema`, `GasFluidBlueprintSchema`, `DistrictBlueprintSchema`, `ItemBlueprintSchema` |
| `src/schemas/components.schema.ts` | ECS components on `EntityRecord`: `position`, `actor`, `portal`, `anatomy` (`limbs`, `bloodVolumePct`, `steamReserveKpa`), `inventory`, `prostheticSpec`, `pressureVessel`, `item`, `districtGate` |
| `src/schemas/commands.schema.ts` | `GameCommandSchema` discriminated union (`MOVE_STEP`, `USE_PORTAL`, `WAIT_TURN`, `VENT_STEAM`, `DAMAGE_LIMB`, `INSTALL_PROSTHETIC`, `REMOVE_PROSTHETIC`, `REFILL_STEAM`, `PRESSURIZE_VESSEL`, `EMIT_SPARK`, `STOCK_PEDESTAL`, `TRIGGER_SUPPLY_SHOCK`, `PICK_UP_ITEM`, `DROP_ITEM`, `USE_ITEM`, `TOGGLE_DOOR`, `TRAVEL_DISTRICT`) |
| `src/schemas/events.schema.ts` | `SimEventSchema` discriminated union (all 25 event types emitted by systems and formatted in `HudLayout.tsx`) |

### B. Headless Simulation Core (`src/sim/`)
| File | Current Lines | Exports & Responsibility |
| :--- | :--- | :--- |
| `src/sim/core/rng.ts` | 76 | `SeededRNG` (`nextUint32`, `nextFloat`, `nextInt`, `getState`), `RNGStateSchema` |
| `src/sim/core/world.ts` | 236 | `WorldStateSchema`, `createInitialWorld`, `serializeWorld`, `deserializeWorld` |
| `src/sim/core/scheduler.ts` | 64 | `STANDARD_ACTION_AP` (100), `MACRO_TICK_INTERVAL` (100), `advanceTurnSchedule` |
| `src/sim/core/engine.ts` | 221 | `dispatchCommand(currentState, rawCommand)` — central command router |
| `src/sim/spatial/grid.ts` | 106 | `TileCellSchema`, `StratumGridSchema`, `createStratumGrid`, `isWithinBounds`, `getTileCell`, `setTileCell`, `findEntitiesAtPoint`, `findBlockingEntityAtPoint` |
| `src/sim/spatial/portals.ts` | 14 | `findPortalAtPoint(entities, point)` |
| `src/sim/spatial/fov.ts` | 115 | `computeVisibleTiles(grid, originX, originY, radius)`, `isPointVisible`, `pointKey` |
| `src/sim/spatial/district-layout.ts` | 138 | `buildSolidStratumGrid`, `carveRoom`, `carveCorridor`, `carveBuildingWithDoor` |
| `src/sim/spatial/generator.ts` | 199 | `generateVictorianDistrict(state)`, `hasWalkablePath(grid, start, goal)` |
| `src/sim/data/item-catalog.ts` | 49 | `ITEM_CATALOG`, `getItemBlueprint`, `createItemEntity` |
| `src/sim/systems/inventory-utils.ts` | 126 | `getCarryProfile`, `computeCarriedVolumeMl`, `isInstalledOnActor`, `findMergeableStack`, `allocateSplitId`, `createInventoryFailureResult`, `MAX_OVERLOAD_RATIO` |
| `src/sim/systems/inventory.system.ts` | 245 | `resolvePickupItem`, `resolveDropItem`, `resolveUseItem` |
| `src/sim/systems/item-spawner.ts` | 71 | `spawnDistrictItems` — deterministic seeded ground-item scatterer |
| `src/sim/systems/movement.system.ts` | 256 | `computeMovementMechanics`, `resolveMoveStep`, `resolveUsePortal` |
| `src/sim/systems/transit.system.ts` | 179 | `resolveToggleDoor`, `resolveTravelDistrict`, `VALID_DISTRICT_IDS` |
| `src/sim/systems/anatomy.system.ts` | **293 (Near Cap)** | `computeProstheticFovBonus`, `resolveDamageLimb`, `resolveInstallProsthetic`, `resolveRemoveProsthetic`, `resolveRefillSteam` |
| `src/sim/systems/thermo.system.ts` | 168 | `advanceThermodynamicsTick`, `SCALD_PRESSURE_THRESHOLD_KPA` |
| `src/sim/systems/pressure.system.ts` | 174 | `resolvePressurizeVessel`, `resolveEmitSpark`, `COAL_DUST_IGNITION_THRESHOLD` |
| `src/sim/systems/economy.system.ts` | **283 (Near Cap)** | `createInitialEconomyLedger`, `computeBoundedPricePence`, `resolveStockPedestal`, `resolveTriggerSupplyShock`, `advanceDistrictEconomyMacroTick` |

### C. Presentation & UI Shell (`src/client/`)
| File | Exports & Responsibility |
| :--- | :--- |
| `src/client/projection/frame-adapter.ts` | `projectWorldToVisualFrame(state, focusActorId, baseFovRadius)` -> `VisualGridFrame` |
| `src/client/renderer/glyph-stage.ts` | `GlyphStageRenderer` — PixiJS v8 canvas renderer with dual-color glyph pulsing and steam overlay |
| `src/client/renderer/crt-filter.ts` | `createCrtPostFilter()` — GLSL scanlines, chromatic aberration, and vignette filter |
| `src/client/ui/HudLayout.tsx` | Main Preact sidebar, `formatEventMessage(ev: SimEvent)`, and tactical/tinkering buttons |
| `src/client/ui/SatchelPanel.tsx` | Artificer's Satchel panel: carried items volume, Use, Drop, and ground Take actions |
| `src/client/ui/AnatomyDoll.tsx` | Limb HP/amputation/prosthetic paperdoll and steam/sanguine telemetry |
| `src/client/ui/MarketLedger.tsx` | Commodity ticker, faction standing table, and storefront controls |
| `src/client/main.tsx` | Client bootstrap, keyboard listener (wasd/arrows, portals, wait, pickup [G]), and `window.__DEBUG_SIM__` |

---

## 4. The 6-Step Recipe for New Features

Every AI contributor must execute new features using this exact lifecycle:

```
[1. Schemas & Types] -> [2. Spatial / Data] -> [3. Headless System] -> [4. Client Projection & HUD] -> [5. Headless Vitest] -> [6. Automated Verification Gate]
```

1. **Schemas First (`src/schemas/`)**:
   - Add new components to `components.schema.ts`.
   - Add new command variants to `commands.schema.ts`.
   - Add new event variants to `events.schema.ts`.
2. **Spatial / Data (`src/sim/spatial/` or `data/`)**:
   - Update `TileCellSchema` or generator algorithms if new terrain or strata are required.
   - If adding JSON data, validate using schemas in `blueprint.schema.ts`.
3. **Headless Domain System (`src/sim/systems/`)**:
   - Write pure, stateless functions taking `(state: WorldState, ...args)` and returning `{ state, events, apSpent }`.
   - **Enforce file limits**: If target system file is near 250 lines, create a new sub-module!
   - Wire the new command into `switch (command.type)` inside `src/sim/core/engine.ts`.
4. **Client Projection & HUD (`src/client/`)**:
   - Handle new `SimEvent` variants in `formatEventMessage` inside `HudLayout.tsx`.
   - If new visual glyphs or shader flags are required, update `frame-adapter.ts` and `glyph-stage.ts`.
5. **Headless Unit Test (`tests/sim/`)**:
   - Write deterministic tests in `tests/sim/<feature>.test.ts`. Use fixed seeds and verify causal chains in `state.eventLog`.
6. **Mandatory Verification Gate**:
   - Run `npm run verify` (`typecheck`, `check:boundaries`, `validate:data`, `test:sim`). All 4 must pass with 0 errors.
