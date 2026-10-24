# Project State

**Last Updated:** 2026-10-24

## Recent Commits
- 5948b7d: fix(tooling): align telemetry anomaly severity schema in hermes-critic live prompt
- 99be4a2: Merge pull request #59 from AdaSibelius/feat/phase2.1-eradicate-raw-identifier-leaks
- 77e2e8e: feat: eradicate raw identifier leaks and substring truncation across client views (#58)

## Immediate Next Priority
- **Phase 50: Interactive World Features, Tactical Environmental Hazards & Tangible Mechanical Agency**: Full gameplay wiring and systemic execution of the remaining unwired environmental agency commands (`LOOT_CONTAINER` for interactive furniture searches with booby-trap triggers, `PRESSURIZE_VESSEL` for tactical steam burst breaches, `PRY_OBSTACLE` for crowbar prying on jammed grates/doors, and `PAY_CHIRURGEON_HEAL` for clinic operating table services). Add dynamic volumetric gaslight illumination, drifting soot clouds with dynamic ASCII character occlusion (`%`, `&`, `*`), whale oil puddles with ignition cascades, and corrosive acid drip hazards.

## 5. Self-Directed Prescriptions for Next Phase
- **P1: Phase 50** [UNREACHABLE_MECHANIC]: Focus core systems development on **Phase 50: Interactive World Features, Tactical Environmental Hazards & Tangible Mechanical Agency**: Full gameplay wiring and systemic execution of the remaining unwired environmental agency commands (`LOOT_CONTAINER` for interactive furniture searches with booby-trap triggers, `PRESSURIZE_VESSEL` for tactical steam burst breaches, `PRY_OBSTACLE` for crowbar prying on jammed grates/doors, and `PAY_CHIRURGEON_HEAL` for clinic operating table services). Add dynamic volumetric gaslight illumination, drifting soot clouds with dynamic ASCII character occlusion (`%`, `&`, `*`), whale oil puddles with ignition cascades, and corrosive acid drip hazards. resolving unwiredCommands and telemetry anomalies. (Target: `src/client/ui/AnatomyWindow.tsx`, `src/sim/core/engine.ts` | Verification: `tests/sim/determinism.test.ts`)
- **P2: Expand Playtest Serializer Command Surface** [SIM_BALANCE]: Wire unwired commands (DESCEND_CATACOMBS, EMIT_SQUAD_CALLOUT, LOOT_CONTAINER, PAY_CHIRURGEON_HEAL) to reduce unwiredCommands count. (Target: `tests/scripts/playtester-serializer.ts` | Verification: `tests/sim/determinism.test.ts`)
- **P3: Modularity Guard & File Splitting** [MODULE_SPLIT]: Monitor and pre-split near-cap modules like src/client/ui/AnatomyWindow.tsx to resolve modularityHotspot anomaly. (Target: `src/client/ui/AnatomyWindow.tsx` | Verification: `tests/sim/determinism.test.ts`)

## 6. Next-Phase Handoff Prompt

```markdown
Implement **Phase 50: Interactive World Features, Tactical Environmental Hazards & Tangible Mechanical Agency**: Full gameplay wiring and systemic execution of the remaining unwired environmental agency commands (`LOOT_CONTAINER` for interactive furniture searches with booby-trap triggers, `PRESSURIZE_VESSEL` for tactical steam burst breaches, `PRY_OBSTACLE` for crowbar prying on jammed grates/doors, and `PAY_CHIRURGEON_HEAL` for clinic operating table services). Add dynamic volumetric gaslight illumination, drifting soot clouds with dynamic ASCII character occlusion (`%`, `&`, `*`), whale oil puddles with ignition cascades, and corrosive acid drip hazards. adhering to AGENTS.md and ARCHITECTURE.md:
1. Run `npm run hermes:scout -- --task "the active phase"` and complete the 6-point Pre-Flight Impact Analysis (including STATE.md P1/P2/P3 triage).
2. Pre-split any src/ hotspot >= 245 lines (`src/client/ui/AnatomyWindow.tsx` (248 lines)) via `npm run hermes:split`.
3. Implement the active phase while folding in P2 (systemic cross-wiring & unwired serializer commands: `DESCEND_CATACOMBS`, `EMIT_SQUAD_CALLOUT`, `LOOT_CONTAINER`, `PAY_CHIRURGEON_HEAL`) and P3 (serialization & deterministic unit tests in tests/sim/), and promoting any out-of-budget P1 agency items into ROADMAP.md.
4. Delegate blueprints (`generate:content`), event logs (`hermes:chronicler`), and test scaffolding (`hermes:testgen`) to local models.
5. Run `npm run verify`, `npm run hermes:critic`, and `npm run sync:state`, then output the next copy-pasteable prompt.
```

## Autonomous Critic Backlog (Sanity-Verified)

| Priority | Category | Title | Directive | Target Files | Verification |
| --- | --- | --- | --- | --- | --- |
| P1 | UNREACHABLE_MECHANIC | Phase 50 | Focus core systems development on **Phase 50: Interactive World Features, Tactical Environmental Hazards & Tangible Mechanical Agency**: Full gameplay wiring and systemic execution of the remaining unwired environmental agency commands (`LOOT_CONTAINER` for interactive furniture searches with booby-trap triggers, `PRESSURIZE_VESSEL` for tactical steam burst breaches, `PRY_OBSTACLE` for crowbar prying on jammed grates/doors, and `PAY_CHIRURGEON_HEAL` for clinic operating table services). Add dynamic volumetric gaslight illumination, drifting soot clouds with dynamic ASCII character occlusion (`%`, `&`, `*`), whale oil puddles with ignition cascades, and corrosive acid drip hazards. resolving unwiredCommands and telemetry anomalies. | `src/client/ui/AnatomyWindow.tsx`, `src/sim/core/engine.ts` | `tests/sim/determinism.test.ts` |
