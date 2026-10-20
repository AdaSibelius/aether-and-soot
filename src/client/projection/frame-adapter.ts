import { EntityRecord } from '../../schemas/components.schema.js';
import { StratumId, VisualGlyphSpec } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { computeVisibleTiles, pointKey } from '../../sim/spatial/fov.js';
import { computeProstheticFovBonus } from '../../sim/systems/anatomy.system.js';

export const DEFAULT_VIEWPORT_WIDTH = 24;
export const DEFAULT_VIEWPORT_HEIGHT = 20;
export const DEFAULT_FOV_RADIUS = 10;

export interface RenderCellFrame {
  readonly x: number;
  readonly y: number;
  readonly worldX: number;
  readonly worldY: number;
  readonly visual: VisualGlyphSpec;
  readonly visible: boolean;
  readonly explored: boolean;
  readonly steamPressureKpa: number;
  readonly coalDustDensity: number;
}

export interface VisualGridFrame {
  readonly turnCount: number;
  readonly macroTickCount: number;
  readonly activeStratum: StratumId;
  readonly width: number;
  readonly height: number;
  readonly cameraOrigin: { readonly x: number; readonly y: number };
  readonly effectiveFovRadius: number;
  readonly playerOrigin: { readonly x: number; readonly y: number };
  readonly cells: readonly RenderCellFrame[];
}

/** Higher draws later (on top): ground items (0) < fixtures like portals/vessels (1) < actors (2). */
function entityDrawPriority(entity: EntityRecord): number {
  if (entity.actor) return 2;
  if (entity.item || entity.prostheticSpec) return 0;
  return 1;
}

/**
 * Pure read-only projection from WorldState + Shadowcasting FOV to a viewport-clamped glyph/tile frame.
 * Never mutates WorldState.
 */
