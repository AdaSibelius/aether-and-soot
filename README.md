# Aether & Soot (Victorian Steampunk 2D Roguelike)

> **Autonomous AI Engineering Context**: This document serves as the comprehensive architectural and systemic dossier for *Aether & Soot*. It explains every implemented gameplay mechanic, the rationale behind architectural invariants, the reality of current scope and limitations, and a complete technical reference for AI agents and human developers alike. For the creative vision, world lore, player experience pillars, and design heuristics, read **[docs/DESIGN_INTENT.md](docs/DESIGN_INTENT.md)**.

---

## 1. Executive Summary & Vision

*Aether & Soot* is a deterministic, 2D turn-based Victorian Steampunk roguelike set in an alternate 1888 subterranean London. The game combines the deep anatomical conditions, declarative building templates, systemic material interactions, and survival mechanics of ***Cataclysm: Dark Days Ahead (CDDA)*** with the evocative CRT scanline shaders, Oxidized Iron diegetic instrumentation, and tactile modal window ergonomics of ***Caves of Qud***.

The player navigates an urban sprawl stratified into four vertical planes:
1. **The Spire** (`SPIRE`): Elevated brass catwalks, steam towers, high-society conservatories, and Clockwork Guild workshops.
2. **The Cobblestone Street** (`STREET`): Ground-level industrial wards, CDDA-style urban parcels, sovereign storefronts, public houses, and smog-choked alleys connected by open district border seams.
3. **The Undercroft** (`UNDERCROFT`): Brick sewer corridors, sluice vaults, cartel smuggling dens, subterranean pneumatic monorails, and hazardous gas pockets.
4. **The Catacombs** (`CATACOMBS`): Deep chalk delve tiers (`depthLevel 1..N`) and pre-Victorian clockwork vaults beneath the Undercroft.

---

## 2. Visual Interface Showcase

*Aether & Soot* renders through a widescreen 88×36 CP437 character-cell grid backed by PixiJS v8 and custom GLSL scanline CRT shaders. Tactical modals and instrument bezels feature double-line brass borders, segmented character-cell telemetry meters, and pneumatic ticker chronicles.

| Victorian Street Overworld & Main HUD | CDDA-Style Artificer Workstation |
| :---: | :---: |
| ![Victorian Street Overworld & Main HUD](docs/screenshots/01_main_street_hud.png) | ![Artificer Workstation](docs/screenshots/02_artificer_workstation.png) |
| **Metropolitan Stratum Atlas** | **Borough Turf & Commodity Exchange** |
| ![Metropolitan Stratum Atlas](docs/screenshots/03_metropolitan_atlas.png) | ![Borough Turf & Commodity Exchange](docs/screenshots/04_market_exchange_turf.png) |
| **Naturalist Philosophy Codex** | **Vitruvian Anatomy & Graft Bay** |
| ![Naturalist Philosophy Codex](docs/screenshots/05_naturalist_codex.png) | ![Vitruvian Anatomy & Graft Bay](docs/screenshots/06_vitruvian_paperdoll.png) |
| **Satchel Inventory & Dial Gauges** | **Look Mode Tactical Inspector** |
| ![Satchel Inventory & Dial Gauges](docs/screenshots/07_satchel_inventory.png) | ![Look Mode Tactical Inspector](docs/screenshots/08_tactical_look_mode.png) |
| **Character Creation & Vocation Embarkation** | |
| ![Character Creation & Vocation Embarkation](docs/screenshots/09_character_embarkation.png) | |

> See [docs/screenshots/README.md](docs/screenshots/README.md) for individual high-resolution screenshots and detailed interface breakdowns.

---

## 3. Architectural Invariants ("Why Things Are The Way They Are")

The codebase is engineered specifically for **reliable autonomous AI pair programming** and **reproducible headless simulation**. Every rule is validated automatically on every commit via `npm run verify`.

