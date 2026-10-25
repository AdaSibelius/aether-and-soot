import { Rectangle, Texture } from 'pixi.js';

export const ATLAS_GLYPHS: readonly string[] = Array.from(new Set([
  ...' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~',
  '█', '▀', '▄', '▌', '▐', '░', '▒', '▓',
  '═', '║', '╔', '╗', '╚', '╝', '╠', '╣', '╬', '╦', '╩',
  '─', '│', '┌', '┐', '└', '┘', '├', '┤', '┼', '┬', '┴',
  '▲', '▼', '◄', '►', '⣿', '☼', '⚙', 'Ø', 'ø', '·', '•',
  '×', '✓', '✗', '§', '¶', '°', '±', '≈', '≠', '≡', '≤', '≥',
  '…', '←', '→', '↑', '↓', 'Ω', '♦', '▬', '■', '□', '◆', '◇', '⚡', '⚠', '‡',
]));

export interface GlyphAtlas {
  readonly cellWidth: number;
  readonly cellHeight: number;
  readonly baseTexture: Texture;
  getTexture(glyph: string): Texture;
  hasGlyph(glyph: string): boolean;
}

const ATLAS_COLUMNS = 16;
const MOCK_GLYPH_SET = new Set(ATLAS_GLYPHS);

function createMockGlyphAtlas(cellWidth: number, cellHeight: number): GlyphAtlas {
  return {
    cellWidth,
    cellHeight,
    baseTexture: Texture.WHITE,
    getTexture: () => Texture.WHITE,
    hasGlyph: (glyph: string) => MOCK_GLYPH_SET.has(glyph),
  };
}

export function createGlyphAtlas(
  cellWidth: number,
  cellHeight: number,
  fontFamily = '"JetBrains Mono", "Fira Code", "Courier New", monospace',
): GlyphAtlas {
  if (typeof document === 'undefined') {
    return createMockGlyphAtlas(cellWidth, cellHeight);
  }

  const glyphMap = new Map<string, Texture>();
  const totalGlyphs = ATLAS_GLYPHS.length;
  const rows = Math.ceil(totalGlyphs / ATLAS_COLUMNS);
  const atlasWidth = ATLAS_COLUMNS * cellWidth;
  const atlasHeight = rows * cellHeight;

  const canvas = document.createElement('canvas');
  canvas.width = atlasWidth;
  canvas.height = atlasHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return createMockGlyphAtlas(cellWidth, cellHeight);
  }

  ctx.clearRect(0, 0, atlasWidth, atlasHeight);
  ctx.font = `bold ${Math.floor(cellHeight * 0.75)}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';

  for (let i = 0; i < totalGlyphs; i++) {
    const glyph = ATLAS_GLYPHS[i]!;
    const col = i % ATLAS_COLUMNS;
    const row = Math.floor(i / ATLAS_COLUMNS);
    const cx = col * cellWidth + cellWidth / 2;
    const cy = row * cellHeight + cellHeight / 2;
    ctx.fillText(glyph, cx, cy);
  }

  const baseTexture = Texture.from(canvas);

  for (let i = 0; i < totalGlyphs; i++) {
    const glyph = ATLAS_GLYPHS[i]!;
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
