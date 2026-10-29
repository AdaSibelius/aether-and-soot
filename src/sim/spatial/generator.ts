import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { BlueprintIdSchema, EntityId, EntityIdSchema, Point2D } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { WorldState } from '../core/world.js';
import { discoverCodexEntry } from '../systems/codex.system.js';
import { createMonorailCarEntity } from '../systems/monorail.system.js';
import {
  buildSolidStratumGrid,
  carveBuildingWithDoor,
  carveCorridor,
  carveRoom,
} from './district-layout.js';
import { populateDistrictArchetypes, seedSpireGreenhouse } from './building-prefabs.js';
import { seedDistrictArchitecture } from './architectural-features.js';
import { generateSpireCatwalks, generateUndercroftDungeon } from './strata-dungeons.js';
import { enrichLargeScaleDistrict } from './district-scaler.js';
import { setTileCell } from './grid.js';

export const DISTRICT_ADJACENCY: Record<string, { west: string; east: string }> = {
  district_spitalfields_soot_works: { west: 'district_fleet_ditch_undercroft', east: 'district_belgravia_brass_spires' },
  district_fleet_ditch_undercroft: { west: 'district_whitechapel_ward', east: 'district_spitalfields_soot_works' },
  district_whitechapel_ward: { west: 'district_fleet_ditch_undercroft', east: 'district_limehouse_docks' },
  district_limehouse_docks: { west: 'district_whitechapel_ward', east: 'district_belgravia_brass_spires' },
  district_belgravia_brass_spires: { west: 'district_limehouse_docks', east: 'district_spitalfields_soot_works' },
};

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
    readonly waterPump?: Point2D;
    readonly clocktower?: Point2D;
    readonly canalLock?: Point2D;
    readonly spireGreenhouse?: Point2D;
    readonly doors?: Record<string, Point2D>;
    readonly sewerDrops?: readonly Point2D[];
    readonly barriersPlaced?: readonly string[];
  };
}

/**
 * Deterministically generates a multi-building Victorian district (Undercroft, Street, Spire)
 * with Workshop, Market Hall, Boiler Hall, openable doors, and District Transit Gates.
 */
