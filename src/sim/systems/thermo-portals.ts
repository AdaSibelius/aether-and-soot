import { EntityRecord } from '../../schemas/components.schema.js';
import { StratumId } from '../../schemas/primitives.schema.js';
import { getTileCell, setTileCell, StratumGrid } from '../spatial/grid.js';

export const STRATUM_ELEVATION: Record<StratumId, number> = {
  CATACOMBS: -1,
  UNDERCROFT: 0,
  STREET: 1,
  SPIRE: 2,
};

/**
 * Transfers upward rising steam and downward draining liquids/coal dust across portals.
 */
export function transferPortalAtmospherics(
  nextStrata: Record<string, StratumGrid>,
  entities: Record<string, EntityRecord>,
): void {
  for (const entity of Object.values(entities)) {
    const pos = entity.position;
    const portal = entity.portal;
    if (!pos || !portal) continue;

    const fromElev = STRATUM_ELEVATION[pos.stratum];
    const toElev = STRATUM_ELEVATION[portal.target.stratum];
    const sourceGrid = nextStrata[pos.stratum];
    const targetGrid = nextStrata[portal.target.stratum];
    if (!sourceGrid || !targetGrid || fromElev === undefined || toElev === undefined) continue;

    const sourceCell = getTileCell(sourceGrid, pos.x, pos.y);
    if (!sourceCell) continue;

    // Upward transfer: Rising superheated steam
    if (toElev > fromElev && portal.conductsGas) {
      if (sourceCell.steamPressureKpa > 1) {
        const transferred = Math.round(sourceCell.steamPressureKpa * 0.3 * 100) / 100;
        nextStrata[pos.stratum] = setTileCell(nextStrata[pos.stratum]!, pos.x, pos.y, (c) => ({
          ...c,
          steamPressureKpa: Math.max(0, c.steamPressureKpa - transferred),
        }));
        nextStrata[portal.target.stratum] = setTileCell(
          nextStrata[portal.target.stratum]!,
          portal.target.x,
          portal.target.y,
          (c) => ({
            ...c,
            steamPressureKpa: c.steamPressureKpa + transferred,
          }),
        );
      }
    }

    // Downward transfer: Liquid drainage and coal dust atmospheric bleeding
    if (toElev < fromElev) {
      // Downward liquid drainage
      if (portal.conductsLiquid && (sourceCell.liquidVolumeMl ?? 0) > 0 && sourceCell.liquidType && sourceCell.liquidType !== 'NONE') {
        const lType = sourceCell.liquidType;
        const curVol = sourceCell.liquidVolumeMl ?? 0;
        const drained = Math.min(curVol, Math.max(10, Math.round(curVol * 0.4)));

        nextStrata[pos.stratum] = setTileCell(nextStrata[pos.stratum]!, pos.x, pos.y, (c) => ({
          ...c,
          liquidVolumeMl: Math.max(0, (c.liquidVolumeMl ?? 0) - drained),
          liquidType: (c.liquidVolumeMl ?? 0) - drained <= 0 ? 'NONE' : c.liquidType,
        }));

        nextStrata[portal.target.stratum] = setTileCell(
          nextStrata[portal.target.stratum]!,
          portal.target.x,
          portal.target.y,
          (c) => {
            const destVol = c.liquidVolumeMl ?? 0;
            const destType = (!c.liquidType || c.liquidType === 'NONE') ? lType : (drained > destVol ? lType : c.liquidType);
            return {
              ...c,
              liquidType: destType,
              liquidVolumeMl: destVol + drained,
            };
          },
        );
      }

      // Downward coal dust settling / bleeding
      if (portal.conductsGas && sourceCell.coalDustDensity > 0.05) {
        const transferredDust = Math.round(sourceCell.coalDustDensity * 0.3 * 1000) / 1000;
        nextStrata[pos.stratum] = setTileCell(nextStrata[pos.stratum]!, pos.x, pos.y, (c) => ({
          ...c,
          coalDustDensity: Math.max(0, Math.round((c.coalDustDensity - transferredDust) * 1000) / 1000),
        }));
        nextStrata[portal.target.stratum] = setTileCell(
          nextStrata[portal.target.stratum]!,
          portal.target.x,
          portal.target.y,
          (c) => ({
            ...c,
            coalDustDensity: Math.min(1, Math.round((c.coalDustDensity + transferredDust) * 1000) / 1000),
          }),
        );
      }
    }
  }
}
