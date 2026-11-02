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
import { generateUrbanDistrict } from './urban-district.js';

export { DISTRICT_ADJACENCY } from './compass-gates.js';
export { connectivityTargets, createPipelineContext };
export type { PipelineDistrictContext };
export {
  executeStage6MultiStratumDungeons,
  executeStage7InteractiveUtilityInfrastructure,
  executeStage8EmergenceAtmosphericSeeding,
} from './district-pipeline-late.js';
export { generateUrbanDistrict };
export { carveVictorianSewerTopology } from './sewer-topology.js';
export { generateSubterraneanMineStratum } from './mines-generation.js';
export { generateHeavyIndustrialSector } from './industrial-district.js';
export { linkAllStrataPortals } from './strata-portals.js';

export function isUrbanDistrict(districtId: string): boolean {
  return districtId.includes('whitechapel') || districtId.includes('ward') || districtId.includes('rookeries') || districtId.includes('urban');
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

/** Stage 2: Rail & Viaduct Arteries (AUD-06: viaduct rail track corridor aligned with monorail depot) */
export function executeStage2RailViaduct(ctx: PipelineDistrictContext): void {
  const railY = ctx.monorailCarPos.y;
  if (railY > 1 && railY < ctx.height - 2) {
    for (let x = 2; x < ctx.width - 2; x++) {
      ctx.street = setTileCell(ctx.street, x, railY, (c) => ({
        ...c,
        terrainType: 'IRON_GRATE',
        blocksMovement: false,
        blocksSight: false,
      }));
    }
  }
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
  if (ctx.compass.north) {
    for (let y = ctx.northGatePos.y; y <= ctx.center.y; y++) {
      ctx.street = setTileCell(ctx.street, ctx.center.x, y, (c) => (
        c.terrainType === 'IRON_GRATE' ? c : {
          ...c,
          terrainType: 'COBBLESTONE_FLOOR',
          blocksMovement: false,
          blocksSight: false,
        }
      ));
    }
  }
  if (ctx.compass.south) {
    for (let y = ctx.center.y; y <= ctx.southGatePos.y; y++) {
      ctx.street = setTileCell(ctx.street, ctx.center.x, y, (c) => (
        c.terrainType === 'IRON_GRATE' ? c : {
          ...c,
          terrainType: 'COBBLESTONE_FLOOR',
          blocksMovement: false,
          blocksSight: false,
        }
      ));
    }
  }

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
    ctx.keyPositions = archetypes.keyPositions ?? {};
    ctx.landmarks = archetypes.landmarks ?? {};
    return;
  }

  // CDDA Hierarchical Urban District Generation (Whitechapel Ward / Urban Districts)
  if (isUrbanDistrict(ctx.currDistrict) && ctx.width >= 45 && ctx.height >= 35) {
    const urban = generateUrbanDistrict(ctx.street, ctx.entities, ctx.width, ctx.height, ctx.center, ctx.rng);
    ctx.street = urban.grid;
    ctx.entities = urban.entities;
    ctx.doors = { ...ctx.doors, ...urban.doors };
    ctx.keyPositions = { ...ctx.keyPositions, ...urban.keyPositions };
    if (urban.parcels.length > 0) {
      const footprints = urban.parcels.map((p) => p.bounds);
      ctx.street = fillUnbuiltYards(
        seedDistrictArchitecture(ctx.street, ctx.currDistrict, ctx.rng, critical),
        footprints,
        ctx.rng,
      );
    }
    const repaired = ensureDistrictConnectivity(ctx.street, ctx.center, connectivityTargets(ctx));
    ctx.street = repaired.grid;
    return;
  }

  const placed = applyTypologyPlacements(ctx.street, ctx.entities, ctx.layout, ctx.rng, ctx.center.y);
  ctx.entities = placed.entities;
  ctx.doors = { ...placed.doors };
  ctx.keyPositions = { ...placed.keyPositions };
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
