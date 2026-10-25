# ROADMAP.md — Phased AI Feature Handoff Plan (Aether & Soot)

> **HOW TO USE THIS ROADMAP**:
> - **Phases 1–6 (Completed)**: Established the deterministic headless core (`src/sim/`), 3-strata verticality, anatomy/prosthetics, thermodynamics, macro-economy, and the PixiJS/Preact presentation shell.
> - **Phases 7–12 (Completed — Issues #12–#17)**: Built world items & encumbrance, multi-building districts & inter-district transit, steam-powered crafting & salvage, autonomous NPC AI & targeted limb combat, physical merchant trading, and the initial UI inspector/system menu.
> - **Phases 13–17 (Completed — Issues #18–#22)**: Delivered the *Caves of Qud* full-window modal UI shell (`[I]` Satchel, `[A]` Vitruvian Anatomy & Grafts, `[C]` Artificer Schematic Bench, `[M]` Dual-Column Exchange & Factions, `[W]` Multi-Stratum World Atlas) and keyboard `[L]` Look/Target cursor mode.
> - **Phases 18–24 (Completed — Issues #23–#29)**: Expanded the world into large scrolling districts (`48x36`), procedural building archetypes with smashable windows and readable schematic manuals, interactive NPC dialogue & procedural faction contracts, CDDA-style Character Creation, wielded weapons & wearable pocketed armor, interactive containers (`LOCKER`, `CRATE`, `BOOKSHELF`) with tangible currency pouches (`Crown Pence Pouch`), and grounded trade with live Chirurgeon/Fixer spawns and dialogue-to-market wiring.
> - **Phases 25–28 (Completed — Issues #30–#33)**: Connected fuel-driven boiler stoking & pyrotechnics, a 5-district procedural Overworld City Grid, full `48x36` Undercroft sewer dungeons & Spire catwalk networks, and unified mortality across all damage sources with a Victorian Morgue screen and expanded cybernetics.
> - **Phases 29–31 (Completed — Issues #34–#36 — Emergent Systemic Sandbox Epics)**: Elevated *Aether & Soot* to true *CDDA* / *Caves of Qud* emergent systemic depth through acoustic decibel propagation & smog stealth, diurnal shift clocks & background district catch-up, and structural wall breaching, multi-strata gravity falls & clockwork traps.
> - **Phases 32–36 (Completed — Issues #37–#41 — Local Zero-Token Automation Tooling)**: Companion tooling suite for local LLM routing (`hermes:scout`, `hermes:testgen`, `hermes:chronicler`, `generate:content`, `hermes:split`) with strict Zod validation, deterministic AST extraction, and anti-tautological test invariants.
> - **Phases 47–50 (Completed — Issues #46, #48, #50, #82 — Procedural Worldcraft, Architectural Archetypes & Visual Density)**: Procedural biomes with CP437 typography, multi-room building prefabs with interior zoning, large-scale 64x48 overworld matrix and multi-stratum Atlas, and interactive environmental hazards.
>
> Every phase is engineered to be **handed off to an independent AI agent** without violating the **300-line file ceiling** (`AGENTS.md` Rule 2.2) or breaking `npm run verify`.

---

## 1. Active Implementation Plan (Phases 37–55)

Inspired by deep systemic comparisons with *Cataclysm: Dark Days Ahead (CDDA)*, *Caves of Qud*, and *Arcostate*, Phases 37–46 prioritize tactile, turn-by-turn simulation depth inside `src/sim/` over peripheral presentation or abstract macro-wars. Every phase leverages the Phases 32–36 Local Hermes Suite (`hermes:scout`, `hermes:split`, `hermes:chronicler`, `hermes:testgen`, `generate:content`) to keep paid context consumption minimal.

### Tier A: Anatomy, Cybernetic Bandwidth & Metabolic Alchemy (Phases 37–38)

- [x] **Phase 37: Boiler Governor Bandwidth, Active Prosthetic Abilities & Corpse Harvesting** *(Completed)*: Pre-split `src/sim/systems/anatomy.system.ts` (293 lines) via `hermes:split` into `src/sim/systems/prosthetics.system.ts`. Add `governorCapacityKw` and `strainLoadKw` to `anatomy` (`components.schema.ts`) to gate installed augments; add `ACTIVATE_PROSTHETIC` command with turn cooldowns and steam costs (*Ocular Thermal Pulse*, *Pneumatic Dash*, *Hydraulic Ram*); equip elite NPCs with active prosthetics and allow harvesting damaged cybernetics from corpses using surgical tools.
- [x] **Phase 38: Alchemical Toxicity, Withdrawal, Pain Shock & Stamina Overclocking** *(Completed)*: Create `src/sim/systems/metabolism.system.ts`. Add `toxicityPct` (0–100%), `painShock` (0–100), `stamina` (0–100), and timed `activeEffects[]` to `anatomy`. Implement Victorian combat alchemicals (*Laudanum Tincture*, *Aether-Salt Stimulant*, *Quicksilver Reflex Draught*) where crossing `toxicityPct >= 80%` triggers overdose side-effects followed by withdrawal debuffs. Use `generate:content` and `hermes:chronicler` for tonic blueprints and logs.

### Tier B: Momentum Physics, Tactical Postures & Tool/Weapon Engineering (Phases 39–40)

- [x] **Phase 39: Multi-Tile Momentum Physics, Knockback Collisions & Stealth Postures** *(Completed)*: Create `src/sim/systems/momentum.system.ts`. Concussive blasts, piledrivers, and harpoon pulls apply directional force vectors (`distanceTiles`, `massKg`) causing multi-tile knockback, wall/actor collision trauma, window smashing, and `ABYSS_DROP` plunges. Add `SET_POSTURE` (`STANDING`, `CROUCHED`, `BRACED`) affecting footstep `noiseDb`, directional furniture cover, and knockback resistance.
- [x] **Phase 40: CDDA Tool Qualities, Weapon Modifications & Loaded Pressure Chambers** *(Completed)*: Pre-split `src/sim/systems/crafting.system.ts` (271 lines) if needed. Add `toolQualities: Record<ToolQualityId, number>` (`SURGERY`, `WRENCHING`, `PRYING`, `ALCHEMICAL`, `LOCKPICKING`) to `ItemBlueprintSchema` for crafting, surgery, and prying. Add `modSlots` and `loadedAmmo` to weapons (`src/sim/systems/weapon-mods.system.ts`) supporting attachable Victorian weapon mods (*Rifled Brass Barrel*, *Acoustic Baffler Silencer*, *High-Pressure Steam Receiver*) and specialized ammo (*Flechette Harpoons*, *Incendiary Phosphor Bolts*).

### Tier C: Surface Liquid Chemistry, Squad Witness AI & Deep Exploration (Phases 41–44)

- [x] **Phase 41: Surface Liquid Pools, Chemical Reactions & Item Coating** *(Completed)*: Extend `TileCellSchema` and `thermo.system.ts` with surface fluids (`liquidType: 'NONE' | 'BLOOD' | 'WHALE_OIL' | 'NITRIC_ACID' | 'SLUICE_SLUDGE'`, `liquidVolumeMl`). Support bleeding trails, slip hazards, spark-ignited whale oil fires, acid corrosion, weapon coating, and thrown flasks.
- [x] **Phase 42: Witness Attribution, Squad Callouts & Faction Grudge Memory** *(Completed)*: Create `src/sim/systems/squad-witness.system.ts`. Gate theft/assault `factionReputation` penalties behind unblinded NPC line-of-sight (`WITNESS_CRIME_REPORTED`), rewarding smog occlusion and stealth. Add `EMIT_SQUAD_CALLOUT` (90 dB acoustic alert) for guards to rally nearby allied squadmates into flanking `COMBAT` states and record a persistent `grudgeTargetId`.
- [x] **Phase 43: Deep Sub-Undercroft Strata (`CATACOMBS` / Infinite Delve) & Derelict Pneumatic Monorail** *(Completed)*: Expand vertical exploration beneath `UNDERCROFT` into procedural depth tiers (`depthLevel: 1..N` Chalk Catacombs & Pre-Victorian Clockwork Vaults) with scaling hazards and relic schematics. Connect underground districts via a rideable, coal-pressurized multi-tile **Subterranean Pneumatic Monorail Car**.
- [x] **Phase 44: Artificer Safehouse Deeds, Furniture Construction & Royal Society Codex** *(Completed)*: Allow purchasing a **Freehold Workshop Deed** (or claiming an Undercroft vault) with persistent item/furniture storage (`SURGICAL_TABLE`, `ARTIFICER_BENCH`, `STEAM_CHARGER`), field construction/barricading (`BUILD_STRUCTURE`), and a `[K]` **Royal Society Naturalist's Codex** tracking discovered automatons, schematics, and alchemical reactions. Discovered Codex entries trigger emergent NPC curiosity, hostility, or trade reactions. Ensure `playtester-serializer.ts` provides complete command/state serialization coverage for Phase 44 deeds, structures, and Codex queries with deterministic unit tests in `tests/sim/`.
  - *Post-Phase Critic Agency Expansion & Cross-Wiring*: Link `COMPLETE_CONTRACT` to deed ownership validation (unlocking `CRAFT_RECIPE`), wire `VENT_STEAM` to steam-charging furniture and `COAT_WEAPON` mechanics, verify `DAMAGE_LIMB` and `VENT_STEAM` interactions with steam-charging furniture are logged, and persist limb-injury state observations across NPC dialogue memory. Seed autonomous Royal Society guild inspectors and rival artificers auditing workshop deeds/guarding vaults with `[K]` Codex reactivity and `NPC_GOAL_CHANGED` telemetry hooks (bridging into Phase 45). Add unit/integration tests for Undercroft vault claim flow and barricading.

### Tier D: Macro World & Presentation Polish (Deferred to Phases 45–46)

- [x] **Phase 45: Dynamic Turf Skirmishes, Economic Supply Escorts & Royal Society Politics** *(Completed)* (Issue #42): Grounded in Phase 42 squad AI and Phase 43 monorail cargo transit between factions. Introduced autonomous Royal Society guild inspectors and rival artificers who audit safehouses, react to workshop deeds, and emit NPC_GOAL_CHANGED telemetry. Implemented dynamic contested turf territory control, convoy preparation/escort/delivery confirmation, and complete serialization in playtester-serializer.ts with deterministic tests in tests/sim/phase45-turf-escort-politics.test.ts.
- [x] **Phase 46: Procedural WebAudio Soundscape & Acoustic Synth Shell** *(Completed)* (Issue #44): Pre-split `src/sim/core/world.ts` (245 -> 70 lines) into `src/sim/core/world-factory.ts` via `hermes:split`. Procedural WebAudio synth engine (`src/client/audio/`) generating synthetic steam releases (`VENT_STEAM`), metallic impacts/sparks (`EMIT_SPARK`, `INSTALL_PROSTHETIC`, `INSTALL_WEAPON_MOD`), acoustic alarms/horns (`SQUAD_CALLOUT_EMITTED`), gunshots/needle rifles, acid sizzle, and 4-strata ambient drone profiles without binary sound assets. Folded P2 serializer commands (`EMIT_SPARK`, `INSTALL_PROSTHETIC`, `INSTALL_WEAPON_MOD`, `LOAD_AMMO`) into `playtester-serializer.ts` with complete deterministic test suites in `tests/sim/phase46-audio-soundscape.test.ts` and `tests/sim/phase46-audio-events.test.ts`.

### Tier E: Procedural Worldcraft, Architectural Archetypes & Visual Density (Phases 47–50)

Inspired by the visual density and procedural depth of *Cataclysm: Dark Days Ahead (CDDA)*, *Caves of Qud*, and *Arcostate*, Tier E elevates *Aether & Soot* from a mechanical simulation into a distinct, visually compelling Victorian Steampunk world using the full range of ASCII, CP437, and Unicode glyph typography with dynamic atmospheric palettes.

- [x] **Phase 47: Procedural Architectural Biomes, Topography & Extended CP437/Unicode Glyph Visuals** *(Completed)* (Issue #46): Expanded `TerrainTypeSchema` and `VisualGlyphSpec` with rich Victorian/Steampunk architectural types (`WROUGHT_IRON_FENCE` `▓`, `BRASS_STEAM_PIPE` `┼`, `GASLAMP_POST` `☼`, `TIMBER_PIER` `═`, `SLAG_MOUND` `▲`, `CANAL_SLUICE` `≈`, `GOTHIC_COLONNADE` `Ω`, and connecting wall box-drawing glyphs `╬`/`║`/`═`). Implemented 5 visually distinct district biomes (*Limehouse Docks*, *Spitalfields Smelting Works*, *Gilded Spire Assembly*, *Blackfriars Rookeries*, *Chalk-Vault Catacombs*) with customized dual-color palettes and shader flags (`GASLIGHT_RADIANCE`, `SOOT_OCCLUSION`, `SPARK_GLINT`). Pre-split `src/client/main.tsx` into `client-debug-bridge.ts` and `frame-adapter.ts` into `wall-connections.ts` and `biome-palette.ts`. Added full serialization coverage and deterministic test suites in `tests/sim/phase47-biome-topography.test.ts`.
- [x] **Phase 48: Multi-Room Building Prefab Engine, Architectural Typology & Landmark Micro-Locations** *(Completed)* (Issue #48): Created procedural multi-room floorplan generation with structural interior zoning (`carveMultiRoomBuilding`, `getInteriorZoneAtPoint`, `findCellsInZone` across `RECEPTION`, `WORKSHOP`, `VAULT`, `SURGICAL_BAY`, `STORAGE`). Built 6 distinctive building archetypes (*Victorian Apothecary & Chirurgeon Clinic*, *Clockwork Pawnshop & Cartel Bank*, *Steam Boilerhouse & Slag Furnace*, *Tenement Rookeries*, *Pneumatic Monorail Depot*, *Guild Artisan Workshop*) and outdoor street landmarks (water pump stations, street-corner clocktowers, sunken canal locks, Spire rooftop greenhouses). Pre-split `character-archetypes.ts` into `character-archetype-defs.ts` and decomposed building engine into `interior-zoning.ts`, `architectural-typologies.ts`, `landmark-micro-locations.ts`, and `building-prefabs.ts`. Guaranteed 100% path safety and serialization round-trip in `tests/sim/phase48-building-prefabs.test.ts`.
- [x] **Phase 49: Large-Scale Overworld Expansion, District Sizing & Multi-Stratum City Atlas** *(Completed)* (Issue #50): Expanded district grid sizing up to 64x48 and scaled the city overworld matrix into a sprawling multi-district metropolis divided by natural barriers (Thames Estuary canal network, viaducts, reinforced toll perimeter walls, and multi-point sewer drops). Upgraded the interactive World Atlas (`[W]`) with dedicated views for local cross-section minimaps, macro-topography, Thames waterways, faction control heatmaps, transit monorails, and comprehensive district/landmark dossiers. Pre-split `src/sim/systems/inventory.system.ts` (243 -> 175 lines) into `inventory-use.system.ts` and modularized `src/client/ui/AtlasWindow.tsx` (231 lines) into `AtlasMinimapView.tsx`, `AtlasOverworldView.tsx`, and `AtlasDossierView.tsx`. Maintained 100% serialization fidelity in `WorldState` and tested with deterministic test suite in `tests/sim/phase49-overworld-atlas.test.ts`.
- [x] **Phase 50: Interactive World Features, Tactical Environmental Hazards & Tangible Mechanical Agency** *(Completed)* (Issue #82): Pre-split `src/client/main.tsx` (246 -> 203 lines) into `src/client/ui/ClientPresentationView.tsx`. Full gameplay wiring and systemic execution of environmental agency commands (`LOOT_CONTAINER` with armed booby-trap triggers and disarming, `PRESSURIZE_VESSEL` with wall breaching into rubble, `PRY_OBSTACLE` for crowbar prying on jammed grates/doors into passable cobblestone, and `PAY_CHIRURGEON_HEAL` for clinic operating table services). Added dynamic volumetric gaslight illumination radiance in radius 5, drifting soot clouds with dynamic ASCII character occlusion (`%`, `&`, `*`) and coughing acoustics, whale oil puddles with ignition cascades, and corrosive acid drip hazards. Pre-split environmental systems into `gaslight.system.ts` and `environmental-hazards.system.ts`, added `environmental-visuals.ts`, folded serializer commands (`DESCEND_CATACOMBS`, `EMIT_SQUAD_CALLOUT`, `LOOT_CONTAINER`, `PAY_CHIRURGEON_HEAL`) into `playtester-serializer.ts`, and verified 100% determinism in `tests/sim/phase50-interactive-hazards.test.ts`.

### Tier UI & Governance: Diegetic Interfaces, Multimodal Audits & Emergence (Phases UI-6–UI-7, GOV-1, VER-1)

- [x] **Phase UI-6: Glyph Atlas Completeness, Zero-Truncation & Dual-Pane Satchel/Anatomy**: Expanded `ATLAS_GLYPHS` with CP437 box-drawing and geometric icons (`…`, `←`, `→`, `↑`, `↓`, `Ω`, `♦`, `▬`, `■`, `□`, `⚡`, `⚠`, `‡`). Upgraded Satchel (`[I]`) and Vitruvian Anatomy (`[A]`) to synchronized dual-pane layouts with resolved catalog display names, Boiler Governor bandwidth load, and all 8 anatomical limb slots (`OCULAR_MOUNT`, `CHASSIS_CORE`).
- [x] **Phase UI-7: Spatial Floating Combat Text, Widescreen Viewport Centering & Telemetry**: Implemented centered widescreen rendering in `frame-adapter.ts` for narrower districts (48×36 inside 88×36), eliminating the blank void with subtle blueprint margins (`·`). Implemented transient spatial floating combat text in `floating-combat-text.tsx` displaying tile-anchored callouts for damage, amputations, scalds, ruptures, and door toggles drifting and fading over time. Refactored `HudLayout.tsx` with `TickerTapeLog.tsx` and WCAG accessibility glyphs.
- [x] **Phase GOV-1 & GOV-2: Antigravity Progressive Disclosure Rules, Hooks & Vision Critic Hardening**: Created `.agents/rules/*.md` progressive disclosure rules (`ui-edison-qud.md`, `ecs-simulation.md`, `lore-procgen.md`), `.agents/hooks.json`, pre-tool validator, and governance checker (`check-agent-governance.ts`). Hardened `hermes-vision-critic.ts` with deterministic atlas audits, raw ID leak detection, and margin collision audits, achieving 98/100 mock score and 92/100 live `gemma4:12b-extended` score.
- [x] **Phase VER-1: 1,000-Turn Headless Emergence Fuzzer & State Ledger**: Built `tests/sim/emergence-fuzzer.test.ts` executing 1,000 automated turns in an industrial arena in <400ms, asserting multi-system cascading reactions across deflagrations, boiler ruptures, structural wall collapses, acoustic shockwaves, and combat defeat. Proved 100% bit-exact deterministic replayability and relational invariant stability.

### Machine-Verifiable State Ledger

| Phase ID & Title | Verification Command | Key Artifact / Deliverable | Status Gate |
| :--- | :--- | :--- | :---: |
| **Phase UI-6**: Atlas Glyphs & Dual-Pane Modals | `npm run test:sim -- -t "cdda-bench"` | `docs/screenshots/01–09.png` | `VERIFIED` (exit 0) |
| **Phase UI-7**: Floating Text & Centered Viewport | `npm run test:sim -- -t "Viewport Centering"` | `tests/sim/viewport-combat-telemetry.test.ts` | `VERIFIED` (exit 0) |
| **Phase GOV-1**: Progressive Disclosure Rules | `npm run check:governance` | `.agents/rules/*.md`, `.agents/hooks.json` | `VERIFIED` (exit 0) |
| **Phase GOV-2**: Multimodal Vision Critic | `npm run hermes:vision` | `tests/artifacts/vision-audit.md` (92/100 Live) | `VERIFIED` (exit 0) |
| **Phase VER-1**: 1,000-Turn Emergence Fuzzer | `npx vitest run tests/sim/emergence-fuzzer.test.ts` | `tests/sim/emergence-fuzzer.test.ts` (360ms) | `VERIFIED` (exit 0) |
| **Tier G Prep**: Phase 51 Architectural Scoping | `npm run check:boundaries && npm run typecheck` | `ROADMAP.md`, `STATE.md` | `PREPPED` (exit 0) |
| **Phase 53**: State Machine Modernization & Governance Tooling | `npm run test:sim -- -t "Phase 53"` | `.agents/state.json`, `src/schemas/project-state.schema.ts` | `VERIFIED` (exit 0) |
| **Phase 54**: Diegetic Presentation Shell & GLSL Shader Suite | `npm run test:sim -- -t "Phase 54"` | `src/client/renderer/steampunk-pipeline.ts`, `diegetic-post-filter.ts` | `VERIFIED` (exit 0) |

### Tier G: The Living City — Causal Geography, Authored Landmarks & Narrative Continuity (Phases 51–57)

Synthesizing the systemic audit recommendations into a coherent, causal simulation of Victorian London: connecting districts through strategic infrastructure conduits, anchoring procedural generation with authored multi-state landmark hubs, simulating macro-commodity supply chains and scarcity cascades, bounding historical chronicle records for witness memory and rumor diffusion, and equipping the player with forensic investigation tools.

- [x] **Phase 51: Simulation Loop Harmonization & Island System Integration** *(Completed)*:
  - Wired environmental hazard scheduling (soot, coughing, acid drips) into turn pipeline.
  - Coupled lighting and smoke density into stealth perception math.
  - Linked turf control standing directly into merchant trade pricing tariffs/discounts.
  - Implemented physiological penalties (pain shock AP penalties and stamina exhaustion).
  - Wired ballistics firearm discharge and surgery crime witness reporting.
- [x] **Phase 52: Corpus Lore Injection & Naturalist Codex Engine** *(Completed)*:
  - Grounded Victorian Cockney slang, Royal Society academic prose, Thieves' Cant, and diurnal shift vernacular into declarative corpora blueprints (`data/corpora/barks.json`, `data/corpora/codex_lore.json`).
  - Implemented deterministic template token interpolation (`{DISTRICT}`, `{SHIFT}`, `{FACTION}`, `{PRESSURE}`) in `src/sim/data/corpora-catalog.ts`.
  - Added `EMIT_PROCEDURAL_BARK`, `DISSECT_CORPSE_ANATOMY`, and `ENFORCE_TURF_AUTHORITY` command dispatch and event sourcing (`PROCEDURAL_BARK_EMITTED`, `CORPSE_DESECRATION_WITNESSED`, `TURF_TARIFF_ENFORCED`).
  - Wired naturalist codex discovery across automaton autopsies (`AUTOMATON`), superheated steam scald survival (`THERMODYNAMICS`), and architectural landmark inspection (`INFRASTRUCTURE`).
- [x] **Phase 53: State Machine Modernization & Governance Tooling** *(Completed)*:
  - Unified project roadmap, active phase status, and modularity telemetry into machine-verified `.agents/state.json` via `ProjectStateSchema`.
  - Refactored `tests/scripts/update-state.ts` into a pure compiler rendering `STATE.md`, `ROADMAP.md`, and `AGENTS.md` idempotently.
  - Scrubbed duplicate critic backlog tables and dynamically wired live Near-Cap Files telemetry into `AGENTS.md` Rule 2.2.
  - Upgraded critic target file resolution to map domain priorities to target files instead of top line counts.
  - Normalized git hooks and screenshot capture paths to dynamic `process.cwd()` execution.
- [x] **Phase 54: Diegetic Presentation Shell & GLSL Shader Suite** *(Completed)*:
  - Restructured PixiJS v8 stage into 5-layer depth-sorted container hierarchy (`WorldTacticalContainer`, `GaslightLightingContainer`, `DiegeticFrameContainer`, `CanvasUiBufferContainer`, `OpticalOverlayContainer`).
  - Implemented 4-pass GLSL shader suite (spherical lens curvature `k=0.08`, Edison aperture shadow mask, dual-threshold amber/cyan bloom, and thermodynamic heat haze / chromatic aberration).
  - Expanded `glyph-atlas-extended.ts` to full 256-glyph CP437 with sub-pixel alignment and Victorian technical symbols (`⚙`, `☼`, `╬`, `⌖`, `◈`, `░▒▓█`).
  - Extracted `camera-governor.ts` from `frame-adapter.ts` to smoothly center viewports and render engraved copperplate architectural cross-sections along world borders.
- [ ] **Phase 55: Causal Supply Chains & Disruption Cascades**: Aggregate macro-tick simulation of 3 vital commodities (*Anthracite Coal*, *Carbolic Tincture*, *Preserved Rations*). Scarcity events trigger downstream consequences: clinic medicine stockouts, workshop steam outages, merchant price inflation, and worker shift strikes.
- [ ] **Phase 56: Bounded World Chronicle, Witness Memory & Rumor Network**: Bounded circular buffer of the last 50 significant historical events in `WorldState.chronicle`. NPCs in line-of-sight or acoustic range log witnessed incidents into `witnessedEvents`, diffusing rumors across shift changes with faction-slanted blame attribution in dynamic dialogue barks.
- [ ] **Phase 57: Investigation Journal & Forensic Environmental Clues**: Detective UI (`[J]` Casebook & Investigation Ledger), forensic tile examination on breached/sabotaged machinery, and clue categorization (`OBSERVED`, `LEARNED`, `HEARD`). Assembling matching clues resolves inquiries to unlock unique faction contracts, safehouse passcodes, or diplomatic leverage.

### Tier F: Emergent Systemic Backlog (Critic Suggestions)

This serves as the permanent holding area for validated, out-of-scope systemic ideas waiting to be scheduled into a formal phase.

#### Flagship NPC Concepts & Narrative Agency
- **Flagship NPC Systems & Branching Storylines**: Develop a cohort of bespoke flagship NPCs who serve as architectural archetypes for branching narrative arcs, deep backstories, actionable motives, and rich dialogue trees.
- **Dynamic World Seeding & Autonomous Simulation**: Seed flagship NPCs across city districts and strata where they react dynamically to world-state changes, player deeds, and peer NPCs. NPCs self-navigate between districts and progress their personal narratives when the player is not present.

#### Emergent Community Concepts & Systemic Complexity
- **Systemic Ambition & Factional Pursuits**: Introduce rich systemic objectives (contracts, schematics, rare codices) that NPCs actively pursue. NPCs hold personal ambitions feeding into larger underground factions and high-strata conspiracies.
- **Emergent Communities & Organic Economies**: Multi-agent NPC interactions drive emergent local communities, mutual-aid networks, and fluctuating black-market economies without rigid event scripting.

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

## Autonomous Critic Backlog (Sanity-Verified)

| Priority | Category | Title | Directive | Target Files | Verification |
| --- | --- | --- | --- | --- | --- |
| P1 | UNREACHABLE_MECHANIC | Phase 55 | Focus core systems development on **Phase 55: Causal Supply Chains & Disruption Cascades**: Aggregate macro-tick simulation of 3 vital commodities (*Anthracite Coal*, *Carbolic Tincture*, *Preserved Rations*). Scarcity events trigger downstream consequences: clinic medicine stockouts, workshop steam outages, merchant price inflation, and worker shift strikes. resolving unwiredCommands and telemetry anomalies. | `src/sim/systems/economy.system.ts, src/sim/systems/trade.system.ts` | `tests/sim/determinism.test.ts` |
| P2 | SIM_BALANCE | Expand Playtest Serializer Command Surface | Wire unwired commands (REMOVE_PROSTHETIC, REPORT_CRIME, REST_AT_BED, SET_POSTURE) to reduce unwiredCommands count. | `tests/scripts/playtester-serializer.ts` | `tests/sim/determinism.test.ts` |
| P3 | MODULE_SPLIT | Modularity Guard & File Splitting | Monitor and pre-split near-cap modules like tests/scripts/hermes-critic.ts and playtester-projection-audit.ts to enforce 250-line target. | `tests/scripts/hermes-critic.ts, tests/scripts/playtester-projection-audit.ts` | `tests/sim/determinism.test.ts` |
