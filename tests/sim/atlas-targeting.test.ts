import { describe, expect, it } from 'vitest';
import { EntityIdSchema, LimbSlotId } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld, WorldState } from '../../src/sim/core/world.js';
import { generateVictorianDistrict } from '../../src/sim/spatial/generator.js';
import { spawnDistrictNpcs } from '../../src/sim/systems/ai.system.js';

describe('Phase 17: Multi-Stratum World Atlas & Keyboard Look / Target Mode', () => {
  const playerId = EntityIdSchema.parse('actor_player');
  const wardenId = EntityIdSchema.parse('npc_clockwork_warden');

  function setupWorld(seed: number): WorldState {
    const base = createInitialWorld({ seed, width: 24, height: 20 });
    const generated = generateVictorianDistrict(base).state;
    return spawnDistrictNpcs(generated).state;
  }

  it('validates 3-strata architecture (SPIRE, STREET, UNDERCROFT) and bidirectional vertical portals', () => {
    const world = setupWorld(42);

    expect(world.strata.SPIRE).toBeDefined();
    expect(world.strata.STREET).toBeDefined();
    expect(world.strata.UNDERCROFT).toBeDefined();

    expect(world.strata.SPIRE?.width).toBe(24);
    expect(world.strata.SPIRE?.height).toBe(20);
    expect(world.strata.STREET?.width).toBe(24);
    expect(world.strata.STREET?.height).toBe(20);
    expect(world.strata.UNDERCROFT?.width).toBe(24);
    expect(world.strata.UNDERCROFT?.height).toBe(20);

    // Verify portals connecting the 3 strata
    const portals = Object.values(world.entities).filter((e) => e.portal !== undefined);
    expect(portals.length).toBeGreaterThanOrEqual(4);

    const liftUp = portals.find((p) => p.portal?.target.stratum === 'SPIRE');
    const liftDown = portals.find((p) => p.portal?.target.stratum === 'STREET' && p.position?.stratum === 'SPIRE');
    const manholeDown = portals.find((p) => p.portal?.target.stratum === 'UNDERCROFT');
    const ladderUp = portals.find((p) => p.portal?.target.stratum === 'STREET' && p.position?.stratum === 'UNDERCROFT');

    expect(liftUp).toBeDefined();
    expect(liftDown).toBeDefined();
    expect(manholeDown).toBeDefined();
    expect(ladderUp).toBeDefined();
  });

  it('executes targeted limb attacks across all 6 slots (HEAD, TORSO, LEFT_ARM, RIGHT_ARM, LEFT_LEG, RIGHT_LEG)', () => {
    let world = setupWorld(99);
    const warden = world.entities[wardenId]!;
    const player = world.entities[playerId]!;

    // Place player adjacent to Clockwork Warden
    world = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...player,
          position: { ...player.position!, x: warden.position!.x + 1, y: warden.position!.y, stratum: 'STREET' },
          combatStats: { meleeDamage: 5, accuracyPct: 100, armorReduction: 0 },
        },
      },
    };

    const slotsToTest: LimbSlotId[] = [
      'HEAD',
      'TORSO',
      'LEFT_ARM',
      'RIGHT_ARM',
      'LEFT_LEG',
      'RIGHT_LEG',
    ];

    for (const slot of slotsToTest) {
      const res = dispatchCommand(world, {
        type: 'ATTACK_ACTOR',
        attackerId: playerId,
        targetId: wardenId,
        targetSlot: slot,
      });

      expect(res.events).toContainEqual(
        expect.objectContaining({
          type: 'COMBAT_ATTACK_RESOLVED',
          attackerId: playerId,
          targetId: wardenId,
          targetSlot: slot,
        }),
      );
      world = res.state;
    }
  });

  it('traverses an adjacent district transit gate to a new London district', () => {
    let world = setupWorld(777);
    const player = world.entities[playerId]!;

    const westGate = Object.values(world.entities).find((e) => e.districtGate && e.id === 'gate_transit_west');
    expect(westGate).toBeDefined();
    expect(westGate?.districtGate).toBeDefined();

    const targetDistrict = westGate!.districtGate!.targetDistrictId;

    // Place player directly adjacent to west transit gate
    world = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...player,
          position: {
            ...player.position!,
            x: westGate!.position!.x + 1,
            y: westGate!.position!.y,
            stratum: westGate!.position!.stratum,
          },
        },
      },
    };

    const transitRes = dispatchCommand(world, {
      type: 'TRAVEL_DISTRICT',
      actorId: playerId,
      targetDistrictId: targetDistrict,
    });

    expect(transitRes.events).toContainEqual(
      expect.objectContaining({
        type: 'DISTRICT_TRAVELED',
        actorId: playerId,
        toDistrictId: targetDistrict,
      }),
    );

    expect(transitRes.state.currentDistrictId).toBe(targetDistrict);
    expect(transitRes.state.entities[playerId]).toBeDefined();
  });
});
