import { EntityRecord } from '../../schemas/components.schema.js';
import { BlueprintIdSchema, EntityIdSchema, Point2D } from '../../schemas/primitives.schema.js';
import { METROPOLIS_DISTRICT_DOSSIERS } from './overworld-matrix.js';

export type CompassDir = 'north' | 'south' | 'east' | 'west';

export interface CompassAdjacency {
  readonly west: string;
  readonly east: string;
  readonly north?: string;
  readonly south?: string;
}

export const COMPASS_OPPOSITE: Readonly<Record<CompassDir, CompassDir>> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
};

/** Legacy 1D ring, retained only as a fallback where the 2D overworld matrix has no planar neighbor. */
const RING_FALLBACK: Readonly<Record<string, { west: string; east: string }>> = {
  district_spitalfields_soot_works: { west: 'district_fleet_ditch_undercroft', east: 'district_belgravia_brass_spires' },
  district_fleet_ditch_undercroft: { west: 'district_whitechapel_ward', east: 'district_spitalfields_soot_works' },
  district_whitechapel_ward: { west: 'district_fleet_ditch_undercroft', east: 'district_limehouse_docks' },
  district_limehouse_docks: { west: 'district_whitechapel_ward', east: 'district_belgravia_brass_spires' },
  district_belgravia_brass_spires: { west: 'district_limehouse_docks', east: 'district_spitalfields_soot_works' },
};
const DEFAULT_RING = { west: 'district_fleet_ditch_undercroft', east: 'district_belgravia_brass_spires' };

/** Looks up the district occupying the macro-grid cell offset by (dCol, dRow) in `overworld-matrix.ts`. */
function planarNeighbor(districtId: string, dCol: number, dRow: number): string | undefined {
  const here = METROPOLIS_DISTRICT_DOSSIERS[districtId]?.macroCoords;
  if (!here) return undefined;
  for (const [id, dossier] of Object.entries(METROPOLIS_DISTRICT_DOSSIERS)) {
    if (dossier.macroCoords.col === here.col + dCol && dossier.macroCoords.row === here.row + dRow) return id;
  }
  return undefined;
}

/**
 * Reconciles the overworld's 2D planar matrix with district gates. North/South gates exist only where a planar
 * neighbor exists; East/West always resolve (planar neighbor first, legacy ring as fallback) so every district keeps
 * its two street arteries.
 */
export function resolveCompassAdjacency(districtId: string): CompassAdjacency {
  const ring = RING_FALLBACK[districtId] ?? DEFAULT_RING;
  const north = planarNeighbor(districtId, 0, -1);
  const south = planarNeighbor(districtId, 0, 1);
  return {
    west: ring.west,
    east: ring.east,
    ...(north ? { north } : {}),
    ...(south ? { south } : {}),
  };
}

export const DISTRICT_ADJACENCY: Record<string, CompassAdjacency> = Object.fromEntries(
  Object.keys(RING_FALLBACK).map((id) => [id, resolveCompassAdjacency(id)]),
);

export function compassGatePositions(width: number, height: number, centerY: number): Record<CompassDir, Point2D> {
  const centerX = Math.floor(width / 2);
  return {
    west: { x: 1, y: centerY },
    east: { x: width - 2, y: centerY },
    north: { x: centerX, y: 1 },
    south: { x: centerX, y: height - 2 },
  };
}

/** Spawns a north/south transit gate entity (east/west gates are spawned by `spawnDistrictInfrastructure`). */
export function spawnCompassGate(
  entities: Record<string, EntityRecord>,
  dir: 'north' | 'south',
  pos: Point2D,
  targetDistrictId: string,
): void {
  const id = EntityIdSchema.parse(`gate_transit_${dir}`);
  const label = dir === 'north' ? 'North' : 'South';
  entities[id] = {
    id,
    name: `${label} Transit Gate (To ${targetDistrictId})`,
    visual: { glyph: '╬', fgPrimary: '#F4D03F', fgSecondary: '#D4AF37', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
    position: { x: pos.x, y: pos.y, stratum: 'STREET', blocksMovement: false, blocksSight: false },
    districtGate: {
      targetDistrictId: BlueprintIdSchema.parse(targetDistrictId),
      gateLabel: `Travel to ${targetDistrictId}`,
      apCost: 100,
    },
  };
}

/**
 * Picks the gate a traveler should arrive at: the gate on the opposite wall from the one they departed through
 * (leaving by the North gate arrives at the next district's South gate).
 */
export function findArrivalGate(
  entities: Record<string, EntityRecord>,
  departureGateId: string,
  fromDistrictId: string,
): EntityRecord | undefined {
  const dir = (['north', 'south', 'east', 'west'] as const).find((d) => departureGateId === `gate_transit_${d}`);
  const gates = Object.values(entities).filter(
    (e) => e.districtGate && e.position && e.districtGate.targetDistrictId === fromDistrictId,
  );
  if (dir) {
    const opposite = gates.find((g) => g.id === `gate_transit_${COMPASS_OPPOSITE[dir]}`);
    if (opposite) return opposite;
  }
  return gates[0];
}
