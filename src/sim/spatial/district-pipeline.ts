import { EntityRecord } from '../../schemas/components.schema.js';
import { BlueprintIdSchema, Point2D } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { WorldState } from '../core/world.js';
import { createMonorailCarEntity } from '../systems/monorail.system.js';
import { seedDistrictArchitecture } from './architectural-features.js';
import { populateDistrictArchetypes, seedSpireGreenhouse } from './building-prefabs.js';
import {
  buildSolidStratumGrid,
  carveBuildingWithDoor,
  carveCorridor,
  carveRoom,
} from './district-layout.js';
import { enrichLargeScaleDistrict } from './district-scaler.js';
import { setTileCell, StratumGrid } from './grid.js';
import { generateSpireCatwalks, generateUndercroftDungeon } from './strata-dungeons.js';
import {
  seedDistrictUtilityNetworks,
  spawnDistrictInfrastructure,
} from './utility-networks.js';

export const DISTRICT_ADJACENCY: Record<string, { west: string; east: string }> = {
  district_spitalfields_soot_works: { west: 'district_fleet_ditch_undercroft', east: 'district_belgravia_brass_spires' },
  district_fleet_ditch_undercroft: { west: 'district_whitechapel_ward', east: 'district_spitalfields_soot_works' },
  district_whitechapel_ward: { west: 'district_fleet_ditch_undercroft', east: 'district_limehouse_docks' },
  district_limehouse_docks: { west: 'district_whitechapel_ward', east: 'district_belgravia_brass_spires' },
  district_belgravia_brass_spires: { west: 'district_limehouse_docks', east: 'district_spitalfields_soot_works' },
};

export interface PipelineDistrictContext {
  readonly state: WorldState;
  readonly rng: SeededRNG;
  readonly width: number;
  readonly height: number;
  readonly center: Point2D;
  readonly liftPos: Point2D;
  readonly boilerPos: Point2D;
  readonly westGatePos: Point2D;
  readonly eastGatePos: Point2D;
  readonly currDistrict: string;
  readonly biomeDust: number;
  readonly workshopDoor: Point2D;
  readonly artificerWorkbench: Point2D;
  readonly marketDoor: Point2D;
  street: StratumGrid;
  undercroft: StratumGrid;
  spire: StratumGrid;
  entities: Record<string, EntityRecord>;
  doors: Record<string, Point2D>;
  landmarks: Record<string, Point2D | undefined>;
  barriersPlaced: string[];
  sewerDrops: Point2D[];
  spireGreenhousePos?: Point2D;
}

export function createPipelineContext(state: WorldState): PipelineDistrictContext {
  const rng = new SeededRNG(state.rngState);
  const width = state.strata.STREET?.width ?? 24;
  const height = state.strata.STREET?.height ?? 24;
  const centerY = height >= 36 ? 18 : Math.floor(height / 2);
  const center: Point2D = { x: Math.floor(width / 2), y: centerY };

  const rndLiftX = rng.nextInt(Math.max(3, center.x + 2), Math.min(width - 4, width - 3));
  const rndLiftY = rng.nextInt(3, Math.max(4, center.y - 2));
  const liftPos: Point2D = width >= 36 ? { x: 30, y: 15 } : { x: rndLiftX, y: rndLiftY };

  const rndBoilerX = rng.nextInt(3, Math.max(4, center.x - 2));
  const rndBoilerY = rng.nextInt(Math.max(3, center.y + 2), Math.min(height - 4, height - 3));
  const boilerPos: Point2D = width >= 36 ? { x: 6, y: 26 } : { x: rndBoilerX, y: rndBoilerY };

  const currDistrict = state.currentDistrictId ?? 'district_spitalfields_soot_works';
  const biomeDust =
    currDistrict === 'district_fleet_ditch_undercroft' ? 0.35 :
    currDistrict === 'district_limehouse_docks' ? 0.30 :
    currDistrict === 'district_belgravia_brass_spires' ? 0.0 :
    currDistrict === 'district_whitechapel_ward' ? 0.10 : 0.15;

  return {
    state,
    rng,
    width,
    height,
    center,
    liftPos,
    boilerPos,
    westGatePos: { x: 1, y: center.y },
    eastGatePos: { x: width - 2, y: center.y },
    currDistrict,
    biomeDust,
    workshopDoor: { x: 4, y: 7 },
    artificerWorkbench: { x: 4, y: 4 },
    marketDoor: { x: 18, y: 16 },
    street: buildSolidStratumGrid('STREET', width, height),
    undercroft: buildSolidStratumGrid('UNDERCROFT', width, height),
    spire: buildSolidStratumGrid('SPIRE', width, height),
    entities: { ...state.entities },
    doors: {},
    landmarks: {},
    barriersPlaced: [],
    sewerDrops: [],
  };
}

