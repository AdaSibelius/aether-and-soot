import { CodexEntryRecord } from '../../schemas/safehouse-records.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { UiCellBuffer } from './cell-buffer.js';
import { VICTORIAN_PALETTE } from './material-palette.js';
import { UiRect } from './viewport-controls.js';

export type NaturalistTab = 'ALL' | 'AUTOMATON' | 'SCHEMATIC' | 'REACTION';

export interface NaturalistLedgerOptions {
  readonly selectedEntryId?: string;
  readonly selectedCategory?: NaturalistTab;
  readonly scrollOffset?: number;
}

const DEFAULT_NATURALIST_ENTRIES: readonly CodexEntryRecord[] = [
  {
    id: 'codex_clockwork_automaton',
    category: 'AUTOMATON',
    title: 'Dissected Clockwork Automaton',
    description: 'Specimen recovered from Spitalfields foundry. The cranial dome houses an intricate mainspring regulator connected via phosphor-bronze conduits to femoral pneumatic pistons.',
    discoveredTurn: 1,
    tags: ['MECHANICAL', 'STEAM'],
  },
  {
    id: 'codex_ocular_hound',
    category: 'AUTOMATON',
    title: 'Steam-Lathe Watch Hound',
    description: 'Canine quadrupeds augmented with brass ocular monocles and pneumatic jaw actuators. Highly sensitive to steam vent vibrations.',
    discoveredTurn: 12,
    tags: ['AUGMENT', 'SENTRY'],
  },
  {
    id: 'codex_aether_aeroponic',
    category: 'REACTION',
    title: 'Spire Conservatory Aether-Fern',
    description: 'Bioluminescent foliage cultured under pressurized blue gaslight lamps atop the Spire glasshouses. Leaves secrete distilled alchemical salts.',
    discoveredTurn: 25,
    tags: ['ALCHEMICAL', 'FLORA'],
  },
  {
    id: 'codex_boiler_core',
    category: 'SCHEMATIC',
    title: 'High-Pressure Boiler Schematic',
    description: 'Detailed blueprint for casting reinforced 50 kPa boiler cores with triple-riveted soot-iron plates and thermal bypass release valves.',
    discoveredTurn: 30,
    tags: ['STEAM', 'FOUNDRY'],
  },
];

const DISSECTION_SKETCH: readonly string[] = [
  '┌─[ANATOMY]─┐',
  '│  (o)─[⚙]  │',
  '│   ║   ║   │',
  '│  [#]═[#]  │',
  '└───────────┘',
];

const TABS: readonly NaturalistTab[] = ['ALL', 'AUTOMATON', 'SCHEMATIC', 'REACTION'];

function getTacticalData(entry: CodexEntryRecord): { vulnerability: string; armor: string; yield1: string; yield2: string } {
  const tags = entry.tags ?? [];
  if (tags.includes('MECHANICAL') || tags.includes('STEAM')) {
    return {
      vulnerability: 'Pneumatics',
      armor: 'Soot-Plate',
      yield1: '1x Brass Gears',
      yield2: '2x Rubber Gaskets',
    };
  }
  if (tags.includes('ALCHEMICAL') || tags.includes('FLORA')) {
    return {
      vulnerability: 'Flame / Heat',
      armor: 'Membrane',
      yield1: '2x Aether Salt',
      yield2: '1x Resin Phial',
    };
  }
  return {
    vulnerability: 'Blunt Force',
    armor: 'Cast Iron',
    yield1: '1x Iron Plate',
    yield2: '1x Steam Valve',
  };
}

