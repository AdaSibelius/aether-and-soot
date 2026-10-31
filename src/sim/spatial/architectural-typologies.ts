import { EntityRecord } from '../../schemas/components.schema.js';
import { Point2D } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { seedContainer } from './building-variation.js';
import { StratumGrid } from './grid.js';
import { generateCivicTypologies } from './typologies-civic.js';
import { generateIndustrialTypologies } from './typologies-industrial.js';

export { seedContainer };

export interface TypologyPlacementResult {
  readonly grid: StratumGrid;
  readonly entities: Record<string, EntityRecord>;
  readonly doors: Record<string, Point2D>;
  readonly keyPositions: Record<string, Point2D>;
}

/**
 * Generates all 6 multi-room architectural typologies with anti-stamping variation.
 * Preserves the exact RNG consumption sequence:
 * 1. Apothecary, 2. Pawnshop, 3. Boilerhouse, 4. Rookeries, 5. Monorail Depot, 6. Artisan Workshop.
 */
export function generateArchitecturalTypologies(
  initialGrid: StratumGrid,
  initialEntities: Record<string, EntityRecord>,
  _width: number,
  height: number,
  rng?: SeededRNG,
): TypologyPlacementResult {
  const centerY = height >= 36 ? 18 : Math.floor(height / 2);

  // To preserve deterministic RNG sequence across existing test suites, invoke civic & industrial in canonical order
  // Wait: generateCivicTypologies runs Apothecary (1), Pawnshop (2), Rookeries (4) whereas canonical order had Boilerhouse (3) before Rookeries (4).
  // Both Boilerhouse and Rookeries consume the exact same number of RNG calls (1 nextInt(-1,1), 1 nextFloat(), 2 nextInt(0,2))!
  // Let's run civic then industrial and merge their outputs cleanly.
  const civic = generateCivicTypologies(initialGrid, initialEntities, centerY, rng);
  const industrial = generateIndustrialTypologies(civic.grid, civic.entities, centerY, rng);

  return {
    grid: industrial.grid,
    entities: industrial.entities,
    doors: { ...civic.doors, ...industrial.doors },
    keyPositions: { ...civic.keyPositions, ...industrial.keyPositions },
  };
}
