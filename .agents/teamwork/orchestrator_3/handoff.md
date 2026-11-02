# Orchestrator Soft Handoff: orchestrator_3 -> orchestrator_4

## Milestone State
| Milestone | Name | Status | Summary |
|---|---|---|---|
| M1 | Building Layout Templates & Steampunk Fixtures | **DONE** | 6 CDDA matrix templates (`building-templates.ts`), fixture catalogs (`fixture-catalog.ts`), instantiator (`template-instantiator.ts`), unit tests. Committed in `ecea285`. |
| M2 | Multi-Stratum Worldgen & Urban District Layouts | **DONE** | CDDA urban layouts, subterranean sewers (`sewer-topology.ts`), mines (`mines-generation.ts`), heavy industry (`industrial-district.ts`), strata portals (`strata-portals.ts`), and BFS pocket sealing (`district-yards.ts`, `district-pipeline-late.ts`). Unanimously APPROVED by 2 Reviewers, 2 Challengers (tested across 101 and 201 seeds), and CLEAN Forensic Audit. All 119 test files pass (623/623 tests). |
| M3 | Enhanced CP437 Glyphs & Graphical Tileset Presentation | **PLANNED** | **Next immediate task**. Features 1–5: Multi-layer glyph projection (`RenderCellLayers`), extended CP437 box-drawing resolver, tactical layer composer with sprite pooling, graphical tileset manager (`CP437_ASCII`, `GRAPHICAL_TILESET`, `HYBRID_OVERLAY`), and WebGL shader tactical split. |
| M4 | E2E Integration, Determinism & Full Verification | **PLANNED** | End-to-end multi-seed integration test suite, full verification gate (`npm run verify`), final audit signoff, and human reporting. |

---

## Active Subagents
- None. All 18 subagents dispatched in `orchestrator_3` have completed their assignments, delivered their reports, and retired.

---

## Pending Decisions & Architectural Invariants
1. **Headless Purity & Zero Untyped Boundaries**:
   - `src/sim/` and `src/schemas/` MUST NEVER import from `src/client/`, `pixi.js`, `preact`, or reference browser globals (`window`, `document`, `requestAnimationFrame`).
   - Zero `Math.random()` or `Date.now()` anywhere in `src/sim/` or `src/schemas/`.
   - Zero `any`, `as unknown as`, or `@ts-ignore`.
2. **Modularity File Ceiling**:
   - Hard automated ceiling of 300 lines across all `.ts`/`.tsx` files (`check-boundaries.ts`).
   - Target line count $\le 250$ lines.
   - For Milestone 3, ensure new client/rendering modules (`extended-box-drawing.ts`, `tactical-layer-composer.ts`, `procedural-tileset.ts`, `tileset-manager.ts`) are structured into clean, single-responsibility files under 250 lines. Note that `glyph-stage.ts` is currently at 240 lines: do NOT bloat `glyph-stage.ts` directly; delegate to auxiliary composer modules.
3. **Forensic Audit Veto**:
   - The Forensic Auditor (`teamwork_auditor`) has a binary veto on every milestone iteration. If the auditor reports INTEGRITY VIOLATION, the milestone fails unconditionally.

---

## Remaining Work (Concrete Next Steps for Successor `orchestrator_4`)

### Phase: Milestone 3 Execution (Features 1–5)
Follow the standard 2B iteration cycle:

1. **Step 2a: Dispatch 3 Explorers in parallel**:
   - **Explorer 1 (Multi-Layer Projection & Box-Drawing Architect)**:
     - Working directory: `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m3_1`
     - Focus: Inspect `src/client/renderer/glyph-stage.ts`, `src/client/renderer/frame-adapter.ts`, `src/schemas/` for `RenderCellLayers` (floor, fixture, item, actor, indicator), and design `extended-box-drawing.ts` for CP437 connectivity resolution.
   - **Explorer 2 (Tactical Layer Composer & Sprite Pooling Architect)**:
     - Working directory: `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m3_2`
     - Focus: Inspect sprite allocation in Pixi stage, design `tactical-layer-composer.ts` with sprite pooling for 5 layers, 4-tier Z-depth palette, and memory reuse without allocation churn.
   - **Explorer 3 (Tileset Manager & Presentation Modes Architect)**:
     - Working directory: `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m3_3`
     - Focus: Inspect tileset assets/manifests, design `procedural-tileset.ts` and `tileset-manager.ts` supporting `CP437_ASCII`, `GRAPHICAL_TILESET`, and `HYBRID_OVERLAY` modes, keyboard toggle commands, and WebGL shader compatibility (`uTacticalSplit`).

2. **Step 2b: Dispatch Worker (`teamwork_worker`)**:
   - Provide merged Explorer recommendations, exact file ownership, and strict 250-line modularity constraints.
   - Include Mandatory Integrity Warning verbatim.
   - Require worker to run tests, boundary checks, and full verification (`npm run verify`).

3. **Step 2c–2e: Gate Verification**:
   - 2 Reviewers (`teamwork_reviewer`): Architecture/modularity and rendering pipeline.
   - 2 Challengers (`teamwork_challenger`): Visual projection correctness, layer ordering, and tileset mode switching stress tests.
   - 1 Forensic Auditor (`teamwork_auditor`): Authentic rendering algorithms, no dummy stubs, zero Core/Shell leakage.

4. **Step 2f: Gate Verdict**:
   - Unanimous APPROVE + CLEAN required.

5. **Milestone 4 (Final E2E & Hardening)**:
   - Full deterministic test suite across seeds, full verification gate (`npm run verify`), commit & push, and final human report.

---

## Key Artifacts
- **Authoritative User Request**: `/Users/emmett/Desktop/Game/.agents/teamwork/ORIGINAL_REQUEST.md`
- **Global Project Plan & Feature Inventory**: `/Users/emmett/Desktop/Game/.agents/teamwork/orchestrator_3/PROJECT.md`
- **Gate Status History**: `/Users/emmett/Desktop/Game/.agents/teamwork/orchestrator_3/GATE_STATUS.md`
- **Execution Progress**: `/Users/emmett/Desktop/Game/.agents/teamwork/orchestrator_3/progress.md`
- **Working Memory**: `/Users/emmett/Desktop/Game/.agents/teamwork/orchestrator_3/BRIEFING.md`
- **M2 Worker Report**: `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_worker_m2_r2_it2/handoff.md`
- **M2 Auditor Report**: `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_auditor_m2_it2_1/handoff.md`
- **M2 Challenger 1 Report**: `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_challenger_m2_it2_1/handoff.md`
- **M2 Challenger 2 Report**: `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_challenger_m2_it2_2/handoff.md`
- **M2 Reviewer 1 Report**: `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_reviewer_m2_it2_1/handoff.md`
- **M2 Reviewer 2 Report**: `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_reviewer_m2_it2_2/handoff.md`
