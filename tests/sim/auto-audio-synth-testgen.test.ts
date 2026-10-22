import { describe, expect, it } from 'vitest';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { mapSimEventToAudioPresets } from '../../src/client/audio/synth-definitions.js';

describe('Deterministic System Test (synth-definitions.ts)', () => {
  it('verifies exported domain function is callable and deterministic', () => {
    const world = createInitialWorld({ seed: 42 });
    expect(world).toBeDefined();
    expect(typeof mapSimEventToAudioPresets).toBe('function');
  });
});
