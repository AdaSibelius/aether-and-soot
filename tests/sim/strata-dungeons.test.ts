import { describe, expect, it } from 'vitest';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { generateVictorianDistrict, hasWalkablePath } from '../../src/sim/spatial/generator.js';

describe('Phase 27: Undercroft Sewer Dungeons & Spire Catwalk Networks', () => {
  it('generates multi-room Undercroft sewer dungeon with >= 250 walkable tiles and unbroken connectivity', () => {
    const world = createInitialWorld({ seed: 301, width: 48, height: 36 });
    const { state, landmarks } = generateVictorianDistrict(world);

    const undercroft = state.strata.UNDERCROFT;
    expect(undercroft).toBeDefined();
    expect(undercroft!.width).toBe(48);
    expect(undercroft!.height).toBe(36);

    const walkableCells = undercroft!.cells.filter((c) => !c.blocksMovement);
    expect(walkableCells.length).toBeGreaterThanOrEqual(250);

    // Verify entry ladder position is walkable
    const entry = landmarks.undercroftLadder;
    expect(hasWalkablePath(undercroft!, entry, entry)).toBe(true);

    // Verify connectivity from entry portal to all quadrants
    const northWest = { x: 10, y: 7 };
    const northEast = { x: 37, y: 7 };
    const southWest = { x: 10, y: 28 };
    const southEast = { x: 37, y: 28 };

    expect(hasWalkablePath(undercroft!, entry, northWest)).toBe(true);
    expect(hasWalkablePath(undercroft!, entry, northEast)).toBe(true);
    expect(hasWalkablePath(undercroft!, entry, southWest)).toBe(true);
    expect(hasWalkablePath(undercroft!, entry, southEast)).toBe(true);
  });

  it('generates Spire rooftop catwalk network with >= 250 walkable tiles and sky-bridge connectivity', () => {
    const world = createInitialWorld({ seed: 302, width: 48, height: 36 });
    const { state, landmarks } = generateVictorianDistrict(world);

    const spire = state.strata.SPIRE;
    expect(spire).toBeDefined();
    expect(spire!.width).toBe(48);
    expect(spire!.height).toBe(36);

    const walkableCells = spire!.cells.filter((c) => !c.blocksMovement);
    expect(walkableCells.length).toBeGreaterThanOrEqual(250);

    const lift = landmarks.spireLift;
    expect(hasWalkablePath(spire!, lift, lift)).toBe(true);

    // Verify connectivity from lift landing to all tower platforms
    const towerNorth = { x: 10, y: 7 };
    const towerSouth = { x: 10, y: 28 };
    const towerEast = { x: 37, y: 28 };

    expect(hasWalkablePath(spire!, lift, towerNorth)).toBe(true);
    expect(hasWalkablePath(spire!, lift, towerSouth)).toBe(true);
    expect(hasWalkablePath(spire!, lift, towerEast)).toBe(true);
  });

  it('spawns stratum-specific NPCs, smuggling vaults, and high-tier fixtures in Undercroft', () => {
    const world = createInitialWorld({ seed: 303, width: 48, height: 36 });
    const { state } = generateVictorianDistrict(world);

    const undercroftEntities = Object.values(state.entities).filter(
      (e) => e.position?.stratum === 'UNDERCROFT',
    );

    // Check for Syndicate Fixer
    const fixer = undercroftEntities.find((e) => e.aiController?.role === 'FIXER');
    expect(fixer).toBeDefined();
    expect(fixer!.aiController!.factionId).toBe('UNDERCROFT_SYNDICATE');

    // Check for Feral sewer lurker hostile
    const lurker = undercroftEntities.find((e) => e.aiController?.hostile === true);
    expect(lurker).toBeDefined();

    // Check for Smuggler gear crate with inventory
    const crate = undercroftEntities.find((e) => e.furniture?.kind === 'CRATE');
    expect(crate).toBeDefined();
    expect(crate!.inventory?.containedEntityIds.length).toBeGreaterThan(0);
  });

  it('spawns sentry guards, artificers, armoury lockers, and crane vessels in Spire', () => {
    const world = createInitialWorld({ seed: 304, width: 48, height: 36 });
    const { state } = generateVictorianDistrict(world);

    const spireEntities = Object.values(state.entities).filter(
      (e) => e.position?.stratum === 'SPIRE',
    );

    // Check for Clockwork Artificer
    const artificer = spireEntities.find((e) => e.aiController?.role === 'MERCHANT');
    expect(artificer).toBeDefined();
    expect(artificer!.aiController!.factionId).toBe('CLOCKWORK_GUILD');

    // Check for Sentry Guard
    const guard = spireEntities.find((e) => e.aiController?.role === 'GUARD');
    expect(guard).toBeDefined();

    // Check for Spire Armoury Locker
    const locker = spireEntities.find((e) => e.furniture?.kind === 'LOCKER');
    expect(locker).toBeDefined();

    // Check for Observatory Library Bookshelf
    const shelf = spireEntities.find((e) => e.furniture?.kind === 'BOOKSHELF');
    expect(shelf).toBeDefined();

    // Check for Spire Crane Pressure Vessel
    const vessel = spireEntities.find((e) => e.pressureVessel !== undefined);
    expect(vessel).toBeDefined();
    expect(vessel!.pressureVessel!.currentPressureKpa).toBeGreaterThan(0);
  });

  it('allows seamless player vertical traversal between Street, Undercroft, and Spire', () => {
    let world = createInitialWorld({ seed: 305, width: 48, height: 36 });
    const { state: initialWorld, landmarks } = generateVictorianDistrict(world);
    const playerId = EntityIdSchema.parse('actor_player');

    // 1. Descend to Undercroft via central manhole
    world = {
      ...initialWorld,
      entities: {
        ...initialWorld.entities,
        [playerId]: {
          ...initialWorld.entities[playerId]!,
          position: { ...landmarks.streetManhole, stratum: 'STREET', blocksMovement: true, blocksSight: false },
        },
      },
    };

    const descendRes = dispatchCommand(world, { type: 'USE_PORTAL', actorId: playerId });
    world = descendRes.state;
    expect(world.entities[playerId]!.position!.stratum).toBe('UNDERCROFT');

    // 2. Climb back to Street via rusted ladder
    const ascendRes = dispatchCommand(world, { type: 'USE_PORTAL', actorId: playerId });
    world = ascendRes.state;
    expect(world.entities[playerId]!.position!.stratum).toBe('STREET');

    // 3. Move to Pneumatic Lift and ascend to Spire
    world = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...world.entities[playerId]!,
          position: { ...landmarks.streetLift, stratum: 'STREET', blocksMovement: true, blocksSight: false },
        },
      },
    };

    const liftUpRes = dispatchCommand(world, { type: 'USE_PORTAL', actorId: playerId });
    world = liftUpRes.state;
    expect(world.entities[playerId]!.position!.stratum).toBe('SPIRE');

    // 4. Descend back to Street via Spire lift
    const liftDownRes = dispatchCommand(world, { type: 'USE_PORTAL', actorId: playerId });
    world = liftDownRes.state;
    expect(world.entities[playerId]!.position!.stratum).toBe('STREET');
  });
});
