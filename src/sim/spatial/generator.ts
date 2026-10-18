import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityIdSchema, Point2D, StratumId } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { WorldState } from '../core/world.js';
import { createStratumGrid, getTileCell, isWithinBounds, setTileCell, StratumGrid, TileCell } from './grid.js';

export interface GeneratedDistrictResult {
  readonly state: WorldState;
  readonly landmarks: {
    readonly undercroftLadder: Point2D;
    readonly streetManhole: Point2D;
    readonly streetLift: Point2D;
    readonly spireLift: Point2D;
    readonly foundryBoiler: Point2D;
  };
}

function carveRoom(
  grid: StratumGrid,
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  terrainType: TileCell['terrainType'],
  coalDustDensity = 0,
): StratumGrid {
  let next = grid;
  for (let y = cy - halfH; y <= cy + halfH; y++) {
    for (let x = cx - halfW; x <= cx + halfW; x++) {
      if (x <= 0 || y <= 0 || x >= grid.width - 1 || y >= grid.height - 1) continue;
      next = setTileCell(next, x, y, () => ({
        terrainType,
        blocksMovement: false,
        blocksSight: false,
        steamPressureKpa: 0,
        coalDustDensity,
      }));
    }
  }
  return next;
}

function carveCorridor(
  grid: StratumGrid,
  from: Point2D,
  to: Point2D,
  terrainType: TileCell['terrainType'],
): StratumGrid {
  let next = grid;
  let currX = from.x;
  let currY = from.y;

  while (currX !== to.x) {
    next = setTileCell(next, currX, currY, () => ({
      terrainType,
      blocksMovement: false,
      blocksSight: false,
      steamPressureKpa: 0,
      coalDustDensity: 0,
    }));
    currX += currX < to.x ? 1 : -1;
  }

  while (currY !== to.y) {
    next = setTileCell(next, currX, currY, () => ({
      terrainType,
      blocksMovement: false,
      blocksSight: false,
      steamPressureKpa: 0,
      coalDustDensity: 0,
    }));
    currY += currY < to.y ? 1 : -1;
  }

  next = setTileCell(next, to.x, to.y, () => ({
    terrainType,
    blocksMovement: false,
    blocksSight: false,
    steamPressureKpa: 0,
    coalDustDensity: 0,
  }));

  return next;
}

function buildSolidStratumGrid(stratum: StratumId, width: number, height: number): StratumGrid {
  const base = createStratumGrid(stratum, width, height);
  const solidCells: TileCell[] = base.cells.map(() => ({
    terrainType: 'SOOT_BRICK_WALL',
    blocksMovement: true,
    blocksSight: true,
    steamPressureKpa: 0,
    coalDustDensity: 0,
  }));
  return { ...base, cells: solidCells };
}

/**
 * Generates a deterministic 3-strata Victorian district (Undercroft, Street, Spire)
 * with guaranteed corridor connectivity between all vertical portals and landmarks.
 */
