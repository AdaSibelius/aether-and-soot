import { EntityRecord } from '../../schemas/components.schema.js';
import { Point2D } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { Box } from './block-geometry.js';
import { getTileCell, isWithinBounds, StratumGrid } from './grid.js';
import { PlacedBuildingSurvey, SpatialAnomaly, SpatialCorrectionLog } from './spatial-survey-types.js';

export function clearDoorwayObstacles(
  grid: StratumGrid,
  entities: Record<string, EntityRecord>,
  buildingsOrAnomalies: readonly PlacedBuildingSurvey[] | readonly SpatialAnomaly[],
  allBuildings?: readonly PlacedBuildingSurvey[],
): { grid: StratumGrid; entities: Record<string, EntityRecord>; logs: SpatialCorrectionLog[] } {
  const cells = [...grid.cells], outEntities = { ...entities }, logs: SpatialCorrectionLog[] = [];
  const clearPoint = (pt: Point2D, targetId?: string): boolean => {
    if (!isWithinBounds(grid, pt.x, pt.y)) return false;
    const idx = pt.y * grid.width + pt.x, cell = cells[idx];
    if (!cell) return false;
    let cleared = false;
    if (cell.blocksMovement || cell.terrainType !== 'COBBLESTONE_FLOOR') {
      cells[idx] = { ...cell, terrainType: 'COBBLESTONE_FLOOR', blocksMovement: false, blocksSight: false, interiorZone: 'NONE' };
      cleared = true;
    }
    for (const ent of Object.values(outEntities)) {
      if (ent.position?.stratum === grid.stratum && ent.position.x === pt.x && ent.position.y === pt.y && ent.position.blocksMovement) {
        delete outEntities[ent.id];
        cleared = true;
      }
    }
    if (cleared) logs.push({ action: 'CLEAR_DOORWAY', position: pt, targetId, details: `Cleared doorway obstacle at (${pt.x},${pt.y})` });
    return cleared;
  };

  if (buildingsOrAnomalies.length > 0 && 'type' in buildingsOrAnomalies[0]!) {
    for (const a of buildingsOrAnomalies as readonly SpatialAnomaly[]) if (a.type === 'BLOCKED_DOORWAY') clearPoint(a.position, a.targetId);
    return { grid: { ...grid, cells }, entities: outEntities, logs };
  }
  const buildings: readonly PlacedBuildingSurvey[] = allBuildings ?? (buildingsOrAnomalies as readonly PlacedBuildingSurvey[]);
  for (const b of buildings) {
    for (const outPt of b.outwardPoints) {
      if (!outPt || !isWithinBounds(grid, outPt.x, outPt.y)) continue;
      const inOther = buildings.some((o) => o.id !== b.id && outPt.x >= o.bounds.x1 && outPt.x <= o.bounds.x2 && outPt.y >= o.bounds.y1 && outPt.y <= o.bounds.y2);
      if (!inOther) clearPoint(outPt, b.id);
    }
  }
  return { grid: { ...grid, cells }, entities: outEntities, logs };
}

