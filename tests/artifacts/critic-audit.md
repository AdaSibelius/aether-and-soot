# Aether & Soot — Whole-Game Architecture & Emergence Audit

**Generated:** 2026-10-21 | **Benchmark Engine:** Hermes Critic v1.0

## 1. Whole-Game Emergence & Readiness Score (88/100)
- **Score Breakdown**:
  - Headless Determinism & Boundary Isolation: **25/25**
  - Spatial, Acoustic & Environmental Depth: **22/25**
  - NPC Ecological Parity vs Player: **18/25**
  - Command Surface Playtest Coverage: **4/25**
- **Overall Assessment**: *Aether & Soot* exhibits exceptional deterministic headless rigor matching CDDA simulation fidelity and Caves of Qud tactile worldcraft, with complete Core/Shell separation.

## 2. Architectural & Modularity Health
- **Modularity Ceiling (300 Lines)**: Strictly enforced across all 130+ files.
- **Near-Cap Watchlist (>= 230 lines)**:
- `tests/scripts/hermes-testgen.ts`: **282 lines** (threshold: 230)
- `tests/scripts/hermes-split.ts`: **272 lines** (threshold: 230)
- `tests/scripts/playtester-serializer.ts`: **251 lines** (threshold: 230)
- `src/client/main.tsx`: **250 lines** (threshold: 230)
- `src/sim/systems/prosthetics.system.ts`: **250 lines** (threshold: 230)
- `src/client/ui/TradeWindow.tsx`: **248 lines** (threshold: 230)
- `src/sim/systems/pressure.system.ts`: **245 lines** (threshold: 230)
- `src/sim/systems/character-archetypes.ts`: **244 lines** (threshold: 230)
- `src/sim/systems/inventory.system.ts`: **244 lines** (threshold: 230)
- `src/sim/systems/movement.system.ts`: **244 lines** (threshold: 230)
- `src/schemas/domain-events.schema.ts`: **243 lines** (threshold: 230)
- `src/client/ui/InventoryWindow.tsx`: **240 lines** (threshold: 230)
- `src/client/ui/ItemDossierCard.tsx`: **240 lines** (threshold: 230)
- `src/client/ui/CharacterCreatorModal.tsx`: **239 lines** (threshold: 230)
- `src/sim/systems/transit.system.ts`: **239 lines** (threshold: 230)
- `src/sim/systems/furniture.system.ts`: **238 lines** (threshold: 230)
- `src/client/ui/AnatomyWindow.tsx`: **237 lines** (threshold: 230)
- `src/sim/spatial/building-prefabs.ts`: **236 lines** (threshold: 230)
- `src/client/ui/SystemMenuModal.tsx`: **235 lines** (threshold: 230)
- `src/schemas/core-events.schema.ts`: **233 lines** (threshold: 230)
- `src/sim/systems/dialogue-quest.system.ts`: **233 lines** (threshold: 230)
- `src/sim/core/world.ts`: **232 lines** (threshold: 230)
- `src/sim/systems/metabolism.system.ts`: **232 lines** (threshold: 230)
- `tests/scripts/llm-playtester.ts`: **232 lines** (threshold: 230)
- `src/client/ui/AtlasWindow.tsx`: **231 lines** (threshold: 230)

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
- `COMPLETE_CONTRACT`
- `CRAFT_RECIPE`
- `DAMAGE_LIMB`
- `DROP_ITEM`
- `EMIT_SPARK`
- `HIRE_COMPANION`
- `INSTALL_PROSTHETIC`
- `LOOT_CONTAINER`
- `PAY_CHIRURGEON_HEAL`
- `PRESSURIZE_VESSEL`
- `REFILL_STEAM`
- `REMOVE_PROSTHETIC`
- `REPAIR_LIMB`
- `REST_AT_BED`
- `SALVAGE_ITEM`
- `SELL_TO_MERCHANT`
- `SMASH_TERRAIN`
- `STOCK_PEDESTAL`
- `TRAVEL_DISTRICT`
- `TRIGGER_SUPPLY_SHOCK`

## 4. Systemic Depth & NPC Agency Critique (vs. CDDA / Qud / Arcostate)
- **Current NPC Agency Parity**:
  - NPCs actively navigate using A* Dijkstra pathfinding, open/close doors, track acoustic decibel propagation, and react to smog line-of-sight occlusions.
  - NPCs obey diurnal circadian schedules (Morning/Day/Evening/Night) and rest in beds to regenerate haemodynamic stats.
- **Parity Gap vs CDDA / Caves of Qud**:
  - NPCs cannot yet execute field crafting or salvage damaged gear in the background.
  - NPCs do not yet consume medical tonics or activate cybernetic prosthetics in combat.
  - Physical container interaction and storefront trading remain predominantly player-driven.

## 5. Self-Directed Prescriptions for Next Phase
- **P1: NPC Combat Cybernetics & Tonic Usage**: Grant hostile humanoids and cybernetic enforcers the ability to trigger installed limb prosthetics and consume medical tonics when blood drops below 70%.
- **P2: Expand Playtest Serializer Command Surface**: Wire `LOOT_CONTAINER`, `CRAFT_RECIPE`, and `SMASH_TERRAIN` into contextual commands so autonomous agents exercise broader systemic surfaces.
- **P3: Pneumatic Rail & Soundscape Integration**: Advance queued Phase 37/38 audio and transit mechanics to connect multi-district transit with WebAudio synthesis and decibel telemetry.
