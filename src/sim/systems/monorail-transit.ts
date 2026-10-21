import { EntityRecord, PositionComponent } from '../../schemas/components.schema.js';
import { BlueprintId, EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../core/world.js';
import { generateVictorianDistrict } from '../spatial/generator.js';
import { catchUpDistrictState } from './district-catchup.system.js';
import { spawnDistrictNpcs } from './district-spawner.js';
import { spawnDistrictItems } from './item-spawner.js';

export interface MonorailTransitResult {
  readonly nextStrata: WorldState['strata'];
  readonly nextEntities: Record<string, EntityRecord>;
  readonly arrivalPos: PositionComponent;
  readonly updatedSavedDistricts: WorldState['savedDistricts'];
}

export function transferMonorailDistrict(
  state: WorldState,
  monorailEntityId: EntityId,
  destinationDistrictId: BlueprintId,
  passengerIds: readonly EntityId[],
): MonorailTransitResult {
  const fromDistrictId = state.currentDistrictId;
  const monorail = state.entities[monorailEntityId]!;

  const preservedEntities: Record<string, EntityRecord> = { [monorailEntityId]: monorail };
  for (const pid of passengerIds) {
    const passenger = state.entities[pid];
    if (passenger) {
      preservedEntities[pid] = passenger;
      for (const invId of passenger.inventory?.containedEntityIds ?? []) {
        const item = state.entities[invId];
        if (item) preservedEntities[invId] = item;
      }
      for (const limb of Object.values(passenger.anatomy?.limbs ?? {})) {
        if (limb.installedProstheticEntityId) {
          const p = state.entities[limb.installedProstheticEntityId];
          if (p) preservedEntities[limb.installedProstheticEntityId] = p;
        }
      }
    }
  }

  const leavingEntities: Record<string, EntityRecord> = {};
  for (const [id, ent] of Object.entries(state.entities)) {
    if (!preservedEntities[id]) {
      leavingEntities[id] = ent;
    }
  }

  const streetGrid = state.strata.STREET ?? state.strata.UNDERCROFT!;
  const undercroftGrid = state.strata.UNDERCROFT ?? streetGrid;
  const spireGrid = state.strata.SPIRE ?? streetGrid;

  const updatedSavedDistricts: WorldState['savedDistricts'] = {
    ...state.savedDistricts,
    [fromDistrictId]: {
      strata: {
        UNDERCROFT: undercroftGrid,
        STREET: streetGrid,
        SPIRE: spireGrid,
      },
      entities: leavingEntities,
      lastSimulatedTurn: state.turnCount,
    },
  };

  const cachedTarget = updatedSavedDistricts[destinationDistrictId];
  let nextStrata: WorldState['strata'];
  let nextEntities: Record<string, EntityRecord>;
  let arrivalPos: PositionComponent;

  if (cachedTarget) {
    const caughtUp = catchUpDistrictState(cachedTarget, state.turnCount);
    nextStrata = caughtUp.strata;
    nextEntities = { ...caughtUp.entities, ...preservedEntities };
    const streetGrid = nextStrata.STREET;
    arrivalPos = {
      x: streetGrid ? Math.floor(streetGrid.width / 2) : 12,
      y: streetGrid ? Math.floor(streetGrid.height / 2) : 10,
      stratum: 'STREET',
      blocksMovement: true,
      blocksSight: false,
    };
  } else {
    const genResult = generateVictorianDistrict({
      ...state,
      currentDistrictId: destinationDistrictId,
      entities: preservedEntities,
    });
    const withItems = spawnDistrictItems(genResult.state);
    const withNpcs = spawnDistrictNpcs(withItems.state);
    nextStrata = withNpcs.state.strata;
    nextEntities = withNpcs.state.entities;
    arrivalPos = {
      x: genResult.landmarks.streetManhole.x,
      y: genResult.landmarks.streetManhole.y,
      stratum: 'STREET',
      blocksMovement: true,
      blocksSight: false,
    };
  }

  return { nextStrata, nextEntities, arrivalPos, updatedSavedDistricts };
}
