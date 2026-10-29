import { describe, expect, it } from 'vitest';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { projectWorldToVisualFrame } from '../../src/client/projection/frame-adapter.js';
import { generateVictorianDistrict } from '../../src/sim/spatial/generator.js';

describe('Task TSK-P4-04: Spire Vertical Depth Parallax & Entity Background Preservation', () => {
  it('samples underlying STREET terrain with desaturated soot-navy tint for SPIRE ABYSS_DROP tiles', () => {
    const baseWorld = createInitialWorld({ seed: 42, width: 48, height: 36 });
    const { state: world } = generateVictorianDistrict(baseWorld);

    const playerId = EntityIdSchema.parse('actor_player');
    const spireGrid = world.strata.SPIRE!;
    const streetGrid = world.strata.STREET!;

    // Find a coordinate on SPIRE that has ABYSS_DROP and has street terrain below
    let abyssX = -1;
    let abyssY = -1;
    for (let y = 5; y < spireGrid.height - 5; y++) {
      for (let x = 5; x < spireGrid.width - 5; x++) {
        const spireCell = spireGrid.cells[y * spireGrid.width + x];
        const streetCell = streetGrid.cells[y * streetGrid.width + x];
        if (spireCell?.terrainType === 'ABYSS_DROP' && streetCell) {
          abyssX = x;
          abyssY = y;
          break;
        }
      }
      if (abyssX !== -1) break;
    }
    expect(abyssX).toBeGreaterThanOrEqual(0);

    // Place player on SPIRE at adjacent cell so target abyss cell is visible
    const player = world.entities[playerId]!;
    const spireWorld = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...player,
          position: {
            ...(player.position ?? { blocksMovement: true, blocksSight: false }),
            x: abyssX - 1,
            y: abyssY,
            stratum: 'SPIRE' as const,
          },
        },
      },
    };

    const frame = projectWorldToVisualFrame(spireWorld, playerId, 12, { width: 30, height: 24 });
    expect(frame.activeStratum).toBe('SPIRE');

    // Find the cell in frame corresponding to (abyssX, abyssY)
    const targetCell = frame.cells.find((c) => c.worldX === abyssX && c.worldY === abyssY);
    expect(targetCell).toBeDefined();

    // Verify underlay flags and soot-navy desaturated tint
    expect(targetCell!.isUnderlay).toBe(true);
    expect(targetCell!.visual.fgPrimary).toBe('#1a2634');
    expect(targetCell!.visual.bgColor).toBe('#080d14');
    expect(targetCell!.visual.glyph.length).toBeGreaterThan(0);
  });

  it('preserves underlying tile bgColor when entity glyph is projected over a terrain tile', () => {
    const baseWorld = createInitialWorld({ seed: 42, width: 24, height: 24 });
    const { state: world } = generateVictorianDistrict(baseWorld);

    const playerId = EntityIdSchema.parse('actor_player');
    const player = world.entities[playerId]!;

    const frame = projectWorldToVisualFrame(world, playerId, 10, { width: 24, height: 20 });
    const playerCell = frame.cells.find((c) => c.worldX === player.position!.x && c.worldY === player.position!.y);

    expect(playerCell).toBeDefined();
    expect(playerCell!.visual.glyph).toBe('@');
    // Ensure entity visual didn't overwrite tile background with #000000 or default black box
    expect(playerCell!.visual.bgColor).toBeDefined();
    expect(playerCell!.visual.bgColor).not.toBe('#000000');
  });
});
