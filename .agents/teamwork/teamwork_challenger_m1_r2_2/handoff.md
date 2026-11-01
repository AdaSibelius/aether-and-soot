# Adversarial Challenge Report: Fixture Instantiation, Container Looting & Physical Invariants

**Agent**: teamwork_challenger (M1 Fixture & Container Challenger)  
**Working Directory**: `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_challenger_m1_r2_2/`  
**Milestone**: Milestone 1 (M1) — Building Layout Templates & Steampunk Fixtures  
**Date**: 2026-11-01  
**Status**: COMPLETE  

---

## 1. Observation

Direct empirical stress testing and static AST inspection of `src/sim/spatial/fixture-catalog.ts` and `src/sim/systems/container.system.ts` were executed via targeted Vitest stress harnesses and boundary checkers:

### 1.1 Test Suite & Verification Execution
1. **Adversarial Stress Test Suite Authoring**:
   - Authored `tests/sim/fixture-container-stress.test.ts` (249 lines, conforming strictly to the $\le 250$ line target ceiling and well below the 300 hard failure limit).
   - Executed targeted stress tests:
     ```bash
     npx vitest run tests/sim/fixture-container-stress.test.ts tests/sim/building-templates.test.ts
     ```
     Result:
     ```
     Test Files  2 passed (2)
          Tests  11 passed (11)
       Duration  367ms
     ```
2. **Boundary & Data Validation**:
   - `npm run check:boundaries`: Checked 417 files. Zero Core/Shell or modularity violations.
   - `npm run validate:data`: Validated 5 prosthetics, 2 commodities, 22 materials/consumables, 9 recipes, 2 gases/fluids, 5 districts, 4 bark corpora, 3 codex entries.
3. **Module Line Count Telemetry (`wc -l`)**:
   ```
   215 src/schemas/primitives.schema.ts
   206 src/schemas/world-components.schema.ts
   119 src/schemas/building-template.schema.ts
   231 src/sim/spatial/fixture-catalog.ts
   235 src/sim/spatial/building-templates.ts
   236 src/sim/spatial/template-instantiator.ts
   189 src/sim/systems/container.system.ts
   184 tests/sim/building-templates.test.ts
   249 tests/sim/fixture-container-stress.test.ts
   ```
   All files are strictly $\le 249$ lines.

### 1.2 Empirical Stress Results

#### Invariant A: Deterministic ID Uniqueness Across 2,048 Fixtures
- **Test Setup**: Spawned all 8 Victorian fixture kinds (`ARTIFICER_BENCH`, `COAL_STOVE`, `IRON_BOILER`, `ROLL_TOP_DESK`, `GAS_LAMP`, `PNEUMATIC_DISPATCH`, `FILING_CABINET`, `VALVE_MANIFOLD`) across 64 distinct coordinates ($x \in [-4..3], y \in [-4..3]$ including origin $(0, 0)$, negative coordinates, and boundary values) on all 4 world strata (`STREET`, `UNDERCROFT`, `SPIRE`, `CATACOMBS`).
- **Observed**:
  - Total fixtures instantiated: 2,048.
  - Set of unique IDs: 2,048 (`seenIds.size === 2048`).
  - **Zero ID collisions** observed.
  - All generated IDs strictly adhere to `EntityIdSchema` (`buildFixtureEntityId` producing `entity_${kind.toLowerCase()}_${x}_${y}_${stratum.toLowerCase()}`).
  - Child item entities inside seeded containers (`${fixtureId}_item_${idx}`) produced 100% unique IDs with zero collisions with other child items or fixtures.

#### Invariant B: Line of Sight and Movement Collision Invariants
- **Artificer Bench & Gas Lamp**:
  - `ARTIFICER_BENCH`: `position.blocksMovement === false`, `position.blocksSight === false`.
  - `GAS_LAMP`: `position.blocksMovement === false`, `position.blocksSight === false`.
  - `findBlockingEntityAtPoint(worldEntities, { x: 5, y: 5, stratum: 'STREET' })` returned `undefined`, confirming movement through benches and lamps is permitted.
- **Iron Boiler**:
  - `IRON_BOILER`: `position.blocksMovement === true`, `position.blocksSight === true`.
  - `findBlockingEntityAtPoint` returned the boiler entity, confirming movement blockage.
  - In FOV shadowcasting (`computeVisibleTiles`), placing an `IRON_BOILER` at $(7, 5)$ occluded tiles $(8, 5)$ and $(9, 5)$ from an observer at $(5, 5)$, while clear tiles allowed unobstructed sight.
- **Other 5 Fixtures**:
  - `COAL_STOVE`, `ROLL_TOP_DESK`, `PNEUMATIC_DISPATCH`, `FILING_CABINET`, `VALVE_MANIFOLD` all verified with `blocksMovement: true` and `blocksSight: false`.
  - All correctly block movement in `findBlockingEntityAtPoint` while allowing raycast visibility.

