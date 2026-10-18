import { describe, expect, it } from 'vitest';
import { FactionContract } from '../../src/schemas/contracts.schema.js';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { createEntityFromBlueprint } from '../../src/sim/data/item-catalog.js';
import { generateVictorianDistrict } from '../../src/sim/spatial/generator.js';
import { spawnDistrictNpcs } from '../../src/sim/systems/ai.system.js';
import { resolveAcceptContract, resolveCompleteContract, resolveHireCompanion } from '../../src/sim/systems/dialogue-quest.system.js';
import { resolveStockPedestal } from '../../src/sim/systems/trade.system.js';

describe('Phase 24: Grounded Economy, Live Spawns & Dialogue-to-Market Wiring', () => {
  const playerId = EntityIdSchema.parse('actor_player');
  const chirurgeonId = EntityIdSchema.parse('npc_apothecary_chirurgeon');
  const fixerId = EntityIdSchema.parse('npc_syndicate_fixer');
  const merchantId = EntityIdSchema.parse('npc_guild_merchant');
  const wardenId = EntityIdSchema.parse('npc_clockwork_warden');
  const boilerId = EntityIdSchema.parse('vessel_district_boiler');

  const movePlayerNear = (world: ReturnType<typeof createInitialWorld>, targetId: string) => {
    const pos = world.entities[targetId]!.position!;
    return {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: { ...world.entities[playerId]!, position: { x: pos.x + 1, y: pos.y, stratum: pos.stratum, blocksMovement: true, blocksSight: false } },
      },
    };
  };

  it('spawns a live Chirurgeon, Fixer, and 3 procedural FactionContracts in district generation', () => {
    const baseWorld = createInitialWorld({ seed: 0xfeedface, width: 48, height: 36 });
    const populated = spawnDistrictNpcs(generateVictorianDistrict(baseWorld).state).state;

    const chirurgeon = populated.entities[chirurgeonId];
    expect(chirurgeon).toBeDefined();
    expect(chirurgeon?.aiController?.role).toBe('CHIRURGEON');
    expect(chirurgeon?.aiController?.factionId).toBe('CLOCKWORK_GUILD');

    const fixer = populated.entities[fixerId];
    expect(fixer).toBeDefined();
    expect(fixer?.aiController?.role).toBe('FIXER');
    expect(fixer?.aiController?.factionId).toBe('UNDERCROFT_SYNDICATE');

    expect(populated.contracts.length).toBeGreaterThanOrEqual(3);
    const kinds = populated.contracts.map((c: FactionContract) => c.kind);
    expect(kinds).toContain('DELIVER_ITEM');
    expect(kinds).toContain('SLAY_HOSTILE');
    expect(kinds).toContain('PRESSURIZE_BOILER');

    const boilerContract = populated.contracts.find((c: FactionContract) => c.kind === 'PRESSURIZE_BOILER');
    expect(boilerContract?.issuerNpcId).toBe(fixerId);
    expect(boilerContract?.targetBlueprintOrEntityId).toBe('vessel_district_boiler');
  });

  it('completes PRESSURIZE_BOILER contract only after the target boiler is pressurized or ruptured', () => {
    const baseWorld = createInitialWorld({ seed: 0x1234, width: 48, height: 36 });
    let world = movePlayerNear(spawnDistrictNpcs(generateVictorianDistrict(baseWorld).state).state, fixerId);

    const contract = world.contracts.find((c: FactionContract) => c.kind === 'PRESSURIZE_BOILER')!;
    const acceptRes = resolveAcceptContract(world, playerId, contract.id);
    expect(acceptRes.events).toContainEqual(expect.objectContaining({ type: 'CONTRACT_ACCEPTED', contractId: contract.id }));
    world = acceptRes.state;

    // Fail before pressurized
    const failRes = resolveCompleteContract(world, playerId, contract.id);
    expect(failRes.events).toContainEqual(expect.objectContaining({ type: 'DIALOGUE_ACTION_FAILED', reason: 'BOILER_NOT_PRESSURIZED' }));

    // Overpressurize boiler past 260 kPa
    world = {
      ...world,
      entities: {
        ...world.entities,
        [boilerId]: { ...world.entities[boilerId]!, pressureVessel: { currentPressureKpa: 280, maxPressureKpa: 300, ruptured: false } },
      },
    };

    const prevTreasury = world.economy.playerTreasuryPence;
    const prevRep = world.economy.factionReputation.UNDERCROFT_SYNDICATE ?? 0;
    const completeRes = resolveCompleteContract(world, playerId, contract.id);

    expect(completeRes.events).toContainEqual(expect.objectContaining({ type: 'CONTRACT_COMPLETED', contractId: contract.id }));
    expect(completeRes.state.economy.playerTreasuryPence).toBe(prevTreasury + contract.rewardPence);
    expect(completeRes.state.economy.factionReputation.UNDERCROFT_SYNDICATE).toBe(prevRep + contract.rewardReputation);
  });

  it('enforces strict inventory consumption when stocking storefront pedestals', () => {
    const baseWorld = createInitialWorld({ seed: 0x9999, width: 48, height: 36 });
    let world = spawnDistrictNpcs(generateVictorianDistrict(baseWorld).state).state;

    const emptyPlayer = world.entities[playerId]!;
    world = {
      ...world,
      entities: { ...world.entities, [playerId]: { ...emptyPlayer, inventory: { ...emptyPlayer.inventory!, containedEntityIds: [], currentMassGrams: 0 } } },
    };

    // Default strict = true rejects when lacking commodity
    const failRes = resolveStockPedestal(world, 'ANTHRACITE_COAL', 2, 25, playerId);
    expect(failRes.events).toContainEqual(expect.objectContaining({ type: 'TRADE_ACTION_FAILED', reason: 'INSUFFICIENT_COMMODITY' }));

    const coalEid1 = EntityIdSchema.parse('item_test_coal_1');
    const coalEid2 = EntityIdSchema.parse('item_test_coal_2');
    const coal1 = createEntityFromBlueprint('commodity_anthracite_briquette', coalEid1, 1)!;
    const coal2 = createEntityFromBlueprint('commodity_anthracite_briquette', coalEid2, 1)!;

    world = {
      ...world,
      entities: {
        ...world.entities, [coalEid1]: coal1, [coalEid2]: coal2,
        [playerId]: { ...emptyPlayer, inventory: { ...emptyPlayer.inventory!, containedEntityIds: [coalEid1, coalEid2], currentMassGrams: coal1.item!.massGrams * 2 } },
      },
    };

    const initialMass = world.entities[playerId]!.inventory!.currentMassGrams;
    const stockRes = resolveStockPedestal(world, 'ANTHRACITE_COAL', 1, 25, playerId);

    expect(stockRes.events).toContainEqual(expect.objectContaining({ type: 'PEDESTAL_STOCKED', commodity: 'ANTHRACITE_COAL', quantity: 1 }));
    expect(stockRes.state.entities[coalEid1]).toBeUndefined();
    expect(stockRes.state.entities[coalEid2]).toBeDefined();
    expect(stockRes.state.entities[playerId]!.inventory!.currentMassGrams).toBe(initialMass - coal1.item!.massGrams);
    expect(stockRes.state.economy.storefrontListings).toContainEqual(expect.objectContaining({ commodity: 'ANTHRACITE_COAL', quantity: 1, askingPriceMarkupPct: 25 }));
  });

  it('restricts companion hiring to combat/street roles and rejects stationary service roles', () => {
    const baseWorld = createInitialWorld({ seed: 0x4321, width: 48, height: 36 });
    let world = { ...spawnDistrictNpcs(generateVictorianDistrict(baseWorld).state).state, economy: { ...baseWorld.economy, playerTreasuryPence: 200 } };

    // Merchant hire rejected
    let nearMerch = movePlayerNear(world, merchantId);
    const merchHire = resolveHireCompanion(nearMerch, playerId, merchantId);
    expect(merchHire.events).toContainEqual(expect.objectContaining({ type: 'DIALOGUE_ACTION_FAILED', reason: 'ROLE_NOT_HIREABLE' }));
    expect(merchHire.state.economy.playerTreasuryPence).toBe(200);

    // Chirurgeon hire rejected
    let nearDoc = movePlayerNear(world, chirurgeonId);
    const docHire = resolveHireCompanion(nearDoc, playerId, chirurgeonId);
    expect(docHire.events).toContainEqual(expect.objectContaining({ type: 'DIALOGUE_ACTION_FAILED', reason: 'ROLE_NOT_HIREABLE' }));
    expect(docHire.state.economy.playerTreasuryPence).toBe(200);

    // Guard (Warden) hire accepted
    let nearWarden = movePlayerNear(world, wardenId);
    const wardenHire = resolveHireCompanion(nearWarden, playerId, wardenId);
    expect(wardenHire.events).toContainEqual(expect.objectContaining({ type: 'COMPANION_RECRUITED', companionId: wardenId }));
    expect(wardenHire.state.entities[wardenId]?.aiController?.companionOfActorId).toBe(playerId);
    expect(wardenHire.state.economy.playerTreasuryPence).toBe(140);
  });

  it('triggers in-world market supply shock when a Foundry Boiler ruptures', () => {
    const baseWorld = createInitialWorld({ seed: 0x8888, width: 48, height: 36 });
    let world = generateVictorianDistrict(baseWorld).state;
    const initialCoalQuote = world.economy.marketQuotes.ANTHRACITE_COAL!;
    const initialRep = world.economy.factionReputation.IRONMONGERS_CARTEL ?? 0;

    const res = dispatchCommand(world, {
      type: 'PRESSURIZE_VESSEL', actorId: playerId, vesselEntityId: boilerId, pressureAddedKpa: 150,
    });

    expect(res.events).toContainEqual(expect.objectContaining({ type: 'VESSEL_RUPTURED', vesselEntityId: boilerId }));
    expect(res.events).toContainEqual(expect.objectContaining({ type: 'SUPPLY_SHOCK_TRIGGERED', commodity: 'ANTHRACITE_COAL', factionAffected: 'IRONMONGERS_CARTEL' }));

    const nextCoalQuote = res.state.economy.marketQuotes.ANTHRACITE_COAL!;
    expect(nextCoalQuote.supplyUnits).toBe(initialCoalQuote.supplyUnits - 60);
    expect(nextCoalQuote.currentPricePence).toBeGreaterThan(initialCoalQuote.currentPricePence);
    expect(res.state.economy.factionReputation.IRONMONGERS_CARTEL).toBe(initialRep - 15);
  });
});
