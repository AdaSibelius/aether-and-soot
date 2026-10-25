import { CharacterCreationConfig, ProfessionId, ScenarioId, TraitId } from '../../schemas/character.schema.js';
import { PROFESSIONS, SCENARIOS, TRAITS } from '../../sim/systems/character-archetype-defs.js';
import { drawMachinedBezel } from './bezel-composer.js';
import { UiCellBuffer } from './cell-buffer.js';
import { VICTORIAN_PALETTE } from './material-palette.js';
import { UiRect } from './viewport-controls.js';

export interface EmbarkationScreenState {
  readonly config: CharacterCreationConfig;
  readonly activeColumn?: 'PROFESSION' | 'TRAITS' | 'SCENARIO';
}

const ALL_PROFESSIONS: readonly ProfessionId[] = [
  'DISGRACED_CHIRURGEON',
  'FOUNDRY_ARTIFICER',
  'CLOCKWORK_VETERAN',
  'AETHER_SMUGGLER',
];

const ALL_TRAITS: readonly TraitId[] = [
  'NIGHT_OPTICS',
  'BOILER_HEART',
  'PACK_MULE',
  'IRON_FISTS',
  'CARTEL_CONNECTIONS',
  'TINKER_SAVANT',
];

const ALL_SCENARIOS: readonly ScenarioId[] = [
  'SPITALFIELDS_FOUNDRY_ROW',
  'BELGRAVIA_SKY_WALK',
  'FLEET_DITCH_SUMP',
];

/**
 * Renders a canvas-native Embarkation Registry Ledger styled as a leather-bound
 * Victorian employment book with wax seal stamps and typewriter key feedback.
 */
