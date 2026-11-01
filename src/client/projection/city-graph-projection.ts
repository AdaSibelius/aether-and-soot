import { CityGraphLedger } from '../../schemas/city-graph.schema.js';
import { ChunkStreamingLedger } from '../../schemas/chunk-streaming.schema.js';

export interface DistrictCausalSummary {
  readonly districtId: string;
  readonly steamKpa: number;
  readonly coalTons: number;
  readonly carbolicLiters: number;
  readonly rationsCrates: number;
  readonly miasmaPpm: number;
  readonly unrestPct: number;
  readonly activeAlerts: readonly string[];
}

export interface ConduitTelemetrySummary {
  readonly edgeId: string;
  readonly conduitType: string;
  readonly sourceDistrict: string;
  readonly targetDistrict: string;
  readonly capacity: number;
  readonly integrityPct: number;
  readonly valveOpen: boolean;
}

export interface ChunkStreamingSummary {
  readonly activeCount: number;
  readonly dormantCount: number;
  readonly centerLabel: string;
}

export function projectDistrictCausalSummary(
  graph: Readonly<CityGraphLedger> | undefined,
  districtId: string,
): DistrictCausalSummary | undefined {
  if (!graph) return undefined;
  const node = graph.nodes[districtId];
  if (!node) return undefined;

  const alerts: string[] = [];
  if (node.flags.steamOutageActive) alerts.push('STEAM OUTAGE');
  if (node.flags.clinicStockoutActive) alerts.push('CLINIC STOCKOUT');
  if (node.flags.workerStrikeActive) alerts.push('WORKER STRIKE');
  if (node.flags.sluiceFloodedActive) alerts.push('SLUICE FLOODED');

  return {
    districtId: node.districtId,
    steamKpa: Math.round(node.reservoirs.steamHeadKpa),
    coalTons: Math.round(node.reservoirs.anthraciteCoalTons),
    carbolicLiters: Math.round(node.reservoirs.carbolicTinctureLiters),
    rationsCrates: Math.round(node.reservoirs.preservedRationsCrates),
    miasmaPpm: Math.round(node.reservoirs.miasmaSaturationPpm),
    unrestPct: Math.round(node.reservoirs.laborUnrestPct),
    activeAlerts: alerts,
  };
}

export function projectDistrictConduits(
  graph: Readonly<CityGraphLedger> | undefined,
  districtId: string,
): readonly ConduitTelemetrySummary[] {
  if (!graph) return [];
  const results: ConduitTelemetrySummary[] = [];

  for (const [edgeId, edge] of Object.entries(graph.edges)) {
    if (edge.fromDistrictId === districtId || edge.toDistrictId === districtId) {
      results.push({
        edgeId,
        conduitType: edge.conduitType,
        sourceDistrict: edge.fromDistrictId,
        targetDistrict: edge.toDistrictId,
        capacity: edge.capacityPerMacroTick,
        integrityPct: edge.integrityPct,
        valveOpen: edge.valveOpen,
      });
    }
  }

  return results;
}

export function projectChunkStreamingSummary(
  ledger: Readonly<ChunkStreamingLedger> | undefined,
): ChunkStreamingSummary {
  if (!ledger) {
    return { activeCount: 0, dormantCount: 0, centerLabel: 'N/A' };
  }
  const center = ledger.activeWindowCenter;
  const centerLabel = center ? `[${center.cx},${center.cy}] (${center.stratum})` : 'N/A';

  return {
    activeCount: ledger.activeChunkKeys.length,
    dormantCount: Object.keys(ledger.dormantChunks).length,
    centerLabel,
  };
}
