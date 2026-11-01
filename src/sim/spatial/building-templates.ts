import {
  BlueprintIdSchema,
  BuildingArchetypeId,
  BuildingArchetypeIdSchema,
} from '../../schemas/primitives.schema.js';
import {
  BuildingTemplate,
  BuildingTemplateSchema,
  TemplateCellRule,
  TemplateRoomDefinition,
} from '../../schemas/building-template.schema.js';

/** Base legend tokens shared across Victorian building archetypes */
export const COMMON_LEGEND: Readonly<Record<string, TemplateCellRule>> = {
  '#': { terrain: 'SOOT_BRICK_WALL', blocksMovement: true, blocksSight: true },
  '.': { terrain: 'COBBLESTONE_FLOOR', blocksMovement: false, blocksSight: false },
  '+': { terrain: 'WOODEN_DOOR_CLOSED', blocksMovement: true, blocksSight: true },
  '"': { terrain: 'GLASS_WINDOW', blocksMovement: true, blocksSight: false },
  '=': { terrain: 'COUNTER_BARRIER', blocksMovement: true, blocksSight: false },
  '|': { terrain: 'WROUGHT_IRON_FENCE', blocksMovement: true, blocksSight: false },
  '_': { terrain: 'IRON_GRATE', blocksMovement: false, blocksSight: false },
};

function defTemplate(spec: {
  id: string; archetypeId: BuildingArchetypeId; name: string;
  width: number; height: number; rows: string[];
  legend: Record<string, TemplateCellRule>; rooms: TemplateRoomDefinition[];
}): BuildingTemplate {
  return BuildingTemplateSchema.parse({ ...spec, id: BlueprintIdSchema.parse(spec.id) });
}

export const TEMPLATE_VICTORIAN_TAVERN: BuildingTemplate = defTemplate({
  id: 'building_victorian_tavern',
  archetypeId: BuildingArchetypeIdSchema.parse('VICTORIAN_TAVERN'),
  name: 'The Black Dog Alehouse & Snug',
  width: 12, height: 10,
  rows: [
    '############',
    '#..g..#....#',
    '#..d..#..s.#',
    '#.###+#+####',
    '#.#........#',
    '#.H.======.#',
    '#...=....b.#',
    '#...=.T..b.#',
    '#...=......#',
    '#####+######',
  ],
  legend: {
    ...COMMON_LEGEND,
    b: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'PUBLIC_BAR', furnitureKind: 'BAR_COUNTER', furnitureLabel: 'Oak Bar Stool', blocksMovement: false },
    T: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'PUBLIC_BAR', furnitureKind: 'ROLL_TOP_DESK', furnitureLabel: 'Tavern Table', blocksMovement: true },
    s: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'SCULLERY', furnitureKind: 'COAL_STOVE', furnitureLabel: 'Scullery Hearth', thermalCoreHeatPct: 80, isContainer: true, lootTableId: 'loot_scullery_coal', blocksMovement: true },
    g: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'RECEPTION', furnitureKind: 'ROLL_TOP_DESK', furnitureLabel: 'Publican Ledger Desk', isContainer: true, lootTableId: 'loot_tavern_ledger', blocksMovement: true },
    d: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'RECEPTION', furnitureKind: 'ROLL_TOP_DESK', furnitureLabel: 'Snug Settee Table', blocksMovement: true },
    H: { terrain: 'IRON_GRATE', interiorZone: 'CELLAR', blocksMovement: false, crossStratumPortal: { targetStratum: 'UNDERCROFT', portalLabel: 'Beer Cellar Ladder' } },
  },
  rooms: [
    { zone: 'RECEPTION', label: 'Private Snug', x1: 1, y1: 1, x2: 5, y2: 3, ambientSmokePpm: 0, ambientSteamKpa: 0 },
    { zone: 'SCULLERY', label: 'Kitchen Scullery', x1: 7, y1: 1, x2: 10, y2: 3, ambientSmokePpm: 0, ambientSteamKpa: 0 },
    { zone: 'PUBLIC_BAR', label: 'Public Bar Concourse', x1: 1, y1: 4, x2: 10, y2: 8, ambientSmokePpm: 0, ambientSteamKpa: 0 },
    { zone: 'CELLAR', label: 'Beer Cellar Alcove', x1: 1, y1: 4, x2: 3, y2: 6, ambientSmokePpm: 0, ambientSteamKpa: 0 },
  ],
});

