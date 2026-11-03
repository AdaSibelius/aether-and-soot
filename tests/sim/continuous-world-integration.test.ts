import { describe, expect, it } from 'vitest';
import { resolveContinuousLookaheadCell } from '../../src/client/projection/continuous-projection.js';
import { projectWorldToVisualFrame } from '../../src/client/projection/frame-adapter.js';
import { BlueprintIdSchema, EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { SeededRNG } from '../../src/sim/core/rng.js';
import { createInitialWorld, WorldState } from '../../src/sim/core/world.js';
import {
  EXPANDED_BUILDING_TEMPLATES,
  getDistrictTailoredTemplate,
} from '../../src/sim/spatial/building-templates-expanded.js';
import { computeDistrictBoundarySeams } from '../../src/sim/spatial/district-boundaries.js';
import { generateVictorianDistrict } from '../../src/sim/spatial/generator.js';
import { setTileCell } from '../../src/sim/spatial/grid.js';
import { runSpatialAnomalyAudit } from '../../src/sim/spatial/spatial-anomaly-detector.js';
import { runDistrictSurveyAudit } from '../../src/sim/spatial/spatial-anomaly-district.js';
import { applySpatialSelfCorrection } from '../../src/sim/spatial/spatial-self-corrector.js';
import {
  formatSurveySheetMarkdown,
  generateSpatialSurveySheet,
} from '../../src/sim/spatial/spatial-survey-sheet.js';
import { PlacedBuildingSurvey } from '../../src/sim/spatial/spatial-survey-types.js';
import { subdivideProceduralParcels } from '../../src/sim/spatial/urban-parcels.js';
import { continuousTransitSystem } from '../../src/sim/systems/continuous-transit.system.js';
import {
  computeCloudSavings,
  formatLedgerSummaryTable,
  getInferenceLedgerSummary,
} from '../scripts/local-llm-ledger.js';

describe('Milestone 4: Continuous World, Survey Sheets & Token Audit E2E Integration', () => {
  const playerId = EntityIdSchema.parse('actor_player');
  const companionId = EntityIdSchema.parse('npc_companion_hound');
  const sootWorksId = BlueprintIdSchema.parse('district_spitalfields_soot_works');

  it('subdivides expanded 64x48 districts, aligns border seams, and resolves tailored building templates', () => {
    const rng = new SeededRNG(6060);
    const subdivision = subdivideProceduralParcels({ width: 64, height: 48 }, rng);
    expect(subdivision.parcels.length).toBeGreaterThanOrEqual(8);
    expect(EXPANDED_BUILDING_TEMPLATES.length).toBe(3);

    expect(getDistrictTailoredTemplate('district_spitalfields_soot_works').id).toBe('building_bessemer_foundry');
    expect(getDistrictTailoredTemplate('district_limehouse_docks').id).toBe('building_dockside_warehouse');
    expect(getDistrictTailoredTemplate('district_belgravia_brass_spires').id).toBe('building_clockwork_salon');

    const seams = computeDistrictBoundarySeams(sootWorksId, 64, 48);
    expect(seams.north.length + seams.south.length + seams.east.length + seams.west.length).toBeGreaterThan(0);
  });

  it('executes Fallout: New York 6-layer spatial survey and self-corrects injected doorway & pathway defects', () => {
    const base = createInitialWorld({ seed: 7070, width: 48, height: 36, currentDistrictId: sootWorksId });
    const { state, landmarks } = generateVictorianDistrict(base);
    let grid = state.strata.STREET!;
    const hub = landmarks.streetManhole;

    const syntheticBuilding: PlacedBuildingSurvey = {
      id: 'bldg_foundry_test',
      archetypeId: 'FOUNDRY',
      templateId: 'building_bessemer_foundry',
      bounds: { x1: 6, y1: 6, x2: 14, y2: 12 },
      entrancePoints: [{ x: 10, y: 12 }],
      outwardPoints: [{ x: 10, y: 13 }],
      doors: { front: { x: 10, y: 12 } },
    };

    grid = setTileCell(grid, 10, 12, () => ({
      terrainType: 'WOODEN_DOOR_CLOSED',
      blocksMovement: false,
      blocksSight: true,
    }));
    grid = setTileCell(grid, 10, 13, () => ({
      terrainType: 'WROUGHT_IRON_FENCE',
      blocksMovement: true,
      blocksSight: false,
    }));

    const preAnomalies = runSpatialAnomalyAudit(
      grid,
      state.entities,
      [syntheticBuilding],
      hub,
      [{ x: 10, y: 12 }],
      [],
    );
    expect(preAnomalies.some((a) => a.type === 'BLOCKED_DOORWAY')).toBe(true);

    const corrected = applySpatialSelfCorrection(
      grid,
      state.entities,
      [syntheticBuilding],
      hub,
      [{ x: 10, y: 12 }],
      [],
    );
    expect(corrected.corrections.length).toBeGreaterThan(0);

    const postAnomalies = runSpatialAnomalyAudit(
      corrected.grid,
      corrected.entities,
      corrected.buildings,
      hub,
      [{ x: 10, y: 12 }],
      [],
    );
    expect(postAnomalies.filter((a) => a.type === 'BLOCKED_DOORWAY').length).toBe(0);

    const sheet = generateSpatialSurveySheet({
      districtId: sootWorksId,
      stratum: 'STREET',
      seed: 7070,
      grid: corrected.grid,
      entities: corrected.entities,
      buildings: corrected.buildings,
      anomalies: postAnomalies,
      corrections: corrected.corrections,
      hub,
    });
    expect(sheet.layers.terrain.length).toBe(36);
    expect(sheet.layers.architecture.length).toBe(36);
    expect(sheet.layers.anomalyHeatmap.length).toBe(36);
    const dossier = formatSurveySheetMarkdown(sheet);
    expect(dossier).toContain('# Spatial Survey Dossier');
    expect(dossier).toContain('Layer 5: Diagnostic Anomaly Heatmap');
  });

  it('transits seamlessly across open district border seams while preserving companions and lookahead projection', () => {
    const world = createInitialWorld({ seed: 8080, width: 48, height: 36, currentDistrictId: sootWorksId });
    const worldWithCompanion: WorldState = {
      ...world,
      currentDistrictId: sootWorksId,
      entities: {
        ...world.entities,
        [companionId]: {
          id: companionId,
          name: 'Pneumatic Automaton Hound',
          visual: { glyph: 'd', fgPrimary: '#D4AF37', fgSecondary: '#A68019', bgColor: '#0A0D0E', shaderFlags: [] },
          position: { x: 46, y: 18, stratum: 'STREET', blocksMovement: true, blocksSight: false },
          aiController: {
            factionId: 'IRONMONGERS_CARTEL',
            role: 'CITIZEN',
            hostile: false,
            alertState: 'IDLE',
            companionOfActorId: playerId,
          },
        },
        [playerId]: {
          ...world.entities[playerId]!,
          position: { x: 47, y: 18, stratum: 'STREET', blocksMovement: true, blocksSight: false },
        },
      },
    };

    const lookahead = resolveContinuousLookaheadCell(worldWithCompanion, 'STREET', 48, 18, 48, 36, 0, 0);
    expect(lookahead).toBeDefined();
    expect(lookahead?.visual.glyph).toBeDefined();
    expect(lookahead?.layers?.floor.alpha).toBeCloseTo(0.65, 2);

    const transit = continuousTransitSystem(worldWithCompanion, playerId, { x: 48, y: 18 });
    expect(transit.traversed).toBe(true);
    expect(transit.state.currentDistrictId).toBe('district_limehouse_docks');
    expect(transit.state.entities[companionId]).toBeDefined();
    expect(transit.state.entities[companionId]?.position?.stratum).toBe('STREET');

    const frame = projectWorldToVisualFrame(transit.state, playerId, 12);
    expect(frame.cells.length).toBeGreaterThan(0);
  });

  it('audits local LLM token ledger and computes cloud API cost savings accurately', () => {
    const savings = computeCloudSavings(265_337, 504_013);
    expect(savings).toBeCloseTo(8.36, 2);

    const summary = getInferenceLedgerSummary();
    expect(summary.totalEntries).toBeGreaterThan(0);
    expect(summary.totalTokens).toBe(summary.totalPromptTokens + summary.totalCompletionTokens);
    expect(summary.estimatedCloudSavingsUsd).toBeGreaterThan(0);

    const table = formatLedgerSummaryTable(summary);
    expect(table).toContain('# Local LLM Inference Ledger & Token Audit');
    expect(table).toContain('Estimated Cloud Cost');
  });

  it('guarantees zero sealed edges, unreciprocated seams, or orphan doors across all 5 districts', () => {
    const districts = [
      'district_spitalfields_soot_works',
      'district_fleet_ditch_undercroft',
      'district_whitechapel_ward',
      'district_limehouse_docks',
      'district_belgravia_brass_spires',
    ] as const;

    for (const id of districts) {
      const districtId = BlueprintIdSchema.parse(id);
      const world = createInitialWorld({ seed: 1, width: 48, height: 36, currentDistrictId: districtId });
      const { state, landmarks } = generateVictorianDistrict(world);
      const anomalies = runDistrictSurveyAudit(state.strata.STREET!, districtId, landmarks.streetManhole);
      expect(anomalies).toEqual([]);
    }
  });
});
