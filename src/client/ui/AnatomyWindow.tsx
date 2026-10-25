import { useEffect, useState } from 'preact/hooks';
import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityId, LimbSlotId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { getProstheticBlueprint } from '../../sim/data/item-catalog.js';
import { LimbSlotCard, LimbSlotConfig } from './LimbSlotCard.js';
import { AnatomyGraftPanel } from './AnatomyGraftPanel.js';

export interface AnatomyWindowProps {
  readonly state: Readonly<WorldState>;
  readonly actorId: EntityId;
  readonly onCommand: (cmd: GameCommand) => void;
}

const HUMAN_LIMBS: readonly LimbSlotConfig[] = [
  { slot: 'HEAD', name: 'Head', keyNum: '1' },
  { slot: 'LEFT_ARM', name: 'Left Arm', keyNum: '2' },
  { slot: 'TORSO', name: 'Torso', keyNum: '3' },
  { slot: 'RIGHT_ARM', name: 'Right Arm', keyNum: '4' },
  { slot: 'LEFT_LEG', name: 'Left Leg', keyNum: '5' },
  { slot: 'RIGHT_LEG', name: 'Right Leg', keyNum: '6' },
];

export function AnatomyWindow({ state, actorId, onCommand }: AnatomyWindowProps) {
  const actor = state.entities[actorId];
  const anatomy = actor?.anatomy;
  const inv = actor?.inventory;

  const [selectedSlot, setSelectedSlot] = useState<LimbSlotId>('HEAD');

  // Keyboard navigation for [1-6] slot selection, [r] repair, [u] uninstall
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key;

      const found = HUMAN_LIMBS.find((l) => l.keyNum === key);
      if (found) {
        e.preventDefault();
        setSelectedSlot(found.slot);
        return;
      }

      if (key.toLowerCase() === 'r') {
        e.preventDefault();
        onCommand({ type: 'REPAIR_LIMB', actorId, slot: selectedSlot });
      } else if (key.toLowerCase() === 'u') {
        const limb = anatomy?.limbs[selectedSlot];
        if (limb?.installedProstheticEntityId) {
          e.preventDefault();
          onCommand({ type: 'REMOVE_PROSTHETIC', actorId, slot: selectedSlot });
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedSlot, anatomy, actorId, onCommand]);

  if (!actor || !anatomy || !inv) return null;

  const selectedLimb = anatomy.limbs[selectedSlot];
  const installedProsthetic = selectedLimb?.installedProstheticEntityId
    ? state.entities[selectedLimb.installedProstheticEntityId]
    : undefined;

  const prostheticBp = installedProsthetic?.prostheticSpec
    ? getProstheticBlueprint(installedProsthetic.prostheticSpec.blueprintId)
    : undefined;

  // Find compatible uninstalled prosthetics in inventory
  const compatibleInSatchel = inv.containedEntityIds
    .map((id) => state.entities[id])
    .filter(
      (e): e is EntityRecord =>
        e !== undefined && e.prostheticSpec?.targetLimbSlot === selectedSlot,
    );

  const isGraftReady = (slot: LimbSlotId) =>
    inv.containedEntityIds.some(
      (id) => state.entities[id]?.prostheticSpec?.targetLimbSlot === slot,
    );

  // Check if player has brass gears for repair
  const brassGears = inv.containedEntityIds
    .map((id) => state.entities[id])
    .find((e) => e?.item?.blueprintId === 'mat_brass_gears');
  const gearsCount = brassGears?.item?.quantity ?? 0;
  const canRepair = gearsCount >= 1 && anatomy.steamReserveKpa >= 15;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '14px', flex: 1 }}>
      {/* Left Column: 2D Spatial Vitruvian Paperdoll Grid */}
      <div class="panel-box" style={{ display: 'flex', flexDirection: 'column' }}>
        <div class="panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>VITRUVIAN CLOCKWORK PAPERDOLL</span>
          <span class="muted" style={{ fontSize: '10px' }}>[1–6] select slot</span>
        </div>

        {/* Spatial Limb Doll Layout */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: 'auto 0' }}>
          {/* Head Row */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <LimbSlotCard
              config={HUMAN_LIMBS[0]!}
              limb={anatomy.limbs.HEAD}
              installed={anatomy.limbs.HEAD?.installedProstheticEntityId ? state.entities[anatomy.limbs.HEAD.installedProstheticEntityId] : undefined}
              isSelected={selectedSlot === 'HEAD'}
              onSelect={() => setSelectedSlot('HEAD')}
              graftReady={isGraftReady('HEAD')}
            />
          </div>

          {/* Torso & Arms Row */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
            <LimbSlotCard
              config={HUMAN_LIMBS[1]!}
              limb={anatomy.limbs.LEFT_ARM}
              installed={anatomy.limbs.LEFT_ARM?.installedProstheticEntityId ? state.entities[anatomy.limbs.LEFT_ARM.installedProstheticEntityId] : undefined}
              isSelected={selectedSlot === 'LEFT_ARM'}
              onSelect={() => setSelectedSlot('LEFT_ARM')}
              graftReady={isGraftReady('LEFT_ARM')}
            />
            <LimbSlotCard
              config={HUMAN_LIMBS[2]!}
              limb={anatomy.limbs.TORSO}
              installed={anatomy.limbs.TORSO?.installedProstheticEntityId ? state.entities[anatomy.limbs.TORSO.installedProstheticEntityId] : undefined}
              isSelected={selectedSlot === 'TORSO'}
              onSelect={() => setSelectedSlot('TORSO')}
              graftReady={isGraftReady('TORSO')}
            />
            <LimbSlotCard
              config={HUMAN_LIMBS[3]!}
              limb={anatomy.limbs.RIGHT_ARM}
              installed={anatomy.limbs.RIGHT_ARM?.installedProstheticEntityId ? state.entities[anatomy.limbs.RIGHT_ARM.installedProstheticEntityId] : undefined}
              isSelected={selectedSlot === 'RIGHT_ARM'}
              onSelect={() => setSelectedSlot('RIGHT_ARM')}
              graftReady={isGraftReady('RIGHT_ARM')}
            />
          </div>

          {/* Legs Row */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
            <LimbSlotCard
              config={HUMAN_LIMBS[4]!}
              limb={anatomy.limbs.LEFT_LEG}
              installed={anatomy.limbs.LEFT_LEG?.installedProstheticEntityId ? state.entities[anatomy.limbs.LEFT_LEG.installedProstheticEntityId] : undefined}
              isSelected={selectedSlot === 'LEFT_LEG'}
              onSelect={() => setSelectedSlot('LEFT_LEG')}
              graftReady={isGraftReady('LEFT_LEG')}
            />
            <LimbSlotCard
              config={HUMAN_LIMBS[5]!}
              limb={anatomy.limbs.RIGHT_LEG}
              installed={anatomy.limbs.RIGHT_LEG?.installedProstheticEntityId ? state.entities[anatomy.limbs.RIGHT_LEG.installedProstheticEntityId] : undefined}
              isSelected={selectedSlot === 'RIGHT_LEG'}
              onSelect={() => setSelectedSlot('RIGHT_LEG')}
              graftReady={isGraftReady('RIGHT_LEG')}
            />
          </div>
        </div>

        <div style={{ marginTop: 'auto', borderTop: '1px solid #1c2833', paddingTop: '6px', fontSize: '10px', color: '#7f8c8d' }}>
          Biomechanical status: Red bars indicate critical tissue damage. Graft prosthetics to restore function.
        </div>
      </div>

      {/* Right Column: Surgical Dossier & Field Repair */}
      <AnatomyGraftPanel
        selectedSlot={selectedSlot}
        slotKeyNum={HUMAN_LIMBS.find((l) => l.slot === selectedSlot)?.keyNum}
        selectedLimb={selectedLimb}
        installedProsthetic={installedProsthetic}
        prostheticBp={prostheticBp}
        compatibleInSatchel={compatibleInSatchel}
        gearsCount={gearsCount}
        canRepair={canRepair}
        actorId={actorId}
        onCommand={onCommand}
      />
    </div>
  );
}
