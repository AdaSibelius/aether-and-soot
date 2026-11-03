# Aether & Soot — Whole-Game Architecture & Emergence Audit

**Generated:** 2026-11-02 | **Benchmark Engine:** Hermes Critic v1.0
- **Execution Mode**: MOCK_FALLBACK (playtester-mock.ts)
- **LLM Telemetry**: Mode: MOCK_FALLBACK | Temperature: 0.1 | Enforce JSON Schema: true

## 1. Whole-Game Emergence & Readiness Score (10/100)
- **Score Breakdown**:
  - Headless Determinism & Boundary Isolation: **25/25**
  - Spatial, Acoustic & Environmental Depth: **22/25**
  - NPC Ecological Parity vs Player: **18/25**
  - Command Surface Playtest Coverage: **3/25**
- **Overall Assessment**: *Aether & Soot* exhibits exceptional deterministic headless rigor matching CDDA simulation fidelity and Caves of Qud tactile worldcraft, with complete Core/Shell separation.

## 2. Architectural & Modularity Health
- **Modularity Ceiling (300 Lines)**: Strictly enforced across all 130+ files.
- **Near-Cap Watchlist (>= 230 lines)**:
- `src/schemas/core-events.schema.ts`: **244 lines** (threshold: 230)
- `src/sim/systems/ai.system.ts`: **240 lines** (threshold: 230)
- `src/sim/systems/furniture.system.ts`: **238 lines** (threshold: 230)
- `src/sim/spatial/strata-portals.ts`: **237 lines** (threshold: 230)
- `src/sim/spatial/template-instantiator.ts`: **237 lines** (threshold: 230)
- `src/sim/systems/district-spawner.ts`: **237 lines** (threshold: 230)
- `src/client/projection/biome-palette.ts`: **236 lines** (threshold: 230)
- `src/sim/spatial/building-templates.ts`: **236 lines** (threshold: 230)
- `src/sim/systems/safehouse.system.ts`: **235 lines** (threshold: 230)
- `src/schemas/commands.schema.ts`: **234 lines** (threshold: 230)
- `src/schemas/domain-commands.schema.ts`: **234 lines** (threshold: 230)
- `src/client/audio/procedural-synth.ts`: **233 lines** (threshold: 230)
- `src/sim/systems/environmental-hazards.system.ts`: **233 lines** (threshold: 230)
- `src/sim/spatial/fixture-catalog.ts`: **232 lines** (threshold: 230)
- `src/sim/systems/metabolism.system.ts`: **232 lines** (threshold: 230)
- `src/client/ui/SystemMenuModal.tsx`: **231 lines** (threshold: 230)
- `src/sim/core/command-router.ts`: **230 lines** (threshold: 230)
- `src/sim/systems/surgery.system.ts`: **230 lines** (threshold: 230)
- `src/sim/systems/utility-simulation.system.ts`: **230 lines** (threshold: 230)

### Actionable UI Projection Bug Reports
- **Status**: CLEAN — Zero UI projection leaks detected.

