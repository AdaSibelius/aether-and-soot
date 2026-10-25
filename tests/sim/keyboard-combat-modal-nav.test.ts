import { describe, expect, it, vi } from 'vitest';
import { GameCommand } from '../../src/schemas/commands.schema.js';
import { BlueprintIdSchema, EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { createDefaultNpcAnatomy } from '../../src/sim/systems/district-spawner.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { handleGameKeydown } from '../../src/client/input/keyboard-router.js';

describe('Phase UI-3: Direct Keyboard Combat & Modal Navigation', () => {
  const playerId = EntityIdSchema.parse('actor_player');
  const enemyId = EntityIdSchema.parse('actor_sewer_lurker');

  function setupWorldWithAdjacentEnemy() {
    const world = createInitialWorld({ seed: 42, width: 24, height: 24 });
    const p = world.entities[playerId]?.position;
    if (!p) throw new Error('Missing player');

    // Place hostile enemy directly to the east of player
    world.entities[enemyId] = {
      id: enemyId,
      name: 'Feral Sewer Lurker',
      visual: { glyph: 'r', fgPrimary: '#ec7063', fgSecondary: '#c0392b', bgColor: '#0a0d0e', shaderFlags: [] },
      position: { x: p.x + 1, y: p.y, stratum: p.stratum, blocksMovement: true, blocksSight: false },
      actor: { energy: 100, speed: 100, isPlayer: false },
      aiController: { factionId: 'UNDERCROFT_SYNDICATE', role: 'SCAVENGER', hostile: true, alertState: 'IDLE' },
      anatomy: createDefaultNpcAnatomy(35, 20),
    };
    return world;
  }

  it('triggers bump-to-attack (TORSO) when moving into an adjacent hostile enemy', () => {
    const world = setupWorldWithAdjacentEnemy();
    const dispatched: GameCommand[] = [];

    handleGameKeydown(
      { key: 'd', preventDefault: vi.fn() } as unknown as KeyboardEvent,
      {
        playerId,
        isSystemMenuOpen: false,
        activeModal: null,
        isLookModeActive: false,
        worldState: world,
        onToggleSystemMenu: vi.fn(),
        onCloseModal: vi.fn(),
        onCycleModal: vi.fn(),
        onSetModal: vi.fn(),
        onToggleLookMode: vi.fn(),
        onMoveLookCursor: vi.fn(),
        onLookAttack: vi.fn(),
        onLookInteract: vi.fn(),
        onCommand: (cmd) => dispatched.push(cmd),
      },
    );

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toEqual({
      type: 'ATTACK_ACTOR',
      attackerId: playerId,
      targetId: enemyId,
      targetSlot: 'TORSO',
    });
  });

  it('strikes specific limb when pressing 1-6 or F against adjacent hostile without entering look mode', () => {
    const world = setupWorldWithAdjacentEnemy();
    const dispatched: GameCommand[] = [];

    // Press '1' for HEAD
    handleGameKeydown(
      { key: '1', preventDefault: vi.fn() } as unknown as KeyboardEvent,
      {
        playerId,
        isSystemMenuOpen: false,
        activeModal: null,
        isLookModeActive: false,
        worldState: world,
        onToggleSystemMenu: vi.fn(),
        onCloseModal: vi.fn(),
        onCycleModal: vi.fn(),
        onSetModal: vi.fn(),
        onToggleLookMode: vi.fn(),
        onMoveLookCursor: vi.fn(),
        onLookAttack: vi.fn(),
        onLookInteract: vi.fn(),
        onCommand: (cmd) => dispatched.push(cmd),
      },
    );

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toEqual({
      type: 'ATTACK_ACTOR',
      attackerId: playerId,
      targetId: enemyId,
      targetSlot: 'HEAD',
    });
  });

  it('routes list navigation and item consumption in active modal via keyboard', () => {
    const world = createInitialWorld({ seed: 101, width: 20, height: 20 });
    const tonicId = EntityIdSchema.parse('item_tonic');
    world.entities[tonicId] = {
      id: tonicId,
      name: 'Dr. Halloway Sanguine Tonic',
      visual: { glyph: '!', fgPrimary: '#e74c3c', fgSecondary: '#c0392b', bgColor: '#0a0d0e', shaderFlags: [] },
      item: { blueprintId: BlueprintIdSchema.parse('item_sanguine_coagulant_injector'), category: 'CONSUMABLE', massGrams: 200, volumeMl: 250, quantity: 1, stackable: true },
    };
    world.entities[playerId]!.inventory = {
      containedEntityIds: [tonicId],
      maxMassGrams: 30000,
      currentMassGrams: 200,
      maxVolumeMl: 40000,
      equippedSlots: {},
    };

    const dispatched: GameCommand[] = [];
    const modalNavState = { selectedIndex: 0 };

    // Press Enter to consume selected item
    handleGameKeydown(
      { key: 'Enter', preventDefault: vi.fn() } as unknown as KeyboardEvent,
      {
        playerId,
        isSystemMenuOpen: false,
        activeModal: 'INVENTORY',
        isLookModeActive: false,
        worldState: world,
        modalNavState,
        onToggleSystemMenu: vi.fn(),
        onCloseModal: vi.fn(),
        onCycleModal: vi.fn(),
        onSetModal: vi.fn(),
        onToggleLookMode: vi.fn(),
        onMoveLookCursor: vi.fn(),
        onLookAttack: vi.fn(),
        onLookInteract: vi.fn(),
        onCommand: (cmd) => dispatched.push(cmd),
      },
    );

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toEqual({
      type: 'USE_ITEM',
      actorId: playerId,
      itemEntityId: tonicId,
    });
  });
});
