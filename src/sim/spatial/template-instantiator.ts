import { EntityRecord } from '../../schemas/components.schema.js';
import {
  EntityId,
  EntityIdSchema,
  Point2D,
} from '../../schemas/primitives.schema.js';
import {
  BuildingTemplate,
  TemplatePlacement,
  TemplateRoomDefinition,
} from '../../schemas/building-template.schema.js';
import { SeededRNG } from '../core/rng.js';
import { getTileCell, isWithinBounds, StratumGrid } from './grid.js';
import {
  buildFixtureEntityId,
  createVictorianFixture,
} from './fixture-catalog.js';

export type TemplateRotation = 0 | 90 | 180 | 270;

export interface TemplateInstantiationResult {
  readonly grid: StratumGrid;
  readonly entities: Record<string, EntityRecord>;
  readonly entrancePoints: readonly Point2D[];
  readonly outwardPoints: readonly Point2D[];
  readonly fixturesPlaced: readonly EntityId[];
  readonly doors: Record<string, Point2D>;
  readonly keyPositions: Record<string, Point2D>;
}

export function getTransformedDimensions(
  w: number,
  h: number,
  rotation: TemplateRotation = 0,
): { width: number; height: number } {
  return rotation === 90 || rotation === 270 ? { width: h, height: w } : { width: w, height: h };
}

export function transformCoord(
  u: number,
  v: number,
  w: number,
  h: number,
  rotation: TemplateRotation = 0,
  mirrorX = false,
  flipY = false,
  origin: Point2D = { x: 0, y: 0 },
): Point2D {
  let rx = u, ry = v, rw = w, rh = h;
  if (rotation === 90) { rx = h - 1 - v; ry = u; rw = h; rh = w; }
  else if (rotation === 180) { rx = w - 1 - u; ry = h - 1 - v; }
  else if (rotation === 270) { rx = v; ry = w - 1 - u; rw = h; rh = w; }
  const mx = mirrorX ? rw - 1 - rx : rx;
  const my = flipY ? rh - 1 - ry : ry;
  return { x: origin.x + mx, y: origin.y + my };
}

export function transformRoomBox(
  room: TemplateRoomDefinition,
  w: number,
  h: number,
  rotation: TemplateRotation = 0,
  mirrorX = false,
  flipY = false,
  origin: Point2D = { x: 0, y: 0 },
): { x1: number; y1: number; x2: number; y2: number } {
  const c1 = transformCoord(room.x1, room.y1, w, h, rotation, mirrorX, flipY, origin);
  const c2 = transformCoord(room.x2, room.y2, w, h, rotation, mirrorX, flipY, origin);
  return {
    x1: Math.min(c1.x, c2.x),
    y1: Math.min(c1.y, c2.y),
    x2: Math.max(c1.x, c2.x),
    y2: Math.max(c1.y, c2.y),
  };
}

