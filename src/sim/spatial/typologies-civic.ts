import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityIdSchema, Point2D } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import {
  applyBuildingAttachments,
  createVariedBuildingPlan,
  seedContainer,
} from './building-variation.js';
import { carveCorridor } from './district-layout.js';
import { setTileCell, StratumGrid } from './grid.js';
import { carveMultiRoomBuilding } from './interior-zoning.js';

export interface CivicTypologyResult {
  readonly grid: StratumGrid;
  readonly entities: Record<string, EntityRecord>;
  readonly doors: Record<string, Point2D>;
  readonly keyPositions: Record<string, Point2D>;
}

/**
 * Generates the 3 civic/mercantile/residential Victorian typologies:
 * 1. Victorian Apothecary & Chirurgeon Clinic
 * 2. Clockwork Pawnshop & Cartel Bank
 * 3. Tenement Rookeries
 */
export function generateCivicTypologies(
  initialGrid: StratumGrid,
  initialEntities: Record<string, EntityRecord>,
  centerY: number,
  rng?: SeededRNG,
): CivicTypologyResult {
  let grid = initialGrid;
  const entities = { ...initialEntities };
  const doors: Record<string, Point2D> = {};
  const keyPositions: Record<string, Point2D> = {};

  // 1. Victorian Apothecary & Chirurgeon Clinic (Top-Right)
  const apothDoor = { x: 38, y: 12 };
  doors.apothecary = apothDoor;
  const apothPlan = createVariedBuildingPlan({
    x1: 33, y1: 3, x2: 43, y2: 12, mainDoor: apothDoor,
    rooms: [
      { zone: 'RECEPTION', x1: 34, y1: 8, x2: 42, y2: 11, label: 'Waiting Lounge' },
      { zone: 'SURGICAL_BAY', x1: 34, y1: 4, x2: 37, y2: 7, label: 'Operating Theatre' },
      { zone: 'STORAGE', x1: 38, y1: 4, x2: 42, y2: 7, label: 'Chemical Dispensary' },
    ],
    interiorDoors: [{ x: 36, y: 7 }, { x: 40, y: 7 }],
    windows: [{ x: 35, y: 3 }, { x: 41, y: 3 }],
  }, rng, { zone: 'STORAGE', x1: 34, y1: 3, x2: 37, y2: 3, label: 'Dispensary Alcove' });
  grid = carveMultiRoomBuilding(grid, apothPlan.spec);
  grid = applyBuildingAttachments(grid, apothPlan);
  grid = carveCorridor(grid, { x: apothDoor.x, y: apothDoor.y + 1 }, { x: apothDoor.x, y: centerY }, 'COBBLESTONE_FLOOR');

  // Solid COUNTER_BARRIER separating RECEPTION from BACKROOM with side-door trespass gating
  for (let cx = 34; cx <= 40; cx++) {
    grid = setTileCell(grid, cx, 8, (c) => ({ ...c, terrainType: 'COUNTER_BARRIER', blocksMovement: true, blocksSight: false, interiorZone: 'RECEPTION' }));
  }
  grid = setTileCell(grid, 41, 8, (c) => ({ ...c, terrainType: 'WOODEN_DOOR_CLOSED', blocksMovement: true, blocksSight: true, interiorZone: 'STORAGE' }));

  keyPositions.chirurgeon = { x: 36, y: 5 };

  const apothPedestalId = EntityIdSchema.parse('furniture_apoth_pedestal');
  entities[apothPedestalId] = {
    id: apothPedestalId, name: 'Sanitary Tincture Display Pedestal',
    visual: { glyph: 'π', fgPrimary: '#2ECC71', fgSecondary: '#27AE60', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
    position: { x: 39, y: 10, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    furniture: { kind: 'PEDESTAL', label: 'Tincture Display Pedestal' },
    tradePedestal: { commodityId: 'AETHER_VIAL', pricePence: 25 },
  };

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
  const pawnPlan = createVariedBuildingPlan({
    x1: 8, y1: 3, x2: 15, y2: 12, mainDoor: pawnDoor,
    rooms: [
      { zone: 'RECEPTION', x1: 9, y1: 8, x2: 14, y2: 11, label: 'Appraisal Concourse' },
      { zone: 'BACKROOM', x1: 9, y1: 4, x2: 11, y2: 7, label: 'Pawn Stash' },
      { zone: 'VAULT', x1: 12, y1: 4, x2: 14, y2: 7, label: 'Cartel Strongroom' },
    ],
    interiorDoors: [{ x: 10, y: 7 }, { x: 13, y: 7 }],
    windows: [{ x: 10, y: 3 }, { x: 14, y: 3 }],
  }, rng);
  grid = carveMultiRoomBuilding(grid, pawnPlan.spec);
  grid = applyBuildingAttachments(grid, pawnPlan);
  grid = carveCorridor(grid, { x: pawnDoor.x, y: pawnDoor.y + 1 }, { x: pawnDoor.x, y: centerY }, 'COBBLESTONE_FLOOR');

  // Solid COUNTER_BARRIER separating RECEPTION from BACKROOM/VAULT with side-door trespass gating
  for (let cx = 9; cx <= 13; cx++) {
    grid = setTileCell(grid, cx, 8, (c) => ({ ...c, terrainType: 'COUNTER_BARRIER', blocksMovement: true, blocksSight: false, interiorZone: 'RECEPTION' }));
  }
  grid = setTileCell(grid, 14, 8, (c) => ({ ...c, terrainType: 'WOODEN_DOOR_CLOSED', blocksMovement: true, blocksSight: true, interiorZone: 'BACKROOM' }));

  keyPositions.merchant = { x: 11, y: 9 };

  const pawnPedestalId = EntityIdSchema.parse('furniture_pawn_pedestal');
  entities[pawnPedestalId] = {
    id: pawnPedestalId, name: 'Reinforced Clockwork Display Pedestal',
    visual: { glyph: 'π', fgPrimary: '#F4D03F', fgSecondary: '#D4AF37', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
    position: { x: 10, y: 10, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    furniture: { kind: 'PEDESTAL', label: 'Clockwork Display Pedestal' },
    tradePedestal: { commodityId: 'CLOCKWORK_MAINSPRING', pricePence: 35 },
  };

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

  // 3. Tenement Rookeries & Docks (Bottom-Right)
  const rookDoor = { x: 38, y: 24 };
  doors.rookeries = rookDoor;
  const rookPlan = createVariedBuildingPlan({
    x1: 33, y1: 24, x2: 43, y2: 33, mainDoor: rookDoor,
    rooms: [
      { zone: 'RECEPTION', x1: 34, y1: 25, x2: 37, y2: 27, label: 'Tenement Flat 1' },
      { zone: 'RECEPTION', x1: 39, y1: 25, x2: 42, y2: 27, label: 'Tenement Flat 2' },
      { zone: 'STORAGE', x1: 34, y1: 29, x2: 37, y2: 31, label: 'Tenement Flat 3' },
      { zone: 'STORAGE', x1: 39, y1: 29, x2: 42, y2: 31, label: 'Tenement Flat 4' },
    ],
    interiorDoors: [
      { x: 37, y: 26 },
      { x: 39, y: 26 },
      { x: 37, y: 30 },
      { x: 39, y: 30 },
    ],
    windows: [{ x: 35, y: 33 }, { x: 41, y: 33 }],
  }, rng, { zone: 'RECEPTION', x1: 34, y1: 29, x2: 36, y2: 31, label: 'Pauper Alcove' });
  grid = carveMultiRoomBuilding(grid, rookPlan.spec);
  grid = applyBuildingAttachments(grid, rookPlan);
  grid = carveCorridor(grid, { x: rookDoor.x, y: rookDoor.y - 1 }, { x: rookDoor.x, y: centerY }, 'COBBLESTONE_FLOOR');

  // Sub-divided 4-room cluster bisected by 1-tile rubble alleyways (RUBBLE_PILE)
  for (let ay = 25; ay <= 31; ay++) {
    grid = setTileCell(grid, 38, ay, (c) => ({ ...c, terrainType: 'RUBBLE_PILE', blocksMovement: false, blocksSight: false, interiorZone: 'NONE' }));
  }
  for (let ax = 34; ax <= 42; ax++) {
    grid = setTileCell(grid, ax, 28, (c) => ({ ...c, terrainType: 'RUBBLE_PILE', blocksMovement: false, blocksSight: false, interiorZone: 'NONE' }));
  }

  // Southern water-adjacent TIMBER_PIER loading dock
  for (let px = 35; px <= 41; px++) {
    grid = setTileCell(grid, px, 32, (c) => ({ ...c, terrainType: 'TIMBER_PIER', blocksMovement: false, blocksSight: false, interiorZone: 'LOADING_DOCK' }));
  }
  grid = setTileCell(grid, 38, 33, (c) => ({ ...c, terrainType: 'TIMBER_PIER', blocksMovement: false, blocksSight: false, interiorZone: 'LOADING_DOCK' }));

  keyPositions.fixer = { x: 35, y: 26 };

  const cotId = EntityIdSchema.parse('furniture_cot_a');
  entities[cotId] = {
    id: cotId, name: 'Sackcloth Sleeping Cot',
    visual: { glyph: 'π', fgPrimary: '#F39C12', fgSecondary: '#D68910', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: 36, y: 30, stratum: 'STREET', blocksMovement: true, blocksSight: false },
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

  return { grid, entities, doors, keyPositions };
}