```mermaid
flowchart TD
    subgraph DataLayer["1. Declarative Schemas & Data (Zod + JSON)"]
        S1["src/schemas/primitives.schema.ts\n(Branded EntityId, StratumId, LimbSlotId)"]
        S2["src/schemas/components.schema.ts\n(Flat Relational ECS Record)"]
        S3["data/**/*.json\n(Prosthetics, Recipes, Materials, Districts)"]
    end

    subgraph SimCore["2. Pure Headless Simulation Core (src/sim/)"]
        E1["dispatchCommand()\n(src/sim/core/engine.ts)"]
        Sys["Domain Systems\n(anatomy, combat, ballistics, thermo, traps...)"]
        W1["WorldState\n(Flat, 100% JSON-serializable)"]
        PRNG["SeededRNG\n(xoshiro128** state tuple)"]
    end

    subgraph ClientShell["3. Presentation Shell (src/client/)"]
        Proj["projectWorldToVisualFrame()\n(Shadowcasting FOV + Viewport)"]
        Pixi["GlyphStageRenderer + GLSL CRT Shader\n(PixiJS v8)"]
        UI["Tactical Preact UI Shell\n(Morgue, Satchel, Anatomy, Workbench, Atlas)"]
    end

    DataLayer --> SimCore
    DataLayer --> ClientShell
    UI -- "Dispatches GameCommand" --> E1
    E1 --> Sys
    Sys --> W1
    W1 -. "Readonly<WorldState>" .-> Proj
    Proj --> Pixi
    W1 -. "Readonly<WorldState>" .-> UI
```

### Why Headless Core / Presentation Shell Separation Exists
- **Zero Browser Dependencies in Core (`src/sim/` and `src/schemas/`)**: No imports from `pixi.js`, `preact`, `window`, `document`, or DOM globals are permitted.
- **Sub-Second Test Execution**: 129 test suites (677 tests) covering 5-district procgen, CDDA building templates, continuous border seams, cellular automata, ballistics, stealth acoustics, NPC diurnal shifts, trap physics, and diegetic canvas UI run in Node.js without spinning up headless browser overhead.
- **Strict Unidirectional Mutability**: The presentation shell (`src/client/`) only holds `Readonly<WorldState>`. State mutations can only happen by dispatching a validated `GameCommand` to `dispatchCommand()`.

### Why Deterministic PRNG & Flat Relational ECS Are Non-Negotiable
- **No Non-Deterministic Calls**: `Math.random()` and `Date.now()` are forbidden and blocked by automated boundary scanners.
- **Bit-Exact Replays & Saves**: `WorldState` stores the 4-element `xoshiro128**` tuple (`rngState`). Serializing `WorldState` at Turn 50 and restoring it guarantees identical simulation outcomes down to the exact damage roll.
- **No Circular Object References**: All entities live in a flat table `state.entities[entityId]`. Items in inventories or socketed cybernetics are stored as branded `EntityId` arrays and never as nested entity trees, ensuring clean JSON serialization.

### Why The Hard Modularity Ceiling (<= 250 Lines per File) Exists
- Long source files cause LLMs to drop context, hallucinate imports, or produce truncated edit blocks.
- Every `.ts` and `.tsx` file is bounded to **<= 250 lines** (hard automated ceiling: 300 lines enforced by `tests/scripts/check-boundaries.ts`). When a domain system grows, logic is proactively extracted into dedicated sibling modules (e.g. `stealth-acoustics.system.ts`, `npc-ecology.system.ts`, `physics-traps.system.ts`).

### Why Event Sourcing (`SimEvent`) Is Used
- Every state change emits a strongly-typed `SimEvent` into `state.eventLog`.
- Decouples simulation rules from UI feedback: headless tests assert event causality, the HUD action chronicle displays formatted prose, and client audio/vfx hooks trigger without inspecting raw diffs.

---

## 3. Comprehensive Mechanics & Systems Catalog

### 3.1. Vitruvian Anatomy & Cybernetics
- **Limb Topology**: Actors have 8 discrete limb slots: `HEAD`, `TORSO`, `LEFT_ARM`, `RIGHT_ARM`, `LEFT_LEG`, `RIGHT_LEG`, `OCULAR_MOUNT`, and `CHASSIS_CORE`.
- **Targeted Damage & Amputation**: Attacks specifically target limb slots. When limb HP hits 0, the limb is amputated.
  - Arm amputation/damage reduces melee damage and combat accuracy.
  - Leg amputation increases movement action point (AP) costs from 100 to 160 AP.
  - Ocular Mount destruction blinds the actor, clamping FOV vision radius to 1 unless restored with an optic prosthetic.
  - Torso or Head destruction results in immediate defeat.
