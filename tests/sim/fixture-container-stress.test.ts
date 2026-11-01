import { describe, expect, it } from 'vitest';
import { EntityIdSchema, StratumId } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld, WorldState } from '../../src/sim/core/world.js';
import { createStratumGrid, findBlockingEntityAtPoint } from '../../src/sim/spatial/grid.js';
import { computeVisibleTiles } from '../../src/sim/spatial/fov.js';
import {
  buildFixtureEntityId,
  createVictorianFixture,
  createArtificerBenchFixture,
  createCoalStoveFixture,
  createFilingCabinetFixture,
  createGasLampFixture,
  createIronBoilerFixture,
  createPneumaticDispatchFixture,
  createRollTopDeskFixture,
  createValveManifoldFixture,
  VictorianFixtureKind,
} from '../../src/sim/spatial/fixture-catalog.js';
import { resolveLootContainer } from '../../src/sim/systems/container.system.js';

describe('Milestone 1 Fixtures & Containers Adversarial Stress Suite', () => {
  const ALL_8_KINDS: readonly VictorianFixtureKind[] = [
    'ARTIFICER_BENCH',
    'COAL_STOVE',
    'IRON_BOILER',
    'ROLL_TOP_DESK',
    'GAS_LAMP',
    'PNEUMATIC_DISPATCH',
    'FILING_CABINET',
    'VALVE_MANIFOLD',
  ];

  const ALL_STRATA: readonly StratumId[] = ['STREET', 'UNDERCROFT', 'SPIRE', 'CATACOMBS'];

  it('spawns 2,048 fixtures across 64 coordinates and 4 strata with 0 ID collisions', () => {
    const spawnedEntities: Record<string, any> = {};
    const seenIds = new Set<string>();

    // Generate 64 distinct coordinates including edge cases (zero, boundary, negative)
    const coordinates: Array<{ x: number; y: number }> = [];
    for (let x = -4; x <= 3; x++) {
      for (let y = -4; y <= 3; y++) {
        coordinates.push({ x, y });
      }
    }
    expect(coordinates.length).toBe(64);

    for (const stratum of ALL_STRATA) {
      for (const kind of ALL_8_KINDS) {
        for (const { x, y } of coordinates) {
          const expectedId = buildFixtureEntityId(kind, x, y, stratum);
          const fixture = createVictorianFixture(kind, { x, y, stratum }, spawnedEntities);
          expect(fixture.id).toBe(expectedId);
          expect(EntityIdSchema.safeParse(fixture.id).success).toBe(true);
          expect(seenIds.has(fixture.id)).toBe(false);

          seenIds.add(fixture.id);
          spawnedEntities[fixture.id] = fixture;

          expect(fixture.position).toBeDefined();
          expect(fixture.position?.x).toBe(x);
          expect(fixture.position?.y).toBe(y);
          expect(fixture.position?.stratum).toBe(stratum);
          expect(fixture.furniture?.kind).toBe(kind);
          expect(Number.isNaN(fixture.position?.x)).toBe(false);
          expect(Number.isNaN(fixture.position?.y)).toBe(false);
        }
      }
    }

    // 8 kinds * 4 strata * 64 coordinates = 2,048 unique fixtures
    expect(seenIds.size).toBe(2048);
    expect(Object.keys(spawnedEntities).length).toBeGreaterThanOrEqual(2048);

    // Verify child items in containers also have strictly unique, schema-valid IDs
    const childItemEntities = Object.values(spawnedEntities).filter((e) => e.item !== undefined);
    const childItemIds = new Set(childItemEntities.map((e) => e.id));
    expect(childItemIds.size).toBe(childItemEntities.length);
    for (const cid of childItemIds) {
      expect(seenIds.has(cid)).toBe(false); // No collision with parent fixtures
    }
  });

  it('enforces line-of-sight and collision invariants across all 8 fixture types', () => {
    const grid = createStratumGrid('STREET', 20, 20);
    const dummyEntities: Record<string, any> = {};

    const bench = createArtificerBenchFixture({ x: 5, y: 5, stratum: 'STREET' });
    const lamp = createGasLampFixture({ x: 6, y: 5, stratum: 'STREET' });
    const boiler = createIronBoilerFixture({ x: 7, y: 5, stratum: 'STREET' });
    const stove = createCoalStoveFixture({ x: 8, y: 5, stratum: 'STREET' }, dummyEntities);
    const desk = createRollTopDeskFixture({ x: 9, y: 5, stratum: 'STREET' }, dummyEntities);
    const dispatch = createPneumaticDispatchFixture({ x: 10, y: 5, stratum: 'STREET' }, dummyEntities);
    const cabinet = createFilingCabinetFixture({ x: 11, y: 5, stratum: 'STREET' }, dummyEntities);
    const manifold = createValveManifoldFixture({ x: 12, y: 5, stratum: 'STREET' });

    // 1. Artificer Bench & Gas Lamp allow movement and sight
    expect(bench.position?.blocksMovement).toBe(false);
    expect(bench.position?.blocksSight).toBe(false);
    expect(lamp.position?.blocksMovement).toBe(false);
    expect(lamp.position?.blocksSight).toBe(false);

    // 2. Iron Boiler blocks BOTH movement and sight
    expect(boiler.position?.blocksMovement).toBe(true);
    expect(boiler.position?.blocksSight).toBe(true);

    // 3. Other 5 fixtures block movement but allow sight
    for (const fixture of [stove, desk, dispatch, cabinet, manifold]) {
      expect(fixture.position?.blocksMovement).toBe(true);
      expect(fixture.position?.blocksSight).toBe(false);
    }

    // 4. Test spatial movement blocking via findBlockingEntityAtPoint
    const worldEntities: Record<string, any> = {
      [bench.id]: bench,
      [lamp.id]: lamp,
      [boiler.id]: boiler,
      [stove.id]: stove,
      [desk.id]: desk,
      [dispatch.id]: dispatch,
      [cabinet.id]: cabinet,
      [manifold.id]: manifold,
    };

    expect(findBlockingEntityAtPoint(worldEntities, { x: 5, y: 5, stratum: 'STREET' })).toBeUndefined();
    expect(findBlockingEntityAtPoint(worldEntities, { x: 6, y: 5, stratum: 'STREET' })).toBeUndefined();
    expect(findBlockingEntityAtPoint(worldEntities, { x: 7, y: 5, stratum: 'STREET' })?.id).toBe(boiler.id);
    expect(findBlockingEntityAtPoint(worldEntities, { x: 8, y: 5, stratum: 'STREET' })?.id).toBe(stove.id);
    expect(findBlockingEntityAtPoint(worldEntities, { x: 9, y: 5, stratum: 'STREET' })?.id).toBe(desk.id);

    // 5. Test FOV shadowcasting through iron boiler tile
    const boilerGrid = {
      ...grid,
      cells: grid.cells.map((cell, idx) => {
        const x = idx % grid.width, y = Math.floor(idx / grid.width);
        return x === 7 && y === 5 ? { ...cell, blocksSight: true } : cell;
      }),
    };
    const fovWithBoiler = computeVisibleTiles(boilerGrid, 5, 5, 5);
    expect(fovWithBoiler.has('7,5')).toBe(true); // Boiler itself is visible
    expect(fovWithBoiler.has('8,5')).toBe(false); // Tile behind boiler is occluded
    expect(fovWithBoiler.has('9,5')).toBe(false);

    // Without sight block, tiles behind are visible
    const clearGrid = {
      ...grid,
      cells: grid.cells.map((cell, idx) => {
        const x = idx % grid.width, y = Math.floor(idx / grid.width);
        return x === 7 && y === 5 ? { ...cell, blocksSight: false } : cell;
      }),
    };
    const fovClear = computeVisibleTiles(clearGrid, 5, 5, 5);
    expect(fovClear.has('7,5')).toBe(true);
    expect(fovClear.has('8,5')).toBe(true);
    expect(fovClear.has('9,5')).toBe(true);
  });

  it('stress tests container looting, depletion, repeated looting, and boundary failures', () => {
    const world = createInitialWorld({ seed: 777 });
    const playerId = EntityIdSchema.parse('actor_player');
    const player = world.entities[playerId]!;
    player.position = { x: 10, y: 10, stratum: 'STREET', blocksMovement: true, blocksSight: false };

    const entities: Record<string, any> = { ...world.entities };
    const desk = createRollTopDeskFixture({ x: 11, y: 10, stratum: 'STREET' }, entities);
    const stove = createCoalStoveFixture({ x: 10, y: 11, stratum: 'STREET' }, entities);
    const boiler = createIronBoilerFixture({ x: 9, y: 10, stratum: 'STREET' });
    const distantCabinet = createFilingCabinetFixture({ x: 14, y: 14, stratum: 'STREET' }, entities);
    const undercroftStove = createCoalStoveFixture({ x: 10, y: 10, stratum: 'UNDERCROFT' }, entities);

    entities[desk.id] = desk;
    entities[stove.id] = stove;
    entities[boiler.id] = boiler;
    entities[distantCabinet.id] = distantCabinet;
    entities[undercroftStove.id] = undercroftStove;

    let currentState: WorldState = { ...world, entities };
    const initTreasury = currentState.economy.playerTreasuryPence;

    // 1. Loot currency container (Roll-top desk with crown pence pouch)
    const lootDesk = resolveLootContainer(currentState, playerId, desk.id);
    expect(lootDesk.apSpent).toBeGreaterThan(0);
    expect(lootDesk.events.some((e) => e.type === 'CONTAINER_LOOTED')).toBe(true);
    currentState = lootDesk.state;
    expect(currentState.economy.playerTreasuryPence).toBe(initTreasury + 18);
    expect(Number.isNaN(currentState.economy.playerTreasuryPence)).toBe(false);

    // 2. Repeatedly loot depleted roll-top desk 25 times -> 0 crashes, 0 NaNs, CONTAINER_EMPTY
    for (let i = 0; i < 25; i++) {
      const repeatLoot = resolveLootContainer(currentState, playerId, desk.id);
      expect(repeatLoot.apSpent).toBe(0);
      expect(repeatLoot.events[0]?.type).toBe('FURNITURE_ACTION_FAILED');
      expect((repeatLoot.events[0] as any).reason).toBe('CONTAINER_EMPTY');
      expect(repeatLoot.state.economy.playerTreasuryPence).toBe(initTreasury + 18);
    }

    // 3. Loot coal stove -> transfers commodity into player inventory
    const preLootCount = currentState.entities[playerId]!.inventory!.containedEntityIds.length;
    const lootStove = resolveLootContainer(currentState, playerId, stove.id);
    expect(lootStove.apSpent).toBeGreaterThan(0);
    currentState = lootStove.state;
    expect(currentState.entities[playerId]!.inventory!.containedEntityIds.length).toBe(preLootCount + 1);

    // Repeated looting of stove returns CONTAINER_EMPTY
    const repeatStove = resolveLootContainer(currentState, playerId, stove.id);
    expect(repeatStove.apSpent).toBe(0);
    expect((repeatStove.events[0] as any).reason).toBe('CONTAINER_EMPTY');

    // 4. Out-of-range looting (distance > 1) -> fails gracefully with OUT_OF_RANGE
    const lootDistant = resolveLootContainer(currentState, playerId, distantCabinet.id);
    expect(lootDistant.apSpent).toBe(0);
    expect((lootDistant.events[0] as any).reason).toBe('OUT_OF_RANGE');

    // 5. Cross-stratum looting (same x,y but different stratum) -> OUT_OF_RANGE
    const lootCrossStratum = resolveLootContainer(currentState, playerId, undercroftStove.id);
    expect(lootCrossStratum.apSpent).toBe(0);
    expect((lootCrossStratum.events[0] as any).reason).toBe('OUT_OF_RANGE');

    // 6. Non-container furniture looting (Iron Boiler) -> NOT_A_CONTAINER
    const lootBoiler = resolveLootContainer(currentState, playerId, boiler.id);
    expect(lootBoiler.apSpent).toBe(0);
    expect((lootBoiler.events[0] as any).reason).toBe('NOT_A_CONTAINER');

    // 7. Non-existent container ID -> OUT_OF_RANGE
    const lootPhantom = resolveLootContainer(currentState, playerId, EntityIdSchema.parse('phantom_box'));
    expect(lootPhantom.apSpent).toBe(0);
    expect((lootPhantom.events[0] as any).reason).toBe('OUT_OF_RANGE');

    // 8. Actor inventory mass overload
    const overloadedPlayerState: WorldState = {
      ...currentState,
      entities: {
        ...currentState.entities,
        [playerId]: {
          ...currentState.entities[playerId]!,
          inventory: {
            ...currentState.entities[playerId]!.inventory!,
            currentMassGrams: 99999999,
          },
        },
      },
    };
    const newCabinet = createFilingCabinetFixture({ x: 10, y: 9, stratum: 'STREET' }, overloadedPlayerState.entities);
    overloadedPlayerState.entities[newCabinet.id] = newCabinet;
    const overloadRes = resolveLootContainer(overloadedPlayerState, playerId, newCabinet.id);
    expect(overloadRes.apSpent).toBe(0);
    expect((overloadRes.events[0] as any).reason).toBe('MASS_EXCEEDED');
  });
});
