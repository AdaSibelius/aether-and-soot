# ARCHITECTURE.md — AI-Optimized System Map (Aether & Soot)

> **PURPOSE FOR AI AGENTS**: Read this file BEFORE planning or writing code. It defines the exact file locations, data contracts, state-mutation pipeline, and architectural invariants of *Aether & Soot*. Do not invent parallel stores, event buses, or untyped helpers.

---

## 1. System Boundaries & The "Why"

The codebase is strictly divided into three rings. Violations cause `npm run check:boundaries` to fail with exit code `1`.

```mermaid
flowchart LR
    subgraph Ring1["Ring 1: Zod Contracts & JSON Data\n(src/schemas/ + data/)"]
        Schemas["src/schemas/*.schema.ts"]
        JSON["data/**/*.json"]
    end

    subgraph Ring2["Ring 2: Headless Simulation Core\n(src/sim/)"]
        Engine["dispatchCommand()\nsrc/sim/core/engine.ts"]
        Systems["Pure Domain Systems\nsrc/sim/systems/*.system.ts"]
        World["WorldState Store\nsrc/sim/core/world.ts"]
    end

    subgraph Ring3["Ring 3: Presentation Shell\n(src/client/)"]
        Adapter["projectWorldToVisualFrame()\nsrc/client/projection/frame-adapter.ts"]
        Pixi["GlyphStageRenderer + CRT Shader\nsrc/client/renderer/"]
        Preact["Preact HUD Panels\nsrc/client/ui/"]
    end

    JSON --> Schemas
    Schemas --> Ring2
    Schemas --> Ring3
    Preact -- "Dispatches GameCommand" --> Engine
    Engine --> Systems
    Systems --> World
    World -. "Readonly<WorldState>" .-> Adapter
    Adapter --> Pixi
    World -. "Readonly<WorldState>" .-> Preact
```

### Why Headless Separation (`src/sim/` vs `src/client/`) Exists:
1. **Sub-Second Automated Verification**: Because `src/sim/` has zero browser, DOM, WebGL, `pixi.js`, or `preact` dependencies, Vitest (`npm run test:sim`) executes 100-turn replays, 50-seed map generation checks, and 500-macro-tick economic simulations in **<300ms** in Node.js without launching a headless browser.
2. **Bit-Exact Determinism & Save/Load Integrity**: Every random roll uses `SeededRNG` (`src/sim/core/rng.ts`), whose 4-integer state tuple (`rngState`) lives inside `WorldState`. Calling `serializeWorld(state)` at Turn 50 and `deserializeWorld(json)` guarantees the exact same state hash at Turn 100 as an uninterrupted run.
3. **Zero UI-Induced State Corruption**: `src/client/` only receives `Readonly<WorldState>`. It cannot mutate entity HP, inventory, or tiles directly; it can only emit a Zod-validated `GameCommand` to `dispatchCommand()`.

---

## 2. State Management & Unidirectional Turn Lifecycle

### Single Source of Truth: `WorldState` (`src/sim/core/world.ts`)
All game state lives in a single flat, JSON-serializable object validated by `WorldStateSchema`:
- `version`: Literal `1`
- `seed`: Initial integer seed
- `rngState`: `[number, number, number, number]` (`xoshiro128**` state tuple)
- `turnCount`: Global turn counter (increments by `1` per command)
- `macroTickCount`: Increments by `1` every `100` turns (`MACRO_TICK_INTERVAL`)
- `strata`: `Record<StratumId, StratumGrid>` — 2D tile grids for `'UNDERCROFT'`, `'STREET'`, and `'SPIRE'`
- `entities`: `Record<string, EntityRecord>` — Flat ECS entity table keyed by branded `EntityId`. **Never nest entity objects inside other entities**; always reference via `EntityId` (e.g., `installedProstheticEntityId` or `containedEntityIds`).
- `economy`: `DistrictEconomyLedger` — Player treasury (`playerTreasuryPence`), faction standings (`factionReputation`), commodity quotes (`marketQuotes`), and storefront listings (`storefrontListings`).
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
| `src/schemas/blueprint.schema.ts` | Declarative JSON schemas: `ProstheticBlueprintSchema`, `CommodityBlueprintSchema`, `GasFluidBlueprintSchema`, `DistrictBlueprintSchema`, `ItemBlueprintSchema`, `CraftingRecipeBlueprintSchema` |
| `src/schemas/components.schema.ts` | ECS components on `EntityRecord`: `position`, `actor`, `portal`, `anatomy` (`limbs`, `bloodVolumePct`, `steamReserveKpa`), `inventory`, `prostheticSpec`, `pressureVessel`, `item`, `districtGate`, `workbench`, `aiController`, `combatStats` |
| `src/schemas/commands.schema.ts` | `GameCommandSchema` discriminated union (`MOVE_STEP`, `USE_PORTAL`, `WAIT_TURN`, `VENT_STEAM`, `DAMAGE_LIMB`, `INSTALL_PROSTHETIC`, `REMOVE_PROSTHETIC`, `REFILL_STEAM`, `PRESSURIZE_VESSEL`, `EMIT_SPARK`, `STOCK_PEDESTAL`, `TRIGGER_SUPPLY_SHOCK`, `PICK_UP_ITEM`, `DROP_ITEM`, `USE_ITEM`, `TOGGLE_DOOR`, `TRAVEL_DISTRICT`, `CRAFT_RECIPE`, `SALVAGE_ITEM`, `REPAIR_LIMB`, `ATTACK_ACTOR`, `BUY_FROM_MERCHANT`, `SELL_TO_MERCHANT`) |
| `src/schemas/domain-events.schema.ts` | Extracted domain event schemas for inventory, district transit, crafting, salvage, limb repair, combat, and merchant trading |
| `src/schemas/events.schema.ts` | `SimEventSchema` discriminated union (all 34 event types emitted by systems and formatted in `HudLayout.tsx`) |

