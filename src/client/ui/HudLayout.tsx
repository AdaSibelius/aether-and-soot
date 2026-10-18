import { SimEvent } from '../../schemas/events.schema.js';
import { EntityIdSchema } from '../../schemas/primitives.schema.js';
import { GameCommand } from '../../schemas/commands.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { AnatomyDoll } from './AnatomyDoll.js';
import { MarketLedger } from './MarketLedger.js';
import { SatchelPanel } from './SatchelPanel.js';

export interface HudLayoutProps {
  readonly state: WorldState;
  readonly onCommand: (command: GameCommand) => void;
}

export function formatEventMessage(ev: SimEvent): string {
  switch (ev.type) {
    case 'ENTITY_MOVED':
      return `[T${ev.turn}] ${ev.actorId} walked to (${ev.to.x}, ${ev.to.y}, ${ev.to.stratum}).`;
    case 'MOVEMENT_BLOCKED':
      return `[T${ev.turn}] Passage blocked at (${ev.attemptedPoint.x}, ${ev.attemptedPoint.y}) [${ev.reason}]!`;
    case 'STRATUM_CHANGED':
      return `[T${ev.turn}] Traversed portal from ${ev.fromStratum} to ${ev.toStratum}!`;
    case 'PORTAL_FAILED':
      return `[T${ev.turn}] Portal malfunction: ${ev.reason}`;
    case 'ACTOR_WAITED':
      return `[T${ev.turn}] Standing ground. Steam accumulator cycling.`;
    case 'STEAM_VENTED':
      return `[T${ev.turn}] Pressure valve released: -${ev.pressureReleasedKpa} kPa steam vented.`;
    case 'LIMB_DAMAGED':
      return `[T${ev.turn}] IMPACT! ${ev.slot} sustained ${ev.damage} damage (${ev.remainingHp}/${ev.maxHp} HP).`;
    case 'LIMB_AMPUTATED':
      return `[T${ev.turn}] CATASTROPHIC FAILURE! ${ev.slot} severed! Hemorrhaging initiated.`;
    case 'PROSTHETIC_INSTALLED':
      return `[T${ev.turn}] Fitted ${ev.prostheticBlueprintId} to ${ev.slot}.`;
    case 'PROSTHETIC_REMOVED':
      return `[T${ev.turn}] Unseated prosthetic from ${ev.slot}.`;
    case 'PROSTHETIC_ACTION_FAILED':
      return `[T${ev.turn}] Surgery failed: ${ev.reason}`;
    case 'STEAM_REFILLED':
      return `[T${ev.turn}] Steam pressurized: +${ev.pressureAddedKpa} kPa (Current: ${ev.currentPressureKpa} kPa).`;
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
    case 'MERCHANT_TRADE_COMPLETED':
      return `[T${ev.turn}] Trade (${ev.tradeType}): ${ev.quantity}x ${ev.itemName} for ${ev.totalPence}d (Treasury: ${ev.playerTreasuryAfter}d).`;
    case 'TRADE_ACTION_FAILED':
      return `[T${ev.turn}] Trade (${ev.action}) failed: ${ev.reason}`;
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
            Turn {state.turnCount} (Tick #{state.macroTickCount})
          </span>
        </div>
        <div class="stat-row">
          <span>Sanguine Volume:</span>
          <span>{player?.anatomy?.bloodVolumePct ?? 0}%</span>
        </div>
        <div class="stat-row">
          <span>Steam Pressure:</span>
          <span>{player?.anatomy?.steamReserveKpa ?? 0} kPa</span>
        </div>
        <div class="stat-row">
          <span>Treasury:</span>
          <span class="brass-text">{state.economy.playerTreasuryPence}d</span>
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
            [R] Refill Boiler (+50 kPa)
          </button>
          <button
            type="button"
            onClick={() =>
              onCommand({
                type: 'VENT_STEAM',
                actorId: playerId,
                pressureVentedKpa: 25,
              })
            }
          >
            [V] Emergency Vent (25 kPa)
          </button>
          <button
            type="button"
            onClick={() => onCommand({ type: 'WAIT_TURN', actorId: playerId })}
          >
            [Space] Wait 1 Turn
          </button>
        </div>
      </div>

      <div class="panel-box">
        <div class="panel-header">TELEMETRY &amp; ACTION CHRONICLE</div>
        <div class="event-log">
          {recentEvents.length === 0 && <div class="event-item">Awaiting boiler ignition...</div>}
          {recentEvents.map((ev, idx) => (
            <div key={`${ev.type}-${ev.turn}-${idx}`} class="event-item">
              {formatEventMessage(ev)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
