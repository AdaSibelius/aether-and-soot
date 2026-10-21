import { describe, expect, it } from 'vitest';
import {
  generateMockContent,
  parseGeneratorArgs,
  validateAndFormatContent,
} from '../scripts/hermes-content-generator.js';

describe('Hermes Content Generator', () => {
  it('parses CLI arguments accurately with safe defaults', () => {
    const config = parseGeneratorArgs(['node', 'script.js', '--type', 'consumables', '--count', '5', '--theme', 'Soot Works', '--mock', '--append']);
    expect(config.type).toBe('consumables');
    expect(config.count).toBe(5);
    expect(config.theme).toBe('Soot Works');
    expect(config.mock).toBe(true);
    expect(config.append).toBe(true);
  });

  it('generates valid Material blueprints matching ItemBlueprintSchema', () => {
    const mockMaterials = generateMockContent({
      type: 'materials',
      count: 3,
      theme: 'Pneumatic Catwalks',
      mock: true,
      append: false,
    });
    const { valid, errors } = validateAndFormatContent('materials', mockMaterials);
    expect(errors).toHaveLength(0);
    expect(valid).toHaveLength(3);
    const first = valid[0];
    if (first && 'category' in first) {
      expect(first.category).toBe('MATERIAL');
    } else {
      expect.fail('Expected material item with category');
    }
  });

  it('generates valid Consumable blueprints with active use effects', () => {
    const mockConsumables = generateMockContent({
      type: 'consumables',
      count: 2,
      theme: 'Apothecary Lab',
      mock: true,
      append: false,
    });
    const { valid, errors } = validateAndFormatContent('consumables', mockConsumables);
    expect(errors).toHaveLength(0);
    expect(valid).toHaveLength(2);
    const first = valid[0];
    if (first && 'category' in first) {
      expect(first.category).toBe('CONSUMABLE');
    } else {
      expect.fail('Expected consumable item with category');
    }
  });

  it('generates valid Crafting Recipes matching CraftingRecipeBlueprintSchema', () => {
    const mockRecipes = generateMockContent({
      type: 'recipes',
      count: 2,
      theme: 'Clockwork Workshop',
      mock: true,
      append: false,
    });
    const { valid, errors } = validateAndFormatContent('recipes', mockRecipes);
    expect(errors).toHaveLength(0);
    expect(valid).toHaveLength(2);
    const first = valid[0];
    if (first && 'outputBlueprintId' in first) {
      expect(first.outputBlueprintId).toBeDefined();
    } else {
      expect.fail('Expected crafting recipe with outputBlueprintId');
    }
  });
});
