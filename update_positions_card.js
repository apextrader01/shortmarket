const fs = require('fs');

const path = 'frontend/src/components/PositionsView.jsx';
let content = fs.readFileSync(path, 'utf8');

const tableStart = content.indexOf('<div className="glass-panel" style={{ overflow: \'hidden\', padding: 0 }}>');
const tableEnd = content.indexOf('</div>\n        </div>\n      )}\n\n      {/* Global MTM Banner */}') + '</div>\n        </div>\n      )}'.length;

if (tableStart === -1 || tableEnd === -1) {
    console.error("Could not find table bounds.");
    process.exit(1);
}

const before = content.substring(0, tableStart);
const after = content.substring(tableEnd);

const newRender = `<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {flatPositions.map((pos, idx) => {
            const isProfit = pos.pnl >= 0;
            const realizedPnl = parseFloat(pos.realized_pnl) || 0;
            const currentValue = pos.ltp * Math.abs(pos.qty);
            const pnlPercent = pos.invested > 0 ? (pos.pnl / pos.invested) * 100 : 0;
            
            // For closed positions, use realized P&L as the main display
            const displayPnl = viewMode === 'CLOSED' ? realizedPnl : pos.pnl;
            const isDisplayProfit = displayPnl >= 0;

            return (
              <div 
                key={idx} 
                onClick={() => {
                  if (viewMode === 'CLOSED') return;
                  if (viewMode === 'OPEN') {
                    if (pos.unencumberedQty === 0) {
                      alert('This position is fully tied to BO/CO pending triggers. To exit, please cancel or modify the pending orders in the Orders tab.');
                      return;
                    }
                    setPartialExitPos(pos);
                    const ls = pos.lotSize || 1;
                    setPartialExitQty((Math.abs(pos.unencumberedQty) / ls).toString());
                    setPartialExitType('MARKET');
                    setPartialExitPrice(pos.ltp > 0 ? pos.ltp.toFixed(2) : '');
                  } else if (viewMode === 'HOLDINGS') {
                    useStore.getState().openOrderModal(pos.symbol, 'SELL', 1, 'DEL');
                  }
                }}
                style={{ 
                  background: 'var(--bg-panel)', 
                  border: '1px solid rgba(255,255,255,0.05)', 
                  borderRadius: '8px', 
                  padding: '16px',
                  cursor: viewMode === 'CLOSED' ? 'default' : 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'background 0.2s, border-color 0.2s',
                  ':hover': {
                    background: 'rgba(255,255,255,0.03)',
                    borderColor: 'var(--color-blue-dark)'
                  }
                }}
              >
                {/* Left Accent Bar */}
                <div style={{ position: 'absolute', left: 0, top: '16px', bottom: '16px', width: '3px', background: pos.qty > 0 ? 'var(--color-green-light)' : (pos.qty < 0 ? 'var(--color-red-light)' : 'var(--text-muted)'), borderRadius: '0 4px 4px 0' }} />

                {/* Row 1: Symbol & Avg */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingLeft: '12px' }}>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#fff', letterSpacing: '0.3px' }}>
                    {pos.symbol.replace(/-(EQ|FUT|CE|PE)$/, '')}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                    Avg. ₹{pos.avg.toFixed(2)}
                  </div>
                </div>

                {/* Row 2: LTP & Qty/Side */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingLeft: '12px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
                    <span>₹{viewMode === 'CLOSED' ? (pos.exit_price ? parseFloat(pos.exit_price).toFixed(2) : '—') : (pos.ltp > 0 ? pos.ltp.toFixed(2) : '—')}</span>
                    {/* Optional: Add day change % here if available in prices store */}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
                    <span>Qty {viewMode === 'CLOSED' ? Math.abs(pos.closed_quantity || 0) : (pos.qty > 0 ? '+' : (pos.qty < 0 ? '-' : ''))}{Math.abs(viewMode === 'CLOSED' ? pos.closed_quantity || 0 : pos.qty)}</span>
                    {(pos.qty !== 0 || viewMode === 'CLOSED') && (
                      <span style={{ 
                        background: pos.qty > 0 || (viewMode === 'CLOSED' && pos.closed_quantity > 0) ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', 
                        color: pos.qty > 0 || (viewMode === 'CLOSED' && pos.closed_quantity > 0) ? 'var(--color-green-light)' : 'var(--color-red-light)', 
                        padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: '800' 
                      }}>
                        {pos.qty > 0 || (viewMode === 'CLOSED' && pos.closed_quantity > 0) ? 'B' : 'S'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Row 3: Invested, Current, P&L */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px', paddingLeft: '12px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '500' }}>Invested Value</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>₹{pos.invested.toFixed(2)}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '500' }}>Current Value</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
                      {viewMode === 'CLOSED' ? '-' : \`₹\${currentValue.toFixed(2)}\`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '500' }}>
                      {viewMode === 'CLOSED' ? 'Realized P&L' : \`P&L (\${isDisplayProfit ? '▲' : '▼'} \${Math.abs(pnlPercent).toFixed(2)}%)\`}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: isDisplayProfit ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                      {isDisplayProfit ? '+' : ''}₹{displayPnl.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>`;

fs.writeFileSync(path, before + newRender + after);
console.log("PositionsView layout rewritten successfully.");
