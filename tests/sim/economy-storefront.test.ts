import { describe, expect, it } from 'vitest';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { SeededRNG } from '../../src/sim/core/rng.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { advanceDistrictEconomyMacroTick } from '../../src/sim/systems/economy.system.js';

import { createEntityFromBlueprint } from '../../src/sim/data/item-catalog.js';

describe('Phase 6: Factions, Macro-Tick Commodity Economy & Player Storefront', () => {
  const playerId = EntityIdSchema.parse('actor_player');

  it('maintains bounded commodity prices with zero NaN or runaway inflation across 500 Macro-Ticks', () => {
    let world = createInitialWorld({ seed: 6060, width: 16, height: 16 });
    const rng = new SeededRNG(world.rngState);

    for (let tick = 1; tick <= 500; tick++) {
      const res = advanceDistrictEconomyMacroTick(world, rng, tick * 100);
      world = {
        ...world,
        economy: res.economy,
      };

      for (const quote of Object.values(world.economy.marketQuotes)) {
        expect(Number.isFinite(quote.currentPricePence)).toBe(true);
        const minAllowed = Math.max(1, Math.floor(quote.basePricePence * 0.35));
        const maxAllowed = Math.ceil(quote.basePricePence * 3.5);
        expect(quote.currentPricePence).toBeGreaterThanOrEqual(minAllowed);
        expect(quote.currentPricePence).toBeLessThanOrEqual(maxAllowed);
      }
    }
  });

  it('spikes commodity price and shifts faction reputation when a supply shock occurs', () => {
    let world = createInitialWorld({ seed: 6061, width: 16, height: 16 });
    const initialCoalPrice = world.economy.marketQuotes.ANTHRACITE_COAL!.currentPricePence;
    const initialRep = world.economy.factionReputation.IRONMONGERS_CARTEL!;

    // Sabotage coal supply (-65 units)
    const shockRes = dispatchCommand(world, {
      type: 'TRIGGER_SUPPLY_SHOCK',
      actorId: playerId,
      commodity: 'ANTHRACITE_COAL',
      supplyDelta: -65,
      factionAffected: 'IRONMONGERS_CARTEL',
      reputationDelta: -25,
    });
    world = shockRes.state;

    const spikedPrice = world.economy.marketQuotes.ANTHRACITE_COAL!.currentPricePence;
    expect(spikedPrice).toBeGreaterThan(initialCoalPrice * 2);
    expect(world.economy.factionReputation.IRONMONGERS_CARTEL).toBe(initialRep - 25);
  });

  it('executes storefront display pedestal sales during the 100-turn Macro-Tick and credits player treasury', () => {
    let world = createInitialWorld({ seed: 6062, width: 16, height: 16 });
    const initialTreasury = world.economy.playerTreasuryPence;

    // Seed player with 4 units of PHOSPHOR_BRONZE
    const bronzeEid = EntityIdSchema.parse('item_bronze_stock');
    const bronzeItem = createEntityFromBlueprint('commodity_phosphor_bronze_ingot', bronzeEid, 4)!;
    const player = world.entities[playerId]!;
    world = {
      ...world,
      entities: {
        ...world.entities,
        [bronzeEid]: bronzeItem,
        [playerId]: {
          ...player,
          inventory: {
            ...player.inventory!,
            containedEntityIds: [...(player.inventory?.containedEntityIds ?? []), bronzeEid],
            currentMassGrams: bronzeItem.item!.massGrams * 4,
          },
        },
      },
    };

    // Stock 4 units of PHOSPHOR_BRONZE at a 10% markup on Turn 1
    const stockRes = dispatchCommand(world, {
      type: 'STOCK_PEDESTAL',
      actorId: playerId,
      commodity: 'PHOSPHOR_BRONZE',
      quantity: 4,
      askingPriceMarkupPct: 10,
    });
    world = stockRes.state;

    // Advance 99 more turns to hit Turn 100 (Macro-Tick #1)
    let turn100Events = stockRes.events;
    for (let t = 2; t <= 100; t++) {
      const waitRes = dispatchCommand(world, {
        type: 'WAIT_TURN',
        actorId: playerId,
      });
      world = waitRes.state;
      if (t === 100) {
        turn100Events = waitRes.events;
      }
    }

    expect(turn100Events).toContainEqual(
      expect.objectContaining({
        type: 'STOREFRONT_SALE_COMPLETED',
        commodity: 'PHOSPHOR_BRONZE',
      }),
    );
    expect(world.economy.playerTreasuryPence).toBeGreaterThan(initialTreasury);
  });
});
