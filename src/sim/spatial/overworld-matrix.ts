import { BlueprintId, BlueprintIdSchema } from '../../schemas/primitives.schema.js';
import {
  DistrictDossier,
  FactionInfluenceRecord,
  MacroTopographyCell,
  OverworldBarrier,
  TransitMonorailRoute,
} from '../../schemas/atlas.schema.js';

export const METROPOLIS_DISTRICT_DOSSIERS: Record<string, DistrictDossier> = {
  district_spitalfields_soot_works: {
    id: BlueprintIdSchema.parse('district_spitalfields_soot_works'),
    name: 'Spitalfields Smelting Works', dominantStratum: 'STREET', cartel: 'Ironmongers Cartel', controllingFactionId: 'faction_ironmongers_cartel', smog: '65% Particulate', wealthIndex: 0.75, description: 'Bessemer furnaces, slag mounds, and arterial transit gates.',
    macroCoords: { col: 2, row: 1 }, naturalBarriers: ['Viaduct Monorail Arch', 'Thames Estuary Canal Branch'],
    connectedDistrictIds: [BlueprintIdSchema.parse('district_fleet_ditch_undercroft'), BlueprintIdSchema.parse('district_belgravia_brass_spires')],
    transitTypes: ['STREET_GATE', 'MONORAIL_LINE', 'SEWER_SIPHON'],
    landmarks: [
      { id: 'foundry_boiler', name: 'High-Pressure Foundry Boiler', stratum: 'STREET', category: 'BOILER_PLANT', description: 'Central coal-pressurized steam governor powering district hydraulics.', controllingFactionId: 'faction_ironmongers_cartel', status: 'OPERATIONAL' },
      { id: 'artificer_bench', name: 'Artificer Pneumatic Bench', stratum: 'STREET', category: 'SAFEHOUSE_VAULT', description: 'Precision clockwork lathe and component fabrication bench.', controllingFactionId: 'faction_ironmongers_cartel', status: 'OPERATIONAL' },
      { id: 'monorail_depot', name: 'Spitalfields Monorail Depot', stratum: 'STREET', category: 'MONORAIL_DEPOT', description: 'Pneumatic freight carrier terminus connecting to Belgravia Spires.', controllingFactionId: 'faction_ironmongers_cartel', status: 'OPERATIONAL' },
      { id: 'clocktower', name: 'St. Jude Street Clocktower', stratum: 'STREET', category: 'CLOCKTOWER', description: 'Mechanical chime tower regulating 4-shift work whistles.', controllingFactionId: 'faction_ironmongers_cartel', status: 'OPERATIONAL' },
    ],
  },
  district_fleet_ditch_undercroft: {
    id: BlueprintIdSchema.parse('district_fleet_ditch_undercroft'),
    name: 'Chalk-Vault Catacombs & Fleet Ditch', dominantStratum: 'UNDERCROFT', cartel: 'Undercroft Syndicate', controllingFactionId: 'faction_undercroft_syndicate', smog: '85% Toxic Miasma', wealthIndex: 0.35, description: 'Flooded subterranean chalk vaults, sluice gates, and illicit aether stills.',
    macroCoords: { col: 0, row: 1 }, naturalBarriers: ['Subterranean Fleet Sluice', 'Multi-Point Sewer Overflow Drops'],
    connectedDistrictIds: [BlueprintIdSchema.parse('district_whitechapel_ward'), BlueprintIdSchema.parse('district_spitalfields_soot_works')],
    transitTypes: ['STREET_GATE', 'SEWER_SIPHON'],
    landmarks: [
      { id: 'submerged_sluice', name: 'Fleet Ditch Sunken Sluice', stratum: 'UNDERCROFT', category: 'CANAL_LOCK', description: 'Heavy iron floodgate regulating toxic miasma and sewer overflow.', controllingFactionId: 'faction_undercroft_syndicate', status: 'OPERATIONAL' },
      { id: 'syndicate_still', name: 'Black-Market Aether Still', stratum: 'CATACOMBS', category: 'SAFEHOUSE_VAULT', description: 'Hidden alchemical boiler condensing quicksilver and aether salts.', controllingFactionId: 'faction_undercroft_syndicate', status: 'CONTESTED' },
      { id: 'catacomb_stairs', name: 'Chalk Crypt Descent', stratum: 'UNDERCROFT', category: 'CATACOMB_DESCENT', description: 'Pre-Victorian bone vault portal opening into deep strata.', controllingFactionId: 'faction_undercroft_syndicate', status: 'OPERATIONAL' },
    ],
  },
  district_belgravia_brass_spires: {
    id: BlueprintIdSchema.parse('district_belgravia_brass_spires'),
    name: 'Gilded Spire Assembly', dominantStratum: 'SPIRE', cartel: 'Clockwork Guild', controllingFactionId: 'faction_clockwork_guild', smog: '15% High-Altitude', wealthIndex: 3.4, description: 'Sky-high brass catwalks, gothic colonnades, and aristocratic towers.',
    macroCoords: { col: 2, row: 0 }, naturalBarriers: ['Reinforced Toll Perimeter Wall', 'Spire Colonnade Viaduct'],
    connectedDistrictIds: [BlueprintIdSchema.parse('district_limehouse_docks'), BlueprintIdSchema.parse('district_spitalfields_soot_works')],
    transitTypes: ['STREET_GATE', 'MONORAIL_LINE'],
    landmarks: [
      { id: 'spire_greenhouse', name: 'Aetheric Aeroponic Greenhouse', stratum: 'SPIRE', category: 'SPIRE_GREENHOUSE', description: 'Pressurized glass conservatory cultivating rare medicinal flora.', controllingFactionId: 'faction_clockwork_guild', status: 'OPERATIONAL' },
      { id: 'cartel_bank', name: 'Clockwork Cartel Bullion Vault', stratum: 'STREET', category: 'SAFEHOUSE_VAULT', description: 'Reinforced steam-locked treasury guarding sovereign sovereigns.', controllingFactionId: 'faction_clockwork_guild', status: 'RESTRICTED' },
      { id: 'spire_lift', name: 'Pneumatic Grand Elevator', stratum: 'STREET', category: 'MONORAIL_DEPOT', description: 'Counterweighted brass lift chamber ascending 40m into Spire assembly.', controllingFactionId: 'faction_clockwork_guild', status: 'OPERATIONAL' },
    ],
  },
  district_whitechapel_ward: {
    id: BlueprintIdSchema.parse('district_whitechapel_ward'),
    name: 'Blackfriars Rookeries & Quarantine Ward', dominantStratum: 'STREET', cartel: 'Crown Constabulary', controllingFactionId: 'faction_crown_constabulary', smog: '55% Hospital Carbolic', wealthIndex: 0.5, description: 'Wrought iron alleys, quarantine checkpoints, and surgical infirmaries.',
    macroCoords: { col: 1, row: 1 }, naturalBarriers: ['Reinforced Toll Perimeter Wall', 'Quarantine Sewer Grates'],
    connectedDistrictIds: [BlueprintIdSchema.parse('district_fleet_ditch_undercroft'), BlueprintIdSchema.parse('district_limehouse_docks')],
    transitTypes: ['STREET_GATE', 'SEWER_SIPHON'],
    landmarks: [
      { id: 'chirurgeon_clinic', name: 'Victorian Surgical Infirmary', stratum: 'STREET', category: 'SURGICAL_CLINIC', description: 'Operating tables and antiseptic supplies for organ grafting.', controllingFactionId: 'faction_crown_constabulary', status: 'OPERATIONAL' },
      { id: 'tenement_rookery', name: 'Crowded Rookery Tenements', stratum: 'STREET', category: 'SAFEHOUSE_VAULT', description: 'Dense labyrinthine tenements harboring unregistered craftsmen.', controllingFactionId: 'faction_crown_constabulary', status: 'CONTESTED' },
      { id: 'toll_checkpoint', name: 'Crown Constabulary Gatehouse', stratum: 'STREET', category: 'SAFEHOUSE_VAULT', description: 'Perimeter toll barrier inspecting travelers for contraband.', controllingFactionId: 'faction_crown_constabulary', status: 'RESTRICTED' },
    ],
  },
  district_limehouse_docks: {
    id: BlueprintIdSchema.parse('district_limehouse_docks'),
    name: 'Limehouse Docks & Estuary Wharves', dominantStratum: 'STREET', cartel: 'Ironmongers Cartel', controllingFactionId: 'faction_ironmongers_cartel', smog: '70% River Smog', wealthIndex: 0.9, description: 'Thames timber wharves, canal sluices, and contraband export warehouses.',
    macroCoords: { col: 3, row: 1 }, naturalBarriers: ['Thames Estuary Canal Network', 'Timber Pier Sluice Locks'],
    connectedDistrictIds: [BlueprintIdSchema.parse('district_whitechapel_ward'), BlueprintIdSchema.parse('district_belgravia_brass_spires')],
    transitTypes: ['STREET_GATE', 'MONORAIL_LINE', 'CANAL_SLUICE_FERRY'],
    landmarks: [
      { id: 'estuary_pier', name: 'Thames Timber Pier Wharves', stratum: 'STREET', category: 'WHARF_PIER', description: 'Heavy timber docking slips receiving coal barges and whale oil casks.', controllingFactionId: 'faction_ironmongers_cartel', status: 'OPERATIONAL' },
      { id: 'canal_sluice_basin', name: 'Grand Estuary Sluice Lock', stratum: 'STREET', category: 'CANAL_LOCK', description: 'Hydraulic lock mechanism regulating canal tidal fluctuations.', controllingFactionId: 'faction_ironmongers_cartel', status: 'OPERATIONAL' },
      { id: 'freight_depot', name: 'East India Steam Warehouse', stratum: 'STREET', category: 'MONORAIL_DEPOT', description: 'Bonded storage for unrefined phosphor, brass fittings, and whale oil.', controllingFactionId: 'faction_ironmongers_cartel', status: 'OPERATIONAL' },
    ],
  },
};

