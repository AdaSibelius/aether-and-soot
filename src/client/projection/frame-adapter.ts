import { EntityRecord } from '../../schemas/components.schema.js';
import { StratumId, VisualGlyphSpec } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { computeVisibleTiles, pointKey } from '../../sim/spatial/fov.js';
import { computeProstheticFovBonus } from '../../sim/systems/anatomy.system.js';
import { resolveBiomeTerrainVisual, resolveDistrictBiome } from './biome-palette.js';
import { resolveConnectingWallGlyph, WALL_BOX_GLYPHS } from './wall-connections.js';
import { applyGaslightVisual, applyLiquidSurfaceVisual, applySootVisualOverlay } from './environmental-visuals.js';
import { calculateGaslightField } from '../../sim/systems/gaslight.system.js';
import { calculateCameraViewport, resolveOutOfBoundsVisual } from './camera-governor.js';
import { humanizeIdentifier, resolveCatalogDisplayName } from './catalog-display.js';

export { humanizeIdentifier, resolveCatalogDisplayName };

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
  readonly isUnderlay?: boolean;
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
  viewportOverride?: { width: number; height: number; tacticalWidth?: number },
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

  const vp = calculateCameraViewport(
    grid.width,
    grid.height,
    originX,
    originY,
    DEFAULT_VIEWPORT_WIDTH,
    DEFAULT_VIEWPORT_HEIGHT,
    viewportOverride,
  );

  const districtBiome = resolveDistrictBiome(state.currentDistrictId, activeStratum);
  const gaslightField = calculateGaslightField(state, activeStratum);

  const cells: RenderCellFrame[] = [];
  for (let vy = 0; vy < vp.viewportHeight; vy++) {
    for (let vx = 0; vx < vp.viewportWidth; vx++) {
      const worldX = vp.cameraX + vx - vp.offsetX;
      const worldY = vp.cameraY + vy - vp.offsetY;

      if (worldX < 0 || worldX >= grid.width || worldY < 0 || worldY >= grid.height) {
        cells.push({
          x: vx,
          y: vy,
          worldX,
          worldY,
          visual: resolveOutOfBoundsVisual(worldX, worldY, grid.width, grid.height, state.turnCount),
          visible: false,
          explored: false,
          steamPressureKpa: 0,
          coalDustDensity: 0,
        });
        continue;
      }

      const tile = grid.cells[worldY * grid.width + worldX];
      const isVisible = visibleSet.has(pointKey(worldX, worldY));
      const isExplored = isVisible || (tile?.explored ?? false);

      let isUnderlay = false;
      const connectingWallGlyph = tile ? resolveConnectingWallGlyph(grid, worldX, worldY) : WALL_BOX_GLYPHS.DEFAULT;
      let cellVisual = tile
        ? resolveBiomeTerrainVisual(tile.terrainType, isVisible, isExplored, districtBiome, connectingWallGlyph, tile.steamPressureKpa ?? 0)
        : resolveBiomeTerrainVisual('COBBLESTONE_FLOOR', isVisible, false, districtBiome, WALL_BOX_GLYPHS.DEFAULT, 0);

      // DEF-11: Spire vertical depth parallax over Street abyss drops
      if (activeStratum === 'SPIRE' && tile?.terrainType === 'ABYSS_DROP' && state.strata.STREET) {
        const streetGrid = state.strata.STREET;
        if (worldX < streetGrid.width && worldY < streetGrid.height) {
          const streetTile = streetGrid.cells[worldY * streetGrid.width + worldX];
          if (streetTile) {
            const streetVisual = resolveBiomeTerrainVisual(streetTile.terrainType, false, true, districtBiome, WALL_BOX_GLYPHS.DEFAULT, 0);
            isUnderlay = true;
            cellVisual = {
              glyph: streetVisual.glyph !== ' ' ? streetVisual.glyph : '·',
              fgPrimary: '#1a2634', // desaturated soot-navy tint
              fgSecondary: '#101820',
              bgColor: '#080d14',
              shaderFlags: [],
            };
          }
        }
      }

      if (tile) {
        cellVisual = applyLiquidSurfaceVisual(cellVisual, tile.liquidType, tile.liquidVolumeMl, isVisible, isExplored);
        cellVisual = applySootVisualOverlay(cellVisual, tile.smokePpm ?? 0, tile.coalDustDensity ?? 0, worldX, worldY, state.turnCount, isVisible, isExplored);
      }
      const isGaslit = (gaslightField.get(pointKey(worldX, worldY)) ?? 0) > 0.15;
      cellVisual = applyGaslightVisual(cellVisual, isGaslit);

      cells.push({
        x: vx, y: vy, worldX, worldY, visual: cellVisual, visible: isVisible, explored: isExplored,
        steamPressureKpa: tile?.steamPressureKpa ?? 0, coalDustDensity: tile?.coalDustDensity ?? 0,
        isUnderlay,
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

    const screenX = pos.x - vp.cameraX + vp.offsetX;
    const screenY = pos.y - vp.cameraY + vp.offsetY;
    if (screenX >= 0 && screenX < vp.viewportWidth && screenY >= 0 && screenY < vp.viewportHeight) {
      const idx = screenY * vp.viewportWidth + screenX;
      const currentCell = cells[idx];
      if (currentCell) {
        const isGaslit = (gaslightField.get(pointKey(pos.x, pos.y)) ?? 0) > 0.15;
        const gaslitVisual = applyGaslightVisual(entity.visual, isGaslit);
        cells[idx] = {
          ...currentCell,
          visual: {
            ...gaslitVisual,
            // Preserve the tile's underlying background color so entity glyphs do not stamp opaque black boxes
            bgColor: currentCell.visual.bgColor,
          },
        };
      }
    }
  }

  return {
    turnCount: state.turnCount,
    macroTickCount: state.macroTickCount,
    activeStratum,
    width: vp.viewportWidth,
    height: vp.viewportHeight,
    cameraOrigin: { x: vp.cameraX - vp.offsetX, y: vp.cameraY - vp.offsetY },
    effectiveFovRadius,
    playerOrigin: { x: originX, y: originY },
    cells,
  };
}
