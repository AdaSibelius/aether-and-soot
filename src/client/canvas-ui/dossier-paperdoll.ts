import { AnatomyComponent, EntityRecord } from '../../schemas/components.schema.js';
import { LimbSlotId } from '../../schemas/primitives.schema.js';
import { UiCellBuffer } from './cell-buffer.js';
import { VICTORIAN_PALETTE } from './material-palette.js';

interface LimbWireframeSpec {
  readonly slot: LimbSlotId;
  readonly label: string;
  readonly x: number;
  readonly y: number;
}

const WIREFRAME_LIMBS: readonly LimbWireframeSpec[] = [
  { slot: 'HEAD', label: 'HEAD', x: 8, y: 1 },
  { slot: 'TORSO', label: 'TORSO', x: 8, y: 3 },
  { slot: 'LEFT_ARM', label: 'L-ARM', x: 1, y: 3 },
  { slot: 'RIGHT_ARM', label: 'R-ARM', x: 15, y: 3 },
  { slot: 'LEFT_LEG', label: 'L-LEG', x: 4, y: 6 },
  { slot: 'RIGHT_LEG', label: 'R-LEG', x: 12, y: 6 },
];

function resolveLimbColor(hp: number, maxHp: number, isProsthetic: boolean): string {
  if (isProsthetic) return VICTORIAN_PALETTE.POLISHED_BRASS;
  if (hp <= 0) return VICTORIAN_PALETTE.WARN_RED;
  const ratio = hp / Math.max(1, maxHp);
  if (ratio <= 0.4) return VICTORIAN_PALETTE.WARN_RED;
  if (ratio <= 0.75) return VICTORIAN_PALETTE.COPPER_ACCENT;
  return VICTORIAN_PALETTE.OK_GREEN;
}

/**
 * Renders an anatomical wireframe schematic with pneumatic conduit linkages,
 * brass prosthetic joint indicators, and localized limb damage states.
 */
