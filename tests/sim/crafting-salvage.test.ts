import { describe, expect, it } from 'vitest';
import { BlueprintIdSchema, EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld, WorldState } from '../../src/sim/core/world.js';
import { createEntityFromBlueprint } from '../../src/sim/data/item-catalog.js';
import { generateVictorianDistrict } from '../../src/sim/spatial/generator.js';

describe('Phase 9: Artificer Crafting, Salvage & Steam Workbenches', () => {
  const playerId = EntityIdSchema.parse('actor_player');

  it('crafts field recipes without a workbench, consuming materials and steam', () => {
    const base = createInitialWorld({ seed: 9001 });
    const player = base.entities[playerId]!;
    const saltId = EntityIdSchema.parse('held_salt');
    const rubberId = EntityIdSchema.parse('held_rubber');
    const salt = createEntityFromBlueprint(BlueprintIdSchema.parse('mat_aether_salt'), saltId, 2)!;
    const rubber = createEntityFromBlueprint(BlueprintIdSchema.parse('mat_vulcanized_rubber'), rubberId, 1)!;

    const state: WorldState = {
      ...base,
      entities: {
        ...base.entities,
        [saltId]: salt,
        [rubberId]: rubber,
        [playerId]: {
          ...player,
          inventory: {
            ...player.inventory!,
            containedEntityIds: [...player.inventory!.containedEntityIds, saltId, rubberId],
            currentMassGrams: player.inventory!.currentMassGrams + 160 + 250,
          },
        },
      },
    };

    const res = dispatchCommand(state, {
      type: 'CRAFT_RECIPE',
      actorId: playerId,
      recipeId: BlueprintIdSchema.parse('recipe_coagulant_tonic'),
    });

    const craftedEvent = res.events.find((e) => e.type === 'ITEM_CRAFTED');
    expect(craftedEvent).toBeDefined();
    if (craftedEvent?.type === 'ITEM_CRAFTED') {
      expect(craftedEvent.steamSpentKpa).toBe(10);
      expect(craftedEvent.quantity).toBe(1);
      const craftedEntity = res.state.entities[craftedEvent.outputEntityId];
      expect(craftedEntity?.item?.blueprintId).toBe('item_coagulant_tonic');
    }

    const updatedPlayer = res.state.entities[playerId]!;
    expect(updatedPlayer.anatomy?.steamReserveKpa).toBe(player.anatomy!.steamReserveKpa - 10);
    expect(res.state.entities[saltId]).toBeUndefined();
    expect(res.state.entities[rubberId]).toBeUndefined();
  });

  it('enforces workbench proximity for bench recipes and applies workbench steam efficiency discount', () => {
    const generated = generateVictorianDistrict(createInitialWorld({ seed: 9002 }));
    const player = generated.state.entities[playerId]!;
    const ironId = EntityIdSchema.parse('held_iron');
    const rubberId = EntityIdSchema.parse('held_rubber');
    const iron = createEntityFromBlueprint(BlueprintIdSchema.parse('mat_cast_iron_plate'), ironId, 1)!;
    const rubber = createEntityFromBlueprint(BlueprintIdSchema.parse('mat_vulcanized_rubber'), rubberId, 2)!;

    const farState: WorldState = {
      ...generated.state,
      entities: {
        ...generated.state.entities,
        [ironId]: iron,
        [rubberId]: rubber,
        [playerId]: {
          ...player,
          position: player.position,
          inventory: {
            ...player.inventory!,
            containedEntityIds: [...player.inventory!.containedEntityIds, ironId, rubberId],
            currentMassGrams: player.inventory!.currentMassGrams + 1200 + 500,
          },
        },
      },
    };

    // Attempt to craft away from the workbench -> fails with WORKBENCH_REQUIRED
    const failRes = dispatchCommand(farState, {
      type: 'CRAFT_RECIPE',
      actorId: playerId,
      recipeId: BlueprintIdSchema.parse('recipe_steam_canister'),
    });
    expect(failRes.events).toContainEqual(
      expect.objectContaining({
        type: 'CRAFTING_FAILED',
        action: 'CRAFT_RECIPE',
        reason: 'WORKBENCH_REQUIRED',
      }),
    );

    // Move player adjacent to the Artificer Workbench landmark
    const benchPos = generated.landmarks.artificerWorkbench;
    const nearBenchState: WorldState = {
      ...farState,
      entities: {
        ...farState.entities,
        [playerId]: {
          ...farState.entities[playerId]!,
          position: { ...player.position!, x: benchPos.x + 1, y: benchPos.y, stratum: 'STREET' },
        },
      },
    };

    const okRes = dispatchCommand(nearBenchState, {
      type: 'CRAFT_RECIPE',
      actorId: playerId,
      recipeId: BlueprintIdSchema.parse('recipe_steam_canister'),
    });

    // Base cost is 30 kPa; 20% workbench bonus reduces it to 24 kPa
    expect(okRes.events).toContainEqual(
      expect.objectContaining({
        type: 'ITEM_CRAFTED',
        recipeId: 'recipe_steam_canister',
        steamSpentKpa: 24,
      }),
    );
  });

  it('salvages unequipped prosthetics and consumables into raw materials while protecting installed limbs', () => {
    const base = createInitialWorld({ seed: 9003 });
    const striderId = EntityIdSchema.parse('item_pneumatic_strider_leg');

    // 1. Install the prosthetic first, then attempt to salvage -> should fail with ITEM_INSTALLED
    const installedRes = dispatchCommand(base, {
      type: 'INSTALL_PROSTHETIC',
      actorId: playerId,
      prostheticEntityId: striderId,
      slot: 'LEFT_LEG',
    });
    const failInstalled = dispatchCommand(installedRes.state, {
      type: 'SALVAGE_ITEM',
      actorId: playerId,
      itemEntityId: striderId,
    });
    expect(failInstalled.events).toContainEqual(
      expect.objectContaining({
        type: 'CRAFTING_FAILED',
        action: 'SALVAGE_ITEM',
        reason: 'ITEM_INSTALLED',
      }),
    );

    // 2. Salvage an unequipped prosthetic in initial state -> yields 2x mat_brass_gears
    const salvageRes = dispatchCommand(base, {
      type: 'SALVAGE_ITEM',
      actorId: playerId,
      itemEntityId: striderId,
    });
    expect(salvageRes.events).toContainEqual(
      expect.objectContaining({
        type: 'ITEM_SALVAGED',
        recoveredMaterialBlueprintId: 'mat_brass_gears',
        recoveredQuantity: 2,
      }),
    );
    expect(salvageRes.state.entities[striderId]).toBeUndefined();
    const updatedPlayer = salvageRes.state.entities[playerId]!;
    const gearEntity = updatedPlayer.inventory!.containedEntityIds
      .map((id) => salvageRes.state.entities[id])
      .find((e) => e?.item?.blueprintId === 'mat_brass_gears');
    expect(gearEntity?.item?.quantity).toBe(2);
  });

  it('repairs a damaged limb using 1x Brass Clockwork Gears and 15 kPa steam', () => {
    const base = createInitialWorld({ seed: 9004 });
    const striderId = EntityIdSchema.parse('item_pneumatic_strider_leg');

    // Salvage strider leg to acquire 2x mat_brass_gears
    const withGears = dispatchCommand(base, {
      type: 'SALVAGE_ITEM',
      actorId: playerId,
      itemEntityId: striderId,
    }).state;

    // Damage RIGHT_ARM by 20 HP
    const damaged = dispatchCommand(withGears, {
      type: 'DAMAGE_LIMB',
      actorId: playerId,
      targetId: playerId,
      slot: 'RIGHT_ARM',
      damage: 20,
    }).state;

    const beforeHp = damaged.entities[playerId]!.anatomy!.limbs.RIGHT_ARM!.hp;
    const beforeSteam = damaged.entities[playerId]!.anatomy!.steamReserveKpa;

    // Repair RIGHT_ARM -> restores 15 HP, spends 15 kPa steam and 1x mat_brass_gears
    const repaired = dispatchCommand(damaged, {
      type: 'REPAIR_LIMB',
      actorId: playerId,
      slot: 'RIGHT_ARM',
    });

    expect(repaired.events).toContainEqual(
      expect.objectContaining({
        type: 'LIMB_REPAIRED',
        slot: 'RIGHT_ARM',
        hpRestored: 15,
        newHp: beforeHp + 15,
        steamSpentKpa: 15,
      }),
    );

    const playerAfter = repaired.state.entities[playerId]!;
    expect(playerAfter.anatomy!.steamReserveKpa).toBe(beforeSteam - 15);
    const remainingGears = playerAfter.inventory!.containedEntityIds
      .map((id) => repaired.state.entities[id])
      .find((e) => e?.item?.blueprintId === 'mat_brass_gears');
    expect(remainingGears?.item?.quantity).toBe(1);
  });
});
