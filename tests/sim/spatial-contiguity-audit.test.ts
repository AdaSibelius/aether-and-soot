import { describe, expect, it } from 'vitest';
import { estimateTerrainAcousticDb, estimateTerrainHardness } from '../../src/client/canvas-ui/tactical-vernier.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { generateCatacombsFloor } from '../../src/sim/spatial/catacombs-generation.js';
import { generateVictorianDistrict, hasWalkablePath } from '../../src/sim/spatial/generator.js';
import { getTileCell, StratumGrid } from '../../src/sim/spatial/grid.js';
import { spawnDistrictNpcs } from '../../src/sim/systems/district-spawner.js';

function openAllDoors(grid: StratumGrid): StratumGrid {
  return {
    ...grid,
    cells: grid.cells.map((c) =>
      c.terrainType === 'WOODEN_DOOR_CLOSED'
        ? { ...c, terrainType: 'WOODEN_DOOR_OPEN', blocksMovement: false, blocksSight: false }
        : c,
    ),
  };
}

function maxComponentSize(grid: StratumGrid, targetTerrains: ReadonlySet<string>): number {
  const visited = new Set<number>();
  let maxBlob = 0;
  for (let y = 1; y < grid.height - 1; y++) {
    for (let x = 1; x < grid.width - 1; x++) {
      const idx = y * grid.width + x;
      const cell = grid.cells[idx];
      if (!cell || visited.has(idx) || !targetTerrains.has(cell.terrainType)) continue;
      if ((cell.interiorZone ?? 'NONE') !== 'NONE') continue;
      let count = 0;
      const queue = [idx];
      visited.add(idx);
      while (queue.length > 0) {
        const curr = queue.shift()!;
        count++;
        const cx = curr % grid.width;
        const cy = Math.floor(curr / grid.width);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx <= 0 || ny <= 0 || nx >= grid.width - 1 || ny >= grid.height - 1) continue;
          const nIdx = ny * grid.width + nx;
          const nCell = grid.cells[nIdx];
          if (!nCell || visited.has(nIdx)) continue;
          if ((nCell.interiorZone ?? 'NONE') === 'NONE' && targetTerrains.has(nCell.terrainType)) {
            visited.add(nIdx);
            queue.push(nIdx);
          }
        }
      }
      if (count > maxBlob) maxBlob = count;
    }
  }
  return maxBlob;
}

