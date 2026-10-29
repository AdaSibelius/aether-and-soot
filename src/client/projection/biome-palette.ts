import { BiomeId, ShaderFlag, StratumId, TerrainType, VisualGlyphSpec } from '../../schemas/primitives.schema.js';

export interface BiomePalette {
  readonly id: BiomeId;
  readonly name: string;
  readonly floorPrimary: string;
  readonly floorSecondary: string;
  readonly floorBg: string;
  readonly wallPrimary: string;
  readonly wallSecondary: string;
  readonly wallBg: string;
  readonly accentPrimary: string;
  readonly accentSecondary: string;
  readonly defaultWallShader: ShaderFlag;
}

export const BIOME_PALETTES: Record<BiomeId, BiomePalette> = {
  LIMEHOUSE_DOCKS: {
    id: 'LIMEHOUSE_DOCKS', name: 'Limehouse Arterial Steam-Docks',
    floorPrimary: '#38A3A5', floorSecondary: '#22577A', floorBg: '#07161E',
    wallPrimary: '#5D6D7E', wallSecondary: '#2E86C1', wallBg: '#0E1C24',
    accentPrimary: '#57CC99', accentSecondary: '#80ED99', defaultWallShader: 'SOOT_OCCLUSION',
  },
  SPITALFIELDS_SMELTING_WORKS: {
    id: 'SPITALFIELDS_SMELTING_WORKS', name: 'Spitalfields Smelting Works & Foundry Row',
    floorPrimary: '#7F8C8D', floorSecondary: '#34495E', floorBg: '#120E0A',
    wallPrimary: '#BA4A00', wallSecondary: '#E59866', wallBg: '#1E140B',
    accentPrimary: '#E67E22', accentSecondary: '#D35400', defaultWallShader: 'SOOT_OCCLUSION',
  },
  GILDED_SPIRE_ASSEMBLY: {
    id: 'GILDED_SPIRE_ASSEMBLY', name: 'Gilded Spire Assembly & Sky-Walks',
    floorPrimary: '#F4D03F', floorSecondary: '#B7950B', floorBg: '#181408',
    wallPrimary: '#F7DC6F', wallSecondary: '#D4AF37', wallBg: '#231B09',
    accentPrimary: '#F9E79F', accentSecondary: '#FCF3CF', defaultWallShader: 'SPARK_GLINT',
  },
  BLACKFRIARS_ROOKERIES: {
    id: 'BLACKFRIARS_ROOKERIES', name: 'Blackfriars Rookeries & Alleys',
    floorPrimary: '#566573', floorSecondary: '#2C3E50', floorBg: '#0B0D0F',
    wallPrimary: '#85929E', wallSecondary: '#34495E', wallBg: '#15191C',
    accentPrimary: '#BDC3C7', accentSecondary: '#7F8C8D', defaultWallShader: 'SOOT_OCCLUSION',
  },
  CHALK_VAULT_CATACOMBS: {
    id: 'CHALK_VAULT_CATACOMBS', name: 'Chalk-Vault Catacombs & Undercroft Reach',
    floorPrimary: '#BDC3C7', floorSecondary: '#7F8C8D', floorBg: '#090E11',
    wallPrimary: '#EAEDED', wallSecondary: '#A6ACAF', wallBg: '#121B20',
    accentPrimary: '#F2F4F4', accentSecondary: '#CCD1D1', defaultWallShader: 'SOOT_OCCLUSION',
  },
};

export function resolveDistrictBiome(districtId?: string, stratum?: StratumId): BiomeId {
  if (stratum === 'CATACOMBS') return 'CHALK_VAULT_CATACOMBS';
  const id = (districtId ?? '').toLowerCase();
  if (id.includes('limehouse') || id.includes('dock')) return 'LIMEHOUSE_DOCKS';
  if (id.includes('belgravia') || id.includes('spire')) return 'GILDED_SPIRE_ASSEMBLY';
  if (id.includes('blackfriars') || id.includes('whitechapel') || id.includes('rookeries')) return 'BLACKFRIARS_ROOKERIES';
  if (id.includes('catacomb') || id.includes('chalk') || id.includes('fleet')) return 'CHALK_VAULT_CATACOMBS';
  if (id.includes('spitalfields') || id.includes('soot') || id.includes('smelt')) return 'SPITALFIELDS_SMELTING_WORKS';
  if (stratum === 'SPIRE') return 'GILDED_SPIRE_ASSEMBLY';
  if (stratum === 'UNDERCROFT') return 'CHALK_VAULT_CATACOMBS';
  return 'SPITALFIELDS_SMELTING_WORKS';
}

