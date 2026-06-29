import React, { useState } from 'react';
import { useStore } from '../store';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

export default function PortfolioView() {
  const [activeTab, setActiveTab] = useState('Overview');
  const { positions, prices, orders } = useStore();

  let totalInvested = 0;
  let totalCurrent = 0;
  let totalInvestedStocks = 0;
  let totalInvestedETFs = 0;
  let unrealizedPnl = 0;

  const deliveryPositions = (positions || []).filter(p => p && p.product_type === 'DEL');

  (positions || []).forEach(pos => {
      if (!pos) return;
      const priceData = prices[pos.symbol] || {};
      const ltp = priceData.ltp || parseFloat(pos.average_price) || 0;
      const qty = Math.abs(pos.quantity);
      
      const invested = parseFloat(pos.average_price) * qty;
      const current = ltp * qty;
      
      let pnl = 0;
      if (pos.quantity > 0) pnl = current - invested;
      else if (pos.quantity < 0) pnl = invested - current;
      unrealizedPnl += pnl;

      // For portfolio breakdown, only include Delivery investments
      if (pos.product_type === 'DEL') {
          totalInvested += invested;
          totalCurrent += current;

          const symbolStr = pos.symbol || '';
          const isETF = symbolStr.includes('ETF') || symbolStr.includes('BEES') || symbolStr.includes('LIQUID');
          if (isETF) {
              totalInvestedETFs += invested;
          } else {
              totalInvestedStocks += invested;
          }
      }
  });

  const isToday = (dateString) => {
     if (!dateString) return false;
     const d = new Date(dateString);
     const today = new Date();
     return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };

  let todayRealizedPnl = 0;
  if (orders) {
      orders.forEach(o => {
          if (o.status === 'EXECUTED' && o.realized_pnl && isToday(o.created_at)) {
              todayRealizedPnl += parseFloat(o.realized_pnl);
          }
      });
  }

  const overallGain = totalCurrent - totalInvested;
  const overallPct = totalInvested > 0 ? (overallGain / totalInvested) * 100 : 0;
  
  const isGain = overallGain >= 0;

  // Chart Data
  const COLORS = ['#3B82F6', '#22C55E', '#EAB308'];
  const chartData = [
    { name: 'Stocks', value: totalInvestedStocks },
    { name: 'ETFs', value: totalInvestedETFs },
    { name: 'Mutual Funds', value: 0 }, // Future addition
  ].filter(d => d.value > 0);
  
  // If no investments yet, show placeholder
  if (chartData.length === 0) {
    chartData.push({ name: 'Uninvested Cash', value: 100 });
    COLORS[0] = 'rgba(255,255,255,0.1)';
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-dark)', minHeight: 0, minWidth: 0 }}>
      {/* Sub Navigation */}
      <div style={{ display: 'flex', gap: '24px', padding: '0 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-panel)' }}>
        {['Overview', 'Equity'].map(tab => (
          <div
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '16px 4px',
              fontSize: '13px',
              fontWeight: activeTab === tab ? '600' : '500',
              color: activeTab === tab ? 'var(--color-blue)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab ? '2px solid var(--color-blue)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {tab}
          </div>
        ))}
      </div>

      <div style={{ padding: '24px', overflowY: 'auto' }}>
        {/* Top Stats Cards */}
        <div className="stats-grid">
          {[
            { label: 'Invested Amount (DEL)', value: `₹ ${totalInvested.toFixed(2)}`, color: 'var(--text-primary)' },
            { label: 'Current Value (DEL)', value: `₹ ${totalCurrent.toFixed(2)}`, color: 'var(--text-primary)' },
            { label: 'Unrealized P&L (Live)', value: `${unrealizedPnl >= 0 ? '+' : ''}₹ ${unrealizedPnl.toFixed(2)}`, sub: 'All Open Positions', color: unrealizedPnl >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' },
            { label: 'Today\'s Realized P&L', value: `${todayRealizedPnl >= 0 ? '+' : ''}₹ ${todayRealizedPnl.toFixed(2)}`, sub: 'Booked Today', color: todayRealizedPnl >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }
          ].map((stat, i) => (
            <div key={i} style={{ background: 'var(--bg-panel)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
                {stat.label}
              </div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: stat.color }}>
                {stat.value} <span style={{ fontSize: '13px', color: stat.color, fontWeight: '500', opacity: 0.8 }}>{stat.sub || ''}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Portfolio Breakup */}
        <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>Portfolio Breakup</h3>
        <div className="portfolio-grid">
          
          {/* Chart Section */}
          <div style={{ background: 'var(--bg-panel)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>Asset Allocation</h4>
            <div style={{ width: '100%', height: '200px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => `₹${value.toFixed(2)}`}
                    contentStyle={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Stats Breakdown Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ fontWeight: '600', fontSize: '15px' }}>Equity <span style={{ color: 'var(--text-secondary)', fontWeight: '400', fontSize: '12px' }}>(₹{totalInvested.toFixed(2)})</span></div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', alignItems: 'center' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: COLORS[0] }} />
                     <span style={{ color: 'var(--text-secondary)' }}>Stocks</span>
                   </div>
                   <span style={{ fontWeight: '600' }}>₹{totalInvestedStocks.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', alignItems: 'center' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: COLORS[1] }} />
                     <span style={{ color: 'var(--text-secondary)' }}>ETFs</span>
                   </div>
                   <span style={{ fontWeight: '600' }}>₹{totalInvestedETFs.toFixed(2)}</span>
                </div>
              </div>
            </div>
            
            <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: COLORS[2] }} />
                Mutual Funds
              </div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>Coming Soon</div>
            </div>
          </div>
        </div>

        {/* Holdings Table */}
        <div style={{ marginTop: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Your Holdings</h3>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Showing {deliveryPositions.length} position(s)
            </div>
          </div>
          
          <div style={{ background: 'var(--bg-panel)', borderRadius: '8px', border: '1px solid var(--border-color)', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                  <th style={{ padding: '16px', fontWeight: '500' }}>Symbol</th>
                  <th style={{ padding: '16px', fontWeight: '500', textAlign: 'right' }}>Qty</th>
                  <th style={{ padding: '16px', fontWeight: '500', textAlign: 'right' }}>Avg Price</th>
                  <th style={{ padding: '16px', fontWeight: '500', textAlign: 'right' }}>LTP</th>
                  <th style={{ padding: '16px', fontWeight: '500', textAlign: 'right' }}>Current Value</th>
                  <th style={{ padding: '16px', fontWeight: '500', textAlign: 'right' }}>Total P&L</th>
                </tr>
              </thead>
              <tbody>
                {deliveryPositions.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      You have no active holdings.
                    </td>
                  </tr>
                ) : (
                  deliveryPositions.map(pos => {
                    const priceData = prices[pos.symbol] || {};
                    const ltp = priceData.ltp || parseFloat(pos.average_price) || 0;
                    const qty = Math.abs(pos.quantity);
                    const invested = parseFloat(pos.average_price) * qty;
                    const current = ltp * qty;
                    const pnl = current - invested;
                    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
                    const isProfit = pnl >= 0;
                    const safeSymbol = pos.symbol || '';
                    
                    return (
                      <tr key={pos.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '16px', fontWeight: '600' }}>
                          {safeSymbol.split('-')[0]}
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginLeft: '6px', background: 'rgba(255,255,255,0.05)', padding: '2px 4px', borderRadius: '4px' }}>
                            {safeSymbol.split('-')[1] || 'NSE'}
                          </span>
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right', fontWeight: '500' }}>{qty}</td>
                        <td style={{ padding: '16px', textAlign: 'right', color: 'var(--text-secondary)' }}>₹{parseFloat(pos.average_price).toFixed(2)}</td>
                        <td style={{ padding: '16px', textAlign: 'right', fontWeight: '500' }}>₹{ltp.toFixed(2)}</td>
                        <td style={{ padding: '16px', textAlign: 'right', fontWeight: '500' }}>₹{current.toFixed(2)}</td>
                        <td style={{ padding: '16px', textAlign: 'right' }}>
                          <div style={{ color: isProfit ? 'var(--color-green-light)' : 'var(--color-red-light)', fontWeight: '600' }}>
                            {isProfit ? '+' : ''}₹{pnl.toFixed(2)}
                          </div>
                          <div style={{ fontSize: '11px', color: isProfit ? 'var(--color-green-light)' : 'var(--color-red-light)', opacity: 0.8 }}>
                            {isProfit ? '+' : ''}{pnlPct.toFixed(2)}%
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