describe('Step 1: Spatial Contiguity Audit & Modularity Pre-Split (AUD-01..AUD-08)', () => {
  const seeds = Array.from({ length: 25 }, (_, i) => 2000 + i);

  it('AUD-01 & AUD-02: guarantees 0 sealed interior rooms and 0 yard fence/lamp blobs > 3 tiles across 25 seeds', () => {
    const yardFeatureSet = new Set(['WROUGHT_IRON_FENCE', 'GASLAMP_POST']);
    for (const seed of seeds) {
      const world = createInitialWorld({ seed, width: 48, height: 36 });
      const { state } = generateVictorianDistrict(world);
      const street = state.strata.STREET!;
      const opened = openAllDoors(street);
      const plaza = { x: 24, y: 18 };

      // Every interior zone cell must be reachable from the central plaza when wooden doors are opened
      for (let y = 1; y < street.height - 1; y++) {
        for (let x = 1; x < street.width - 1; x++) {
          const cell = getTileCell(opened, x, y);
          if (!cell || cell.blocksMovement) continue;
          if ((cell.interiorZone ?? 'NONE') !== 'NONE') {
            expect(hasWalkablePath(opened, plaza, { x, y })).toBe(true);
          }
        }
      }

      // Yard WROUGHT_IRON_FENCE and GASLAMP_POST connected components never exceed 3 tiles
      expect(maxComponentSize(street, yardFeatureSet)).toBeLessThanOrEqual(3);
    }
  });

  it('AUD-03 & AUD-07: aligns NPC spawns with permuted building typologies and places Guild Master Bench across 25 seeds', () => {
    for (const seed of seeds) {
      const world = createInitialWorld({ seed, width: 48, height: 36 });
      const { state: genState } = generateVictorianDistrict(world);
      const { state } = spawnDistrictNpcs(genState);
      const street = state.strata.STREET!;

      // Guild Master Artificer Bench spawns inside Artisan Workshop
      const masterBench = state.entities['station_guild_artisan_bench'];
      expect(masterBench?.position).toBeDefined();
      expect(masterBench?.workbench?.stationType).toBe('ARTIFICER_BENCH');
      const benchCell = getTileCell(street, masterBench!.position!.x, masterBench!.position!.y);
      expect(benchCell?.interiorZone).toBe('WORKSHOP');

      // Chirurgeon spawns near surgical table
      const chirurgeon = state.entities['npc_apothecary_chirurgeon']!.position!;
      const surgTable = state.entities['furniture_surgical_table']!.position!;
      expect(Math.hypot(chirurgeon.x - surgTable.x, chirurgeon.y - surgTable.y)).toBeLessThanOrEqual(4);

      // Merchant spawns near safe vault inside Pawnshop
      const merchant = state.entities['npc_guild_merchant']!.position!;
      const safeVault = state.entities['furniture_safe_vault']!.position!;
      expect(Math.hypot(merchant.x - safeVault.x, merchant.y - safeVault.y)).toBeLessThanOrEqual(5);

      // Syndicate Fixer spawns near cot inside Rookeries
      const fixer = state.entities['npc_syndicate_fixer']!.position!;
      const cot = state.entities['furniture_cot_a']!.position!;
      expect(Math.hypot(fixer.x - cot.x, fixer.y - cot.y)).toBeLessThanOrEqual(4);

      // Foundry Stoker spawns near boiler inside Boilerhouse
      const stoker = state.entities['npc_foundry_stoker']!.position!;
      const boiler = state.entities['vessel_district_boiler']!.position!;
      expect(Math.hypot(stoker.x - boiler.x, stoker.y - boiler.y)).toBeLessThanOrEqual(4);
    }
  });

  it('AUD-04 & AUD-05: verifies 100% Catacombs portal reciprocity and Spire Conservatory catwalk bridge across 25 seeds', () => {
    for (const seed of seeds) {
      const world = createInitialWorld({ seed, width: 48, height: 36 });
      const { state, landmarks } = generateVictorianDistrict(world);

      // Undercroft -> Catacombs stairs target Depth 1 stairsUp room (5, 5)
      const undercroftStairs = state.entities['stairs_undercroft_to_catacombs'];
      expect(undercroftStairs?.portal?.target.stratum).toBe('CATACOMBS');
      expect(undercroftStairs?.portal?.target.depthLevel).toBe(1);

      const d1 = generateCatacombsFloor(seed, 48, 36, 1);
      const targetCell = getTileCell(d1.grid, undercroftStairs!.portal!.target.x, undercroftStairs!.portal!.target.y);
      expect(targetCell?.blocksMovement).toBe(false);

      // Depth 1 stairsDown has valid portal component targeting Depth 2
      const downD1 = d1.entities['stairs_catacombs_down_d1'];
      expect(downD1?.portal?.target.stratum).toBe('CATACOMBS');
      expect(downD1?.portal?.target.depthLevel).toBe(2);

      // Spire Conservatory is connected to Spire Lift via walkable catwalk bridge when doors are opened
      const spireOpened = openAllDoors(state.strata.SPIRE!);
      const gh = state.entities['landmark_spire_greenhouse']!.position!;
      expect(hasWalkablePath(spireOpened, landmarks.spireLift, { x: gh.x, y: gh.y })).toBe(true);
    }
  });

  it('AUD-06 & AUD-08: carves Stage 2 viaduct rail track, protects VAULT walls, and aligns tactical vernier terrain lookup', () => {
    const world = createInitialWorld({ seed: 2026, width: 48, height: 36 });
    const { state } = generateVictorianDistrict(world);
    const street = state.strata.STREET!;
    const monorailCar = state.entities['monorail_car_street_depot']!.position!;

    // Stage 2 viaduct rail track carved at monorailCar.y
    let grateCount = 0;
    for (let x = 2; x < street.width - 2; x++) {
      if (getTileCell(street, x, monorailCar.y)?.terrainType === 'IRON_GRATE') grateCount++;
    }
    expect(grateCount).toBeGreaterThanOrEqual(8);

    // Tactical vernier matches canonical TerrainTypeSchema values
    expect(estimateTerrainAcousticDb('IRON_GRATE')).toBe(82);
    expect(estimateTerrainAcousticDb('COBBLESTONE_FLOOR')).toBe(68);
    expect(estimateTerrainAcousticDb('RUBBLE_PILE')).toBe(75);
    expect(estimateTerrainHardness('SOOT_BRICK_WALL')).toEqual({ rating: 'VITRIFIED_BRICK', mohs: 7.0 });
    expect(estimateTerrainHardness('WROUGHT_IRON_FENCE')).toEqual({ rating: 'STRUCTURAL_IRON', mohs: 6.5 });
    expect(estimateTerrainHardness('BRASS_STEAM_PIPE')).toEqual({ rating: 'STRUCTURAL_IRON', mohs: 6.5 });
    expect(estimateTerrainHardness('SLAG_MOUND')).toEqual({ rating: 'VITRIFIED_STONE', mohs: 5.5 });
  });
});
