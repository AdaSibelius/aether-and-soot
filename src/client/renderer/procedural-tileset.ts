import { Rectangle, Texture } from 'pixi.js';

export const TILE_KEYS = {
  FLOOR_COBBLESTONE: 'tile_floor_cobblestone',
  FLOOR_FLAGSTONE: 'tile_floor_flagstone',
  FLOOR_WOOD_PLANK: 'tile_floor_wood_plank',
  FLOOR_IRON_GRATE: 'tile_floor_iron_grate',
  FLOOR_MUD_SOOT: 'tile_floor_mud_soot',
  FLOOR_SEWER_FLUME: 'tile_floor_sewer_flume',
  FLOOR_INSPECTION_WALKWAY: 'tile_floor_inspection_walkway',
  FLOOR_MINE_TRACKS: 'tile_floor_mine_tracks',
  FLOOR_ABYSS: 'tile_floor_abyss',
  WALL_BRICK: 'tile_wall_brick',
  WALL_RIVETED_IRON: 'tile_wall_riveted_iron',
  WALL_TIMBER_STRUT: 'tile_wall_timber_strut',
  WALL_CORRUGATED_TIN: 'tile_wall_corrugated_tin',
  WALL_WINDOW: 'tile_wall_window',
  DOOR_CLOSED: 'tile_door_closed',
  DOOR_OPEN: 'tile_door_open',
  FIXTURE_WORKBENCH: 'tile_fixture_workbench',
  FIXTURE_BOILER: 'tile_fixture_boiler',
  FIXTURE_COAL_STOVE: 'tile_fixture_coal_stove',
  FIXTURE_DESK: 'tile_fixture_desk',
  FIXTURE_GASLAMP: 'tile_fixture_gaslamp',
  FIXTURE_DISPATCH_TUBE: 'tile_fixture_dispatch_tube',
  FIXTURE_CABINET: 'tile_fixture_cabinet',
  FIXTURE_VALVE_MANIFOLD: 'tile_fixture_valve_manifold',
  FIXTURE_PORTAL_STAIRS: 'tile_fixture_portal_stairs',
  FIXTURE_PORTAL_MANHOLE: 'tile_fixture_portal_manhole',
  CONDUIT_STEAM_PIPE_H: 'tile_conduit_pipe_h',
  CONDUIT_STEAM_PIPE_V: 'tile_conduit_pipe_v',
  CONDUIT_STEAM_PIPE_CROSS: 'tile_conduit_pipe_cross',
  CONDUIT_BRASS_GEAR: 'tile_conduit_gear',
  ITEM_SCRAP: 'tile_item_scrap',
  ITEM_SATCHEL: 'tile_item_satchel',
  ITEM_PHIAL: 'tile_item_phial',
  ITEM_CRATE: 'tile_item_crate',
  ACTOR_PLAYER: 'tile_actor_player',
  ACTOR_AUTOMATON: 'tile_actor_automaton',
  ACTOR_HUMANOID: 'tile_actor_humanoid',
  ACTOR_CREATURE: 'tile_actor_creature',
  INDICATOR_CURSOR: 'tile_indicator_cursor',
} as const;

export type ProceduralTileKey = (typeof TILE_KEYS)[keyof typeof TILE_KEYS];
export const TILE_KEY_LIST: readonly string[] = Object.values(TILE_KEYS);
export const TILE_KEY_SET: ReadonlySet<string> = new Set(TILE_KEY_LIST);

export interface ProceduralTileset {
  readonly cellWidth: number;
  readonly cellHeight: number;
  readonly baseTexture: Texture;
  getTexture(tileKey: string): Texture;
  hasTile(tileKey: string): boolean;
}

const ATLAS_COLUMNS = 8;

function createMockProceduralTileset(cellWidth: number, cellHeight: number): ProceduralTileset {
  return {
    cellWidth, cellHeight, baseTexture: Texture.WHITE,
    getTexture: () => Texture.WHITE,
    hasTile: (key: string) => TILE_KEY_SET.has(key),
  };
}

