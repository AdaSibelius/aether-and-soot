import { describe, expect, it } from 'vitest';
import { BlueprintIdSchema, EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld, deserializeWorld, serializeWorld } from '../../src/sim/core/world.js';
import { generateVictorianDistrict } from '../../src/sim/spatial/generator.js';
import { getTileCell, setTileCell } from '../../src/sim/spatial/grid.js';
import { projectWorldToVisualFrame } from '../../src/client/projection/frame-adapter.js';

describe('Phase 18: Large Scrolling Districts, Camera Viewport, Fog-of-War & Cache', () => {
  const playerId = EntityIdSchema.parse('actor_player');

  it('initializes default district to 48x36 and marks initial player FOV as explored', () => {
    const world = createInitialWorld({ seed: 777 });
    const street = world.strata.STREET!;
    expect(street).toBeDefined();
    expect(street.width).toBe(48);
    expect(street.height).toBe(36);

    const playerPos = world.entities[playerId]?.position;
    expect(playerPos).toBeDefined();
    expect(playerPos?.x).toBe(24);
    expect(playerPos?.y).toBe(18);

    const playerCell = getTileCell(street, playerPos!.x, playerPos!.y);
    expect(playerCell?.explored).toBe(true);

    const distantCell = getTileCell(street, 0, 0);
    expect(distantCell?.explored).toBe(false);
  });

  it('clamps camera viewport around player position on a 48x36 grid', () => {
    let world = createInitialWorld({ seed: 888 });

    const centerFrame = projectWorldToVisualFrame(world, playerId);
    expect(centerFrame.width).toBe(24);
    expect(centerFrame.height).toBe(20);
    expect(centerFrame.cameraOrigin.x).toBe(12);
    expect(centerFrame.cameraOrigin.y).toBe(8);
    expect(centerFrame.cells.length).toBe(24 * 20);

    world = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...world.entities[playerId]!,
          position: { ...world.entities[playerId]!.position!, x: 2, y: 2 },
        },
      },
    };
    const topLeftFrame = projectWorldToVisualFrame(world, playerId);
    expect(topLeftFrame.cameraOrigin.x).toBe(0);
    expect(topLeftFrame.cameraOrigin.y).toBe(0);

    world = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...world.entities[playerId]!,
          position: { ...world.entities[playerId]!.position!, x: 46, y: 34 },
        },
      },
    };
    const bottomRightFrame = projectWorldToVisualFrame(world, playerId);
    expect(bottomRightFrame.cameraOrigin.x).toBe(24);
    expect(bottomRightFrame.cameraOrigin.y).toBe(16);
  });

  it('renders unexplored tiles as void and explored out-of-FOV tiles as dimmed terrain with actors hidden', () => {
    let world = createInitialWorld({ seed: 999 });

    const npcId = EntityIdSchema.parse('npc_lurker');
    world = {
      ...world,
      entities: {
        ...world.entities,
        [npcId]: {
          id: npcId,
          name: 'Shadow Lurker',
          visual: { glyph: 'L', fgPrimary: '#ff0000', fgSecondary: '#880000', bgColor: '#000000', shaderFlags: [] },
          position: { x: 0, y: 0, stratum: 'STREET', blocksMovement: true, blocksSight: false },
          actor: { energy: 100, speed: 100, isPlayer: false },
        },
        [playerId]: {
          ...world.entities[playerId]!,
          position: { ...world.entities[playerId]!.position!, x: 0, y: 0 },
        },
      },
    };

    const frame = projectWorldToVisualFrame(world, playerId, 3);
    const cell00 = frame.cells[0];
    expect(cell00).toBeDefined();
    expect(cell00?.visible).toBe(true);
    expect(cell00?.explored).toBe(true);

    const farCell = frame.cells[23]; // (23, 0)
    expect(farCell).toBeDefined();
    expect(farCell?.visible).toBe(false);
    expect(farCell?.explored).toBe(false);
    expect(farCell?.visual.glyph).toBe(' ');

    const street = world.strata.STREET!;
    const testTile = getTileCell(street, 10, 10);
    if (testTile) {
      world = {
        ...world,
        strata: {
          ...world.strata,
          STREET: setTileCell(street, 10, 10, () => ({ explored: true, terrainType: 'SOOT_BRICK_WALL' })),
        },
      };
    }

    const frameWithExplored = projectWorldToVisualFrame(world, playerId, 3);
    const exploredOutOfFovCell = frameWithExplored.cells[10 * 24 + 10];
    expect(exploredOutOfFovCell?.explored).toBe(true);
    expect(exploredOutOfFovCell?.visible).toBe(false);
    expect(exploredOutOfFovCell?.visual.glyph).toBe('#');
    expect(exploredOutOfFovCell?.visual.fgPrimary).toBe('#34495E');
  });

  it('preserves explored tiles across turns as player moves and updates FOV', () => {
    let world = createInitialWorld({ seed: 1234 });
    const pPos = world.entities[playerId]!.position!;

    const res1 = dispatchCommand(world, {
      type: 'MOVE_STEP',
      actorId: playerId,
      dx: 1,
      dy: 0,
    });
    world = res1.state;
    const newPos = world.entities[playerId]!.position!;
    expect(newPos.x).toBe(pPos.x + 1);

    const street = world.strata.STREET!;
    const cell = getTileCell(street, newPos.x, newPos.y);
    expect(cell?.explored).toBe(true);
  });

  it('snapshots departing district state and restores previously visited district on return', () => {
    const baseWorld = createInitialWorld({ seed: 42, width: 24, height: 24 });
    const { state: initialWorld, landmarks } = generateVictorianDistrict(baseWorld);

    const gatePos = landmarks.eastGate;
    let world = {
      ...initialWorld,
      entities: {
        ...initialWorld.entities,
        [playerId]: {
          ...initialWorld.entities[playerId]!,
          position: { ...initialWorld.entities[playerId]!.position!, x: gatePos.x - 1, y: gatePos.y },
        },
      },
    };

    const spitalfieldsStreet = world.strata.STREET!;
    const modCell = getTileCell(spitalfieldsStreet, 5, 5);
    expect(modCell).toBeDefined();
    world = {
      ...world,
      strata: {
        ...world.strata,
        STREET: setTileCell(spitalfieldsStreet, 5, 5, () => ({ explored: true, terrainType: 'BRASS_CATWALK' })),
      },
    };

    const travelToBelgravia = dispatchCommand(world, {
      type: 'TRAVEL_DISTRICT',
      actorId: playerId,
      targetDistrictId: BlueprintIdSchema.parse('district_belgravia_brass_spires'),
    });
    world = travelToBelgravia.state;
    expect(world.currentDistrictId).toBe('district_belgravia_brass_spires');

    expect(world.savedDistricts['district_spitalfields_soot_works']).toBeDefined();
    const cachedSpitalfields = world.savedDistricts['district_spitalfields_soot_works']!;
    const cachedCell = getTileCell(cachedSpitalfields.strata.STREET, 5, 5);
    expect(cachedCell?.terrainType).toBe('BRASS_CATWALK');
    expect(cachedCell?.explored).toBe(true);

    const returnGate = Object.values(world.entities).find(
      (e) => e.districtGate?.targetDistrictId === 'district_spitalfields_soot_works' && e.position,
    );
    expect(returnGate).toBeDefined();
    const returnGatePos = returnGate!.position!;

    world = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...world.entities[playerId]!,
          position: { ...world.entities[playerId]!.position!, x: returnGatePos.x + 1, y: returnGatePos.y },
        },
      },
    };

    const travelBack = dispatchCommand(world, {
      type: 'TRAVEL_DISTRICT',
      actorId: playerId,
      targetDistrictId: BlueprintIdSchema.parse('district_spitalfields_soot_works'),
    });
    world = travelBack.state;
    expect(world.currentDistrictId).toBe('district_spitalfields_soot_works');

    const restoredCell = getTileCell(world.strata.STREET!, 5, 5);
    expect(restoredCell?.terrainType).toBe('BRASS_CATWALK');
    expect(restoredCell?.explored).toBe(true);

    const json = serializeWorld(world);
    const roundTripped = deserializeWorld(json);
    expect(roundTripped.savedDistricts['district_belgravia_brass_spires']).toBeDefined();
    expect(roundTripped.currentDistrictId).toBe('district_spitalfields_soot_works');
  });
});
