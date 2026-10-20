import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { BlueprintIdSchema, EntityId, Point3D } from '../../schemas/primitives.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import { setTileCell } from '../spatial/grid.js';
import { withoutEntity } from './inventory-utils.js';

export interface SystemBoilerResult {
  readonly state: WorldState;
  readonly events: SimEvent[];
  readonly apSpent: number;
}

function isFuelItem(blueprintId: string): boolean {
  return (
    blueprintId === 'item_pressurized_steam_canister' ||
    blueprintId === 'commodity_anthracite_briquette' ||
    blueprintId.includes('coal') ||
    blueprintId.includes('anthracite') ||
    blueprintId.includes('briquette')
  );
}

function findAdjacentBoiler(state: WorldState, actor: EntityRecord): EntityRecord | undefined {
  if (!actor.position) return undefined;
  const { x, y, stratum } = actor.position;
  return Object.values(state.entities).find((e) => {
    if (!e.pressureVessel || e.pressureVessel.ruptured || !e.position) return false;
    if (e.position.stratum !== stratum) return false;
    return Math.max(Math.abs(e.position.x - x), Math.abs(e.position.y - y)) <= 1;
  });
}

export function resolveRefillSteam(
  state: WorldState,
  actorId: EntityId,
  pressureAddedKpa = 50,
  bypassFuelRequirement = false,
): SystemBoilerResult {
  const actor = state.entities[actorId];
  if (!actor || !actor.anatomy) {
    return { state, events: [], apSpent: STANDARD_ACTION_AP };
  }

  const turn = state.turnCount + 1;
  let stokedFromBoiler = false;
  let fuelBlueprintId: string | undefined;
  let effectivePressureAdded = pressureAddedKpa;
  let nextEntities: Record<string, EntityRecord> = state.entities;
  let nextInv = actor.inventory;

  if (!bypassFuelRequirement) {
    const boiler = findAdjacentBoiler(state, actor);
    if (boiler) {
      stokedFromBoiler = true;
    } else {
      const inv = actor.inventory;
      const fuelEntityId = inv?.containedEntityIds.find((id) => {
        const itemEntity = state.entities[id];
        return itemEntity?.item && isFuelItem(itemEntity.item.blueprintId);
      });

      if (!fuelEntityId || !inv) {
        return {
          state,
          events: [
            {
              type: 'STEAM_REFILL_FAILED',
              turn,
              actorId,
              reason: 'No adjacent boiler or fuel canister in inventory.',
            },
          ],
          apSpent: STANDARD_ACTION_AP,
        };
      }

      const fuelItem = state.entities[fuelEntityId]!;
      fuelBlueprintId = fuelItem.item!.blueprintId;
      effectivePressureAdded =
        fuelBlueprintId === 'item_pressurized_steam_canister' ? 60 : 50;

      const remainingQuantity = fuelItem.item!.quantity - 1;
      nextEntities =
        remainingQuantity > 0
          ? {
              ...state.entities,
              [fuelEntityId]: {
                ...fuelItem,
                item: { ...fuelItem.item!, quantity: remainingQuantity },
              },
            }
          : withoutEntity(state.entities, fuelEntityId);

      const nextContained =
        remainingQuantity > 0
          ? inv.containedEntityIds
          : inv.containedEntityIds.filter((id) => id !== fuelEntityId);

      nextInv = {
        ...inv,
        containedEntityIds: nextContained,
        currentMassGrams: Math.max(0, inv.currentMassGrams - fuelItem.item!.massGrams),
      };
    }
  }

  const newReserveKpa = Math.min(
    actor.anatomy.maxSteamReserveKpa,
    actor.anatomy.steamReserveKpa + effectivePressureAdded,
  );

  const updatedActor: EntityRecord = {
    ...actor,
    anatomy: {
      ...actor.anatomy,
      steamReserveKpa: newReserveKpa,
    },
    ...(nextInv ? { inventory: nextInv } : {}),
  };

  return {
    state: {
      ...state,
      entities: {
        ...nextEntities,
        [actorId]: updatedActor,
      },
    },
    apSpent: STANDARD_ACTION_AP,
    events: [
      {
        type: 'STEAM_REFILLED',
        turn,
        actorId,
        newReserveKpa,
        ...(stokedFromBoiler ? { stokedFromBoiler: true } : {}),
        ...(fuelBlueprintId ? { fuelBlueprintId: BlueprintIdSchema.parse(fuelBlueprintId) } : {}),
      },
    ],
  };
}

export function resolveVentSteam(
  state: WorldState,
  actorId: EntityId,
  target: Point3D,
  pressureReleasedKpa: number,
  bypassReserveCheck = false,
): SystemBoilerResult {
  const actor = state.entities[actorId];
  if (!actor) {
    return { state, events: [], apSpent: STANDARD_ACTION_AP };
  }

  const turn = state.turnCount + 1;

  if (!bypassReserveCheck && actor.anatomy && actor.anatomy.steamReserveKpa < 10) {
    return {
      state,
      events: [
        {
          type: 'STEAM_VENT_FAILED',
          turn,
          actorId,
          reason: 'Insufficient steam reserve to vent (minimum 10 kPa required).',
        },
      ],
      apSpent: STANDARD_ACTION_AP,
    };
  }

  let updatedActor = actor;
  if (actor.anatomy) {
    const deducted = Math.min(actor.anatomy.steamReserveKpa, pressureReleasedKpa);
    const newReserve = actor.anatomy.steamReserveKpa - deducted;
    const nextThermal = actor.thermal
      ? { ...actor.thermal, coreHeatPct: Math.max(0, actor.thermal.coreHeatPct - 10) }
      : undefined;

    updatedActor = {
      ...actor,
      anatomy: { ...actor.anatomy, steamReserveKpa: newReserve },
      ...(nextThermal ? { thermal: nextThermal } : {}),
    };
  }

  const targetStratum = state.strata[target.stratum];
  let nextStrata = state.strata;
  if (targetStratum) {
    const updatedGrid = setTileCell(targetStratum, target.x, target.y, (cell) => ({
      ...cell,
      steamPressureKpa: cell.steamPressureKpa + pressureReleasedKpa,
    }));
    nextStrata = { ...state.strata, [target.stratum]: updatedGrid };
  }

  return {
    state: {
      ...state,
      strata: nextStrata,
      entities: {
        ...state.entities,
        [actorId]: updatedActor,
      },
    },
    apSpent: STANDARD_ACTION_AP,
    events: [
      {
        type: 'STEAM_VENTED',
        turn,
        actorId,
        origin: target,
        pressureReleasedKpa,
      },
    ],
  };
}
