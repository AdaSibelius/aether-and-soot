/**
 * npm run survey:world [-- --seeds 8 --out tests/artifacts/survey-sheets]
 *
 * Generates every district through the PRODUCTION pipeline (`generateVictorianDistrict`, the same call the game makes
 * at boot and on district travel), audits the result, and writes 6-layer survey-sheet dossiers. Exits 1 on any
 * FATAL/ERROR anomaly so a regression like a walled-in district or floating doors fails loudly instead of shipping.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BlueprintIdSchema } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { generateVictorianDistrict } from '../../src/sim/spatial/generator.js';
import { runSpatialAnomalyAudit } from '../../src/sim/spatial/spatial-anomaly-detector.js';
import { runDistrictSurveyAudit } from '../../src/sim/spatial/spatial-anomaly-district.js';
import { formatSurveySheetMarkdown, generateSpatialSurveySheet } from '../../src/sim/spatial/spatial-survey-sheet.js';
import { SpatialAnomaly } from '../../src/sim/spatial/spatial-survey-types.js';

export const SURVEY_DISTRICTS = [
  'district_spitalfields_soot_works',
  'district_fleet_ditch_undercroft',
  'district_whitechapel_ward',
  'district_limehouse_docks',
  'district_belgravia_brass_spires',
] as const;

function argValue(flag: string, fallback: string): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

export interface DistrictSurveyRow {
  readonly districtId: string;
  readonly seed: number;
  readonly anomalies: readonly SpatialAnomaly[];
  readonly dossier: string;
}

export function surveyDistrict(districtId: string, seed: number): DistrictSurveyRow {
  const id = BlueprintIdSchema.parse(districtId);
  const { state, landmarks } = generateVictorianDistrict(createInitialWorld({ seed, currentDistrictId: id }));
  const grid = state.strata.STREET!;
  const hub = landmarks.streetManhole;
  const gates = [landmarks.westGate, landmarks.eastGate, landmarks.northGate, landmarks.southGate].filter(
    (p): p is NonNullable<typeof p> => p !== undefined,
  );
  const anomalies = [
    ...runDistrictSurveyAudit(grid, id, hub),
    ...runSpatialAnomalyAudit(grid, state.entities, [], hub, [...gates, landmarks.streetLift, landmarks.foundryBoiler], []),
  ];
  const sheet = generateSpatialSurveySheet({ districtId, stratum: 'STREET', seed, grid, entities: state.entities, anomalies, hub });
  return { districtId, seed, anomalies, dossier: formatSurveySheetMarkdown(sheet) };
}

function main(): void {
  const seeds = Number(argValue('--seeds', '8'));
  const outDir = argValue('--out', 'tests/artifacts/survey-sheets');
  mkdirSync(outDir, { recursive: true });
  const lines = ['# World Survey Summary', '', '| District | Seed | Sealed edges | Unreciprocated seams | Orphan doors | Other |', '|---|---|---|---|---|---|'];
  let failing = 0;
  for (const districtId of SURVEY_DISTRICTS) {
    for (let seed = 1; seed <= seeds; seed++) {
      const row = surveyDistrict(districtId, seed);
      const count = (t: string): number => row.anomalies.filter((a) => a.type === t).length;
      const other = row.anomalies.length - count('SEALED_DISTRICT_EDGE') - count('UNRECIPROCATED_SEAM') - count('ORPHAN_DOOR');
      if (row.anomalies.some((a) => a.severity !== 'WARNING')) failing++;
      lines.push(`| ${districtId} | ${seed} | ${count('SEALED_DISTRICT_EDGE')} | ${count('UNRECIPROCATED_SEAM')} | ${count('ORPHAN_DOOR')} | ${other} |`);
      if (seed === 1 || row.anomalies.length > 0) writeFileSync(join(outDir, `${districtId}-seed${seed}.md`), row.dossier);
    }
  }
  writeFileSync(join(outDir, 'summary.md'), lines.join('\n') + '\n');
  console.log(lines.join('\n'));
  console.log(`\n[survey:world] ${failing} of ${SURVEY_DISTRICTS.length * seeds} district surveys have FATAL/ERROR anomalies. Dossiers: ${outDir}`);
  if (failing > 0) process.exit(1);
}

if (process.argv[1]?.endsWith('survey-world.ts')) main();
