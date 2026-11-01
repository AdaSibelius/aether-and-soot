# Milestone 1 Independent Review & Adversarial Critic Report

**Reviewer Agent**: `teamwork_reviewer` (M1 Schema & Fixture Reviewer)  
**Working Directory**: `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_reviewer_m1_r2_1/`  
**Milestone**: Milestone 1 (M1) — Building Layout Templates & Steampunk Fixtures  
**Review Target**: Implementation delivered by `teamwork_worker_m1_r2`  
**Date**: 2026-11-01  
**Verdict**: **APPROVE**  
**Overall Risk Assessment**: **LOW**

---

## 1. Observation

Direct inspection and execution commands on the codebase produced the following verifiable telemetry:

### 1.1 Source Code and Schema Verification
1. `src/schemas/primitives.schema.ts` (215 lines, target <= 250):
   - Added `'TIMBER_STRUT'` to `TerrainTypeSchema` (line 115).
   - Added `'CORRIDOR'`, `'LIVING_QUARTERS'`, `'SCULLERY'`, `'CELLAR'`, `'PUBLIC_BAR'`, `'HOLDING_CELL'`, `'INSPECTOR_OFFICE'` to `InteriorZoneTypeSchema` (lines 176–182).
   - Added `'VICTORIAN_TAVERN'`, `'CONSTABULARY_OFFICE'`, `'TENEMENT_HOUSE'` to `BuildingArchetypeIdSchema` (lines 193–195).
   - Strict TypeScript types, zero `any`, zero untyped casts.
2. `src/schemas/world-components.schema.ts` (206 lines, target <= 250):
   - Modularized `FurnitureKindSchema` (lines 58–87) containing all 18 existing furniture types plus 9 new Victorian fixtures (`'COAL_STOVE'`, `'IRON_BOILER'`, `'ROLL_TOP_DESK'`, `'GAS_LAMP'`, `'PNEUMATIC_DISPATCH'`, `'FILING_CABINET'`, `'VALVE_MANIFOLD'`, `'BAR_COUNTER'`, `'CELL_BENCH'`).
   - `FurnitureComponentSchema` references `FurnitureKindSchema` with zero type widening.
3. `src/schemas/building-template.schema.ts` (119 lines, target <= 250):
   - Complete declarative schemas for `TemplateCellRuleSchema`, `TemplateRoomDefinitionSchema`, `TemplatePlacementSchema`, and `BuildingTemplateSchema`.
   - Line 111–118: `.refine()` matrix dimension integrity rule (`tpl.rows.length === tpl.height && tpl.rows.every(r => r.length === width)`).
4. `src/sim/spatial/fixture-catalog.ts` (231 lines, target <= 250):
   - Deterministic entity ID generation: `buildFixtureEntityId(kind, x, y, stratum)` producing `entity_${kind.toLowerCase()}_${x}_${y}_${stratum.toLowerCase()}`.
   - 8 specialized fixture factory functions: `createArtificerBenchFixture`, `createCoalStoveFixture`, `createIronBoilerFixture`, `createRollTopDeskFixture`, `createGasLampFixture`, `createPneumaticDispatchFixture`, `createFilingCabinetFixture`, `createValveManifoldFixture`.
   - `createVictorianFixture` (and alias `createFixtureEntity`) providing exhaustive dispatch and graceful fallback.
   - Flat relational ECS: `seedFixtureInventory` stores spawned child items directly into the top-level `entities` record (`entities[itemId] = created`) while parent fixtures reference only their IDs in `inventory.containedEntityIds`.
5. `src/sim/spatial/building-templates.ts` (235 lines, target <= 250):
   - 6 CDDA-style matrix templates: `TEMPLATE_VICTORIAN_TAVERN` (12x10), `TEMPLATE_CONSTABULARY_STATION` (11x10), `TEMPLATE_TENEMENT_HOUSE` (11x11), `TEMPLATE_APOTHECARY_CLINIC` (11x10), `TEMPLATE_ARTISAN_WORKSHOP` (13x10), and `TEMPLATE_STEAM_BOILERHOUSE` (11x10).
   - Validated at module initialization via `BuildingTemplateSchema.parse(...)`.
6. `src/sim/spatial/template-instantiator.ts` (236 lines, target <= 250):
   - Closed-form affine coordinate transformations (`transformCoord`, `getTransformedDimensions`, `transformRoomBox`) supporting 0°, 90°, 180°, 270° orthogonal rotations and `mirrorX`/`flipY` reflections.
   - Out-of-bounds stamping bounds protection against `grid.width` and `grid.height`.
   - Stamping of base terrain, interior zones, fixtures, thermodynamic pressures/particulates, and cross-stratum portals.
   - Breadth-First Search (BFS) reachability enforcement (`hasTemplateWalkablePath`) guaranteeing every interior room has a traversable path to the exterior entrance.
