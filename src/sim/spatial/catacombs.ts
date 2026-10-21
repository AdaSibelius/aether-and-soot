import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { BlueprintIdSchema, EntityId, EntityIdSchema, Point2D } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { WorldState } from '../core/world.js';
import { buildSolidStratumGrid, carveCorridor, carveRoom } from './district-layout.js';
import { setTileCell, StratumGrid } from './grid.js';

export interface CatacombsFloorResult {
  readonly grid: StratumGrid;
  readonly entities: Record<string, EntityRecord>;
  readonly stairsUp: Point2D;
  readonly stairsDown: Point2D;
  readonly tierName: string;
}

export function getCatacombsTierName(depth: number): string {
  if (depth <= 3) return 'Chalk Catacombs';
  if (depth <= 6) return 'Sunken Ossuary';
  if (depth <= 10) return 'Clockwork Vaults';
  return 'Abyssal Cog-Core';
}

export function generateCatacombsFloor(
  seedOrState: number | [number, number, number, number],
  width: number,
  height: number,
  depthLevel: number,
): CatacombsFloorResult {
  const rng = new SeededRNG(typeof seedOrState === 'number' ? seedOrState + depthLevel * 31337 : seedOrState);
  const tierName = getCatacombsTierName(depthLevel);
  let grid = buildSolidStratumGrid('CATACOMBS', width, height);

  const roomCenters: Point2D[] = [
    { x: rng.nextInt(3, 7), y: rng.nextInt(3, 7) },
    { x: rng.nextInt(14, 18), y: rng.nextInt(3, 7) },
    { x: rng.nextInt(14, 18), y: rng.nextInt(14, 18) },
    { x: rng.nextInt(3, 7), y: rng.nextInt(14, 18) },
  ];

  const miasmaSteam = Math.min(60, 5 + depthLevel * 6);
  const miasmaDust = Math.min(0.8, 0.1 + depthLevel * 0.08);

  for (let i = 0; i < roomCenters.length; i++) {
    const rc = roomCenters[i]!;
    const floorTerrain = depthLevel >= 7 ? 'BRASS_CATWALK' : 'COBBLESTONE_FLOOR';
    grid = carveRoom(grid, rc.x, rc.y, 2, 2, floorTerrain, miasmaDust);
    // Infuse miasma steam pressure into room
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const tx = rc.x + dx;
        const ty = rc.y + dy;
        if (tx > 0 && ty > 0 && tx < width - 1 && ty < height - 1) {
          grid = setTileCell(grid, tx, ty, (c) => ({
            ...c,
            steamPressureKpa: miasmaSteam,
            coalDustDensity: miasmaDust,
          }));
        }
      }
    }
  }

  // Connect rooms sequentially
  for (let i = 0; i < roomCenters.length; i++) {
    const from = roomCenters[i]!;
    const to = roomCenters[(i + 1) % roomCenters.length]!;
    grid = carveCorridor(grid, from, to, 'COBBLESTONE_FLOOR');
  }

  const stairsUp = roomCenters[0]!;
  const stairsDown = roomCenters[2]!;
  const entities: Record<string, EntityRecord> = {};

  // Entrance stairs
  const upId = EntityIdSchema.parse(`stairs_catacombs_up_d${depthLevel}`);
  entities[upId] = {
    id: upId,
    name: depthLevel === 1 ? 'Stairs Up to Undercroft' : `Stairs Up to Depth ${depthLevel - 1}`,
    visual: { glyph: '<', fgPrimary: '#D4AC0D', fgSecondary: '#7D6608', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: stairsUp.x, y: stairsUp.y, stratum: 'CATACOMBS', depthLevel, blocksMovement: false, blocksSight: false },
    portal: {
      target: { x: stairsUp.x, y: stairsUp.y, stratum: depthLevel === 1 ? 'UNDERCROFT' : 'CATACOMBS', depthLevel: depthLevel - 1 },
      bidirectional: true,
      conductsGas: true,
      apCost: 100,
      portalLabel: depthLevel === 1 ? 'Ascend to Undercroft' : `Ascend to Depth ${depthLevel - 1}`,
    },
  };

  // Descent stairs
  const downId = EntityIdSchema.parse(`stairs_catacombs_down_d${depthLevel}`);
  entities[downId] = {
    id: downId,
    name: `Stairs Down to Depth ${depthLevel + 1}`,
    visual: { glyph: '>', fgPrimary: '#E74C3C', fgSecondary: '#922B21', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: stairsDown.x, y: stairsDown.y, stratum: 'CATACOMBS', depthLevel, blocksMovement: false, blocksSight: false },
  };

  // Intermediate hazards & relics
  const trapKind = depthLevel >= 7 ? 'STEAM_MINE' : depthLevel >= 4 ? 'SPRING_JAW' : 'SPARK_TRIPWIRE';
  const trapRoom = roomCenters[1]!;
  const trapId = EntityIdSchema.parse(`trap_catacombs_d${depthLevel}_1`);
  entities[trapId] = {
    id: trapId,
    name: `${tierName} Hazard`,
    visual: { glyph: '^', fgPrimary: '#E67E22', fgSecondary: '#A04000', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: trapRoom.x, y: trapRoom.y, stratum: 'CATACOMBS', depthLevel, blocksMovement: false, blocksSight: false },
    trap: { trapKind, armed: true, damageMagnitude: 15 + depthLevel * 4 },
  };

  const relicRoom = roomCenters[3]!;
  const relicId = EntityIdSchema.parse(`relic_schematic_d${depthLevel}`);
  const blueprint = depthLevel >= 7 ? 'item_pneumatic_strider_leg' : depthLevel >= 4 ? 'item_clockwork_mainspring' : 'blueprint_steam_repeater';
  entities[relicId] = {
    id: relicId,
    name: `${tierName} Relic Cache`,
    visual: { glyph: '*', fgPrimary: '#5DADE2', fgSecondary: '#1B4F72', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: relicRoom.x, y: relicRoom.y, stratum: 'CATACOMBS', depthLevel, blocksMovement: false, blocksSight: false },
    item: {
      blueprintId: BlueprintIdSchema.parse(blueprint),
      category: 'MATERIAL',
      massGrams: 500,
      volumeMl: 250,
      quantity: 1,
      stackable: false,
    },
  };

  return { grid, entities, stairsUp, stairsDown, tierName };
}

