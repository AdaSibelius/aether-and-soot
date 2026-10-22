import { InteriorZoneType, Point2D, TerrainType } from '../../schemas/primitives.schema.js';
import { getTileCell, setTileCell, StratumGrid } from './grid.js';

export interface RoomZoneDefinition {
  readonly zone: InteriorZoneType;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly label?: string;
}

export interface MultiRoomBuildingSpec {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly mainDoor: Point2D;
  readonly rooms: readonly RoomZoneDefinition[];
  readonly interiorDoors: readonly Point2D[];
  readonly windows?: readonly Point2D[];
  readonly floorTerrain?: TerrainType;
  readonly wallTerrain?: TerrainType;
}

/** Sets a single cell as an exterior or interior glass pane aperture overlooking the street. */
export function setWindowCell(grid: StratumGrid, x: number, y: number): StratumGrid {
  return setTileCell(grid, x, y, (c) => ({
    ...c,
    terrainType: 'GLASS_WINDOW',
    blocksMovement: true,
    blocksSight: false,
  }));
}

/** Carves a procedural multi-room floorplan with structural interior zoning and doors. */
export function carveMultiRoomBuilding(
  initialGrid: StratumGrid,
  spec: MultiRoomBuildingSpec,
): StratumGrid {
  let grid = initialGrid;
  const wallTerrain: TerrainType = spec.wallTerrain ?? 'SOOT_BRICK_WALL';
  const floorTerrain: TerrainType = spec.floorTerrain ?? 'COBBLESTONE_FLOOR';

  // 1. Fill outer perimeter bounding box with solid wall
  for (let y = spec.y1; y <= spec.y2; y++) {
    for (let x = spec.x1; x <= spec.x2; x++) {
      grid = setTileCell(grid, x, y, (c) => ({
        ...c,
        terrainType: wallTerrain,
        blocksMovement: true,
        blocksSight: true,
        interiorZone: 'NONE',
      }));
    }
  }

  // 2. Carve each individual zoned room and stamp its structural zone type
  for (const room of spec.rooms) {
    for (let y = room.y1; y <= room.y2; y++) {
      for (let x = room.x1; x <= room.x2; x++) {
        grid = setTileCell(grid, x, y, (c) => ({
          ...c,
          terrainType: floorTerrain,
          blocksMovement: false,
          blocksSight: false,
          interiorZone: room.zone,
        }));
      }
    }
  }

  // 3. Place main exterior entrance door
  grid = setTileCell(grid, spec.mainDoor.x, spec.mainDoor.y, (c) => ({
    ...c,
    terrainType: 'WOODEN_DOOR_CLOSED',
    blocksMovement: true,
    blocksSight: true,
    interiorZone: 'RECEPTION',
  }));

  // 4. Place internal partition doors connecting rooms
  for (const door of spec.interiorDoors) {
    grid = setTileCell(grid, door.x, door.y, (c) => ({
      ...c,
      terrainType: 'WOODEN_DOOR_CLOSED',
      blocksMovement: true,
      blocksSight: true,
    }));
  }

  // 5. Place transparent glass windows along exterior facade
  if (spec.windows) {
    for (const win of spec.windows) {
      grid = setWindowCell(grid, win.x, win.y);
    }
  }

  return grid;
}

/** Look up the structural interior zone at any grid coordinate. */
export function getInteriorZoneAtPoint(
  grid: StratumGrid,
  x: number,
  y: number,
): InteriorZoneType {
  const cell = getTileCell(grid, x, y);
  return cell?.interiorZone ?? 'NONE';
}

/** Collect all coordinates tagged with a specific interior zone within a stratum grid. */
export function findCellsInZone(
  grid: StratumGrid,
  targetZone: InteriorZoneType,
): readonly Point2D[] {
  const points: Point2D[] = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const cell = getTileCell(grid, x, y);
      if (cell && cell.interiorZone === targetZone) {
        points.push({ x, y });
      }
    }
  }
  return points;
}
