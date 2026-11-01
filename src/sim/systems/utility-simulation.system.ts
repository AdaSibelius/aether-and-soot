import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId, LiquidTypeId, StratumId } from '../../schemas/primitives.schema.js';
import { StratumGrid } from '../spatial/grid.js';
import { WorldState } from '../core/world.js';

function getWalkableNeighbors(grid: StratumGrid, cx: number, cy: number): { x: number; y: number }[] {
  const result: { x: number; y: number }[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = cx + dx, ny = cy + dy;
      if (nx >= 0 && nx < grid.width && ny >= 0 && ny < grid.height) {
        const c = grid.cells[ny * grid.width + nx];
        if (c && !c.blocksMovement) result.push({ x: nx, y: ny });
      }
    }
  }
  return result.length > 0 ? result : [{ x: cx, y: cy }];
}

function simulateUtilityConduits(
  nextEntities: Record<EntityId, EntityRecord>,
  nextStrata: Record<StratumId, StratumGrid>,
  events: SimEvent[],
  turn: number,
): void {
  for (const ent of Object.values(nextEntities)) {
    if (!ent.utilityConduit) continue;
    const cond = { ...ent.utilityConduit };

    if (cond.operatingPressureKpa > cond.maxPressureKpa) {
      cond.ruptured = true;
      cond.isRuptured = true;
      const vented = cond.operatingPressureKpa;
      cond.operatingPressureKpa = 0;

      if (ent.position) {
        const grid = nextStrata[ent.position.stratum];
        if (grid) {
          const neighbors = getWalkableNeighbors(grid, ent.position.x, ent.position.y);
          const perCell = Math.max(15, Math.round(vented / neighbors.length));
          for (const { x, y } of neighbors) {
            const idx = y * grid.width + x;
            const c = grid.cells[idx];
            if (c) grid.cells[idx] = { ...c, steamPressureKpa: Math.min(100, c.steamPressureKpa + perCell) };
          }
        }
      }

      nextEntities[ent.id] = {
        ...ent,
        visual: { glyph: '*', fgPrimary: '#E74C3C', fgSecondary: '#C0392B', bgColor: '#1A0A0A', shaderFlags: ['PULSE_STEAM'] },
        utilityConduit: cond,
      };

      events.push({
        type: 'CONDUIT_RUPTURED',
        turn,
        conduitEntityId: ent.id,
        networkId: cond.networkId,
        origin: ent.position ?? { x: 0, y: 0, stratum: 'STREET' },
        operatingPressureKpa: vented,
        maxPressureKpa: cond.maxPressureKpa,
        ventedPressureKpa: vented,
      });
    } else if (!cond.ruptured && !cond.isRuptured) {
      for (const epId of cond.connectedEndpointEntityIds) {
        const endpoint = nextEntities[epId];
        if (!endpoint) continue;

        if (endpoint.pressureVessel && !endpoint.pressureVessel.ruptured) {
          if (endpoint.pressureVessel.currentPressureKpa > cond.operatingPressureKpa) {
            const delta = Math.min(25, Math.round((endpoint.pressureVessel.currentPressureKpa - cond.operatingPressureKpa) / 2));
            if (delta > 0) {
              endpoint.pressureVessel = { ...endpoint.pressureVessel, currentPressureKpa: endpoint.pressureVessel.currentPressureKpa - delta };
              cond.operatingPressureKpa += delta;
            }
          }
        } else if (endpoint.utilityConduit && !endpoint.utilityConduit.ruptured && !endpoint.utilityConduit.isRuptured) {
          if (cond.operatingPressureKpa > endpoint.utilityConduit.operatingPressureKpa) {
            const delta = Math.min(20, Math.round((cond.operatingPressureKpa - endpoint.utilityConduit.operatingPressureKpa) / 2));
            if (delta > 0) {
              cond.operatingPressureKpa -= delta;
              endpoint.utilityConduit = { ...endpoint.utilityConduit, operatingPressureKpa: endpoint.utilityConduit.operatingPressureKpa + delta };
            }
          }
        }
      }
      nextEntities[ent.id] = { ...ent, utilityConduit: cond };
    }
  }
}

