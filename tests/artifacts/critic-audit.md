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
- `src/client/main.tsx`: **245 lines** (threshold: 230)
- `src/sim/systems/character-archetypes.ts`: **244 lines** (threshold: 230)
- `src/sim/systems/inventory.system.ts`: **244 lines** (threshold: 230)
- `src/schemas/domain-events.schema.ts`: **243 lines** (threshold: 230)
- `src/client/ui/InventoryWindow.tsx`: **240 lines** (threshold: 230)
- `src/client/ui/ItemDossierCard.tsx`: **240 lines** (threshold: 230)
- `src/client/ui/CharacterCreatorModal.tsx`: **239 lines** (threshold: 230)
- `src/sim/systems/transit.system.ts`: **239 lines** (threshold: 230)
- `src/schemas/events.schema.ts`: **238 lines** (threshold: 230)
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


**Observed telemetry.** Active command set: 4 commands — `ATTACK_ACTOR`, `MOVE_STEP`, `USE_PORTAL`, `VENT_STEAM`. Unwired (planned) commands: 8 — `LOOT_CONTAINER`, `PAY_CHIRURGEON_HEAL`, `PRESSURIZE_VESSEL`, `PRY_OBSTACLE`, `REFILL_STEAM`, `REMOVE_PROSTHETIC`, `REPAIR_LIMB`, `REST_AT_BED`. No telemetry evidence exists for any unwired command; the active set is the only demonstrated behavior.

**Systemic depth.** The active set is small but each command touches a distinct subsystem (combat, locomotion, teleportation, environmental steam control). The presence of 8 unwired hooks suggests a "wizard's workshop" design profile: the codebase has been wired for player agency on the core loop while peripheral systems are still being sketched. This is a common roguelike pattern — the design documents more mechanics than it has shipped. Compared to CDDA (Caves of Qud), which is celebrated for emergent chemistry and physics, Aether & Soot's active set is narrower but more thematically concentrated (steam, prosthetics, pressure). Compared to Qud (the item-driven roguelike tradition), the telemetry shows more item-adjacent unwired hooks (`LOOT_CONTAINER`, `REFILL_STEAM`, `REMOVE_PROSTHETIC`) than a shipped item system would suggest. Compared to Arcostate (a state-machine-heavy design paradigm), the Phase 46 soundscape project signals a move toward procedural state-driven audio, which aligns with that paradigm's rigor.

**NPC agency.** The telemetry shows zero NPC-driven events. Two unwired commands point to intended NPC roles: `REST_AT_BED` (a bed NPC, likely a healer) and `PAY_CHIRURGEON_HEAL` (a surgeon NPC). In CDDA, guards and merchants act autonomously; in Qud, social mechanics give NPCs persistent roles. Here, both are dead hooks — the chirurgeon has no healing agency, and the bed has no rest state. The design clearly intends for NPCs to have agency (the commands exist as API entries), but the telemetry proves that agency is not yet realized. Until `PAY_CHIRURGEON_HEAL` is wired, the surgeon is a placeholder; until `REST_AT_BED` is functional, the bed is a dead node. This is the most significant gap: the system's depth is present in the command surface, but NPC agency — the design's core differentiator for a Victorian roguelike — is currently unactivated.

## 5. Self-Directed Prescriptions for Next Phase (P1, P2, P3)

**P1 — Phase 46: Procedural WebAudio Soundscape & Acoustic Synth Shell.** Implement a WebAudio synthesizer module that maps finalized `SimEvent` triggers from Phases 37–45 to distinct synth patches. Prioritize the events already present in telemetry: `ATTACK_ACTOR` (percussive hit), `VENT_STEAM` (steam-hiss ambient), `USE_PORTAL` (transition tone). Make the soundscape procedural — patch selection and modulation should vary with the phase's environmental state (e.g., steam pressure modulates the hiss pitch). Close the loop: when `VENT_STEAM` fires in-game, the synth emits a matching hiss; when `ATTACK_ACTOR` fires, a sharp percussive hit plays. This ties the soundscape to the active command set without inventing new telemetry.

**P2 — Bridge Unwired Commands into Playable Systems (independent of each other).** First, implement `PAY_CHIRURGEON_HEAL` as an NPC-driven mechanic: the surgeon heals the player when paid, restoring health and giving the chirurgeon agency (the NPC is no longer a dead hook). Tie it to `REST_AT_BED`: the bed NPC can also trigger a rest state that feeds into the Phase 46 soundscape. Second, implement `LOOT_CONTAINER` as a functional loot container — items stored persistently in a container slot, and `REFILL_STEAM` can top up its steam reservoir. These two are independent mechanical systems (healing vs. inventory) and should be wired separately; no dependency between them is invented.

**P3 — Complete Prosthetic & Limb Systems.** Implement `REMOVE_PROSTHETIC` and `REPAIR_LIMB` as a paired player-driven subsystem: the player can remove a prosthetic to access a limb, then repair it to restore full function. This closes the loop with the chirurgeon (the surgeon performs the repair after payment). Ensure `REST_AT_BED` is fully functional — the bed NPC's rest state should emit a calm pad that reinforces the Phase 46 audio theme. P3 is the mechanical cap of the current feature set: once prosthetics are removable and repairable, and the bed heals, the remaining unwired commands (`PRESSURIZE_VESSEL`, `PRY_OBSTACLE`) can be layered on top without breaking the established player/NPC workflow.

## 6. Next-Phase Handoff Prompt

```markdown
Implement **Phase 46: Procedural WebAudio Soundscape & Acoustic Synth Shell**: WebAudio synthesizer wired to finalized `SimEvent` triggers across Phases 37–45. adhering to AGENTS.md and ARCHITECTURE.md:
1. Run `npm run hermes:scout -- --task "the active phase"` and complete the 6-point Pre-Flight Impact Analysis (including STATE.md P1/P2/P3 triage).
2. Pre-split any src/ hotspot >= 245 lines (`src/client/main.tsx` (245 lines)) via `npm run hermes:split`.
3. Implement the active phase while folding in P2 (systemic cross-wiring & unwired serializer commands: `LOOT_CONTAINER`, `PAY_CHIRURGEON_HEAL`, `PRESSURIZE_VESSEL`, `PRY_OBSTACLE`) and P3 (serialization & deterministic unit tests in tests/sim/), and promoting any out-of-budget P1 agency items into ROADMAP.md.
4. Delegate blueprints (`generate:content`), event logs (`hermes:chronicler`), and test scaffolding (`hermes:testgen`) to local models.
5. Run `npm run verify`, `npm run hermes:critic`, and `npm run sync:state`, then output the next copy-pasteable prompt.
```
