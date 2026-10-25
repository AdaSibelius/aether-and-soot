import { describe, expect, it } from 'vitest';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { projectWorldToVisualFrame } from '../../src/client/projection/frame-adapter.js';
import { WIDESCREEN_GRID_HEIGHT, WIDESCREEN_GRID_WIDTH } from '../../src/client/renderer/glyph-stage.js';
import { deriveFloatingCombatText } from '../../src/client/renderer/floating-combat-text.js';
import { resolveDiegeticClickHit } from '../../src/client/client-interactions.js';
import { SimEvent } from '../../src/schemas/events.schema.js';

describe('Viewport Centering & Floating Combat Telemetry', () => {
  it('centers narrower district within widescreen viewport without void', () => {
    const world = createInitialWorld({ seed: 101, width: 48, height: 36 });
    const playerId = EntityIdSchema.parse('actor_player');

    const frame = projectWorldToVisualFrame(world, playerId, undefined, {
      width: WIDESCREEN_GRID_WIDTH,
      height: WIDESCREEN_GRID_HEIGHT,
    });

    expect(frame.width).toBe(88);
    expect(frame.height).toBe(36);
    expect(frame.cells).toHaveLength(88 * 36);

    // District is 48 wide inside 88 widescreen => offset is (88 - 48) / 2 = 20
    expect(frame.cameraOrigin.x).toBe(-20);
    expect(frame.cameraOrigin.y).toBe(0);

    // Margin cells (vx = 0..19) should have worldX < 0 and out-of-bounds glyph '·'
    const leftMarginCell = frame.cells[0];
    expect(leftMarginCell).toBeDefined();
    expect(leftMarginCell?.worldX).toBeLessThan(0);
    expect(leftMarginCell?.visual.glyph).toBe('·');

    // In-bounds cell at vx = 20 should map to worldX = 0
    const firstDistrictCell = frame.cells[20];
    expect(firstDistrictCell).toBeDefined();
    expect(firstDistrictCell?.worldX).toBe(0);
    expect(firstDistrictCell?.visual.glyph).not.toBe('·');
  });

  it('derives floating combat text callouts from simulation events', () => {
    const world = createInitialWorld({ seed: 102 });
    const playerId = EntityIdSchema.parse('actor_player');
    const targetPos = world.entities[playerId]!.position!;

    const events: SimEvent[] = [
      {
        type: 'COMBAT_ATTACK_RESOLVED',
        turn: 1,
        attackerId: playerId,
        targetId: playerId,
        targetSlot: 'RIGHT_ARM',
        hit: true,
        damageDealt: 14,
      },
      {
        type: 'LIMB_AMPUTATED',
        turn: 1,
        targetId: playerId,
        slot: 'RIGHT_ARM',
      },
      {
        type: 'THERMAL_SCALD',
        turn: 1,
        targetId: playerId,
        slot: 'TORSO',
        damage: 8,
        steamPressureKpa: 300,
      },
      {
        type: 'DOOR_TOGGLED',
        turn: 1,
        actorId: playerId,
        at: { x: 5, y: 5, stratum: 'STREET' },
        newState: 'OPEN',
      },
    ];

    const callouts = deriveFloatingCombatText(events, world, 1000);
    expect(callouts.length).toBeGreaterThanOrEqual(3);

    const hitCallout = callouts.find((c) => c.text.includes('-14'));
    expect(hitCallout).toBeDefined();
    expect(hitCallout?.color).toBe('#e74c3c');
    expect(hitCallout?.worldX).toBe(targetPos.x);

    const amputatedCallout = callouts.find((c) => c.text.includes('AMPUTATED'));
    expect(amputatedCallout).toBeDefined();

    const scaldCallout = callouts.find((c) => c.text.includes('SCALD!'));
    expect(scaldCallout).toBeDefined();
    expect(scaldCallout?.color).toBe('#e67e22');

    const doorCallout = callouts.find((c) => c.text === '[DOOR OPEN]');
    expect(doorCallout).toBeDefined();
  });

  it('resolves diegetic canvas UI clicks into valid GameCommands', () => {
    const world = createInitialWorld({ seed: 103 });
    const playerId = EntityIdSchema.parse('actor_player');

    expect(resolveDiegeticClickHit(undefined, world, playerId)).toBeNull();
    expect(resolveDiegeticClickHit('unknown_action', world, playerId)).toBeNull();

    const itemCmd = resolveDiegeticClickHit('select_item:item_repair_kit', world, playerId);
    expect(itemCmd).toEqual({
      type: 'USE_ITEM',
      actorId: playerId,
      itemEntityId: 'item_repair_kit',
    });

    const craftCmd = resolveDiegeticClickHit('craft_recipe:recipe_bandage', world, playerId);
    expect(craftCmd).toEqual({
      type: 'CRAFT_RECIPE',
      actorId: playerId,
      recipeId: 'recipe_bandage',
    });
  });
});
