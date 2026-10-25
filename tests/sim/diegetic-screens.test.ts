import { describe, expect, it } from 'vitest';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { createUiCellBuffer } from '../../src/client/canvas-ui/cell-buffer.js';
import { renderArtificerBenchScreen } from '../../src/client/canvas-ui/artificer-bench-screen.js';
import { VICTORIAN_PALETTE } from '../../src/client/canvas-ui/material-palette.js';
import { renderNaturalistLedgerScreen } from '../../src/client/canvas-ui/naturalist-ledger-screen.js';
import { renderSatchelScreen } from '../../src/client/canvas-ui/satchel-screen.js';

describe('Diegetic Screen Identity Divergence', () => {
  const playerId = EntityIdSchema.parse('actor_player');

  describe('renderSatchelScreen', () => {
    it('renders portable dark-iron housing with precision gauges and compartment rows', () => {
      const buf = createUiCellBuffer(55, 18);
      const state = createInitialWorld({ seed: 42 });

      renderSatchelScreen(buf, { x: 0, y: 0, width: 55, height: 18 }, state, playerId);

      // Frame uses PRIMARY_IRON rivets and borders
      expect(buf.getCell(0, 0)?.glyph).toBe('☼');
      expect(buf.getCell(54, 17)?.glyph).toBe('Ø');
      expect(buf.extractRowString(0)).toContain('SATCHEL & PORTABLE GAUGES');

      // Contains STM & BLD instrument gauges
      const fullText = Array.from({ length: 18 }, (_, r) => buf.extractRowString(r)).join('\n');
      expect(fullText).toContain('STM: [');
      expect(fullText).toContain('BLD: (');
      expect(fullText).toContain('PNEUMATIC COMPARTMENTS');
    });

    it('highlights selected item row with aether blue and sets hit actions', () => {
      const buf = createUiCellBuffer(55, 18);
      const state = createInitialWorld({ seed: 42 });
      const inventory = state.entities[playerId]?.inventory;
      const firstItemId = inventory?.containedEntityIds[0];

      if (firstItemId) {
        renderSatchelScreen(buf, { x: 0, y: 0, width: 55, height: 18 }, state, playerId, {
          selectedItemId: firstItemId,
        });

        const fullText = Array.from({ length: 18 }, (_, r) => buf.extractRowString(r)).join('\n');
        expect(fullText).toContain('► [A]');
        expect(buf.resolveHitActionAt(2, 7)).toBe(`select_item:${firstItemId}`);
      }
    });
  });

  describe('renderArtificerBenchScreen', () => {
    it('renders heavy iron workbench with schematic gears and smoke mask regions', () => {
      const buf = createUiCellBuffer(55, 18);
      const state = createInitialWorld({ seed: 42 });

      renderArtificerBenchScreen(buf, { x: 0, y: 0, width: 55, height: 18 }, state);

      expect(buf.extractRowString(0)).toContain('ARTIFICER WORKSTATION');

      // Contains smoke mask flag in bottom furnace rows
      const smokeCell = buf.getCell(4, 15);
      expect(smokeCell?.shaderFlags).toContain('SMOKE_MASK_REGION');

      // Has recipe crafting hit actions
      expect(buf.resolveHitActionAt(2, 4)).toContain('craft_recipe:');
    });

    it('triggers mechanical shudder (TREMOR_JITTER) on high-pressure blueprints (>= 50 kPa)', () => {
      const buf = createUiCellBuffer(55, 18);
      const state = createInitialWorld({ seed: 42 });

      renderArtificerBenchScreen(buf, { x: 0, y: 0, width: 55, height: 18 }, state, {
        selectedRecipeId: 'recipe_boiler_core_50kpa',
        customRecipes: [
          { id: 'recipe_pneumatic_leg', name: 'Strider Leg', steamCostKpa: 25 },
          { id: 'recipe_boiler_core_50kpa', name: '50 kPa Boiler Core', steamCostKpa: 50 },
        ],
      });

      // Recipe 1 (50 kPa Boiler Core) is at row 5
      const highPressureCell = buf.getCell(2, 5);
      expect(highPressureCell?.fg).toBe(VICTORIAN_PALETTE.INCANDESCENT_RED);
      expect(highPressureCell?.shaderFlags).toContain('TREMOR_JITTER');
      expect(highPressureCell?.shaderFlags).toContain('THERMO_CRITICAL_PULSE');
    });
  });

  describe('renderNaturalistLedgerScreen', () => {
    it('renders two-page sepia ledger with center binding spine (⣿) without iron borders', () => {
      const buf = createUiCellBuffer(60, 18);
      const state = createInitialWorld({ seed: 42 });

      renderNaturalistLedgerScreen(buf, { x: 0, y: 0, width: 60, height: 18 }, state);

      // Center binding spine is ⣿
      expect(buf.getCell(29, 5)?.glyph).toBe('⣿');
      expect(buf.getCell(30, 5)?.glyph).toBe('⣿');

      // Left page background is sepia parchment
      expect(buf.getCell(2, 2)?.bg).toBe(VICTORIAN_PALETTE.SEPIA_PARCHMENT);

      // Does NOT render iron border blocks (▀, ▄)
      const topRow = buf.extractRowString(0);
      expect(topRow).not.toContain('▀');
      expect(topRow).not.toContain('▄');

      // Left page has taxonomy index and right page has dissection sketch
      const fullText = Array.from({ length: 18 }, (_, r) => buf.extractRowString(r)).join('\n');
      expect(fullText).toContain('TAXONOMY INDEX');
      expect(fullText).toContain('FIELD ANNOTATIONS');
      expect(fullText).toContain('┌─[ANATOMY]─┐');
      expect(fullText).toContain('│  (o)─[⚙]  │');
    });

    it('attaches select_codex hit actions for taxonomy inspection', () => {
      const buf = createUiCellBuffer(60, 18);
      const state = createInitialWorld({ seed: 42 });

      renderNaturalistLedgerScreen(buf, { x: 0, y: 0, width: 60, height: 18 }, state);

      expect(buf.resolveHitActionAt(2, 4)).toContain('select_codex:');
    });
  });
});
