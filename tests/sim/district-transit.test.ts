import { describe, expect, it } from 'vitest';
import { BlueprintIdSchema, EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld, deserializeWorld, serializeWorld } from '../../src/sim/core/world.js';
import { computeVisibleTiles, pointKey } from '../../src/sim/spatial/fov.js';
import { generateVictorianDistrict } from '../../src/sim/spatial/generator.js';
import { getTileCell } from '../../src/sim/spatial/grid.js';
import { advanceThermodynamicsTick } from '../../src/sim/systems/thermo.system.js';

describe('Phase 8: Multi-Building District ProcGen, Doors & Inter-District Transit', () => {
  const playerId = EntityIdSchema.parse('actor_player');

  it('procedurally generates named buildings with closed doors and district transit gates', () => {
    const baseWorld = createInitialWorld({ seed: 42, width: 24, height: 24 });
    const { state, landmarks } = generateVictorianDistrict(baseWorld);

    const streetGrid = state.strata.STREET!;
    expect(streetGrid).toBeDefined();

    // Workshop door and Market door exist and are closed by default
    const workshopDoorCell = getTileCell(streetGrid, landmarks.workshopDoor.x, landmarks.workshopDoor.y);
    expect(workshopDoorCell).toBeDefined();
    expect(workshopDoorCell!.terrainType).toBe('WOODEN_DOOR_CLOSED');
    expect(workshopDoorCell!.blocksMovement).toBe(true);
    expect(workshopDoorCell!.blocksSight).toBe(true);

    const marketDoorCell = getTileCell(streetGrid, landmarks.marketDoor.x, landmarks.marketDoor.y);
    expect(marketDoorCell).toBeDefined();
    expect(marketDoorCell!.terrainType).toBe('WOODEN_DOOR_CLOSED');

    // West and East District Gates exist on borders
    const westGateCell = getTileCell(streetGrid, landmarks.westGate.x, landmarks.westGate.y);
    expect(westGateCell).toBeDefined();
    expect(westGateCell!.terrainType).toBe('DISTRICT_GATE');
    expect(westGateCell!.blocksMovement).toBe(false);

    const eastGateCell = getTileCell(streetGrid, landmarks.eastGate.x, landmarks.eastGate.y);
    expect(eastGateCell).toBeDefined();
    expect(eastGateCell!.terrainType).toBe('DISTRICT_GATE');

    // Gate entities exist in state.entities
    const westGate = Object.values(state.entities).find((e) => e.districtGate?.targetDistrictId === 'district_fleet_ditch_undercroft');
    expect(westGate).toBeDefined();
    expect(westGate!.districtGate!.targetDistrictId).toBe('district_fleet_ditch_undercroft');

    const eastGate = Object.values(state.entities).find((e) => e.districtGate?.targetDistrictId === 'district_belgravia_brass_spires');
    expect(eastGate).toBeDefined();
    expect(eastGate!.districtGate!.targetDistrictId).toBe('district_belgravia_brass_spires');
  });

  it('opens and closes doors, correctly updating movement, sight, and FOV occlusion', () => {
    const baseWorld = createInitialWorld({ seed: 101, width: 24, height: 24 });
    const { state: initialWorld, landmarks } = generateVictorianDistrict(baseWorld);

    // Position player just outside the workshop door (y + 1)
    const doorPos = landmarks.workshopDoor;
    let world = {
      ...initialWorld,
      entities: {
        ...initialWorld.entities,
        [playerId]: {
          ...initialWorld.entities[playerId]!,
          position: {
            ...initialWorld.entities[playerId]!.position!,
            x: doorPos.x,
            y: doorPos.y + 1,
            blocksMovement: true,
            blocksSight: false,
          },
        },
      },
    };

    const streetBefore = world.strata.STREET!;
    const interiorX = doorPos.x;
    const interiorY = doorPos.y - 1; // inside the workshop

    // 1. When door is CLOSED: FOV cannot see into interior room
    const fovClosed = computeVisibleTiles(streetBefore, doorPos.x, doorPos.y + 1, 6);
    expect(fovClosed.has(pointKey(interiorX, interiorY))).toBe(false);

    // 2. Open door via TOGGLE_DOOR command
    const openRes = dispatchCommand(world, {
      type: 'TOGGLE_DOOR',
      actorId: playerId,
      target: { x: doorPos.x, y: doorPos.y, stratum: 'STREET' },
    });
    world = openRes.state;

    const doorOpenEvent = openRes.events.find((e) => e.type === 'DOOR_TOGGLED');
    expect(doorOpenEvent).toBeDefined();
    expect(doorOpenEvent?.type === 'DOOR_TOGGLED' && doorOpenEvent.newState).toBe('OPEN');

    const streetOpen = world.strata.STREET!;
    const doorCellOpen = getTileCell(streetOpen, doorPos.x, doorPos.y);
    expect(doorCellOpen!.terrainType).toBe('WOODEN_DOOR_OPEN');
    expect(doorCellOpen!.blocksMovement).toBe(false);
    expect(doorCellOpen!.blocksSight).toBe(false);

    // FOV now penetrates into interior room!
    const fovOpen = computeVisibleTiles(streetOpen, doorPos.x, doorPos.y + 1, 6);
    expect(fovOpen.has(pointKey(interiorX, interiorY))).toBe(true);

    // 3. Close door via TOGGLE_DOOR command
    const closeRes = dispatchCommand(world, {
      type: 'TOGGLE_DOOR',
      actorId: playerId,
      target: { x: doorPos.x, y: doorPos.y, stratum: 'STREET' },
    });
    world = closeRes.state;

    const doorCloseEvent = closeRes.events.find((e) => e.type === 'DOOR_TOGGLED');
    expect(doorCloseEvent).toBeDefined();
    expect(doorCloseEvent?.type === 'DOOR_TOGGLED' && doorCloseEvent.newState).toBe('CLOSED');

    const doorCellClosedAgain = getTileCell(world.strata.STREET!, doorPos.x, doorPos.y);
    expect(doorCellClosedAgain!.terrainType).toBe('WOODEN_DOOR_CLOSED');
    expect(doorCellClosedAgain!.blocksMovement).toBe(true);
    expect(doorCellClosedAgain!.blocksSight).toBe(true);
  });

  it('prevents closing a door when a blocking entity is standing in the doorway', () => {
    const baseWorld = createInitialWorld({ seed: 202, width: 24, height: 24 });
    const { state: initialWorld, landmarks } = generateVictorianDistrict(baseWorld);
    const doorPos = landmarks.workshopDoor;

    // Open door first
    let world = {
      ...initialWorld,
      entities: {
        ...initialWorld.entities,
        [playerId]: {
          ...initialWorld.entities[playerId]!,
          position: {
            ...initialWorld.entities[playerId]!.position!,
            x: doorPos.x,
            y: doorPos.y + 1,
            blocksMovement: true,
            blocksSight: false,
          },
        },
      },
    };
    world = dispatchCommand(world, {
      type: 'TOGGLE_DOOR',
      actorId: playerId,
      target: { x: doorPos.x, y: doorPos.y, stratum: 'STREET' },
    }).state;

    // Move player into doorway
    world = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...world.entities[playerId]!,
          position: {
            ...world.entities[playerId]!.position!,
            x: doorPos.x,
            y: doorPos.y,
            blocksMovement: true,
            blocksSight: false,
          },
        },
      },
    };

    // Attempt to close door while standing in it
    const closeAttempt = dispatchCommand(world, {
      type: 'TOGGLE_DOOR',
      actorId: playerId,
      target: { x: doorPos.x, y: doorPos.y, stratum: 'STREET' },
    });

    const failed = closeAttempt.events.find((e) => e.type === 'TRANSIT_ACTION_FAILED');
    expect(failed).toBeDefined();
    expect(failed?.type === 'TRANSIT_ACTION_FAILED' && failed.reason).toBe('BLOCKED_BY_ENTITY');
  });

  it('verifies that closed doors block steam diffusion while open doors allow diffusion', () => {
    const baseWorld = createInitialWorld({ seed: 303, width: 24, height: 24 });
    const { state: initialWorld, landmarks } = generateVictorianDistrict(baseWorld);
    const doorPos = landmarks.workshopDoor;
    const insidePos = { x: doorPos.x, y: doorPos.y - 1, stratum: 'STREET' as const };
    const outsidePos = { x: doorPos.x, y: doorPos.y + 1, stratum: 'STREET' as const };

    // Inject 100 kPa steam outside the closed door
    let world = dispatchCommand(initialWorld, {
      type: 'VENT_STEAM',
      actorId: playerId,
      target: outsidePos,
      pressureReleasedKpa: 100,
    }).state;

    // Tick thermodynamics for 3 turns with closed door
    for (let t = 0; t < 3; t++) {
      world = advanceThermodynamicsTick(world).state;
    }
    const insideCellClosed = getTileCell(world.strata.STREET!, insidePos.x, insidePos.y);
    expect(insideCellClosed!.steamPressureKpa).toBe(0);

    // Open door and place steam again outside
    world = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...world.entities[playerId]!,
          position: {
            ...world.entities[playerId]!.position!,
            x: doorPos.x,
            y: doorPos.y + 1,
            blocksMovement: true,
            blocksSight: false,
          },
        },
      },
    };

    world = dispatchCommand(world, {
      type: 'TOGGLE_DOOR',
      actorId: playerId,
      target: { x: doorPos.x, y: doorPos.y, stratum: 'STREET' },
    }).state;

    world = dispatchCommand(world, {
      type: 'VENT_STEAM',
      actorId: playerId,
      target: outsidePos,
      pressureReleasedKpa: 100,
    }).state;

    // Tick thermodynamics across open door
    for (let t = 0; t < 5; t++) {
      world = advanceThermodynamicsTick(world).state;
    }
    const insideCellOpen = getTileCell(world.strata.STREET!, insidePos.x, insidePos.y);
    expect(insideCellOpen!.steamPressureKpa).toBeGreaterThan(0);
  });

  it('deterministically transitions between Spitalfields and Fleet Ditch Undercroft via District Gates', () => {
    const baseWorld = createInitialWorld({ seed: 404, width: 24, height: 24 });
    const { state: initialWorld, landmarks } = generateVictorianDistrict(baseWorld);

    // Place player adjacent to West Gate (leads to district_fleet_ditch_undercroft)
    const westGate = landmarks.westGate;
    let world = {
      ...initialWorld,
      entities: {
        ...initialWorld.entities,
        [playerId]: {
          ...initialWorld.entities[playerId]!,
          position: {
            ...initialWorld.entities[playerId]!.position!,
            x: westGate.x + 1,
            y: westGate.y,
            blocksMovement: true,
            blocksSight: false,
          },
        },
      },
    };

    expect(world.currentDistrictId).toBe('district_spitalfields_soot_works');

    // Travel to Fleet Ditch Undercroft
    const travelRes = dispatchCommand(world, {
      type: 'TRAVEL_DISTRICT',
      actorId: playerId,
      targetDistrictId: BlueprintIdSchema.parse('district_fleet_ditch_undercroft'),
    });
    world = travelRes.state;

    const traveledEvent = travelRes.events.find((e) => e.type === 'DISTRICT_TRAVELED');
    expect(traveledEvent).toBeDefined();
    expect(traveledEvent?.type === 'DISTRICT_TRAVELED' && traveledEvent.toDistrictId).toBe(
      'district_fleet_ditch_undercroft',
    );
    expect(world.currentDistrictId).toBe('district_fleet_ditch_undercroft');

    // Player actor and carried items are preserved
    expect(world.entities[playerId]).toBeDefined();
    expect(world.entities[playerId]!.anatomy).toBeDefined();
    expect(world.entities[playerId]!.inventory?.containedEntityIds.length).toBeGreaterThanOrEqual(2);

    // Save/load serialization retains target district
    const serialized = serializeWorld(world);
    const restored = deserializeWorld(serialized);
    expect(restored.currentDistrictId).toBe('district_fleet_ditch_undercroft');
  });
});