export function flipOrRelocateDoorway(
  grid: StratumGrid,
  building: PlacedBuildingSurvey,
  allBuildingsOrAnomaly?: readonly PlacedBuildingSurvey[] | SpatialAnomaly,
  passedAnomaly?: SpatialAnomaly,
  _rng?: SeededRNG,
): { grid: StratumGrid; building: PlacedBuildingSurvey; log?: SpatialCorrectionLog } {
  const allBuildings = Array.isArray(allBuildingsOrAnomaly) ? allBuildingsOrAnomaly : [building];
  const anomaly = Array.isArray(allBuildingsOrAnomaly) ? passedAnomaly : (allBuildingsOrAnomaly && 'type' in allBuildingsOrAnomaly ? allBuildingsOrAnomaly : passedAnomaly);

  let blockedIdx = -1;
  for (let i = 0; i < building.entrancePoints.length; i++) {
    const door = building.entrancePoints[i]!, outPt = building.outwardPoints[i]!;
    if (anomaly && !((anomaly.position.x === door.x && anomaly.position.y === door.y) || (anomaly.position.x === outPt.x && anomaly.position.y === outPt.y))) continue;
    const oob = !isWithinBounds(grid, outPt.x, outPt.y);
    const inOther = allBuildings.some((o) => o.id !== building.id && outPt.x >= o.bounds.x1 && outPt.x <= o.bounds.x2 && outPt.y >= o.bounds.y1 && outPt.y <= o.bounds.y2);
    const cellOut = isWithinBounds(grid, outPt.x, outPt.y) ? getTileCell(grid, outPt.x, outPt.y) : undefined;
    if (oob || inOther || cellOut?.blocksMovement) { blockedIdx = i; break; }
  }
  if (blockedIdx === -1) return { grid, building };

  const oldDoor = building.entrancePoints[blockedIdx]!, { x1, y1, x2, y2 } = building.bounds;
  const candidates: { c: Point2D; d: Point2D }[] = [];
  const checkEdge = (cx: number, cy: number, dx: number, dy: number): void => {
    const d = { x: cx + dx, y: cy + dy }, a = { x: cx - dx, y: cy - dy };
    if (!isWithinBounds(grid, d.x, d.y) || !isWithinBounds(grid, a.x, a.y)) return;
    if (allBuildings.some((o) => o.id !== building.id && d.x >= o.bounds.x1 && d.x <= o.bounds.x2 && d.y >= o.bounds.y1 && d.y <= o.bounds.y2)) return;
    const cellA = getTileCell(grid, a.x, a.y), cellD = getTileCell(grid, d.x, d.y);
    if (!cellA || cellA.blocksMovement || !cellD || cellD.terrainType === 'ABYSS_DROP') return;
    candidates.push({ c: { x: cx, y: cy }, d });
  };

  for (let x = x1 + 1; x < x2; x++) { checkEdge(x, y1, 0, -1); checkEdge(x, y2, 0, 1); }
  for (let y = y1 + 1; y < y2; y++) { checkEdge(x1, y, -1, 0); checkEdge(x2, y, 1, 0); }
  if (candidates.length === 0) return { grid, building };

  candidates.sort((p1, p2) => ((getTileCell(grid, p1.d.x, p1.d.y)?.blocksMovement ? 1 : 0) - (getTileCell(grid, p2.d.x, p2.d.y)?.blocksMovement ? 1 : 0)));
  const best = candidates[0]!, cells = [...grid.cells];
  const oldIdx = oldDoor.y * grid.width + oldDoor.x, newIdx = best.c.y * grid.width + best.c.x, depIdx = best.d.y * grid.width + best.d.x;
  cells[oldIdx] = { ...cells[oldIdx]!, terrainType: 'SOOT_BRICK_WALL', blocksMovement: true, blocksSight: true };
  cells[newIdx] = { ...cells[newIdx]!, terrainType: 'WOODEN_DOOR_CLOSED', blocksMovement: true, blocksSight: true };
  cells[depIdx] = { ...cells[depIdx]!, terrainType: 'COBBLESTONE_FLOOR', blocksMovement: false, blocksSight: false, interiorZone: 'NONE' };

  const entrancePoints = building.entrancePoints.map((p, i) => (i === blockedIdx ? best.c : p));
  const outwardPoints = building.outwardPoints.map((p, i) => (i === blockedIdx ? best.d : p));
  const doors = { ...building.doors };
  for (const [k, v] of Object.entries(doors)) { if (v.x === oldDoor.x && v.y === oldDoor.y) doors[k] = best.c; }

  return {
    grid: { ...grid, cells }, building: { ...building, entrancePoints, outwardPoints, doors },
    log: { action: 'FLIP_DOORWAY', position: best.c, targetId: building.id, details: `Relocated door from (${oldDoor.x},${oldDoor.y}) to (${best.c.x},${best.c.y})` },
  };
}

function getReachableSet(grid: StratumGrid, hub: Point2D): Set<number> {
  const reachable = new Set<number>();
  if (!isWithinBounds(grid, hub.x, hub.y)) return reachable;
  const queue = [hub.y * grid.width + hub.x];
  reachable.add(queue[0]!);
  while (queue.length > 0) {
    const curr = queue.shift()!, cx = curr % grid.width, cy = Math.floor(curr / grid.width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx, ny = cy + dy, nIdx = ny * grid.width + nx;
      if (!isWithinBounds(grid, nx, ny) || reachable.has(nIdx)) continue;
      const cell = grid.cells[nIdx];
      if (cell && (!cell.blocksMovement || cell.terrainType === 'WOODEN_DOOR_CLOSED' || cell.terrainType === 'WOODEN_DOOR_OPEN')) {
        reachable.add(nIdx); queue.push(nIdx);
      }
    }
  }
  return reachable;
}

