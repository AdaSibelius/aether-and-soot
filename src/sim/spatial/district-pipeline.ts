import { Point2D } from '../../schemas/primitives.schema.js';
import { seedDistrictArchitecture } from './architectural-features.js';
import { populateDistrictArchetypes } from './building-prefabs.js';
import { applyTypologyPlacements } from './district-blocks.js';
import {
  connectivityTargets,
  createPipelineContext,
  PipelineDistrictContext,
} from './district-pipeline-context.js';
import {
  carveBuildingWithDoor,
  carveCorridor,
  carveRoom,
} from './district-layout.js';
import { ensureDistrictConnectivity, fillUnbuiltYards } from './district-yards.js';
import { setTileCell } from './grid.js';
import { seedOutdoorStreetLandmarks } from './landmark-micro-locations.js';

export { DISTRICT_ADJACENCY } from './compass-gates.js';
export { connectivityTargets, createPipelineContext };
export type { PipelineDistrictContext };
export {
  executeStage6MultiStratumDungeons,
  executeStage7InteractiveUtilityInfrastructure,
  executeStage8EmergenceAtmosphericSeeding,
} from './district-pipeline-late.js';

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

function carveGateCell(ctx: PipelineDistrictContext, pos: Point2D): void {
  ctx.street = setTileCell(ctx.street, pos.x, pos.y, (c) => ({
    ...c,
    terrainType: 'DISTRICT_GATE',
    blocksMovement: false,
    blocksSight: false,
  }));
}

/** Stage 3: Thoroughfare Skeletization (plaza, main street axis, lift alcove and 2D compass gates) */
export function executeStage3ThoroughfareSkeletization(ctx: PipelineDistrictContext): void {
  ctx.street = carveRoom(ctx.street, ctx.center.x, ctx.center.y, 3, 3, 'COBBLESTONE_FLOOR', ctx.biomeDust);
  ctx.street = carveRoom(ctx.street, ctx.liftPos.x, ctx.liftPos.y, 2, 2, 'COBBLESTONE_FLOOR', Math.max(0, ctx.biomeDust - 0.05));
  if (!ctx.layout) {
    ctx.street = carveRoom(ctx.street, ctx.boilerPos.x, ctx.boilerPos.y, 2, 2, 'COBBLESTONE_FLOOR', Math.min(1, ctx.biomeDust + 0.3));
  }
  ctx.street = carveCorridor(ctx.street, ctx.center, ctx.liftPos, 'COBBLESTONE_FLOOR');
  if (!ctx.layout) {
    ctx.street = carveCorridor(ctx.street, ctx.center, ctx.boilerPos, 'COBBLESTONE_FLOOR');
  }
  ctx.street = carveCorridor(ctx.street, ctx.westGatePos, ctx.eastGatePos, 'COBBLESTONE_FLOOR');

  carveGateCell(ctx, ctx.westGatePos);
  carveGateCell(ctx, ctx.eastGatePos);
  if (ctx.compass.north) carveGateCell(ctx, ctx.northGatePos);
  if (ctx.compass.south) carveGateCell(ctx, ctx.southGatePos);
}

/** Stage 4: Structural Plot Zoning (workshop and market hall along the thoroughfare) */
export function executeStage4PlotZoning(ctx: PipelineDistrictContext): void {
  if (ctx.layout) {
    const { workshop, market } = ctx.layout;
    ctx.street = carveBuildingWithDoor(ctx.street, workshop.box.x1, workshop.box.y1, workshop.box.x2, workshop.box.y2, 'COBBLESTONE_FLOOR', workshop.door, 'CLOSED', 0.05);
    ctx.street = carveBuildingWithDoor(ctx.street, market.box.x1, market.box.y1, market.box.x2, market.box.y2, 'COBBLESTONE_FLOOR', market.door, 'CLOSED', 0.1);
    return;
  }
  // Building 1: Artificer Workshop (top-left) with closed door and workbench
  ctx.street = carveCorridor(ctx.street, { x: ctx.workshopDoor.x, y: ctx.workshopDoor.y + 1 }, { x: ctx.workshopDoor.x, y: ctx.center.y }, 'COBBLESTONE_FLOOR');
  ctx.street = carveBuildingWithDoor(ctx.street, 2, 2, 6, 7, 'COBBLESTONE_FLOOR', ctx.workshopDoor, 'CLOSED', 0.05);

  // Building 2: Market Hall (bottom-right) with closed door
  ctx.street = carveCorridor(ctx.street, { x: ctx.marketDoor.x, y: ctx.marketDoor.y - 1 }, { x: ctx.marketDoor.x, y: ctx.center.y }, 'COBBLESTONE_FLOOR');
  ctx.street = carveBuildingWithDoor(ctx.street, 16, 16, 21, 21, 'COBBLESTONE_FLOOR', ctx.marketDoor, 'CLOSED', 0.1);
}

function criticalAnchors(ctx: PipelineDistrictContext): Point2D[] {
  return [ctx.westGatePos, ctx.eastGatePos, ctx.center, ctx.liftPos, ctx.boilerPos];
}

/** Stage 5: Architectural Typology Carving (seeded block placement, landmarks, yards, BFS repair) */
export function executeStage5ArchitecturalTypologies(ctx: PipelineDistrictContext): void {
  const critical = criticalAnchors(ctx);
  if (!ctx.layout) {
    const archetypes = populateDistrictArchetypes(ctx.street, ctx.entities, ctx.width, ctx.height, critical, ctx.rng);
    ctx.street = seedDistrictArchitecture(archetypes.grid, ctx.currDistrict, ctx.rng, critical);
    ctx.entities = archetypes.entities;
    ctx.doors = archetypes.doors ?? {};
    ctx.landmarks = archetypes.landmarks ?? {};
    return;
  }

  const placed = applyTypologyPlacements(ctx.street, ctx.entities, ctx.layout, ctx.rng, ctx.center.y);
  ctx.entities = placed.entities;
  ctx.doors = { ...placed.doors };
  // Establish connectivity before feature seeding so `canPlaceWithoutSevering` guards are meaningful.
  const repaired = ensureDistrictConnectivity(placed.grid, ctx.center, connectivityTargets(ctx));
  const landmarkRes = seedOutdoorStreetLandmarks(repaired.grid, ctx.entities, critical, ctx.layout.landmarkSites);
  ctx.entities = landmarkRes.entities;
  ctx.landmarks = landmarkRes.positions;
  const footprints = [...ctx.layout.placements.map((p) => p.dst), ctx.layout.workshop.box, ctx.layout.market.box];
  ctx.street = fillUnbuiltYards(
    seedDistrictArchitecture(landmarkRes.grid, ctx.currDistrict, ctx.rng, critical),
    footprints,
    ctx.rng,
  );
}
