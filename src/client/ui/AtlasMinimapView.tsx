import { EntityId, StratumId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { getTileCell, StratumGrid } from '../../sim/spatial/grid.js';

export interface AtlasMinimapViewProps {
  readonly state: Readonly<WorldState>;
  readonly selectedStratum: StratumId;
  readonly onSelectStratum: (stratum: StratumId) => void;
  readonly playerPos?: { x: number; y: number; stratum: StratumId } | undefined;
  readonly actorId: EntityId;
}

const STRATA_ORDER: readonly { id: StratumId; label: string; altitude: string }[] = [
  { id: 'SPIRE', label: 'SPIRE', altitude: '+40m Catwalks' },
  { id: 'STREET', label: 'STREET', altitude: '0m Cobblestones' },
  { id: 'UNDERCROFT', label: 'UNDERCROFT', altitude: '-15m Sewers' },
  { id: 'CATACOMBS', label: 'CATACOMBS', altitude: '-45m Crypts' },
];

export function AtlasMinimapView({
  state,
  selectedStratum,
  onSelectStratum,
  playerPos,
  actorId,
}: AtlasMinimapViewProps) {
  const grid: StratumGrid | undefined = state.strata[selectedStratum];

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div class="panel-header" style={{ margin: 0, border: 'none' }}>
          LOCAL STRATUM CROSS-SECTION
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {STRATA_ORDER.map((stratum) => {
            const isActive = selectedStratum === stratum.id;
            const isPlayerHere = playerPos?.stratum === stratum.id;
            return (
              <button
                key={stratum.id}
                type="button"
                onClick={() => onSelectStratum(stratum.id)}
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

      {/* ASCII Minimap Grid */}
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
                if (cell?.terrainType === 'CANAL_SLUICE') return <span key={x} style={{ color: '#2e86c1' }}>≈</span>;
                if (cell?.terrainType === 'TIMBER_PIER') return <span key={x} style={{ color: '#d4af37' }}>═</span>;
                if (cell?.terrainType === 'GOTHIC_COLONNADE') return <span key={x} style={{ color: '#f4d03f' }}>Ω</span>;
                if (cell?.terrainType === 'WROUGHT_IRON_FENCE') return <span key={x} style={{ color: '#7f8c8d' }}>▓</span>;
                if (cell?.blocksMovement) return <span key={x} style={{ color: '#34495e' }}>#</span>;
                return <span key={x} style={{ color: '#17202a' }}>·</span>;
              })}
            </div>
          ))}
      </div>

      {/* Legend & Telemetry */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', color: '#7f8c8d' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span><b style={{ color: 'var(--ok-green)' }}>@</b> Player</span>
          <span><b style={{ color: '#2e86c1' }}>Ω</b> Gate</span>
          <span><b style={{ color: '#2e86c1' }}>≈</b> Canal</span>
          <span><b style={{ color: '#f4d03f' }}>Ω</b> Viaduct</span>
          <span><b style={{ color: '#7f8c8d' }}>▓</b> Toll Wall</span>
          <span><b style={{ color: '#5dade2' }}>&gt;/&lt;</b> Sump</span>
        </div>
        <div>{entitiesOnStratum.length} entities tracked</div>
      </div>
    </div>
  );
}
