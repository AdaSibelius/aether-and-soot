import { describe, expect, it } from 'vitest';
import {
  CausalConduitTypeSchema,
  ChunkKeySchema,
  ConduitEdgeIdSchema,
} from '../../src/schemas/primitives.schema.js';
import {
  CausalConduitEdgeSchema,
  CityGraphLedgerSchema,
  CityGraphNodeSchema,
  DistrictCausalFlagsSchema,
  DistrictResourceReservoirSchema,
} from '../../src/schemas/city-graph.schema.js';

describe('CityGraphSchema & Flat Relational Ledger Validation', () => {
  const validReservoir = {
    steamHeadKpa: 750.5,
    anthraciteCoalTons: 120,
    carbolicTinctureLiters: 45.2,
    preservedRationsCrates: 300,
    miasmaSaturationPpm: 12.8,
    laborUnrestPct: 35,
  };

  const validFlags = {
    steamOutageActive: false,
    clinicStockoutActive: false,
    workerStrikeActive: true,
    sluiceFloodedActive: false,
  };

  it('validates branded chunk and conduit edge IDs', () => {
    const chunkKey = ChunkKeySchema.parse('chunk:12,34:STREET');
    expect(chunkKey).toBe('chunk:12,34:STREET');
    expect(() => ChunkKeySchema.parse('')).toThrow();

    const edgeId = ConduitEdgeIdSchema.parse('conduit_steam_spitalfields_whitechapel');
    expect(edgeId).toBe('conduit_steam_spitalfields_whitechapel');
    expect(() => ConduitEdgeIdSchema.parse('')).toThrow();

    expect(CausalConduitTypeSchema.parse('STEAM_ARTERIAL')).toBe('STEAM_ARTERIAL');
    expect(CausalConduitTypeSchema.parse('HYDRAULIC_SLUICE')).toBe('HYDRAULIC_SLUICE');
    expect(CausalConduitTypeSchema.parse('PNEUMATIC_FREIGHT')).toBe('PNEUMATIC_FREIGHT');
    expect(CausalConduitTypeSchema.parse('AETHER_TELEGRAPH')).toBe('AETHER_TELEGRAPH');
    expect(CausalConduitTypeSchema.parse('SEWER_OUTFALL')).toBe('SEWER_OUTFALL');
    expect(() => CausalConduitTypeSchema.parse('INVALID_TYPE')).toThrow();
  });

  it('parses valid DistrictResourceReservoir and enforces non-negative constraints', () => {
    const parsed = DistrictResourceReservoirSchema.parse(validReservoir);
    expect(parsed.steamHeadKpa).toBe(750.5);
    expect(parsed.laborUnrestPct).toBe(35);

    expect(() =>
      DistrictResourceReservoirSchema.parse({ ...validReservoir, steamHeadKpa: -1 }),
    ).toThrow();
    expect(() =>
      DistrictResourceReservoirSchema.parse({ ...validReservoir, anthraciteCoalTons: -0.1 }),
    ).toThrow();
    expect(() =>
      DistrictResourceReservoirSchema.parse({ ...validReservoir, carbolicTinctureLiters: -5 }),
    ).toThrow();
    expect(() =>
      DistrictResourceReservoirSchema.parse({ ...validReservoir, preservedRationsCrates: -10 }),
    ).toThrow();
    expect(() =>
      DistrictResourceReservoirSchema.parse({ ...validReservoir, miasmaSaturationPpm: -0.01 }),
    ).toThrow();
    expect(() =>
      DistrictResourceReservoirSchema.parse({ ...validReservoir, laborUnrestPct: -1 }),
    ).toThrow();
    expect(() =>
      DistrictResourceReservoirSchema.parse({ ...validReservoir, laborUnrestPct: 101 }),
    ).toThrow();
  });

  it('parses DistrictCausalFlags with robust false defaults', () => {
    const emptyFlags = DistrictCausalFlagsSchema.parse({});
    expect(emptyFlags.steamOutageActive).toBe(false);
    expect(emptyFlags.clinicStockoutActive).toBe(false);
    expect(emptyFlags.workerStrikeActive).toBe(false);
    expect(emptyFlags.sluiceFloodedActive).toBe(false);

    const partialFlags = DistrictCausalFlagsSchema.parse({ steamOutageActive: true });
    expect(partialFlags.steamOutageActive).toBe(true);
    expect(partialFlags.clinicStockoutActive).toBe(false);
  });

  it('parses CityGraphNode with flat relational blueprint and faction IDs', () => {
    const node = CityGraphNodeSchema.parse({
      districtId: 'district_spitalfields_smelting',
      controllingFactionId: 'IRONMONGERS_CARTEL',
      reservoirs: validReservoir,
      flags: validFlags,
      lastUpdatedTurn: 140,
    });

    expect(node.districtId).toBe('district_spitalfields_smelting');
    expect(node.controllingFactionId).toBe('IRONMONGERS_CARTEL');
    expect(node.flags.workerStrikeActive).toBe(true);
    expect(node.lastUpdatedTurn).toBe(140);

    expect(() =>
      CityGraphNodeSchema.parse({
        districtId: '',
        controllingFactionId: 'IRONMONGERS_CARTEL',
        reservoirs: validReservoir,
        lastUpdatedTurn: 0,
      }),
    ).toThrow();

    expect(() =>
      CityGraphNodeSchema.parse({
        districtId: 'district_valid',
        controllingFactionId: '',
        reservoirs: validReservoir,
        lastUpdatedTurn: -1,
      }),
    ).toThrow();
  });

  it('parses CausalConduitEdgeSchema and validates boundary conditions', () => {
    const validEdge = {
      edgeId: 'conduit_edge_001',
      conduitType: 'STEAM_ARTERIAL',
      fromDistrictId: 'district_spitalfields_smelting',
      toDistrictId: 'district_limehouse_docks',
      stratum: 'STREET',
      capacityPerMacroTick: 100,
      integrityPct: 85,
      valveOpen: true,
      tollTariffPct: 15,
    };

    const parsed = CausalConduitEdgeSchema.parse(validEdge);
    expect(parsed.capacityPerMacroTick).toBe(100);
    expect(parsed.integrityPct).toBe(85);
    expect(parsed.tollTariffPct).toBe(15);

    // Boundary conditions for integrityPct [0, 100]
    expect(CausalConduitEdgeSchema.parse({ ...validEdge, integrityPct: 0 }).integrityPct).toBe(0);
    expect(CausalConduitEdgeSchema.parse({ ...validEdge, integrityPct: 100 }).integrityPct).toBe(100);
    expect(() => CausalConduitEdgeSchema.parse({ ...validEdge, integrityPct: -0.1 })).toThrow();
    expect(() => CausalConduitEdgeSchema.parse({ ...validEdge, integrityPct: 100.1 })).toThrow();

    // Boundary conditions for tollTariffPct [0, 200]
    expect(CausalConduitEdgeSchema.parse({ ...validEdge, tollTariffPct: 0 }).tollTariffPct).toBe(0);
    expect(CausalConduitEdgeSchema.parse({ ...validEdge, tollTariffPct: 200 }).tollTariffPct).toBe(200);
    expect(() => CausalConduitEdgeSchema.parse({ ...validEdge, tollTariffPct: -1 })).toThrow();
    expect(() => CausalConduitEdgeSchema.parse({ ...validEdge, tollTariffPct: 201 })).toThrow();

    // capacityPerMacroTick non-negative
    expect(() => CausalConduitEdgeSchema.parse({ ...validEdge, capacityPerMacroTick: -5 })).toThrow();
  });

  it('validates flat relational CityGraphLedgerSchema parsing and record lookup', () => {
    const ledger = CityGraphLedgerSchema.parse({
      nodes: {
        district_limehouse: {
          districtId: 'district_limehouse',
          controllingFactionId: 'UNDERCROFT_SYNDICATE',
          reservoirs: validReservoir,
          flags: validFlags,
          lastUpdatedTurn: 10,
        },
      },
      edges: {
        edge_limehouse_spitalfields: {
          edgeId: 'edge_limehouse_spitalfields',
          conduitType: 'HYDRAULIC_SLUICE',
          fromDistrictId: 'district_limehouse',
          toDistrictId: 'district_spitalfields',
          stratum: 'UNDERCROFT',
          capacityPerMacroTick: 50,
          integrityPct: 92,
          valveOpen: true,
          tollTariffPct: 5,
        },
      },
    });

    expect(ledger.nodes.district_limehouse).toBeDefined();
    expect(ledger.nodes.district_limehouse?.districtId).toBe('district_limehouse');
    expect(ledger.edges.edge_limehouse_spitalfields).toBeDefined();
    expect(ledger.edges.edge_limehouse_spitalfields?.conduitType).toBe('HYDRAULIC_SLUICE');

    // Default empty ledger
    const emptyLedger = CityGraphLedgerSchema.parse({});
    expect(emptyLedger.nodes).toEqual({});
    expect(emptyLedger.edges).toEqual({});
  });
});
