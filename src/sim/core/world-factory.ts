import { z } from 'zod';
import { EntityRecord } from '../../schemas/components.schema.js';
import { BlueprintIdSchema, EntityIdSchema, StratumId,  } from '../../schemas/primitives.schema.js';
import { createStratumGrid, markExploredTiles, StratumGridSchema } from '../spatial/grid.js';
import { computeVisibleTiles } from '../spatial/fov.js';
import { createInitialEconomyLedger,  } from '../systems/economy.system.js';
import { SeededRNG } from './rng.js';
import { WorldState, CreateWorldConfig } from './world.js';

export function createInitialWorld(config: CreateWorldConfig): WorldState {
  const width = config.width ?? 48;
  const height = config.height ?? 36;
  const rng = new SeededRNG(config.seed);

  const strata: Record<StratumId, z.infer<typeof StratumGridSchema>> = {
    CATACOMBS: createStratumGrid('CATACOMBS', width, height),
    UNDERCROFT: createStratumGrid('UNDERCROFT', width, height),
    STREET: createStratumGrid('STREET', width, height),
    SPIRE: createStratumGrid('SPIRE', width, height),
  };

  const playerId = EntityIdSchema.parse('actor_player');
  const manholeDownId = EntityIdSchema.parse('portal_manhole_down');
  const ladderUpId = EntityIdSchema.parse('portal_ladder_up');
  const striderLegId = EntityIdSchema.parse('item_pneumatic_strider_leg');
  const ocularMonocleId = EntityIdSchema.parse('item_aetheric_monocle');

  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);

  const playerEntity: EntityRecord = {
    id: playerId,
    name: 'Chief Artificer',
    visual: { glyph: '@', fgPrimary: '#F4D03F', fgSecondary: '#B7950B', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: centerX, y: centerY, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    actor: { energy: 100, speed: 100, isPlayer: true },
    anatomy: {
      limbs: {
        HEAD: { slot: 'HEAD', hp: 20, maxHp: 20, amputated: false },
        TORSO: { slot: 'TORSO', hp: 40, maxHp: 40, amputated: false },
        LEFT_ARM: { slot: 'LEFT_ARM', hp: 25, maxHp: 25, amputated: false },
        RIGHT_ARM: { slot: 'RIGHT_ARM', hp: 25, maxHp: 25, amputated: false },
        LEFT_LEG: { slot: 'LEFT_LEG', hp: 30, maxHp: 30, amputated: false },
        RIGHT_LEG: { slot: 'RIGHT_LEG', hp: 30, maxHp: 30, amputated: false },
        OCULAR_MOUNT: { slot: 'OCULAR_MOUNT', hp: 10, maxHp: 10, amputated: false },
        CHASSIS_CORE: { slot: 'CHASSIS_CORE', hp: 50, maxHp: 50, amputated: false },
      },
      bloodVolumePct: 100,
      steamReserveKpa: 100,
      maxSteamReserveKpa: 100,
      unlockedRecipeIds: [],
      governorCapacityKw: 100,
      strainLoadKw: 0,
      toxicityPct: 0,
      painShock: 0,
      stamina: 100,
      activeEffects: [],
    },
    inventory: {
      containedEntityIds: [striderLegId, ocularMonocleId],
      equippedSlots: {},
      maxMassGrams: 25000,
      maxVolumeMl: 30000,
      currentMassGrams: 4650,
    },
    thermal: { coreHeatPct: 50 },
  };

  const striderLegEntity: EntityRecord = {
    id: striderLegId,
    name: 'Gilded Pneumatic Strider Leg Mk.I',
    visual: { glyph: 'L', fgPrimary: '#D4AF37', fgSecondary: '#8B4513', bgColor: '#0A0D0E', shaderFlags: ['PULSE_STEAM'] },
    prostheticSpec: {
      blueprintId: BlueprintIdSchema.parse('prosthetic_pneumatic_leg_mk1'),
      targetLimbSlot: 'LEFT_LEG',
      socketType: 'ACTUATOR',
      massGrams: 4200, volumeMl: 3100, steamConsumptionPerTurn: 2,
      moveApModifier: -15, fovRadiusBonus: 0, pressureRatingKpa: 320, noiseDb: 25,
    },
  };

  const ocularMonocleEntity: EntityRecord = {
    id: ocularMonocleId,
    name: 'Aetheric Turret Monocle',
    visual: { glyph: 'o', fgPrimary: '#5DADE2', fgSecondary: '#D4AF37', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
    prostheticSpec: {
      blueprintId: BlueprintIdSchema.parse('prosthetic_clockwork_ocular_lens'),
      targetLimbSlot: 'OCULAR_MOUNT',
      socketType: 'OPTIC_SENSOR',
      massGrams: 450, volumeMl: 300, steamConsumptionPerTurn: 0,
      moveApModifier: 0, fovRadiusBonus: 4, pressureRatingKpa: 120, noiseDb: 0,
    },
  };

  const manholeEntity: EntityRecord = {
    id: manholeDownId,
    name: 'Iron Manhole to Undercroft',
    visual: {
      glyph: '>',
      fgPrimary: '#D4AF37',
      fgSecondary: '#5D6D7E',
      bgColor: '#0A0D0E',
      shaderFlags: ['PULSE_STEAM'],
    },
    position: {
      x: centerX,
      y: centerY,
      stratum: 'STREET',
      blocksMovement: false,
      blocksSight: false,
    },
    portal: {
      target: { x: centerX, y: centerY, stratum: 'UNDERCROFT' },
      bidirectional: true,
      conductsGas: true,
      apCost: 100,
      portalLabel: 'Descend into the Soot-Sewers',
    },
  };

  const ladderEntity: EntityRecord = {
    id: ladderUpId,
    name: 'Rusted Iron Ladder to Street',
    visual: {
      glyph: '<',
      fgPrimary: '#D4AF37',
      fgSecondary: '#5D6D7E',
      bgColor: '#0A0D0E',
      shaderFlags: [],
    },
    position: {
      x: centerX,
      y: centerY,
      stratum: 'UNDERCROFT',
      blocksMovement: false,
      blocksSight: false,
    },
    portal: {
      target: { x: centerX, y: centerY, stratum: 'STREET' },
      bidirectional: true,
      conductsGas: true,
      apCost: 100,
      portalLabel: 'Climb to Cobblestone Street',
    },
  };

  const initialVisible = computeVisibleTiles(strata.STREET, centerX, centerY, 10);
  strata.STREET = markExploredTiles(strata.STREET, initialVisible);

  return {
    version: 1,
    seed: config.seed,
    rngState: rng.getState(),
    turnCount: 0,
    macroTickCount: 0,
    currentDistrictId: BlueprintIdSchema.parse('district_spitalfields_soot_works'),
    strata,
    entities: {
      [playerId]: playerEntity,
      [striderLegId]: striderLegEntity,
      [ocularMonocleId]: ocularMonocleEntity,
      [manholeDownId]: manholeEntity,
      [ladderUpId]: ladderEntity,
    },
    economy: createInitialEconomyLedger(),
    contracts: [],
    safehouses: {},
    codex: {},
    turf: {},
    convoys: {},
    audits: {},
    eventLog: [],
    savedDistricts: {},
    catacombDepths: {},
  };
}
