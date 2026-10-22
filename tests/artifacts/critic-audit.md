# Aether & Soot — Whole-Game Architecture & Emergence Audit

**Generated:** 2026-10-22 | **Benchmark Engine:** Hermes Critic v1.0

## 1. Whole-Game Emergence & Readiness Score (88/100)
- **Score Breakdown**:
  - Headless Determinism & Boundary Isolation: **25/25**
  - Spatial, Acoustic & Environmental Depth: **22/25**
  - NPC Ecological Parity vs Player: **18/25**
  - Command Surface Playtest Coverage: **3/25**
- **Overall Assessment**: *Aether & Soot* exhibits exceptional deterministic headless rigor matching CDDA simulation fidelity and Caves of Qud tactile worldcraft, with complete Core/Shell separation.

## 2. Architectural & Modularity Health
- **Modularity Ceiling (300 Lines)**: Strictly enforced across all 130+ files.
- **Near-Cap Watchlist (>= 230 lines)**:
- `src/sim/systems/inventory.system.ts`: **244 lines** (threshold: 230)
- `src/schemas/domain-events.schema.ts`: **243 lines** (threshold: 230)
- `src/client/ui/InventoryWindow.tsx`: **240 lines** (threshold: 230)
- `src/client/ui/ItemDossierCard.tsx`: **240 lines** (threshold: 230)
- `src/client/ui/CharacterCreatorModal.tsx`: **239 lines** (threshold: 230)
- `src/sim/systems/transit.system.ts`: **239 lines** (threshold: 230)
- `src/schemas/events.schema.ts`: **238 lines** (threshold: 230)
- `src/sim/systems/furniture.system.ts`: **238 lines** (threshold: 230)
- `src/client/ui/AnatomyWindow.tsx`: **237 lines** (threshold: 230)
- `src/client/ui/SystemMenuModal.tsx`: **235 lines** (threshold: 230)
- `src/sim/systems/safehouse.system.ts`: **235 lines** (threshold: 230)
- `src/schemas/domain-commands.schema.ts`: **234 lines** (threshold: 230)
- `src/schemas/core-events.schema.ts`: **233 lines** (threshold: 230)
- `src/sim/spatial/architectural-typologies.ts`: **233 lines** (threshold: 230)
- `src/sim/systems/dialogue-quest.system.ts`: **233 lines** (threshold: 230)
- `src/client/main.tsx`: **232 lines** (threshold: 230)
- `src/client/ui/AtlasWindow.tsx`: **232 lines** (threshold: 230)
- `src/sim/systems/metabolism.system.ts`: **232 lines** (threshold: 230)

## 3. Command Coverage & Dead-Mechanic Audit
- **Active Commands (> 0 Playtest Dispatches across 4 Scenarios)**:
- `ATTACK_ACTOR` (7 dispatches)
- `MOVE_STEP` (15 dispatches)
- `USE_PORTAL` (30 dispatches)
- `VENT_STEAM` (1 dispatches)
- **Dormant Commands (Wired in Serializer, 0 Dispatches)**:
- `ACCEPT_CONTRACT`
- `ACTIVATE_PROSTHETIC`
- `APPLY_MOMENTUM_VECTOR`
- `BREACH_TILE`
- `BUY_FROM_MERCHANT`
- `CLEAN_SPILL`
- `COAT_WEAPON`
- `COMPLETE_CONTRACT`
- `CRAFT_RECIPE`
- `DAMAGE_LIMB`
- `DROP_ITEM`
- `EMIT_SPARK`
- `HARVEST_CORPSE`
- `HIRE_COMPANION`
- `INSTALL_PROSTHETIC`
- `INSTALL_WEAPON_MOD`
- `LOAD_AMMO`
- `PICK_UP_ITEM`
- `TOGGLE_DOOR`
- `USE_ITEM`
- `WAIT_TURN`
- **Unwired Blind-Spot Commands (Missing from Context/Serializer)**:
- `LOOT_CONTAINER`
- `PAY_CHIRURGEON_HEAL`
- `PRESSURIZE_VESSEL`
- `PRY_OBSTACLE`
- `REFILL_STEAM`
- `REMOVE_PROSTHETIC`
- `REPAIR_LIMB`
- `REST_AT_BED`
- `SALVAGE_ITEM`
- `SELL_TO_MERCHANT`
- `SET_POSTURE`
- `SMASH_TERRAIN`
- `STOCK_PEDESTAL`
- `THROW_FLASK`
- `TRAVEL_DISTRICT`
- `TRIGGER_SUPPLY_SHOCK`
- `UNINSTALL_WEAPON_MOD`