export const TEMPLATE_CONSTABULARY_STATION: BuildingTemplate = defTemplate({
  id: 'building_constabulary_station',
  archetypeId: BuildingArchetypeIdSchema.parse('CONSTABULARY_OFFICE'),
  name: 'Bow Street Constabulary Office & Lockup',
  width: 11, height: 10,
  rows: [
    '###########',
    '#..F#C.|.C#',
    '#..g#=.+.=#',
    '##+####+###',
    '#.........#',
    '#..======.#',
    '#..=....d.#',
    '#..=..p...#',
    '#..E......#',
    '####+######',
  ],
  legend: {
    ...COMMON_LEGEND,
    g: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'INSPECTOR_OFFICE', furnitureKind: 'ROLL_TOP_DESK', furnitureLabel: "Inspector's Mahogany Desk", isContainer: true, lootTableId: 'loot_police_dossiers', blocksMovement: true },
    F: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'INSPECTOR_OFFICE', furnitureKind: 'FILING_CABINET', furnitureLabel: 'Criminal Dossier Cabinet', isContainer: true, lootTableId: 'loot_police_archives', blocksMovement: true },
    d: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'RECEPTION', furnitureKind: 'ROLL_TOP_DESK', furnitureLabel: "Constable's Charge Desk", isContainer: true, blocksMovement: true },
    p: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'RECEPTION', furnitureKind: 'PNEUMATIC_DISPATCH', furnitureLabel: 'Scotland Yard Dispatch Tube', blocksMovement: true },
    E: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'VAULT', furnitureKind: 'SAFE_VAULT', furnitureLabel: 'Reinforced Evidence Safe', isContainer: true, lootTableId: 'loot_evidence_vault', blocksMovement: true },
    C: { terrain: 'IRON_GRATE', interiorZone: 'HOLDING_CELL', furnitureKind: 'CELL_BENCH', furnitureLabel: 'Iron Cell Cot', blocksMovement: false },
  },
  rooms: [
    { zone: 'INSPECTOR_OFFICE', label: "Inspector's Office", x1: 1, y1: 1, x2: 3, y2: 3, ambientSmokePpm: 0, ambientSteamKpa: 0 },
    { zone: 'HOLDING_CELL', label: 'Barred Holding Cells', x1: 5, y1: 1, x2: 9, y2: 2, ambientSmokePpm: 0, ambientSteamKpa: 0 },
    { zone: 'RECEPTION', label: 'Charge Room Concourse', x1: 1, y1: 4, x2: 9, y2: 8, ambientSmokePpm: 0, ambientSteamKpa: 0 },
    { zone: 'VAULT', label: 'Evidence Safe Vault', x1: 1, y1: 7, x2: 3, y2: 8, ambientSmokePpm: 0, ambientSteamKpa: 0 },
  ],
});

export const TEMPLATE_TENEMENT_HOUSE: BuildingTemplate = defTemplate({
  id: 'building_tenement_house',
  archetypeId: BuildingArchetypeIdSchema.parse('TENEMENT_HOUSE'),
  name: 'Rookery Common Tenement House',
  width: 11, height: 11,
  rows: [
    '###########',
    '#b..#.#..b#',
    '#...#.#...#',
    '#...+.+...#',
    '#####.#####',
    '#...#.#...#',
    '#...#.+.s.#',
    '#H..#.#.W.#',
    '#...+.#...#',
    '#...#.#...#',
    '#####+#####',
  ],
  legend: {
    ...COMMON_LEGEND,
    b: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'LIVING_QUARTERS', furnitureKind: 'BED', furnitureLabel: 'Pauper Straw Mattress', blocksMovement: false },
    s: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'SCULLERY', furnitureKind: 'COAL_STOVE', furnitureLabel: 'Communal Wash Stove', thermalCoreHeatPct: 75, isContainer: true, blocksMovement: true },
    W: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'SCULLERY', furnitureKind: 'WATER_PUMP', furnitureLabel: 'Cast-Iron Scullery Sink', blocksMovement: true },
    H: { terrain: 'IRON_GRATE', interiorZone: 'CELLAR', blocksMovement: false, crossStratumPortal: { targetStratum: 'UNDERCROFT', portalLabel: 'Tenement Coal Chute' } },
  },
  rooms: [
    { zone: 'LIVING_QUARTERS', label: 'Tenement Flat 1', x1: 1, y1: 1, x2: 3, y2: 3, ambientSmokePpm: 0, ambientSteamKpa: 0 },
    { zone: 'LIVING_QUARTERS', label: 'Tenement Flat 2', x1: 7, y1: 1, x2: 9, y2: 3, ambientSmokePpm: 0, ambientSteamKpa: 0 },
    { zone: 'CORRIDOR', label: 'Central Spine Corridor', x1: 5, y1: 1, x2: 5, y2: 9, ambientSmokePpm: 0, ambientSteamKpa: 0 },
    { zone: 'SCULLERY', label: 'Shared Scullery & Wash', x1: 7, y1: 5, x2: 9, y2: 9, ambientSmokePpm: 0, ambientSteamKpa: 0 },
    { zone: 'CELLAR', label: 'Coal Cellar Alcove', x1: 1, y1: 5, x2: 3, y2: 9, ambientSmokePpm: 0, ambientSteamKpa: 0 },
  ],
});

