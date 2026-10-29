import { EntityRecord } from '../../schemas/components.schema.js';
import { Point2D } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { WorldState } from '../core/world.js';
import { CompassAdjacency, compassGatePositions, resolveCompassAdjacency } from './compass-gates.js';
import { MacroLayout, mapPoint, planMacroLayout, supportsProceduralBlocks } from './district-blocks.js';
import { buildSolidStratumGrid } from './district-layout.js';
import { StratumGrid } from './grid.js';

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
  readonly northGatePos: Point2D;
  readonly southGatePos: Point2D;
  readonly compass: CompassAdjacency;
  /** Seeded block layout; undefined for compact fixtures that keep the legacy stamped layout. */
  readonly layout: MacroLayout | undefined;
  readonly monorailCarPos: Point2D;
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
  const rndBoilerX = rng.nextInt(3, Math.max(4, center.x - 2));
  const rndBoilerY = rng.nextInt(Math.max(3, center.y + 2), Math.min(height - 4, height - 3));

  // Seeded block layout replaces the former `width >= 36` hardcoded hub/building coordinates.
  const layout = supportsProceduralBlocks(width, height) ? planMacroLayout(rng, width, height, center) : undefined;
  const boilerhouse = layout?.placements.find((p) => p.key === 'boilerhouse');
  const depot = layout?.placements.find((p) => p.key === 'monorailDepot');

  const liftPos: Point2D = layout ? layout.liftPos : { x: rndLiftX, y: rndLiftY };
  const boilerPos: Point2D = boilerhouse
    ? mapPoint(boilerhouse, { x: 6, y: 26 })
    : { x: rndBoilerX, y: rndBoilerY };

  const currDistrict = state.currentDistrictId ?? 'district_spitalfields_soot_works';
  const biomeDust =
    currDistrict === 'district_fleet_ditch_undercroft' ? 0.35 :
    currDistrict === 'district_limehouse_docks' ? 0.30 :
    currDistrict === 'district_belgravia_brass_spires' ? 0.0 :
    currDistrict === 'district_whitechapel_ward' ? 0.10 : 0.15;

  const gates = compassGatePositions(width, height, center.y);
  return {
    state,
    rng,
    width,
    height,
    center,
    liftPos,
    boilerPos,
    westGatePos: gates.west,
    eastGatePos: gates.east,
    northGatePos: gates.north,
    southGatePos: gates.south,
    compass: resolveCompassAdjacency(currDistrict),
    layout,
    monorailCarPos: depot ? mapPoint(depot, { x: 20, y: 5 }) : { x: 20, y: 5 },
    currDistrict,
    biomeDust,
    workshopDoor: layout ? layout.workshop.door : { x: 4, y: 7 },
    artificerWorkbench: layout ? layout.workshop.interiorAnchor : { x: 4, y: 4 },
    marketDoor: layout ? layout.market.door : { x: 18, y: 16 },
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

/** Every STREET point that must stay reachable from the plaza (gates, lift, boiler, building entrances, drops). */
export function connectivityTargets(ctx: PipelineDistrictContext): Point2D[] {
  const targets: Point2D[] = [ctx.westGatePos, ctx.eastGatePos, ctx.liftPos, ctx.boilerPos, ...ctx.sewerDrops];
  if (ctx.compass.north) targets.push(ctx.northGatePos);
  if (ctx.compass.south) targets.push(ctx.southGatePos);
  if (ctx.layout) {
    for (const p of ctx.layout.placements) targets.push(p.outward);
    targets.push({ x: ctx.workshopDoor.x, y: ctx.workshopDoor.y + 1 }, { x: ctx.marketDoor.x, y: ctx.marketDoor.y - 1 });
  }
  return targets;
}