export const NATURAL_OVERWORLD_BARRIERS: readonly OverworldBarrier[] = [
  {
    id: 'barrier_thames_estuary', barrierType: 'THAMES_CANAL', name: 'Thames Estuary Canal Network',
    fromDistrictId: BlueprintIdSchema.parse('district_limehouse_docks'), toDistrictId: BlueprintIdSchema.parse('district_spitalfields_soot_works'),
    description: 'Wide brackish canal waterway traversed via timber piers and sluice locks.', glyph: '≈', passable: true,
  },
  {
    id: 'barrier_spitalfields_viaduct', barrierType: 'VIADUCT', name: 'Great Eastern Colonnade Viaduct',
    fromDistrictId: BlueprintIdSchema.parse('district_spitalfields_soot_works'), toDistrictId: BlueprintIdSchema.parse('district_belgravia_brass_spires'),
    description: 'Elevated stone and brass aqueduct viaduct carrying the pneumatic monorail.', glyph: '╩', passable: true,
  },
  {
    id: 'barrier_toll_perimeter_wall', barrierType: 'TOLL_PERIMETER_WALL', name: 'Reinforced Crown Toll Perimeter Wall',
    fromDistrictId: BlueprintIdSchema.parse('district_whitechapel_ward'), toDistrictId: BlueprintIdSchema.parse('district_belgravia_brass_spires'),
    description: 'Fortified wrought-iron perimeter wall guarded by Constabulary toll checkpoints.', glyph: '▓', passable: true, tollPence: 15,
  },
  {
    id: 'barrier_multipoint_sewers', barrierType: 'SEWER_DROP', name: 'Multi-Point Sewer Drainage Network',
    fromDistrictId: BlueprintIdSchema.parse('district_fleet_ditch_undercroft'), toDistrictId: BlueprintIdSchema.parse('district_whitechapel_ward'),
    description: 'Multiple manhole siphons and sewer sumps providing vertical subterranean descent.', glyph: '>', passable: true,
  },
];

