import { StratumId, VisualGlyphSpec } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';

export interface RenderCellFrame {
  readonly x: number;
  readonly y: number;
  readonly visual: VisualGlyphSpec;
  readonly steamPressureKpa: number;
}

export interface VisualGridFrame {
  readonly turnCount: number;
  readonly macroTickCount: number;
  readonly activeStratum: StratumId;
  readonly width: number;
  readonly height: number;
  readonly cells: readonly RenderCellFrame[];
}

/**
 * Pure read-only projection from WorldState to a Caves of Qud style glyph/tile frame.
 * Never mutates WorldState.
 */
export function projectWorldToVisualFrame(
  state: Readonly<WorldState>,
  focusActorId = 'actor_player',
): VisualGridFrame {
  const focusActor = state.entities[focusActorId];
  const activeStratum: StratumId = focusActor?.position?.stratum ?? 'STREET';
  const grid = state.strata[activeStratum];
  if (!grid) {
    throw new Error(`Missing stratum grid for ${activeStratum}`);
  }

  const cells: RenderCellFrame[] = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const tile = grid.cells[y * grid.width + x];
      const baseVisual: VisualGlyphSpec =
        tile?.terrainType === 'SOOT_BRICK_WALL'
          ? {
              glyph: '#',
              fgPrimary: '#7F8C8D',
              fgSecondary: '#BA4A00',
              bgColor: '#17202A',
              shaderFlags: ['SOOT_OCCLUSION'],
            }
          : {
              glyph: '.',
              fgPrimary: '#566573',
              fgSecondary: '#2C3E50',
              bgColor: '#0A0D0E',
              shaderFlags: [],
            };

      cells.push({
        x,
        y,
        visual: baseVisual,
        steamPressureKpa: tile?.steamPressureKpa ?? 0,
      });
    }
  }

  for (const entity of Object.values(state.entities)) {
    const pos = entity.position;
    if (pos && pos.stratum === activeStratum) {
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
    cells,
  };
}
