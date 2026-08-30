const fs = require('fs');
let app = fs.readFileSync('frontend/src/App.jsx', 'utf8');

// The exact string in the file right now:
const oldTicker = `// [HOTFIX]: Repaired infinite recursive render loop (React Error #185)
// Decoupled Header Ticker for Top Indices
const LiveIndexTicker = React.memo(() => {
  const prices = useStore(state => state.prices);
  const TOP_INDICES = ['NSE:NIFTY50-INDEX', 'NSE:NIFTYBANK-INDEX', 'BSE:SENSEX-INDEX'];
  return (
    <LiveIndexTicker />
  );
});`;

const newTicker = `// [HOTFIX]: Repaired infinite recursive render loop (React Error #185)
// Decoupled Header Ticker for Top Indices
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

// Because replace_file_content has fuzzy matching bugs that roll back code, we use exact replace
if (app.includes('return (\n    <LiveIndexTicker />\n  );')) {
    app = app.replace(/const LiveIndexTicker = React\.memo\(\(\) => \{[\s\S]*?return \([\s\S]*?<LiveIndexTicker \/>[\s\S]*?\);\s*\}\);/g, newTicker.replace('// [HOTFIX]: Repaired infinite recursive render loop (React Error #185)\n// Decoupled Header Ticker for Top Indices\n', ''));
    fs.writeFileSync('frontend/src/App.jsx', app);
    console.log("Successfully fixed LiveIndexTicker.");
} else {
    console.log("Could not find the exact broken LiveIndexTicker block.");
}
