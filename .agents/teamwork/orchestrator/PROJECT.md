# Project: Full-Game Codebase Audit & Systemic Mapping

## Overview
Conduct a clean, full-game codebase audit and documentation sweep across three specialized tracks:
1. Architectural Modularity & State Audit (R1)
2. Systemic Interconnectivity & Simulation Critique (R2)
3. Documentation & Workflow DevOps Sweep (R3)
Synthesize into a unified Systemic Mapping and Evaluation Report at `docs/SYSTEMIC_MAPPING_REPORT.md` (R4).

## Milestones & Tracks

| # | Track Name | Role / Archetype | Scope & Outputs | Dependencies | Status |
|---|------------|------------------|-----------------|--------------|--------|
| M1 | Architectural Modularity & State Audit | teamwork_explorer | Map headless ECS schemas, codebase boundaries (`src/sim/`, `src/schemas/`, `src/client/`), 300-line modularity ceiling adherence, dormant commands, architectural bottlenecks. Output: `analysis.md` | none | DONE |
| M2 | Systemic Interconnectivity & Simulation Critique | teamwork_critic | Deep evaluation of causal chains, NPC agency, environmental storytelling, spatial strata, industrial hazards, trade, diurnal schedules, economic integration. Output: `critique.md` | none | DONE |
| M3 | Documentation & Workflow DevOps Sweep | teamwork_explorer | Audit active docs (`AGENTS.md`, `ARCHITECTURE.md`, `STATE.md`) vs live codebase; identify friction points, outdated state, drift. Output: `devops_audit.md` | none | DONE |
| M4 | Unified Report Compilation | teamwork_worker | Synthesize M1, M2, M3 into `docs/SYSTEMIC_MAPPING_REPORT.md` with clinical tone, concrete maps, and sequenced copy-pasteable Antigravity execution prompts. | M1, M2, M3 | DONE |
| M5 | Quality Gate & Acceptance Review | teamwork_reviewer | Review `docs/SYSTEMIC_MAPPING_REPORT.md` against all acceptance criteria (tone, coverage, exact schemas, verify commands). Output: `review.md`, `handoff.md` (VERDICT: APPROVE) | M4 | DONE |

## Acceptance Criteria
- [x] Deliverable file exists: `docs/SYSTEMIC_MAPPING_REPORT.md`
- [x] All 3 specialized tracks covered in depth
- [x] Tone is clinical, critical, strictly objective; zero flattery or conversational padding
- [x] Concrete objective map of current headless ECS systems, causal interconnectivity, and simulation limitations
- [x] Sequenced list of structured, copy-pasteable execution prompts for Antigravity with exact schema and step definitions
- [x] Each prompt enforces 300-line ceiling and requires `npm run verify` and `tests/scripts/check-boundaries.ts` validation
