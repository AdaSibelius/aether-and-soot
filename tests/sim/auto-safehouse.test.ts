import { describe, expect, it } from 'vitest';
import { BlueprintIdSchema, EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld, deserializeWorld, serializeWorld } from '../../src/sim/core/world.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { projectWorldToVisualFrame } from '../../src/client/projection/frame-adapter.js';

describe('Deterministic Safehouse & Furniture System Test (safehouse.system.ts)', () => {
  const playerId = EntityIdSchema.parse('actor_player');

  it('claims an artificer workshop vault deed and verifies deed registry', () => {
    // Given (Seeded World)
    const world = createInitialWorld({ seed: 106 });
    expect(Object.keys(world.safehouses).length).toBe(0);

    // When (Command Dispatched via command-router.ts)
    const result = dispatchCommand(world, { type: 'CLAIM_WORKSHOP_DEED', actorId: playerId });

    // Then (ECS Component Delta + Domain Event Emitted + Frame Projection Verified)
    // 1. ECS Component Delta
    const safehouses = Object.values(result.state.safehouses);
    expect(safehouses.length).toBe(1);
    const safehouse = safehouses[0]!;
    expect(safehouse.ownerId).toBe(playerId);
    expect(safehouse.name).toContain('Workshop');
    expect(safehouse.deedId).toBeDefined();

    // 2. Domain Event Emitted
    const deedEv = result.events.find((e) => e.type === 'WORKSHOP_DEED_CLAIMED');
    expect(deedEv).toBeDefined();
    if (deedEv && deedEv.type === 'WORKSHOP_DEED_CLAIMED') {
      expect(deedEv.actorId).toBe(playerId);
      expect(deedEv.deedId).toBe(safehouse.deedId);
    }

    // 3. Frame Projection Verified
    const frame = projectWorldToVisualFrame(result.state, playerId);
    expect(frame.activeStratum).toBeDefined();
    expect(frame.cells.length).toBeGreaterThan(0);
  });

  it('builds a STEAM_CHARGER furniture structure and verifies persistence', () => {
    // Given (Seeded World)
    let world = createInitialWorld({ seed: 202 });
    const claimRes = dispatchCommand(world, { type: 'CLAIM_WORKSHOP_DEED', actorId: playerId });
    world = claimRes.state;
    const player = world.entities[playerId]!;
    const pos = player.position!;
    const targetPos = { x: pos.x + 1, y: pos.y, stratum: pos.stratum };

    // When (Command Dispatched via command-router.ts)
    const buildRes = dispatchCommand(world, {
      type: 'BUILD_STRUCTURE',
      actorId: playerId,
      structureType: 'STEAM_CHARGER',
      target: targetPos,
    });

    // Then (ECS Component Delta + Domain Event Emitted + Frame Projection Verified)
    // 1. ECS Component Delta
    const structures = Object.values(buildRes.state.entities).filter(
      (e) => e.furniture?.kind === 'STEAM_CHARGER',
    );
    expect(structures.length).toBe(1);
    const charger = structures[0]!;
    expect(charger.position?.x).toBe(targetPos.x);
    expect(charger.position?.y).toBe(targetPos.y);
    expect(charger.pressureVessel?.maxPressureKpa).toBe(250);

    // 2. Domain Event Emitted
    const buildEv = buildRes.events.find((e) => e.type === 'STRUCTURE_BUILT');
    expect(buildEv).toBeDefined();
    if (buildEv && buildEv.type === 'STRUCTURE_BUILT') {
      expect(buildEv.structureType).toBe('STEAM_CHARGER');
      expect(buildEv.structureEntityId).toBe(charger.id);
    }

    // 3. Frame Projection Verified
    const frame = projectWorldToVisualFrame(buildRes.state, playerId);
    expect(frame.activeStratum).toBe(pos.stratum);
    expect(frame.cells.some((c) => c.worldX === targetPos.x && c.worldY === targetPos.y)).toBe(true);

    // 4. Persistence across serializeWorld / deserializeWorld
    const serialized = serializeWorld(buildRes.state);
    const restored = deserializeWorld(serialized);
    expect(Object.keys(restored.safehouses).length).toBe(1);
    const restoredCharger = Object.values(restored.entities).find(
      (e) => e.furniture?.kind === 'STEAM_CHARGER',
    );
    expect(restoredCharger).toBeDefined();
    expect(restoredCharger?.id).toBe(charger.id);
    expect(restoredCharger?.pressureVessel?.maxPressureKpa).toBe(250);
  });

  it('stores and retrieves items from safehouse structures', () => {
    // Given (Seeded World)
    let world = createInitialWorld({ seed: 303 });
    const player = world.entities[playerId]!;
    const pos = player.position!;
    const targetPos = { x: pos.x + 1, y: pos.y, stratum: pos.stratum };

    // Build an ARTIFICER_BENCH (which supports storage inventory)
    world = dispatchCommand(world, {
      type: 'BUILD_STRUCTURE',
      actorId: playerId,
      structureType: 'ARTIFICER_BENCH',
      target: targetPos,
    }).state;

    const bench = Object.values(world.entities).find((e) => e.furniture?.kind === 'ARTIFICER_BENCH')!;
    expect(bench).toBeDefined();

    // Give player a test wrench item
    const wrenchId = EntityIdSchema.parse('item_artificer_wrench');
    world = {
      ...world,
      entities: {
        ...world.entities,
        [wrenchId]: {
          id: wrenchId,
          name: 'Brass Ratchet Wrench',
          visual: { glyph: 'w', fgPrimary: '#D4AF37', fgSecondary: '#5D6D7E', bgColor: '#0A0D0E', shaderFlags: [] },
          item: {
            blueprintId: BlueprintIdSchema.parse('mat_brass_scrap'),
            category: 'MATERIAL',
            massGrams: 500,
            volumeMl: 200,
            quantity: 1,
            stackable: false,
          },
        },
        [playerId]: {
          ...player,
          inventory: {
            containedEntityIds: [...(player.inventory?.containedEntityIds ?? []), wrenchId],
            equippedSlots: {},
            maxMassGrams: 20000,
            maxVolumeMl: 10000,
            currentMassGrams: 500,
          },
        },
      },
    };

    // When (Command Dispatched via command-router.ts): Store item in structure
    const storeRes = dispatchCommand(world, {
      type: 'STORE_ITEM_IN_STRUCTURE',
      actorId: playerId,
      structureEntityId: bench.id,
      itemEntityId: wrenchId,
    });

    // Then (ECS Component Delta + Domain Event Emitted + Frame Projection Verified)
    // 1. ECS Component Delta
    const playerAfterStore = storeRes.state.entities[playerId]!;
    const benchAfterStore = storeRes.state.entities[bench.id]!;
    expect(playerAfterStore.inventory?.containedEntityIds.includes(wrenchId)).toBe(false);
    expect(benchAfterStore.inventory?.containedEntityIds.includes(wrenchId)).toBe(true);

    // 2. Domain Event Emitted
    expect(
      storeRes.events.some(
        (e) => e.type === 'STRUCTURE_STORAGE_UPDATED' && e.action === 'STORE',
      ),
    ).toBe(true);

    // 3. Frame Projection Verified
    const frameAfterStore = projectWorldToVisualFrame(storeRes.state, playerId);
    expect(frameAfterStore.activeStratum).toBeDefined();

    // When: Retrieve item from structure
    const retrieveRes = dispatchCommand(storeRes.state, {
      type: 'RETRIEVE_ITEM_FROM_STRUCTURE',
      actorId: playerId,
      structureEntityId: bench.id,
      itemEntityId: wrenchId,
    });

    // Then
    const playerAfterRetrieve = retrieveRes.state.entities[playerId]!;
    const benchAfterRetrieve = retrieveRes.state.entities[bench.id]!;
    expect(playerAfterRetrieve.inventory?.containedEntityIds.includes(wrenchId)).toBe(true);
    expect(benchAfterRetrieve.inventory?.containedEntityIds.includes(wrenchId)).toBe(false);
    expect(
      retrieveRes.events.some(
        (e) => e.type === 'STRUCTURE_STORAGE_UPDATED' && e.action === 'RETRIEVE',
      ),
    ).toBe(true);
  });
});
