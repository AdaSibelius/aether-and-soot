import { describe, expect, it } from 'vitest';
import { EntityRecord } from '../../src/schemas/components.schema.js';
import { BlueprintIdSchema, EntityIdSchema, LimbSlotId, StratumId } from '../../src/schemas/primitives.schema.js';
import { assertWorldInvariants, validateWorldInvariants } from '../../src/sim/core/invariants.js';
import { MAX_PERSISTENT_EVENT_LOG } from '../../src/sim/core/scheduler.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld, WorldState } from '../../src/sim/core/world.js';
import { generateVictorianDistrict } from '../../src/sim/spatial/generator.js';
import { createDefaultNpcAnatomy } from '../../src/sim/systems/district-spawner.js';

describe('Phase B: World Relational Invariants Guard & Event Log Ring-Buffer Hygiene', () => {
  const playerId = EntityIdSchema.parse('actor_player');
  const streetStratum: StratumId = 'STREET';
  const leftLegSlot: LimbSlotId = 'LEFT_LEG';
  const rightLegSlot: LimbSlotId = 'RIGHT_LEG';

  it('validates clean initial world and procedural Victorian district with 0 violations', () => {
    const initialWorld = createInitialWorld({ seed: 101, width: 24, height: 24 });
    expect(validateWorldInvariants(initialWorld)).toEqual([]);
    expect(() => assertWorldInvariants(initialWorld)).not.toThrow();

    const district = generateVictorianDistrict(initialWorld).state;
    expect(validateWorldInvariants(district)).toEqual([]);
    expect(() => assertWorldInvariants(district)).not.toThrow();
  });

  it('catches missing inventory items and duplicate item ownership across multiple containers', () => {
    const world = createInitialWorld({ seed: 202 });
    const missingItemId = EntityIdSchema.parse('item_nonexistent_widget');
    const existingItemId = EntityIdSchema.parse('item_pneumatic_strider_leg');

    // 1. Missing item reference in inventory
    const corruptedMissing: WorldState = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...world.entities[playerId]!,
          inventory: {
            ...world.entities[playerId]!.inventory!,
            containedEntityIds: [...world.entities[playerId]!.inventory!.containedEntityIds, missingItemId],
          },
        },
      },
    };
    const missingViolations = validateWorldInvariants(corruptedMissing);
    expect(missingViolations.some((v) => v.includes('references missing item entity'))).toBe(true);
    expect(() => assertWorldInvariants(corruptedMissing)).toThrow(/references missing item entity/);

    // 2. Duplicate ownership of the same item across two containers/actors
    const secondActorId = EntityIdSchema.parse('actor_secondary');
    const corruptedDuplicate: WorldState = {
      ...world,
      entities: {
        ...world.entities,
        [secondActorId]: {
          id: secondActorId,
          name: 'Smuggler accomplice',
          visual: { glyph: 's', fgPrimary: '#aaa', fgSecondary: '#555', bgColor: '#000', shaderFlags: [] },
          inventory: {
            containedEntityIds: [existingItemId],
            equippedSlots: {},
            currentMassGrams: 1000,
            maxMassGrams: 20000,
            maxVolumeMl: 20000,
          },
        },
      },
    };
    const duplicateViolations = validateWorldInvariants(corruptedDuplicate);
    expect(duplicateViolations.some((v) => v.includes('duplicate inventory ownership'))).toBe(true);

    // 3. Carried item with illegal ground position
    const corruptedGroundItem: WorldState = {
      ...world,
      entities: {
        ...world.entities,
        [existingItemId]: {
          ...world.entities[existingItemId]!,
          position: { x: 5, y: 5, stratum: streetStratum, blocksMovement: false, blocksSight: false },
        },
      },
    };
    const groundViolations = validateWorldInvariants(corruptedGroundItem);
    expect(groundViolations.some((v) => v.includes('must not possess a ground position'))).toBe(true);
  });

  it('catches invalid limb socketing, missing prosthetics, and duplicate socketing', () => {
    const world = createInitialWorld({ seed: 303 });
    const missingProstheticId = EntityIdSchema.parse('item_ghost_prosthetic');
    const realProstheticId = EntityIdSchema.parse('item_pneumatic_strider_leg');

    // 1. Missing prosthetic reference
    const corruptedMissingP: WorldState = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...world.entities[playerId]!,
          anatomy: {
            ...world.entities[playerId]!.anatomy!,
            limbs: {
              ...world.entities[playerId]!.anatomy!.limbs,
              LEFT_LEG: {
                slot: leftLegSlot,
                hp: 30,
                maxHp: 30,
                amputated: false,
                installedProstheticEntityId: missingProstheticId,
              },
            },
          },
        },
      },
    };
    const pViolations = validateWorldInvariants(corruptedMissingP);
    expect(pViolations.some((v) => v.includes('references missing prosthetic entity'))).toBe(true);

    // 2. Duplicate socketing of same prosthetic into two limbs
    const corruptedDoubleSocket: WorldState = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...world.entities[playerId]!,
          anatomy: {
            ...world.entities[playerId]!.anatomy!,
            limbs: {
              ...world.entities[playerId]!.anatomy!.limbs,
              LEFT_LEG: {
                slot: leftLegSlot,
                hp: 30,
                maxHp: 30,
                amputated: false,
                installedProstheticEntityId: realProstheticId,
              },
              RIGHT_LEG: {
                slot: rightLegSlot,
                hp: 30,
                maxHp: 30,
                amputated: false,
                installedProstheticEntityId: realProstheticId,
              },
            },
          },
        },
      },
    };
    const doubleViolations = validateWorldInvariants(corruptedDoubleSocket);
    expect(doubleViolations.some((v) => v.includes('socketed in multiple limbs'))).toBe(true);
  });

  it('catches actor out-of-bounds coordinates and placement on impassable solid wall tiles', () => {
    const world = createInitialWorld({ seed: 404, width: 16, height: 16 });

    // 1. Out of bounds actor
    const corruptedOob: WorldState = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...world.entities[playerId]!,
          position: { x: 99, y: 99, stratum: streetStratum, blocksMovement: true, blocksSight: false },
        },
      },
    };
    const oobViolations = validateWorldInvariants(corruptedOob);
    expect(oobViolations.some((v) => v.includes('is out of bounds'))).toBe(true);

    // 2. Actor placed on border solid wall tile (0, 0)
    const corruptedWall: WorldState = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...world.entities[playerId]!,
          position: { x: 0, y: 0, stratum: streetStratum, blocksMovement: true, blocksSight: false },
        },
      },
    };
    const wallViolations = validateWorldInvariants(corruptedWall);
    expect(wallViolations.some((v) => v.includes('positioned on blocking terrain'))).toBe(true);
  });

  it('catches dead NPCs retaining active actor or aiController components', () => {
    const world = createInitialWorld({ seed: 505 });
    const npcId = EntityIdSchema.parse('actor_test_npc');

    const deadNpc: EntityRecord = {
      id: npcId,
      name: 'Fallen Thug',
      visual: { glyph: 't', fgPrimary: '#f00', fgSecondary: '#500', bgColor: '#000', shaderFlags: [] },
      position: { x: 5, y: 5, stratum: streetStratum, blocksMovement: true, blocksSight: false },
      actor: { energy: 100, speed: 100, isPlayer: false },
      aiController: { factionId: 'UNDERCROFT_SYNDICATE', role: 'SCAVENGER', hostile: true, alertState: 'IDLE' },
      anatomy: {
        ...createDefaultNpcAnatomy(),
        bloodVolumePct: 0, // Ex-sanguinated / fatal trauma
      },
    };

    const corruptedDeadNpc: WorldState = {
      ...world,
      entities: {
        ...world.entities,
        [npcId]: deadNpc,
      },
    };

    const violations = validateWorldInvariants(corruptedDeadNpc);
    expect(violations.some((v) => v.includes('remains in entities with an active actor component'))).toBe(true);
    expect(violations.some((v) => v.includes('active aiController component'))).toBe(true);
  });

  it('enforces eventLog ring-buffer ceiling of MAX_PERSISTENT_EVENT_LOG (250)', () => {
    let world = createInitialWorld({ seed: 606, width: 16, height: 16 });
    for (let step = 0; step < 300; step++) {
      world = dispatchCommand(world, { type: 'WAIT_TURN', actorId: playerId }).state;
    }
    expect(world.turnCount).toBe(300);
    expect(world.eventLog.length).toBe(MAX_PERSISTENT_EVENT_LOG);
    expect(() => assertWorldInvariants(world)).not.toThrow();
  });

  it('detects orphaned items, rejects actions from deceased actors, and cleanly resolves lethal DAMAGE_LIMB', () => {
    const world = createInitialWorld({ seed: 707 });
    const orphanId = EntityIdSchema.parse('item_orphan_gear');
    const orphanWorld: WorldState = {
      ...world,
      entities: {
        ...world.entities,
        [orphanId]: {
          id: orphanId,
          name: 'Floating Gear',
          visual: { glyph: '*', fgPrimary: '#fff', fgSecondary: '#888', bgColor: '#000', shaderFlags: [] },
          item: { blueprintId: BlueprintIdSchema.parse('item_clockwork_gear'), category: 'MATERIAL', massGrams: 50, volumeMl: 20, quantity: 1, stackable: true },
        },
      },
    };
    expect(validateWorldInvariants(orphanWorld).some((v) => v.includes('is orphaned'))).toBe(true);

    // Mortality rejection
    const deadPlayerWorld: WorldState = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...world.entities[playerId]!,
          anatomy: { ...world.entities[playerId]!.anatomy!, bloodVolumePct: 0 },
        },
      },
    };
    const actRes = dispatchCommand(deadPlayerWorld, { type: 'WAIT_TURN', actorId: playerId });
    expect(actRes.resolution.status).toBe('rejected');
    if (actRes.resolution.status === 'rejected') {
      expect(actRes.resolution.reason).toContain('deceased');
    }

    // Lethal DAMAGE_LIMB resolves defeat without invariant violation
    const npcId = EntityIdSchema.parse('npc_lethal_target');
    const liveNpcWorld: WorldState = {
      ...world,
      entities: {
        ...world.entities,
        [npcId]: {
          id: npcId,
          name: 'Target Sentry',
          visual: { glyph: 's', fgPrimary: '#f00', fgSecondary: '#500', bgColor: '#000', shaderFlags: [] },
          position: { x: 5, y: 5, stratum: streetStratum, blocksMovement: true, blocksSight: false },
          actor: { energy: 100, speed: 100, isPlayer: false },
          anatomy: createDefaultNpcAnatomy(),
        },
      },
    };
    const lethalRes = dispatchCommand(liveNpcWorld, { type: 'DAMAGE_LIMB', actorId: playerId, targetId: npcId, slot: 'TORSO', damage: 100 });
    expect(lethalRes.events.some((e) => e.type === 'ACTOR_DEFEATED')).toBe(true);
    expect(lethalRes.state.entities[npcId]).toBeUndefined();
    expect(() => assertWorldInvariants(lethalRes.state)).not.toThrow();
  });
});
