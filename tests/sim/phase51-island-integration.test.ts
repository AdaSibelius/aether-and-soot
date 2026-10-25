import { describe, expect, it } from 'vitest';
import { EntityRecord } from '../../src/schemas/components.schema.js';
import { BlueprintIdSchema, EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { SeededRNG } from '../../src/sim/core/rng.js';
import { createInitialWorld, WorldState } from '../../src/sim/core/world.js';
import { computeVisibleTiles, isPointVisible } from '../../src/sim/spatial/fov.js';
import { getTileCell, setTileCell } from '../../src/sim/spatial/grid.js';
import { createDefaultNpcAnatomy } from '../../src/sim/systems/ai.system.js';
import { resolveFireRangedWeapon } from '../../src/sim/systems/ballistics.system.js';
import { computeEffectiveCombatStats, resolveAttackActor } from '../../src/sim/systems/combat.system.js';
import { computeMovementMechanics, resolveMoveStep } from '../../src/sim/systems/movement.system.js';
import { applyStaminaExertion, computePainShockPenalty } from '../../src/sim/systems/physiological-penalties.js';
import { registerTurfSector } from '../../src/sim/systems/skirmish-turf.system.js';
import { canActorSpotTarget, evaluateStealthDetection } from '../../src/sim/systems/stealth-acoustics.system.js';
import { resolveHarvestCorpse } from '../../src/sim/systems/surgery.system.js';
import { computeBuyUnitPrice, computeSellUnitPrice, computeTradePricePence } from '../../src/sim/systems/trade-pricing.js';

const V_STD = { glyph: '@', fgPrimary: '#D4AF37', fgSecondary: '#8B4513', bgColor: '#0A0D0E', shaderFlags: [] };

describe('Phase 51: Simulation Loop Harmonization & Island System Integration', () => {
  const playerId = EntityIdSchema.parse('actor_player');
  const guardId = EntityIdSchema.parse('npc_guard_51');
  const merchantId = EntityIdSchema.parse('npc_merchant_51');

  function createBaseTestWorld(): WorldState {
    const world = createInitialWorld({ seed: 5151, width: 24, height: 24 });
    const guard: EntityRecord = {
      id: guardId,
      name: 'Constabulary Watchman',
      visual: V_STD,
      position: { x: 10, y: 5, stratum: 'STREET', blocksMovement: true, blocksSight: false },
      actor: { isPlayer: false, energy: 100, speed: 100 },
      anatomy: createDefaultNpcAnatomy(40, 20),
      aiController: { factionId: 'CROWN_CONSTABULARY', role: 'GUARD', hostile: false, alertState: 'IDLE' },
    };
    const player = world.entities[playerId]!;
    return {
      ...world,
      entities: {
        ...world.entities,
        [guardId]: guard,
        [playerId]: { ...player, position: { x: 4, y: 5, stratum: 'STREET', blocksMovement: true, blocksSight: false } },
      },
    };
  }

  it('1. schedules advanceEnvironmentalHazards inside the turn pipeline (soot drift, choking coughs, acid drips)', () => {
    let world = createBaseTestWorld();
    const street = setTileCell(world.strata.STREET!, 3, 5, (c) => ({ ...c, smokePpm: 150 }));
    const acidFixtureId = EntityIdSchema.parse('fixture_acid_drip_51');
    world = {
      ...world,
      strata: { ...world.strata, STREET: street },
      entities: {
        ...world.entities,
        [acidFixtureId]: {
          id: acidFixtureId,
          name: 'Corroded Acid_Drip Conduit',
          visual: V_STD,
          position: { x: 6, y: 6, stratum: 'STREET', blocksMovement: false, blocksSight: false },
        },
      },
    };

    const res = dispatchCommand(world, { type: 'WAIT_TURN', actorId: playerId });
    expect(res.events.some((e) => e.type === 'HAZARD_TRIGGERED' && e.hazardType === 'ACID_DRIP')).toBe(true);
    expect(getTileCell(res.state.strata.STREET!, 6, 6)?.liquidType).toBe('NITRIC_ACID');
    expect(getTileCell(res.state.strata.STREET!, 4, 5)?.smokePpm ?? 0).toBeGreaterThan(0);
  });

  it('2. couples gaslight illumination (+4 penalty) and smoke density (-3 concealment & FOV attenuation) into stealth perception', () => {
    let world = createBaseTestWorld();
    world = {
      ...world,
      entities: {
        ...world.entities,
        [guardId]: { ...world.entities[guardId]!, position: { x: 14, y: 5, stratum: 'STREET', blocksMovement: true, blocksSight: false } },
      },
    };
    expect(canActorSpotTarget(world, guardId, playerId)).toBe(false);

    const litStreet = setTileCell(world.strata.STREET!, 4, 4, (c) => ({ ...c, terrainType: 'GASLAMP_POST' }));
    expect(evaluateStealthDetection({ ...world, strata: { ...world.strata, STREET: litStreet } }, guardId, playerId)).toBe(true);

    const midWorld: WorldState = {
      ...world,
      entities: {
        ...world.entities,
        [guardId]: { ...world.entities[guardId]!, position: { x: 11, y: 5, stratum: 'STREET', blocksMovement: true, blocksSight: false } },
      },
    };
    expect(canActorSpotTarget(midWorld, guardId, playerId)).toBe(true);

    const smokyStreet = setTileCell(midWorld.strata.STREET!, 4, 5, (c) => ({ ...c, smokePpm: 55 }));
    expect(canActorSpotTarget({ ...midWorld, strata: { ...midWorld.strata, STREET: smokyStreet } }, guardId, playerId)).toBe(false);

    const denseSmokeGrid = setTileCell(world.strata.STREET!, 6, 5, (c) => ({ ...c, smokePpm: 75 }));
    expect(isPointVisible(computeVisibleTiles(denseSmokeGrid, 4, 5, 8), { x: 11, y: 5 })).toBe(false);
  });

  it('3. applies +25% hostile turf tariff and -15% allied turf discount to merchant trade pricing', () => {
    let world = createBaseTestWorld();
    const itemEntity: EntityRecord = {
      id: EntityIdSchema.parse('item_coal_51'),
      name: 'Anthracite Briquette',
      visual: V_STD,
      item: { blueprintId: BlueprintIdSchema.parse('commodity_anthracite_briquette'), category: 'COMMODITY', massGrams: 500, volumeMl: 400, quantity: 1, stackable: true },
    };
    const merchant: EntityRecord = {
      id: merchantId,
      name: 'Independent Broker',
      visual: V_STD,
      position: { x: 5, y: 5, stratum: 'STREET', blocksMovement: true, blocksSight: false },
      actor: { isPlayer: false, energy: 100, speed: 100 },
      aiController: { factionId: 'CLOCKWORK_GUILD', role: 'MERCHANT', hostile: false, alertState: 'IDLE' },
    };

    world = registerTurfSector(world, {
      turfId: 'turf_spitalfields_market',
      name: 'Spitalfields Market Exchange',
      districtId: world.currentDistrictId,
      stratum: 'STREET',
      bounds: { xMin: 0, xMax: 12, yMin: 0, yMax: 12 },
      controllingFactionId: 'IRONMONGERS_CARTEL',
      controlScores: { IRONMONGERS_CARTEL: 80 },
      contested: false,
      lastSkirmishTurn: 0,
    });

    world = {
      ...world,
      economy: {
        ...world.economy,
        factionReputation: { ...world.economy.factionReputation, CLOCKWORK_GUILD: 0, IRONMONGERS_CARTEL: 0 },
      },
    };
    const neutralBuy = computeBuyUnitPrice(world, merchant, itemEntity);
    const neutralSell = computeSellUnitPrice(world, merchant, itemEntity);

    const hostileWorld: WorldState = {
      ...world,
      economy: { ...world.economy, factionReputation: { ...world.economy.factionReputation, IRONMONGERS_CARTEL: -50 } },
    };
    expect(computeTradePricePence(hostileWorld, merchant, itemEntity, 'BUY')).toBe(Math.round(neutralBuy * 1.25));
    expect(computeTradePricePence(hostileWorld, merchant, itemEntity, 'SELL')).toBe(Math.round(neutralSell * 0.75));

    const alliedWorld: WorldState = {
      ...world,
      economy: { ...world.economy, factionReputation: { ...world.economy.factionReputation, IRONMONGERS_CARTEL: 50 } },
    };
    expect(computeTradePricePence(alliedWorld, merchant, itemEntity, 'BUY')).toBe(Math.round(neutralBuy * 0.85));
    expect(computeTradePricePence(alliedWorld, merchant, itemEntity, 'SELL')).toBe(Math.round(neutralSell * 1.15));
  });

  it('4. couples painShock and stamina exertion into movement AP and melee combat stats', () => {
    const world = createBaseTestWorld();
    const player = world.entities[playerId]!;
    const traumatizedPlayer: EntityRecord = {
      ...player,
      anatomy: { ...player.anatomy!, painShock: 64, stamina: 0 },
    };

    const penalty = computePainShockPenalty(traumatizedPlayer);
    expect(penalty.accuracyPenaltyPct).toBe(26);
    expect(penalty.apPenalty).toBe(40);
    expect(penalty.damagePenalty).toBe(2);

    const baseStats = computeEffectiveCombatStats(player);
    const traumaStats = computeEffectiveCombatStats(traumatizedPlayer);
    expect(traumaStats.accuracyPct).toBeLessThan(baseStats.accuracyPct);
    expect(traumaStats.meleeDamage).toBeLessThan(baseStats.meleeDamage);
    expect(computeMovementMechanics(world, traumatizedPlayer).apSpent).toBe(140);

    const stepRes = resolveMoveStep(world, playerId, 1, 0);
    expect(stepRes.state.entities[playerId]!.anatomy!.stamina).toBe(player.anatomy!.stamina - 2);
    expect(applyStaminaExertion(player, 15).anatomy!.stamina).toBe(player.anatomy!.stamina - 15);

    const adjWorld: WorldState = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...traumatizedPlayer,
          anatomy: { ...traumatizedPlayer.anatomy!, stamina: 50 },
          position: { x: 9, y: 5, stratum: 'STREET', blocksMovement: true, blocksSight: false },
        },
      },
    };
    const atkRes = resolveAttackActor(adjWorld, playerId, guardId, 'TORSO', new SeededRNG(123));
    expect(atkRes.apSpent).toBe(125);
    expect(atkRes.state.entities[playerId]!.anatomy!.stamina).toBe(45);
  });

  it('5. reports ASSAULT on ranged weapon fire and THEFT on witnessed public corpse surgery', () => {
    let world = createBaseTestWorld();
    const rifleId = EntityIdSchema.parse('item_harpoon_rifle_51');
    const scalpelId = EntityIdSchema.parse('item_scalpel_51');
    const prostheticId = EntityIdSchema.parse('prosthetic_graft_51');
    const corpseId = EntityIdSchema.parse('corpse_citizen_51');
    const targetNpcId = EntityIdSchema.parse('npc_citizen_51');

    const rifle: EntityRecord = {
      id: rifleId,
      name: 'Pneumatic Harpoon Rifle',
      visual: V_STD,
      equipmentSpec: {
        equipSlot: 'WIELD',
        meleeDamageBonus: 2,
        armorBonus: 0,
        storageVolumeBonusMl: 0,
        steamResistanceKpa: 0,
        rangedRange: 8,
        rangedDamage: 14,
        rangedSteamCostKpa: 10,
        installedModBlueprintIds: [],
      },
      item: { blueprintId: BlueprintIdSchema.parse('weapon_pneumatic_harpoon'), category: 'EQUIPMENT', massGrams: 3000, volumeMl: 2000, quantity: 1, stackable: false },
    };
    const scalpel: EntityRecord = {
      id: scalpelId,
      name: 'Chirurgeon Scalpel',
      visual: V_STD,
      item: { blueprintId: BlueprintIdSchema.parse('tool_surgical_scalpel'), category: 'EQUIPMENT', massGrams: 150, volumeMl: 80, quantity: 1, stackable: false, surgicalQuality: 90 },
    };
    const prosthetic: EntityRecord = {
      id: prostheticId,
      name: 'Brass Pneumatic Arm',
      visual: V_STD,
      prostheticSpec: {
        blueprintId: BlueprintIdSchema.parse('prosthetic_pneumatic_arm_mk1'),
        targetLimbSlot: 'RIGHT_ARM',
        socketType: 'ACTUATOR',
        massGrams: 1500,
        volumeMl: 800,
        pressureRatingKpa: 80,
        steamConsumptionPerTurn: 2,
        moveApModifier: 0,
        fovRadiusBonus: 0,
        noiseDb: 8,
      },
    };
    const targetNpc: EntityRecord = {
      id: targetNpcId,
      name: 'Constabulary Clerk',
      visual: V_STD,
      position: { x: 7, y: 5, stratum: 'STREET', blocksMovement: true, blocksSight: false },
      actor: { isPlayer: false, energy: 100, speed: 100 },
      anatomy: createDefaultNpcAnatomy(40, 20),
      aiController: { factionId: 'CROWN_CONSTABULARY', role: 'CITIZEN', hostile: false, alertState: 'IDLE' },
    };
    const baseCorpseAnatomy = createDefaultNpcAnatomy(30, 15);
    const corpse: EntityRecord = {
      id: corpseId,
      name: 'Fallen Constabulary Officer Corpse',
      visual: V_STD,
      position: { x: 5, y: 5, stratum: 'STREET', blocksMovement: false, blocksSight: false },
      aiController: { factionId: 'CROWN_CONSTABULARY', role: 'GUARD', hostile: false, alertState: 'IDLE' },
      anatomy: {
        ...baseCorpseAnatomy,
        bloodVolumePct: 0,
        limbs: { ...baseCorpseAnatomy.limbs, RIGHT_ARM: { slot: 'RIGHT_ARM', hp: 0, maxHp: 20, amputated: true, installedProstheticEntityId: prostheticId } },
      },
    };

    const player = world.entities[playerId]!;
    world = {
      ...world,
      entities: {
        ...world.entities,
        [rifleId]: rifle,
        [scalpelId]: scalpel,
        [prostheticId]: prosthetic,
        [targetNpcId]: targetNpc,
        [corpseId]: corpse,
        [guardId]: { ...world.entities[guardId]!, position: { x: 8, y: 6, stratum: 'STREET', blocksMovement: true, blocksSight: false } },
        [playerId]: {
          ...player,
          position: { x: 4, y: 5, stratum: 'STREET', blocksMovement: true, blocksSight: false },
          inventory: {
            ...player.inventory!,
            containedEntityIds: [...player.inventory!.containedEntityIds, rifleId, scalpelId],
            equippedSlots: { ...player.inventory!.equippedSlots, WIELD: rifleId },
          },
        },
      },
    };

    const fireRes = resolveFireRangedWeapon(world, playerId, targetNpcId, 'TORSO', new SeededRNG(42));
    expect(fireRes.events).toContainEqual(expect.objectContaining({ type: 'WITNESS_CRIME_REPORTED', witnessId: guardId, perpetratorId: playerId, crime: 'ASSAULT' }));

    const harvestRes = resolveHarvestCorpse(world, playerId, corpseId, scalpelId, 'RIGHT_ARM');
    expect(harvestRes.events).toContainEqual(expect.objectContaining({ type: 'CYBERNETIC_HARVESTED', actorId: playerId, corpseEntityId: corpseId }));
    expect(harvestRes.events).toContainEqual(expect.objectContaining({ type: 'WITNESS_CRIME_REPORTED', witnessId: guardId, perpetratorId: playerId, crime: 'THEFT' }));
  });
});
