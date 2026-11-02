import { Point2D } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { buildSolidStratumGrid } from './district-layout.js';
import { setTileCell, StratumGrid } from './grid.js';

export interface SewerJunctionChamber {
  readonly center: Point2D;
  readonly isCatchBasin: boolean;
  readonly hasSurfaceLadder: boolean;
}

export interface SewerTopologyResult {
  readonly grid: StratumGrid;
  readonly chambers: readonly Point2D[];
  readonly junctionChambers: readonly SewerJunctionChamber[];
  readonly catchBasinPos: Point2D;
}

function inBounds(grid: StratumGrid, x: number, y: number): boolean {
  return x >= 1 && y >= 1 && x <= grid.width - 2 && y <= grid.height - 2;
}

function carveOctagonalChamber(
  grid: StratumGrid,
  cx: number,
  cy: number,
  isEntry: boolean,
  rng: SeededRNG,
): StratumGrid {
  let g = grid;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) === 2 && Math.abs(dy) === 2) continue; // 21-tile octagon
      const x = cx + dx;
      const y = cy + dy;
      if (!inBounds(g, x, y)) continue;

      g = setTileCell(g, x, y, (cell) => ({
        ...cell,
        terrainType: 'IRON_GRATE',
        blocksMovement: false,
        blocksSight: false,
        coalDustDensity: 0.2,
        smokePpm: isEntry ? rng.nextInt(15, 30) : rng.nextInt(40, 80),
        steamPressureKpa: isEntry ? 0 : rng.nextInt(10, 25),
      }));
    }
  }

  // If not entry, carve a recessed catch basin sump at (cx - 1, cy)
  if (!isEntry && inBounds(g, cx - 1, cy)) {
    g = setTileCell(g, cx - 1, cy, (cell) => ({
      ...cell,
      terrainType: 'CANAL_SLUICE',
      liquidType: 'SLUICE_SLUDGE',
      liquidVolumeMl: 2500,
      blocksMovement: true,
      blocksSight: false,
      smokePpm: rng.nextInt(180, 260),
      steamPressureKpa: rng.nextInt(25, 45),
    }));
  }

  return g;
}

function carveDualChannelConduit(
  grid: StratumGrid,
  from: Point2D,
  to: Point2D,
  rng: SeededRNG,
): StratumGrid {
  let g = grid;
  const carveSegment = (x1: number, y1: number, x2: number, y2: number, isHoriz: boolean) => {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    if (isHoriz) {
      const y = y1;
      for (let x = minX; x <= maxX; x++) {
        const isWeir = x % 5 === 0 || x === minX || x === maxX;
        // Central channel
        if (inBounds(g, x, y)) {
          g = setTileCell(g, x, y, (c) => ({
            ...c,
            terrainType: isWeir ? 'IRON_GRATE' : 'CANAL_SLUICE',
            liquidType: 'SLUICE_SLUDGE',
            liquidVolumeMl: isWeir ? 500 : 2000,
            blocksMovement: !isWeir,
            blocksSight: false,
            smokePpm: isWeir ? rng.nextInt(60, 100) : rng.nextInt(120, 220),
            steamPressureKpa: isWeir ? 10 : rng.nextInt(15, 35),
          }));
        }
        // Flanking walkways
        for (const wy of [y - 1, y + 1]) {
          if (inBounds(g, x, wy)) {
            g = setTileCell(g, x, wy, (c) => {
              const isLiquidSluice = c.liquidType !== 'NONE' && c.terrainType === 'CANAL_SLUICE';
              if (c.blocksMovement && !isLiquidSluice) {
                return {
                  ...c,
                  terrainType: 'IRON_GRATE',
                  liquidType: 'NONE',
                  liquidVolumeMl: 0,
                  blocksMovement: false,
                  blocksSight: false,
                  coalDustDensity: 0.15,
                  smokePpm: rng.nextInt(40, 80),
                  steamPressureKpa: Math.min(c.steamPressureKpa ?? 0, 25),
                };
              }
              return c;
            });
          }
        }
      }
    } else {
      const x = x1;
      for (let y = minY; y <= maxY; y++) {
        const isWeir = y % 5 === 0 || y === minY || y === maxY;
        if (inBounds(g, x, y)) {
          g = setTileCell(g, x, y, (c) => ({
            ...c,
            terrainType: isWeir ? 'IRON_GRATE' : 'CANAL_SLUICE',
            liquidType: 'SLUICE_SLUDGE',
            liquidVolumeMl: isWeir ? 500 : 2000,
            blocksMovement: !isWeir,
            blocksSight: false,
            smokePpm: isWeir ? rng.nextInt(60, 100) : rng.nextInt(120, 220),
            steamPressureKpa: isWeir ? 10 : rng.nextInt(15, 35),
          }));
        }
        for (const wx of [x - 1, x + 1]) {
          if (inBounds(g, wx, y)) {
            g = setTileCell(g, wx, y, (c) => {
              const isLiquidSluice = c.liquidType !== 'NONE' && c.terrainType === 'CANAL_SLUICE';
              if (c.blocksMovement && !isLiquidSluice) {
                return {
                  ...c,
                  terrainType: 'IRON_GRATE',
                  liquidType: 'NONE',
                  liquidVolumeMl: 0,
                  blocksMovement: false,
                  blocksSight: false,
                  coalDustDensity: 0.15,
                  smokePpm: rng.nextInt(40, 80),
                  steamPressureKpa: Math.min(c.steamPressureKpa ?? 0, 25),
                };
              }
              return c;
            });
          }
        }
      }
    }
  };

  // L-bend conduit: horizontal then vertical
  carveSegment(from.x, from.y, to.x, from.y, true);
  carveSegment(to.x, from.y, to.x, to.y, false);
  return g;
}