export function generateVictorianDistrict(state: WorldState): GeneratedDistrictResult {
  const rng = new SeededRNG(state.rngState);
  const width = state.strata.STREET?.width ?? 24;
  const height = state.strata.STREET?.height ?? 24;

  const center: Point2D = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  const liftPos: Point2D = {
    x: rng.nextInt(Math.max(3, center.x + 2), Math.min(width - 4, width - 3)),
    y: rng.nextInt(3, Math.max(4, center.y - 2)),
  };
  const boilerPos: Point2D = {
    x: rng.nextInt(3, Math.max(4, center.x - 2)),
    y: rng.nextInt(Math.max(3, center.y + 2), Math.min(height - 4, height - 3)),
  };

  // 1. UNDERCROFT: Brick sewer chambers connected by iron grates
  let undercroft = buildSolidStratumGrid('UNDERCROFT', width, height);
  const sewerChamberB: Point2D = {
    x: rng.nextInt(3, Math.max(4, width - 4)),
    y: rng.nextInt(3, Math.max(4, height - 4)),
  };
  undercroft = carveRoom(undercroft, center.x, center.y, 2, 2, 'IRON_GRATE', 0.1);
  undercroft = carveRoom(undercroft, sewerChamberB.x, sewerChamberB.y, 2, 2, 'IRON_GRATE', 0.2);
  undercroft = carveCorridor(undercroft, center, sewerChamberB, 'IRON_GRATE');

  // 2. STREET: Foundry courtyard, soot-works boiler room, and freight lift plaza
  let street = buildSolidStratumGrid('STREET', width, height);
  street = carveRoom(street, center.x, center.y, 3, 3, 'COBBLESTONE_FLOOR', 0.15);
  street = carveRoom(street, liftPos.x, liftPos.y, 2, 2, 'COBBLESTONE_FLOOR', 0.05);
  street = carveRoom(street, boilerPos.x, boilerPos.y, 2, 2, 'COBBLESTONE_FLOOR', 0.45);
  street = carveCorridor(street, center, liftPos, 'COBBLESTONE_FLOOR');
  street = carveCorridor(street, center, boilerPos, 'COBBLESTONE_FLOOR');

  // 3. SPIRE: Elevated brass catwalks and clockwork observatory
  let spire = buildSolidStratumGrid('SPIRE', width, height);
  spire = carveRoom(spire, liftPos.x, liftPos.y, 2, 2, 'BRASS_CATWALK', 0);
  spire = carveRoom(spire, center.x, center.y, 2, 2, 'BRASS_CATWALK', 0);
  spire = carveCorridor(spire, liftPos, center, 'BRASS_CATWALK');

  const liftDownId = EntityIdSchema.parse('portal_spire_lift_down');
  const liftUpId = EntityIdSchema.parse('portal_street_lift_up');
  const boilerId = EntityIdSchema.parse('vessel_district_boiler');

  const streetLiftEntity: EntityRecord = {
    id: liftUpId,
    name: 'Pneumatic Freight Elevator (To Spire)',
    visual: {
      glyph: '^',
      fgPrimary: '#F4D03F',
      fgSecondary: '#D4AF37',
      bgColor: '#0A0D0E',
      shaderFlags: ['SPARK_GLINT'],
    },
    position: {
      x: liftPos.x,
      y: liftPos.y,
      stratum: 'STREET',
      blocksMovement: false,
      blocksSight: false,
    },
    portal: {
      target: { x: liftPos.x, y: liftPos.y, stratum: 'SPIRE' },
      bidirectional: true,
      conductsGas: true,
      apCost: 100,
      portalLabel: 'Ascend Pneumatic Lift to Brass Spire',
    },
  };

  const spireLiftEntity: EntityRecord = {
    id: liftDownId,
    name: 'Pneumatic Freight Elevator (To Street)',
    visual: {
      glyph: 'v',
      fgPrimary: '#F4D03F',
      fgSecondary: '#D4AF37',
      bgColor: '#0A0D0E',
      shaderFlags: [],
    },
    position: {
      x: liftPos.x,
      y: liftPos.y,
      stratum: 'SPIRE',
      blocksMovement: false,
      blocksSight: false,
    },
    portal: {
      target: { x: liftPos.x, y: liftPos.y, stratum: 'STREET' },
      bidirectional: true,
      conductsGas: true,
      apCost: 100,
      portalLabel: 'Descend Pneumatic Lift to Foundry Street',
    },
  };

  const boilerEntity: EntityRecord = {
    id: boilerId,
    name: 'Spitalfields High-Pressure Foundry Boiler',
    visual: {
      glyph: '0',
      fgPrimary: '#CD7F32',
      fgSecondary: '#E67E22',
      bgColor: '#0A0D0E',
      shaderFlags: ['PULSE_STEAM'],
    },
    position: {
      x: boilerPos.x,
      y: boilerPos.y,
      stratum: 'STREET',
      blocksMovement: false,
      blocksSight: false,
    },
    pressureVessel: {
      currentPressureKpa: 180,
      maxPressureKpa: 300,
      ruptured: false,
    },
  };

  return {
    state: {
      ...state,
      rngState: rng.getState(),
      strata: {
        UNDERCROFT: undercroft,
        STREET: street,
        SPIRE: spire,
      },
      entities: {
        ...state.entities,
        [liftUpId]: streetLiftEntity,
        [liftDownId]: spireLiftEntity,
        [boilerId]: boilerEntity,
      },
    },
    landmarks: {
      undercroftLadder: center,
      streetManhole: center,
      streetLift: liftPos,
      spireLift: liftPos,
      foundryBoiler: boilerPos,
    },
  };
}

/**
 * Breadth-First Search (BFS) walkability check between two points on a single StratumGrid.
 */
export function hasWalkablePath(grid: StratumGrid, start: Point2D, goal: Point2D): boolean {
  if (!isWithinBounds(grid, start.x, start.y) || !isWithinBounds(grid, goal.x, goal.y)) {
    return false;
  }

  const visited = new Set<string>();
  const queue: Point2D[] = [start];
  const deltas = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr.x === goal.x && curr.y === goal.y) {
      return true;
    }
    const key = `${curr.x},${curr.y}`;
    if (visited.has(key)) continue;
    visited.add(key);

    for (const { dx, dy } of deltas) {
      const nx = curr.x + dx;
      const ny = curr.y + dy;
      if (!isWithinBounds(grid, nx, ny)) continue;
      const cell = getTileCell(grid, nx, ny);
      if (cell && !cell.blocksMovement) {
        queue.push({ x: nx, y: ny });
      }
    }
  }

  return false;
}
