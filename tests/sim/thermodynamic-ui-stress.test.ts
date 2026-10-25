import { describe, expect, it } from 'vitest';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { resolveThermodynamicStress } from '../../src/client/renderer/steampunk-shader.js';

describe('Thermodynamic Stress Telemetry & Shaders', () => {
  const playerId = EntityIdSchema.parse('actor_player');

  it('reports NOMINAL stress during standard operating conditions', () => {
    const state = createInitialWorld({ seed: 100 });
    const player = state.entities[playerId];
    if (player?.anatomy) {
      player.anatomy.steamReserveKpa = 25;
      player.anatomy.maxSteamReserveKpa = 100;
      player.anatomy.strainLoadKw = 10;
      player.anatomy.governorCapacityKw = 100;
      player.anatomy.toxicityPct = 0;
    }

    const result = resolveThermodynamicStress(state, playerId);
    expect(result.stressLevel).toBe('NOMINAL');
    expect(result.stressValue).toBeLessThan(0.4);
    expect(result.reason).toBe('NOMINAL_OPERATION');
  });

  it('transitions to ELEVATED thermal strain when boiler or governor load crosses 50%', () => {
    const state = createInitialWorld({ seed: 100 });
    const player = state.entities[playerId];
    if (player?.anatomy) {
      player.anatomy.steamReserveKpa = 65;
      player.anatomy.maxSteamReserveKpa = 100;
      player.anatomy.strainLoadKw = 55;
      player.anatomy.governorCapacityKw = 100;
    }

    const result = resolveThermodynamicStress(state, playerId);
    expect(result.stressLevel).toBe('ELEVATED');
    expect(result.stressValue).toBeGreaterThanOrEqual(0.5);
    expect(result.reason).toBe('ELEVATED_THERMAL_LOAD');
  });

  it('triggers CRITICAL thermodynamic stress when steam reaches dangerous limits (>= 90 kPa)', () => {
    const state = createInitialWorld({ seed: 100 });
    const player = state.entities[playerId];
    if (player?.anatomy) {
      player.anatomy.steamReserveKpa = 96;
      player.anatomy.maxSteamReserveKpa = 100;
    }

    const result = resolveThermodynamicStress(state, playerId);
    expect(result.stressLevel).toBe('CRITICAL');
    expect(result.stressValue).toBeGreaterThanOrEqual(0.85);
    expect(result.reason).toBe('CRITICAL_BOILER_PRESSURE');
  });

  it('subsides back to NOMINAL state when boiler vents steam and recovers', () => {
    const state = createInitialWorld({ seed: 100 });
    const player = state.entities[playerId];
    if (player?.anatomy) {
      // 1. Critical spike
      player.anatomy.steamReserveKpa = 95;
      const criticalResult = resolveThermodynamicStress(state, playerId);
      expect(criticalResult.stressLevel).toBe('CRITICAL');

      // 2. Steam vented back to safe reservoir
      player.anatomy.steamReserveKpa = 30;
      const recoveredResult = resolveThermodynamicStress(state, playerId);
      expect(recoveredResult.stressLevel).toBe('NOMINAL');
      expect(recoveredResult.stressValue).toBeLessThan(0.4);
    }
  });
});
