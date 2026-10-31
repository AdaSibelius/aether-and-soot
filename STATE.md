# Project State

**Last Updated:** 2026-10-31

## Recent Commits
- 9be9f52: fix(ui): center tactical viewport in columns 0..57, fill console bezel background, and scale window to full display
- 3bba341: fix(build): install @fontsource/ibm-plex-mono and remove duplicate bare CSS @import in index.html
- c74fcff: feat(procgen): implement true seeded macro-layout, 2D compass gates, distinct strata topologies, and quantitative diversity tests

## Immediate Next Priority
- Phase 56: Causal Supply Chains & Disruption Cascades: Aggregate macro-tick simulation of 3 vital commodities (Anthracite Coal, Carbolic Tincture, Preserved Rations). Scarcity events trigger downstream consequences: clinic medicine stockouts, workshop steam outages, merchant price inflation, and worker shift strikes.

## 5. Self-Directed Prescriptions for Next Phase
- **P1: Phase 56** [UNREACHABLE_MECHANIC]: Implement a bounded circular buffer storing the last 50 significant historical events in WorldState.chronicle. Ensure NPCs within line-of-sight or acoustic range log witnessed incidents into the witnessedEvents collection. Diffuse rumors across shift changes with faction-slanted blame attribution in dynamic dialogue barks. (Target: `src/sim/core/engine.ts`, `src/client/bootstrap-loop.ts`, `src/client/input/keyboard-router.ts`, `src/client/input/modal-nav-router.ts` | Verification: `tests/sim/determinism.test.ts`)
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
| P1 | UNREACHABLE_MECHANIC | Phase 56 | Implement a bounded circular buffer storing the last 50 significant historical events in WorldState.chronicle. Ensure NPCs within line-of-sight or acoustic range log witnessed incidents into the witnessedEvents collection. Diffuse rumors across shift changes with faction-slanted blame attribution in dynamic dialogue barks. | `src/sim/core/engine.ts`, `src/client/bootstrap-loop.ts`, `src/client/input/keyboard-router.ts`, `src/client/input/modal-nav-router.ts` | `tests/sim/determinism.test.ts` |
| P2 | SIM_BALANCE | Expand Playtest Serializer Command Surface | Wire unwired commands (REMOVE_PROSTHETIC, REPORT_CRIME, REST_AT_BED, SET_POSTURE) to reduce unwiredCommands count. | `tests/scripts/playtester-serializer.ts` | `tests/sim/determinism.test.ts` |
| P3 | MODULE_SPLIT | Modularity Guard & File Splitting | Monitor and pre-split near-cap modules like tests/scripts/hermes-critic.ts and playtester-projection-audit.ts to enforce 250-line target. | `tests/scripts/hermes-critic.ts`, `tests/scripts/playtester-projection-audit.ts` | `tests/sim/determinism.test.ts` |