export function hasTemplateWalkablePath(grid: StratumGrid, start: Point2D, goal: Point2D): boolean {
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
      const nx = curr.x + dx, ny = curr.y + dy;
      if (!isWithinBounds(grid, nx, ny)) continue;
      const cell = getTileCell(grid, nx, ny);
      if (cell && (!cell.blocksMovement || cell.terrainType === 'WOODEN_DOOR_CLOSED' || cell.terrainType === 'WOODEN_DOOR_OPEN')) {
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return false;
}

export function instantiateTemplateIntoGrid(
  grid: StratumGrid,
  entities: Record<string, EntityRecord>,
  template: BuildingTemplate,
  placement: TemplatePlacement,
  _rng: SeededRNG,
): TemplateInstantiationResult {
  const rot = (placement.rotation ?? placement.rotationDeg ?? 0) as TemplateRotation;
  const mx = placement.mirrorX ?? false;
  const fy = placement.flipY ?? false;
  const origin = placement.origin;
  const stratum = placement.targetStratum ?? grid.stratum;

  const w = template.width, h = template.height;
  const dims = getTransformedDimensions(w, h, rot);

  if (origin.x < 0 || origin.y < 0 || origin.x + dims.width > grid.width || origin.y + dims.height > grid.height) {
    throw new Error(`Template '${template.id}' out of bounds at (${origin.x}, ${origin.y}) on ${grid.width}x${grid.height}`);
  }

  const cells = [...grid.cells];
  const outEntities: Record<string, EntityRecord> = { ...entities };
  const entrancePoints: Point2D[] = [];
  const outwardPoints: Point2D[] = [];
  const fixturesPlaced: EntityId[] = [];
  const doors: Record<string, Point2D> = {};
  const keyPositions: Record<string, Point2D> = {};

  for (let v = 0; v < h; v++) {
    const row = template.rows[v];
    if (!row || row.length !== w) throw new Error(`Template '${template.id}' row ${v} invalid length`);
    for (let u = 0; u < w; u++) {
      const ch = row[u]!;
      const rule = template.legend[ch];
      if (!rule) throw new Error(`Template '${template.id}' missing legend for '${ch}' at (${u}, ${v})`);

      const pt = transformCoord(u, v, w, h, rot, mx, fy, origin);
      const idx = pt.y * grid.width + pt.x;
      const prev = cells[idx]!;

      const blocksMove = rule.blocksMovement ?? (
        rule.terrain === 'SOOT_BRICK_WALL' || rule.terrain === 'WOODEN_DOOR_CLOSED' ||
        rule.terrain === 'COUNTER_BARRIER' || rule.terrain === 'GLASS_WINDOW' || rule.terrain === 'WROUGHT_IRON_FENCE'
      );
      const blocksSight = rule.blocksSight ?? (rule.terrain === 'SOOT_BRICK_WALL' || rule.terrain === 'WOODEN_DOOR_CLOSED');

      cells[idx] = {
        ...prev,
        terrainType: rule.terrain,
        blocksMovement: blocksMove,
        blocksSight: blocksSight,
        interiorZone: rule.interiorZone ?? prev.interiorZone ?? 'NONE',
        steamPressureKpa: rule.steamPressureKpa ?? prev.steamPressureKpa,
        smokePpm: rule.smokePpm ?? prev.smokePpm,
      };

      const isPerimeter = u === 0 || u === w - 1 || v === 0 || v === h - 1;
      if (ch === template.exteriorDoorChar && isPerimeter) {
        entrancePoints.push(pt);
        doors[`${template.id}_door_${entrancePoints.length}`] = pt;
        const outU = u === 0 ? -1 : u === w - 1 ? 1 : 0;
        const outV = v === 0 ? -1 : v === h - 1 ? 1 : 0;
        outwardPoints.push(transformCoord(u + outU, v + outV, w, h, rot, mx, fy, origin));
      }

      if (rule.furnitureKind) {
        const fixtureId = buildFixtureEntityId(rule.furnitureKind, pt.x, pt.y, stratum);
        outEntities[fixtureId] = createVictorianFixture(rule.furnitureKind, {
          x: pt.x, y: pt.y, stratum, customId: fixtureId, label: rule.furnitureLabel,
          visual: rule.furnitureVisual, blocksMovement: rule.blocksMovement, blocksSight: rule.blocksSight,
          isContainer: rule.isContainer, coreHeatPct: rule.thermalCoreHeatPct, currentPressureKpa: rule.steamPressureKpa,
        }, outEntities);
        fixturesPlaced.push(fixtureId);
        keyPositions[`${rule.furnitureKind.toLowerCase()}_${fixturesPlaced.length}`] = pt;
      }

      if (rule.crossStratumPortal) {
        const portalId = EntityIdSchema.parse(`entity_portal_${template.id}_${pt.x}_${pt.y}_${stratum.toLowerCase()}`);
        outEntities[portalId] = {
          id: portalId,
          name: rule.crossStratumPortal.portalLabel,
          visual: { glyph: 'H', fgPrimary: '#D4AF37', fgSecondary: '#B7950B', bgColor: '#0A0D0E', shaderFlags: [] },
          position: { x: pt.x, y: pt.y, stratum, blocksMovement: false, blocksSight: false },
          portal: {
            target: { x: pt.x, y: pt.y, stratum: rule.crossStratumPortal.targetStratum },
            bidirectional: true,
            conductsGas: true,
            portalLabel: rule.crossStratumPortal.portalLabel,
            apCost: 100,
          },
        };
      }
    }
  }

  for (const room of template.rooms) {
    const box = transformRoomBox(room, w, h, rot, mx, fy, origin);
    for (let ry = box.y1; ry <= box.y2; ry++) {
      for (let rx = box.x1; rx <= box.x2; rx++) {
        const idx = ry * grid.width + rx;
        const cell = cells[idx];
        if (cell && cell.terrainType !== 'SOOT_BRICK_WALL') {
          cells[idx] = {
            ...cell,
            interiorZone: cell.interiorZone && cell.interiorZone !== 'NONE' ? cell.interiorZone : room.zone,
            smokePpm: room.ambientSmokePpm ? Math.max(cell.smokePpm ?? 0, room.ambientSmokePpm) : cell.smokePpm,
            steamPressureKpa: room.ambientSteamKpa ? Math.max(cell.steamPressureKpa ?? 0, room.ambientSteamKpa) : cell.steamPressureKpa,
          };
        }
      }
    }
  }

  const nextGrid: StratumGrid = { ...grid, cells };

  if (entrancePoints.length > 0) {
    const mainDoor = entrancePoints[0]!;
    for (const room of template.rooms) {
      const box = transformRoomBox(room, w, h, rot, mx, fy, origin);
      let roomWalkable: Point2D | undefined;
      for (let ry = box.y1; ry <= box.y2; ry++) {
        for (let rx = box.x1; rx <= box.x2; rx++) {
          const c = cells[ry * grid.width + rx];
          if (c && !c.blocksMovement) { roomWalkable = { x: rx, y: ry }; break; }
        }
        if (roomWalkable) break;
      }
      if (roomWalkable && !hasTemplateWalkablePath(nextGrid, mainDoor, roomWalkable)) {
        throw new Error(`Walkability invariant failed: Room '${room.label}' unreachable from door in '${template.id}'`);
      }
    }
  }

  return { grid: nextGrid, entities: outEntities, entrancePoints, outwardPoints, fixturesPlaced, doors, keyPositions };
}
