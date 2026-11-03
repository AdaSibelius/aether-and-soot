## 2026-11-02T23:53:57Z
You are teamwork_explorer_m2_2 (M2 Self-Corrector Explorer).
Your working directory is: /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m2_2/

MANDATORY FIRST STEP: Read /Users/emmett/Desktop/Game/.agents/teamwork/ORIGINAL_REQUEST.md.
Also read:
- /Users/emmett/Desktop/Game/.agents/teamwork/orchestrator_5/PROJECT.md
- /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_survey_5_2/handoff.md

Objective:
Investigate Feature 8 (Deterministic Spatial Self-Corrector) of Milestone 2:
1. Deeply inspect `src/sim/spatial/district-yards.ts` (`punchPath`, `ensureDistrictConnectivity`, `sealOrphanedWalkableTiles`) and `src/sim/spatial/template-instantiator.ts`.
2. Design `src/sim/spatial/spatial-self-corrector.ts` (~220 lines, target <= 250):
   - `clearDoorwayObstacles`: Clear yard obstacles in departure tiles to `COBBLESTONE_FLOOR` and reposition/prune blocking entities.
   - `flipOrRelocateDoorway`: Scan exterior perimeter for open street/alley facing candidate coordinate, seal old doorway, carve new wooden door, update building survey.
   - `stitchDisconnectedPathways`: Weighted A* routing that heavily penalizes exterior walls (weight 60) and STRICTLY FORBIDS routing street pathways through private interior rooms (`interiorZone !== 'NONE'`, weight 300+). Paves a clean 1-tile cobblestone sidewalk to reconnect isolated nodes.
   - `restoreRoadCorridors`: Re-stamp cobblestone floors across designated arterial avenues and cross-streets.
   - `applySpatialSelfCorrection`: Coordinates the multi-pass correction pipeline (up to 3 passes).
3. Strict Architectural Guardrails:
   - Headless determinism: Use only `SeededRNG` if randomized candidate selection is needed.
   - ZERO imports from `src/client/`, zero browser globals, zero `Math.random()` / `Date.now()`.
   - Line count strictly <= 250 lines.
4. Provide a complete, drop-in replacement specification and implementation guide for the worker.

Output:
- Keep `progress.md` updated with "Last visited: [timestamp]" heartbeat in your directory.
- Write your final detailed report to `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m2_2/handoff.md`.
- Call `send_message` to parent (`b1f4e92b-f8d8-4000-b9ea-8ea40dd02e57`) when done.
