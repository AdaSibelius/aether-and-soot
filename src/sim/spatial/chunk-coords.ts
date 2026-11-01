import {
  BlueprintId,
  BlueprintIdSchema,
  ChunkKey,
  Point3D,
  StratumIdSchema,
} from '../../schemas/primitives.schema.js';
import {
  CHUNK_SIZE_X,
  CHUNK_SIZE_Y,
  ChunkCoordinate,
  ChunkCoordinateSchema,
  formatChunkKey,
} from '../../schemas/chunk-streaming.schema.js';

export { formatChunkKey };

export function worldPointToChunkCoord(
  districtId: BlueprintId,
  point: Point3D,
): ChunkCoordinate {
  const cx = Math.floor(point.x / CHUNK_SIZE_X);
  const cy = Math.floor(point.y / CHUNK_SIZE_Y);
  return ChunkCoordinateSchema.parse({
    districtId,
    stratum: point.stratum,
    cx,
    cy,
  });
}

export function parseChunkKey(key: ChunkKey): ChunkCoordinate {
  const parts = key.split(':');
  if (parts.length < 4 || parts[0] !== 'chunk') {
    throw new Error(`[parseChunkKey] Invalid ChunkKey format: '${key}'`);
  }
  const districtId = BlueprintIdSchema.parse(parts[1]!);
  const stratum = StratumIdSchema.parse(parts[2]);
  const [cxStr, cyStr] = (parts[3] ?? '').split(',');
  const cx = parseInt(cxStr ?? '0', 10);
  const cy = parseInt(cyStr ?? '0', 10);
  return ChunkCoordinateSchema.parse({ districtId, stratum, cx, cy });
}

export function getChunkBounds(coord: ChunkCoordinate): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const minX = coord.cx * CHUNK_SIZE_X;
  const minY = coord.cy * CHUNK_SIZE_Y;
  const maxX = minX + CHUNK_SIZE_X - 1;
  const maxY = minY + CHUNK_SIZE_Y - 1;
  return { minX, minY, maxX, maxY };
}

export function computeActiveChunkWindow(
  center: ChunkCoordinate,
  gridWidth: number,
  gridHeight: number,
  radiusChebyshev = 1,
): readonly ChunkCoordinate[] {
  const maxCx = Math.max(0, Math.floor((gridWidth - 1) / CHUNK_SIZE_X));
  const maxCy = Math.max(0, Math.floor((gridHeight - 1) / CHUNK_SIZE_Y));
  const coords: ChunkCoordinate[] = [];

  for (let dy = -radiusChebyshev; dy <= radiusChebyshev; dy++) {
    for (let dx = -radiusChebyshev; dx <= radiusChebyshev; dx++) {
      const cx = center.cx + dx;
      const cy = center.cy + dy;
      if (cx >= 0 && cx <= maxCx && cy >= 0 && cy <= maxCy) {
        coords.push(
          ChunkCoordinateSchema.parse({
            districtId: center.districtId,
            stratum: center.stratum,
            cx,
            cy,
          }),
        );
      }
    }
  }

  return coords;
}
