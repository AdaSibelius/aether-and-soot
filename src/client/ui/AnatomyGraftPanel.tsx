import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityId, LimbSlotId } from '../../schemas/primitives.schema.js';
import { ProstheticBlueprint } from '../../schemas/blueprint.schema.js';

export interface AnatomyGraftPanelProps {
  readonly selectedSlot: LimbSlotId;
  readonly slotKeyNum?: string | undefined;
  readonly selectedLimb?: {
    readonly hp: number;
    readonly maxHp: number;
    readonly amputated: boolean;
  } | undefined;
  readonly installedProsthetic?: EntityRecord | undefined;
  readonly prostheticBp?: ProstheticBlueprint | undefined;
  readonly compatibleInSatchel: readonly EntityRecord[];
  readonly gearsCount: number;
  readonly canRepair: boolean;
  readonly actorId: EntityId;
  readonly onCommand: (cmd: GameCommand) => void;
}

export function AnatomyGraftPanel({
  selectedSlot,
  slotKeyNum,
  selectedLimb,
  installedProsthetic,
  prostheticBp,
  compatibleInSatchel,
  gearsCount,
  canRepair,
  actorId,
  onCommand,
}: AnatomyGraftPanelProps) {
  return (
    <div class="panel-box" style={{ display: 'flex', flexDirection: 'column', background: '#0d1316', border: '1px solid #2e4053' }}>
      <div class="panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span class="brass-text">SURGICAL DOSSIER: {selectedSlot}</span>
        {slotKeyNum && <span class="muted" style={{ fontSize: '10px' }}>Slot #{slotKeyNum}</span>}
      </div>

      <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px', margin: '6px 0 12px 0' }}>
        <div class="stat-row">
          <span>Tissue Integrity:</span>
          <span class={selectedLimb?.amputated ? 'warn-text' : 'ok-text'}>
            {selectedLimb ? `${selectedLimb.hp} / ${selectedLimb.maxHp} HP` : 'N/A'}
          </span>
        </div>
        <div class="stat-row">
          <span>Amputation Status:</span>
          <span class={selectedLimb?.amputated ? 'warn-text' : 'ok-text'}>
            {selectedLimb?.amputated ? 'SEVERED / AMPUTATED' : 'INTACT'}
          </span>
        </div>

        {installedProsthetic && (
          <div style={{ background: '#11181c', border: '1px solid var(--brass-gold)', padding: '6px', marginTop: '6px' }}>
            <div class="brass-text" style={{ fontWeight: 'bold' }}>
              {installedProsthetic.visual.glyph} {installedProsthetic.name}
            </div>
            <div style={{ fontStyle: 'italic', fontSize: '10px', color: '#d5dbdb', margin: '3px 0' }}>
              "{prostheticBp?.description ?? 'Installed clockwork limb.'}"
            </div>
            <button
              type="button"
              onClick={() => onCommand({ type: 'REMOVE_PROSTHETIC', actorId, slot: selectedSlot })}
              style={{ padding: '3px 8px', fontSize: '10px', marginTop: '4px', color: '#ec7063' }}
            >
              [U] Uninstall Prosthetic
            </button>
          </div>
        )}
      </div>

      {/* Field Repair Section */}
      <div class="panel-header" style={{ marginTop: '8px' }}>FIELD SURGICAL REPAIR</div>
      <div style={{ fontSize: '11px', marginBottom: '8px' }}>
        Restores 25 limb HP and repairs severing using 1x Brass Gears &amp; 15 kPa boiler steam.
      </div>
      <div class="stat-row" style={{ fontSize: '10px', marginBottom: '6px' }}>
        <span>Brass Gears Owned:</span>
        <span class={gearsCount >= 1 ? 'ok-text' : 'warn-text'}>{gearsCount} / 1</span>
      </div>
      <button
        type="button"
        disabled={!canRepair}
        onClick={() => onCommand({ type: 'REPAIR_LIMB', actorId, slot: selectedSlot })}
        style={{ opacity: canRepair ? 1 : 0.5, padding: '4px 10px', fontSize: '11px', color: 'var(--brass-gold)' }}
      >
        [R] Field Repair Limb (1 Gear + 15 kPa)
      </button>

      {/* Socket Compatible Satchel Prosthetics */}
      <div class="panel-header" style={{ marginTop: '14px' }}>COMPATIBLE PROSTHETICS IN SATCHEL</div>
      {compatibleInSatchel.length === 0 ? (
        <div class="log-entry muted" style={{ fontSize: '10px' }}>No compatible prosthetics in satchel.</div>
      ) : (
        compatibleInSatchel.map((item) => (
          <div key={item.id} class="stat-row" style={{ alignItems: 'center', fontSize: '11px' }}>
            <span>{item.visual.glyph} {item.name}</span>
            <button
              type="button"
              onClick={() => onCommand({ type: 'INSTALL_PROSTHETIC', actorId, prostheticEntityId: item.id, slot: selectedSlot })}
              style={{ padding: '2px 6px', fontSize: '10px', color: 'var(--brass-gold)' }}
            >
              [G] Graft
            </button>
          </div>
        ))
      )}
    </div>
  );
}
