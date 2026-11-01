import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityId, EntityIdSchema, StratumId, VisualGlyphSpec } from '../../schemas/primitives.schema.js';
import { FurnitureKind } from '../../schemas/world-components.schema.js';
import { createEntityFromBlueprint } from '../data/item-catalog.js';

export type VictorianFixtureKind =
  | 'ARTIFICER_BENCH'
  | 'COAL_STOVE'
  | 'IRON_BOILER'
  | 'ROLL_TOP_DESK'
  | 'GAS_LAMP'
  | 'PNEUMATIC_DISPATCH'
  | 'FILING_CABINET'
  | 'VALVE_MANIFOLD';

export interface FixtureLootItem {
  readonly blueprintId: string;
  readonly quantity?: number;
}

export interface FixtureOptions {
  readonly x: number;
  readonly y: number;
  readonly stratum?: StratumId | undefined;
  readonly customId?: EntityId | undefined;
  readonly label?: string | undefined;
  readonly visual?: VisualGlyphSpec | undefined;
  readonly blocksMovement?: boolean | undefined;
  readonly blocksSight?: boolean | undefined;
  readonly lootItems?: readonly FixtureLootItem[] | undefined;
  readonly isContainer?: boolean | undefined;
  readonly coreHeatPct?: number | undefined;
  readonly bonusEfficiencyPct?: number | undefined;
  readonly currentPressureKpa?: number | undefined;
  readonly maxPressureKpa?: number | undefined;
  readonly networkId?: string | undefined;
}

export function buildFixtureEntityId(kind: string, x: number, y: number, stratum: StratumId): EntityId {
  return EntityIdSchema.parse(`entity_${kind.toLowerCase()}_${x}_${y}_${stratum.toLowerCase()}`);
}

function seedFixtureInventory(
  fixtureId: EntityId,
  lootItems: readonly FixtureLootItem[] | undefined,
  entities: Record<string, EntityRecord> | undefined,
  maxMassGrams = 30000,
  maxVolumeMl = 25000,
): EntityRecord['inventory'] {
  const containedEntityIds: EntityId[] = [];
  let totalMass = 0;
  if (lootItems && entities) {
    lootItems.forEach((item, idx) => {
      const itemId = EntityIdSchema.parse(`${fixtureId}_item_${idx}`);
      const qty = item.quantity ?? 1;
      const created = createEntityFromBlueprint(item.blueprintId, itemId, qty);
      if (created) {
        entities[itemId] = created;
        containedEntityIds.push(itemId);
        totalMass += (created.item?.massGrams ?? 0) * qty;
      }
    });
  }
  return { containedEntityIds, currentMassGrams: totalMass, maxMassGrams, maxVolumeMl };
}

