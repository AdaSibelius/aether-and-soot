import { EntityRecord } from '../../schemas/components.schema.js';
import { Point2D } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { generateArchitecturalTypologies } from './architectural-typologies.js';
import { buildSolidStratumGrid, carveCorridor } from './district-layout.js';
import { StratumGrid } from './grid.js';

export interface Box {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export type TypologyKey = 'apothecary' | 'pawnshop' | 'boilerhouse' | 'rookeries' | 'monorailDepot' | 'artisanWorkshop';

/** Canonical footprints produced by `generateArchitecturalTypologies`, used as stamps for seeded block placement. */
const CANONICAL: Readonly<Record<TypologyKey, { box: Box; door: Point2D }>> = {
  apothecary: { box: { x1: 33, y1: 3, x2: 43, y2: 12 }, door: { x: 38, y: 12 } },
  pawnshop: { box: { x1: 8, y1: 3, x2: 15, y2: 12 }, door: { x: 12, y: 12 } },
  boilerhouse: { box: { x1: 3, y1: 24, x2: 13, y2: 33 }, door: { x: 8, y: 24 } },
  rookeries: { box: { x1: 33, y1: 24, x2: 43, y2: 33 }, door: { x: 38, y: 24 } },
  monorailDepot: { box: { x1: 17, y1: 3, x2: 29, y2: 12 }, door: { x: 23, y: 12 } },
  artisanWorkshop: { box: { x1: 17, y1: 24, x2: 29, y2: 33 }, door: { x: 23, y: 24 } },
};
const TYPOLOGY_KEYS = Object.keys(CANONICAL) as TypologyKey[];

export interface BuildingPlacement {
  readonly key: TypologyKey;
  readonly src: Box;
  readonly dst: Box;
  readonly mirrorX: boolean;
  readonly flipY: boolean;
  readonly door: Point2D;
  /** Street-side cell directly outside the door. */
  readonly outward: Point2D;
}

export interface SmallBuilding {
  readonly box: Box;
  readonly door: Point2D;
  readonly interiorAnchor: Point2D;
}

export interface MacroLayout {
  readonly placements: readonly BuildingPlacement[];
  readonly workshop: SmallBuilding;
  readonly market: SmallBuilding;
  readonly liftPos: Point2D;
  readonly dropPoints: readonly Point2D[];
  readonly landmarkSites: readonly Point2D[];
}

/** Minimum district footprint for seeded block placement; smaller fixtures keep their compact legacy layouts. */
export function supportsProceduralBlocks(width: number, height: number): boolean {
  return width >= 45 && height >= 36;
}

export function mapPoint(p: BuildingPlacement, pt: Point2D): Point2D {
  const w = p.src.x2 - p.src.x1;
  const h = p.src.y2 - p.src.y1;
  const u = pt.x - p.src.x1;
  const v = pt.y - p.src.y1;
  return {
    x: p.dst.x1 + (p.mirrorX ? w - u : u),
    y: p.dst.y1 + (p.flipY ? h - v : v),
  };
}

function inBox(b: Box, x: number, y: number): boolean {
  return x >= b.x1 && x <= b.x2 && y >= b.y1 && y <= b.y2;
}

function intersects(a: Box, b: Box, margin = 0): boolean {
  return a.x1 - margin <= b.x2 && a.x2 + margin >= b.x1 && a.y1 - margin <= b.y2 && a.y2 + margin >= b.y1;
}

function shuffle<T>(rng: SeededRNG, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i);
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return items;
}

/** Samples a point inside the street band (rows around the main thoroughfare) avoiding `avoid` boxes. */
function pickBandPoint(rng: SeededRNG, width: number, cy: number, rowSpan: number, avoid: readonly Box[], margin: number): Point2D | undefined {
  for (let attempt = 0; attempt < 60; attempt++) {
    const x = rng.nextInt(4, width - 5);
    const y = cy + rng.nextInt(-rowSpan, rowSpan);
    if (y !== cy && !avoid.some((b) => intersects({ x1: x, y1: y, x2: x, y2: y }, b, margin))) return { x, y };
  }
  return undefined;
}

