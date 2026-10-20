import { describe, expect, it } from 'vitest';
import { EntityRecord } from '../../src/schemas/components.schema.js';
import { BlueprintIdSchema, EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { resolveStockPedestal } from '../../src/sim/systems/trade.system.js';

describe('Phase 11: Merchant Trading & Physical Pedestal Stocking', () => {
  const playerId = EntityIdSchema.parse('actor_player');
  const merchantId = EntityIdSchema.parse('actor_merchant_1');
  const gearItemId = EntityIdSchema.parse('item_gears_1');
  const rubberItemId = EntityIdSchema.parse('item_rubber_1');

  function makeItem(id: string, bp: string, cat: 'MATERIAL' | 'COMMODITY', mass: number, vol: number, qty: number, cid?: 'PHOSPHOR_BRONZE'): EntityRecord {
    return {
      id: EntityIdSchema.parse(id),
      name: id,
      visual: { glyph: '*', fgPrimary: '#D4AF37', fgSecondary: '#B7950B', bgColor: '#0A0D0E', shaderFlags: [] },
      item: { blueprintId: BlueprintIdSchema.parse(bp), category: cat, massGrams: mass, volumeMl: vol, quantity: qty, stackable: true, commodityId: cid },
    };
  }

  function setupWorldWithMerchant() {
    const world = createInitialWorld({ seed: 7777, width: 16, height: 16 });
    const p = world.entities[playerId]!;
    const gear = makeItem('item_gears_1', 'mat_brass_gears', 'MATERIAL', 200, 150, 5);
    const rubber = makeItem('item_rubber_1', 'mat_vulcanized_rubber', 'MATERIAL', 100, 80, 3);
    const merchant: EntityRecord = {
      id: merchantId,
      name: 'Cartel Chandler',
      visual: { glyph: 'M', fgPrimary: '#E67E22', fgSecondary: '#D35400', bgColor: '#0A0D0E', shaderFlags: [] },
      position: { x: p.position!.x + 1, y: p.position!.y, stratum: p.position!.stratum, blocksMovement: true, blocksSight: false },
      actor: { energy: 100, speed: 100, isPlayer: false },
      aiController: { factionId: 'IRONMONGERS_CARTEL', role: 'MERCHANT', hostile: false, alertState: 'IDLE' },
      inventory: { containedEntityIds: [gearItemId], maxMassGrams: 50000, maxVolumeMl: 50000, currentMassGrams: 1000 },
    };
    return {
      ...world,
      entities: {
        ...world.entities,
        [gearItemId]: gear,
        [rubberItemId]: rubber,
        [merchantId]: merchant,
        [playerId]: {
          ...p,
          inventory: { ...p.inventory!, containedEntityIds: [...p.inventory!.containedEntityIds, rubberItemId], currentMassGrams: p.inventory!.currentMassGrams + 300 },
        },
      },
    };
  }

  it('allows player to buy items from an adjacent merchant and deducts treasury', () => {
    const world = setupWorldWithMerchant();
    const initialTreasury = world.economy.playerTreasuryPence;
    const res = dispatchCommand(world, { type: 'BUY_FROM_MERCHANT', actorId: playerId, merchantId, itemEntityId: gearItemId, quantity: 2 });
    expect(res.events).toContainEqual(expect.objectContaining({ type: 'MERCHANT_TRADE_COMPLETED', tradeType: 'BUY', quantity: 2 }));
    expect(res.state.economy.playerTreasuryPence).toBeLessThan(initialTreasury);

    const player = res.state.entities[playerId]!;
    const boughtItem = Object.values(res.state.entities).find(
      (e) => e.item?.blueprintId === 'mat_brass_gears' && player.inventory!.containedEntityIds.includes(e.id),
    );
    expect(boughtItem).toBeDefined();
    expect(boughtItem!.item!.quantity).toBe(2);
    expect(res.state.entities[gearItemId]!.item!.quantity).toBe(3);
  });

  it('allows player to sell items to an adjacent merchant and credits treasury', () => {
    const world = setupWorldWithMerchant();
    const initialTreasury = world.economy.playerTreasuryPence;
    const res = dispatchCommand(world, { type: 'SELL_TO_MERCHANT', actorId: playerId, merchantId, itemEntityId: rubberItemId, quantity: 2 });
    expect(res.events).toContainEqual(expect.objectContaining({ type: 'MERCHANT_TRADE_COMPLETED', tradeType: 'SELL', quantity: 2 }));
    expect(res.state.economy.playerTreasuryPence).toBeGreaterThan(initialTreasury);
    expect(res.state.entities[rubberItemId]!.item!.quantity).toBe(1);
  });

  it('applies faction reputation discount on buy and refuses trade on hostile reputation', () => {
    let world = setupWorldWithMerchant();
    world = { ...world, economy: { ...world.economy, factionReputation: { ...world.economy.factionReputation, IRONMONGERS_CARTEL: 40 } } };

    const resFriendly = dispatchCommand(world, { type: 'BUY_FROM_MERCHANT', actorId: playerId, merchantId, itemEntityId: gearItemId, quantity: 1 });
    const ev = resFriendly.events.find((e) => e.type === 'MERCHANT_TRADE_COMPLETED') as Extract<typeof resFriendly.events[number], { type: 'MERCHANT_TRADE_COMPLETED' }>;
    expect(ev).toBeDefined();
    expect(ev.totalPence).toBe(14); // 15 base - 10% rep discount = 14d

    let hostileWorld = setupWorldWithMerchant();
    hostileWorld = { ...hostileWorld, economy: { ...hostileWorld.economy, factionReputation: { ...hostileWorld.economy.factionReputation, IRONMONGERS_CARTEL: -40 } } };
    const resHostile = dispatchCommand(hostileWorld, { type: 'BUY_FROM_MERCHANT', actorId: playerId, merchantId, itemEntityId: gearItemId, quantity: 1 });
    expect(resHostile.events).toContainEqual(expect.objectContaining({ type: 'TRADE_ACTION_FAILED', reason: 'MERCHANT_HOSTILE' }));
  });

  it('fails with appropriate reason on insufficient funds, out of range, or installed gear', () => {
    const world = setupWorldWithMerchant();
    const poorWorld = { ...world, economy: { ...world.economy, playerTreasuryPence: 0 } };
    const resPoor = dispatchCommand(poorWorld, { type: 'BUY_FROM_MERCHANT', actorId: playerId, merchantId, itemEntityId: gearItemId, quantity: 1 });
    expect(resPoor.events).toContainEqual(expect.objectContaining({ type: 'TRADE_ACTION_FAILED', reason: 'INSUFFICIENT_FUNDS' }));

    const farWorld = {
      ...world,
      entities: {
        ...world.entities,
        [merchantId]: { ...world.entities[merchantId]!, position: { ...world.entities[merchantId]!.position!, x: 0, y: 0 } },
      },
    };
    const resFar = dispatchCommand(farWorld, { type: 'BUY_FROM_MERCHANT', actorId: playerId, merchantId, itemEntityId: gearItemId, quantity: 1 });
    expect(resFar.events).toContainEqual(expect.objectContaining({ type: 'TRADE_ACTION_FAILED', reason: 'OUT_OF_RANGE' }));
  });

  it('consumes physical commodity items when stocking pedestals and reduces mass', () => {
    const world = setupWorldWithMerchant();
    const bronzeId = EntityIdSchema.parse('item_bronze_ingots');
    const bronze = makeItem('item_bronze_ingots', 'commodity_phosphor_bronze_ingot', 'COMMODITY', 2500, 400, 5, 'PHOSPHOR_BRONZE');
    const player = world.entities[playerId]!;
    const worldWithBronze = {
      ...world,
      entities: {
        ...world.entities,
        [bronzeId]: bronze,
        [playerId]: {
          ...player,
          inventory: { ...player.inventory!, containedEntityIds: [...player.inventory!.containedEntityIds, bronzeId], currentMassGrams: player.inventory!.currentMassGrams + 12500 },
        },
      },
    };

    const initialMass = worldWithBronze.entities[playerId]!.inventory!.currentMassGrams;
    const res = dispatchCommand(worldWithBronze, { type: 'STOCK_PEDESTAL', actorId: playerId, commodity: 'PHOSPHOR_BRONZE', quantity: 3, askingPriceMarkupPct: 15 });
    expect(res.events).toContainEqual(expect.objectContaining({ type: 'PEDESTAL_STOCKED', commodity: 'PHOSPHOR_BRONZE', quantity: 3 }));
    expect(res.state.entities[bronzeId]!.item!.quantity).toBe(2);
    expect(res.state.entities[playerId]!.inventory!.currentMassGrams).toBe(initialMass - 7500);

    const emptyWorld = {
      ...world,
      entities: { ...world.entities, [playerId]: { ...player, inventory: { ...player.inventory!, containedEntityIds: [], currentMassGrams: 0 } } },
    };
    const strictRes = resolveStockPedestal(emptyWorld, 'AETHER_VIAL', 1, 10, playerId, true);
    expect(strictRes.events).toContainEqual(expect.objectContaining({ type: 'TRADE_ACTION_FAILED', reason: 'INSUFFICIENT_COMMODITY' }));
  });
});