7. `src/sim/systems/container.system.ts` (189 lines, target <= 250):
   - Extended `VALID_CONTAINER_KINDS` with `'COAL_STOVE'`, `'ROLL_TOP_DESK'`, `'PNEUMATIC_DISPATCH'`, and `'FILING_CABINET'`.
8. `tests/sim/building-templates.test.ts` (184 lines, target <= 250):
   - 8 comprehensive deterministic unit tests covering structural dimensions, coordinate rotation math, Tavern stamping, Constabulary stamping, Boilerhouse stamping, Container looting mechanics, 30-seed BFS walkability, and byte-identical JSON determinism.

### 1.2 Verification Pipeline Results
- `npm run typecheck` (`tsc --noEmit`):
  * **Result**: Exit code 0, 0 errors.
- `npm run check:boundaries` (`tsx tests/scripts/check-boundaries.ts`):
  * **Result**: `[check:boundaries] OK — Checked 415 files. Zero Core/Shell or modularity violations.`
  * Zero browser globals (`window`, `document`) or non-deterministic calls (`Math.random()`, `Date.now()`) in `src/sim/` or `src/schemas/`.
  * All files <= 236 lines (well below the 250 line guideline and 300 line hard ceiling).
- `npm run validate:data` (`tsx tests/scripts/validate-data.ts`):
  * **Result**: `[validate:data] OK — Validated 5 prosthetics, 2 commodities, 22 materials/consumables, 9 recipes, 2 gases/fluids, 5 districts, 4 bark corpora, 3 codex entries.`
- `npx vitest run tests/sim/building-templates.test.ts`:
  * **Result**: `Test Files 1 passed (1), Tests 8 passed (8), Duration 368ms`.
- `npm run test:sim` (`vitest run`):
  * **Result**: `Test Files 114 passed (114), Tests 598 passed (598), Duration 6.54s`.
- Master gate `npm run verify`:
  * **Result**: All 4 gates passed in sequence with 0 errors.

---

## 2. Integrity Audit (Anti-Cheating Check)

As reviewer and adversarial critic, an explicit audit for integrity violations was conducted:
1. **Hardcoded Test Results or Facade Outputs**:
   - Inspected `tests/sim/building-templates.test.ts` and `src/sim/spatial/template-instantiator.ts`.
   - Tests do not use hardcoded mocks of results; they execute the full simulation pipeline (`createStratumGrid`, `instantiateTemplateIntoGrid`, `resolveLootContainer`, BFS path searches across 30 seeds).
   - Coordinate transformations compute actual trigonometry/linear algebra for dimensions and coordinates.
2. **Dummy or Facade Implementations**:
   - `createVictorianFixture` instantiates concrete `EntityRecord` instances with active game components (`workbench`, `thermal`, `pressureVessel`, `inventory`, `utilityConduit`, `portal`).
   - `seedFixtureInventory` invokes `createEntityFromBlueprint` and seeds valid items into `entities`.
3. **Shortcuts or Delegations Bypassing Requirements**:
   - All 6 CDDA building templates have complete ASCII layouts, complete legends, and room boundaries.
   - All 8 required Victorian fixtures have explicit factory functions and component configurations.
4. **Fabricated Verification Logs or Self-Certifying Work**:
   - Verification commands were independently re-executed in this turn (`typecheck`, `check:boundaries`, `validate:data`, `vitest run tests/sim/building-templates.test.ts`, `npm run verify`).
   - Results match the worker's reported telemetry exactly.

**Integrity Finding**: **PASS (Zero integrity violations detected).**

---

## 3. Logic Chain

1. **Schema Extensibility & Backward Compatibility**:
   - Additions to `primitives.schema.ts` and `world-components.schema.ts` are strictly additive enum variants. Existing save states and schemas continue to validate without schema migrations or version increments.
2. **Flat Relational ECS Enforcement**:
   - Rule 2.3 prohibits nested entity records. `fixture-catalog.ts` places child items into `entities[itemId]` and only references the `EntityId` strings within the parent container's `inventory.containedEntityIds`.
   - Entity IDs use coordinate and stratum namespaces (`entity_${kind}_${x}_${y}_${stratum}`) guaranteeing determinism and uniqueness across multiple instances in the same world state.
