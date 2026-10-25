import { AnatomyComponent } from '../../schemas/components.schema.js';
import { EntityId, LimbSlotId } from '../../schemas/primitives.schema.js';
import { UiCellBuffer } from './cell-buffer.js';
import { VICTORIAN_PALETTE } from './material-palette.js';

export interface ClockworkPaperdollOptions {
  readonly selectedSlot?: LimbSlotId;
  readonly equippedProsthetics?: Readonly<Record<string, EntityId>>;
  readonly transitionTick?: number;
}

export function renderClockworkPaperdoll(
  buf: UiCellBuffer,
  originX: number,
  originY: number,
  anatomy: AnatomyComponent | undefined,
  options: ClockworkPaperdollOptions = {},
): void {
  const { selectedSlot, equippedProsthetics = {}, transitionTick } = options;

  const isProsthetic = (slot: LimbSlotId): boolean => {
    const limb = anatomy?.limbs[slot];
    return Boolean(limb?.installedProstheticEntityId || equippedProsthetics[slot]);
  };

  const isAmputated = (slot: LimbSlotId): boolean => {
    const limb = anatomy?.limbs[slot];
    return Boolean(limb?.amputated) && !isProsthetic(slot);
  };

  const getSlotVisuals = (slot: LimbSlotId) => {
    const prosthetic = isProsthetic(slot);
    const amputated = isAmputated(slot);
    const selected = selectedSlot === slot;

    let fg: string = prosthetic ? VICTORIAN_PALETTE.AETHER_BLUE : VICTORIAN_PALETTE.AMBER_GASLIGHT;
    const bg: string = selected ? VICTORIAN_PALETTE.OXIDIZED_IRON : VICTORIAN_PALETTE.SOOT_IRON_BG;
    let shader: string[] | undefined = prosthetic ? ['AETHER_HALATION'] : undefined;

    if (amputated) {
      fg = VICTORIAN_PALETTE.INCANDESCENT_RED;
      shader = ['THERMO_CRITICAL_PULSE'];
    } else if (prosthetic && transitionTick !== undefined && transitionTick < 6) {
      fg = '#ffffff';
      shader = ['AETHER_HALATION', 'SPARK_GLINT'];
    }

    return { fg, bg, shader, action: `select_limb:${slot}` };
  };

  // 0. OCULAR MOUNT (Row 0, above/left of head)
  const ocularVis = getSlotVisuals('OCULAR_MOUNT');
  const ocularGlyph = isProsthetic('OCULAR_MOUNT') ? '[☼]' : isAmputated('OCULAR_MOUNT') ? '[x]' : '[·]';
  buf.writeString(originX + 2, originY, ocularGlyph, ocularVis.fg, ocularVis.bg, ocularVis.shader, ocularVis.action);

  // 1. HEAD (Row 0)
  const headVis = getSlotVisuals('HEAD');
  const headGlyphs = isAmputated('HEAD') ? '( x )' : isProsthetic('HEAD') ? '[#☼#]' : '( ~ )';
  buf.writeString(originX + 6, originY, headGlyphs, headVis.fg, headVis.bg, headVis.shader, headVis.action);

  // Structural neck & shoulders (Row 1)
  buf.setCell(originX + 6, originY + 1, '/', VICTORIAN_PALETTE.RIVET_STEEL, VICTORIAN_PALETTE.SOOT_IRON_BG);
  buf.setCell(originX + 8, originY + 1, '|', VICTORIAN_PALETTE.RIVET_STEEL, VICTORIAN_PALETTE.SOOT_IRON_BG);
  buf.setCell(originX + 10, originY + 1, '\\', VICTORIAN_PALETTE.RIVET_STEEL, VICTORIAN_PALETTE.SOOT_IRON_BG);

  // 2. TORSO, CHASSIS_CORE, LEFT_ARM, RIGHT_ARM (Rows 2, 3, 4)
  const lArmVis = getSlotVisuals('LEFT_ARM');
  const torsoVis = getSlotVisuals('TORSO');
  const coreVis = getSlotVisuals('CHASSIS_CORE');
  const rArmVis = getSlotVisuals('RIGHT_ARM');

  // Row 2: Shoulders, Chest
  const lArmR2 = isAmputated('LEFT_ARM') ? ' x ' : isProsthetic('LEFT_ARM') ? '[=]' : '(~)';
  const torsoR2 = isAmputated('TORSO') ? '( x )' : isProsthetic('TORSO') ? '[#╬#]' : '(===)';
  const rArmR2 = isAmputated('RIGHT_ARM') ? ' x ' : isProsthetic('RIGHT_ARM') ? '[=]' : '(~)';
  buf.writeString(originX + 2, originY + 2, lArmR2, lArmVis.fg, lArmVis.bg, lArmVis.shader, lArmVis.action);
  buf.setCell(originX + 5, originY + 2, '=', VICTORIAN_PALETTE.RIVET_STEEL, VICTORIAN_PALETTE.SOOT_IRON_BG);
  buf.writeString(originX + 6, originY + 2, torsoR2, torsoVis.fg, torsoVis.bg, torsoVis.shader, torsoVis.action);
  buf.setCell(originX + 11, originY + 2, '=', VICTORIAN_PALETTE.RIVET_STEEL, VICTORIAN_PALETTE.SOOT_IRON_BG);
  buf.writeString(originX + 12, originY + 2, rArmR2, rArmVis.fg, rArmVis.bg, rArmVis.shader, rArmVis.action);

  // Row 3: Forearms, Boiler Core
  const lArmR3 = isAmputated('LEFT_ARM') ? '   ' : isProsthetic('LEFT_ARM') ? '[#]' : '(~)';
  const isCoreSelected = selectedSlot === 'CHASSIS_CORE';
  const torsoR3 = isAmputated('TORSO') ? '( x )' : isProsthetic('CHASSIS_CORE') ? '[#⚙#]' : isProsthetic('TORSO') ? '[#╬#]' : '( • )';
  const activeMidVis = isCoreSelected ? coreVis : torsoVis;
  const rArmR3 = isAmputated('RIGHT_ARM') ? '   ' : isProsthetic('RIGHT_ARM') ? '[#]' : '(~)';
  buf.writeString(originX + 2, originY + 3, lArmR3, lArmVis.fg, lArmVis.bg, lArmVis.shader, lArmVis.action);
  buf.writeString(originX + 6, originY + 3, torsoR3, activeMidVis.fg, activeMidVis.bg, activeMidVis.shader, isCoreSelected ? coreVis.action : torsoVis.action);
  buf.writeString(originX + 12, originY + 3, rArmR3, rArmVis.fg, rArmVis.bg, rArmVis.shader, rArmVis.action);

  // Row 4: Hands, Abdomen
  const lArmR4 = isAmputated('LEFT_ARM') ? '   ' : isProsthetic('LEFT_ARM') ? ' ╬ ' : ' ~ ';
  const torsoR4 = isAmputated('TORSO') ? '( x )' : isProsthetic('TORSO') ? '[#╬#]' : '(===)';
  const rArmR4 = isAmputated('RIGHT_ARM') ? '   ' : isProsthetic('RIGHT_ARM') ? ' ╬ ' : ' ~ ';
  buf.writeString(originX + 2, originY + 4, lArmR4, lArmVis.fg, lArmVis.bg, lArmVis.shader, lArmVis.action);
  buf.writeString(originX + 6, originY + 4, torsoR4, torsoVis.fg, torsoVis.bg, torsoVis.shader, torsoVis.action);
  buf.writeString(originX + 12, originY + 4, rArmR4, rArmVis.fg, rArmVis.bg, rArmVis.shader, rArmVis.action);

  // Structural pelvis & hip joints (Row 5)
  buf.setCell(originX + 6, originY + 5, '/', VICTORIAN_PALETTE.RIVET_STEEL, VICTORIAN_PALETTE.SOOT_IRON_BG);
  buf.setCell(originX + 10, originY + 5, '\\', VICTORIAN_PALETTE.RIVET_STEEL, VICTORIAN_PALETTE.SOOT_IRON_BG);

  // 3. LEFT_LEG, RIGHT_LEG (Rows 6, 7, 8)
  const lLegVis = getSlotVisuals('LEFT_LEG');
  const rLegVis = getSlotVisuals('RIGHT_LEG');

  // Row 6: Thighs
  const lLegR6 = isAmputated('LEFT_LEG') ? ' x ' : isProsthetic('LEFT_LEG') ? '[=]' : '(~)';
  const rLegR6 = isAmputated('RIGHT_LEG') ? ' x ' : isProsthetic('RIGHT_LEG') ? '[=]' : '(~)';
  buf.writeString(originX + 5, originY + 6, lLegR6, lLegVis.fg, lLegVis.bg, lLegVis.shader, lLegVis.action);
  buf.writeString(originX + 9, originY + 6, rLegR6, rLegVis.fg, rLegVis.bg, rLegVis.shader, rLegVis.action);

  // Row 7: Shins
  const lLegR7 = isAmputated('LEFT_LEG') ? '   ' : isProsthetic('LEFT_LEG') ? '[#]' : '(~)';
  const rLegR7 = isAmputated('RIGHT_LEG') ? '   ' : isProsthetic('RIGHT_LEG') ? '[#]' : '(~)';
  buf.writeString(originX + 5, originY + 7, lLegR7, lLegVis.fg, lLegVis.bg, lLegVis.shader, lLegVis.action);
  buf.writeString(originX + 9, originY + 7, rLegR7, rLegVis.fg, rLegVis.bg, rLegVis.shader, rLegVis.action);

  // Row 8: Feet
  const lLegR8 = isAmputated('LEFT_LEG') ? '   ' : isProsthetic('LEFT_LEG') ? '[╬]' : '(_)';
  const rLegR8 = isAmputated('RIGHT_LEG') ? '   ' : isProsthetic('RIGHT_LEG') ? '[╬]' : '(_)';
  buf.writeString(originX + 5, originY + 8, lLegR8, lLegVis.fg, lLegVis.bg, lLegVis.shader, lLegVis.action);
  buf.writeString(originX + 9, originY + 8, rLegR8, rLegVis.fg, rLegVis.bg, rLegVis.shader, rLegVis.action);

  // Highlight indicator around selected slot if active
  if (selectedSlot) {
    const indicatorText = `[ ${selectedSlot} ]`;
    buf.writeString(originX + Math.max(0, Math.floor((17 - indicatorText.length) / 2)), originY + 10, indicatorText, VICTORIAN_PALETTE.TARNISHED_BRASS, VICTORIAN_PALETTE.OXIDIZED_IRON);
  }
}
