import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId, Point2D } from '../../schemas/primitives.schema.js';
import { WorldState } from '../core/world.js';
import { discoverCodexEntry } from '../systems/codex.system.js';
import {
  createPipelineContext,
  DISTRICT_ADJACENCY,
  executeStage1TopologyHydrology,
  executeStage2RailViaduct,
  executeStage3ThoroughfareSkeletization,
  executeStage4PlotZoning,
  executeStage5ArchitecturalTypologies,
  executeStage6MultiStratumDungeons,
  executeStage7InteractiveUtilityInfrastructure,
  executeStage8EmergenceAtmosphericSeeding,
} from './district-pipeline.js';

export { DISTRICT_ADJACENCY };

export interface GeneratedDistrictResult {
  readonly state: WorldState;
  readonly landmarks: {
    readonly undercroftLadder: Point2D;
    readonly streetManhole: Point2D;
    readonly streetLift: Point2D;
    readonly spireLift: Point2D;
    readonly foundryBoiler: Point2D;
    readonly workshopDoor: Point2D;
    readonly artificerWorkbench: Point2D;
    readonly marketDoor: Point2D;
    readonly westGate: Point2D;
    readonly eastGate: Point2D;
    readonly waterPump?: Point2D | undefined;
    readonly clocktower?: Point2D | undefined;
    readonly canalLock?: Point2D | undefined;
    readonly spireGreenhouse?: Point2D | undefined;
    readonly doors?: Record<string, Point2D> | undefined;
    readonly sewerDrops?: readonly Point2D[] | undefined;
    readonly barriersPlaced?: readonly string[] | undefined;
  };
}

/**
 * Deterministically generates a multi-building Victorian district using an 8-stage pipeline:
 * Stage 1: Topology & Hydrology (Thames canal, Fleet ditch, wharf cuts)
 * Stage 2: Rail & Viaduct Arteries (pneumatic monorail pylons, viaduct arches)
 * Stage 3: Thoroughfare Skeletization (Bresenham street axes & compass gates)
 * Stage 4: Structural Plot Zoning (perimeter block partition with setbacks)
 * Stage 5: Architectural Typology Carving (multi-room building footprints)
 * Stage 6: Multi-Stratum Dungeon Weaving (Undercroft sewer siphons, Spire catwalks)
 * Stage 7: Interactive Utility & Infrastructure (boilers, workbenches, consoles, portals)
 * Stage 8: Emergence & Atmospheric Seeding (soot gradients, steam pools, gas pockets)
 */
export function generateVictorianDistrict(state: WorldState): GeneratedDistrictResult {
  const ctx = createPipelineContext(state);

  // Stage 1: Topology & Hydrology
  executeStage1TopologyHydrology(ctx);

  // Stage 2: Rail & Viaduct Arteries
  executeStage2RailViaduct(ctx);

  // Stage 3: Thoroughfare Skeletization
  executeStage3ThoroughfareSkeletization(ctx);

  // Stage 4: Structural Plot Zoning
  executeStage4PlotZoning(ctx);

  // Stage 5: Architectural Typology Carving
  executeStage5ArchitecturalTypologies(ctx);

  // Stage 6: Multi-Stratum Dungeon Weaving
  executeStage6MultiStratumDungeons(ctx);

  // Stage 7: Interactive Utility & Infrastructure
  executeStage7InteractiveUtilityInfrastructure(ctx);

  // Stage 8: Emergence & Atmospheric Seeding
  executeStage8EmergenceAtmosphericSeeding(ctx);

  return {
    state: {
      ...ctx.state,
      rngState: ctx.rng.getState(),
      strata: {
        UNDERCROFT: ctx.undercroft,
        STREET: ctx.street,
        SPIRE: ctx.spire,
      },
      entities: ctx.entities,
    },
    landmarks: {
      undercroftLadder: ctx.center,
      streetManhole: ctx.center,
      streetLift: ctx.liftPos,
      spireLift: ctx.liftPos,
      foundryBoiler: ctx.boilerPos,
      workshopDoor: ctx.workshopDoor,
      artificerWorkbench: ctx.artificerWorkbench,
      marketDoor: ctx.marketDoor,
      westGate: ctx.westGatePos,
      eastGate: ctx.eastGatePos,
      waterPump: ctx.landmarks.waterPump ?? { x: 14, y: 16 },
      clocktower: ctx.landmarks.clocktower ?? { x: 31, y: 16 },
      canalLock: ctx.landmarks.canalLock ?? { x: 31, y: 20 },
      spireGreenhouse: ctx.spireGreenhousePos,
      doors: ctx.doors,
      sewerDrops: ctx.sewerDrops,
      barriersPlaced: ctx.barriersPlaced,
    },
  };
}

export { hasWalkablePath } from './district-layout.js';

export function inspectLandmarkCodex(
  state: WorldState,
  actorId: EntityId,
  landmarkName: string,
): { state: WorldState; discovered: boolean; event?: SimEvent } {
  const norm = landmarkName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return discoverCodexEntry(state, actorId, {
    id: `codex_landmark_${norm}`,
    category: 'INFRASTRUCTURE',
    title: landmarkName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    description: `Architectural survey of the ${landmarkName.replace(/_/g, ' ')} structure recorded in the naturalist codex.`,
    tags: ['INFRASTRUCTURE', 'LANDMARK', norm],
  });
}
