import { describe, expect, it } from 'vitest';
import { BlueprintIdSchema, EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld, WorldState } from '../../src/sim/core/world.js';
import { createEntityFromBlueprint } from '../../src/sim/data/item-catalog.js';
import { computeVisibleTiles, pointKey } from '../../src/sim/spatial/fov.js';
import { generateVictorianDistrict } from '../../src/sim/spatial/generator.js';
import { getTileCell, setTileCell } from '../../src/sim/spatial/grid.js';

describe('Phase 19: Procedural Building Archetypes, Glass Windows, Interactive Furniture & Schematic Manuals', () => {
  const playerId = EntityIdSchema.parse('actor_player');

  it('generates building archetypes with glass windows and interactive furniture', () => {
    const generated = generateVictorianDistrict(createInitialWorld({ seed: 42 }));
    const state = generated.state;
    const grid = state.strata.STREET!;

    // Check for glass windows placed in the district
    const glassWindows = grid.cells.filter((c) => c.terrainType === 'GLASS_WINDOW');
    expect(glassWindows.length).toBeGreaterThanOrEqual(4);

    // Check for interactive furniture
    const furnitureEntities = Object.values(state.entities).filter((e) => e.furniture !== undefined);
    expect(furnitureEntities.length).toBeGreaterThanOrEqual(4);

    const kinds = new Set(furnitureEntities.map((e) => e.furniture?.kind));
    expect(kinds.has('SURGICAL_TABLE') || kinds.has('BED')).toBe(true);
  });

  it('glass window blocks movement but allows line-of-sight FOV penetration', () => {
    const base = createInitialWorld({ seed: 101 });
    let grid = base.strata.STREET!;

    grid = setTileCell(grid, 10, 10, (prev) => ({
      ...prev,
      terrainType: 'GLASS_WINDOW',
      blocksMovement: true,
      blocksSight: false,
    }));
    base.strata.STREET = grid;
    const cell = getTileCell(grid, 10, 10)!;

    expect(cell.blocksMovement).toBe(true);
    expect(cell.blocksSight).toBe(false);

    // Compute FOV from (10, 9) looking through window at (10, 10) to (10, 11)
    const visibleTiles = computeVisibleTiles(grid, 10, 9, 5);
    expect(visibleTiles.has(pointKey(10, 10))).toBe(true);
    expect(visibleTiles.has(pointKey(10, 11))).toBe(true);
  });

  it('resolveSmashTerrain transforms adjacent glass window into walkable smashed frame', () => {
    const base = createInitialWorld({ seed: 102 });
    const player = base.entities[playerId]!;
    const px = player.position!.x;
    const py = player.position!.y;
    const stratum = player.position!.stratum;
    let grid = base.strata[stratum]!;

    grid = setTileCell(grid, px + 1, py, (prev) => ({
      ...prev,
      terrainType: 'GLASS_WINDOW',
      blocksMovement: true,
      blocksSight: false,
    }));
    base.strata[stratum] = grid;

    const res = dispatchCommand(base, {
      type: 'SMASH_TERRAIN',
      actorId: playerId,
      target: { x: px + 1, y: py, stratum },
    });

    const smashEvent = res.events.find((e) => e.type === 'TERRAIN_SMASHED');
    expect(smashEvent).toBeDefined();
    if (smashEvent?.type === 'TERRAIN_SMASHED') {
      expect(smashEvent.toTerrain).toBe('SMASHED_WINDOW_FRAME');
    }

    const updatedCell = getTileCell(res.state.strata[stratum]!, px + 1, py)!;
    expect(updatedCell.terrainType).toBe('SMASHED_WINDOW_FRAME');
    expect(updatedCell.blocksMovement).toBe(false);
    expect(updatedCell.blocksSight).toBe(false);
  });

  it('fails to smash distant non-adjacent window', () => {
    const base = createInitialWorld({ seed: 103 });
    const player = base.entities[playerId]!;
    const px = player.position!.x;
    const py = player.position!.y;
    const stratum = player.position!.stratum;
    let grid = base.strata[stratum]!;

    grid = setTileCell(grid, px + 5, py + 5, (prev) => ({
      ...prev,
      terrainType: 'GLASS_WINDOW',
      blocksMovement: true,
      blocksSight: false,
    }));
    base.strata[stratum] = grid;

    const res = dispatchCommand(base, {
      type: 'SMASH_TERRAIN',
      actorId: playerId,
      target: { x: px + 5, y: py + 5, stratum },
    });

    const smashEvent = res.events.find((e) => e.type === 'TERRAIN_SMASHED');
    expect(smashEvent).toBeUndefined();
  });

  it('gates locked schematic recipes and unlocks them when reading manual', () => {
    const base = createInitialWorld({ seed: 104 });
    const player = base.entities[playerId]!;
    const manualId = EntityIdSchema.parse('item_test_manual');
    const manual = createEntityFromBlueprint(BlueprintIdSchema.parse('book_pneumatic_schematic'), manualId, 1)!;

    const gearId = EntityIdSchema.parse('mat_gear_test');
    const plateId = EntityIdSchema.parse('mat_plate_test');
    const rubberId = EntityIdSchema.parse('mat_rubber_test');
    const gears = createEntityFromBlueprint(BlueprintIdSchema.parse('mat_brass_gears'), gearId, 3)!;
    const plates = createEntityFromBlueprint(BlueprintIdSchema.parse('mat_cast_iron_plate'), plateId, 2)!;
    const rubber = createEntityFromBlueprint(BlueprintIdSchema.parse('mat_vulcanized_rubber'), rubberId, 2)!;

    const benchId = EntityIdSchema.parse('bench_test');
    const bench = {
      id: benchId,
      name: 'Artificer Bench',
      position: {
        x: player.position!.x + 1,
        y: player.position!.y,
        stratum: player.position!.stratum,
        blocksMovement: true,
        blocksSight: false,
      },
      visual: {
        glyph: '∏',
        fgPrimary: '#d4af37',
        fgSecondary: '#f39c12',
        bgColor: '#000000',
        shaderFlags: ['NONE' as const],
      },
      workbench: { stationType: 'ARTIFICER_BENCH' as const, bonusEfficiencyPct: 0 },
    };

    const stateWithGear: WorldState = {
      ...base,
      entities: {
        ...base.entities,
        [benchId]: bench,
        [manualId]: manual,
        [gearId]: gears,
        [plateId]: plates,
        [rubberId]: rubber,
        [playerId]: {
          ...player,
          anatomy: {
            ...player.anatomy!,
            steamReserveKpa: 100,
            unlockedRecipeIds: [],
          },
          inventory: {
            ...player.inventory!,
            containedEntityIds: [...player.inventory!.containedEntityIds, manualId, gearId, plateId, rubberId],
          },
        },
      },
    };

    // Attempting to craft pneumatic leg fails because manual has not been read
    const failRes = dispatchCommand(stateWithGear, {
      type: 'CRAFT_RECIPE',
      actorId: playerId,
      recipeId: BlueprintIdSchema.parse('recipe_pneumatic_leg_mk1'),
    });

    const failEvent = failRes.events.find((e) => e.type === 'CRAFTING_FAILED');
    expect(failEvent).toBeDefined();
    if (failEvent?.type === 'CRAFTING_FAILED') {
      expect(failEvent.reason).toBe('RECIPE_LOCKED');
    }

    // Read schematic manual via USE_ITEM
    const readRes = dispatchCommand(stateWithGear, {
      type: 'USE_ITEM',
      actorId: playerId,
      itemEntityId: manualId,
    });

    const unlockEvent = readRes.events.find((e) => e.type === 'RECIPE_UNLOCKED');
    expect(unlockEvent).toBeDefined();
    if (unlockEvent?.type === 'RECIPE_UNLOCKED') {
      expect(unlockEvent.recipeId).toBe('recipe_pneumatic_leg_mk1');
    }

    const playerAfterRead = readRes.state.entities[playerId]!;
    expect(playerAfterRead.anatomy?.unlockedRecipeIds).toContain('recipe_pneumatic_leg_mk1');

    // Crafting now succeeds with unlocked recipe
    const craftRes = dispatchCommand(readRes.state, {
      type: 'CRAFT_RECIPE',
      actorId: playerId,
      recipeId: BlueprintIdSchema.parse('recipe_pneumatic_leg_mk1'),
    });

    const craftEvent = craftRes.events.find((e) => e.type === 'ITEM_CRAFTED');
    expect(craftEvent).toBeDefined();
    if (craftEvent?.type === 'ITEM_CRAFTED') {
      expect(craftEvent.recipeId).toBe('recipe_pneumatic_leg_mk1');
    }
  });

  it('restores limb HP and blood volume when resting adjacent to bed or surgical table', () => {
    const base = createInitialWorld({ seed: 105 });
    const player = base.entities[playerId]!;
    const px = player.position!.x;
    const py = player.position!.y;
    const stratum = player.position!.stratum;

    const tableId = EntityIdSchema.parse('furniture_surgical_table');
    const table = {
      id: tableId,
      name: "Chirurgeon's Table",
      position: { x: px + 1, y: py, stratum, blocksMovement: true, blocksSight: false },
      visual: {
        glyph: '╦',
        fgPrimary: '#1abc9c',
        fgSecondary: '#16a085',
        bgColor: '#000000',
        shaderFlags: ['NONE' as const],
      },
      furniture: { kind: 'SURGICAL_TABLE' as const, label: 'Chirurgeon Table' },
    };

    const injuredState: WorldState = {
      ...base,
      entities: {
        ...base.entities,
        [tableId]: table,
        [playerId]: {
          ...player,
          anatomy: {
            ...player.anatomy!,
            bloodVolumePct: 60,
            limbs: {
              ...player.anatomy!.limbs,
              TORSO: {
                ...player.anatomy!.limbs.TORSO!,
                hp: 15,
              },
            },
          },
        },
      },
    };

    const restRes = dispatchCommand(injuredState, {
      type: 'REST_AT_BED',
      actorId: playerId,
    });

    const restEvent = restRes.events.find((e) => e.type === 'ACTOR_RESTED');
    expect(restEvent).toBeDefined();
    if (restEvent?.type === 'ACTOR_RESTED') {
      expect(restEvent.bloodRestoredPct).toBeGreaterThan(0);
      expect(restEvent.hpRestored).toBeGreaterThan(0);
    }

    const restedPlayer = restRes.state.entities[playerId]!;
    expect(restedPlayer.anatomy!.bloodVolumePct).toBeGreaterThan(60);
    expect(restedPlayer.anatomy!.limbs.TORSO!.hp).toBeGreaterThan(15);
  });
});
