# ROADMAP.md — Phased AI Feature Handoff Plan (Aether & Soot)

> **HOW TO USE THIS ROADMAP**:
> - **Phases 1–6 (Completed)**: Established the deterministic headless core (`src/sim/`), 3-strata verticality, anatomy/prosthetics, thermodynamics, macro-economy, and the PixiJS/Preact presentation shell.
> - **Phases 7–12 (Completed — Issues #12–#17)**: Built world items & encumbrance, multi-building districts & inter-district transit, steam-powered crafting & salvage, autonomous NPC AI & targeted limb combat, physical merchant trading, and the initial UI inspector/system menu.
> - **Phases 13–17 (Completed — Issues #18–#22)**: Delivered the *Caves of Qud* full-window modal UI shell (`[I]` Satchel, `[A]` Vitruvian Anatomy & Grafts, `[C]` Artificer Schematic Bench, `[M]` Dual-Column Exchange & Factions, `[W]` Multi-Stratum World Atlas) and keyboard `[L]` Look/Target cursor mode.
> - **Phases 18–22 (Active — Issues #23–#27 — The *Cataclysm: Dark Days Ahead* Living Sandbox Expansion)**: Expands the world into large scrolling districts (`48x36`) with persistent Fog-of-War memory and cached district states, 5 procedural building archetypes with smashable glass windows and readable schematic manuals, interactive NPC dialogue & procedural faction contracts, a CDDA-style Character Creation screen (Professions, Traits, Scenarios), and wielded melee/ranged weapons with wearable pocketed armor.
>
> Every phase is engineered to be **handed off to an independent AI agent** without violating the **300-line file ceiling** (`AGENTS.md` Rule 2.2) or breaking `npm run verify`.

---

## 1. Active Implementation Plan: Phases 18–22 (CDDA Living Sandbox Expansion)

### Phase 18: Large Scrolling Districts (`48x36`), Camera Viewport, Persistent Fog-of-War & District State Cache (Issue #23)
- **Goal**: Expand the playable world from a tiny static `24x20` room into a **Large Scrolling District (`48x36`)** rendered through a **24x20 Camera Viewport** centered on the player (`@`), with **Persistent Fog-of-War Tile Memory** (`explored`) and **Persistent Inter-District State Caching** (`savedDistricts`) so revisiting a district preserves opened doors, dropped items, and defeated NPCs.
- **Architectural Constraint**: Keep every `.ts`/`.tsx` file **<= 250 lines** (hard ceiling: 300 lines).
- **Files to Create / Modify**:
  - **Modify** `src/sim/spatial/grid.ts` & `src/sim/core/world.ts`:
    - Add `explored: z.boolean().default(false)` to `TileCellSchema` (or `exploredTiles` in `WorldStateSchema`).
    - Add `savedDistricts` snapshot cache to `WorldStateSchema` so `resolveTravelDistrict` (`src/sim/systems/transit.system.ts`) saves the current district's strata & non-player entities before switching and restores previously visited districts instead of regenerating them from scratch.
    - Update `src/client/main.tsx` to initialize `48x36` districts (`createInitialWorld({ seed, width: 48, height: 36 })`).
  - **Modify** `src/client/projection/frame-adapter.ts` & `src/client/main.tsx`:
    - Compute `cameraOrigin: { x: number; y: number }` clamping a `24x20` viewport window centered on the player's `(x, y)` within `[0..grid.width - 24, 0..grid.height - 20]`.
    - Mark tiles in current FOV as `explored` and render previously explored out-of-FOV tiles in dimmed slate (`#1c2833` / `#34495e`) while hiding unseen mobile actors.
    - Translate mouse hover/click and `[L]` Look Cursor coordinates by `cameraOrigin`.
  - **Create** `tests/sim/scrolling-fog-persistence.test.ts`: Deterministic tests for `48x36` camera clamping, fog-of-war memory persistence, and A -> B -> A district state restoration.
- **Copy-Paste Prompt for AI Agent**:
  > Read `AGENTS.md`, `ARCHITECTURE.md`, and `ROADMAP.md` (Phase 18). Output the 5-point Pre-Flight Impact Analysis Checklist, then implement **Phase 18: Large Scrolling Districts (48x36), Camera Viewport, Persistent Fog-of-War & District State Cache (Issue #23)**. Keep all files <= 250 lines, add deterministic tests in `tests/sim/scrolling-fog-persistence.test.ts`, and run `npm run verify` until all 4 checks pass with 0 errors.

---

### Phase 19: Procedural Building Archetypes, Glass Windows, Interactive Furniture & Schematic Manuals (Issue #24)
- **Goal**: Transform district generation into a **CDDA-style Urban Sandbox** featuring **5 Distinct Procedural Building Archetypes**, smashable/transparent **Glass Windows**, **Interactive Furniture** (`BED`, `SURGICAL_TABLE`), and **Readable Schematic Manuals** that unlock advanced crafting recipes.
- **Architectural Constraint**: Do NOT bloat `src/sim/spatial/generator.ts`—create `src/sim/spatial/building-prefabs.ts` and `src/sim/systems/furniture.system.ts` (all files **<= 250 lines**).
- **Files to Create / Modify**:
  - **Modify** `src/sim/spatial/grid.ts`: Add `GLASS_WINDOW` (`blocksMovement: true`, `blocksSight: false`) and `SMASHED_WINDOW_FRAME` (`blocksMovement: false`, `blocksSight: false`) to `TerrainTypeSchema`.
  - **Create** `src/sim/spatial/building-prefabs.ts`: Procedural builders for **1. Chirurgeon's Apothecary**, **2. Clockwork Foundry**, **3. Constabulary Watchhouse**, **4. Tenement & Public House**, and **5. Aether Alchemical Lab**, with contextual furniture and themed loot tables.
  - **Create** `src/sim/systems/furniture.system.ts` & update `src/schemas/`:
    - Add `SMASH_TERRAIN` (`actorId`, `target: Point3D`) to smash adjacent `GLASS_WINDOW` into `SMASHED_WINDOW_FRAME` (`TERRAIN_SMASHED` event).
    - Add `REST_AT_BED` (`actorId`) to rest at an adjacent `BED` / `SURGICAL_TABLE` and restore limb HP & blood volume (`ACTOR_RESTED` event).
    - Add `unlocksRecipeId: BlueprintIdSchema.optional()` to `ItemBlueprintSchema` & `ItemComponentSchema` and `unlockedRecipeIds: z.array(BlueprintIdSchema)` to `AnatomyComponentSchema`, so using a Schematic Manual unlocks advanced recipes (`RECIPE_UNLOCKED` event).
  - **Create** `tests/sim/buildings-manuals.test.ts`: Deterministic tests for transparent `GLASS_WINDOW` FOV, `SMASH_TERRAIN`, reading manuals to unlock recipes, and `REST_AT_BED`.
- **Copy-Paste Prompt for AI Agent**:
  > Read `AGENTS.md`, `ARCHITECTURE.md`, and `ROADMAP.md` (Phase 19). Output the 5-point Pre-Flight Impact Analysis Checklist, then implement **Phase 19: Procedural Building Archetypes, Glass Windows, Interactive Furniture & Schematic Manuals (Issue #24)** by creating `src/sim/spatial/building-prefabs.ts`, `src/sim/systems/furniture.system.ts`, and `tests/sim/buildings-manuals.test.ts`. Keep all files <= 250 lines and run `npm run verify` until all 4 checks pass with 0 errors.

---

### Phase 20: Interactive NPC Dialogue, Procedural Faction Contracts (Quests), Chirurgeon Services & Companions (Issue #25)
- **Goal**: Bring NPCs to life with a **Dialogue & Contract System (`[T]` Talk)**. Players can converse with named NPCs, accept and turn in **Procedural Faction Contracts (Quests)** for pence and cartel reputation, pay **Street Chirurgeons** for medical restoration, and recruit **Allied Companions** who follow and fight alongside the player.
- **Architectural Constraint**: Create `src/sim/systems/dialogue-quest.system.ts` and `src/client/ui/DialogueModal.tsx` (all files **<= 250 lines**).
- **Files to Create / Modify**:
  - **Modify** `src/schemas/components.schema.ts`, `src/schemas/commands.schema.ts`, & `src/schemas/domain-events.schema.ts`:
    - Add `'CHIRURGEON'` and `'FIXER'` roles and `companionOfActorId: EntityIdSchema.optional()` to `AiControllerComponentSchema`.
    - Add `FactionContractSchema` (`id`, `issuerNpcId`, `factionId`, `title`, `description`, `kind`: `'DELIVER_ITEM' | 'SLAY_HOSTILE' | 'PRESSURIZE_BOILER'`, `targetBlueprintOrEntityId`, `rewardPence`, `rewardReputation`, `status`: `'AVAILABLE' | 'ACTIVE' | 'COMPLETED'`) to `DistrictEconomyLedgerSchema`.
    - Add commands: `ACCEPT_CONTRACT`, `COMPLETE_CONTRACT`, `HIRE_COMPANION`, `PAY_CHIRURGEON_HEAL`.
  - **Create** `src/sim/systems/dialogue-quest.system.ts` & update `src/sim/systems/ai.system.ts`:
    - Implement `resolveAcceptContract`, `resolveCompleteContract`, `resolveHireCompanion`, and `resolvePayChirurgeonHeal`.
    - Update `advanceNpcTurns` in `ai.system.ts` so companions (`companionOfActorId === playerId`) follow the player and attack adjacent hostiles.
  - **Create** `src/client/ui/DialogueModal.tsx`: Interactive conversation, contract board, Chirurgeon healing service, and companion recruitment modal triggered by `[T]` or clicking `[Talk]` on an adjacent NPC.
  - **Create** `tests/sim/dialogue-contracts.test.ts`: Deterministic tests for contract completion rewards, Chirurgeon healing, and companion AI combat assistance.
- **Copy-Paste Prompt for AI Agent**:
  > Read `AGENTS.md`, `ARCHITECTURE.md`, and `ROADMAP.md` (Phase 20). Output the 5-point Pre-Flight Impact Analysis Checklist, then implement **Phase 20: Interactive NPC Dialogue, Procedural Faction Contracts (Quests), Chirurgeon Services & Companions (Issue #25)** by creating `src/sim/systems/dialogue-quest.system.ts`, `src/client/ui/DialogueModal.tsx`, and `tests/sim/dialogue-contracts.test.ts`. Keep all files <= 250 lines and run `npm run verify` until all 4 checks pass with 0 errors.

---

### Phase 21: CDDA-Style Character Creation Modal (Professions, Traits & Starting Scenarios) (Issue #26)
- **Goal**: Replace the static starting character with a **CDDA / Caves of Qud Character Creation & Starting Scenario Builder** where players choose their **Profession**, **Build-Defining Traits**, and **Starting District Scenario**.
- **Architectural Constraint**: Create `src/sim/systems/character-archetypes.ts` and `src/client/ui/CharacterCreatorModal.tsx` (all files **<= 250 lines**).
- **Files to Create / Modify**:
  - **Create** `src/sim/systems/character-archetypes.ts`:
    - Define 4 Professions: `DISGRACED_CHIRURGEON`, `FOUNDRY_ARTIFICER`, `CLOCKWORK_VETERAN` (starts with pre-grafted `Pneumatic Strider Leg`), and `AETHER_SMUGGLER`.
    - Define 6 Traits (pick up to 2): `NIGHT_OPTICS`, `BOILER_HEART`, `PACK_MULE`, `IRON_FISTS`, `CARTEL_CONNECTIONS`, `TINKER_SAVANT`.
    - Define 3 Starting Scenarios: `SPITALFIELDS_FOUNDRY_ROW` (`STREET`), `BELGRAVIA_SKY_WALK` (`SPIRE`), `FLEET_DITCH_SUMP` (`UNDERCROFT`).
    - Implement `applyCharacterCreation(state: WorldState, config: CharacterCreationConfig): WorldState`.
  - **Create** `src/client/ui/CharacterCreatorModal.tsx` & wire into `src/client/main.tsx` (`[N] New Character` button in `QuickActionBar.tsx` and `SystemMenuModal.tsx`).
  - **Create** `tests/sim/character-creation.test.ts`: Deterministic tests verifying all 4 professions, trait stat modifiers, pre-grafted prosthetics, and starting scenarios.
- **Copy-Paste Prompt for AI Agent**:
  > Read `AGENTS.md`, `ARCHITECTURE.md`, and `ROADMAP.md` (Phase 21). Output the 5-point Pre-Flight Impact Analysis Checklist, then implement **Phase 21: CDDA-Style Character Creation Modal (Professions, Traits & Starting Scenarios) (Issue #26)** by creating `src/sim/systems/character-archetypes.ts`, `src/client/ui/CharacterCreatorModal.tsx`, and `tests/sim/character-creation.test.ts`. Keep all files <= 250 lines and run `npm run verify` until all 4 checks pass with 0 errors.

---

### Phase 22: Wielded Weapons, Wearable Armor/Pocket Gear & Ranged Pneumatic Ballistics (`[F]` Fire Mode) (Issue #27)
- **Goal**: Complete the CDDA survival-combat loop by adding **Wielded Melee & Ranged Weapons**, **Wearable Clothing & Armor Layers** (providing **Pocket Carry Capacity**, **Armor**, and **Steam Scald Resistance**), and **Ranged Pneumatic Ballistics (`[F]` Fire Mode)** across the viewport.
- **Architectural Constraint**: Create `src/sim/systems/equipment.system.ts` and `src/sim/systems/ballistics.system.ts` (all files **<= 250 lines**).
- **Files to Create / Modify**:
  - **Modify** `src/schemas/` & `data/items/materials.json`:
    - Add `EquipmentSpecSchema` (`equipSlot`: `'WIELD' | 'HEAD_WEAR' | 'TORSO_WEAR' | 'BACK_WEAR'`, `meleeDamageBonus`, `armorBonus`, `storageVolumeBonusMl`, `steamResistanceKpa`, `rangedRange`, `rangedDamage`, `rangedSteamCostKpa`) to `ItemBlueprintSchema` & `ItemComponentSchema`.
    - Add `equippedSlots` to `InventoryComponentSchema`.
    - Add 4 gear blueprints to `data/items/materials.json`: *Heavy Pipe Wrench*, *Pneumatic Harpoon Rifle*, *Asbestos Foundry Coat*, and *Artificer's Canvas Rucksack*.
  - **Create** `src/sim/systems/equipment.system.ts` & `src/sim/systems/ballistics.system.ts`:
    - Implement `EQUIP_ITEM`, `UNEQUIP_ITEM`, and `FIRE_RANGED_WEAPON` (`attackerId`, `targetId`, `targetSlot`).
    - Apply pocket storage volume (`storageVolumeBonusMl`), melee/armor bonuses, and steam scald resistance in `inventory-utils.ts`, `combat.system.ts`, and `thermo.system.ts`.
  - **Modify** `src/client/ui/InventoryWindow.tsx` & `src/client/ui/LookCursorOverlay.tsx`: Add `[E] Equip / Unequip` controls in Satchel and ranged `[F]` / `[1]`–`[6]` limb firing in Look Mode.
  - **Create** `tests/sim/equipment-ballistics.test.ts`: Deterministic tests for rucksack volume expansion, asbestos steam resistance, and ranged harpoon firing with LOS validation.
- **Copy-Paste Prompt for AI Agent**:
  > Read `AGENTS.md`, `ARCHITECTURE.md`, and `ROADMAP.md` (Phase 22). Output the 5-point Pre-Flight Impact Analysis Checklist, then implement **Phase 22: Wielded Weapons, Wearable Armor/Pocket Gear & Ranged Pneumatic Ballistics ([F] Fire Mode) (Issue #27)** by creating `src/sim/systems/equipment.system.ts`, `src/sim/systems/ballistics.system.ts`, and `tests/sim/equipment-ballistics.test.ts`. Keep all files <= 250 lines and run `npm run verify` until all 4 checks pass with 0 errors.

---

## 2. Archive: Completed Phases (Phases 7–17)
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
