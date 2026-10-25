import { describe, expect, it } from 'vitest';
import { AnatomyComponent } from '../../src/schemas/components.schema.js';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { createUiCellBuffer } from '../../src/client/canvas-ui/cell-buffer.js';
import { renderClockworkPaperdoll } from '../../src/client/canvas-ui/diegetic-anatomy.js';
import { renderFactionContaminationMap } from '../../src/client/canvas-ui/diegetic-cartography.js';
import { VICTORIAN_PALETTE } from '../../src/client/canvas-ui/material-palette.js';

describe('Diegetic Visualizations', () => {
  const createMockAnatomy = (overrides: Partial<AnatomyComponent> = {}): AnatomyComponent => ({
    limbs: {
      HEAD: { slot: 'HEAD', hp: 20, maxHp: 20, amputated: false },
      TORSO: { slot: 'TORSO', hp: 50, maxHp: 50, amputated: false },
      LEFT_ARM: { slot: 'LEFT_ARM', hp: 20, maxHp: 20, amputated: false },
      RIGHT_ARM: { slot: 'RIGHT_ARM', hp: 20, maxHp: 20, amputated: false },
      LEFT_LEG: { slot: 'LEFT_LEG', hp: 25, maxHp: 25, amputated: false },
      RIGHT_LEG: { slot: 'RIGHT_LEG', hp: 25, maxHp: 25, amputated: false },
    },
    bloodVolumePct: 100,
    steamReserveKpa: 80,
    maxSteamReserveKpa: 100,
    governorCapacityKw: 100,
    strainLoadKw: 0,
    toxicityPct: 0,
    painShock: 0,
    stamina: 100,
    unlockedRecipeIds: [],
    activeEffects: [],
    ...overrides,
  });

  describe('renderClockworkPaperdoll', () => {
    it('renders soft organic glyphs for biological limbs with amber gaslight coloring', () => {
      const buf = createUiCellBuffer(20, 12);
      const anatomy = createMockAnatomy();

      renderClockworkPaperdoll(buf, 0, 0, anatomy);

      // Head: soft organic ( ~ )
      expect(buf.extractRowString(0)).toContain('( ~ )');
      expect(buf.getCell(7, 0)?.fg).toBe(VICTORIAN_PALETTE.AMBER_GASLIGHT);

      // Left leg: soft organic (~) and (_)
      const thighRow = buf.extractRowString(6);
      const footRow = buf.extractRowString(8);
      expect(thighRow).toContain('(~)');
      expect(footRow).toContain('(_)');
      expect(buf.getCell(6, 6)?.fg).toBe(VICTORIAN_PALETTE.AMBER_GASLIGHT);
    });

    it('dynamically swaps biological curves for dense mechanical geometry when a prosthetic is grafted', () => {
      const buf = createUiCellBuffer(20, 12);
      const anatomy = createMockAnatomy();

      // Graft a Gilded Pneumatic Strider Leg onto LEFT_LEG
      renderClockworkPaperdoll(buf, 0, 0, anatomy, {
        equippedProsthetics: {
          LEFT_LEG: EntityIdSchema.parse('item_gilded_strider_leg'),
        },
      });

      // Left leg thigh (Row 6) is now [=], shin (Row 7) is [#], foot (Row 8) is [╬]
      expect(buf.getCell(5, 6)?.glyph).toBe('[');
      expect(buf.getCell(6, 6)?.glyph).toBe('=');
      expect(buf.getCell(7, 6)?.glyph).toBe(']');

      expect(buf.getCell(5, 7)?.glyph).toBe('[');
      expect(buf.getCell(6, 7)?.glyph).toBe('#');
      expect(buf.getCell(7, 7)?.glyph).toBe(']');

      expect(buf.getCell(5, 8)?.glyph).toBe('[');
      expect(buf.getCell(6, 8)?.glyph).toBe('╬');
      expect(buf.getCell(7, 8)?.glyph).toBe(']');

      // Visuals are now Aether Blue with AETHER_HALATION
      const graftedFootCell = buf.getCell(6, 8);
      expect(graftedFootCell?.fg).toBe(VICTORIAN_PALETTE.AETHER_BLUE);
      expect(graftedFootCell?.shaderFlags).toContain('AETHER_HALATION');

      // Right leg remains biological
      expect(buf.getCell(10, 6)?.glyph).toBe('~');
      expect(buf.getCell(10, 6)?.fg).toBe(VICTORIAN_PALETTE.AMBER_GASLIGHT);
    });

    it('triggers spark glint and white flash during active graft transition ticks', () => {
      const buf = createUiCellBuffer(20, 12);
      const anatomy = createMockAnatomy();

      renderClockworkPaperdoll(buf, 0, 0, anatomy, {
        equippedProsthetics: {
          LEFT_ARM: EntityIdSchema.parse('item_pneumatic_piston_arm'),
        },
        transitionTick: 3,
      });

      const forearmCell = buf.getCell(3, 3);
      expect(forearmCell?.fg).toBe('#ffffff');
      expect(forearmCell?.shaderFlags).toContain('SPARK_GLINT');
      expect(forearmCell?.shaderFlags).toContain('AETHER_HALATION');
    });

    it('renders severed limb as red marker with thermal pulse flag', () => {
      const buf = createUiCellBuffer(20, 12);
      const anatomy = createMockAnatomy({
        limbs: {
          ...createMockAnatomy().limbs,
          RIGHT_ARM: { slot: 'RIGHT_ARM', hp: 0, maxHp: 20, amputated: true },
        },
      });

      renderClockworkPaperdoll(buf, 0, 0, anatomy);

      const severedArmCell = buf.getCell(13, 2);
      expect(severedArmCell?.glyph).toBe('x');
      expect(severedArmCell?.fg).toBe(VICTORIAN_PALETTE.INCANDESCENT_RED);
      expect(severedArmCell?.shaderFlags).toContain('THERMO_CRITICAL_PULSE');
    });

    it('registers limb hit actions across the paperdoll for mouse interaction', () => {
      const buf = createUiCellBuffer(20, 12);
      const anatomy = createMockAnatomy();

      renderClockworkPaperdoll(buf, 0, 0, anatomy, { selectedSlot: 'TORSO' });

      expect(buf.resolveHitActionAt(7, 0)).toBe('select_limb:HEAD');
      expect(buf.resolveHitActionAt(3, 2)).toBe('select_limb:LEFT_ARM');
      expect(buf.resolveHitActionAt(8, 3)).toBe('select_limb:TORSO');
      expect(buf.resolveHitActionAt(6, 6)).toBe('select_limb:LEFT_LEG');
      expect(buf.extractRowString(10)).toContain('[ TORSO ]');
    });
  });

  describe('renderFactionContaminationMap', () => {
    it('renders low-resolution CP437 metropolis blocks with faction contamination and precision legend', () => {
      const buf = createUiCellBuffer(56, 16);
      const state = createInitialWorld({ seed: 12345 });

      renderFactionContaminationMap(buf, { x: 0, y: 0, width: 56, height: 16 }, state);

      const fullOutput = Array.from({ length: 16 }, (_, r) => buf.extractRowString(r)).join('\n');

      // Contains faction contamination textures: spreading rust (▓), soot (░), clockwork (╬), crown (☼)
      expect(fullOutput).toContain('▓');
      expect(fullOutput).toContain('░');
      expect(fullOutput).toContain('╬');
      expect(fullOutput).toContain('☼');

      // Precision legend
      expect(fullOutput).toContain('═[ FACTION CONTAMINATION ]═');
      expect(fullOutput).toContain('IRON CARTEL');
      expect(fullOutput).toContain('SYNDICATE');
      expect(fullOutput).toContain('CLOCK GUILD');
      expect(fullOutput).toContain('CONSTABULARY');

      // Sector hit action
      expect(buf.resolveHitActionAt(1, 1)).toBe('select_turf:turf_soot_smelting');
    });

    it('highlights selected turf sector border in aether blue', () => {
      const buf = createUiCellBuffer(56, 16);
      const state = createInitialWorld({ seed: 12345 });

      renderFactionContaminationMap(buf, { x: 0, y: 0, width: 56, height: 16 }, state, 'turf_soot_smelting');

      const cornerCell = buf.getCell(0, 0);
      expect(cornerCell?.glyph).toBe('┌');
      expect(cornerCell?.fg).toBe(VICTORIAN_PALETTE.AETHER_BLUE);
    });
  });
});