/** Stage 1: Topology & Hydrology */
export function executeStage1TopologyHydrology(ctx: PipelineDistrictContext): void {
  // Carve river/canal incisions if dock district
  if (ctx.currDistrict.includes('limehouse') && ctx.width >= 36) {
    const canalY = ctx.height - 4;
    for (let x = 2; x < ctx.width - 2; x++) {
      ctx.street = setTileCell(ctx.street, x, canalY, (c) => ({ ...c, terrainType: 'CANAL_SLUICE', blocksMovement: true }));
    }
  }
}

/** Stage 2: Rail & Viaduct Arteries */
export function executeStage2RailViaduct(_ctx: PipelineDistrictContext): void {
  // Reserved for viaduct and pneumatic monorail corridors
}

/** Stage 3: Thoroughfare Skeletization */
export function executeStage3ThoroughfareSkeletization(ctx: PipelineDistrictContext): void {
  ctx.street = carveRoom(ctx.street, ctx.center.x, ctx.center.y, 3, 3, 'COBBLESTONE_FLOOR', ctx.biomeDust);
  ctx.street = carveRoom(ctx.street, ctx.liftPos.x, ctx.liftPos.y, 2, 2, 'COBBLESTONE_FLOOR', Math.max(0, ctx.biomeDust - 0.05));
  ctx.street = carveRoom(ctx.street, ctx.boilerPos.x, ctx.boilerPos.y, 2, 2, 'COBBLESTONE_FLOOR', Math.min(1, ctx.biomeDust + 0.3));
  ctx.street = carveCorridor(ctx.street, ctx.center, ctx.liftPos, 'COBBLESTONE_FLOOR');
  ctx.street = carveCorridor(ctx.street, ctx.center, ctx.boilerPos, 'COBBLESTONE_FLOOR');
  ctx.street = carveCorridor(ctx.street, ctx.westGatePos, ctx.eastGatePos, 'COBBLESTONE_FLOOR');

  ctx.street = setTileCell(ctx.street, ctx.westGatePos.x, ctx.westGatePos.y, (c) => ({
    ...c,
    terrainType: 'DISTRICT_GATE',
    blocksMovement: false,
    blocksSight: false,
  }));
  ctx.street = setTileCell(ctx.street, ctx.eastGatePos.x, ctx.eastGatePos.y, (c) => ({
    ...c,
    terrainType: 'DISTRICT_GATE',
    blocksMovement: false,
    blocksSight: false,
  }));
}

/** Stage 4: Structural Plot Zoning */
export function executeStage4PlotZoning(ctx: PipelineDistrictContext): void {
  // Building 1: Artificer Workshop (top-left) with closed door and workbench
  ctx.street = carveCorridor(ctx.street, { x: ctx.workshopDoor.x, y: ctx.workshopDoor.y + 1 }, { x: ctx.workshopDoor.x, y: ctx.center.y }, 'COBBLESTONE_FLOOR');
  ctx.street = carveBuildingWithDoor(ctx.street, 2, 2, 6, 7, 'COBBLESTONE_FLOOR', ctx.workshopDoor, 'CLOSED', 0.05);

  // Building 2: Market Hall (bottom-right) with closed door
  ctx.street = carveCorridor(ctx.street, { x: ctx.marketDoor.x, y: ctx.marketDoor.y - 1 }, { x: ctx.marketDoor.x, y: ctx.center.y }, 'COBBLESTONE_FLOOR');
  ctx.street = carveBuildingWithDoor(ctx.street, 16, 16, 21, 21, 'COBBLESTONE_FLOOR', ctx.marketDoor, 'CLOSED', 0.1);
}

