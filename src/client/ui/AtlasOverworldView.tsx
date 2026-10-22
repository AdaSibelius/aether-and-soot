import { useState } from 'preact/hooks';
import { AtlasViewMode } from '../../schemas/atlas.schema.js';
import {
  FACTION_INFLUENCE_HEATMAP,
  generateMacroTopographyGrid,
  NATURAL_OVERWORLD_BARRIERS,
  TRANSIT_MONORAIL_ROUTES,
} from '../../sim/spatial/overworld-matrix.js';

export interface AtlasOverworldViewProps {
  readonly mode: AtlasViewMode;
  readonly currentDistrictId: string;
}

export function AtlasOverworldView({ mode, currentDistrictId }: AtlasOverworldViewProps) {
  const [hoveredNode, setHoveredNode] = useState<string | undefined>();
  const topoGrid = generateMacroTopographyGrid();

  if (mode === 'TOPOGRAPHY' || mode === 'WATERWAYS') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '8px' }}>
        <div class="panel-header" style={{ margin: 0, border: 'none' }}>
          {mode === 'TOPOGRAPHY' ? 'GREATER LONDON MACRO-TOPOGRAPHY' : 'THAMES ESTUARY & CANAL WATERWAYS'}
        </div>
        <div
          style={{
            flex: 1,
            background: '#070a0c',
            border: '1px solid #1c2833',
            padding: '8px',
            fontFamily: 'monospace',
            lineHeight: '13px',
            fontSize: '11px',
            letterSpacing: '2px',
            overflow: 'auto',
          }}
        >
          {topoGrid.map((row, y) => (
            <div key={y} style={{ display: 'flex' }}>
              {row.map((cell) => {
                const isCurrent = cell.districtId === currentDistrictId;
                const isWater = cell.feature === 'WATER';
                const isHighlighted = mode === 'WATERWAYS' ? isWater : true;
                const fg = isCurrent ? 'var(--ok-green)' : isHighlighted ? cell.fgColor : '#2C3E50';

                return (
                  <span
                    key={cell.x}
                    onMouseEnter={() => setHoveredNode(cell.label ?? cell.feature)}
                    onMouseLeave={() => setHoveredNode(undefined)}
                    style={{
                      color: fg,
                      fontWeight: cell.districtId ? 'bold' : 'normal',
                      cursor: cell.districtId ? 'pointer' : 'default',
                      padding: '0 1px',
                    }}
                  >
                    {isCurrent ? '@' : cell.glyph}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
        <div style={{ fontSize: '10px', color: '#95a5a6', background: '#0e161a', padding: '6px', border: '1px solid #1c2833' }}>
          <span><b>Inspection:</b> {hoveredNode ?? 'Hover over topographical landmarks for elevation data.'}</span>
        </div>
      </div>
    );
  }

  if (mode === 'FACTIONS') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '8px' }}>
        <div class="panel-header" style={{ margin: 0, border: 'none' }}>
          FACTION TERRITORIAL CONTROL HEATMAP
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'auto' }}>
          {FACTION_INFLUENCE_HEATMAP.map((f) => (
            <div key={f.factionId} style={{ padding: '8px', background: '#0d1316', border: '1px solid #1c2833' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: f.color, fontWeight: 'bold', fontSize: '11px' }}>{f.factionName}</span>
                <span class="brass-text" style={{ fontSize: '11px', fontWeight: 'bold' }}>{f.influencePct}% Control</span>
              </div>
              <div style={{ background: '#1c2833', height: '6px', margin: '4px 0', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${f.influencePct}%`, background: f.color, height: '100%' }} />
              </div>
              <div style={{ fontSize: '9px', color: '#7f8c8d' }}>{f.territoryDescription}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // MONORAILS
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '8px' }}>
      <div class="panel-header" style={{ margin: 0, border: 'none' }}>
        PNEUMATIC MONORAIL TRANSIT ARTERIES
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'auto' }}>
        {TRANSIT_MONORAIL_ROUTES.map((route) => (
          <div key={route.routeId} style={{ padding: '8px', background: '#0d1316', border: '1px solid #1c2833' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span class="brass-text" style={{ fontWeight: 'bold', fontSize: '11px' }}>{route.name}</span>
              <span style={{ fontSize: '10px', color: 'var(--ok-green)' }}>[{route.status}]</span>
            </div>
            <div style={{ fontSize: '10px', color: '#95a5a6', marginTop: '2px' }}>
              Terminus: <b>{route.stationName}</b> | Pressure: <span class="brass-text">{route.pressureOperatingKpa} kPa</span>
            </div>
            <div style={{ fontSize: '9px', color: '#7f8c8d', marginTop: '2px' }}>
              Connects: {route.fromDistrictId} &gt;&gt; {route.toDistrictId}
            </div>
          </div>
        ))}
        <div class="panel-header" style={{ margin: '6px 0 2px 0', border: 'none' }}>
          NATURAL BARRIER TRANSIT TOLLS
        </div>
        {NATURAL_OVERWORLD_BARRIERS.map((b) => (
          <div key={b.id} style={{ padding: '6px', background: '#090e11', border: '1px solid #17202a', fontSize: '10px' }}>
            <span class="brass-text" style={{ fontWeight: 'bold' }}>{b.name}</span>
            <div style={{ color: '#7f8c8d', fontSize: '9px' }}>{b.description}</div>
            {b.tollPence && <div style={{ color: '#f5b041', fontSize: '9px' }}>Toll: {b.tollPence} Crown Pence</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
