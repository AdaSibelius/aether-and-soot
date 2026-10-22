# Project State

**Last Updated:** 2026-10-22

## Recent Commits
- [Phase 47]: Implement Procedural Architectural Biomes, Topography & Extended CP437/Unicode Glyph Visuals (Closes #46)
- 7ccd9e6: Establish Tier E: Procedural Worldcraft, Architectural Archetypes & Visual Density (Phases 47-50)
- 1e47c24: Implement Phase 46: Procedural WebAudio Soundscape & Acoustic Synth Shell (Closes #44) (#45)
- 22d5b92: Implement Phase 45: Dynamic Turf Skirmishes, Economic Supply Escorts & Royal Society Politics (Closes #42) (#43)

## Immediate Next Priority
- **Phase 48: Multi-Room Building Prefab Engine, Architectural Typology & Landmark Micro-Locations**: Create procedural multi-room floorplan generation with structural interior zoning (reception, workshop, vault, surgical bay, storage). Build 6 distinctive building archetypes (*Victorian Apothecary & Chirurgeon Clinic*, *Clockwork Pawnshop & Cartel Bank*, *Steam Boilerhouse & Slag Furnace*, *Tenement Rookeries*, *Pneumatic Monorail Depot*, *Guild Artisan Workshop*) and outdoor street landmarks (water pump stations, street-corner clocktowers, sunken canal locks, Spire rooftop greenhouses).

## 5. Self-Directed Prescriptions for Next Phase (P1, P2, P3)

**P1 — Phase 48: Multi-Room Building Prefab Engine, Architectural Typology & Landmark Micro-Locations.** Implement procedural multi-room floorplan generation with structural interior zoning (reception, workshop, vault, surgical bay, storage). Build 6 distinctive building archetypes (*Victorian Apothecary & Chirurgeon Clinic*, *Clockwork Pawnshop & Cartel Bank*, *Steam Boilerhouse & Slag Furnace*, *Tenement Rookeries*, *Pneumatic Monorail Depot*, *Guild Artisan Workshop*) and outdoor street landmarks (water pump stations, street-corner clocktowers, sunken canal locks, Spire rooftop greenhouses).

**P2 — Modular Building Engine & Prefab Splitting.** Pre-split `src/sim/spatial/building-prefabs.ts` (currently 235 lines) and near-cap files like `src/sim/systems/character-archetypes.ts` (243 lines) via `npm run hermes:split` into specialized zoning and archetype sub-modules to stay strictly beneath the 250-line ceiling.

**P3 — Serialization, Landmark Micro-Locations & Deterministic Tests.** Ensure all procedural interior room entities, containers, and landmark micro-locations are 100% serializable in `WorldState` and tested with deterministic tests in `tests/sim/phase48-building-prefabs.test.ts`.

## 6. Next-Phase Handoff Prompt

```markdown
Implement **Phase 48: Multi-Room Building Prefab Engine, Architectural Typology & Landmark Micro-Locations**: Create procedural multi-room floorplan generation with structural interior zoning (reception, workshop, vault, surgical bay, storage). Build 6 distinctive building archetypes (*Victorian Apothecary & Chirurgeon Clinic*, *Clockwork Pawnshop & Cartel Bank*, *Steam Boilerhouse & Slag Furnace*, *Tenement Rookeries*, *Pneumatic Monorail Depot*, *Guild Artisan Workshop*) and outdoor street landmarks (water pump stations, street-corner clocktowers, sunken canal locks, Spire rooftop greenhouses) adhering strictly to AGENTS.md and ARCHITECTURE.md:
1. Run `npm run hermes:scout -- --task "the active phase"` and complete the 6-point Pre-Flight Impact Analysis (including STATE.md P1/P2/P3 triage).
2. Pre-split any src/ hotspot >= 240 lines (`src/sim/systems/character-archetypes.ts` (243 lines), `src/sim/spatial/building-prefabs.ts` (235 lines)) via `npm run hermes:split`.
3. Implement the active phase while folding in P2 (multi-room interior zoning & archetype decoupling) and P3 (serialization & deterministic unit tests in tests/sim/), and promoting any out-of-budget P1 agency items into ROADMAP.md.
4. Delegate blueprints (`generate:content`), event logs (`hermes:chronicler`), and test scaffolding (`hermes:testgen`) to local models.
5. Run `npm run verify`, `npm run hermes:critic`, and `npm run sync:state`, then output the next copy-pasteable prompt.
```