- **Haemodynamic Blood System**: Actors track `bloodVolumePct` (0–100%). Wounds cause bleeding; amputations cause severe acute haemorrhage. Falling to 0% blood volume results in fatal exsanguination.
- **Coagulant Tonics**: Consuming Dr. Halloway's Coagulant Tonic stops active blood loss and restores blood volume.
- **Pneumatic Cybernetic Prosthetics**: Amputated or augmented slots can receive socketed steam prosthetics:
  - `prosthetic_pneumatic_leg_mk1`: Restores locomotion, grants -15 AP movement speed, and provides 50% fall shock absorption.
  - `prosthetic_clockwork_ocular_lens`: Restores vision and expands FOV radius through soot and smog.
  - `prosthetic_pneumatic_piledriver_arm`: Heavy hydraulic arm for high-impact melee trauma and structural wall breaching.
  - `prosthetic_boiler_core_furnace`: Thoracic internal boiler boosting heat stability and max steam reservoir.
  - `prosthetic_clockwork_gyrostabilizer_leg`: Silent counter-rotating flywheels for brisk locomotion without acoustic noise.
- **Surgical Context & Sterile Bonuses**: Installing or removing prosthetics in the field inflicts 15–20% blood loss shock. Performing surgery while adjacent to a `SURGICAL_TABLE` or having the `DISGRACED_CHIRURGEON` profession reduces surgical blood loss to 0%.

### 3.2. Cellular Automata Thermodynamics & Pyrotechnics
- **Double-Buffered Gas Grids**: Each stratum grid cell simulates:
  - `steamPressureKpa`: Compressed steam expanding and dissipating across open tiles.
  - `coalDustDensity`: Suspended particulate coal dust.
- **Vertical Gas Portals**: Rising steam naturally vents upward from `UNDERCROFT` to `STREET` through portals marked `conductsGas: true` (manholes, floor grates).
- **Thermal Scald Hazards**: Actors standing in tiles with `steamPressureKpa >= 25 kPa` suffer thermal scald damage to their torso every turn. Insulated clothing (e.g. Asbestos Foundry Coat) provides steam resistance.
- **Foundry Boilers & Ruptures**: Pressure vessels accumulate steam. Exceeding `maxPressureKpa` causes explosive vessel rupture, breaching adjacent soot brick walls, venting hundreds of kPa into surrounding tiles, and inflicting blast trauma.
- **Pyrotechnic Dust Explosions**: Emitting a spark (`EMIT_SPARK`) into a contiguous cloud of coal dust (`density >= 0.25`) ignites the cloud in a chain-reaction explosion that consumes the dust and flashes it into high-pressure steam.
- **Steam Reserves & Stoking**: High-tier prosthetics and weapons consume steam from `anatomy.steamReserveKpa`. Players stoke steam for free when adjacent to an active boiler, or consume portable steam canisters and anthracite coal briquettes.

### 3.3. Acoustic Propagation, Smog Occlusion Stealth & Sensory AI
- **Decibel Sound Propagation**: Physical actions emit acoustic pulses (`SOUND_EMITTED`) with inverse-distance falloff:
  - Smashing glass windows: `85 dB`
  - Pneumatic gunfire: `95 dB`
  - Boiler ruptures: `120 dB`
  - Movement footsteps: Base `10 dB`, increased by heavy/pneumatic prosthetics (`noiseDb`) or reduced by silent clockwork flywheels.
- **Sensory NPC State Machine**: NPCs transition dynamically through `IDLE`, `INVESTIGATING`, and `COMBAT`. Sounds lure out-of-sight guards to inspect `lastKnownTargetPos`.
- **Smog & Steam Occlusion**: High-density particulate clouds (`steamPressureKpa >= 20 kPa` or `coalDustDensity >= 0.3`) completely block line of sight, allowing players to vent steam or stir coal dust to break pursuit and evade enemy gunfire.
- **Ocular Blindness**: Actors whose `OCULAR_MOUNT` is amputated (without an installed optic prosthetic) are clamped to a visual radius of 1 tile, requiring acoustic cues or touch to navigate.

### 3.4. Diurnal Shift Clocks, Autonomous Ecology & District Catch-Up
- **100-Turn Victorian Shift Clocks**: Districts cycle through 4 distinct 25-turn shift phases:
  - `DAWN_WHISTLE` (Turns 0–24)
  - `FOUNDRY_SHIFT` (Turns 25–49)
  - `GASLIGHT_CURFEW` (Turns 50–74)
  - `GRAVEYARD_WATCH` (Turns 75–99)
