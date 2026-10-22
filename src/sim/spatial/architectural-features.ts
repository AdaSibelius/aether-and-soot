import { Point2D, TerrainType } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { hasWalkablePath } from './district-layout.js';
import { getTileCell, isWithinBounds, setTileCell, StratumGrid } from './grid.js';

export interface ArchitecturalFeaturePlacement {
  readonly x: number;
  readonly y: number;
  readonly terrainType: TerrainType;
  readonly blocksMovement: boolean;
  readonly blocksSight: boolean;
}

/**
 * Returns physical collision and visibility parameters for architectural terrain types.
 */
export function getArchitecturalTerrainProperties(terrainType: TerrainType): {
  blocksMovement: boolean;
  blocksSight: boolean;
} {
  switch (terrainType) {
    case 'GASLAMP_POST':
    case 'WROUGHT_IRON_FENCE':
    case 'BRASS_STEAM_PIPE':
    case 'CANAL_SLUICE':
      return { blocksMovement: true, blocksSight: false };
    case 'SLAG_MOUND':
    case 'GOTHIC_COLONNADE':
    case 'SOOT_BRICK_WALL':
    case 'WALL_CROSS':
    case 'WALL_VERTICAL':
    case 'WALL_HORIZONTAL':
    case 'WALL_CORNER_NW':
    case 'WALL_CORNER_NE':
    case 'WALL_CORNER_SW':
    case 'WALL_CORNER_SE':
    case 'WALL_TEE_NORTH':
    case 'WALL_TEE_SOUTH':
    case 'WALL_TEE_EAST':
    case 'WALL_TEE_WEST':
      return { blocksMovement: true, blocksSight: true };
    case 'TIMBER_PIER':
    case 'COBBLESTONE_FLOOR':
    case 'BRASS_CATWALK':
    case 'RUBBLE_PILE':
    case 'DISTRICT_GATE':
    case 'WOODEN_DOOR_OPEN':
      return { blocksMovement: false, blocksSight: false };
    case 'GLASS_WINDOW':
      return { blocksMovement: true, blocksSight: false };
    case 'WOODEN_DOOR_CLOSED':
      return { blocksMovement: true, blocksSight: true };
    case 'ABYSS_DROP':
      return { blocksMovement: true, blocksSight: false };
    default:
      return { blocksMovement: false, blocksSight: false };
  }
}

/**
 * Plants an architectural terrain feature at (x, y) if within bounds.
 */
export function placeArchitecturalFeature(
  grid: StratumGrid,
  x: number,
  y: number,
  terrainType: TerrainType,
): StratumGrid {
  if (!isWithinBounds(grid, x, y)) return grid;
  const props = getArchitecturalTerrainProperties(terrainType);
  return setTileCell(grid, x, y, (c) => ({
    ...c,
    terrainType,
    blocksMovement: props.blocksMovement,
    blocksSight: props.blocksSight,
  }));
}

export function canPlaceWithoutSevering(
  grid: StratumGrid,
  x: number,
  y: number,
  terrainType: TerrainType,
  criticalLandmarks?: readonly Point2D[],
): boolean {
  if (!criticalLandmarks || criticalLandmarks.length < 2) return true;
  const candidate = placeArchitecturalFeature(grid, x, y, terrainType);
  const start = criticalLandmarks[0]!;
  for (let i = 1; i < criticalLandmarks.length; i++) {
    const target = criticalLandmarks[i]!;
    if (!hasWalkablePath(candidate, start, target)) {
      return false;
    }
  }
  return true;
}

/**
 * Seeds procedural Victorian Steampunk architectural elements across the district
 * without obstructing vital thoroughfares or critical doorways.
 */