### B. Headless Simulation Core (`src/sim/`)
| File | Current Lines | Exports & Responsibility |
| :--- | :--- | :--- |
| `src/sim/core/rng.ts` | 76 | `SeededRNG` (`nextUint32`, `nextFloat`, `nextInt`, `getState`), `RNGStateSchema` |
| `src/sim/core/world.ts` | 232 | `WorldStateSchema`, `createInitialWorld`, `serializeWorld`, `deserializeWorld` |
| `src/sim/core/scheduler.ts` | 66 | `STANDARD_ACTION_AP` (100), `MACRO_TICK_INTERVAL` (100), `advanceTurnSchedule` |
| `src/sim/core/engine.ts` | 105 | `dispatchCommand(currentState, rawCommand)` — central command router |
| `src/sim/spatial/grid.ts` | 128 | `TileCellSchema`, `StratumGridSchema`, `createStratumGrid`, `isWithinBounds`, `getTileCell`, `setTileCell`, `findEntitiesAtPoint`, `findBlockingEntityAtPoint` |
| `src/sim/spatial/portals.ts` | 14 | `findPortalAtPoint(entities, point)` |
| `src/sim/spatial/fov.ts` | 141 | `computeVisibleTiles(grid, originX, originY, radius)`, `isPointVisible`, `pointKey` |
| `src/sim/spatial/district-layout.ts` | 139 | `buildSolidStratumGrid`, `carveRoom`, `carveCorridor`, `carveBuildingWithDoor` |
| `src/sim/spatial/generator.ts` | 222 | `generateVictorianDistrict(state)`, `hasWalkablePath(grid, start, goal)` |
| `src/sim/spatial/catacombs.ts` | 209 | Procedural infinite delve chalk catacombs & relic clockwork vault generation |
| `src/sim/spatial/strata-dungeons.ts` | 224 | Undercroft sewers and Spire catwalks layout generation |
| `src/sim/data/item-catalog.ts` | 156 | `ITEM_CATALOG`, `PROSTHETIC_CATALOG`, `COMMODITY_CATALOG`, `RECIPE_CATALOG`, `getItemBlueprint`, `getRecipeBlueprint`, `createItemEntity`, `createEntityFromBlueprint` |
| `src/sim/systems/inventory-utils.ts` | 126 | `getCarryProfile`, `computeCarriedVolumeMl`, `isInstalledOnActor`, `findMergeableStack`, `allocateSplitId`, `createInventoryFailureResult`, `MAX_OVERLOAD_RATIO` |
| `src/sim/systems/inventory.system.ts` | 243 | `resolvePickupItem`, `resolveDropItem`, `resolveUseItem` |
| `src/sim/systems/item-spawner.ts` | 71 | `spawnDistrictItems` — deterministic seeded ground-item scatterer |
| `src/sim/systems/crafting.system.ts` | 126 | `resolveCraftRecipe`, `resolveSalvageItem`, `resolveRepairLimb` |
| `src/sim/systems/combat.system.ts` | 199 | `computeEffectiveCombatStats`, `resolveAttackActor` |
| `src/sim/systems/ai.system.ts` | 211 | `createDefaultNpcAnatomy`, `spawnDistrictNpcs`, `advanceNpcTurns` |
| `src/sim/systems/movement.system.ts` | 202 | `computeMovementMechanics`, `resolveMoveStep`, `resolveUsePortal` |
| `src/sim/systems/transit.system.ts` | 238 | `resolveToggleDoor`, `resolveTravelDistrict`, `VALID_DISTRICT_IDS` |
| `src/sim/systems/trade.system.ts` | 9 | `resolveBuyFromMerchant`, `resolveSellToMerchant`, `resolveStockPedestal` |
| `src/sim/systems/anatomy.system.ts` | 78 | `resolveDamageLimb`, `computeProstheticFovBonus` |
| `src/sim/systems/prosthetics.system.ts` | 249 | `resolveActivateProsthetic`, `resolveHarvestCorpse`, `resolveInstallProsthetic`, `resolveRemoveProsthetic`, `resolveRefillSteam` |
| `src/sim/systems/metabolism.system.ts` | 231 | `advanceMetabolismTick`, `resolveDrinkTonic`, `applyToxicityEffects`, `processAddictionWithdrawal` |
| `src/sim/systems/momentum.system.ts` | 163 | `resolveSetPosture`, `applyMomentumVector`, `computeKnockbackCollisions` |
| `src/sim/systems/weapon-mods.system.ts` | 226 | `resolveInstallWeaponMod`, `resolveUninstallWeaponMod`, `resolveLoadAmmo` |
| `src/sim/systems/liquids.system.ts` | 99 | Surface fluid pools, slip hazards, stain mechanics, flammable ignition |
| `src/sim/systems/squad-witness.system.ts` | 177 | `resolveSquadCallout`, `evaluateWitnessCrimes`, `recordFactionGrudge` |
| `src/sim/systems/monorail.system.ts` | 211 | `resolveRideMonorail`, `resolveMonorailTransit`, pneumatic car movement |
| `src/sim/systems/thermo.system.ts` | 177 | `advanceThermodynamicsTick`, `SCALD_PRESSURE_THRESHOLD_KPA` |
| `src/sim/systems/pressure.system.ts` | 161 | `resolvePressurizeVessel`, `resolveEmitSpark`, `COAL_DUST_IGNITION_THRESHOLD` |
| `src/sim/systems/economy.system.ts` | 197 | `createInitialEconomyLedger`, `computeBoundedPricePence`, `resolveTriggerSupplyShock`, `advanceDistrictEconomyMacroTick` |

