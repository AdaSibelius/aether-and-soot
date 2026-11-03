import { BlueprintIdSchema, BuildingArchetypeIdSchema } from '../../schemas/primitives.schema.js';
import {
  BuildingTemplate,
  BuildingTemplateSchema,
  TemplateCellRule,
  TemplateRoomDefinition,
} from '../../schemas/building-template.schema.js';
import { COMMON_LEGEND } from './building-templates.js';

function defTemplate(spec: {
  id: string; archetypeId: string; name: string;
  width: number; height: number; rows: string[];
  legend: Record<string, TemplateCellRule>; rooms: TemplateRoomDefinition[];
}): BuildingTemplate {
  return BuildingTemplateSchema.parse({
    ...spec,
    id: BlueprintIdSchema.parse(spec.id),
    archetypeId: BuildingArchetypeIdSchema.parse(spec.archetypeId),
  });
}

/** 1. Bessemer Blast Foundry (Spitalfields Soot Works, 13x10) */
export const TEMPLATE_BESSEMER_FOUNDRY: BuildingTemplate = defTemplate({
  id: 'building_bessemer_foundry',
  archetypeId: 'STEAM_BOILERHOUSE_FURNACE',
  name: 'Bessemer High-Blast Foundry & Slag Works',
  width: 13, height: 10,
  rows: [
    '#############',
    '#..F...#...B#',
    '#......#...W#',
    '#..s...#..._#',
    '###+####+####',
    '#...........#',
    '#...===+===.#',
    '#...=..C..=.#',
    '#......d....#',
    '######+######',
  ],
  legend: {
    ...COMMON_LEGEND,
    F: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'WORKSHOP', furnitureKind: 'SMELTING_FURNACE', furnitureLabel: 'Bessemer Blast Converter', thermalCoreHeatPct: 95, smokePpm: 120, blocksMovement: true, blocksSight: true },
    s: { terrain: 'SLAG_PIT', interiorZone: 'WORKSHOP', blocksMovement: false },
    B: { terrain: 'CANAL_SLUICE', interiorZone: 'STORAGE', furnitureKind: 'WATER_PUMP', furnitureLabel: 'Quenching Cooling Basin', blocksMovement: true },
    W: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'STORAGE', furnitureKind: 'VALVE_MANIFOLD', furnitureLabel: 'Steam Pressure Quenching Manifold', steamPressureKpa: 150, blocksMovement: true },
    C: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'STORAGE', furnitureKind: 'CRATE', furnitureLabel: 'Anthracite Ore Crate', isContainer: true, lootTableId: 'loot_coal_bunker', blocksMovement: true },
    d: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'RECEPTION', furnitureKind: 'ROLL_TOP_DESK', furnitureLabel: 'Foundry Overseer Desk', isContainer: true, blocksMovement: true },
    _: { terrain: 'IRON_GRATE', interiorZone: 'CELLAR', blocksMovement: false, crossStratumPortal: { targetStratum: 'UNDERCROFT', portalLabel: 'Slag Drainage Chute' } },
  },
  rooms: [
    { zone: 'WORKSHOP', label: 'Bessemer Converter Hearth', x1: 1, y1: 1, x2: 6, y2: 3, ambientSmokePpm: 100, ambientSteamKpa: 40 },
    { zone: 'STORAGE', label: 'Quenching Basin & Cistern', x1: 8, y1: 1, x2: 11, y2: 3, ambientSmokePpm: 20, ambientSteamKpa: 70 },
    { zone: 'RECEPTION', label: 'Casting Floor Concourse', x1: 1, y1: 5, x2: 11, y2: 8, ambientSmokePpm: 30, ambientSteamKpa: 10 },
  ],
});

