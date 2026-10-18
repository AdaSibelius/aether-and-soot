import { useEffect } from 'preact/hooks';
import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { CHIRURGEON_FEE_PENCE, COMPANION_HIRE_FEE_PENCE } from '../../sim/systems/dialogue-quest.system.js';

export interface DialogueModalProps {
  readonly state: Readonly<WorldState>;
  readonly actorId: EntityId;
  readonly targetNpcId: EntityId;
  readonly onCommand: (cmd: GameCommand) => void;
  readonly onClose: () => void;
  readonly onOpenModal?: (windowId: 'INVENTORY' | 'ANATOMY' | 'WORKBENCH' | 'EXCHANGE' | 'ATLAS') => void;
}

export function DialogueModal({ state, actorId, targetNpcId, onCommand, onClose, onOpenModal }: DialogueModalProps) {
  const npc = state.entities[targetNpcId];
  const player = state.entities[actorId];
  const treasury = state.economy.playerTreasuryPence;
  const ai = npc?.aiController;
  const isCompanion = ai?.companionOfActorId === actorId;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key.toLowerCase() === 't') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!npc || !player || !ai) return null;

  const factionRep = state.economy.factionReputation[ai.factionId] ?? 0;
  const contracts = state.contracts.filter((c) => c.issuerNpcId === npc.id || c.factionId === ai.factionId);
  const isHireableRole = ai.role === 'GUARD' || ai.role === 'SCAVENGER' || ai.role === 'CITIZEN';

  const getGreeting = () => {
    if (isCompanion) return '"At your side, artificer. Point the way and I shall strike."';
    switch (ai.role) {
      case 'CHIRURGEON':
        return '"Flesh is frail in the soot works, traveler. For 35 pence, I can stitch wounds and replenish lost blood."';
      case 'FIXER':
        return '"Keep your voice low. The Syndicate always has profitable employment for capable operatives."';
      case 'GUARD':
        return '"Keep your weapons sheathed and maintain order in the sector."';
      case 'MERCHANT':
        return '"Finest brass and refined commodities in London. Take a look at the listings."';
      default:
        return '"Greetings, artificer. What brings you through this district?"';
    }
  };

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(5, 7, 9, 0.85)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      }}
    >
      <div
        class="panel-box"
        style={{
          width: '540px', maxHeight: '85vh', display: 'flex', flexDirection: 'column',
          background: '#0a0e11', border: '1px solid var(--brass-gold)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.9)', padding: '16px', gap: '12px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #23313d', paddingBottom: '8px' }}>
          <div>
            <span style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--brass-gold)' }}>
              {npc.visual.glyph} {npc.name}
            </span>
            <span style={{ fontSize: '11px', color: '#7f8c8d', marginLeft: '8px' }}>
              [{ai.role}] • {ai.factionId.replace(/_/g, ' ')} ({factionRep >= 0 ? `+${factionRep}` : factionRep})
            </span>
          </div>
          <button type="button" onClick={onClose} style={{ padding: '2px 8px', fontSize: '11px', color: '#e74c3c' }}>[Esc / T] Close</button>
        </div>

        {/* Dialogue Greeting */}
        <div style={{ fontSize: '12px', color: '#d5dbdb', fontStyle: 'italic', background: '#0e1418', padding: '10px', borderLeft: '3px solid var(--brass-gold)' }}>
          {getGreeting()}
        </div>

        {/* Player Treasury Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--brass-gold)' }}>
          <span>Your Satchel Treasury: {treasury}d</span>
          {isCompanion && <span class="ok-text">✓ Recruited Companion</span>}
        </div>

        {/* Specialist Services */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {ai.role === 'CHIRURGEON' && (
            <button
              type="button"
              disabled={treasury < CHIRURGEON_FEE_PENCE}
              onClick={() => onCommand({ type: 'PAY_CHIRURGEON_HEAL', actorId, chirurgeonId: npc.id })}
              style={{
                flex: 1, padding: '8px', fontSize: '11px', fontWeight: 'bold',
                color: treasury >= CHIRURGEON_FEE_PENCE ? 'var(--ok-green)' : '#7f8c8d',
                border: '1px solid #27ae60', background: '#0d1f14', cursor: treasury >= CHIRURGEON_FEE_PENCE ? 'pointer' : 'not-allowed',
              }}
            >
              [Heal] Full Surgical Care ({CHIRURGEON_FEE_PENCE}d)
            </button>
          )}

          {ai.role === 'MERCHANT' && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenModal?.('EXCHANGE');
              }}
              style={{
                flex: 1, padding: '8px', fontSize: '11px', fontWeight: 'bold',
                color: 'var(--brass-gold)', border: '1px solid var(--brass-gold)',
                background: '#1c2833', cursor: 'pointer',
              }}
            >
              [Open Exchange Ledger (M)]
            </button>
          )}

          {!isCompanion && isHireableRole && (
            <button
              type="button"
              disabled={treasury < COMPANION_HIRE_FEE_PENCE}
              onClick={() => onCommand({ type: 'HIRE_COMPANION', actorId, npcId: npc.id })}
              style={{
                flex: 1, padding: '8px', fontSize: '11px', fontWeight: 'bold',
                color: treasury >= COMPANION_HIRE_FEE_PENCE ? 'var(--brass-gold)' : '#7f8c8d',
                border: '1px solid var(--brass-gold)', background: '#1c2833', cursor: treasury >= COMPANION_HIRE_FEE_PENCE ? 'pointer' : 'not-allowed',
              }}
            >
              [Recruit] Hire as Allied Companion ({COMPANION_HIRE_FEE_PENCE}d)
            </button>
          )}
        </div>

        {/* Faction Contracts Board */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div class="panel-header" style={{ fontSize: '11px' }}>FACTION CONTRACTS & EXPEDITIONS</div>
          {contracts.length === 0 ? (
            <div class="muted" style={{ fontSize: '11px' }}>No active or available contracts from this party.</div>
          ) : (
            contracts.map((c) => {
              const isAvailable = c.status === 'AVAILABLE';
              const isActive = c.status === 'ACTIVE';
              const isCompleted = c.status === 'COMPLETED';

              const hasItem = c.kind === 'DELIVER_ITEM' && (player.inventory?.containedEntityIds ?? []).some(
                (id) => state.entities[id]?.item?.blueprintId === c.targetBlueprintOrEntityId,
              );
              const targetEntity = state.entities[c.targetBlueprintOrEntityId];
              const isTargetDead = c.kind === 'SLAY_HOSTILE' && (!targetEntity || targetEntity.anatomy?.limbs.TORSO?.amputated);
              const isBoilerPressurized = c.kind === 'PRESSURIZE_BOILER' && Boolean(
                targetEntity?.pressureVessel?.ruptured || (targetEntity?.pressureVessel?.currentPressureKpa ?? 0) >= 260,
              );
              const canComplete = isActive && (hasItem || isTargetDead || isBoilerPressurized);

              return (
                <div key={c.id} style={{ background: '#0e1418', border: '1px solid #1c2833', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#d5dbdb' }}>{c.title}</span>
                    <span style={{ fontSize: '10px', color: isCompleted ? 'var(--ok-green)' : isActive ? 'var(--brass-gold)' : '#7f8c8d' }}>
                      [{c.status}]
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#95a5a6' }}>{c.description}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <span class="copper-text" style={{ fontSize: '10px' }}>
                      Reward: {c.rewardPence}d • {c.rewardReputation >= 0 ? `+${c.rewardReputation}` : c.rewardReputation} Rep
                    </span>
                    {isAvailable && (
                      <button
                        type="button"
                        onClick={() => onCommand({ type: 'ACCEPT_CONTRACT', actorId, contractId: c.id })}
                        style={{ padding: '3px 8px', fontSize: '10px', color: 'var(--brass-gold)', border: '1px solid var(--brass-gold)' }}
                      >
                        Accept Contract
                      </button>
                    )}
                    {isActive && (
                      <button
                        type="button"
                        disabled={!canComplete}
                        onClick={() => onCommand({ type: 'COMPLETE_CONTRACT', actorId, contractId: c.id })}
                        style={{
                          padding: '3px 8px', fontSize: '10px',
                          color: canComplete ? 'var(--ok-green)' : '#7f8c8d',
                          border: canComplete ? '1px solid var(--ok-green)' : '1px solid #2c3e50',
                          cursor: canComplete ? 'pointer' : 'not-allowed',
                        }}
                      >
                        {canComplete ? 'Turn In / Claim Reward' : 'In Progress'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
