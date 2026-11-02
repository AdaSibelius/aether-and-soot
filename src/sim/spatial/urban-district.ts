import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityId, EntityIdSchema, Point2D } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { BuildingTemplate } from '../../schemas/building-template.schema.js';
import { ALL_BUILDING_TEMPLATES } from './building-templates.js';
import { Box } from './district-blocks.js';
import { carveCorridor, carveRoom } from './district-layout.js';
import { ensureDistrictConnectivity } from './district-yards.js';
import { setTileCell, StratumGrid } from './grid.js';
import {
  getTransformedDimensions,
  instantiateTemplateIntoGrid,
  TemplateRotation,
} from './template-instantiator.js';

export interface UrbanParcel {
  readonly id: string;
  readonly bounds: Box;
  readonly frontDirection: 'NORTH' | 'SOUTH';
  readonly templateId?: string;
}

export interface UrbanStreetSpec {
  readonly avenueY: { readonly min: number; readonly max: number };
  readonly plaza: Box;
  readonly crossStreetX: readonly [number, number];
  readonly northAlleyY: number;
  readonly southAlleyY: number;
}

export interface UrbanDistrictResult {
  readonly grid: StratumGrid;
  readonly entities: Record<string, EntityRecord>;
  readonly parcels: readonly UrbanParcel[];
  readonly doors: Record<string, Point2D>;
  readonly entrancePoints: readonly Point2D[];
  readonly outwardPoints: readonly Point2D[];
  readonly keyPositions: Record<string, Point2D>;
  readonly fixturesPlaced: readonly EntityId[];
}

export function getUrbanStreetSpec(_width: number, height: number, center: Point2D): UrbanStreetSpec {
  const cy = center.y;
  return {
    avenueY: { min: cy - 1, max: cy + 1 },
    plaza: { x1: center.x - 3, y1: cy - 3, x2: center.x + 3, y2: cy + 3 },
    crossStreetX: [15, 30],
    northAlleyY: 2,
    southAlleyY: Math.max(cy + 4, height - 3),
  };
}

export function carveHierarchicalStreetNetwork(
  grid: StratumGrid,
  width: number,
  height: number,
  center: Point2D,
  rng: SeededRNG,
): StratumGrid {
  const spec = getUrbanStreetSpec(width, height, center);
  let g = grid;

  // 1. Central 7x7 Plaza
  g = carveRoom(g, center.x, center.y, 3, 3, 'COBBLESTONE_FLOOR');

  // 2. Primary Arterial Avenue (Width 3)
  for (let y = spec.avenueY.min; y <= spec.avenueY.max; y++) {
    for (let x = 1; x < width - 1; x++) {
      g = setTileCell(g, x, y, (c) => ({ ...c, terrainType: 'COBBLESTONE_FLOOR', blocksMovement: false, blocksSight: false }));
    }
  }

  // 3. Secondary Cross-Streets (Width 2)
  for (const sx of spec.crossStreetX) {
    if (sx >= width - 3) continue;
    for (let y = spec.northAlleyY; y <= spec.southAlleyY; y++) {
      for (let dx = 0; dx <= 1; dx++) {
        if (sx + dx < width - 1) {
          g = setTileCell(g, sx + dx, y, (c) => ({ ...c, terrainType: 'COBBLESTONE_FLOOR', blocksMovement: false, blocksSight: false }));
        }
      }
    }
  }

  // 4. Service Back-Alleys (Width 1, cobblestone + rubble)
  for (const ay of [spec.northAlleyY, spec.southAlleyY]) {
    for (let x = 2; x < width - 2; x++) {
      const terrain = rng.nextFloat() < 0.25 ? 'RUBBLE_PILE' : 'COBBLESTONE_FLOOR';
      g = setTileCell(g, x, ay, (c) => ({ ...c, terrainType: terrain, blocksMovement: false, blocksSight: false }));
    }
  }

  // Compass Gate Access Points
  g = setTileCell(g, center.x, 1, (c) => ({ ...c, terrainType: 'COBBLESTONE_FLOOR', blocksMovement: false, blocksSight: false }));
  g = setTileCell(g, center.x, height - 2, (c) => ({ ...c, terrainType: 'COBBLESTONE_FLOOR', blocksMovement: false, blocksSight: false }));

  return g;
}

