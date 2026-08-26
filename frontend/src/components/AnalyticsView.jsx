import { useShallow } from 'zustand/react/shallow';
import React, { useEffect, useState } from 'react';
import { useStore, API } from '../store';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Target, Activity } from 'lucide-react';

export default function AnalyticsView() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const { user } = useStore(useShallow(state => ({ user: state.user })));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch(`${API}/api/analytics`, {
          credentials: 'include'
        });
        if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
        const result = await res.json();
        setData(result);
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setLoading(false);
      }
    };
    if (user) {
      fetchAnalytics();
    } else {
      setLoading(false);
    }
  }, [user]);

  if (loading) return <div style={{ padding: '20px', color: 'var(--text-secondary)' }}>Loading analytics...</div>;
  if (!data) return <div style={{ padding: '20px', color: 'var(--text-secondary)' }}>Failed to load data.</div>;

  const { totalTrades, winningTrades, losingTrades, winRate, avgWinner, avgLoser, equityCurve, recentTrades } = data;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', padding: '10px', borderRadius: '4px' }}>
          <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>{label}</p>
          <p style={{ margin: 0, fontWeight: 'bold', color: 'var(--color-blue)' }}>Cumulative P&L: ₹{payload[0].value.toFixed(2)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', color: 'var(--text-primary)' }}>
      
      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div style={{ background: 'var(--bg-panel)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '13px' }}>
            <Activity size={16} /> Total Trades
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{totalTrades}</div>
        </div>

        <div style={{ background: 'var(--bg-panel)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '13px' }}>
            <Target size={16} /> Win Rate
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: parseFloat(winRate) > 50 ? 'var(--color-green-light)' : 'var(--color-yellow)' }}>
            {winRate}%
          </div>
        </div>

        <div style={{ background: 'var(--bg-panel)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '13px' }}>
            <TrendingUp size={16} color="var(--color-green-light)" /> Avg Winner
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-green-light)' }}>
            ₹{avgWinner}
          </div>
        </div>

        <div style={{ background: 'var(--bg-panel)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '13px' }}>
            <TrendingDown size={16} color="var(--color-red-light)" /> Avg Loser
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-red-light)' }}>
            ₹{avgLoser}
          </div>
        </div>
      </div>

      {/* Equity Curve Chart */}
      <div style={{ background: 'var(--bg-panel)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)', height: isMobile ? '300px' : '400px' }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: '16px' }}>Cumulative Equity Curve</h3>
        {equityCurve && equityCurve.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={equityCurve} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPnL" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-blue)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--color-blue)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="cumulative" stroke="var(--color-blue)" strokeWidth={2} fillOpacity={1} fill="url(#colorPnL)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
            Not enough data to plot equity curve yet.
          </div>
        )}
      </div>

      {/* Recent Trades Log */}
      <div style={{ background: 'var(--bg-panel)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', fontWeight: 'bold' }}>
          Trade Log (Last 50 Closed Trades)
        </div>
        <div style={{ overflowX: 'auto' }}>
          
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recentTrades && recentTrades.length > 0 ? recentTrades.map((trade, i) => (
                <div key={i} style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 'bold' }}>{trade.symbol}</div>
                    <div style={{ fontWeight: 'bold', color: parseFloat(trade.realized_pnl) >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                      ₹{parseFloat(trade.realized_pnl).toFixed(2)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                    <div style={{ color: 'var(--text-secondary)' }}>{new Date(trade.created_at).toLocaleString()}</div>
                    <div>
                      <span style={{ color: trade.side === 'BUY' ? 'var(--color-green-light)' : 'var(--color-red-light)', fontWeight: 'bold' }}>{trade.side}</span> {trade.quantity}
                    </div>
                  </div>
                </div>
              )) : (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>No closed trades found.</div>
              )}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-panel)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '12px 20px', fontWeight: '500' }}>Date</th>
                <th style={{ padding: '12px 20px', fontWeight: '500' }}>Symbol</th>
                <th style={{ padding: '12px 20px', fontWeight: '500' }}>Type</th>
                <th style={{ padding: '12px 20px', fontWeight: '500', textAlign: 'right' }}>Realized P&L</th>
              </tr>
            </thead>
            <tbody>
              {recentTrades && recentTrades.length > 0 ? recentTrades.map((trade, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 20px' }}>{new Date(trade.created_at).toLocaleString()}</td>
                  <td style={{ padding: '12px 20px', fontWeight: 'bold' }}>{trade.symbol}</td>
                  <td style={{ padding: '12px 20px' }}>
                    <span style={{ color: trade.side === 'BUY' ? 'var(--color-green-light)' : 'var(--color-red-light)', fontWeight: 'bold' }}>{trade.side}</span> {trade.quantity}
                  </td>
                  <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 'bold', color: parseFloat(trade.realized_pnl) >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                    ₹{parseFloat(trade.realized_pnl).toFixed(2)}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>No closed trades found.</td>
                </tr>
              )}
            </tbody>
          </table>
          )}
  
        </div>
      </div>

    </div>
  );
}
