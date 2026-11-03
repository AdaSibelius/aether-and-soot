import { EntityRecord } from '../../schemas/components.schema.js';
import { Point2D } from '../../schemas/primitives.schema.js';
import { Box, intersects } from './block-geometry.js';
import { findBlockingEntityAtPoint, getTileCell, isWithinBounds, StratumGrid } from './grid.js';
import { AnomalySeverity, PlacedBuildingSurvey, SpatialAnomaly, SpatialAnomalyType } from './spatial-survey-types.js';

function makeAnomaly(id: string, type: SpatialAnomalyType, severity: AnomalySeverity, position: Point2D, description: string, targetId?: string): SpatialAnomaly {
  return targetId !== undefined ? { id, type, severity, position, description, targetId } : { id, type, severity, position, description };
}

export function detectBuildingOverlaps(buildings: readonly PlacedBuildingSurvey[]): SpatialAnomaly[] {
  const anomalies: SpatialAnomaly[] = [];
  for (let i = 0; i < buildings.length; i++) {
    const bA = buildings[i]!;
    for (let j = i + 1; j < buildings.length; j++) {
      const bB = buildings[j]!;
      if (intersects(bA.bounds, bB.bounds)) {
        const ox = Math.max(bA.bounds.x1, bB.bounds.x1), oy = Math.max(bA.bounds.y1, bB.bounds.y1);
        anomalies.push(makeAnomaly(`anom_ol_${bA.id}_${bB.id}`, 'BUILDING_OVERLAP', 'FATAL', { x: ox, y: oy }, `Building '${bA.id}' overlaps '${bB.id}' at (${ox},${oy})`, bA.id));
      }
    }
  }
  return anomalies;
}

export function detectBlockedDoorways(grid: StratumGrid, entities: Record<string, EntityRecord>, buildings: readonly PlacedBuildingSurvey[]): SpatialAnomaly[] {
  const anomalies: SpatialAnomaly[] = [];
  for (const b of buildings) {
    for (let k = 0; k < b.entrancePoints.length; k++) {
      const doorPt = b.entrancePoints[k]!;
      const doorCell = getTileCell(grid, doorPt.x, doorPt.y);
      if (!doorCell || doorCell.terrainType === 'SOOT_BRICK_WALL') {
        anomalies.push(makeAnomaly(`anom_dr_sld_${b.id}_${doorPt.x}_${doorPt.y}`, 'BLOCKED_DOORWAY', 'FATAL', doorPt, `Door at (${doorPt.x},${doorPt.y}) in '${b.id}' sealed by solid wall`, b.id));
        continue;
      }
      const doorEnt = findBlockingEntityAtPoint(entities, { x: doorPt.x, y: doorPt.y, stratum: grid.stratum });
      if (doorEnt) {
        anomalies.push(makeAnomaly(`anom_dr_fxt_${b.id}_${doorPt.x}_${doorPt.y}`, 'BLOCKED_DOORWAY', 'ERROR', doorPt, `Door at (${doorPt.x},${doorPt.y}) blocked by fixture '${doorEnt.name ?? doorEnt.id}'`, doorEnt.id));
      }
      let outPt = b.outwardPoints[k];
      if (!outPt) {
        if (doorPt.x === b.bounds.x1) outPt = { x: doorPt.x - 1, y: doorPt.y };
        else if (doorPt.x === b.bounds.x2) outPt = { x: doorPt.x + 1, y: doorPt.y };
        else if (doorPt.y === b.bounds.y1) outPt = { x: doorPt.x, y: doorPt.y - 1 };
        else outPt = { x: doorPt.x, y: doorPt.y + 1 };
      }
      if (!isWithinBounds(grid, outPt.x, outPt.y)) {
        anomalies.push(makeAnomaly(`anom_dr_oob_${b.id}_${doorPt.x}_${doorPt.y}`, 'BLOCKED_DOORWAY', 'FATAL', doorPt, `Door at (${doorPt.x},${doorPt.y}) in '${b.id}' opens out of bounds`, b.id));
        continue;
      }
      const outCell = getTileCell(grid, outPt.x, outPt.y);
      if (outCell && outCell.blocksMovement && outCell.terrainType !== 'WOODEN_DOOR_CLOSED' && outCell.terrainType !== 'WOODEN_DOOR_OPEN') {
        const isWall = outCell.terrainType === 'SOOT_BRICK_WALL' || outCell.terrainType === 'TIMBER_STRUT';
        anomalies.push(makeAnomaly(`anom_dr_obs_${b.id}_${doorPt.x}_${doorPt.y}`, 'BLOCKED_DOORWAY', isWall ? 'FATAL' : 'ERROR', doorPt, `Door at (${doorPt.x},${doorPt.y}) faces ${outCell.terrainType}`, b.id));
      }
      const outEnt = findBlockingEntityAtPoint(entities, { x: outPt.x, y: outPt.y, stratum: grid.stratum });
      if (outEnt) {
        anomalies.push(makeAnomaly(`anom_dr_oent_${b.id}_${doorPt.x}_${doorPt.y}`, 'BLOCKED_DOORWAY', 'ERROR', doorPt, `Departure tile for door at (${doorPt.x},${doorPt.y}) blocked by '${outEnt.name ?? outEnt.id}'`, outEnt.id));
      }
      const inPt = { x: doorPt.x - (outPt.x - doorPt.x), y: doorPt.y - (outPt.y - doorPt.y) };
      if (isWithinBounds(grid, inPt.x, inPt.y) && getTileCell(grid, inPt.x, inPt.y)?.terrainType === 'SOOT_BRICK_WALL') {
        anomalies.push(makeAnomaly(`anom_dr_in_${b.id}_${doorPt.x}_${doorPt.y}`, 'BLOCKED_DOORWAY', 'WARNING', doorPt, `Interior approach for door at (${doorPt.x},${doorPt.y}) obstructed by wall`, b.id));
      }
    }
  }
  return anomalies;
}

