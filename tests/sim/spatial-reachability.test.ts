import { describe, expect, it } from 'vitest';
import { BlueprintIdSchema, Point2D } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { generateVictorianDistrict, hasWalkablePath } from '../../src/sim/spatial/generator.js';
import { getTileCell, isWithinBounds, StratumGrid } from '../../src/sim/spatial/grid.js';

function isReachableOrAdjacentReachable(grid: StratumGrid, start: Point2D, target: Point2D): boolean {
  if (hasWalkablePath(grid, start, target)) return true;

  const deltas = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  for (const { dx, dy } of deltas) {
    const adj = { x: target.x + dx, y: target.y + dy };
    if (isWithinBounds(grid, adj.x, adj.y)) {
      const cell = getTileCell(grid, adj.x, adj.y);
      if (cell && !cell.blocksMovement && hasWalkablePath(grid, start, adj)) {
        return true;
      }
    }
  }
  return false;
}

describe('Section 7.1: BFS Spatial Transit Reachability & Anti-Trapping Tests', () => {
  const CANONICAL_DISTRICTS = [
    'district_spitalfields_soot_works',
    'district_fleet_ditch_undercroft',
    'district_limehouse_docks',
    'district_whitechapel_ward',
    'district_belgravia_brass_spires',
  ] as const;

  it('guarantees 100% BFS reachability from central plaza to gates, portals, and doors across seeds 1000..1020', () => {
    for (let seed = 1000; seed <= 1020; seed++) {
      for (const districtId of CANONICAL_DISTRICTS) {
        const world = createInitialWorld({
          seed,
          currentDistrictId: BlueprintIdSchema.parse(districtId),
          width: 48,
          height: 36,
        });

        const { state, landmarks } = generateVictorianDistrict(world);
        const street = state.strata.STREET;
        expect(street).toBeDefined();

        const plazaCenter = landmarks.streetManhole;
        expect(isWithinBounds(street!, plazaCenter.x, plazaCenter.y)).toBe(true);

        // 1. Compass Transit Gates (West & East)
        expect(
          isReachableOrAdjacentReachable(street!, plazaCenter, landmarks.westGate),
          `Seed ${seed} district ${districtId}: West gate unreachable`,
        ).toBe(true);
        expect(
          isReachableOrAdjacentReachable(street!, plazaCenter, landmarks.eastGate),
          `Seed ${seed} district ${districtId}: East gate unreachable`,
        ).toBe(true);

        // 2. Vertical Portals (Street Pneumatic Lift & Sewer Manhole)
        expect(
          isReachableOrAdjacentReachable(street!, plazaCenter, landmarks.streetLift),
          `Seed ${seed} district ${districtId}: Street lift unreachable`,
        ).toBe(true);
        expect(
          isReachableOrAdjacentReachable(street!, plazaCenter, landmarks.streetManhole),
          `Seed ${seed} district ${districtId}: Street manhole unreachable`,
        ).toBe(true);

        // 3. Public Building Doors & Landmarks
        expect(
          isReachableOrAdjacentReachable(street!, plazaCenter, landmarks.workshopDoor),
          `Seed ${seed} district ${districtId}: Workshop door unreachable`,
        ).toBe(true);
        expect(
          isReachableOrAdjacentReachable(street!, plazaCenter, landmarks.marketDoor),
          `Seed ${seed} district ${districtId}: Market door unreachable`,
        ).toBe(true);
        expect(
          isReachableOrAdjacentReachable(street!, plazaCenter, landmarks.foundryBoiler),
          `Seed ${seed} district ${districtId}: Boiler unreachable`,
        ).toBe(true);

        // 4. Any registered district gate entities on STREET
        const streetGates = Object.values(state.entities).filter(
          (e) => e.districtGate && e.position?.stratum === 'STREET',
        );
        for (const g of streetGates) {
          expect(
            isReachableOrAdjacentReachable(street!, plazaCenter, g.position!),
            `Seed ${seed} district ${districtId}: District gate ${g.id} unreachable`,
          ).toBe(true);
        }
      }
    }
  });
});
