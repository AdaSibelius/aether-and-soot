# Project State

**Last Updated:** 2026-10-29

## Recent Commits
- 8ae4667: feat(phase4): activate 5-layer pipeline, spire vertical parallax underlay, and spatial reachability tests
- cb5d4d7: feat(phase4): tactical console 30-col layout, embarkation rebalance, framed market turf, and fog-of-war atlas
- 71d9687: feat(phase3): formalize 8-stage procgen pipeline, anti-stamping grammars, and utility networks

## Immediate Next Priority
- Phase 56: Causal Supply Chains & Disruption Cascades: Aggregate macro-tick simulation of 3 vital commodities (Anthracite Coal, Carbolic Tincture, Preserved Rations). Scarcity events trigger downstream consequences: clinic medicine stockouts, workshop steam outages, merchant price inflation, and worker shift strikes.

## 5. Self-Directed Prescriptions for Next Phase
- **P1: Phase 56** [UNREACHABLE_MECHANIC]: Focus core systems development on **Phase 56: Bounded World Chronicle, Witness Memory & Rumor Network**: Bounded circular buffer of the last 50 significant historical events in `WorldState.chronicle`. NPCs in line-of-sight or acoustic range log witnessed incidents into `witnessedEvents`, diffusing rumors across shift changes with faction-slanted blame attribution in dynamic dialogue barks. resolving unwiredCommands and telemetry anomalies. (Target: `src/sim/systems/squad-witness.system.ts`, `src/sim/systems/dialogue-quest.system.ts` | Verification: `tests/sim/determinism.test.ts`)
- **P2: Expand Playtest Serializer Command Surface** [SIM_BALANCE]: Wire unwired commands (REMOVE_PROSTHETIC, REPORT_CRIME, REST_AT_BED, SET_POSTURE) to reduce unwiredCommands count. (Target: `tests/scripts/playtester-serializer.ts` | Verification: `tests/sim/determinism.test.ts`)
- **P3: Modularity Guard & File Splitting** [MODULE_SPLIT]: Monitor and pre-split near-cap modules like tests/scripts/hermes-critic.ts and playtester-projection-audit.ts to enforce 250-line target. (Target: `tests/scripts/hermes-critic.ts`, `tests/scripts/playtester-projection-audit.ts` | Verification: `tests/sim/determinism.test.ts`)

## 6. Next-Phase Handoff Prompt

```markdown
Implement **Phase 56**: Causal Supply Chains & Disruption Cascades: Aggregate macro-tick simulation of 3 vital commodities (Anthracite Coal, Carbolic Tincture, Preserved Rations). Scarcity events trigger downstream consequences: clinic medicine stockouts, workshop steam outages, merchant price inflation, and worker shift strikes. adhering to AGENTS.md and ARCHITECTURE.md:
1. Run `npm run hermes:scout -- --task "the active phase"` and complete the 6-point Pre-Flight Impact Analysis (including STATE.md P1/P2/P3 triage).
2. Pre-split any src/ hotspot >= 245 lines (`src/client/bootstrap-loop.ts` (271 lines)) via `npm run hermes:split`.
3. Implement the active phase while folding in P2 (systemic cross-wiring & unwired serializer commands) and P3 (serialization & deterministic unit tests in tests/sim/), and promoting any out-of-budget P1 agency items into ROADMAP.md.
4. Delegate blueprints (`generate:content`), event logs (`hermes:chronicler`), and test scaffolding (`hermes:testgen`) to local models.
5. Run `npm run verify`, `npm run hermes:critic`, and `npm run sync:state`, then output the next copy-pasteable prompt.
```

## Autonomous Critic Backlog (Sanity-Verified)

| Priority | Category | Title | Directive | Target Files | Verification |
| --- | --- | --- | --- | --- | --- |
| P1 | UNREACHABLE_MECHANIC | Phase 56 | Focus core systems development on **Phase 56: Bounded World Chronicle, Witness Memory & Rumor Network**: Bounded circular buffer of the last 50 significant historical events in `WorldState.chronicle`. NPCs in line-of-sight or acoustic range log witnessed incidents into `witnessedEvents`, diffusing rumors across shift changes with faction-slanted blame attribution in dynamic dialogue barks. resolving unwiredCommands and telemetry anomalies. | `src/sim/systems/squad-witness.system.ts`, `src/sim/systems/dialogue-quest.system.ts` | `tests/sim/determinism.test.ts` |
| P2 | SIM_BALANCE | Expand Playtest Serializer Command Surface | Wire unwired commands (REMOVE_PROSTHETIC, REPORT_CRIME, REST_AT_BED, SET_POSTURE) to reduce unwiredCommands count. | `tests/scripts/playtester-serializer.ts` | `tests/sim/determinism.test.ts` |
| P3 | MODULE_SPLIT | Modularity Guard & File Splitting | Monitor and pre-split near-cap modules like tests/scripts/hermes-critic.ts and playtester-projection-audit.ts to enforce 250-line target. | `tests/scripts/hermes-critic.ts`, `tests/scripts/playtester-projection-audit.ts` | `tests/sim/determinism.test.ts` |
