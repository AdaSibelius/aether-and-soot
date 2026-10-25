export interface TickerTapeLogProps {
  readonly chronicleLines: readonly string[];
}

export function TickerTapeLog({ chronicleLines }: TickerTapeLogProps) {
  return (
    <div class="panel-box log-box" style={{ background: '#1c1611', borderColor: 'var(--brass-gold)' }}>
      <div class="panel-header" style={{ color: 'var(--brass-gold)', borderBottom: '1px solid #4a3b2c' }}>
        <span>╔═[ EDISON TICKER-TAPE CHRONICLE ]═╗</span>
      </div>
      <div style={{ maxHeight: '110px', overflowY: 'hidden', padding: '2px 4px' }}>
        {chronicleLines.length === 0 ? (
          <div class="log-entry muted" style={{ fontStyle: 'italic', color: '#7f6b55' }}>
            [··] Telegraph circuit idle. Awaiting pneumatic actuation...
          </div>
        ) : (
          chronicleLines.map((line, idx) => (
            <div
              key={`ticker-${idx}`}
              class="log-entry"
              style={{
                fontSize: '11px',
                lineHeight: '1.3',
                color: idx === 0 ? '#f5e6cb' : '#c2b299',
                display: 'flex',
                alignItems: 'flex-start',
                marginBottom: '2px',
              }}
            >
              <span style={{ color: 'var(--brass-gold)', marginRight: '5px', flexShrink: 0 }}>»</span>
              <span>{line}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
