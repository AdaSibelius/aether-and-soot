import { describe, expect, it } from 'vitest';
import { BlueprintIdSchema } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { createSaveStorageAdapter, InMemorySaveAdapter } from '../../src/client/persistence/save-adapter.js';
import { computeAspectLockedScale, DesktopWindowManager } from '../../src/client/renderer/desktop-window-manager.js';

describe('SaveStorageAdapter & DesktopWindowManager (Phase UI-7)', () => {
  it('saves, lists, loads, and deletes world state with InMemorySaveAdapter', async () => {
    const adapter = new InMemorySaveAdapter();
    const world = createInitialWorld({ seed: 0x12345678 });
    world.turnCount = 42;
    world.currentDistrictId = BlueprintIdSchema.parse('district_spitalfields_soot_works');

    // 1. Save
    const meta = await adapter.saveWorld('slot_1', world);
    expect(meta.slot).toBe('slot_1');
    expect(meta.turnCount).toBe(42);
    expect(meta.seed).toBe(0x12345678);
    expect(meta.districtId).toBe('district_spitalfields_soot_works');

    // 2. List
    const saves = await adapter.listSaves();
    expect(saves).toHaveLength(1);
    expect(saves[0]?.slot).toBe('slot_1');

    // 3. Load
    const loaded = await adapter.loadWorld('slot_1');
    expect(loaded).not.toBeNull();
    expect(loaded?.seed).toBe(0x12345678);
    expect(loaded?.turnCount).toBe(42);
    expect(loaded?.currentDistrictId).toBe('district_spitalfields_soot_works');

    // 4. Delete
    const deleted = await adapter.deleteSave('slot_1');
    expect(deleted).toBe(true);

    const reloaded = await adapter.loadWorld('slot_1');
    expect(reloaded).toBeNull();
  });

  it('createSaveStorageAdapter defaults to InMemorySaveAdapter in headless node environment', () => {
    const adapter = createSaveStorageAdapter();
    expect(adapter.adapterType).toBe('IN_MEMORY');
  });

  it('computes aspect-locked integer and continuous DPI scaling', () => {
    // 1056 x 720 base resolution
    const baseW = 1056;
    const baseH = 720;

    // Test 1: Exactly 1920x1080 display (16:9)
    const metrics1080p = computeAspectLockedScale(
      { windowWidth: 1920, windowHeight: 1080 },
      baseW,
      baseH,
      false,
    );
    expect(metrics1080p.scaleFactor).toBeCloseTo(1.5, 2);
    expect(metrics1080p.scaledWidth).toBe(1584);
    expect(metrics1080p.scaledHeight).toBe(1080);
    expect(metrics1080p.offsetX).toBe(168);
    expect(metrics1080p.offsetY).toBe(0);

    // Test 2: Integer scaling on 4K display (3840x2160)
    const metrics4kInt = computeAspectLockedScale(
      { windowWidth: 3840, windowHeight: 2160 },
      baseW,
      baseH,
      true,
    );
    expect(metrics4kInt.scaleFactor).toBe(3);
    expect(metrics4kInt.scaledWidth).toBe(1056 * 3);
    expect(metrics4kInt.scaledHeight).toBe(720 * 3);
    expect(metrics4kInt.offsetX).toBeGreaterThanOrEqual(0);
    expect(metrics4kInt.offsetY).toBeGreaterThanOrEqual(0);

    // Test 3: Ultra-wide window (2560 x 1080)
    const metricsUltrawide = computeAspectLockedScale(
      { windowWidth: 2560, windowHeight: 1080 },
      baseW,
      baseH,
      false,
    );
    expect(metricsUltrawide.scaledHeight).toBe(1080);
    expect(metricsUltrawide.offsetX).toBe(488);
  });

  it('instantiates and destroys DesktopWindowManager cleanly in headless environment', () => {
    let suspended = false;
    let resumed = false;

    const manager = new DesktopWindowManager({
      onSuspend: () => { suspended = true; },
      onResume: () => { resumed = true; },
    });

    expect(manager.isAppSuspended()).toBe(false);
    expect(suspended).toBe(false);
    expect(resumed).toBe(false);

    manager.destroy();
  });
});
