import React, { useState } from 'react';
import { useStore } from '../store';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function PositionsTable() {
  const [viewMode, setViewMode] = useState('OPEN');
  const { positions, orders, prices, user } = useStore();

  const filteredPositions = positions.filter(pos => viewMode === 'OPEN' ? pos.quantity !== 0 : pos.quantity === 0);

  const positionsWithPnl = filteredPositions.map(pos => {
    const ltp = prices[pos.symbol]?.ltp || pos.average_price;
    const pnl = pos.quantity !== 0 
        ? (ltp - pos.average_price) * pos.quantity 
        : parseFloat(pos.realized_pnl || 0);
    const pnlPct = pos.quantity !== 0 && pos.average_price > 0 
        ? ((ltp - pos.average_price) / pos.average_price) * 100 
        : 0;
    return { ...pos, ltp, pnl, pnlPct };
  });

  const totalPnl = positionsWithPnl.reduce((sum, p) => sum + p.pnl, 0);
  const recentOrders = orders.slice(0, 8);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Positions */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700' }}>Positions</h3>
            <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', padding: '2px' }}>
              <button
                onClick={() => setViewMode('OPEN')}
                style={{ background: viewMode === 'OPEN' ? 'var(--color-blue)' : 'transparent', color: '#fff', border: 'none', padding: '2px 8px', borderRadius: '3px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}
              >OPEN</button>
              <button
                onClick={() => setViewMode('CLOSED')}
                style={{ background: viewMode === 'CLOSED' ? 'var(--color-blue)' : 'transparent', color: '#fff', border: 'none', padding: '2px 8px', borderRadius: '3px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}
              >CLOSED</button>
            </div>
          </div>
          {positionsWithPnl.length > 0 && (
            <div style={{
              fontSize: '13px', fontWeight: '700',
              color: totalPnl >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)',
              background: totalPnl >= 0 ? 'rgba(34,197,94,0.1)' : 'rgba(225,42,31,0.1)',
              padding: '4px 10px', borderRadius: '6px'
            }}>
              Total P&L: {totalPnl >= 0 ? '+' : ''}₹{totalPnl.toFixed(2)}
            </div>
          )}
        </div>

        {positionsWithPnl.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
            {viewMode === 'CLOSED' ? 'No closed positions today.' : 'No open positions. Place your first trade!'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: '650px', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {['Symbol', 'Qty', 'Avg Price', viewMode === 'OPEN' ? 'LTP' : 'Exit Price', 'P&L', 'P&L%'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Symbol' ? 'left' : 'right', color: 'var(--text-secondary)', fontWeight: '600', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {positionsWithPnl.map(pos => (
                  <tr key={pos.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '700' }}>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }} title={pos.symbol}>{pos.symbol}</div>
                      <div style={{ fontSize: '10px', color: pos.quantity > 0 ? 'var(--color-green-light)' : (pos.quantity < 0 ? 'var(--color-red-light)' : 'var(--text-muted)') }}>
                        {pos.quantity > 0 ? 'LONG' : (pos.quantity < 0 ? 'SHORT' : 'CLOSED')}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600' }}>{viewMode === 'CLOSED' && pos.closed_quantity ? Math.abs(pos.closed_quantity) : Math.abs(pos.quantity)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>₹{pos.average_price.toFixed(2)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600' }}>₹{viewMode === 'CLOSED' && pos.exit_price ? pos.exit_price.toFixed(2) : pos.ltp.toFixed(2)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: pos.pnl >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                      {pos.pnl >= 0 ? '+' : ''}₹{pos.pnl.toFixed(2)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', color: pos.pnlPct >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px' }}>
                        {pos.pnlPct >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        {pos.pnlPct >= 0 ? '+' : ''}{pos.pnlPct.toFixed(2)}%
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Orders */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px' }}>Recent Orders</h3>
        {recentOrders.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
            No orders yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: '650px', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {['Symbol', 'Side', 'Type', 'Qty', 'Price', 'Status', 'Time'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: '600' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentOrders.map(order => {
                  const statusColor = order.status === 'EXECUTED' ? 'var(--color-green-light)'
                    : order.status === 'CANCELLED' ? 'var(--text-secondary)'
                    : order.status === 'REJECTED' ? 'var(--color-red-light)'
                    : '#F59E0B'; // PENDING = amber

                  return (
                    <tr key={order.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: '700' }}>{order.symbol}</td>
                      <td style={{ padding: '8px 12px', fontWeight: '700', color: order.side === 'BUY' ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>{order.side}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{order.type}</td>
                      <td style={{ padding: '8px 12px' }}>{order.quantity}</td>
                      <td style={{ padding: '8px 12px' }}>{order.price ? `₹${Number(order.price).toFixed(2)}` : 'MKT'}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{
                          color: statusColor,
                          background: `${statusColor}18`,
                          padding: '2px 8px', borderRadius: '4px',
                          fontSize: '11px', fontWeight: '700'
                        }}>{order.status}</span>
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontSize: '11px' }}>
                        {new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
