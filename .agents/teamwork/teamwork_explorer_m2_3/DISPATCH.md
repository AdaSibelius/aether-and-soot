## 2026-11-02T23:54:11Z
From: b1f4e92b-f8d8-4000-b9ea-8ea40dd02e57 (parent)
Objective:
Investigate Feature 9 (Multi-Layer Survey Sheet Exporter) and Feature 10 (Headless Survey & Self-Correction Test Suite) of Milestone 2:
1. Examine `src/sim/spatial/grid.ts` and `src/client/projection/extended-box-drawing.ts`.
2. Design `src/sim/spatial/spatial-survey-sheet.ts` (~210 lines, target <= 250):
   - `generateSpatialSurveySheet(...)`: Creates the `SpatialSurveySheet` object with metadata, anomalies, and corrections.
   - Generates 6-layer visual matrices:
     - Layer 0: Ground & Terrain
     - Layer 1: Architecture & Autotiling Box-Drawing Shell
     - Layer 2: Interactive Fixtures & Portals
     - Layer 3: Cadastral Zoning & Room Semantics
     - Layer 4: Circulation & Movement Vectors
     - Layer 5: Diagnostic Anomaly Heatmap
   - `formatSurveySheetMarkdown(sheet)`: Exports diagnostic Markdown snapshot dossier.
3. Design `tests/sim/spatial-survey-self-correction.test.ts` (~240 lines, target <= 250):
   - Unit tests for anomaly injection and detection (all 5 types).
   - Unit tests for self-correction passes (clearance, door flipping, weighted A* routing around private rooms, road restoration).
   - Multi-seed regression test across 25+ seeds asserting 100% zero anomalies after correction.
   - Survey sheet export test asserting layer dimensions and markdown formatting.
4. Strict Architectural Guardrails:
   - Headless separation: zero `src/client/` imports in `src/sim/spatial/spatial-survey-sheet.ts`.
   - Line counts strictly <= 250 lines.
5. Provide a complete, drop-in replacement specification and implementation guide for the worker.