function dimColor(color: string): string {
  // Simple darkening fallback for non-visible explored tiles
  if (color.startsWith('#') && color.length === 7) {
    const r = Math.max(10, Math.floor(parseInt(color.slice(1, 3), 16) * 0.45)).toString(16).padStart(2, '0');
    const g = Math.max(10, Math.floor(parseInt(color.slice(3, 5), 16) * 0.45)).toString(16).padStart(2, '0');
    const b = Math.max(10, Math.floor(parseInt(color.slice(5, 7), 16) * 0.45)).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  return '#2C3E50';
}

export function resolveBiomeTerrainVisual(
  terrainType: TerrainType,
  isVisible: boolean,
  isExplored: boolean,
  biomeId: BiomeId,
  connectingWallGlyph: string,
  steamPressureKpa = 0,
): VisualGlyphSpec {
  if (!isExplored) {
    return { glyph: ' ', fgPrimary: '#17202A', fgSecondary: '#050708', bgColor: '#050708', shaderFlags: [] };
  }

  const p = BIOME_PALETTES[biomeId];
  let glyph = '·';
  let fgPrimary = isVisible ? p.floorPrimary : '#2C3E50';
  let fgSecondary = isVisible ? p.floorSecondary : '#1C2833';
  let bgColor = isVisible ? p.floorBg : '#0A0D0E';
  let shaderFlags: ShaderFlag[] = [];

  switch (terrainType) {
    case 'SOOT_BRICK_WALL':
    case 'WALL_CROSS':
    case 'WALL_VERTICAL':
    case 'WALL_HORIZONTAL':
    case 'WALL_CORNER_NW':
    case 'WALL_CORNER_NE':
    case 'WALL_CORNER_SW':
    case 'WALL_CORNER_SE':
    case 'WALL_TEE_NORTH':
    case 'WALL_TEE_SOUTH':
    case 'WALL_TEE_EAST':
    case 'WALL_TEE_WEST':
      glyph = connectingWallGlyph;
      fgPrimary = isVisible ? p.wallPrimary : '#34495E';
      fgSecondary = isVisible ? p.wallSecondary : '#2C3E50';
      bgColor = isVisible ? p.wallBg : '#17202A';
      if (isVisible) shaderFlags = [p.defaultWallShader];
      break;
    case 'WROUGHT_IRON_FENCE':
      glyph = '▓';
      fgPrimary = isVisible ? '#7F8C8D' : '#34495E';
      fgSecondary = isVisible ? '#566573' : '#1C2833';
      bgColor = p.floorBg;
      break;
    case 'BRASS_STEAM_PIPE':
      glyph = '┼';
      fgPrimary = isVisible ? '#D4AF37' : '#7D6608';
      fgSecondary = isVisible ? '#B7950B' : '#4D3E04';
      bgColor = p.floorBg;
      if (isVisible) shaderFlags = ['SPARK_GLINT'];
      break;
    case 'GASLAMP_POST':
      glyph = '☼';
      fgPrimary = isVisible ? '#F9E79F' : '#7D6608';
      fgSecondary = isVisible ? '#F39C12' : '#B7950B';
      bgColor = p.floorBg;
      if (isVisible) shaderFlags = ['GASLIGHT_RADIANCE'];
      break;
    case 'TIMBER_PIER':
      glyph = '╤';
      fgPrimary = isVisible ? '#BA8B02' : '#5A4301';
      fgSecondary = isVisible ? '#8C6702' : '#382A01';
      bgColor = p.floorBg;
      break;
    case 'SLAG_MOUND':
      glyph = '▲';
      fgPrimary = isVisible ? '#E67E22' : '#6E370B';
      fgSecondary = isVisible ? '#A04000' : '#4E1F05';
      bgColor = p.floorBg;
      if (isVisible) shaderFlags = ['SOOT_OCCLUSION'];
      break;
    case 'CANAL_SLUICE':
      glyph = '╫';
      fgPrimary = isVisible ? '#5DADE2' : '#1B4F72';
      fgSecondary = isVisible ? '#2874A6' : '#112F45';
      bgColor = p.floorBg;
      if (isVisible && steamPressureKpa > 0) shaderFlags = ['PULSE_STEAM'];
      break;
    case 'GOTHIC_COLONNADE':
      glyph = 'Ω';
      fgPrimary = isVisible ? p.accentPrimary : dimColor(p.accentPrimary);
      fgSecondary = isVisible ? p.accentSecondary : dimColor(p.accentSecondary);
      bgColor = p.wallBg;
      if (isVisible) shaderFlags = [biomeId === 'GILDED_SPIRE_ASSEMBLY' ? 'GASLIGHT_RADIANCE' : 'SOOT_OCCLUSION'];
      break;
    case 'WOODEN_DOOR_CLOSED':
      glyph = '+';
      fgPrimary = isVisible ? '#E67E22' : '#7E5109';
      fgSecondary = '#BA4A00';
      bgColor = '#1C130C';
      break;
    case 'WOODEN_DOOR_OPEN':
      glyph = '/';
      fgPrimary = isVisible ? '#F39C12' : '#7D6608';
      fgSecondary = '#D35400';
      break;
    case 'DISTRICT_GATE':
      glyph = '╬';
      fgPrimary = isVisible ? '#F4D03F' : '#7D6608';
      fgSecondary = '#F39C12';
      bgColor = '#1A1105';
      if (isVisible) shaderFlags = ['SPARK_GLINT'];
      break;
    case 'GLASS_WINDOW':
      glyph = '⊞';
      fgPrimary = isVisible ? '#A9CCE3' : '#5D6D7E';
      fgSecondary = '#5499C7';
      if (isVisible) shaderFlags = ['SPARK_GLINT'];
      break;
    case 'SMASHED_WINDOW_FRAME':
      glyph = '%';
      fgPrimary = isVisible ? '#BDC3C7' : '#566573';
      fgSecondary = '#7F8C8D';
      break;
    case 'RUBBLE_PILE':
      glyph = ',';
      fgPrimary = isVisible ? '#7F8C8D' : '#34495E';
      fgSecondary = '#566573';
      break;
    case 'BRASS_CATWALK':
      glyph = '=';
      fgPrimary = isVisible ? '#D4AC0D' : '#5D4C06';
      fgSecondary = '#9A7D0A';
      break;
    case 'IRON_GRATE':
      glyph = '≡';
      fgPrimary = isVisible ? '#7F8C8D' : '#34495E';
      fgSecondary = '#566573';
      break;
    case 'ABYSS_DROP':
      glyph = ' ';
      bgColor = '#000000';
      break;
    default:
      glyph = '·';
      if (isVisible && steamPressureKpa > 0) shaderFlags = ['PULSE_STEAM', 'HEAT_SHIMMER'];
      break;
  }

  return { glyph, fgPrimary, fgSecondary, bgColor, shaderFlags };
}
