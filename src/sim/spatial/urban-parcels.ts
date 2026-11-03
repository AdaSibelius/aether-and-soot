import { Point2D } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { Box } from './block-geometry.js';

export interface UrbanGridSpec {
  readonly width: number;
  readonly height: number;
  readonly center?: Point2D;
  readonly avenueWidth?: number;          // Default: 3
  readonly crossStreetWidth?: number;     // Default: 2
  readonly alleyWidth?: number;           // Default: 1
  readonly minParcelWidth?: number;       // Default: 11
  readonly minParcelHeight?: number;      // Default: 10
  readonly plazaSize?: { width: number; height: number }; // Default: { width: 7, height: 7 }
  readonly crossStreetSpacing?: number;   // Default: 16 (chunk size X)
}

export interface UrbanParcel {
  readonly id: string;
  readonly bounds: Box;
  readonly frontDirection: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';
  readonly templateId?: string;
  readonly streetAccess: 'AVENUE' | 'CROSS_STREET' | 'PLAZA';
  readonly serviceAlleyBounds?: Box;
}

export interface ProceduralParcelResult {
  readonly spec: UrbanGridSpec;
  readonly center: Point2D;
  readonly avenueCorridor: Box;
  readonly crossStreetCorridors: readonly Box[];
  readonly serviceAlleys: readonly Box[];
  readonly plaza: Box;
  readonly blocks: readonly Box[];
  readonly parcels: readonly UrbanParcel[];
  readonly streetCorridors: readonly Box[];
}

/**
 * Parametric multi-block parcel subdivider that partitions arbitrary district dimensions
 * into structured urban super-blocks, building parcels, and street corridors.
 */
export function subdivideProceduralParcels(
  spec: UrbanGridSpec,
  rng: SeededRNG,
): ProceduralParcelResult {
  const { width, height } = spec;
  const cx = spec.center?.x ?? Math.floor(width / 2);
  const cy = spec.center?.y ?? Math.floor(height / 2);
  const center: Point2D = { x: cx, y: cy };

  const aw = spec.avenueWidth ?? 3;
  const halfAw = Math.floor(aw / 2);
  const avenueCorridor: Box = {
    x1: 0,
    y1: cy - halfAw,
    x2: width - 1,
    y2: cy - halfAw + aw - 1,
  };

  const pw = spec.plazaSize?.width ?? 7;
  const ph = spec.plazaSize?.height ?? 7;
  const halfPw = Math.floor(pw / 2);
  const halfPh = Math.floor(ph / 2);
  const plaza: Box = {
    x1: cx - halfPw,
    y1: cy - halfPh,
    x2: cx - halfPw + pw - 1,
    y2: cy - halfPh + ph - 1,
  };

  const csw = spec.crossStreetWidth ?? 2;
  const spacing = spec.crossStreetSpacing ?? 16;
  const crossStreetCorridors: Box[] = [];

  for (let sx = spacing - 1; sx < width - Math.floor(spacing / 2); sx += spacing) {
    const ex = Math.min(width - 2, sx + csw - 1);
    crossStreetCorridors.push({ x1: sx, y1: 0, x2: ex, y2: height - 1 });
  }

  const alleyW = spec.alleyWidth ?? 1;
  const northAlley: Box = { x1: 2, y1: 2, x2: width - 3, y2: 2 + alleyW - 1 };
  const southAlley: Box = {
    x1: 2,
    y1: height - 3 - alleyW + 1,
    x2: width - 3,
    y2: height - 3,
  };
  const serviceAlleys: readonly Box[] = [northAlley, southAlley];

  const colStarts: number[] = [2];
  const colEnds: number[] = [];
  for (const cs of crossStreetCorridors) {
    colEnds.push(cs.x1 - 1);
    colStarts.push(cs.x2 + 1);
  }
  colEnds.push(width - 3);

  const minPw = spec.minParcelWidth ?? 11;
  const minPh = spec.minParcelHeight ?? 10;
  const blocks: Box[] = [];
  const parcels: UrbanParcel[] = [];

  for (let col = 0; col < colStarts.length; col++) {
    const x1 = colStarts[col]!;
    const x2 = colEnds[col]!;
    const colWidth = x2 - x1 + 1;
    if (colWidth < minPw) continue;

    const overlapsPlaza = x1 <= plaza.x2 && x2 >= plaza.x1;
    const streetAccess: UrbanParcel['streetAccess'] = overlapsPlaza ? 'PLAZA' : 'AVENUE';

    // North Block
    const northY1 = northAlley.y2 + 1;
    const northY2 = overlapsPlaza ? Math.min(avenueCorridor.y1 - 1, plaza.y1 - 1) : avenueCorridor.y1 - 1;
    if (northY2 - northY1 + 1 >= minPh) {
      const northBlock: Box = { x1, y1: northY1, x2, y2: northY2 };
      blocks.push(northBlock);

      if (colWidth >= 2 * minPw + 2) {
        const midX = Math.floor((x1 + x2) / 2);
        parcels.push(
          { id: `parcel_n_${col}_w`, bounds: { x1, y1: northY1, x2: midX - 1, y2: northY2 }, frontDirection: 'SOUTH', streetAccess, serviceAlleyBounds: northAlley },
          { id: `parcel_n_${col}_e`, bounds: { x1: midX + 1, y1: northY1, x2, y2: northY2 }, frontDirection: 'SOUTH', streetAccess, serviceAlleyBounds: northAlley },
        );
      } else {
        parcels.push({ id: `parcel_n_${col}`, bounds: northBlock, frontDirection: 'SOUTH', streetAccess, serviceAlleyBounds: northAlley });
      }
    }

    // South Block
    const southY1 = overlapsPlaza ? Math.max(avenueCorridor.y2 + 1, plaza.y2 + 1) : avenueCorridor.y2 + 1;
    const southY2 = southAlley.y1 - 1;
    if (southY2 - southY1 + 1 >= minPh) {
      const southBlock: Box = { x1, y1: southY1, x2, y2: southY2 };
      blocks.push(southBlock);

      if (colWidth >= 2 * minPw + 2) {
        const midX = Math.floor((x1 + x2) / 2);
        parcels.push(
          { id: `parcel_s_${col}_w`, bounds: { x1, y1: southY1, x2: midX - 1, y2: southY2 }, frontDirection: 'NORTH', streetAccess, serviceAlleyBounds: southAlley },
          { id: `parcel_s_${col}_e`, bounds: { x1: midX + 1, y1: southY1, x2, y2: southY2 }, frontDirection: 'NORTH', streetAccess, serviceAlleyBounds: southAlley },
        );
      } else {
        parcels.push({ id: `parcel_s_${col}`, bounds: southBlock, frontDirection: 'NORTH', streetAccess, serviceAlleyBounds: southAlley });
      }
    }
  }

  // Shuffle parcel ordering deterministically with rng if needed, preserving stability
  void rng;

  const streetCorridors: readonly Box[] = [
    avenueCorridor,
    ...crossStreetCorridors,
    plaza,
  ];

  return {
    spec,
    center,
    avenueCorridor,
    crossStreetCorridors,
    serviceAlleys,
    plaza,
    blocks,
    parcels,
    streetCorridors,
  };
}