/** Stage 5: Architectural Typology Carving */
export function executeStage5ArchitecturalTypologies(ctx: PipelineDistrictContext): void {
  const critical = [ctx.westGatePos, ctx.eastGatePos, ctx.center, ctx.liftPos, ctx.boilerPos];
  const archetypes = populateDistrictArchetypes(ctx.street, ctx.entities, ctx.width, ctx.height, critical, ctx.rng);
  ctx.street = seedDistrictArchitecture(archetypes.grid, ctx.currDistrict, ctx.rng, critical);
  ctx.entities = archetypes.entities;
  ctx.doors = archetypes.doors ?? {};
  ctx.landmarks = archetypes.landmarks ?? {};
}

/** Stage 6: Multi-Stratum Dungeon Weaving */
export function executeStage6MultiStratumDungeons(ctx: PipelineDistrictContext): void {
  const underRes = generateUndercroftDungeon(ctx.width, ctx.height, ctx.center, ctx.rng, ctx.entities);
  ctx.undercroft = underRes.grid;
  ctx.entities = underRes.entities;

  const spireRes = generateSpireCatwalks(ctx.width, ctx.height, ctx.liftPos, ctx.rng, ctx.entities);
  const ghRes = ctx.width >= 36 ? seedSpireGreenhouse(spireRes.grid, spireRes.entities, ctx.liftPos) : { grid: spireRes.grid, entities: spireRes.entities, position: ctx.liftPos };
  ctx.spire = ghRes.grid;
  ctx.entities = ghRes.entities;
  ctx.spireGreenhousePos = ghRes.position;

  const critical = [ctx.westGatePos, ctx.eastGatePos, ctx.center, ctx.liftPos, ctx.boilerPos];
  const scaled = enrichLargeScaleDistrict(ctx.street, ctx.undercroft, ctx.currDistrict, ctx.rng, critical, ctx.entities);
  ctx.street = scaled.streetGrid;
  ctx.undercroft = scaled.undercroftGrid;
  ctx.entities = scaled.entities;
  ctx.barriersPlaced = scaled.barriersPlaced;
  ctx.sewerDrops = [...scaled.sewerDrops];
}

/** Stage 7: Interactive Utility & Infrastructure */
export function executeStage7InteractiveUtilityInfrastructure(ctx: PipelineDistrictContext): void {
  const adjacency = DISTRICT_ADJACENCY[ctx.currDistrict] ?? {
    west: 'district_fleet_ditch_undercroft',
    east: 'district_belgravia_brass_spires',
  };
  const westTarget = adjacency.west;
  const eastTarget = adjacency.east;

  spawnDistrictInfrastructure(
    ctx.entities,
    ctx.liftPos,
    ctx.boilerPos,
    ctx.artificerWorkbench,
    ctx.westGatePos,
    ctx.eastGatePos,
    westTarget,
    eastTarget,
  );

  if (ctx.doors.monorailDepot) {
    const carId = 'monorail_car_street_depot';
    ctx.entities[carId] = createMonorailCarEntity(carId, { x: 20, y: 5, stratum: 'STREET' }, BlueprintIdSchema.parse(westTarget), 75);
  }

  seedDistrictUtilityNetworks(ctx.entities, ctx.currDistrict, ctx.boilerPos, ctx.artificerWorkbench, ctx.center);
}

/** Stage 8: Emergence & Atmospheric Seeding */
export function executeStage8EmergenceAtmosphericSeeding(ctx: PipelineDistrictContext): void {
  // Infuse atmospheric soot and steam gradients around the boilerhouse
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const bx = ctx.boilerPos.x + dx;
      const by = ctx.boilerPos.y + dy;
      if (bx > 0 && by > 0 && bx < ctx.width - 1 && by < ctx.height - 1) {
        ctx.street = setTileCell(ctx.street, bx, by, (c) => ({
          ...c,
          steamPressureKpa: Math.min(100, c.steamPressureKpa + 20),
          coalDustDensity: Math.min(1, c.coalDustDensity + 0.15),
        }));
      }
    }
  }
}