/** 2. Dockside Warehouse (Limehouse Docks, 12x10) */
export const TEMPLATE_DOCKSIDE_WAREHOUSE: BuildingTemplate = defTemplate({
  id: 'building_dockside_warehouse',
  archetypeId: 'PNEUMATIC_MONORAIL_DEPOT',
  name: 'East India Estuary Wharf Warehouse',
  width: 12, height: 10,
  rows: [
    '############',
    '#..K...#..C#',
    '#......#..C#',
    '#.._...#..S#',
    '###+####+###',
    '#..........#',
    '#.===..===.#',
    '#.L......d.#',
    '#..........#',
    '#####+######',
  ],
  legend: {
    ...COMMON_LEGEND,
    K: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'WORKSHOP', furnitureKind: 'MONORAIL_DEPOT_CONSOLE', furnitureLabel: 'Hydraulic Cargo Crane Winch', blocksMovement: true },
    C: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'STORAGE', furnitureKind: 'CRATE', furnitureLabel: 'Bonded Whale Oil & Phosphor Crate', isContainer: true, lootTableId: 'loot_apothecary_reagents', blocksMovement: true },
    S: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'STORAGE', furnitureKind: 'SAFE_VAULT', furnitureLabel: 'Bonded Contraband Strongbox', isContainer: true, lootTableId: 'loot_evidence_vault', blocksMovement: true },
    L: { terrain: 'BOARDING_PLATFORM', interiorZone: 'LOADING_DOCK', furnitureKind: 'BARRICADE_WOOD', furnitureLabel: 'Timber Cargo Loading Skid', blocksMovement: false },
    d: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'LOADING_DOCK', furnitureKind: 'ROLL_TOP_DESK', furnitureLabel: 'Harbormaster Customs Desk', isContainer: true, blocksMovement: true },
    _: { terrain: 'IRON_GRATE', interiorZone: 'CELLAR', blocksMovement: false, crossStratumPortal: { targetStratum: 'UNDERCROFT', portalLabel: 'Tidal Sluice Hatch' } },
  },
  rooms: [
    { zone: 'WORKSHOP', label: 'Crane Rigging Bay', x1: 1, y1: 1, x2: 6, y2: 3, ambientSmokePpm: 15, ambientSteamKpa: 10 },
    { zone: 'STORAGE', label: 'Bonded Freight Vault', x1: 8, y1: 1, x2: 10, y2: 3, ambientSmokePpm: 0, ambientSteamKpa: 0 },
    { zone: 'LOADING_DOCK', label: 'Wharfside Staging Concourse', x1: 1, y1: 5, x2: 10, y2: 8, ambientSmokePpm: 25, ambientSteamKpa: 0 },
  ],
});

/** 3. Clockwork Salon (Belgravia Brass Spires, 12x10) */
export const TEMPLATE_CLOCKWORK_SALON: BuildingTemplate = defTemplate({
  id: 'building_clockwork_salon',
  archetypeId: 'CLOCKWORK_PAWNSHOP_BANK',
  name: 'Gilded Horological Salon & Automaton Parlor',
  width: 12, height: 10,
  rows: [
    '############',
    '#..G...#..A#',
    '#......#...#',
    '#..P...#..p#',
    '###+####+###',
    '#..........#',
    '#.===..===.#',
    '#.V...T..V.#',
    '#..........#',
    '#####+######',
  ],
  legend: {
    ...COMMON_LEGEND,
    G: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'WORKSHOP', furnitureKind: 'CLOCKTOWER_MECHANISM', furnitureLabel: 'Master Brass Gearworks Escapement', blocksMovement: true },
    A: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'VAULT', furnitureKind: 'PEDESTAL', furnitureLabel: 'Clockwork Automaton Alcove', blocksMovement: true },
    P: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'WORKSHOP', furnitureKind: 'PNEUMATIC_DISPATCH', furnitureLabel: 'Chrono-Telegraph Dispatch Tube', blocksMovement: true },
    p: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'VAULT', furnitureKind: 'STEAM_CHARGER', furnitureLabel: 'Artificer Steam Charging Station', blocksMovement: true },
    V: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'RECEPTION', furnitureKind: 'BAR_COUNTER', furnitureLabel: 'Velvet Parlor Settee', blocksMovement: false },
    T: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'RECEPTION', furnitureKind: 'ROLL_TOP_DESK', furnitureLabel: 'Mahogany Presentation Table', isContainer: true, lootTableId: 'loot_artisan_vault', blocksMovement: true },
  },
  rooms: [
    { zone: 'WORKSHOP', label: 'Horological Gear Gallery', x1: 1, y1: 1, x2: 6, y2: 3, ambientSmokePpm: 0, ambientSteamKpa: 0 },
    { zone: 'VAULT', label: 'Automaton Strongroom Alcove', x1: 8, y1: 1, x2: 10, y2: 3, ambientSmokePpm: 0, ambientSteamKpa: 20 },
    { zone: 'RECEPTION', label: 'Velvet Clockwork Salon', x1: 1, y1: 5, x2: 10, y2: 8, ambientSmokePpm: 0, ambientSteamKpa: 0 },
  ],
});

export const EXPANDED_BUILDING_TEMPLATES: readonly BuildingTemplate[] = [
  TEMPLATE_BESSEMER_FOUNDRY,
  TEMPLATE_DOCKSIDE_WAREHOUSE,
  TEMPLATE_CLOCKWORK_SALON,
];

export const BUILDING_TEMPLATE_REGISTRY_EXPANDED: Readonly<Record<string, BuildingTemplate>> = Object.fromEntries(
  EXPANDED_BUILDING_TEMPLATES.map((t) => [t.id, t]),
);

/** Returns a district-specific priority building template or falls back to standard pool. */
export function getDistrictTailoredTemplate(districtId: string): BuildingTemplate {
  if (districtId.includes('soot_works') || districtId.includes('spitalfields')) {
    return TEMPLATE_BESSEMER_FOUNDRY;
  }
  if (districtId.includes('docks') || districtId.includes('limehouse')) {
    return TEMPLATE_DOCKSIDE_WAREHOUSE;
  }
  if (districtId.includes('brass_spires') || districtId.includes('belgravia')) {
    return TEMPLATE_CLOCKWORK_SALON;
  }
  return TEMPLATE_BESSEMER_FOUNDRY;
}