export function renderDiegeticPaperdoll(
  buf: UiCellBuffer,
  originX: number,
  originY: number,
  actorOrAnatomy: EntityRecord | { anatomy?: Partial<AnatomyComponent> | undefined } | Partial<AnatomyComponent>,
): void {
  const anatomy: Partial<AnatomyComponent> | undefined = 'anatomy' in actorOrAnatomy
    ? (actorOrAnatomy.anatomy as Partial<AnatomyComponent> | undefined)
    : 'limbs' in actorOrAnatomy
    ? (actorOrAnatomy as Partial<AnatomyComponent>)
    : undefined;

  if (!anatomy || !anatomy.limbs) {
    buf.writeString(originX, originY, 'NO ANATOMICAL TELEMETRY', VICTORIAN_PALETTE.SEPIA_INK);
    return;
  }

  // Header & Pneumatic Governor Conduit Load (in Victorian Horsepower)
  const loadHp = Math.round((anatomy.strainLoadKw ?? 0) * 1.34);
  const capHp = Math.round((anatomy.governorCapacityKw ?? 100) * 1.34);
  buf.writeString(originX, originY, `WIREFRAME [Gov:${loadHp}/${capHp}HP]`, VICTORIAN_PALETTE.TARNISHED_BRASS);

  // Structural Wireframe Connectors (Pneumatic & Nervous Conduits)
  // Neck conduit
  buf.setCell(originX + 10, originY + 2, '║', VICTORIAN_PALETTE.RIVET_STEEL);
  // Shoulder conduits
  buf.setCell(originX + 6, originY + 3, '═', VICTORIAN_PALETTE.RIVET_STEEL);
  buf.setCell(originX + 7, originY + 3, 'O', VICTORIAN_PALETTE.POLISHED_BRASS);
  buf.setCell(originX + 13, originY + 3, 'O', VICTORIAN_PALETTE.POLISHED_BRASS);
  buf.setCell(originX + 14, originY + 3, '═', VICTORIAN_PALETTE.RIVET_STEEL);
  // Pelvic hip conduits
  buf.setCell(originX + 8, originY + 5, '╱', VICTORIAN_PALETTE.RIVET_STEEL);
  buf.setCell(originX + 12, originY + 5, '╲', VICTORIAN_PALETTE.RIVET_STEEL);

  // Render individual limb modules
  for (const spec of WIREFRAME_LIMBS) {
    const limb = anatomy.limbs[spec.slot];
    const isProsthetic = Boolean(limb?.installedProstheticEntityId);
    const hp = limb?.hp ?? 0;
    const maxHp = limb?.maxHp ?? 100;
    const color = resolveLimbColor(hp, maxHp, isProsthetic);

    const limbGlyph = isProsthetic ? '⚙' : hp <= 0 ? '✗' : '■';
    const lx = originX + spec.x;
    const ly = originY + spec.y;

    buf.setCell(lx, ly, limbGlyph, color, VICTORIAN_PALETTE.SOOT_IRON_BG);
    const labelStr = isProsthetic ? `${spec.label}*` : spec.label;
    buf.writeString(lx + 2, ly, labelStr, color);
    buf.writeString(lx + 2, ly + 1, `${hp}HP`, VICTORIAN_PALETTE.RIVET_STEEL);
  }

  // Sanguine & Metabolic Indicators
  const bloodStr = anatomy.bloodVolumePct !== undefined ? `Blood: ${anatomy.bloodVolumePct}%` : '';
  const toxStr = anatomy.toxicityPct !== undefined ? `Toxicity: ${anatomy.toxicityPct}%` : '';
  const painStr = anatomy.painShock !== undefined ? `Pain: ${anatomy.painShock}` : '';
  if (bloodStr) buf.writeString(originX + 1, originY + 8, bloodStr, (anatomy.bloodVolumePct ?? 100) < 50 ? VICTORIAN_PALETTE.WARN_RED : '#c0392b');
  if (toxStr) buf.writeString(originX + 12, originY + 8, toxStr, (anatomy.toxicityPct ?? 0) > 50 ? VICTORIAN_PALETTE.WARN_RED : VICTORIAN_PALETTE.VERDIGRIS_PATINA);
  if (painStr) buf.writeString(originX + 1, originY + 9, painStr, (anatomy.painShock ?? 0) > 40 ? VICTORIAN_PALETTE.WARN_RED : VICTORIAN_PALETTE.SEPIA_INK);
}

/**
 * Renders a compact 6-row anatomical wireframe for the 30-column tactical console:
 * Row 0: Head glyph & HP
 * Row 1: Upper limbs (L-Arm, Torso, R-Arm) with prosthetic markers
 * Row 2: Upper limb HP numbers
 * Row 3: Lower limbs (L-Leg, R-Leg)
 * Row 4: Lower limb HP numbers
 * Row 5: Toxicity, Pain Shock, and Stamina status
 */
