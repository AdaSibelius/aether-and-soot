## 2026-11-01T20:30:15Z
You are teamwork_worker (Milestone 1 Implementation Worker).
Your working directory is: /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_worker_m1_r2/

MANDATORY FIRST STEP:
Read the authoritative user request at:
/Users/emmett/Desktop/Game/.agents/teamwork/ORIGINAL_REQUEST.md
Also read the Project Index at:
/Users/emmett/Desktop/Game/.agents/teamwork/orchestrator_2/PROJECT.md
And carefully read the 3 Explorer handoff reports providing exact code blueprints:
1. /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m1_1/handoff.md (Schemas)
2. /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m1_2/handoff.md (Fixture Catalog)
3. /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m1_3/handoff.md (Building Templates & Instantiator)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE FILE OWNERSHIP (You own and may modify ONLY these files):
- `src/schemas/primitives.schema.ts`
- `src/schemas/world-components.schema.ts`
- `src/schemas/building-template.schema.ts`
- `src/sim/spatial/fixture-catalog.ts`
- `src/sim/spatial/building-templates.ts`
- `src/sim/spatial/template-instantiator.ts`
- `src/sim/systems/container.system.ts`
- `tests/sim/building-templates.test.ts`

TASK DESCRIPTION:
Implement Milestone 1: Building Layout Templates & Steampunk Fixtures:
1. Extend `src/schemas/primitives.schema.ts`:
   - `TerrainTypeSchema`: add `'TIMBER_STRUT'`
   - `InteriorZoneTypeSchema`: add `'CORRIDOR'`, `'LIVING_QUARTERS'`, `'SCULLERY'`, `'CELLAR'`, `'PUBLIC_BAR'`, `'HOLDING_CELL'`, `'INSPECTOR_OFFICE'`
   - `BuildingArchetypeIdSchema`: add `'VICTORIAN_TAVERN'`, `'CONSTABULARY_OFFICE'`, `'TENEMENT_HOUSE'`
2. Extend `src/schemas/world-components.schema.ts`:
   - Extract `FurnitureKindSchema` and add `'COAL_STOVE'`, `'IRON_BOILER'`, `'ROLL_TOP_DESK'`, `'GAS_LAMP'`, `'PNEUMATIC_DISPATCH'`, `'FILING_CABINET'`, `'VALVE_MANIFOLD'`, `'BAR_COUNTER'`, `'CELL_BENCH'`
   - Update `FurnitureComponentSchema` to use `FurnitureKindSchema`
3. Create `src/schemas/building-template.schema.ts`:
   - Implement `TemplateCellRuleSchema`, `TemplateRoomDefinitionSchema`, `TemplatePlacementSchema`, and `BuildingTemplateSchema` (with `.refine()` matrix dimension check) per M1-1 blueprint
4. Create `src/sim/spatial/fixture-catalog.ts`:
   - Implement factory functions for all 8 fixtures (`createArtificerBenchFixture`, `createCoalStoveFixture`, `createIronBoilerFixture`, `createRollTopDeskFixture`, `createGasLampFixture`, `createPneumaticDispatchFixture`, `createFilingCabinetFixture`, `createValveManifoldFixture`, and `createVictorianFixture`) per M1-2 blueprint
   - Ensure deterministic ID generation `entity_${kind}_${x}_${y}_${stratum}` and flat relational ECS
5. Create `src/sim/spatial/building-templates.ts`:
   - Implement declarative CDDA matrix templates for all 6 typologies (`TEMPLATE_VICTORIAN_TAVERN`, `TEMPLATE_CONSTABULARY_STATION`, `TEMPLATE_TENEMENT_HOUSE`, `TEMPLATE_APOTHECARY_CLINIC`, `TEMPLATE_ARTISAN_WORKSHOP`, `TEMPLATE_STEAM_BOILERHOUSE`, and registries) per M1-3 blueprint
6. Create `src/sim/spatial/template-instantiator.ts`:
   - Implement `instantiateTemplateIntoGrid`, `transformCoord`, `getTransformedDimensions`, `transformRoomBox` with 4-directional rotation (0, 90, 180, 270), mirroring (`mirrorX`, `flipY`), outward door normals, and 100% BFS room reachability checks per M1-3 blueprint
7. Update `src/sim/systems/container.system.ts`:
   - Add `'COAL_STOVE'`, `'ROLL_TOP_DESK'`, `'PNEUMATIC_DISPATCH'`, `'FILING_CABINET'` to `VALID_CONTAINER_KINDS`
8. Create `tests/sim/building-templates.test.ts`:
   - Implement complete deterministic unit test suite covering matrix dimensions, rotation transformations, fixture spawning, 30+ seed BFS walkability, and byte-identical JSON determinism per M1-3 blueprint

MODULARITY & GOVERNANCE RULES (AGENTS.md):
- Keep EVERY file strictly <= 250 lines (300 lines is a hard failure).
- Strict TypeScript: `"strict": true`, `"noUncheckedIndexedAccess": true`. Zero `any`, zero `@ts-ignore`.
- Zero non-deterministic tokens in `src/sim/` (no `Math.random()`, no `Date.now()`). Use `SeededRNG`.

VERIFICATION REQUIREMENTS:
Run:
- `npm run typecheck`
- `npm run check:boundaries`
- `npm run validate:data`
- `npx vitest run tests/sim/building-templates.test.ts`
- `npm run test:sim`
- `npm run verify`

DELIVERABLE:
Write a comprehensive completion report to `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_worker_m1_r2/handoff.md` with:
- Summary of all files created/modified with exact line counts
- Build and test execution commands and results (all passing)
- Evidence of compliance with all constraints and integrity rules
When done, message the orchestrator with the completion status and report path.