export function seedDistrictArchitecture(
  grid: StratumGrid,
  districtId: string,
  _rng: SeededRNG,
  criticalLandmarks?: readonly Point2D[],
): StratumGrid {
  let updated = grid;
  const centerY = Math.floor(grid.height / 2);
  const centerX = Math.floor(grid.width / 2);

  // 1. Gaslamps framing the central street plaza
  const lampPositions = [
    { x: centerX - 2, y: centerY - 1 },
    { x: centerX + 2, y: centerY - 1 },
    { x: centerX - 2, y: centerY + 1 },
    { x: centerX + 2, y: centerY + 1 },
  ];
  for (const lp of lampPositions) {
    const existing = getTileCell(updated, lp.x, lp.y);
    if (existing && existing.terrainType === 'COBBLESTONE_FLOOR') {
      if (canPlaceWithoutSevering(updated, lp.x, lp.y, 'GASLAMP_POST', criticalLandmarks)) {
        updated = placeArchitecturalFeature(updated, lp.x, lp.y, 'GASLAMP_POST');
      }
    }
  }

  // 2. Biome-specific architectural embellishments
  const dLower = districtId.toLowerCase();
  if (dLower.includes('limehouse') || dLower.includes('dock')) {
    // Timber piers (walkable) and canal sluices
    for (let x = centerX - 2; x <= centerX + 2; x++) {
      if (getTileCell(updated, x, centerY + 2)?.terrainType === 'COBBLESTONE_FLOOR') {
        updated = placeArchitecturalFeature(updated, x, centerY + 2, 'TIMBER_PIER');
      }
    }
    const sluiceX = Math.min(grid.width - 4, centerX + 6);
    if (getTileCell(updated, sluiceX, centerY + 1)?.terrainType === 'COBBLESTONE_FLOOR') {
      if (canPlaceWithoutSevering(updated, sluiceX, centerY + 1, 'CANAL_SLUICE', criticalLandmarks)) {
        updated = placeArchitecturalFeature(updated, sluiceX, centerY + 1, 'CANAL_SLUICE');
      }
    }
  } else if (dLower.includes('belgravia') || dLower.includes('spire')) {
    // Gothic colonnades
    const colX1 = Math.max(3, centerX - 4);
    const colX2 = Math.min(grid.width - 4, centerX + 4);
    if (getTileCell(updated, colX1, centerY - 2)?.terrainType === 'COBBLESTONE_FLOOR') {
      if (canPlaceWithoutSevering(updated, colX1, centerY - 2, 'GOTHIC_COLONNADE', criticalLandmarks)) {
        updated = placeArchitecturalFeature(updated, colX1, centerY - 2, 'GOTHIC_COLONNADE');
      }
    }
    if (getTileCell(updated, colX2, centerY - 2)?.terrainType === 'COBBLESTONE_FLOOR') {
      if (canPlaceWithoutSevering(updated, colX2, centerY - 2, 'GOTHIC_COLONNADE', criticalLandmarks)) {
        updated = placeArchitecturalFeature(updated, colX2, centerY - 2, 'GOTHIC_COLONNADE');
      }
    }
  } else if (dLower.includes('spitalfields') || dLower.includes('soot')) {
    // Slag mounds and brass steam pipes
    const pipeY = centerY + 2;
    if (getTileCell(updated, centerX - 3, pipeY)?.terrainType === 'COBBLESTONE_FLOOR') {
      if (canPlaceWithoutSevering(updated, centerX - 3, pipeY, 'BRASS_STEAM_PIPE', criticalLandmarks)) {
        updated = placeArchitecturalFeature(updated, centerX - 3, pipeY, 'BRASS_STEAM_PIPE');
      }
    }
    if (getTileCell(updated, centerX + 3, pipeY)?.terrainType === 'COBBLESTONE_FLOOR') {
      if (canPlaceWithoutSevering(updated, centerX + 3, pipeY, 'SLAG_MOUND', criticalLandmarks)) {
        updated = placeArchitecturalFeature(updated, centerX + 3, pipeY, 'SLAG_MOUND');
      }
    }
  } else {
    // Rookeries: Wrought iron fence
    const fenceX = centerX - 2;
    if (getTileCell(updated, fenceX, centerY - 2)?.terrainType === 'COBBLESTONE_FLOOR') {
      if (canPlaceWithoutSevering(updated, fenceX, centerY - 2, 'WROUGHT_IRON_FENCE', criticalLandmarks)) {
        updated = placeArchitecturalFeature(updated, fenceX, centerY - 2, 'WROUGHT_IRON_FENCE');
      }
    }
  }

  return updated;
}
