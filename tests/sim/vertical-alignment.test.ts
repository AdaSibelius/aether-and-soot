import { describe, expect, it } from 'vitest';
import { BlueprintIdSchema } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { generateVictorianDistrict } from '../../src/sim/spatial/generator.js';

describe('Section 7.1: Cross-Stratum Coordinate Alignment & Shaft Verification', () => {
  const CANONICAL_DISTRICTS = [
    'district_spitalfields_soot_works',
    'district_fleet_ditch_undercroft',
    'district_limehouse_docks',
    'district_whitechapel_ward',
    'district_belgravia_brass_spires',
  ] as const;

  it('verifies that every street manhole aligns exactly with an undercroft ladder at identical (x, y)', () => {
    for (const districtId of CANONICAL_DISTRICTS) {
      const world = createInitialWorld({
        seed: 1042,
        currentDistrictId: BlueprintIdSchema.parse(districtId),
        width: 48,
        height: 36,
      });
      const { state, landmarks } = generateVictorianDistrict(world);

      expect(landmarks.streetManhole.x).toBe(landmarks.undercroftLadder.x);
      expect(landmarks.streetManhole.y).toBe(landmarks.undercroftLadder.y);

      // Verify portal entities on STREET targeting UNDERCROFT
      const streetManholes = Object.values(state.entities).filter(
        (e) => e.portal?.target.stratum === 'UNDERCROFT' && e.position?.stratum === 'STREET',
      );
      expect(streetManholes.length).toBeGreaterThan(0);

      for (const sm of streetManholes) {
        const smPos = sm.position!;
        const smTarget = sm.portal!.target;
        expect(smTarget.x).toBe(smPos.x);
        expect(smTarget.y).toBe(smPos.y);

        // Matching undercroft return portal
        const undercroftReturn = Object.values(state.entities).find(
          (e) =>
            e.position?.stratum === 'UNDERCROFT' &&
            e.position.x === smPos.x &&
            e.position.y === smPos.y &&
            e.portal?.target.stratum === 'STREET',
        );
        expect(undercroftReturn).toBeDefined();
        expect(undercroftReturn!.portal!.target.x).toBe(smPos.x);
        expect(undercroftReturn!.portal!.target.y).toBe(smPos.y);
      }
    }
  });

  it('verifies that pneumatic lifts on STREET align with lift platforms on SPIRE at identical (x, y)', () => {
    for (const districtId of CANONICAL_DISTRICTS) {
      const world = createInitialWorld({
        seed: 1088,
        currentDistrictId: BlueprintIdSchema.parse(districtId),
        width: 48,
        height: 36,
      });
      const { state, landmarks } = generateVictorianDistrict(world);

      expect(landmarks.streetLift.x).toBe(landmarks.spireLift.x);
      expect(landmarks.streetLift.y).toBe(landmarks.spireLift.y);

      // Verify pneumatic lift ascending portal
      const streetLift = Object.values(state.entities).find(
        (e) =>
          e.position?.stratum === 'STREET' &&
          e.position.x === landmarks.streetLift.x &&
          e.position.y === landmarks.streetLift.y &&
          e.portal?.target.stratum === 'SPIRE',
      );
      expect(streetLift).toBeDefined();

      // Verify pneumatic lift descending portal
      const spireLift = Object.values(state.entities).find(
        (e) =>
          e.position?.stratum === 'SPIRE' &&
          e.position.x === landmarks.spireLift.x &&
          e.position.y === landmarks.spireLift.y &&
          e.portal?.target.stratum === 'STREET',
      );
      expect(spireLift).toBeDefined();
      expect(spireLift!.portal!.target.x).toBe(streetLift!.position!.x);
      expect(spireLift!.portal!.target.y).toBe(streetLift!.position!.y);
    }
  });

  it('verifies cross-stratum sewer drops and utility shafts align across vertical strata', () => {
    const world = createInitialWorld({
      seed: 1099,
      currentDistrictId: BlueprintIdSchema.parse('district_spitalfields_soot_works'),
      width: 48,
      height: 36,
    });
    const { state } = generateVictorianDistrict(world);

    const shafts = Object.values(state.entities).filter((e) => e.crossStratumShaft);
    expect(shafts.length).toBeGreaterThan(0);

    for (const s of shafts) {
      const comp = s.crossStratumShaft!;
      expect(comp.upperCoord.x).toBe(comp.lowerCoord.x);
      expect(comp.upperCoord.y).toBe(comp.lowerCoord.y);
      if (comp.upperStratum === 'SPIRE') {
        expect(comp.lowerStratum).toBe('STREET');
      } else {
        expect(comp.upperStratum).toBe('STREET');
        expect(comp.lowerStratum).toBe('UNDERCROFT');
      }
    }
  });
});
