import { StratumId, VisualGlyphSpec } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { computeVisibleTiles, pointKey } from '../../sim/spatial/fov.js';

export const DEFAULT_FOV_RADIUS = 10;

export interface RenderCellFrame {
  readonly x: number;
  readonly y: number;
  readonly visual: VisualGlyphSpec;
  readonly visible: boolean;
  readonly steamPressureKpa: number;
  readonly coalDustDensity: number;
}

export interface VisualGridFrame {
  readonly turnCount: number;
  readonly macroTickCount: number;
  readonly activeStratum: StratumId;
  readonly width: number;
  readonly height: number;
  readonly playerOrigin: { readonly x: number; readonly y: number };
  readonly cells: readonly RenderCellFrame[];
}

/**
 * Pure read-only projection from WorldState + Shadowcasting FOV to a Caves of Qud style glyph/tile frame.
 * Never mutates WorldState.
 */
export function projectWorldToVisualFrame(
  state: Readonly<WorldState>,
  focusActorId = 'actor_player',
  fovRadius = DEFAULT_FOV_RADIUS,
): VisualGridFrame {
  const focusActor = state.entities[focusActorId];
  const activeStratum: StratumId = focusActor?.position?.stratum ?? 'STREET';
  const grid = state.strata[activeStratum];
  if (!grid) {
    throw new Error(`Missing stratum grid for ${activeStratum}`);
  }

  const originX = focusActor?.position?.x ?? Math.floor(grid.width / 2);
  const originY = focusActor?.position?.y ?? Math.floor(grid.height / 2);
  const visibleSet = computeVisibleTiles(grid, originX, originY, fovRadius);

  const cells: RenderCellFrame[] = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const tile = grid.cells[y * grid.width + x];
      const isVisible = visibleSet.has(pointKey(x, y));

      const baseVisual: VisualGlyphSpec =
        tile?.terrainType === 'SOOT_BRICK_WALL'
          ? {
              glyph: '#',
              fgPrimary: isVisible ? '#99A3A4' : '#34495E',
              fgSecondary: '#BA4A00',
              bgColor: '#17202A',
              shaderFlags: ['SOOT_OCCLUSION'],
            }
          : {
              glyph: '·',
              fgPrimary: isVisible ? '#5D6D7E' : '#1C2833',
              fgSecondary: '#2C3E50',
              bgColor: '#0A0D0E',
              shaderFlags:
                (tile?.steamPressureKpa ?? 0) > 0 ? ['PULSE_STEAM', 'HEAT_SHIMMER'] : [],
            };

      cells.push({
        x,
        y,
        visual: baseVisual,
        visible: isVisible,
        steamPressureKpa: tile?.steamPressureKpa ?? 0,
        coalDustDensity: tile?.coalDustDensity ?? 0,
      });
    }
  }

  for (const entity of Object.values(state.entities)) {
    const pos = entity.position;
    if (pos && pos.stratum === activeStratum && visibleSet.has(pointKey(pos.x, pos.y))) {
      const idx = pos.y * grid.width + pos.x;
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
    width: grid.width,
    height: grid.height,
    playerOrigin: { x: originX, y: originY },
    cells,
  };
}
