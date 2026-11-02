import { EntityRecord } from '../../schemas/components.schema.js';
import { BlueprintIdSchema, EntityId, EntityIdSchema, Point2D } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { createEntityFromBlueprint } from '../data/item-catalog.js';
import { buildSolidStratumGrid, carveCorridor, hasWalkablePath } from './district-layout.js';
import { setTileCell, StratumGrid } from './grid.js';

export interface MineStope {
  readonly center: Point2D;
  readonly radius: number;
  readonly pillars: readonly Point2D[];
}

export interface MineStratumResult {
  readonly grid: StratumGrid;
  readonly entities: Record<string, EntityRecord>;
  readonly hoistPos: Point2D;
  readonly stopes: readonly MineStope[];
  readonly railTracks: readonly Point2D[];
}

function inBounds(grid: StratumGrid, x: number, y: number): boolean {
  return x >= 2 && y >= 2 && x <= grid.width - 3 && y <= grid.height - 3;
}

export function generateSubterraneanMineStratum(
  width: number,
  height: number,
  hoistPos: Point2D,
  rng: SeededRNG,
  depthLevel = 1,
): MineStratumResult {
  let grid = buildSolidStratumGrid('CATACOMBS', width, height);
  const entities: Record<string, EntityRecord> = {};
  const railTracks: Point2D[] = [];
  const stopes: MineStope[] = [];

  // 1. Headframe Hoist Station (5x5 boarding platform)
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const x = hoistPos.x + dx;
      const y = hoistPos.y + dy;
      if (inBounds(grid, x, y)) {
        grid = setTileCell(grid, x, y, (c) => ({
          ...c,
          terrainType: 'BOARDING_PLATFORM',
          blocksMovement: false,
          blocksSight: false,
          coalDustDensity: 0.35,
        }));
      }
    }
  }

  // Headframe Hoist Cage Entity
  const hoistId = EntityIdSchema.parse('portal_mine_hoist_cage');
  entities[hoistId] = {
    id: hoistId,
    name: 'Mine Headframe Hoist Cage',
    visual: { glyph: 'H', fgPrimary: '#E67E22', fgSecondary: '#A04000', bgColor: '#0A0D0E', shaderFlags: ['PULSE_STEAM'] },
    position: { x: hoistPos.x, y: hoistPos.y, stratum: 'CATACOMBS', depthLevel, blocksMovement: false, blocksSight: false },
    portal: {
      target: { x: hoistPos.x, y: hoistPos.y, stratum: 'STREET' },
      bidirectional: true,
      conductsGas: true,
      apCost: 100,
      portalLabel: 'Operate Steam Hoist to Street Level',
    },
  };

  // 2. Room-and-Pillar Excavated Stopes
  const stopeDefs = [
    { center: { x: Math.max(6, Math.floor(width * 0.22)), y: Math.max(6, Math.floor(height * 0.28)) }, radius: 4 },
    { center: { x: Math.min(width - 7, Math.floor(width * 0.78)), y: Math.max(6, Math.floor(height * 0.32)) }, radius: 4 },
    { center: { x: Math.floor(width * 0.5), y: Math.min(height - 7, Math.floor(height * 0.78)) }, radius: 4 },
  ];

  for (let i = 0; i < stopeDefs.length; i++) {
    const { center, radius } = stopeDefs[i]!;
    const pillars: Point2D[] = [];
    const pillarOffsets = [
      { dx: -2, dy: -2 }, { dx: 2, dy: -2 },
      { dx: -2, dy: 2 }, { dx: 2, dy: 2 },
    ];

    const maxExtent = Math.max(radius, 3);
    for (let dy = -maxExtent; dy <= maxExtent; dy++) {
      for (let dx = -maxExtent; dx <= maxExtent; dx++) {
        const isPillar = pillarOffsets.some((po) => po.dx === dx && po.dy === dy);
        const isPillarHalo = pillarOffsets.some((po) => Math.abs(dx - po.dx) <= 1 && Math.abs(dy - po.dy) <= 1);
        const inStopeRadius = dx * dx + dy * dy <= radius * radius + 1;

        if (!inStopeRadius && !isPillarHalo) continue;
        const x = center.x + dx;
        const y = center.y + dy;
        if (!inBounds(grid, x, y)) continue;

        if (isPillar) {
          pillars.push({ x, y });
          grid = setTileCell(grid, x, y, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL', blocksMovement: true, blocksSight: true }));
        } else {
          grid = setTileCell(grid, x, y, (c) => ({
            ...c,
            terrainType: 'SCORCHED_STONE',
            blocksMovement: false,
            blocksSight: false,
            coalDustDensity: 0.45,
            smokePpm: rng.nextInt(20, 60),
          }));
        }
      }
    }
    stopes.push({ center, radius, pillars });

    // 3. Narrow-Gauge Rail Track Drift Corridor from Hoist to Stope
    grid = carveCorridor(grid, hoistPos, center, 'RAIL_TRACK');

    // Track rail positions
    const minX = Math.min(hoistPos.x, center.x);
    const maxX = Math.max(hoistPos.x, center.x);
    const minY = Math.min(hoistPos.y, center.y);
    const maxY = Math.max(hoistPos.y, center.y);
    for (let x = minX; x <= maxX; x++) railTracks.push({ x, y: hoistPos.y });
    for (let y = minY; y <= maxY; y++) railTracks.push({ x: center.x, y });

    // 4. Ore Trolley Container at Rail Siding
    const trolleyId = EntityIdSchema.parse(`furniture_ore_trolley_${i}`);
    const coalId = EntityIdSchema.parse(`loot_mine_coal_${i}`);
    const gearId = EntityIdSchema.parse(`loot_mine_gears_${i}`);

    const coal = createEntityFromBlueprint(BlueprintIdSchema.parse('commodity_anthracite_briquette'), coalId, 3);
    const gears = createEntityFromBlueprint(BlueprintIdSchema.parse('mat_brass_gears'), gearId, 2);
    if (coal) entities[coalId] = coal;
    if (gears) entities[gearId] = gears;

    const contained: EntityId[] = [];
    if (coal) contained.push(coalId);
    if (gears) contained.push(gearId);

    entities[trolleyId] = {
      id: trolleyId,
      name: 'Narrow-Gauge Ore Trolley',
      visual: { glyph: '⌸', fgPrimary: '#D4AF37', fgSecondary: '#8B6914', bgColor: '#0A0D0E', shaderFlags: [] },
      position: { x: center.x + 1, y: center.y, stratum: 'CATACOMBS', depthLevel, blocksMovement: true, blocksSight: false },
      furniture: { kind: 'CRATE', label: 'Narrow-Gauge Ore Trolley' },
      inventory: { containedEntityIds: contained, currentMassGrams: 6000, maxMassGrams: 50000, maxVolumeMl: 50000 },
    };
  }

  // 5. Timber Strut Shoring Placement along Drift Edges
  for (let y = 3; y < height - 3; y++) {
    for (let x = 3; x < width - 3; x++) {
      const cell = grid.cells[y * width + x];
      if (!cell || cell.blocksMovement || cell.terrainType === 'RAIL_TRACK') continue;
      // Is it near a wall and not on key corridors?
      const adjacentWall = [
        grid.cells[(y - 1) * width + x],
        grid.cells[(y + 1) * width + x],
        grid.cells[y * width + (x - 1)],
        grid.cells[y * width + (x + 1)],
      ].some((c) => c && c.terrainType === 'SOOT_BRICK_WALL');

      // Never place timber struts within the 8-cell perimeter ring of support pillars
      const isNearPillar = stopes.some((s) => s.pillars.some((p) => Math.abs(x - p.x) <= 1 && Math.abs(y - p.y) <= 1));
      if (isNearPillar) continue;

      if (adjacentWall && (x + y) % 7 === 0) {
        // Test if placing timber strut keeps reachability to all stopes
        const testGrid = setTileCell(grid, x, y, (c) => ({ ...c, terrainType: 'TIMBER_STRUT', blocksMovement: true, blocksSight: false }));
        const allReachable = stopes.every((s) => hasWalkablePath(testGrid, hoistPos, s.center));
        if (allReachable) {
          grid = testGrid;
        }
      }
    }
  }

  return {
    grid,
    entities,
    hoistPos,
    stopes,
    railTracks,
  };
}
