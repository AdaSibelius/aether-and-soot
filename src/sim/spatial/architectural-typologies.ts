import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityId, EntityIdSchema, Point2D } from '../../schemas/primitives.schema.js';
import { createEntityFromBlueprint } from '../data/item-catalog.js';
import { setTileCell, StratumGrid } from './grid.js';
import { carveCorridor } from './district-layout.js';
import { carveMultiRoomBuilding } from './interior-zoning.js';

export interface TypologyPlacementResult {
  readonly grid: StratumGrid;
  readonly entities: Record<string, EntityRecord>;
  readonly doors: Record<string, Point2D>;
  readonly keyPositions: Record<string, Point2D>;
}

export function seedContainer(
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

/** Generates all 6 multi-room architectural typologies for standard Victorian districts. */
export function generateArchitecturalTypologies(
  initialGrid: StratumGrid,
  initialEntities: Record<string, EntityRecord>,
  _width: number,
  height: number,
): TypologyPlacementResult {
  let grid = initialGrid;
  const entities = { ...initialEntities };
  const doors: Record<string, Point2D> = {};
  const keyPositions: Record<string, Point2D> = {};
  const centerY = height >= 36 ? 18 : Math.floor(height / 2);

  // 1. Victorian Apothecary & Chirurgeon Clinic (Top-Right)
  const apothDoor = { x: 38, y: 12 };
  doors.apothecary = apothDoor;
  grid = carveMultiRoomBuilding(grid, {
    x1: 33, y1: 3, x2: 43, y2: 12, mainDoor: apothDoor,
    rooms: [
      { zone: 'RECEPTION', x1: 34, y1: 8, x2: 42, y2: 11, label: 'Waiting Lounge' },
      { zone: 'SURGICAL_BAY', x1: 34, y1: 4, x2: 37, y2: 7, label: 'Operating Theatre' },
      { zone: 'STORAGE', x1: 39, y1: 4, x2: 42, y2: 7, label: 'Chemical Storage' },
    ],
    interiorDoors: [{ x: 36, y: 7 }, { x: 40, y: 7 }],
    windows: [{ x: 35, y: 3 }, { x: 41, y: 3 }],
  });
  grid = carveCorridor(grid, { x: apothDoor.x, y: apothDoor.y + 1 }, { x: apothDoor.x, y: centerY }, 'COBBLESTONE_FLOOR');

  const surgTableId = EntityIdSchema.parse('furniture_surgical_table');
  entities[surgTableId] = {
    id: surgTableId, name: 'Cast-Iron Surgical Operating Table',
    visual: { glyph: '┬', fgPrimary: '#E74C3C', fgSecondary: '#C0392B', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: 35, y: 5, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    furniture: { kind: 'SURGICAL_TABLE', label: 'Cast-Iron Surgical Table' },
  };
  const medLockerId = EntityIdSchema.parse('furniture_medicine_locker');
  entities[medLockerId] = {
    id: medLockerId, name: 'Sanitary Chirurgical Medicine Locker',
    visual: { glyph: '⌸', fgPrimary: '#5DADE2', fgSecondary: '#2E86C1', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: 41, y: 5, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    furniture: { kind: 'LOCKER', label: 'Sanitary Medicine Locker' },
    inventory: seedContainer(entities, [
      { id: 'loot_apoth_tonic_1', blueprintId: 'item_coagulant_tonic', quantity: 2 },
      { id: 'loot_apoth_rubber_1', blueprintId: 'mat_vulcanized_rubber', quantity: 2 },
    ]),
  };

  // 2. Clockwork Pawnshop & Cartel Bank (Top-Left-Mid)
  const pawnDoor = { x: 12, y: 12 };
  doors.pawnshop = pawnDoor;
  grid = carveMultiRoomBuilding(grid, {
    x1: 8, y1: 3, x2: 15, y2: 12, mainDoor: pawnDoor,
    rooms: [
      { zone: 'RECEPTION', x1: 9, y1: 8, x2: 14, y2: 11, label: 'Appraisal Concourse' },
      { zone: 'STORAGE', x1: 9, y1: 4, x2: 11, y2: 7, label: 'Pawn Stash' },
      { zone: 'VAULT', x1: 12, y1: 4, x2: 14, y2: 7, label: 'Cartel Strongroom' },
    ],
    interiorDoors: [{ x: 10, y: 7 }, { x: 13, y: 7 }],
    windows: [{ x: 10, y: 3 }, { x: 14, y: 3 }],
  });
  grid = carveCorridor(grid, { x: pawnDoor.x, y: pawnDoor.y + 1 }, { x: pawnDoor.x, y: centerY }, 'COBBLESTONE_FLOOR');

  const vaultSafeId = EntityIdSchema.parse('furniture_safe_vault');
  entities[vaultSafeId] = {
    id: vaultSafeId, name: 'Reinforced Clockwork Cartel Safe',
    visual: { glyph: '⌸', fgPrimary: '#F4D03F', fgSecondary: '#B7950B', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
    position: { x: 13, y: 5, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    furniture: { kind: 'SAFE_VAULT', label: 'Reinforced Clockwork Cartel Safe' },
    inventory: seedContainer(entities, [
      { id: 'loot_bank_pence_1', blueprintId: 'item_crown_pence_pouch', quantity: 2 },
      { id: 'loot_bank_gears_1', blueprintId: 'mat_brass_gears', quantity: 3 },
    ]),
  };
  const gearCrateId = EntityIdSchema.parse('furniture_gear_crate');
  entities[gearCrateId] = {
    id: gearCrateId, name: 'Heavy Brass Gear Crate',
    visual: { glyph: '⌸', fgPrimary: '#D4AF37', fgSecondary: '#8B6914', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: 10, y: 5, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    furniture: { kind: 'CRATE', label: 'Heavy Brass Gear Crate' },
    inventory: seedContainer(entities, [
      { id: 'loot_foundry_gears_1', blueprintId: 'mat_brass_gears', quantity: 3 },
      { id: 'loot_foundry_coal_1', blueprintId: 'commodity_anthracite_briquette', quantity: 2 },
    ]),
  };

  // 3. Steam Boilerhouse & Slag Furnace (Bottom-Left)
  const boilerDoor = { x: 8, y: 24 };
  doors.boilerhouse = boilerDoor;
  grid = carveMultiRoomBuilding(grid, {
    x1: 3, y1: 24, x2: 13, y2: 33, mainDoor: boilerDoor,
    rooms: [
      { zone: 'WORKSHOP', x1: 4, y1: 25, x2: 12, y2: 28, label: 'Smelting Hearth' },
      { zone: 'STORAGE', x1: 4, y1: 30, x2: 12, y2: 32, label: 'Fuel Stacks' },
    ],
    interiorDoors: [{ x: 8, y: 29 }],
    windows: [{ x: 5, y: 33 }, { x: 11, y: 33 }],
  });
  grid = setTileCell(grid, boilerDoor.x, boilerDoor.y, (c) => ({
    ...c,
    terrainType: 'WOODEN_DOOR_OPEN',
    blocksMovement: false,
    blocksSight: false,
    interiorZone: 'WORKSHOP',
  }));
  grid = carveCorridor(grid, { x: boilerDoor.x, y: boilerDoor.y - 1 }, { x: boilerDoor.x, y: centerY }, 'COBBLESTONE_FLOOR');

  const boilerPos = { x: 6, y: 26 };
  keyPositions.boiler = boilerPos;
  const furnaceId = EntityIdSchema.parse('furniture_smelting_furnace');
  entities[furnaceId] = {
    id: furnaceId, name: 'Reverberatory Smelting Furnace',
    visual: { glyph: 'Ω', fgPrimary: '#E67E22', fgSecondary: '#D35400', bgColor: '#0A0D0E', shaderFlags: ['PULSE_STEAM'] },
    position: { x: 10, y: 26, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    furniture: { kind: 'SMELTING_FURNACE', label: 'Reverberatory Smelting Furnace' },
  };

  // 4. Tenement Rookeries (Bottom-Right)
  const rookDoor = { x: 38, y: 24 };
  doors.rookeries = rookDoor;
  grid = carveMultiRoomBuilding(grid, {
    x1: 33, y1: 24, x2: 43, y2: 33, mainDoor: rookDoor,
    rooms: [
      { zone: 'RECEPTION', x1: 34, y1: 25, x2: 42, y2: 28, label: 'Common Hall' },
      { zone: 'STORAGE', x1: 34, y1: 30, x2: 42, y2: 32, label: 'Dormitory Stash' },
    ],
    interiorDoors: [{ x: 38, y: 29 }],
    windows: [{ x: 35, y: 33 }, { x: 41, y: 33 }],
  });
  grid = carveCorridor(grid, { x: rookDoor.x, y: rookDoor.y - 1 }, { x: rookDoor.x, y: centerY }, 'COBBLESTONE_FLOOR');

  const cotId = EntityIdSchema.parse('furniture_cot_a');
  entities[cotId] = {
    id: cotId, name: 'Sackcloth Sleeping Cot',
    visual: { glyph: 'π', fgPrimary: '#F39C12', fgSecondary: '#D68910', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: 36, y: 31, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    furniture: { kind: 'BED', label: 'Sackcloth Sleeping Cot' },
  };
  const shelfId = EntityIdSchema.parse('furniture_bookshelf');
  entities[shelfId] = {
    id: shelfId, name: 'Tenement Public Library Shelf',
    visual: { glyph: 'E', fgPrimary: '#A04000', fgSecondary: '#6E2C00', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: 40, y: 26, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    furniture: { kind: 'BOOKSHELF', label: 'Tenement Public Library Shelf' },
    inventory: seedContainer(entities, [{ id: 'loot_lib_man_1', blueprintId: 'book_pneumatic_schematic', quantity: 1 }]),
  };

  // 5. Pneumatic Monorail Depot (Top-Center)
  const depotDoor = { x: 23, y: 12 };
  doors.monorailDepot = depotDoor;
  grid = carveMultiRoomBuilding(grid, {
    x1: 17, y1: 3, x2: 29, y2: 12, mainDoor: depotDoor,
    rooms: [
      { zone: 'RECEPTION', x1: 18, y1: 8, x2: 28, y2: 11, label: 'Ticket Concourse' },
      { zone: 'WORKSHOP', x1: 18, y1: 4, x2: 22, y2: 7, label: 'Actuator Service Bay' },
      { zone: 'STORAGE', x1: 24, y1: 4, x2: 28, y2: 7, label: 'Pneumatic Parts Depot' },
    ],
    interiorDoors: [{ x: 20, y: 7 }, { x: 26, y: 7 }],
    windows: [{ x: 19, y: 3 }, { x: 27, y: 3 }],
  });
  grid = carveCorridor(grid, { x: depotDoor.x, y: depotDoor.y + 1 }, { x: depotDoor.x, y: centerY }, 'COBBLESTONE_FLOOR');
  for (let tx = 18; tx <= 22; tx++) {
    grid = setTileCell(grid, tx, 5, (c) => ({ ...c, terrainType: 'IRON_GRATE', blocksMovement: false, blocksSight: false }));
  }

  const consoleId = EntityIdSchema.parse('furniture_monorail_console');
  entities[consoleId] = {
    id: consoleId, name: 'Pneumatic Monorail Dispatch Console',
    visual: { glyph: '≡', fgPrimary: '#2ECC71', fgSecondary: '#27AE60', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
    position: { x: 23, y: 9, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    furniture: { kind: 'MONORAIL_DEPOT_CONSOLE', label: 'Pneumatic Dispatch Console' },
  };

  // 6. Guild Artisan Workshop (Bottom-Center)
  const artisanDoor = { x: 23, y: 24 };
  doors.artisanWorkshop = artisanDoor;
  grid = carveMultiRoomBuilding(grid, {
    x1: 17, y1: 24, x2: 29, y2: 33, mainDoor: artisanDoor,
    rooms: [
      { zone: 'RECEPTION', x1: 18, y1: 25, x2: 28, y2: 28, label: 'Artisan Showroom' },
      { zone: 'WORKSHOP', x1: 18, y1: 30, x2: 23, y2: 32, label: 'Master Bench' },
      { zone: 'VAULT', x1: 25, y1: 30, x2: 28, y2: 32, label: 'Ingot Strongbox' },
    ],
    interiorDoors: [{ x: 21, y: 29 }, { x: 26, y: 29 }],
    windows: [{ x: 19, y: 33 }, { x: 27, y: 33 }],
  });
  grid = carveCorridor(grid, { x: artisanDoor.x, y: artisanDoor.y - 1 }, { x: artisanDoor.x, y: centerY }, 'COBBLESTONE_FLOOR');

  const benchPos = { x: 20, y: 31 };
  keyPositions.artisanBench = benchPos;
  const artisanVaultId = EntityIdSchema.parse('furniture_artisan_vault');
  entities[artisanVaultId] = {
    id: artisanVaultId, name: 'Guild Ingot Strongbox',
    visual: { glyph: '⌸', fgPrimary: '#CD7F32', fgSecondary: '#935116', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: 26, y: 31, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    furniture: { kind: 'SAFE_VAULT', label: 'Guild Ingot Strongbox' },
    inventory: seedContainer(entities, [
      { id: 'loot_artisan_salt_1', blueprintId: 'mat_aether_salt', quantity: 2 },
      { id: 'loot_artisan_plate_1', blueprintId: 'mat_cast_iron_plate', quantity: 2 },
    ]),
  };

  return { grid, entities, doors, keyPositions };
}