export function detectWallCollisions(grid: StratumGrid, portals: readonly Point2D[], streetCorridors: readonly Box[]): SpatialAnomaly[] {
  const anomalies: SpatialAnomaly[] = [];
  for (const p of portals) {
    if (!isWithinBounds(grid, p.x, p.y)) {
      anomalies.push(makeAnomaly(`anom_ptl_oob_${p.x}_${p.y}`, 'WALL_COLLISION', 'FATAL', p, `Portal at (${p.x},${p.y}) is out of bounds`));
      continue;
    }
    const cell = getTileCell(grid, p.x, p.y);
    if (cell && (cell.blocksMovement || cell.terrainType === 'SOOT_BRICK_WALL')) {
      anomalies.push(makeAnomaly(`anom_ptl_wall_${p.x}_${p.y}`, 'WALL_COLLISION', 'FATAL', p, `Portal at (${p.x},${p.y}) blocked by solid wall`));
      continue;
    }
    let walkableAdj = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = p.x + dx, ny = p.y + dy;
      if (!isWithinBounds(grid, nx, ny)) continue;
      const c = getTileCell(grid, nx, ny);
      if (c && (!c.blocksMovement || c.terrainType === 'WOODEN_DOOR_CLOSED' || c.terrainType === 'WOODEN_DOOR_OPEN')) walkableAdj++;
    }
    if (walkableAdj === 0) {
      anomalies.push(makeAnomaly(`anom_ptl_trp_${p.x}_${p.y}`, 'WALL_COLLISION', 'ERROR', p, `Portal at (${p.x},${p.y}) has zero walkable adjacent tiles`));
    }
  }
  for (let ci = 0; ci < streetCorridors.length; ci++) {
    const box = streetCorridors[ci]!;
    for (let y = box.y1; y <= box.y2; y++) {
      for (let x = box.x1; x <= box.x2; x++) {
        if (!isWithinBounds(grid, x, y)) continue;
        if (getTileCell(grid, x, y)?.terrainType === 'SOOT_BRICK_WALL') {
          anomalies.push(makeAnomaly(`anom_crd_wall_${ci}_${x}_${y}`, 'WALL_COLLISION', 'ERROR', { x, y }, `Wall at (${x},${y}) breaches street corridor`));
        }
      }
    }
  }
  return anomalies;
}

