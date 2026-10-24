import { describe, expect, it } from 'vitest';
import { EntityRecord } from '../../src/schemas/components.schema.js';
import { EquipmentSpecSchema } from '../../src/schemas/equipment.schema.js';
import { BlueprintIdSchema, EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { getTileCell, setTileCell } from '../../src/sim/spatial/grid.js';

describe('Phase 41: Surface Liquid Pools, Chemical Reactions & Item Coating', () => {
  const playerId = EntityIdSchema.parse('actor_player');
  const targetId = EntityIdSchema.parse('actor_sentry_target');
  const acidFlaskId = EntityIdSchema.parse('item_acid_flask');
  const oilFlaskId = EntityIdSchema.parse('item_oil_flask');
  const weaponId = EntityIdSchema.parse('item_sabre_1');
  const mopId = EntityIdSchema.parse('tool_mop_1');

  function makeItem(id: typeof acidFlaskId, bp: string): EntityRecord {
    return {
      id, name: bp,
      visual: { glyph: '!', fgPrimary: '#2ECC71', fgSecondary: '#27AE60', bgColor: '#0A0D0E', shaderFlags: [] },
      item: { blueprintId: BlueprintIdSchema.parse(bp), category: 'CONSUMABLE', massGrams: 500, volumeMl: 500, quantity: 1, stackable: false },
    };
  }

  it('leaves a blood trail when an injured actor moves', () => {
    let world = createInitialWorld({ seed: 42, width: 20, height: 20 });
    const p = world.entities[playerId]!;
    const pPos = p.position!;
    // Set player blood to 80% (injured)
    world = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: { ...p, anatomy: { ...p.anatomy!, bloodVolumePct: 80 } },
      },
    };

    const moveRes = dispatchCommand(world, { type: 'MOVE_STEP', actorId: playerId, dx: 1, dy: 0 });
    expect(moveRes.events).toContainEqual(
      expect.objectContaining({ type: 'LIQUID_SPILLED', liquidType: 'BLOOD', volumeMl: 150 }),
    );

    const originCell = getTileCell(moveRes.state.strata.STREET!, pPos.x, pPos.y)!;
    expect(originCell.liquidType).toBe('BLOOD');
    expect(originCell.liquidVolumeMl).toBe(150);
  });

  it('causes slip hazard on sludge and acid corrosion on nitric acid', () => {
    let world = createInitialWorld({ seed: 43, width: 20, height: 20 });
    const pPos = world.entities[playerId]!.position!;

    // Place SLUICE_SLUDGE 1 tile east
    let grid = setTileCell(world.strata.STREET!, pPos.x + 1, pPos.y, (c) => ({
      ...c, liquidType: 'SLUICE_SLUDGE', liquidVolumeMl: 300,
    }));
    world = { ...world, strata: { ...world.strata, STREET: grid } };

    // Move onto sludge
    const slipRes = dispatchCommand(world, { type: 'MOVE_STEP', actorId: playerId, dx: 1, dy: 0 });
    expect(slipRes.events).toContainEqual(expect.objectContaining({ type: 'SURFACE_SLIPPED', liquidType: 'SLUICE_SLUDGE' }));
    expect(slipRes.state.entities[playerId]?.actor?.posture).toBe('CROUCHED');

    // Place NITRIC_ACID 1 tile south of new position
    const currentPos = slipRes.state.entities[playerId]!.position!;
    grid = setTileCell(slipRes.state.strata.STREET!, currentPos.x, currentPos.y + 1, (c) => ({
      ...c, liquidType: 'NITRIC_ACID', liquidVolumeMl: 400,
    }));
    world = { ...slipRes.state, strata: { ...slipRes.state.strata, STREET: grid } };

    const acidRes = dispatchCommand(world, { type: 'MOVE_STEP', actorId: playerId, dx: 0, dy: 1 });
    expect(acidRes.events).toContainEqual(expect.objectContaining({ type: 'ACID_CORROSION_TICK', damageInflicted: 8 }));
  });

  it('throws a flask creating a surface pool and ignites whale oil with a spark', () => {
    let world = createInitialWorld({ seed: 44, width: 20, height: 20 });
    const pPos = world.entities[playerId]!.position!;
    const targetPoint = { x: pPos.x + 2, y: pPos.y, stratum: pPos.stratum };

    const oilFlask = makeItem(oilFlaskId, 'flask_whale_oil');
    const p = world.entities[playerId]!;
    world = {
      ...world,
      entities: {
        ...world.entities, [oilFlaskId]: oilFlask,
        [playerId]: { ...p, inventory: { ...p.inventory!, containedEntityIds: [...p.inventory!.containedEntityIds, oilFlaskId] } },
      },
    };

    // 1. Throw flask of whale oil
    const throwRes = dispatchCommand(world, { type: 'THROW_FLASK', actorId: playerId, target: targetPoint, flaskEntityId: oilFlaskId });
    expect(throwRes.events).toContainEqual(expect.objectContaining({ type: 'LIQUID_SPILLED', liquidType: 'WHALE_OIL', volumeMl: 500 }));
    world = throwRes.state;

    const oilCell = getTileCell(world.strata.STREET!, targetPoint.x, targetPoint.y)!;
    expect(oilCell.liquidType).toBe('WHALE_OIL');

    // 2. Emit spark at whale oil pool -> conflagration!
    const sparkRes = dispatchCommand(world, { type: 'EMIT_SPARK', actorId: playerId, target: targetPoint });
    expect(sparkRes.events).toContainEqual(expect.objectContaining({ type: 'LIQUID_IGNITED', liquidType: 'WHALE_OIL', thermalDamage: 25 }));

    const burnedCell = getTileCell(sparkRes.state.strata.STREET!, targetPoint.x, targetPoint.y)!;
    expect(burnedCell.liquidType).toBe('NONE');
    expect(burnedCell.steamPressureKpa).toBeGreaterThan(0);
  });

  it('coats weapon with acid for bonus attack damage and cleans up spills', () => {
    let world = createInitialWorld({ seed: 45, width: 20, height: 20 });
    const pPos = world.entities[playerId]!.position!;

    const acidFlask = makeItem(acidFlaskId, 'flask_nitric_acid');
    const mop = makeItem(mopId, 'tool_mop');
    const sabreSpec = EquipmentSpecSchema.parse({ equipSlot: 'WIELD', meleeDamageBonus: 8 });
    const sabre: EntityRecord = {
      id: weaponId, name: 'Forged Cavalry Sabre',
      visual: { glyph: '/', fgPrimary: '#BDC3C7', fgSecondary: '#7F8C8D', bgColor: '#0A0D0E', shaderFlags: [] },
      item: { blueprintId: BlueprintIdSchema.parse('gear_cavalry_sabre'), category: 'EQUIPMENT', massGrams: 1200, volumeMl: 1000, quantity: 1, stackable: false, equipmentSpec: sabreSpec },
      equipmentSpec: sabreSpec,
    };

    const target: EntityRecord = {
      id: targetId, name: 'Clockwork Enforcer',
      visual: { glyph: 'E', fgPrimary: '#E74C3C', fgSecondary: '#C0392B', bgColor: '#0A0D0E', shaderFlags: [] },
      position: { x: pPos.x + 1, y: pPos.y, stratum: pPos.stratum, blocksMovement: true, blocksSight: false },
      actor: { energy: 0, speed: 100, isPlayer: false },
      anatomy: { ...world.entities[playerId]!.anatomy! },
    };

    const p = world.entities[playerId]!;
    world = {
      ...world,
      entities: {
        ...world.entities, [acidFlaskId]: acidFlask, [weaponId]: sabre, [mopId]: mop, [targetId]: target,
        [playerId]: {
          ...p,
          inventory: {
            ...p.inventory!,
            containedEntityIds: [...p.inventory!.containedEntityIds, acidFlaskId, weaponId, mopId],
            equippedSlots: { WIELD: weaponId },
          },
        },
      },
    };

    // 1. Coat weapon with acid
    const coatRes = dispatchCommand(world, { type: 'COAT_WEAPON', actorId: playerId, weaponEntityId: weaponId, liquidContainerId: acidFlaskId });
    expect(coatRes.events).toContainEqual(expect.objectContaining({ type: 'ITEM_COATED', liquidType: 'NITRIC_ACID' }));
    world = coatRes.state;

    // 2. Attack with coated weapon deals extra acid damage
    const initHp = world.entities[targetId]!.anatomy!.limbs.TORSO!.hp;
    const atkRes = dispatchCommand(world, { type: 'ATTACK_ACTOR', attackerId: playerId, targetId, targetSlot: 'TORSO' });
    expect(atkRes.state.entities[targetId]!.anatomy!.limbs.TORSO!.hp).toBeLessThan(initHp - 15);

    // 3. Clean up a spill 1 tile away
    let grid = setTileCell(atkRes.state.strata.STREET!, pPos.x, pPos.y + 1, (c) => ({
      ...c, liquidType: 'WHALE_OIL', liquidVolumeMl: 250,
    }));
    world = { ...atkRes.state, strata: { ...atkRes.state.strata, STREET: grid } };

    const cleanRes = dispatchCommand(world, { type: 'CLEAN_SPILL', actorId: playerId, target: { x: pPos.x, y: pPos.y + 1, stratum: 'STREET' }, toolEntityId: mopId });
    const cleanedCell = getTileCell(cleanRes.state.strata.STREET!, pPos.x, pPos.y + 1)!;
    expect(cleanedCell.liquidType).toBe('NONE');
    expect(cleanedCell.liquidVolumeMl).toBe(0);
  });
});