3. **Topological and Spatial Invariants**:
   - Every template row and column matches the declared dimensions, verified at compile time by `BuildingTemplateSchema.refine()`.
   - 100% BFS reachability verification ensures that procedurally stamped templates do not trap the player or block access to interior functional rooms.
   - Exterior doors are filtered by perimeter coordinates (`isPerimeter`), preventing interior room doors from being exposed to the street connection network.
4. **Clean Headless Core/Shell Boundary**:
   - Neither `src/sim/spatial/` nor `src/schemas/` imports anything from `src/client/`, `pixi.js`, or browser globals.
   - All visual data is represented as declarative `VisualGlyphSpec` objects conforming to `primitives.schema.ts`.

---

## 4. Adversarial Challenges & Stress-Testing

### Challenge 1 (Minor / Advisory): Multi-Entrance Reachability Assumption
- **Assumption Challenged**: In `template-instantiator.ts` (lines 217–233), the walkability validation assumes `mainDoor = entrancePoints[0]!` and verifies that every interior room can reach this single door.
- **Attack Scenario**: If a template possesses multiple exterior doors (e.g., a front shop door and a rear loading bay) where a rear storage room is partitioned off and accessible *only* via the rear door, checking reachability strictly from `entrancePoints[0]` would falsely trigger a walkability invariant failure (`Walkability invariant failed: Room '...' unreachable from door`).
- **Blast Radius**: Zero impact in Milestone 1 (all 6 M1 templates have exactly 1 exterior entrance). Low-to-Medium risk in Milestone 2 if multi-entrance templates are introduced.
- **Mitigation / Recommendation for M2**: Update the invariant check in Milestone 2 to test whether each room is reachable from *at least one* exterior door:
  `entrancePoints.some(door => hasTemplateWalkablePath(nextGrid, door, roomWalkable))`.

### Challenge 2 (Resolved): Stamping Near Grid Boundaries
- **Assumption Challenged**: Template instantiator assumes the caller passes valid placement coordinates.
- **Attack Scenario**: Calling `instantiateTemplateIntoGrid` where `origin.x + dims.width > grid.width` or with negative origins.
- **Defense Verified**: Line 118–120 in `template-instantiator.ts` contains an explicit bounds guard throwing an informative error:
  `Template '${template.id}' out of bounds at (${origin.x}, ${origin.y}) on ${grid.width}x${grid.height}`.

### Challenge 3 (Resolved): Container Loot Seeding with Missing Blueprints
- **Assumption Challenged**: Fixture catalog assumes all blueprint IDs exist in `item-catalog.ts`.
- **Attack Scenario**: Calling `seedFixtureInventory` with an unrecognized or corrupted blueprint ID.
- **Defense Verified**: Line 57 in `fixture-catalog.ts` guards `if (created)` before registering into `entities`, preventing `undefined` values from polluting `entities`.

---

## 5. Review Findings Summary

### Critical Findings: None
### Major Findings: None
### Minor / Advisory Findings:
- **Finding 1 (Advisory for M2)**:
  - *Location*: `src/sim/spatial/template-instantiator.ts:218`
  - *Detail*: Invariant reachability currently assumes all rooms connect to `entrancePoints[0]`. If M2 introduces buildings with detached annexes or dual exterior entrances, generalize to `entrancePoints.some(...)`.

---

## 6. Caveats

- **Undercroft Cellar Portals**: The portals in `TEMPLATE_VICTORIAN_TAVERN` and `TEMPLATE_TENEMENT_HOUSE` target stratum `UNDERCROFT`. Milestone 2 district generation must ensure matching coordinates on `UNDERCROFT` are carved and walkable.
- **Review Scope**: This review covers Milestone 1 deliverables. Downstream client rendering (M3) and multi-stratum worldgen (M2) remain to be implemented in their respective milestones.

---

## 7. Conclusion & Verdict

The Milestone 1 implementation by `teamwork_worker_m1_r2` is comprehensive, robust, strictly typed, modular, and fully tested. All 4 verification gates pass with zero errors, line counts are well within the 250 line threshold, and the code adheres to all architectural invariants and headless simulation standards.

**Verdict: APPROVE**

---

## 8. Verification Method

To independently reproduce this verification:
```bash
# 1. Strict TypeScript check
npm run typecheck

# 2. Modularity & boundary enforcement check (enforces <= 300 line limit)
npm run check:boundaries

# 3. Zod data validation check
npm run validate:data

# 4. Milestone 1 targeted simulation test suite
npx vitest run tests/sim/building-templates.test.ts

# 5. Full regression simulation test suite
npm run test:sim

# 6. Complete master verification pipeline
npm run verify
```
Expected output: 0 errors across all 4 gates, 114 test files passed, 598 tests passed.