### C. Presentation & UI Shell (`src/client/`)
| File | Exports & Responsibility |
| :--- | :--- |
| `src/client/projection/frame-adapter.ts` | `projectWorldToVisualFrame(state, focusActorId, baseFovRadius)` -> `VisualGridFrame` |
| `src/client/renderer/glyph-stage.ts` | `GlyphStageRenderer` — PixiJS v8 canvas renderer with dual-color glyph pulsing and steam overlay |
| `src/client/renderer/crt-filter.ts` | `createCrtPostFilter()` — GLSL scanlines, chromatic aberration, and vignette filter |
| `src/client/ui/EventFormatter.ts` | `formatEventMessage(ev: SimEvent)` — pure chronicler formatting all 34 SimEvent variants |
| `src/client/ui/HudLayout.tsx` | Main Preact sidebar with 5-tab drawer navigation (`TELEMETRY`, `INVENTORY`, `SURGERY`, `WORKBENCH`, `EXCHANGE`) |
| `src/client/ui/InventoryPanel.tsx` | Artificer's satchel: mass/volume bars, item use/drop/socket actions, and ground item pick-up |
| `src/client/ui/CraftingPanel.tsx` | Schematics checklist, steam pressure cost check, recipe craft buttons, and item scrap salvage |
| `src/client/ui/TileInspectorPanel.tsx` | Live canvas tile hover/click inspector: terrain, steam kPa, coal dust, entities, and context actions |
| `src/client/ui/SystemMenuModal.tsx` | Victorian system overlay (`[Esc]`): Seed generation, LocalStorage save/load, and JSON save import/export |
| `src/client/ui/SatchelPanel.tsx` | Quick satchel view: carried items volume, Use, Drop, and ground Take actions |
| `src/client/ui/AnatomyDoll.tsx` | Limb HP/amputation/prosthetic paperdoll and steam/sanguine telemetry |
| `src/client/ui/MarketLedger.tsx` | Commodity ticker, faction standing table, and storefront controls |
| `src/client/main.tsx` | Client bootstrap, canvas pointer hover/click listeners, keyboard listener (wasd/arrows, portals, wait, pickup [G], drawer shortcuts [I, C, M, A, Esc]), and `window.__DEBUG_SIM__` |

