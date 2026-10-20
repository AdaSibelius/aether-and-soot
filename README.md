# Aether & Soot (Victorian Steampunk 2D Roguelike)

> **Autonomous AI Engineering Context**: This document serves as the comprehensive architectural and systemic dossier for *Aether & Soot*. It explains every implemented gameplay mechanic, the rationale behind architectural invariants, the reality of current scope and limitations, and a complete technical reference for AI agents and human developers alike.

---

## 1. Executive Summary & Vision

*Aether & Soot* is a deterministic, 2D turn-based Victorian Steampunk roguelike set in an alternate 1888 subterranean London. The game combines the deep anatomical conditions, systemic material interactions, and survival mechanics of ***Cataclysm: Dark Days Ahead (CDDA)*** with the evocative CRT scanline shaders, glyph-based art direction, and tactile modal window ergonomics of ***Caves of Qud***.

The player navigates an urban sprawl stratified into three vertical planes:
1. **The Spire** (`SPIRE`): Elevated brass catwalks, steam towers, high-society conservatories, and Clockwork Guild workshops.
2. **The Cobblestone Street** (`STREET`): Ground-level industrial wards, sovereign storefronts, public houses, and smog-choked alleys.
3. **The Undercroft** (`UNDERCROFT`): Brick sewer corridors, sluice vaults, cartel smuggling dens, and hazardous gas pockets.

---

## 2. Architectural Invariants ("Why Things Are The Way They Are")

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
        Sys["Domain Systems\n(anatomy, combat, ballistics, thermo, mortality...)"]
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
- **Sub-Second Test Execution**: 23 test suites (102 tests) covering 5-district procgen, cellular automata, ballistics, and cartel economies run in **<800ms** in Node.js without spinning up headless browser overhead.
- **Strict Unidirectional Mutability**: The presentation shell (`src/client/`) only holds `Readonly<WorldState>`. State mutations can only happen by dispatching a validated `GameCommand` to `dispatchCommand()`.

### Why Deterministic PRNG & Flat Relational ECS Are Non-Negotiable
- **No Non-Deterministic Calls**: `Math.random()` and `Date.now()` are forbidden and blocked by automated boundary scanners.
- **Bit-Exact Replays & Saves**: `WorldState` stores the 4-element `xoshiro128**` tuple (`rngState`). Serializing `WorldState` at Turn 50 and restoring it guarantees identical simulation outcomes down to the exact damage roll.
- **No Circular Object References**: All entities live in a flat table `state.entities[entityId]`. Items in inventories or socketed cybernetics are stored as branded `EntityId` arrays and never as nested entity trees, ensuring clean JSON serialization.

### Why The Hard Modularity Ceiling (<= 250 Lines per File) Exists
- Long source files cause LLMs to drop context, hallucinate imports, or produce truncated edit blocks.
- Every `.ts` and `.tsx` file is bounded to **<= 250 lines** (hard automated ceiling: 300 lines enforced by `tests/scripts/check-boundaries.ts`). When a domain system grows, logic is proactively extracted into dedicated sibling modules (e.g. `surgical-context.ts`, `crafting-utils.ts`, `boiler-stoking.system.ts`).

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
  - Torso or Head destruction results in immediate defeat.
- **Haemodynamic Blood System**: Actors track `bloodVolumePct` (0–100%). Wounds cause bleeding; amputations cause severe acute haemorrhage. Falling to 0% blood volume results in fatal exsanguination.
- **Coagulant Tonics**: Consuming Dr. Halloway's Coagulant Tonic stops active blood loss and restores blood volume.
- **Pneumatic Cybernetic Prosthetics**: Amputated or augmented slots can receive socketed steam prosthetics:
  - `prosthetic_pneumatic_leg_mk1`: Restores locomotion and grants -15 AP movement speed.
  - `prosthetic_clockwork_ocular_lens`: Expands FOV radius through soot and smog.
  - `prosthetic_pneumatic_piledriver_arm`: Heavy hydraulic arm for high-impact melee trauma.
  - `prosthetic_boiler_core_furnace`: Thoracic internal boiler boosting heat stability and max steam reservoir.
  - `prosthetic_clockwork_gyrostabilizer_leg`: Precision counter-rotating flywheels for brisk locomotion.