## 3. Command Coverage & Dead-Mechanic Audit
- **Active Commands (> 0 Playtest Dispatches across 4 Scenarios)**:
- `ATTACK_ACTOR` (6 dispatches)
- `BUY_FROM_MERCHANT` (4 dispatches)
- `MOVE_STEP` (10 dispatches)
- `USE_ITEM` (1 dispatches)
- `USE_PORTAL` (38 dispatches)
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
- `MODULATE_CAUSAL_CONDUIT`
- `PAY_CHIRURGEON_HEAL`
- `PICK_UP_ITEM`
- `PREPARE_SUPPLY_CONVOY`
- `PRESSURIZE_VESSEL`
- `PRY_OBSTACLE`
- `REFILL_STEAM`
- `REMOVE_PROSTHETIC`
- `REPAIR_LIMB`
- `REPORT_CRIME`
- `REST_AT_BED`
- `RETRIEVE_ITEM_FROM_STRUCTURE`
- `SALVAGE_ITEM`
- `SELL_TO_MERCHANT`
- `SET_POSTURE`
- `STOCK_PEDESTAL`
- `STORE_ITEM_IN_STRUCTURE`
- `TOGGLE_DOOR`
- `WAIT_TURN`
- **Unwired Blind-Spot Commands (Missing from Context/Serializer)**:
- **Transit & Overworld**: `ASCEND_CATACOMBS`
- **Forensic & Lore**: `DISSECT_CORPSE_ANATOMY`, `EMIT_PROCEDURAL_BARK`, `ENFORCE_TURF_AUTHORITY`
- **Equipment & Crafting**: `EQUIP_ITEM`, `FIRE_RANGED_WEAPON`, `UNEQUIP_ITEM`
- **Economy & Contracts**: `SMASH_TERRAIN`, `THROW_FLASK`, `TRAVEL_DISTRICT`, `TRIGGER_SUPPLY_SHOCK`, `UNINSTALL_WEAPON_MOD`

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
- **P1: Phase 56** [UNREACHABLE_MECHANIC]: Focus core systems development on **Phase 56: Causal Supply Chains & Disruption Cascades** *(PLANNED)*: Aggregate macro-tick simulation of 3 vital commodities (*Anthracite Coal*, *Carbolic Tincture*, *Preserved Rations*). Scarcity events trigger downstream consequences: clinic medicine stockouts, workshop steam outages, merchant price inflation, and worker shift strikes. resolving unwiredCommands and telemetry anomalies. (Target: `src/sim/systems/economy.system.ts`, `src/sim/systems/trade.system.ts` | Verification: `tests/sim/determinism.test.ts`)
- **P2: Expand Playtest Serializer Command Surface** [SIM_BALANCE]: Wire unwired commands (ASCEND_CATACOMBS, DISSECT_CORPSE_ANATOMY, EMIT_PROCEDURAL_BARK, ENFORCE_TURF_AUTHORITY) to reduce unwiredCommands count. (Target: `tests/scripts/playtester-serializer.ts` | Verification: `tests/sim/determinism.test.ts`)
- **P3: Modularity Guard & File Splitting** [MODULE_SPLIT]: Monitor and pre-split near-cap modules like src/schemas/core-events.schema.ts to resolve modularityHotspot anomaly. (Target: `src/schemas/core-events.schema.ts` | Verification: `tests/sim/determinism.test.ts`)

## 6. Next-Phase Handoff Prompt

```markdown
Implement **Phase 56: Causal Supply Chains & Disruption Cascades** *(PLANNED)*: Aggregate macro-tick simulation of 3 vital commodities (*Anthracite Coal*, *Carbolic Tincture*, *Preserved Rations*). Scarcity events trigger downstream consequences: clinic medicine stockouts, workshop steam outages, merchant price inflation, and worker shift strikes. adhering to AGENTS.md and ARCHITECTURE.md:
1. Run `npm run hermes:scout -- --task "the active phase"` and complete the 6-point Pre-Flight Impact Analysis (including STATE.md P1/P2/P3 triage).
2. Pre-split any src/ hotspot >= 245 lines (`src/schemas/core-events.schema.ts` (244 lines)) via `npm run hermes:split`.
3. Implement the active phase while folding in P2 (systemic cross-wiring & unwired serializer commands: `ASCEND_CATACOMBS`, `DISSECT_CORPSE_ANATOMY`, `EMIT_PROCEDURAL_BARK`, `ENFORCE_TURF_AUTHORITY`) and P3 (serialization & deterministic unit tests in tests/sim/), and promoting any out-of-budget P1 agency items into ROADMAP.md.
4. Delegate blueprints (`generate:content`), event logs (`hermes:chronicler`), and test scaffolding (`hermes:testgen`) to local models.
5. Run `npm run verify`, `npm run hermes:critic`, and `npm run sync:state`, then output the next copy-pasteable prompt.
```