export function detectDisconnectedPathways(grid: StratumGrid, hub: Point2D, targets: readonly Point2D[]): SpatialAnomaly[] {
  const anomalies: SpatialAnomaly[] = [];
  if (!isWithinBounds(grid, hub.x, hub.y)) {
    return [makeAnomaly('anom_hub_oob', 'DISCONNECTED_PATHWAY', 'FATAL', hub, `Hub (${hub.x},${hub.y}) is out of bounds`)];
  }
  const hubCell = getTileCell(grid, hub.x, hub.y);
  if (hubCell && hubCell.blocksMovement && hubCell.terrainType !== 'WOODEN_DOOR_CLOSED' && hubCell.terrainType !== 'WOODEN_DOOR_OPEN') {
    return [makeAnomaly('anom_hub_blk', 'DISCONNECTED_PATHWAY', 'FATAL', hub, `Hub (${hub.x},${hub.y}) is blocked by ${hubCell.terrainType}`)];
  }
  const { width, height } = grid, visited = new Uint8Array(width * height), queue: Point2D[] = [hub];
  visited[hub.y * width + hub.x] = 1;
  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = curr.x + dx, ny = curr.y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const idx = ny * width + nx;
      if (visited[idx]) continue;
      const cell = grid.cells[idx];
      if (cell && (!cell.blocksMovement || cell.terrainType === 'WOODEN_DOOR_CLOSED' || cell.terrainType === 'WOODEN_DOOR_OPEN')) {
        visited[idx] = 1;
        queue.push({ x: nx, y: ny });
      }
    }
  }
  for (const t of targets) {
    if (!isWithinBounds(grid, t.x, t.y)) {
      anomalies.push(makeAnomaly(`anom_tgt_oob_${t.x}_${t.y}`, 'DISCONNECTED_PATHWAY', 'FATAL', t, `Target at (${t.x},${t.y}) is out of bounds`));
      continue;
    }
    if (!visited[t.y * width + t.x]) {
      anomalies.push(makeAnomaly(`anom_disc_${t.x}_${t.y}`, 'DISCONNECTED_PATHWAY', 'ERROR', t, `Target at (${t.x},${t.y}) is disconnected from hub (${hub.x},${hub.y})`));
    }
  }
  return anomalies;
}

export function detectBuildingRoadCollisions(buildings: readonly PlacedBuildingSurvey[], streetCorridors: readonly Box[]): SpatialAnomaly[] {
  const anomalies: SpatialAnomaly[] = [];
  for (const b of buildings) {
    for (let ci = 0; ci < streetCorridors.length; ci++) {
      const corridor = streetCorridors[ci]!;
      if (intersects(b.bounds, corridor)) {
        const ox = Math.max(b.bounds.x1, corridor.x1), oy = Math.max(b.bounds.y1, corridor.y1);
        anomalies.push(makeAnomaly(`anom_road_col_${b.id}_${ci}`, 'BUILDING_ROAD_COLLISION', 'FATAL', { x: ox, y: oy }, `Building '${b.id}' encroaches into corridor at (${ox},${oy})`, b.id));
      }
    }
  }
  return anomalies;
}

export function runSpatialAnomalyAudit(
  grid: StratumGrid,
  entities: Record<string, EntityRecord>,
  buildings: readonly PlacedBuildingSurvey[],
  hub: Point2D,
  targets: readonly Point2D[],
  streetCorridors: readonly Box[],
  portals?: readonly Point2D[],
): SpatialAnomaly[] {
  const resolvedPortals = portals ?? Object.values(entities)
    .filter((e) => e.portal && e.position && e.position.stratum === grid.stratum)
    .map((e) => ({ x: e.position!.x, y: e.position!.y }));
  return [
    ...detectBuildingOverlaps(buildings),
    ...detectBlockedDoorways(grid, entities, buildings),
    ...detectWallCollisions(grid, resolvedPortals, streetCorridors),
    ...detectDisconnectedPathways(grid, hub, targets),
    ...detectBuildingRoadCollisions(buildings, streetCorridors),
  ];
}
