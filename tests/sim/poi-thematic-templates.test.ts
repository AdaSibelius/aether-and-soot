import { describe, expect, it } from 'vitest';
import { resolveBiomeTerrainVisual } from '../../src/client/projection/biome-palette.js';
import { isWallJoinableTerrain, resolveConnectingWallGlyph, WALL_BOX_GLYPHS } from '../../src/client/projection/wall-connections.js';
import { createDefaultShaderUniformValues, packShaderUniforms } from '../../src/client/renderer/shader-uniforms.js';
import { DIEGETIC_FRAGMENT_SHADER } from '../../src/client/renderer/diegetic-post-filter.js';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { getArchitecturalTerrainProperties } from '../../src/sim/spatial/architectural-features.js';
import { generateVictorianDistrict } from '../../src/sim/spatial/generator.js';
import { createStratumGrid, getTileCell, setTileCell } from '../../src/sim/spatial/grid.js';
import { parseLlmResponseToCommand, serializePlayerContext } from '../scripts/playtester-serializer.js';

describe('Step 2: Thematic Architectural Templates & Volumetric Smoke Hook', () => {
  it('correctly configures CP437 glyphs and physical properties for the 5 new terrains', () => {
    // 1. COUNTER_BARRIER: '╦', blocksMovement: true, blocksSight: false
    const counterProps = getArchitecturalTerrainProperties('COUNTER_BARRIER');
    expect(counterProps).toEqual({ blocksMovement: true, blocksSight: false });
    const counterVisual = resolveBiomeTerrainVisual('COUNTER_BARRIER', true, true, 'SPITALFIELDS_SMELTING_WORKS', '#');
    expect(counterVisual.glyph).toBe('╦');
    expect(counterVisual.shaderFlags).toContain('COUNTER_GLINT');
    expect(isWallJoinableTerrain('COUNTER_BARRIER')).toBe(true);

    // 2. CONVEYOR_TRACK: '▤', blocksMovement: false, blocksSight: false
    const convProps = getArchitecturalTerrainProperties('CONVEYOR_TRACK');
    expect(convProps).toEqual({ blocksMovement: false, blocksSight: false });
    const convVisual = resolveBiomeTerrainVisual('CONVEYOR_TRACK', true, true, 'SPITALFIELDS_SMELTING_WORKS', '#');
    expect(convVisual.glyph).toBe('▤');

    // 3. SLAG_PIT: '▒', blocksMovement: true, blocksSight: false, HEAT_SHIMMER
    const pitProps = getArchitecturalTerrainProperties('SLAG_PIT');
    expect(pitProps).toEqual({ blocksMovement: true, blocksSight: false });
    const pitVisual = resolveBiomeTerrainVisual('SLAG_PIT', true, true, 'SPITALFIELDS_SMELTING_WORKS', '#');
    expect(pitVisual.glyph).toBe('▒');
    expect(pitVisual.shaderFlags).toContain('HEAT_SHIMMER');

    // 4. RAIL_TRACK: '═', blocksMovement: false, blocksSight: false
    const railProps = getArchitecturalTerrainProperties('RAIL_TRACK');
    expect(railProps).toEqual({ blocksMovement: false, blocksSight: false });
    const railVisual = resolveBiomeTerrainVisual('RAIL_TRACK', true, true, 'SPITALFIELDS_SMELTING_WORKS', '#');
    expect(railVisual.glyph).toBe('═');

    // 5. BOARDING_PLATFORM: '▬', blocksMovement: false, blocksSight: false
    const platProps = getArchitecturalTerrainProperties('BOARDING_PLATFORM');
    expect(platProps).toEqual({ blocksMovement: false, blocksSight: false });
    const platVisual = resolveBiomeTerrainVisual('BOARDING_PLATFORM', true, true, 'SPITALFIELDS_SMELTING_WORKS', '#');
    expect(platVisual.glyph).toBe('▬');
  });

  it('renders solid masonry fill ▓ for 8-neighbor enclosed walls without ╬ clutter', () => {
    let grid = createStratumGrid('STREET', 5, 5);
    // Fill all cells with solid wall
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        grid = setTileCell(grid, x, y, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL' }));
      }
    }
    // Fully enclosed interior tile (2, 2)
    expect(resolveConnectingWallGlyph(grid, 2, 2)).toBe(WALL_BOX_GLYPHS.SOLID_INTERIOR);
    expect(WALL_BOX_GLYPHS.SOLID_INTERIOR).toBe('▓');
  });

  it('wires uSmokeMask into diegetic post filter and uniform packing', () => {
    expect(DIEGETIC_FRAGMENT_SHADER).toContain('uSmokeMask');
    const uniforms = createDefaultShaderUniformValues(800, 600);
    expect(uniforms.smokeMask).toEqual([0, 0, 0, 0]);
    const packed = packShaderUniforms(uniforms);
    expect(packed['uSmokeMask']?.type).toBe('vec4<f32>');
  });

  it('generates Factories, Stations, Mercantile, and Rookeries with thematic POI architecture across seeds', () => {
    const seeds = [2026, 2027, 2028, 2029, 2030];
    for (const seed of seeds) {
      const world = createInitialWorld({ seed, width: 48, height: 36 });
      const { state } = generateVictorianDistrict(world);
      const street = state.strata.STREET!;

      // 1. Factories: Boilerhouse & Artisan Workshop
      let foundBoilerSlag = false;
      let foundBoilerConveyor = false;
      let foundBoilerHalo = false;
      let foundWorkshopPipe = false;
      let foundWorkshopConveyor = false;

      for (let y = 1; y < street.height - 1; y++) {
        for (let x = 1; x < street.width - 1; x++) {
          const cell = getTileCell(street, x, y)!;
          if (cell.terrainType === 'SLAG_PIT') foundBoilerSlag = true;
          if (cell.terrainType === 'CONVEYOR_TRACK') foundBoilerConveyor = true;
          if (cell.steamPressureKpa >= 35 && (cell.smokePpm ?? 0) >= 120) foundBoilerHalo = true;
          if (cell.terrainType === 'BRASS_STEAM_PIPE' && (cell.interiorZone === 'WORKSHOP' || cell.interiorZone === 'ASSEMBLY_LINE')) {
            foundWorkshopPipe = true;
          }
          if (cell.terrainType === 'CONVEYOR_TRACK' && cell.interiorZone === 'ASSEMBLY_LINE') {
            foundWorkshopConveyor = true;
          }
        }
      }
      expect(foundBoilerSlag).toBe(true);
      expect(foundBoilerConveyor).toBe(true);
      expect(foundBoilerHalo).toBe(true);
      expect(foundWorkshopPipe).toBe(true);
      expect(foundWorkshopConveyor).toBe(true);

      // 2. Stations: Monorail Depot
      let foundRailTrack = false;
      let foundPlatform = false;
      let foundDepotBarrier = false;
      for (let y = 1; y < street.height - 1; y++) {
        for (let x = 1; x < street.width - 1; x++) {
          const cell = getTileCell(street, x, y)!;
          if (cell.terrainType === 'RAIL_TRACK' && cell.interiorZone === 'PLATFORM') foundRailTrack = true;
          if (cell.terrainType === 'BOARDING_PLATFORM' && cell.interiorZone === 'PLATFORM') foundPlatform = true;
          if (cell.terrainType === 'COUNTER_BARRIER' && cell.interiorZone === 'TICKET_BOOTH') foundDepotBarrier = true;
        }
      }
      expect(foundRailTrack).toBe(true);
      expect(foundPlatform).toBe(true);
      expect(foundDepotBarrier).toBe(true);

      const fuel1 = state.entities['vessel_depot_aether_fuel_1'];
      const fuel2 = state.entities['vessel_depot_aether_fuel_2'];
      expect(fuel1?.pressureVessel?.currentPressureKpa).toBe(120);
      expect(fuel2?.pressureVessel?.currentPressureKpa).toBe(120);
      expect(fuel1?.visual.shaderFlags).toContain('VOLUMETRIC_PLUME');

      // 3. Mercantile: Pawnshop & Apothecary
      const pawnPedestal = state.entities['furniture_pawn_pedestal'];
      const apothPedestal = state.entities['furniture_apoth_pedestal'];
      expect(pawnPedestal?.tradePedestal?.commodityId).toBe('CLOCKWORK_MAINSPRING');
      expect(apothPedestal?.tradePedestal?.commodityId).toBe('AETHER_VIAL');

      let foundCounterBarrier = false;
      for (let y = 1; y < street.height - 1; y++) {
        for (let x = 1; x < street.width - 1; x++) {
          const cell = getTileCell(street, x, y)!;
          if (cell.terrainType === 'COUNTER_BARRIER') foundCounterBarrier = true;
        }
      }
      expect(foundCounterBarrier).toBe(true);

      // 4. Rookeries & Docks
      let foundPierLoadingDock = false;
      let foundRubbleAlley = false;
      for (let y = 1; y < street.height - 1; y++) {
        for (let x = 1; x < street.width - 1; x++) {
          const cell = getTileCell(street, x, y)!;
          if (cell.terrainType === 'TIMBER_PIER' && cell.interiorZone === 'LOADING_DOCK') foundPierLoadingDock = true;
          if (cell.terrainType === 'RUBBLE_PILE') foundRubbleAlley = true;
        }
      }
      expect(foundPierLoadingDock).toBe(true);
      expect(foundRubbleAlley).toBe(true);
    }
  });

  it('serializes and dispatches folded P2 hygiene commands: REMOVE_PROSTHETIC, REST_AT_BED, SET_POSTURE, REPORT_CRIME', () => {
    const world = createInitialWorld({ seed: 2026, width: 48, height: 36 });
    const player = world.entities['actor_player']!;
    const pId = player.id;

    // 1. SET_POSTURE
    const serialized = serializePlayerContext(world);
    expect(serialized).toContain('SET_POSTURE');
    const postureCmd = parseLlmResponseToCommand('{"action": "SET_POSTURE", "posture": "CROUCHED"}', world);
    expect(postureCmd).toEqual({ type: 'SET_POSTURE', actorId: pId, posture: 'CROUCHED' });

    // 2. REST_AT_BED
    // Move player adjacent to cot
    const cotPos = world.entities['furniture_cot_a']?.position;
    if (cotPos) {
      const stateWithCot = {
        ...world,
        entities: {
          ...world.entities,
          [pId]: { ...player, position: { ...player.position!, x: cotPos.x + 1, y: cotPos.y } },
        },
      };
      const bedSerialized = serializePlayerContext(stateWithCot);
      expect(bedSerialized).toContain('REST_AT_BED');
    }
    const restCmd = parseLlmResponseToCommand('{"action": "REST_AT_BED"}', world);
    expect(restCmd).toEqual({ type: 'REST_AT_BED', actorId: pId });

    // 3. REMOVE_PROSTHETIC
    const playerRecord = world.entities[pId]!;
    const stateWithProsthetic = {
      ...world,
      entities: {
        ...world.entities,
        [pId]: {
          ...playerRecord,
          anatomy: {
            ...playerRecord.anatomy!,
            limbs: {
              ...playerRecord.anatomy!.limbs,
              LEFT_ARM: {
                ...playerRecord.anatomy!.limbs.LEFT_ARM!,
                installedProstheticEntityId: EntityIdSchema.parse('item_prosthetic_grapple'),
              },
            },
          },
        },
      },
    };
    const prosthSerialized = serializePlayerContext(stateWithProsthetic);
    expect(prosthSerialized).toContain('REMOVE_PROSTHETIC');
    const removeCmd = parseLlmResponseToCommand('{"action": "REMOVE_PROSTHETIC", "slot": "LEFT_ARM"}', world);
    expect(removeCmd).toEqual({ type: 'REMOVE_PROSTHETIC', actorId: pId, slot: 'LEFT_ARM' });

    // 4. REPORT_CRIME
    const wardenId = 'npc_clockwork_warden';
    const reportCmd = parseLlmResponseToCommand(`{"action": "REPORT_CRIME", "perpetratorId": "${wardenId}", "crime": "THEFT"}`, world);
    expect(reportCmd).toEqual({
      type: 'REPORT_CRIME',
      witnessId: pId,
      perpetratorId: EntityIdSchema.parse(wardenId),
      crime: 'THEFT',
    });
  });
});
