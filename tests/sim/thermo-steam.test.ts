import { describe, expect, it } from 'vitest';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { getTileCell, setTileCell } from '../../src/sim/spatial/grid.js';

describe('Phase 4: Thermodynamics, Cellular Automata Gases & Boiler Pressure Hazards', () => {
  const playerId = EntityIdSchema.parse('actor_player');

  it('diffuses vented steam across open neighbors while blocking diffusion through solid brick walls', () => {
    let world = createInitialWorld({ seed: 4040, width: 12, height: 12 });

    // Place a solid wall at (6, 5) on STREET
    const street = world.strata.STREET!;
    world = {
      ...world,
      strata: {
        ...world.strata,
        STREET: setTileCell(street, 6, 5, () => ({
          terrainType: 'SOOT_BRICK_WALL',
          blocksMovement: true,
          blocksSight: true,
          steamPressureKpa: 0,
          coalDustDensity: 0,
        })),
      },
    };

    // Vent 100 kPa steam at (5, 5)
    const ventRes = dispatchCommand(world, {
      type: 'VENT_STEAM',
      actorId: playerId,
      target: { x: 5, y: 5, stratum: 'STREET' },
      pressureReleasedKpa: 100,
    });
    world = ventRes.state;

    const updatedStreet = world.strata.STREET!;
    const centerCell = getTileCell(updatedStreet, 5, 5)!;
    const openNeighborWest = getTileCell(updatedStreet, 4, 5)!;
    const solidNeighborEast = getTileCell(updatedStreet, 6, 5)!;

    expect(centerCell.steamPressureKpa).toBeGreaterThan(0);
    expect(openNeighborWest.steamPressureKpa).toBeGreaterThan(10);
    expect(solidNeighborEast.steamPressureKpa).toBe(0);
  });

  it('vents rising steam upward from UNDERCROFT to STREET through gas-conducting portals', () => {
    let world = createInitialWorld({ seed: 4041, width: 16, height: 16 });
    const centerX = 8;
    const centerY = 8;

    // Vent 120 kPa steam at the Undercroft ladder portal (8, 8)
    const ventRes = dispatchCommand(world, {
      type: 'VENT_STEAM',
      actorId: playerId,
      target: { x: centerX, y: centerY, stratum: 'UNDERCROFT' },
      pressureReleasedKpa: 120,
    });
    world = ventRes.state;

    const streetPortalCell = getTileCell(world.strata.STREET!, centerX, centerY)!;
    expect(streetPortalCell.steamPressureKpa).toBeGreaterThan(15);
  });

  it('ruptures an overpressurized boiler vessel, floods adjacent tiles with steam, and scalds nearby actors', () => {
    let world = createInitialWorld({ seed: 4042, width: 16, height: 16 });
    const boilerId = EntityIdSchema.parse('vessel_foundry_boiler_01');
    const playerPos = world.entities[playerId]!.position!;

    // Place a boiler right next to the player
    world = {
      ...world,
      entities: {
        ...world.entities,
        [boilerId]: {
          id: boilerId,
          name: 'High-Pressure Foundry Boiler',
          visual: {
            glyph: '0',
            fgPrimary: '#CD7F32',
            fgSecondary: '#E74C3C',
            bgColor: '#0A0D0E',
            shaderFlags: ['PULSE_STEAM'],
          },
          position: {
            x: playerPos.x + 1,
            y: playerPos.y,
            stratum: 'STREET',
            blocksMovement: true,
            blocksSight: false,
          },
          pressureVessel: {
            currentPressureKpa: 280,
            maxPressureKpa: 300,
            ruptured: false,
          },
        },
      },
    };

    // Add 120 kPa -> 400 kPa exceeds maxPressureKpa (300) -> Ruptures!
    const ruptureRes = dispatchCommand(world, {
      type: 'PRESSURIZE_VESSEL',
      actorId: playerId,
      vesselEntityId: boilerId,
      pressureAddedKpa: 120,
    });
    world = ruptureRes.state;

    expect(ruptureRes.events).toContainEqual(
      expect.objectContaining({
        type: 'VESSEL_RUPTURED',
        vesselEntityId: boilerId,
        releasedPressureKpa: 400,
      }),
    );

    expect(ruptureRes.events).toContainEqual(
      expect.objectContaining({
        type: 'THERMAL_SCALD',
        targetId: playerId,
        slot: 'TORSO',
      }),
    );
    expect(world.entities[playerId]!.anatomy!.limbs.TORSO!.hp).toBeLessThan(40);
  });

  it('ignites a contiguous cloud of suspended coal dust when a spark is emitted', () => {
    let world = createInitialWorld({ seed: 4043, width: 14, height: 14 });
    let street = world.strata.STREET!;

    const dustTiles = [
      { x: 4, y: 4 },
      { x: 5, y: 4 },
      { x: 6, y: 4 },
    ];
    for (const pt of dustTiles) {
      street = setTileCell(street, pt.x, pt.y, (c) => ({
        ...c,
        coalDustDensity: 0.75,
      }));
    }
    world = {
      ...world,
      strata: { ...world.strata, STREET: street },
    };

    const sparkRes = dispatchCommand(world, {
      type: 'EMIT_SPARK',
      actorId: playerId,
      target: { x: 4, y: 4, stratum: 'STREET' },
    });
    world = sparkRes.state;

    expect(sparkRes.events).toContainEqual(
      expect.objectContaining({
        type: 'COAL_DUST_IGNITED',
        ignitedTileCount: 3,
      }),
    );

    for (const pt of dustTiles) {
      const cell = getTileCell(world.strata.STREET!, pt.x, pt.y)!;
      expect(cell.coalDustDensity).toBe(0);
      expect(cell.steamPressureKpa).toBeGreaterThan(20);
    }
  });
});
