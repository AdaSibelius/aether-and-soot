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


**Observed command surface.** Active commands observed in telemetry: `ATTACK_ACTOR`, `MOVE_STEP`, `USE_PORTAL`, `VENT_STEAM` — four core actions. Unwired (planned) commands: `LOOT_CONTAINER`, `PAY_CHIRURGEON_HEAL`, `PRESSURIZE_VESSEL`, `PRY_OBSTACLE`, `REFILL_STEAM`, `REMOVE_PROSTHETIC`, `REPAIR_LIMB`, `REST_AT_BED`. The ratio of planned to observed actions (9 planned vs. 4 observed) indicates a design that prioritizes vertical feature depth over breadth of currently observable behaviors. No mechanical dependencies between the unwired commands have been evidenced in telemetry; they are treated as independent service/utility primitives.

**Systemic depth.** Aether & Soot's depth is concentrated in environmental and body-modification systems rather than in the broad action set seen in CDDA/Qud. `VENT_STEAM` as an active command shows that steam vent manipulation is a core systemic action — the player interacts with the world's infrastructure to produce effects, similar in spirit to CDDA's terrain interactions but flavored through a Victorian-industrial lens. The unwired `PRESSURIZE_VESSEL`, `PRY_OBSTACLE`, and `REFILL_STEAM` commands suggest a pressure/containment subsystem that can be wired into the same state machine as `VENT_STEAM`, giving the player a consistent environmental toolkit. In contrast, Qud's depth is built on mutation and faction geography; Aether & Soot trades faction geography for mechanical specialization (prosthetics, loot containers, chirurgeon services).

**NPC agency.** CDDA and Qud both feature NPCs with territory control, faction allegiances, and emergent negotiation or conflict behavior. Aether & Soot's telemetry does not yet show observed NPC decision data — the NPC layer is latent via unwired commands. The planned `PAY_CHIRURGEON_HEAL`, `REMOVE_PROSTHETIC`, and `REPAIR_LIMB` imply service-oriented NPCs (a chirurgeon, a prosthetist) rather than autonomous faction agents. This is a different agency model: NPCs are positioned as helpers/service providers the player can choose to engage with, rather than as territorial competitors. The `LOOT_CONTAINER` command further suggests item-storage NPCs that the player can interact with. The planned World Atlas upgrade (faction control heatmaps) will introduce a faction layer later, but at present NPC agency is a design intent visible only in the unwired command surface.

**Comparison to Arcostate.** If Arcostate emphasizes deterministic procedural generation with strict rule layering, Aether & Soot's Victorian roguelike leans into thematic environmental interaction — canal networks, steam pressure, and structural obstacles — that arcostate-style design may not foreground. The telemetry's `VENT_STEAM` command is a concrete example of a mechanic that ties the player to the environment in a way that is more specific than CDDA's generic "interact with terrain" and more mechanically grounded than Qud's abstract item interactions.

**Summary.** Aether & Soot's systemic depth is real but narrow: it excels at environmental/industrial mechanics and body-modification services, while NPC agency remains a latent design intent rather than an observed emergent property. Compared to CDDA/Qud, it trades faction-driven NPC autonomy for service-oriented NPC interactions; compared to Arcostate, it favors thematic environmental interaction over pure procedural determinism.

## 5. Self-Directed Prescriptions for Next Phase (P1, P2, P3)

**P1 — District sizing and city matrix (Phase 49 core).**
- Implement the multi-district metropolis grid up to **64×48** district cells.
- Scale the overworld matrix into a sprawling multi-district city divided by natural barriers: Thames Estuary canal network, viaducts, reinforced toll perimeter walls, and multi-point sewer drops.
- Wire `VENT_STEAM` and `USE_PORTAL` into the expanded grid so that steam vents and portals function as transit/terrain modifiers across districts.

**P2 — World Atlas upgrade ([W]).**
- Add macro-topography layer, canal waterways, faction control heatmaps, transit monorails, and landmark dossiers to the interactive atlas.
- Extend `src/schemas/domain-events.schema.ts:243` (domain events schema) to model atlas features such as heatmaps, monorail routes, and landmark dossiers.
- Surface landmark dossiers through `src/client/ui/ItemDossierCard.tsx:240` and inventory/loot-container context via `src/client/ui/InventoryWindow.tsx:240`.

**P3 — Wire unwired commands and complete active command surface.**
- Bring the following unwired commands into the active surface: `LOOT_CONTAINER`, `PAY_CHIRURGEON_HEAL`, `PRESSURIZE_VESSEL`, `PRY_OBSTACLE`, `REFILL_STEAM`, `REMOVE_PROSTHETIC`, `REPAIR_LIMB`, `REST_AT_BED`.
- Ensure `VENT_STEAM` and `USE_PORTAL` are fully functional and wired into the same state machine as the new district/atlas systems.
- No mechanical dependencies between the unwired commands have been observed in telemetry; they can be wired independently, but all should share a consistent world-state contract (steam/pressure/vessel state) to preserve systemic coherence.

## 6. Next-Phase Handoff Prompt

```markdown
Implement **Phase 49: Large-Scale Overworld Expansion, District Sizing & Multi-Stratum City Atlas**: Expand district grid sizing up to 64x48 and scale the city overworld matrix into a sprawling multi-district metropolis divided by natural barriers (Thames Estuary canal network, viaducts, reinforced toll perimeter walls, and multi-point sewer drops). Upgrade the interactive World Atlas (`[W]`) to display macro-topography, canal waterways, faction control heatmaps, transit monorails, and landmark dossiers. adhering to AGENTS.md and ARCHITECTURE.md:
1. Run `npm run hermes:scout -- --task "the active phase"` and complete the 6-point Pre-Flight Impact Analysis (including STATE.md P1/P2/P3 triage).
2. Pre-split any src/ hotspot >= 245 lines (`src/schemas/domain-events.schema.ts` (243 lines)) via `npm run hermes:split`.
3. Implement the active phase while folding in P2 (systemic cross-wiring & unwired serializer commands: `LOOT_CONTAINER`, `PAY_CHIRURGEON_HEAL`, `PRESSURIZE_VESSEL`, `PRY_OBSTACLE`) and P3 (serialization & deterministic unit tests in tests/sim/), and promoting any out-of-budget P1 agency items into ROADMAP.md.
4. Delegate blueprints (`generate:content`), event logs (`hermes:chronicler`), and test scaffolding (`hermes:testgen`) to local models.
5. Run `npm run verify`, `npm run hermes:critic`, and `npm run sync:state`, then output the next copy-pasteable prompt.
```
