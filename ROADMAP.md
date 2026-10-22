# ROADMAP.md — Phased AI Feature Handoff Plan (Aether & Soot)

> **HOW TO USE THIS ROADMAP**:
> - **Phases 1–6 (Completed)**: Established the deterministic headless core (`src/sim/`), 3-strata verticality, anatomy/prosthetics, thermodynamics, macro-economy, and the PixiJS/Preact presentation shell.
> - **Phases 7–12 (Completed — Issues #12–#17)**: Built world items & encumbrance, multi-building districts & inter-district transit, steam-powered crafting & salvage, autonomous NPC AI & targeted limb combat, physical merchant trading, and the initial UI inspector/system menu.
> - **Phases 13–17 (Completed — Issues #18–#22)**: Delivered the *Caves of Qud* full-window modal UI shell (`[I]` Satchel, `[A]` Vitruvian Anatomy & Grafts, `[C]` Artificer Schematic Bench, `[M]` Dual-Column Exchange & Factions, `[W]` Multi-Stratum World Atlas) and keyboard `[L]` Look/Target cursor mode.
> - **Phases 18–24 (Completed — Issues #23–#29)**: Expanded the world into large scrolling districts (`48x36`), procedural building archetypes with smashable windows and readable schematic manuals, interactive NPC dialogue & procedural faction contracts, CDDA-style Character Creation, wielded weapons & wearable pocketed armor, interactive containers (`LOCKER`, `CRATE`, `BOOKSHELF`) with tangible currency pouches (`Crown Pence Pouch`), and grounded trade with live Chirurgeon/Fixer spawns and dialogue-to-market wiring.
> - **Phases 25–28 (Completed — Issues #30–#33)**: Connected fuel-driven boiler stoking & pyrotechnics, a 5-district procedural Overworld City Grid, full `48x36` Undercroft sewer dungeons & Spire catwalk networks, and unified mortality across all damage sources with a Victorian Morgue screen and expanded cybernetics.
> - **Phases 29–31 (Completed — Issues #34–#36 — Emergent Systemic Sandbox Epics)**: Elevated *Aether & Soot* to true *CDDA* / *Caves of Qud* emergent systemic depth through acoustic decibel propagation & smog stealth, diurnal shift clocks & background district catch-up, and structural wall breaching, multi-strata gravity falls & clockwork traps.
> - **Phases 32–36 (Completed — Issues #37–#41 — Local Zero-Token Automation Tooling)**: Companion tooling suite for local LLM routing (`hermes:scout`, `hermes:testgen`, `hermes:chronicler`, `generate:content`, `hermes:split`) with strict Zod validation, deterministic AST extraction, and anti-tautological test invariants.
>
> Every phase is engineered to be **handed off to an independent AI agent** without violating the **300-line file ceiling** (`AGENTS.md` Rule 2.2) or breaking `npm run verify`.

---

## 1. Active Implementation Plan: Core Systemic Simulation Epics (Phases 37–46)

Inspired by deep systemic comparisons with *Cataclysm: Dark Days Ahead (CDDA)*, *Caves of Qud*, and *Arcostate*, Phases 37–46 prioritize tactile, turn-by-turn simulation depth inside `src/sim/` over peripheral presentation or abstract macro-wars. Every phase leverages the Phases 32–36 Local Hermes Suite (`hermes:scout`, `hermes:split`, `hermes:chronicler`, `hermes:testgen`, `generate:content`) to keep paid context consumption minimal.

### Tier A: Anatomy, Cybernetic Bandwidth & Metabolic Alchemy (Phases 37–38)

- [x] **Phase 37: Boiler Governor Bandwidth, Active Prosthetic Abilities & Corpse Harvesting**: Pre-split `src/sim/systems/anatomy.system.ts` (293 lines) via `hermes:split` into `src/sim/systems/prosthetics.system.ts`. Add `governorCapacityKw` and `strainLoadKw` to `anatomy` (`components.schema.ts`) to gate installed augments; add `ACTIVATE_PROSTHETIC` command with turn cooldowns and steam costs (*Ocular Thermal Pulse*, *Pneumatic Dash*, *Hydraulic Ram*); equip elite NPCs with active prosthetics and allow harvesting damaged cybernetics from corpses using surgical tools.
- [x] **Phase 38: Alchemical Toxicity, Withdrawal, Pain Shock & Stamina Overclocking**: Create `src/sim/systems/metabolism.system.ts`. Add `toxicityPct` (0–100%), `painShock` (0–100), `stamina` (0–100), and timed `activeEffects[]` to `anatomy`. Implement Victorian combat alchemicals (*Laudanum Tincture*, *Aether-Salt Stimulant*, *Quicksilver Reflex Draught*) where crossing `toxicityPct >= 80%` triggers overdose side-effects followed by withdrawal debuffs. Use `generate:content` and `hermes:chronicler` for tonic blueprints and logs.

### Tier B: Momentum Physics, Tactical Postures & Tool/Weapon Engineering (Phases 39–40)

- [x] **Phase 39: Multi-Tile Momentum Physics, Knockback Collisions & Stealth Postures**: Create `src/sim/systems/momentum.system.ts`. Concussive blasts, piledrivers, and harpoon pulls apply directional force vectors (`distanceTiles`, `massKg`) causing multi-tile knockback, wall/actor collision trauma, window smashing, and `ABYSS_DROP` plunges. Add `SET_POSTURE` (`STANDING`, `CROUCHED`, `BRACED`) affecting footstep `noiseDb`, directional furniture cover, and knockback resistance.
- [x] **Phase 40: CDDA Tool Qualities, Weapon Modifications & Loaded Pressure Chambers**: Pre-split `src/sim/systems/crafting.system.ts` (271 lines) if needed. Add `toolQualities: Record<ToolQualityId, number>` (`SURGERY`, `WRENCHING`, `PRYING`, `ALCHEMICAL`, `LOCKPICKING`) to `ItemBlueprintSchema` for crafting, surgery, and prying. Add `modSlots` and `loadedAmmo` to weapons (`src/sim/systems/weapon-mods.system.ts`) supporting attachable Victorian weapon mods (*Rifled Brass Barrel*, *Acoustic Baffler Silencer*, *High-Pressure Steam Receiver*) and specialized ammo (*Flechette Harpoons*, *Incendiary Phosphor Bolts*).

### Tier C: Surface Liquid Chemistry, Squad Witness AI & Deep Exploration (Phases 41–44)

- [x] **Phase 41: Surface Liquid Pools, Chemical Reactions & Item Coating**: Extend `TileCellSchema` and `thermo.system.ts` with surface fluids (`liquidType: 'NONE' | 'BLOOD' | 'WHALE_OIL' | 'NITRIC_ACID' | 'SLUICE_SLUDGE'`, `liquidVolumeMl`). Support bleeding trails, slip hazards, spark-ignited whale oil fires, acid corrosion, weapon coating, and thrown flasks.
- [x] **Phase 42: Witness Attribution, Squad Callouts & Faction Grudge Memory**: Create `src/sim/systems/squad-witness.system.ts`. Gate theft/assault `factionReputation` penalties behind unblinded NPC line-of-sight (`WITNESS_CRIME_REPORTED`), rewarding smog occlusion and stealth. Add `EMIT_SQUAD_CALLOUT` (90 dB acoustic alert) for guards to rally nearby allied squadmates into flanking `COMBAT` states and record a persistent `grudgeTargetId`.
- [x] **Phase 43: Deep Sub-Undercroft Strata (`CATACOMBS` / Infinite Delve) & Derelict Pneumatic Monorail**: Expand vertical exploration beneath `UNDERCROFT` into procedural depth tiers (`depthLevel: 1..N` Chalk Catacombs & Pre-Victorian Clockwork Vaults) with scaling hazards and relic schematics. Connect underground districts via a rideable, coal-pressurized multi-tile **Subterranean Pneumatic Monorail Car**.
- [x] **Phase 44: Artificer Safehouse Deeds, Furniture Construction & Royal Society Codex**: Allow purchasing a **Freehold Workshop Deed** (or claiming an Undercroft vault) with persistent item/furniture storage (`SURGICAL_TABLE`, `ARTIFICER_BENCH`, `STEAM_CHARGER`), field construction/barricading (`BUILD_STRUCTURE`), and a `[K]` **Royal Society Naturalist's Codex** tracking discovered automatons, schematics, and alchemical reactions. Discovered Codex entries trigger emergent NPC curiosity, hostility, or trade reactions. Ensure `playtester-serializer.ts` provides complete command/state serialization coverage for Phase 44 deeds, structures, and Codex queries with deterministic unit tests in `tests/sim/`.
  - *Post-Phase Critic Agency Expansion*: Link `COMPLETE_CONTRACT` to deed ownership validation, expand safehouse crafting/mod pipelines with exclusive recipe/mod slots, and persist limb-injury state observations across NPC dialogue memory.

### Tier D: Macro World & Presentation Polish (Deferred to Phases 45–46)

- [ ] **Phase 45: Dynamic Turf Skirmishes, Economic Supply Escorts & Royal Society Politics**: Grounded in Phase 42 squad AI and Phase 43 monorail cargo transit between factions. Introduce autonomous Royal Society guild inspectors and rival artificers who audit safehouses, react to workshop deeds, and emit `NPC_GOAL_CHANGED` telemetry.
- [ ] **Phase 46: Procedural WebAudio Soundscape & Acoustic Synth Shell**: WebAudio synthesizer wired to finalized `SimEvent` triggers across Phases 37–45.

---

## 2. Archive: Completed Tooling & Systems (Phases 32–36)
- [x] **Phase 32 (Issue #37 — Completed)**: Local Codebase Scout & Pre-Flight Impact Analyzer (`tests/scripts/hermes-scout.ts`, `npm run hermes:scout`). Compiles the mandatory 5-point Pre-Flight Impact Analysis locally without polluting Gemini's context with raw multi-file reads. Defaults to `gemma4:12b-extended`.
- [x] **Phase 33 (Issue #38 — Completed)**: Self-Healing Deterministic Unit Test Generator (`tests/scripts/hermes-testgen.ts`, `npm run hermes:testgen`). Generates Vitest suites with compiler-only error recovery and anti-tautological test protection. Defaults to `gemma4:12b-extended`.
- [x] **Phase 34 (Issue #39 — Completed)**: Exhaustive `SimEvent` Chronicler & Boilerplate Generator (`tests/scripts/hermes-chronicler.ts`, `npm run hermes:chronicler`). Synchronizes `src/schemas/events.schema.ts` variants with `EventFormatter.ts` switch cases and Victorian logs. Defaults to `hermes3:8b`.
- [x] **Phase 35 (Issue #40 — Completed)**: Full-Spectrum Declarative Blueprint & Prefab Factory (`tests/scripts/hermes-content-generator.ts`, `tests/scripts/hermes-content-normalizers.ts`). Expands bulk local generation to prosthetics, districts, gases, and ASCII building prefabs. Defaults to `hermes3:8b`.
- [x] **Phase 36 (Issue #41 — Completed)**: Modularity Ceiling Splitter Assistant (`tests/scripts/hermes-split.ts`, `npm run hermes:split`). Uses deterministic AST slicing to extract sub-domain functions from near-cap files (>=240 lines) to enforce the 300-line modularity ceiling. Defaults to `gemma4:12b-extended`.

---

## 3. Archive: Completed Gameplay Phases (Phases 7–31)
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
- **Phase 29 (Issue #34 — Completed)**: Acoustic Decibel Propagation, Smog Occlusion Stealth & Sensory AI (`src/sim/systems/stealth-acoustics.system.ts`, `tests/sim/stealth-acoustics.test.ts`).
- **Phase 30 (Issue #35 — Completed)**: Diurnal Shift Clocks, Autonomous NPC Ecology & Background District Catch-Up (`src/sim/systems/npc-ecology.system.ts`, `src/sim/systems/district-catchup.system.ts`, `tests/sim/npc-ecology-catchup.test.ts`).
- **Phase 31 (Issue #36 — Completed)**: Structural Wall Breaching, Multi-Strata Gravity Falls & Clockwork Traps (`src/sim/systems/physics-traps.system.ts`, `tests/sim/physics-traps-falls.test.ts`).
