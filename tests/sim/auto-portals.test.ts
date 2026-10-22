import { describe, expect, it } from 'vitest';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { findPortalAtPoint } from '../../src/sim/spatial/portals.js';

describe('Auto-Generated System Test (portals.ts)', () => {
  it('executes deterministic system function with valid world state', () => {
    const world = createInitialWorld({ seed: 42 });
    const portal = findPortalAtPoint(world.entities, { x: 24, y: 18, stratum: 'STREET' });
    expect(portal).toBeDefined();
    expect(portal?.portal).toBeDefined();
  });
});