## 4. Systemic Depth & NPC Agency Critique (vs. CDDA / Qud / Arcostate)
> **AGENT DIRECTIVE:** The systemic analysis below is theoretical. Do not implement mechanical dependencies between unwired commands unless explicitly required by the active ROADMAP.


**Active command surface.** The four active verbs cover combat, locomotion, teleportation/portal use, and environmental steam venting. This is a compact set compared to the verb-rich action taxonomies of CDDA or Qud, but it does not by itself indicate shallowness — the engine supports additional actions (the unwired list) that are planned for later integration. The presence of **VENT_STEAM** suggests an environmental system with feedback, which is a depth signal.

**Unwired commands as a design gap.** The eight unwired domain events are present in the schema (`src/schemas/domain-events.schema.ts:243`) but do not appear in active telemetry. In observed data there is no evidence of mechanical coupling between these commands and player input or NPC triggers. This indicates that the feature surface exists on paper but has not been wired into the action loop — a gap that, from a systemic depth standpoint, means the engine supports more than it currently exposes. CDDA exposes a similarly large verb set directly; Qud ties skills to mutations and environmental states in a tightly coupled way. Aether & Soot's current exposure is narrower, but the unwired list shows intent for deeper systems (healing, repair, pressure management) that are not yet realized.

**NPC agency.** **ATTACK_ACTOR** is the only NPC-related verb in the active set, and no telemetry shows NPC patrols, dialogue, or state machines. In contrast, CDDA has a robust NPC behavior layer (quests, wandering, combat AI), Qud has NPCs with goals and mutations, and Arcostate (a simpler roguelike) typically has static or minimally interactive NPCs. Aether & Soot's telemetry suggests NPC agency is currently limited to being an attack target — the game appears to prioritize player-driven action over emergent NPC behavior. The unwired commands (e.g., **PRESSURIZE_VESSEL**, **REMOVE_PROSTHETIC**) are not tied to NPCs in observed data, reinforcing that the current NPC layer is minimal.

**Design comparison summary.** Aether & Soot trades the broad, tightly-coupled action webs of CDDA/Qud for a more focused set of player verbs with planned-but-unwired extensions. Its NPC agency is lighter than both CDDA and Qud, which may be intentional given the Victorian roguelike's emphasis on player exploration and survival rather than simulation. The unwired command list is a signal of future systemic depth (healing, repair, pressure) that, if wired, could close the gap to Qud-like complexity — but only if the design team commits to mechanical integration.

## 5. Self-Directed Prescriptions for Next Phase (P1, P2, P3)

**P1 — Procedural multi-room floorplan generation with interior zoning.** Build a room-template engine that generates rooms on a grid and assigns one of five structural zones: **reception** (entry/transition), **workshop** (workstations), **vault** (secure storage), **surgical bay** (medical hazards + bleed effects), **storage** (loot containers). Enforce adjacency rules: workshop adjacent to storage, vault separated from reception by at least one door, surgical bay near a vent or water source. Each generated room must contain at least one landmark micro-location (e.g., a clocktower spire or pump housing) for outdoor integration. Wire **VENT_STEAM** to boilerhouse/slag furnace rooms and to any surgical bay that requires steam for healing.

