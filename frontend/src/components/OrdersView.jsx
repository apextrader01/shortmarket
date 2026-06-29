import React, { useState } from 'react';
import { useStore } from '../store';
import { Box } from 'lucide-react';

export default function OrdersView() {
  const { orders } = useStore();
  const [activeTab, setActiveTab] = useState('Open Orders');

  const tabs = ['Open Orders', 'Order History', 'Basket Orders', 'Alerts'];

  // Filter orders based on active tab
  const displayOrders = orders.filter(order => {
    if (activeTab === 'Open Orders') return order.status === 'PENDING';
    if (activeTab === 'Order History') return order.status !== 'PENDING';
    return false;
  });

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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: displayOrders.length === 0 ? 'center' : 'flex-start' }}>
        {displayOrders.length === 0 ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              width: '120px', height: '100px', background: 'var(--bg-panel)', 
              borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)', margin: '0 auto 24px', position: 'relative'
            }}>
              <Box size={40} color="var(--color-green-light)" />
              <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '24px' }}>✨</div>
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>You don't have any {activeTab.toLowerCase()}</h2>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700' }}>{activeTab}</h2>
              {activeTab === 'Open Orders' && displayOrders.length > 0 && (
                <button
                  onClick={async () => {
                    if (window.confirm('Are you sure you want to cancel ALL open orders?')) {
                      for (const order of displayOrders) {
                        await useStore.getState().cancelOrder(order.id);
                      }
                    }
                  }}
                  style={{
                    background: 'var(--color-red-light)', color: '#fff', border: 'none',
                    padding: '8px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}
                >
                  CANCEL ALL OPEN ORDERS
                </button>
              )}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px', fontWeight: '500' }}>Time</th>
                  <th style={{ padding: '12px 16px', fontWeight: '500' }}>Symbol</th>
                  <th style={{ padding: '12px 16px', fontWeight: '500' }}>Type</th>
                  <th style={{ padding: '12px 16px', fontWeight: '500' }}>Qty</th>
                  <th style={{ padding: '12px 16px', fontWeight: '500' }}>Price</th>
                  <th style={{ padding: '12px 16px', fontWeight: '500' }}>Order Type</th>
                  <th style={{ padding: '12px 16px', fontWeight: '500' }}>Status</th>
                  {activeTab === 'Open Orders' && <th style={{ padding: '12px 16px', fontWeight: '500', textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {displayOrders.map(order => (
                  <tr key={order.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '12px 16px' }}>{new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                    <td style={{ padding: '12px 16px', fontWeight: '600' }}>{order.symbol.split('-')[0]}</td>
                    <td style={{ padding: '12px 16px', color: order.side === 'BUY' ? 'var(--color-green-light)' : 'var(--color-red-light)', fontWeight: '600' }}>
                      <span style={{ background: order.side === 'BUY' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span>{order.side}</span>
                        <span style={{ fontSize: '10px', opacity: 0.8 }}>({order.product_type || 'DEL'})</span>
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>{order.quantity}</td>
                    <td style={{ padding: '12px 16px' }}>{order.price ? `₹${parseFloat(order.price).toFixed(2)}` : '—'}</td>
                    <td style={{ padding: '12px 16px', fontWeight: '600' }}>{order.type || (order.price ? 'LIMIT' : 'MARKET')}</td>
                    <td style={{ padding: '12px 16px', fontWeight: '600', color: order.status === 'PENDING' ? 'var(--color-yellow)' : (order.status === 'EXECUTED' ? 'var(--color-green-light)' : 'var(--color-red-light)') }}>
                      {order.status}
                    </td>
                    {activeTab === 'Open Orders' && (
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button 
                            onClick={() => useStore.getState().openEditOrderModal(order)}
                            style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-blue)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '4px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                          >
                            EDIT
                          </button>
                          <button 
                            onClick={() => {
                              if (window.confirm('Are you sure you want to cancel this order?')) {
                                useStore.getState().cancelOrder(order.id);
                              }
                            }}
                            style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-red-light)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '4px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                          >
                            CANCEL
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
