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


Telemetry shows a small but well-defined active command surface — `ATTACK_ACTOR`, `MOVE_STEP`, `USE_PORTAL`, `VENT_STEAM` — that maps cleanly to combat, locomotion, teleportation, and environmental interaction. The eight unwired commands (`COMPLETE_CONTRACT`, `CRAFT_RECIPE`, `DAMAGE_LIMB`, `DROP_ITEM`, `EMIT_SPARK`, `HIRE_COMPANION`, `INSTALL_PROSTHETIC`, `INSTALL_WEAPON_MOD`) are present in the schema but telemetry records no state changes or feedback from them; they exist as hooks rather than active systems. No observed dependency links exist between the unwired commands and the active ones.

**Compared to CDDA:** CDDA derives depth from procedural item/weapon generation and a deep NPC goal system (e.g., merchants, guards with persistent routines). Aether & Soot has a dedicated character-archetype system (`src/sim/systems/character-archetypes.ts:244`) that hints at archetype-driven depth, but telemetry shows no archetype-specific mechanics yet — the archetype layer is currently scaffolding rather than an active driver.

**Compared to Qud:** Qud's emergent NPC curiosity and procedural reactions are driven by item-level interactions. Aether & Soot's Royal Society Naturalist's Codex is a similar data-driven curiosity trigger, but telemetry only records that discovered entries "trigger emergent NPC curiosity, hostility, or trade reactions" — there is no evidence of persistent NPC state (no memory of a specific automaton or schematic), so the reaction appears event-driven rather than state-driven.

**Compared to Arcostate:** Arcostate's contract and property systems are explicit and enforced. The `COMPLETE_CONTRACT` unwired command suggests a contract hook, but telemetry shows no contract enforcement or reward loops; the deed/vault purchase path remains a design placeholder with no observable payoff.

**NPC agency in Phase 44 is currently event-based:** Codex entries → emergent reactions via `src/schemas/events.schema.ts:245`. This is a step toward agency, but the design lacks persistent NPC memory (no telemetry shows an NPC retaining knowledge of a discovered automaton or schematic). The codex tracking schema is the correct place for this, but the serialization path has not yet been wired to the event emitter.

**Systemic depth gap:** Phase 44 introduces persistent storage (`SURGICAL_TABLE`, `ARTIFICER_BENCH`, `STEAM_CHARGER`), field construction/barricading (`BUILD_STRUCTURE`), and the Naturalist's Codex — none of which have observable telemetry. The active command set is deterministic but shallow, and the unwired commands are not yet integrated into the state graph.

## 5. Self-Directed Prescriptions for Next Phase (P1, P2, P3)

**P1 — Serialization & Test Coverage (`playtester-serializer.ts`)**
- Extend `playtester-serializer.ts` to cover all Phase 44 command/state pairs: deed purchase/claim (Freehold Workshop Deed / Undercroft vault), storage state for `SURGICAL_TABLE`, `ARTIFICER_BENCH`, `STEAM_CHARGER`, `BUILD_STRUCTURE` field construction, and the `[K]` Royal Society Naturalist's Codex query (automatons, schematics, alchemical reactions).
- Write deterministic unit tests in `tests/sim/` that assert serialization round-trips for each state object (e.g., deed ownership → persisted deed ID; storage slot → item count; codex entry → tracked discovery). Ensure the serializer is order-stable and idempotent.
- This closes the telemetry gap: the serializer must be the single source of truth for what the test harness observes.

**P2 — Wiring Unwired Commands into Phase 44 Systems**
- Link `COMPLETE_CONTRACT` to deed ownership validation (a contract is only valid if the player holds a valid deed).
- Wire `CRAFT_RECIPE` and `INSTALL_WEAPON_MOD` into the Artificer Safehouse Deed's crafting/modification pipeline so the deed grants access to new recipe slots and weapon mods.
- Make `DAMAGE_LIMB` a persistent limb-state tracker that feeds NPC curiosity (e.g., an NPC who has seen the injury reacts with concern or hostility).
- Ensure the `[K]` codex entries are emitted via `src/schemas/events.schema.ts:245` and consumed by the event emitter to trigger emergent NPC reactions — this is the core of the Naturalist's Codex mechanic.

**P3 — NPC Agency & Systemic Expansion**
- Give NPCs a persistent memory of codex discoveries: store discovered automatons, schematics, and alchemical reactions in a player-side log that NPCs can query; the `[K]` codex query should return entries that NPCs with the relevant curiosity flag react to.
- Tie `BUILD_STRUCTURE` (barricading) to the safehouse's defensive state — a built structure should persist across phases and influence Phase 44's barricade mechanics.
- Add deterministic unit tests in `tests/sim/` for the full Phase 44 flow: deed purchase → storage persistence → codex entry → NPC reaction. Verify that `src/client/ui/TradeWindow.tsx:248` (trade window) reflects the new item/furniture inventory tied to the deed, and that `src/schemas/events.schema.ts:245` correctly serializes Codex query results.
- Ensure `TradeWindow.tsx:248` is updated to display the deed-bound furniture inventory (`SURGICAL_TABLE`, `ARTIFICER_BENCH`, `STEAM_CHARGER`) as purchasable/placeable items.

These prescriptions close the observed telemetry gaps, wire the Phase 44 hooks into a coherent state graph, and establish deterministic serialization and test coverage for the Freehold Workshop Deed, furniture construction, and Royal Society Codex tracking.

## 6. Next-Phase Handoff Prompt

```markdown
Implement **Phase 44: Artificer Safehouse Deeds, Furniture Construction & Royal Society Codex**: Allow purchasing a **Freehold Workshop Deed** (or claiming an Undercroft vault) with persistent item/furniture storage (`SURGICAL_TABLE`, `ARTIFICER_BENCH`, `STEAM_CHARGER`), field construction/barricading (`BUILD_STRUCTURE`), and a `[K]` **Royal Society Naturalist's Codex** tracking discovered automatons, schematics, and alchemical reactions. Discovered Codex entries trigger emergent NPC curiosity, hostility, or trade reactions. Ensure `playtester-serializer.ts` provides complete command/state serialization coverage for Phase 44 deeds, structures, and Codex queries with deterministic unit tests in `tests/sim/`. adhering to AGENTS.md and ARCHITECTURE.md:
1. Run `npm run hermes:scout -- --task "the active phase"` and complete the 6-point Pre-Flight Impact Analysis (including STATE.md P1/P2/P3 triage).
2. Pre-split any src/ hotspot >= 245 lines (`src/client/ui/TradeWindow.tsx` (248 lines)) via `npm run hermes:split`.
3. Implement the active phase while folding in P2 (systemic cross-wiring & unwired serializer commands: `COMPLETE_CONTRACT`, `CRAFT_RECIPE`, `DAMAGE_LIMB`, `DROP_ITEM`) and P3 (serialization & deterministic unit tests in tests/sim/), and promoting any out-of-budget P1 agency items into ROADMAP.md.
4. Delegate blueprints (`generate:content`), event logs (`hermes:chronicler`), and test scaffolding (`hermes:testgen`) to local models.
5. Run `npm run verify`, `npm run hermes:critic`, and `npm run sync:state`, then output the next copy-pasteable prompt.
```