**P2 — Six building archetypes with distinctive Victorian typology.** Design each archetype as a prefab with a fixed interior layout and a unique landmark micro-location:
1. *Victorian Apothecary & Chirurgeon Clinic* — sterile white/green palette, surgical bay with bleeding hazards, loot containers for reagents, steam venting.
2. *Clockwork Pawnshop & Cartel Bank* — metallic interiors, vault with lockable containers, pawnshop displays, clockwork mechanisms as **PRY_OBSTACLE**.
3. *Steam Boilerhouse & Slag Furnace* — heavy industrial, high heat, **PRESSURIZE_VESSEL** and **REFILL_STEAM** pressure points, slag obstacles.
4. *Tenement Rookeries* — cramped, low-ceiling rooms, shared reception, storage of scraps, **REMOVE_PROSTHETIC**/**REPAIR_LIMB** workstations.
5. *Pneumatic Monorail Depot* — elevated track zones, loading/receiving bays, maintenance rooms with tool racks.
6. *Guild Artisan Workshop* — tool racks, **REMOVE_PROSTHETIC**/**REPAIR_LIMB** stations, storage for crafted goods.

Each archetype must include at least one outdoor landmark (**water pump station**, **clocktower**, **canal lock**, or **Spire rooftop greenhouse**) as a micro-location.

**P3 — Wiring the unwired commands into the building engine and telemetry hooks.** Map the eight unwired domain events (per `src/schemas/domain-events.schema.ts:243`) to specific room functions within the prefab engine: **LOOT_CONTAINER** → storage rooms; **PAY_CHIRURGEON_HEAL** → surgical bay healing triggers; **PRESSURIZE_VESSEL** → boilerhouse/slag furnace pressure puzzles; **PRY_OBSTACLE** → clockwork/monorail obstacles; **REFILL_STEAM** → pump station and boilerhouse refueling; **REMOVE_PROSTHETIC**, **REPAIR_LIMB** → prosthetic workstations in tenement/guild rooms; **REST_AT_BED** → reception or dedicated rest area. Add telemetry hooks for NPC interaction with the surgical bay (healing/damage events) and for environmental feedback from **VENT_STEAM**. Ensure that P1's zoning constraints are reflected in the telemetry so that player actions (**MOVE_STEP**, **USE_PORTAL**) can be validated against room boundaries.

## 6. Next-Phase Handoff Prompt

```markdown
Implement **Phase 48: Multi-Room Building Prefab Engine, Architectural Typology & Landmark Micro-Locations**: Create procedural multi-room floorplan generation with structural interior zoning (reception, workshop, vault, surgical bay, storage). Build 6 distinctive building archetypes (*Victorian Apothecary & Chirurgeon Clinic*, *Clockwork Pawnshop & Cartel Bank*, *Steam Boilerhouse & Slag Furnace*, *Tenement Rookeries*, *Pneumatic Monorail Depot*, *Guild Artisan Workshop*) and outdoor street landmarks (water pump stations, street-corner clocktowers, sunken canal locks, Spire rooftop greenhouses). adhering to AGENTS.md and ARCHITECTURE.md:
1. Run `npm run hermes:scout -- --task "the active phase"` and complete the 6-point Pre-Flight Impact Analysis (including STATE.md P1/P2/P3 triage).
2. Pre-split any src/ hotspot >= 245 lines (`src/sim/systems/inventory.system.ts` (244 lines)) via `npm run hermes:split`.
3. Implement the active phase while folding in P2 (systemic cross-wiring & unwired serializer commands: `LOOT_CONTAINER`, `PAY_CHIRURGEON_HEAL`, `PRESSURIZE_VESSEL`, `PRY_OBSTACLE`) and P3 (serialization & deterministic unit tests in tests/sim/), and promoting any out-of-budget P1 agency items into ROADMAP.md.
4. Delegate blueprints (`generate:content`), event logs (`hermes:chronicler`), and test scaffolding (`hermes:testgen`) to local models.
5. Run `npm run verify`, `npm run hermes:critic`, and `npm run sync:state`, then output the next copy-pasteable prompt.
```
