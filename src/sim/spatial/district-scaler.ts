import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityIdSchema, Point2D, StratumId } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { canPlaceWithoutSevering, placeArchitecturalFeature } from './architectural-features.js';
import { carveCorridor, hasWalkablePath } from './district-layout.js';
import { isWithinBounds, setTileCell, StratumGrid } from './grid.js';

export interface ScaledDistrictEnrichmentResult {
  readonly streetGrid: StratumGrid;
  readonly undercroftGrid: StratumGrid;
  readonly entities: Record<string, EntityRecord>;
  readonly barriersPlaced: string[];
  readonly sewerDrops: readonly Point2D[];
}

/**
 * Enriches large-scale districts (up to 64x48) with macro barriers:
 * - Thames Estuary canal network (sluices, timber piers)
 * - Elevated viaduct colonnade arches
 * - Reinforced Crown toll perimeter wall & checkpoint gate
 * - Multi-point sewer drops connecting Street to Undercroft
 */
export function enrichLargeScaleDistrict(
  streetGrid: StratumGrid,
  undercroftGrid: StratumGrid,
  districtId: string,
  _rng: SeededRNG,
  criticalLandmarks: readonly Point2D[],
  existingEntities: Record<string, EntityRecord>,
  options: { readonly dropHints?: readonly Point2D[]; readonly origin?: Point2D } = {},
): ScaledDistrictEnrichmentResult {
  let street = streetGrid;
  let undercroft = undercroftGrid;
  const entities = { ...existingEntities };
  const barriersPlaced: string[] = [];
  const sewerDrops: Point2D[] = [];

  const { width, height } = street;
  if (width < 48 || height < 36) {
    return { streetGrid: street, undercroftGrid: undercroft, entities, barriersPlaced, sewerDrops };
  }

  const centerY = options.origin?.y ?? Math.floor(height / 2);
  const centerX = options.origin?.x ?? Math.floor(width / 2);
  const dLower = districtId.toLowerCase();

  // 1. Thames Estuary Canal Network (southern & south-eastern quadrant)
  if (dLower.includes('limehouse') || dLower.includes('soot') || dLower.includes('spitalfields')) {
    const canalY = height - 6;
    for (let x = centerX - 10; x <= width - 6; x++) {
      if (isWithinBounds(street, x, canalY) && !criticalLandmarks.some((p) => p.x === x && p.y === canalY)) {
        street = placeArchitecturalFeature(street, x, canalY, 'CANAL_SLUICE');
      }
      // Adjacent timber wharf pier
      if (isWithinBounds(street, x, canalY - 1)) {
        street = placeArchitecturalFeature(street, x, canalY - 1, 'TIMBER_PIER');
      }
    }
    const canalId = EntityIdSchema.parse(`hydrology_canal_${districtId}`);
    entities[canalId] = {
      id: canalId,
      name: 'Thames Estuary Canal Sluice Barrier',
      visual: { glyph: '╫', fgPrimary: '#2874A6', fgSecondary: '#1B4F72', bgColor: '#0A0D0E', shaderFlags: ['PULSE_STEAM'] },
      position: { x: centerX, y: canalY, stratum: 'STREET', blocksMovement: true, blocksSight: false },
      hydrologyChannel: {
        fluidType: 'WATER',
        currentVolumeMl: 100000,
        maxFlowRateMlPerTick: 2000,
        sluiceOpen: true,
        drainsIntoStratum: 'UNDERCROFT',
      },
    };
    barriersPlaced.push('THAMES_CANAL');
  }

  // 2. Viaduct Colonnade Arches (northern quadrant)
  if (dLower.includes('spitalfields') || dLower.includes('belgravia') || dLower.includes('spire')) {
    const viaductY = 6;
    for (let x = 8; x <= width - 8; x += 4) {
      if (isWithinBounds(street, x, viaductY) && canPlaceWithoutSevering(street, x, viaductY, 'GOTHIC_COLONNADE', criticalLandmarks)) {
        street = placeArchitecturalFeature(street, x, viaductY, 'GOTHIC_COLONNADE');
      }
    }
    barriersPlaced.push('VIADUCT');
  }

  // 3. Reinforced Toll Perimeter Wall (western / central barrier)
  if (dLower.includes('whitechapel') || dLower.includes('rookeries')) {
    const wallX = centerX - 8;
    for (let y = 5; y <= height - 8; y++) {
      if (y === centerY || y === centerY - 1) continue; // Leave central toll passage open
      if (isWithinBounds(street, wallX, y) && canPlaceWithoutSevering(street, wallX, y, 'WROUGHT_IRON_FENCE', criticalLandmarks)) {
        street = placeArchitecturalFeature(street, wallX, y, 'WROUGHT_IRON_FENCE');
      }
    }
    barriersPlaced.push('TOLL_PERIMETER_WALL');
  }

  // 4. Multi-Point Sewer Drops (Secondary & Tertiary descent portals)
  const secondaryDrop: Point2D = { x: Math.min(width - 6, centerX + 16), y: Math.min(height - 5, centerY + 8) };
  const tertiaryDrop: Point2D = { x: Math.max(5, centerX - 16), y: Math.min(height - 5, centerY + 8) };

  const drops = options.dropHints && options.dropHints.length >= 2
    ? options.dropHints.slice(0, 2)
    : [secondaryDrop, tertiaryDrop];
  for (let i = 0; i < drops.length; i++) {
    const pt = drops[i]!;
    // Ensure walkability to drop point
    street = carveCorridor(street, { x: centerX, y: centerY }, pt, 'COBBLESTONE_FLOOR');
    street = setTileCell(street, pt.x, pt.y, (c) => ({
      ...c,
      terrainType: 'COBBLESTONE_FLOOR',
      blocksMovement: false,
      blocksSight: false,
    }));
    undercroft = carveCorridor(undercroft, { x: centerX, y: centerY }, pt, 'IRON_GRATE');

    const streetPortalId = EntityIdSchema.parse(`portal_sewer_drop_${i + 1}`);
    const undercroftPortalId = EntityIdSchema.parse(`portal_undercroft_ascent_${i + 1}`);

    entities[streetPortalId] = {
      id: streetPortalId,
      name: `Sewer Drain Drop #${i + 1} (To Undercroft)`,
      visual: { glyph: '>', fgPrimary: '#5DADE2', fgSecondary: '#2E86C1', bgColor: '#0A0D0E', shaderFlags: ['PULSE_STEAM'] },
      position: { x: pt.x, y: pt.y, stratum: 'STREET' as StratumId, blocksMovement: false, blocksSight: false },
      portal: { target: { x: pt.x, y: pt.y, stratum: 'UNDERCROFT' as StratumId }, bidirectional: true, conductsGas: true, apCost: 100, portalLabel: `Descend Sewer Shaft #${i + 1}` },
      crossStratumShaft: {
        shaftType: 'SEWER_SIPHON',
        upperStratum: 'STREET',
        lowerStratum: 'UNDERCROFT',
        upperCoord: { x: pt.x, y: pt.y },
        lowerCoord: { x: pt.x, y: pt.y },
        operational: true,
        flowRateUnitsPerTick: 5,
      },
    };

    entities[undercroftPortalId] = {
      id: undercroftPortalId,
      name: `Sewer Drainage Siphon #${i + 1} (To Street)`,
      visual: { glyph: '<', fgPrimary: '#5DADE2', fgSecondary: '#2E86C1', bgColor: '#0A0D0E', shaderFlags: [] },
      position: { x: pt.x, y: pt.y, stratum: 'UNDERCROFT' as StratumId, blocksMovement: false, blocksSight: false },
      portal: { target: { x: pt.x, y: pt.y, stratum: 'STREET' as StratumId }, bidirectional: true, conductsGas: true, apCost: 100, portalLabel: `Climb Sewer Siphon #${i + 1}` },
      crossStratumShaft: {
        shaftType: 'SEWER_SIPHON',
        upperStratum: 'STREET',
        lowerStratum: 'UNDERCROFT',
        upperCoord: { x: pt.x, y: pt.y },
        lowerCoord: { x: pt.x, y: pt.y },
        operational: true,
        flowRateUnitsPerTick: 5,
      },
    };

    sewerDrops.push(pt);
  }
  barriersPlaced.push('SEWER_DROP');

  return { streetGrid: street, undercroftGrid: undercroft, entities, barriersPlaced, sewerDrops };
}

/** Verifies that all sewer drops and gates remain walkable from the central thoroughfare. */
export function verifyDistrictWalkability(
  grid: StratumGrid,
  center: Point2D,
  targets: readonly Point2D[],
): boolean {
  for (const t of targets) {
    if (!hasWalkablePath(grid, center, t)) {
      return false;
    }
  }
  return true;
}
