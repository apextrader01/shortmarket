import React, { useState } from 'react';
import { useStore } from '../store';

export default function PortfolioView() {
  const [activeTab, setActiveTab] = useState('Overview');
  const { positions, prices } = useStore();

  const deliveryPositions = positions.filter(p => p.product_type === 'DEL');

  let totalInvested = 0;
  let totalCurrent = 0;
  let totalInvestedStocks = 0;
  let totalInvestedETFs = 0;

  deliveryPositions.forEach(pos => {
      const priceData = prices[pos.symbol] || {};
      const ltp = priceData.ltp || parseFloat(pos.average_price) || 0;
      const qty = Math.abs(pos.quantity);
      
      const invested = parseFloat(pos.average_price) * qty;
      const current = ltp * qty;
      
      totalInvested += invested;
      totalCurrent += current;

      const isETF = pos.symbol.includes('ETF') || pos.symbol.includes('BEES') || pos.symbol.includes('LIQUID');
      if (isETF) {
          totalInvestedETFs += invested;
      } else {
          totalInvestedStocks += invested;
      }
  });

  const overallGain = totalCurrent - totalInvested;
  const overallPct = totalInvested > 0 ? (overallGain / totalInvested) * 100 : 0;
  
  const isGain = overallGain >= 0;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-dark)' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Invested Amount', value: `₹ ${totalInvested.toFixed(2)}`, color: 'var(--text-primary)' },
            { label: 'Current Value', value: `₹ ${totalCurrent.toFixed(2)}`, color: 'var(--text-primary)' },
            { label: 'Overall Gain', value: `${isGain ? '+' : ''}₹ ${overallGain.toFixed(2)}`, sub: `${overallPct.toFixed(2)}%`, color: isGain ? 'var(--color-green-light)' : 'var(--color-red-light)' },
            { label: 'Today\'s Gain', value: '₹ 0.00', sub: '0%', color: 'var(--text-primary)' }
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
        <div style={{ background: 'var(--bg-panel)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
          {deliveryPositions.length === 0 ? (
            <div style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-blue)', padding: '12px 16px', borderRadius: '4px', fontSize: '13px', marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ background: 'var(--color-blue)', color: 'white', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>!</span>
              You have not invested in Equity, Mutual Funds with Angel One yet.
            </div>
          ) : (
            <div style={{ background: 'rgba(34, 197, 94, 0.1)', color: 'var(--color-green-light)', padding: '12px 16px', borderRadius: '4px', fontSize: '13px', marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              You have {deliveryPositions.length} active Delivery holding(s).
            </div>
          )}
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ fontWeight: '600', fontSize: '15px' }}>Equity <span style={{ color: 'var(--text-secondary)', fontWeight: '400', fontSize: '12px' }}>(₹{totalInvested.toFixed(2)})</span></div>
                <button style={{ background: 'transparent', color: 'var(--color-blue)', border: 'none', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>INVEST NOW</button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                   <span style={{ color: 'var(--text-secondary)' }}>Stocks</span>
                   <span style={{ fontWeight: '600' }}>₹{totalInvestedStocks.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                   <span style={{ color: 'var(--text-secondary)' }}>ETFs</span>
                   <span style={{ fontWeight: '600' }}>₹{totalInvestedETFs.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: '600' }}>Mutual Funds</div>
              <button style={{ background: 'transparent', color: 'var(--color-blue)', border: 'none', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>INVEST NOW</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
