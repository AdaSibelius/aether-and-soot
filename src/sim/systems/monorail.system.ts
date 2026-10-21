import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { BlueprintId, EntityId, EntityIdSchema, Point3D } from '../../schemas/primitives.schema.js';
import { WorldState } from '../core/world.js';
import { transferMonorailDistrict } from './monorail-transit.js';
import { VALID_DISTRICT_IDS } from './transit.system.js';

export interface MonorailResolutionResult {
  readonly state: WorldState;
  readonly events: SimEvent[];
  readonly apSpent: number;
}

export function createMonorailCarEntity(
  carId: string,
  stationPos: Point3D,
  destinationDistrictId: BlueprintId,
  steamPressureKpa = 60,
): EntityRecord {
  const entityId = EntityIdSchema.parse(carId);
  return {
    id: entityId,
    name: 'Derelict Pneumatic Monorail Car',
    visual: { glyph: '#', fgPrimary: '#E59866', fgSecondary: '#BA4A00', bgColor: '#1C2833', shaderFlags: ['PULSE_STEAM'] },
    position: { ...stationPos, blocksMovement: true, blocksSight: false },
    monorailCar: {
      carId,
      destinationDistrictId,
      steamPressureKpa,
      speedMph: Math.round(steamPressureKpa * 0.75),
      occupiedByActorIds: [],
    },
  };
}

export function resolveBoardMonorail(
  state: WorldState,
  actorId: EntityId,
  monorailEntityId: EntityId,
): MonorailResolutionResult {
  const actor = state.entities[actorId];
  const monorail = state.entities[monorailEntityId];
  const turn = state.turnCount + 1;

  if (!actor || !actor.position || !monorail || !monorail.position || !monorail.monorailCar) {
    return {
      state,
      events: [{ type: 'MONORAIL_ACTION_FAILED', turn, actorId, reason: 'INVALID_MONORAIL_TARGET' }],
      apSpent: 0,
    };
  }

  const occupants = [...monorail.monorailCar.occupiedByActorIds];
  const isBoarded = occupants.includes(actorId);

  if (isBoarded) {
    const updatedOccupants = occupants.filter((id) => id !== actorId);
    const updatedMonorail: EntityRecord = {
      ...monorail,
      monorailCar: { ...monorail.monorailCar, occupiedByActorIds: updatedOccupants },
    };
    const updatedActor: EntityRecord = {
      ...actor,
      position: {
        x: Math.max(0, monorail.position.x + 1),
        y: monorail.position.y,
        stratum: monorail.position.stratum,
        blocksMovement: true,
        blocksSight: false,
      },
    };
    return {
      state: {
        ...state,
        turnCount: turn,
        entities: { ...state.entities, [monorailEntityId]: updatedMonorail, [actorId]: updatedActor },
      },
      events: [{ type: 'MONORAIL_BOARDED', turn, actorId, monorailEntityId, passengersCount: updatedOccupants.length }],
      apSpent: 50,
    };
  }

  const dist = Math.max(Math.abs(actor.position.x - monorail.position.x), Math.abs(actor.position.y - monorail.position.y));
  if (dist > 1 || actor.position.stratum !== monorail.position.stratum) {
    return {
      state,
      events: [{ type: 'MONORAIL_ACTION_FAILED', turn, actorId, reason: 'OUT_OF_RANGE' }],
      apSpent: 0,
    };
  }

  const updatedOccupants = [...occupants, actorId];
  const updatedMonorail: EntityRecord = {
    ...monorail,
    monorailCar: { ...monorail.monorailCar, occupiedByActorIds: updatedOccupants },
  };
  const updatedActor: EntityRecord = {
    ...actor,
    position: {
      x: monorail.position.x,
      y: monorail.position.y,
      stratum: monorail.position.stratum,
      blocksMovement: false,
      blocksSight: false,
    },
  };

  return {
    state: {
      ...state,
      turnCount: turn,
      entities: { ...state.entities, [monorailEntityId]: updatedMonorail, [actorId]: updatedActor },
    },
    events: [{ type: 'MONORAIL_BOARDED', turn, actorId, monorailEntityId, passengersCount: updatedOccupants.length }],
    apSpent: 50,
  };
}

export function resolveLaunchMonorail(
  state: WorldState,
  actorId: EntityId,
  monorailEntityId: EntityId,
  destinationDistrictId: BlueprintId,
): MonorailResolutionResult {
  const actor = state.entities[actorId];
  const monorail = state.entities[monorailEntityId];
  const turn = state.turnCount + 1;

  if (!actor || !monorail || !monorail.monorailCar) {
    return { state, events: [{ type: 'MONORAIL_ACTION_FAILED', turn, actorId, reason: 'NOT_A_MONORAIL' }], apSpent: 0 };
  }

  const car = monorail.monorailCar;
  if (!car.occupiedByActorIds.includes(actorId)) {
    return { state, events: [{ type: 'MONORAIL_ACTION_FAILED', turn, actorId, reason: 'ACTOR_NOT_BOARDED' }], apSpent: 0 };
  }

  if (destinationDistrictId === state.currentDistrictId) {
    return { state, events: [{ type: 'MONORAIL_ACTION_FAILED', turn, actorId, reason: 'ALREADY_IN_DISTRICT' }], apSpent: 0 };
  }

  if (!VALID_DISTRICT_IDS.has(destinationDistrictId)) {
    return { state, events: [{ type: 'MONORAIL_ACTION_FAILED', turn, actorId, reason: 'UNKNOWN_DISTRICT' }], apSpent: 0 };
  }

  if (car.steamPressureKpa < 15) {
    return { state, events: [{ type: 'MONORAIL_ACTION_FAILED', turn, actorId, reason: 'INSUFFICIENT_STEAM_PRESSURE' }], apSpent: 0 };
  }

  const speedMph = Math.round(car.steamPressureKpa * 0.75);
  const nextSteamKpa = Math.max(0, car.steamPressureKpa - 15);

  const { nextStrata, nextEntities, arrivalPos, updatedSavedDistricts } = transferMonorailDistrict(
    state,
    monorailEntityId,
    destinationDistrictId,
    car.occupiedByActorIds,
  );

  nextEntities[monorailEntityId] = {
    ...monorail,
    position: arrivalPos,
    monorailCar: {
      ...car,
      steamPressureKpa: nextSteamKpa,
      speedMph: Math.round(nextSteamKpa * 0.75),
    },
  };

  for (const passengerId of car.occupiedByActorIds) {
    const passenger = nextEntities[passengerId];
    if (passenger) {
      nextEntities[passengerId] = {
        ...passenger,
        position: { ...arrivalPos, blocksMovement: true, blocksSight: false },
      };
    }
  }

  const events: SimEvent[] = [
    {
      type: 'MONORAIL_LAUNCHED',
      turn,
      actorId,
      monorailEntityId,
      destinationDistrictId,
      speedMph,
      steamPressureKpa: car.steamPressureKpa,
    },
    {
      type: 'MONORAIL_ARRIVED',
      turn,
      monorailEntityId,
      destinationDistrictId,
      passengers: car.occupiedByActorIds,
    },
  ];

  return {
    state: {
      ...state,
      turnCount: turn,
      currentDistrictId: destinationDistrictId,
      strata: nextStrata,
      entities: nextEntities,
      savedDistricts: updatedSavedDistricts,
    },
    events,
    apSpent: 100,
  };
}
