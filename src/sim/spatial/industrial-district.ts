import { EntityRecord } from '../../schemas/components.schema.js';
import { BlueprintIdSchema, EntityIdSchema, Point2D } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { createEntityFromBlueprint } from '../data/item-catalog.js';
import { createMonorailCarEntity } from '../systems/monorail.system.js';
import { carveCorridor } from './district-layout.js';
import { setTileCell, StratumGrid } from './grid.js';

export interface IndustrialSectorBounds {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface IndustrialSectorResult {
  readonly grid: StratumGrid;
  readonly entities: Record<string, EntityRecord>;
  readonly furnacePos: Point2D;
  readonly boilerPos: Point2D;
  readonly monorailPos: Point2D;
  readonly mineHoistPos: Point2D;
  readonly conveyorStart: Point2D;
  readonly conveyorEnd: Point2D;
  readonly doors: Record<string, Point2D>;
}

export function generateHeavyIndustrialSector(
  initialGrid: StratumGrid,
  initialEntities: Record<string, EntityRecord>,
  bounds: IndustrialSectorBounds,
  _rng?: SeededRNG,
): IndustrialSectorResult {
  let grid = initialGrid;
  const entities = { ...initialEntities };
  const doors: Record<string, Point2D> = {};

  const ox = bounds.x1;
  const oy = bounds.y1;
  const railY = oy + 8;

  // Connecting avenue corridor along unobstructed column ox + 5 (carved before furnace/halo)
  grid = carveCorridor(grid, { x: ox + 5, y: railY + 1 }, { x: ox + 5, y: Math.max(1, oy - 2) }, 'COBBLESTONE_FLOOR');

  // 1. Smelting Hall & Reverberatory Hearth (top section of industrial bounds)
  const furnacePos: Point2D = { x: ox + 6, y: oy + 3 };
  const smeltingDoor: Point2D = { x: ox + 4, y: oy + 5 };
  doors.smeltingHall = smeltingDoor;

  for (let y = oy + 1; y <= oy + 5; y++) {
    for (let x = ox + 1; x <= ox + 11; x++) {
      grid = setTileCell(grid, x, y, (c) => ({
        ...c,
        terrainType: 'SCORCHED_STONE',
        blocksMovement: false,
        blocksSight: false,
        interiorZone: 'WORKSHOP',
      }));
    }
  }

  // Slag pit trench & steam pipes along flanks
  for (let px = ox + 2; px <= ox + 4; px++) {
    grid = setTileCell(grid, px, oy + 1, (c) => ({ ...c, terrainType: 'BRASS_STEAM_PIPE', blocksMovement: true, blocksSight: false }));
  }
  for (let sy = oy + 2; sy <= oy + 4; sy++) {
    grid = setTileCell(grid, ox + 2, sy, (c) => ({ ...c, terrainType: 'SLAG_PIT', blocksMovement: true, blocksSight: false }));
  }

  // Smelting furnace entity
  const furnaceId = EntityIdSchema.parse('furniture_smelting_furnace');
  entities[furnaceId] = {
    id: furnaceId,
    name: 'Heavy Reverberatory Smelting Furnace',
    visual: { glyph: 'Ω', fgPrimary: '#E67E22', fgSecondary: '#D35400', bgColor: '#0A0D0E', shaderFlags: ['PULSE_STEAM', 'VOLUMETRIC_PLUME'] },
    position: { x: furnacePos.x, y: furnacePos.y, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    furniture: { kind: 'SMELTING_FURNACE', label: 'Reverberatory Smelting Furnace' },
  };

  // 5x5 thermal halo around furnace
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const hx = furnacePos.x + dx;
      const hy = furnacePos.y + dy;
      if (hx >= 1 && hy >= 1 && hx < grid.width - 1 && hy < grid.height - 1) {
        grid = setTileCell(grid, hx, hy, (c) => ({
          ...c,
          steamPressureKpa: Math.max(c.steamPressureKpa, 45),
          smokePpm: Math.max(c.smokePpm ?? 0, 140),
          coalDustDensity: Math.max(c.coalDustDensity, 0.35),
        }));
      }
    }
  }

  // 2. Continuous Conveyor Run from Feedstock Hopper to Ingot Vault
  const conveyorStart: Point2D = { x: ox + 8, y: oy + 2 };
  const conveyorEnd: Point2D = { x: ox + 8, y: oy + 7 };
  for (let cy = conveyorStart.y; cy <= conveyorEnd.y; cy++) {
    grid = setTileCell(grid, ox + 8, cy, (c) => ({
      ...c,
      terrainType: 'CONVEYOR_TRACK',
      blocksMovement: false,
      blocksSight: false,
      interiorZone: 'ASSEMBLY_LINE',
    }));
  }

