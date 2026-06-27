import React, { useState } from 'react';
import { useStore } from '../store';
import { Box } from 'lucide-react';

export default function OrdersView() {
  const { orders } = useStore();
  const [activeTab, setActiveTab] = useState('Open Orders');

  const tabs = ['Open Orders', 'Order History', 'Stock SIP', 'GTT', 'Basket Orders', 'Alerts'];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-dark)' }}>
      {/* Sub Navigation */}
      <div style={{ display: 'flex', gap: '24px', padding: '0 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-panel)' }}>
        {tabs.map(tab => (
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

      {/* Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {orders.length === 0 ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              width: '120px', height: '100px', background: 'var(--bg-panel)', 
              borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)', margin: '0 auto 24px', position: 'relative'
            }}>
              <Box size={40} color="var(--color-green-light)" />
              <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '24px' }}>✨</div>
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>You don't have any open orders</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>Check Angel One's Recommendations</p>
            <button style={{
              background: 'var(--bg-panel)', color: 'var(--color-blue)', padding: '10px 24px', 
              borderRadius: '4px', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px',
              border: '1px solid var(--border-color)', cursor: 'pointer'
            }}>
              VIEW TRADING IDEAS
            </button>
          </div>
        ) : (
          <div style={{ padding: '24px', width: '100%', height: '100%', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>{activeTab}</h2>
            {/* Orders Table */}
          </div>
        )}
      </div>
    </div>
  );
}
