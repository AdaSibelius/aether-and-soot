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
- `src/sim/core/world.ts`: **245 lines** (threshold: 230)
- `src/sim/systems/character-archetypes.ts`: **244 lines** (threshold: 230)
- `src/sim/systems/inventory.system.ts`: **244 lines** (threshold: 230)
- `src/schemas/domain-events.schema.ts`: **243 lines** (threshold: 230)
- `src/client/ui/InventoryWindow.tsx`: **240 lines** (threshold: 230)
- `src/client/ui/ItemDossierCard.tsx`: **240 lines** (threshold: 230)
- `src/client/ui/CharacterCreatorModal.tsx`: **239 lines** (threshold: 230)
- `src/sim/systems/transit.system.ts`: **239 lines** (threshold: 230)
- `src/client/main.tsx`: **238 lines** (threshold: 230)
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
- `HARVEST_CORPSE`
- `HIRE_COMPANION`
- `PICK_UP_ITEM`
- `TOGGLE_DOOR`
- `USE_ITEM`
- `WAIT_TURN`
- **Unwired Blind-Spot Commands (Missing from Context/Serializer)**:
- `EMIT_SPARK`
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


Aether & Soot's telemetry shows a small but focused active command surface — four wired commands (ATTACK_ACTOR, MOVE_STEP, USE_PORTAL, VENT_STEAM) — paired with a larger pool of eight unwired commands that exist in the codebase but are not yet driving gameplay loops. The architecture is split across three near-cap files: `src/sim/core/world.ts` (core world state), `src/sim/systems/character-archetypes.ts` (player/NPC build definitions), and `src/sim/systems/inventory.system.ts` (loot/equipment handling). This modular separation suggests a design intent where systems compose rather than interlock tightly, which is a strength for systemic depth.

Against CDDA, Aether & Soot trades faction-level NPC agency for tighter player-system coupling. CDDA's NPCs carry goals, faction standing, and procedural behavior; this game's telemetry shows no active NPC commands, so NPC agency is currently minimal. The gap is intentional — the Victorian roguelike focuses on environmental and mechanical systems (steam, prosthetics, pressure vessels) rather than emergent social dynamics.

Against Qud, the modular command layout mirrors Qud's philosophy of independent, composable systems (e.g., build slots, loot tables). The presence of a dedicated inventory system and character-archetype definitions supports the kind of build-driven depth Qud is known for, even if the current telemetry only exercises the player side. The trade-off is that Aether & Soot's procedural depth is currently environmental (world state, portals) rather than character-driven.

Against Arcostate — the same studio's earlier work — the shared Victorian/industrial aesthetic is present (steam, prosthetics), but Arcostate tends toward simpler enemy behavior. Aether & Soot's telemetry shows more mechanical variety (prosthetics, looting, pressure vessels) and a larger unwired surface, suggesting a more ambitious system than Arcostate's current scope. The Phase 46 WebAudio soundscape is a step toward the atmospheric layering that could give NPCs or locations a stronger sense of presence.

The core critique: the architecture supports depth (modular files, separate command pools), but the active surface is narrow. NPC agency is not yet realized in telemetry; the design has the building blocks (character-archetypes, unwired commands) to add it later, and Phase 46's soundscape is a candidate for environmental storytelling that could anchor NPC behavior.

## 5. Self-Directed Prescriptions for Next Phase (P1, P2, P3)

**P1 — Wire the unwired surface with design intent.** The eight unwired commands are architectural scaffolding; wire them in order of player-impact and thematic fit: PAY_CHIRURGEON_HEAL and INSTALL_PROSTHETIC (character customization tied to character-archetypes.ts), LOAD_AMMO and LOOT_CONTAINER (inventory.system.ts), EMIT_SPARK and PRESSURIZE_VESSEL (environmental hazard/feedback), PRY_OBSTACLE and VENT_STEAM (mechanical interaction). Do not wire all at once — keep the active set small as in the current telemetry. The goal is to expand the player's agency surface without bloating the core loop.

**P2 — Phase 46 soundscape integration.** The priority is the WebAudio synthesizer wired to finalized SimEvent triggers across Phases 37–45. Treat VENT_STEAM as a sonic texture within that shell (steam hiss, pressure release) so the mechanical systems and audio reinforce each other. This is the highest-priority item per telemetry and should be completed before expanding the active command set further.

**P3 — Seed NPC agency from the same architectural pool.** Use the unwired commands as a design brief for NPC behavior: PRESSURIZE_VESSEL and PRY_OBSTACLE suggest that environmental manipulation is a known mechanic; NPCs could use those same actions (or simplified variants) to patrol, defend, or flee. Tie character-archetypes.ts to enemy classes so the same build language defines both player and NPC behavior — this gives NPCs consistent agency without inventing new systems. Even a minimal chase/defend loop wired through USE_PORTAL and VENT_STEAM would give the world actors presence.

## 6. Next-Phase Handoff Prompt

```markdown
Implement **Phase 46: Procedural WebAudio Soundscape & Acoustic Synth Shell**: WebAudio synthesizer wired to finalized `SimEvent` triggers across Phases 37–45. adhering to AGENTS.md and ARCHITECTURE.md:
1. Run `npm run hermes:scout -- --task "the active phase"` and complete the 6-point Pre-Flight Impact Analysis (including STATE.md P1/P2/P3 triage).
2. Pre-split any src/ hotspot >= 245 lines (`src/sim/core/world.ts` (245 lines)) via `npm run hermes:split`.
3. Implement the active phase while folding in P2 (systemic cross-wiring & unwired serializer commands: `EMIT_SPARK`, `INSTALL_PROSTHETIC`, `INSTALL_WEAPON_MOD`, `LOAD_AMMO`) and P3 (serialization & deterministic unit tests in tests/sim/), and promoting any out-of-budget P1 agency items into ROADMAP.md.
4. Delegate blueprints (`generate:content`), event logs (`hermes:chronicler`), and test scaffolding (`hermes:testgen`) to local models.
5. Run `npm run verify`, `npm run hermes:critic`, and `npm run sync:state`, then output the next copy-pasteable prompt.
```