function simulateCrossStratumShafts(
  nextEntities: Record<EntityId, EntityRecord>,
  nextStrata: Record<StratumId, StratumGrid>,
  events: SimEvent[],
  turn: number,
): void {
  for (const ent of Object.values(nextEntities)) {
    if (!ent.crossStratumShaft || !ent.crossStratumShaft.operational) continue;
    const shaft = ent.crossStratumShaft;
    const upGrid = nextStrata[shaft.upperStratum];
    const lowGrid = nextStrata[shaft.lowerStratum];
    if (!upGrid || !lowGrid) continue;

    const upIdx = shaft.upperCoord.y * upGrid.width + shaft.upperCoord.x;
    const lowIdx = shaft.lowerCoord.y * lowGrid.width + shaft.lowerCoord.x;
    const upCell = upGrid.cells[upIdx];
    const lowCell = lowGrid.cells[lowIdx];

    if (shaft.shaftType === 'SEWER_SIPHON' || shaft.shaftType === 'GRAVITY_CHUTE') {
      const upVol = upCell?.liquidVolumeMl ?? 0;
      if (upCell && upCell.liquidType && upCell.liquidType !== 'NONE' && upVol > 0 && lowCell) {
        const transfer = Math.min(upVol, shaft.flowRateUnitsPerTick * 250);
        const lType = upCell.liquidType;
        const lowVol = lowCell.liquidVolumeMl ?? 0;
        lowGrid.cells[lowIdx] = { ...lowCell, liquidType: lType, liquidVolumeMl: lowVol + transfer };
        const nextUpVol = Math.max(0, upVol - transfer);
        upGrid.cells[upIdx] = { ...upCell, liquidVolumeMl: nextUpVol, liquidType: nextUpVol === 0 ? 'NONE' : lType };
        events.push({ type: 'SHAFT_TRANSPORT_COMPLETED', turn, shaftEntityId: ent.id, shaftType: shaft.shaftType, fromStratum: shaft.upperStratum, toStratum: shaft.lowerStratum, transportKind: 'FLUID', details: `${lType} drainage` });
      }

      if (shaft.shaftType === 'GRAVITY_CHUTE') {
        for (const item of Object.values(nextEntities)) {
          if (item.item && item.position?.stratum === shaft.upperStratum && item.position.x === shaft.upperCoord.x && item.position.y === shaft.upperCoord.y) {
            nextEntities[item.id] = { ...item, position: { x: shaft.lowerCoord.x, y: shaft.lowerCoord.y, stratum: shaft.lowerStratum, blocksMovement: false, blocksSight: false } };
            events.push({ type: 'SHAFT_TRANSPORT_COMPLETED', turn, shaftEntityId: ent.id, shaftType: shaft.shaftType, fromStratum: shaft.upperStratum, toStratum: shaft.lowerStratum, transportKind: 'CARGO', details: item.id });
          }
        }
      }
    } else if (shaft.shaftType === 'STEAM_RISER') {
      if (lowCell && upCell && lowCell.steamPressureKpa > 0) {
        const steamDelta = Math.min(lowCell.steamPressureKpa, shaft.flowRateUnitsPerTick * 20);
        lowGrid.cells[lowIdx] = { ...lowCell, steamPressureKpa: lowCell.steamPressureKpa - steamDelta };
        upGrid.cells[upIdx] = { ...upCell, steamPressureKpa: Math.min(100, upCell.steamPressureKpa + steamDelta) };
        events.push({ type: 'SHAFT_TRANSPORT_COMPLETED', turn, shaftEntityId: ent.id, shaftType: shaft.shaftType, fromStratum: shaft.lowerStratum, toStratum: shaft.upperStratum, transportKind: 'STEAM', details: `${steamDelta} kPa steam` });
      }
    } else if (shaft.shaftType === 'PNEUMATIC_LIFT') {
      for (const item of Object.values(nextEntities)) {
        if (item.item && item.position?.stratum === shaft.lowerStratum && item.position.x === shaft.lowerCoord.x && item.position.y === shaft.lowerCoord.y) {
          nextEntities[item.id] = { ...item, position: { x: shaft.upperCoord.x, y: shaft.upperCoord.y, stratum: shaft.upperStratum, blocksMovement: false, blocksSight: false } };
          events.push({ type: 'SHAFT_TRANSPORT_COMPLETED', turn, shaftEntityId: ent.id, shaftType: shaft.shaftType, fromStratum: shaft.lowerStratum, toStratum: shaft.upperStratum, transportKind: 'CARGO', details: item.id });
        }
      }
    }
  }
}