export const TEMPLATE_APOTHECARY_CLINIC: BuildingTemplate = defTemplate({
  id: 'building_apothecary_clinic',
  archetypeId: BuildingArchetypeIdSchema.parse('VICTORIAN_APOTHECARY_CLINIC'),
  name: 'St. Jude Chirurgeon Dispensary',
  width: 11, height: 10,
  rows: [
    '###########',
    '#..S#.#.C.#',
    '#...#.#...#',
    '#...#.#.L.#',
    '##+##.##+##',
    '#.........#',
    '#..======.#',
    '#..=....d.#',
    '#..=......#',
    '#####+#####',
  ],
  legend: {
    ...COMMON_LEGEND,
    S: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'SURGICAL_BAY', furnitureKind: 'SURGICAL_TABLE', furnitureLabel: 'Galvanic Operating Table', blocksMovement: true },
    C: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'STORAGE', furnitureKind: 'CRATE', furnitureLabel: 'Alchemical Reagent Chest', isContainer: true, lootTableId: 'loot_apothecary_reagents', blocksMovement: true },
    L: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'STORAGE', furnitureKind: 'GAS_LAMP', furnitureLabel: 'Welsbach Mantle Wall Lamp', blocksMovement: false },
    d: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'RECEPTION', furnitureKind: 'ROLL_TOP_DESK', furnitureLabel: 'Prescription Dispense Desk', isContainer: true, blocksMovement: true },
  },
  rooms: [
    { zone: 'SURGICAL_BAY', label: 'Operating Theatre', x1: 1, y1: 1, x2: 4, y2: 3, ambientSmokePpm: 0, ambientSteamKpa: 0 },
    { zone: 'STORAGE', label: 'Chemical Dispensary', x1: 6, y1: 1, x2: 9, y2: 3, ambientSmokePpm: 0, ambientSteamKpa: 0 },
    { zone: 'RECEPTION', label: 'Patient Waiting Lounge', x1: 1, y1: 5, x2: 9, y2: 8, ambientSmokePpm: 0, ambientSteamKpa: 0 },
  ],
});

