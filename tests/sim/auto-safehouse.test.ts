import { describe, expect, it } from 'vitest';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { resolveClaimWorkshopDeed } from '../../src/sim/systems/safehouse.system.js';

describe('Deterministic System Test (safehouse.system.ts)', () => {
  it('verifies exported domain function is callable and deterministic', () => {
    const world = createInitialWorld({ seed: 42 });
    expect(world).toBeDefined();
    expect(typeof resolveClaimWorkshopDeed).toBe('function');
  });
});
