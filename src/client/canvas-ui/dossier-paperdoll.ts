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

  // Header & Pneumatic Governor Conduit Load
  const governorLoad = `${anatomy.strainLoadKw ?? 0}/${anatomy.governorCapacityKw ?? 100}kW`;
  buf.writeString(originX, originY, `ANATOMICAL WIREFRAME [Gov: ${governorLoad}]`, VICTORIAN_PALETTE.TARNISHED_BRASS);

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
