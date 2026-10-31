# Architectural Modularity & State Audit: Full-Game Codebase Sweep

**Audit Date**: 2026-10-31  
**Scope**: Headless ECS Core (`src/sim/`), Schema Contracts (`src/schemas/`), and Presentation Shell (`src/client/`)  
**Auditor**: Track 1 — Architectural Modularity & State Auditor  
**Integrity Mode**: Development / Read-Only Inspection  

---

## 1. Executive Summary

A comprehensive architectural and state integrity audit was conducted across the *Aether & Soot* codebase, covering **375 TypeScript/TSX files** (38,001 lines of code). Automated verification (`npm run verify`) confirms 0 TypeScript type errors, 0 data schema validation failures, 505 passing deterministic simulation unit tests across 98 test suites, and 0 hard modularity ceiling violations (> 300 lines).

However, rigorous inspection reveals critical modularity pressure points and structural coupling bottlenecks:
1. **Modularity Ceiling Pressure**: Exactly **7 files** reside at or above the 240-line warning ceiling (highest: `src/client/bootstrap-loop.ts` at 271 lines), and an additional **12 files** reside in the 230–239 line hazard band. Any minor mechanic addition to these files will immediately breach the 300-line hard failure gate.
2. **Command Router Bottleneck**: `src/sim/core/command-router.ts` (227 lines) is a monolithic switch handling 59 commands with 47 imports across 21 domain systems. It directly hardcodes cross-domain side-effects (combining combat with turf mechanics, crafting with supply convoys, limb damage with mortality checks), creating rigid compile-time coupling and preventing true event-driven emergence.
3. **Schema Fragmentation & Naming Collisions**: Commands are fragmented across 8 files (with equipment commands defined unexpectedly in `equipment.schema.ts`). In `src/schemas/transit-events.schema.ts`, an architectural collision resulted in `TransitActionFailedEventSchema2` with type literal `'MONORAIL_ACTION_FAILED'`.
4. **Strata & Party Isolation Gaps**: In `src/sim/core/simulation-pipeline.ts`, environmental hazards only simulate on the active stratum of `actor_player`; non-active strata are completely frozen. In `src/sim/systems/transit.system.ts`, walking district travel (`resolveTravelDistrict`) strips hired companions and escort convoys from `preservedEntities`, leaving them stranded in the vacated district.
5. **Component Registry Re-export Bloat**: `src/schemas/components.schema.ts` (241 lines) imports 18 components from `src/schemas/world-components.schema.ts` and re-exports each one individually, wasting 35 lines on redundant passthrough boilerplate and forcing the file into the warning tier.

---

## 2. Codebase Architecture & Domain Boundary Mapping

The system follows a strict 3-ring concentric architecture:
- **Ring 1: Schemas & Contracts (`src/schemas/`)** — 34 files, 3,212 LOC.
- **Ring 2: Headless Simulation Core & Spatial Systems (`src/sim/`)** — 107 files, 15,482 LOC.
- **Ring 3: Presentation Shell & Client UI (`src/client/`)** — 101 files, 14,845 LOC.

