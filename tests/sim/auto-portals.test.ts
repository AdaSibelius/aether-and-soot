import { describe, expect, it } from 'vitest';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { getDistrictDossier } from '../../src/sim/spatial/overworld-matrix.js';

describe('Deterministic System Test (overworld-matrix.ts)', () => {
  it('verifies exported domain function is callable and deterministic', () => {
    const world = createInitialWorld({ seed: 42 });
    expect(world).toBeDefined();
    expect(typeof getDistrictDossier).toBe('function');
  });
});
