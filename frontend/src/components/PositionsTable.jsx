import React from 'react';
import { useStore } from '../store';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function PositionsTable() {
  const { positions, orders, prices, user } = useStore();

  const positionsWithPnl = positions.map(pos => {
    const ltp = prices[pos.symbol]?.ltp || pos.average_price;
    const pnl = (ltp - pos.average_price) * pos.quantity;
    const pnlPct = ((ltp - pos.average_price) / pos.average_price) * 100;
    return { ...pos, ltp, pnl, pnlPct };
  });

  const totalPnl = positionsWithPnl.reduce((sum, p) => sum + p.pnl, 0);
  const recentOrders = orders.slice(0, 8);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Positions */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700' }}>Open Positions</h3>
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
            No open positions. Place your first trade!
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {['Symbol', 'Qty', 'Avg Price', 'LTP', 'P&L', 'P&L%'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Symbol' ? 'left' : 'right', color: 'var(--text-secondary)', fontWeight: '600', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {positionsWithPnl.map(pos => (
                  <tr key={pos.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '700' }}>
                      <div>{pos.symbol}</div>
                      <div style={{ fontSize: '10px', color: pos.quantity > 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                        {pos.quantity > 0 ? 'LONG' : 'SHORT'}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600' }}>{Math.abs(pos.quantity)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>₹{pos.average_price.toFixed(2)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600' }}>₹{pos.ltp.toFixed(2)}</td>
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
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
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