export function stitchDisconnectedPathways(
  grid: StratumGrid, hub: Point2D, disconnectedTargets: readonly Point2D[],
): { grid: StratumGrid; logs: SpatialCorrectionLog[] } {
  const cells = [...grid.cells], logs: SpatialCorrectionLog[] = [], { width, height } = grid;
  const reachable = getReachableSet(grid, hub);

  for (const target of disconnectedTargets) {
    if (!isWithinBounds(grid, target.x, target.y)) continue;
    const targetIdx = target.y * width + target.x;
    if (reachable.has(targetIdx)) continue;

    const open = [targetIdx], gScore = new Float64Array(width * height).fill(Infinity);
    const fScore = new Float64Array(width * height).fill(Infinity), parent = new Int32Array(width * height).fill(-1);
    gScore[targetIdx] = 0; fScore[targetIdx] = Math.abs(target.x - hub.x) + Math.abs(target.y - hub.y);
    let meetIdx = -1;

    while (open.length > 0) {
      let best = 0;
      for (let i = 1; i < open.length; i++) if (fScore[open[i]!]! < fScore[open[best]!]!) best = i;
      const currIdx = open.splice(best, 1)[0]!;
      if (reachable.has(currIdx)) { meetIdx = currIdx; break; }

      const cx = currIdx % width, cy = Math.floor(currIdx / width), curG = gScore[currIdx]!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 1 || ny < 1 || nx >= width - 1 || ny >= height - 1) continue;
        const nIdx = ny * width + nx, cell = cells[nIdx]!;
        const stepCost = (cell.interiorZone && cell.interiorZone !== 'NONE') ? 350.0 : (cell.terrainType === 'SOOT_BRICK_WALL' ? 60.0 : (cell.blocksMovement ? 5.0 : 1.0));
        const nextG = curG + stepCost;
        if (nextG < gScore[nIdx]!) {
          gScore[nIdx] = nextG; parent[nIdx] = currIdx; fScore[nIdx] = nextG + Math.abs(nx - hub.x) + Math.abs(ny - hub.y);
          if (!open.includes(nIdx)) open.push(nIdx);
        }
      }
    }
    if (meetIdx !== -1) {
      let curr = meetIdx;
      while (curr !== -1) {
        const cell = cells[curr]!;
        if (cell.blocksMovement || cell.terrainType !== 'COBBLESTONE_FLOOR') cells[curr] = { ...cell, terrainType: 'COBBLESTONE_FLOOR', blocksMovement: false, blocksSight: false, interiorZone: 'NONE' };
        reachable.add(curr); curr = parent[curr]!;
      }
      logs.push({ action: 'STITCH_PATHWAY', position: target, details: `Stitched sidewalk from (${target.x},${target.y}) to network` });
    }
  }
  return { grid: { ...grid, cells }, logs };
}

export function restoreRoadCorridors(grid: StratumGrid, streetCorridors: readonly Box[]): { grid: StratumGrid; logs: SpatialCorrectionLog[] } {
  const cells = [...grid.cells], logs: SpatialCorrectionLog[] = [];
  for (const corridor of streetCorridors) {
    let restored = 0;
    for (let y = corridor.y1; y <= corridor.y2; y++) {
      for (let x = corridor.x1; x <= corridor.x2; x++) {
        if (!isWithinBounds(grid, x, y)) continue;
        const idx = y * grid.width + x, cell = cells[idx]!;
        if (cell.blocksMovement || cell.terrainType !== 'COBBLESTONE_FLOOR') {
          cells[idx] = { ...cell, terrainType: 'COBBLESTONE_FLOOR', blocksMovement: false, blocksSight: false, interiorZone: 'NONE' };
          restored++;
        }
      }
    }
    if (restored > 0) {
      logs.push({ action: 'RESTORE_ROAD', position: { x: corridor.x1, y: corridor.y1 }, details: `Restored road [${corridor.x1},${corridor.y1} to ${corridor.x2},${corridor.y2}]: cleared ${restored} tiles` });
    }
  }
  return { grid: { ...grid, cells }, logs };
}

export function applySpatialSelfCorrection(
  grid: StratumGrid, entities: Record<string, EntityRecord>, buildings: PlacedBuildingSurvey[], hub: Point2D, targets: Point2D[], streetCorridors: Box[], maxPasses = 3,
): { grid: StratumGrid; entities: Record<string, EntityRecord>; buildings: PlacedBuildingSurvey[]; corrections: SpatialCorrectionLog[] } {
  let curGrid = grid, curEntities = { ...entities }, curBuildings = [...buildings];
  const allLogs: SpatialCorrectionLog[] = [];

  for (let pass = 0; pass < maxPasses; pass++) {
    let mods = 0;
    const clearRes = clearDoorwayObstacles(curGrid, curEntities, curBuildings);
    if (clearRes.logs.length > 0) { curGrid = clearRes.grid; curEntities = clearRes.entities; allLogs.push(...clearRes.logs); mods += clearRes.logs.length; }
    const roadRes = restoreRoadCorridors(curGrid, streetCorridors);
    if (roadRes.logs.length > 0) { curGrid = roadRes.grid; allLogs.push(...roadRes.logs); mods += roadRes.logs.length; }
    const nextBuildings: PlacedBuildingSurvey[] = [];
    for (const b of curBuildings) {
      const flipRes = flipOrRelocateDoorway(curGrid, b, curBuildings);
      curGrid = flipRes.grid; nextBuildings.push(flipRes.building);
      if (flipRes.log) { allLogs.push(flipRes.log); mods++; }
    }
    curBuildings = nextBuildings;
    const allTargets = [...targets, ...curBuildings.flatMap((b) => b.outwardPoints)];
    const stitchRes = stitchDisconnectedPathways(curGrid, hub, allTargets);
    if (stitchRes.logs.length > 0) { curGrid = stitchRes.grid; allLogs.push(...stitchRes.logs); mods += stitchRes.logs.length; }
    if (mods === 0) break;
  }
  return { grid: curGrid, entities: curEntities, buildings: curBuildings, corrections: allLogs };
}
