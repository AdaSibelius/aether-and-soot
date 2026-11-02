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
      { zone: 'ASSEMBLY_LINE', x1: 4, y1: 30, x2: 12, y2: 32, label: 'Fuel Stacks & Line' },
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

  // Kinetic plumbing pathways, slag pit trench, conveyor line, and 3x3 thermodynamic stress halo
  for (let px = 5; px <= 7; px++) {
    grid = setTileCell(grid, px, 25, (c) => ({ ...c, terrainType: 'BRASS_STEAM_PIPE', blocksMovement: true, blocksSight: false, interiorZone: 'WORKSHOP' }));
  }
  for (let sy = 27; sy <= 28; sy++) {
    grid = setTileCell(grid, 5, sy, (c) => ({ ...c, terrainType: 'SLAG_PIT', blocksMovement: true, blocksSight: false, interiorZone: 'WORKSHOP' }));
  }
  for (let cy = 26; cy <= 28; cy++) {
    grid = setTileCell(grid, 11, cy, (c) => ({ ...c, terrainType: 'CONVEYOR_TRACK', blocksMovement: false, blocksSight: false, interiorZone: 'ASSEMBLY_LINE' }));
  }

  const boilerPos = { x: 6, y: 26 };
  keyPositions.boiler = boilerPos;
  keyPositions.stoker = { x: 8, y: 26 };

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 5; dx++) {
      grid = setTileCell(grid, boilerPos.x + dx, boilerPos.y + dy, (c) => ({
        ...c,
        steamPressureKpa: Math.max(c.steamPressureKpa, 35),
        smokePpm: Math.max(c.smokePpm ?? 0, 120),
      }));
    }
  }

  const furnaceId = EntityIdSchema.parse('furniture_smelting_furnace');
  entities[furnaceId] = {
    id: furnaceId, name: 'Reverberatory Smelting Furnace',
    visual: { glyph: 'Ω', fgPrimary: '#E67E22', fgSecondary: '#D35400', bgColor: '#0A0D0E', shaderFlags: ['PULSE_STEAM', 'VOLUMETRIC_PLUME'] },
    position: { x: 10, y: 26, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    furniture: { kind: 'SMELTING_FURNACE', label: 'Reverberatory Smelting Furnace' },
  };

  // 2. Pneumatic Monorail Depot (Top-Center)
  const depotDoor = { x: 23, y: 12 };
  doors.monorailDepot = depotDoor;
  const depotPlan = createVariedBuildingPlan({
    x1: 17, y1: 3, x2: 29, y2: 12, mainDoor: depotDoor,
    rooms: [
      { zone: 'TICKET_BOOTH', x1: 18, y1: 8, x2: 21, y2: 11, label: 'Ticket Booth' },
      { zone: 'RECEPTION', x1: 22, y1: 8, x2: 28, y2: 11, label: 'Ticket Concourse' },
      { zone: 'PLATFORM', x1: 18, y1: 4, x2: 28, y2: 7, label: 'Boarding Platforms' },
    ],
    interiorDoors: [{ x: 23, y: 7 }, { x: 21, y: 11 }],
    windows: [{ x: 19, y: 3 }, { x: 27, y: 3 }],
  }, rng, { zone: 'STORAGE', x1: 27, y1: 4, x2: 28, y2: 6, label: 'Lockbox Storage' });
  grid = carveMultiRoomBuilding(grid, depotPlan.spec);
  grid = applyBuildingAttachments(grid, depotPlan);
  grid = carveCorridor(grid, { x: depotDoor.x, y: depotDoor.y + 1 }, { x: depotDoor.x, y: centerY }, 'COBBLESTONE_FLOOR');

  // Parallel rail track lines, boarding platform concourse, and ticket counter barrier
  for (let tx = 18; tx <= 28; tx++) {
    grid = setTileCell(grid, tx, 4, (c) => ({ ...c, terrainType: 'RAIL_TRACK', blocksMovement: false, blocksSight: false, interiorZone: 'PLATFORM' }));
    grid = setTileCell(grid, tx, 5, (c) => ({ ...c, terrainType: 'RAIL_TRACK', blocksMovement: false, blocksSight: false, interiorZone: 'PLATFORM' }));
    grid = setTileCell(grid, tx, 6, (c) => ({ ...c, terrainType: 'BOARDING_PLATFORM', blocksMovement: false, blocksSight: false, interiorZone: 'PLATFORM' }));
  }
  for (let ty = 8; ty <= 10; ty++) {
    grid = setTileCell(grid, 21, ty, (c) => ({ ...c, terrainType: 'COUNTER_BARRIER', blocksMovement: true, blocksSight: false, interiorZone: 'TICKET_BOOTH' }));
  }

  const consoleId = EntityIdSchema.parse('furniture_monorail_console');
  entities[consoleId] = {
    id: consoleId, name: 'Pneumatic Monorail Dispatch Console',
    visual: { glyph: '≡', fgPrimary: '#2ECC71', fgSecondary: '#27AE60', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
    position: { x: 23, y: 9, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    furniture: { kind: 'MONORAIL_DEPOT_CONSOLE', label: 'Pneumatic Dispatch Console' },
  };

  // Dual PressureVessel aether-fuel depot
  const fuelVessel1Id = EntityIdSchema.parse('vessel_depot_aether_fuel_1');
  entities[fuelVessel1Id] = {
    id: fuelVessel1Id, name: 'Pneumatic Aether-Fuel Reserve Alpha',
    visual: { glyph: 'B', fgPrimary: '#5DADE2', fgSecondary: '#2E86C1', bgColor: '#0A0D0E', shaderFlags: ['PULSE_STEAM', 'VOLUMETRIC_PLUME'] },
    position: { x: 27, y: 5, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    pressureVessel: { currentPressureKpa: 120, maxPressureKpa: 250, ruptured: false },
  };
  const fuelVessel2Id = EntityIdSchema.parse('vessel_depot_aether_fuel_2');
  entities[fuelVessel2Id] = {
    id: fuelVessel2Id, name: 'Pneumatic Aether-Fuel Reserve Beta',
    visual: { glyph: 'B', fgPrimary: '#5DADE2', fgSecondary: '#2E86C1', bgColor: '#0A0D0E', shaderFlags: ['PULSE_STEAM', 'VOLUMETRIC_PLUME'] },
    position: { x: 28, y: 5, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    pressureVessel: { currentPressureKpa: 120, maxPressureKpa: 250, ruptured: false },
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

  // Kinetic plumbing pathways, slag pit trench, conveyor line, and 3x3 thermodynamic stress halo
  for (let py = 26; py <= 27; py++) {
    grid = setTileCell(grid, 22, py, (c) => ({ ...c, terrainType: 'BRASS_STEAM_PIPE', blocksMovement: true, blocksSight: false, interiorZone: 'WORKSHOP' }));
  }
  for (let sy = 26; sy <= 27; sy++) {
    grid = setTileCell(grid, 24, sy, (c) => ({ ...c, terrainType: 'SLAG_PIT', blocksMovement: true, blocksSight: false, interiorZone: 'WORKSHOP' }));
  }
  for (let cx = 25; cx <= 28; cx++) {
    grid = setTileCell(grid, cx, 27, (c) => ({ ...c, terrainType: 'CONVEYOR_TRACK', blocksMovement: false, blocksSight: false, interiorZone: 'ASSEMBLY_LINE' }));
  }

  const benchPos = { x: 20, y: 31 };
  keyPositions.artisanBench = benchPos;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      grid = setTileCell(grid, benchPos.x + dx, benchPos.y + dy, (c) => ({
        ...c,
        steamPressureKpa: Math.max(c.steamPressureKpa, 35),
        smokePpm: Math.max(c.smokePpm ?? 0, 120),
      }));
    }
  }

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