- **Autonomous NPC Schedules**: During `FOUNDRY_SHIFT`, workers and shopkeepers pathfind to their `workAnchor` and restock trade pedestals. During `GRAVEYARD_WATCH`, citizens retire to their `restAnchor`.
- **Ecology & Medical Triage**: Wounded NPCs (`bloodVolumePct <= 60%`) carry and self-administer Coagulant Tonics. If critically injured (`bloodVolumePct <= 50%`) with no tonics, their goal transitions to `SEEK_MEDICAL` as they seek out the nearest Chirurgeon or Surgical Table.
- **Deterministic District Catch-Up**: Cached districts in `state.savedDistricts` fast-forward elapsed turns upon re-entry, decaying suspended steam and coal dust and snapping scheduled NPCs to their active shift coordinates.

### 3.5. Structural Breaching, Multi-Strata Gravity Falls & Traps
- **Destructible Architecture**: High-magnitude concussive forces (boiler ruptures or pneumatic piledriver strikes) breach rigid `SOOT_BRICK_WALL` structures into traversable `RUBBLE_PILE` debris, venting trapped steam clouds and opening new infiltration routes.
- **Multi-Strata Gravity Falls**: Pushing or knocking an actor into an `ABYSS_DROP` on the `SPIRE` catwalk causes a multi-strata plunge down to the `STREET` below. Falls inflict 20 HP blunt trauma to both legs; socketed pneumatic leg prosthetics absorb 50% of fall impact.
- **Deployable Clockwork Traps**: Players and artificers craft and place hidden mechanical traps:
  - `SPARK_TRIPWIRE`: Emits a friction spark when stepped on, detonating flammable coal dust pockets.
  - `SPRING_JAW`: Snaps shut on unsuspecting limbs, inflicting heavy bone and tissue damage.
  - `STEAM_MINE`: High-pressure pneumatic mine that blasts intruders with concussive scalding steam.

### 3.6. Tactical Combat & Ballistics
- **Turn Scheduling**: Actions spend Action Points (AP). Standard turn is 100 AP. Speed modifications alter turn frequency relative to the global clock.
- **Targeted Melee**: Attackers target specific limbs (`1`–`6` hotkeys in Look Mode or contextual click), calculating damage against targeted armor reduction.
- **Pneumatic Ballistics**: Ranged weapons (e.g. Pneumatic Harpoon Rifle) consume compressed steam reserve, trace 8-octant Bresenham line-of-sight and range, verify lack of intervening obstacles, and apply targeted impact damage.

### 3.7. Unified Mortality & Victorian Coroner's Morgue
- **Unified Mortality Pipeline**: Fatal conditions (`TORSO.hp <= 0`, `HEAD.hp <= 0`, or `bloodVolumePct <= 0`) uniformly resolve through `resolveActorDefeatIfFatal()` across melee, ranged fire, steam scalds, falls, and boiler explosions.
- **Loot & Economy Drops**: Defeated NPCs drop all carried satchel inventory, installed prosthetics, and a minted Crown Pence pouch on their coordinate before being removed from the simulation.
- **Player State Preservation**: Upon player death, `actor_player` is preserved in `WorldState.entities` rather than purged.
- **Coroner's Inquest (Morgue Screen)**: Triggers an obituary screen presenting autopsy findings (thoracic rupture, decapitation, exsanguination), turn count, death coordinate, and inventory effects, with a `[New Character / Re-Embark (N)]` restart loop.

### 3.8. Dynamic Cartel Economy, Trade & Dialogue
- **Macro-Tick Simulation**: Every 100 turns, an economic macro-tick updates supply and demand across factions (`IRONMONGERS_CARTEL`, `CLOCKWORK_GUILD`, `UNDERCROFT_SYNDICATE`, `CROWN_CONSTABULARY`).
- **Dynamic Commodity Pricing**: Market prices for Anthracite Coal, Brass Gears, Rubber, and Aether Salt fluctuate based on local district scarcity and supply shocks.
- **Grounded Storefront Pedestals**: Merchants stock physical `tradePedestal` entities in shops. Players interact with pedestals or NPCs directly to buy and sell.
- **Interactive Dialogue & Procedural Contracts**: NPCs feature tree-based dialogue providing:
  - Faction contracts (`SLAY_HOSTILE`, `DELIVER_ITEM`, `PRESSURIZE_BOILER`) offering Crown Pence and reputation.
  - Companion recruitment for hired muscle.
  - Chirurgeon medical services to suture amputated limbs and replenish blood volume.

