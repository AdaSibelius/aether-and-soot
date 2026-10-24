import { EntityId } from '../../schemas/primitives.schema.js';
import { getTileCell, isWithinBounds } from '../spatial/grid.js';
import { isActorFatal } from '../systems/mortality.system.js';
import { WorldState } from './world.js';

/**
 * Validates relational invariants across the world state and entities:
 * 1. All inventory item IDs exist in state.entities without duplicate ownership.
 * 2. Carried inventory items do not retain ground positions.
 * 3. Equipped slots reference valid entities.
 * 4. Installed prosthetics exist, possess prostheticSpec, and are not socketed in multiple limbs.
 * 5. Living actors with positions are within stratum bounds on non-blocking terrain.
 * 6. Defeated NPCs are excised from active actor/AI scheduling.
 *
 * @returns Array of human-readable violation descriptions. Empty if state is 100% valid.
 */
export function validateWorldInvariants(state: Readonly<WorldState>): string[] {
  const violations: string[] = [];
  const inventoryOwnership = new Map<EntityId, string>();
  const prostheticSockets = new Map<EntityId, string>();

  for (const [entityId, entity] of Object.entries(state.entities)) {
    // 1. Inventory & equipment validation
    if (entity.inventory) {
      for (const itemId of entity.inventory.containedEntityIds) {
        const itemEntity = state.entities[itemId];
        if (!itemEntity) {
          violations.push(
            `Inventory of entity '${entityId}' references missing item entity '${itemId}'.`,
          );
        } else {
          // Check for duplicate inventory ownership across actors/containers
          const existingHolder = inventoryOwnership.get(itemId);
          if (existingHolder && existingHolder !== entityId) {
            violations.push(
              `Item entity '${itemId}' has duplicate inventory ownership: contained in '${existingHolder}' and '${entityId}'.`,
            );
          } else {
            inventoryOwnership.set(itemId, entityId);
          }

          // Carried items must not possess a ground position
          if (itemEntity.position !== undefined) {
            violations.push(
              `Item entity '${itemId}' contained in inventory of '${entityId}' must not possess a ground position.`,
            );
          }
        }
      }

      if (entity.inventory.equippedSlots) {
        for (const [slot, equippedId] of Object.entries(entity.inventory.equippedSlots)) {
          if (!state.entities[equippedId]) {
            violations.push(
              `Equipped slot '${slot}' on entity '${entityId}' references missing entity '${equippedId}'.`,
            );
          }
        }
      }
    }

    // 2. Anatomy & installed prosthetics validation
    if (entity.anatomy) {
      for (const [slot, limb] of Object.entries(entity.anatomy.limbs)) {
        if (limb?.installedProstheticEntityId) {
          const pId = limb.installedProstheticEntityId;
          const prostheticEntity = state.entities[pId];

          // Check for duplicate limb socketing
          const existingSocket = prostheticSockets.get(pId);
          if (existingSocket && existingSocket !== `${entityId}.${slot}`) {
            violations.push(
              `Prosthetic entity '${pId}' is socketed in multiple limbs: '${existingSocket}' and '${entityId}.${slot}'.`,
            );
          } else {
            prostheticSockets.set(pId, `${entityId}.${slot}`);
          }

          if (!prostheticEntity) {
            violations.push(
              `Limb '${slot}' on entity '${entityId}' references missing prosthetic entity '${pId}'.`,
            );
          } else {
            if (!prostheticEntity.prostheticSpec) {
              violations.push(
                `Prosthetic entity '${pId}' installed on limb '${slot}' of '${entityId}' lacks a prostheticSpec component.`,
              );
            }
            if (prostheticEntity.position !== undefined) {
              violations.push(
                `Prosthetic entity '${pId}' installed on limb '${slot}' of '${entityId}' must not possess a ground position.`,
              );
            }
            const invHolder = inventoryOwnership.get(pId);
            if (invHolder && invHolder !== entityId) {
              violations.push(
                `Prosthetic entity '${pId}' installed on '${entityId}' is unexpectedly contained in another entity's inventory '${invHolder}'.`,
              );
            }
          }
        }
      }
    }

    // 3. Actor position, bounds, and terrain checks
    if (entity.actor && entity.position) {
      const isDead = isActorFatal(entity);
      if (isDead) {
        if (!entity.actor.isPlayer) {
          violations.push(
            `Dead NPC '${entityId}' with fatal trauma remains in entities with an active actor component.`,
          );
        } else if (entity.actor.energy > 0) {
          violations.push(
            `Dead player '${entityId}' still has active turn energy (${entity.actor.energy}).`,
          );
        }
      } else {
        const grid = state.strata[entity.position.stratum];
        if (!grid) {
          violations.push(
            `Actor '${entityId}' references non-existent stratum '${entity.position.stratum}'.`,
          );
        } else if (!isWithinBounds(grid, entity.position.x, entity.position.y)) {
          violations.push(
            `Actor '${entityId}' at (${entity.position.x}, ${entity.position.y}) is out of bounds for stratum '${entity.position.stratum}' (${grid.width}x${grid.height}).`,
          );
        } else {
          const cell = getTileCell(grid, entity.position.x, entity.position.y);
          if (cell?.blocksMovement) {
            violations.push(
              `Actor '${entityId}' is positioned on blocking terrain '${cell.terrainType}' at (${entity.position.x}, ${entity.position.y}) in stratum '${entity.position.stratum}'.`,
            );
          }
        }
      }
    }

    // 4. Dead AI controller check
    if (entity.aiController && isActorFatal(entity)) {
      violations.push(
        `Dead NPC '${entityId}' still has an active aiController component in state.entities.`,
      );
    }
  }

  return violations;
}

/**
 * Asserts that all world relational invariants hold.
 * Throws a descriptive error listing all violations if any invariant fails.
 */
export function assertWorldInvariants(state: Readonly<WorldState>): void {
  const violations = validateWorldInvariants(state);
  if (violations.length > 0) {
    throw new Error(
      `[assertWorldInvariants] ${violations.length} world invariant violation(s) detected:\n` +
        violations.map((v) => `  - ${v}`).join('\n'),
    );
  }
}
