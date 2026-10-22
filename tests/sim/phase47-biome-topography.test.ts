import { describe, expect, it } from 'vitest';
import { TerrainType } from '../../src/schemas/primitives.schema.js';
import {
  createInitialWorld,
  deserializeWorld,
  serializeWorld,
} from '../../src/sim/core/world.js';
import {
  getArchitecturalTerrainProperties,
  placeArchitecturalFeature,
} from '../../src/sim/spatial/architectural-features.js';
import {
  generateVictorianDistrict,
  hasWalkablePath,
} from '../../src/sim/spatial/generator.js';
import { createStratumGrid, getTileCell, setTileCell } from '../../src/sim/spatial/grid.js';
import {
  BIOME_PALETTES,
  resolveBiomeTerrainVisual,
  resolveDistrictBiome,
} from '../../src/client/projection/biome-palette.js';
import {
  resolveConnectingWallGlyph,
  WALL_BOX_GLYPHS,
} from '../../src/client/projection/wall-connections.js';
import { serializePlayerContext } from '../scripts/playtester-serializer.js';

describe('Phase 47: Procedural Architectural Biomes, Topography & Extended CP437/Unicode Glyphs', () => {
  it('correctly reports physical collision and line-of-sight properties for architectural terrain', () => {
    // See-through obstacles (fences, pipes, gaslamps, sluice gates)
    expect(getArchitecturalTerrainProperties('WROUGHT_IRON_FENCE')).toEqual({ blocksMovement: true, blocksSight: false });
    expect(getArchitecturalTerrainProperties('BRASS_STEAM_PIPE')).toEqual({ blocksMovement: true, blocksSight: false });
    expect(getArchitecturalTerrainProperties('GASLAMP_POST')).toEqual({ blocksMovement: true, blocksSight: false });
    expect(getArchitecturalTerrainProperties('CANAL_SLUICE')).toEqual({ blocksMovement: true, blocksSight: false });

    // Opaque obstacles (slag mounds, colonnades, walls)
    expect(getArchitecturalTerrainProperties('SLAG_MOUND')).toEqual({ blocksMovement: true, blocksSight: true });
    expect(getArchitecturalTerrainProperties('GOTHIC_COLONNADE')).toEqual({ blocksMovement: true, blocksSight: true });
    expect(getArchitecturalTerrainProperties('WALL_CROSS')).toEqual({ blocksMovement: true, blocksSight: true });

    // Walkable architecture (timber piers)
    expect(getArchitecturalTerrainProperties('TIMBER_PIER')).toEqual({ blocksMovement: false, blocksSight: false });
  });

  it('dynamically resolves connecting wall box-drawing glyphs for 4-way, tees, corners, and lines', () => {
    const makeFloorGrid = () => {
      let g = createStratumGrid('STREET', 7, 7);
      for (let y = 0; y < 7; y++) {
        for (let x = 0; x < 7; x++) {
          g = setTileCell(g, x, y, (c) => ({ ...c, terrainType: 'COBBLESTONE_FLOOR' }));
        }
      }
      return g;
    };

    // 4-way cross at (3, 3)
    let crossGrid = makeFloorGrid();
    crossGrid = setTileCell(crossGrid, 3, 3, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL' }));
    crossGrid = setTileCell(crossGrid, 3, 2, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL' }));
    crossGrid = setTileCell(crossGrid, 3, 4, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL' }));
    crossGrid = setTileCell(crossGrid, 2, 3, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL' }));
    crossGrid = setTileCell(crossGrid, 4, 3, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL' }));
    expect(resolveConnectingWallGlyph(crossGrid, 3, 3)).toBe(WALL_BOX_GLYPHS.CROSS); // ╬

    // Vertical line at (3, 3) with N and S neighbors
    let vertGrid = makeFloorGrid();
    vertGrid = setTileCell(vertGrid, 3, 3, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL' }));
    vertGrid = setTileCell(vertGrid, 3, 2, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL' }));
    vertGrid = setTileCell(vertGrid, 3, 4, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL' }));
    expect(resolveConnectingWallGlyph(vertGrid, 3, 3)).toBe(WALL_BOX_GLYPHS.VERTICAL); // ║

    // Horizontal line at (3, 3) with E and W neighbors
    let horizGrid = makeFloorGrid();
    horizGrid = setTileCell(horizGrid, 3, 3, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL' }));
    horizGrid = setTileCell(horizGrid, 2, 3, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL' }));
    horizGrid = setTileCell(horizGrid, 4, 3, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL' }));
    expect(resolveConnectingWallGlyph(horizGrid, 3, 3)).toBe(WALL_BOX_GLYPHS.HORIZONTAL); // ═

    // Corner at (3, 3) with N and W neighbors (╝)
    let cornerGrid = makeFloorGrid();
    cornerGrid = setTileCell(cornerGrid, 3, 3, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL' }));
    cornerGrid = setTileCell(cornerGrid, 3, 2, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL' }));
    cornerGrid = setTileCell(cornerGrid, 2, 3, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL' }));
    expect(resolveConnectingWallGlyph(cornerGrid, 3, 3)).toBe(WALL_BOX_GLYPHS.CORNER_SE); // ╝
  });

  it('resolves district biomes with customized dual-color palettes and shader flags', () => {
    expect(resolveDistrictBiome('district_limehouse_docks', 'STREET')).toBe('LIMEHOUSE_DOCKS');
    expect(resolveDistrictBiome('district_spitalfields_soot_works', 'STREET')).toBe('SPITALFIELDS_SMELTING_WORKS');
    expect(resolveDistrictBiome('district_belgravia_brass_spires', 'SPIRE')).toBe('GILDED_SPIRE_ASSEMBLY');
    expect(resolveDistrictBiome('district_whitechapel_ward', 'STREET')).toBe('BLACKFRIARS_ROOKERIES');
    expect(resolveDistrictBiome('district_fleet_ditch_undercroft', 'UNDERCROFT')).toBe('CHALK_VAULT_CATACOMBS');
    expect(resolveDistrictBiome(undefined, 'CATACOMBS')).toBe('CHALK_VAULT_CATACOMBS');

    // Limehouse Docks palette
    const docksPalette = BIOME_PALETTES.LIMEHOUSE_DOCKS;
    expect(docksPalette.floorPrimary).toBe('#38A3A5');
    expect(docksPalette.defaultWallShader).toBe('SOOT_OCCLUSION');

    // Gaslamp post emits GASLIGHT_RADIANCE shader flag
    const gaslampVisual = resolveBiomeTerrainVisual('GASLAMP_POST', true, true, 'SPITALFIELDS_SMELTING_WORKS', '#');
    expect(gaslampVisual.glyph).toBe('☼');
    expect(gaslampVisual.shaderFlags).toContain('GASLIGHT_RADIANCE');

    // Brass steam pipe emits SPARK_GLINT shader flag
    const pipeVisual = resolveBiomeTerrainVisual('BRASS_STEAM_PIPE', true, true, 'SPITALFIELDS_SMELTING_WORKS', '#');
    expect(pipeVisual.glyph).toBe('┼');
    expect(pipeVisual.shaderFlags).toContain('SPARK_GLINT');

    // Wrought iron fence uses ▓ glyph
    const fenceVisual = resolveBiomeTerrainVisual('WROUGHT_IRON_FENCE', true, true, 'BLACKFRIARS_ROOKERIES', '#');
    expect(fenceVisual.glyph).toBe('▓');

    // Slag mound uses ▲ glyph and SOOT_OCCLUSION shader flag
    const slagVisual = resolveBiomeTerrainVisual('SLAG_MOUND', true, true, 'SPITALFIELDS_SMELTING_WORKS', '#');
    expect(slagVisual.glyph).toBe('▲');
    expect(slagVisual.shaderFlags).toContain('SOOT_OCCLUSION');

    // Timber pier uses ═ glyph
    const pierVisual = resolveBiomeTerrainVisual('TIMBER_PIER', true, true, 'LIMEHOUSE_DOCKS', '#');
    expect(pierVisual.glyph).toBe('═');
  });

  it('guarantees 100% serialization round-trip across all new architectural terrain types in WorldState', () => {
    const world = createInitialWorld({ seed: 777, width: 24, height: 24 });
    const architecturalTypes: TerrainType[] = [
      'WROUGHT_IRON_FENCE',
      'BRASS_STEAM_PIPE',
      'GASLAMP_POST',
      'TIMBER_PIER',
      'SLAG_MOUND',
      'CANAL_SLUICE',
      'GOTHIC_COLONNADE',
      'WALL_CROSS',
      'WALL_VERTICAL',
      'WALL_HORIZONTAL',
    ];

    let street = world.strata.STREET!;
    architecturalTypes.forEach((terrainType, i) => {
      street = placeArchitecturalFeature(street, i + 2, 2, terrainType);
    });

    const stateWithArch = {
      ...world,
      strata: {
        ...world.strata,
        STREET: street,
      },
    };

    const json = serializeWorld(stateWithArch);
    const restored = deserializeWorld(json);

    expect(restored.version).toBe(1);
    architecturalTypes.forEach((expectedType, i) => {
      const cell = getTileCell(restored.strata.STREET!, i + 2, 2);
      expect(cell?.terrainType).toBe(expectedType);
    });
  });

  it('seeds district architecture during generation while preserving walkable connectivity', () => {
    const baseWorld = createInitialWorld({ seed: 42, width: 48, height: 36 });
    const { state: world, landmarks } = generateVictorianDistrict(baseWorld);
    const street = world.strata.STREET!;

    // Verify gaslamps are seeded along the thoroughfare margins
    const gaslamps = street.cells.filter((c) => c.terrainType === 'GASLAMP_POST');
    expect(gaslamps.length).toBeGreaterThan(0);

    // Verify walkable connectivity holds from west gate to east gate
    expect(hasWalkablePath(street, landmarks.westGate, landmarks.eastGate)).toBe(true);
    expect(hasWalkablePath(street, landmarks.streetManhole, landmarks.streetLift)).toBe(true);
  });

  it('renders extended CP437/Unicode glyphs in playtester serializer ASCII FOV', () => {
    const world = createInitialWorld({ seed: 101, width: 24, height: 24 });
    const player = world.entities['actor_player']!;
    const px = player.position!.x;
    const py = player.position!.y;

    // Place adjacent architectural features within FOV
    let street = world.strata.STREET!;
    street = placeArchitecturalFeature(street, px + 1, py, 'GASLAMP_POST');
    street = placeArchitecturalFeature(street, px - 1, py, 'WROUGHT_IRON_FENCE');
    street = placeArchitecturalFeature(street, px, py + 1, 'BRASS_STEAM_PIPE');

    const testWorld = {
      ...world,
      strata: { ...world.strata, STREET: street },
    };

    const serializedFov = serializePlayerContext(testWorld);
    expect(serializedFov).toContain('☼'); // Gaslamp
    expect(serializedFov).toContain('▓'); // Fence
    expect(serializedFov).toContain('┼'); // Pipe
  });
});