### 3.9. Artificer Crafting & Scrap Salvage
- **Schematic Workbenches**: Adjacent Artificer Benches and Alchemical Stills enable crafting tonics, steam canisters, commodities, traps, and cybernetics.
- **Equipped Gear Drop & Salvage Stat Fix**: Dropping or salvaging wielded weapons or worn armor automatically unequips them first, cleanly reversing `meleeDamageBonus`, `armorBonus`, and `storageVolumeBonusMl` without leaving ghost stat bonuses.
- **Manuals & Knowledge**: Schematic Manuals found in libraries or bookshelves permanently unlock high-tier recipes when read.

### 3.10. Procedural World Generation, CDDA Building Templates & Continuous District Seams
- **5 Overworld Districts**:
  1. `district_spitalfields_soot_works`: Industrial foundry district with Bessemer converter halls, heavy boilers, smog, and Ironmongers' workshops.
  2. `district_fleet_ditch_undercroft`: Canal slums with pawnshops, black-market fixers, and Undercroft Syndicate outposts.
  3. `district_belgravia_brass_spires`: High-society spires with Clockwork Guild salons and Constabulary toll checkpoints.
  4. `district_whitechapel_ward`: Quarantined hospital ward with hierarchical CDDA urban blocks, chirurgeons, operating tables, and medical caches.
  5. `district_limehouse_docks`: Fog-shrouded riverfront with bonded warehouses, timber piers, canal sluices, and maritime smuggling.
- **CDDA-Style Declarative Building Templates & Multi-Room Zoning**:
  - Buildings are instantiated from ASCII legend templates (`src/sim/spatial/building-templates.ts`, `building-templates-expanded.ts`) and multi-room floorplans (`interior-zoning.ts`) with typed interior zones (`RECEPTION`, `WORKSHOP`, `VAULT`, `SURGICAL_BAY`, `STORAGE`, `DORMITORY`, `PLATFORM`, `TICKET_BOOTH`).
- **Continuous District Border Seams & Lookahead Projection**:
  - District perimeters feature reciprocated open border seams (`OPEN_STREET`, `CANAL_BRIDGE`, `VIADUCT_ARCH`, `TOLL_ARCH`) computed by `computeDistrictBoundarySeams` and carved into the street grid via `applyBoundarySeamsToGrid`.
  - Approaching an open border projects a live `0.65`-alpha lookahead of the neighboring district (`resolveContinuousLookaheadCell`), and stepping across the border translates coordinates seamlessly (`continuousTransitSystem`) while keeping active companions at the player's side (`COMPANION_TRANSIT_PRESERVED`).
- **Fallout: New York 6-Layer Spatial Survey & Self-Healing Worldgen (`npm run survey:world`)**:
  - Every generated district is audited against `runDistrictSurveyAudit` and `runSpatialAnomalyAudit` (`SEALED_DISTRICT_EDGE = 0`, `UNRECIPROCATED_SEAM = 0`, `ORPHAN_DOOR = 0`, `BLOCKED_DOORWAY = 0`), with 6-layer ASCII survey sheets emitted to `tests/artifacts/survey-sheets/`.

---

## 4. Current Implementation Scope vs. Reality & Limitations

To provide complete transparency for future AI agents and contributors, here is the exact reality of current systems:

