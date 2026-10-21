import { describe, expect, it } from 'vitest';
import {
  generateMockContent,
  parseGeneratorArgs,
} from '../scripts/hermes-content-generator.js';
import {
  normalizePrefabGrid,
  validateAndFormatContent,
} from '../scripts/hermes-content-normalizers.js';

describe('Hermes Full-Spectrum Content Generator (Phase 35)', () => {
  it('parses CLI arguments accurately with Tier 2 fast model defaults', () => {
    const config = parseGeneratorArgs(['node', 'script.js', '--type', 'prosthetics', '--count', '4', '--theme', 'Soot Works', '--mock', '--append']);
    expect(config.type).toBe('prosthetics');
    expect(config.count).toBe(4);
    expect(config.theme).toBe('Soot Works');
    expect(config.mock).toBe(true);
    expect(config.append).toBe(true);
    expect(config.model).toMatch(/hermes3:8b|hermes-agent/);
  });

  it('generates valid Material and Consumable blueprints', () => {
    const mockMaterials = generateMockContent({ type: 'materials', count: 2, theme: 'Catwalks', mock: true, append: false });
    const { valid: matValid, errors: matErrors } = validateAndFormatContent('materials', mockMaterials);
    expect(matErrors).toHaveLength(0);
    expect(matValid).toHaveLength(2);

    const mockConsumables = generateMockContent({ type: 'consumables', count: 2, theme: 'Apothecary', mock: true, append: false });
    const { valid: conValid, errors: conErrors } = validateAndFormatContent('consumables', mockConsumables);
    expect(conErrors).toHaveLength(0);
    expect(conValid).toHaveLength(2);
  });

  it('generates valid Prosthetic blueprints matching ProstheticBlueprintSchema', () => {
    const mockProsthetics = generateMockContent({ type: 'prosthetics', count: 2, theme: 'Foundry', mock: true, append: false });
    const { valid, errors } = validateAndFormatContent('prosthetics', mockProsthetics);
    expect(errors).toHaveLength(0);
    expect(valid).toHaveLength(2);
    const first = valid[0];
    if (first && 'targetLimbSlot' in first) {
      expect(first.targetLimbSlot).toBe('LEFT_ARM');
      expect(first.pressureRatingKpa).toBeGreaterThanOrEqual(50);
    } else {
      expect.fail('Expected valid prosthetic blueprint');
    }
  });

  it('generates valid District and Gas blueprints matching their schemas', () => {
    const mockDistricts = generateMockContent({ type: 'districts', count: 2, theme: 'Iron Works', mock: true, append: false });
    const { valid: dValid, errors: dErrors } = validateAndFormatContent('districts', mockDistricts);
    expect(dErrors).toHaveLength(0);
    expect(dValid).toHaveLength(2);

    const mockGases = generateMockContent({ type: 'gases', count: 2, theme: 'Sewer Gas', mock: true, append: false });
    const { valid: gValid, errors: gErrors } = validateAndFormatContent('gases', mockGases);
    expect(gErrors).toHaveLength(0);
    expect(gValid).toHaveLength(2);
  });

  it('generates valid ASCII Prefab rooms and deterministically enforces perimeter doors', () => {
    const mockPrefabs = generateMockContent({ type: 'prefabs', count: 2, theme: 'Artificer Cell', mock: true, append: false });
    const { valid, errors } = validateAndFormatContent('prefabs', mockPrefabs);
    expect(errors).toHaveLength(0);
    expect(valid).toHaveLength(2);
    const first = valid[0];
    if (first && 'layout' in first) {
      expect(first.layout.some((row: string) => row.includes('+'))).toBe(true);
      expect(first.width).toBe(8);
      expect(first.height).toBe(6);
    } else {
      expect.fail('Expected valid prefab room');
    }
  });

  it('deterministic prefab normalizer automatically repairs sealed rooms by adding a door', () => {
    const sealedRoom = {
      id: 'prefab_sealed',
      name: 'Sealed Vault',
      width: 6,
      height: 5,
      layout: [
        '######',
        '#....#',
        '#....#',
        '#....#',
        '######', // No door '+'
      ],
    };
    const normalized = normalizePrefabGrid(sealedRoom);
    expect(normalized.layout.some((r: string) => r.includes('+'))).toBe(true);
    expect(normalized.layout[4]).toContain('+');
  });
});
