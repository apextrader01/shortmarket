const fs = require('fs');
let app = fs.readFileSync('frontend/src/App.jsx', 'utf8');

// 1. Fix LiveIndexTicker definition
const oldTicker = `  // Decoupled Header Ticker for Top Indices
  const LiveIndexTicker = React.memo(() => {
    const prices = useStore(state => state.prices);
    const TOP_INDICES = ['NSE:NIFTY50-INDEX', 'NSE:NIFTYBANK-INDEX', 'BSE:SENSEX-INDEX'];
    return (
      <LiveIndexTicker />
    );
  });`;

const newTicker = `  // Decoupled Header Ticker for Top Indices
  const LiveIndexTicker = React.memo(() => {
    const prices = useStore(state => state.prices);
    const TOP_INDICES = ['NSE:NIFTY50-INDEX', 'NSE:NIFTYBANK-INDEX', 'BSE:SENSEX-INDEX'];
    return (
      <div className="hide-on-tablet" style={{ display: 'flex', gap: '6px' }}>
        {TOP_INDICES.map((idx) => {
          const p      = prices[idx];
          const isUp   = p?.pct >= 0;
          return (
            <div
              key={idx}
              style={{
                display:      'flex',
                alignItems:   'center',
                gap:          '4px',
                background:   p
                  ? (isUp ? 'rgba(34,197,94,0.12)' : 'rgba(225,42,31,0.12)')
                  : 'rgba(255,255,255,0.05)',
                color: p
                  ? (isUp ? 'var(--color-green-light)' : 'var(--color-red-light)')
                  : 'var(--text-secondary)',
                padding:      '2px 6px',
                borderRadius: '12px',
                fontSize:     '10px',
                fontWeight:   '700',
              }}
            >
              {p && (isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />)}
              {idx.split('-')[0]}{' '}
              {p ? \`\${p.ltp.toFixed(2)}\` : '...'}
              {p && (
                <span style={{ opacity: 0.8, fontSize: '9px', marginLeft: '2px' }}>
                  {p.change !== undefined ? \`\${p.change > 0 ? '+' : ''}\${Number(p.change).toFixed(2)} (\${p.pct > 0 ? '+' : ''}\${Number(p.pct).toFixed(2)}%)\` : ''}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  });`;

if (app.includes(oldTicker)) {
    app = app.replace(oldTicker, newTicker);
}

// 2. Replace the inline TOP_INDICES block in App with <LiveIndexTicker />
const inlineBlockRegex = /<div className="hide-on-tablet" style=\{\{ display: 'flex', gap: '6px' \}\}>[\s\S]*?\{TOP_INDICES\.map\(\(idx\) => \{[\s\S]*?const p      = useStore\.getState\(\)\.prices\[idx\];[\s\S]*?<\/div>\s*\);\s*\}\)\}\s*<\/div>/g;

app = app.replace(inlineBlockRegex, "<LiveIndexTicker />");

fs.writeFileSync('frontend/src/App.jsx', app);
console.log("Fixed LiveIndexTicker and replaced inline block.");
