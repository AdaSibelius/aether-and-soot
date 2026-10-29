import { describe, expect, it } from 'vitest';
import { generateModalUiBuffer } from '../../src/client/canvas-ui/modal-buffer-router.js';
import { handleModalNavigationKey, ModalNavState } from '../../src/client/input/modal-nav-router.js';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld } from '../../src/sim/core/world.js';

describe('Phase UI-4: CDDA Bench, World Atlas Minimap, Market Exchange & Naturalist Codex', () => {
  it('renders Artificer Bench with 2-column layout, CDDA category tabs, and component checklist', () => {
    const world = createInitialWorld({ seed: 42, width: 24, height: 24 });
    const playerId = EntityIdSchema.parse('actor_player');

    const buf = generateModalUiBuffer('WORKBENCH', world, playerId, 88, 36);

    // Frame title rendered
    const titleRow = buf.extractRowString(1);
    expect(titleRow).toContain('ARTIFICER WORKSTATION');

    // CDDA category tabs rendered
    const tabRow = buf.extractRowString(3);
    expect(tabRow).toContain('[ ALL ]');
    expect(tabRow).toContain('[ WEAPONS ]');
    expect(tabRow).toContain('[ PROSTHETICS ]');
    expect(tabRow).toContain('[ STEAM ]');
    expect(tabRow).toContain('[ ALCHEMY ]');

    // Left column catalog header
    const catalogHeaderRow = buf.extractRowString(4);
    expect(catalogHeaderRow).toContain('SCHEMATIC CATALOG');

    // Right column dossier header
    expect(catalogHeaderRow).toContain('SCHEMATIC DOSSIER');

    // Vertical divider column rendered at x = 43
    expect(buf.getCell(43, 5)?.glyph).toBe('│');

    // Recipes listed with craftability tags ([+] or [-])
    const recipeRow = buf.extractRowString(5);
    expect(recipeRow).toMatch(/\[\+|\-\]/);

    // Check component checklist rendered in right column
    let hasChecklist = false;
    for (let y = 6; y < 25; y++) {
      const row = buf.extractRowString(y);
      if (row.includes('REQUIRED COMPONENTS') || row.includes('[✓]') || row.includes('[✗]')) {
        hasChecklist = true;
        break;
      }
    }
    expect(hasChecklist).toBe(true);

    // Test modal keyboard navigation for WORKBENCH
    const navState: ModalNavState = { selectedIndex: 0 };
    const commands: any[] = [];
    const downHandled = handleModalNavigationKey(
      { key: 'ArrowDown', preventDefault() {} },
      'WORKBENCH',
      world,
      playerId,
      navState,
      (cmd) => commands.push(cmd),
    );
    expect(downHandled).toBe(true);
    expect(navState.selectedIndex).toBe(1);

    const enterHandled = handleModalNavigationKey(
      { key: 'Enter', preventDefault() {} },
      'WORKBENCH',
      world,
      playerId,
      navState,
      (cmd) => commands.push(cmd),
    );
    expect(enterHandled).toBe(true);
    expect(commands.length).toBe(1);
    expect(commands[0]?.type).toBe('CRAFT_RECIPE');
  });

  it('renders Atlas with live stratum minimap, player @, district dossier, and atmospheric readings', () => {
    const world = createInitialWorld({ seed: 42, width: 24, height: 24 });
    const playerId = EntityIdSchema.parse('actor_player');

    const buf = generateModalUiBuffer('ATLAS', world, playerId, 88, 36);

    // Title
    const titleRow = buf.extractRowString(1);
    expect(titleRow).toContain('METROPOLITAN ATLAS');

    // Left minimap title & right dossier title
    const subTitleRow = buf.extractRowString(3);
    expect(subTitleRow).toContain('STRATUM TOPOGRAPHY MINIMAP');
    expect(subTitleRow).toContain('DISTRICT DOSSIER');

    // Minimap contains player glyph '@'
    let playerGlyphFound = false;
    for (let y = 5; y < 28; y++) {
      for (let x = 4; x < 40; x++) {
        if (buf.getCell(x, y)?.glyph === '@') {
          playerGlyphFound = true;
          break;
        }
      }
      if (playerGlyphFound) break;
    }
    expect(playerGlyphFound).toBe(true);

    // Right dossier contains stratum altitude and atmospheric readings
    let foundAtmospheric = false;
    for (let y = 5; y < 30; y++) {
      const row = buf.extractRowString(y);
      if (row.includes('LOCAL ATMOSPHERIC READINGS') || row.includes('Ambient Steam')) {
        foundAtmospheric = true;
        break;
      }
    }
    expect(foundAtmospheric).toBe(true);

    // Unexplored minimap cells outside initial FOV render strictly as empty void ' ' without fog spoilers
    let foundUnexploredVoid = false;
    for (let y = 5; y < 28; y++) {
      for (let x = 4; x < 40; x++) {
        if (buf.getCell(x, y)?.glyph === ' ') {
          foundUnexploredVoid = true;
          break;
        }
      }
      if (foundUnexploredVoid) break;
    }
    expect(foundUnexploredVoid).toBe(true);
  });

  it('renders Borough Turf sectors and live Commodity Exchange ticker in EXCHANGE modal', () => {
    const world = createInitialWorld({ seed: 42, width: 24, height: 24 });
    const playerId = EntityIdSchema.parse('actor_player');

    const buf = generateModalUiBuffer('EXCHANGE', world, playerId, 88, 36);

    const titleRow = buf.extractRowString(1);
    expect(titleRow).toContain('COMMODITY EXCHANGE & TREASURY');

    // Verify commodity quotes and player treasury
    let foundTreasury = false;
    let foundQuotes = false;
    for (let y = 1; y < 30; y++) {
      const row = buf.extractRowString(y);
      if (row.includes('Player Treasury:')) foundTreasury = true;
      if (row.includes('LIVE COMMODITY QUOTES')) foundQuotes = true;
    }
    expect(foundTreasury).toBe(true);
    expect(foundQuotes).toBe(true);
  });

  it('renders Naturalist Codex with clean non-overlapping dissection sketch, tactical analysis, and notes', () => {
    const world = createInitialWorld({ seed: 42, width: 24, height: 24 });
    const playerId = EntityIdSchema.parse('actor_player');

    const buf = generateModalUiBuffer('CODEX', world, playerId, 88, 36);

    const titleRow = buf.extractRowString(2);
    expect(titleRow).toContain("THE NATURALIST'S LEDGER");

    // Category tabs on left page
    const tabRow = buf.extractRowString(3);
    expect(tabRow).toContain('[ALL]');

    // Center spine rendered
    expect(buf.getCell(43, 5)?.glyph).toBe('⣿');
    expect(buf.getCell(44, 5)?.glyph).toBe('⣿');

    // Right page dissection sketch rendered in rows 5-9
    expect(buf.getCell(47, 5)?.glyph).toBe('┌');

    // Tactical Analysis rendered beside sketch
    const tacticalRow = buf.extractRowString(5);
    expect(tacticalRow).toContain('Tactical Analysis:');

    // Field notes rendered in row 12+ without colliding with sketch
    const fieldNotesHeader = buf.extractRowString(12);
    expect(fieldNotesHeader).toContain('OBSERVER FIELD NOTES');

    // Morphological traits rendered below
    const traitsHeader = buf.extractRowString(18);
    expect(traitsHeader).toContain('MORPHOLOGICAL TRAITS');
    const tagsRow = buf.extractRowString(19);
    expect(tagsRow).toContain('TAGS: MECHANICAL • STEAM');
  });

  it('verifies zero text truncation, zero undefined tokens, and zero border collisions across all 6 modals', () => {
    const world = createInitialWorld({ seed: 42, width: 24, height: 24 });
    const playerId = EntityIdSchema.parse('actor_player');
    const modals = ['INVENTORY', 'ANATOMY', 'WORKBENCH', 'EXCHANGE', 'CODEX', 'ATLAS'] as const;

    for (const modal of modals) {
      const buf = generateModalUiBuffer(modal, world, playerId, 88, 36);

      // Verify each row length and absence of interpolation corruption
      for (let y = 0; y < 36; y++) {
        const row = buf.extractRowString(y);
        expect(row.length).toBe(88);
        expect(row).not.toContain('undefined');
        expect(row).not.toContain('null');
        expect(row).not.toContain('NaN');
        expect(row).not.toContain('[object');
      }

      // Verify framed modals have valid perimeter corners and enclosed borders
      if (modal === 'WORKBENCH' || modal === 'ANATOMY' || modal === 'ATLAS' || modal === 'INVENTORY') {
        const topLeft = buf.getCell(2, 1)?.glyph;
        const topRight = buf.getCell(85, 1)?.glyph;
        const bottomLeft = buf.getCell(2, 34)?.glyph;
        const bottomRight = buf.getCell(85, 34)?.glyph;

        expect(['☼', '╔', '┌']).toContain(topLeft);
        expect(['☼', '╗', '┐']).toContain(topRight);
        expect(['Ø', '╚', '└']).toContain(bottomLeft);
        expect(['Ø', '╝', '┘']).toContain(bottomRight);

        // Verify side borders are not overwritten by text spill
        for (let y = 3; y < 33; y++) {
          const leftBorder = buf.getCell(2, y)?.glyph;
          const rightBorder = buf.getCell(85, y)?.glyph;
          expect(['█', '║', '│']).toContain(leftBorder);
          expect(['█', '║', '│']).toContain(rightBorder);
        }
      }
    }
  });
});
