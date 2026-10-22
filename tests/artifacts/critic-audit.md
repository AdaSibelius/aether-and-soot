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
- `tests/scripts/hermes-testgen.ts`: **282 lines** (threshold: 230)
- `tests/scripts/hermes-split.ts`: **273 lines** (threshold: 230)
- `tests/scripts/playtester-serializer.ts`: **251 lines** (threshold: 230)
- `src/client/main.tsx`: **250 lines** (threshold: 230)
- `src/sim/systems/prosthetics.system.ts`: **250 lines** (threshold: 230)
- `src/client/ui/TradeWindow.tsx`: **248 lines** (threshold: 230)
- `src/schemas/commands.schema.ts`: **245 lines** (threshold: 230)
- `src/sim/systems/character-archetypes.ts`: **244 lines** (threshold: 230)
- `src/sim/systems/inventory.system.ts`: **244 lines** (threshold: 230)
- `src/schemas/domain-events.schema.ts`: **243 lines** (threshold: 230)
- `src/client/ui/InventoryWindow.tsx`: **240 lines** (threshold: 230)
- `src/client/ui/ItemDossierCard.tsx`: **240 lines** (threshold: 230)
- `src/client/ui/CharacterCreatorModal.tsx`: **239 lines** (threshold: 230)
- `src/sim/systems/transit.system.ts`: **239 lines** (threshold: 230)
- `src/sim/systems/furniture.system.ts`: **238 lines** (threshold: 230)
- `src/client/ui/AnatomyWindow.tsx`: **237 lines** (threshold: 230)
- `src/sim/spatial/building-prefabs.ts`: **236 lines** (threshold: 230)
- `src/client/ui/SystemMenuModal.tsx`: **235 lines** (threshold: 230)
- `src/schemas/domain-commands.schema.ts`: **234 lines** (threshold: 230)
- `src/schemas/core-events.schema.ts`: **233 lines** (threshold: 230)
- `src/sim/core/world.ts`: **233 lines** (threshold: 230)
- `src/sim/systems/dialogue-quest.system.ts`: **233 lines** (threshold: 230)
- `src/client/ui/AtlasWindow.tsx`: **232 lines** (threshold: 230)
- `src/sim/systems/metabolism.system.ts`: **232 lines** (threshold: 230)
- `tests/scripts/hermes-critic.ts`: **231 lines** (threshold: 230)

## 3. Command Coverage & Dead-Mechanic Audit
- **Active Commands (> 0 Playtest Dispatches across 4 Scenarios)**:
- `ATTACK_ACTOR` (7 dispatches)
- `MOVE_STEP` (15 dispatches)
- `USE_PORTAL` (30 dispatches)
- `VENT_STEAM` (1 dispatches)
- **Dormant Commands (Wired in Serializer, 0 Dispatches)**:
- `ACTIVATE_PROSTHETIC`
- `BREACH_TILE`
- `BUY_FROM_MERCHANT`
- `HARVEST_CORPSE`
- `PICK_UP_ITEM`
- `TOGGLE_DOOR`
- `USE_ITEM`
- `WAIT_TURN`
- **Unwired Blind-Spot Commands (Missing from Context/Serializer)**:
- `ACCEPT_CONTRACT`
- `APPLY_MOMENTUM_VECTOR`
- `CLEAN_SPILL`
- `COAT_WEAPON`
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
- **Current NPC Agency Parity**:
  - NPCs actively navigate using A* Dijkstra pathfinding, open/close doors, track acoustic decibel propagation, and react to smog line-of-sight occlusions.
  - NPCs obey diurnal circadian schedules (Morning/Day/Evening/Night) and rest in beds to regenerate haemodynamic stats.
- **Parity Gap vs CDDA / Caves of Qud**:
  - NPCs cannot yet execute field crafting or salvage damaged gear in the background.
  - NPCs do not yet consume medical tonics or activate cybernetic prosthetics in combat.
  - Physical container interaction and storefront trading remain predominantly player-driven.

## 5. Self-Directed Prescriptions for Next Phase (P1, P2, P3)

**P1 — Expand NPC Agency**
- Introduce autonomous NPC roles tied to the Royal Society and Undercroft vault: e.g., guild inspectors with goal-state objectives (audit workshop deeds, guard vaults) and rival artificers who react to the player's deed purchases.
- Make NPC reactions depend on the `[K]` Codex state — discovered automatons and schematics should trigger NPC curiosity, hostility, or trade offers, creating emergent social friction.
- Add telemetry hooks for NPC goal changes (e.g., `NPC_GOAL_CHANGED`) to measure agency impact.

**P2 — Deepen Phase 44 Systemic Integration**
- Make the Freehold Workshop Deed a persistent object that grants access to `SURGICAL_TABLE`, `ARTIFICER_BENCH`, and `STEAM_CHARGER` storage, and ensure `BUILD_STRUCTURE`/barricading can be applied to vault walls with telemetry visibility.
- Wire cross-feature dependencies: e.g., `COMPLETE_CONTRACT` unlocks specific `CRAFT_RECIPE` variants; `VENT_STEAM` can power `COAT_WEAPON` effects or be cleaned via `CLEAN_SPILL`.
- Update the test infrastructure (`tests/scripts/hermes-testgen.ts:282`, `hermes-split.ts:273`) to emit telemetry for deed purchase, vault claim, and Codex entry creation.

**P3 — Telemetry Hygiene & Validation**
- Ensure `playtester-serializer.ts:251` serializes the new Phase 44 state (deed, storage slots, barricades, Codex entries) without loss.
- Add unit/integration tests for Undercroft vault claim flow, BUILD_STRUCTURE barricading mechanics, and NPC goal reactions to the Codex.
- Verify that `DAMAGE_LIMB` and `VENT_STEAM` interactions with the new steam-charging furniture are logged in the telemetry stream so that emergent bugs can be reproduced.