export function renderNaturalistLedgerScreen(
  buf: UiCellBuffer,
  rect: UiRect,
  state: Readonly<WorldState>,
  options: NaturalistLedgerOptions = {},
): void {
  const { selectedEntryId, selectedCategory = 'ALL', scrollOffset = 0 } = options;
  const rawEntries = Object.values(state.codex ?? {}).length > 0
    ? Object.values(state.codex)
    : DEFAULT_NATURALIST_ENTRIES;

  const codexRecords = selectedCategory === 'ALL'
    ? rawEntries
    : rawEntries.filter((e) => e.category === selectedCategory);

  const isWidescreen = rect.width >= 70;
  const leftWidth = Math.floor((rect.width - 2) / 2);
  const spineX = rect.x + leftWidth;
  const rightX = spineX + 2;
  const rightWidth = rect.width - leftWidth - 2;

  const leftBg = VICTORIAN_PALETTE.SEPIA_PARCHMENT;
  const rightBg = '#1c1611';
  const inkFg = VICTORIAN_PALETTE.SEPIA_INK;

  // 1. Warm parchment & paper grain
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      const isRight = x >= rightX;
      const bg = isRight ? rightBg : leftBg;
      const isGrain = (x * 11 + y * 19) % 23 === 0;
      buf.setCell(x, y, isGrain ? '░' : ' ', isGrain ? '#382c21' : inkFg, bg);
    }
  }

  // 2. Center spine (⣿)
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    buf.setCell(spineX, y, '⣿', VICTORIAN_PALETTE.TARNISHED_BRASS, leftBg);
    buf.setCell(spineX + 1, y, '⣿', VICTORIAN_PALETTE.TARNISHED_BRASS, rightBg);
  }

  // 3. Left Page: Header & Specimen Roster
  buf.writeString(rect.x + 2, rect.y + 1, "THE NATURALIST'S LEDGER", VICTORIAN_PALETTE.AMBER_GASLIGHT, leftBg);

  if (isWidescreen) {
    let tabX = rect.x + 2;
    for (const cat of TABS) {
      const isCat = cat === selectedCategory;
      const label = `[${cat.slice(0, 4)}]`;
      buf.writeString(tabX, rect.y + 2, label, isCat ? VICTORIAN_PALETTE.AETHER_BLUE : '#594928', leftBg, undefined, `select_codex_tab:${cat}`);
      tabX += label.length + 1;
    }
  } else {
    buf.writeString(rect.x + 2, rect.y + 2, '─[ TAXONOMY INDEX ]────────────', '#594928', leftBg);
  }

  const maxLeftRows = Math.max(1, rect.height - 6);
  const activeEntry = (selectedEntryId ? codexRecords.find((e) => e.id === selectedEntryId) : undefined) ?? codexRecords[0] ?? DEFAULT_NATURALIST_ENTRIES[0]!;

  for (let idx = 0; idx < maxLeftRows; idx++) {
    const entryIdx = scrollOffset + idx;
    const entry = codexRecords[entryIdx];
    if (!entry) continue;

    const rowY = rect.y + 4 + idx;
    const isSelected = activeEntry.id === entry.id;
    const prefix = isSelected ? '► ' : '  ';
    const tag = `[${entry.category.slice(0, 4)}]`;
    const titleSnippet = entry.title.slice(0, Math.max(10, leftWidth - 12));
    const line = `${prefix}${tag} ${titleSnippet}`;
    const fg = isSelected ? VICTORIAN_PALETTE.TARNISHED_BRASS : inkFg;
    const bg = isSelected ? '#33271d' : leftBg;

    buf.writeString(rect.x + 2, rowY, line.slice(0, leftWidth - 3), fg, bg, undefined, `select_codex:${entry.id}`);
  }

  // 4. Right Page
  buf.writeString(rightX + 2, rect.y + 1, '─[ FIELD ANNOTATIONS ]─────────', '#594928', rightBg);

  if (isWidescreen) {
    buf.writeString(rightX + 2, rect.y + 2, activeEntry.title.slice(0, rightWidth - 4), VICTORIAN_PALETTE.AMBER_GASLIGHT, rightBg);

    // Sketch at rightX + 2 (rows 4 to 8)
    for (let sRow = 0; sRow < DISSECTION_SKETCH.length; sRow++) {
      buf.writeString(rightX + 2, rect.y + 4 + sRow, DISSECTION_SKETCH[sRow] ?? '', VICTORIAN_PALETTE.TARNISHED_BRASS, rightBg);
    }

    // Tactical Analysis beside sketch at rightX + 17 (rows 4 to 9)
    const tacticalData = getTacticalData(activeEntry);
    buf.writeString(rightX + 17, rect.y + 4, 'Tactical Analysis:', VICTORIAN_PALETTE.TARNISHED_BRASS, rightBg);
    buf.writeString(rightX + 17, rect.y + 5, `• Vuln: ${tacticalData.vulnerability}`.slice(0, rightWidth - 18), VICTORIAN_PALETTE.INCANDESCENT_RED, rightBg);
    buf.writeString(rightX + 17, rect.y + 6, `• Armor: ${tacticalData.armor}`.slice(0, rightWidth - 18), VICTORIAN_PALETTE.SEPIA_INK, rightBg);
    buf.writeString(rightX + 17, rect.y + 7, 'Harvest Yield:', VICTORIAN_PALETTE.TARNISHED_BRASS, rightBg);
    buf.writeString(rightX + 17, rect.y + 8, `• ${tacticalData.yield1}`.slice(0, rightWidth - 18), VICTORIAN_PALETTE.AETHER_BLUE, rightBg);
    buf.writeString(rightX + 17, rect.y + 9, `• ${tacticalData.yield2}`.slice(0, rightWidth - 18), VICTORIAN_PALETTE.AETHER_BLUE, rightBg);

    // Full-Width Field Notes (rows 11 to 16, ZERO OVERLAP)
    buf.writeString(rightX + 2, rect.y + 11, '─[ OBSERVER FIELD NOTES ]────────────', '#594928', rightBg);
    buf.writeWrappedText(
      { x: rightX + 2, y: rect.y + 12, width: rightWidth - 4, height: 4 },
      activeEntry.description,
      { fg: inkFg, bg: rightBg, jitterIndent: false },
    );

    // Morphological Traits
    buf.writeString(rightX + 2, rect.y + 17, '─[ MORPHOLOGICAL TRAITS ]────────────', '#594928', rightBg);
    buf.writeString(rightX + 2, rect.y + 18, `TAGS: ${activeEntry.tags?.join(' • ') ?? 'UNKNOWN'} | Turn ${activeEntry.discoveredTurn}`.slice(0, rightWidth - 4), VICTORIAN_PALETTE.TARNISHED_BRASS, rightBg);
  } else {
    // Compact Right Page
    buf.writeString(rightX + 2, rect.y + 3, activeEntry.title, VICTORIAN_PALETTE.AMBER_GASLIGHT, rightBg);
    const sketchWidth = 13;
    const sketchX = rightX + rightWidth - sketchWidth - 2;
    for (let sRow = 0; sRow < DISSECTION_SKETCH.length; sRow++) {
      buf.writeString(sketchX, rect.y + 4 + sRow, DISSECTION_SKETCH[sRow] ?? '', VICTORIAN_PALETTE.TARNISHED_BRASS, rightBg);
    }
    const notesWidth = Math.max(10, sketchX - (rightX + 2) - 1);
    buf.writeWrappedText(
      { x: rightX + 2, y: rect.y + 5, width: notesWidth, height: 5 },
      activeEntry.description,
      { fg: inkFg, bg: rightBg, jitterIndent: true },
    );
    buf.writeString(rightX + 2, rect.y + 11, '─[ MORPHOLOGICAL TRAITS ]──────', '#594928', rightBg);
    buf.writeString(rightX + 2, rect.y + 12, `TAGS: ${activeEntry.tags?.join(' • ') ?? 'UNKNOWN'}`, VICTORIAN_PALETTE.TARNISHED_BRASS, rightBg);
  }

  const footerY = rect.y + rect.height - 2;
  const footerText = isWidescreen ? '* Royal Society Naturalist Ledger *' : '* Royal Society *';
  buf.writeString(rightX + 2, footerY, footerText.slice(0, rightWidth - 4), '#7f6b55', rightBg);
}
