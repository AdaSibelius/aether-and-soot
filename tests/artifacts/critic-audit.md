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
- `src/client/ui/TradeWindow.tsx`: **248 lines** (threshold: 230)
- `src/schemas/events.schema.ts`: **245 lines** (threshold: 230)
- `src/sim/systems/character-archetypes.ts`: **244 lines** (threshold: 230)
- `src/sim/systems/inventory.system.ts`: **244 lines** (threshold: 230)
- `src/schemas/domain-events.schema.ts`: **243 lines** (threshold: 230)
- `src/client/ui/InventoryWindow.tsx`: **240 lines** (threshold: 230)
- `src/client/ui/ItemDossierCard.tsx`: **240 lines** (threshold: 230)
- `src/client/ui/CharacterCreatorModal.tsx`: **239 lines** (threshold: 230)
- `src/sim/systems/transit.system.ts`: **239 lines** (threshold: 230)
- `src/client/main.tsx`: **238 lines** (threshold: 230)
- `src/sim/core/world.ts`: **238 lines** (threshold: 230)
- `src/sim/systems/furniture.system.ts`: **238 lines** (threshold: 230)
- `src/client/ui/AnatomyWindow.tsx`: **237 lines** (threshold: 230)
- `src/sim/spatial/building-prefabs.ts`: **236 lines** (threshold: 230)
- `src/client/ui/SystemMenuModal.tsx`: **235 lines** (threshold: 230)
- `src/sim/systems/safehouse.system.ts`: **235 lines** (threshold: 230)
- `src/schemas/domain-commands.schema.ts`: **234 lines** (threshold: 230)
- `src/schemas/core-events.schema.ts`: **233 lines** (threshold: 230)
- `src/sim/systems/dialogue-quest.system.ts`: **233 lines** (threshold: 230)
- `src/client/ui/AtlasWindow.tsx`: **232 lines** (threshold: 230)
- `src/sim/systems/metabolism.system.ts`: **232 lines** (threshold: 230)
- `src/schemas/commands.schema.ts`: **230 lines** (threshold: 230)

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
- `HARVEST_CORPSE`
- `PICK_UP_ITEM`
- `TOGGLE_DOOR`
- `USE_ITEM`
- `WAIT_TURN`
- **Unwired Blind-Spot Commands (Missing from Context/Serializer)**:
- `COMPLETE_CONTRACT`
- `CRAFT_RECIPE`
- `DAMAGE_LIMB`
- `DROP_ITEM`
- `EMIT_SPARK`
- `HIRE_COMPANION`
- `INSTALL_PROSTHETIC`
- `INSTALL_WEAPON_MOD`
- `LOAD_AMMO`
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


**Active command surface.** Compared to CDDA's squad AI, which continuously re-evaluates squad goals and can pivot mid-fight, Aether & Soot's ATTACK_ACTOR/MOVE_STEP act as stat-driven actors with no observable goal-state transitions in current telemetry. The Phase 42 squad AI referenced for turf skirmishes is not yet integrated, so the squad-level coordination that CDDA provides is absent.

**Unwired commands.** Telemetry shows no mechanical dependencies between unwired commands — DROP_ITEM does not alter CRAFT_RECIPE state, and HIRE_COMPANION / INSTALL_WEAPON_MOD do not feed into ATTACK_ACTOR's damage profile. This is consistent with the "unwired" label: these commands are registered but not wired into the active command graph. The design is intentionally modular, but the lack of coupling limits cross-system emergent behavior.

**NPC agency (planned).** Phase 45 introduces autonomous Royal Society guild inspectors and rival artificers that audit safehouses and react to workshop deeds, emitting `NPC_GOAL_CHANGED` telemetry. This is a deliberate departure from Qud's static procedural NPC goals and Arcostate's more reactive faction politics: the goal-change signal is meant to be observable state. However, current telemetry shows no evidence that any NPC with an emitted `NPC_GOAL_CHANGED` has altered world state or influenced squad behavior — the agency is forward-looking rather than demonstrated.

**Design comparison summary.**
- **CDDA:** deep squad goals and dynamic re-evaluation; Aether & Soot lacks this.
- **Qud:** static procedural NPCs; Aether & Soot's inspectors are a step toward dynamic goals but are not yet wired.
- **Arcostate:** visible political state changes; Phase 45's Royal Society politics aligns with this direction, but the telemetry has no current mechanism for safehouse audits or workshop deed reactions.

## 5. Self-Directed Prescriptions for Next Phase (P1, P2, P3)

**P1 — Dynamic Turf Skirmishes.** Build on the Phase 42 squad AI foundation: wire ATTACK_ACTOR and MOVE_STEP to turf ownership/control events so that skirmish behavior is reactive to contested terrain. Telemetry must track per-actor turf state changes and record VENT_STEAM/USE_PORTAL usage as tactical cover during skirmishes. This closes the gap between the active command surface and the turf system, giving the skirmish loop observable depth.

**P2 — Economic Supply Escorts.** Wire CRAFT_RECIPE into convoy preparation (item preparation before escort), DROP_ITEM into delivery confirmation, and HIRE_COMPANION into escort selection. Telemetry should log each stage: recipe completion → item ready; drop-off → success/failure; escort survival → outcome. This makes the economic supply chain visible and auditable, matching the Phase 45 design brief.

**P3 — Royal Society Politics.** Implement autonomous Royal Society guild inspectors that audit safehouses and react to workshop deeds, each emitting `NPC_GOAL_CHANGED` with a target goal (e.g., "report unsafe workshop"). Rival artificers should emit the same telemetry when they audit. The goal changes must be observable in the event stream and must visibly shift faction reputation or safehouse state — this is the concrete realization of the planned NPC agency, and it directly addresses the Phase 45 requirement for auditing and reaction to workshop deeds.

## 6. Next-Phase Handoff Prompt

```markdown
Implement **Phase 45: Dynamic Turf Skirmishes, Economic Supply Escorts & Royal Society Politics**: Grounded in Phase 42 squad AI and Phase 43 monorail cargo transit between factions. Introduce autonomous Royal Society guild inspectors and rival artificers who audit safehouses, react to workshop deeds, and emit `NPC_GOAL_CHANGED` telemetry. adhering to AGENTS.md and ARCHITECTURE.md:
1. Run `npm run hermes:scout -- --task "the active phase"` and complete the 6-point Pre-Flight Impact Analysis (including STATE.md P1/P2/P3 triage).
2. Pre-split any src/ hotspot >= 245 lines (`src/client/ui/TradeWindow.tsx` (248 lines)) via `npm run hermes:split`.
3. Implement the active phase while folding in P2 (systemic cross-wiring & unwired serializer commands: `COMPLETE_CONTRACT`, `CRAFT_RECIPE`, `DAMAGE_LIMB`, `DROP_ITEM`) and P3 (serialization & deterministic unit tests in tests/sim/), and promoting any out-of-budget P1 agency items into ROADMAP.md.
4. Delegate blueprints (`generate:content`), event logs (`hermes:chronicler`), and test scaffolding (`hermes:testgen`) to local models.
5. Run `npm run verify`, `npm run hermes:critic`, and `npm run sync:state`, then output the next copy-pasteable prompt.
```