export function resolveDescendCatacombs(
  state: WorldState,
  actorId: EntityId,
  stairEntityId: EntityId,
): { state: WorldState; events: SimEvent[]; apSpent: number } {
  const actor = state.entities[actorId];
  const stair = state.entities[stairEntityId];
  const turn = state.turnCount + 1;

  if (!actor || !actor.position) {
    return { state, events: [{ type: 'TRANSIT_ACTION_FAILED', turn, actorId, action: 'TRAVEL_DISTRICT', reason: 'NO_GATE_AT_POSITION' }], apSpent: 0 };
  }

  if (!stair || !stair.position) {
    return { state, events: [{ type: 'TRANSIT_ACTION_FAILED', turn, actorId, action: 'TRAVEL_DISTRICT', reason: 'NO_GATE_AT_POSITION' }], apSpent: 0 };
  }

  const dist = Math.max(Math.abs(actor.position.x - stair.position.x), Math.abs(actor.position.y - stair.position.y));
  if (dist > 1) {
    return { state, events: [{ type: 'TRANSIT_ACTION_FAILED', turn, actorId, action: 'TRAVEL_DISTRICT', reason: 'OUT_OF_RANGE' }], apSpent: 0 };
  }

  const currentDepth = actor.position.depthLevel ?? (actor.position.stratum === 'UNDERCROFT' ? 0 : 0);
  const targetDepth = currentDepth + 1;
  const floor = generateCatacombsFloor(state.rngState, 24, 24, targetDepth);

  // Preserve player and existing entities outside of old catacombs
  const nextEntities: Record<string, EntityRecord> = {};
  for (const [id, ent] of Object.entries(state.entities)) {
    if (ent.position?.stratum !== 'CATACOMBS') {
      nextEntities[id] = ent;
    }
  }

  // Merge floor entities
  for (const [id, ent] of Object.entries(floor.entities)) {
    nextEntities[id] = ent;
  }

  // Position actor at stairsUp
  nextEntities[actorId] = {
    ...actor,
    position: {
      x: floor.stairsUp.x,
      y: floor.stairsUp.y,
      stratum: 'CATACOMBS',
      depthLevel: targetDepth,
      blocksMovement: true,
      blocksSight: false,
    },
  };

  const nextStrata = {
    ...state.strata,
    CATACOMBS: floor.grid,
  };

  const event: SimEvent = {
    type: 'CATACOMBS_DEPTH_DESCENDED',
    turn,
    actorId,
    fromDepth: currentDepth,
    toDepth: targetDepth,
    tierName: floor.tierName,
  };

  return {
    state: {
      ...state,
      turnCount: turn,
      strata: nextStrata,
      entities: nextEntities,
    },
    events: [event],
    apSpent: 100,
  };
}
