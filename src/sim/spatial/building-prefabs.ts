import { EntityRecord } from '../../schemas/components.schema.js';
import { Point2D } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { generateArchitecturalTypologies } from './architectural-typologies.js';
import { StratumGrid } from './grid.js';
import { seedOutdoorStreetLandmarks } from './landmark-micro-locations.js';

export interface DistrictArchetypesResult {
  readonly grid: StratumGrid;
  readonly entities: Record<string, EntityRecord>;
  readonly doors?: Record<string, Point2D>;
  readonly keyPositions?: Record<string, Point2D>;
  readonly landmarks?: Record<string, Point2D>;
}

/**
 * Procedurally generates 6 distinct multi-room Victorian building typologies and outdoor street landmarks:
 * 1. Victorian Apothecary & Chirurgeon Clinic (Reception, Surgical Bay, Chemical Storage)
 * 2. Clockwork Pawnshop & Cartel Bank (Appraisal Concourse, Cartel Strongroom Vault, Pawn Stash)
 * 3. Steam Boilerhouse & Slag Furnace (Smelting Hearth Workshop, Coal Stacks Storage)
 * 4. Tenement Rookeries (Common Reception Hall, Dormitory Stash Storage)
 * 5. Pneumatic Monorail Depot (Ticket Concourse, Actuator Workshop, Parts Storage)
 * 6. Guild Artisan Workshop (Showroom Reception, Master Bench Workshop, Ingot Strongbox Vault)
 * Plus outdoor street landmarks: Municipal Water Pump Station, Great St. Jude Clocktower, Sunken Canal Lock.
 */
export function populateDistrictArchetypes(
  initialGrid: StratumGrid,
  initialEntities: Record<string, EntityRecord>,
  width: number,
  height: number,
  criticalPoints?: readonly Point2D[],
  rng?: SeededRNG,
): DistrictArchetypesResult {
  // Small legacy districts (e.g. 24x24 in minimal test fixtures) preserve their minimal layout.
  if (width < 36 || height < 28) {
    return { grid: initialGrid, entities: initialEntities };
  }

  // 1. Generate the 6 multi-room architectural typologies with anti-stamping variation
  const typologies = generateArchitecturalTypologies(initialGrid, initialEntities, width, height, rng);

  // 2. Critical navigation anchors to guarantee 100% path safety
  const critical = criticalPoints ?? [
    { x: 0, y: Math.floor(height / 2) },
    { x: width - 1, y: Math.floor(height / 2) },
    { x: Math.floor(width / 2), y: Math.floor(height / 2) },
    typologies.doors.apothecary ?? { x: 38, y: 12 },
    typologies.doors.pawnshop ?? { x: 8, y: 12 },
    typologies.doors.boilerhouse ?? { x: 8, y: 24 },
    typologies.doors.rookeries ?? { x: 38, y: 24 },
    typologies.doors.monorailDepot ?? { x: 23, y: 12 },
    typologies.doors.artisanWorkshop ?? { x: 23, y: 24 },
  ];

  // 3. Seed outdoor street landmarks (water pump, clocktower, canal lock)
  const landmarkRes = seedOutdoorStreetLandmarks(typologies.grid, typologies.entities, critical);

  return {
    grid: landmarkRes.grid,
    entities: landmarkRes.entities,
    doors: typologies.doors,
    keyPositions: typologies.keyPositions,
    landmarks: landmarkRes.positions,
  };
}

export { carveMultiRoomBuilding, findCellsInZone, getInteriorZoneAtPoint } from './interior-zoning.js';
export { generateArchitecturalTypologies } from './architectural-typologies.js';
export { seedOutdoorStreetLandmarks, seedSpireGreenhouse } from './landmark-micro-locations.js';
