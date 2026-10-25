# Aether & Soot — Whole-Game Architecture & Emergence Audit

**Generated:** 2026-10-25 | **Benchmark Engine:** Hermes Critic v1.0
- **Execution Mode**: MOCK_FALLBACK (playtester-mock.ts)
- **LLM Telemetry**: Mode: MOCK_FALLBACK | Temperature: 0.1 | Enforce JSON Schema: true

## 1. Whole-Game Emergence & Readiness Score (0/100)
- **Score Breakdown**:
  - Headless Determinism & Boundary Isolation: **25/25**
  - Spatial, Acoustic & Environmental Depth: **22/25**
  - NPC Ecological Parity vs Player: **18/25**
  - Command Surface Playtest Coverage: **4/25**
- **Overall Assessment**: *Aether & Soot* exhibits exceptional deterministic headless rigor matching CDDA simulation fidelity and Caves of Qud tactile worldcraft, with complete Core/Shell separation.

## 2. Architectural & Modularity Health
- **Modularity Ceiling (300 Lines)**: Strictly enforced across all 130+ files.
- **Near-Cap Watchlist (>= 230 lines)**:
- `src/client/projection/frame-adapter.ts`: **251 lines** (threshold: 230)
- `src/client/bootstrap-loop.ts`: **249 lines** (threshold: 230)
- `src/client/ui/CharacterCreatorModal.tsx`: **247 lines** (threshold: 230)
- `src/client/ui/ItemDossierCard.tsx`: **245 lines** (threshold: 230)
- `src/sim/systems/container.system.ts`: **245 lines** (threshold: 230)
- `src/client/ui/InventoryWindow.tsx`: **244 lines** (threshold: 230)
- `src/client/ui/LookCursorOverlay.tsx`: **244 lines** (threshold: 230)
- `src/client/ui/CraftingWindow.tsx`: **243 lines** (threshold: 230)
- `src/schemas/domain-events.schema.ts`: **243 lines** (threshold: 230)
- `src/sim/systems/transit.system.ts`: **239 lines** (threshold: 230)
- `src/client/input/keyboard-router.ts`: **238 lines** (threshold: 230)
- `src/sim/systems/furniture.system.ts`: **238 lines** (threshold: 230)
- `src/client/canvas-ui/diegetic-cartography.ts`: **236 lines** (threshold: 230)
- `src/schemas/events.schema.ts`: **235 lines** (threshold: 230)
- `src/sim/systems/safehouse.system.ts`: **235 lines** (threshold: 230)
- `src/client/canvas-ui/artificer-bench-screen.ts`: **234 lines** (threshold: 230)
- `src/schemas/domain-commands.schema.ts`: **234 lines** (threshold: 230)
- `src/client/audio/procedural-synth.ts`: **233 lines** (threshold: 230)
- `src/schemas/core-events.schema.ts`: **233 lines** (threshold: 230)
- `src/sim/spatial/architectural-typologies.ts`: **233 lines** (threshold: 230)
- `src/sim/systems/dialogue-quest.system.ts`: **233 lines** (threshold: 230)
- `src/sim/systems/environmental-hazards.system.ts`: **232 lines** (threshold: 230)
- `src/sim/systems/metabolism.system.ts`: **232 lines** (threshold: 230)
- `src/client/ui/SystemMenuModal.tsx`: **231 lines** (threshold: 230)

## 3. Command Coverage & Dead-Mechanic Audit
- **Active Commands (> 0 Playtest Dispatches across 4 Scenarios)**:
- `ATTACK_ACTOR` (7 dispatches)
- `BUY_FROM_MERCHANT` (4 dispatches)
- `MOVE_STEP` (10 dispatches)
- `USE_ITEM` (1 dispatches)
- `USE_PORTAL` (30 dispatches)
- `VENT_STEAM` (1 dispatches)
- **Dormant Commands (Wired in Serializer, 0 Dispatches)**:
- `ACCEPT_CONTRACT`
- `ACTIVATE_PROSTHETIC`
- `APPLY_MOMENTUM_VECTOR`
- `AUDIT_SAFEHOUSE_DEED`
- `BOARD_MONORAIL`
- `BREACH_TILE`
- `BUILD_STRUCTURE`
- `CLAIM_WORKSHOP_DEED`
- `CLEAN_SPILL`
- `COAT_WEAPON`
- `COMPLETE_CONTRACT`
- `CONSULT_CODEX`
- `CRAFT_RECIPE`
- `DAMAGE_LIMB`
- `DESCEND_CATACOMBS`
- `DROP_ITEM`
- `EMIT_SPARK`
- `EMIT_SQUAD_CALLOUT`
- `HARVEST_CORPSE`
- `HIRE_COMPANION`
- `INITIATE_TURF_SKIRMISH`
- `INSTALL_PROSTHETIC`
- `INSTALL_WEAPON_MOD`
- `LAUNCH_MONORAIL`
- `LOAD_AMMO`
- `LOOT_CONTAINER`
- `PAY_CHIRURGEON_HEAL`
- `PICK_UP_ITEM`
- `PREPARE_SUPPLY_CONVOY`
- `PRESSURIZE_VESSEL`
- `PRY_OBSTACLE`
- `REFILL_STEAM`
- `REPAIR_LIMB`
- `RETRIEVE_ITEM_FROM_STRUCTURE`
- `SALVAGE_ITEM`
- `SELL_TO_MERCHANT`
- `STOCK_PEDESTAL`
- `STORE_ITEM_IN_STRUCTURE`
- `TOGGLE_DOOR`
- `WAIT_TURN`
- **Unwired Blind-Spot Commands (Missing from Context/Serializer)**:
- `REMOVE_PROSTHETIC`
- `REPORT_CRIME`
- `REST_AT_BED`
- `SET_POSTURE`
- `SMASH_TERRAIN`
- `THROW_FLASK`
- `TRAVEL_DISTRICT`
- `TRIGGER_SUPPLY_SHOCK`
- `UNINSTALL_WEAPON_MOD`

