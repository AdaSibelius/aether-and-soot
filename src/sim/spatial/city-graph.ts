import { BlueprintId, BlueprintIdSchema, ConduitEdgeIdSchema } from '../../schemas/primitives.schema.js';
import {
  CausalConduitEdge,
  CityGraphLedger,
  CityGraphNode,
  DistrictResourceReservoir,
} from '../../schemas/city-graph.schema.js';
import { METROPOLIS_DISTRICT_DOSSIERS } from './overworld-matrix.js';

const INITIAL_DISTRICT_RESERVOIRS: Record<string, DistrictResourceReservoir> = {
  district_spitalfields_soot_works: { steamHeadKpa: 500, anthraciteCoalTons: 350, carbolicTinctureLiters: 25, preservedRationsCrates: 40, miasmaSaturationPpm: 30, laborUnrestPct: 15 },
  district_whitechapel_ward: { steamHeadKpa: 120, anthraciteCoalTons: 40, carbolicTinctureLiters: 250, preservedRationsCrates: 30, miasmaSaturationPpm: 25, laborUnrestPct: 20 },
  district_limehouse_docks: { steamHeadKpa: 140, anthraciteCoalTons: 80, carbolicTinctureLiters: 30, preservedRationsCrates: 400, miasmaSaturationPpm: 30, laborUnrestPct: 10 },
  district_fleet_ditch_undercroft: { steamHeadKpa: 90, anthraciteCoalTons: 30, carbolicTinctureLiters: 15, preservedRationsCrates: 25, miasmaSaturationPpm: 60, laborUnrestPct: 20 },
  district_belgravia_brass_spires: { steamHeadKpa: 110, anthraciteCoalTons: 35, carbolicTinctureLiters: 40, preservedRationsCrates: 50, miasmaSaturationPpm: 5, laborUnrestPct: 5 },
};

const DEFAULT_RESERVOIR: DistrictResourceReservoir = {
  steamHeadKpa: 100, anthraciteCoalTons: 50, carbolicTinctureLiters: 30, preservedRationsCrates: 50, miasmaSaturationPpm: 20, laborUnrestPct: 10,
};