export function projectWorldToVisualFrame(
  state: Readonly<WorldState>,
  focusActorId = 'actor_player',
  baseFovRadius = DEFAULT_FOV_RADIUS,
): VisualGridFrame {
  const focusActor = state.entities[focusActorId];
  const activeStratum: StratumId = focusActor?.position?.stratum ?? 'STREET';
  const grid = state.strata[activeStratum];
  if (!grid) {
    throw new Error(`Missing stratum grid for ${activeStratum}`);
  }

  const originX = focusActor?.position?.x ?? Math.floor(grid.width / 2);
  const originY = focusActor?.position?.y ?? Math.floor(grid.height / 2);
  const traitBonus = focusActor?.traits?.includes('NIGHT_OPTICS') ? 2 : 0;
  const fovBonus = (focusActor ? computeProstheticFovBonus(state, focusActor) : 0) + traitBonus;
  const effectiveFovRadius = Math.max(2, baseFovRadius + fovBonus);
  const visibleSet = computeVisibleTiles(grid, originX, originY, effectiveFovRadius);

  const viewportWidth = Math.min(DEFAULT_VIEWPORT_WIDTH, grid.width);
  const viewportHeight = Math.min(DEFAULT_VIEWPORT_HEIGHT, grid.height);

  const cameraX = Math.max(0, Math.min(grid.width - viewportWidth, originX - Math.floor(viewportWidth / 2)));
  const cameraY = Math.max(0, Math.min(grid.height - viewportHeight, originY - Math.floor(viewportHeight / 2)));

  const cells: RenderCellFrame[] = [];
  for (let vy = 0; vy < viewportHeight; vy++) {
    for (let vx = 0; vx < viewportWidth; vx++) {
      const worldX = cameraX + vx;
      const worldY = cameraY + vy;
      const tile = grid.cells[worldY * grid.width + worldX];
      const isVisible = visibleSet.has(pointKey(worldX, worldY));
      const isExplored = isVisible || (tile?.explored ?? false);

      let baseVisual: VisualGlyphSpec;
      if (!isExplored) {
        baseVisual = {
          glyph: ' ',
          fgPrimary: '#17202A',
          fgSecondary: '#050708',
          bgColor: '#050708',
          shaderFlags: [],
        };
      } else if (tile?.terrainType === 'SOOT_BRICK_WALL') {
        baseVisual = {
          glyph: '#',
          fgPrimary: isVisible ? '#99A3A4' : '#34495E',
          fgSecondary: isVisible ? '#BA4A00' : '#2C3E50',
          bgColor: '#17202A',
          shaderFlags: isVisible ? ['SOOT_OCCLUSION'] : [],
        };
      } else if (tile?.terrainType === 'WOODEN_DOOR_CLOSED') {
        baseVisual = {
          glyph: '+',
          fgPrimary: isVisible ? '#E67E22' : '#7E5109',
          fgSecondary: '#BA4A00',
          bgColor: '#1C130C',
          shaderFlags: [],
        };
      } else if (tile?.terrainType === 'WOODEN_DOOR_OPEN') {
        baseVisual = {
          glyph: '/',
          fgPrimary: isVisible ? '#F39C12' : '#7D6608',
          fgSecondary: '#D35400',
          bgColor: '#0A0D0E',
          shaderFlags: [],
        };
      } else if (tile?.terrainType === 'DISTRICT_GATE') {
        baseVisual = {
          glyph: 'Ω',
          fgPrimary: isVisible ? '#F4D03F' : '#7D6608',
          fgSecondary: '#F39C12',
          bgColor: '#1A1105',
          shaderFlags: isVisible ? ['SPARK_GLINT'] : [],
        };
      } else if (tile?.terrainType === 'GLASS_WINDOW') {
        baseVisual = {
          glyph: '⊞',
          fgPrimary: isVisible ? '#A9CCE3' : '#5D6D7E',
          fgSecondary: '#5499C7',
          bgColor: '#0A0D0E',
          shaderFlags: isVisible ? ['SPARK_GLINT'] : [],
        };
      } else if (tile?.terrainType === 'SMASHED_WINDOW_FRAME') {
        baseVisual = {
          glyph: '%',
          fgPrimary: isVisible ? '#BDC3C7' : '#566573',
          fgSecondary: '#7F8C8D',
          bgColor: '#0A0D0E',
          shaderFlags: [],
        };
      } else if (tile?.terrainType === 'RUBBLE_PILE') {
        baseVisual = {
          glyph: ',',
          fgPrimary: isVisible ? '#7F8C8D' : '#34495E',
          fgSecondary: '#566573',
          bgColor: '#0A0D0E',
          shaderFlags: [],
        };
      } else {
        baseVisual = {
          glyph: tile?.terrainType === 'BRASS_CATWALK' ? '=' : tile?.terrainType === 'IRON_GRATE' ? '≈' : '·',
          fgPrimary: isVisible ? '#5D6D7E' : '#2C3E50',
          fgSecondary: '#1C2833',
          bgColor: '#0A0D0E',
          shaderFlags:
            isVisible && (tile?.steamPressureKpa ?? 0) > 0 ? ['PULSE_STEAM', 'HEAT_SHIMMER'] : [],
        };
      }

      cells.push({
        x: vx,
        y: vy,
        worldX,
        worldY,
        visual: baseVisual,
        visible: isVisible,
        explored: isExplored,
        steamPressureKpa: tile?.steamPressureKpa ?? 0,
        coalDustDensity: tile?.coalDustDensity ?? 0,
      });
    }
  }

  const drawOrder = Object.values(state.entities).sort(
    (a, b) => entityDrawPriority(a) - entityDrawPriority(b),
  );
  for (const entity of drawOrder) {
    const pos = entity.position;
    if (!pos || pos.stratum !== activeStratum) continue;
    const isActor = Boolean(entity.actor);
    const inFov = visibleSet.has(pointKey(pos.x, pos.y));
    if (isActor && !inFov && entity.id !== focusActorId) continue;
    const tileExplored = inFov || (grid.cells[pos.y * grid.width + pos.x]?.explored ?? false);
    if (!inFov && !tileExplored) continue;

    const screenX = pos.x - cameraX;
    const screenY = pos.y - cameraY;
    if (screenX >= 0 && screenX < viewportWidth && screenY >= 0 && screenY < viewportHeight) {
      const idx = screenY * viewportWidth + screenX;
      const currentCell = cells[idx];
      if (currentCell) {
        cells[idx] = {
          ...currentCell,
          visual: entity.visual,
        };
      }
    }
  }

  return {
    turnCount: state.turnCount,
    macroTickCount: state.macroTickCount,
    activeStratum,
    width: viewportWidth,
    height: viewportHeight,
    cameraOrigin: { x: cameraX, y: cameraY },
    effectiveFovRadius,
    playerOrigin: { x: originX, y: originY },
    cells,
  };
}
