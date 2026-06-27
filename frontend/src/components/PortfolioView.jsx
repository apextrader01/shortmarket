import React, { useState } from 'react';
import { useStore } from '../store';

export default function PortfolioView() {
  const [activeTab, setActiveTab] = useState('Overview');

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
            { label: 'Invested Amount', value: '₹ 0' },
            { label: 'Current Value', value: '₹ 0' },
            { label: 'Overall Gain', value: '₹ 0.00', sub: '0%' },
            { label: 'Today\'s Gain', value: '₹ 0.00', sub: '0%' }
          ].map((stat, i) => (
            <div key={i} style={{ background: 'var(--bg-panel)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
                {stat.label}
              </div>
              <div style={{ fontSize: '20px', fontWeight: '700' }}>
                {stat.value} <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>{stat.sub}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Portfolio Breakup */}
        <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>Portfolio Breakup</h3>
        <div style={{ background: 'var(--bg-panel)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
          <div style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-blue)', padding: '12px 16px', borderRadius: '4px', fontSize: '13px', marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ background: 'var(--color-blue)', color: 'white', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>!</span>
            You have not invested in Equity, Mutual Funds with Angel One yet.
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: '600' }}>Equity</div>
              <button style={{ background: 'transparent', color: 'var(--color-blue)', border: 'none', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>INVEST NOW</button>
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