function placeSmallBuilding(rng: SeededRNG, width: number, box: (x1: number) => Box, avoidX: readonly Box[], blockedCols: ReadonlySet<number>): Box {
  const valid = (x1: number): boolean => {
    const b = box(x1);
    if (avoidX.some((a) => intersects(b, a, 1))) return false;
    for (let x = b.x1; x <= b.x2; x++) if (blockedCols.has(x)) return false;
    return true;
  };
  for (let attempt = 0; attempt < 60; attempt++) {
    const x1 = rng.nextInt(2, width - 9);
    if (valid(x1)) return box(x1);
  }
  for (let x1 = 2; x1 <= width - 9; x1++) if (valid(x1)) return box(x1);
  return box(2);
}

/**
 * Seeded perimeter-block zoning: the six typologies are permuted across a 3x2 grid of plots flanking the central
 * thoroughfare (jittered inside their plot, mirrored/flipped so doors face the street), while the workshop, market,
 * pneumatic lift, sewer drops and landmark sites are sampled around the plaza band.
 */
export function planMacroLayout(rng: SeededRNG, width: number, height: number, center: Point2D): MacroLayout {
  const cy = center.y;
  const slotW = Math.floor((width - 4 - 2) / 3);
  const topRows = { min: 2, max: cy - 5 };
  const botRows = { min: cy + 5, max: height - 3 };

  const placements: BuildingPlacement[] = shuffle(rng, [...TYPOLOGY_KEYS]).map((key, i) => {
    const { box: src, door } = CANONICAL[key];
    const bw = src.x2 - src.x1 + 1;
    const bh = src.y2 - src.y1 + 1;
    const top = i < 3;
    const rows = top ? topRows : botRows;
    const x1 = rng.nextInt(2 + (i % 3) * (slotW + 1), 2 + (i % 3) * (slotW + 1) + slotW - bw);
    const y1 = rng.nextInt(rows.min, rows.max - bh + 1);
    const doorSouth = door.y === src.y2;
    const base: BuildingPlacement = {
      key,
      src,
      dst: { x1, y1, x2: x1 + bw - 1, y2: y1 + bh - 1 },
      mirrorX: rng.nextFloat() < 0.5,
      flipY: top ? !doorSouth : doorSouth,
      door,
      outward: door,
    };
    const mappedDoor = mapPoint(base, door);
    return { ...base, door: mappedDoor, outward: { x: mappedDoor.x, y: mappedDoor.y + (top ? 1 : -1) } };
  });

  const plaza: Box = { x1: center.x - 3, y1: cy - 3, x2: center.x + 3, y2: cy + 3 };
  const topCols = new Set(placements.filter((p) => p.dst.y1 < cy).map((p) => p.door.x));
  const botCols = new Set(placements.filter((p) => p.dst.y1 > cy).map((p) => p.door.x));

  const workshopBox = placeSmallBuilding(rng, width, (x1) => ({ x1, y1: cy - 4, x2: x1 + 5, y2: cy - 1 }), [plaza], topCols);
  const marketBox = placeSmallBuilding(rng, width, (x1) => ({ x1, y1: cy + 1, x2: x1 + 5, y2: cy + 4 }), [plaza], botCols);
  const workshopDoor = { x: workshopBox.x1 + rng.nextInt(1, 4), y: workshopBox.y2 };
  const marketDoor = { x: marketBox.x1 + rng.nextInt(1, 4), y: marketBox.y1 };

  const avoid: Box[] = [plaza, workshopBox, marketBox];
  let liftPos: Point2D = { x: center.x + 9, y: cy };
  for (let attempt = 0; attempt < 80; attempt++) {
    const x = rng.nextInt(5, width - 6);
    const y = cy + rng.nextInt(-2, 2);
    if (!avoid.some((b) => intersects({ x1: x - 2, y1: y - 2, x2: x + 2, y2: y + 2 }, b, 1))) {
      liftPos = { x, y };
      break;
    }
  }
  const liftRoom: Box = { x1: liftPos.x - 2, y1: liftPos.y - 2, x2: liftPos.x + 2, y2: liftPos.y + 2 };
  const clear = [...avoid, liftRoom];

  const dropPoints: Point2D[] = [];
  for (let i = 0; i < 2; i++) {
    const pt = pickBandPoint(rng, width, cy, 3, [...clear, ...dropPoints.map((d) => ({ x1: d.x, y1: d.y, x2: d.x, y2: d.y }))], 1);
    if (pt) dropPoints.push(pt);
  }
  const landmarkSites: Point2D[] = [];
  for (let i = 0; i < 3; i++) {
    const taken = [...dropPoints, ...landmarkSites].map((d) => ({ x1: d.x, y1: d.y, x2: d.x, y2: d.y }));
    const pt = pickBandPoint(rng, width, cy, 3, [...clear, ...taken], 1);
    if (pt) landmarkSites.push(pt);
  }

  return {
    placements,
    workshop: { box: workshopBox, door: workshopDoor, interiorAnchor: { x: workshopBox.x1 + 2, y: workshopBox.y1 + 1 } },
    market: { box: marketBox, door: marketDoor, interiorAnchor: { x: marketBox.x1 + 2, y: marketBox.y2 - 1 } },
    liftPos,
    dropPoints,
    landmarkSites,
  };
}

