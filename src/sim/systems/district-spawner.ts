import { AnatomyComponent, EntityRecord } from '../../schemas/components.schema.js';
import { FactionContract } from '../../schemas/contracts.schema.js';
import { BlueprintIdSchema, EntityId, EntityIdSchema } from '../../schemas/primitives.schema.js';
import { getTileCell, isWithinBounds, StratumGrid } from '../spatial/grid.js';
import { WorldState } from '../core/world.js';
import { createEntityFromBlueprint } from '../data/item-catalog.js';
import { getCarryProfile } from './inventory-utils.js';

function findWalkableSpawnPoint(
  grid: StratumGrid | undefined,
  defaultX: number,
  defaultY: number,
  entities?: Readonly<Record<string, EntityRecord>>,
): { x: number; y: number } {
  if (!grid) return { x: defaultX, y: defaultY };
  const isOccupied = (x: number, y: number): boolean => {
    if (!entities) return false;
    return Object.values(entities).some(
      (e) => e.position && e.position.stratum === grid.stratum && e.position.x === x && e.position.y === y && e.position.blocksMovement,
    );
  };
  const initial = getTileCell(grid, defaultX, defaultY);
  if (initial && !initial.blocksMovement && !isOccupied(defaultX, defaultY)) return { x: defaultX, y: defaultY };

  for (let r = 1; r <= 8; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = defaultX + dx;
        const ny = defaultY + dy;
        if (isWithinBounds(grid, nx, ny)) {
          const cell = getTileCell(grid, nx, ny);
          if (cell && !cell.blocksMovement && !isOccupied(nx, ny)) {
            return { x: nx, y: ny };
          }
        }
      }
    }
  }
  return { x: defaultX, y: defaultY };
}

export function createDefaultNpcAnatomy(torsoHp = 45, limbHp = 25): AnatomyComponent {
  return {
    bloodVolumePct: 100,
    steamReserveKpa: 80,
    maxSteamReserveKpa: 100,
    governorCapacityKw: 100,
    strainLoadKw: 0,
    toxicityPct: 0,
    painShock: 0,
    stamina: 100,
    activeEffects: [],
    limbs: {
      HEAD: { slot: 'HEAD', hp: limbHp, maxHp: limbHp, amputated: false },
      TORSO: { slot: 'TORSO', hp: torsoHp, maxHp: torsoHp, amputated: false },
      LEFT_ARM: { slot: 'LEFT_ARM', hp: limbHp, maxHp: limbHp, amputated: false },
      RIGHT_ARM: { slot: 'RIGHT_ARM', hp: limbHp, maxHp: limbHp, amputated: false },
      LEFT_LEG: { slot: 'LEFT_LEG', hp: limbHp, maxHp: limbHp, amputated: false },
      RIGHT_LEG: { slot: 'RIGHT_LEG', hp: limbHp, maxHp: limbHp, amputated: false },
    },
    unlockedRecipeIds: [],
  };
}

function buildNpcInventory(
  entities: Record<string, EntityRecord>,
  items: readonly { id: string; blueprintId: string; quantity: number }[],
): { containedIds: EntityId[]; totalMass: number } {
  const containedIds: EntityId[] = [];
  let totalMass = 0;
  for (const spec of items) {
    const eid = EntityIdSchema.parse(spec.id);
    const created = createEntityFromBlueprint(BlueprintIdSchema.parse(spec.blueprintId), eid, spec.quantity);
    if (!created) continue;
    entities[eid] = created;
    containedIds.push(eid);
    totalMass += getCarryProfile(created)?.massGrams ?? 0;
  }
  return { containedIds, totalMass };
}

export function createProceduralDistrictContracts(): FactionContract[] {
  return [
    {
      id: 'contract_deliver_gears', issuerNpcId: EntityIdSchema.parse('npc_guild_merchant'), factionId: 'CLOCKWORK_GUILD',
      title: 'Requisition: Brass Clockwork Gears', description: 'Deliver 1 set of machined brass gears to the Clockwork Guild quartermaster.',
      kind: 'DELIVER_ITEM', targetBlueprintOrEntityId: 'mat_brass_gears', rewardPence: 45, rewardReputation: 15, status: 'AVAILABLE',
    },
    {
      id: 'contract_slay_scavenger', issuerNpcId: EntityIdSchema.parse('npc_clockwork_warden'), factionId: 'CROWN_CONSTABULARY',
      title: 'Bounty: Neutralize Sump Scavenger', description: 'Track down and eliminate the hostile sump scavenger lurking in the district.',
      kind: 'SLAY_HOSTILE', targetBlueprintOrEntityId: 'npc_sump_scavenger', rewardPence: 60, rewardReputation: 20, status: 'AVAILABLE',
    },
    {
      id: 'contract_sabotage_boiler', issuerNpcId: EntityIdSchema.parse('npc_syndicate_fixer'), factionId: 'UNDERCROFT_SYNDICATE',
      title: 'Sabotage: Overpressurize Foundry Boiler', description: 'Overpressurize the Ironmongers foundry boiler beyond safety thresholds to disrupt production.',
      kind: 'PRESSURIZE_BOILER', targetBlueprintOrEntityId: 'vessel_district_boiler', rewardPence: 80, rewardReputation: 25, status: 'AVAILABLE',
    },
  ];
}

