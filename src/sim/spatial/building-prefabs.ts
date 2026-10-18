import { EntityRecord } from '../../schemas/components.schema.js';
import { BlueprintIdSchema, EntityId, EntityIdSchema, Point2D } from '../../schemas/primitives.schema.js';
import { carveBuildingWithDoor, carveCorridor, carveRoom } from './district-layout.js';
import { setTileCell, StratumGrid } from './grid.js';

import { createEntityFromBlueprint } from '../data/item-catalog.js';

export interface DistrictArchetypesResult {
  readonly grid: StratumGrid;
  readonly entities: Record<string, EntityRecord>;
}

function seedContainer(
  entities: Record<string, EntityRecord>,
  items: readonly { id: string; blueprintId: string; quantity: number }[],
): EntityRecord['inventory'] {
  const containedEntityIds: EntityId[] = [];
  let totalMass = 0;
  for (const it of items) {
    const eid = EntityIdSchema.parse(it.id);
    const created = createEntityFromBlueprint(it.blueprintId, eid, it.quantity);
    if (created) {
      entities[eid] = created;
      containedEntityIds.push(eid);
      totalMass += (created.item?.massGrams ?? 0) * (created.item?.quantity ?? 1);
    }
  }
  return { containedEntityIds, currentMassGrams: totalMass, maxMassGrams: 50000, maxVolumeMl: 50000 };
}

function setWindow(grid: StratumGrid, x: number, y: number): StratumGrid {
  return setTileCell(grid, x, y, (c) => ({
    ...c,
    terrainType: 'GLASS_WINDOW',
    blocksMovement: true,
    blocksSight: false,
  }));
}

/**
 * Procedurally generates 5 distinct Victorian building archetypes across the street stratum:
 * 1. Chirurgeon's Apothecary (Surgical table, medicine locker, tonic)
 * 2. Clockwork Foundry (Boiler, tool lockers, brass gear crates)
 * 3. Constabulary Watchhouse (Holding cells, armoury locker, patrolling warden)
 * 4. Tenement & Public House (Beds/cots, bookshelf, patron seating)
 * 5. Aether Alchemical Lab (Alchemical still, aether crystals, schematic manuals)
 */