export interface PlacedTypologies {
  readonly grid: StratumGrid;
  readonly entities: Record<string, EntityRecord>;
  readonly doors: Record<string, Point2D>;
  readonly keyPositions: Record<string, Point2D>;
}

/**
 * Generates the six canonical multi-room typologies on a scratch grid (preserving their per-seed room/annex/pipe
 * variation) and stamps each footprint — with its furniture and containers — at its planned block position.
 */
export function applyTypologyPlacements(
  street: StratumGrid,
  entities: Record<string, EntityRecord>,
  layout: MacroLayout,
  rng: SeededRNG,
  centerY: number,
): PlacedTypologies {
  const scratch = generateArchitecturalTypologies(
    buildSolidStratumGrid('STREET', street.width, street.height),
    {},
    street.width,
    street.height,
    rng,
  );
  const cells = street.cells.slice();
  const out: Record<string, EntityRecord> = { ...entities };
  const doors: Record<string, Point2D> = {};
  const keyPositions: Record<string, Point2D> = {};

  for (const p of layout.placements) {
    for (let sy = p.src.y1; sy <= p.src.y2; sy++) {
      for (let sx = p.src.x1; sx <= p.src.x2; sx++) {
        const d = mapPoint(p, { x: sx, y: sy });
        const cell = scratch.grid.cells[sy * street.width + sx];
        if (cell) cells[d.y * street.width + d.x] = cell;
      }
    }
    doors[p.key] = p.door;
  }

  for (const [id, ent] of Object.entries(scratch.entities)) {
    const pos = ent.position;
    const owner = pos ? layout.placements.find((p) => inBox(p.src, pos.x, pos.y)) : undefined;
    out[id] = pos && owner ? { ...ent, position: { ...pos, ...mapPoint(owner, pos) } } : ent;
  }

  const boiler = layout.placements.find((p) => p.key === 'boilerhouse');
  const artisan = layout.placements.find((p) => p.key === 'artisanWorkshop');
  const boilerSrc = scratch.keyPositions.boiler;
  const benchSrc = scratch.keyPositions.artisanBench;
  if (boiler && boilerSrc) keyPositions.boiler = mapPoint(boiler, boilerSrc);
  if (artisan && benchSrc) keyPositions.artisanBench = mapPoint(artisan, benchSrc);

  let grid: StratumGrid = { ...street, cells };
  for (const p of layout.placements) {
    grid = carveCorridor(grid, p.outward, { x: p.outward.x, y: centerY }, 'COBBLESTONE_FLOOR');
  }
  return { grid, entities: out, doors, keyPositions };
}
