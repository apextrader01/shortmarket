import React from 'react';
import { useStore } from '../store';
import { Briefcase } from 'lucide-react';

export default function PositionsView() {
  const { positions, prices } = useStore();

  if (positions.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)' }}>
        <div style={{ 
          width: '120px', height: '100px', background: 'var(--bg-panel)', 
          borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)', marginBottom: '24px', position: 'relative'
        }}>
          <Briefcase size={40} color="var(--color-green-light)" />
          <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '24px' }}>✨</div>
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>You do not have any positions</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>List of all your positions for today will appear here.</p>
        <button style={{
          background: 'var(--color-blue)', color: 'white', padding: '10px 24px', 
          borderRadius: '4px', fontSize: '13px', fontWeight: '600', letterSpacing: '0.5px',
          border: 'none', cursor: 'pointer'
        }}>
          VIEW TRADING IDEAS
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', width: '100%', background: 'var(--bg-dark)', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '700' }}>Positions</h2>
        <button
          onClick={async () => {
            if (window.confirm('Are you sure you want to EXIT ALL open positions at market price?')) {
              const store = useStore.getState();
              // Iterate through positions and place market orders for each
              for (const pos of positions) {
                if (pos.quantity === 0) continue;
                const exitSide = pos.quantity > 0 ? 'SELL' : 'BUY';
                const payload = {
                  symbol: pos.symbol,
                  type: 'MARKET',
                  side: exitSide,
                  quantity: Math.abs(pos.quantity),
                  price: 0,
                  sl_price: null,
                  tgt_price: null,
                  margin: 0,
                  product_type: pos.product_type || 'DEL'
                };
                await store.placeOrder(payload);
              }
            }
          }}
          style={{
            background: 'var(--color-red-light)', color: '#fff', border: 'none',
            padding: '8px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
        >
          EXIT ALL OPEN POSITIONS
        </button>
      </div>
      
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr>
              <th>Instrument</th>
              <th>Type</th>
              <th style={{ textAlign: 'right' }}>Qty.</th>
              <th style={{ textAlign: 'right' }}>Avg. Price</th>
              <th style={{ textAlign: 'right' }}>LTP</th>
              <th style={{ textAlign: 'right' }}>P&L</th>
              <th style={{ textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {positions.map(pos => {
              const priceData = prices[pos.symbol] || {};
              const ltp = priceData.ltp || 0;
              const avg = parseFloat(pos.average_price) || 0;
              const qty = pos.quantity || 0;
              
              // Calculate PnL
              const invested = avg * Math.abs(qty);
              const currentValue = ltp * Math.abs(qty);
              const pnl = qty > 0 ? (currentValue - invested) : (invested - currentValue);
              const isProfit = pnl >= 0;

              return (
                <tr key={pos.id || pos.symbol}>
                  <td style={{ fontWeight: '600' }}>{pos.symbol}</td>
                  <td>
                    <span style={{ 
                      background: pos.product_type === 'INT' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                      color: pos.product_type === 'INT' ? '#fef08a' : 'var(--color-green-light)',
                      padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold'
                    }}>{pos.product_type || 'DEL'}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>{qty}</td>
                  <td style={{ textAlign: 'right' }}>₹{avg.toFixed(2)}</td>
                  <td style={{ textAlign: 'right', fontWeight: '600' }}>{ltp > 0 ? `₹${ltp.toFixed(2)}` : '—'}</td>
                  <td style={{ 
                    textAlign: 'right', 
                    fontWeight: '700',
                    color: isProfit ? 'var(--color-green-light)' : 'var(--color-red-light)'
                  }}>
                    {pnl > 0 ? '+' : ''}{pnl.toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'center', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <button 
                      onClick={async () => {
                        const isInt = pos.product_type === 'INT';
                        const newType = isInt ? 'DEL' : 'INT';
                        const requiredMargin = avg * Math.abs(qty) * 0.75;
                        const confirmMsg = isInt 
                           ? `Convert to Delivery? This requires ₹${requiredMargin.toFixed(2)} available cash.` 
                           : `Convert to Intraday? This will free up ₹${requiredMargin.toFixed(2)} cash.`;
                        if (window.confirm(confirmMsg)) {
                           const res = await useStore.getState().convertPosition(pos.id, newType, requiredMargin);
                           if (!res.success) alert(res.error);
                        }
                      }}
                      style={{ 
                        background: 'transparent', color: 'var(--color-blue)', border: '1px solid var(--color-blue)', 
                        padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' 
                      }}
                    >
                      Convert to {pos.product_type === 'INT' ? 'DEL' : 'INT'}
                    </button>
                    <button
                      onClick={() => {
                        const exitSide = qty > 0 ? 'SELL' : 'BUY';
                        useStore.getState().openOrderModal(pos.symbol, exitSide, Math.abs(qty));
                      }}
                      style={{
                        background: 'var(--color-red-light)', color: '#fff', border: 'none',
                        padding: '4px 14px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }}
                    >
                      EXIT
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