- **Surgical Context & Sterile Bonuses**: Installing or removing prosthetics in the field inflicts 15–20% blood loss shock. Performing surgery while adjacent to a `SURGICAL_TABLE` or having the `DISGRACED_CHIRURGEON` profession reduces surgical blood loss to 0%.

### 3.2. Cellular Automata Thermodynamics & Pyrotechnics
- **Double-Buffered Gas Grids**: Each stratum grid cell simulates:
  - `steamPressureKpa`: Compressed steam expanding and dissipating across open tiles.
  - `coalDustDensity`: Suspended particulate coal dust.
- **Vertical Gas Portals**: Rising steam naturally vents upward from `UNDERCROFT` to `STREET` through portals marked `conductsGas: true` (manholes, floor grates).
- **Thermal Scald Hazards**: Actors standing in tiles with `steamPressureKpa >= 25 kPa` suffer thermal scald damage to their torso every turn. Insulated clothing (e.g. Asbestos Foundry Coat) provides steam resistance.
- **Foundry Boilers & Ruptures**: Pressure vessels accumulate steam. Exceeding `maxPressureKpa` causes explosive vessel rupture, venting hundreds of kPa into surrounding tiles, inflicting blast trauma and triggering cartel coal shortages.
- **Pyrotechnic Dust Explosions**: Emitting a spark (`EMIT_SPARK`) into a contiguous cloud of coal dust (`density >= 0.25`) ignites the cloud in a chain-reaction explosion that consumes the dust and flashes it into high-pressure steam.
- **Steam Reserves & Stoking**: High-tier prosthetics and weapons consume steam from `anatomy.steamReserveKpa`. Players stoke steam for free when adjacent to an active boiler, or consume portable steam canisters and anthracite coal briquettes.

### 3.3. Tactical Combat & Ballistics
- **Turn Scheduling**: Actions spend Action Points (AP). Standard turn is 100 AP. Speed modifications alter turn frequency relative to the global clock.
- **Targeted Melee**: Attackers target specific limbs (`1`–`6` hotkeys in Look Mode or contextual click), calculating damage against targeted armor reduction.
- **Pneumatic Ballistics**: Ranged weapons (e.g. Pneumatic Harpoon Rifle) consume compressed steam reserve, trace 8-octant Bresenham line-of-sight and range, verify lack of intervening obstacles, and apply targeted impact damage.

### 3.4. Unified Mortality & Victorian Coroner's Morgue
- **Unified Mortality Pipeline**: Fatal conditions (`TORSO.hp <= 0`, `HEAD.hp <= 0`, or `bloodVolumePct <= 0`) uniformly resolve through `resolveActorDefeatIfFatal()` across melee, ranged fire, steam scalds, and boiler explosions.
- **Loot & Economy Drops**: Defeated NPCs drop all carried satchel inventory, installed prosthetics, and a minted Crown Pence pouch on their coordinate before being removed from the simulation.
- **Player State Preservation**: Upon player death, `actor_player` is preserved in `WorldState.entities` rather than purged.
- **Coroner's Inquest (Morgue Screen)**: Triggers an obituary screen presenting autopsy findings (thoracic rupture, decapitation, exsanguination), turn count, death coordinate, and inventory effects, with a `[New Character / Re-Embark (N)]` restart loop.

### 3.5. Dynamic Cartel Economy, Trade & Dialogue
- **Macro-Tick Simulation**: Every 100 turns, an economic macro-tick updates supply and demand across factions (`IRONMONGERS_CARTEL`, `CLOCKWORK_GUILD`, `UNDERCROFT_SYNDICATE`, `CROWN_CONSTABULARY`).
- **Dynamic Commodity Pricing**: Market prices for Anthracite Coal, Brass Gears, Rubber, and Aether Salt fluctuate based on local district scarcity and supply shocks.
- **Grounded Storefront Pedestals**: Merchants stock physical `tradePedestal` entities in shops. Players interact with pedestals or NPCs directly to buy and sell.
- **Interactive Dialogue & Procedural Contracts**: NPCs feature tree-based dialogue providing:
  - Faction contracts (`SLAY_HOSTILE`, `DELIVER_ITEM`, `PRESSURIZE_BOILER`) offering Crown Pence and reputation.
  - Companion recruitment for hired muscle.
  - Chirurgeon medical services to suture amputated limbs and replenish blood volume.

