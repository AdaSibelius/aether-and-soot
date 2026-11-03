# BRIEFING — 2026-11-02T23:59:00Z

## Mission
Investigate Feature 8 (Deterministic Spatial Self-Corrector) for Milestone 2 and design `src/sim/spatial/spatial-self-corrector.ts`.

## 🔒 My Identity
- Archetype: Teamwork explorer
- Roles: Read-only investigation, architectural analysis, synthesis, specification design
- Working directory: /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m2_2/
- Original parent: b1f4e92b-f8d8-4000-b9ea-8ea40dd02e57
- Milestone: Milestone 2 (Feature 8: Deterministic Spatial Self-Corrector)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement in `src/` directly
- Pure headless determinism: Use only `SeededRNG` if PRNG is required
- ZERO imports from `src/client/`, zero browser globals, zero `Math.random()` / `Date.now()`
- Design `src/sim/spatial/spatial-self-corrector.ts` strictly <= 250 lines (hard gate: 300)
- Deliver comprehensive handoff report to `handoff.md` and message parent

## Current Parent
- Conversation ID: b1f4e92b-f8d8-4000-b9ea-8ea40dd02e57
- Updated: 2026-11-02T23:59:00Z

## Investigation State
- **Explored paths**: `src/sim/spatial/district-yards.ts`, `src/sim/spatial/template-instantiator.ts`, `src/sim/spatial/urban-district.ts`, `src/sim/spatial/grid.ts`, `src/sim/spatial/district-layout.ts`, `src/sim/spatial/block-geometry.ts`, `src/schemas/primitives.schema.ts`
- **Key findings**:
  1. `punchPath` in `district-yards.ts` only checked `cell.interiorZone === 'VAULT'`, carelessly punching through taverns, clinics, and living quarters.
  2. `sealOrphanedWalkableTiles` blindly seals disconnected rooms into solid brick walls if connectivity failed.
  3. `clearDoorwayObstacles` must distinguish between yard scatter (fences, lamps, pipes, rubble) vs. building walls.
  4. `flipOrRelocateDoorway` must check exterior perimeters and verify both approach tile (interior walkable) and departure tile (exterior facing street/alley).
  5. Weighted A* pathfinding strictly forbids interior rooms (weight 350+ / inf), penalizes exterior walls (weight 60), and paves a 1-tile cobblestone sidewalk to the nearest reachable street node.
  6. In-line array splice for A* open set reduces code size by 42 lines over a heap class, fitting the entire module in ~238 lines (target <= 250).
- **Unexplored areas**: Milestone 3 continuous chunk boundaries (deferred to M3 explorers).

## Key Decisions Made
- Designed compact, self-contained `src/sim/spatial/spatial-self-corrector.ts` (~238 lines).
- Eliminated circular dependency on `spatial-anomaly-detector.ts` by using direct topological inspection in self-corrector passes.
- Handled multiple caller signatures in `clearDoorwayObstacles` for maximum test interoperability.
- Multi-pass pipeline coordinates clearance -> road restoration -> doorway relocation -> weighted A* pathway stitching, breaking early on convergence (up to 3 passes).

## Artifact Index
- DISPATCH.md — Incoming dispatch record
- BRIEFING.md — Persistent context & situational awareness
- progress.md — Liveness heartbeat and milestone tracking
- handoff.md — Complete 5-component handoff report for worker
