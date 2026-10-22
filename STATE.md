# Project State

**Last Updated:** 2026-10-22

## Recent Commits
- 18d2e9d: Configure 3-Tier Ollama routing (lfm2.5, gemma4, hermes3) across local tooling
- b5d0ad0: Fix hermes-critic model routing and make post-phase prescriptions fully dynamic
- 13d8ddc: Implement Phase 43: Deep Sub-Undercroft Strata (CATACOMBS) & Derelict Pneumatic Monorail

## Immediate Next Priority
- **Phase 44: Artificer Safehouse Deeds, Furniture Construction & Royal Society Codex**: Allow purchasing a **Freehold Workshop Deed** (or claiming an Undercroft vault) with persistent item/furniture storage (`SURGICAL_TABLE`, `ARTIFICER_BENCH`, `STEAM_CHARGER`), field construction/barricading (`BUILD_STRUCTURE`), and a `[K]` **Royal Society Naturalist's Codex** tracking discovered automatons, schematics, and alchemical reactions. Discovered Codex entries trigger emergent NPC curiosity, hostility, or trade reactions. Ensure `playtester-serializer.ts` provides complete command/state serialization coverage for Phase 44 deeds, structures, and Codex queries with deterministic unit tests in `tests/sim/`.

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