export function createInitialCityGraphLedger(): CityGraphLedger {
  const nodes: Record<string, CityGraphNode> = {};

  for (const [districtKey, dossier] of Object.entries(METROPOLIS_DISTRICT_DOSSIERS)) {
    const reservoirs = INITIAL_DISTRICT_RESERVOIRS[districtKey] ?? { ...DEFAULT_RESERVOIR };
    nodes[districtKey] = {
      districtId: dossier.id,
      controllingFactionId: dossier.controllingFactionId,
      reservoirs,
      flags: {
        steamOutageActive: false,
        clinicStockoutActive: false,
        workerStrikeActive: false,
        sluiceFloodedActive: false,
      },
      lastUpdatedTurn: 0,
    };
  }

  const edges: Record<string, CausalConduitEdge> = {
    edge_spitalfields_belgravia_steam: {
      edgeId: ConduitEdgeIdSchema.parse('edge_spitalfields_belgravia_steam'),
      conduitType: 'STEAM_ARTERIAL',
      fromDistrictId: BlueprintIdSchema.parse('district_spitalfields_soot_works'),
      toDistrictId: BlueprintIdSchema.parse('district_belgravia_brass_spires'),
      stratum: 'SPIRE',
      capacityPerMacroTick: 80,
      integrityPct: 100,
      valveOpen: true,
      tollTariffPct: 10,
    },
    edge_spitalfields_whitechapel_steam: {
      edgeId: ConduitEdgeIdSchema.parse('edge_spitalfields_whitechapel_steam'),
      conduitType: 'STEAM_ARTERIAL',
      fromDistrictId: BlueprintIdSchema.parse('district_spitalfields_soot_works'),
      toDistrictId: BlueprintIdSchema.parse('district_whitechapel_ward'),
      stratum: 'STREET',
      capacityPerMacroTick: 60,
      integrityPct: 100,
      valveOpen: true,
      tollTariffPct: 5,
    },
    edge_limehouse_spitalfields_freight: {
      edgeId: ConduitEdgeIdSchema.parse('edge_limehouse_spitalfields_freight'),
      conduitType: 'PNEUMATIC_FREIGHT',
      fromDistrictId: BlueprintIdSchema.parse('district_limehouse_docks'),
      toDistrictId: BlueprintIdSchema.parse('district_spitalfields_soot_works'),
      stratum: 'STREET',
      capacityPerMacroTick: 50,
      integrityPct: 100,
      valveOpen: true,
      tollTariffPct: 5,
    },
    edge_limehouse_whitechapel_freight: {
      edgeId: ConduitEdgeIdSchema.parse('edge_limehouse_whitechapel_freight'),
      conduitType: 'PNEUMATIC_FREIGHT',
      fromDistrictId: BlueprintIdSchema.parse('district_limehouse_docks'),
      toDistrictId: BlueprintIdSchema.parse('district_whitechapel_ward'),
      stratum: 'STREET',
      capacityPerMacroTick: 40,
      integrityPct: 100,
      valveOpen: true,
      tollTariffPct: 5,
    },
    edge_whitechapel_spitalfields_telegraph: {
      edgeId: ConduitEdgeIdSchema.parse('edge_whitechapel_spitalfields_telegraph'),
      conduitType: 'AETHER_TELEGRAPH',
      fromDistrictId: BlueprintIdSchema.parse('district_whitechapel_ward'),
      toDistrictId: BlueprintIdSchema.parse('district_spitalfields_soot_works'),
      stratum: 'STREET',
      capacityPerMacroTick: 30,
      integrityPct: 100,
      valveOpen: true,
      tollTariffPct: 0,
    },
    edge_whitechapel_fleet_sluice: {
      edgeId: ConduitEdgeIdSchema.parse('edge_whitechapel_fleet_sluice'),
      conduitType: 'HYDRAULIC_SLUICE',
      fromDistrictId: BlueprintIdSchema.parse('district_whitechapel_ward'),
      toDistrictId: BlueprintIdSchema.parse('district_fleet_ditch_undercroft'),
      stratum: 'UNDERCROFT',
      capacityPerMacroTick: 50,
      integrityPct: 100,
      valveOpen: true,
      tollTariffPct: 0,
    },
    edge_spitalfields_fleet_sewer: {
      edgeId: ConduitEdgeIdSchema.parse('edge_spitalfields_fleet_sewer'),
      conduitType: 'SEWER_OUTFALL',
      fromDistrictId: BlueprintIdSchema.parse('district_spitalfields_soot_works'),
      toDistrictId: BlueprintIdSchema.parse('district_fleet_ditch_undercroft'),
      stratum: 'UNDERCROFT',
      capacityPerMacroTick: 60,
      integrityPct: 100,
      valveOpen: true,
      tollTariffPct: 0,
    },
  };

  return { nodes, edges };
}

export function getUpstreamConduits(
  graph: CityGraphLedger,
  districtId: BlueprintId | string,
): CausalConduitEdge[] {
  return Object.values(graph.edges).filter((edge) => edge.toDistrictId === districtId);
}

export function getDownstreamConduits(
  graph: CityGraphLedger,
  districtId: BlueprintId | string,
): CausalConduitEdge[] {
  return Object.values(graph.edges).filter((edge) => edge.fromDistrictId === districtId);
}

export function computeEffectiveConduitFlow(
  edge: CausalConduitEdge,
  _sourceNode?: CityGraphNode,
): number {
  if (!edge.valveOpen || edge.integrityPct <= 0) {
    return 0;
  }
  return edge.capacityPerMacroTick * (edge.integrityPct / 100);
}