export function renderEmbarkationScreen(
  buf: UiCellBuffer,
  rect: UiRect,
  screenState: EmbarkationScreenState,
): void {
  const { x, y, width, height } = rect;
  if (width < 30 || height < 16) return;

  // 1. Leather and Brass Master Bezel
  drawMachinedBezel(buf, rect, {
    title: "HER MAJESTY'S GUILD REGISTRY — EMBARKATION LEDGER",
    subtitle: 'VICTORIAN INDENTURE & CONTRACTUAL EMPLOYMENT',
    rivetStyle: 'BRASS_BOLTS',
    fgColor: VICTORIAN_PALETTE.TARNISHED_BRASS,
    bgColor: VICTORIAN_PALETTE.OXIDIZED_IRON,
  });

  const { config } = screenState;
  const colWidth = Math.floor((width - 6) / 3);
  const leftX = x + 2;
  const midX = leftX + colWidth + 1;
  const rightX = midX + colWidth + 1;
  const contentY = y + 2;

  // Vertical dividers between columns
  for (let r = contentY; r < y + height - 3; r++) {
    buf.setCell(leftX + colWidth, r, '│', VICTORIAN_PALETTE.MUTED_PIPE, VICTORIAN_PALETTE.OXIDIZED_IRON);
    buf.setCell(midX + colWidth, r, '│', VICTORIAN_PALETTE.MUTED_PIPE, VICTORIAN_PALETTE.OXIDIZED_IRON);
  }

  // --- COLUMN 1: OCCUPATIONAL GUILD / PROFESSION ---
  buf.writeString(leftX, contentY, '═[ 1. TRADE & GUILD ]═', VICTORIAN_PALETTE.AMBER_GASLIGHT, VICTORIAN_PALETTE.OXIDIZED_IRON);
  let curY = contentY + 2;
  for (const profId of ALL_PROFESSIONS) {
    const prof = PROFESSIONS[profId];
    const isSelected = config.professionId === profId;
    const prefix = isSelected ? '► [*] ' : '  [ ] ';
    const fg = isSelected ? VICTORIAN_PALETTE.POLISHED_BRASS ?? '#e6c875' : VICTORIAN_PALETTE.SEPIA_INK;
    const hit = `select_prof:${profId}`;

    buf.writeString(leftX, curY, `${prefix}${prof.name.slice(0, colWidth - 8)}`, fg, VICTORIAN_PALETTE.OXIDIZED_IRON, undefined, hit);
    curY++;

    if (isSelected) {
      const descLines = prof.description.match(/.{1,26}(\s|$)/g) ?? [prof.description];
      for (const d of descLines.slice(0, 2)) {
        buf.writeString(leftX + 4, curY, d.trim(), VICTORIAN_PALETTE.RIVET_STEEL, VICTORIAN_PALETTE.OXIDIZED_IRON);
        curY++;
      }
      if (prof.preGraftedBlueprintId) {
        buf.writeString(leftX + 4, curY, `Graft: ${prof.preGraftedSlot}`, VICTORIAN_PALETTE.AETHER_BLUE, VICTORIAN_PALETTE.OXIDIZED_IRON);
        curY++;
      }
      curY++;
    } else {
      curY++;
    }
  }

  // --- COLUMN 2: PHYSIOLOGICAL AUGMENTS / TRAITS ---
  buf.writeString(midX, contentY, '═[ 2. AUGMENTS (MAX 2) ]═', VICTORIAN_PALETTE.AMBER_GASLIGHT, VICTORIAN_PALETTE.OXIDIZED_IRON);
  curY = contentY + 2;
  for (const traitId of ALL_TRAITS) {
    const trait = TRAITS[traitId];
    const isChecked = config.traitIds.includes(traitId);
    const prefix = isChecked ? '► [√] ' : '  [ ] ';
    const fg = isChecked ? VICTORIAN_PALETTE.AETHER_BLUE : VICTORIAN_PALETTE.SEPIA_INK;
    const hit = `toggle_trait:${traitId}`;

    buf.writeString(midX, curY, `${prefix}${trait.name.slice(0, colWidth - 8)}`, fg, VICTORIAN_PALETTE.OXIDIZED_IRON, undefined, hit);
    curY++;

    if (isChecked) {
      const descLines = trait.description.match(/.{1,26}(\s|$)/g) ?? [trait.description];
      for (const d of descLines.slice(0, 2)) {
        buf.writeString(midX + 4, curY, d.trim(), VICTORIAN_PALETTE.RIVET_STEEL, VICTORIAN_PALETTE.OXIDIZED_IRON);
        curY++;
      }
    }
    curY++;
  }

  // --- COLUMN 3: DISTRICT ASSIGNMENT & WAX SEAL EMBARK ---
  buf.writeString(rightX, contentY, '═[ 3. DEPLOYMENT POST ]═', VICTORIAN_PALETTE.AMBER_GASLIGHT, VICTORIAN_PALETTE.OXIDIZED_IRON);
  curY = contentY + 2;
  for (const scenId of ALL_SCENARIOS) {
    const scen = SCENARIOS[scenId];
    const isSelected = config.scenarioId === scenId;
    const prefix = isSelected ? '► [*] ' : '  [ ] ';
    const fg = isSelected ? VICTORIAN_PALETTE.TARNISHED_BRASS : VICTORIAN_PALETTE.SEPIA_INK;
    const hit = `select_scen:${scenId}`;

    buf.writeString(rightX, curY, `${prefix}${scen.name.slice(0, colWidth - 8)}`, fg, VICTORIAN_PALETTE.OXIDIZED_IRON, undefined, hit);
    curY += 2;
  }

  // Large Diegetic Red Wax Seal Embark Stamp Button
  const stampY = y + height - 8;
  buf.writeString(rightX, stampY - 1, '─[ OFFICIAL ROYAL RATIFICATION ]─', VICTORIAN_PALETTE.MUTED_PIPE, VICTORIAN_PALETTE.OXIDIZED_IRON);

  buf.writeString(rightX, stampY, '╔══════════════════════════╗', VICTORIAN_PALETTE.INCANDESCENT_RED, VICTORIAN_PALETTE.OXIDIZED_IRON);
  buf.writeString(
    rightX,
    stampY + 1,
    '║ ☼ [AFFIX WAX SEAL & GO] ☼║',
    VICTORIAN_PALETTE.INCANDESCENT_RED,
    VICTORIAN_PALETTE.OXIDIZED_IRON,
    ['THERMO_CRITICAL_PULSE'],
    'embark_action',
  );
  buf.writeString(rightX, stampY + 2, '╚══════════════════════════╝', VICTORIAN_PALETTE.INCANDESCENT_RED, VICTORIAN_PALETTE.OXIDIZED_IRON);

  // Footer: Keyboard Navigation / Typewriter Keys
  const footY = y + height - 2;
  const footerHint = 'KEYS: [1-4] Trade │ [T] Trait Toggle │ [S] Scenario │ [ENTER] Ratify │ [ESC] Cancel';
  buf.writeString(x + 3, footY, footerHint, VICTORIAN_PALETTE.MUTED_PIPE, VICTORIAN_PALETTE.OXIDIZED_IRON);
}