export const TEMPLATE_ARTISAN_WORKSHOP: BuildingTemplate = defTemplate({
  id: 'building_artisan_workshop',
  archetypeId: BuildingArchetypeIdSchema.parse('GUILD_ARTISAN_WORKSHOP'),
  name: 'Guild Artificer Workshop & Vault',
  width: 13, height: 10,
  rows: [
    '#############',
    '#..W...#..V.#',
    '#......#....#',
    '#..W...#.F..#',
    '###+####+####',
    '#...........#',
    '#...===+===.#',
    '#...=...d...#',
    '#...=...p...#',
    '######+######',
  ],
  legend: {
    ...COMMON_LEGEND,
    W: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'WORKSHOP', furnitureKind: 'ARTIFICER_BENCH', furnitureLabel: 'Brass Artificer Workbench', blocksMovement: false },
    V: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'VAULT', furnitureKind: 'SAFE_VAULT', furnitureLabel: 'Mainspring Strongroom Safe', isContainer: true, lootTableId: 'loot_artisan_vault', blocksMovement: true },
    F: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'VAULT', furnitureKind: 'FILING_CABINET', furnitureLabel: 'Schematic Blueprint Cabinet', isContainer: true, blocksMovement: true },
    d: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'RECEPTION', furnitureKind: 'ROLL_TOP_DESK', furnitureLabel: 'Master Horologist Desk', isContainer: true, blocksMovement: true },
    p: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'RECEPTION', furnitureKind: 'PNEUMATIC_DISPATCH', furnitureLabel: 'Guild Order Dispatch Tube', blocksMovement: true },
  },
  rooms: [
    { zone: 'WORKSHOP', label: 'Artificer Assembly Hall', x1: 1, y1: 1, x2: 6, y2: 3, ambientSmokePpm: 0, ambientSteamKpa: 0 },
    { zone: 'VAULT', label: 'Clockwork Gear Vault', x1: 8, y1: 1, x2: 11, y2: 3, ambientSmokePpm: 0, ambientSteamKpa: 0 },
    { zone: 'RECEPTION', label: 'Guild Showroom', x1: 1, y1: 5, x2: 11, y2: 8, ambientSmokePpm: 0, ambientSteamKpa: 0 },
  ],
});

export const TEMPLATE_STEAM_BOILERHOUSE: BuildingTemplate = defTemplate({
  id: 'building_steam_boilerhouse',
  archetypeId: BuildingArchetypeIdSchema.parse('STEAM_BOILERHOUSE_FURNACE'),
  name: 'Vulcan Industrial Steam Boilerhouse',
  width: 11, height: 10,
  rows: [
    '###########',
    '#..B..#..C#',
    '#.....#...#',
    '#.....#..C#',
    '###+###+###',
    '#.........#',
    '#.M.......#',
    '#...s.....#',
    '#.........#',
    '####+######',
  ],
  legend: {
    ...COMMON_LEGEND,
    B: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'WORKSHOP', furnitureKind: 'IRON_BOILER', furnitureLabel: 'Industrial Cornish Boiler', steamPressureKpa: 60, thermalCoreHeatPct: 90, blocksMovement: true, blocksSight: true },
    C: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'STORAGE', furnitureKind: 'CRATE', furnitureLabel: 'Anthracite Coal Bunker', smokePpm: 80, isContainer: true, lootTableId: 'loot_coal_bunker', blocksMovement: true },
    M: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'BACKROOM', furnitureKind: 'VALVE_MANIFOLD', furnitureLabel: 'High-Pressure Steam Manifold', blocksMovement: true },
    s: { terrain: 'COBBLESTONE_FLOOR', interiorZone: 'BACKROOM', furnitureKind: 'COAL_STOVE', furnitureLabel: 'Pilot Ignition Stove', thermalCoreHeatPct: 80, blocksMovement: true },
  },
  rooms: [
    { zone: 'WORKSHOP', label: 'High-Pressure Boiler Hearth', x1: 1, y1: 1, x2: 5, y2: 3, ambientSmokePpm: 0, ambientSteamKpa: 60 },
    { zone: 'STORAGE', label: 'Anthracite Bunker', x1: 7, y1: 1, x2: 9, y2: 3, ambientSmokePpm: 80, ambientSteamKpa: 0 },
    { zone: 'BACKROOM', label: 'Manifold Control Bay', x1: 1, y1: 5, x2: 9, y2: 8, ambientSmokePpm: 0, ambientSteamKpa: 0 },
  ],
});

export const ALL_BUILDING_TEMPLATES: readonly BuildingTemplate[] = [
  TEMPLATE_VICTORIAN_TAVERN, TEMPLATE_CONSTABULARY_STATION, TEMPLATE_TENEMENT_HOUSE,
  TEMPLATE_APOTHECARY_CLINIC, TEMPLATE_ARTISAN_WORKSHOP, TEMPLATE_STEAM_BOILERHOUSE,
];

export const BUILDING_TEMPLATE_REGISTRY: Readonly<Record<string, BuildingTemplate>> = Object.fromEntries(
  ALL_BUILDING_TEMPLATES.map((t) => [t.id, t]),
);
