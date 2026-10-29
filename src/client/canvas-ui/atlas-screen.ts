import { EntityId, StratumId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { renderAtlasDossierPanel } from './atlas-dossier-panel.js';
import { UiCellBuffer } from './cell-buffer.js';
import { drawIndustrialFrame } from './industrial-primitives.js';
import { VICTORIAN_PALETTE } from './material-palette.js';
import { UiRect } from './viewport-controls.js';

export interface AtlasScreenOptions {
  readonly selectedStratum?: StratumId;
}

const STRATUM_LEVEL: Record<StratumId, number> = {
  CATACOMBS: 0,
  UNDERCROFT: 1,
  STREET: 2,
  SPIRE: 3,
};

export function renderAtlasScreen(
  buf: UiCellBuffer,
  rect: UiRect,
  state: Readonly<WorldState>,
  playerId: EntityId,
  options: AtlasScreenOptions = {},
): void {
  const player = state.entities[playerId];
  const playerPos = player?.position;
  const currentStratum = options.selectedStratum ?? playerPos?.stratum ?? 'STREET';

  // 1. Primary brass industrial bezel
  drawIndustrialFrame(buf, rect, {
    tier: 'SECONDARY_BRASS',
    title: 'METROPOLITAN ATLAS & DIEGETIC STRATUM MINIMAP [W]',
  });

  const leftX = rect.x + 2;
  const leftWidth = 38;
  const dividerX = rect.x + 41;
  const rightX = rect.x + 43;
  const rightWidth = Math.min(38, rect.width - 46);

  // Brass separator divider column
  for (let dy = rect.y + 2; dy < rect.y + rect.height - 2; dy++) {
    buf.setCell(dividerX, dy, '│', VICTORIAN_PALETTE.MUTED_PIPE, VICTORIAN_PALETTE.SOOT_IRON_BG);
  }

  // 2. Left Column: Stratum Minimap
  buf.writeString(leftX, rect.y + 2, '═[ STRATUM TOPOGRAPHY MINIMAP ]═', VICTORIAN_PALETTE.TARNISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG);

  const grid = state.strata[currentStratum];
  const mapW = Math.min(leftWidth, 36);
  const mapH = Math.min(rect.height - 8, 22);
  const mapStartY = rect.y + 4;

  if (grid) {
    const px = playerPos && playerPos.stratum === currentStratum ? playerPos.x : Math.floor(grid.width / 2);
    const py = playerPos && playerPos.stratum === currentStratum ? playerPos.y : Math.floor(grid.height / 2);

    const originX = Math.max(0, Math.min(grid.width - mapW, px - Math.floor(mapW / 2)));
    const originY = Math.max(0, Math.min(grid.height - mapH, py - Math.floor(mapH / 2)));

    // Collect landmark entities on this stratum
    const gateEntities = Object.values(state.entities).filter(
      (e) => e.districtGate && e.position && e.position.stratum === currentStratum,
    );
    const portalEntities = Object.values(state.entities).filter(
      (e) => e.portal && e.position && e.position.stratum === currentStratum,
    );

    for (let vy = 0; vy < mapH; vy++) {
      for (let vx = 0; vx < mapW; vx++) {
        const gx = originX + vx;
        const gy = originY + vy;
        const screenX = leftX + vx;
        const screenY = mapStartY + vy;

        if (gx >= grid.width || gy >= grid.height) continue;

        // Player origin (always visible on player's current stratum)
        if (playerPos && playerPos.stratum === currentStratum && gx === playerPos.x && gy === playerPos.y) {
          buf.setCell(screenX, screenY, '@', VICTORIAN_PALETTE.AETHER_BLUE, VICTORIAN_PALETTE.OXIDIZED_IRON, ['AETHER_HALATION']);
          continue;
        }

        const tile = grid.cells[gy * grid.width + gx];
        if (!tile) continue;

        // Fog-of-war guard: Unexplored tiles render strictly as empty void ' ' without spoilers
        if (!tile.explored) {
          buf.setCell(screenX, screenY, ' ', VICTORIAN_PALETTE.SOOT_IRON_BG, VICTORIAN_PALETTE.SOOT_IRON_BG);
          continue;
        }

        // District transit gate (only if explored)
        const gate = gateEntities.find((e) => e.position?.x === gx && e.position?.y === gy);
        if (gate) {
          buf.setCell(screenX, screenY, '╬', VICTORIAN_PALETTE.TARNISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG, ['SPARK_GLINT']);
          continue;
        }

        // Stratum portal (stairs, grate, ladder) (only if explored)
        const portal = portalEntities.find((e) => e.position?.x === gx && e.position?.y === gy);
        if (portal && portal.portal && portal.position) {
          const targetLvl = STRATUM_LEVEL[portal.portal.target.stratum] ?? 2;
          const currentLvl = STRATUM_LEVEL[portal.position.stratum] ?? 2;
          const isDown = targetLvl < currentLvl;
          buf.setCell(screenX, screenY, isDown ? '>' : '<', VICTORIAN_PALETTE.AMBER_GASLIGHT, VICTORIAN_PALETTE.SOOT_IRON_BG);
          continue;
        }

        if (tile.blocksMovement) {
          buf.setCell(screenX, screenY, '█', '#323c46', VICTORIAN_PALETTE.SOOT_IRON_BG);
        } else if (tile.liquidType && tile.liquidType !== 'NONE') {
          buf.setCell(screenX, screenY, '~', '#2980b9', VICTORIAN_PALETTE.SOOT_IRON_BG);
        } else if (tile.steamPressureKpa > 20) {
          buf.setCell(screenX, screenY, '░', VICTORIAN_PALETTE.MUTED_PIPE, VICTORIAN_PALETTE.SOOT_IRON_BG);
        } else {
          buf.setCell(screenX, screenY, '·', '#202830', VICTORIAN_PALETTE.SOOT_IRON_BG);
        }
      }
    }
  }

  // Minimap Legend
  const legendY = mapStartY + mapH + 1;
  buf.writeString(leftX, legendY, '@ You ╬ Gate > Down < Up █ Wall · Floor', VICTORIAN_PALETTE.MUTED_PIPE, VICTORIAN_PALETTE.SOOT_IRON_BG);

  // 3. Right Column: District Dossier & Telemetry
  renderAtlasDossierPanel(
    buf,
    rightX,
    rightWidth,
    rect.y,
    state,
    playerPos,
    currentStratum,
  );
}
