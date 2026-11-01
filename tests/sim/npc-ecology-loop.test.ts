import { describe, expect, it } from 'vitest';
import { EntityRecord } from '../../src/schemas/components.schema.js';
import { EntityIdSchema, FactionId } from '../../src/schemas/primitives.schema.js';
import { SeededRNG } from '../../src/sim/core/rng.js';
import { createInitialWorld, getShiftPhase } from '../../src/sim/core/world.js';
import { createEntityFromBlueprint } from '../../src/sim/data/item-catalog.js';
import { createSpatialView } from '../../src/sim/spatial/facade.js';
import { setTileCell } from '../../src/sim/spatial/grid.js';
import { advanceNpcTurns, createDefaultNpcAnatomy, decideNpcIntent } from '../../src/sim/systems/ai.system.js';
import { resolveNpcEcologyAction } from '../../src/sim/systems/npc-ecology.system.js';
import { findEcologyNextStep } from '../../src/sim/systems/npc-pathfinding.js';
import { registerTurfSector } from '../../src/sim/systems/skirmish-turf.system.js';
import { processCrimeWitnesses } from '../../src/sim/systems/squad-witness.system.js';

describe('NPC Diurnal Ecology, Active Simulation & Territorial Authority', () => {
  const playerId = EntityIdSchema.parse('actor_player');
  const npcId = EntityIdSchema.parse('npc_worker_1');
  const guardId = EntityIdSchema.parse('npc_constable_1');
  const victimId = EntityIdSchema.parse('npc_dock_hand');

  function makeNpc(
    id: typeof npcId,
    role: 'CITIZEN' | 'GUARD',
    faction: FactionId,
    x: number,
    y: number,
  ): EntityRecord {
    return {
      id,
      name: role,
      visual: { glyph: role === 'GUARD' ? 'G' : 'w', fgPrimary: '#D4AF37', fgSecondary: '#8B4513', bgColor: '#0A0D0E', shaderFlags: [] },
      actor: { isPlayer: false, energy: 100, speed: 100 },
      anatomy: createDefaultNpcAnatomy(30, 20),
      aiController: { factionId: faction, role, hostile: false, alertState: 'IDLE' },
      position: { x, y, stratum: 'STREET', blocksMovement: true, blocksSight: false },
      schedule: {
        workAnchor: { x: 5, y: 5, stratum: 'STREET' },
        restAnchor: { x: 15, y: 15, stratum: 'STREET' },
        patrolWaypoints: [{ x: 8, y: 8, stratum: 'STREET' }],
        currentGoal: 'WORK',
      },
    };
  }

  it('verifies 4-shift diurnal cycle schedule goals', () => {
    expect(getShiftPhase(10)).toBe('DAWN_WHISTLE');
    expect(getShiftPhase(30)).toBe('FOUNDRY_SHIFT');
    expect(getShiftPhase(60)).toBe('GASLIGHT_CURFEW');
    expect(getShiftPhase(80)).toBe('GRAVEYARD_WATCH');

    let state = createInitialWorld({ seed: 42, width: 20, height: 20 });
    const worker = makeNpc(npcId, 'CITIZEN', 'IRONMONGERS_CARTEL', 15, 15);
    state = { ...state, turnCount: 10, entities: { ...state.entities, [npcId]: worker } };

    const dawnRes = resolveNpcEcologyAction(state, npcId);
    expect(dawnRes.handled).toBe(true);
    const dawnNpc = dawnRes.state.entities[npcId]!;
    expect(dawnNpc.schedule?.currentGoal).toBe('WORK');

    state = { ...dawnRes.state, turnCount: 60 };
    const curfewRes = resolveNpcEcologyAction(state, npcId);
    expect(curfewRes.handled).toBe(true);
    const curfewNpc = curfewRes.state.entities[npcId]!;
    expect(curfewNpc.schedule?.currentGoal).toBe('REST');
  });

  it('simulates active sleep healing at restAnchor during GRAVEYARD_WATCH', () => {
    let state = createInitialWorld({ seed: 42, width: 20, height: 20 });
    const worker = makeNpc(npcId, 'CITIZEN', 'IRONMONGERS_CARTEL', 15, 15);
    worker.anatomy!.bloodVolumePct = 70;
    worker.anatomy!.limbs.TORSO!.hp = 10;
    state = { ...state, turnCount: 80, entities: { ...state.entities, [npcId]: worker } };

    const healRes = resolveNpcEcologyAction(state, npcId);
    expect(healRes.handled).toBe(true);
    const healedWorker = healRes.state.entities[npcId]!;
    expect(healedWorker.anatomy!.bloodVolumePct).toBe(72);
    expect(healedWorker.anatomy!.limbs.TORSO!.hp).toBe(15);
  });

  it('simulates active work consuming materials and progressing safehouse production', () => {
    let state = createInitialWorld({ seed: 42, width: 20, height: 20 });
    const worker = makeNpc(npcId, 'CITIZEN', 'IRONMONGERS_CARTEL', 5, 5);
    const matItem = createEntityFromBlueprint('mat_brass_gears', EntityIdSchema.parse('item_mat_1'))!;
    const chestId = EntityIdSchema.parse('workshop_crate_1');

    const crate: EntityRecord = {
      id: chestId,
      name: 'Workshop Crate',
      visual: { glyph: 'C', fgPrimary: '#8B4513', fgSecondary: '#5C2E0B', bgColor: '#0A0D0E', shaderFlags: [] },
      position: { x: 5, y: 6, stratum: 'STREET', blocksMovement: true, blocksSight: false },
      workbench: { stationType: 'ARTIFICER_BENCH', bonusEfficiencyPct: 10 },
      inventory: { containedEntityIds: [matItem.id], maxMassGrams: 50000, maxVolumeMl: 50000, currentMassGrams: 500 },
    };

    state = {
      ...state,
      turnCount: 30,
      safehouses: {
        deed_foundry: {
          deedId: 'deed_foundry',
          name: 'Old Foundry',
          ownerId: worker.id,
          stratum: 'STREET',
          bounds: { xMin: 2, xMax: 10, yMin: 2, yMax: 10 },
          isVault: false,
          claimedTurn: 1,
          productionProgress: 0,
        },
      },
      entities: { ...state.entities, [npcId]: worker, [chestId]: crate, [matItem.id]: matItem },
    };

    const workRes = resolveNpcEcologyAction(state, npcId);
    expect(workRes.handled).toBe(true);
    expect(workRes.state.safehouses.deed_foundry?.productionProgress).toBe(1);
  });

  it('evaluates obstacle-aware pathfinding and scald steam hazard avoidance', () => {
    let state = createInitialWorld({ seed: 42, width: 20, height: 20 });
    const actor = makeNpc(npcId, 'CITIZEN', 'IRONMONGERS_CARTEL', 5, 5);
    const updatedStreet = setTileCell(state.strata.STREET!, 5, 6, (prev) => ({
      ...prev,
      steamPressureKpa: 35,
    }));
    state = { ...state, strata: { ...state.strata, STREET: updatedStreet }, entities: { ...state.entities, [npcId]: actor } };

    const step = findEcologyNextStep(state, actor, { x: 5, y: 8, stratum: 'STREET' });
    expect(step).not.toBeNull();
    expect(step!.dx === 0 && step!.dy === 1).toBe(false);
  });

  it('allows Crown Constabulary guards to witness crimes against other factions', () => {
    let state = createInitialWorld({ seed: 42, width: 20, height: 20 });
    const p = state.entities[playerId]!;
    const guard = makeNpc(guardId, 'GUARD', 'CROWN_CONSTABULARY', 5, 5);
    const victim = makeNpc(victimId, 'CITIZEN', 'UNDERCROFT_SYNDICATE', 4, 5);

    state = {
      ...state,
      entities: {
        ...state.entities,
        [playerId]: { ...p, position: { x: 3, y: 5, stratum: 'STREET', blocksMovement: true, blocksSight: false } },
        [guardId]: guard,
        [victimId]: victim,
      },
    };

    const initialRep = state.economy.factionReputation.UNDERCROFT_SYNDICATE ?? 0;
    const res = processCrimeWitnesses(state, playerId, 'UNDERCROFT_SYNDICATE', 'ASSAULT');

    expect(res.events.some((e) => e.type === 'WITNESS_CRIME_REPORTED')).toBe(true);
    expect(res.state.economy.factionReputation.UNDERCROFT_SYNDICATE).toBe(initialRep - 15);
    const witnessGuard = res.state.entities[guardId]!;
    expect(witnessGuard.aiController?.grudgeTargetId).toBe(playerId);
  });

  it('triggers turf tariff demand and detects safehouse trespass', () => {
    let state = createInitialWorld({ seed: 42, width: 20, height: 20 });
    const p = state.entities[playerId]!;
    const guard = makeNpc(guardId, 'GUARD', 'CROWN_CONSTABULARY', 6, 5);

    state = registerTurfSector(state, {
      turfId: 'turf_soot_market',
      districtId: 'iron_quarter',
      name: 'Soot Market Turf',
      stratum: 'STREET',
      bounds: { xMin: 1, xMax: 10, yMin: 1, yMax: 10 },
      controllingFactionId: 'CROWN_CONSTABULARY',
      contested: false,
      controlScores: { CROWN_CONSTABULARY: 100 },
    });

    state = {
      ...state,
      economy: { ...state.economy, playerTreasuryPence: 50 },
      entities: {
        ...state.entities,
        [playerId]: { ...p, position: { x: 5, y: 5, stratum: 'STREET', blocksMovement: true, blocksSight: false } },
        [guardId]: guard,
      },
    };

    const spatial = createSpatialView(state, 'STREET');
    const rng = new SeededRNG(99);
    const decision = decideNpcIntent(guard, state, spatial, rng);

    expect(decision.command).toBeDefined();
    expect(decision.command?.type).toBe('ENFORCE_TURF_AUTHORITY');

    state = {
      ...state,
      safehouses: {
        deed_private_haven: {
          deedId: 'deed_private_haven',
          name: 'Private Manor',
          ownerId: guardId,
          stratum: 'STREET',
          bounds: { xMin: 4, xMax: 6, yMin: 4, yMax: 6 },
          isVault: false,
          claimedTurn: 1,
        },
      },
    };

    const advanceRes = advanceNpcTurns(state, rng);
    expect(advanceRes.events.some((e) => e.type === 'WITNESS_CRIME_REPORTED' && (e as { crime?: string }).crime === 'TRESPASS')).toBe(true);
  });
});
