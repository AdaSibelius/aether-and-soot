import { describe, expect, it } from 'vitest';
import { EntityRecord } from '../../src/schemas/components.schema.js';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { createEntityFromBlueprint } from '../../src/sim/data/item-catalog.js';
import { getTileCell, setTileCell } from '../../src/sim/spatial/grid.js';
import { resolveKnockbackAndGravityFall } from '../../src/sim/systems/physics-traps.system.js';

describe('Phase 31: Structural Wall Breaching, Multi-Strata Gravity Falls & Clockwork Traps', () => {
  const playerId = EntityIdSchema.parse('actor_player');
  const vesselId = EntityIdSchema.parse('vessel_boiler_1');

  it('(a) boiler rupture or piledriver breaches adjacent SOOT_BRICK_WALL into RUBBLE_PILE and floods steam', () => {
    let world = createInitialWorld({ seed: 101, width: 20, height: 20 });
    // Place SOOT_BRICK_WALL east of player at (11, 10)
    let street = world.strata.STREET!;
    street = setTileCell(street, 11, 10, (c) => ({
      ...c,
      terrainType: 'SOOT_BRICK_WALL',
      blocksMovement: true,
      blocksSight: true,
      steamPressureKpa: 0,
    }));
    world = { ...world, strata: { ...world.strata, STREET: street } };

    // Place a pressurized boiler vessel at player position (10, 10)
    const vessel: EntityRecord = {
      id: vesselId,
      name: 'High-Pressure Steam Boiler',
      visual: { glyph: 'B', fgPrimary: '#D4AF37', fgSecondary: '#BA4A00', bgColor: '#0A0D0E', shaderFlags: ['PULSE_STEAM'] },
      position: { x: 10, y: 10, stratum: 'STREET', blocksMovement: true, blocksSight: false },
      pressureVessel: { currentPressureKpa: 90, maxPressureKpa: 100, ruptured: false },
    };
    world = { ...world, entities: { ...world.entities, [vesselId]: vessel } };

    // 1. Overpressurize boiler by +50 kPa -> Rupture!
    const ruptureRes = dispatchCommand(world, {
      type: 'PRESSURIZE_VESSEL',
      actorId: playerId,
      vesselEntityId: vesselId,
      pressureAddedKpa: 50,
    });
    world = ruptureRes.state;

    // Verify wall at (11, 10) was breached into RUBBLE_PILE and steam flooded in
    expect(ruptureRes.events).toContainEqual(
      expect.objectContaining({ type: 'WALL_BREACHED', target: { x: 11, y: 10, stratum: 'STREET' } }),
    );
    const breachedCell = getTileCell(world.strata.STREET!, 11, 10)!;
    expect(breachedCell.terrainType).toBe('RUBBLE_PILE');
    expect(breachedCell.blocksMovement).toBe(false);
    expect(breachedCell.steamPressureKpa).toBeGreaterThan(0);

    // 2. Piledriver breach: install piledriver arm on player and breach north wall at (10, 9)
    let piledriverWorld = createInitialWorld({ seed: 102, width: 20, height: 20 });
    let pStreet = piledriverWorld.strata.STREET!;
    pStreet = setTileCell(pStreet, 10, 9, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL', blocksMovement: true, blocksSight: true }));
    piledriverWorld = { ...piledriverWorld, strata: { ...piledriverWorld.strata, STREET: pStreet } };

    const armItem = createEntityFromBlueprint('prosthetic_pneumatic_piledriver_arm', EntityIdSchema.parse('item_piledriver_arm'))!;
    piledriverWorld = { ...piledriverWorld, entities: { ...piledriverWorld.entities, [armItem.id]: armItem } };
    piledriverWorld = dispatchCommand(piledriverWorld, {
      type: 'INSTALL_PROSTHETIC',
      actorId: playerId,
      prostheticEntityId: armItem.id,
      slot: 'RIGHT_ARM',
    }).state;

    const breachRes = dispatchCommand(piledriverWorld, {
      type: 'BREACH_TILE',
      actorId: playerId,
      target: { x: 10, y: 9, stratum: 'STREET' },
    });
    expect(breachRes.events).toContainEqual(
      expect.objectContaining({ type: 'WALL_BREACHED', breachSource: 'PILEDRIVER' }),
    );
    const pBreachedCell = getTileCell(breachRes.state.strata.STREET!, 10, 9)!;
    expect(pBreachedCell.terrainType).toBe('RUBBLE_PILE');
    expect(pBreachedCell.blocksMovement).toBe(false);
  });

  it('(b) knockback onto ABYSS_DROP in SPIRE drops actor to STREET with leg trauma & pneumatic mitigation', () => {
    let world = createInitialWorld({ seed: 202, width: 20, height: 20 });
    // Move player to SPIRE at (10, 10)
    world = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: { ...world.entities[playerId]!, position: { x: 10, y: 10, stratum: 'SPIRE', blocksMovement: true, blocksSight: false } },
      },
    };
    let spire = world.strata.SPIRE!;
    spire = setTileCell(spire, 11, 10, (c) => ({ ...c, terrainType: 'ABYSS_DROP', blocksMovement: false, blocksSight: false }));
    world = { ...world, strata: { ...world.strata, SPIRE: spire } };

    // 1. Unmitigated fall (no pneumatic leg): deals 20 HP per leg = 40 impact damage
    const fallRes = resolveKnockbackAndGravityFall(world, playerId, 1, 0, 1);
    expect(fallRes.events).toContainEqual(
      expect.objectContaining({ type: 'ACTOR_FELL_STRATUM', fromStratum: 'SPIRE', toStratum: 'STREET', impactDamage: 40 }),
    );
    const fallenPlayer = fallRes.state.entities[playerId]!;
    expect(fallenPlayer.position!.stratum).toBe('STREET');
    expect(fallenPlayer.anatomy!.limbs.LEFT_LEG!.hp).toBe(10); // 30 max - 20
    expect(fallenPlayer.anatomy!.limbs.RIGHT_LEG!.hp).toBe(10); // 30 max - 20

    // 2. Mitigated fall with pneumatic leg & >= 15 kPa steam: 50% reduction (10 HP per leg)
    let pneuWorld = createInitialWorld({ seed: 203, width: 20, height: 20 });
    pneuWorld = {
      ...pneuWorld,
      entities: {
        ...pneuWorld.entities,
        [playerId]: {
          ...pneuWorld.entities[playerId]!,
          position: { x: 10, y: 10, stratum: 'SPIRE', blocksMovement: true, blocksSight: false },
          anatomy: { ...pneuWorld.entities[playerId]!.anatomy!, steamReserveKpa: 50 },
        },
      },
      strata: { ...pneuWorld.strata, SPIRE: spire },
    };
    const pneuLeg = createEntityFromBlueprint('prosthetic_pneumatic_leg_mk1', EntityIdSchema.parse('item_leg_pneu'))!;
    pneuWorld = { ...pneuWorld, entities: { ...pneuWorld.entities, [pneuLeg.id]: pneuLeg } };
    pneuWorld = dispatchCommand(pneuWorld, {
      type: 'INSTALL_PROSTHETIC',
      actorId: playerId,
      prostheticEntityId: pneuLeg.id,
      slot: 'LEFT_LEG',
    }).state;

    const mitRes = resolveKnockbackAndGravityFall(pneuWorld, playerId, 1, 0, 1);
    expect(mitRes.events).toContainEqual(
      expect.objectContaining({ type: 'ACTOR_FELL_STRATUM', impactDamage: 20 }),
    );
    const mitPlayer = mitRes.state.entities[playerId]!;
    expect(mitPlayer.anatomy!.steamReserveKpa).toBeLessThan(50);
  });

  it('(c) stepping onto a SPARK_TRIPWIRE ignites an adjacent coal dust cloud', () => {
    let world = createInitialWorld({ seed: 303, width: 20, height: 20 });
    const pPos = world.entities[playerId]!.position!;
    const stepTarget = { x: pPos.x + 1, y: pPos.y, stratum: pPos.stratum };

    // Coat step destination and adjacent tile in dense coal dust
    let street = world.strata.STREET!;
    street = setTileCell(street, stepTarget.x, stepTarget.y, (c) => ({ ...c, coalDustDensity: 0.45 }));
    street = setTileCell(street, stepTarget.x + 1, stepTarget.y, (c) => ({ ...c, coalDustDensity: 0.45 }));
    world = { ...world, strata: { ...world.strata, STREET: street } };

    // Plant an armed SPARK_TRIPWIRE entity at destination
    const tripwireId = EntityIdSchema.parse('trap_spark_wire_1');
    const trapEntity: EntityRecord = {
      id: tripwireId,
      name: 'Clockwork Spark Tripwire',
      visual: { glyph: '^', fgPrimary: '#E74C3C', fgSecondary: '#F39C12', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
      position: { x: stepTarget.x, y: stepTarget.y, stratum: stepTarget.stratum, blocksMovement: false, blocksSight: false },
      trap: { trapKind: 'SPARK_TRIPWIRE', armed: true, damageMagnitude: 15 },
    };
    world = { ...world, entities: { ...world.entities, [tripwireId]: trapEntity } };

    // Move onto trap tile
    const stepRes = dispatchCommand(world, { type: 'MOVE_STEP', actorId: playerId, dx: 1, dy: 0 });

    // Verify trap triggered and ignited coal dust cloud
    expect(stepRes.events).toContainEqual(
      expect.objectContaining({ type: 'TRAP_TRIGGERED', trapKind: 'SPARK_TRIPWIRE' }),
    );
    expect(stepRes.events).toContainEqual(
      expect.objectContaining({ type: 'COAL_DUST_IGNITED' }),
    );

    const triggeredTrap = stepRes.state.entities[tripwireId]!;
    expect(triggeredTrap.trap!.armed).toBe(false);
    const burnedCell = getTileCell(stepRes.state.strata.STREET!, stepTarget.x, stepTarget.y)!;
    expect(burnedCell.coalDustDensity).toBe(0);
    expect(burnedCell.steamPressureKpa).toBeGreaterThan(0);
  });
});