function simulateHydrologyChannels(
  nextEntities: Record<EntityId, EntityRecord>,
  nextStrata: Record<StratumId, StratumGrid>,
  events: SimEvent[],
  turn: number,
): void {
  for (const ent of Object.values(nextEntities)) {
    if (!ent.hydrologyChannel || !ent.position) continue;
    const chan = { ...ent.hydrologyChannel };
    const grid = nextStrata[ent.position.stratum];
    if (!grid) continue;

    const idx = ent.position.y * grid.width + ent.position.x;
    const cell = grid.cells[idx];
    if (!cell) continue;

    const cellVol = cell.liquidVolumeMl ?? 0;
    if (chan.sluiceOpen) {
      if (cell.liquidType && cell.liquidType !== 'NONE' && cellVol > 0) {
        const drain = Math.min(cellVol, chan.maxFlowRateMlPerTick);
        const lType = cell.liquidType;
        const nextVol = Math.max(0, cellVol - drain);
        grid.cells[idx] = { ...cell, liquidVolumeMl: nextVol, liquidType: nextVol === 0 ? 'NONE' : lType };

        if (chan.drainsIntoStratum) {
          const drainGrid = nextStrata[chan.drainsIntoStratum];
          if (drainGrid) {
            const dIdx = ent.position.y * drainGrid.width + ent.position.x;
            const dCell = drainGrid.cells[dIdx];
            if (dCell) {
              const dVol = dCell.liquidVolumeMl ?? 0;
              drainGrid.cells[dIdx] = { ...dCell, liquidType: lType, liquidVolumeMl: dVol + drain };
            }
          }
        }

        events.push({ type: 'HYDROLOGY_DRAINED', turn, channelEntityId: ent.id, at: ent.position, fluidType: chan.fluidType, volumeDrainedMl: drain, drainedIntoStratum: chan.drainsIntoStratum });
      }
    } else {
      const newVol = chan.currentVolumeMl + chan.maxFlowRateMlPerTick;
      const maxCapacity = 30000;
      if (newVol > maxCapacity) {
        chan.currentVolumeMl = maxCapacity;
        const mappedLiquid: LiquidTypeId = chan.fluidType === 'ACID' ? 'NITRIC_ACID' : chan.fluidType === 'WHALE_OIL' ? 'WHALE_OIL' : 'SLUICE_SLUDGE';
        const neighbors = getWalkableNeighbors(grid, ent.position.x, ent.position.y);
        for (const { x, y } of neighbors) {
          const fIdx = y * grid.width + x;
          const fc = grid.cells[fIdx];
          if (fc) {
            const fVol = fc.liquidVolumeMl ?? 0;
            grid.cells[fIdx] = { ...fc, liquidType: mappedLiquid, liquidVolumeMl: Math.min(1000, fVol + 500) };
          }
        }
        nextEntities[ent.id] = { ...ent, visual: { ...ent.visual, glyph: '■', fgPrimary: '#C0392B', shaderFlags: ['PULSE_STEAM'] }, hydrologyChannel: chan };
        events.push({ type: 'HYDROLOGY_FLOODING', turn, channelEntityId: ent.id, at: ent.position, fluidType: chan.fluidType, volumeOverflowMl: newVol - maxCapacity });
      } else {
        chan.currentVolumeMl = newVol;
        nextEntities[ent.id] = { ...ent, hydrologyChannel: chan };
      }
    }
  }
}

export function advanceUtilityConduitTick(state: WorldState): { state: WorldState; events: SimEvent[] } {
  const nextEntities = { ...state.entities };
  const nextStrata = Object.fromEntries(
    Object.entries(state.strata).map(([k, g]) => [k, { ...g, cells: [...g.cells] }])
  ) as Record<StratumId, StratumGrid>;
  const events: SimEvent[] = [];
  const turn = state.turnCount + 1;

  simulateUtilityConduits(nextEntities, nextStrata, events, turn);
  simulateCrossStratumShafts(nextEntities, nextStrata, events, turn);
  simulateHydrologyChannels(nextEntities, nextStrata, events, turn);

  return {
    state: { ...state, entities: nextEntities, strata: nextStrata },
    events,
  };
}
