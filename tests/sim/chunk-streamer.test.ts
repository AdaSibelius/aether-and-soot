import { describe, expect, it } from 'vitest';
import {
  BlueprintIdSchema,
  ChunkKeySchema,
  EntityIdSchema,
} from '../../src/schemas/primitives.schema.js';
import { EntityRecord } from '../../src/schemas/components.schema.js';
import { SeededRNG } from '../../src/sim/core/rng.js';
import { assertWorldInvariants, validateWorldInvariants } from '../../src/sim/core/invariants.js';
import {
  createInitialWorld,
  deserializeWorld,
  serializeWorld,
  WorldState,
} from '../../src/sim/core/world.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createDefaultNpcAnatomy } from '../../src/sim/systems/district-spawner.js';
import {
  computeActiveChunkWindow,
  formatChunkKey,
  getChunkBounds,
  parseChunkKey,
  worldPointToChunkCoord,
} from '../../src/sim/spatial/chunk-coords.js';
import {
  hibernateChunk,
  hydrateChunk,
} from '../../src/sim/spatial/chunk-streamer.js';

describe('Spatial Chunk Streamer, Transitive Closure & Causal Catch-Up', () => {
  const districtId = BlueprintIdSchema.parse('district_spitalfields_soot_works');
  const playerId = EntityIdSchema.parse('actor_player');

  it('computes chunk coordinates, bounds, and active Chebyshev windows correctly', () => {
    const point = { x: 50, y: 40, stratum: 'STREET' as const };
    const coord = worldPointToChunkCoord(districtId, point);

    expect(coord.cx).toBe(3); // 50 / 16 = 3
    expect(coord.cy).toBe(3); // 40 / 12 = 3
    expect(coord.stratum).toBe('STREET');

    const bounds = getChunkBounds(coord);
    expect(bounds.minX).toBe(48);
    expect(bounds.maxX).toBe(63);
    expect(bounds.minY).toBe(36);
    expect(bounds.maxY).toBe(47);

    const key = formatChunkKey(coord);
    expect(key).toBe(`chunk:${districtId}:STREET:3,3`);
    expect(parseChunkKey(ChunkKeySchema.parse(key))).toEqual(coord);

    // 64x48 district = 4x4 chunks (0..3, 0..3)
    const windowChunks = computeActiveChunkWindow(coord, 64, 48, 1);
    expect(windowChunks.length).toBe(4); // corner chunk has 4 neighbors in 4x4 grid: (2,2), (2,3), (3,2), (3,3)
    expect(windowChunks.some((c) => c.cx === 3 && c.cy === 3)).toBe(true);
  });

  it('enforces transitive entity closure during hibernation and hydration without invariant violations', () => {
    const world = createInitialWorld({ seed: 333, width: 64, height: 48 });
    const rng = new SeededRNG(333);

    // Create an NPC at (52, 40) in chunk (3,3)
    const npcId = EntityIdSchema.parse('npc_artisan_automaton');
    const carriedItemId = EntityIdSchema.parse('item_carbine_schematic');
    const equippedItemId = EntityIdSchema.parse('item_clockwork_wrench');
    const prostheticId = EntityIdSchema.parse('item_hydraulic_arm');

    const defaultAnatomy = createDefaultNpcAnatomy();
    const npcEntity: EntityRecord = {
      id: npcId,
      name: 'Guild Artisan',
      visual: { glyph: 'n', fgPrimary: '#D4AF37', fgSecondary: '#8B4513', bgColor: '#0A0D0E', shaderFlags: [] },
      position: { x: 52, y: 40, stratum: 'STREET', blocksMovement: true, blocksSight: false },
      actor: { energy: 100, speed: 100, isPlayer: false },
      inventory: {
        containedEntityIds: [carriedItemId, equippedItemId],
        equippedSlots: { WIELD: equippedItemId },
        currentMassGrams: 850,
        maxMassGrams: 20000,
        maxVolumeMl: 20000,
      },
      anatomy: {
        ...defaultAnatomy,
        limbs: {
          ...defaultAnatomy.limbs,
          RIGHT_ARM: { slot: 'RIGHT_ARM', hp: 20, maxHp: 20, amputated: false, installedProstheticEntityId: prostheticId },
        },
      },
    };

    const carriedItem: EntityRecord = {
      id: carriedItemId, name: 'Carbine Schematic',
      visual: { glyph: '?', fgPrimary: '#5DADE2', fgSecondary: '#FFFFFF', bgColor: '#0A0D0E', shaderFlags: [] },
      item: { blueprintId: BlueprintIdSchema.parse('item_schematic'), category: 'MATERIAL', massGrams: 50, volumeMl: 50, quantity: 1, stackable: false },
    };

    const equippedItem: EntityRecord = {
      id: equippedItemId, name: 'Clockwork Wrench',
      visual: { glyph: '/', fgPrimary: '#D4AF37', fgSecondary: '#FFFFFF', bgColor: '#0A0D0E', shaderFlags: [] },
      item: { blueprintId: BlueprintIdSchema.parse('item_wrench'), category: 'EQUIPMENT', massGrams: 800, volumeMl: 600, quantity: 1, stackable: false },
    };

    const prostheticItem: EntityRecord = {
      id: prostheticId, name: 'Hydraulic Piston Arm',
      visual: { glyph: 'A', fgPrimary: '#E67E22', fgSecondary: '#8B4513', bgColor: '#0A0D0E', shaderFlags: [] },
      prostheticSpec: {
        blueprintId: BlueprintIdSchema.parse('prosthetic_hydraulic_arm'), targetLimbSlot: 'RIGHT_ARM', socketType: 'ACTUATOR',
        massGrams: 2000, volumeMl: 1500, steamConsumptionPerTurn: 1, moveApModifier: 0, fovRadiusBonus: 0, pressureRatingKpa: 200, noiseDb: 10,
      },
    };

    const populatedWorld: WorldState = {
      ...world,
      entities: { ...world.entities, [npcId]: npcEntity, [carriedItemId]: carriedItem, [equippedItemId]: equippedItem, [prostheticId]: prostheticItem },
    };

    expect(validateWorldInvariants(populatedWorld)).toEqual([]);

    // Hibernate chunk (3,3)
    const targetCoord = { districtId, stratum: 'STREET' as const, cx: 3, cy: 3 };
    const hibernatedState = hibernateChunk(populatedWorld, targetCoord);

    // Verify NPC and all 3 attached child entities were moved to dormantEntities
    expect(hibernatedState.entities[npcId]).toBeUndefined();
    expect(hibernatedState.entities[carriedItemId]).toBeUndefined();
    expect(hibernatedState.entities[equippedItemId]).toBeUndefined();
    expect(hibernatedState.entities[prostheticId]).toBeUndefined();

    expect(hibernatedState.chunkLedger?.dormantEntities[npcId]).toBeDefined();
    expect(hibernatedState.chunkLedger?.dormantEntities[carriedItemId]).toBeDefined();
    expect(hibernatedState.chunkLedger?.dormantEntities[equippedItemId]).toBeDefined();
    expect(hibernatedState.chunkLedger?.dormantEntities[prostheticId]).toBeDefined();

    // Verify 0 invariant violations in hibernated state
    expect(validateWorldInvariants(hibernatedState)).toEqual([]);
    expect(() => assertWorldInvariants(hibernatedState)).not.toThrow();

    // Hydrate chunk (3,3) back into active state
    const hydratedRes = hydrateChunk(hibernatedState, targetCoord, rng);
    const hydratedState = hydratedRes.state;

    // Verify all 4 entities returned to active state.entities
    expect(hydratedState.entities[npcId]).toBeDefined();
    expect(hydratedState.entities[carriedItemId]).toBeDefined();
    expect(hydratedState.entities[equippedItemId]).toBeDefined();
    expect(hydratedState.entities[prostheticId]).toBeDefined();

    expect(hydratedState.chunkLedger?.dormantEntities[npcId]).toBeUndefined();
    expect(validateWorldInvariants(hydratedState)).toEqual([]);
    expect(() => assertWorldInvariants(hydratedState)).not.toThrow();
  });

  it('produces identical states after mid-stream serialization and 50 turns', () => {
    const world = createInitialWorld({ seed: 444, width: 64, height: 48 });

    // Hibernate chunk (3,3)
    const targetCoord = { districtId, stratum: 'STREET' as const, cx: 3, cy: 3 };
    const stateWithDormant = hibernateChunk(world, targetCoord);

    // Round-trip serialize & deserialize mid-stream
    const json = serializeWorld(stateWithDormant);
    const deserialized = deserializeWorld(json);

    expect(deserialized).toEqual(stateWithDormant);
    expect(() => assertWorldInvariants(deserialized)).not.toThrow();

    // Advance 50 turns on both states and assert exact determinism
    let stateA = stateWithDormant;
    let stateB = deserialized;
    for (let i = 0; i < 50; i++) {
      stateA = dispatchCommand(stateA, { type: 'WAIT_TURN', actorId: playerId }).state;
      stateB = dispatchCommand(stateB, { type: 'WAIT_TURN', actorId: playerId }).state;
    }

    expect(stateA.turnCount).toBe(50);
    expect(stateB.turnCount).toBe(50);
    expect(stateA).toEqual(stateB);
    expect(() => assertWorldInvariants(stateB)).not.toThrow();
  });

  it('applies causal district flags (steamOutageActive and sluiceFloodedActive) on hydration', () => {
    const world = createInitialWorld({ seed: 555, width: 64, height: 48 });
    const rng = new SeededRNG(555);

    const targetCoord = { districtId, stratum: 'STREET' as const, cx: 2, cy: 2 };
    const hibernated = hibernateChunk(world, targetCoord);

    // Turn on causal flags in cityGraph
    const causalWorld: WorldState = {
      ...hibernated,
      cityGraph: {
        ...hibernated.cityGraph!,
        nodes: {
          ...hibernated.cityGraph!.nodes,
          [districtId]: {
            ...hibernated.cityGraph!.nodes[districtId]!,
            flags: {
              steamOutageActive: true,
              clinicStockoutActive: false,
              workerStrikeActive: false,
              sluiceFloodedActive: true,
            },
          },
        },
      },
    };

    const hydratedRes = hydrateChunk(causalWorld, targetCoord, rng);
    const hydratedGrid = hydratedRes.state.strata['STREET']!;
    const bounds = getChunkBounds(targetCoord);

    // Check that walkable cells received SLUICE_SLUDGE
    let foundSludge = false;
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
      for (let x = bounds.minX; x <= bounds.maxX; x++) {
        const cell = hydratedGrid.cells[y * hydratedGrid.width + x];
        if (cell && !cell.blocksMovement) {
          expect(cell.liquidType).toBe('SLUICE_SLUDGE');
          foundSludge = true;
        }
      }
    }
    expect(foundSludge).toBe(true);
    expect(() => assertWorldInvariants(hydratedRes.state)).not.toThrow();
  });

  it('emits CHUNK_WINDOW_SHIFTED when actor moves across chunk boundaries', () => {
    const world = createInitialWorld({ seed: 666, width: 64, height: 48 });

    // Player starts at (15, 6) on chunk border (0,0)
    const playerEntity = world.entities[playerId]!;
    const nearBorderWorld: WorldState = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...playerEntity,
          position: { x: 15, y: 6, stratum: 'STREET', blocksMovement: true, blocksSight: false },
        },
      },
    };

    // Step across boundary to (16, 6) in chunk (1,0)
    const moveRes = dispatchCommand(nearBorderWorld, {
      type: 'MOVE_STEP',
      actorId: playerId,
      dx: 1,
      dy: 0,
    });

    expect(moveRes.resolution.status).toBe('applied');
    const shiftEvent = moveRes.events.find((e) => e.type === 'CHUNK_WINDOW_SHIFTED');
    expect(shiftEvent).toBeDefined();
  });
});
