import { EntityRecord } from '../../schemas/components.schema.js';
import { BlueprintIdSchema, EntityIdSchema, Point2D } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { WorldState } from '../core/world.js';
import {
  buildSolidStratumGrid,
  carveBuildingWithDoor,
  carveCorridor,
  carveRoom,
} from './district-layout.js';
import { populateDistrictArchetypes } from './building-prefabs.js';
import { getTileCell, isWithinBounds, setTileCell, StratumGrid } from './grid.js';

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

  const center: Point2D = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  const liftPos: Point2D = {
    x: rng.nextInt(Math.max(3, center.x + 2), Math.min(width - 4, width - 3)),
    y: rng.nextInt(3, Math.max(4, center.y - 2)),
  };
  const boilerPos: Point2D = {
    x: rng.nextInt(3, Math.max(4, center.x - 2)),
    y: rng.nextInt(Math.max(3, center.y + 2), Math.min(height - 4, height - 3)),
  };

  // 1. UNDERCROFT: Brick sewer chambers connected by iron grates
  let undercroft = buildSolidStratumGrid('UNDERCROFT', width, height);
  const sewerChamberB: Point2D = {
    x: rng.nextInt(3, Math.max(4, width - 4)),
    y: rng.nextInt(3, Math.max(4, height - 4)),
  };
  undercroft = carveRoom(undercroft, center.x, center.y, 2, 2, 'IRON_GRATE', 0.1);
  undercroft = carveRoom(undercroft, sewerChamberB.x, sewerChamberB.y, 2, 2, 'IRON_GRATE', 0.2);
  undercroft = carveCorridor(undercroft, center, sewerChamberB, 'IRON_GRATE');

  // 2. STREET: Central thoroughfare, buildings with doors, boiler house, and transit gates
  let street = buildSolidStratumGrid('STREET', width, height);
  street = carveRoom(street, center.x, center.y, 3, 3, 'COBBLESTONE_FLOOR', 0.15);
  street = carveRoom(street, liftPos.x, liftPos.y, 2, 2, 'COBBLESTONE_FLOOR', 0.05);
  street = carveRoom(street, boilerPos.x, boilerPos.y, 2, 2, 'COBBLESTONE_FLOOR', 0.45);
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

  // 3. SPIRE: Elevated brass catwalks and clockwork observatory
  let spire = buildSolidStratumGrid('SPIRE', width, height);
  spire = carveRoom(spire, liftPos.x, liftPos.y, 2, 2, 'BRASS_CATWALK', 0);
  spire = carveRoom(spire, center.x, center.y, 2, 2, 'BRASS_CATWALK', 0);
  spire = carveCorridor(spire, liftPos, center, 'BRASS_CATWALK');

  const liftDownId = EntityIdSchema.parse('portal_spire_lift_down');
  const liftUpId = EntityIdSchema.parse('portal_street_lift_up');
  const boilerId = EntityIdSchema.parse('vessel_district_boiler');
  const workbenchId = EntityIdSchema.parse('station_artificer_workbench');
  const westGateId = EntityIdSchema.parse('gate_transit_west');
  const eastGateId = EntityIdSchema.parse('gate_transit_east');

  const currDistrict = state.currentDistrictId ?? 'district_spitalfields_soot_works';
  const westTarget = currDistrict === 'district_fleet_ditch_undercroft'
    ? 'district_spitalfields_soot_works'
    : 'district_fleet_ditch_undercroft';
  const eastTarget = currDistrict === 'district_belgravia_brass_spires'
    ? 'district_spitalfields_soot_works'
    : 'district_belgravia_brass_spires';

  const newEntities: Record<string, EntityRecord> = {
    ...state.entities,
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

  const archetypes = populateDistrictArchetypes(street, newEntities, width, height);
  street = archetypes.grid;
  const finalEntities = archetypes.entities;

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
    },
  };
}

/**
 * Breadth-First Search (BFS) walkability check between two points on a single StratumGrid.
 */
export function hasWalkablePath(grid: StratumGrid, start: Point2D, goal: Point2D): boolean {
  if (!isWithinBounds(grid, start.x, start.y) || !isWithinBounds(grid, goal.x, goal.y)) return false;
  const visited = new Set<string>();
  const queue: Point2D[] = [start];
  const deltas = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr.x === goal.x && curr.y === goal.y) return true;
    const key = `${curr.x},${curr.y}`;
    if (visited.has(key)) continue;
    visited.add(key);

    for (const { dx, dy } of deltas) {
      const nx = curr.x + dx;
      const ny = curr.y + dy;
      if (!isWithinBounds(grid, nx, ny)) continue;
      const cell = getTileCell(grid, nx, ny);
      if (cell && !cell.blocksMovement) queue.push({ x: nx, y: ny });
    }
  }
  return false;
}