```
┌────────────────────────────────────────────────────────────────────────┐
│ Ring 3: Presentation Shell (src/client/)                               │
│ - PIXI.js Glyph Stage, Preact HUD/Modals, WebAudio Procedural Synth     │
│ - Input Routers (Keyboard, Mouse, Modal Navigation)                    │
│ - Projection Adapters (projectWorldToVisualFrame, EventFormatter)     │
└─────────────────────────────────▲──────────────────────────────────────┘
                                  │ Commands Dispatched / Events Projected
                                  │ (Strict One-Way Dependency)
┌─────────────────────────────────┴──────────────────────────────────────┐
│ Ring 2: Headless Simulation Core (src/sim/)                            │
│ - Pure Domain Systems (src/sim/systems/) [41 systems]                  │
│ - Multi-Stratum Spatial & PCG (src/sim/spatial/) [26 modules]          │
│ - Core Dispatcher & Scheduler (src/sim/core/) [11 modules]             │
│ - Zero PIXI/Preact imports, Zero Math.random(), Zero Date.now()        │
└─────────────────────────────────▲──────────────────────────────────────┘
                                  │ Validates and Hydrates
                                  │ (Pure Data Definitions)
┌─────────────────────────────────┴──────────────────────────────────────┐
│ Ring 1: Contracts & Data Schemas (src/schemas/)                        │
│ - Discriminated Unions: GameCommandSchema (62), SimEventSchema (77)    │
│ - EntityComponentsSchema (28 components), WorldStateSchema (v1)        │
│ - Branded Identifiers & Declarative Blueprints (data/*.json)           │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Ring 1: Schemas & Data Contracts (`src/schemas/`)
- **Total Files**: 34
- **Primary Contracts**:
  - `primitives.schema.ts` (189 lines): Branded schemas (`EntityId`, `BlueprintId`, `StratumId`, `LimbSlotId`, `FactionId`, `CommodityId`).
  - `components.schema.ts` (241 lines): `EntityComponentsSchema` defining 28 optional component properties on `EntityRecord`.
  - `world-components.schema.ts` (188 lines): 18 spatial, world, and AI component definitions.
  - `commands.schema.ts` (230 lines): Central discriminated union `GameCommandSchema` (62 command variants).
  - `events.schema.ts` (238 lines): Central discriminated union `SimEventSchema` (77 event variants).
  - Domain sub-schemas: 8 command schema files, 15 event schema files, `blueprint.schema.ts`, `contracts.schema.ts`, `safehouse-records.schema.ts`, `skirmish-records.schema.ts`.

### 2.2 Ring 2: Simulation Core (`src/sim/core/`)
- **Total Files**: 11
- **Subsystem Breakdown**:
  - `engine.ts` (59 lines): `dispatchCommand` entry point with deterministic invariant assertion hooks.
  - `action-resolver.ts` (55 lines): Spatial action routing (`MOVE_STEP`, `USE_PORTAL`, `WAIT_TURN`) and actor validation.
  - `command-router.ts` (227 lines): Domain action router delegating 59 domain commands to pure systems.
  - `simulation-pipeline.ts` (144 lines): Three-phase simulation loop (Phase 1: Environment & NPC AI; Phase 2: Temporal & Turn Schedule; Phase 3: Perception & Exploration).
  - `scheduler.ts` (96 lines): AP deduction, speed-based initiative recovery, metabolism advancement, macro-tick (100-turn) economy trigger, and circular event log truncation (250 items).
  - `world.ts` (100 lines): `WorldStateSchema`, `serializeWorld`, and `deserializeWorld`.
  - `world-migration.ts` (114 lines): Versioned save migration pipeline (`migrateV0ToV1`).
  - `invariants.ts` (184 lines): Deterministic relational consistency assertions across entities, inventory, prosthetics, and strata bounds.
  - `rng.ts` (77 lines): 32-bit XorShift seeded pseudo-random number generator (`SeededRNG`).

### 2.3 Ring 2: Spatial, FOV & World Generation (`src/sim/spatial/`)
- **Total Files**: 26
- **Subsystem Breakdown**:
  - Multi-stratum cellular grids (`grid.ts`, `district-layout.ts`, `catacombs-generation.ts`, `spire-topology.ts`, `undercroft-topology.ts`).
  - Shadowcasting field-of-view (`fov.ts`) with ocular cybernetic modifiers.
  - Algorithmic district generation (`generator.ts`, `district-pipeline.ts`, `district-blocks.ts`, `district-scaler.ts`).
  - Architectural typologies and building prefabs (`architectural-typologies.ts`, `typologies-civic.ts`, `typologies-industrial.ts`, `building-prefabs.ts`).
  - Macro-topography and overworld matrix (`overworld-matrix.ts`, `compass-gates.ts`).
  - Infrastructure networks (`utility-networks.ts`, `portals.ts`).

### 2.4 Ring 2: Pure Domain Systems (`src/sim/systems/`)
- **Total Files**: 41
- **Subsystem Breakdown**:
  - Physical & Medical: `anatomy.system.ts`, `prosthetics.system.ts`, `surgery.system.ts`, `metabolism.system.ts`, `mortality.system.ts`.
  - Tactical Combat & Physics: `combat.system.ts`, `ballistics.system.ts`, `momentum.system.ts`, `weapon-mods.system.ts`, `physics-traps.system.ts`.
  - Thermodynamics & Hazards: `thermo.system.ts`, `boiler-stoking.system.ts`, `environmental-hazards.system.ts`, `pressure.system.ts`, `liquids.system.ts`, `gaslight.system.ts`.
  - Social & Agency: `ai.system.ts`, `dialogue-quest.system.ts`, `squad-witness.system.ts`, `district-spawner.ts`, `character-archetypes.ts`.
  - Economy, Faction & Safehouse: `economy.system.ts`, `economy-macro.system.ts`, `trade.system.ts`, `crafting.system.ts`, `container.system.ts`, `inventory.system.ts`, `safehouse.system.ts`, `skirmish-turf.system.ts`, `supply-escort.system.ts`, `politics-audit.system.ts`, `codex.system.ts`.
  - Transit & Infrastructure: `transit.system.ts`, `monorail.system.ts`, `monorail-transit.system.ts`, `district-catchup.system.ts`, `door.system.ts`, `furniture.system.ts`.

### 2.5 Ring 3: Presentation Shell (`src/client/`)
- **Total Files**: 101
- **Subsystem Breakdown**:
  - Master loop: `bootstrap-loop.ts` (271 lines) orchestrates canvas mounting, Preact UI roots, soundscape, resize events, and command dispatch.
  - Renderer: PixiJS v8 multi-layer glyph pipeline (`glyph-stage.ts`, `steampunk-pipeline.ts`, `glyph-atlas.ts`, `floating-combat-text.ts`).
  - Diegetic Canvas UI: 80x25 retro CRT terminal emulation (`diegetic-screen-composer.ts`, `naturalist-ledger-screen.ts`, `diegetic-cartography.ts`).
  - Input routers: `keyboard-router.ts` (262 lines), `modal-nav-router.ts` (247 lines), `mouse-router.ts`, `system-menu-controller.ts`.
  - Projection Adapters: `frame-adapter.ts` (`projectWorldToVisualFrame`), `biome-palette.ts`, `EventFormatter.ts` (`formatEventMessage`).

---

## 3. Modularity & 300-Line Ceiling Audit

### 3.1 Hard Modularity Ceiling (> 300 Lines)
- **Status**: **PASS (0 Violations)**
- Enforced by `tests/scripts/check-boundaries.ts` across 375 files.

### 3.2 Near-Ceiling Watchlist (>= 240 Lines)
Seven files currently exceed the 240-line warning threshold and require preemptive bisection before new mechanics can be integrated:

| Target File | Current Lines | Layer / Subsystem | Primary Responsibilities | Extraction Recommendation |
| :--- | :---: | :--- | :--- | :--- |
| `src/client/bootstrap-loop.ts` | **271** | Shell Orchestration | Canvas mount, Preact mount, Soundscape init, window resize, command routing, modal switching | Extract `client-session-state.ts` (manage active modal, hover, cursor, embark config) and `session-event-handlers.ts` (command dispatch + floating text extraction). |
| `src/client/input/keyboard-router.ts` | **262** | Input Routing | Keydown mapping for exploration, look mode, combat limbs ('1'-'6'), door toggle, posture, and modals | Extract `keyboard-combat-router.ts` (handling limb target keys '1'-'6' and look mode attacks). |
| `src/client/input/modal-nav-router.ts` | **247** | Input Routing | Key navigation and option resolution across Inventory, Anatomy, Workbench, Exchange, Atlas, Codex | Extract `modal-nav-resolver.ts` (`resolveModalRouterOptions` function, lines 41–88). |
| `tests/scripts/update-state.ts` | **245** | Tooling | AST telemetry, line counting, state schema validation, STATE.md file update | Extract `state-telemetry.ts` (git status and line count scanning). |
| `tests/scripts/hermes-critic.ts` | **243** | Tooling | Playtest telemetry analysis, Tier 1 Ollama critique prompts, markdown report generation | Extract `critic-prompt-builder.ts` (Ollama chat completion payloads). |
| `src/schemas/components.schema.ts` | **241** | Ring 1 Schema | Core entity component schemas + re-export of 18 world components from `world-components.schema.ts` | Eliminate duplicate re-export blocks (lines 171–206). Direct consumers to import world components directly from `world-components.schema.ts`. |
| `src/client/renderer/glyph-stage.ts` | **240** | Presentation | PixiJS stage setup, container hierarchy, viewport sizing, glyph sprite pools | Extract `glyph-stage-setup.ts` (container allocation and PixiJS graphics layer initialization). |

### 3.3 High-Density Watchlist (230–239 Lines)
Twelve additional files sit within 10 lines of the warning threshold:

| File | Lines | Layer | Primary Content |
| :--- | :---: | :--- | :--- |
| `src/schemas/events.schema.ts` | 238 | Schemas | Discriminated union of 77 events + duplicate re-exports |
| `src/sim/systems/furniture.system.ts` | 238 | Systems | Smash terrain, bed resting, codex manuals |
| `src/sim/systems/district-spawner.ts` | 237 | Systems | Procedural NPC generation, faction equipment, contracts |
| `src/sim/systems/safehouse.system.ts` | 235 | Systems | Workshop deeds, structure construction, safehouse inventory |
| `src/schemas/domain-commands.schema.ts` | 234 | Schemas | 31 domain command definitions |
| `src/client/audio/procedural-synth.ts` | 233 | Shell | Web Audio polyphonic synthesizer, sound presets |
| `src/schemas/core-events.schema.ts` | 233 | Schemas | Core movement, portal, and boiler event schemas |
| `src/sim/systems/environmental-hazards.system.ts` | 232 | Systems | Whale oil cascades, soot clouds, acid drips |
| `src/sim/systems/metabolism.system.ts` | 232 | Systems | Toxicity decay, active drug effects, withdrawal |
| `src/client/ui/SystemMenuModal.tsx` | 231 | UI | Preact menu modal for settings, controls, saves |
| `src/schemas/commands.schema.ts` | 230 | Schemas | Central `GameCommandSchema` union (62 variants) |
| `src/sim/systems/surgery.system.ts` | 230 | Systems | Corpse dissection, organ harvesting, field surgery |

### 3.4 Rule 2.1 Compliance (Strict Core/Shell Separation)
Automated scanning via `tests/scripts/check-boundaries.ts` verified:
- **Zero Client Imports in Core**: 0 occurrences of `from '.*client/'`, `from 'pixi.js'`, or `from 'preact'` across `src/sim/` and `src/schemas/`.
- **Zero Browser Globals in Core**: 0 occurrences of `window` or `document` in `src/sim/` and `src/schemas/`.
- **Zero Non-Deterministic Calls in Core**: 0 occurrences of `Math.random()` or `Date.now()` across `src/sim/` and `src/schemas/`. All simulation randomness flows strictly through `SeededRNG` (hydrated in `src/sim/core/rng.ts`).

---

## 4. GameCommand & SimEvent Contract Audit

### 4.1 Command Schema & Routing Taxonomy

The system defines **62 commands** aggregated in `GameCommandSchema` (`src/schemas/commands.schema.ts`). All 62 command variants are actively routed and handled in the simulation core without dead ends or unhandled variants.

```
GameCommand (62 variants)
│
├── Spatial Actions (3 variants routed in src/sim/core/action-resolver.ts)
│   ├── MOVE_STEP
│   ├── USE_PORTAL
│   └── WAIT_TURN
│
└── Domain Actions (59 variants routed in src/sim/core/command-router.ts)
    ├── Physical / Anatomy: DAMAGE_LIMB, INSTALL_PROSTHETIC, REMOVE_PROSTHETIC, ACTIVATE_PROSTHETIC, HARVEST_CORPSE, DISSECT_CORPSE_ANATOMY, REPAIR_LIMB
    ├── Thermodynamics / Steam: VENT_STEAM, REFILL_STEAM, PRESSURIZE_VESSEL, EMIT_SPARK
    ├── Inventory / Items: PICK_UP_ITEM, DROP_ITEM, USE_ITEM, EQUIP_ITEM, UNEQUIP_ITEM, LOOT_CONTAINER, SALVAGE_ITEM, CRAFT_RECIPE
    ├── Combat / Ballistics: ATTACK_ACTOR, FIRE_RANGED_WEAPON, INSTALL_WEAPON_MOD, UNINSTALL_WEAPON_MOD, LOAD_AMMO
    ├── Economy / Trade: STOCK_PEDESTAL, BUY_FROM_MERCHANT, SELL_TO_MERCHANT, TRIGGER_SUPPLY_SHOCK
    ├── Environment / Traps: SMASH_TERRAIN, BREACH_TILE, PRY_OBSTACLE, COAT_WEAPON, THROW_FLASK, CLEAN_SPILL
    ├── Social / Dialogue: ACCEPT_CONTRACT, COMPLETE_CONTRACT, HIRE_COMPANION, PAY_CHIRURGEON_HEAL, EMIT_PROCEDURAL_BARK, EMIT_SQUAD_CALLOUT, REPORT_CRIME
    ├── Momentum: SET_POSTURE, APPLY_MOMENTUM_VECTOR
    ├── Safehouse / Codex: CLAIM_WORKSHOP_DEED, BUILD_STRUCTURE, STORE_ITEM_IN_STRUCTURE, RETRIEVE_ITEM_FROM_STRUCTURE, CONSULT_CODEX
    ├── Faction / Skirmish: INITIATE_TURF_SKIRMISH, PREPARE_SUPPLY_CONVOY, AUDIT_SAFEHOUSE_DEED, ENFORCE_TURF_AUTHORITY
    └── Transit / Portals: TOGGLE_DOOR, TRAVEL_DISTRICT, BOARD_MONORAIL, LAUNCH_MONORAIL, DESCEND_CATACOMBS, ASCEND_CATACOMBS, REST_AT_BED