export function createArtificerBenchFixture(opts: FixtureOptions): EntityRecord {
  const stratum = opts.stratum ?? 'STREET';
  const id = opts.customId ?? buildFixtureEntityId('artificer_bench', opts.x, opts.y, stratum);
  const name = opts.label ?? 'Brass Artificer Workbench';
  return {
    id,
    name,
    visual: opts.visual ?? { glyph: 'T', fgPrimary: '#D4AF37', fgSecondary: '#CD7F32', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
    position: { x: opts.x, y: opts.y, stratum, blocksMovement: opts.blocksMovement ?? false, blocksSight: opts.blocksSight ?? false },
    furniture: { kind: 'ARTIFICER_BENCH', label: name, durabilityHp: 150 },
    workbench: { stationType: 'ARTIFICER_BENCH', bonusEfficiencyPct: opts.bonusEfficiencyPct ?? 25 },
  };
}

export function createCoalStoveFixture(opts: FixtureOptions, entities?: Record<string, EntityRecord>): EntityRecord {
  const stratum = opts.stratum ?? 'STREET';
  const id = opts.customId ?? buildFixtureEntityId('coal_stove', opts.x, opts.y, stratum);
  const name = opts.label ?? 'Cast-Iron Coal Stove';
  const loot = opts.lootItems ?? [{ blueprintId: 'commodity_anthracite_briquette', quantity: 2 }];
  return {
    id,
    name,
    visual: opts.visual ?? { glyph: '♨', fgPrimary: '#E67E22', fgSecondary: '#BA4A00', bgColor: '#0A0D0E', shaderFlags: ['HEAT_SHIMMER'] },
    position: { x: opts.x, y: opts.y, stratum, blocksMovement: opts.blocksMovement ?? true, blocksSight: opts.blocksSight ?? false },
    furniture: { kind: 'COAL_STOVE', label: name, durabilityHp: 200 },
    thermal: { coreHeatPct: opts.coreHeatPct ?? 80 },
    inventory: seedFixtureInventory(id, loot, entities, 40000, 30000),
  };
}

export function createIronBoilerFixture(opts: FixtureOptions): EntityRecord {
  const stratum = opts.stratum ?? 'STREET';
  const id = opts.customId ?? buildFixtureEntityId('iron_boiler', opts.x, opts.y, stratum);
  const name = opts.label ?? 'Industrial Iron Boiler';
  return {
    id,
    name,
    visual: opts.visual ?? { glyph: 'Ω', fgPrimary: '#5DADE2', fgSecondary: '#2E86C1', bgColor: '#0A0D0E', shaderFlags: ['PULSE_STEAM', 'VOLUMETRIC_PLUME'] },
    position: { x: opts.x, y: opts.y, stratum, blocksMovement: opts.blocksMovement ?? true, blocksSight: opts.blocksSight ?? true },
    furniture: { kind: 'IRON_BOILER', label: name, durabilityHp: 400 },
    pressureVessel: { currentPressureKpa: opts.currentPressureKpa ?? 140, maxPressureKpa: opts.maxPressureKpa ?? 250, ruptured: false },
    thermal: { coreHeatPct: opts.coreHeatPct ?? 90 },
  };
}

export function createRollTopDeskFixture(opts: FixtureOptions, entities?: Record<string, EntityRecord>): EntityRecord {
  const stratum = opts.stratum ?? 'STREET';
  const id = opts.customId ?? buildFixtureEntityId('roll_top_desk', opts.x, opts.y, stratum);
  const name = opts.label ?? 'Mahogany Roll-Top Desk';
  const loot = opts.lootItems ?? [{ blueprintId: 'item_crown_pence_pouch', quantity: 1 }];
  return {
    id,
    name,
    visual: opts.visual ?? { glyph: '╤', fgPrimary: '#873600', fgSecondary: '#5B2C6F', bgColor: '#0A0D0E', shaderFlags: ['COUNTER_GLINT'] },
    position: { x: opts.x, y: opts.y, stratum, blocksMovement: opts.blocksMovement ?? true, blocksSight: opts.blocksSight ?? false },
    furniture: { kind: 'ROLL_TOP_DESK', label: name, durabilityHp: 120 },
    inventory: seedFixtureInventory(id, loot, entities, 25000, 25000),
  };
}

export function createGasLampFixture(opts: FixtureOptions): EntityRecord {
  const stratum = opts.stratum ?? 'STREET';
  const id = opts.customId ?? buildFixtureEntityId('gas_lamp', opts.x, opts.y, stratum);
  const name = opts.label ?? 'Welsbach Mantle Gas Lamp';
  return {
    id,
    name,
    visual: opts.visual ?? { glyph: '☼', fgPrimary: '#F9E79F', fgSecondary: '#F39C12', bgColor: '#0A0D0E', shaderFlags: ['GASLIGHT_RADIANCE'] },
    position: { x: opts.x, y: opts.y, stratum, blocksMovement: opts.blocksMovement ?? false, blocksSight: opts.blocksSight ?? false },
    furniture: { kind: 'GAS_LAMP', label: name, durabilityHp: 50 },
    thermal: { coreHeatPct: opts.coreHeatPct ?? 25 },
  };
}

export function createPneumaticDispatchFixture(opts: FixtureOptions, entities?: Record<string, EntityRecord>): EntityRecord {
  const stratum = opts.stratum ?? 'STREET';
  const id = opts.customId ?? buildFixtureEntityId('pneumatic_dispatch', opts.x, opts.y, stratum);
  const name = opts.label ?? 'Brass Pneumatic Dispatch Tube';
  const loot = opts.lootItems ?? [{ blueprintId: 'item_pressurized_steam_canister', quantity: 1 }];
  return {
    id,
    name,
    visual: opts.visual ?? { glyph: '¶', fgPrimary: '#D4AF37', fgSecondary: '#B7950B', bgColor: '#0A0D0E', shaderFlags: ['PULSE_STEAM'] },
    position: { x: opts.x, y: opts.y, stratum, blocksMovement: opts.blocksMovement ?? true, blocksSight: opts.blocksSight ?? false },
    furniture: { kind: 'PNEUMATIC_DISPATCH', label: name, durabilityHp: 180 },
    utilityConduit: {
      conduitType: 'PNEUMATIC_TRANSIT_TUBE',
      networkId: opts.networkId ?? 'dispatch_central',
      operatingPressureKpa: opts.currentPressureKpa ?? 70,
      maxPressureKpa: opts.maxPressureKpa ?? 150,
      ruptured: false,
      isRuptured: false,
      connectedEndpointEntityIds: [],
    },
    inventory: seedFixtureInventory(id, loot, entities, 15000, 10000),
  };
}

export function createFilingCabinetFixture(opts: FixtureOptions, entities?: Record<string, EntityRecord>): EntityRecord {
  const stratum = opts.stratum ?? 'STREET';
  const id = opts.customId ?? buildFixtureEntityId('filing_cabinet', opts.x, opts.y, stratum);
  const name = opts.label ?? 'Rolled-Steel Filing Cabinet';
  const loot = opts.lootItems ?? [{ blueprintId: 'book_pneumatic_schematic', quantity: 1 }];
  return {
    id,
    name,
    visual: opts.visual ?? { glyph: '⌸', fgPrimary: '#7F8C8D', fgSecondary: '#34495E', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: opts.x, y: opts.y, stratum, blocksMovement: opts.blocksMovement ?? true, blocksSight: opts.blocksSight ?? false },
    furniture: { kind: 'FILING_CABINET', label: name, durabilityHp: 220 },
    inventory: seedFixtureInventory(id, loot, entities, 40000, 45000),
  };
}

export function createValveManifoldFixture(opts: FixtureOptions): EntityRecord {
  const stratum = opts.stratum ?? 'STREET';
  const id = opts.customId ?? buildFixtureEntityId('valve_manifold', opts.x, opts.y, stratum);
  const name = opts.label ?? 'High-Pressure Valve Manifold';
  return {
    id,
    name,
    visual: opts.visual ?? { glyph: 'X', fgPrimary: '#E74C3C', fgSecondary: '#922B21', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
    position: { x: opts.x, y: opts.y, stratum, blocksMovement: opts.blocksMovement ?? true, blocksSight: opts.blocksSight ?? false },
    furniture: { kind: 'VALVE_MANIFOLD', label: name, durabilityHp: 300 },
    pressureVessel: { currentPressureKpa: opts.currentPressureKpa ?? 140, maxPressureKpa: opts.maxPressureKpa ?? 250, ruptured: false },
  };
}

export function createVictorianFixture(
  kind: FurnitureKind,
  opts: FixtureOptions,
  entities?: Record<string, EntityRecord>,
): EntityRecord {
  switch (kind) {
    case 'ARTIFICER_BENCH': return createArtificerBenchFixture(opts);
    case 'COAL_STOVE': return createCoalStoveFixture(opts, entities);
    case 'IRON_BOILER': return createIronBoilerFixture(opts);
    case 'ROLL_TOP_DESK': return createRollTopDeskFixture(opts, entities);
    case 'GAS_LAMP': return createGasLampFixture(opts);
    case 'PNEUMATIC_DISPATCH': return createPneumaticDispatchFixture(opts, entities);
    case 'FILING_CABINET': return createFilingCabinetFixture(opts, entities);
    case 'VALVE_MANIFOLD': return createValveManifoldFixture(opts);
    default: {
      const stratum = opts.stratum ?? 'STREET';
      const id = opts.customId ?? buildFixtureEntityId(kind, opts.x, opts.y, stratum);
      const name = opts.label ?? kind.replace(/_/g, ' ');
      const visual: VisualGlyphSpec = opts.visual ?? {
        glyph: kind === 'BAR_COUNTER' ? '═' : kind === 'CELL_BENCH' ? '─' : kind === 'SAFE_VAULT' ? '▣' : '■',
        fgPrimary: '#873600',
        fgSecondary: '#5B2C6F',
        bgColor: '#0A0D0E',
        shaderFlags: kind === 'SAFE_VAULT' ? ['SPARK_GLINT'] : [],
      };
      return {
        id,
        name,
        visual,
        position: { x: opts.x, y: opts.y, stratum, blocksMovement: opts.blocksMovement ?? true, blocksSight: opts.blocksSight ?? false },
        furniture: { kind, label: name, durabilityHp: 150 },
        ...(opts.isContainer ? { inventory: seedFixtureInventory(id, opts.lootItems, entities, 30000, 25000) } : {}),
      };
    }
  }
}

export const createFixtureEntity = createVictorianFixture;