export const FACTION_INFLUENCE_HEATMAP: readonly FactionInfluenceRecord[] = [
  {
    factionId: 'faction_ironmongers_cartel', factionName: 'Ironmongers Cartel', color: '#D4AF37', influencePct: 40,
    dominantDistricts: [BlueprintIdSchema.parse('district_spitalfields_soot_works'), BlueprintIdSchema.parse('district_limehouse_docks')],
    territoryDescription: 'Monopolizes heavy foundries, steam boilers, and Thames maritime trade.',
  },
  {
    factionId: 'faction_undercroft_syndicate', factionName: 'Undercroft Syndicate', color: '#2E86C1', influencePct: 25,
    dominantDistricts: [BlueprintIdSchema.parse('district_fleet_ditch_undercroft')],
    territoryDescription: 'Controls flooded chalk vaults, sewer smuggling tunnels, and illicit aether stills.',
  },
  {
    factionId: 'faction_clockwork_guild', factionName: 'Clockwork Guild', color: '#F4D03F', influencePct: 20,
    dominantDistricts: [BlueprintIdSchema.parse('district_belgravia_brass_spires')],
    territoryDescription: 'Governs high-altitude brass spires, precision horology, and high finance.',
  },
  {
    factionId: 'faction_crown_constabulary', factionName: 'Crown Constabulary', color: '#EC7063', influencePct: 15,
    dominantDistricts: [BlueprintIdSchema.parse('district_whitechapel_ward')],
    territoryDescription: 'Enforces quarantine curfews, toll perimeter checkpoints, and infirmaries.',
  },
];

