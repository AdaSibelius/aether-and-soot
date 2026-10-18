import { describe, expect, it } from 'vitest';
import { EntityId, EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld, deserializeWorld, serializeWorld, WorldState } from '../../src/sim/core/world.js';
import { createItemEntity, getItemBlueprint } from '../../src/sim/data/item-catalog.js';
import { getTileCell } from '../../src/sim/spatial/grid.js';
import { generateVictorianDistrict } from '../../src/sim/spatial/generator.js';
import { spawnDistrictItems } from '../../src/sim/systems/item-spawner.js';

const playerId = EntityIdSchema.parse('actor_player');

function placeAtPlayer(world: WorldState, blueprintId: string, rawId: string, qty: number): WorldState {
  const bp = getItemBlueprint(blueprintId)!;
  const pos = world.entities[playerId]!.position!;
  const id = EntityIdSchema.parse(rawId);
  const entity = createItemEntity(bp, id, qty, { x: pos.x, y: pos.y, stratum: pos.stratum });
  return { ...world, entities: { ...world.entities, [id]: entity } };
}

function inv(world: WorldState) {
  return world.entities[playerId]!.inventory!;
}

describe('Phase 7: World Items, Ground Spawning & Inventory Management', () => {
  it('picks up a ground stack, then drops part of it as a split stack on the tile', () => {
    let world = placeAtPlayer(createInitialWorld({ seed: 7001 }), 'item_coagulant_tonic', 'item_tonic_a', 2);
    const tonicId = EntityIdSchema.parse('item_tonic_a');
    const massBefore = inv(world).currentMassGrams;

    const pick = dispatchCommand(world, { type: 'PICK_UP_ITEM', actorId: playerId });
    world = pick.state;
    expect(pick.events).toContainEqual(
      expect.objectContaining({ type: 'ITEM_PICKED_UP', itemEntityId: tonicId, quantity: 2 }),
    );
    expect(inv(world).containedEntityIds).toContain(tonicId);
    expect(world.entities[tonicId]!.position).toBeUndefined();
    expect(inv(world).currentMassGrams).toBe(massBefore + 500);

    const drop = dispatchCommand(world, {
      type: 'DROP_ITEM',
      actorId: playerId,
      itemEntityId: tonicId,
      quantity: 1,
    });
    world = drop.state;
    const dropEv = drop.events.find((e) => e.type === 'ITEM_DROPPED');
    expect(dropEv?.type === 'ITEM_DROPPED' && dropEv.quantity).toBe(1);
    const splitId = dropEv?.type === 'ITEM_DROPPED' ? dropEv.itemEntityId : ('' as EntityId);
    expect(splitId).not.toBe(tonicId);
    const playerPos = world.entities[playerId]!.position!;
    expect(world.entities[splitId]!.position).toMatchObject({
      x: playerPos.x,
      y: playerPos.y,
      stratum: playerPos.stratum,
      blocksMovement: false,
    });
    expect(world.entities[tonicId]!.item!.quantity).toBe(1);
    expect(inv(world).currentMassGrams).toBe(massBefore + 250);
  });

  it('merges identical stackable items into one inventory stack', () => {
    let world = placeAtPlayer(createInitialWorld({ seed: 7002 }), 'mat_brass_gears', 'item_gears_a', 1);
    world = dispatchCommand(world, { type: 'PICK_UP_ITEM', actorId: playerId }).state;
    world = placeAtPlayer(world, 'mat_brass_gears', 'item_gears_b', 3);

    const res = dispatchCommand(world, { type: 'PICK_UP_ITEM', actorId: playerId });
    expect(res.events).toContainEqual(
      expect.objectContaining({ type: 'ITEM_PICKED_UP', stackedIntoEntityId: 'item_gears_a', quantity: 3 }),
    );
    expect(res.state.entities['item_gears_a']!.item!.quantity).toBe(4);
    expect(res.state.entities['item_gears_b']).toBeUndefined();
    expect(inv(res.state).containedEntityIds.filter((id) => id.startsWith('item_gears'))).toHaveLength(1);
  });

  it('enforces the hard volume ceiling and the 1.5x mass overload ceiling', () => {
    const base = createInitialWorld({ seed: 7003 });

    const bulky = placeAtPlayer(base, 'item_pressurized_steam_canister', 'item_canisters', 30);
    const volRes = dispatchCommand(bulky, { type: 'PICK_UP_ITEM', actorId: playerId });
    expect(volRes.events).toContainEqual(
      expect.objectContaining({ type: 'INVENTORY_ACTION_FAILED', reason: 'VOLUME_EXCEEDED' }),
    );
    expect(inv(volRes.state).containedEntityIds).not.toContain('item_canisters');

    const heavy = placeAtPlayer(base, 'mat_cast_iron_plate', 'item_iron', 30);
    const massRes = dispatchCommand(heavy, { type: 'PICK_UP_ITEM', actorId: playerId });
    expect(massRes.events).toContainEqual(
      expect.objectContaining({ type: 'INVENTORY_ACTION_FAILED', reason: 'MASS_EXCEEDED' }),
    );
    expect(massRes.state.entities['item_iron']!.position).toBeDefined();
    expect(inv(massRes.state).currentMassGrams).toBe(inv(base).currentMassGrams);
  });

  it('uses consumables to restore blood and steam, removing exhausted stacks', () => {
    let world = createInitialWorld({ seed: 7004 });
    world = dispatchCommand(world, {
      type: 'DAMAGE_LIMB',
      actorId: playerId,
      targetId: playerId,
      slot: 'LEFT_LEG',
      damage: 35,
    }).state;
    const bloodBefore = world.entities[playerId]!.anatomy!.bloodVolumePct;
    expect(bloodBefore).toBeLessThan(100);

    world = placeAtPlayer(world, 'item_coagulant_tonic', 'item_tonic', 1);
    world = dispatchCommand(world, { type: 'PICK_UP_ITEM', actorId: playerId }).state;
    const used = dispatchCommand(world, {
      type: 'USE_ITEM',
      actorId: playerId,
      itemEntityId: EntityIdSchema.parse('item_tonic'),
    });
    world = used.state;
    expect(world.entities[playerId]!.anatomy!.bloodVolumePct).toBe(Math.min(100, bloodBefore + 25));
    expect(used.events).toContainEqual(
      expect.objectContaining({ type: 'ITEM_USED', effect: 'RESTORE_BLOOD', remainingQuantity: 0 }),
    );
    expect(world.entities['item_tonic']).toBeUndefined();
    expect(inv(world).containedEntityIds).not.toContain('item_tonic');

    const player = world.entities[playerId]!;
    world = {
      ...world,
      entities: { ...world.entities, [playerId]: { ...player, anatomy: { ...player.anatomy!, steamReserveKpa: 20 } } },
    };
    world = placeAtPlayer(world, 'item_pressurized_steam_canister', 'item_canister', 1);
    world = dispatchCommand(world, { type: 'PICK_UP_ITEM', actorId: playerId }).state;
    world = dispatchCommand(world, {
      type: 'USE_ITEM',
      actorId: playerId,
      itemEntityId: EntityIdSchema.parse('item_canister'),
    }).state;
    expect(world.entities[playerId]!.anatomy!.steamReserveKpa).toBe(60);
  });

  it('rejects dropping installed prosthetics, using non-consumables, and empty-tile pickups', () => {
    let world = createInitialWorld({ seed: 7005 });
    const monocleId = EntityIdSchema.parse('item_aetheric_monocle');

    const empty = dispatchCommand(world, { type: 'PICK_UP_ITEM', actorId: playerId });
    expect(empty.events).toContainEqual(expect.objectContaining({ reason: 'NO_ITEM_HERE' }));

    world = dispatchCommand(world, {
      type: 'INSTALL_PROSTHETIC',
      actorId: playerId,
      prostheticEntityId: monocleId,
      slot: 'OCULAR_MOUNT',
    }).state;
    const drop = dispatchCommand(world, { type: 'DROP_ITEM', actorId: playerId, itemEntityId: monocleId });
    expect(drop.events).toContainEqual(expect.objectContaining({ reason: 'ITEM_INSTALLED' }));

    world = placeAtPlayer(world, 'mat_aether_salt', 'item_salt', 2);
    world = dispatchCommand(world, { type: 'PICK_UP_ITEM', actorId: playerId }).state;
    const use = dispatchCommand(world, {
      type: 'USE_ITEM',
      actorId: playerId,
      itemEntityId: EntityIdSchema.parse('item_salt'),
    });
    expect(use.events).toContainEqual(expect.objectContaining({ reason: 'NOT_CONSUMABLE' }));
  });

  it('spawns ground items deterministically on walkable, unoccupied tiles and survives save/load', () => {
    const build = () =>
      spawnDistrictItems(generateVictorianDistrict(createInitialWorld({ seed: 7006, width: 24, height: 24 })).state);
    const a = build();
    const b = build();

    expect(serializeWorld(a.state)).toBe(serializeWorld(b.state));
    expect(a.spawnedItemIds).toHaveLength(12);

    for (const id of a.spawnedItemIds) {
      const item = a.state.entities[id]!;
      const pos = item.position!;
      expect(item.item).toBeDefined();
      expect(getTileCell(a.state.strata[pos.stratum]!, pos.x, pos.y)!.blocksMovement).toBe(false);
      const sharing = Object.values(a.state.entities).filter(
        (e) => e.id !== id && e.position?.stratum === pos.stratum && e.position.x === pos.x && e.position.y === pos.y,
      );
      expect(sharing).toHaveLength(0);
    }

    expect(deserializeWorld(serializeWorld(a.state))).toEqual(a.state);
  });
});
