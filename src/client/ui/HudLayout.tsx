import { GameCommand } from '../../schemas/commands.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityIdSchema } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { AnatomyDoll } from './AnatomyDoll.js';
import { MarketLedger } from './MarketLedger.js';
import { SatchelPanel } from './SatchelPanel.js';

export interface HudLayoutProps {
  readonly state: Readonly<WorldState>;
  readonly onCommand: (cmd: GameCommand) => void;
}

function formatEventMessage(ev: SimEvent): string {
  switch (ev.type) {
    case 'ENTITY_MOVED':
      return `[T${ev.turn}] Stepped to (${ev.to.x}, ${ev.to.y}) on ${ev.to.stratum} [${ev.apSpent} AP]`;
    case 'MOVEMENT_BLOCKED':
      return `[T${ev.turn}] Movement blocked (${ev.reason}) at (${ev.target.x}, ${ev.target.y})`;
    case 'STRATUM_CHANGED':
      return `[T${ev.turn}] Traversed portal: ${ev.fromStratum} -> ${ev.toStratum}`;
    case 'PORTAL_FAILED':
      return `[T${ev.turn}] Portal traversal failed: ${ev.reason}`;
    case 'ACTOR_WAITED':
      return `[T${ev.turn}] Artificer holds position and checks pressure gauges.`;
    case 'STEAM_VENTED':
      return `[T${ev.turn}] Vented ${ev.pressureReleasedKpa} kPa superheated steam!`;
    case 'LIMB_DAMAGED':
      return `[T${ev.turn}] ${ev.slot} took ${ev.damage} dmg (${ev.remainingHp} HP left)`;
    case 'LIMB_AMPUTATED':
      return `[T${ev.turn}] CRITICAL: ${ev.slot} severed!`;
    case 'PROSTHETIC_INSTALLED':
      return `[T${ev.turn}] Installed prosthetic into ${ev.slot} socket.`;
    case 'PROSTHETIC_REMOVED':
      return `[T${ev.turn}] Detached prosthetic from ${ev.slot} socket.`;
    case 'PROSTHETIC_ACTION_FAILED':
      return `[T${ev.turn}] Tinkering failed on ${ev.slot}: ${ev.reason}`;
    case 'STEAM_REFILLED':
      return `[T${ev.turn}] Boiler re-pressurized to ${ev.newReserveKpa} kPa.`;
    case 'VESSEL_RUPTURED':
      return `[T${ev.turn}] BOILER RUPTURE! ${ev.releasedPressureKpa} kPa blasted at (${ev.origin.x}, ${ev.origin.y})!`;
    case 'COAL_DUST_IGNITED':
      return `[T${ev.turn}] FLASH FIRE! ${ev.ignitedTileCount} coal dust tiles ignited!`;
    case 'THERMAL_SCALD':
      return `[T${ev.turn}] SCALD! Superheated steam (${ev.steamPressureKpa} kPa) burns ${ev.slot}!`;
    case 'PEDESTAL_STOCKED':
      return `[T${ev.turn}] Stocked ${ev.quantity}x ${ev.commodity} on display pedestal.`;
    case 'SUPPLY_SHOCK_TRIGGERED':
      return `[T${ev.turn}] SUPPLY SHOCK! ${ev.commodity} -> ${ev.newPricePence}d (${ev.factionAffected} rep: ${ev.newReputation})`;
    case 'STOREFRONT_SALE_COMPLETED':
      return `[T${ev.turn}] SALE! Sold ${ev.unitsSold}x ${ev.commodity} for ${ev.revenuePence}d!`;
    case 'MACRO_TICK_COMPLETED':
      return `[T${ev.turn}] === District Macro-Tick #${ev.macroTickIndex} Processed ===`;
    case 'ITEM_PICKED_UP':
      return `[T${ev.turn}] Pocketed ${ev.quantity}x ${ev.itemName}${ev.stackedIntoEntityId ? ' (stacked)' : ''}.`;
    case 'ITEM_DROPPED':
      return `[T${ev.turn}] Dropped ${ev.quantity}x ${ev.itemName} at (${ev.at.x}, ${ev.at.y}).`;
    case 'ITEM_USED':
      return `[T${ev.turn}] Used ${ev.itemName}: +${Math.round(ev.amountRestored)} ${ev.effect === 'RESTORE_BLOOD' ? '% blood' : 'kPa steam'} (${ev.remainingQuantity} left).`;
    case 'INVENTORY_ACTION_FAILED':
      return `[T${ev.turn}] ${ev.action} failed: ${ev.reason}`;
    case 'DOOR_TOGGLED':
      return `[T${ev.turn}] ${ev.newState === 'OPEN' ? 'Opened' : 'Closed'} door at (${ev.at.x}, ${ev.at.y}).`;
    case 'DISTRICT_TRAVELED':
      return `[T${ev.turn}] Traveled to ${ev.toDistrictId}!`;
    case 'TRANSIT_ACTION_FAILED':
      return `[T${ev.turn}] Transit (${ev.action}) failed: ${ev.reason}`;
    case 'ITEM_CRAFTED':
      return `[T${ev.turn}] Crafted ${ev.quantity}x ${ev.outputName} (-${ev.steamSpentKpa} kPa steam).`;
    case 'ITEM_SALVAGED':
      return `[T${ev.turn}] Salvaged ${ev.salvagedItemName} -> ${ev.recoveredQuantity}x ${ev.recoveredMaterialBlueprintId}.`;
    case 'LIMB_REPAIRED':
      return `[T${ev.turn}] Repaired ${ev.slot} (+${ev.hpRestored} HP, now ${ev.newHp} HP).`;
    case 'CRAFTING_FAILED':
      return `[T${ev.turn}] Artificer ${ev.action} failed: ${ev.reason}`;
    case 'COMBAT_ATTACK_RESOLVED':
      return ev.hit
        ? `[T${ev.turn}] ${ev.attackerId} struck ${ev.targetId}'s ${ev.targetSlot} for ${ev.damageDealt} dmg!`
        : `[T${ev.turn}] ${ev.attackerId}'s strike at ${ev.targetId}'s ${ev.targetSlot} missed!`;
    case 'ACTOR_DEFEATED':
      return `[T${ev.turn}] DEFEATED! ${ev.actorName} collapsed (${ev.droppedEntityIds.length} items dropped)!`;
    case 'COMBAT_ACTION_FAILED':
      return `[T${ev.turn}] Attack failed: ${ev.reason}`;
  }
}

