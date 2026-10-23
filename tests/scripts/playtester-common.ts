export const DIR_VECTORS: Record<string, [number, number]> = {
  N: [0, -1],
  S: [0, 1],
  E: [1, 0],
  W: [-1, 0],
  NE: [1, -1],
  NW: [-1, -1],
  SE: [1, 1],
  SW: [-1, 1],
};

const CARDINAL_MAP: Record<string, string> = {
  NORTH: 'N',
  UP: 'N',
  SOUTH: 'S',
  DOWN: 'S',
  EAST: 'E',
  RIGHT: 'E',
  WEST: 'W',
  LEFT: 'W',
  NORTHEAST: 'NE',
  NORTHWEST: 'NW',
  SOUTHEAST: 'SE',
  SOUTHWEST: 'SW',
};

export function normalizeDirection(raw: string): string | undefined {
  const norm = raw.trim().toUpperCase().replace(/[^A-Z]/g, '');
  return DIR_VECTORS[norm] ? norm : CARDINAL_MAP[norm];
}
