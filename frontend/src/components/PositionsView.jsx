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
      <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>Positions</h2>
      
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr>
              <th>Instrument</th>
              <th style={{ textAlign: 'right' }}>Qty.</th>
              <th style={{ textAlign: 'right' }}>Avg. Price</th>
              <th style={{ textAlign: 'right' }}>LTP</th>
              <th style={{ textAlign: 'right' }}>P&L</th>
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
