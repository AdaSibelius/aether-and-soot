---
name: worldgen-survey
description: >-
  Procedures and invariants for CDDA-style building templates, 8-stage district procedural
  generation, continuous district border seams, and Fallout: New York 6-layer spatial survey auditing.
---

# Procedural Worldcraft, Building Templates & Spatial Survey Auditing (Aether & Soot)

This skill defines the architecture, invariants, and verification workflows when modifying any file in `src/sim/spatial/` (district generation, CDDA building templates, interior zoning, urban parcels, continuous border seams, and multi-stratum dungeons).

---

## 1. The 8-Stage District Generation Pipeline

Production districts are generated via `generateVictorianDistrict(state)` in `src/sim/spatial/generator.ts`, which orchestrates `src/sim/spatial/district-pipeline.ts` (Stages 1–5) and `src/sim/spatial/district-pipeline-late.ts` (Stages 6–8):

1. **Stage 1–2 (`createPipelineContext`)**: Hydrates `SeededRNG` from `state.rngState`, resolves 2D overworld adjacency (`resolveCompassAdjacency`), and plans seeded perimeter-block macro layouts (`planMacroLayout`).
2. **Stage 3 (`executeStage3ThoroughfareSkeletization`)**: Carves the central plaza (`ctx.center`), pneumatic lift shaft (`ctx.liftPos`), cardinal thoroughfares, and compass gate approaches.
3. **Stage 4 (`executeStage4PlotZoning`)**: Carves the Artificer Workshop and Market Hall flanking the main thoroughfare.
4. **Stage 5 (`executeStage5ArchitecturalTypologies`)**:
   - Standard districts (`48x36`): Stamps the 6 multi-room Victorian typologies (`apothecary`, `pawnshop`, `rookeries`, `boilerhouse`, `monorailDepot`, `artisanWorkshop`) via `applyTypologyPlacements`, seeds outdoor street landmarks (`seedOutdoorStreetLandmarks`), and fills unbuilt courtyards (`fillUnbuiltYards`).
   - Urban districts (`Whitechapel Ward` / `>= 45x35`): Runs hierarchical CDDA block & parcel subdivision (`generateUrbanDistrict` / `subdivideProceduralParcels`) and instantiates declarative ASCII building templates (`instantiateBuildingTemplate`).
5. **Stage 6 (`executeStage6MultiStratumDungeons`)**: Generates `UNDERCROFT` brick sewer dungeons (`generateUndercroftDungeon`), `SPIRE` brass catwalk networks (`generateSpireCatwalks`), and macro barriers (`enrichLargeScaleDistrict`).
6. **Stage 7 (`executeStage7InteractiveUtilityInfrastructure`)**:
   - Spawns portals, utility networks, and monorail cars (`linkAllStrataPortals`).
   - Runs `ensureDistrictConnectivity` to guarantee walkability from `ctx.center` to all critical landmarks.
   - Runs `ensureCompassGateTransitCorridors`: applies open border seams (`applyBoundarySeamsToGrid`) and clears cardinal transit avenues (`x = 1..width-2` at `cy`, `y = 1..height-2` at `cx`).
   - Repairs landmark door jambs and removes floating doors (`sanitizeOrphanDoors`), seals unreachable floor pockets (`sealOrphanedWalkableTiles`), and re-verifies orphan door cleanliness.
7. **Stage 8 (`executeStage8EmergenceAtmosphericSeeding`)**: Seeds initial steam pressure and coal dust gradients around active boilers.

---

## 2. Non-Negotiable Spatial Worldgen Invariants

Every change to `src/sim/spatial/` is audited against three hard district-level invariants in `src/sim/spatial/spatial-anomaly-district.ts`:

### Invariant A — Zero Sealed District Edges (`SEALED_DISTRICT_EDGE = 0`)
- Every open boundary seam segment (`OPEN_STREET`, `CANAL_BRIDGE`, `VIADUCT_ARCH`, `TOLL_ARCH`) declared by `computeDistrictBoundarySeams(districtId, width, height)` MUST have at least one passable border cell (`x = 0`, `x = width - 1`, `y = 0`, or `y = height - 1`) that is reachable via flood-fill from the central hub (`landmarks.streetManhole`).
- Never leave the outer ring (`x = 0`, `x = width - 1`, `y = 0`, `y = height - 1`) as solid `SOOT_BRICK_WALL` across an open seam.

