import { z } from 'zod';
import { EntityComponentsSchema, EntityRecord } from '../../schemas/components.schema.js';
import { SimEventSchema } from '../../schemas/events.schema.js';
import {
  BlueprintId,
  BlueprintIdSchema,
  EntityIdSchema,
  StratumId,
  StratumIdSchema,
} from '../../schemas/primitives.schema.js';
import { createStratumGrid, StratumGridSchema } from '../spatial/grid.js';
import {
  createInitialEconomyLedger,
  DistrictEconomyLedgerSchema,
} from '../systems/economy.system.js';
import { RNGStateSchema, SeededRNG } from './rng.js';

export const WorldStateSchema = z.object({
  version: z.literal(1),
  seed: z.number().int(),
  rngState: RNGStateSchema,
  turnCount: z.number().int().nonnegative(),
  macroTickCount: z.number().int().nonnegative(),
  currentDistrictId: BlueprintIdSchema.default(
    'district_spitalfields_soot_works' as z.infer<typeof BlueprintIdSchema>,
  ),
  strata: z.record(StratumIdSchema, StratumGridSchema),
  entities: z.record(z.string(), EntityComponentsSchema),
  economy: DistrictEconomyLedgerSchema,
  eventLog: z.array(SimEventSchema),
});
export type WorldState = z.infer<typeof WorldStateSchema>;

export interface CreateWorldConfig {
  seed: number;
  width?: number;
  height?: number;
}

export function createInitialWorld(config: CreateWorldConfig): WorldState {
  const width = config.width ?? 24;
  const height = config.height ?? 24;
  const rng = new SeededRNG(config.seed);

  const strataNames: StratumId[] = ['UNDERCROFT', 'STREET', 'SPIRE'];
  const strata: Record<StratumId, z.infer<typeof StratumGridSchema>> = {
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
    visual: {
      glyph: '@',
      fgPrimary: '#F4D03F',
      fgSecondary: '#B7950B',
      bgColor: '#0A0D0E',
      shaderFlags: [],
    },
    position: {
      x: centerX,
      y: centerY,
      stratum: 'STREET',
      blocksMovement: true,
      blocksSight: false,
    },
    actor: {
      energy: 100,
      speed: 100,
      isPlayer: true,
    },
    anatomy: {
      limbs: {
        HEAD: { slot: 'HEAD', hp: 20, maxHp: 20, amputated: false },
        TORSO: { slot: 'TORSO', hp: 50, maxHp: 50, amputated: false },
        LEFT_ARM: { slot: 'LEFT_ARM', hp: 25, maxHp: 25, amputated: false },
        RIGHT_ARM: { slot: 'RIGHT_ARM', hp: 25, maxHp: 25, amputated: false },
        LEFT_LEG: {
          slot: 'LEFT_LEG',
          hp: 0,
          maxHp: 30,
          amputated: true,
          installedProstheticEntityId: striderLegId,
        },
        RIGHT_LEG: { slot: 'RIGHT_LEG', hp: 30, maxHp: 30, amputated: false },
        OCULAR_MOUNT: {
          slot: 'OCULAR_MOUNT',
          hp: 10,
          maxHp: 10,
          amputated: false,
          installedProstheticEntityId: ocularMonocleId,
        },
        CHASSIS_CORE: { slot: 'CHASSIS_CORE', hp: 40, maxHp: 40, amputated: false },
      },
      bloodVolumePct: 100,
      steamReserveKpa: 100,
      maxSteamReserveKpa: 100,
    },
    inventory: {
      containedEntityIds: [striderLegId, ocularMonocleId],
      maxMassGrams: 25000,
      maxVolumeMl: 30000,
      currentMassGrams: 5100,
    },
  };

  const striderLegEntity: EntityRecord = {
    id: striderLegId,
    name: 'Pneumatic Strider Leg Mk.II',
    visual: {
      glyph: 'L',
      fgPrimary: '#D4AF37',
      fgSecondary: '#9A7D0A',
      bgColor: '#0A0D0E',
      shaderFlags: ['SPARK_GLINT'],
    },
    prostheticSpec: {
      blueprintId: BlueprintIdSchema.parse('item_pneumatic_strider_leg'),
      targetLimbSlot: 'LEFT_LEG',
      socketType: 'PNEUMATIC_BRACKET',
      massGrams: 4500,
      volumeMl: 3200,
      steamConsumptionPerTurn: 2,
      moveApModifier: -15,
      fovRadiusBonus: 0,
      pressureRatingKpa: 250,
    },
  };

  const ocularMonocleEntity: EntityRecord = {
    id: ocularMonocleId,
    name: 'Aetheric Vernier Monocle',
    visual: {
      glyph: 'o',
      fgPrimary: '#5DADE2',
      fgSecondary: '#2E86C1',
      bgColor: '#0A0D0E',
      shaderFlags: ['HEAT_SHIMMER'],
    },
    prostheticSpec: {
      blueprintId: BlueprintIdSchema.parse('item_aetheric_monocle'),
      targetLimbSlot: 'OCULAR_MOUNT',
      socketType: 'CLOCKWORK_GEAR',
      massGrams: 600,
      volumeMl: 450,
      steamConsumptionPerTurn: 0,
      moveApModifier: 0,
      fovRadiusBonus: 3,
      pressureRatingKpa: 120,
    },
  };

  const manholeEntity: EntityRecord = {
    id: manholeDownId,
    name: 'Heavy Cast-Iron Manhole Cover (To Undercroft)',
    visual: {
      glyph: '>',
      fgPrimary: '#7F8C8D',
      fgSecondary: '#2C3E50',
      bgColor: '#0A0D0E',
      shaderFlags: [],
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
      portalLabel: 'Descend Heavy Cast-Iron Ladder to Undercroft',
    },
  };

  const ladderEntity: EntityRecord = {
    id: ladderUpId,
    name: 'Rusted Iron Ladder (To Street)',
    visual: {
      glyph: '<',
      fgPrimary: '#7F8C8D',
      fgSecondary: '#2C3E50',
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

  for (const s of strataNames) {
    if (!strata[s]) {
      throw new Error(`Missing stratum initialization: ${s}`);
    }
  }

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
    eventLog: [],
  };
}

export function serializeWorld(state: WorldState): string {
  return JSON.stringify(state);
}

export function deserializeWorld(json: string): WorldState {
  const parsed: unknown = JSON.parse(json);
  return WorldStateSchema.parse(parsed);
}