| System | Current Implementation Reality | Current Scope Limitations |
| :--- | :--- | :--- |
| **World Persistence & Continuity** | Active district simulated live in memory with seamless edge-seam transit (`continuousTransitSystem`), companion preservation, and cross-border lookahead projection. Inactive districts are cached in `state.savedDistricts` and execute deterministic delta catch-up upon re-entry. | Catch-up is analytical; off-screen districts do not simulate full turn-by-turn combat while the player is away. |
| **NPC AI & Ecology** | NPCs feature role-based AI, 4-quadrant diurnal shift schedules (work/rest), self-medication, medical triage pathfinding, sound investigation, witness crime reporting, and merchant pedestal restocking. | Non-companion NPCs do not yet migrate between different districts independently. |
| **Combat & Sensory Stealth** | Full 8-octant shadowcasting FOV, particulate smog/steam LOS attenuation, gaslight illumination radius, ocular blindness clamping, acoustic decibel propagation, postures (`STANDING`, `CROUCHED`, `BRACED`), targeted limb combat, knockback, and deployable traps. | No directional cone facing mechanics; NPCs perceive in 360° within their effective sight/hearing radius. |
| **Physics & Destruction** | Structural soot brick walls can be breached into rubble piles via concussive forces. Actors knocked into Spire abyss chasms plunge down to the Street stratum with fall trauma. Surface liquids (`BLOOD`, `WHALE_OIL`, `NITRIC_ACID`, `SLUICE_SLUDGE`) ignite or corrode. | Wood/metal furniture is destroyed, pried, or looted rather than splintered into multi-tile shrapnel. |
| **Grounded Trade** | Merchants own physical storefront pedestal entities. Prices react dynamically to supply shocks and faction turf tariffs, and shopkeepers restock pedestals during active work shifts. | Autonomous non-player citizens do not yet barter or buy items off pedestals. |
| **ProcGen & Visual Survey** | 8-stage seed-deterministic pipeline with CDDA building templates, hierarchical urban parcels (`48x36` and `64x48`), reciprocated border seams, and automated 6-layer spatial anomaly auditing (`npm run survey:world`). | Building interiors are single-story per stratum; verticality within a building uses stratum portals (`UNDERCROFT` / `STREET` / `SPIRE`). |
| **Presentation Shell** | PixiJS v8 Canvas rendering, 3-mode presentation switcher (`ASCII`, `ENHANCED_GLYPHS`, `TILESET` via `[F2]`), Oxidized Iron palette, 4-pass GLSL CRT/gaslight shader, procedural WebAudio synth (`src/client/audio/`), and Preact/Canvas HUD modals. | Graphical `TILESET` mode uses procedurally synthesized 16×16 pixel-art sprites rather than external PNG sprite sheets. |

---

## 5. Controls Reference

| Context | Hotkey | Function |
| :--- | :--- | :--- |
| **Movement** | `W / A / S / D` or `Arrow Keys` | Move 1 tile cardinally |
| **Pass Turn** | `.` (period) or `Space` | Wait 1 turn (100 AP) |
| **Pickup** | `g` or `,` | Pick up ground items at current tile |
| **Stairs / Portals** | `>` / `<` / `Enter` | Ascend / descend strata (Manholes, Lifts, Ladders, District Gates) |
| **Look / Target Mode** | `L` | Toggle targeting cursor on/off |
| In Look Mode | `W / A / S / D` | Move inspection cursor |
| In Look Mode | `Enter` | Interact with targeted tile (Toggle door, loot container, stoke boiler) |
| In Look Mode | `1` – `6` or `F` | Target enemy limb (`1` Head, `2` Torso, `3` L.Arm, `4` R.Arm, `5` L.Leg, `6` R.Leg, `F` Torso quick strike) |
| **Satchel / Inventory** | `I` | Open Satchel window (equip, drop, drink tonics) |
| **Vitruvian Anatomy** | `Shift + A` | Open Anatomy window (inspect limbs, blood %, steam kPa, socket cybernetics) |
| **Artificer Workbench** | `C` | Open Workbench window (craft recipes, repair limbs, salvage scrap) |
| **Merchant Exchange** | `M` | Open Merchant Trade ledger |
| **World Atlas** | `Shift + W` | Open 5-district Overworld Atlas |
| **Dialogue** | `T` | Talk to adjacent NPC (contracts, companions, surgery) |
| **New Character** | `N` | Open Character Creation modal (choose profession & scenario) |
| **Presentation Mode** | `F2` | Cycle visual presentation mode (`ASCII` -> `ENHANCED_GLYPHS` -> `TILESET`) |
| **System Menu** | `Esc` | Open Save/Load/Seed menu (or dismiss open modal / look mode) |

---

## 6. Verification Pipeline

Every contribution must pass the mandatory four-stage gate (enforced locally via `npm run verify` and on GitHub Actions CI via `.github/workflows/ci.yml`):

```bash
npm run verify
```

