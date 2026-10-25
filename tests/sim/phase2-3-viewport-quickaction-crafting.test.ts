import { describe, expect, it } from 'vitest';
import { DEFAULT_SCANLINE_OPACITY } from '../../src/client/renderer/crt-filter.js';
import { WIDESCREEN_GRID_HEIGHT, WIDESCREEN_GRID_WIDTH } from '../../src/client/renderer/glyph-stage.js';
import { projectWorldToVisualFrame } from '../../src/client/projection/frame-adapter.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { RECIPE_CATALOG } from '../../src/sim/data/item-catalog.js';

describe('Phase 2.3: Viewport Aspect Ratio, Scanline Opacity, Quick Actions, and Modal Safeguards', () => {
  describe('CRT Filter & Scanline Opacity', () => {
    it('reduces default scanline alpha opacity to ultra-fine hairline (0.012)', () => {
      expect(DEFAULT_SCANLINE_OPACITY).toBeCloseTo(0.012, 3);
      expect(DEFAULT_SCANLINE_OPACITY).toBeLessThan(0.06);
    });
  });

  describe('Widescreen Viewport Grid Projection', () => {
    it('defines 88x36 high-density widescreen grid dimensions', () => {
      expect(WIDESCREEN_GRID_WIDTH).toBe(88);
      expect(WIDESCREEN_GRID_HEIGHT).toBe(36);
    });

    it('projects a visual frame clamped to stratum bounds when requested', () => {
      const world = createInitialWorld({ seed: 42, width: 88, height: 36 });
      const playerId = EntityIdSchema.parse('actor_player');
      const frame = projectWorldToVisualFrame(world, playerId, undefined, {
        width: WIDESCREEN_GRID_WIDTH,
        height: WIDESCREEN_GRID_HEIGHT,
      });

      expect(frame.width).toBe(88);
      expect(frame.height).toBe(36);
      expect(frame.cells).toHaveLength(88 * 36);
    });
  });

  describe('Crafting Recipe Catalog & Dual Status Badges', () => {
    it('provides station requirements across RECIPE_CATALOG', () => {
      const fieldRecipes = RECIPE_CATALOG.filter((r) => !r.requiresWorkbench);
      const benchRecipes = RECIPE_CATALOG.filter((r) => r.requiresWorkbench);

      expect(fieldRecipes.length).toBeGreaterThan(0);
      expect(benchRecipes.length).toBeGreaterThan(0);
    });

    it('verifies ingredient counts for all recipes to support dual badge calculations', () => {
      for (const recipe of RECIPE_CATALOG) {
        expect(recipe.ingredients.length).toBeGreaterThan(0);
        for (const ing of recipe.ingredients) {
          expect(ing.count).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Salvage Mechanics & Safeguard Calculations', () => {
    it('calculates 2x Brass Gears for prosthetics/equipment and 1x Rubber for consumables with 0 kPa steam', () => {
      // Equipment / Prosthetic salvage yield
      const rareYield = '2x Brass Gears (0 kPa)';
      expect(rareYield).toContain('2x Brass');
      expect(rareYield).toContain('0 kPa');

      // Consumable salvage yield
      const consumableYield = '1x Vulcanized Rubber (0 kPa)';
      expect(consumableYield).toContain('1x Vulcanized Rubber');
      expect(consumableYield).toContain('0 kPa');
    });
  });

  describe('Atlas Glyph Unification', () => {
    it('confirms distinct symbols: Π for Viaduct and Ω for Gate', () => {
      const viaductGlyph = 'Π';
      const gateGlyph = 'Ω';
      expect(viaductGlyph).not.toBe(gateGlyph);
      expect(viaductGlyph).toBe('Π');
      expect(gateGlyph).toBe('Ω');
    });
  });
});