export function spawnDistrictNpcs(state: WorldState): {
  readonly state: WorldState;
  readonly spawnedNpcIds: readonly EntityId[];
} {
  const entities: Record<string, EntityRecord> = { ...state.entities };
  const wardenId = EntityIdSchema.parse('npc_clockwork_warden');
  const scavengerId = EntityIdSchema.parse('npc_sump_scavenger');
  const stokerId = EntityIdSchema.parse('npc_foundry_stoker');
  const merchantId = EntityIdSchema.parse('npc_guild_merchant');
  const chirurgeonId = EntityIdSchema.parse('npc_apothecary_chirurgeon');
  const fixerId = EntityIdSchema.parse('npc_syndicate_fixer');

  const streetGrid = state.strata.STREET;
  const undercroftGrid = state.strata.UNDERCROFT;
  const isLarge = streetGrid && streetGrid.width >= 36 && streetGrid.height >= 28;

  // AUD-03: Anchor NPCs to their permuted building typology fixtures so they always spawn inside their thematic zones
  const surgTablePos = entities['furniture_surgical_table']?.position;
  const safeVaultPos = entities['furniture_safe_vault']?.position;
  const cotPos = entities['furniture_cot_a']?.position;
  const boilerPos = entities['vessel_district_boiler']?.position;

  const wardenPos = findWalkableSpawnPoint(streetGrid, 10, 11, entities);
  const scavengerPos = findWalkableSpawnPoint(undercroftGrid, 11, 11, entities);
  const stokerPos = findWalkableSpawnPoint(
    streetGrid,
    boilerPos ? boilerPos.x + 1 : 14,
    boilerPos ? boilerPos.y : 13,
    entities,
  );
  const merchantPos = findWalkableSpawnPoint(
    streetGrid,
    safeVaultPos ? safeVaultPos.x : 19,
    safeVaultPos ? safeVaultPos.y + 3 : 19,
    entities,
  );
  const chirurgeonPos = findWalkableSpawnPoint(
    streetGrid,
    surgTablePos ? surgTablePos.x + 1 : isLarge ? 34 : 16,
    surgTablePos ? surgTablePos.y : isLarge ? 6 : 16,
    entities,
  );
  const fixerPos = findWalkableSpawnPoint(
    streetGrid,
    cotPos ? cotPos.x + 1 : isLarge ? 34 : 18,
    cotPos ? cotPos.y : isLarge ? 26 : 17,
    entities,
  );

  const wardenInv = buildNpcInventory(entities, [{ id: 'loot_warden_gears', blueprintId: 'mat_brass_gears', quantity: 2 }]);
  const scavengerInv = buildNpcInventory(entities, [{ id: 'loot_scavenger_salt', blueprintId: 'mat_aether_salt', quantity: 2 }]);
  const stokerInv = buildNpcInventory(entities, [{ id: 'loot_stoker_coal', blueprintId: 'commodity_anthracite_briquette', quantity: 1 }]);
  const merchantInv = buildNpcInventory(entities, [
    { id: 'loot_merchant_tonic', blueprintId: 'item_coagulant_tonic', quantity: 2 },
    { id: 'loot_merchant_canister', blueprintId: 'item_pressurized_steam_canister', quantity: 1 },
  ]);
  const chirurgeonInv = buildNpcInventory(entities, [{ id: 'loot_chirurgeon_tonic', blueprintId: 'item_coagulant_tonic', quantity: 3 }]);
  const fixerInv = buildNpcInventory(entities, [
    { id: 'loot_fixer_pouch', blueprintId: 'item_crown_pence_pouch', quantity: 1 },
    { id: 'loot_fixer_gears', blueprintId: 'mat_brass_gears', quantity: 1 },
  ]);

  entities[wardenId] = {
    id: wardenId, name: 'Clockwork Automaton Warden',
    visual: { glyph: 'W', fgPrimary: '#2E86C1', fgSecondary: '#D4AF37', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
    position: { x: wardenPos.x, y: wardenPos.y, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    actor: { energy: 0, speed: 100, isPlayer: false },
    aiController: { factionId: 'CROWN_CONSTABULARY', role: 'GUARD', hostile: false, alertState: 'IDLE' },
    combatStats: { meleeDamage: 14, accuracyPct: 88, armorReduction: 3 },
    anatomy: createDefaultNpcAnatomy(55, 30),
    inventory: { containedEntityIds: wardenInv.containedIds, maxMassGrams: 25000, maxVolumeMl: 30000, currentMassGrams: wardenInv.totalMass },
  };

  entities[scavengerId] = {
    id: scavengerId, name: 'Fleet Ditch Sump Scavenger',
    visual: { glyph: 's', fgPrimary: '#E74C3C', fgSecondary: '#922B21', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: scavengerPos.x, y: scavengerPos.y, stratum: 'UNDERCROFT', blocksMovement: true, blocksSight: false },
    actor: { energy: 0, speed: 100, isPlayer: false },
    aiController: { factionId: 'UNDERCROFT_SYNDICATE', role: 'SCAVENGER', hostile: true, alertState: 'IDLE' },
    combatStats: { meleeDamage: 10, accuracyPct: 80, armorReduction: 0 },
    anatomy: createDefaultNpcAnatomy(30, 20),
    inventory: { containedEntityIds: scavengerInv.containedIds, maxMassGrams: 20000, maxVolumeMl: 20000, currentMassGrams: scavengerInv.totalMass },
  };

  entities[stokerId] = {
    id: stokerId, name: 'Spitalfields Foundry Stoker',
    visual: { glyph: 'f', fgPrimary: '#E67E22', fgSecondary: '#CD7F32', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: stokerPos.x, y: stokerPos.y, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    actor: { energy: 0, speed: 90, isPlayer: false },
    aiController: { factionId: 'IRONMONGERS_CARTEL', role: 'CITIZEN', hostile: false, alertState: 'IDLE' },
    combatStats: { meleeDamage: 12, accuracyPct: 82, armorReduction: 1 },
    anatomy: createDefaultNpcAnatomy(45, 25),
    inventory: { containedEntityIds: stokerInv.containedIds, maxMassGrams: 25000, maxVolumeMl: 25000, currentMassGrams: stokerInv.totalMass },
  };

  entities[merchantId] = {
    id: merchantId, name: 'Royal Exchange Quartermaster',
    visual: { glyph: 'M', fgPrimary: '#F4D03F', fgSecondary: '#D4AF37', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
    position: { x: merchantPos.x, y: merchantPos.y, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    actor: { energy: 0, speed: 80, isPlayer: false },
    aiController: { factionId: 'CLOCKWORK_GUILD', role: 'MERCHANT', hostile: false, alertState: 'IDLE' },
    combatStats: { meleeDamage: 8, accuracyPct: 75, armorReduction: 1 },
    anatomy: createDefaultNpcAnatomy(40, 20),
    inventory: { containedEntityIds: merchantInv.containedIds, maxMassGrams: 30000, maxVolumeMl: 30000, currentMassGrams: merchantInv.totalMass },
  };

  entities[chirurgeonId] = {
    id: chirurgeonId, name: 'Chirurgeon Vane',
    visual: { glyph: 'C', fgPrimary: '#2ECC71', fgSecondary: '#27AE60', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: chirurgeonPos.x, y: chirurgeonPos.y, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    actor: { energy: 0, speed: 85, isPlayer: false },
    aiController: { factionId: 'CLOCKWORK_GUILD', role: 'CHIRURGEON', hostile: false, alertState: 'IDLE' },
    combatStats: { meleeDamage: 8, accuracyPct: 75, armorReduction: 1 },
    anatomy: createDefaultNpcAnatomy(40, 20),
    inventory: { containedEntityIds: chirurgeonInv.containedIds, maxMassGrams: 20000, maxVolumeMl: 20000, currentMassGrams: chirurgeonInv.totalMass },
  };

  entities[fixerId] = {
    id: fixerId, name: 'Syndicate Fixer Jasper',
    visual: { glyph: 'F', fgPrimary: '#9B59B6', fgSecondary: '#8E44AD', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: fixerPos.x, y: fixerPos.y, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    actor: { energy: 0, speed: 95, isPlayer: false },
    aiController: { factionId: 'UNDERCROFT_SYNDICATE', role: 'FIXER', hostile: false, alertState: 'IDLE' },
    combatStats: { meleeDamage: 11, accuracyPct: 80, armorReduction: 1 },
    anatomy: createDefaultNpcAnatomy(45, 25),
    inventory: { containedEntityIds: fixerInv.containedIds, maxMassGrams: 20000, maxVolumeMl: 20000, currentMassGrams: fixerInv.totalMass },
  };

  const nextContracts = state.contracts.length === 0 ? createProceduralDistrictContracts() : state.contracts;

  return {
    state: { ...state, entities, contracts: nextContracts },
    spawnedNpcIds: [wardenId, scavengerId, stokerId, merchantId, chirurgeonId, fixerId],
  };
}
