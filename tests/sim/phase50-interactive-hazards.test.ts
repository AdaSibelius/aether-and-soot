import { describe, expect, it } from 'vitest';
import { EntityRecord } from '../../src/schemas/components.schema.js';
import { BlueprintIdSchema, EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld, serializeWorld, deserializeWorld } from '../../src/sim/core/world.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { projectWorldToVisualFrame } from '../../src/client/projection/frame-adapter.js';
import { getTileCell, setTileCell } from '../../src/sim/spatial/grid.js';
import {
  advanceEnvironmentalHazards,
  calculateGaslightField,
} from '../../src/sim/systems/environmental-hazards.system.js';
import { applyLiquidSurfaceVisual, applySootVisualOverlay } from '../../src/client/projection/environmental-visuals.js';

describe('Phase 50: Interactive World Features, Tactical Hazards & Mechanical Agency', () => {
  const playerId = EntityIdSchema.parse('actor_player');

  it('triggers booby-trap when looting a rigged container via LOOT_CONTAINER', () => {
    let state = createInitialWorld({ seed: 101 });
    state = {
      ...state,
      entities: {
        ...state.entities,
        [playerId]: {
          ...state.entities[playerId]!,
          position: { ...state.entities[playerId]!.position!, x: 5, y: 5, stratum: 'STREET' },
        },
      },
    };

    const containerId = EntityIdSchema.parse('rigged_locker');
    const itemId = EntityIdSchema.parse('item_salvage_scrap');
    const scrapItem: EntityRecord = {
      id: itemId,
      name: 'Pneumatic Scrap',
      visual: { glyph: '*', fgPrimary: '#D4AF37', fgSecondary: '#8B6914', bgColor: '#0A0D0E', shaderFlags: [] },
      item: { blueprintId: BlueprintIdSchema.parse('mat_scrap_iron'), category: 'MATERIAL', massGrams: 500, volumeMl: 250, stackable: true, quantity: 1 },
    };
    const riggedContainer: EntityRecord = {
      id: containerId,
      name: 'Booby-Trapped Locker',
      visual: { glyph: 'L', fgPrimary: '#E67E22', fgSecondary: '#A04000', bgColor: '#0A0D0E', shaderFlags: [] },
      position: { x: 5, y: 6, stratum: 'STREET', blocksMovement: true, blocksSight: false },
      furniture: { kind: 'LOCKER', label: 'Storage Locker' },
      inventory: { containedEntityIds: [itemId], maxMassGrams: 20000, maxVolumeMl: 20000, currentMassGrams: 500 },
      trap: { trapKind: 'SPRING_JAW', armed: true, damageMagnitude: 15 },
    };
    state = { ...state, entities: { ...state.entities, [itemId]: scrapItem, [containerId]: riggedContainer } };

    const lootRes = dispatchCommand(state, { type: 'LOOT_CONTAINER', actorId: playerId, containerId });
    expect(lootRes.events.some((e) => e.type === 'TRAP_TRIGGERED')).toBe(true);
    expect(lootRes.events.some((e) => e.type === 'HAZARD_TRIGGERED')).toBe(true);
    expect(lootRes.events.some((e) => e.type === 'CONTAINER_LOOTED')).toBe(true);
    expect(lootRes.state.entities[containerId]?.trap?.armed).toBe(false);
    expect(lootRes.state.entities[playerId]?.inventory?.containedEntityIds).toContain(itemId);
  });

  it('tactically overpressurizes vessel to breach adjacent walls via PRESSURIZE_VESSEL', () => {
    let state = createInitialWorld({ seed: 102 });
    const vesselId = EntityIdSchema.parse('tactical_boiler');
    const boiler: EntityRecord = {
      id: vesselId,
      name: 'Foundry Steam Boiler',
      visual: { glyph: 'B', fgPrimary: '#E67E22', fgSecondary: '#D35400', bgColor: '#0A0D0E', shaderFlags: ['PULSE_STEAM'] },
      position: { x: 10, y: 10, stratum: 'STREET', blocksMovement: true, blocksSight: false },
      pressureVessel: { currentPressureKpa: 280, maxPressureKpa: 300, ruptured: false },
    };
    state = { ...state, entities: { ...state.entities, [vesselId]: boiler } };
    state = {
      ...state,
      strata: {
        ...state.strata,
        STREET: setTileCell(state.strata.STREET!, 11, 10, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL', blocksMovement: true, blocksSight: true })),
      },
    };

    const breachRes = dispatchCommand(state, { type: 'PRESSURIZE_VESSEL', actorId: playerId, vesselEntityId: vesselId, pressureAddedKpa: 50 });
    expect(breachRes.state.entities[vesselId]?.pressureVessel?.ruptured).toBe(true);
    expect(breachRes.events.some((e) => e.type === 'WALL_BREACHED')).toBe(true);
    const breachedCell = getTileCell(breachRes.state.strata.STREET!, 11, 10);
    expect(breachedCell?.terrainType).toBe('RUBBLE_PILE');
    expect(breachedCell?.blocksMovement).toBe(false);
  });

  it('pries jammed iron grate into passable cobblestone using crowbar via PRY_OBSTACLE', () => {
    let state = createInitialWorld({ seed: 103 });
    const toolId = EntityIdSchema.parse('item_crowbar');
    const crowbar: EntityRecord = {
      id: toolId,
      name: 'Heavy Steel Crowbar',
      visual: { glyph: '/', fgPrimary: '#BDC3C7', fgSecondary: '#7F8C8D', bgColor: '#0A0D0E', shaderFlags: [] },
      item: { blueprintId: BlueprintIdSchema.parse('tool_crowbar'), category: 'EQUIPMENT', massGrams: 2000, volumeMl: 800, stackable: false, quantity: 1, toolQualities: { PRYING: 2 } },
    };
    state = {
      ...state,
      entities: {
        ...state.entities,
        [toolId]: crowbar,
        [playerId]: {
          ...state.entities[playerId]!,
          position: { ...state.entities[playerId]!.position!, x: 4, y: 4, stratum: 'STREET' },
          inventory: { ...state.entities[playerId]!.inventory!, containedEntityIds: [...state.entities[playerId]!.inventory!.containedEntityIds, toolId] },
        },
      },
      strata: {
        ...state.strata,
        STREET: setTileCell(state.strata.STREET!, 5, 4, (c) => ({ ...c, terrainType: 'IRON_GRATE', blocksMovement: true, blocksSight: false })),
      },
    };

    const pryRes = dispatchCommand(state, { type: 'PRY_OBSTACLE', actorId: playerId, target: { x: 5, y: 4, stratum: 'STREET' }, toolEntityId: toolId });
    expect(pryRes.events.some((e) => e.type === 'OBSTACLE_PRIED')).toBe(true);
    const cell = getTileCell(pryRes.state.strata.STREET!, 5, 4);
    expect(cell?.terrainType).toBe('COBBLESTONE_FLOOR');
    expect(cell?.blocksMovement).toBe(false);
  });

  it('heals anatomy and restores blood volume via PAY_CHIRURGEON_HEAL', () => {
    let state = createInitialWorld({ seed: 104 });
    const chirurgeonId = EntityIdSchema.parse('clinic_doc');
    const doc: EntityRecord = {
      id: chirurgeonId,
      name: 'Chirurgeon Dr. Bell',
      visual: { glyph: '@', fgPrimary: '#2ECC71', fgSecondary: '#27AE60', bgColor: '#0A0D0E', shaderFlags: [] },
      position: { x: 8, y: 9, stratum: 'STREET', blocksMovement: true, blocksSight: false },
      actor: { energy: 100, speed: 100, isPlayer: false },
      aiController: { role: 'CHIRURGEON', hostile: false, factionId: 'CLOCKWORK_GUILD', alertState: 'IDLE' },
    };
    state = {
      ...state,
      economy: { ...state.economy, playerTreasuryPence: 200 },
      entities: {
        ...state.entities,
        [chirurgeonId]: doc,
        [playerId]: {
          ...state.entities[playerId]!,
          position: { ...state.entities[playerId]!.position!, x: 8, y: 8, stratum: 'STREET' },
          anatomy: {
            ...state.entities[playerId]!.anatomy!,
            bloodVolumePct: 40,
            limbs: {
              ...state.entities[playerId]!.anatomy!.limbs,
              TORSO: { ...state.entities[playerId]!.anatomy!.limbs.TORSO!, hp: 10 },
            },
          },
        },
      },
    };

    const healRes = dispatchCommand(state, { type: 'PAY_CHIRURGEON_HEAL', actorId: playerId, chirurgeonId });
    expect(healRes.events.some((e) => e.type === 'CHIRURGEON_HEAL_COMPLETED')).toBe(true);
    expect(healRes.state.entities[playerId]?.anatomy?.bloodVolumePct).toBe(100);
    expect(healRes.state.entities[playerId]?.anatomy?.limbs.TORSO?.hp).toBe(healRes.state.entities[playerId]?.anatomy?.limbs.TORSO?.maxHp);
    expect(healRes.state.economy.playerTreasuryPence).toBe(165);
  });

  it('ignites contiguous whale oil puddles in a cascading conflagration', () => {
    let state = createInitialWorld({ seed: 105 });
    let grid = state.strata.STREET!;
    for (let x = 12; x <= 15; x++) {
      grid = setTileCell(grid, x, 12, (c) => ({ ...c, liquidType: 'WHALE_OIL', liquidVolumeMl: 250 }));
    }
    state = { ...state, strata: { ...state.strata, STREET: grid } };

    const sparkRes = dispatchCommand(state, { type: 'EMIT_SPARK', actorId: playerId, target: { x: 12, y: 12, stratum: 'STREET' } });
    const ignited = sparkRes.events.filter((e) => e.type === 'LIQUID_IGNITED');
    expect(ignited.length).toBe(4);
    expect(sparkRes.events.some((e) => e.type === 'HAZARD_TRIGGERED')).toBe(true);

    const checkCell = getTileCell(sparkRes.state.strata.STREET!, 15, 12);
    expect(checkCell?.liquidType).toBe('NONE');
    expect(checkCell?.liquidVolumeMl).toBe(0);
    expect(checkCell?.steamPressureKpa).toBeGreaterThan(0);
  });

  it('drifts soot clouds with dynamic ASCII character occlusion and acid drip hazards', () => {
    let state = createInitialWorld({ seed: 106 });
    let grid = state.strata.STREET!;
    grid = setTileCell(grid, 10, 10, (c) => ({ ...c, smokePpm: 120 }));
    state = {
      ...state,
      strata: { ...state.strata, STREET: grid },
      entities: {
        ...state.entities,
        acid_fixture: {
          id: EntityIdSchema.parse('acid_fixture'),
          name: 'Ceiling Acid_Drip Pipe',
          visual: { glyph: 'T', fgPrimary: '#2ECC71', fgSecondary: '#27AE60', bgColor: '#0A0D0E', shaderFlags: [] },
          position: { x: 10, y: 11, stratum: 'STREET', blocksMovement: false, blocksSight: false },
        },
        [playerId]: {
          ...state.entities[playerId]!,
          position: { ...state.entities[playerId]!.position!, x: 11, y: 10, stratum: 'STREET' },
        },
      },
    };

    const hazardRes = advanceEnvironmentalHazards(state, 'STREET');
    expect(hazardRes.events.some((e) => e.type === 'HAZARD_TRIGGERED')).toBe(true);
    const acidCell = getTileCell(hazardRes.state.strata.STREET!, 10, 11);
    expect(acidCell?.liquidType).toBe('NITRIC_ACID');
    expect(acidCell?.liquidVolumeMl).toBeGreaterThan(0);

    const baseSpec = { glyph: '.', fgPrimary: '#CCCCCC', fgSecondary: '#888888', bgColor: '#000000', shaderFlags: [] };
    const sootVisual1 = applySootVisualOverlay(baseSpec, 100, 0, 1, 1, 0, true, true);
    const sootVisual2 = applySootVisualOverlay(baseSpec, 100, 0, 1, 1, 1, true, true);
    expect(['%', '&', '*']).toContain(sootVisual1.glyph);
    expect(sootVisual1.shaderFlags).toContain('SOOT_OCCLUSION');
    expect(sootVisual1.glyph).not.toBe(sootVisual2.glyph);

    // Unexplored tiles must return baseSpec unmodified (Phase 0: TSK-P0-01)
    const unexploredSoot = applySootVisualOverlay(baseSpec, 100, 0, 1, 1, 0, false, false);
    expect(unexploredSoot).toBe(baseSpec);

    const oilVisual = applyLiquidSurfaceVisual(baseSpec, 'WHALE_OIL', 200, true, true);
    expect(oilVisual.glyph).toBe('~');
    expect(oilVisual.shaderFlags).toContain('SPARK_GLINT');

    const unexploredLiquid = applyLiquidSurfaceVisual(baseSpec, 'WHALE_OIL', 200, false, false);
    expect(unexploredLiquid).toBe(baseSpec);
  });

  it('projects volumetric gaslight illumination and verifies round-trip serialization', () => {
    let state = createInitialWorld({ seed: 107 });
    state = {
      ...state,
      strata: {
        ...state.strata,
        STREET: setTileCell(state.strata.STREET!, 12, 12, (c) => ({ ...c, terrainType: 'GASLAMP_POST' })),
      },
      entities: {
        ...state.entities,
        [playerId]: {
          ...state.entities[playerId]!,
          position: { ...state.entities[playerId]!.position!, x: 12, y: 13, stratum: 'STREET' },
        },
      },
    };

    const gaslightMap = calculateGaslightField(state, 'STREET');
    expect((gaslightMap.get('12,13') ?? 0)).toBeGreaterThan(0.5);

    const frame = projectWorldToVisualFrame(state, playerId);
    const gaslitCell = frame.cells.find((c) => c.worldX === 12 && c.worldY === 13);
    expect(gaslitCell?.visual.shaderFlags).toContain('GASLIGHT_RADIANCE');

    const serialized = serializeWorld(state);
    const deserialized = deserializeWorld(serialized);
    expect(deserialized.seed).toBe(state.seed);
    expect(deserialized.turnCount).toBe(state.turnCount);
    expect(deserialized.entities[playerId]?.position?.x).toBe(12);
  });
});
