## 2026-11-01T20:48:00Z
You are teamwork_reviewer (M1 Template & Spatial Reviewer).
Your working directory is: /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_reviewer_m1_r2_2/

MANDATORY FIRST STEP:
Read the authoritative user request at:
/Users/emmett/Desktop/Game/.agents/teamwork/ORIGINAL_REQUEST.md
Also read the Project Index at:
/Users/emmett/Desktop/Game/.agents/teamwork/orchestrator_2/PROJECT.md
And review the Worker's implementation report at:
/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_worker_m1_r2/handoff.md

OBJECTIVE:
Independently review the building templates and spatial stamping instantiator for correctness, robustness, and geometric precision:
1. Examine:
   - `src/sim/spatial/building-templates.ts`
   - `src/sim/spatial/template-instantiator.ts`
   - `tests/sim/building-templates.test.ts`
2. Verify:
   - Matrix transformation correctness across 0°, 90°, 180°, 270° and mirroring (`mirrorX`, `flipY`)
   - Door outward vector calculation and perimeter check
   - Invariant enforcement: room reachability validation `hasTemplateWalkablePath`
   - Modularity compliance: files <= 250 lines (300 ceiling)
   - Determinism: byte-identical outputs across identical seeds
3. Run verification commands:
   - `npm run typecheck`
   - `npm run check:boundaries`
   - `npx vitest run tests/sim/building-templates.test.ts`
   - `npm run verify`

DELIVERABLE:
Write a comprehensive review report to `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_reviewer_m1_r2_2/handoff.md`.
You MUST conclude with an explicit verdict:
`Verdict: APPROVE` or `Verdict: REQUEST_CHANGES` (with concrete reasons).
When done, message the orchestrator with your verdict and handoff path. Do NOT modify source code files.