export function populateDistrictArchetypes(
  initialGrid: StratumGrid,
  initialEntities: Record<string, EntityRecord>,
  width: number,
  height: number,
): DistrictArchetypesResult {
  let grid = initialGrid;
  const entities = { ...initialEntities };
  const centerY = Math.floor(height / 2);

  // Procedural building archetypes are engineered for standard 48x36 districts (Phase 18+).
  // Small legacy districts (e.g. 24x24 in test fixtures) preserve their minimal layout.
  if (width < 36 || height < 28) {
    return { grid: initialGrid, entities: initialEntities };
  }

  // 1. Chirurgeon's Apothecary (top-right)
  const apothCx = 34;
  const apothCy = 7;
  const apothDoor: Point2D = { x: apothCx, y: apothCy + 3 };
  grid = carveBuildingWithDoor(grid, apothCx - 3, apothCy - 3, apothCx + 3, apothCy + 3, 'COBBLESTONE_FLOOR', apothDoor, 'CLOSED');
  grid = setWindow(grid, apothCx - 2, apothCy - 3);
  grid = setWindow(grid, apothCx + 2, apothCy - 3);
  grid = carveCorridor(grid, { x: apothDoor.x, y: apothDoor.y + 1 }, { x: apothDoor.x, y: centerY }, 'COBBLESTONE_FLOOR');

  const surgTableId = EntityIdSchema.parse('furniture_surgical_table');
  entities[surgTableId] = {
    id: surgTableId,
    name: 'Cast-Iron Surgical Table',
    visual: { glyph: '┬', fgPrimary: '#E74C3C', fgSecondary: '#C0392B', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: apothCx - 1, y: apothCy, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    furniture: { kind: 'SURGICAL_TABLE', label: 'Cast-Iron Surgical Table' },
  };

  const medLockerId = EntityIdSchema.parse('furniture_medicine_locker');
  const medInv = seedContainer(entities, [
    { id: 'loot_apoth_tonic_1', blueprintId: 'item_coagulant_tonic', quantity: 2 },
    { id: 'loot_apoth_rubber_1', blueprintId: 'mat_vulcanized_rubber', quantity: 1 },
  ]);
  entities[medLockerId] = {
    id: medLockerId,
    name: 'Sanitary Medicine Locker',
    visual: { glyph: '⌸', fgPrimary: '#5DADE2', fgSecondary: '#2E86C1', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: apothCx + 1, y: apothCy, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    furniture: { kind: 'LOCKER', label: 'Sanitary Medicine Locker' },
    inventory: medInv,
  };

  // 2. Clockwork Foundry (top-left) - add glass windows overlooking the street
  grid = setWindow(grid, 3, 2);
  grid = setWindow(grid, 5, 2);
  const gearCrateId = EntityIdSchema.parse('furniture_gear_crate');
  const gearInv = seedContainer(entities, [
    { id: 'loot_foundry_gears_1', blueprintId: 'mat_brass_gears', quantity: 3 },
    { id: 'loot_foundry_coal_1', blueprintId: 'commodity_anthracite_briquette', quantity: 2 },
    { id: 'loot_foundry_pence_1', blueprintId: 'item_crown_pence_pouch', quantity: 1 },
  ]);
  entities[gearCrateId] = {
    id: gearCrateId,
    name: 'Heavy Brass Gear Crate',
    visual: { glyph: '⌸', fgPrimary: '#D4AF37', fgSecondary: '#8B6914', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: 3, y: 5, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    furniture: { kind: 'CRATE', label: 'Heavy Brass Gear Crate' },
    inventory: gearInv,
  };

  // 3. Constabulary Watchhouse (bottom-left)
  const watchCx = 10;
  const watchCy = 27;
  const watchDoor: Point2D = { x: watchCx, y: watchCy - 3 };
  grid = carveBuildingWithDoor(grid, watchCx - 4, watchCy - 3, watchCx + 4, watchCy + 3, 'COBBLESTONE_FLOOR', watchDoor, 'CLOSED');
  grid = setWindow(grid, watchCx - 2, watchCy + 3);
  grid = setWindow(grid, watchCx + 2, watchCy + 3);
  grid = carveCorridor(grid, { x: watchDoor.x, y: watchDoor.y - 1 }, { x: watchDoor.x, y: centerY }, 'COBBLESTONE_FLOOR');

  // Holding Cell inside Watchhouse
  grid = carveRoom(grid, watchCx - 2, watchCy + 1, 1, 1, 'IRON_GRATE');

  const armLockerId = EntityIdSchema.parse('furniture_armoury_locker');
  const armInv = seedContainer(entities, [
    { id: 'loot_armoury_plate_1', blueprintId: 'mat_cast_iron_plate', quantity: 2 },
    { id: 'loot_armoury_wrench_1', blueprintId: 'weapon_heavy_pipe_wrench', quantity: 1 },
  ]);
  entities[armLockerId] = {
    id: armLockerId,
    name: 'Constabulary Armoury Locker',
    visual: { glyph: '⌸', fgPrimary: '#7F8C8D', fgSecondary: '#34495E', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: watchCx + 2, y: watchCy, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    furniture: { kind: 'LOCKER', label: 'Constabulary Armoury Locker' },
    inventory: armInv,
  };

  // 4. Tenement & Public House (bottom-right)
  const pubCx = 35;
  const pubCy = 27;
  const pubDoor: Point2D = { x: pubCx, y: pubCy - 4 };
  grid = carveBuildingWithDoor(grid, pubCx - 5, pubCy - 4, pubCx + 5, pubCy + 4, 'COBBLESTONE_FLOOR', pubDoor, 'CLOSED');
  grid = setWindow(grid, pubCx - 3, pubCy + 4);
  grid = setWindow(grid, pubCx + 3, pubCy + 4);
  grid = carveCorridor(grid, { x: pubDoor.x, y: pubDoor.y - 1 }, { x: pubDoor.x, y: centerY }, 'COBBLESTONE_FLOOR');

  const cotAId = EntityIdSchema.parse('furniture_cot_a');
  entities[cotAId] = {
    id: cotAId,
    name: 'Sackcloth Sleeping Cot',
    visual: { glyph: 'π', fgPrimary: '#F39C12', fgSecondary: '#D68910', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: pubCx - 3, y: pubCy + 1, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    furniture: { kind: 'BED', label: 'Sackcloth Sleeping Cot' },
  };

  const cotBId = EntityIdSchema.parse('furniture_cot_b');
  entities[cotBId] = {
    id: cotBId,
    name: 'Sackcloth Sleeping Cot',
    visual: { glyph: 'π', fgPrimary: '#F39C12', fgSecondary: '#D68910', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: pubCx - 1, y: pubCy + 1, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    furniture: { kind: 'BED', label: 'Sackcloth Sleeping Cot' },
  };

  const bookshelfId = EntityIdSchema.parse('furniture_bookshelf');
  const bookInv = seedContainer(entities, [
    { id: 'loot_library_manual_1', blueprintId: 'book_pneumatic_schematic', quantity: 1 },
    { id: 'loot_library_manual_2', blueprintId: 'book_ocular_schematic', quantity: 1 },
  ]);
  entities[bookshelfId] = {
    id: bookshelfId,
    name: 'Public House Library Shelf',
    visual: { glyph: 'E', fgPrimary: '#A04000', fgSecondary: '#6E2C00', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: pubCx, y: pubCy + 2, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    furniture: { kind: 'BOOKSHELF', label: 'Public House Library Shelf' },
    inventory: bookInv,
  };

  // 5. Aether Alchemical Lab (top-center)
  const labCx = 22;
  const labCy = 7;
  const labDoor: Point2D = { x: labCx, y: labCy + 3 };
  grid = carveBuildingWithDoor(grid, labCx - 3, labCy - 3, labCx + 3, labCy + 3, 'COBBLESTONE_FLOOR', labDoor, 'CLOSED');
  grid = setWindow(grid, labCx - 2, labCy - 3);
  grid = setWindow(grid, labCx + 2, labCy - 3);
  grid = carveCorridor(grid, { x: labDoor.x, y: labDoor.y + 1 }, { x: labDoor.x, y: centerY }, 'COBBLESTONE_FLOOR');

  const stillId = EntityIdSchema.parse('station_alchemical_still');
  entities[stillId] = {
    id: stillId,
    name: 'Aetheric Fractional Distillation Still',
    visual: { glyph: '&', fgPrimary: '#AF7AC5', fgSecondary: '#7D3C98', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
    position: { x: labCx - 1, y: labCy, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    workbench: { stationType: 'ALCHEMICAL_STILL', bonusEfficiencyPct: 25 },
  };

  // Schematic Manuals in the Alchemical Lab
  const manualPneumaticId = EntityIdSchema.parse('item_manual_pneumatics');
  entities[manualPneumaticId] = {
    id: manualPneumaticId,
    name: 'Technical Folio: Pneumatic Actuators',
    visual: { glyph: '?', fgPrimary: '#F4D03F', fgSecondary: '#D4AC0D', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: labCx + 1, y: labCy - 1, stratum: 'STREET', blocksMovement: false, blocksSight: false },
    item: {
      blueprintId: BlueprintIdSchema.parse('book_pneumatic_schematic'),
      category: 'CONSUMABLE',
      massGrams: 500,
      volumeMl: 600,
      quantity: 1,
      stackable: false,
      unlocksRecipeId: BlueprintIdSchema.parse('recipe_pneumatic_leg_mk1'),
    },
  };

  const manualOcularId = EntityIdSchema.parse('item_manual_optics');
  entities[manualOcularId] = {
    id: manualOcularId,
    name: "Artificer's Tract: Aetheric Refraction",
    visual: { glyph: '?', fgPrimary: '#5DADE2', fgSecondary: '#2E86C1', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
    position: { x: labCx + 1, y: labCy + 1, stratum: 'STREET', blocksMovement: false, blocksSight: false },
    item: {
      blueprintId: BlueprintIdSchema.parse('book_ocular_schematic'),
      category: 'CONSUMABLE',
      massGrams: 400,
      volumeMl: 500,
      quantity: 1,
      stackable: false,
      unlocksRecipeId: BlueprintIdSchema.parse('recipe_clockwork_ocular_lens'),
    },
  };

  return { grid, entities };
}