### Invariant B — 100% Seam Reciprocity (`UNRECIPROCATED_SEAM = 0`)
- Every open seam on `edge` pointing to `neighborDistrictId` across `[startCoord, endCoord]` MUST be mirrored by `neighborDistrictId` on `OPPOSITE[edge]` pointing back to `districtId` at the exact same `[startCoord, endCoord]`.
- When modifying `src/sim/spatial/overworld-matrix.ts` or `src/sim/spatial/district-boundaries.ts`, verify that both planar adjacency (`findPlanarNeighbor`) and any `RING_FALLBACK` entries are strictly symmetric.

### Invariant C — Every Door Embedded in a Straight Wall Line (`ORPHAN_DOOR = 0`)
- Every `WOODEN_DOOR_CLOSED` or `WOODEN_DOOR_OPEN` tile must satisfy `isDoorEmbeddedInWall(grid, x, y)`:
  - Either passable North & South (`y - 1`, `y + 1`) and solid wall East & West (`x - 1`, `x + 1`), OR
  - Passable East & West (`x - 1`, `x + 1`) and solid wall North & South (`y - 1`, `y + 1`).
- Never stamp an interior door (`spec.interiorDoors`) onto open floor where two room zones abut without an intervening wall (`if (!getTileCell(grid, door.x, door.y)?.blocksMovement) continue;`).
- Always run `sanitizeOrphanDoors(grid, landmarkDoors)` after late-stage corridor carving (`carveCorridor`, `punchPath`, `ensureCompassGateTransitCorridors`) so doors whose adjacent wall jambs were carved are either repaired (for landmark doors) or converted to open `COBBLESTONE_FLOOR`.

---

## 3. Adding or Modifying CDDA Building Templates

Declarative ASCII building templates live in `src/sim/spatial/building-templates.ts` and `src/sim/spatial/building-templates-expanded.ts` and are validated by `BuildingTemplateSchema` (`src/schemas/building-template.schema.ts`):

1. **Dimensions & Rows**: `rows.length` must equal `height`, and every row string length must equal `width`.
2. **Door Placement on Templates**:
   - Exterior doors (`+`) must sit on an exterior wall line (`#`) flanked on both sides along that wall by solid wall/window tiles (`#` or `=`), with open interior floor (`.`) inside and open approach outside.
   - Interior partition doors (`+`) must sit inside a full partition wall (`#` or `|`) spanning between two rooms.
3. **Instantiation & Self-Correction**:
   - Use `instantiateBuildingTemplate` (`src/sim/spatial/template-instantiator.ts`) and run `applySpatialSelfCorrection` (`src/sim/spatial/spatial-self-corrector.ts`) to automatically clear doorway obstacles (`clearDoorwayObstacles`), relocate blocked entrances (`flipOrRelocateDoorway`), and stitch disconnected sidewalks (`stitchDisconnectedPathways`).

---

## 4. Mandatory Visual Survey Verification (`npm run survey:world`)

Whenever you touch any file in `src/sim/spatial/`, run the multi-district, multi-seed 6-layer spatial survey before concluding your turn:

```bash
npm run survey:world -- --seeds 4 --out tests/artifacts/survey-sheets
```

This generates 6-layer ASCII survey sheets (Terrain, Architecture & Doors, Interior Zoning, Reachability Flood-Fill, Diagnostic Anomaly Heatmap, and Atmospheric Overlay) in `tests/artifacts/survey-sheets/` and fails with exit code `1` if any `SEALED_DISTRICT_EDGE`, `UNRECIPROCATED_SEAM`, `ORPHAN_DOOR`, `BLOCKED_DOORWAY`, `ORPHANED_FLOOR_POCKET`, or `WALL_COLLISION` anomaly is detected.
