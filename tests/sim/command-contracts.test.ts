import { describe, expect, it } from 'vitest';
import { EntityRecord } from '../../src/schemas/components.schema.js';
import { GameCommand } from '../../src/schemas/commands.schema.js';
import { BlueprintIdSchema, EntityId, EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { assertWorldInvariants, validateWorldInvariants } from '../../src/sim/core/invariants.js';
import { createDefaultNpcAnatomy } from '../../src/sim/systems/district-spawner.js';
import { createInitialWorld, deserializeWorld, serializeWorld, WorldState } from '../../src/sim/core/world.js';

interface TestFixture {
  world: WorldState;
  playerId: EntityId;
  striderLegId: EntityId;
  targetActorId: EntityId;
  groundItemId: EntityId;
}

function createContractsFixture(): TestFixture {
  let world = createInitialWorld({ seed: 777, width: 24, height: 24 });
  const playerId = EntityIdSchema.parse('actor_player');
  const striderLegId = EntityIdSchema.parse('item_pneumatic_strider_leg');
  const targetActorId = EntityIdSchema.parse('npc_dummy_target');
  const groundItemId = EntityIdSchema.parse('item_ground_scrap');
  const pPos = world.entities[playerId]!.position!;

  const dummy: EntityRecord = {
    id: targetActorId, name: 'Target Dummy',
    visual: { glyph: 'D', fgPrimary: '#E74C3C', fgSecondary: '#922B21', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: pPos.x + 1, y: pPos.y, stratum: pPos.stratum, blocksMovement: true, blocksSight: false },
    actor: { energy: 0, speed: 100, isPlayer: false },
    anatomy: createDefaultNpcAnatomy(30, 20),
  };

  const groundItem: EntityRecord = {
    id: groundItemId, name: 'Brass Scrap Piece',
    visual: { glyph: '*', fgPrimary: '#E67E22', fgSecondary: '#D35400', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: pPos.x, y: pPos.y, stratum: pPos.stratum, blocksMovement: false, blocksSight: false },
    item: { blueprintId: BlueprintIdSchema.parse('mat_scrap_brass'), category: 'MATERIAL', massGrams: 200, volumeMl: 150, quantity: 1, stackable: true },
  };

  world = { ...world, entities: { ...world.entities, [targetActorId]: dummy, [groundItemId]: groundItem } };
  return { world, playerId, striderLegId, targetActorId, groundItemId };
}

function assertNoOrphanedOrDuplicateEntities(state: WorldState): void {
  const seenCarried = new Set<string>();
  for (const entity of Object.values(state.entities)) {
    if (entity?.inventory) {
      for (const itemId of entity.inventory.containedEntityIds) {
        expect(seenCarried.has(itemId)).toBe(false);
        seenCarried.add(itemId);
        const itemRecord = state.entities[itemId];
        expect(itemRecord).toBeDefined();
        expect(itemRecord?.position).toBeUndefined();
      }
    }
  }
  for (const [entityId, entity] of Object.entries(state.entities)) {
    if (entity?.position && entity.item) {
      expect(seenCarried.has(entityId)).toBe(false);
    }
  }
  expect(validateWorldInvariants(state)).toEqual([]);
}

describe('Phase ARCH-3.2: Universal Parameterized Command Contract Test Suite', () => {
  const acceptedCases: Array<{
    name: string;
    setup?: (f: TestFixture) => WorldState;
    command: (f: TestFixture) => GameCommand;
  }> = [
    { name: 'WAIT_TURN', command: (f) => ({ type: 'WAIT_TURN', actorId: f.playerId }) },
    { name: 'MOVE_STEP', command: (f) => ({ type: 'MOVE_STEP', actorId: f.playerId, dx: 0, dy: 1 }) },
    { name: 'DROP_ITEM', command: (f) => ({ type: 'DROP_ITEM', actorId: f.playerId, itemEntityId: f.striderLegId, quantity: 1 }) },
    { name: 'PICK_UP_ITEM', command: (f) => ({ type: 'PICK_UP_ITEM', actorId: f.playerId, itemEntityId: f.groundItemId }) },
    { name: 'CONSULT_CODEX', command: (f) => ({ type: 'CONSULT_CODEX', actorId: f.playerId }) },
    { name: 'REFILL_STEAM', command: (f) => ({ type: 'REFILL_STEAM', actorId: f.playerId, pressureAddedKpa: 25, bypassFuelRequirement: true }) },
    { name: 'INSTALL_PROSTHETIC', command: (f) => ({ type: 'INSTALL_PROSTHETIC', actorId: f.playerId, prostheticEntityId: f.striderLegId, slot: 'LEFT_LEG' }) },
    {
      name: 'USE_PORTAL',
      setup: (f) => ({ ...f.world, entities: { ...f.world.entities, [f.playerId]: { ...f.world.entities[f.playerId]!, position: { x: 14, y: 12, stratum: 'STREET', blocksMovement: true, blocksSight: false } } } }),
      command: (f) => ({ type: 'USE_PORTAL', actorId: f.playerId }),
    },
    { name: 'ATTACK_ACTOR', command: (f) => ({ type: 'ATTACK_ACTOR', attackerId: f.playerId, targetId: f.targetActorId, targetSlot: 'TORSO' }) },
    { name: 'DAMAGE_LIMB', command: (f) => ({ type: 'DAMAGE_LIMB', actorId: f.playerId, targetId: f.targetActorId, slot: 'TORSO', damage: 10 }) },
  ];

  for (const tc of acceptedCases) {
    it(`Contract 1, 3, 4, 5: accepts ${tc.name} with invariant compliance and replay`, () => {
      const fixture = createContractsFixture();
      const initialState = tc.setup ? tc.setup(fixture) : fixture.world;
      const cmd = tc.command(fixture);

      // Contract 1: Invariants hold on execution
      const res1 = dispatchCommand(initialState, cmd);
      expect(res1.resolution.status).toBe('applied');
      expect(() => assertWorldInvariants(res1.state)).not.toThrow();

      // Contract 3: Consumes valid AP and emits events
      if (res1.resolution.status === 'applied') {
        expect(res1.resolution.apSpent).toBeGreaterThanOrEqual(0);
      }
      expect(res1.events.length).toBeGreaterThanOrEqual(1);

      // Contract 4: Zero orphaned or duplicate entity references
      assertNoOrphanedOrDuplicateEntities(res1.state);

      // Contract 5: Deterministic replay yields identical state and event sequence
      const res2 = dispatchCommand(initialState, cmd);
      expect(res2.state).toEqual(res1.state);
      expect(res2.events).toEqual(res1.events);

      // Persistence roundtrip
      expect(deserializeWorld(serializeWorld(res1.state))).toEqual(res1.state);
    });
  }

  const rejectedCases: Array<{
    name: string;
    setup?: (f: TestFixture) => WorldState;
    command: (f: TestFixture) => GameCommand;
  }> = [
    {
      name: 'MOVE_STEP into border wall',
      setup: (f) => ({ ...f.world, entities: { ...f.world.entities, [f.playerId]: { ...f.world.entities[f.playerId]!, position: { x: 1, y: 1, stratum: 'STREET', blocksMovement: true, blocksSight: false } } } }),
      command: (f) => ({ type: 'MOVE_STEP', actorId: f.playerId, dx: -1, dy: 0 }),
    },
    { name: 'DROP_ITEM missing item', command: (f) => ({ type: 'DROP_ITEM', actorId: f.playerId, itemEntityId: EntityIdSchema.parse('item_ghost_1'), quantity: 1 }) },
    { name: 'PICK_UP_ITEM missing item', command: (f) => ({ type: 'PICK_UP_ITEM', actorId: f.playerId, itemEntityId: EntityIdSchema.parse('item_ghost_2') }) },
    { name: 'USE_ITEM missing item', command: (f) => ({ type: 'USE_ITEM', actorId: f.playerId, itemEntityId: EntityIdSchema.parse('item_ghost_3') }) },
    { name: 'REST_AT_BED without bed', command: (f) => ({ type: 'REST_AT_BED', actorId: f.playerId }) },
    { name: 'SMASH_TERRAIN non-smashable', command: (f) => ({ type: 'SMASH_TERRAIN', actorId: f.playerId, target: { x: 0, y: 0, stratum: 'STREET' } }), },
    { name: 'LOOT_CONTAINER non-container', command: (f) => ({ type: 'LOOT_CONTAINER', actorId: f.playerId, containerId: f.targetActorId }) },
    { name: 'TOGGLE_DOOR on non-door wall', command: (f) => ({ type: 'TOGGLE_DOOR', actorId: f.playerId, target: { x: 0, y: 0, stratum: 'STREET' } }) },
    { name: 'TRAVEL_DISTRICT without gate', command: (f) => ({ type: 'TRAVEL_DISTRICT', actorId: f.playerId, targetDistrictId: BlueprintIdSchema.parse('district_highgate_spire') }) },
    { name: 'COMPLETE_CONTRACT missing contract', command: (f) => ({ type: 'COMPLETE_CONTRACT', actorId: f.playerId, contractId: BlueprintIdSchema.parse('contract_ghost') }) },
    { name: 'LAUNCH_MONORAIL not boarded', command: (f) => ({ type: 'LAUNCH_MONORAIL', actorId: f.playerId, monorailEntityId: f.targetActorId, destinationDistrictId: BlueprintIdSchema.parse('district_highgate_spire') }) },
  ];

  for (const tc of rejectedCases) {
    it(`Contract 2: rejects ${tc.name} with non-empty reason and zero state mutation`, () => {
      const fixture = createContractsFixture();
      const initialState = tc.setup ? tc.setup(fixture) : fixture.world;
      const cmd = tc.command(fixture);

      const res = dispatchCommand(initialState, cmd);

      // Contract 2: Rejection status and non-empty reason
      expect(res.resolution.status).toBe('rejected');
      if (res.resolution.status === 'rejected') {
        expect(typeof res.resolution.reason).toBe('string');
        expect(res.resolution.reason.length).toBeGreaterThan(0);
      }

      // Contract 2: Zero mutation on failure (referential identity preserved)
      expect(res.state).toBe(initialState);
      expect(validateWorldInvariants(res.state)).toEqual([]);
    });
  }

  it('preserves relational invariants across a continuous multi-action gameplay sequence', () => {
    const fixture = createContractsFixture();
    let world = fixture.world;

    const sequence: GameCommand[] = [
      { type: 'MOVE_STEP', actorId: fixture.playerId, dx: 0, dy: 1 },
      { type: 'DROP_ITEM', actorId: fixture.playerId, itemEntityId: fixture.striderLegId, quantity: 1 },
      { type: 'PICK_UP_ITEM', actorId: fixture.playerId, itemEntityId: fixture.striderLegId },
      { type: 'CONSULT_CODEX', actorId: fixture.playerId },
      { type: 'WAIT_TURN', actorId: fixture.playerId },
    ];

    for (const cmd of sequence) {
      const res = dispatchCommand(world, cmd);
      expect(res.resolution.status).toBe('applied');
      expect(() => assertWorldInvariants(res.state)).not.toThrow();
      assertNoOrphanedOrDuplicateEntities(res.state);
      world = res.state;
    }

    expect(world.turnCount).toBeGreaterThan(fixture.world.turnCount);
    expect(world.eventLog.length).toBeGreaterThan(fixture.world.eventLog.length);
  });
});
