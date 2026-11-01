import { describe, expect, it } from 'vitest';
import { EntityRecord } from '../../src/schemas/components.schema.js';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { EscortConvoyRecord } from '../../src/schemas/skirmish-records.schema.js';
import { validateWorldInvariants } from '../../src/sim/core/invariants.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { createEntityFromBlueprint } from '../../src/sim/data/item-catalog.js';
import { createDefaultNpcAnatomy } from '../../src/sim/systems/ai.system.js';
import { restockAdjacentPedestal } from '../../src/sim/systems/npc-ecology-actions.js';
import { processDropItemDelivery } from '../../src/sim/systems/supply-escort.system.js';
import { resolveBuyFromMerchant } from '../../src/sim/systems/trade-buy.system.js';
import { resolveStockPedestal } from '../../src/sim/systems/trade-pedestal.js';
import { resolveSellToMerchant } from '../../src/sim/systems/trade-sell.system.js';

describe('Causal Economy, Currency Conservation & Physical Logistics', () => {
  const playerId = EntityIdSchema.parse('actor_player');
  const merchantId = EntityIdSchema.parse('npc_cartel_merchant');
  const pedestalId = EntityIdSchema.parse('pedestal_fixture_1');

  function makeMerchant(x = 5, y = 5, walletPence = 500): EntityRecord {
    return {
      id: merchantId,
      name: 'Cartel Factor',
      visual: { glyph: 'M', fgPrimary: '#D4AF37', fgSecondary: '#8B4513', bgColor: '#0A0D0E', shaderFlags: [] },
      actor: { isPlayer: false, energy: 100, speed: 100 },
      anatomy: createDefaultNpcAnatomy(30, 20),
      aiController: { factionId: 'IRONMONGERS_CARTEL', role: 'MERCHANT', hostile: false, alertState: 'IDLE' },
      position: { x, y, stratum: 'STREET', blocksMovement: true, blocksSight: false },
      merchant: { walletPence },
      inventory: { containedEntityIds: [], maxMassGrams: 50000, maxVolumeMl: 50000, currentMassGrams: 0 },
    };
  }

  it('couples micro-commerce with macro quotes and conserves currency', () => {
    let state = createInitialWorld({ seed: 123, width: 20, height: 20 });
    const merchant = makeMerchant(5, 5, 200);
    const coalItem = createEntityFromBlueprint('commodity_anthracite_briquette', EntityIdSchema.parse('item_coal_1'), 10)!;

    merchant.inventory!.containedEntityIds.push(coalItem.id);
    merchant.inventory!.currentMassGrams = coalItem.item!.massGrams * 10;

    const p = state.entities[playerId]!;
    state = {
      ...state,
      economy: { ...state.economy, playerTreasuryPence: 300 },
      entities: {
        ...state.entities,
        [playerId]: { ...p, position: { x: 5, y: 6, stratum: 'STREET', blocksMovement: true, blocksSight: false } },
        [merchantId]: merchant,
        [coalItem.id]: coalItem,
      },
    };

    const initialQuote = state.economy.marketQuotes.ANTHRACITE_COAL!;
    const buyRes = resolveBuyFromMerchant(state, playerId, merchantId, coalItem.id, 5);
    expect(buyRes.events.some((e) => e.type === 'MERCHANT_TRADE_COMPLETED')).toBe(true);

    const postBuyQuote = buyRes.state.economy.marketQuotes.ANTHRACITE_COAL!;
    expect(postBuyQuote.supplyUnits).toBe(initialQuote.supplyUnits - 5);
    expect(postBuyQuote.currentPricePence).toBeGreaterThanOrEqual(initialQuote.currentPricePence);

    const totalCost = buyRes.events[0]!.type === 'MERCHANT_TRADE_COMPLETED' ? buyRes.events[0]!.totalPence : 0;
    expect(buyRes.state.economy.playerTreasuryPence).toBe(300 - totalCost);
    expect(buyRes.state.entities[merchantId]!.merchant?.walletPence).toBe(200 + totalCost);

    const boughtItem = Object.values(buyRes.state.entities).find(
      (e) => e.item?.commodityId === 'ANTHRACITE_COAL' && buyRes.state.entities[playerId]!.inventory!.containedEntityIds.includes(e.id),
    )!;

    const sellRes = resolveSellToMerchant(buyRes.state, playerId, merchantId, boughtItem.id, 2);
    expect(sellRes.events.some((e) => e.type === 'MERCHANT_TRADE_COMPLETED')).toBe(true);

    const postSellQuote = sellRes.state.economy.marketQuotes.ANTHRACITE_COAL!;
    expect(postSellQuote.supplyUnits).toBe(postBuyQuote.supplyUnits + 2);
  });

  it('rejects selling when merchant coffer lacks sufficient funds', () => {
    let state = createInitialWorld({ seed: 123, width: 20, height: 20 });
    const poorMerchant = makeMerchant(5, 5, 2);
    const expensiveItem = createEntityFromBlueprint('commodity_anthracite_briquette', EntityIdSchema.parse('item_expensive_1'), 1)!;
    expensiveItem.item!.penceValue = 50;

    const p = state.entities[playerId]!;
    state = {
      ...state,
      entities: {
        ...state.entities,
        [playerId]: {
          ...p,
          position: { x: 5, y: 6, stratum: 'STREET', blocksMovement: true, blocksSight: false },
          inventory: { ...p.inventory!, containedEntityIds: [expensiveItem.id] },
        },
        [merchantId]: poorMerchant,
        [expensiveItem.id]: expensiveItem,
      },
    };

    const sellRes = resolveSellToMerchant(state, playerId, merchantId, expensiveItem.id, 1);
    expect(sellRes.events.some((e) => e.type === 'TRADE_ACTION_FAILED' && e.reason === 'INSUFFICIENT_FUNDS')).toBe(true);
    expect(sellRes.state.entities[merchantId]!.merchant?.walletPence).toBe(2);
  });

  it('enforces spatial destination bounds on escort convoy cargo deliveries', () => {
    let state = createInitialWorld({ seed: 456, width: 20, height: 20 });
    const cargoItem = createEntityFromBlueprint('commodity_anthracite_briquette', EntityIdSchema.parse('convoy_cargo_1'), 1)!;
    const convoy: EscortConvoyRecord = {
      convoyId: 'convoy_timber_1',
      clientFactionId: 'IRONMONGERS_CARTEL',
      destinationDistrictId: 'iron_quarter',
      destinationPos: { x: 10, y: 10, stratum: 'STREET' },
      cargoItemId: cargoItem.id,
      stage: 'IN_TRANSIT',
      escortCompanionIds: [],
      rewardPence: 75,
      startedTurn: 5,
    };

    state = {
      ...state,
      convoys: { [convoy.convoyId]: convoy },
      entities: { ...state.entities, [cargoItem.id]: cargoItem },
    };

    const outOfBoundsRes = processDropItemDelivery(state, playerId, cargoItem.id, { x: 15, y: 15, stratum: 'STREET' });
    expect(outOfBoundsRes.events.length).toBe(0);
    expect(outOfBoundsRes.state.convoys[convoy.convoyId]!.stage).toBe('IN_TRANSIT');

    const wrongStratumRes = processDropItemDelivery(state, playerId, cargoItem.id, { x: 10, y: 10, stratum: 'UNDERCROFT' });
    expect(wrongStratumRes.events.length).toBe(0);

    const validDeliveryRes = processDropItemDelivery(state, playerId, cargoItem.id, { x: 11, y: 10, stratum: 'STREET' });
    expect(validDeliveryRes.events.some((e) => e.type === 'CONVOY_DELIVERY_CONFIRMED')).toBe(true);
    expect(validDeliveryRes.state.convoys[convoy.convoyId]!.stage).toBe('DELIVERED');
    expect(validDeliveryRes.state.economy.playerTreasuryPence).toBe(state.economy.playerTreasuryPence + 75);
  });

  it('restocks adjacent pedestals without creating dangling pointers or breaking invariants', () => {
    let state = createInitialWorld({ seed: 789, width: 20, height: 20 });
    const merchant = makeMerchant(5, 5, 200);
    const singleItem = createEntityFromBlueprint('commodity_anthracite_briquette', EntityIdSchema.parse('item_single_1'), 1)!;
    merchant.inventory!.containedEntityIds.push(singleItem.id);
    merchant.inventory!.currentMassGrams = singleItem.item!.massGrams;

    const pedestal: EntityRecord = {
      id: pedestalId,
      name: 'Trade Pedestal',
      visual: { glyph: 'π', fgPrimary: '#2ECC71', fgSecondary: '#27AE60', bgColor: '#0A0D0E', shaderFlags: [] },
      position: { x: 5, y: 6, stratum: 'STREET', blocksMovement: true, blocksSight: false },
      tradePedestal: { pricePence: 20 },
    };

    state = {
      ...state,
      entities: {
        ...state.entities,
        [merchantId]: merchant,
        [pedestalId]: pedestal,
        [singleItem.id]: singleItem,
      },
    };

    const restockSingle = restockAdjacentPedestal(state, merchant);
    expect(restockSingle).toBeDefined();
    const updatedPedestal = restockSingle!.state.entities[pedestalId]!;
    const itemPointerId = updatedPedestal.tradePedestal!.itemEntityId!;
    expect(itemPointerId).toBeDefined();
    expect(restockSingle!.state.entities[itemPointerId]).toBeDefined();

    const violationsSingle = validateWorldInvariants(restockSingle!.state);
    expect(violationsSingle).toEqual([]);

    let multiState = createInitialWorld({ seed: 790, width: 20, height: 20 });
    const multiItem = createEntityFromBlueprint('commodity_anthracite_briquette', EntityIdSchema.parse('item_multi_1'), 5)!;
    const freshMerchant = makeMerchant(5, 5, 200);
    freshMerchant.inventory!.containedEntityIds.push(multiItem.id);
    freshMerchant.inventory!.currentMassGrams = multiItem.item!.massGrams * 5;

    const freshPedestal: EntityRecord = {
      ...pedestal,
      tradePedestal: { pricePence: 20 },
    };

    multiState = {
      ...multiState,
      entities: {
        ...multiState.entities,
        [merchantId]: freshMerchant,
        [pedestalId]: freshPedestal,
        [multiItem.id]: multiItem,
      },
    };

    const restockMulti = restockAdjacentPedestal(multiState, freshMerchant);
    expect(restockMulti).toBeDefined();
    const multiPedestal = restockMulti!.state.entities[pedestalId]!;
    const splitPointerId = multiPedestal.tradePedestal!.itemEntityId!;
    expect(splitPointerId).toBeDefined();
    expect(restockMulti!.state.entities[splitPointerId]).toBeDefined();
    expect(restockMulti!.state.entities[multiItem.id]).toBeDefined();
    expect(restockMulti!.state.entities[multiItem.id]!.item!.quantity).toBe(4);

    const violationsMulti = validateWorldInvariants(restockMulti!.state);
    expect(violationsMulti).toEqual([]);
  });

  it('unifies resolveStockPedestal with adjacent in-world TradePedestalComponent', () => {
    let state = createInitialWorld({ seed: 999, width: 20, height: 20 });
    const coal = createEntityFromBlueprint('commodity_anthracite_briquette', EntityIdSchema.parse('player_coal_1'), 2)!;
    const p = state.entities[playerId]!;

    const pedestal: EntityRecord = {
      id: pedestalId,
      name: 'Trade Pedestal',
      visual: { glyph: 'π', fgPrimary: '#2ECC71', fgSecondary: '#27AE60', bgColor: '#0A0D0E', shaderFlags: [] },
      position: { x: 10, y: 11, stratum: 'STREET', blocksMovement: true, blocksSight: false },
      tradePedestal: { pricePence: 10 },
    };

    state = {
      ...state,
      entities: {
        ...state.entities,
        [playerId]: {
          ...p,
          position: { x: 10, y: 10, stratum: 'STREET', blocksMovement: true, blocksSight: false },
          inventory: { ...p.inventory!, containedEntityIds: [...p.inventory!.containedEntityIds, coal.id] },
        },
        [pedestalId]: pedestal,
        [coal.id]: coal,
      },
    };

    const stockRes = resolveStockPedestal(state, 'ANTHRACITE_COAL', 1, 20, playerId, true);
    expect(stockRes.events.some((e) => e.type === 'PEDESTAL_STOCKED')).toBe(true);

    const updatedPed = stockRes.state.entities[pedestalId]!;
    expect(updatedPed.tradePedestal?.commodityId).toBe('ANTHRACITE_COAL');
    expect(updatedPed.tradePedestal?.itemEntityId).toBeDefined();
    expect(stockRes.state.entities[updatedPed.tradePedestal!.itemEntityId!]).toBeDefined();

    const violations = validateWorldInvariants(stockRes.state);
    expect(violations).toEqual([]);
  });
});