export function carveVictorianSewerTopology(
  width: number,
  height: number,
  entryPos: Point2D,
  rng: SeededRNG,
): SewerTopologyResult {
  let grid = buildSolidStratumGrid('UNDERCROFT', width, height);

  const rX = (r: number) => Math.floor(width * r);
  const rY = (r: number) => Math.floor(height * r);

  // Four canonical quadrant anchors matching test invariants + 2 mid chambers
  const anchors: Point2D[] = [
    { x: rX(0.22), y: rY(0.20) }, // NW (10, 7)
    { x: rX(0.78), y: rY(0.20) }, // NE (37, 7)
    { x: rX(0.22), y: rY(0.80) }, // SW (10, 28)
    { x: rX(0.78), y: rY(0.80) }, // SE (37, 28)
    { x: rX(0.50), y: rY(0.25) }, // North-Mid
    { x: rX(0.50), y: rY(0.75) }, // South-Mid
  ];

  const chambers: Point2D[] = [entryPos, ...anchors];
  const junctionChambers: SewerJunctionChamber[] = [];

  // Carve octagonal chambers
  for (let i = 0; i < chambers.length; i++) {
    const c = chambers[i]!;
    const isEntry = i === 0;
    const isCatchBasin = i === 3;
    grid = carveOctagonalChamber(grid, c.x, c.y, isEntry, rng);
    junctionChambers.push({ center: c, isCatchBasin, hasSurfaceLadder: isEntry });
  }

  // Connect entry chamber to all anchors with dual-channel conduits
  for (const anchor of anchors) {
    grid = carveDualChannelConduit(grid, entryPos, anchor, rng);
  }

  // Additional perimeter conduits connecting quadrants
  grid = carveDualChannelConduit(grid, anchors[0]!, anchors[1]!, rng);
  grid = carveDualChannelConduit(grid, anchors[2]!, anchors[3]!, rng);

  // Guarantee entry landing tile is walkable
  grid = setTileCell(grid, entryPos.x, entryPos.y, (c) => ({
    ...c,
    terrainType: 'IRON_GRATE',
    liquidType: 'NONE',
    liquidVolumeMl: 0,
    blocksMovement: false,
    blocksSight: false,
  }));

  const catchBasinPos = anchors[2]!;

  return {
    grid,
    chambers: anchors,
    junctionChambers,
    catchBasinPos,
  };
}
