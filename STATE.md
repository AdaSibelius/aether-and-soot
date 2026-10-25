# Project State

**Last Updated:** 2026-10-25

## Recent Commits
- 8c4ecc5: feat(tooling): implement Phase UI-5 hermes-vision-critic layout verifier & audit pipeline
- 19ea947: test(ui): add 6-modal zero-truncation & border-collision verification
- 0a2b180: feat(ui): implement Phase UI-4 CDDA artificer bench, atlas minimap, market exchange & codex

## Immediate Next Priority
- **Phase 51: City Causality Graph & Strategic Overworld Topology**: Model directional physical conduits (`STEAM_MAIN`, `COAL_BARGE_CANAL`, `SLUICE_DRAINAGE`, `PNEUMATIC_CHUTE`) connecting districts across strata (`src/schemas/city-graph.schema.ts`, `src/sim/spatial/city-graph.ts`). Disrupted conduits propagate downstream pressure/flow loss during macro-ticks (`CONDUIT_STATUS_CHANGED`). Add an Infrastructure overlay view to the World Atlas (`[W]`).

## 5. Self-Directed Prescriptions for Next Phase
- **P1: Phase 51** [UNREACHABLE_MECHANIC]: Focus core systems development on **Phase 51: City Causality Graph & Strategic Overworld Topology**: Model directional physical conduits (`STEAM_MAIN`, `COAL_BARGE_CANAL`, `SLUICE_DRAINAGE`, `PNEUMATIC_CHUTE`) connecting districts across strata (`src/schemas/city-graph.schema.ts`, `src/sim/spatial/city-graph.ts`). Disrupted conduits propagate downstream pressure/flow loss during macro-ticks (`CONDUIT_STATUS_CHANGED`). Add an Infrastructure overlay view to the World Atlas (`[W]`). resolving unwiredCommands and telemetry anomalies. (Target: `src/client/ui/CharacterCreatorModal.tsx`, `src/sim/core/engine.ts` | Verification: `tests/sim/determinism.test.ts`)
- **P2: Expand Playtest Serializer Command Surface** [SIM_BALANCE]: Wire unwired commands (REMOVE_PROSTHETIC, REPORT_CRIME, REST_AT_BED, SET_POSTURE) to reduce unwiredCommands count. (Target: `tests/scripts/playtester-serializer.ts` | Verification: `tests/sim/determinism.test.ts`)
- **P3: Modularity Guard & File Splitting** [MODULE_SPLIT]: Monitor and pre-split near-cap modules like src/client/ui/CharacterCreatorModal.tsx to resolve modularityHotspot anomaly. (Target: `src/client/ui/CharacterCreatorModal.tsx` | Verification: `tests/sim/determinism.test.ts`)

## 6. Next-Phase Handoff Prompt

```markdown
Implement **Phase 51: City Causality Graph & Strategic Overworld Topology**: Model directional physical conduits (`STEAM_MAIN`, `COAL_BARGE_CANAL`, `SLUICE_DRAINAGE`, `PNEUMATIC_CHUTE`) connecting districts across strata (`src/schemas/city-graph.schema.ts`, `src/sim/spatial/city-graph.ts`). Disrupted conduits propagate downstream pressure/flow loss during macro-ticks (`CONDUIT_STATUS_CHANGED`). Add an Infrastructure overlay view to the World Atlas (`[W]`). adhering to AGENTS.md and ARCHITECTURE.md:
1. Run `npm run hermes:scout -- --task "the active phase"` and complete the 6-point Pre-Flight Impact Analysis (including STATE.md P1/P2/P3 triage).
2. Pre-split any src/ hotspot >= 245 lines (`src/client/ui/CharacterCreatorModal.tsx` (247 lines)) via `npm run hermes:split`.
3. Implement the active phase while folding in P2 (systemic cross-wiring & unwired serializer commands: `REMOVE_PROSTHETIC`, `REPORT_CRIME`, `REST_AT_BED`, `SET_POSTURE`) and P3 (serialization & deterministic unit tests in tests/sim/), and promoting any out-of-budget P1 agency items into ROADMAP.md.
4. Delegate blueprints (`generate:content`), event logs (`hermes:chronicler`), and test scaffolding (`hermes:testgen`) to local models.
5. Run `npm run verify`, `npm run hermes:critic`, and `npm run sync:state`, then output the next copy-pasteable prompt.
```

## Autonomous Critic Backlog (Sanity-Verified)

| Priority | Category | Title | Directive | Target Files | Verification |
| --- | --- | --- | --- | --- | --- |
| P1 | UNREACHABLE_MECHANIC | Phase 51 | Focus core systems development on **Phase 51: City Causality Graph & Strategic Overworld Topology**: Model directional physical conduits (`STEAM_MAIN`, `COAL_BARGE_CANAL`, `SLUICE_DRAINAGE`, `PNEUMATIC_CHUTE`) connecting districts across strata (`src/schemas/city-graph.schema.ts`, `src/sim/spatial/city-graph.ts`). Disrupted conduits propagate downstream pressure/flow loss during macro-ticks (`CONDUIT_STATUS_CHANGED`). Add an Infrastructure overlay view to the World Atlas (`[W]`). resolving unwiredCommands and telemetry anomalies. | `src/client/ui/CharacterCreatorModal.tsx`, `src/sim/core/engine.ts` | `tests/sim/determinism.test.ts` |
