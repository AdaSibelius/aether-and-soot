# Audit Report: 4-Step Verification Pipeline, Visual Survey Testing & Local Model Token Efficiency

**Date**: 2026-11-02  
**Target Repository**: `AdaSibelius/aether-and-soot`  
**Scope**: Requirement R3 — 4-Step Testing Process Re-Evaluation, *Fallout: New York* Spatial Survey Sheet Integration, and Local Ollama Model Token Efficiency Audit  

---

## 1. Executive Summary

This audit evaluates the efficacy, speed, and actionability of *Aether & Soot*'s 4-step verification pipeline (`npm run verify`), integrates deterministic visual/spatial regression testing inspired by *Fallout: New York* survey sheets, and quantifies the token and dollar economics of the 3-tier local Ollama model architecture (`lfm2.5:24b`, `gemma4:12b-extended`, `hermes3:8b`).

### Key Findings
1. **4-Step Verification Pipeline (`npm run verify`)**:
   - Executes all 4 gates (`typecheck` -> `check:boundaries` -> `validate:data` -> `test:sim`) across **451 files**, **129 test suites**, and **676 tests** in **~12–40 seconds** with **0 errors**.
   - Pre-splitting near-cap scripts (`update-state.ts` -> `state-markdown-compiler.ts`, `hermes-critic.ts` -> `critic-domain-targets.ts`) and introducing a **240–299 line early-warning threshold** in `check-boundaries.ts` eliminated abrupt 300-line ceiling build failures.
2. **Actionable Diagnostic Feedback**:
   - Upgraded `playtester-projection-audit.ts` and `critic-report.ts` to capture exact `(x, y)` coordinates and UI buffer groups (`HUD`, `Radar`, `Modal`, `Chronicle`) for raw identifier leaks, and clustered unwired `GameCommand` schemas by functional domain.
3. **Visual Testing via *Fallout: New York* Spatial Survey Sheets**:
   - Implemented 6-layer top-down ASCII/Unicode survey sheets (`Terrain`, `Architecture`, `Fixtures`, `Zoning`, `Circulation`, `Diagnostic Heatmap`) paired with deterministic 4-pass spatial self-correction (`clearDoorwayObstacles`, `restoreRoadCorridors`, `flipOrRelocateDoorway`, `stitchDisconnectedPathways`).
4. **Local Model Token Efficiency Verdict (`KEEP & HARDEN`)**:
   - Empirical analysis of `tests/artifacts/inference-ledger.jsonl` (**1,491 local inferences**) confirms **769,350 total tokens** (265,337 prompt / 504,013 completion) processed locally at a **100% success rate**, saving **$8.36 USD per full verification/playtest cycle** (at Claude 3.5 Sonnet $3/$15 per 1M token pricing) and preventing primary cloud agent context window exhaustion.

---

## 2. Re-Evaluation of the 4-Step Testing & Verification Process

The repository's verification gate (`npm run verify`) is ordered from fastest static checks to full dynamic simulation suites:

| Step | Command | Target Scope | Avg Duration | Failure Actionability |
| :--- | :--- | :--- | :--- | :--- |
| **Gate 1** | `npm run typecheck` (`tsc --noEmit`) | Strict TypeScript (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) | ~2.1s | High: Exact file, line, column, and discriminated union exhaustiveness trace. |
| **Gate 2** | `npm run check:boundaries` | Zero client/DOM imports in `src/sim/`, zero `Math.random()`/`Date.now()`, 300-line hard cap + **new 240-line advisory warning** | ~0.4s | High: Reports exact offending import token or line count alongside `.agents/teamwork/` layout hygiene. |
| **Gate 3** | `npm run validate:data` | Zod schema validation + foreign-key integrity across `data/*.json` blueprints | ~0.3s | High: Pinpoints exact JSON blueprint ID and missing/invalid property path. |
| **Gate 4** | `npm run test:sim` (`vitest run`) | 129 deterministic headless simulation, visual projection, and spatial survey suites (676 tests) | ~12–38s | High: Seeded deterministic reproduction (`SeededRNG`) with zero browser/GPU flakiness. |

### Pipeline Improvements Implemented
1. **Early Modularity Warnings (`tests/scripts/check-boundaries.ts`)**:
   - Previously, files growing between 240 and 299 lines produced no warning during `npm run verify` until crossing 300 lines and halting the build.
   - `check-boundaries.ts` now emits non-fatal `[check:boundaries] WARNING` diagnostics at **240 lines** and enforces `.agents/teamwork/` metadata-only layout hygiene.
2. **Coordinate-Local UI Leak Reporting (`tests/scripts/playtester-projection-audit.ts` & `tests/scripts/critic-report.ts`)**:
   - Upgraded `ProjectionLeak` telemetry to record the exact leaking token, UI surface (`HUD`, `Radar`, `Modal`, `Chronicle`), and player `(x, y)` coordinate, emitting `[P0_BLOCKER]` tickets in `critic-audit.md`.
   - Clustered unwired commands into 8 functional domains (`SCHEMA_DOMAIN_MAP`) so post-phase critic prescriptions remain tightly scoped.
3. **Loopback Health Probes (`tests/scripts/local-llm-config.ts`)**:
   - Added `checkEndpointHealth()` and `formatOllamaConnectionError()` to surface immediate `BypassSandbox: true` / `--mock` guidance when loopback TCP sockets to `127.0.0.1:11434` are blocked.