  // Feedstock Hopper Container
  const hopperId = EntityIdSchema.parse('furniture_feedstock_hopper');
  const coalId = EntityIdSchema.parse('loot_hopper_coal');
  const coal = createEntityFromBlueprint(BlueprintIdSchema.parse('commodity_anthracite_briquette'), coalId, 5);
  if (coal) entities[coalId] = coal;
  entities[hopperId] = {
    id: hopperId,
    name: 'Anthracite Feedstock Hopper',
    visual: { glyph: '⌸', fgPrimary: '#7F8C8D', fgSecondary: '#34495E', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: conveyorStart.x + 1, y: conveyorStart.y, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    furniture: { kind: 'CRATE', label: 'Anthracite Feedstock Hopper' },
    inventory: { containedEntityIds: coal ? [coalId] : [], currentMassGrams: 5000, maxMassGrams: 50000, maxVolumeMl: 50000 },
  };

  // Ingot Vault Strongroom
  const vaultId = EntityIdSchema.parse('furniture_ingot_vault');
  const plateId = EntityIdSchema.parse('loot_vault_plate');
  const gearId = EntityIdSchema.parse('loot_vault_gears');
  const plate = createEntityFromBlueprint(BlueprintIdSchema.parse('mat_cast_iron_plate'), plateId, 3);
  const gear = createEntityFromBlueprint(BlueprintIdSchema.parse('mat_brass_gears'), gearId, 2);
  if (plate) entities[plateId] = plate;
  if (gear) entities[gearId] = gear;
  entities[vaultId] = {
    id: vaultId,
    name: 'Cast Iron Ingot Strongbox',
    visual: { glyph: '⌸', fgPrimary: '#CD7F32', fgSecondary: '#935116', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: conveyorEnd.x + 1, y: conveyorEnd.y, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    furniture: { kind: 'SAFE_VAULT', label: 'Cast Iron Ingot Strongbox' },
    inventory: {
      containedEntityIds: [plateId, gearId].filter((id) => entities[id]),
      currentMassGrams: 8000,
      maxMassGrams: 50000,
      maxVolumeMl: 50000,
    },
  };

  // 3. Rail Spur, Monorail Depot Terminus & Freight Mine Hoist
  const xStart = ox + 1;
  const xEnd = Math.min(grid.width - 3, ox + 13);
  for (let rx = xStart; rx <= xEnd; rx++) {
    grid = setTileCell(grid, rx, railY, (c) => ({ ...c, terrainType: 'RAIL_TRACK', blocksMovement: false, blocksSight: false, interiorZone: 'PLATFORM' }));
    grid = setTileCell(grid, rx, railY + 1, (c) => ({ ...c, terrainType: 'BOARDING_PLATFORM', blocksMovement: false, blocksSight: false, interiorZone: 'PLATFORM' }));
  }

  const monorailPos: Point2D = { x: ox + 4, y: railY };
  const carId = EntityIdSchema.parse('monorail_car_street_depot');
  entities[carId] = createMonorailCarEntity(carId, { ...monorailPos, stratum: 'STREET' }, BlueprintIdSchema.parse('district_spitalfields_soot_works'), 75);

  const consoleId = EntityIdSchema.parse('furniture_monorail_console');
  entities[consoleId] = {
    id: consoleId,
    name: 'Pneumatic Monorail Dispatch Console',
    visual: { glyph: '≡', fgPrimary: '#2ECC71', fgSecondary: '#27AE60', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
    position: { x: ox + 2, y: railY + 1, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    furniture: { kind: 'MONORAIL_DEPOT_CONSOLE', label: 'Pneumatic Dispatch Console' },
  };

  const mineHoistPos: Point2D = { x: xEnd, y: railY };
  const hoistId = EntityIdSchema.parse('portal_street_mine_hoist');
  entities[hoistId] = {
    id: hoistId,
    name: 'Freight Mine Headframe Hoist',
    visual: { glyph: 'H', fgPrimary: '#E67E22', fgSecondary: '#A04000', bgColor: '#0A0D0E', shaderFlags: ['PULSE_STEAM'] },
    position: { x: mineHoistPos.x, y: mineHoistPos.y, stratum: 'STREET', blocksMovement: false, blocksSight: false },
    portal: { target: { x: mineHoistPos.x, y: mineHoistPos.y, stratum: 'CATACOMBS', depthLevel: 1 }, bidirectional: true, conductsGas: true, apCost: 100, portalLabel: 'Descend Steam Hoist to Subterranean Mine' },
  };

  // 4. Outdoor Boiler Yard with High-Pressure Accumulator Vessels
  const boilerPos: Point2D = { x: ox + 11, y: oy + 3 };
  for (let by = oy + 1; by <= oy + 5; by++) {
    for (let bx = ox + 10; bx <= ox + 13; bx++) {
      grid = setTileCell(grid, bx, by, (c) => ({ ...c, terrainType: 'IRON_GRATE', blocksMovement: false, blocksSight: false }));
    }
  }

  const boilerVessel1 = EntityIdSchema.parse('vessel_district_boiler');
  entities[boilerVessel1] = {
    id: boilerVessel1,
    name: 'Industrial High-Pressure Foundry Boiler',
    visual: { glyph: '0', fgPrimary: '#CD7F32', fgSecondary: '#E67E22', bgColor: '#0A0D0E', shaderFlags: ['PULSE_STEAM'] },
    position: { x: boilerPos.x, y: boilerPos.y, stratum: 'STREET', blocksMovement: false, blocksSight: false },
    pressureVessel: { currentPressureKpa: 220, maxPressureKpa: 350, ruptured: false },
  };

  const boilerVessel2 = EntityIdSchema.parse('vessel_boiler_accumulator_2');
  entities[boilerVessel2] = {
    id: boilerVessel2,
    name: 'Auxiliary Steam Accumulator Battery',
    visual: { glyph: '0', fgPrimary: '#CD7F32', fgSecondary: '#E67E22', bgColor: '#0A0D0E', shaderFlags: ['PULSE_STEAM'] },
    position: { x: boilerPos.x + 1, y: boilerPos.y, stratum: 'STREET', blocksMovement: false, blocksSight: false },
    pressureVessel: { currentPressureKpa: 210, maxPressureKpa: 350, ruptured: false },
  };

  return {
    grid,
    entities,
    furnacePos,
    boilerPos,
    monorailPos,
    mineHoistPos,
    conveyorStart,
    conveyorEnd,
    doors,
  };
}
