# BRIEFING — 2026-11-03T00:43:00Z

## Mission
Investigate and design Milestone 3 Feature 13 (Continuous Spatial Navigation System) and Feature 14 (Expanded District Architectural Templates).

## 🔒 My Identity
- Archetype: explorer
- Roles: explorer, investigator, synthesizer
- Working directory: /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m3_it1_2
- Original parent: b1f4e92b-f8d8-4000-b9ea-8ea40dd02e57
- Milestone: Milestone 3 (Features 13 & 14)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Target <= 200 lines per file (hard ceiling: 250 lines)
- Strict headless separation: src/sim/ and src/schemas/ must never import client/pixi/preact or browser globals
- Zero non-deterministic tokens (Math.random, Date.now) in src/sim/; use SeededRNG
- Re-use existing schemas and ECS patterns (flat entities, branded IDs)

## Current Parent
- Conversation ID: b1f4e92b-f8d8-4000-b9ea-8ea40dd02e57
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `src/sim/core/world.ts`, `invariants.ts`, `engine.ts`
  - `src/sim/systems/movement.system.ts`, `transit.system.ts`, `portal-transit.system.ts`, `transit-companions.ts`
  - `src/sim/spatial/building-templates.ts`, `template-instantiator.ts`, `fixture-catalog.ts`, `urban-district.ts`, `compass-gates.ts`, `overworld-matrix.ts`
  - `src/sim/spatial/spatial-survey-types.ts`, `spatial-anomaly-detector.ts`
  - `src/schemas/primitives.schema.ts`, `building-template.schema.ts`, `world-components.schema.ts`, `events.schema.ts`
- **Key findings**:
  - Feature 13 (Continuous Navigation): Can hook cleanly into `resolveMoveStep` when `!isWithinBounds`. Reuses `collectPartyPreservedEntities` and `placePreservedCompanions` from `transit-companions.ts`, saving departing district to `savedDistricts` and restoring/generating arrival district. Translates coordinates (East: x=1, West: x=W-2, North: y=H-2, South: y=1) with safety seam scan. Emits `DISTRICT_TRAVELED`, `COMPANION_TRANSIT_PRESERVED`, and `ENTITY_MOVED`.
  - Feature 14 (Expanded Architectural Templates): Designed Bessemer Foundry (13x10), Dockside Warehouse (12x10), and Clockwork Salon (12x10) tailored for Spitalfields, Limehouse, and Belgravia. Fully compliant with CDDA matrix layout, Zod schemas, M2 anomaly detection, and parcel dimensions.
- **Unexplored areas**: None. Ready for complete synthesis into handoff.md.

## Key Decisions Made
- `continuous-transit.system.ts` will reuse existing `transit-companions.ts` helpers to keep implementation <= 180 lines.
- `building-templates-expanded.ts` will define the 3 specialized district templates and export `BUILDING_TEMPLATE_REGISTRY_EXPANDED` and combined registries without modifying `building-templates.ts`.

## Artifact Index
- DISPATCH.md — Parent dispatch instructions
- BRIEFING.md — Persistent working memory
- progress.md — Liveness heartbeat and progress log
- handoff.md — Final handoff report
