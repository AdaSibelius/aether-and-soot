# Project State

**Last Updated:** 2026-10-25

## Recent Commits
- 4d493eb: feat(tooling): add TSX-aware split, mechanic scaffolder, and workflow skills (#81)
- e7dba65: chore(repo): prune merged feature branches and update test telemetry
- 1c389e9: feat(pipeline): complete antigravity agent skills specification suite (#78) (#79)

## Immediate Next Priority
- **Phase 50: Interactive World Features, Tactical Environmental Hazards & Tangible Mechanical Agency**: Full gameplay wiring and systemic execution of the remaining unwired environmental agency commands (`LOOT_CONTAINER` for interactive furniture searches with booby-trap triggers, `PRESSURIZE_VESSEL` for tactical steam burst breaches, `PRY_OBSTACLE` for crowbar prying on jammed grates/doors, and `PAY_CHIRURGEON_HEAL` for clinic operating table services). Add dynamic volumetric gaslight illumination, drifting soot clouds with dynamic ASCII character occlusion (`%`, `&`, `*`), whale oil puddles with ignition cascades, and corrosive acid drip hazards.

## 5. Self-Directed Prescriptions for Next Phase
- **P1: Phase 50** [UNREACHABLE_MECHANIC]: Implement full gameplay wiring and systemic execution of the remaining unwired environmental agency commands: LOOT_CONTAINER for interactive furniture searches with booby-trap triggers, PRESSURIZE_VESSEL for tactical steam burst breaches, PRY_OBSTACLE for crowbar prying on jammed grates/doors, PAY_CHIRURGEON_HEAL for clinic operating table services. Add dynamic volumetric gaslight illumination, drifting soot clouds with dynamic ASCII character occlusion using % & *, whale oil puddles with ignition cascades, and corrosive acid drip hazards. Ensure deterministic execution of all 8 unwired commands (REMOVE_PROSTHETIC, REPORT_CRIME, REST_AT_BED, SET_POSTURE, SMASH_TERRAIN, THROW_FLASK, TRAVEL_DISTRICT, TRIGGER_SUPPLY_SHOCK). (Target: `src/sim/core/engine.ts`, `src/client/ui/CharacterCreatorModal.tsx`, `src/client/ui/ItemDossierCard.tsx`, `src/sim/systems/container.system.ts` | Verification: `tests/sim/determinism.test.ts`)

## 6. Next-Phase Handoff Prompt

```markdown
Implement **Phase 50: Interactive World Features, Tactical Environmental Hazards & Tangible Mechanical Agency**: Full gameplay wiring and systemic execution of the remaining unwired environmental agency commands (`LOOT_CONTAINER` for interactive furniture searches with booby-trap triggers, `PRESSURIZE_VESSEL` for tactical steam burst breaches, `PRY_OBSTACLE` for crowbar prying on jammed grates/doors, and `PAY_CHIRURGEON_HEAL` for clinic operating table services). Add dynamic volumetric gaslight illumination, drifting soot clouds with dynamic ASCII character occlusion (`%`, `&`, `*`), whale oil puddles with ignition cascades, and corrosive acid drip hazards. adhering to AGENTS.md and ARCHITECTURE.md:
1. Run `npm run hermes:scout -- --task "the active phase"` and complete the 6-point Pre-Flight Impact Analysis (including STATE.md P1/P2/P3 triage).
2. Pre-split any src/ hotspot >= 245 lines (`src/client/ui/CharacterCreatorModal.tsx` (247 lines)) via `npm run hermes:split`.
3. Implement the active phase while folding in P2 (systemic cross-wiring & unwired serializer commands: `REMOVE_PROSTHETIC`, `REPORT_CRIME`, `REST_AT_BED`, `SET_POSTURE`) and P3 (serialization & deterministic unit tests in tests/sim/), and promoting any out-of-budget P1 agency items into ROADMAP.md.
4. Delegate blueprints (`generate:content`), event logs (`hermes:chronicler`), and test scaffolding (`hermes:testgen`) to local models.
5. Run `npm run verify`, `npm run hermes:critic`, and `npm run sync:state`, then output the next copy-pasteable prompt.
```

## Autonomous Critic Backlog (Sanity-Verified)

| Priority | Category | Title | Directive | Target Files | Verification |
| --- | --- | --- | --- | --- | --- |
| P1 | UNREACHABLE_MECHANIC | Phase 50 | Implement full gameplay wiring and systemic execution of the remaining unwired environmental agency commands: LOOT_CONTAINER for interactive furniture searches with booby-trap triggers, PRESSURIZE_VESSEL for tactical steam burst breaches, PRY_OBSTACLE for crowbar prying on jammed grates/doors, PAY_CHIRURGEON_HEAL for clinic operating table services. Add dynamic volumetric gaslight illumination, drifting soot clouds with dynamic ASCII character occlusion using % & *, whale oil puddles with ignition cascades, and corrosive acid drip hazards. Ensure deterministic execution of all 8 unwired commands (REMOVE_PROSTHETIC, REPORT_CRIME, REST_AT_BED, SET_POSTURE, SMASH_TERRAIN, THROW_FLASK, TRAVEL_DISTRICT, TRIGGER_SUPPLY_SHOCK). | `src/sim/core/engine.ts`, `src/client/ui/CharacterCreatorModal.tsx`, `src/client/ui/ItemDossierCard.tsx`, `src/sim/systems/container.system.ts` | `tests/sim/determinism.test.ts` |
