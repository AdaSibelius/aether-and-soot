import { EntityRecord, InventoryComponent } from '../../schemas/components.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../core/world.js';
import {
  computeCarriedVolumeMl,
  findMergeableStack,
  getCarryProfile,
  MAX_OVERLOAD_RATIO,
  withoutEntity,
} from './inventory-utils.js';

export interface ContainerTransferResult {
  readonly success: boolean;
  readonly failureReason?: 'VOLUME_EXCEEDED' | 'MASS_EXCEEDED' | 'CONTAINER_EMPTY';
  readonly nextEntities: Record<string, EntityRecord>;
  readonly currentContained: EntityId[];
  readonly currentMass: number;
  readonly remainingContainerIds: EntityId[];
  readonly lootedItemIds: EntityId[];
  readonly penceGained: number;
}

export function executeContainerItemTransfer(
  state: WorldState,
  actor: EntityRecord,
  containerInv: InventoryComponent,
  targetIds: readonly EntityId[],
): ContainerTransferResult {
  let nextEntities: Record<string, EntityRecord> = { ...state.entities };
  let currentContained = [...actor.inventory!.containedEntityIds];
  let currentMass = actor.inventory!.currentMassGrams;
  let remainingContainerIds = [...containerInv.containedEntityIds];
  const lootedItemIds: EntityId[] = [];
  let penceGained = 0;

  for (const tid of targetIds) {
    const itemEntity = nextEntities[tid];
    if (!itemEntity?.item) continue;

    const itemPence = itemEntity.item.penceValue ?? 0;
    if (itemPence > 0) {
      penceGained += itemPence * (itemEntity.item.quantity ?? 1);
      nextEntities = withoutEntity(nextEntities, tid);
      remainingContainerIds = remainingContainerIds.filter((id) => id !== tid);
      lootedItemIds.push(tid);
      continue;
    }

    const profile = getCarryProfile(itemEntity);
    if (!profile) continue;

    const workingInv: InventoryComponent = {
      ...actor.inventory!,
      containedEntityIds: currentContained,
      currentMassGrams: currentMass,
    };
    const workingState: WorldState = { ...state, entities: nextEntities };

    if (computeCarriedVolumeMl(workingState, workingInv) + profile.volumeMl > actor.inventory!.maxVolumeMl) {
      if (lootedItemIds.length === 0 && penceGained === 0) {
        return {
          success: false,
          failureReason: 'VOLUME_EXCEEDED',
          nextEntities,
          currentContained,
          currentMass,
          remainingContainerIds,
          lootedItemIds,
          penceGained,
        };
      }
      break;
    }

    if (currentMass + profile.massGrams > actor.inventory!.maxMassGrams * MAX_OVERLOAD_RATIO) {
      if (lootedItemIds.length === 0 && penceGained === 0) {
        return {
          success: false,
          failureReason: 'MASS_EXCEEDED',
          nextEntities,
          currentContained,
          currentMass,
          remainingContainerIds,
          lootedItemIds,
          penceGained,
        };
      }
      break;
    }

    remainingContainerIds = remainingContainerIds.filter((id) => id !== tid);
    const stack = findMergeableStack(workingState, workingInv, itemEntity);
    if (stack?.item) {
      nextEntities = withoutEntity(nextEntities, tid);
      nextEntities[stack.id] = {
        ...stack,
        item: { ...stack.item, quantity: stack.item.quantity + itemEntity.item.quantity },
      };
      currentMass += profile.massGrams;
    } else {
      currentContained.push(tid);
      currentMass += profile.massGrams;
    }
    lootedItemIds.push(tid);
  }

  if (lootedItemIds.length === 0 && penceGained === 0) {
    return {
      success: false,
      failureReason: 'CONTAINER_EMPTY',
      nextEntities,
      currentContained,
      currentMass,
      remainingContainerIds,
      lootedItemIds,
      penceGained,
    };
  }

  return {
    success: true,
    nextEntities,
    currentContained,
    currentMass,
    remainingContainerIds,
    lootedItemIds,
    penceGained,
  };
}