export function HudLayout({ state, onCommand }: HudLayoutProps) {
  const playerId = EntityIdSchema.parse('actor_player');
  const striderLegId = EntityIdSchema.parse('item_pneumatic_strider_leg');
  const monocleId = EntityIdSchema.parse('item_aetheric_monocle');
  const player = state.entities[playerId];
  const recentEvents = state.eventLog.slice(-6).reverse();

  return (
    <div class="hud-sidebar">
      <div class="panel-box">
        <div class="panel-header">AETHER &amp; SOOT // TELEMETRY</div>
        <div class="stat-row">
          <span>Stratum:</span>
          <span class="brass-text">{player?.position?.stratum ?? 'STREET'}</span>
        </div>
        <div class="stat-row">
          <span>Coordinates:</span>
          <span>
            ({player?.position?.x ?? 0}, {player?.position?.y ?? 0})
          </span>
        </div>
        <div class="stat-row">
          <span>Chronometer:</span>
          <span>
            Turn {state.turnCount} | Macro #{state.macroTickCount}
          </span>
        </div>
        <div class="stat-row">
          <span>Encumbrance:</span>
          <span>
            {player?.inventory?.currentMassGrams ?? 0} / {player?.inventory?.maxMassGrams ?? 25000} g
          </span>
        </div>
      </div>

      <AnatomyDoll anatomy={player?.anatomy} />

      <SatchelPanel state={state} actorId={playerId} onCommand={onCommand} />

      <MarketLedger economy={state.economy} onCommand={onCommand} />

      <div class="panel-box">
        <div class="panel-header">TACTICAL &amp; TINKERING BENCH</div>
        <div class="button-grid">
          <button
            type="button"
            onClick={() => onCommand({ type: 'USE_PORTAL', actorId: playerId })}
          >
            [&gt;/&lt;] Traverse Portal
          </button>
          <button
            type="button"
            onClick={() =>
              onCommand({
                type: 'INSTALL_PROSTHETIC',
                actorId: playerId,
                prostheticEntityId: striderLegId,
                slot: 'LEFT_LEG',
              })
            }
          >
            [1] Socket Pneumatic Strider (L.Leg)
          </button>
          <button
            type="button"
            onClick={() =>
              onCommand({
                type: 'INSTALL_PROSTHETIC',
                actorId: playerId,
                prostheticEntityId: monocleId,
                slot: 'OCULAR_MOUNT',
              })
            }
          >
            [2] Socket Aetheric Monocle (Ocular)
          </button>
          <button
            type="button"
            onClick={() =>
              onCommand({
                type: 'REFILL_STEAM',
                actorId: playerId,
                pressureAddedKpa: 50,
              })
            }
          >
            [R] Stoker Boiler (+50 kPa Steam)
          </button>
          <button
            type="button"
            onClick={() => {
              if (!player?.position) return;
              onCommand({
                type: 'VENT_STEAM',
                actorId: playerId,
                target: {
                  x: player.position.x,
                  y: player.position.y,
                  stratum: player.position.stratum,
                },
                pressureReleasedKpa: 45,
              });
            }}
          >
            [V] Vent Boiler Steam
          </button>
        </div>
      </div>

      <div class="panel-box log-box">
        <div class="panel-header">CHRONICLE LOG</div>
        {recentEvents.length === 0 ? (
          <div class="log-entry muted">Awaiting pneumatic actuation...</div>
        ) : (
          recentEvents.map((ev, idx) => (
            <div key={`${ev.turn}-${idx}`} class="log-entry">
              {formatEventMessage(ev)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
