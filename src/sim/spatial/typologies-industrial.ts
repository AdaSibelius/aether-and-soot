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

export interface IndustrialTypologyResult {
  readonly grid: StratumGrid;
  readonly entities: Record<string, EntityRecord>;
  readonly doors: Record<string, Point2D>;
  readonly keyPositions: Record<string, Point2D>;
}

/**
 * Generates the 3 industrial/transit/artisan Victorian typologies:
 * 1. Steam Boilerhouse & Slag Furnace
 * 2. Pneumatic Monorail Depot
 * 3. Guild Artisan Workshop
 */
export function generateIndustrialTypologies(
  initialGrid: StratumGrid,
  initialEntities: Record<string, EntityRecord>,
  centerY: number,
  rng?: SeededRNG,
): IndustrialTypologyResult {
  let grid = initialGrid;
  const entities = { ...initialEntities };
  const doors: Record<string, Point2D> = {};
  const keyPositions: Record<string, Point2D> = {};

  // 1. Steam Boilerhouse & Slag Furnace (Bottom-Left)
  const boilerDoor = { x: 8, y: 24 };
  doors.boilerhouse = boilerDoor;
  const boilerPlan = createVariedBuildingPlan({
    x1: 3, y1: 24, x2: 13, y2: 33, mainDoor: boilerDoor,
    rooms: [
      { zone: 'WORKSHOP', x1: 4, y1: 25, x2: 12, y2: 28, label: 'Smelting Hearth' },
      { zone: 'STORAGE', x1: 4, y1: 30, x2: 12, y2: 32, label: 'Fuel Stacks' },
    ],
    interiorDoors: [{ x: 8, y: 29 }],
    windows: [{ x: 5, y: 33 }, { x: 11, y: 33 }],
  }, rng, { zone: 'WORKSHOP', x1: 3, y1: 26, x2: 4, y2: 28, label: 'Slag Trough' });
  grid = carveMultiRoomBuilding(grid, boilerPlan.spec);
  grid = applyBuildingAttachments(grid, boilerPlan);
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
  keyPositions.stoker = { x: 8, y: 26 };
  const furnaceId = EntityIdSchema.parse('furniture_smelting_furnace');
  entities[furnaceId] = {
    id: furnaceId, name: 'Reverberatory Smelting Furnace',
    visual: { glyph: 'Ω', fgPrimary: '#E67E22', fgSecondary: '#D35400', bgColor: '#0A0D0E', shaderFlags: ['PULSE_STEAM'] },
    position: { x: 10, y: 26, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    furniture: { kind: 'SMELTING_FURNACE', label: 'Reverberatory Smelting Furnace' },
  };

  // 2. Pneumatic Monorail Depot (Top-Center)
  const depotDoor = { x: 23, y: 12 };
  doors.monorailDepot = depotDoor;
  const depotPlan = createVariedBuildingPlan({
    x1: 17, y1: 3, x2: 29, y2: 12, mainDoor: depotDoor,
    rooms: [
      { zone: 'RECEPTION', x1: 18, y1: 8, x2: 28, y2: 11, label: 'Ticket Concourse' },
      { zone: 'WORKSHOP', x1: 18, y1: 4, x2: 22, y2: 7, label: 'Actuator Service Bay' },
      { zone: 'STORAGE', x1: 24, y1: 4, x2: 28, y2: 7, label: 'Pneumatic Parts Depot' },
    ],
    interiorDoors: [{ x: 20, y: 7 }, { x: 26, y: 7 }],
    windows: [{ x: 19, y: 3 }, { x: 27, y: 3 }],
  }, rng, { zone: 'STORAGE', x1: 27, y1: 4, x2: 28, y2: 6, label: 'Lockbox Storage' });
  grid = carveMultiRoomBuilding(grid, depotPlan.spec);
  grid = applyBuildingAttachments(grid, depotPlan);
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

  // 3. Guild Artisan Workshop (Bottom-Center)
  const artisanDoor = { x: 23, y: 24 };
  doors.artisanWorkshop = artisanDoor;
  const artisanPlan = createVariedBuildingPlan({
    x1: 17, y1: 24, x2: 29, y2: 33, mainDoor: artisanDoor,
    rooms: [
      { zone: 'RECEPTION', x1: 18, y1: 25, x2: 28, y2: 28, label: 'Artisan Showroom' },
      { zone: 'WORKSHOP', x1: 18, y1: 30, x2: 23, y2: 32, label: 'Master Bench' },
      { zone: 'VAULT', x1: 25, y1: 30, x2: 28, y2: 32, label: 'Ingot Strongbox' },
    ],
    interiorDoors: [{ x: 21, y: 29 }, { x: 26, y: 29 }],
    windows: [{ x: 19, y: 33 }, { x: 27, y: 33 }],
  }, rng, { zone: 'WORKSHOP', x1: 24, y1: 30, x2: 25, y2: 32, label: 'Lapidary Nook' });
  grid = carveMultiRoomBuilding(grid, artisanPlan.spec);
  grid = applyBuildingAttachments(grid, artisanPlan);
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
