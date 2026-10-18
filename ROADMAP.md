# ROADMAP.md — Phased AI Feature Handoff Plan (Aether & Soot)

> **HOW TO USE THIS ROADMAP**:
> - **Phases 1–6 (Completed)**: Established the deterministic headless core (`src/sim/`), 3-strata verticality, anatomy/prosthetics, thermodynamics, macro-economy, and the PixiJS/Preact presentation shell.
> - **Phases 7–12 (Completed — Issues #12–#17)**: Built world items & encumbrance, multi-building districts & inter-district transit, steam-powered crafting & salvage, autonomous NPC AI & targeted limb combat, physical merchant trading, and the initial UI inspector/system menu.
> - **Phases 13–17 (Completed — Issues #18–#22)**: Delivered the *Caves of Qud* full-window modal UI shell (`[I]` Satchel, `[A]` Vitruvian Anatomy & Grafts, `[C]` Artificer Schematic Bench, `[M]` Dual-Column Exchange & Factions, `[W]` Multi-Stratum World Atlas) and keyboard `[L]` Look/Target cursor mode.
> - **Phases 18–24 (Completed — Issues #23–#29)**: Expanded the world into large scrolling districts (`48x36`), procedural building archetypes with smashable windows and readable schematic manuals, interactive NPC dialogue & procedural faction contracts, CDDA-style Character Creation, wielded weapons & wearable pocketed armor, interactive containers (`LOCKER`, `CRATE`, `BOOKSHELF`) with tangible currency pouches (`Crown Pence Pouch`), and grounded trade with live Chirurgeon/Fixer spawns and dialogue-to-market wiring.
> - **Phases 25–28 (Active — Issues #30–#33 — Deep Interconnected World & Systems Cohesion)**: Connects every standalone mechanic into an interlocking Victorian survival simulation: fuel-driven boiler stoking & tactical pyrotechnics, a 5-district procedural Overworld City Grid, full `48x36` Undercroft sewer dungeons & Spire catwalk networks, and unified mortality across all damage sources with a Victorian Morgue screen and expanded cybernetics.
>
> Every phase is engineered to be **handed off to an independent AI agent** without violating the **300-line file ceiling** (`AGENTS.md` Rule 2.2) or breaking `npm run verify`.

---

## 1. Active Implementation Plan: Phases 25–28 (World Scale & Systems Cohesion)


### Phase 25: Fuel-Driven Boiler Stoking, Pyrotechnics & Gas Hazards (Issue #30)
- **Goal**: Connect the internal boiler (`steamReserveKpa`), fuel commodities (`Anthracite Coal`, `Steam Canisters`), Foundry Boilers (`pressureVessel`), and explosive pyrotechnics (`PRESSURIZE_VESSEL`, `EMIT_SPARK`) into a cohesive resource and tactical hazard loop.
- **Architectural Constraint**: `src/sim/systems/anatomy.system.ts` is near the 300-line ceiling (293 lines). Extract boiler/steam refill and venting into `src/sim/systems/boiler-stoking.system.ts` so both files stay **<= 250 lines**.
- **Files to Create / Modify**:
  - **Create** `src/sim/systems/boiler-stoking.system.ts` & update `src/sim/systems/anatomy.system.ts` and `src/sim/core/engine.ts`:
    - Update `resolveRefillSteam`: stoke `+50 kPa` for free if adjacent (`<= 1` tile) to an unruptured `pressureVessel` (*Foundry Boiler*), OR consume 1x fuel item (`item_steam_canister`, `commodity_anthracite_briquette`, or `item_anthracite_coal`) from `actor.inventory`.
    - Update `VENT_STEAM` so venting deducts `pressureReleasedKpa` from `actor.anatomy.steamReserveKpa` (requiring available steam), adds `steamPressureKpa` to the tile, and dumps `10%` `coreHeatPct`.
  - **Modify** `src/client/ui/LookCursorOverlay.tsx` & `src/client/ui/TileInspectorPanel.tsx`:
    - Add `[Stoke from Boiler (+50 kPa)]` (`REFILL_STEAM`) and `[Sabotage Valve (+120 kPa)]` (`PRESSURIZE_VESSEL`) when inspecting an adjacent unruptured `pressureVessel`.
    - Add `[Strike Flint Spark]` (`EMIT_SPARK`) when inspecting an adjacent or current tile with `coalDustDensity >= 40`.
  - **Create** `tests/sim/boiler-pyrotechnics.test.ts`: Deterministic tests for boiler/fuel-backed stoking, `VENT_STEAM` reserve deduction + cooling, and `PRESSURIZE_VESSEL` / `EMIT_SPARK` pyrotechnics.
- **Copy-Paste Prompt for AI Agent**:
  > Read `AGENTS.md`, `ARCHITECTURE.md`, and `ROADMAP.md` (Phase 25). Output the 5-point Pre-Flight Impact Analysis Checklist, then implement **Phase 25: Fuel-Driven Boiler Stoking, Pyrotechnics & Gas Hazards (Issue #30)** by creating `src/sim/systems/boiler-stoking.system.ts` and `tests/sim/boiler-pyrotechnics.test.ts`. Keep all files <= 250 lines and run `npm run verify` until all 4 checks pass with 0 errors.

---

### Phase 26: Procedural Overworld City Grid & Distinct District Biomes (Issue #31)
- **Goal**: Expand the playable world from 3 static districts into a connected 5-district Victorian Overworld City Grid where every visited district is populated with NPCs, loot, seed-varied building layouts, and distinct environmental biomes, and where stepping on a `DISTRICT_GATE` (`Ω`) travels across the city.
- **Architectural Constraint**: Keep every `.ts`/`.tsx` file **<= 250 lines** (hard ceiling: 300 lines).
- **Files to Create / Modify**:
  - **Create** `data/districts/whitechapel_ward.json` & `data/districts/limehouse_docks.json`:
    - Expand `VALID_DISTRICT_IDS` to 5 districts: `spitalfields_works` (Industrial), `fleet_ditch` (Canal Slums), `belgravia_spires` (High Society), `whitechapel_ward` (Quarantine Ward), and `limehouse_docks` (Steam-Docks).
  - **Modify** `src/sim/systems/transit.system.ts` & `src/sim/spatial/building-prefabs.ts`:
    - Ensure `resolveTravelDistrict` invokes `spawnDistrictItems` and `spawnDistrictNpcs` when generating an unvisited district for the first time (while preserving cached entities on revisit).
    - Wire `USE_PORTAL` when standing on a `DISTRICT_GATE` (`Ω`) entity to transition to the next connected district.
    - Apply district biome modifiers (smog/coal-dust baseline, wealth index, and seed-varied building placement).
  - **Modify** `src/client/ui/AtlasWindow.tsx`: Render the 5-district Overworld City Node Map with biome badges, visited status, and transit controls.
  - **Create** `tests/sim/overworld-biomes.test.ts`: Deterministic tests verifying NPC/item population on newly visited districts, `DISTRICT_GATE` portal transit, and 5-district validation.
- **Copy-Paste Prompt for AI Agent**:
  > Read `AGENTS.md`, `ARCHITECTURE.md`, and `ROADMAP.md` (Phase 26). Output the 5-point Pre-Flight Impact Analysis Checklist, then implement **Phase 26: Procedural Overworld City Grid & Distinct District Biomes (Issue #31)** and add deterministic tests in `tests/sim/overworld-biomes.test.ts`. Keep all files <= 250 lines and run `npm run verify` until all 4 checks pass with 0 errors.

---

### Phase 27: Undercroft Sewer Dungeons & Spire Catwalk Networks (Issue #32)
- **Goal**: Transform the vertical `UNDERCROFT` and `SPIRE` strata from tiny two-room placeholders into full `48x36` procedural multi-room sewer dungeons and rooftop catwalk networks populated with stratum-specific NPCs, hazards, and high-tier loot crates.
- **Architectural Constraint**: `src/sim/spatial/generator.ts` is 285 lines. Create `src/sim/spatial/strata-dungeons.ts` (**<= 250 lines**) and move `UNDERCROFT` / `SPIRE` layout logic into it so `generator.ts` shrinks below 250 lines.
- **Files to Create / Modify**:
  - **Create** `src/sim/spatial/strata-dungeons.ts` & update `src/sim/spatial/generator.ts` and `src/sim/core/world.ts`:
    - **`UNDERCROFT` (`48x36`)**: Carve 6–8 interconnected brick sewer chambers and smuggling vaults connected by sluice corridors, with coal-dust pockets, steam vents, `Heavy Brass Gear Crates`, Syndicate `FIXER` / smugglers, and feral sewer hostiles.
    - **`SPIRE` (`48x36`)**: Carve 5–7 elevated brass tower platforms connected by narrow sky-bridges/catwalks, with pressure vessels, `Constabulary Armoury Lockers`, `Public House Library Shelves`, Clockwork Guild artificers, and sentry guards.
    - Verify `hasWalkablePath` connectivity between entry portals (`MANHOLE` at `(4, 4)` and `PNEUMATIC_LIFT` at `(15, 10)`) and all carved chambers.
  - **Create** `tests/sim/strata-dungeons.test.ts`: Deterministic tests verifying `>= 250` walkable tiles, multi-room connectivity, and stratum-specific NPC/container spawns in both `UNDERCROFT` and `SPIRE`.
- **Copy-Paste Prompt for AI Agent**:
  > Read `AGENTS.md`, `ARCHITECTURE.md`, and `ROADMAP.md` (Phase 27). Output the 5-point Pre-Flight Impact Analysis Checklist, then implement **Phase 27: Undercroft Sewer Dungeons & Spire Catwalk Networks (Issue #32)** by creating `src/sim/spatial/strata-dungeons.ts` and `tests/sim/strata-dungeons.test.ts`. Keep all files <= 250 lines and run `npm run verify` until all 4 checks pass with 0 errors.

---

### Phase 28: Unified Mortality, Equipped-Gear Drop/Salvage Fix, Morgue Screen & Cybernetics (Issue #33)
- **Goal**: Unify actor mortality across all damage sources (melee, ranged ballistics, steam scalds, and boiler explosions), fix equipped-item drop/salvage stat leaks, add a Victorian Morgue / Obituary screen when the player dies, and expand the prosthetic cybernetics catalog with surgical context bonuses.
- **Architectural Constraint**: Create `src/sim/systems/mortality.system.ts` and `src/client/ui/MorgueModal.tsx` (all files **<= 250 lines**).
- **Files to Create / Modify**:
  - **Create** `src/sim/systems/mortality.system.ts` & wire into `combat.system.ts`, `ballistics.system.ts`, `thermo.system.ts`, and `pressure.system.ts`:
    - Implement `resolveActorDefeatIfFatal(state, targetId, attackerId?)`: when `TORSO.hp <= 0 || HEAD.hp <= 0 || bloodVolumePct <= 0`, emit `ACTOR_DEFEATED`, drop NPC inventory + loot + Crown Pence pouch, and remove defeated NPCs while preserving `actor_player` in `state.entities` so the Morgue screen can inspect the player's final state.
  - **Modify** `src/sim/systems/inventory.system.ts` & `src/sim/systems/crafting.system.ts`:
    - When `resolveDropItem` or `resolveSalvageItem` is called on an `itemEntityId` currently equipped in `actor.inventory.equippedSlots`, automatically unequip it first via `resolveUnequipItem` (removing its slot entry and subtracting its `storageVolumeBonusMl`, `meleeDamageBonus`, and `armorBonus`) so actors never retain ghost stat bonuses.
  - **Modify** `data/items/prosthetics.json`, `data/items/recipes.json`, & `src/sim/systems/anatomy.system.ts`:
    - Add `prosthetic_pneumatic_piledriver_arm`, `prosthetic_boiler_core_furnace`, and `prosthetic_clockwork_gyrostabilizer_leg` plus crafting recipes.
    - Standing adjacent to a `SURGICAL_TABLE` (or having the `DISGRACED_CHIRURGEON` profession) prevents blood-loss shock during `INSTALL_PROSTHETIC` / `REMOVE_PROSTHETIC`.
  - **Create** `src/client/ui/MorgueModal.tsx` & wire into `src/client/ui/HudLayout.tsx`:
    - Display a Victorian Coroner's Inquest / Obituary when `actor_player` is defeated, with a `[New Character / Re-Embark (N)]` button.
  - **Create** `tests/sim/mortality-cybernetics.test.ts`: Deterministic tests for lethal ranged/explosion kills dropping loot and completing contracts, equipped-item drop/salvage stat reversal, player defeat preservation, and new prosthetic crafting/installation.
- **Copy-Paste Prompt for AI Agent**:
  > Read `AGENTS.md`, `ARCHITECTURE.md`, and `ROADMAP.md` (Phase 28). Output the 5-point Pre-Flight Impact Analysis Checklist, then implement **Phase 28: Unified Mortality, Equipped-Gear Drop/Salvage Fix, Morgue Screen & Cybernetics (Issue #33)** by creating `src/sim/systems/mortality.system.ts`, `src/client/ui/MorgueModal.tsx`, and `tests/sim/mortality-cybernetics.test.ts`. Keep all files <= 250 lines and run `npm run verify` until all 4 checks pass with 0 errors.

---

## 2. Archive: Completed Phases (Phases 7–24)
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
