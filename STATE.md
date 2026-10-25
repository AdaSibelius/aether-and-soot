# Project State

**Last Updated:** 2026-10-25

## Recent Commits
- 340a681: docs(audit): add 3-track architectural, systemic, and UI evaluation report
- b0031a6: feat(test): implement 1,000-turn emergence fuzzer, state ledger, and Phase 51 prep
- 62e1fe3: chore: sync playtest report timestamp

## Immediate Next Priority
- **Phase 51: City Causality Graph & Strategic Overworld Topology** *(STATUS: SCOPED & PREPPED — AWAITING DISPATCH)*:

## 5. Self-Directed Prescriptions for Next Phase
- **P1: Phase 51** [UNREACHABLE_MECHANIC]: Focus core systems development on **Phase 51: City Causality Graph & Strategic Overworld Topology** *(STATUS: SCOPED & PREPPED — AWAITING DISPATCH)*: resolving unwiredCommands and telemetry anomalies. (Target: `src/client/projection/frame-adapter.ts`, `src/sim/core/engine.ts` | Verification: `tests/sim/determinism.test.ts`)
- **P2: Expand Playtest Serializer Command Surface** [SIM_BALANCE]: Wire unwired commands (REMOVE_PROSTHETIC, REPORT_CRIME, REST_AT_BED, SET_POSTURE) to reduce unwiredCommands count. (Target: `tests/scripts/playtester-serializer.ts` | Verification: `tests/sim/determinism.test.ts`)
- **P3: Modularity Guard & File Splitting** [MODULE_SPLIT]: Monitor and pre-split near-cap modules like src/client/projection/frame-adapter.ts to resolve modularityHotspot anomaly. (Target: `src/client/projection/frame-adapter.ts` | Verification: `tests/sim/determinism.test.ts`)

## 6. Next-Phase Handoff Prompt

```markdown
Implement **Phase 51: City Causality Graph & Strategic Overworld Topology** *(STATUS: SCOPED & PREPPED — AWAITING DISPATCH)*: adhering to AGENTS.md and ARCHITECTURE.md:
1. Run `npm run hermes:scout -- --task "the active phase"` and complete the 6-point Pre-Flight Impact Analysis (including STATE.md P1/P2/P3 triage).
2. Pre-split any src/ hotspot >= 245 lines (`src/client/projection/frame-adapter.ts` (251 lines)) via `npm run hermes:split`.
3. Implement the active phase while folding in P2 (systemic cross-wiring & unwired serializer commands: `REMOVE_PROSTHETIC`, `REPORT_CRIME`, `REST_AT_BED`, `SET_POSTURE`) and P3 (serialization & deterministic unit tests in tests/sim/), and promoting any out-of-budget P1 agency items into ROADMAP.md.
4. Delegate blueprints (`generate:content`), event logs (`hermes:chronicler`), and test scaffolding (`hermes:testgen`) to local models.
5. Run `npm run verify`, `npm run hermes:critic`, and `npm run sync:state`, then output the next copy-pasteable prompt.
```

## Autonomous Critic Backlog (Sanity-Verified)

| Priority | Category | Title | Directive | Target Files | Verification |
| --- | --- | --- | --- | --- | --- |
| P1 | UNREACHABLE_MECHANIC | Phase 51 | Focus core systems development on **Phase 51: City Causality Graph & Strategic Overworld Topology** *(STATUS: SCOPED & PREPPED — AWAITING DISPATCH)*: resolving unwiredCommands and telemetry anomalies. | `src/client/projection/frame-adapter.ts`, `src/sim/core/engine.ts` | `tests/sim/determinism.test.ts` |
