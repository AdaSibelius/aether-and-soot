import { Rectangle, Texture } from 'pixi.js';
import { GlyphAtlas } from './glyph-atlas.js';

// Standard 256 Code Page 437 character table augmented with Victorian technical symbols
export const CP437_EXTENDED_GLYPHS: readonly string[] = Array.from(new Set([
  // CP437 0x00-0x1F graphical controls
  ' ', '☺', '☻', '♥', '♦', '♣', '♠', '•', '◘', '○', '◙', '♂', '♀', '♪', '♫', '☼',
  '►', '◄', '↕', '‼', '¶', '§', '▬', '↨', '↑', '↓', '→', '←', '∟', '↔', '▲', '▼',
  // ASCII 0x20-0x7E
  ...' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~',
  '⌂',
  // CP437 0x80-0x9F (Extended Latin & Cyrillic/Currency)
  'Ç', 'ü', 'é', 'â', 'ä', 'à', 'å', 'ç', 'ê', 'ë', 'è', 'ï', 'î', 'ì', 'Ä', 'Å',
  'É', 'æ', 'Æ', 'ô', 'ö', 'ò', 'û', 'ù', 'ÿ', 'Ö', 'Ü', '¢', '£', '¥', '₧', 'ƒ',
  // CP437 0xA0-0xBF (Diacritics & Blocks)
  'á', 'í', 'ó', 'ú', 'ñ', 'Ñ', 'ª', 'º', '¿', '⌐', '¬', '½', '¼', '¡', '«', '»',
  '░', '▒', '▓', '│', '┤', '╡', '╢', '╖', '╕', '╣', '║', '╗', '╝', '╜', '╛', '┐',
  // CP437 0xC0-0xDF (Box Drawing & Shading)
  '└', '┴', '┬', '├', '─', '┼', '╞', '╟', '╚', '╔', '╩', '╦', '╠', '═', '╬', '╧',
  '╨', '╤', '╥', '╙', '╘', '╒', '╓', '╫', '╪', '┘', '┌', '█', '▄', '▌', '▐', '▀',
  // CP437 0xE0-0xFF (Greek, Math & Misc)
  'α', 'ß', 'Γ', 'π', 'Σ', 'σ', 'µ', 'τ', 'Φ', 'Θ', 'Ω', 'δ', '∞', 'φ', 'ε', '∩',
  '≡', '±', '≥', '≤', '⌠', '⌡', '÷', '≈', '°', '∙', '·', '√', 'ⁿ', '²', '■', ' ',
  // Victorian Technical & Cartographic Symbology
  '⚙', '⌖', '◈', '◆', '◇', '□', '⚡', '⚠', '‡', '⣿', 'Ø', 'ø', '×', '✓', '✗', '…',
  '╭', '╮', '╰', '╯', '╱', '╲', '—', '–', '★', '☆', '●', '◎',
]));

const ATLAS_COLUMNS = 16;
const MOCK_GLYPH_SET = new Set(CP437_EXTENDED_GLYPHS);

function createMockExtendedGlyphAtlas(cellWidth: number, cellHeight: number): GlyphAtlas {
  return {
    cellWidth,
    cellHeight,
    baseTexture: Texture.WHITE,
    getTexture: () => Texture.WHITE,
    hasGlyph: (glyph: string) => MOCK_GLYPH_SET.has(glyph),
  };
}

/**
 * Creates an extended 256-glyph CP437 raster texture atlas with sub-pixel alignment,
 * supporting Victorian technical apparatus glyphs, piping borders, and mathematical symbols.
 */
export function createExtendedGlyphAtlas(
  cellWidth: number,
  cellHeight: number,
  fontFamily = '"JetBrains Mono", "Fira Code", "IBM Plex Mono", "Courier New", monospace',
): GlyphAtlas {
  if (typeof document === 'undefined') {
    return createMockExtendedGlyphAtlas(cellWidth, cellHeight);
  }

  const glyphMap = new Map<string, Texture>();
  const totalGlyphs = CP437_EXTENDED_GLYPHS.length;
  const rows = Math.ceil(totalGlyphs / ATLAS_COLUMNS);
  const atlasWidth = ATLAS_COLUMNS * cellWidth;
  const atlasHeight = rows * cellHeight;

  const canvas = document.createElement('canvas');
  canvas.width = atlasWidth;
  canvas.height = atlasHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return createMockExtendedGlyphAtlas(cellWidth, cellHeight);
  }

  ctx.clearRect(0, 0, atlasWidth, atlasHeight);
  ctx.font = `bold ${Math.floor(cellHeight * 0.72)}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';

  // Sub-pixel aligned font rasterization
  for (let i = 0; i < totalGlyphs; i++) {
    const glyph = CP437_EXTENDED_GLYPHS[i]!;
    const col = i % ATLAS_COLUMNS;
    const row = Math.floor(i / ATLAS_COLUMNS);
    const cx = Math.floor(col * cellWidth + cellWidth / 2);
    const cy = Math.floor(row * cellHeight + cellHeight / 2);
    ctx.fillText(glyph, cx, cy);
  }

  const baseTexture = Texture.from(canvas);

  for (let i = 0; i < totalGlyphs; i++) {
    const glyph = CP437_EXTENDED_GLYPHS[i]!;
    const col = i % ATLAS_COLUMNS;
    const row = Math.floor(i / ATLAS_COLUMNS);
    const frame = new Rectangle(col * cellWidth, row * cellHeight, cellWidth, cellHeight);
    const glyphTexture = new Texture({
      source: baseTexture.source,
      frame,
    });
    glyphMap.set(glyph, glyphTexture);
  }

  const fallbackTexture = glyphMap.get('?') ?? Texture.WHITE;

  return {
    cellWidth,
    cellHeight,
    baseTexture,
    getTexture(glyph: string): Texture {
      return glyphMap.get(glyph) ?? fallbackTexture;
    },
    hasGlyph(glyph: string): boolean {
      return glyphMap.has(glyph);
    },
  };
}
