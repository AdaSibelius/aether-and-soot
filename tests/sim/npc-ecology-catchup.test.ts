import { describe, expect, it } from 'vitest';
import { EntityRecord } from '../../src/schemas/components.schema.js';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld, getShiftPhase, WorldState } from '../../src/sim/core/world.js';
import { createEntityFromBlueprint } from '../../src/sim/data/item-catalog.js';
import { setTileCell } from '../../src/sim/spatial/grid.js';
import { createDefaultNpcAnatomy } from '../../src/sim/systems/ai.system.js';
import { catchUpDistrictState } from '../../src/sim/systems/district-catchup.system.js';

describe('Phase 30: Diurnal Shift Clocks, Autonomous NPC Ecology & District Catch-Up', () => {
  const playerId = EntityIdSchema.parse('actor_player');
  const citizenId = EntityIdSchema.parse('npc_soot_worker');
  const merchantId = EntityIdSchema.parse('npc_cartel_merchant');
  const chirurgeonId = EntityIdSchema.parse('npc_district_chirurgeon');
  const pedestalId = EntityIdSchema.parse('pedestal_market_stall');

  function setupEcologyScenario(turnCount = 25): WorldState {
    const base = createInitialWorld({ seed: 777, width: 24, height: 24 });
    const tonic = createEntityFromBlueprint('item_coagulant_tonic', EntityIdSchema.parse('item_tonic_1'))!;

    const citizen: EntityRecord = {
      id: citizenId,
      name: 'Barnaby Finch',
      visual: { glyph: 'c', fgPrimary: '#D4AF37', fgSecondary: '#8B4513', bgColor: '#0A0D0E', shaderFlags: [] },
      actor: { isPlayer: false, energy: 100, speed: 100 },
      anatomy: createDefaultNpcAnatomy(30, 20),
      aiController: { factionId: 'IRONMONGERS_CARTEL', role: 'CITIZEN', hostile: false, alertState: 'IDLE' },
      position: { x: 10, y: 10, stratum: 'STREET', blocksMovement: true, blocksSight: false },
      schedule: {
        workAnchor: { x: 5, y: 5, stratum: 'STREET' },
        restAnchor: { x: 18, y: 18, stratum: 'STREET' },
        currentGoal: 'WORK',
      },
      inventory: { containedEntityIds: [tonic.id], maxMassGrams: 20000, maxVolumeMl: 20000, currentMassGrams: tonic.item?.massGrams ?? 100 },
    };

    const chirurgeon: EntityRecord = {
      id: chirurgeonId,
      name: 'Chirurgeon Vane',
      visual: { glyph: 'H', fgPrimary: '#2ECC71', fgSecondary: '#27AE60', bgColor: '#0A0D0E', shaderFlags: [] },
      actor: { isPlayer: false, energy: 100, speed: 100 },
      anatomy: createDefaultNpcAnatomy(40, 20),
      aiController: { factionId: 'CLOCKWORK_GUILD', role: 'CHIRURGEON', hostile: false, alertState: 'IDLE' },
      position: { x: 8, y: 10, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    };

    const tradeGoods = createEntityFromBlueprint('commodity_anthracite_briquette', EntityIdSchema.parse('item_coal_1'))!;

    const merchant: EntityRecord = {
      id: merchantId,
      name: 'Quartermaster Locke',
      visual: { glyph: 'M', fgPrimary: '#F4D03F', fgSecondary: '#D4AF37', bgColor: '#0A0D0E', shaderFlags: [] },
      actor: { isPlayer: false, energy: 100, speed: 100 },
      anatomy: createDefaultNpcAnatomy(40, 20),
      aiController: { factionId: 'CLOCKWORK_GUILD', role: 'MERCHANT', hostile: false, alertState: 'IDLE' },
      position: { x: 15, y: 15, stratum: 'STREET', blocksMovement: true, blocksSight: false },
      schedule: {
        workAnchor: { x: 15, y: 15, stratum: 'STREET' },
        restAnchor: { x: 20, y: 20, stratum: 'STREET' },
        currentGoal: 'WORK',
      },
      inventory: { containedEntityIds: [tradeGoods.id], maxMassGrams: 30000, maxVolumeMl: 30000, currentMassGrams: tradeGoods.item?.massGrams ?? 500 },
    };

    const pedestal: EntityRecord = {
      id: pedestalId,
      name: 'Market Trade Pedestal',
      visual: { glyph: 'P', fgPrimary: '#D4AF37', fgSecondary: '#7F8C8D', bgColor: '#0A0D0E', shaderFlags: [] },
      position: { x: 15, y: 16, stratum: 'STREET', blocksMovement: true, blocksSight: false },
      tradePedestal: { pricePence: 12 },
    };

    return {
      ...base,
      turnCount,
      entities: {
        ...base.entities,
        [tonic.id]: tonic,
        [tradeGoods.id]: tradeGoods,
        [citizenId]: citizen,
        [chirurgeonId]: chirurgeon,
        [merchantId]: merchant,
        [pedestalId]: pedestal,
        [playerId]: { ...base.entities[playerId]!, position: { x: 2, y: 2, stratum: 'STREET', blocksMovement: true, blocksSight: false } },
      },
    };
  }

  it('(a) auto-medicates wounded NPCs when carrying blood tonics, or seeks medical triage when depleted', () => {
    let world = setupEcologyScenario(25);
    // Wound citizen to 55% blood volume (<= 60%)
    world = {
      ...world,
      entities: {
        ...world.entities,
        [citizenId]: {
          ...world.entities[citizenId]!,
          anatomy: { ...world.entities[citizenId]!.anatomy!, bloodVolumePct: 55 },
        },
      },
    };

    // Advancing world turn lets citizen take turn
    const res = dispatchCommand(world, { type: 'WAIT_TURN', actorId: playerId });
    const afterCitizen = res.state.entities[citizenId]!;
    expect(res.events).toContainEqual(expect.objectContaining({ type: 'ITEM_USED', effect: 'RESTORE_BLOOD' }));
    expect(afterCitizen.anatomy!.bloodVolumePct).toBeGreaterThan(55);

    // Depleted tonic & blood <= 50% triggers SEEK_MEDICAL toward chirurgeon at (8, 10)
    let depletedWorld = setupEcologyScenario(25);
    const tonicId = EntityIdSchema.parse('item_tonic_1');
    const { [tonicId]: _depletedTonic, ...depletedEntities } = depletedWorld.entities;
    depletedWorld = {
      ...depletedWorld,
      entities: {
        ...depletedEntities,
        [citizenId]: {
          ...depletedWorld.entities[citizenId]!,
          anatomy: { ...depletedWorld.entities[citizenId]!.anatomy!, bloodVolumePct: 40 },
          inventory: { containedEntityIds: [], maxMassGrams: 20000, maxVolumeMl: 20000, currentMassGrams: 0 },
        },
      },
    };

    const triageRes = dispatchCommand(depletedWorld, { type: 'WAIT_TURN', actorId: playerId });
    const triageCitizen = triageRes.state.entities[citizenId]!;
    expect(triageCitizen.schedule!.currentGoal).toBe('SEEK_MEDICAL');
    // Citizen at (10, 10) steps west towards Chirurgeon at (8, 10)
    expect(triageCitizen.position!.x).toBeLessThan(10);
  });

  it('(b) diurnal shift transitions route NPCs between work and rest anchors and merchants restock pedestals', () => {
    // 1. Shift calculation quadrant verification
    expect(getShiftPhase(10)).toBe('DAWN_WHISTLE');
    expect(getShiftPhase(35)).toBe('FOUNDRY_SHIFT');
    expect(getShiftPhase(60)).toBe('GASLIGHT_CURFEW');
    expect(getShiftPhase(85)).toBe('GRAVEYARD_WATCH');

    // 2. During GRAVEYARD_WATCH (turn 80), citizen paths toward restAnchor (18, 18)
    let nightWorld = setupEcologyScenario(80);
    const nightRes = dispatchCommand(nightWorld, { type: 'WAIT_TURN', actorId: playerId });
    const nightCitizen = nightRes.state.entities[citizenId]!;
    expect(nightCitizen.schedule!.currentGoal).toBe('REST');
    // Started at (10, 10), stepping towards (18, 18)
    expect(nightCitizen.position!.x).toBeGreaterThan(10);

    // 3. During FOUNDRY_SHIFT (turn 30), merchant at (15, 15) restocks adjacent empty tradePedestal at (15, 16)
    let dayWorld = setupEcologyScenario(30);
    const dayRes = dispatchCommand(dayWorld, { type: 'WAIT_TURN', actorId: playerId });
    expect(dayRes.events).toContainEqual(expect.objectContaining({ type: 'PEDESTAL_STOCKED', quantity: 1 }));
    const stockedPedestal = dayRes.state.entities[pedestalId]!;
    expect(stockedPedestal.tradePedestal!.itemEntityId).toBeDefined();
  });

  it('(c) district catch-up decays residual steam/dust and snaps scheduled NPCs to active shift anchors', () => {
    const base = setupEcologyScenario(10);
    // Inject residual steam and coal dust into Spitalfields street grid
    let street = base.strata.STREET!;
    street = setTileCell(street, 12, 12, (c) => ({ ...c, steamPressureKpa: 80, coalDustDensity: 0.5 }));

    const snapshot = {
      strata: { UNDERCROFT: base.strata.UNDERCROFT!, STREET: street, SPIRE: base.strata.SPIRE! },
      entities: base.entities,
      lastSimulatedTurn: 10,
    };

    // Catch up 75 turns later at turn 85 (GRAVEYARD_WATCH)
    const caughtUp = catchUpDistrictState(snapshot, 85);

    // Atmospheric decay
    const caughtUpCell = caughtUp.strata.STREET.cells[12 * street.width + 12]!;
    expect(caughtUpCell.steamPressureKpa).toBeLessThan(10);
    expect(caughtUpCell.coalDustDensity).toBeLessThan(0.1);

    // Scheduled NPC snapped to rest anchor for night shift
    const snappedCitizen = caughtUp.entities[citizenId]!;
    expect(snappedCitizen.position).toEqual({ x: 18, y: 18, stratum: 'STREET', blocksMovement: true, blocksSight: false });
    expect(snappedCitizen.schedule!.currentGoal).toBe('REST');
  });
});
