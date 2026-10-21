import { describe, expect, it } from 'vitest';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { createEntityFromBlueprint } from '../../src/sim/data/item-catalog.js';
import { BlueprintIdSchema, EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { resolveHarvestCorpse } from '../../src/sim/systems/surgery.system.js';

describe('Phase 37: Governor Bandwidth, Active Prosthetics & Corpse Harvesting', () => {
  const playerId = EntityIdSchema.parse('actor_player');

  it('updates strainLoadKw upon installing and removing prosthetics', () => {
    let world = createInitialWorld({ seed: 3701 });
    const legId = EntityIdSchema.parse('item_test_strider_leg');
    const leg = createEntityFromBlueprint('prosthetic_pneumatic_leg_mk1', legId, 1)!;

    world = { ...world, entities: { ...world.entities, [legId]: leg } };
    expect(world.entities[playerId]!.anatomy!.strainLoadKw).toBe(0);

    // Install leg
    world = dispatchCommand(world, {
      type: 'INSTALL_PROSTHETIC',
      actorId: playerId,
      prostheticEntityId: legId,
      slot: 'LEFT_LEG',
    }).state;

    expect(world.entities[playerId]!.anatomy!.strainLoadKw).toBeGreaterThan(0);
    const initialStrain = world.entities[playerId]!.anatomy!.strainLoadKw;

    // Remove leg
    world = dispatchCommand(world, {
      type: 'REMOVE_PROSTHETIC',
      actorId: playerId,
      slot: 'LEFT_LEG',
    }).state;

    expect(world.entities[playerId]!.anatomy!.strainLoadKw).toBeLessThan(initialStrain);
  });

  it('executes Pneumatic Dash ability and deducts steam with turn cooldown', () => {
    let world = createInitialWorld({ seed: 3702 });
    const dashLegId = EntityIdSchema.parse('item_dash_leg');
    const dashLeg = createEntityFromBlueprint('prosthetic_pneumatic_leg_mk1', dashLegId, 1)!;

    // Equip with active ability
    dashLeg.prostheticSpec = {
      ...dashLeg.prostheticSpec!,
      activeAbility: {
        id: 'PNEUMATIC_DASH',
        steamCost: 20,
        cooldownTurns: 3,
        cooldownRemaining: 0,
      },
    };

    world = {
      ...world,
      entities: {
        ...world.entities,
        [dashLegId]: dashLeg,
        [playerId]: {
          ...world.entities[playerId]!,
          anatomy: { ...world.entities[playerId]!.anatomy!, steamReserveKpa: 80, strainLoadKw: 30, governorCapacityKw: 100 },
        },
      },
    };

    // Install
    world = dispatchCommand(world, {
      type: 'INSTALL_PROSTHETIC',
      actorId: playerId,
      prostheticEntityId: dashLegId,
      slot: 'LEFT_LEG',
    }).state;

    const startPos = { ...world.entities[playerId]!.position! };

    // Activate Dash east (dx: 1, dy: 0)
    const actRes = dispatchCommand(world, {
      type: 'ACTIVATE_PROSTHETIC',
      actorId: playerId,
      slot: 'LEFT_LEG',
      direction: { dx: 1, dy: 0 },
    });
    world = actRes.state;

    expect(actRes.events.some((e) => e.type === 'PROSTHETIC_ACTIVATED')).toBe(true);
    expect(world.entities[playerId]!.anatomy!.steamReserveKpa).toBe(60); // 80 - 20 = 60
    expect(world.entities[playerId]!.position!.x).toBeGreaterThan(startPos.x);

    // Cannot activate again immediately due to cooldown
    const cdFailRes = dispatchCommand(world, {
      type: 'ACTIVATE_PROSTHETIC',
      actorId: playerId,
      slot: 'LEFT_LEG',
      direction: { dx: 1, dy: 0 },
    });
    expect(cdFailRes.events.some((e) => e.type === 'PROSTHETIC_ACTION_FAILED')).toBe(true);
  });

  it('blocks active ability when boiler governor capacity is overloaded', () => {
    let world = createInitialWorld({ seed: 3703 });
    const ramArmId = EntityIdSchema.parse('item_ram_arm');
    const ramArm = createEntityFromBlueprint('prosthetic_pneumatic_piledriver_arm', ramArmId, 1)!;

    ramArm.prostheticSpec = {
      ...ramArm.prostheticSpec!,
      activeAbility: {
        id: 'HYDRAULIC_RAM',
        steamCost: 15,
        cooldownTurns: 2,
        cooldownRemaining: 0,
      },
    };

    world = {
      ...world,
      entities: {
        ...world.entities,
        [ramArmId]: ramArm,
        [playerId]: {
          ...world.entities[playerId]!,
          anatomy: {
            ...world.entities[playerId]!.anatomy!,
            governorCapacityKw: 50,
            strainLoadKw: 90, // Exceeds governor capacity!
            steamReserveKpa: 80,
          },
        },
      },
    };

    // Install
    world = dispatchCommand(world, {
      type: 'INSTALL_PROSTHETIC',
      actorId: playerId,
      prostheticEntityId: ramArmId,
      slot: 'RIGHT_ARM',
    }).state;

    // Activate should trigger GOVERNOR_OVERLOADED
    const actRes = dispatchCommand(world, {
      type: 'ACTIVATE_PROSTHETIC',
      actorId: playerId,
      slot: 'RIGHT_ARM',
      direction: { dx: 1, dy: 0 },
    });

    const overloadEv = actRes.events.find((e) => e.type === 'GOVERNOR_OVERLOADED');
    expect(overloadEv).toBeDefined();
    expect(actRes.events.some((e) => e.type === 'PROSTHETIC_ACTIVATED')).toBe(false);
  });

  it('harvests cybernetic from dead actor using surgical tool and scales damage by tool quality', () => {
    let world = createInitialWorld({ seed: 3704 });
    const pPos = world.entities[playerId]!.position!;
    const corpseId = EntityIdSchema.parse('corpse_cyborg_elite');
    const monocleId = EntityIdSchema.parse('item_corpse_monocle');
    const monocle = createEntityFromBlueprint('prosthetic_clockwork_ocular_lens', monocleId, 1)!;

    const brassBp = BlueprintIdSchema.parse('mat_brass_gears');

    // High quality surgical scalpel
    const scalpelId = EntityIdSchema.parse('item_fine_scalpel');
    world.entities[scalpelId] = {
      id: scalpelId, name: 'Silver Scalpel',
      visual: { glyph: '/', fgPrimary: '#EAECEE', fgSecondary: '#BDC3C7', bgColor: '#0A0D0E', shaderFlags: [] },
      item: { blueprintId: brassBp, category: 'MATERIAL', massGrams: 200, volumeMl: 100, stackable: false, surgicalQuality: 90, quantity: 1 },
    };

    // Low quality iron wrench tool
    const wrenchId = EntityIdSchema.parse('item_crude_wrench');
    world.entities[wrenchId] = {
      id: wrenchId, name: 'Rusted Wrench',
      visual: { glyph: '/', fgPrimary: '#7F8C8D', fgSecondary: '#34495E', bgColor: '#0A0D0E', shaderFlags: [] },
      item: { blueprintId: brassBp, category: 'MATERIAL', massGrams: 1500, volumeMl: 800, stackable: false, surgicalQuality: 30, quantity: 1 },
    };

    // Corpse adjacent to player with monocle installed
    world.entities[monocleId] = monocle;
    world.entities[corpseId] = {
      id: corpseId, name: 'Corpse of Artificer',
      visual: { glyph: '%', fgPrimary: '#99A3A4', fgSecondary: '#5D6D7E', bgColor: '#0A0D0E', shaderFlags: [] },
      position: { x: pPos.x + 1, y: pPos.y, stratum: pPos.stratum, blocksMovement: false, blocksSight: false },
      anatomy: {
        bloodVolumePct: 0, steamReserveKpa: 0, maxSteamReserveKpa: 100, governorCapacityKw: 100, strainLoadKw: 0, unlockedRecipeIds: [], toxicityPct: 0, painShock: 0, stamina: 100, activeEffects: [],
        limbs: { OCULAR_MOUNT: { slot: 'OCULAR_MOUNT', hp: 0, maxHp: 10, amputated: false, installedProstheticEntityId: monocleId } },
      },
    };

    world.entities[playerId] = {
      ...world.entities[playerId]!,
      inventory: { ...world.entities[playerId]!.inventory!, containedEntityIds: [...world.entities[playerId]!.inventory!.containedEntityIds, scalpelId, wrenchId] },
    };

    // Harvest with fine scalpel -> CYBERNETIC_HARVESTED with low item damage (5%)
    const harvestRes = dispatchCommand(world, {
      type: 'HARVEST_CORPSE', actorId: playerId, corpseEntityId: corpseId, toolEntityId: scalpelId, slot: 'OCULAR_MOUNT',
    });
    world = harvestRes.state;

    const harvestEv = harvestRes.events.find((e) => e.type === 'CYBERNETIC_HARVESTED');
    expect(harvestEv).toBeDefined();
    if (harvestEv && harvestEv.type === 'CYBERNETIC_HARVESTED') {
      expect(harvestEv.toolQuality).toBe('FINE');
      expect(harvestEv.itemDamagePct).toBeLessThan(10);
    }

    expect(world.entities[playerId]!.inventory!.containedEntityIds).toContain(monocleId);
    expect(world.entities[corpseId]!.anatomy!.limbs.OCULAR_MOUNT?.installedProstheticEntityId).toBeUndefined();
  });

  it('rejects corpse harvesting when actor lacks surgical quality tool or is distant', () => {
    let world = createInitialWorld({ seed: 3705 });
    const pPos = world.entities[playerId]!.position!;
    const corpseId = EntityIdSchema.parse('corpse_distant');
    const dummyItemId = EntityIdSchema.parse('item_coal_chunk');

    world.entities[dummyItemId] = {
      id: dummyItemId, name: 'Raw Coal',
      visual: { glyph: '*', fgPrimary: '#111', fgSecondary: '#222', bgColor: '#000', shaderFlags: [] },
      item: { blueprintId: BlueprintIdSchema.parse('mat_brass_gears'), category: 'COMMODITY', massGrams: 500, volumeMl: 300, quantity: 1, stackable: true },
    };
    world.entities[corpseId] = {
      id: corpseId, name: 'Corpse of Lurker',
      visual: { glyph: '%', fgPrimary: '#999', fgSecondary: '#555', bgColor: '#000', shaderFlags: [] },
      position: { x: pPos.x + 5, y: pPos.y, stratum: pPos.stratum, blocksMovement: false, blocksSight: false },
    };
    world.entities[playerId] = {
      ...world.entities[playerId]!,
      inventory: { ...world.entities[playerId]!.inventory!, containedEntityIds: [dummyItemId] },
    };

    const failDistRes = resolveHarvestCorpse(world, playerId, corpseId, dummyItemId);
    expect(failDistRes.events.some((e) => e.type === 'HARVEST_ACTION_FAILED' && e.reason === 'TOO_DISTANT')).toBe(true);
  });
});
