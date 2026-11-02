import { EntityRecord } from '../../schemas/components.schema.js';
import { ShaderFlag, TerrainType, VisualGlyphSpec } from '../../schemas/primitives.schema.js';

export interface GlyphLayerVisual {
  readonly glyph: string;
  readonly fgPrimary: string;
  readonly fgSecondary?: string | undefined;
  readonly bgColor?: string | undefined;
  readonly alpha?: number | undefined;
  readonly shaderFlags?: readonly ShaderFlag[] | undefined;
  readonly tileKey?: string | undefined;
}

export interface RenderCellLayers {
  readonly floor: GlyphLayerVisual;
  readonly fixture?: GlyphLayerVisual | undefined;
  readonly item?: GlyphLayerVisual | undefined;
  readonly actor?: GlyphLayerVisual | undefined;
  readonly indicator?: GlyphLayerVisual | undefined;
}

export type EntityVisualLayer = 'actor' | 'item' | 'fixture';

export function classifyEntityLayer(entity: EntityRecord): EntityVisualLayer {
  if (entity.actor) return 'actor';
  if (entity.item || entity.prostheticSpec) return 'item';
  return 'fixture';
}

export function isFixtureTerrain(terrain: TerrainType): boolean {
  switch (terrain) {
    case 'WOODEN_DOOR_CLOSED':
    case 'WOODEN_DOOR_OPEN':
    case 'GLASS_WINDOW':
    case 'SMASHED_WINDOW_FRAME':
    case 'DISTRICT_GATE':
    case 'BRASS_STEAM_PIPE':
    case 'GASLAMP_POST':
    case 'COUNTER_BARRIER':
    case 'CANAL_SLUICE':
      return true;
    default:
      return false;
  }
}

export function composeLayersToVisualSpec(layers: RenderCellLayers): VisualGlyphSpec {
  const topVisual = layers.indicator ?? layers.actor ?? layers.item ?? layers.fixture ?? layers.floor;
  return {
    glyph: topVisual.glyph,
    fgPrimary: topVisual.fgPrimary,
    fgSecondary: topVisual.fgSecondary ?? topVisual.fgPrimary,
    bgColor: layers.floor.bgColor ?? '#0A0D0E',
    shaderFlags: topVisual.shaderFlags ? [...topVisual.shaderFlags] : [],
  };
}

const TERRAIN_TILE_MAP: Partial<Record<TerrainType, string>> = {
  COBBLESTONE_FLOOR: 'tile_floor_cobblestone', BOARDING_PLATFORM: 'tile_floor_flagstone',
  TIMBER_PIER: 'tile_floor_wood_plank', IRON_GRATE: 'tile_floor_iron_grate',
  BRASS_CATWALK: 'tile_floor_iron_grate', RUBBLE_PILE: 'tile_floor_mud_soot',
  SLAG_MOUND: 'tile_floor_mud_soot', CANAL_SLUICE: 'tile_floor_sewer_flume',
  RAIL_TRACK: 'tile_floor_mine_tracks', CONVEYOR_TRACK: 'tile_floor_mine_tracks',
  ABYSS_DROP: 'tile_floor_abyss', SOOT_BRICK_WALL: 'tile_wall_brick',
  TIMBER_STRUT: 'tile_wall_timber_strut', WOODEN_DOOR_CLOSED: 'tile_door_closed',
  WOODEN_DOOR_OPEN: 'tile_door_open', GLASS_WINDOW: 'tile_wall_window',
  SMASHED_WINDOW_FRAME: 'tile_wall_window', DISTRICT_GATE: 'tile_wall_riveted_iron',
  BRASS_STEAM_PIPE: 'tile_conduit_pipe_h', GASLAMP_POST: 'tile_fixture_gaslamp',
  COUNTER_BARRIER: 'tile_fixture_workbench',
};

export function resolveTerrainTileKey(terrain: TerrainType): string | undefined {
  return TERRAIN_TILE_MAP[terrain];
}

export function buildOutOfBoundsLayers(oobVisual: VisualGlyphSpec): RenderCellLayers {
  return {
    floor: {
      glyph: oobVisual.glyph,
      fgPrimary: oobVisual.fgPrimary,
      fgSecondary: oobVisual.fgSecondary,
      bgColor: oobVisual.bgColor,
      shaderFlags: oobVisual.shaderFlags,
    },
  };
}

export function buildCellLayers(
  cellVisual: VisualGlyphSpec,
  terrainType: TerrainType | undefined,
  baseFloorSpec?: VisualGlyphSpec,
): RenderCellLayers {
  if (terrainType && isFixtureTerrain(terrainType)) {
    const floor = baseFloorSpec ?? {
      glyph: '·', fgPrimary: '#6A7D8F', fgSecondary: '#526373', bgColor: cellVisual.bgColor, shaderFlags: [],
    };
    return {
      floor: {
        glyph: floor.glyph, fgPrimary: floor.fgPrimary, fgSecondary: floor.fgSecondary,
        bgColor: cellVisual.bgColor, shaderFlags: floor.shaderFlags,
        tileKey: resolveTerrainTileKey('COBBLESTONE_FLOOR'),
      },
      fixture: {
        glyph: cellVisual.glyph, fgPrimary: cellVisual.fgPrimary, fgSecondary: cellVisual.fgSecondary,
        shaderFlags: cellVisual.shaderFlags, tileKey: resolveTerrainTileKey(terrainType),
      },
    };
  }
  return {
    floor: {
      glyph: cellVisual.glyph, fgPrimary: cellVisual.fgPrimary, fgSecondary: cellVisual.fgSecondary,
      bgColor: cellVisual.bgColor, shaderFlags: cellVisual.shaderFlags,
      tileKey: terrainType ? resolveTerrainTileKey(terrainType) : undefined,
    },
  };
}

export function buildEntityLayerVisual(
  entity: EntityRecord,
  gaslitVisual: VisualGlyphSpec,
  bgColor: string,
): GlyphLayerVisual {
  return {
    glyph: gaslitVisual.glyph,
    fgPrimary: gaslitVisual.fgPrimary,
    fgSecondary: gaslitVisual.fgSecondary,
    bgColor,
    shaderFlags: gaslitVisual.shaderFlags,
    tileKey: entity.actor ? 'tile_actor_player' : entity.item ? 'tile_item_scrap' : undefined,
  };
}