## 4. Systemic Depth & NPC Agency Critique (vs. CDDA / Qud / Arcostate)
> **AGENT DIRECTIVE:** The systemic analysis below is theoretical. Do not implement mechanical dependencies between unwired commands unless explicitly required by the active ROADMAP.

- **Current NPC Agency Parity**:
  - NPCs actively navigate using A* Dijkstra pathfinding, open/close doors, track acoustic decibel propagation, and react to smog line-of-sight occlusions.
  - NPCs obey diurnal circadian schedules (Morning/Day/Evening/Night) and rest in beds to regenerate haemodynamic stats.
  - NPCs consume restorative medical tonics under trauma/pain, activate combat prosthetics (pneumatic dash, ocular pulse), and broadcast squad witness alerts.
- **Parity Gap vs CDDA / Caves of Qud**:
  - NPCs cannot yet execute field crafting or salvage damaged gear in the background.
  - NPCs do not yet autonomously construct fortifications, deploy workshop furniture, or claim freehold deeds.
  - Physical container looting and storefront trading remain predominantly player-driven.

## 5. Self-Directed Prescriptions for Next Phase
- **P1: Phase 51** [UNREACHABLE_MECHANIC]: Focus core systems development on **Phase 51: City Causality Graph & Strategic Overworld Topology** *(STATUS: SCOPED & PREPPED — AWAITING DISPATCH)*: resolving unwiredCommands and telemetry anomalies. (Target: `src/client/projection/frame-adapter.ts`, `src/sim/core/engine.ts` | Verification: `tests/sim/determinism.test.ts`)
- **P2: Expand Playtest Serializer Command Surface** [SIM_BALANCE]: Wire unwired commands (REMOVE_PROSTHETIC, REPORT_CRIME, REST_AT_BED, SET_POSTURE) to reduce unwiredCommands count. (Target: `tests/scripts/playtester-serializer.ts` | Verification: `tests/sim/determinism.test.ts`)
- **P3: Modularity Guard & File Splitting** [MODULE_SPLIT]: Monitor and pre-split near-cap modules like src/client/projection/frame-adapter.ts to resolve modularityHotspot anomaly. (Target: `src/client/projection/frame-adapter.ts` | Verification: `tests/sim/determinism.test.ts`)

## 6. Next-Phase Handoff Prompt

```markdown
Implement **Phase 51: City Causality Graph & Strategic Overworld Topology** *(STATUS: SCOPED & PREPPED — AWAITING DISPATCH)*: adhering to AGENTS.md and ARCHITECTURE.md:
1. Run `npm run hermes:scout -- --task "the active phase"` and complete the 6-point Pre-Flight Impact Analysis (including STATE.md P1/P2/P3 triage).
2. Pre-split any src/ hotspot >= 245 lines (`src/client/projection/frame-adapter.ts` (251 lines)) via `npm run hermes:split`.
3. Implement the active phase while folding in P2 (systemic cross-wiring & unwired serializer commands: `REMOVE_PROSTHETIC`, `REPORT_CRIME`, `REST_AT_BED`, `SET_POSTURE`) and P3 (serialization & deterministic unit tests in tests/sim/), and promoting any out-of-budget P1 agency items into ROADMAP.md.
4. Delegate blueprints (`generate:content`), event logs (`hermes:chronicler`), and test scaffolding (`hermes:testgen`) to local models.
5. Run `npm run verify`, `npm run hermes:critic`, and `npm run sync:state`, then output the next copy-pasteable prompt.
```
