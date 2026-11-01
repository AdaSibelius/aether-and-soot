## 2026-11-01T20:23:49Z
You are teamwork_explorer (M1 Fixture Blueprint Architect).
Your working directory is: /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m1_2/

MANDATORY FIRST STEP:
Read the authoritative user request at:
/Users/emmett/Desktop/Game/.agents/teamwork/ORIGINAL_REQUEST.md
Also read the Project Index at:
/Users/emmett/Desktop/Game/.agents/teamwork/orchestrator_2/PROJECT.md
And reference the Survey Report at:
/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_survey_r2_3/handoff.md

OBJECTIVE:
Investigate and design the Victorian Steampunk Fixture Catalog module `src/sim/spatial/fixture-catalog.ts` for Milestone 1:
1. Specify deterministic entity creation factories for all 8 required fixtures:
   - Brass Artificer Workbench (`ARTIFICER_BENCH`, workbench component)
   - Cast-Iron Coal Stove (`COAL_STOVE`, thermal component, container for coal)
   - Industrial Iron Boiler (`IRON_BOILER`, pressure vessel component, thermal, steam emission)
   - Mahogany Roll-Top Desk (`ROLL_TOP_DESK`, container for ledger/pence)
   - Welsbach Mantle Gas Lamp (`GAS_LAMP`, thermal, light emitter)
   - Brass Pneumatic Dispatch Tube (`PNEUMATIC_DISPATCH`, utility conduit component)
   - Rolled-Steel Filing Cabinet (`FILING_CABINET`, container for dossiers)
   - High-Pressure Valve Manifold (`VALVE_MANIFOLD`, pressure vessel component)
2. Detail exact ECS components attached to each fixture (`PositionComponent`, `RenderableComponent`, `InteractionComponent`, `ThermalComponent`, `PressureVesselComponent`, `InventoryComponent`, `WorkbenchComponent`, `UtilityConduitComponent`).
3. Ensure fixtures follow flat relational ECS rules (`EntityRecord` in `state.entities[id]`) and deterministic entity ID generation (`entity_${kind}_${x}_${y}_${stratum}`).
4. Check file size: `src/sim/spatial/fixture-catalog.ts` must stay under 200 lines (target <= 250, hard ceiling 300).

DELIVERABLE:
Write a concrete specification report to `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m1_2/handoff.md` with:
- Exact TypeScript factory function implementations and component assembly details
- Collision and line-of-sight properties (`blocksMovement`, `blocksSight`)
- Container initialization and loot seeding strategy
When done, message the orchestrator with the completion status and report path. Do NOT modify source code or run build/test commands.