#### Invariant C: Container Looting & Edge Case Stress
- **Initial Currency Looting**:
  - Roll-top desk containing `item_crown_pence_pouch` looted by player.
  - Spent `STANDARD_ACTION_AP` ($100$ AP), credited $+18$ pence to `playerTreasuryPence`, removed pouch entity from `entities`.
  - `Number.isNaN(state.economy.playerTreasuryPence)` was `false`.
- **Repeated Looting of Depleted Containers (25 Iterations)**:
  - 25 consecutive `resolveLootContainer` calls on the depleted desk returned `CONTAINER_EMPTY` (`events[0].reason === 'CONTAINER_EMPTY'`).
  - `apSpent` was strictly $0$.
  - Zero unhandled exceptions thrown; zero NaN leaks in player treasury.
- **Out-of-Range & Cross-Stratum Boundary Enforcement**:
  - Looting container at distance $> 1$ (e.g. $(14, 14)$ from player at $(10, 10)$) returned `apSpent: 0` and failure reason `OUT_OF_RANGE`.
  - Looting container at identical $(x, y)$ but different stratum (`UNDERCROFT` vs `STREET`) returned `apSpent: 0` and failure reason `OUT_OF_RANGE`.
- **Non-Container & Phantom Targets**:
  - Looting non-container furniture (`IRON_BOILER`, not in `VALID_CONTAINER_KINDS`) returned `NOT_A_CONTAINER`.
  - Looting non-existent entity ID returned `OUT_OF_RANGE` with zero exceptions.
- **Inventory Overload Handling**:
  - When actor carried mass was artificially maxed ($99,999,999$g), looting a heavy container cleanly failed with `MASS_EXCEEDED` and $0$ AP spent.

---

## 2. Logic Chain

1. **Deterministic Fixture Identification**:
   - `buildFixtureEntityId(kind, x, y, stratum)` deterministically formats as `entity_${kind.toLowerCase()}_${x}_${y}_${stratum.toLowerCase()}`.
   - Because $(x, y, stratum)$ uniquely identifies spatial location and $kind$ is injected into the namespace, two distinct fixtures on the same tile would only collide if they shared the same kind.
   - In standard world instantiation, each grid cell hosts at most one fixture entity.
   - Child items append `_item_${idx}` to the parent fixture's unique ID, maintaining strict mathematical collision immunity across all entities.

2. **Physical Blocking & Shadowcasting**:
   - In ECS queries, `findBlockingEntityAtPoint` checks `entity.position?.blocksMovement`.
   - `IRON_BOILER` has both `blocksMovement: true` and `blocksSight: true`, mirroring Victorian industrial machinery bulk.
   - `ARTIFICER_BENCH` and `GAS_LAMP` set `blocksMovement: false` and `blocksSight: false`, correctly permitting player and NPC traversal (e.g. standing at workbenches or passing under streetlights).
   - In `computeVisibleTiles`, opaque cells occlude light cones via 8-octant recursive shadowcasting.

3. **Container System Robustness**:
   - `resolveLootContainer` implements defensive pre-flight guards:
     * Validates actor existence, position, and inventory.
     * Validates container existence, matching stratum, and Chebyshev distance $\le 1$.
     * Validates `VALID_CONTAINER_KINDS.has(container.furniture.kind)`.
     * Validates `containerInv.containedEntityIds.length > 0`.
   - Any guard failure immediately returns a zero-cost `FURNITURE_ACTION_FAILED` event without modifying world state.
   - Currency auto-redemption directly increments `economy.playerTreasuryPence` and purges currency entities, preventing entity table bloat.
   - 0 unhandled exceptions or NaN values occur during 25+ repeated depletion loot operations.

---

## 3. Caveats

1. **Source Code Modifications**:
   - As an empirical challenger, zero changes were made to source code in `src/`.
   - Verification was performed strictly through non-destructive test harnesses in `tests/sim/` and CLI verification tooling.
2. **Booby Trap Triggering**:
   - While booby traps are supported by `resolveLootContainer` (`container.trap?.armed`), default Victorian fixtures generated from `fixture-catalog.ts` do not instantiate armed traps by default. Trapped containers remain tested under `tests/sim/physics-traps-falls.test.ts`.

---

## 4. Conclusion

All fixture instantiation, container looting, spatial movement, and line-of-sight invariants pass adversarial stress testing with zero regressions, zero ID collisions, zero unhandled exceptions, and zero NaN leaks.

`Verdict: APPROVE`

---

## 5. Verification Method

To independently verify all claims and assertions in this report, execute:

```bash
# 1. Run the targeted Milestone 1 adversarial stress harness
npx vitest run tests/sim/fixture-container-stress.test.ts tests/sim/building-templates.test.ts

# 2. Run boundary and modularity checks (<= 250 line target, 300 hard limit)
npm run check:boundaries

# 3. Run Zod data validation
npm run validate:data

# 4. Run TypeScript compiler check
npm run typecheck
```
