import { createStratumGrid, getTileCell } from '../../../src/sim/spatial/grid.js';
import { SeededRNG } from '../../../src/sim/core/rng.js';
import {
  instantiateTemplateIntoGrid,
  transformCoord,
  getTransformedDimensions,
  hasTemplateWalkablePath,
} from '../../../src/sim/spatial/template-instantiator.js';
import {
  ALL_BUILDING_TEMPLATES,
  TEMPLATE_VICTORIAN_TAVERN,
  TEMPLATE_CONSTABULARY_STATION,
  TEMPLATE_ARTISAN_WORKSHOP,
} from '../../../src/sim/spatial/building-templates.js';
import {
  createCoalStoveFixture,
  createIronBoilerFixture,
  createPneumaticDispatchFixture,
  createVictorianFixture,
} from '../../../src/sim/spatial/fixture-catalog.js';

console.log('--- Starting Adversarial Stress Tests ---');

// Stress Test 1: Out-of-bounds stamping rejection
{
  const grid = createStratumGrid('STREET', 12, 10);
  const rng = new SeededRNG(1);
  let threw = false;
  try {
    instantiateTemplateIntoGrid(grid, {}, TEMPLATE_VICTORIAN_TAVERN, { origin: { x: 5, y: 5 } }, rng);
  } catch (e: any) {
    threw = true;
    if (!e.message.includes('out of bounds')) throw new Error('Wrong error message: ' + e.message);
  }
  if (!threw) throw new Error('Stress Test 1 Failed: Out of bounds was not rejected');
  console.log('✓ Stress Test 1 Passed: Out of bounds correctly rejected');
}

// Stress Test 2: Unreachable room detection
{
  const badTemplate = {
    ...TEMPLATE_VICTORIAN_TAVERN,
    id: 'building_bad_sealed' as any,
    rows: [
      '############',
      '#..g..#....#',
      '#..d..#..s.#',
      '#.####+#####', // Sealed entrance into kitchen/scullery
      '#.#........#',
      '#.H.======.#',
      '#...=....b.#',
      '#...=.T..b.#',
      '#...=......#',
      '#####+######',
    ],
  };
  const grid = createStratumGrid('STREET', 30, 30);
  const rng = new SeededRNG(2);
  let threw = false;
  try {
    instantiateTemplateIntoGrid(grid, {}, badTemplate, { origin: { x: 5, y: 5 } }, rng);
  } catch (e: any) {
    threw = true;
    if (!e.message.includes('Walkability invariant failed')) {
      throw new Error('Wrong error message: ' + e.message);
    }
  }
  if (!threw) throw new Error('Stress Test 2 Failed: Unreachable room was not detected');
  console.log('✓ Stress Test 2 Passed: Unreachable room invariant enforcement verified');
}

// Stress Test 3: Four-way coordinate inversion cycle
{
  const w = 15, h = 9;
  for (let u = 0; u < w; u++) {
    for (let v = 0; v < h; v++) {
      // 90 deg 4 times should return to origin (relative)
      // Let's trace rotating 4 times manually
      const p90 = transformCoord(u, v, w, h, 90);
      const p180 = transformCoord(p90.x, p90.y, h, w, 90);
      const p270 = transformCoord(p180.x, p180.y, w, h, 90);
      const p360 = transformCoord(p270.x, p270.y, h, w, 90);
      if (p360.x !== u || p360.y !== v) {
        throw new Error(`Rotation cycle mismatch at (${u}, ${v}): got (${p360.x}, ${p360.y})`);
      }
    }
  }
  console.log('✓ Stress Test 3 Passed: 4x 90deg rotation cycle is identity across all cells');
}

// Stress Test 4: Mirror-mirror and flip-flip inversion
{
  const w = 13, h = 11;
  for (let u = 0; u < w; u++) {
    for (let v = 0; v < h; v++) {
      const m1 = transformCoord(u, v, w, h, 0, true, false);
      const m2 = transformCoord(m1.x, m1.y, w, h, 0, true, false);
      if (m2.x !== u || m2.y !== v) throw new Error(`MirrorX inversion failed at (${u}, ${v})`);

      const f1 = transformCoord(u, v, w, h, 0, false, true);
      const f2 = transformCoord(f1.x, f1.y, w, h, 0, false, true);
      if (f2.x !== u || f2.y !== v) throw new Error(`FlipY inversion failed at (${u}, ${v})`);
    }
  }
  console.log('✓ Stress Test 4 Passed: Mirror and flip reflections are exact involutions');
}

// Stress Test 5: Fixture Catalog component schema conformity
{
  const testEntities: Record<string, any> = {};
  const stove = createCoalStoveFixture({ x: 2, y: 3, stratum: 'STREET' }, testEntities);
  if (stove.thermal?.coreHeatPct !== 80) throw new Error('Stove thermal heat incorrect');
  if (!stove.inventory || stove.inventory.containedEntityIds.length !== 1) {
    throw new Error('Stove inventory seeding failed');
  }
  const itemId = stove.inventory.containedEntityIds[0]!;
  if (!testEntities[itemId] || !testEntities[itemId].item) {
    throw new Error('Seeded coal entity missing in entities registry');
  }

  const boiler = createIronBoilerFixture({ x: 4, y: 5, stratum: 'STREET' });
  if (boiler.pressureVessel?.currentPressureKpa !== 140 || boiler.pressureVessel?.maxPressureKpa !== 250) {
    throw new Error('Boiler pressure vessel specs incorrect');
  }

  const dispatch = createPneumaticDispatchFixture({ x: 6, y: 7, stratum: 'STREET' }, testEntities);
  if (dispatch.utilityConduit?.conduitType !== 'PNEUMATIC_TRANSIT_TUBE') {
    throw new Error('Dispatch conduit type incorrect');
  }
  console.log('✓ Stress Test 5 Passed: Fixture Catalog component schema and inventory integrity verified');
}

console.log('--- ALL ADVERSARIAL STRESS TESTS PASSED ---');