export function subdivideUrbanParcels(width: number, height: number, center: Point2D): UrbanParcel[] {
  if (width < 45 || height < 35) return [];
  const spec = getUrbanStreetSpec(width, height, center);
  return [
    { id: 'parcel_nw', bounds: { x1: 2, y1: spec.northAlleyY + 1, x2: spec.crossStreetX[0] - 1, y2: spec.avenueY.min - 1 }, frontDirection: 'SOUTH' },
    { id: 'parcel_nc', bounds: { x1: spec.crossStreetX[0] + 2, y1: spec.northAlleyY + 1, x2: spec.crossStreetX[1] - 1, y2: spec.plaza.y1 - 1 }, frontDirection: 'SOUTH' },
    { id: 'parcel_ne', bounds: { x1: spec.crossStreetX[1] + 2, y1: spec.northAlleyY + 1, x2: width - 4, y2: spec.avenueY.min - 1 }, frontDirection: 'SOUTH' },
    { id: 'parcel_sw', bounds: { x1: 2, y1: spec.avenueY.max + 1, x2: spec.crossStreetX[0] - 1, y2: spec.southAlleyY - 1 }, frontDirection: 'NORTH' },
    { id: 'parcel_sc', bounds: { x1: spec.crossStreetX[0] + 2, y1: spec.plaza.y2 + 1, x2: spec.crossStreetX[1] - 1, y2: spec.southAlleyY - 1 }, frontDirection: 'NORTH' },
    { id: 'parcel_se', bounds: { x1: spec.crossStreetX[1] + 2, y1: spec.avenueY.max + 1, x2: width - 4, y2: spec.southAlleyY - 1 }, frontDirection: 'NORTH' },
  ];
}

export function generateUrbanDistrict(
  grid: StratumGrid,
  entities: Record<string, EntityRecord>,
  width: number,
  height: number,
  center: Point2D,
  rng: SeededRNG,
): UrbanDistrictResult {
  let g = carveHierarchicalStreetNetwork(grid, width, height, center, rng);
  let outEntities = { ...entities };
  const parcels = subdivideUrbanParcels(width, height, center);
  const doors: Record<string, Point2D> = {};
  const entrancePoints: Point2D[] = [];
  const outwardPoints: Point2D[] = [];
  const keyPositions: Record<string, Point2D> = {};
  const fixturesPlaced: EntityId[] = [];

  // Seed Central Plaza Monument if space allows
  const monumentId = EntityIdSchema.parse('landmark_plaza_monument');
  if (!outEntities[monumentId] && width >= 36) {
    outEntities[monumentId] = {
      id: monumentId,
      name: 'Victoria Memorial Clocktower & Fountain',
      visual: { glyph: '⌂', fgPrimary: '#D4AF37', fgSecondary: '#5D6D7E', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
      position: { x: center.x + 2, y: center.y - 1, stratum: 'STREET', blocksMovement: true, blocksSight: false },
      furniture: { kind: 'VALVE_MANIFOLD', label: 'Victoria Memorial Clocktower & Fountain' },
    };
  }

  const templates: BuildingTemplate[] = [...ALL_BUILDING_TEMPLATES];
  for (let i = templates.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i);
    const tmp = templates[i]!;
    templates[i] = templates[j]!;
    templates[j] = tmp;
  }

  for (let i = 0; i < parcels.length; i++) {
    const parcel = parcels[i]!;
    const tpl = templates[i % templates.length]!;
    const rot: TemplateRotation = parcel.frontDirection === 'SOUTH' ? 0 : 180;
    const dims = getTransformedDimensions(tpl.width, tpl.height, rot);
    const pw = parcel.bounds.x2 - parcel.bounds.x1 + 1;
    const ph = parcel.bounds.y2 - parcel.bounds.y1 + 1;
    if (dims.width > pw || dims.height > ph) continue;

    const originX = parcel.bounds.x1 + Math.floor((pw - dims.width) / 2);
    const originY = parcel.frontDirection === 'SOUTH'
      ? parcel.bounds.y2 - dims.height + 1
      : parcel.bounds.y1;

    const stampRes = instantiateTemplateIntoGrid(g, outEntities, tpl, {
      origin: { x: originX, y: originY },
      rotation: rot,
      mirrorX: rng.nextFloat() < 0.5,
      targetStratum: 'STREET',
    }, rng);

    g = stampRes.grid;
    outEntities = { ...stampRes.entities };
    entrancePoints.push(...stampRes.entrancePoints);
    outwardPoints.push(...stampRes.outwardPoints);
    fixturesPlaced.push(...stampRes.fixturesPlaced);
    Object.assign(doors, stampRes.doors);
    Object.assign(keyPositions, stampRes.keyPositions);

    for (const outPt of stampRes.outwardPoints) {
      const targetY = parcel.frontDirection === 'SOUTH' ? outPt.y + 1 : outPt.y - 1;
      g = carveCorridor(g, outPt, { x: outPt.x, y: targetY }, 'COBBLESTONE_FLOOR');
    }
  }

  const targets = [
    ...outwardPoints,
    { x: 1, y: center.y },
    { x: width - 2, y: center.y },
    { x: center.x, y: 1 },
    { x: center.x, y: height - 2 },
  ];
  const { grid: repaired } = ensureDistrictConnectivity(g, center, targets);

  return {
    grid: repaired,
    entities: outEntities,
    parcels,
    doors,
    entrancePoints,
    outwardPoints,
    keyPositions,
    fixturesPlaced,
  };
}
