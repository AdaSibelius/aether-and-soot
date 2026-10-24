import { describe, expect, it } from 'vitest';
import { EntityRecord } from '../../src/schemas/components.schema.js';
import { EntityIdSchema, StratumId } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { SeededRNG } from '../../src/sim/core/rng.js';
import { advanceTurnSchedule, STANDARD_ACTION_AP } from '../../src/sim/core/scheduler.js';
import { createInitialWorld, WorldState } from '../../src/sim/core/world.js';
import { createDefaultNpcAnatomy } from '../../src/sim/systems/district-spawner.js';

describe('Phase ARCH-1.2: Simulation Clock & Action Point Formalization', () => {
  const playerId = EntityIdSchema.parse('actor_player');
  const guardId = EntityIdSchema.parse('actor_patrol_guard');
  const streetStratum: StratumId = 'STREET';

  function createTestFixture(): { world: WorldState; initialTurn: number } {
    let world = createInitialWorld({ seed: 888, width: 16, height: 16 });

    const player = world.entities[playerId]!;
    const guard: EntityRecord = {
      id: guardId,
      name: 'Constabulary Patrolman',
      visual: { glyph: 'G', fgPrimary: '#3498DB', fgSecondary: '#2980B9', bgColor: '#0A0D0E', shaderFlags: [] },
      position: { x: 5, y: 5, stratum: streetStratum, blocksMovement: true, blocksSight: false },
      actor: { energy: 100, speed: 100, isPlayer: false },
      aiController: { factionId: 'CROWN_CONSTABULARY', role: 'GUARD', hostile: false, alertState: 'IDLE' },
      anatomy: createDefaultNpcAnatomy(),
    };

    world = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...player,
          position: { x: 1, y: 1, stratum: streetStratum, blocksMovement: true, blocksSight: false },
          actor: { ...player.actor!, energy: 100, speed: 100 },
        },
        [guardId]: guard,
      },
    };

    return { world, initialTurn: world.turnCount };
  }

  it('executes CONSULT_CODEX as a zero-time inspection without advancing simulation turn count or NPC movement', () => {
    const { world, initialTurn } = createTestFixture();
    const initialGuardPos = { ...world.entities[guardId]!.position! };

    const result = dispatchCommand(world, {
      type: 'CONSULT_CODEX',
      actorId: playerId,
      entryId: 'automaton_brass_weaver',
    });

    expect(result.resolution.status).toBe('applied');
    if (result.resolution.status === 'applied') {
      expect(result.resolution.advancesTime).toBe(false);
      expect(result.resolution.apSpent).toBe(0);
      expect(result.resolution.events.some((e) => e.type === 'CODEX_CONSULTED')).toBe(true);
    }

    // Simulation clock stays paused
    expect(result.state.turnCount).toBe(initialTurn);

    // Autonomous NPCs do not move
    expect(result.state.entities[guardId]?.position).toEqual(initialGuardPos);
  });

  it('executes WAIT_TURN as a full-turn action advancing simulation turn clock by 1 and ticking NPCs', () => {
    const { world, initialTurn } = createTestFixture();

    const result = dispatchCommand(world, {
      type: 'WAIT_TURN',
      actorId: playerId,
    });

    expect(result.resolution.status).toBe('applied');
    if (result.resolution.status === 'applied') {
      expect(result.resolution.advancesTime).toBe(true);
      expect(result.resolution.apSpent).toBe(STANDARD_ACTION_AP);
      expect(result.resolution.simulationTicks).toBe(1);
    }

    // World clock advances by 1
    expect(result.state.turnCount).toBe(initialTurn + 1);
  });

  it('deducts AP without advancing turn clock when advanceTurnSchedule is called with ticks=0', () => {
    const { world, initialTurn } = createTestFixture();
    const rng = new SeededRNG(world.rngState);
    const initialEnergy = world.entities[playerId]!.actor!.energy;

    const scheduled = advanceTurnSchedule(world, playerId, 50, [], rng, 0);

    // Turn count is unchanged
    expect(scheduled.state.turnCount).toBe(initialTurn);

    // Energy is deducted by 50 without speed initiative recovery
    expect(scheduled.state.entities[playerId]!.actor!.energy).toBe(initialEnergy - 50);
  });

  it('supports explicit multi-tick intervals in advanceTurnSchedule, scaling speed recovery and metabolism', () => {
    const { world, initialTurn } = createTestFixture();
    const rng = new SeededRNG(world.rngState);
    const initialEnergy = world.entities[playerId]!.actor!.energy;
    const playerSpeed = world.entities[playerId]!.actor!.speed;

    // Simulate a 3-tick extended operation (e.g., prolonged rest or heavy machinery operation)
    const scheduled = advanceTurnSchedule(world, playerId, 200, [], rng, 3);

    // Turn count advances by 3
    expect(scheduled.state.turnCount).toBe(initialTurn + 3);

    // Energy accounts for AP cost plus 3 ticks of speed recovery
    expect(scheduled.state.entities[playerId]!.actor!.energy).toBe(initialEnergy - 200 + playerSpeed * 3);
  });

  it('triggers MACRO_TICK_COMPLETED when multi-tick advancement crosses a 100-turn boundary', () => {
    const { world } = createTestFixture();
    const rng = new SeededRNG(world.rngState);

    // Set world turn to 98
    const primedWorld: WorldState = {
      ...world,
      turnCount: 98,
      macroTickCount: 0,
    };

    // Advance by 3 ticks (crosses 100 to 101)
    const scheduled = advanceTurnSchedule(primedWorld, playerId, STANDARD_ACTION_AP, [], rng, 3);

    expect(scheduled.state.turnCount).toBe(101);
    expect(scheduled.state.macroTickCount).toBe(1);
    expect(scheduled.allEvents.some((e) => e.type === 'MACRO_TICK_COMPLETED')).toBe(true);
  });
});
