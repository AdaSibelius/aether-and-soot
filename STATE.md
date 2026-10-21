# Project State

**Last Updated:** 2026-10-21

## Recent Commits
- 97b5927: Reprioritize ROADMAP.md around Phases 37-46 core simulation systems and sync STATE.md
- 3e356d5: docs(roadmap): mark Phases 32-36 complete and sync STATE.md for Phase 37
- cd8d950: Add Output Economy rule and automated STATE.md tracker

## Immediate Next Priority
- **Phase 37: Boiler Governor Bandwidth, Active Prosthetic Abilities & Corpse Harvesting**: Pre-split `src/sim/systems/anatomy.system.ts` (293 lines) via `hermes:split` into `src/sim/systems/prosthetics.system.ts`. Add `governorCapacityKw` and `strainLoadKw` to `anatomy` (`components.schema.ts`) to gate installed augments; add `ACTIVATE_PROSTHETIC` command with turn cooldowns and steam costs (*Ocular Thermal Pulse*, *Pneumatic Dash*, *Hydraulic Ram*); equip elite NPCs with active prosthetics and allow harvesting damaged cybernetics from corpses using surgical tools.
