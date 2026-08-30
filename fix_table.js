const fs = require('fs');
let pt = fs.readFileSync('frontend/src/components/PositionsTable.jsx', 'utf8');

pt = pt.replace(/prices: state\.prices,?\s*/g, '');
pt = pt.replace(/, prices \} = useStore/, ' } = useStore');
pt = pt.replace(/prices,/g, '');

const wrapperCode = `
const LivePositionsTableRow = React.memo(({ pos, viewMode }) => {
  const priceData = useStore(state => state.prices[pos.symbol] || {});
  const ltp = priceData.ltp || pos.average_price || 0;
  
  const pnl = pos.quantity !== 0 ? (ltp - pos.average_price) * pos.quantity : parseFloat(pos.realized_pnl || 0);
  const pnlPct = pos.quantity !== 0 && pos.average_price > 0 ? ((ltp - pos.average_price) / pos.average_price) * 100 : 0;
  
  return (
    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <td style={{ padding: '10px 12px', fontWeight: '700' }}>
        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }} title={pos.symbol}>{pos.symbol}</div>
        <div style={{ fontSize: '10px', color: pos.quantity > 0 ? 'var(--color-green-light)' : (pos.quantity < 0 ? 'var(--color-red-light)' : 'var(--text-muted)') }}>
          {pos.quantity > 0 ? 'LONG' : (pos.quantity < 0 ? 'SHORT' : 'CLOSED')}
        </div>
      </td>
      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600' }}>{viewMode === 'CLOSED' && pos.closed_quantity ? Math.abs(pos.closed_quantity) : Math.abs(pos.quantity)}</td>
      <td style={{ padding: '10px 12px', textAlign: 'right' }}>'{pos.average_price.toFixed(2)}</td>
      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600' }}>'{viewMode === 'CLOSED' && pos.exit_price ? pos.exit_price.toFixed(2) : ltp.toFixed(2)}</td>
      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: pnl >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
        {pnl >= 0 ? '+' : ''}'{pnl.toFixed(2)}
      </td>
      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', color: pnlPct >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px' }}>
          {pnlPct >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
        </div>
      </td>
    </tr>
  );
});

const LiveTotalPnlBadge = React.memo(({ filteredPositions }) => {
  const prices = useStore(state => state.prices);
  let totalPnl = 0;
  filteredPositions.forEach(pos => {
    const ltp = prices[pos.symbol]?.ltp || pos.average_price || 0;
    const pnl = pos.quantity !== 0 ? (ltp - pos.average_price) * pos.quantity : parseFloat(pos.realized_pnl || 0);
    totalPnl += pnl;
  });
  if (filteredPositions.length === 0) return null;
  return (
    <div style={{
      fontSize: '13px', fontWeight: '700',
      color: totalPnl >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)',
      background: totalPnl >= 0 ? 'rgba(34,197,94,0.1)' : 'rgba(225,42,31,0.1)',
      padding: '4px 10px', borderRadius: '6px'
    }}>
      Total P&L: {totalPnl >= 0 ? '+' : ''}'{totalPnl.toFixed(2)}
    </div>
  );
});
`;

pt = pt.replace("export default function PositionsTable() {", wrapperCode + "\nexport default function PositionsTable() {");

// Remove inline math
const mathStart = `const positionsWithPnl = filteredPositions.map(pos => {`;
const mathEnd = `const totalPnl = positionsWithPnl.reduce((sum, p) => sum + p.pnl, 0);`;
const mSIdx = pt.indexOf(mathStart);
const mEIdx = pt.indexOf(mathEnd) + mathEnd.length;
if(mSIdx > -1 && mEIdx > mSIdx) {
  pt = pt.slice(0, mSIdx) + pt.slice(mEIdx);
}

// Replace references
pt = pt.replace(/positionsWithPnl\.length/g, 'filteredPositions.length');

// Replace badge
const badgeRegex = /\{filteredPositions\.length > 0 && \([\s\S]*?<\/div>\s*\)\}/;
pt = pt.replace(badgeRegex, '<LiveTotalPnlBadge filteredPositions={filteredPositions} />');

// Replace mapping
const mapRegex = /\{positionsWithPnl\.map\(pos => \([\s\S]*?<\/tr>\s*\)\)\}/;
pt = pt.replace(mapRegex, '{filteredPositions.map(pos => <LivePositionsTableRow key={pos.id} pos={pos} viewMode={viewMode} />)}');

fs.writeFileSync('frontend/src/components/PositionsTable.jsx', pt);
console.log('Fixed PositionsTable');
