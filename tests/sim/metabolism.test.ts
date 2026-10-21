import { describe, expect, it } from 'vitest';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { createEntityFromBlueprint } from '../../src/sim/data/item-catalog.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import {
  advanceMetabolismTick,
  applyItemUseEffect,
} from '../../src/sim/systems/metabolism.system.js';

describe('Deterministic Metabolism System Test', () => {
  it('triggers TOXICITY_OVERDOSE and inflicts penalties when toxicity crosses 80%', () => {
    const world = createInitialWorld({ seed: 42 });
    const playerId = EntityIdSchema.parse('actor_player');
    const player = world.entities[playerId];
    expect(player?.anatomy).toBeDefined();

    // Set player toxicity directly to the overdose threshold
    const primedWorld = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...player!,
          anatomy: {
            ...player!.anatomy!,
            toxicityPct: 85,
            bloodVolumePct: 100,
          },
        },
      },
    };

    const tick = advanceMetabolismTick(primedWorld);
    const overdoseEv = tick.events.find((e) => e.type === 'TOXICITY_OVERDOSE');
    expect(overdoseEv).toBeDefined();
    if (overdoseEv && overdoseEv.type === 'TOXICITY_OVERDOSE') {
      expect(overdoseEv.actorId).toBe(playerId);
      expect(overdoseEv.toxicityPct).toBe(85);
      expect(overdoseEv.bloodVolumeLost).toBeGreaterThan(0);
    }

    const updatedPlayer = tick.state.entities[playerId];
    expect(updatedPlayer?.anatomy?.bloodVolumePct).toBeLessThan(100);
    // Toxicity decays by 1 per turn
    expect(updatedPlayer?.anatomy?.toxicityPct).toBe(84);
  });

  it('triggers WITHDRAWAL_ONSET when a stimulant effect expires', () => {
    const world = createInitialWorld({ seed: 42 });
    const playerId = EntityIdSchema.parse('actor_player');
    const player = world.entities[playerId];

    const buffedWorld = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...player!,
          anatomy: {
            ...player!.anatomy!,
            activeEffects: [{ effectId: 'stim_aether_rush', durationTurns: 1, magnitude: 25 }],
          },
        },
      },
    };

    const tick = advanceMetabolismTick(buffedWorld);
    const withdrawalEv = tick.events.find((e) => e.type === 'WITHDRAWAL_ONSET');
    expect(withdrawalEv).toBeDefined();
    if (withdrawalEv && withdrawalEv.type === 'WITHDRAWAL_ONSET') {
      expect(withdrawalEv.actorId).toBe(playerId);
      expect(withdrawalEv.effectId).toBe('stim_aether_rush');
      expect(withdrawalEv.penaltyAp).toBe(25);
    }

    const updatedPlayer = tick.state.entities[playerId];
    expect(updatedPlayer?.anatomy?.activeEffects.length).toBe(0);
  });

  it('applies alchemical consumption and evaluates overdose threshold during item use', () => {
    const world = createInitialWorld({ seed: 42 });
    const playerId = EntityIdSchema.parse('actor_player');
    const playerAnatomy = world.entities[playerId]!.anatomy!;

    const result = applyItemUseEffect(
      { ...playerAnatomy, toxicityPct: 70 },
      { kind: 'ALCHEMICAL', magnitude: 25, toxicityDelta: 20, staminaRestore: 30, appliedEffectId: 'stim_aether_rush' },
      playerId,
      1,
    );

    expect(result.nextAnatomy.toxicityPct).toBe(90);
    expect(result.nextAnatomy.activeEffects.some((e) => e.effectId === 'stim_aether_rush')).toBe(true);

    const alchemicalEv = result.alchemicalEvents.find((e) => e.type === 'ALCHEMICAL_CONSUMED');
    expect(alchemicalEv).toBeDefined();

    const overdoseEv = result.alchemicalEvents.find((e) => e.type === 'TOXICITY_OVERDOSE');
    expect(overdoseEv).toBeDefined();
  });

  it('integrates alchemical item use with engine command dispatch and scheduler tick', () => {
    const world = createInitialWorld({ seed: 42 });
    const playerId = EntityIdSchema.parse('actor_player');
    const tonicId = EntityIdSchema.parse('item_test_stimulant');
    const tonic = createEntityFromBlueprint('item_aether_salt_stimulant', tonicId, 1);
    expect(tonic).toBeDefined();

    const worldWithTonic = {
      ...world,
      entities: {
        ...world.entities,
        [tonicId]: tonic!,
        [playerId]: {
          ...world.entities[playerId]!,
          inventory: {
            ...world.entities[playerId]!.inventory!,
            containedEntityIds: [...world.entities[playerId]!.inventory!.containedEntityIds, tonicId],
          },
        },
      },
    };

    const res = dispatchCommand(worldWithTonic, {
      type: 'USE_ITEM',
      actorId: playerId,
      itemEntityId: tonicId,
    });

    const usedEv = res.events.find((e) => e.type === 'ITEM_USED');
    expect(usedEv).toBeDefined();

    const alchemicalEv = res.events.find((e) => e.type === 'ALCHEMICAL_CONSUMED');
    expect(alchemicalEv).toBeDefined();

    const finalPlayer = res.state.entities[playerId];
    expect(finalPlayer?.anatomy?.toxicityPct).toBeGreaterThan(0);
    expect(finalPlayer?.anatomy?.activeEffects.some((e) => e.effectId === 'stim_aether_rush')).toBe(true);
  });
});
