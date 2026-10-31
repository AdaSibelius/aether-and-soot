import { Point2D } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';

export interface Box {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export type TypologyKey = 'apothecary' | 'pawnshop' | 'boilerhouse' | 'rookeries' | 'monorailDepot' | 'artisanWorkshop';

/** Canonical footprints produced by `generateArchitecturalTypologies`, used as stamps for seeded block placement. */
export const CANONICAL: Readonly<Record<TypologyKey, { box: Box; door: Point2D }>> = {
  apothecary: { box: { x1: 33, y1: 3, x2: 43, y2: 12 }, door: { x: 38, y: 12 } },
  pawnshop: { box: { x1: 8, y1: 3, x2: 15, y2: 12 }, door: { x: 12, y: 12 } },
  boilerhouse: { box: { x1: 3, y1: 24, x2: 13, y2: 33 }, door: { x: 8, y: 24 } },
  rookeries: { box: { x1: 33, y1: 24, x2: 43, y2: 33 }, door: { x: 38, y: 24 } },
  monorailDepot: { box: { x1: 17, y1: 3, x2: 29, y2: 12 }, door: { x: 23, y: 12 } },
  artisanWorkshop: { box: { x1: 17, y1: 24, x2: 29, y2: 33 }, door: { x: 23, y: 24 } },
};
export const TYPOLOGY_KEYS = Object.keys(CANONICAL) as TypologyKey[];

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

export function inBox(b: Box, x: number, y: number): boolean {
  return x >= b.x1 && x <= b.x2 && y >= b.y1 && y <= b.y2;
}

export function intersects(a: Box, b: Box, margin = 0): boolean {
  return a.x1 - margin <= b.x2 && a.x2 + margin >= b.x1 && a.y1 - margin <= b.y2 && a.y2 + margin >= b.y1;
}

export function shuffle<T>(rng: SeededRNG, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i);
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return items;
}

/** Samples a point inside the street band (rows around the main thoroughfare) avoiding `avoid` boxes. */
export function pickBandPoint(
  rng: SeededRNG,
  width: number,
  cy: number,
  rowSpan: number,
  avoid: readonly Box[],
  margin: number,
): Point2D | undefined {
  for (let attempt = 0; attempt < 60; attempt++) {
    const x = rng.nextInt(4, width - 5);
    const y = cy + rng.nextInt(-rowSpan, rowSpan);
    if (y !== cy && !avoid.some((b) => intersects({ x1: x, y1: y, x2: x, y2: y }, b, margin))) return { x, y };
  }
  return undefined;
}

export function placeSmallBuilding(
  rng: SeededRNG,
  width: number,
  box: (x1: number) => Box,
  avoidX: readonly Box[],
  blockedCols: ReadonlySet<number>,
): Box {
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
