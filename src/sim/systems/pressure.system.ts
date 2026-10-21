import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import { getTileCell, setTileCell } from '../spatial/grid.js';
import { resolveDamageLimb } from './anatomy.system.js';
import { resolveTriggerSupplyShock } from './economy.system.js';
import { resolveActorDefeatIfFatal } from './mortality.system.js';
import { emitAcousticPulse } from './stealth-acoustics.system.js';
import { resolveBreachTile } from './physics-traps.system.js';

export interface SystemPressureResult {
  readonly state: WorldState;
  readonly events: SimEvent[];
  readonly apSpent: number;
}

export function resolvePressurizeVessel(
  state: WorldState,
  vesselEntityId: EntityId,
  pressureAddedKpa: number,
): SystemPressureResult {
  const vessel = state.entities[vesselEntityId];
  if (!vessel || !vessel.pressureVessel || !vessel.position) {
    return { state, events: [], apSpent: STANDARD_ACTION_AP };
  }

  const nextPressure = vessel.pressureVessel.currentPressureKpa + pressureAddedKpa;
  const turn = state.turnCount + 1;

  if (nextPressure <= vessel.pressureVessel.maxPressureKpa && !vessel.pressureVessel.ruptured) {
    const updatedVessel: EntityRecord = {
      ...vessel,
      pressureVessel: {
        ...vessel.pressureVessel,
        currentPressureKpa: nextPressure,
      },
    };
    return {
      state: {
        ...state,
        entities: { ...state.entities, [vesselEntityId]: updatedVessel },
      },
      events: [],
      apSpent: STANDARD_ACTION_AP,
    };
  }

  // Rupture! Vent all pressure into origin and cardinal neighbor tiles
  const origin = vessel.position;
  const grid = state.strata[origin.stratum];
  let updatedGrid = grid;
  const blastEvents: SimEvent[] = [];

  const points = [
    { x: origin.x, y: origin.y, share: 0.4 },
    { x: origin.x + 1, y: origin.y, share: 0.15 },
    { x: origin.x - 1, y: origin.y, share: 0.15 },
    { x: origin.x, y: origin.y + 1, share: 0.15 },
    { x: origin.x, y: origin.y - 1, share: 0.15 },
  ];

  if (updatedGrid) {
    for (const pt of points) {
      const cell = getTileCell(updatedGrid, pt.x, pt.y);
      if (cell?.terrainType === 'SOOT_BRICK_WALL') {
        const breachRes = resolveBreachTile(
          { ...state, strata: { ...state.strata, [origin.stratum]: updatedGrid } },
          { x: pt.x, y: pt.y, stratum: origin.stratum },
          turn,
          'EXPLOSION',
        );
        if (breachRes.breached) {
          updatedGrid = breachRes.state.strata[origin.stratum]!;
          blastEvents.push(...breachRes.events);
        }
      }
      const updatedCell = getTileCell(updatedGrid, pt.x, pt.y);
      if (updatedCell && !updatedCell.blocksMovement) {
        updatedGrid = setTileCell(updatedGrid, pt.x, pt.y, (c) => ({
          ...c,
          steamPressureKpa: c.steamPressureKpa + Math.round(nextPressure * pt.share),
        }));
      }
    }
  }

  const rupturedVessel: EntityRecord = {
    ...vessel,
    position: {
      ...origin,
      blocksMovement: false,
    },
    pressureVessel: {
      ...vessel.pressureVessel,
      currentPressureKpa: 0,
      ruptured: true,
    },
  };

  const rupturedState: WorldState = {
    ...state,
    strata: updatedGrid ? { ...state.strata, [origin.stratum]: updatedGrid } : state.strata,
    entities: { ...state.entities, [vesselEntityId]: rupturedVessel },
  };

  const shockRes = resolveTriggerSupplyShock(
    rupturedState,
    'ANTHRACITE_COAL',
    -60,
    'IRONMONGERS_CARTEL',
    -15,
  );

  let workingState = shockRes.state;

  for (const pt of points) {
    const victims = Object.values(workingState.entities).filter(
      (e) =>
        e.actor &&
        e.anatomy &&
        e.position &&
        e.position.stratum === origin.stratum &&
        e.position.x === pt.x &&
        e.position.y === pt.y,
    );
    for (const victim of victims) {
      const blastDmg = Math.max(3, Math.floor((nextPressure * pt.share) / 20));
      const dmgRes = resolveDamageLimb(workingState, victim.id, 'TORSO', blastDmg);
      workingState = dmgRes.state;
      blastEvents.push(...dmgRes.events);

      const defeatRes = resolveActorDefeatIfFatal(workingState, victim.id);
      workingState = defeatRes.state;
      blastEvents.push(...defeatRes.events);
    }
  }

  const ruptureNoise = emitAcousticPulse(workingState, origin, 120, turn);
  workingState = ruptureNoise.state;
  blastEvents.push(...ruptureNoise.events);

  return {
    state: workingState,
    apSpent: STANDARD_ACTION_AP,
    events: [
      {
        type: 'VESSEL_RUPTURED',
        turn,
        vesselEntityId,
        origin: { x: origin.x, y: origin.y, stratum: origin.stratum },
        releasedPressureKpa: nextPressure,
      },
      ...shockRes.events,
      ...blastEvents,
    ],
  };
}

export { resolveEmitSpark, COAL_DUST_IGNITION_THRESHOLD } from './pyrotechnics.system.js';
