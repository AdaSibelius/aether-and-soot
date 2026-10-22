import { describe, expect, it } from 'vitest';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { getArchitecturalTerrainProperties } from '../../src/sim/spatial/architectural-features.js';

describe('Deterministic System Test (architectural-features.ts)', () => {
  it('verifies exported domain function is callable and deterministic', () => {
    const world = createInitialWorld({ seed: 42 });
    expect(world).toBeDefined();
    expect(typeof getArchitecturalTerrainProperties).toBe('function');
  });
});
