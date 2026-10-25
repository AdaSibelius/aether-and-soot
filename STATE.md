# Project State

**Last Updated:** 2026-10-25

## Recent Commits
- e454d70: feat(sim): implement Phase 50 interactive world features and hazards (#82) (#83)
- 4d493eb: feat(tooling): add TSX-aware split, mechanic scaffolder, and workflow skills (#81)
- e7dba65: chore(repo): prune merged feature branches and update test telemetry

## Immediate Next Priority
- All scheduled phases completed

## 5. Self-Directed Prescriptions for Next Phase
- **P1: All scheduled phases completed** [UNREACHABLE_MECHANIC]: Focus core systems development on All scheduled phases completed resolving unwiredCommands and telemetry anomalies. (Target: `src/client/ui/CharacterCreatorModal.tsx`, `src/sim/core/engine.ts` | Verification: `tests/sim/determinism.test.ts`)
- **P2: Expand Playtest Serializer Command Surface** [SIM_BALANCE]: Wire unwired commands (REMOVE_PROSTHETIC, REPORT_CRIME, REST_AT_BED, SET_POSTURE) to reduce unwiredCommands count. (Target: `tests/scripts/playtester-serializer.ts` | Verification: `tests/sim/determinism.test.ts`)
- **P3: Modularity Guard & File Splitting** [MODULE_SPLIT]: Monitor and pre-split near-cap modules like src/client/ui/CharacterCreatorModal.tsx to resolve modularityHotspot anomaly. (Target: `src/client/ui/CharacterCreatorModal.tsx` | Verification: `tests/sim/determinism.test.ts`)

## 6. Next-Phase Handoff Prompt

```markdown
Implement All scheduled phases completed adhering to AGENTS.md and ARCHITECTURE.md:
1. Run `npm run hermes:scout -- --task "the active phase"` and complete the 6-point Pre-Flight Impact Analysis (including STATE.md P1/P2/P3 triage).
2. Pre-split any src/ hotspot >= 245 lines (`src/client/ui/CharacterCreatorModal.tsx` (247 lines)) via `npm run hermes:split`.
3. Implement the active phase while folding in P2 (systemic cross-wiring & unwired serializer commands: `REMOVE_PROSTHETIC`, `REPORT_CRIME`, `REST_AT_BED`, `SET_POSTURE`) and P3 (serialization & deterministic unit tests in tests/sim/), and promoting any out-of-budget P1 agency items into ROADMAP.md.
4. Delegate blueprints (`generate:content`), event logs (`hermes:chronicler`), and test scaffolding (`hermes:testgen`) to local models.
5. Run `npm run verify`, `npm run hermes:critic`, and `npm run sync:state`, then output the next copy-pasteable prompt.
```

## Autonomous Critic Backlog (Sanity-Verified)

| Priority | Category | Title | Directive | Target Files | Verification |
| --- | --- | --- | --- | --- | --- |
| P1 | UNREACHABLE_MECHANIC | All scheduled phases completed | Focus core systems development on All scheduled phases completed resolving unwiredCommands and telemetry anomalies. | `src/client/ui/CharacterCreatorModal.tsx`, `src/sim/core/engine.ts` | `tests/sim/determinism.test.ts` |
