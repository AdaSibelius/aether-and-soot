import { EntityRecord, PortalComponentSchema } from '../../src/schemas/components.schema.js';
import { BlueprintIdSchema, EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { WorldState } from '../../src/sim/core/world.js';
import { setTileCell } from '../../src/sim/spatial/grid.js';
import { spawnDistrictNpcs } from '../../src/sim/systems/district-spawner.js';

export type PlaytestScenario = 'explore' | 'combat' | 'economy' | 'transit';

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
        primary: 'Purchase the Coagulant Tonic from the adjacent Apothecary Chirurgeon (M) and consume it to heal blood volume from 70%.',
        secondary: 'Use BUY to acquire "loot_merchant_tonic", then use USE_ITEM on "loot_merchant_tonic" to heal vitals.',
      };
    case 'transit':
      return {
        primary: 'Navigate through the security corridor, bypass or disarm hazards, and transition to the Undercroft.',
        secondary: 'Avoid or disarm the trap, use TOGGLE_DOOR to open the barrier, and execute USE_PORTAL on the staircase.',
      };
    case 'explore':
    default:
      return {
        primary: 'Explore the district, uncover unvisited tiles, and survive.',
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
    // Remove all portals and gates to isolate the player in the apothecary shop
    for (const [id, ent] of Object.entries(nextEntities)) {
      if (ent.portal || ent.districtGate) {
        delete nextEntities[id];
      }
    }

    const merchantId = EntityIdSchema.parse('npc_guild_merchant');
    const mX = pos.x + 1;
    const mY = pos.y;
    grid = setTileCell(grid, pos.x, pos.y, (c) => ({ ...c, terrainType: 'COBBLESTONE_FLOOR', blocksMovement: false, blocksSight: false }));
    grid = setTileCell(grid, mX, mY, (c) => ({ ...c, terrainType: 'COBBLESTONE_FLOOR', blocksMovement: false, blocksSight: false }));

    const tonicId = EntityIdSchema.parse('loot_merchant_tonic');
    nextEntities[tonicId] = {
      id: tonicId, name: 'Coagulant Tonic',
      visual: { glyph: '!', fgPrimary: '#E74C3C', fgSecondary: '#C0392B', bgColor: '#0A0D0E', shaderFlags: [] },
      item: {
        blueprintId: BlueprintIdSchema.parse('item_coagulant_tonic'),
        category: 'CONSUMABLE',
        quantity: 3,
        stackable: true,
        massGrams: 250,
        volumeMl: 250,
        useEffect: { kind: 'RESTORE_BLOOD', magnitude: 30 },
      },
    };

    const merchant = nextEntities[merchantId] ?? {
      id: merchantId, name: 'Apothecary Chirurgeon',
      visual: { glyph: 'M', fgPrimary: '#F4D03F', fgSecondary: '#D4AF37', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
      actor: { energy: 0, speed: 80, isPlayer: false },
    };

    nextEntities[merchantId] = {
      ...merchant,
      name: 'Apothecary Chirurgeon',
      position: { x: mX, y: mY, stratum: pos.stratum, blocksMovement: true, blocksSight: false },
      aiController: { factionId: 'CLOCKWORK_GUILD', role: 'MERCHANT', hostile: false, alertState: 'IDLE' },
      inventory: { containedEntityIds: [tonicId], maxMassGrams: 30000, maxVolumeMl: 30000, currentMassGrams: 750 },
    };

    nextEconomy = { ...nextEconomy, playerTreasuryPence: 500 };
    if (player.anatomy) {
      nextEntities[playerId] = {
        ...player,
        anatomy: { ...player.anatomy, bloodVolumePct: 70 },
      };
    }
  } else if (scenario === 'transit') {
    const x1 = Math.min(grid.width - 5, pos.x + 1);
    const x2 = x1 + 1;
    const x3 = x1 + 2;
    const x4 = x1 + 3;

    grid = setTileCell(grid, x1, pos.y, (c) => ({ ...c, terrainType: 'COBBLESTONE_FLOOR', blocksMovement: false, blocksSight: false }));
    grid = setTileCell(grid, x2, pos.y, (c) => ({ ...c, terrainType: 'COBBLESTONE_FLOOR', blocksMovement: false, blocksSight: false }));
    grid = setTileCell(grid, x3, pos.y, (c) => ({ ...c, terrainType: 'WOODEN_DOOR_CLOSED', blocksMovement: true, blocksSight: true }));
    grid = setTileCell(grid, x4, pos.y, (c) => ({ ...c, terrainType: 'COBBLESTONE_FLOOR', blocksMovement: false, blocksSight: false }));

    const trapId = EntityIdSchema.parse('env_transit_trap');
    nextEntities[trapId] = {
      id: trapId, name: 'Clockwork Spring Jaw Trap',
      visual: { glyph: '^', fgPrimary: '#E74C3C', fgSecondary: '#922B21', bgColor: '#0A0D0E', shaderFlags: [] },
      position: { x: x2, y: pos.y, stratum: pos.stratum, blocksMovement: false, blocksSight: false },
      trap: { trapKind: 'SPRING_JAW', armed: true, damageMagnitude: 15 },
    };

    const portalId = EntityIdSchema.parse('env_transit_stairs_down');
    nextEntities[portalId] = {
      id: portalId, name: 'Stairs Down to Undercroft',
      visual: { glyph: '>', fgPrimary: '#F4D03F', fgSecondary: '#B7950B', bgColor: '#0A0D0E', shaderFlags: [] },
      position: { x: x4, y: pos.y, stratum: pos.stratum, blocksMovement: false, blocksSight: false },
      portal: PortalComponentSchema.parse({ target: { x: 10, y: 10, stratum: 'UNDERCROFT' }, portalLabel: 'Stairs down to Undercroft' }),
    };
  }

  return {
    ...withNpcs,
    economy: nextEconomy,
    strata: { ...withNpcs.strata, [pos.stratum]: grid },
    entities: nextEntities,
  };
}