export function generateVictorianDistrict(state: WorldState): GeneratedDistrictResult {
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

  // 1. UNDERCROFT: Procedural sewer dungeon with interconnected chambers and smuggling vaults
  const undercroftRes = generateUndercroftDungeon(width, height, center, rng, state.entities);
  let undercroft = undercroftRes.grid;

  // 2. STREET: Central thoroughfare, buildings with doors, boiler house, and transit gates
  let street = buildSolidStratumGrid('STREET', width, height);
  street = carveRoom(street, center.x, center.y, 3, 3, 'COBBLESTONE_FLOOR', biomeDust);
  street = carveRoom(street, liftPos.x, liftPos.y, 2, 2, 'COBBLESTONE_FLOOR', Math.max(0, biomeDust - 0.05));
  street = carveRoom(street, boilerPos.x, boilerPos.y, 2, 2, 'COBBLESTONE_FLOOR', Math.min(1, biomeDust + 0.3));
  street = carveCorridor(street, center, liftPos, 'COBBLESTONE_FLOOR');
  street = carveCorridor(street, center, boilerPos, 'COBBLESTONE_FLOOR');

  // East-West Central Thoroughfare
  const westGatePos: Point2D = { x: 1, y: center.y };
  const eastGatePos: Point2D = { x: width - 2, y: center.y };
  street = carveCorridor(street, westGatePos, eastGatePos, 'COBBLESTONE_FLOOR');

  // Building 1: Artificer Workshop (top-left) with closed door and workbench
  const workshopDoor: Point2D = { x: 4, y: 7 };
  const artificerWorkbench: Point2D = { x: 4, y: 4 };
  street = carveCorridor(street, { x: workshopDoor.x, y: workshopDoor.y + 1 }, { x: workshopDoor.x, y: center.y }, 'COBBLESTONE_FLOOR');
  street = carveBuildingWithDoor(street, 2, 2, 6, 7, 'COBBLESTONE_FLOOR', workshopDoor, 'CLOSED', 0.05);

  // Building 2: Market Hall (bottom-right) with closed door
  const marketDoor: Point2D = { x: 18, y: 16 };
  street = carveCorridor(street, { x: marketDoor.x, y: marketDoor.y - 1 }, { x: marketDoor.x, y: center.y }, 'COBBLESTONE_FLOOR');
  street = carveBuildingWithDoor(street, 16, 16, 21, 21, 'COBBLESTONE_FLOOR', marketDoor, 'CLOSED', 0.1);

  // Place Gate tiles at west and east thoroughfare borders
  street = setTileCell(street, westGatePos.x, westGatePos.y, (c) => ({
    ...c,
    terrainType: 'DISTRICT_GATE',
    blocksMovement: false,
    blocksSight: false,
  }));
  street = setTileCell(street, eastGatePos.x, eastGatePos.y, (c) => ({
    ...c,
    terrainType: 'DISTRICT_GATE',
    blocksMovement: false,
    blocksSight: false,
  }));

  // 3. SPIRE: Elevated brass tower platforms and sky-bridge catwalks
  const spireRes = generateSpireCatwalks(width, height, liftPos, rng, undercroftRes.entities);
  const ghRes = width >= 36 ? seedSpireGreenhouse(spireRes.grid, spireRes.entities, liftPos) : { grid: spireRes.grid, entities: spireRes.entities, position: liftPos };
  const spire = ghRes.grid;

  const liftDownId = EntityIdSchema.parse('portal_spire_lift_down');
  const liftUpId = EntityIdSchema.parse('portal_street_lift_up');
  const boilerId = EntityIdSchema.parse('vessel_district_boiler');
  const workbenchId = EntityIdSchema.parse('station_artificer_workbench');
  const westGateId = EntityIdSchema.parse('gate_transit_west');
  const eastGateId = EntityIdSchema.parse('gate_transit_east');

  const adj = DISTRICT_ADJACENCY[currDistrict] ?? {
    west: 'district_fleet_ditch_undercroft',
    east: 'district_whitechapel_ward',
  };
  const westTarget = adj.west;
  const eastTarget = adj.east;

  const newEntities: Record<string, EntityRecord> = {
    ...ghRes.entities,
    [liftUpId]: {
      id: liftUpId,
      name: 'Pneumatic Freight Elevator (To Spire)',
      visual: { glyph: '^', fgPrimary: '#F4D03F', fgSecondary: '#D4AF37', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
      position: { x: liftPos.x, y: liftPos.y, stratum: 'STREET', blocksMovement: false, blocksSight: false },
      portal: { target: { x: liftPos.x, y: liftPos.y, stratum: 'SPIRE' }, bidirectional: true, conductsGas: true, apCost: 100, portalLabel: 'Ascend Pneumatic Lift to Brass Spire' },
    },
    [liftDownId]: {
      id: liftDownId,
      name: 'Pneumatic Freight Elevator (To Street)',
      visual: { glyph: 'v', fgPrimary: '#F4D03F', fgSecondary: '#D4AF37', bgColor: '#0A0D0E', shaderFlags: [] },
      position: { x: liftPos.x, y: liftPos.y, stratum: 'SPIRE', blocksMovement: false, blocksSight: false },
      portal: { target: { x: liftPos.x, y: liftPos.y, stratum: 'STREET' }, bidirectional: true, conductsGas: true, apCost: 100, portalLabel: 'Descend Pneumatic Lift to Foundry Street' },
    },
    [boilerId]: {
      id: boilerId,
      name: 'Spitalfields High-Pressure Foundry Boiler',
      visual: { glyph: '0', fgPrimary: '#CD7F32', fgSecondary: '#E67E22', bgColor: '#0A0D0E', shaderFlags: ['PULSE_STEAM'] },
      position: { x: boilerPos.x, y: boilerPos.y, stratum: 'STREET', blocksMovement: false, blocksSight: false },
      pressureVessel: { currentPressureKpa: 180, maxPressureKpa: 300, ruptured: false },
    },
    [workbenchId]: {
      id: workbenchId,
      name: 'Spitalfields Pneumatic Artificer Workbench',
      visual: { glyph: 'T', fgPrimary: '#D4AF37', fgSecondary: '#CD7F32', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
      position: { x: artificerWorkbench.x, y: artificerWorkbench.y, stratum: 'STREET', blocksMovement: false, blocksSight: false },
      workbench: { stationType: 'ARTIFICER_BENCH', bonusEfficiencyPct: 20 },
    },
    [westGateId]: {
      id: westGateId,
      name: `West Transit Gate (To ${westTarget})`,
      visual: { glyph: 'Ω', fgPrimary: '#2E86C1', fgSecondary: '#1B4F72', bgColor: '#0A0D0E', shaderFlags: [] },
      position: { x: westGatePos.x, y: westGatePos.y, stratum: 'STREET', blocksMovement: false, blocksSight: false },
      districtGate: { targetDistrictId: BlueprintIdSchema.parse(westTarget), gateLabel: `Travel to ${westTarget}`, apCost: 100 },
    },
    [eastGateId]: {
      id: eastGateId,
      name: `East Transit Gate (To ${eastTarget})`,
      visual: { glyph: 'Ω', fgPrimary: '#F4D03F', fgSecondary: '#D4AF37', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
      position: { x: eastGatePos.x, y: eastGatePos.y, stratum: 'STREET', blocksMovement: false, blocksSight: false },
      districtGate: { targetDistrictId: BlueprintIdSchema.parse(eastTarget), gateLabel: `Travel to ${eastTarget}`, apCost: 100 },
    },
  };

  const criticalLandmarks = [westGatePos, eastGatePos, center, liftPos, boilerPos];
  const archetypes = populateDistrictArchetypes(street, newEntities, width, height, criticalLandmarks);
  street = seedDistrictArchitecture(archetypes.grid, currDistrict, rng, criticalLandmarks);

  const scaled = enrichLargeScaleDistrict(
    street, undercroft, currDistrict, rng, criticalLandmarks, archetypes.entities,
  );
  street = scaled.streetGrid;
  undercroft = scaled.undercroftGrid;
  const finalEntities = scaled.entities;

  if (archetypes.doors?.monorailDepot) {
    const carId = 'monorail_car_street_depot';
    const destDistrict = BlueprintIdSchema.parse(westTarget ?? 'district_belgravia_brass_spires');
    finalEntities[carId] = createMonorailCarEntity(carId, { x: 20, y: 5, stratum: 'STREET' }, destDistrict, 75);
  }

  return {
    state: {
      ...state,
      rngState: rng.getState(),
      strata: { UNDERCROFT: undercroft, STREET: street, SPIRE: spire },
      entities: finalEntities,
    },
    landmarks: {
      undercroftLadder: center,
      streetManhole: center,
      streetLift: liftPos,
      spireLift: liftPos,
      foundryBoiler: boilerPos,
      workshopDoor,
      artificerWorkbench,
      marketDoor,
      westGate: westGatePos,
      eastGate: eastGatePos,
      waterPump: archetypes.landmarks?.waterPump ?? { x: 14, y: 16 },
      clocktower: archetypes.landmarks?.clocktower ?? { x: 31, y: 16 },
      canalLock: archetypes.landmarks?.canalLock ?? { x: 31, y: 20 },
      spireGreenhouse: ghRes.position,
      doors: archetypes.doors ?? {},
      sewerDrops: scaled.sewerDrops,
      barriersPlaced: scaled.barriersPlaced,
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
