import { describe, expect, it } from 'vitest';
import { EntityRecord } from '../../src/schemas/components.schema.js';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { setTileCell } from '../../src/sim/spatial/grid.js';
import { createDefaultNpcAnatomy } from '../../src/sim/systems/district-spawner.js';

describe('Phase 42: Witness Attribution, Squad Callouts & Faction Grudge Memory', () => {
  const playerId = EntityIdSchema.parse('actor_player');
  const guardId = EntityIdSchema.parse('npc_guard_alpha');
  const squadmateId = EntityIdSchema.parse('npc_guard_bravo');
  const victimId = EntityIdSchema.parse('npc_victim_citizen');

  function makeNpc(id: typeof guardId, role: 'GUARD' | 'CITIZEN', x: number, squadId?: string): EntityRecord {
    return {
      id, name: role,
      visual: { glyph: 'G', fgPrimary: '#D4AF37', fgSecondary: '#8B4513', bgColor: '#0A0D0E', shaderFlags: [] },
      actor: { isPlayer: false, energy: 100, speed: 100 },
      anatomy: createDefaultNpcAnatomy(30, 15),
      aiController: { factionId: 'CROWN_CONSTABULARY', role, hostile: false, alertState: 'IDLE', ...(squadId ? { squadId } : {}) },
      position: { x, y: 5, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    };
  }

  it('theft and assault with an unblinded witness cause reputation loss and grudge acquisition', () => {
    let world = createInitialWorld({ seed: 101, width: 20, height: 20 });
    const p = world.entities[playerId]!;
    const guard = makeNpc(guardId, 'GUARD', 5, 'squad_crimson');
    const victim = makeNpc(victimId, 'CITIZEN', 2);

    world = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: { ...p, position: { x: 1, y: 5, stratum: 'STREET', blocksMovement: true, blocksSight: false } },
        [victimId]: victim,
        [guardId]: guard,
      },
    };

    const initialRep = world.economy.factionReputation.CROWN_CONSTABULARY ?? 0;

    const atkRes = dispatchCommand(world, {
      type: 'ATTACK_ACTOR', attackerId: playerId, targetId: victimId, targetSlot: 'TORSO',
    });

    world = atkRes.state;
    expect(world.economy.factionReputation.CROWN_CONSTABULARY).toBe(initialRep - 15);
    expect(atkRes.events.some((e) => e.type === 'WITNESS_CRIME_REPORTED')).toBe(true);
    expect(atkRes.events.some((e) => e.type === 'GRUDGE_ACQUIRED')).toBe(true);
    expect(world.entities[guardId]!.aiController?.grudgeTargetId).toBe(playerId);
  });

  it('assault occluded by smog causes zero reputation loss', () => {
    let world = createInitialWorld({ seed: 102, width: 20, height: 20 });
    const p = world.entities[playerId]!;
    const street = setTileCell(world.strata.STREET!, 1, 5, (c) => ({ ...c, smokePpm: 150 }));
    world = {
      ...world,
      strata: { ...world.strata, STREET: street },
      entities: {
        ...world.entities,
        [playerId]: { ...p, position: { x: 1, y: 5, stratum: 'STREET', blocksMovement: true, blocksSight: false } },
        [victimId]: makeNpc(victimId, 'CITIZEN', 2),
        [guardId]: makeNpc(guardId, 'GUARD', 5),
      },
    };

    const initialRep = world.economy.factionReputation.CROWN_CONSTABULARY ?? 0;
    const atkRes = dispatchCommand(world, {
      type: 'ATTACK_ACTOR', attackerId: playerId, targetId: victimId, targetSlot: 'TORSO',
    });

    expect(atkRes.state.economy.factionReputation.CROWN_CONSTABULARY).toBe(initialRep);
    expect(atkRes.events.some((e) => e.type === 'WITNESS_CRIME_REPORTED')).toBe(false);
  });

  it('guard shout propagates 90 dB acoustic alert rallying allied squadmates to target', () => {
    let world = createInitialWorld({ seed: 103, width: 20, height: 20 });
    const p = world.entities[playerId]!;
    world = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: { ...p, position: { x: 1, y: 5, stratum: 'STREET', blocksMovement: true, blocksSight: false } },
        [guardId]: makeNpc(guardId, 'GUARD', 5, 'squad_crimson'),
        [squadmateId]: makeNpc(squadmateId, 'GUARD', 9, 'squad_crimson'),
      },
    };

    const calloutRes = dispatchCommand(world, {
      type: 'EMIT_SQUAD_CALLOUT',
      actorId: guardId,
      targetId: playerId,
      alertMessage: 'Intruder breached perimeter! Rally to me!',
    });

    expect(calloutRes.events.some((e) => e.type === 'SQUAD_CALLOUT_EMITTED')).toBe(true);
    expect(calloutRes.events.some((e) => e.type === 'SQUADMATE_RALLIED')).toBe(true);

    const rallied = calloutRes.state.entities[squadmateId]!;
    expect(rallied.aiController?.alertState).toBe('COMBAT');
    expect(rallied.aiController?.grudgeTargetId).toBe(playerId);
  });

  it('persistent grudge memory retains hostility after line of sight is broken', () => {
    let world = createInitialWorld({ seed: 104, width: 20, height: 20 });
    const p = world.entities[playerId]!;
    const guard: EntityRecord = {
      ...makeNpc(guardId, 'GUARD', 15),
      aiController: { factionId: 'CROWN_CONSTABULARY', role: 'GUARD', hostile: false, alertState: 'IDLE', grudgeTargetId: playerId },
      position: { x: 15, y: 15, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    };

    world = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: { ...p, position: { x: 1, y: 1, stratum: 'STREET', blocksMovement: true, blocksSight: false } },
        [guardId]: guard,
      },
    };

    const waitRes = dispatchCommand(world, { type: 'WAIT_TURN', actorId: playerId });
    const tickGuard = waitRes.state.entities[guardId]!;
    expect(tickGuard.aiController?.hostile).toBe(true);
    expect(tickGuard.aiController?.grudgeTargetId).toBe(playerId);
  });

  it('dispatches REPORT_CRIME to alert authorities and adjust faction reputation', () => {
    let world = createInitialWorld({ seed: 105, width: 20, height: 20 });
    const p = world.entities[playerId]!;
    const citizen = makeNpc(EntityIdSchema.parse('npc_citizen_witness'), 'CITIZEN', 4);
    const guard = makeNpc(guardId, 'GUARD', 6);
    world = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: { ...p, position: { x: 2, y: 5, stratum: 'STREET', blocksMovement: true, blocksSight: false } },
        [citizen.id]: citizen,
        [guardId]: guard,
      },
    };

    const initialRep = world.economy.factionReputation['CROWN_CONSTABULARY'] ?? 0;
    const reportRes = dispatchCommand(world, {
      type: 'REPORT_CRIME',
      witnessId: citizen.id,
      perpetratorId: playerId,
      crime: 'THEFT',
    });

    expect(reportRes.events.some((e) => e.type === 'WITNESS_CRIME_REPORTED')).toBe(true);
    const nextRep = reportRes.state.economy.factionReputation['CROWN_CONSTABULARY'] ?? 0;
    expect(nextRep).toBeLessThan(initialRep);
  });
});