---

## 4. Recipe: How to Add a New Gameplay Mechanic Safely

Follow this exact 6-step sequence whenever adding a new command or system:
1. **Schema First (`src/schemas/`)**:
   - Add any new component fields to `src/schemas/components.schema.ts`.
   - Add the new command variant to `GameCommandSchema` in `src/schemas/commands.schema.ts`.
   - Add the resulting `SimEvent` variant(s) to `SimEventSchema` in `src/schemas/events.schema.ts`.
2. **Pure System Function (`src/sim/systems/`)**:
   - Check the line count of the target `.system.ts` file (`wc -l`). **If it is over 220 lines, create a new `<domain>.system.ts` file** instead of bloating the existing file past the 300-line hard limit.
   - Implement a pure function `(state: WorldState, ...) => { state: WorldState, events: SimEvent[], apSpent: number }`.
3. **Wire into `dispatchCommand` (`src/sim/core/engine.ts`)**:
   - Add a `case` for the new `command.type` in `src/sim/core/engine.ts`.
4. **Update Event Formatter (`src/client/ui/EventFormatter.ts`)**:
   - Add a `case` for the new `SimEvent['type']` in `formatEventMessage()` (or run `npm run hermes:chronicler`) so exhaustive TypeScript checks pass.
5. **Write Deterministic Unit Test (`tests/sim/`)**:
   - Create or extend a `.test.ts` file using `createInitialWorld({ seed: <fixed_int> })` and assert both the emitted `SimEvent` and resulting `WorldState`.
6. **Run `npm run verify`**:
   - Confirm `typecheck`, `check:boundaries`, `validate:data`, and `test:sim` all exit with `0`.

---

## 5. Tooling: Autonomous Headless LLM Playtester Pipeline

Located in `tests/scripts/`, this suite exercises end-to-end emergence by driving the headless engine with local LLMs or rule-based mock agents.

| File | Lines | Responsibility |
| :--- | :---: | :--- |
| `tests/scripts/playtester-serializer.ts` | 250 | Formats relative 11x11 ASCII FOV, vitals, acoustic history, contextual menus, and parses LLM outputs into `GameCommand`. |
| `tests/scripts/playtester-scenarios.ts` | 166 | Injects isolated test setups (`explore`, `combat`, `economy`, `transit`) and scenario-specific directives. |
| `tests/scripts/playtest-report.ts` | 82 | Formats comprehensive telemetry markdown reports in `tests/artifacts/playtest-report.md`. |
| `tests/scripts/llm-playtester.ts` | 211 | Main CLI entry point. Executes turn loops against Ollama / Hermes endpoints or deterministic mock agents. |
| `tests/scripts/hermes-content-generator.ts` | 225 | Offloads bulk declarative JSON blueprint generation (materials, consumables, recipes) to local Hermes with Zod validation. |
| `tests/scripts/hermes-scout.ts` | 173 | Local codebase scout & AST impact analyzer for pre-flight checklist (`npm run hermes:scout`). |
| `tests/scripts/hermes-testgen.ts` | 281 | Self-healing deterministic unit test generator with anti-tautological protection (`npm run hermes:testgen`). |
| `tests/scripts/hermes-chronicler.ts` | 191 | Exhaustive `SimEvent` chronicler synchronizing events with `EventFormatter.ts` (`npm run hermes:chronicler`). |
| `tests/scripts/hermes-split.ts` | 272 | AST-guided modularity ceiling splitter for near-cap files >= 240 lines (`npm run hermes:split`). |
| `tests/scripts/hermes-critic.ts` | 239 | Whole-game emergence & architectural audit engine generating P1/P2/P3 prescriptions and handoff prompts (`npm run hermes:critic`). |
| `tests/scripts/update-state.ts` | 78 | State synchronizer embedding recent commits, next roadmap priority, critic prescriptions, and prompt handoff into `STATE.md` (`npm run sync:state`). |
| `tests/sim/playtester-harness.test.ts` | — | Unit tests verifying that action payloads serialize and resolve into valid simulation commands. |
| `tests/sim/hermes-content.test.ts` | — | Unit tests verifying CLI parsing, mock content generation, and blueprint schema validation. |
