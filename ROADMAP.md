# ROADMAP.md — Phased AI Feature Handoff Plan (Aether & Soot)

> **HOW TO USE THIS ROADMAP**:
> - **Phases 1–6 (Completed)**: Established the deterministic headless core (`src/sim/`), 3-strata verticality, anatomy/prosthetics, thermodynamics, macro-economy, and the PixiJS/Preact presentation shell.
> - **Phases 7–12 (Completed — Issues #12–#17)**: Built world items & encumbrance, multi-building districts & inter-district transit, steam-powered crafting & salvage, autonomous NPC AI & targeted limb combat, physical merchant trading, and the initial UI inspector/system menu.
> - **Phases 13–17 (Completed — Issues #18–#22)**: Delivered the *Caves of Qud* full-window modal UI shell (`[I]` Satchel, `[A]` Vitruvian Anatomy & Grafts, `[C]` Artificer Schematic Bench, `[M]` Dual-Column Exchange & Factions, `[W]` Multi-Stratum World Atlas) and keyboard `[L]` Look/Target cursor mode.
> - **Phases 18–24 (Completed — Issues #23–#29)**: Expanded the world into large scrolling districts (`48x36`), procedural building archetypes with smashable windows and readable schematic manuals, interactive NPC dialogue & procedural faction contracts, CDDA-style Character Creation, wielded weapons & wearable pocketed armor, interactive containers (`LOCKER`, `CRATE`, `BOOKSHELF`) with tangible currency pouches (`Crown Pence Pouch`), and grounded trade with live Chirurgeon/Fixer spawns and dialogue-to-market wiring.
> - **Phases 25–28 (Completed — Issues #30–#33)**: Connected fuel-driven boiler stoking & pyrotechnics, a 5-district procedural Overworld City Grid, full `48x36` Undercroft sewer dungeons & Spire catwalk networks, and unified mortality across all damage sources with a Victorian Morgue screen and expanded cybernetics.
> - **Phases 29–31 (Active — Issues #34–#36 — Emergent Systemic Sandbox Epics)**: Elevates *Aether & Soot* to true *CDDA* / *Caves of Qud* emergent systemic depth through acoustic propagation & smog stealth, diurnal shift clocks & background district catch-up, and structural wall breaching, multi-strata gravity falls & clockwork traps.
>
> Every phase is engineered to be **handed off to an independent AI agent** without violating the **300-line file ceiling** (`AGENTS.md` Rule 2.2) or breaking `npm run verify`.

---

## 1. Active Implementation Plan: Phases 29–31 (Emergent Systemic Sandbox Epics)

### Phase 29: Acoustic Propagation, Smog Occlusion Stealth & Sensory AI (Issue #34)
- **Goal**: Replace binary omniscient NPC awareness with **CDDA-style Acoustic Decibel Propagation** and **Dynamic Particulate Sight Attenuation** so steam clouds, coal dust, prosthetic noise tradeoffs, ocular blindness, and acoustic decoys create emergent stealth and heist gameplay.
- **Architectural Constraint**: Keep every `.ts`/`.tsx` file **<= 250 lines** (hard ceiling: 300 lines). Extract sensory and acoustic rules into `src/sim/systems/stealth-acoustics.system.ts`.
- **Files to Create / Modify**:
  - **Modify** `src/schemas/components.schema.ts`, `src/schemas/domain-events.schema.ts`, & `src/schemas/events.schema.ts`:
    - Add `alertState: z.enum(['IDLE', 'INVESTIGATING', 'COMBAT']).default('IDLE')` and `lastKnownTargetPos: Point3DSchema.optional()` to `AiControllerComponentSchema`.
    - Add `noiseDb: z.number().int().nonnegative().default(0)` to `ProstheticSpecComponentSchema` (e.g. loud pneumatic limbs vs silent clockwork limbs).
    - Add `SOUND_EMITTED` event (`origin: Point3DSchema`, `decibels: z.number().int().nonnegative()`, `sourceActorId: EntityIdSchema.optional()`).
  - **Modify** `src/sim/spatial/fov.ts`:
    - Treat tiles with `steamPressureKpa >= 20` or `coalDustDensity >= 0.3` as opaque sight blockers (`isOpaque`).
    - Clamp actor FOV radius to `1` if `OCULAR_MOUNT` has `amputated: true` without an installed optic prosthetic.
  - **Create** `src/sim/systems/stealth-acoustics.system.ts` (**<= 200 lines**):
    - Implement `computeActorStepNoiseDb(state, actorId)`, `emitAcousticPulse(state, origin, decibels, turn, sourceActorId?)` (alerting NPCs within hearing range to set `alertState: 'INVESTIGATING'` and `lastKnownTargetPos: origin`), and `canActorSpotTarget(state, observerId, targetId)`.
  - **Modify** `src/sim/systems/ai.system.ts`, `src/sim/systems/movement.system.ts`, & `src/sim/systems/pressure.system.ts`:
    - Emit sound pulses on noisy movement, window smashing (`85 dB`), ranged gunfire (`95 dB`), and boiler ruptures (`120 dB`).
    - Update `ai.system.ts` so NPCs only engage in `COMBAT` when `canActorSpotTarget` is true, and otherwise pathfind toward `lastKnownTargetPos` while `INVESTIGATING`.
  - **Create** `tests/sim/stealth-acoustics.test.ts`: Deterministic tests verifying: (a) venting steam breaks NPC line-of-sight, (b) amputating an NPC's `OCULAR_MOUNT` blinds them to radius 1, and (c) smashing a window or walking with noisy pneumatic prosthetics lures an out-of-sight guard to `lastKnownTargetPos`.
- **Copy-Paste Prompt for AI Agent**:
  > Read `AGENTS.md`, `ARCHITECTURE.md`, and `ROADMAP.md` (Phase 29). Output the 5-point Pre-Flight Impact Analysis Checklist, then implement **Phase 29: Acoustic Propagation, Smog Occlusion Stealth & Sensory AI (Issue #34)** by creating `src/sim/systems/stealth-acoustics.system.ts` and `tests/sim/stealth-acoustics.test.ts`. Keep all files <= 250 lines and run `npm run verify` until all 4 checks pass with 0 errors.

---

### Phase 30: Diurnal Shift Clocks, Autonomous NPC Ecology & Background District Catch-Up (Issue #35)
- **Goal**: Bring districts to life with a **Victorian Industrial Shift Clock** (`DAWN_WHISTLE`, `FOUNDRY_SHIFT`, `GASLIGHT_CURFEW`, `GRAVEYARD_WATCH`), autonomous NPC self-preservation and storefront restocking, and a **Deterministic Delta Catch-Up Solver** when returning to cached districts in `state.savedDistricts`.
- **Architectural Constraint**: Keep every `.ts`/`.tsx` file **<= 250 lines**. Create `src/sim/systems/npc-ecology.system.ts` and `src/sim/systems/district-catchup.system.ts` so `ai.system.ts` and `transit.system.ts` stay well below 250 lines.
- **Files to Create / Modify**:
  - **Modify** `src/schemas/components.schema.ts` & `src/sim/core/world.ts`:
    - Define `NpcScheduleComponentSchema` (`workAnchor: Point3DSchema`, `restAnchor: Point3DSchema`, `currentGoal: z.enum(['WORK', 'REST', 'PATROL', 'SEEK_MEDICAL']).default('WORK')`) and attach `schedule: NpcScheduleComponentSchema.optional()` to `EntityComponentsSchema`.
    - Add `lastSimulatedTurn: z.number().int().nonnegative().default(0)` to `DistrictStateSnapshotSchema` and export `getShiftPhase(turnCount: number): 'DAWN_WHISTLE' | 'FOUNDRY_SHIFT' | 'GASLIGHT_CURFEW' | 'GRAVEYARD_WATCH'`.
  - **Create** `src/sim/systems/npc-ecology.system.ts` (**<= 200 lines**):
    - Wounded NPCs (`bloodVolumePct <= 60`) automatically consume carried `RESTORE_BLOOD` tonics; if `bloodVolumePct <= 50` with no tonic, set `currentGoal: 'SEEK_MEDICAL'` and path toward the nearest `CHIRURGEON` or `SURGICAL_TABLE`.
    - During `GRAVEYARD_WATCH` (turns 75–99 of each 100-turn cycle), non-guard scheduled NPCs path toward `restAnchor`; during `FOUNDRY_SHIFT`, they path toward `workAnchor` and merchants restock adjacent empty `tradePedestal` entities from their inventory.
  - **Create** `src/sim/systems/district-catchup.system.ts` (**<= 150 lines**) & wire into `src/sim/systems/transit.system.ts`:
    - When `resolveTravelDistrict` rehydrates a snapshot from `state.savedDistricts`, compute `elapsedTurns = state.turnCount - snapshot.lastSimulatedTurn`, decay residual steam/coal-dust proportional to `elapsedTurns`, and snap scheduled NPCs to their active shift anchor (`workAnchor` vs `restAnchor`).
  - **Create** `tests/sim/npc-ecology-catchup.test.ts`: Deterministic tests verifying wounded NPC self-medication, diurnal shift transitions, merchant pedestal restocking, and elapsed-turn district catch-up on transit.
- **Copy-Paste Prompt for AI Agent**:
  > Read `AGENTS.md`, `ARCHITECTURE.md`, and `ROADMAP.md` (Phase 30). Output the 5-point Pre-Flight Impact Analysis Checklist, then implement **Phase 30: Diurnal Shift Clocks, Autonomous NPC Ecology & Background District Catch-Up (Issue #35)** by creating `src/sim/systems/npc-ecology.system.ts`, `src/sim/systems/district-catchup.system.ts`, and `tests/sim/npc-ecology-catchup.test.ts`. Keep all files <= 250 lines and run `npm run verify` until all 4 checks pass with 0 errors.

---

### Phase 31: Structural Wall Breaching, Multi-Strata Gravity Falls & Clockwork Traps (Issue #36)
- **Goal**: Turn district architecture and vertical strata into an interactive physics sandbox with destructible `SOOT_BRICK_WALL` -> `RUBBLE_PILE` breaching, pneumatic knockback across `SPIRE` `ABYSS_DROP` chasms (triggering multi-strata gravity falls with leg trauma and pneumatic shock absorption), and deployable clockwork traps (`SPARK_TRIPWIRE`, `STEAM_MINE`, `SPRING_JAW`).
- **Architectural Constraint**: Keep every `.ts`/`.tsx` file **<= 250 lines**. Create `src/sim/systems/physics-traps.system.ts`.
- **Files to Create / Modify**:
  - **Modify** `src/schemas/primitives.schema.ts`, `src/schemas/components.schema.ts`, `src/schemas/commands.schema.ts`, & `src/schemas/domain-events.schema.ts`:
    - Add `'RUBBLE_PILE'` to `TerrainTypeSchema`.
    - Add `TrapComponentSchema` (`trapKind: z.enum(['SPARK_TRIPWIRE', 'STEAM_MINE', 'SPRING_JAW'])`, `armed: z.boolean().default(true)`, `damageMagnitude: z.number().int().nonnegative().default(20)`) and attach `trap: TrapComponentSchema.optional()` to `EntityComponentsSchema`.
    - Add `WALL_BREACHED`, `ACTOR_FELL_STRATUM`, and `TRAP_TRIGGERED` events.
  - **Create** `src/sim/systems/physics-traps.system.ts` (**<= 220 lines**):
    - `resolveBreachTile(state, targetPoint, turn)`: Converts `SOOT_BRICK_WALL` into walkable `RUBBLE_PILE`, allowing gas and actors to pass through (triggered by boiler ruptures in `pressure.system.ts` or heavy piledriver strikes).
    - `resolveKnockbackAndGravityFall(state, actorId, dx, dy, turn)`: Pushes actor 1 tile; if pushed onto `ABYSS_DROP` in `SPIRE`, drops the actor to `STREET` at `(x, y)`, dealing 20 HP damage to `LEFT_LEG` and `RIGHT_LEG` (reduced by 50% if a pneumatic leg prosthetic is installed with `steamReserveKpa >= 15`).
    - `resolveStepOnTraps(state, actorId, point, turn)`: Triggers armed `trap` entities when an actor steps onto `point` (`SPARK_TRIPWIRE` invokes `resolveEmitSpark` to ignite coal dust; `SPRING_JAW` damages a leg limb).
  - **Modify** `data/items/materials.json`, `data/items/recipes.json`, & `src/client/projection/frame-adapter.ts`:
    - Add craftable `item_clockwork_spark_trap` and render `RUBBLE_PILE` as `,` (`#7F8C8D`).
  - **Create** `tests/sim/physics-traps-falls.test.ts`: Deterministic tests verifying wall breaching + steam flooding, Spire-to-Street gravity fall + pneumatic leg mitigation, and spark tripwire coal-dust ignition.
- **Copy-Paste Prompt for AI Agent**:
  > Read `AGENTS.md`, `ARCHITECTURE.md`, and `ROADMAP.md` (Phase 31). Output the 5-point Pre-Flight Impact Analysis Checklist, then implement **Phase 31: Structural Wall Breaching, Multi-Strata Gravity Falls & Clockwork Traps (Issue #36)** by creating `src/sim/systems/physics-traps.system.ts` and `tests/sim/physics-traps-falls.test.ts`. Keep all files <= 250 lines and run `npm run verify` until all 4 checks pass with 0 errors.

---

## 2. Archive: Completed Phases (Phases 7–28)
- **Phase 7 (Issue #12 — Completed)**: World Items, Ground Spawning & True Inventory Management (`src/sim/systems/inventory.system.ts`, `src/sim/systems/item-spawner.ts`).
- **Phase 8 (Issue #13 — Completed)**: Multi-Building District ProcGen, Doors & Inter-District Transit (`src/sim/spatial/district-layout.ts`, `src/sim/systems/transit.system.ts`).
- **Phase 9 (Issue #14 — Completed)**: Artificer Crafting, Salvage & Steam Workbenches (`src/sim/systems/crafting.system.ts`, `data/items/recipes.json`).
- **Phase 10 (Issue #15 — Completed)**: Autonomous NPCs, Enemies, Faction AI & Targeted Limb Combat (`src/sim/systems/combat.system.ts`, `src/sim/systems/ai.system.ts`).
- **Phase 11 (Issue #16 — Completed)**: Physical Storefront Inventories & Merchant Trading (`src/sim/systems/trade.system.ts`).
- **Phase 12 (Issue #17 — Completed)**: Initial Multi-Screen UI Panels, System Menu Modal & Canvas Tile Inspector (`src/client/ui/*.tsx`).
- **Phase 13 (Issue #18 — Completed)**: *Caves of Qud* Modal Window Shell & Always-On Tactical Sidebar (`src/client/ui/CharacterModalShell.tsx`, `src/client/ui/QuickActionBar.tsx`).
- **Phase 14 (Issue #19 — Completed)**: Two-Column Satchel Window (`[I]`), `[a–z]` Hotkeys & Item Dossier (`src/client/ui/InventoryWindow.tsx`, `src/client/ui/ItemDossierCard.tsx`).
- **Phase 15 (Issue #20 — Completed)**: Vitruvian Clockwork Paperdoll (`[A]`) & Schematic Workbench Window (`[C]`) (`src/client/ui/AnatomyWindow.tsx`, `src/client/ui/CraftingWindow.tsx`).
- **Phase 16 (Issue #21 — Completed)**: Dual-Column Merchant Trade Window & Cartel Economy Ledger (`[M]`) (`src/client/ui/TradeWindow.tsx`, `src/client/ui/CartelLedgerView.tsx`).
- **Phase 17 (Issue #22 — Completed)**: Multi-Stratum World Atlas (`[W]`) & Keyboard `[L]` Look / Target Mode (`src/client/ui/AtlasWindow.tsx`, `src/client/ui/LookCursorOverlay.tsx`).
- **Phase 18 (Issue #23 — Completed)**: Large Scrolling Districts (`48x36`), Camera Viewport, Persistent Fog-of-War & District State Cache (`src/client/projection/frame-adapter.ts`, `src/sim/systems/transit.system.ts`).
- **Phase 19 (Issue #24 — Completed)**: Procedural Building Archetypes, Glass Windows, Interactive Furniture & Schematic Manuals (`src/sim/spatial/building-prefabs.ts`, `src/sim/systems/furniture.system.ts`).
- **Phase 20 (Issue #25 — Completed)**: Interactive NPC Dialogue, Procedural Faction Contracts, Chirurgeon Services & Companions (`src/sim/systems/dialogue-quest.system.ts`, `src/client/ui/DialogueModal.tsx`).
- **Phase 21 (Issue #26 — Completed)**: CDDA-Style Character Creation Modal — Professions, Traits & Starting Scenarios (`src/sim/systems/character-archetypes.ts`, `src/client/ui/CharacterCreatorModal.tsx`).
- **Phase 22 (Issue #27 — Completed)**: Wielded Weapons, Wearable Armor/Pocket Gear & Ranged Pneumatic Ballistics (`src/sim/systems/equipment.system.ts`, `src/sim/systems/ballistics.system.ts`).
- **Phase 23 (Issue #28 — Completed)**: Interactive Containers (`LOCKER`, `CRATE`, `BOOKSHELF`) & Tangible Currency / Loot Tables (`src/sim/systems/container.system.ts`, `data/items/materials.json`, `tests/sim/containers-currency.test.ts`).
- **Phase 24 (Issue #29 — Completed)**: Grounded Trade, Live Chirurgeon/Fixer/Contract Spawns & Dialogue-to-Market Wiring (`src/sim/systems/district-spawner.ts`, `src/sim/systems/trade-pedestal.ts`, `tests/sim/grounded-economy.test.ts`).
- **Phase 25 (Issue #30 — Completed)**: Fuel-Driven Boiler Stoking, Pyrotechnics & Gas Hazards (`src/sim/systems/boiler-stoking.system.ts`, `tests/sim/boiler-pyrotechnics.test.ts`).
- **Phase 26 (Issue #31 — Completed)**: Procedural Overworld City Grid & Distinct District Biomes (`data/districts/whitechapel_ward.json`, `data/districts/limehouse_docks.json`, `tests/sim/overworld-biomes.test.ts`).
- **Phase 27 (Issue #32 — Completed)**: Undercroft Sewer Dungeons & Spire Catwalk Networks (`src/sim/spatial/strata-dungeons.ts`, `tests/sim/strata-dungeons.test.ts`).
- **Phase 28 (Issue #33 — Completed)**: Unified Mortality, Equipped-Gear Drop/Salvage Fix, Morgue Screen & Cybernetics (`src/sim/systems/mortality.system.ts`, `src/client/ui/MorgueModal.tsx`, `tests/sim/mortality-cybernetics.test.ts`).