export function renderCompactPaperdoll(
  buf: UiCellBuffer,
  x: number,
  y: number,
  anatomy: Partial<AnatomyComponent>,
): void {
  if (!anatomy.limbs) {
    buf.writeString(x, y, 'ANATOMY TELEMETRY OFFLINE', VICTORIAN_PALETTE.SEPIA_INK);
    return;
  }

  const limbs = anatomy.limbs;
  const getLimb = (slot: LimbSlotId) => {
    const l = limbs[slot];
    const isProsthetic = Boolean(l?.installedProstheticEntityId);
    const hp = l?.hp ?? 0;
    const maxHp = l?.maxHp ?? 100;
    const color = resolveLimbColor(hp, maxHp, isProsthetic);
    const glyph = isProsthetic ? '⚙' : hp <= 0 ? '✗' : '■';
    return { hp, color, glyph };
  };

  const head = getLimb('HEAD');
  const torso = getLimb('TORSO');
  const lArm = getLimb('LEFT_ARM');
  const rArm = getLimb('RIGHT_ARM');
  const lLeg = getLimb('LEFT_LEG');
  const rLeg = getLimb('RIGHT_LEG');

  // Row 0: Centered Head
  buf.setCell(x + 9, y, head.glyph, head.color, VICTORIAN_PALETTE.SOOT_IRON_BG);
  buf.writeString(x + 11, y, `HEAD ${head.hp}`, head.color, VICTORIAN_PALETTE.SOOT_IRON_BG);

  // Row 1: Upper Limbs
  buf.setCell(x + 1, y + 1, lArm.glyph, lArm.color, VICTORIAN_PALETTE.SOOT_IRON_BG);
  buf.writeString(x + 3, y + 1, 'L-ARM', lArm.color, VICTORIAN_PALETTE.SOOT_IRON_BG);
  buf.setCell(x + 10, y + 1, torso.glyph, torso.color, VICTORIAN_PALETTE.SOOT_IRON_BG);
  buf.writeString(x + 12, y + 1, 'BODY', torso.color, VICTORIAN_PALETTE.SOOT_IRON_BG);
  buf.setCell(x + 18, y + 1, rArm.glyph, rArm.color, VICTORIAN_PALETTE.SOOT_IRON_BG);
  buf.writeString(x + 20, y + 1, 'R-ARM', rArm.color, VICTORIAN_PALETTE.SOOT_IRON_BG);

  // Row 2: Upper HP
  buf.writeString(x + 3, y + 2, `${Math.max(-999, Math.min(9999, lArm.hp))}HP`.padStart(5, ' ').slice(0, 6), VICTORIAN_PALETTE.RIVET_STEEL);
  buf.writeString(x + 11, y + 2, `${Math.max(-999, Math.min(9999, torso.hp))}HP`.padStart(5, ' ').slice(0, 6), VICTORIAN_PALETTE.RIVET_STEEL);
  buf.writeString(x + 20, y + 2, `${Math.max(-999, Math.min(9999, rArm.hp))}HP`.padStart(5, ' ').slice(0, 6), VICTORIAN_PALETTE.RIVET_STEEL);

  // Row 3: Lower Limbs
  buf.setCell(x + 5, y + 3, lLeg.glyph, lLeg.color, VICTORIAN_PALETTE.SOOT_IRON_BG);
  buf.writeString(x + 7, y + 3, 'L-LEG', lLeg.color, VICTORIAN_PALETTE.SOOT_IRON_BG);
  buf.setCell(x + 15, y + 3, rLeg.glyph, rLeg.color, VICTORIAN_PALETTE.SOOT_IRON_BG);
  buf.writeString(x + 17, y + 3, 'R-LEG', rLeg.color, VICTORIAN_PALETTE.SOOT_IRON_BG);

  // Row 4: Lower HP
  buf.writeString(x + 7, y + 4, `${Math.max(-999, Math.min(9999, lLeg.hp))}HP`.padStart(5, ' ').slice(0, 6), VICTORIAN_PALETTE.RIVET_STEEL);
  buf.writeString(x + 17, y + 4, `${Math.max(-999, Math.min(9999, rLeg.hp))}HP`.padStart(5, ' ').slice(0, 6), VICTORIAN_PALETTE.RIVET_STEEL);

  // Row 5: Vitals Summary (Tox, Pain, Stamina)
  const tox = anatomy.toxicityPct ?? 0;
  const pain = anatomy.painShock ?? 0;
  const stam = anatomy.stamina ?? 100;
  const toxFg = tox > 50 ? VICTORIAN_PALETTE.WARN_RED : VICTORIAN_PALETTE.VERDIGRIS_PATINA;
  const painFg = pain > 40 ? VICTORIAN_PALETTE.WARN_RED : VICTORIAN_PALETTE.SEPIA_INK;
  buf.writeString(x, y + 5, `TOX:${Math.min(999, tox)}%`.padEnd(8, ' ').slice(0, 8), toxFg);
  buf.writeString(x + 9, y + 5, `PAIN:${Math.min(999, pain)}`.padEnd(8, ' ').slice(0, 8), painFg);
  buf.writeString(x + 18, y + 5, `STM:${Math.max(0, Math.min(999, Math.round(stam)))}%`.slice(0, 8), VICTORIAN_PALETTE.POLISHED_BRASS);
}