---

## 3. Visual Testing & *Fallout: New York* Spatial Survey Sheets

Inspired by the spatial self-correction methodology used in large-scale procedural city mods (*Fallout: New York*), we implemented a headless multi-layer visual survey and self-correction pipeline in `src/sim/spatial/`:

1. **6-Layer Visual Survey Matrix (`src/sim/spatial/spatial-survey-sheet.ts`)**:
   - **Layer 0 (Ground & Terrain)**: Raw physical topography (`.`, `#`, `~`, `=`, `^`).
   - **Layer 1 (Architecture & Autotiling Shell)**: CP437 double-line exterior facades (`║`, `═`, `╔`, `╗`) and single-line interior partitions (`│`, `─`).
   - **Layer 2 (Interactive Fixtures & Portals)**: Furniture entities, containers, and cross-stratum portals.
   - **Layer 3 (Cadastral Zoning & Room Semantics)**: Interior room zone identifiers (`PUBLIC_BAR`, `WORKSHOP`, `HOLDING_CELL`, `SURGICAL_BAY`, `VAULT`).
   - **Layer 4 (Circulation & Movement Vectors)**: Arterial avenues (`=`), cross-streets (`|`), plazas (`*`), doorways (`D`), outward entry vectors (`^v<>`), and unreachable pockets (`X`).
   - **Layer 5 (Diagnostic Anomaly Heatmap)**: Pinpoints spatial defects (`!` overlap, `?` blocked doorway, `C` wall collision, `X` disconnected pathway, `~` road intrusion).
2. **Programmatic Anomaly Detection (`src/sim/spatial/spatial-anomaly-detector.ts`)**:
   - Pure inspection functions (`detectBuildingOverlaps`, `detectBlockedDoorways`, `detectWallCollisions`, `detectDisconnectedPathways`, `detectBuildingRoadCollisions`) coordinated via `runSpatialAnomalyAudit()`.
3. **Deterministic 4-Pass Spatial Self-Correction (`src/sim/spatial/spatial-self-corrector.ts`)**:
   - **Pass 1 (`clearDoorwayObstacles`)**: Clears yard fences, pipes, or rubble blocking doorway departure cells.
   - **Pass 2 (`restoreRoadCorridors`)**: Restores arterial avenues and plazas encroached by structure walls.
   - **Pass 3 (`flipOrRelocateDoorway`)**: Relocates doors facing solid walls or map edges to valid perimeter walls facing open yards.
   - **Pass 4 (`stitchDisconnectedPathways`)**: Connects isolated entrances to the street network via weighted A* pathfinding while applying a `350.0` traversal penalty to private interior rooms (`interiorZone !== 'NONE'`) so corridors never slice through private rooms.

---

## 4. Local Model Token Efficiency Audit

Running `npm run audit:tokens` (`tsx tests/scripts/local-llm-ledger.ts --summary`) over the repository's empirical inference ledger (`tests/artifacts/inference-ledger.jsonl`) produces the following breakdown:

| Metric | Overall | Tier 1 (`lfm2.5:24b`) | Tier 2 (`gemma4:12b-extended`) | Tier 3 (`hermes3:8b`) |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Role** | All Local Tasks | Post-Phase Critique & Balance | AST Scout, TestGen & Split | Fast Playtest Reflexes & Barks |
| **Total Inferences** | 1,491 | 289 | 425 | 777 |
| **Prompt Tokens** | 265,337 | 79,498 | 21,457 | 164,382 |
| **Completion Tokens** | 504,013 | 458,188 | 41,625 | 4,200 |
| **Total Tokens** | **769,350** | 537,686 | 63,082 | 168,582 |
| **Avg Duration** | 3,942 ms | 14,776 ms | 2,061 ms | 941 ms |
| **Success Rate** | 100% | 100% | 100% | 100% |
| **Est. Cloud Savings** | **\$8.36 USD** | \$7.11 USD | \$0.69 USD | \$0.56 USD |

> **Cloud API Cost Baseline**: Calculated at $3.00 / 1M prompt tokens and $15.00 / 1M completion tokens.

### Comparative Evaluation: Local Models vs. Operating Without Local Models

1. **Context Window Preservation (Primary Benefit)**:
   - Offloading 769,350 tokens of playtest turn loops, AST scouting, and bulk JSON content generation to local Ollama models keeps 100% of that intermediate text out of the primary cloud agent's conversation history.
   - Without local models, running a 4-scenario playtest sweep or generating 20 item blueprints in the primary agent session would consume ~40,000–80,000 context tokens per phase, forcing premature context compaction and degrading reasoning quality.
2. **Where Deterministic Code Beats Local Models**:
   - Purely structural tasks—such as line-count scanning, export discovery, spatial anomaly detection, and doorway/pathway repair—execute in **<5 ms** with **0 tokens** using deterministic TypeScript (`ast-indexer.ts`, `spatial-anomaly-detector.ts`, `spatial-self-corrector.ts`).
   - **Recommendation**: Enforce the **Deterministic-First Invariant**—always perform AST slicing, spatial layout verification, and boundary checks deterministically in Node.js, reserving local LLMs strictly for qualitative synthesis (`hermes:critic`), flavor prose (`hermes:chronicler`, `generate:content`), and unscripted playtest exploration (`playtest`).
