# Project State

**Last Updated:** 2026-10-22

## Recent Commits
- 37d32a0: Implement Phase 44: Artificer Safehouse Deeds, Furniture Construction & Royal Society Codex
- 18d2e9d: Configure 3-Tier Ollama routing (lfm2.5, gemma4, hermes3) across local tooling
- b5d0ad0: Fix hermes-critic model routing and make post-phase prescriptions fully dynamic

## Immediate Next Priority
- **Phase 45: Dynamic Turf Skirmishes, Economic Supply Escorts & Royal Society Politics**: Grounded in Phase 42 squad AI and Phase 43 monorail cargo transit between factions. Introduce autonomous Royal Society guild inspectors and rival artificers who audit safehouses, react to workshop deeds, and emit `NPC_GOAL_CHANGED` telemetry.

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
