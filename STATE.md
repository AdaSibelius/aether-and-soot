# Project State

**Last Updated:** 2026-10-22

## Recent Commits
- 135f280: Implement Phase 48: Multi-Room Building Prefab Engine, Architectural Typology & Landmark Micro-Locations (#48) (#49)
- 2afd1d9: Implement Phase 47: Procedural Architectural Biomes, Topography & Extended CP437/Unicode Glyph Visuals (#47)
- 7ccd9e6: Establish Tier E: Procedural Worldcraft, Architectural Archetypes & Visual Density (Phases 47-50)

## Immediate Next Priority
- **Phase 50: Interactive World Features, Tactical Environmental Hazards & Tangible Mechanical Agency**: Full gameplay wiring and systemic execution of the remaining unwired environmental agency commands (`LOOT_CONTAINER` for interactive furniture searches with booby-trap triggers, `PRESSURIZE_VESSEL` for tactical steam burst breaches, `PRY_OBSTACLE` for crowbar prying on jammed grates/doors, and `PAY_CHIRURGEON_HEAL` for clinic operating table services). Add dynamic volumetric gaslight illumination, drifting soot clouds with dynamic ASCII character occlusion (`%`, `&`, `*`), whale oil puddles with ignition cascades, and corrosive acid drip hazards.

## 5. Self-Directed Prescriptions for Next Phase (P1, P2, P3)

**P1 — Phase 50: Interactive World Features, Tactical Environmental Hazards & Tangible Mechanical Agency.** Full gameplay wiring and systemic execution of the remaining unwired environmental agency commands (`LOOT_CONTAINER` for interactive furniture searches with booby-trap triggers, `PRESSURIZE_VESSEL` for tactical steam burst breaches, `PRY_OBSTACLE` for crowbar prying on jammed grates/doors, and `PAY_CHIRURGEON_HEAL` for clinic operating table services). Add dynamic volumetric gaslight illumination, drifting soot clouds with dynamic ASCII character occlusion (`%`, `&`, `*`), whale oil puddles with ignition cascades, and corrosive acid drip hazards.

**P2 — Modularity & Schema Pre-Splitting.** Pre-split any near-cap hotspot files approaching the 250-line target (e.g. `src/schemas/domain-events.schema.ts` (242 lines), `src/schemas/commands.schema.ts` (244 lines), and `src/sim/systems/prosthetics.system.ts` (249 lines)) via `npm run hermes:split` before adding new command execution logic.

**P3 — Environmental Hazard Mechanics, Serialization & Deterministic Unit Tests.** Implement volumetric gaslight and drifting soot simulation in `src/sim/systems/hazards.system.ts` with complete save-state serialization coverage in `WorldState` and deterministic tests in `tests/sim/phase50-interactive-hazards.test.ts`.

## 6. Next-Phase Handoff Prompt

```markdown
Implement **Phase 50: Interactive World Features, Tactical Environmental Hazards & Tangible Mechanical Agency**: Full gameplay wiring and systemic execution of the remaining unwired environmental agency commands (`LOOT_CONTAINER` for interactive furniture searches with booby-trap triggers, `PRESSURIZE_VESSEL` for tactical steam burst breaches, `PRY_OBSTACLE` for crowbar prying on jammed grates/doors, and `PAY_CHIRURGEON_HEAL` for clinic operating table services). Add dynamic volumetric gaslight illumination, drifting soot clouds with dynamic ASCII character occlusion (`%`, `&`, `*`), whale oil puddles with ignition cascades, and corrosive acid drip hazards adhering strictly to AGENTS.md and ARCHITECTURE.md:
1. Run `npm run hermes:scout -- --task "the active phase"` and complete the 6-point Pre-Flight Impact Analysis (including STATE.md P1/P2/P3 triage).
2. Pre-split any src/ hotspot >= 240 lines (`src/schemas/domain-events.schema.ts` (242 lines), `src/schemas/commands.schema.ts` (244 lines)) via `npm run hermes:split`.
3. Implement the active phase while folding in P2 (unwired agency commands execution) and P3 (serialization & deterministic unit tests in tests/sim/), and promoting any out-of-budget P1 agency items into ROADMAP.md.
4. Delegate blueprints (`generate:content`), event logs (`hermes:chronicler`), and test scaffolding (`hermes:testgen`) to local models.
5. Run `npm run verify`, `npm run hermes:critic`, and `npm run sync:state`, then output the next copy-pasteable prompt.
```
