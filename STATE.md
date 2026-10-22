# Project State

**Last Updated:** 2026-10-22

## Recent Commits
- b5d0ad0: Fix hermes-critic model routing and make post-phase prescriptions fully dynamic
- 13d8ddc: Implement Phase 43: Deep Sub-Undercroft Strata (CATACOMBS) & Derelict Pneumatic Monorail
- d3a7da9: Update STATE.md for Phase 42

## Immediate Next Priority
- **Phase 44: Artificer Safehouse Deeds, Furniture Construction & Royal Society Codex**: Allow purchasing a **Freehold Workshop Deed** (or claiming an Undercroft vault) with persistent item/furniture storage (`SURGICAL_TABLE`, `ARTIFICER_BENCH`, `STEAM_CHARGER`), field construction/barricading (`BUILD_STRUCTURE`), and a `[K]` **Royal Society Naturalist's Codex** tracking discovered automatons, schematics, and alchemical reactions.

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