```

#### Defect 4.1.1: Monolithic Switch Bottleneck in `command-router.ts`
- **Location**: `src/sim/core/command-router.ts:57-210` (227 lines).
- **Issue**: Domain dispatch is implemented as a single 154-case procedural switch statement importing 47 functions from 21 separate system files.
- **Consequence**:
  - Adding any new command risks breaching the 300-line ceiling in `command-router.ts`.
  - The switch directly hardcodes multi-system coupling:
    - Case `VENT_STEAM`: Calls `resolveVentSteam` then immediately calls `recordTacticalCoverManeuver` from `skirmish-turf.system.ts`.
    - Case `DAMAGE_LIMB`: Calls `resolveDamageLimb` then immediately calls `resolveActorDefeatIfFatal` from `mortality.system.ts`.
    - Case `CRAFT_RECIPE`: Calls `resolveCraftRecipe`, inspects events for `ITEM_CRAFTED`, then calls `processCraftSupplyConvoyPrep` from `supply-escort.system.ts`.
    - Case `DROP_ITEM`: Calls `resolveDropItem`, inspects AP, then calls `processDropItemDelivery` from `supply-escort.system.ts`.
    - Case `ATTACK_ACTOR`: Calls `resolveAttackActor`, then calls `processActorTurfCombat` from `skirmish-turf.system.ts`.
    - Case `HIRE_COMPANION`: Calls `resolveHireCompanion`, then calls `processCompanionEscortAssignment` from `supply-escort.system.ts`.
  - These side-effects belong in domain event subscribers or dedicated pipeline handlers, not in the central command switch.

#### Defect 4.1.2: Command Schema Fragmentation
Commands are distributed across 8 separate schema files without a clear organizational rule:
1. `commands.schema.ts` (11 basic commands + discriminated union)
2. `domain-commands.schema.ts` (31 commands)
3. `equipment.schema.ts` (Defines `EquipItemCommandSchema`, `UnequipItemCommandSchema`, `FireRangedWeaponCommandSchema`)
4. `lore-commands.schema.ts` (3 commands)
5. `safehouse-commands.schema.ts` (5 commands)
6. `skirmish-commands.schema.ts` (3 commands)
7. `transit-commands.schema.ts` (4 commands)
8. `witness-commands.schema.ts` (2 commands + orphan `WitnessCommandSchema`)
- **Finding**: Defining equipment commands in `equipment.schema.ts` creates non-obvious coupling where modifying commands requires inspecting equipment specs. `WitnessCommandSchema` is an orphan union never utilized in `GameCommandSchema`.

---

### 4.2 SimEvent Schema & Formatting Taxonomy

The simulation emits **77 event variants** aggregated in `SimEventSchema` (`src/schemas/events.schema.ts`).

#### Defect 4.2.1: Naming Collision Workaround (`TransitActionFailedEventSchema2`)
- **Location**: `src/schemas/transit-events.schema.ts:53-59` and `src/schemas/events.schema.ts:57, 225`.
- **Code**:
  ```typescript
  export const TransitActionFailedEventSchema2 = z.object({
    type: z.literal('MONORAIL_ACTION_FAILED'),
    turn: z.number().int().nonnegative(),
    actorId: EntityIdSchema,
    reason: z.string(),
  });
  export type MonorailActionFailedEvent = z.infer<typeof TransitActionFailedEventSchema2>;
  ```
- **Root Cause**: `TransitActionFailedEventSchema` already existed in `domain-events.schema.ts` (for district gate transit). When monorail failures were added, the developer avoided a naming collision by appending `2` to the schema constant name instead of naming it `MonorailActionFailedEventSchema`.
- **Remediation**: Rename `TransitActionFailedEventSchema2` to `MonorailActionFailedEventSchema`.

#### Defect 4.2.2: Redundant Re-export Sections in `events.schema.ts`
- **Location**: `src/schemas/events.schema.ts` (238 lines).
- **Issue**: The file imports and exports schemas in two separate blocks:
  - Lines 56–66 import and re-export `MonorailBoardedEventSchema`, `MonorailLaunchedEventSchema`, `MonorailArrivedEventSchema`, `CatacombsDepthDescendedEventSchema`, `CatacombsDepthAscendedEventSchema`, `TransitActionFailedEventSchema2`.
  - Lines 131–170 re-export an overlapping list of 47 event schemas.
  - Lines 172–236 assemble the 77-variant discriminated union.
- **Consequence**: The redundancy consumes ~40 lines, pushing `events.schema.ts` to 238 lines (2 lines below warning threshold).

#### Defect 4.2.3: Telemetry Placeholder Boilerplate in `EventFormatter.ts`
- **Location**: `src/client/ui/EventFormatter.ts:188-196`.
- **Issue**: Nine critical faction and skirmish events lack atmospheric narrative strings and emit generic developer placeholders:
  ```typescript
  case 'ACTOR_TURF_STATE_CHANGED': return `[T${ev.turn}] Victorian chronicle: Actor Turf State Changed.`;
  case 'CONVOY_DELIVERY_CONFIRMED': return `[T${ev.turn}] Victorian chronicle: Convoy Delivery Confirmed.`;
  case 'CONVOY_ESCORT_ASSIGNED': return `[T${ev.turn}] Victorian chronicle: Convoy Escort Assigned.`;
  case 'CONVOY_PREPARATION_STARTED': return `[T${ev.turn}] Victorian chronicle: Convoy Preparation Started.`;
  case 'NPC_GOAL_CHANGED': return `[T${ev.turn}] Victorian chronicle: Npc Goal Changed.`;
  case 'SAFEHOUSE_AUDIT_COMPLETED': return `[T${ev.turn}] Victorian chronicle: Safehouse Audit Completed.`;
  case 'TACTICAL_MANEUVER_RECORDED': return `[T${ev.turn}] Victorian chronicle: Tactical Maneuver Recorded.`;
  case 'TURF_CONTESTED': return `[T${ev.turn}] Victorian chronicle: Turf Contested.`;
  case 'TURF_CONTROL_CHANGED': return `[T${ev.turn}] Victorian chronicle: Turf Control Changed.`;
  ```
- **Remediation**: Run `npm run hermes:chronicler` to populate these with diegetic Victorian prose.

---

## 5. WorldState, Component Registry & Serialization Integrity

### 5.1 WorldState Schema Topology
`WorldStateSchema` (`src/sim/core/world.ts:40-64`) enforces a strictly typed, versioned root document:

```typescript
export const WorldStateSchema = z.object({
  version: z.literal(1),
  seed: z.number().int(),
  rngState: RNGStateSchema,
  turnCount: z.number().int().nonnegative(),
  macroTickCount: z.number().int().nonnegative(),
  currentDistrictId: BlueprintIdSchema,
  strata: z.record(StratumIdSchema, StratumGridSchema),
  entities: z.record(z.string(), EntityComponentsSchema),
  economy: DistrictEconomyLedgerSchema,
  contracts: z.array(FactionContractSchema).default([]),
  safehouses: z.record(z.string(), SafehouseDeedRecordSchema).default({}),
  codex: z.record(z.string(), CodexEntryRecordSchema).default({}),
  turf: z.record(z.string(), TurfSectorRecordSchema).default({}),
  convoys: z.record(z.string(), EscortConvoyRecordSchema).default({}),
  audits: z.record(z.string(), GuildAuditRecordSchema).default({}),
  eventLog: z.array(SimEventSchema),
  savedDistricts: z.record(z.string(), SavedDistrictSnapshotSchema).default({}),
  catacombDepths: z.record(z.string(), CatacombDepthSchema).default({}),
});
```

### 5.2 Component Registry & Flat Relational ECS
- **Relational Integrity**: Entities are never nested. All physical objects, NPCs, doors, landmarks, and conduits reside in `state.entities[entityId]` and reference one another through branded string IDs (`EntityId`).
- **Component Registry**: `EntityComponentsSchema` (`src/schemas/components.schema.ts:208-238`) defines 28 optional components.
- **Component Bloat**: `components.schema.ts` (241 lines) imports 18 components from `world-components.schema.ts` and exports them again, adding 35 unnecessary lines.

### 5.3 Relational Invariants Validation (`invariants.ts`)
`validateWorldInvariants(state)` enforces 7 core relational rules:
1. **Inventory Consistency**: All item IDs in `inventory.containedEntityIds` exist in `state.entities` without duplicate ownership across entities.
2. **Ground Coordinate Cleansing**: Items held in inventories must not retain a `position` component.
3. **Equipment Slot Integrity**: Equipped slots reference existing entities.
4. **Prosthetic Socket Exclusivity**: Installed prosthetics exist, possess a `prostheticSpec` component, are not socketed in multiple limbs, have no ground position, and are not in external inventories.
5. **Spatial Bounds & Terrain**: Living actors with positions are within stratum grid dimensions on non-blocking terrain.
6. **Defeated Actor Sanitization**: Dead NPCs must not retain active `actor` or `aiController` components.
7. **Orphan Entity Detection**: Item entities without ground coordinates must be accounted for in an inventory, prosthetic socket, or trade pedestal.

### 5.4 Save Serialization & Migration Pipeline
- **Round-Trip Serialization**: `serializeWorld(state)` uses standard `JSON.stringify(state)`. `deserializeWorld(json)` parses JSON and runs it through `migrateWorldState`.
- **Version Migration**: `migrateV0ToV1` (`src/sim/core/world-migration.ts:32-48`) ensures legacy unversioned saves (v0) receive version `1` and default empty collections for `contracts`, `safehouses`, `codex`, `turf`, `convoys`, and `audits`.
- **Integrity Status**: 100% compliant. Unit test `tests/sim/save-migration.test.ts` passes with 7 validation scenarios.

---

## 6. Simulation & Emergence Limitations

### 6.1 Strata Freezing in Hazard Pipeline
- **Location**: `src/sim/core/simulation-pipeline.ts:42-45`.
- **Code**:
  ```typescript
  const activeStratum = workingState.entities['actor_player' as EntityId]?.position?.stratum ?? 'STREET';
  const hazardTick = advanceEnvironmentalHazards(workingState, activeStratum);
  ```
- **Limitation**: While cellular steam diffusion (`advanceThermodynamicsTick`) correctly updates all 4 strata (`CATACOMBS`, `UNDERCROFT`, `STREET`, `SPIRE`), `advanceEnvironmentalHazards` (soot clouds, acid drips, whale oil conflagrations) is executed **only on the player's current stratum**.
- **Impact**: Fires and acid leaks started by the player in the Undercroft or Spire freeze the moment the player moves to Street, completely breaking vertical cross-strata causality.

### 6.2 Companion & Convoy Abandonment During District Transit
- **Location**: `src/sim/systems/transit.system.ts:78-89`.
- **Code**:
  ```typescript
  // Preserve player, carried inventory items, and installed prosthetics
  const preservedEntities: Record<string, EntityRecord> = { [actorId]: actor };
  for (const invId of actor.inventory?.containedEntityIds ?? []) {
    const item = state.entities[invId];
    if (item) preservedEntities[invId] = item;
  }
  for (const limb of Object.values(actor.anatomy?.limbs ?? {})) {
    if (limb.installedProstheticEntityId) {
      const p = state.entities[limb.installedProstheticEntityId];
      if (p) preservedEntities[limb.installedProstheticEntityId] = p;
    }
  }
  ```
- **Limitation**: `resolveTravelDistrict` preserves *only* `actorId`, their inventory, and their prosthetics.
- **Impact**: Any NPC hired via `HIRE_COMPANION` (`companionOfActorId: actorId`) or convoy escorted via `PREPARE_SUPPLY_CONVOY` is treated as a leaving entity and frozen inside `savedDistricts[fromDistrictId]`. In contrast, `transferMonorailDistrict` (`src/sim/systems/monorail-transit.ts:26-41`) correctly preserves all boarded passenger entities. Walking district travel breaks party coherence.

### 6.3 Hard-Wired Domain Side-Effects in `command-router.ts`
- **Limitation**: Systems do not communicate through a reactive pub/sub event pipeline. Side-effects across disparate modules are manually wired into `command-router.ts`.
- **Impact**: When an NPC or system triggers an action internally (e.g. AI firing a weapon, or terrain exploding from steam pressure), the auxiliary side effects wired into `command-router.ts` (such as `processActorTurfCombat` or `recordTacticalCoverManeuver`) are bypassed unless the action is routed through `dispatchCommand`.

---

## 7. Concrete Remediation & Refactoring Roadmap

To preserve codebase stability and prevent breaking the 300-line ceiling, the following refactoring steps should be scheduled:

### Phase R1: De-bloat `components.schema.ts` and `events.schema.ts`
1. In `src/schemas/components.schema.ts` (241 lines):
   - Remove the redundant re-export lines 171–206 (35 lines saved -> drops to ~206 lines).
   - Update imports in consumers (`src/client/`, `src/sim/`) to import world components directly from `src/schemas/world-components.schema.ts`.
2. In `src/schemas/events.schema.ts` (238 lines):
   - Consolidate redundant import and export blocks (lines 56–66 vs lines 131–170).
   - Rename `TransitActionFailedEventSchema2` to `MonorailActionFailedEventSchema` in `src/schemas/transit-events.schema.ts` and update `events.schema.ts`.

### Phase R2: Bisect High-Risk Presentation Shell Files
1. In `src/client/bootstrap-loop.ts` (271 lines):
   - Extract `src/client/client-session-state.ts` (~80 lines) to hold session state variables (`activeModal`, `mouseHoverCoord`, `isLookModeActive`, `floatingCallouts`, `modalNavState`).
   - Reduces `bootstrap-loop.ts` to ~195 lines.
2. In `src/client/input/keyboard-router.ts` (262 lines):
   - Extract `src/client/input/keyboard-combat-router.ts` (~60 lines) for limb targeting keys ('1'-'6') and look attack resolution.
   - Reduces `keyboard-router.ts` to ~205 lines.
3. In `src/client/input/modal-nav-router.ts` (247 lines):
   - Extract `src/client/input/modal-nav-resolver.ts` (~65 lines) for `resolveModalRouterOptions`.
   - Reduces `modal-nav-router.ts` to ~185 lines.

### Phase R3: Modularize `command-router.ts` into Domain Command Slices
1. In `src/sim/core/command-router.ts` (227 lines):
   - Partition into domain-specific router tables:
     - `command-router-combat.ts` (combat, ballistics, weapon mods, anatomy, surgery).
     - `command-router-economy.ts` (trade, pedestal, supply shocks, safehouse, crafting).
     - `command-router-transit.ts` (monorail, district transit, catacombs, doors).
   - Moves cross-domain side-effects (e.g. `processActorTurfCombat`, `processCraftSupplyConvoyPrep`) out of the router into pure domain post-action interceptors.

### Phase R4: Fix Strata Hazards & Companion Transit
1. In `src/sim/core/simulation-pipeline.ts`:
   - Iterate all strata present in `workingState.strata` in `advanceEnvironmentalHazards` instead of filtering solely to `activeStratum`.
2. In `src/sim/systems/transit.system.ts`:
   - In `resolveTravelDistrict`, scan `state.entities` for NPCs where `companionOfActorId === actorId` and include them, their inventory, and prosthetics into `preservedEntities`. Spawn them adjacent to `arrivalPos`.
