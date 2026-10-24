import { describe, expect, it } from 'vitest';
import {
  formatBlueprintTooltip,
  humanizeIdentifier,
  resolveBlueprintDisplayName,
} from '../../src/sim/data/item-catalog.js';
import { resolveCatalogDisplayName } from '../../src/client/projection/frame-adapter.js';

describe('Phase 2.1: Eradicate Raw Identifier Leaks and Formatting', () => {
  describe('humanizeIdentifier', () => {
    it('formats raw limb and slot underscore enums to Title Case', () => {
      expect(humanizeIdentifier('LEFT_ARM')).toBe('Left Arm');
      expect(humanizeIdentifier('RIGHT_ARM')).toBe('Right Arm');
      expect(humanizeIdentifier('LEFT_LEG')).toBe('Left Leg');
      expect(humanizeIdentifier('RIGHT_LEG')).toBe('Right Leg');
      expect(humanizeIdentifier('HEAD')).toBe('Head');
      expect(humanizeIdentifier('TORSO')).toBe('Torso');
      expect(humanizeIdentifier('THREADED_COUPLING')).toBe('Threaded Coupling');
    });

    it('strips common prefixes and title-cases snake_case identifiers', () => {
      expect(humanizeIdentifier('item_coagulant_tonic')).toBe('Coagulant Tonic');
      expect(humanizeIdentifier('mat_vulcanized_rubber')).toBe('Vulcanized Rubber');
      expect(humanizeIdentifier('npc_foundry_guard')).toBe('Foundry Guard');
      expect(humanizeIdentifier('landmark_water_pump')).toBe('Water Pump');
      expect(humanizeIdentifier('district_belgravia_brass_spires')).toBe('Belgravia Brass Spires');
    });

    it('handles empty or blank inputs gracefully', () => {
      expect(humanizeIdentifier('')).toBe('');
    });
  });

  describe('resolveBlueprintDisplayName and formatBlueprintTooltip', () => {
    it('resolves actual item names from catalog', () => {
      expect(resolveBlueprintDisplayName('item_coagulant_tonic')).toBe(
        "Dr. Halloway's Coagulant Tonic",
      );
      expect(resolveBlueprintDisplayName('mat_vulcanized_rubber')).toBe('Vulcanized Rubber');
      expect(resolveBlueprintDisplayName('prosthetic_pneumatic_leg_mk1')).toBe(
        'Gilded Pneumatic Strider Leg Mk.I',
      );
    });

    it('falls back to Title Case if blueprint does not exist', () => {
      expect(resolveBlueprintDisplayName('item_custom_alchemical_salts')).toBe(
        'Custom Alchemical Salts',
      );
    });

    it('produces informative stat tooltips for loadout items and prosthetics', () => {
      const tonicTooltip = formatBlueprintTooltip('item_coagulant_tonic');
      expect(tonicTooltip).toBeDefined();
      expect(tonicTooltip).toContain('250g');
      expect(tonicTooltip).toContain('200ml');

      const rubberTooltip = formatBlueprintTooltip('mat_vulcanized_rubber');
      expect(rubberTooltip).toBeDefined();
      expect(rubberTooltip).toContain('90g');
      expect(rubberTooltip).toContain('150ml');

      const prostheticTooltip = formatBlueprintTooltip('prosthetic_pneumatic_leg_mk1');
      expect(prostheticTooltip).toBeDefined();
      expect(prostheticTooltip).toContain('kPa');
    });
  });

  describe('resolveCatalogDisplayName (frame-adapter)', () => {
    it('resolves district titles matching Atlas and overworld dossiers', () => {
      expect(
        resolveCatalogDisplayName('district', 'district_spitalfields_soot_works'),
      ).toBe('Spitalfields Smelting Works');
      expect(
        resolveCatalogDisplayName('district', 'district_belgravia_brass_spires'),
      ).toBe('Gilded Spire Assembly');
      expect(
        resolveCatalogDisplayName('district', 'district_fleet_ditch_undercroft'),
      ).toBe('Chalk-Vault Catacombs & Fleet Ditch');
    });

    it('resolves full landmark names', () => {
      expect(resolveCatalogDisplayName('landmark', 'landmark_water_pump')).toBe(
        'Victorian Municipal Water Pump',
      );
      expect(
        resolveCatalogDisplayName('landmark', 'landmark_street_clocktower'),
      ).toBe('Great St. Jude Street Clocktower');
      expect(resolveCatalogDisplayName('landmark', 'landmark_canal_lock')).toBe(
        'Limehouse Sunken Canal Lock & Winch',
      );
      expect(
        resolveCatalogDisplayName('landmark', 'landmark_spire_greenhouse'),
      ).toBe('Belgravia Spire Conservatory');
      expect(resolveCatalogDisplayName('landmark', 'foundry_boiler')).toBe(
        'High-Pressure Foundry Boiler',
      );
    });

    it('resolves item and prosthetic catalog display names', () => {
      expect(resolveCatalogDisplayName('item', 'item_coagulant_tonic')).toBe(
        "Dr. Halloway's Coagulant Tonic",
      );
      expect(resolveCatalogDisplayName('item', 'mat_vulcanized_rubber')).toBe(
        'Vulcanized Rubber',
      );
      expect(
        resolveCatalogDisplayName('prosthetic', 'prosthetic_pneumatic_leg_mk1'),
      ).toBe('Gilded Pneumatic Strider Leg Mk.I');
    });

    it('falls back to Title Case humanization for unknown IDs', () => {
      expect(resolveCatalogDisplayName('role', 'CITIZEN')).toBe('Citizen');
      expect(resolveCatalogDisplayName('slot', 'LEFT_LEG')).toBe('Left Leg');
      expect(resolveCatalogDisplayName('unknown', 'npc_foundry_foreman')).toBe(
        'Foundry Foreman',
      );
    });
  });
});
