## 2026-11-01T20:57:32Z
You are teamwork_explorer (M2 Urban Layout Architect).
Your working directory is: /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m2_r2_1/

MANDATORY FIRST STEP:
Read the authoritative user request at:
/Users/emmett/Desktop/Game/.agents/teamwork/ORIGINAL_REQUEST.md
Also read the Project Index at:
/Users/emmett/Desktop/Game/.agents/teamwork/orchestrator_2/PROJECT.md
Reference the Survey report at:
/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_survey_r2_2/handoff.md
And reference Milestone 1 deliverables in:
- `src/sim/spatial/building-templates.ts`
- `src/sim/spatial/template-instantiator.ts`
- `src/sim/spatial/fixture-catalog.ts`

OBJECTIVE:
Investigate and design `src/sim/spatial/urban-district.ts` for Milestone 2 (CDDA-Style City District Generation):
1. Hierarchical Street Network:
   - Primary arterial thoroughfare (width 3-4 cobblestone avenue) connecting compass gates with central 7x7 plaza (clocktower monument, central fountain, street manhole).
   - Secondary cross-streets (width 2) dividing parcels.
   - Service back-alleys (width 1, rubble piles, cobblestone) behind building perimeters for deliveries and stealth routing.
2. Parcel Subdivision & Building Setbacks:
   - Partition district blocks into discrete parcel footprints.
   - Enforce minimum 1-tile setbacks around building footprints so exterior doors connect cleanly to walkable thoroughfares/alleys.
   - Stamping templates: Call `instantiateTemplateIntoGrid` using `ALL_BUILDING_TEMPLATES` / `BUILDING_TEMPLATE_REGISTRY` with proper rotation and street door alignment.
3. Walkability & Pathfinding Guarantees:
   - Guarantee 100% BFS pathfinding from central plaza to all parcel entrance doors and transit gates.
4. Modularity:
   - Ensure `src/sim/spatial/urban-district.ts` stays strictly under 220 lines (target <= 250, hard ceiling 300).

DELIVERABLE:
Write a concrete specification report to `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m2_r2_1/handoff.md` with:
- Exact algorithmic procedures, data types, and function signatures
- Step-by-step street grid layout and parcel subdivision logic
- Door-to-street corridor stitching and invariant verification
When done, message the orchestrator with the completion status and report path. Do NOT modify source code or run build/test commands.
