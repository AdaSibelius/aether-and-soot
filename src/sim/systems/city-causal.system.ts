import { ConduitEdgeId, EntityId } from '../../schemas/primitives.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { CityGraphNode } from '../../schemas/city-graph.schema.js';
import { EntityRecord } from '../../schemas/components.schema.js';
import { SeededRNG } from '../core/rng.js';
import { WorldState } from '../core/world.js';
import { computeEffectiveConduitFlow } from '../spatial/city-graph.js';

export function advanceCityGraphMacroTick(
  state: WorldState,
  _rng: SeededRNG,
  currentTurn?: number,
): { state: WorldState; events: SimEvent[] } {
  if (!state.cityGraph) {
    return { state, events: [] };
  }

  const turn = currentTurn ?? state.turnCount;
  const events: SimEvent[] = [];
  const nextNodes: Record<string, CityGraphNode> = {};

  for (const [k, v] of Object.entries(state.cityGraph.nodes)) {
    nextNodes[k] = { ...v, reservoirs: { ...v.reservoirs }, flags: { ...v.flags } };
  }
  const nextEdges = { ...state.cityGraph.edges };

  // 1. District baseline generation / consumption
  const spitalfields = nextNodes['district_spitalfields_soot_works'];
  if (spitalfields) {
    spitalfields.reservoirs.anthraciteCoalTons = Math.max(0, spitalfields.reservoirs.anthraciteCoalTons - 15);
    spitalfields.reservoirs.steamHeadKpa += 60;
    spitalfields.reservoirs.miasmaSaturationPpm += 5;
  }

  const whitechapel = nextNodes['district_whitechapel_ward'];
  if (whitechapel) {
    whitechapel.reservoirs.steamHeadKpa = Math.max(0, whitechapel.reservoirs.steamHeadKpa - 20);
    whitechapel.reservoirs.preservedRationsCrates = Math.max(0, whitechapel.reservoirs.preservedRationsCrates - 10);
    whitechapel.reservoirs.carbolicTinctureLiters += 30;
  }

  const limehouse = nextNodes['district_limehouse_docks'];
  if (limehouse) {
    limehouse.reservoirs.steamHeadKpa = Math.max(0, limehouse.reservoirs.steamHeadKpa - 15);
    limehouse.reservoirs.preservedRationsCrates += 40;
  }

  const belgravia = nextNodes['district_belgravia_brass_spires'];
  if (belgravia) {
    belgravia.reservoirs.steamHeadKpa = Math.max(0, belgravia.reservoirs.steamHeadKpa - 40);
    belgravia.reservoirs.preservedRationsCrates = Math.max(0, belgravia.reservoirs.preservedRationsCrates - 15);
    belgravia.reservoirs.carbolicTinctureLiters = Math.max(0, belgravia.reservoirs.carbolicTinctureLiters - 10);
  }

  const fleetDitch = nextNodes['district_fleet_ditch_undercroft'];
  if (fleetDitch) {
    fleetDitch.reservoirs.miasmaSaturationPpm += 15;
    fleetDitch.reservoirs.preservedRationsCrates = Math.max(0, fleetDitch.reservoirs.preservedRationsCrates - 10);
  }

  // 2. Conduit resource propagation
  for (const edge of Object.values(nextEdges)) {
    const src = nextNodes[edge.fromDistrictId];
    const dst = nextNodes[edge.toDistrictId];
    if (!src || !dst) continue;

    const flow = computeEffectiveConduitFlow(edge, src);
    if (flow <= 0) continue;

    if (edge.conduitType === 'STEAM_ARTERIAL') {
      const transfer = Math.min(flow, src.reservoirs.steamHeadKpa * 0.5);
      src.reservoirs.steamHeadKpa = Math.max(0, src.reservoirs.steamHeadKpa - transfer);
      dst.reservoirs.steamHeadKpa += transfer * 0.9;
    } else if (edge.conduitType === 'PNEUMATIC_FREIGHT') {
      if (src.reservoirs.preservedRationsCrates > 0) {
        const transfer = Math.min(flow * 0.5, src.reservoirs.preservedRationsCrates * 0.3);
        src.reservoirs.preservedRationsCrates = Math.max(0, src.reservoirs.preservedRationsCrates - transfer);
        dst.reservoirs.preservedRationsCrates += transfer;
      }
    } else if (edge.conduitType === 'HYDRAULIC_SLUICE' || edge.conduitType === 'SEWER_OUTFALL') {
      const flushed = Math.min(flow * 0.3, src.reservoirs.miasmaSaturationPpm * 0.4);
      src.reservoirs.miasmaSaturationPpm = Math.max(0, src.reservoirs.miasmaSaturationPpm - flushed);
      dst.reservoirs.miasmaSaturationPpm += flushed;
    }
  }

  // 3. Threshold cascades & active district entity/economy impact
  let nextEntities = state.entities;
  let nextEconomy = state.economy;

  for (const node of Object.values(nextNodes)) {
    node.lastUpdatedTurn = turn;

    // Steam Head Outage (< 80 kPa)
    if (node.reservoirs.steamHeadKpa < 80) {
      if (!node.flags.steamOutageActive) {
        node.flags.steamOutageActive = true;
        events.push({
          type: 'DISTRICT_CAUSAL_CASCADE_TRIGGERED', turn, districtId: node.districtId,
          cascadeType: 'STEAM_OUTAGE', detail: `Steam head dropped to ${Math.round(node.reservoirs.steamHeadKpa)} kPa in ${node.districtId}`,
        });
      }
      if (node.districtId === state.currentDistrictId) {
        const updated: Record<string, EntityRecord> = { ...nextEntities };
        let modified = false;
        for (const [id, ent] of Object.entries(nextEntities)) {
          if (ent.utilityConduit?.conduitType === 'HIGH_PRESSURE_STEAM_MAIN' && ent.utilityConduit.operatingPressureKpa > 0) {
            updated[id] = { ...ent, utilityConduit: { ...ent.utilityConduit, operatingPressureKpa: 0 } };
            modified = true;
          }
        }
        if (modified) nextEntities = updated;
      }
    } else {
      node.flags.steamOutageActive = false;
    }

    // Carbolic Tincture Clinic Stockout (< 10 L)
    if (node.reservoirs.carbolicTinctureLiters < 10) {
      if (!node.flags.clinicStockoutActive) {
        node.flags.clinicStockoutActive = true;
        events.push({
          type: 'DISTRICT_CAUSAL_CASCADE_TRIGGERED', turn, districtId: node.districtId,
          cascadeType: 'CLINIC_STOCKOUT', detail: `Carbolic tincture dropped to ${Math.round(node.reservoirs.carbolicTinctureLiters)}L in ${node.districtId}`,
        });
      }
      const quote = nextEconomy.marketQuotes['AETHER_VIAL'];
      if (node.districtId === state.currentDistrictId && quote) {
        nextEconomy = {
          ...nextEconomy,
          marketQuotes: { ...nextEconomy.marketQuotes, AETHER_VIAL: { ...quote, currentPricePence: Math.round(quote.currentPricePence * 1.5) } },
        };
      }
    } else {
      node.flags.clinicStockoutActive = false;
    }

    // Preserved Rations Worker Strike (< 10 crates)
    if (node.reservoirs.preservedRationsCrates < 10) {
      if (!node.flags.workerStrikeActive) {
        node.flags.workerStrikeActive = true;
        events.push({
          type: 'DISTRICT_CAUSAL_CASCADE_TRIGGERED', turn, districtId: node.districtId,
          cascadeType: 'WORKER_STRIKE', detail: `Preserved rations dropped to ${Math.round(node.reservoirs.preservedRationsCrates)} crates in ${node.districtId}`,
        });
      }
      node.reservoirs.laborUnrestPct = Math.min(100, node.reservoirs.laborUnrestPct + 15);
      const coalQuote = nextEconomy.marketQuotes['ANTHRACITE_COAL'];
      if (node.districtId === state.currentDistrictId && coalQuote) {
        nextEconomy = {
          ...nextEconomy,
          marketQuotes: { ...nextEconomy.marketQuotes, ANTHRACITE_COAL: { ...coalQuote, currentPricePence: Math.round(coalQuote.currentPricePence * 1.5) } },
        };
      }
    } else {
      node.flags.workerStrikeActive = false;
    }

    // Sluice Flooding Miasma Saturation (> 75 PPM)
    if (node.reservoirs.miasmaSaturationPpm > 75) {
      if (!node.flags.sluiceFloodedActive) {
        node.flags.sluiceFloodedActive = true;
        events.push({
          type: 'DISTRICT_CAUSAL_CASCADE_TRIGGERED', turn, districtId: node.districtId,
          cascadeType: 'SLUICE_FLOODED', detail: `Miasma saturation reached ${Math.round(node.reservoirs.miasmaSaturationPpm)} PPM in ${node.districtId}`,
        });
      }
      if (node.districtId === state.currentDistrictId) {
        const updated: Record<string, EntityRecord> = { ...nextEntities };
        let modified = false;
        for (const [id, ent] of Object.entries(nextEntities)) {
          if (ent.hydrologyChannel?.sluiceOpen) {
            updated[id] = { ...ent, hydrologyChannel: { ...ent.hydrologyChannel, sluiceOpen: false } };
            modified = true;
          }
        }
        if (modified) nextEntities = updated;
      }
    } else {
      node.flags.sluiceFloodedActive = false;
    }
  }

  return {
    state: { ...state, cityGraph: { nodes: nextNodes, edges: nextEdges }, entities: nextEntities, economy: nextEconomy },
    events,
  };
}

