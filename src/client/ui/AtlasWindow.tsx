import { useState } from 'preact/hooks';
import { GameCommand } from '../../schemas/commands.schema.js';
import { BlueprintId, BlueprintIdSchema, EntityId, StratumId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { getTileCell } from '../../sim/spatial/grid.js';

export interface AtlasWindowProps {
  readonly state: Readonly<WorldState>;
  readonly actorId: EntityId;
  readonly onCommand: (cmd: GameCommand) => void;
}

interface DistrictInfo {
  readonly id: BlueprintId;
  readonly name: string;
  readonly dominantStratum: StratumId;
  readonly cartel: string;
  readonly smog: string;
  readonly description: string;
}

const DISTRICT_ROSTER: readonly DistrictInfo[] = [
  { id: BlueprintIdSchema.parse('district_spitalfields_soot_works'), name: 'Spitalfields Soot-Works & Foundry Row', dominantStratum: 'STREET', cartel: 'Ironmongers Cartel', smog: '65% Particulate', description: 'Bessemer furnaces, smokeless coal silos, and arterial pneumatic transit gates.' },
  { id: BlueprintIdSchema.parse('district_fleet_ditch_undercroft'), name: 'Fleet Ditch Flooded Undercroft', dominantStratum: 'UNDERCROFT', cartel: 'Undercroft Syndicate', smog: '85% Toxic Miasma', description: 'Flooded subterranean sewers, sump scavenger camps, and illicit aether stills.' },
  { id: BlueprintIdSchema.parse('district_belgravia_brass_spires'), name: 'Belgravia Brass Spires & Sky-Walks', dominantStratum: 'SPIRE', cartel: 'Clockwork Guild', smog: '15% High-Altitude Venting', description: 'Sky-high brass catwalks, pneumatic freight lifts, and aristocratic watchtowers.' },
];

const STRATA_ORDER: readonly { id: StratumId; label: string; altitude: string }[] = [
  { id: 'SPIRE', label: 'SPIRE', altitude: '+40m Catwalks' },
  { id: 'STREET', label: 'STREET', altitude: '0m Cobblestones' },
  { id: 'UNDERCROFT', label: 'UNDERCROFT', altitude: '-15m Sewers' },
];

export function AtlasWindow({ state, actorId, onCommand }: AtlasWindowProps) {
  const player = state.entities[actorId];
  const playerPos = player?.position;
  const currentDistrict = state.currentDistrictId ?? 'district_spitalfields_soot_works';

  const [selectedStratum, setSelectedStratum] = useState<StratumId>(
    playerPos?.stratum ?? 'STREET',
  );

  const grid = state.strata[selectedStratum];

  // Detect if player is adjacent to any district transit gate
  const adjacentGate = playerPos
    ? Object.values(state.entities).find((e) => {
        if (!e.districtGate || !e.position || e.position.stratum !== playerPos.stratum) return false;
        return Math.max(Math.abs(e.position.x - playerPos.x), Math.abs(e.position.y - playerPos.y)) <= 1;
      })
    : undefined;

  // Build entity map for selected stratum
  const entitiesOnStratum = Object.values(state.entities).filter(
    (e) => e.position && e.position.stratum === selectedStratum,
  );
  const entityPosMap = new Map<string, typeof entitiesOnStratum[0]>();
  for (const ent of entitiesOnStratum) {
    if (ent.position) {
      const key = `${ent.position.x},${ent.position.y}`;
      if (!entityPosMap.has(key) || ent.id === actorId || ent.actor) {
        entityPosMap.set(key, ent);
      }
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px', flex: 1, minHeight: 0 }}>
      {/* Left Column: 3-Strata Cross-Section Minimap */}
      <div class="panel-box" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div class="panel-header" style={{ margin: 0, border: 'none' }}>
            3-STRATA CROSS-SECTION MAP
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {STRATA_ORDER.map((stratum) => {
              const isActive = selectedStratum === stratum.id;
              const isPlayerHere = playerPos?.stratum === stratum.id;
              return (
                <button
                  key={stratum.id}
                  type="button"
                  onClick={() => setSelectedStratum(stratum.id)}
                  style={{
                    padding: '2px 6px',
                    fontSize: '10px',
                    background: isActive ? '#243342' : 'transparent',
                    border: isActive ? '1px solid var(--brass-gold)' : '1px solid #2e4053',
                    color: isActive ? 'var(--brass-gold)' : '#7f8c8d',
                  }}
                >
                  {stratum.label} {isPlayerHere ? '(@)' : ''}
                </button>
              );
            })}
          </div>
        </div>

        {/* 24x20 Minimap ASCII Grid */}
        <div
          style={{
            flex: 1,
            background: '#070a0c',
            border: '1px solid #1c2833',
            padding: '4px',
            fontFamily: 'monospace',
            lineHeight: '11px',
            fontSize: '10px',
            letterSpacing: '1px',
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {grid &&
            Array.from({ length: grid.height }, (_, y) => (
              <div key={y} style={{ display: 'flex', height: '11px' }}>
                {Array.from({ length: grid.width }, (_, x) => {
                  const isPlayer = playerPos?.x === x && playerPos.y === y && playerPos.stratum === selectedStratum;
                  if (isPlayer) return <span key={x} style={{ color: 'var(--ok-green)', fontWeight: 'bold' }}>@</span>;
                  const ent = entityPosMap.get(`${x},${y}`);
                  if (ent) {
                    const color = ent.districtGate ? '#2e86c1' : ent.aiController?.hostile ? '#ec7063' : ent.aiController?.role === 'MERCHANT' ? '#d4af37' : '#f4d03f';
                    return <span key={x} style={{ color, fontWeight: 'bold' }}>{ent.visual.glyph}</span>;
                  }
                  const cell = getTileCell(grid, x, y);
                  if (cell?.terrainType === 'WOODEN_DOOR_CLOSED') return <span key={x} style={{ color: '#cd7f32' }}>+</span>;
                  if (cell?.terrainType === 'WOODEN_DOOR_OPEN') return <span key={x} style={{ color: '#cd7f32' }}>/</span>;
                  if (cell?.blocksMovement) return <span key={x} style={{ color: '#34495e' }}>#</span>;
                  return <span key={x} style={{ color: '#17202a' }}>·</span>;
                })}
              </div>
            ))}
        </div>

        {/* Minimap Key Legend */}
        <div style={{ fontSize: '9px', color: '#7f8c8d', marginTop: '6px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span><b style={{ color: 'var(--ok-green)' }}>@</b> You</span>
          <span><b style={{ color: '#f4d03f' }}>^/v</b> Lift</span>
          <span><b style={{ color: '#cd7f32' }}>&gt;/&lt;</b> Sump</span>
          <span><b style={{ color: '#2e86c1' }}>Ω</b> Gate</span>
          <span><b style={{ color: '#d4af37' }}>M</b> Trader</span>
          <span><b style={{ color: '#ec7063' }}>!</b> Hostile</span>
        </div>
      </div>

      {/* Right Column: Victorian London District Graph */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div class="panel-box" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div class="panel-header">LONDON DISTRICT OVERWORLD GRAPH</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            {DISTRICT_ROSTER.map((district) => {
              const isCurrent = currentDistrict === district.id;
              const canTravel = adjacentGate?.districtGate?.targetDistrictId === district.id;

              return (
                <div
                  key={district.id}
                  style={{
                    padding: '8px',
                    background: isCurrent ? '#16222f' : '#0d1316',
                    border: isCurrent ? '1px solid var(--brass-gold)' : '1px solid #1c2833',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span class={isCurrent ? 'brass-text' : 'parchment-text'} style={{ fontWeight: 'bold', fontSize: '11px' }}>
                      {district.name}
                    </span>
                    {isCurrent && (
                      <span style={{ fontSize: '10px', color: 'var(--ok-green)', fontWeight: 'bold' }}>
                        [CURRENT LOCATION]
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '10px', color: '#95a5a6', marginTop: '3px' }}>
                    Cartel: <span class="brass-text">{district.cartel}</span> | Miasma: {district.smog}
                  </div>
                  <div style={{ fontSize: '10px', color: '#7f8c8d', marginTop: '3px' }}>
                    {district.description}
                  </div>

                  {canTravel && (
                    <div style={{ marginTop: '6px' }}>
                      <button
                        type="button"
                        onClick={() =>
                          onCommand({
                            type: 'TRAVEL_DISTRICT',
                            actorId,
                            targetDistrictId: district.id,
                          })
                        }
                        style={{ padding: '3px 8px', fontSize: '10px', color: 'var(--brass-gold)' }}
                      >
                        [Fast-Travel Transit Gate &gt;&gt;]
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Stratum Elevation Telemetry */}
        <div class="panel-box">
          <div class="panel-header">VERTICAL ARCHITECTURE TELEMETRY</div>
          <div class="stat-row" style={{ fontSize: '11px' }}>
            <span>Active Stratum:</span>
            <span class="brass-text">{selectedStratum}</span>
          </div>
          <div class="stat-row" style={{ fontSize: '11px' }}>
            <span>Atmospheric Density:</span>
            <span>{selectedStratum === 'SPIRE' ? 'Thin Aetheric Vapor' : selectedStratum === 'STREET' ? 'Soot & Flue Smog' : 'Heavy Sump Water'}</span>
          </div>
          <div class="stat-row" style={{ fontSize: '11px' }}>
            <span>Entities Tracked:</span>
            <span>{entitiesOnStratum.length} objects &amp; actors</span>
          </div>
        </div>
      </div>
    </div>
  );
}
