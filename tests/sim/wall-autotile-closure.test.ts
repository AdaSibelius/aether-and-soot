import { describe, expect, it } from 'vitest';
import {
  isWallJoinableTerrain,
  isWallTerrain,
  resolveConnectingWallGlyph,
  WALL_BOX_GLYPHS,
} from '../../src/client/projection/wall-connections.js';
import { TerrainType } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { generateVictorianDistrict } from '../../src/sim/spatial/generator.js';
import { createStratumGrid, setTileCell, StratumGrid } from '../../src/sim/spatial/grid.js';

function makeFloorGrid(width = 9, height = 9): StratumGrid {
  let g = createStratumGrid('STREET', width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      g = setTileCell(g, x, y, (c) => ({ ...c, terrainType: 'COBBLESTONE_FLOOR', blocksMovement: false, blocksSight: false }));
    }
  }
  return g;
}

describe('Section 7.1 (3): Wall Autotiling Closure & Jamb Tee Invariants', () => {
  it('constructs closed tees (╦, ╩, ╠, ╣) when partition walls meet door, window, or gate jambs', () => {
    const openings: TerrainType[] = [
      'WOODEN_DOOR_CLOSED',
      'WOODEN_DOOR_OPEN',
      'GLASS_WINDOW',
      'SMASHED_WINDOW_FRAME',
      'DISTRICT_GATE',
    ];

    for (const opening of openings) {
      expect(isWallJoinableTerrain(opening)).toBe(true);
      expect(isWallTerrain(opening)).toBe(false);

      // Horizontal wall along y=4 with opening at (5,4) and partition rising North from (4,4) -> ╩ (TEE_SOUTH)
      let g = makeFloorGrid();
      g = setTileCell(g, 3, 4, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL' }));
      g = setTileCell(g, 4, 4, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL' }));
      g = setTileCell(g, 5, 4, (c) => ({ ...c, terrainType: opening }));
      g = setTileCell(g, 4, 3, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL' }));
      expect(resolveConnectingWallGlyph(g, 4, 4)).toBe(WALL_BOX_GLYPHS.TEE_SOUTH);

      // Partition dropping South from (4,4) -> ╦ (TEE_NORTH)
      let gNorth = makeFloorGrid();
      gNorth = setTileCell(gNorth, 3, 4, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL' }));
      gNorth = setTileCell(gNorth, 4, 4, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL' }));
      gNorth = setTileCell(gNorth, 5, 4, (c) => ({ ...c, terrainType: opening }));
      gNorth = setTileCell(gNorth, 4, 5, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL' }));
      expect(resolveConnectingWallGlyph(gNorth, 4, 4)).toBe(WALL_BOX_GLYPHS.TEE_NORTH);

      // Vertical wall along x=4 with opening at (4,5) and partition branching East from (4,4) -> ╠ (TEE_EAST)
      let gEast = makeFloorGrid();
      gEast = setTileCell(gEast, 4, 3, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL' }));
      gEast = setTileCell(gEast, 4, 4, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL' }));
      gEast = setTileCell(gEast, 4, 5, (c) => ({ ...c, terrainType: opening }));
      gEast = setTileCell(gEast, 5, 4, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL' }));
      expect(resolveConnectingWallGlyph(gEast, 4, 4)).toBe(WALL_BOX_GLYPHS.TEE_EAST);

      // Vertical wall along x=4 with opening at (4,5) and partition branching West from (4,4) -> ╣ (TEE_WEST)
      let gWest = makeFloorGrid();
      gWest = setTileCell(gWest, 4, 3, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL' }));
      gWest = setTileCell(gWest, 4, 4, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL' }));
      gWest = setTileCell(gWest, 4, 5, (c) => ({ ...c, terrainType: opening }));
      gWest = setTileCell(gWest, 3, 4, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL' }));
      expect(resolveConnectingWallGlyph(gWest, 4, 4)).toBe(WALL_BOX_GLYPHS.TEE_WEST);
    }
  });

  it('produces zero disconnected wall glyphs (#) adjacent to doors, windows, and gates across generated districts', () => {
    for (let seed = 1000; seed <= 1010; seed++) {
      const world = createInitialWorld({ seed, width: 48, height: 36 });
      const { state } = generateVictorianDistrict(world);
      const street = state.strata.STREET!;

      for (let y = 0; y < street.height; y++) {
        for (let x = 0; x < street.width; x++) {
          const cell = street.cells[y * street.width + x]!;
          if (!isWallTerrain(cell.terrainType)) continue;

          const neighbors = [
            street.cells[(y - 1) * street.width + x],
            street.cells[(y + 1) * street.width + x],
            street.cells[y * street.width + (x - 1)],
            street.cells[y * street.width + (x + 1)],
          ];
          const touchesOpening = neighbors.some(
            (n) =>
              n !== undefined &&
              (n.terrainType === 'WOODEN_DOOR_CLOSED' ||
                n.terrainType === 'WOODEN_DOOR_OPEN' ||
                n.terrainType === 'GLASS_WINDOW' ||
                n.terrainType === 'SMASHED_WINDOW_FRAME' ||
                n.terrainType === 'DISTRICT_GATE'),
          );

          if (touchesOpening) {
            const glyph = resolveConnectingWallGlyph(street, x, y);
            expect(glyph, `Seed ${seed} wall at (${x},${y}) adjacent to opening was disconnected`).not.toBe(
              WALL_BOX_GLYPHS.DEFAULT,
            );
          }
        }
      }
    }
  });
});
