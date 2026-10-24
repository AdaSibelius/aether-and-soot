import { describe, expect, it } from 'vitest';
import { EntityRecord } from '../../src/schemas/components.schema.js';
import { EntityIdSchema, StratumId } from '../../src/schemas/primitives.schema.js';
import { createAppliedResolution, createRejectedResolution } from '../../src/sim/core/command-resolution.js';
import { SeededRNG } from '../../src/sim/core/rng.js';
import { STANDARD_ACTION_AP } from '../../src/sim/core/scheduler.js';
import {
  advancePerception,
  advanceTemporalState,
  advanceWorldEnvironment,
  executeSimulationPhases,
} from '../../src/sim/core/simulation-pipeline.js';
import { createInitialWorld, WorldState } from '../../src/sim/core/world.js';
import { createDefaultNpcAnatomy } from '../../src/sim/systems/district-spawner.js';

describe('Phase ARCH-2.2: Statically-Typed Simulation Pipeline', () => {
  const playerId = EntityIdSchema.parse('actor_player');
  const guardId = EntityIdSchema.parse('actor_patrol_guard');
  const streetStratum: StratumId = 'STREET';

  function createPipelineFixture(): { world: WorldState; initialTurn: number } {
    let world = createInitialWorld({ seed: 999, width: 16, height: 16 });

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

  it('runs advanceWorldEnvironment in isolation for autonomous NPCs and thermodynamics', () => {
    const { world } = createPipelineFixture();
    const rng = new SeededRNG(world.rngState);

    const env = advanceWorldEnvironment(world, rng, 1);
    expect(env.state).toBeDefined();
    expect(Array.isArray(env.events)).toBe(true);
  });

  it('runs advanceTemporalState in isolation, deducting AP and advancing turn schedule', () => {
    const { world, initialTurn } = createPipelineFixture();
    const rng = new SeededRNG(world.rngState);
    const initialEnergy = world.entities[playerId]!.actor!.energy;

    const temporal = advanceTemporalState(world, playerId, STANDARD_ACTION_AP, [], rng, 1);
    expect(temporal.state.turnCount).toBe(initialTurn + 1);
    // Player spent 100 AP, gained speed (100) -> energy stays 100
    expect(temporal.state.entities[playerId]!.actor!.energy).toBe(initialEnergy);
  });

  it('runs advancePerception in isolation, marking visible tiles as explored', () => {
    const { world } = createPipelineFixture();

    const perceptionState = advancePerception(world, playerId);
    const grid = perceptionState.strata[streetStratum]!;
    // Player at (1, 1), tile (1, 1) should be explored
    const playerCell = grid.cells[1 * 16 + 1]!;
    expect(playerCell.explored).toBe(true);
  });

  it('sequences all phases via executeSimulationPhases for applied advancing commands', () => {
    const { world, initialTurn } = createPipelineFixture();
    const rng = new SeededRNG(world.rngState);

    const resolution = createAppliedResolution(world, [], STANDARD_ACTION_AP, true, 1);
    const result = executeSimulationPhases(resolution, playerId, rng);

    expect(result.resolution.status).toBe('applied');
    expect(result.state.turnCount).toBe(initialTurn + 1);
    const grid = result.state.strata[streetStratum]!;
    expect(grid.cells[1 * 16 + 1]!.explored).toBe(true);
  });

  it('bypasses environmental ticks in executeSimulationPhases when resolution.advancesTime is false', () => {
    const { world, initialTurn } = createPipelineFixture();
    const rng = new SeededRNG(world.rngState);
    const initialGuardPos = { ...world.entities[guardId]!.position! };

    const resolution = createAppliedResolution(world, [], 0, false, 0);
    const result = executeSimulationPhases(resolution, playerId, rng);

    expect(result.resolution.status).toBe('applied');
    expect(result.state.turnCount).toBe(initialTurn);
    expect(result.state.entities[guardId]!.position).toEqual(initialGuardPos);
  });

  it('returns immediately in executeSimulationPhases without mutating state when rejected', () => {
    const { world, initialTurn } = createPipelineFixture();
    const rng = new SeededRNG(world.rngState);

    const resolution = createRejectedResolution(world, 'TEST_REJECTION', []);
    const result = executeSimulationPhases(resolution, playerId, rng);

    expect(result.resolution.status).toBe('rejected');
    expect(result.state.turnCount).toBe(initialTurn);
    expect(result.state).toBe(world);
  });
});