1. **`npm run typecheck`**: Strict TypeScript verification (`noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`).
2. **`npm run check:boundaries`**: Enforces strict Core/Shell isolation (no DOM or non-deterministic PRNG tokens in `src/sim/`) and enforces the 300-line modularity ceiling across all 453 source/test files.
3. **`npm run validate:data`**: Validates all declarative JSON blueprints in `data/` against Zod schemas.
4. **`npm run test:sim`**: Executes all 129 headless deterministic test suites (677 tests).

For changes touching `src/sim/spatial/` (worldgen, building templates, or district boundaries), also run the 6-layer spatial anomaly survey:
```bash
npm run survey:world -- --seeds 4 --out tests/artifacts/survey-sheets
```

---

## 7. Headless Autonomous LLM Playtester Suite

To validate systemic emergence without requiring human manual playthroughs, *Aether & Soot* includes an autonomous, headless LLM playtester in `tests/scripts/`.

### Why It Exists
- **Sandbox Emergence Testing**: Evaluates how complex, interacting systems (acoustic decibels, smog sight attenuation, trap triggers, steam deployment, wound stabilization, trade) function together across 30–500 turns.
- **Autonomous Regression Discovery**: Detects stuck oscillation loops, pathfinding bumps, economic stalls, and lethal balance regressions in an isolated, headless simulation.

### Architecture & Data Flow
1. **Context Serializer (`tests/scripts/playtester-serializer.ts`)**: Generates an 11x11 relative ASCII FOV grid centered on the player `@`, vitals (Blood %, Steam kPa), recent acoustic sound emissions, breadcrumb history `[Recent Steps: ...]`, engine bump feedback `[SYSTEM FEEDBACK: ...]`, and dynamic `[AVAILABLE CONTEXTUAL COMMANDS]`.
2. **Autonomous Agent**:
   - **Local LLM Endpoint**: Sends prompts to the local Ollama instance (`http://localhost:11434/v1/chat/completions`) using Tier 3 model routing (`hermes3:8b`).
   - **Deterministic Mock Agent (`--mock`)**: A rule-based fallback agent for fast CI verification that explores unvisited tiles, disarms/avoids traps, vents steam if hostiles are in range, and trades/heals when wounded.
3. **Resilient Command Parser**: Parses JSON payloads (`{"action": "MOVE", "dir": "N"}`, `{"action": "BUY", ...}`, `{"action": "VENT_STEAM", ...}`) and natural language fallbacks into strict `GameCommand` objects.
4. **Scenarios (`tests/scripts/playtester-scenarios.ts`)**:
   - `explore`: Open-ended district reconnaissance and hazard avoidance.
   - `combat`: Engages an alert Clockwork Automaton Warden at close range with high boiler steam.
   - `economy`: Isolates the player in an Apothecary shop with wounded vitals to verify merchant purchases and tonic consumption.
   - `transit`: Tests navigation through traps and locked security doors to reach vertical stratum stairs.
5. **Telemetry Reporter (`tests/scripts/playtest-report.ts`)**: Generates comprehensive markdown summaries in `tests/artifacts/playtest-report.md` tracking decibels emitted, alert transitions, steam clouds deployed, combat hits/misses, damage dealt/taken, items acquired/used, and unique tiles visited.

### Execution Commands
```bash
# Run CI-friendly deterministic mock agent (zero network calls, 100 turns)
npm run playtest:mock

# Run live against local Ollama endpoint (Tier 3: hermes3:8b)
npm run playtest -- --scenario economy --turns 30
```

---

## 8. Zero-Token Content Generation (Ollama 3-Tier Routing)

To conserve paid LLM context tokens during world-building and codebase evolution, *Aether & Soot* includes an offline local model stack routed across three specialized Ollama tiers (`http://localhost:11434/v1/chat/completions`):
- **Tier 1 (`lfm2.5:24b`)**: Deep reasoning, architectural emergence audits, and post-phase critiques (`npm run hermes:critic`).
- **Tier 2 (`gemma4:12b-extended`)**: AST analysis, pre-flight scouting, automated test scaffolding, and modularity file-splitting (`npm run hermes:scout`, `npm run hermes:testgen`, `npm run hermes:split`).
- **Tier 3 (`hermes3:8b`)**: Fast declarative blueprints, ambient flavor logs, narrative barks, and autonomous playtesting (`npm run generate:content`, `npm run hermes:chronicler`, `npm run playtest`).

