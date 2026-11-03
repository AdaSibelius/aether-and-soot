# Project: Continuous World Evolution, Spatial Survey Sheets & Verification Token Audit

## Architecture
The system advances *Aether & Soot* from isolated discrete map grids to a cohesive, continuous steampunk world with Fallout: New York inspired spatial survey sheets, automated self-correction, and an audited 4-step verification and local model pipeline.

```
                    ┌────────────────────────────────────────────────────────┐
                    │               Client Presentation Shell                │
                    │  (Continuous Projection, Tactical Layer Composer, HUD) │
                    └───────────────────────────┬────────────────────────────┘
                                                │ (read-only projection)
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│                                Headless Simulation Core                                    │
│                                                                                            │
│  ┌───────────────────────┐   ┌──────────────────────────┐   ┌───────────────────────────┐  │
│  │   Continuous World    │   │  Spatial Survey Sheets   │   │   Deterministic Spatial   │  │
│  │      Generation       │──▶│   & Anomaly Detection    │──▶│      Self-Correction      │  │
│  │ (Parcels, Boundaries, │   │ (Overlaps, Blocked Doors,│   │(Doorway Clearance/Flipping│  │
│  │   Seams, Templates)   │   │ Road/Wall Collisions)    │   │  Weighted A* Stitching)   │  │
│  └───────────────────────┘   └──────────────────────────┘   └───────────────────────────┘  │
│                                           │                                                │
│                                           ▼                                                │
│                              ┌─────────────────────────┐                                   │
│                              │  Continuous Navigation  │                                   │
│                              │  & Chunk Streaming Handoff│                                 │
│                              └─────────────────────────┘                                   │
└────────────────────────────────────────────────────────────────────────────────────────────┘
                                                │
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│                    Audited Verification Pipeline & Local Model Tooling                     │
│  (Typecheck -> Boundary Early Warnings -> Data Validation -> Vitest Simulation Suite)     │
│  (Tiered Ollama Routing: lfm2.5:24b / gemma4:12b-extended / hermes3:8b + Token Ledger)    │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Core Simulation (`src/sim/spatial/` & `src/sim/systems/`)**:
  - `urban-parcels.ts`: Parametric multi-block parcel subdivider decoupling urban generation from fixed 48x36 dimensions.
  - `district-boundaries.ts`: Edge seam alignment opening thoroughfares across planar overworld neighbors.
  - `continuous-transit.system.ts`: Seamless coordinate translation and companion preservation on border traversal.
  - `building-templates-expanded.ts`: Distinctive district-tailored architectural templates (Foundry, Warehouse, Salon).
  - `spatial-survey-types.ts`: Zod schemas for survey sheets, anomaly diagnostics, and correction logs.
  - `spatial-anomaly-detector.ts`: Pure inspection functions for overlaps, blocked doors, wall/road collisions, and disconnected paths.
  - `spatial-self-corrector.ts`: Multi-pass clearance, door relocation, and weighted A* pathway stitching around private rooms.
  - `spatial-survey-sheet.ts`: 6-layer visual matrix exporter (Terrain, Architecture, Fixtures, Zoning, Circulation, Diagnostic Heatmap).
- **Client Presentation Shell (`src/client/projection/`)**:
  - `continuous-projection.ts`: Continuous viewport lookahead into adjacent district/chunk cells, eliminating black void edges.
- **Verification & Tooling (`tests/scripts/`)**:
  - `update-state.ts` pre-split into `state-markdown-compiler.ts`.
  - `hermes-critic.ts` pre-split into `critic-domain-targets.ts`.
  - `check-boundaries.ts`: Added 240–299 line early warning logs and workspace layout compliance.
  - `local-llm-ledger.ts`: Automated CLI audit (`npm run audit:tokens`) with cloud cost comparison metrics.
  - `playtester-projection-audit.ts` & `critic-report.ts`: Detailed coordinate and token reporting for UI projection leaks.

---

## Feature Inventory

Every feature from the Survey phase is assigned to a milestone below. No feature is left unassigned.

| # | Feature | Description | Milestone | Source |
|---|---|---|---|---|
| 1 | Tooling Modularity Pre-Splitting | Pre-split `update-state.ts` (extract `state-markdown-compiler.ts`) and `hermes-critic.ts` (extract `critic-domain-targets.ts`) to maintain strict <= 250 line ceiling | M1 | Survey R3 |
| 2 | Early Warning & Layout Compliance | Add 240–299 line advisory warnings and `.agents/teamwork/` metadata-only validation to `check-boundaries.ts` | M1 | Survey R3 |
| 3 | Automated Token Ledger Audit CLI | Implement `npm run audit:tokens` (`local-llm-ledger.ts --summary`) calculating token usage, latency, and cloud API savings | M1 | Survey R3 |
| 4 | Projection Leak & Feedback Actionability | Capture exact coordinate/token locality in `playtester-projection-audit.ts` and group unwired commands by phase domain in `critic-report.ts` | M1 | Survey R3 |
| 5 | Pre-Flight Loopback Diagnostic Probes | Add explicit `BypassSandbox: true` diagnostic alerts and endpoint healthcheck probes in `local-llm-config.ts` | M1 | Survey R3 |
| 6 | Spatial Survey Schemas & Types | Zod schemas and TypeScript types for `SpatialSurveySheet`, `SpatialAnomaly`, `PlacedBuildingRecord`, and `SpatialCorrectionLog` | M2 | Survey R2 |
| 7 | Programmatic Spatial Anomaly Detector | Pure inspection functions detecting building overlaps, blocked doorways, wall collisions, disconnected pathways, and road collisions | M2 | Survey R2 |
| 8 | Deterministic Spatial Self-Corrector | Multi-pass self-correction: doorway obstacle clearance, doorway flipping/relocation, weighted A* pathway stitching (routing around private rooms), and road restoration | M2 | Survey R2 |
| 9 | Multi-Layer Survey Sheet Exporter | 6-layer visual ASCII/Unicode matrix exporter (Terrain, Architecture, Fixtures, Zoning, Circulation, Diagnostic Heatmap) and Markdown snapshot dossiers | M2 | Survey R2 |
| 10 | Headless Survey & Self-Correction Test Suite | Unit tests in `tests/sim/spatial-survey-self-correction.test.ts` verifying synthetic anomaly injection, correction efficacy, and 25-seed zero-anomaly validation | M2 | Survey R2 |
| 11 | Parametric Multi-Block Parcel Subdivider | Decouple urban district layout from 48x36 with parametric block/parcel partitioning for arbitrary dimensions with front and service alley access | M3 | Survey R1 |
| 12 | Inter-District Edge Seam Alignment | Align thoroughfares across overworld planar neighbors, replacing perimeter walls with open street seams, toll arches, and bridges | M3 | Survey R1 |
| 13 | Continuous Spatial Navigation System | Seamless coordinate translation and companion preservation when walking across district borders without modal prompts or teleports | M3 | Survey R1 |
| 14 | Expanded District Architectural Templates | District-tailored CDDA matrix templates: Bessemer Foundry (Soot Works), Dockside Warehouse (Limehouse), and Clockwork Salon (Belgravia) | M3 | Survey R1 |
| 15 | Continuous Viewport Lookahead Projection | Extend camera frame adapter to query adjacent district/chunk cells near borders, rendering continuous cityscape without void edges | M3 | Survey R1 |
| 16 | Continuous Multi-Seed Walkability Suite | Headless Vitest suite in `tests/sim/continuous-worldgen.test.ts` verifying multi-seed determinism, seam traversability, and companion preservation | M3 | Survey R1 |
| 17 | E2E Integration & Stress Verification | End-to-end integration test verifying continuous navigation across multiple districts, spatial survey self-correction, and token ledger accounting | M4 | Synthesis |
| 18 | Full Repository Verification Gate | 100% clean execution of `npm run verify` across typecheck, boundary checks, data validation, and 650+ unit tests with 0 errors | M4 | Synthesis |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| M1 | Verification Pipeline Hardening & Token Audit | Features 1, 2, 3, 4, 5 (R3 Deliverables) | None | **DONE** |
| M2 | Fallout: NY Spatial Survey Sheets & Self-Correction | Features 6, 7, 8, 9, 10 (R2 Deliverables) | M1 | **IN_PROGRESS** (Worker completed, pending review & audit) |
| M3 | Continuous World Generation & Border Seams | Features 11, 12, 13, 14, 15, 16 (R1 Deliverables) | M1, M2 | PLANNED |
| M4 | E2E Integration & Full Repository Verification Gate | Features 17, 18 (End-to-End Verification & Gate Signoff) | M1, M2, M3 | PLANNED |

---

## Interface Contracts

### M1 Tooling ↔ Verification Pipeline
- `tests/scripts/state-markdown-compiler.ts`:
  - `compileStateMarkdown(data: StateData): string`
  - `compileRoadmapMarkdown(data: RoadmapData): string`
  - `compileAgentsMarkdown(data: AgentsData): string`
- `tests/scripts/critic-domain-targets.ts`:
  - `resolvePhaseDomainTargetFiles(phaseNum: number, title: string): readonly string[]`
- `npm run audit:tokens` / `getInferenceLedgerSummary()`:
  - Output: formatted markdown summary table and `{ totalEntries, totalPromptTokens, totalCompletionTokens, totalTokens, totalDurationMs, successRatePct, estimatedCloudSavingsUsd }`.

### M2 Spatial Survey & Self-Correction ↔ Simulation Core
- `SpatialSurveySheet`:
  ```typescript
  export interface SpatialSurveySheet {
    readonly districtId: string;
    readonly stratum: StratumId;
    readonly seed: number;
    readonly dimensions: { width: number; height: number };
    readonly layers: {
      readonly terrain: readonly string[];
      readonly architecture: readonly string[];
      readonly fixtures: readonly string[];
      readonly zoning: readonly string[];
      readonly circulation: readonly string[];
      readonly anomalyHeatmap: readonly string[];
    };
    readonly anomalies: readonly SpatialAnomaly[];
    readonly corrections: readonly SpatialCorrectionLog[];
  }
  ```
- `runSpatialAnomalyAudit(grid: StratumGrid, entities: Record<string, EntityRecord>, buildings: readonly PlacedBuildingSurvey[], hub: Point2D, targets: readonly Point2D[], streetCorridors: readonly Box[]): SpatialAnomaly[]`
- `applySpatialSelfCorrection(grid: StratumGrid, entities: Record<string, EntityRecord>, buildings: PlacedBuildingSurvey[], hub: Point2D, targets: Point2D[], streetCorridors: Box[]): { grid: StratumGrid; entities: Record<string, EntityRecord>; buildings: PlacedBuildingSurvey[]; corrections: SpatialCorrectionLog[] }`

### M3 Continuous Worldgen ↔ M2 Survey Sheets & M1 Pipeline
- `subdivideProceduralParcels(spec: UrbanGridSpec, rng: SeededRNG): ProceduralParcelResult`
- `computeDistrictBoundarySeams(districtId: BlueprintId, width: number, height: number): DistrictBoundarySeams`
- `continuousTransitSystem(state: WorldState, actorId: EntityId, targetCoord: Point2D): ContinuousTransitResult`
- `BUILDING_TEMPLATE_REGISTRY_EXPANDED`:
  - `building_bessemer_foundry`, `building_dockside_warehouse`, `building_clockwork_salon`.

---

## Code Layout

### Verification & Tooling (`tests/scripts/`)
- `tests/scripts/state-markdown-compiler.ts` (extracted from `update-state.ts`, <= 150 lines)
- `tests/scripts/critic-domain-targets.ts` (extracted from `hermes-critic.ts`, <= 120 lines)
- `tests/scripts/check-boundaries.ts` (enhanced with advisory warnings & layout check, <= 120 lines)
- `tests/scripts/local-llm-ledger.ts` (enhanced with CLI summary & cloud cost analysis, <= 160 lines)
- `tests/scripts/playtester-projection-audit.ts` (enhanced with coordinate locality, <= 220 lines)

### Spatial Simulation Core (`src/sim/spatial/` & `src/sim/systems/`)
- `src/sim/spatial/spatial-survey-types.ts` (~110 lines)
- `src/sim/spatial/spatial-anomaly-detector.ts` (~210 lines)
- `src/sim/spatial/spatial-self-corrector.ts` (~220 lines)
- `src/sim/spatial/spatial-survey-sheet.ts` (~210 lines)
- `src/sim/spatial/urban-parcels.ts` (~160 lines)
- `src/sim/spatial/district-boundaries.ts` (~180 lines)
- `src/sim/spatial/building-templates-expanded.ts` (~210 lines)
- `src/sim/systems/continuous-transit.system.ts` (~175 lines)

### Client Presentation Shell (`src/client/projection/`)
- `src/client/projection/continuous-projection.ts` (~150 lines)

### Headless Verification Test Suites (`tests/sim/`)
- `tests/sim/spatial-survey-self-correction.test.ts` (~240 lines)
- `tests/sim/continuous-worldgen.test.ts` (~200 lines)
- `tests/sim/continuous-world-integration.test.ts` (~220 lines)