function renderTileVector(ctx: CanvasRenderingContext2D, key: string, x: number, y: number, w: number, h: number): void {
  ctx.save();
  ctx.fillStyle = '#181412';
  ctx.fillRect(x, y, w, h);
  if (key.startsWith('tile_floor_')) {
    ctx.fillStyle = key.includes('grate') ? '#2a333d' : key.includes('wood') ? '#3a2e22' : '#222831';
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.strokeStyle = '#3e4a59';
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  } else if (key.startsWith('tile_wall_')) {
    ctx.fillStyle = key.includes('iron') ? '#3a4450' : key.includes('strut') ? '#4a3828' : '#4d2a22';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#6e3c32';
    ctx.fillRect(x + 1, y + 2, w - 2, Math.floor(h / 3));
    ctx.fillRect(x + 1, y + Math.floor(h / 2), w - 2, Math.floor(h / 3));
  } else if (key.startsWith('tile_door_')) {
    ctx.fillStyle = '#5c4033';
    ctx.fillRect(x + 2, y + 1, w - 4, h - 2);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(x + w - 4, y + Math.floor(h / 2), 2, 2);
  } else if (key.startsWith('tile_fixture_')) {
    ctx.fillStyle = '#3a3530';
    ctx.fillRect(x + 1, y + 3, w - 2, h - 4);
    ctx.fillStyle = key.includes('boiler') ? '#b94b42' : key.includes('gaslamp') ? '#ffb733' : '#8f7a62';
    ctx.beginPath();
    ctx.arc(x + Math.floor(w / 2), y + Math.floor(h / 2), Math.min(w, h) / 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (key.startsWith('tile_conduit_')) {
    ctx.fillStyle = '#a67c52';
    if (key.includes('pipe_h') || key.includes('cross')) ctx.fillRect(x, y + Math.floor(h / 2) - 2, w, 4);
    if (key.includes('pipe_v') || key.includes('cross')) ctx.fillRect(x + Math.floor(w / 2) - 2, y, 4, h);
  } else if (key.startsWith('tile_item_')) {
    ctx.fillStyle = key.includes('phial') ? '#4dd4f5' : '#d4af37';
    ctx.fillRect(x + 3, y + Math.floor(h / 3), w - 6, Math.floor(h / 2));
  } else if (key.startsWith('tile_actor_')) {
    ctx.fillStyle = key.includes('player') ? '#ffd700' : key.includes('automaton') ? '#e67e22' : '#d4c2a5';
    ctx.beginPath();
    ctx.arc(x + Math.floor(w / 2), y + Math.floor(h / 3), Math.floor(w / 3), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x + 2, y + Math.floor(h / 2), w - 4, Math.floor(h / 2) - 1);
  } else if (key === 'tile_indicator_cursor') {
    ctx.strokeStyle = '#e5a93c';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }
  ctx.restore();
}

export function createProceduralTileset(cellWidth = 12, cellHeight = 20): ProceduralTileset {
  if (typeof document === 'undefined') {
    return createMockProceduralTileset(cellWidth, cellHeight);
  }
  const total = TILE_KEY_LIST.length;
  const rows = Math.ceil(total / ATLAS_COLUMNS);
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLUMNS * cellWidth;
  canvas.height = rows * cellHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return createMockProceduralTileset(cellWidth, cellHeight);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const textures = new Map<string, Texture>();
  const baseTexture = Texture.from(canvas);

  for (let i = 0; i < total; i++) {
    const key = TILE_KEY_LIST[i]!;
    const col = i % ATLAS_COLUMNS;
    const row = Math.floor(i / ATLAS_COLUMNS);
    const px = col * cellWidth;
    const py = row * cellHeight;
    renderTileVector(ctx, key, px, py, cellWidth, cellHeight);
    const frame = new Rectangle(px, py, cellWidth, cellHeight);
    textures.set(key, new Texture({ source: baseTexture.source, frame }));
  }

  const fallback = textures.get(TILE_KEYS.FLOOR_COBBLESTONE) ?? Texture.WHITE;
  return {
    cellWidth, cellHeight, baseTexture,
    getTexture: (key: string) => textures.get(key) ?? fallback,
    hasTile: (key: string) => textures.has(key),
  };
}