export function resolveModulateCausalConduit(
  state: WorldState,
  actorId: EntityId,
  edgeId: ConduitEdgeId,
  action: 'OPEN_VALVE' | 'CLOSE_VALVE' | 'SABOTAGE_CONDUIT' | 'REPAIR_CONDUIT',
): { state: WorldState; events: SimEvent[]; apSpent: number } {
  if (!state.cityGraph?.edges[edgeId]) return { state, events: [], apSpent: 0 };
  const edge = { ...state.cityGraph.edges[edgeId] };
  let apSpent = 50;

  if (action === 'OPEN_VALVE') edge.valveOpen = true;
  else if (action === 'CLOSE_VALVE') edge.valveOpen = false;
  else if (action === 'SABOTAGE_CONDUIT') { edge.integrityPct = 0; apSpent = 100; }
  else if (action === 'REPAIR_CONDUIT') { edge.integrityPct = Math.min(100, edge.integrityPct + 50); apSpent = 100; }

  const event: SimEvent = {
    type: 'CAUSAL_CONDUIT_MODULATED', turn: state.turnCount, actorId, edgeId, action,
    valveOpen: edge.valveOpen, integrityPct: edge.integrityPct,
  };

  return {
    state: { ...state, cityGraph: { ...state.cityGraph, edges: { ...state.cityGraph.edges, [edgeId]: edge } } },
    events: [event],
    apSpent,
  };
}