### 3.6. Artificer Crafting & Scrap Salvage
- **Schematic Workbenches**: Adjacent Artificer Benches and Alchemical Stills enable crafting tonics, steam canisters, commodities, and cybernetics.
- **Equipped Gear Drop & Salvage Stat Fix**: Dropping or salvaging wielded weapons or worn armor automatically unequips them first, cleanly reversing `meleeDamageBonus`, `armorBonus`, and `storageVolumeBonusMl` without leaving ghost stat bonuses.
- **Manuals & Knowledge**: Schematic Manuals found in libraries or bookshelves permanently unlock high-tier recipes when read.

### 3.7. Procedural World Generation & District Biomes
- **5 Overworld Districts**:
  1. `spitalfields_works`: Industrial foundry district with heavy boilers, smog, and Ironmongers' workshops.
  2. `fleet_ditch`: Canal slums with high sewage, black-market fixers, and Undercroft Syndicate outposts.
  3. `belgravia_spires`: High-society spires with Clockwork Guild laboratories and Constabulary checkpoints.
  4. `whitechapel_ward`: Quarantined hospital ward with chirurgeons, operating tables, and medical caches.
  5. `limehouse_docks`: Fog-shrouded riverfront with cargo crates, fuel barges, and maritime smuggling.
- **Multi-Room Strata Dungeons (`48x36`)**:
  - `UNDERCROFT`: Carved subterranean sewer mazes with sluice corridors, brick chambers, Syndicate dens, and steam vents.
  - `SPIRE`: Elevated brass catwalk networks connecting tower platforms across open abyss drops.
- **District Transit & Caching**: Stepping on a `DISTRICT_GATE` (`Ω`) transitions the player across districts. Visited districts are preserved in `state.savedDistricts` so dropped items and building alterations persist on return.

---

## 4. Current Implementation Scope vs. Reality & Limitations

To provide complete transparency for future AI agents and contributors, here is the exact reality of current systems:

| System | Current Implementation Reality | Current Scope Limitations |
| :--- | :--- | :--- |
| **World Persistence** | Active district is simulated live in memory. Inactive districts are frozen in `state.savedDistricts` and rehydrated upon transit. | Inactive districts do not run background cellular automata or NPC movements while the player is away. |
| **NPC AI** | NPCs have role-based AI (`CITIZEN`, `MERCHANT`, `FIXER`, `CHIRURGEON`, `GUARD`, `BEAST`, `CULTIST`), Dijkstra/Chebyshev pathfinding, and targeted attacks. | NPCs do not have complex day/night schedules or needs (they do not sleep, eat, or migrate between districts autonomously). |
| **Combat & LOS** | Full 8-octant shadowcasting FOV, targeted limb combat, armor damage reduction, and ranged ballistics. | No stealth light levels, cover mechanics, or directional facing cones. |
| **Grounded Trade** | Merchants own physical storefront pedestal entities. Prices react dynamically to supply shocks and transactions. | Autonomous NPCs do not wander into shops to purchase items off pedestals. |
| **ProcGen** | Seed-deterministic layout carving with pre-fab building archetypes, openable doors, interactive furniture, and stratum dungeons. | World layout is generated per district on initial entry; there is no continuous seamless world streaming without gate transitions. |
| **Presentation Shell** | PixiJS v8 Canvas rendering, custom GLSL CRT scanline shader, Preact tactical HUD modals, and full keyboard routing. | No WebAudio sound effects or musical soundtrack currently implemented. |

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
| **System Menu** | `Esc` | Open Save/Load/Seed menu (or dismiss open modal / look mode) |

---

## 6. Verification Pipeline

Every contribution must pass the mandatory four-stage gate:

```bash
npm run verify
```

1. **`npm run typecheck`**: Strict TypeScript verification (`noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`).
2. **`npm run check:boundaries`**: Enforces strict Core/Shell isolation (no DOM or non-deterministic PRNG tokens in `src/sim/`) and enforces the 300-line modularity ceiling across all 105 source files.
3. **`npm run validate:data`**: Validates all declarative JSON blueprints in `data/` against Zod schemas.
4. **`npm run test:sim`**: Executes all 23 headless deterministic test suites (102 tests).
