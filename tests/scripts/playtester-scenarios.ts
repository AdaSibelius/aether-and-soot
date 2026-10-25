import { EntityRecord, PortalComponentSchema } from '../../src/schemas/components.schema.js';
import { BlueprintIdSchema, EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { WorldState } from '../../src/sim/core/world.js';
import { setTileCell } from '../../src/sim/spatial/grid.js';
import { spawnDistrictNpcs } from '../../src/sim/systems/district-spawner.js';

export type PlaytestScenario =
  | 'explore'
  | 'combat'
  | 'economy'
  | 'transit'
  | 'surgical'
  | 'sabotage'
  | 'safehouse_transit';

export interface ScenarioObjectives {
  readonly primary: string;
  readonly secondary: string;
}

export function getScenarioObjectives(scenario: PlaytestScenario): ScenarioObjectives {
  switch (scenario) {
    case 'combat':
      return {
        primary: 'Neutralize the hostile clockwork automaton or deploy steam to break combat visual lock.',
        secondary: 'Use ATTACK to strike vulnerable limbs (HEAD, TORSO) or VENT_STEAM to obscure line-of-sight.',
      };
    case 'economy':
      return {
        primary: 'Purchase Coagulant Tonic from adjacent Apothecary Chirurgeon and consume it to heal blood volume.',
        secondary: 'Use BUY to acquire "loot_merchant_tonic", then use USE_ITEM on "loot_merchant_tonic" to heal vitals.',
      };
    case 'transit':
      return {
        primary: 'Navigate through security corridor, bypass hazards, and transition to Undercroft.',
        secondary: 'Avoid or disarm trap, use TOGGLE_DOOR to open barrier, and execute USE_PORTAL on staircase.',
      };
    case 'surgical':
      return {
        primary: 'Stoke boiler, salvage scrap into Brass Gears, field repair left arm, and graft Gilded Pneumatic Strider Leg Mk.I.',
        secondary: 'Use STOKE_BOILER, SALVAGE_ITEM, FIELD_REPAIR_LIMB, and GRAFT_PROSTHETIC.',
      };
    case 'sabotage':
      return {
        primary: 'Overpressurize Foundry Boiler beyond 300 kPa to trigger -60 Coal Supply shock, then profit on Anthracite Coal.',
        secondary: 'Use PRESSURIZE_VESSEL on Foundry Boiler, then execute SELL_TO_MERCHANT for Anthracite Coal.',
      };
    case 'safehouse_transit':
      return {
        primary: 'Claim workshop vault deed, stock trade pedestal with Anthracite Coal, and dispatch inter-district monorail transit.',
        secondary: 'Use CLAIM_SAFEHOUSE, STOCK_PEDESTAL, and DISPATCH_MONORAIL.',
      };
    case 'explore':
    default:
      return {
        primary: 'Explore district, uncover unvisited tiles, and survive.',
        secondary: 'Interact with closed doors (+), avoid armed traps (^), and vent steam (~) to break line-of-sight.',
      };
  }
}

export function applyPlaytestScenario(state: WorldState, scenario: PlaytestScenario): WorldState {
  const playerId = EntityIdSchema.parse('actor_player');
  const player = state.entities[playerId];
  if (!player?.position) return state;

  const withNpcs = !state.entities['npc_clockwork_warden'] ? spawnDistrictNpcs(state).state : state;
  const pos = player.position;
  let grid = withNpcs.strata[pos.stratum];
  if (!grid) return withNpcs;

  const nextEntities: Record<string, EntityRecord> = { ...withNpcs.entities };
  let nextEconomy = withNpcs.economy;

  if (scenario === 'combat') {
    const wardenId = EntityIdSchema.parse('npc_clockwork_warden');
    const targetX = Math.min(grid.width - 2, pos.x + 2);
    const targetY = pos.y;
    for (let x = Math.min(pos.x, targetX); x <= Math.max(pos.x, targetX); x++) {
      grid = setTileCell(grid, x, targetY, (c) => ({ ...c, terrainType: 'COBBLESTONE_FLOOR', blocksMovement: false, blocksSight: false }));
    }
    const warden = nextEntities[wardenId] ?? {
      id: wardenId, name: 'Clockwork Automaton Warden',
      visual: { glyph: 'W', fgPrimary: '#2E86C1', fgSecondary: '#D4AF37', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
      actor: { energy: 0, speed: 100, isPlayer: false },
      combatStats: { meleeDamage: 12, accuracyPct: 85, armorReduction: 2 },
    };
    nextEntities[wardenId] = {
      ...warden,
      position: { x: targetX, y: targetY, stratum: pos.stratum, blocksMovement: true, blocksSight: false },
      aiController: { factionId: 'CROWN_CONSTABULARY', role: 'GUARD', hostile: true, alertState: 'COMBAT' },
    };
    if (player.anatomy) {
      nextEntities[playerId] = {
        ...player,
        anatomy: { ...player.anatomy, steamReserveKpa: 100 },
        combatStats: { meleeDamage: 18, accuracyPct: 90, armorReduction: 2 },
      };
    }
  } else if (scenario === 'economy') {
    for (const [id, ent] of Object.entries(nextEntities)) {
      if (ent.portal || ent.districtGate) delete nextEntities[id];
    }
    const merchantId = EntityIdSchema.parse('npc_guild_merchant');
    const mX = pos.x + 1;
    grid = setTileCell(grid, pos.x, pos.y, (c) => ({ ...c, terrainType: 'COBBLESTONE_FLOOR', blocksMovement: false, blocksSight: false }));
    grid = setTileCell(grid, mX, pos.y, (c) => ({ ...c, terrainType: 'COBBLESTONE_FLOOR', blocksMovement: false, blocksSight: false }));
    const tonicId = EntityIdSchema.parse('loot_merchant_tonic');
    nextEntities[tonicId] = {
      id: tonicId, name: 'Coagulant Tonic',
      visual: { glyph: '!', fgPrimary: '#E74C3C', fgSecondary: '#C0392B', bgColor: '#0A0D0E', shaderFlags: [] },
      item: { blueprintId: BlueprintIdSchema.parse('item_coagulant_tonic'), category: 'CONSUMABLE', quantity: 3, stackable: true, massGrams: 250, volumeMl: 250, useEffect: { kind: 'RESTORE_BLOOD', magnitude: 30 } },
    };
    nextEntities[merchantId] = {
      id: merchantId, name: 'Apothecary Chirurgeon',
      visual: { glyph: 'M', fgPrimary: '#F4D03F', fgSecondary: '#D4AF37', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
      actor: { energy: 0, speed: 80, isPlayer: false },
      position: { x: mX, y: pos.y, stratum: pos.stratum, blocksMovement: true, blocksSight: false },
      aiController: { factionId: 'CLOCKWORK_GUILD', role: 'MERCHANT', hostile: false, alertState: 'IDLE' },
      inventory: { containedEntityIds: [tonicId], maxMassGrams: 30000, maxVolumeMl: 30000, currentMassGrams: 750 },
    };
    nextEconomy = { ...nextEconomy, playerTreasuryPence: 500 };
    if (player.anatomy) nextEntities[playerId] = { ...player, anatomy: { ...player.anatomy, bloodVolumePct: 70 } };
  } else if (scenario === 'transit') {
    const x1 = Math.min(grid.width - 5, pos.x + 1), x2 = x1 + 1, x3 = x1 + 2, x4 = x1 + 3;
    grid = setTileCell(grid, x1, pos.y, (c) => ({ ...c, terrainType: 'COBBLESTONE_FLOOR', blocksMovement: false, blocksSight: false }));
    grid = setTileCell(grid, x2, pos.y, (c) => ({ ...c, terrainType: 'COBBLESTONE_FLOOR', blocksMovement: false, blocksSight: false }));
    grid = setTileCell(grid, x3, pos.y, (c) => ({ ...c, terrainType: 'WOODEN_DOOR_CLOSED', blocksMovement: true, blocksSight: true }));
    grid = setTileCell(grid, x4, pos.y, (c) => ({ ...c, terrainType: 'COBBLESTONE_FLOOR', blocksMovement: false, blocksSight: false }));
    const trapId = EntityIdSchema.parse('env_transit_trap');
    nextEntities[trapId] = { id: trapId, name: 'Clockwork Spring Jaw Trap', visual: { glyph: '^', fgPrimary: '#E74C3C', fgSecondary: '#922B21', bgColor: '#0A0D0E', shaderFlags: [] }, position: { x: x2, y: pos.y, stratum: pos.stratum, blocksMovement: false, blocksSight: false }, trap: { trapKind: 'SPRING_JAW', armed: true, damageMagnitude: 15 } };
    const portalId = EntityIdSchema.parse('env_transit_stairs_down');
    nextEntities[portalId] = { id: portalId, name: 'Stairs Down to Undercroft', visual: { glyph: '>', fgPrimary: '#F4D03F', fgSecondary: '#B7950B', bgColor: '#0A0D0E', shaderFlags: [] }, position: { x: x4, y: pos.y, stratum: pos.stratum, blocksMovement: false, blocksSight: false }, portal: PortalComponentSchema.parse({ target: { x: 10, y: 10, stratum: 'UNDERCROFT' }, portalLabel: 'Stairs down to Undercroft' }) };
  } else if (scenario === 'surgical') {
    const boilerId = EntityIdSchema.parse('env_boiler_surgical');
    nextEntities[boilerId] = { id: boilerId, name: 'Steam Boilerhouse Furnace', visual: { glyph: 'B', fgPrimary: '#E67E22', fgSecondary: '#D35400', bgColor: '#0A0D0E', shaderFlags: [] }, position: { x: pos.x + 1, y: pos.y, stratum: pos.stratum, blocksMovement: true, blocksSight: false }, pressureVessel: { maxPressureKpa: 300, currentPressureKpa: 100, ruptured: false } };
    const legId = EntityIdSchema.parse('item_strider_leg');
    nextEntities[legId] = { id: legId, name: 'Gilded Pneumatic Strider Leg Mk.I', visual: { glyph: ']', fgPrimary: '#F1C40F', fgSecondary: '#D4AC0D', bgColor: '#0A0D0E', shaderFlags: [] }, prostheticSpec: { blueprintId: BlueprintIdSchema.parse('prosthetic_pneumatic_leg_mk1'), targetLimbSlot: 'LEFT_LEG', socketType: 'ACTUATOR', massGrams: 4200, volumeMl: 3100, pressureRatingKpa: 320, moveApModifier: -15, steamConsumptionPerTurn: 1.5, noiseDb: 25, fovRadiusBonus: 0 } };
    const scrapId = EntityIdSchema.parse('item_scrap_metal');
    nextEntities[scrapId] = { id: scrapId, name: 'Clockwork Scrap Gears', visual: { glyph: '*', fgPrimary: '#BDC3C7', fgSecondary: '#7F8C8D', bgColor: '#0A0D0E', shaderFlags: [] }, item: { blueprintId: BlueprintIdSchema.parse('mat_cast_iron_plate'), category: 'MATERIAL', massGrams: 500, volumeMl: 500, quantity: 1, stackable: true } };
    const fuelId = EntityIdSchema.parse('item_fuel_canister');
    nextEntities[fuelId] = { id: fuelId, name: 'Pressurized Steam Canister', visual: { glyph: '~', fgPrimary: '#3498DB', fgSecondary: '#2980B9', bgColor: '#0A0D0E', shaderFlags: [] }, item: { blueprintId: BlueprintIdSchema.parse('item_pressurized_steam_canister'), category: 'CONSUMABLE', massGrams: 600, volumeMl: 500, quantity: 1, stackable: true } };
    const playerAnatomy = player.anatomy ? { ...player.anatomy, limbs: { ...player.anatomy.limbs, LEFT_ARM: { ...player.anatomy.limbs['LEFT_ARM']!, hp: 35 } } } : undefined;
    const invIds = [legId, scrapId, fuelId];
    for (const oldId of player.inventory?.containedEntityIds ?? []) {
      if (!invIds.includes(oldId)) delete nextEntities[oldId];
    }
    nextEntities[playerId] = { ...player, anatomy: playerAnatomy, inventory: { containedEntityIds: invIds, maxMassGrams: 40000, maxVolumeMl: 40000, currentMassGrams: 5300 } };
  } else if (scenario === 'sabotage') {
    const boilerId = EntityIdSchema.parse('env_foundry_boiler');
    nextEntities[boilerId] = { id: boilerId, name: 'Foundry Blast Boiler', visual: { glyph: 'B', fgPrimary: '#E74C3C', fgSecondary: '#C0392B', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] }, position: { x: pos.x + 1, y: pos.y, stratum: pos.stratum, blocksMovement: true, blocksSight: false }, pressureVessel: { maxPressureKpa: 300, currentPressureKpa: 280, ruptured: false } };
    const merchantId = EntityIdSchema.parse('npc_coal_broker');
    nextEntities[merchantId] = { id: merchantId, name: 'Ironmonger Coal Broker', visual: { glyph: 'M', fgPrimary: '#F39C12', fgSecondary: '#D68910', bgColor: '#0A0D0E', shaderFlags: [] }, position: { x: pos.x - 1, y: pos.y, stratum: pos.stratum, blocksMovement: true, blocksSight: false }, aiController: { factionId: 'IRONMONGERS_CARTEL', role: 'MERCHANT', hostile: false, alertState: 'IDLE' }, inventory: { containedEntityIds: [], maxMassGrams: 50000, maxVolumeMl: 50000, currentMassGrams: 0 } };
    const coalId = EntityIdSchema.parse('item_player_coal');
    nextEntities[coalId] = { id: coalId, name: 'Anthracite Coal Briquette', visual: { glyph: '$', fgPrimary: '#34495E', fgSecondary: '#2C3E50', bgColor: '#0A0D0E', shaderFlags: [] }, item: { blueprintId: BlueprintIdSchema.parse('commodity_anthracite_briquette'), category: 'COMMODITY', massGrams: 1000, volumeMl: 800, quantity: 5, stackable: true } };
    for (const oldId of player.inventory?.containedEntityIds ?? []) {
      if (oldId !== coalId) delete nextEntities[oldId];
    }
    nextEntities[playerId] = { ...player, inventory: { containedEntityIds: [coalId], maxMassGrams: 30000, maxVolumeMl: 30000, currentMassGrams: 1000 } };
  } else if (scenario === 'safehouse_transit') {
    const monorailId = EntityIdSchema.parse('env_monorail_cab');
    nextEntities[monorailId] = { id: monorailId, name: 'Pneumatic Monorail Cab', visual: { glyph: 'T', fgPrimary: '#1ABC9C', fgSecondary: '#16A085', bgColor: '#0A0D0E', shaderFlags: [] }, position: { x: pos.x, y: pos.y + 1, stratum: pos.stratum, blocksMovement: false, blocksSight: false }, monorailCar: { carId: 'env_monorail_cab', destinationDistrictId: BlueprintIdSchema.parse('district_gilded_spire'), steamPressureKpa: 200, speedMph: 45, occupiedByActorIds: [] } };
    const coalId = EntityIdSchema.parse('item_pedestal_coal');
    nextEntities[coalId] = { id: coalId, name: 'Anthracite Coal', visual: { glyph: '$', fgPrimary: '#34495E', fgSecondary: '#2C3E50', bgColor: '#0A0D0E', shaderFlags: [] }, item: { blueprintId: BlueprintIdSchema.parse('commodity_anthracite_briquette'), category: 'COMMODITY', massGrams: 1000, volumeMl: 800, quantity: 10, stackable: true } };
    for (const oldId of player.inventory?.containedEntityIds ?? []) {
      if (oldId !== coalId) delete nextEntities[oldId];
    }
    nextEntities[playerId] = { ...player, inventory: { containedEntityIds: [coalId], maxMassGrams: 30000, maxVolumeMl: 30000, currentMassGrams: 1000 } };
  }

  return { ...withNpcs, economy: nextEconomy, strata: { ...withNpcs.strata, [pos.stratum]: grid }, entities: nextEntities };
}
