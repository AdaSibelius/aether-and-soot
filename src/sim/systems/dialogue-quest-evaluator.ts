import { FactionContract } from '../../schemas/contracts.schema.js';
import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../core/world.js';
import { withoutEntity } from './inventory-utils.js';

export interface ContractCompletionCheckResult {
  readonly success: boolean;
  readonly failureReason?: string;
  readonly nextEntities?: Record<string, EntityRecord>;
}

export function evaluateContractFulfillment(
  state: WorldState,
  actorId: EntityId,
  actor: EntityRecord,
  contract: FactionContract,
): ContractCompletionCheckResult {
  let nextEntities = { ...state.entities };
  let nextContained = [...actor.inventory!.containedEntityIds];

  if (contract.kind === 'DELIVER_ITEM') {
    const itemEntry = nextContained
      .map((id) => nextEntities[id])
      .find((e) => e?.item?.blueprintId === contract.targetBlueprintOrEntityId);

    if (!itemEntry?.item) {
      return { success: false, failureReason: 'ITEM_REQUIREMENT_UNMET' };
    }

    if (itemEntry.item.quantity > 1) {
      nextEntities[itemEntry.id] = {
        ...itemEntry,
        item: { ...itemEntry.item, quantity: itemEntry.item.quantity - 1 },
      };
    } else {
      nextEntities = withoutEntity(nextEntities, itemEntry.id);
      nextContained = nextContained.filter((id) => id !== itemEntry.id);
    }

    nextEntities[actorId] = {
      ...actor,
      inventory: { ...actor.inventory!, containedEntityIds: nextContained },
    };
  } else if (contract.kind === 'SLAY_HOSTILE') {
    const target = nextEntities[contract.targetBlueprintOrEntityId];
    if (target && target.actor && !target.anatomy?.limbs.TORSO?.amputated) {
      return { success: false, failureReason: 'TARGET_STILL_ALIVE' };
    }
  } else if (contract.kind === 'PRESSURIZE_BOILER') {
    const target = nextEntities[contract.targetBlueprintOrEntityId];
    const isPressurized = Boolean(
      target?.pressureVessel?.ruptured || (target?.pressureVessel?.currentPressureKpa ?? 0) >= 260,
    );
    if (!isPressurized) {
      return { success: false, failureReason: 'BOILER_NOT_PRESSURIZED' };
    }
  }

  return { success: true, nextEntities };
}