export const TRANSIT_MONORAIL_ROUTES: readonly TransitMonorailRoute[] = [
  {
    routeId: 'monorail_east_spitalfields', name: 'Spitalfields–Belgravia Express',
    fromDistrictId: BlueprintIdSchema.parse('district_spitalfields_soot_works'), toDistrictId: BlueprintIdSchema.parse('district_belgravia_brass_spires'),
    stationName: 'Foundry Central Terminus', pressureOperatingKpa: 280, status: 'ACTIVE',
  },
  {
    routeId: 'monorail_limehouse_freight', name: 'Limehouse Timber Freight Line',
    fromDistrictId: BlueprintIdSchema.parse('district_limehouse_docks'), toDistrictId: BlueprintIdSchema.parse('district_spitalfields_soot_works'),
    stationName: 'Estuary Wharf Terminal', pressureOperatingKpa: 240, status: 'ACTIVE',
  },
  {
    routeId: 'monorail_spire_circumferential', name: 'Belgravia Sky-Spur Line',
    fromDistrictId: BlueprintIdSchema.parse('district_belgravia_brass_spires'), toDistrictId: BlueprintIdSchema.parse('district_limehouse_docks'),
    stationName: 'Catwalk High Station', pressureOperatingKpa: 260, status: 'ACTIVE',
  },
];

export function getDistrictDossier(districtId: BlueprintId | string): DistrictDossier | undefined {
  return METROPOLIS_DISTRICT_DOSSIERS[districtId];
}

export function getAllDistrictDossiers(): readonly DistrictDossier[] {
  return Object.values(METROPOLIS_DISTRICT_DOSSIERS);
}

export function getOverworldBarriersForDistrict(districtId: BlueprintId | string): readonly OverworldBarrier[] {
  return NATURAL_OVERWORLD_BARRIERS.filter(
    (b) => b.fromDistrictId === districtId || b.toDistrictId === districtId,
  );
}

/** Generates a 20x8 macro-topography grid of Greater Victorian London. */
export function generateMacroTopographyGrid(): MacroTopographyCell[][] {
  const width = 20;
  const height = 8;
  const grid: MacroTopographyCell[][] = [];

  for (let y = 0; y < height; y++) {
    const row: MacroTopographyCell[] = [];
    for (let x = 0; x < width; x++) {
      let glyph = '·';
      let feature: MacroTopographyCell['feature'] = 'OPEN_GROUND';
      let elevationMeters = 0;
      let fgColor = '#2C3E50';
      let districtId: BlueprintId | undefined;
      let label: string | undefined;

      // Thames Estuary Waterway (curves along southern rows)
      if (y === 6 && x >= 4 && x <= 18) {
        glyph = '≈'; feature = 'WATER'; fgColor = '#2E86C1'; elevationMeters = -3;
      } else if (y === 5 && x >= 12 && x <= 19) {
        glyph = '≈'; feature = 'WATER'; fgColor = '#2E86C1'; elevationMeters = -2;
      } else if (y === 7 && x >= 8 && x <= 17) {
        glyph = '~'; feature = 'WATER'; fgColor = '#1B4F72'; elevationMeters = -4;
      }
      // Viaduct Colonnade (northern elevated span)
      else if (y === 2 && x >= 9 && x <= 13) {
        glyph = '╩'; feature = 'VIADUCT'; fgColor = '#D4AF37'; elevationMeters = 30;
      }
      // Reinforced Toll Perimeter Wall (west-central barrier)
      else if (x === 6 && y >= 2 && y <= 4) {
        glyph = '▓'; feature = 'WALL'; fgColor = '#7F8C8D'; elevationMeters = 5;
      }
      // District Hubs
      else if (x === 2 && y === 4) {
        glyph = 'F'; feature = 'DISTRICT_CORE'; fgColor = '#5DADE2'; elevationMeters = -15;
        districtId = BlueprintIdSchema.parse('district_fleet_ditch_undercroft'); label = 'Fleet Ditch';
      } else if (x === 5 && y === 3) {
        glyph = 'W'; feature = 'DISTRICT_CORE'; fgColor = '#EC7063'; elevationMeters = 0;
        districtId = BlueprintIdSchema.parse('district_whitechapel_ward'); label = 'Whitechapel';
      } else if (x === 10 && y === 3) {
        glyph = 'S'; feature = 'DISTRICT_CORE'; fgColor = '#F4D03F'; elevationMeters = 0;
        districtId = BlueprintIdSchema.parse('district_spitalfields_soot_works'); label = 'Spitalfields';
      } else if (x === 11 && y === 1) {
        glyph = 'B'; feature = 'DISTRICT_CORE'; fgColor = '#F5B041'; elevationMeters = 40;
        districtId = BlueprintIdSchema.parse('district_belgravia_brass_spires'); label = 'Belgravia Spires';
      } else if (x === 16 && y === 4) {
        glyph = 'L'; feature = 'DISTRICT_CORE'; fgColor = '#48C9B0'; elevationMeters = 1;
        districtId = BlueprintIdSchema.parse('district_limehouse_docks'); label = 'Limehouse Docks';
      }

      row.push({ x, y, glyph, feature, elevationMeters, fgColor, districtId, label });
    }
    grid.push(row);
  }
  return grid;
}
