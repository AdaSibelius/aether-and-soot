import { describe, expect, it } from 'vitest';
import {
  drawBourdonPressureGauge,
  drawSanguineManometer,
  drawSplitFlapOdometer,
  formatVictorianCurrency,
  formatVictorianFluidMeasures,
} from '../../src/client/canvas-ui/analog-gauges.js';
import { createUiCellBuffer } from '../../src/client/canvas-ui/cell-buffer.js';
import { composeDiegeticUiBuffer } from '../../src/client/canvas-ui/diegetic-screen-composer.js';
import { renderDiegeticPaperdoll } from '../../src/client/canvas-ui/dossier-paperdoll.js';
import { renderEmbarkationScreen } from '../../src/client/canvas-ui/embarkation-screen.js';
import {
  estimateTerrainAcousticDb,
  estimateTerrainHardness,
  renderTacticalVernierDossier,
} from '../../src/client/canvas-ui/tactical-vernier.js';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { generateVictorianDistrict } from '../../src/sim/spatial/generator.js';

describe('Phase 55: High-Density Victorian Mechanical Console UI', () => {
  describe('Pre-Decimal Victorian Currency Formatting', () => {
    it('formats pence amounts into pounds, shillings, and pence (£ s d)', () => {
      expect(formatVictorianCurrency(0)).toBe('0d');
      expect(formatVictorianCurrency(7)).toBe('7d');
      expect(formatVictorianCurrency(12)).toBe('1s 0d');
      expect(formatVictorianCurrency(29)).toBe('2s 5d');
      expect(formatVictorianCurrency(240)).toBe('£1 0s 0d');
      expect(formatVictorianCurrency(275)).toBe('£1 2s 11d');
    });

    it('formats negative currency balances with minus sign', () => {
      expect(formatVictorianCurrency(-25)).toBe('-2s 1d');
      expect(formatVictorianCurrency(-260)).toBe('-£1 1s 8d');
    });
  });

  describe('Victorian Imperial Sanguine Fluid Measures', () => {
    it('converts blood percentages into Imperial Pints and Drams (8 Pts = 1024 Drams total)', () => {
      expect(formatVictorianFluidMeasures(100).formatted).toBe('8 Pts 0 Drm');
      expect(formatVictorianFluidMeasures(50).formatted).toBe('4 Pts 0 Drm');
      expect(formatVictorianFluidMeasures(0).formatted).toBe('0 Pts 0 Drm');
    });

    it('clamps negative or exceeding blood values', () => {
      expect(formatVictorianFluidMeasures(-10).formatted).toBe('0 Pts 0 Drm');
      expect(formatVictorianFluidMeasures(120).formatted).toBe('8 Pts 0 Drm');
    });
  });

  describe('Analog Instrument Widgets', () => {
    it('renders Bourdon steam pressure gauge dial with radial needle indicator', () => {
      const buf = createUiCellBuffer(20, 10);
      drawBourdonPressureGauge(buf, 2, 1, 75, 100);

      expect(buf.getCell(2, 1)?.glyph).toBe('╭');
      expect(buf.getCell(5, 1)?.glyph).toBe('B');

      let foundNeedle = false;
      for (let y = 1; y < 8; y++) {
        for (let x = 2; x < 15; x++) {
          if (buf.getCell(x, y)?.glyph === '▲') {
            foundNeedle = true;
            break;
          }
        }
      }
      expect(foundNeedle).toBe(true);
    });

    it('renders galvanic sanguine manometer column with fluid level and tick marks', () => {
      const buf = createUiCellBuffer(20, 12);
      drawSanguineManometer(buf, 2, 1, 80, 8);

      expect(buf.getCell(2, 1)?.glyph).toBe('┌');
      expect(buf.getCell(3, 1)?.glyph).toBe('M');

      let foundFluid = false;
      for (let y = 2; y < 10; y++) {
        const g1 = buf.getCell(3, y)?.glyph;
        const g2 = buf.getCell(4, y)?.glyph;
        if (g1 === '░' || g1 === '█' || g2 === '░' || g2 === '█') {
          foundFluid = true;
          break;
        }
      }
      expect(foundFluid).toBe(true);
    });

    it('renders split-flap mechanical odometer registers', () => {
      const buf = createUiCellBuffer(20, 6);
      drawSplitFlapOdometer(buf, 2, 1, 42, 4, 'TURNS');

      expect(buf.getCell(2, 1)?.glyph).toBe('T');
      expect(buf.getCell(3, 1)?.glyph).toBe('U');
      expect(buf.getCell(13, 1)?.glyph).toBe('4');
      expect(buf.getCell(15, 1)?.glyph).toBe('2');
    });
  });

  describe('Caves of Qud-Grade Optical Vernier Tile Scanner', () => {
    it('estimates acoustic footstep reverberation dB by terrain classification', () => {
      expect(estimateTerrainAcousticDb('CAST_IRON_GRATE')).toBe(82);
      expect(estimateTerrainAcousticDb('BRITISH_STONE_PAVER')).toBe(68);
      expect(estimateTerrainAcousticDb('SLAG_RUBBLE')).toBe(75);
      expect(estimateTerrainAcousticDb('ROTTED_WOOD_FLOOR')).toBe(52);
    });

    it('estimates structural Mohs hardness rating by terrain classification', () => {
      expect(estimateTerrainHardness('CAST_IRON_GRATE').mohs).toBe(6.5);
      expect(estimateTerrainHardness('BRITISH_STONE_PAVER').mohs).toBe(5.5);
      expect(estimateTerrainHardness('BRICK_FOUNDRY_WALL').mohs).toBe(7.0);
      expect(estimateTerrainHardness('WOODEN_DOOR_CLOSED').mohs).toBe(3.0);
    });

    it('renders optical vernier dossier panel for inspected tile', () => {
      const state = generateVictorianDistrict(createInitialWorld({ seed: 12345 })).state;
      const buf = createUiCellBuffer(30, 16);
      renderTacticalVernierDossier(buf, { x: 1, y: 1, width: 26, height: 12 }, state, { x: 10, y: 10 });

      const headerRow = buf.extractRowString(1);
      expect(headerRow).toContain('OPTICAL VERNIER');

      let hasPpm = false;
      let hasAcoustics = false;
      let hasMohs = false;
      for (let r = 2; r < 13; r++) {
        const rowStr = buf.extractRowString(r);
        if (rowStr.includes('SOOT CONC:')) hasPpm = true;
        if (rowStr.includes('ACOUSTIC:')) hasAcoustics = true;
        if (rowStr.includes('Mohs')) hasMohs = true;
      }
      expect(hasPpm).toBe(true);
      expect(hasAcoustics).toBe(true);
      expect(hasMohs).toBe(true);
    });
  });

  describe('Anatomical Wireframe Paperdoll', () => {
    it('renders anatomical paperdoll wireframe with limb damage status', () => {
      const buf = createUiCellBuffer(26, 12);
      const anatomy = {
        bloodVolumePct: 85,
        strainLoadKw: 15,
        governorCapacityKw: 100,
        prosthetics: {},
        limbs: {
          HEAD: { slot: 'HEAD' as const, hp: 20, maxHp: 20, amputated: false },
          TORSO: { slot: 'TORSO' as const, hp: 80, maxHp: 100, amputated: false },
          LEFT_ARM: { slot: 'LEFT_ARM' as const, hp: 30, maxHp: 30, amputated: false },
          RIGHT_ARM: { slot: 'RIGHT_ARM' as const, hp: 0, maxHp: 30, amputated: true },
          LEFT_LEG: { slot: 'LEFT_LEG' as const, hp: 40, maxHp: 40, amputated: false },
          RIGHT_LEG: { slot: 'RIGHT_LEG' as const, hp: 40, maxHp: 40, amputated: false },
        },
      };

      renderDiegeticPaperdoll(buf, 2, 1, { anatomy });

      expect(buf.getCell(10, 2)?.glyph).toBe('■');
      expect(buf.getCell(12, 2)?.glyph).toBe('H');
    });
  });

  describe('Canvas-Native Embarkation Screen & Composer', () => {
    it('renders the 3-column leather-bound employment book and wax seal stamp', () => {
      const buf = createUiCellBuffer(88, 36);
      renderEmbarkationScreen(buf, { x: 2, y: 1, width: 84, height: 34 }, {
        config: {
          professionId: 'FOUNDRY_ARTIFICER',
          traitIds: ['BOILER_HEART'],
          scenarioId: 'SPITALFIELDS_FOUNDRY_ROW',
          seed: 42,
        },
      });

      const titleRow = buf.extractRowString(1);
      expect(titleRow).toContain('EMBARKATION LEDGER');

      let foundWaxSeal = false;
      for (let r = 20; r < 34; r++) {
        const row = buf.extractRowString(r);
        if (row.includes('AFFIX WAX SEAL')) {
          foundWaxSeal = true;
          break;
        }
      }
      expect(foundWaxSeal).toBe(true);
    });

    it('composes full-screen embarkation screen when creator is open', () => {
      const state = createInitialWorld({ seed: 777 });
      const playerId = EntityIdSchema.parse('actor_player');
      const buf = composeDiegeticUiBuffer({
        isCreatorOpen: true,
        embarkConfig: {
          professionId: 'DISGRACED_CHIRURGEON',
          traitIds: ['NIGHT_OPTICS'],
          scenarioId: 'BELGRAVIA_SKY_WALK',
        },
        activeModal: null,
        useDiegeticCanvasUi: true,
        worldState: state,
        playerId,
        width: 88,
        height: 36,
        inspectedTile: null,
        isLookModeActive: false,
      });

      expect(buf).toBeDefined();
      expect(buf?.extractRowString(1)).toContain('EMBARKATION LEDGER');
    });
  });
});