### Why It Exists
- Generates bulk declarative JSON data (materials, consumables, crafting recipes) using the local, free Ollama endpoint (`http://localhost:11434`).
- Automatically coerces types, strips invalid LLM tokens, and validates all generated blueprints against strict Zod schemas (`ItemBlueprintSchema`, `CraftingRecipeBlueprintSchema`).
- Appends clean records directly into `data/items/materials.json` or `data/items/recipes.json` without burning developer or Gemini tokens.

### Usage
```bash
# Generate deterministic mock items (no network calls, CI-safe)
npm run generate:content:mock -- --type materials --count 3

# Generate live Victorian materials using local Ollama (hermes3:8b) and append to data/
npm run generate:content -- --type materials --count 2 --theme "Whitechapel gas lanterns and soot pipes" --append
```

---

## 9. Role-Based Routing Matrix

To keep context windows lean and prevent architectural drift, contributors and agents must route through designated entry points:

| Role / Persona | Focus Domain | Key Documentation & Guidelines | Primary Tools & Commands |
| :--- | :--- | :--- | :--- |
| **Executive AI Agent** (Antigravity / Argon) | Full-stack orchestration, ECS core, client projection, schema updates | `AGENTS.md`, `ARCHITECTURE.md`, `docs/DESIGN_INTENT.md`, `STATE.md`, `.agents/rules/` | `npm run verify`, `npm run survey:world`, `npm run hermes:critic`, `npm run sync:state` |
| **Local Model Worker** (Ollama Tiers 1–3) | Bulk blueprints, test scaffolding, AST file splitting, playtesting | `.agents/skills/hermes-tooling/SKILL.md`, `.agents/skills/content-generation/` | `npm run hermes:scout`, `npm run hermes:testgen`, `npm run generate:content` |
| **Worldgen & Spatial Architect** | CDDA building templates, urban parcels, continuous seams, survey sheets | `.agents/skills/worldgen-survey/SKILL.md`, `docs/DESIGN_INTENT.md` | `npm run survey:world`, `npm run test:sim` |
| **Human System Architect** | Balance evaluation, roadmap gating, design pillar arbitration | `docs/DESIGN_INTENT.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `tests/artifacts/` | `npm run playtest`, `npm run build && npm run preview` |
| **Procedural Lore Designer** | Markov dialogue, district flavor, bark corpora, item lore | `.agents/rules/lore-procgen.md`, `docs/DESIGN_INTENT.md`, `data/corpora/` | `npm run generate:content`, `npm run hermes:chronicler` |

---

## 10. Live Architectural & Gameplay Telemetry

| Metric / Dimension | Current Value | Verification Gate / Validator |
| :--- | :--- | :--- |
| **Deterministic Unit Test Suites** | 129 suites (677 tests passing, 0 failures) | `npm run test:sim` (`vitest run`) |
| **TypeScript Typecheck** | 0 errors (`strict: true`, `noUncheckedIndexedAccess: true`) | `npm run typecheck` (`tsc --noEmit`) |
| **Architectural Boundaries** | 453 source/test files checked (0 violations, hard 300-line cap) | `npm run check:boundaries` |
| **World Spatial Survey Audit** | 0 anomalies across all 5 districts (`SEALED_DISTRICT_EDGE = 0`, `ORPHAN_DOOR = 0`) | `npm run survey:world` |
| **Agent Governance Health** | 100% PASS (3 progressive disclosure rules, pre-tool hooks, 9 skills) | `npm run check:governance` |
| **Vision Critic UI Score** | 98/100 (100% modal pass, 0 atlas leaks, 0 collisions) | `npm run hermes:vision:mock` |
| **Declarative JSON Blueprints** | 50+ blueprints across 5 districts, 9 recipes, 5 prosthetics, 7 corpora | `npm run validate:data` |
| **Target Viewport Resolution** | 88×36 character cells (3-mode `ASCII` / `ENHANCED_GLYPHS` / `TILESET`) | `src/client/projection/frame-adapter.ts` |
| **Tactical Modal Screens** | 7 diegetic modals (Satchel, Anatomy, Workbench, Exchange, Atlas, Codex, Embark) | `src/client/canvas-ui/modal-buffer-router.ts` |

