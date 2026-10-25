import { CodexCategory } from '../../schemas/safehouse-events.schema.js';
import { CodexEntryRecord } from '../../schemas/safehouse-records.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { UiCellBuffer } from './cell-buffer.js';
import { VICTORIAN_PALETTE } from './material-palette.js';
import { UiRect } from './viewport-controls.js';

export interface NaturalistLedgerOptions {
  readonly selectedEntryId?: string;
  readonly scrollOffset?: number;
}

const DEFAULT_NATURALIST_ENTRIES: readonly CodexEntryRecord[] = [
  {
    id: 'codex_clockwork_automaton',
    category: 'BEASTS' as CodexCategory,
    title: 'Dissected Clockwork Automaton',
    description: 'Specimen recovered from Spitalfields foundry. The cranial dome houses an intricate mainspring regulator connected via phosphor-bronze conduits to femoral pneumatic pistons.',
    discoveredTurn: 1,
    tags: ['MECHANICAL', 'STEAM'],
  },
  {
    id: 'codex_ocular_hound',
    category: 'BEASTS' as CodexCategory,
    title: 'Steam-Lathe Watch Hound',
    description: 'Canine quadrupeds augmented with brass ocular monocles and pneumatic jaw actuators. Highly sensitive to steam vent vibrations.',
    discoveredTurn: 12,
    tags: ['AUGMENT', 'SENTRY'],
  },
  {
    id: 'codex_aether_aeroponic',
    category: 'FLORA' as CodexCategory,
    title: 'Spire Conservatory Aether-Fern',
    description: 'Bioluminescent foliage cultured under pressurized blue gaslight lamps atop the Spire glasshouses. Leaves secrete distilled alchemical salts.',
    discoveredTurn: 25,
    tags: ['ALCHEMICAL', 'FLORA'],
  },
];

const DISSECTION_SKETCH: readonly string[] = [
  '┌─[ANATOMY]─┐',
  '│  (o)─[⚙]  │',
  '│   ║   ║   │',
  '│  [#]═[#]  │',
  '└───────────┘',
];

export function renderNaturalistLedgerScreen(
  buf: UiCellBuffer,
  rect: UiRect,
  state: Readonly<WorldState>,
  options: NaturalistLedgerOptions = {},
): void {
  const { selectedEntryId, scrollOffset = 0 } = options;
  const codexRecords = Object.values(state.codex ?? {}).length > 0
    ? Object.values(state.codex)
    : DEFAULT_NATURALIST_ENTRIES;

  const leftWidth = Math.floor((rect.width - 2) / 2);
  const spineX = rect.x + leftWidth;
  const rightX = spineX + 2;
  const rightWidth = rect.width - leftWidth - 2;

  const leftBg = VICTORIAN_PALETTE.SEPIA_PARCHMENT;
  const rightBg = '#1e1813'; // Subtle contrasting page tone for depth
  const inkFg = VICTORIAN_PALETTE.SEPIA_INK;

  // 1. Fill physical ledger pages with warm sepia parchment & paper grain
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      const isRight = x >= rightX;
      const bg = isRight ? rightBg : leftBg;
      // Dithered paper grain (░, ▒) on subtle grain coordinates
      const isGrain = (x * 11 + y * 19) % 23 === 0;
      buf.setCell(x, y, isGrain ? '░' : ' ', isGrain ? '#382c21' : inkFg, bg);
    }
  }

  // 2. Heavy center binding spine (⣿)
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    buf.setCell(spineX, y, '⣿', VICTORIAN_PALETTE.TARNISHED_BRASS, leftBg);
    buf.setCell(spineX + 1, y, '⣿', VICTORIAN_PALETTE.TARNISHED_BRASS, rightBg);
  }

  // 3. Left Page: Taxonomy & Discovered Fauna Roster
  buf.writeString(rect.x + 2, rect.y + 1, 'THE NATURALIST\'S LEDGER', VICTORIAN_PALETTE.AMBER_GASLIGHT, leftBg);
  buf.writeString(rect.x + 2, rect.y + 2, '─[ TAXONOMY INDEX ]────────────', '#594928', leftBg);

  const maxLeftRows = Math.max(1, rect.height - 5);
  for (let idx = 0; idx < maxLeftRows; idx++) {
    const entryIdx = scrollOffset + idx;
    const entry = codexRecords[entryIdx];
    if (!entry) continue;

    const rowY = rect.y + 4 + idx;
    const isSelected = selectedEntryId === entry.id || (!selectedEntryId && idx === 0);
    const prefix = isSelected ? '► ' : '  ';
    const tag = `[${entry.category.slice(0, 4)}]`;
    const line = `${prefix}${tag} ${entry.title}`;
    const fg = isSelected ? VICTORIAN_PALETTE.TARNISHED_BRASS : inkFg;
    const hitKey = `select_codex:${entry.id}`;

    buf.writeString(rect.x + 2, rowY, line.slice(0, leftWidth - 3), fg, leftBg, undefined, hitKey);
  }

  // 4. Right Page: Field Notes & Dissection Sketch
  const activeEntry = (selectedEntryId ? codexRecords.find((e) => e.id === selectedEntryId) : undefined) ?? codexRecords[0]!;

  buf.writeString(rightX + 2, rect.y + 1, '─[ FIELD ANNOTATIONS ]─────────', '#594928', rightBg);
  buf.writeString(rightX + 2, rect.y + 3, activeEntry.title, VICTORIAN_PALETTE.AMBER_GASLIGHT, rightBg);

  // Stamp asymmetric CP437 dissection sketch in top-right of page
  const sketchWidth = 13;
  const sketchX = rightX + rightWidth - sketchWidth - 2;
  const sketchY = rect.y + 4;

  for (let sRow = 0; sRow < DISSECTION_SKETCH.length; sRow++) {
    const sLine = DISSECTION_SKETCH[sRow] ?? '';
    buf.writeString(sketchX, sketchY + sRow, sLine, VICTORIAN_PALETTE.TARNISHED_BRASS, rightBg);
  }

  // Wrap field notes around sketch bounding box
  const notesWidth = Math.max(10, sketchX - (rightX + 2) - 1);
  buf.writeWrappedText(
    { x: rightX + 2, y: rect.y + 5, width: notesWidth, height: 6 },
    activeEntry.description,
    { fg: inkFg, bg: rightBg, jitterIndent: true },
  );

  // Lower field notes section below sketch
  buf.writeString(rightX + 2, rect.y + 11, '─[ MORPHOLOGICAL TRAITS ]──────', '#594928', rightBg);
  const tagSummary = `SPECIMEN TAGS: ${activeEntry.tags?.join(' • ') ?? 'UNKNOWN'}`;
  buf.writeString(rightX + 2, rect.y + 12, tagSummary, VICTORIAN_PALETTE.TARNISHED_BRASS, rightBg);

  // Handwritten letterpress attribution footer
  const footerY = rect.y + rect.height - 2;
  buf.writeString(rightX + 2, footerY, '* Recorded by Fellow of the Royal Society *', '#7f6b55', rightBg);
}
