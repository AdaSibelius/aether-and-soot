import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityIdSchema, Point2D } from '../../schemas/primitives.schema.js';
import { canPlaceWithoutSevering } from './architectural-features.js';
import { setTileCell, StratumGrid } from './grid.js';

export interface LandmarkMicroLocationsResult {
  readonly streetGrid: StratumGrid;
  readonly spireGrid?: StratumGrid;
  readonly entities: Record<string, EntityRecord>;
  readonly landmarks: Record<string, Point2D>;
}

/** Seeds outdoor street landmarks (water pump, clocktower, canal lock) ensuring 100% path safety. */
export function seedOutdoorStreetLandmarks(
  initialGrid: StratumGrid,
  initialEntities: Record<string, EntityRecord>,
  criticalPoints: readonly Point2D[],
  sites: readonly Point2D[] = [],
): { grid: StratumGrid; entities: Record<string, EntityRecord>; positions: Record<string, Point2D> } {
  let grid = initialGrid;
  const entities = { ...initialEntities };
  const positions: Record<string, Point2D> = {};

  // 1. Water Pump Station (sidewalk square)
  const pumpPos: Point2D = sites[0] ?? { x: 14, y: 16 };
  if (canPlaceWithoutSevering(grid, pumpPos.x, pumpPos.y, 'IRON_GRATE', criticalPoints)) {
    grid = setTileCell(grid, pumpPos.x, pumpPos.y, (c) => ({
      ...c,
      terrainType: 'IRON_GRATE',
      blocksMovement: false,
      blocksSight: false,
    }));
    const pumpId = EntityIdSchema.parse('landmark_water_pump');
    entities[pumpId] = {
      id: pumpId,
      name: 'Victorian Municipal Water Pump Station',
      visual: { glyph: '╤', fgPrimary: '#3498DB', fgSecondary: '#2980B9', bgColor: '#0A0D0E', shaderFlags: [] },
      position: { x: pumpPos.x, y: pumpPos.y, stratum: 'STREET', blocksMovement: false, blocksSight: false },
      landmark: { kind: 'WATER_PUMP_STATION', label: 'Victorian Municipal Water Pump', discovered: true },
      furniture: { kind: 'WATER_PUMP', label: 'Victorian Municipal Water Pump' },
    };
    positions.waterPump = pumpPos;
  }

  // 2. Street-Corner Clocktower (thoroughfare monument)
  const clockPos: Point2D = sites[1] ?? { x: 31, y: 16 };
  if (canPlaceWithoutSevering(grid, clockPos.x, clockPos.y, 'SOOT_BRICK_WALL', criticalPoints)) {
    const clockId = EntityIdSchema.parse('landmark_street_clocktower');
    entities[clockId] = {
      id: clockId,
      name: 'Great St. Jude Street-Corner Clocktower',
      visual: { glyph: '⌂', fgPrimary: '#F4D03F', fgSecondary: '#D4AC0D', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
      position: { x: clockPos.x, y: clockPos.y, stratum: 'STREET', blocksMovement: true, blocksSight: false },
      landmark: { kind: 'STREET_CLOCKTOWER', label: 'Great St. Jude Street Clocktower', discovered: true },
      furniture: { kind: 'CLOCKTOWER_MECHANISM', label: 'Great St. Jude Clockwork Mechanism' },
    };
    positions.clocktower = clockPos;
  }

  // 3. Sunken Canal Lock (dock sluice winch)
  const lockPos: Point2D = sites[2] ?? { x: 31, y: 20 };
  if (canPlaceWithoutSevering(grid, lockPos.x, lockPos.y, 'CANAL_SLUICE', criticalPoints)) {
    grid = setTileCell(grid, lockPos.x, lockPos.y, (c) => ({
      ...c,
      terrainType: 'CANAL_SLUICE',
      blocksMovement: true,
      blocksSight: false,
    }));
    const lockId = EntityIdSchema.parse('landmark_canal_lock');
    entities[lockId] = {
      id: lockId,
      name: 'Limehouse Sunken Canal Lock & Winch',
      visual: { glyph: '≈', fgPrimary: '#16A085', fgSecondary: '#117A65', bgColor: '#0A0D0E', shaderFlags: ['PULSE_STEAM'] },
      position: { x: lockPos.x, y: lockPos.y, stratum: 'STREET', blocksMovement: false, blocksSight: false },
      landmark: { kind: 'SUNKEN_CANAL_LOCK', label: 'Sunken Canal Sluice Lock', discovered: true },
      furniture: { kind: 'CANAL_LOCK_MECHANISM', label: 'Heavy Canal Lock Gate Winch' },
    };
    positions.canalLock = lockPos;
  }

  return { grid, entities, positions };
}

/** Seeds a glass conservatory and botanical planter on the Spire stratum. */
export function seedSpireGreenhouse(
  initialSpireGrid: StratumGrid,
  initialEntities: Record<string, EntityRecord>,
  liftPos: Point2D,
): { grid: StratumGrid; entities: Record<string, EntityRecord>; position: Point2D } {
  let grid = initialSpireGrid;
  const entities = { ...initialEntities };

  // Place greenhouse offset from the lift
  const ghX = Math.min(grid.width - 6, Math.max(5, liftPos.x - 8));
  const ghY = Math.min(grid.height - 6, Math.max(5, liftPos.y - 6));
  const greenhousePos: Point2D = { x: ghX + 2, y: ghY + 2 };

  // Carve 5x5 conservatory box with glass pane walls and catwalk floor
  for (let dy = 0; dy <= 4; dy++) {
    for (let dx = 0; dx <= 4; dx++) {
      const isPerimeter = dx === 0 || dy === 0 || dx === 4 || dy === 4;
      const isDoor = dx === 2 && dy === 4;
      const x = ghX + dx;
      const y = ghY + dy;
      grid = setTileCell(grid, x, y, (c) => ({
        ...c,
        terrainType: isDoor ? 'WOODEN_DOOR_CLOSED' : isPerimeter ? 'GLASS_WINDOW' : 'BRASS_CATWALK',
        blocksMovement: isPerimeter && !isDoor,
        blocksSight: false,
        interiorZone: isPerimeter ? 'NONE' : 'WORKSHOP',
      }));
    }
  }

  const greenhouseId = EntityIdSchema.parse('landmark_spire_greenhouse');
  entities[greenhouseId] = {
    id: greenhouseId,
    name: 'Belgravia Spire Conservatory & Botanical Planter',
    visual: { glyph: 'Ψ', fgPrimary: '#2ECC71', fgSecondary: '#27AE60', bgColor: '#0A0D0E', shaderFlags: ['GASLIGHT_RADIANCE'] },
    position: { x: greenhousePos.x, y: greenhousePos.y, stratum: 'SPIRE', blocksMovement: true, blocksSight: false },
    landmark: { kind: 'SPIRE_ROOFTOP_GREENHOUSE', label: 'Belgravia Spire Conservatory', discovered: true },
    furniture: { kind: 'BOTANICAL_PLANTER', label: 'Aetheric Botanical Planter' },
  };

  return { grid, entities, position: greenhousePos };
}
