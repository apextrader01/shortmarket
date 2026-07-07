import React, { useState } from 'react';
import { useStore } from '../store';
import { Box } from 'lucide-react';

export default function OrdersView() {
  const { orders, pendingTriggers, removePendingTrigger } = useStore();
  const [activeTab, setActiveTab] = useState('Open Orders');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const tabs = ['Open Orders', 'Pending Triggers', 'Order History', 'Basket Orders', 'Alerts'];

  // Filter orders based on active tab
  let displayOrders = orders.filter(order => {
    if (activeTab === 'Open Orders') return order.status === 'PENDING';
    if (activeTab === 'Order History') return order.status !== 'PENDING';
    return false;
  });
  
  let displayTriggers = pendingTriggers || [];

  if (searchQuery) {
    const lowerQuery = searchQuery.toLowerCase();
    displayOrders = displayOrders.filter(order => 
      order.symbol.toLowerCase().includes(lowerQuery) || 
      order.status.toLowerCase().includes(lowerQuery) ||
      (order.type || '').toLowerCase().includes(lowerQuery)
    );
    displayTriggers = displayTriggers.filter(trigger =>
      trigger.symbol.toLowerCase().includes(lowerQuery) ||
      trigger.status.toLowerCase().includes(lowerQuery) ||
      (trigger.type || '').toLowerCase().includes(lowerQuery)
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-dark)' }}>
      {/* Sub Navigation */}
      <div style={{ display: 'flex', padding: '0 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-panel)', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '24px' }}>
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
        <div>
          <input
            type="text"
            placeholder="Filter orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'var(--bg-dark)', border: '1px solid var(--border-color)', 
              padding: '6px 12px', borderRadius: '4px', color: '#fff', fontSize: '13px',
              width: '200px', outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: (activeTab === 'Pending Triggers' ? displayTriggers.length === 0 : displayOrders.length === 0) ? 'center' : 'flex-start' }}>
        {(activeTab === 'Pending Triggers' ? displayTriggers.length === 0 : displayOrders.length === 0) ? (
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
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                {activeTab === 'Pending Triggers' ? (
                  <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Time</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Symbol</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Type</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Qty</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Trigger Price</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Trailing Jump</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Order Type</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Status</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500', textAlign: 'right' }}>Actions</th>
                  </tr>
                ) : (
                  <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Time</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Symbol</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Type</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Qty</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Price</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Order Type</th>
                    {activeTab === 'Order History' && <th style={{ padding: '12px 16px', fontWeight: '500' }}>Charges</th>}
                    {activeTab === 'Order History' && <th style={{ padding: '12px 16px', fontWeight: '500' }}>Realized P&L</th>}
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Status</th>
                    {activeTab === 'Open Orders' && <th style={{ padding: '12px 16px', fontWeight: '500', textAlign: 'right' }}>Actions</th>}
                  </tr>
                )}
              </thead>
              <tbody>
                {activeTab === 'Pending Triggers' ? (
                  displayTriggers.map(trigger => (
                    <tr key={trigger.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px 16px' }}>{new Date(trigger.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                      <td style={{ padding: '12px 16px', fontWeight: '600' }}>{trigger.symbol.split('-')[0]}</td>
                      <td style={{ padding: '12px 16px', color: trigger.side === 'BUY' ? 'var(--color-green-light)' : 'var(--color-red-light)', fontWeight: '600' }}>
                        <span style={{ background: trigger.side === 'BUY' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span>{trigger.side}</span>
                          <span style={{ fontSize: '10px', opacity: 0.8 }}>({trigger.productType})</span>
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>{trigger.quantity}</td>
                      <td style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--color-blue)' }}>₹{trigger.triggerPrice?.toFixed(2)}</td>
                      <td style={{ padding: '12px 16px' }}>{trigger.trailingJump ? `₹${trigger.trailingJump}` : '—'}</td>
                      <td style={{ padding: '12px 16px', fontWeight: '600' }}>{trigger.type.replace('_', ' ')}</td>
                      <td style={{ padding: '12px 16px', fontWeight: '600', color: trigger.status === 'PENDING_TRIGGER' ? 'var(--color-yellow)' : 'var(--color-green-light)' }}>
                        {trigger.status.replace('_', ' ')}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {trigger.status === 'PENDING_TRIGGER' && (
                           <button 
                             onClick={() => {
                               if (window.confirm('Cancel this pending trigger?')) {
                                 removePendingTrigger(trigger.id);
                               }
                             }}
                             style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-red-light)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '4px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                           >
                             CANCEL
                           </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  displayOrders.map(order => (
                  <tr 
                    key={order.id} 
                    onClick={() => activeTab === 'Order History' && setSelectedOrder(order)}
                    style={{ 
                      borderBottom: '1px solid rgba(255,255,255,0.05)', 
                      cursor: activeTab === 'Order History' ? 'pointer' : 'default',
                      transition: 'background 0.2s',
                      ...(activeTab === 'Order History' ? { '&:hover': { background: 'rgba(255,255,255,0.05)' } } : {})
                    }}
                    onMouseEnter={(e) => activeTab === 'Order History' && (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={(e) => activeTab === 'Order History' && (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 16px' }}>{new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                    <td style={{ padding: '12px 16px', fontWeight: '600' }}>{order.symbol.split('-')[0]}</td>
                    <td style={{ padding: '12px 16px', color: order.side === 'BUY' ? 'var(--color-green-light)' : 'var(--color-red-light)', fontWeight: '600' }}>
                      <span style={{ background: order.side === 'BUY' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span>{order.side}</span>
                        <span style={{ fontSize: '10px', opacity: 0.8 }}>({order.product_type || 'DEL'})</span>
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>{order.quantity}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {order.type === 'TRAILING_STOP' ? (
                        <span title="Trailing Stop Loss" style={{ color: 'var(--color-yellow)' }}>
                          Trg: ₹{parseFloat(order.trigger_price || 0).toFixed(2)}<br/>
                          <span style={{ fontSize: '10px', opacity: 0.8 }}>Trail: {order.trail_amount}</span>
                        </span>
                      ) : order.trigger_price ? (
                        <span title="Trigger Price">
                          Trg: ₹{parseFloat(order.trigger_price).toFixed(2)}
                          {order.price && parseFloat(order.price) > 0 ? <><br/><span style={{ fontSize: '10px', opacity: 0.8 }}>Lmt: ₹{parseFloat(order.price).toFixed(2)}</span></> : null}
                        </span>
                      ) : (order.price && parseFloat(order.price) > 0 ? `₹${parseFloat(order.price).toFixed(2)}` : '—')}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: '600' }}>
                      {order.type === 'TRAILING_STOP' ? 'TRAIL-SL' : (order.type || (order.price ? 'LIMIT' : 'MARKET'))}
                      {order.parent_order_id && <span style={{ fontSize: '9px', background: 'var(--color-blue)', padding: '2px 4px', borderRadius: '4px', marginLeft: '6px' }}>OCO</span>}
                    </td>
                    {activeTab === 'Order History' && (
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                        {order.taxes ? `₹${parseFloat(order.taxes).toFixed(2)}` : '₹0.00'}
                      </td>
                    )}
                    {activeTab === 'Order History' && (
                      <td style={{ padding: '12px 16px', fontWeight: '600', color: !order.realized_pnl ? 'var(--text-secondary)' : parseFloat(order.realized_pnl) > 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                        {order.realized_pnl ? `${parseFloat(order.realized_pnl) > 0 ? '+' : ''}₹${parseFloat(order.realized_pnl).toFixed(2)}` : '—'}
                      </td>
                    )}
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
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => setSelectedOrder(null)}>
          <div style={{
            background: 'var(--bg-panel)', padding: '24px', borderRadius: '8px',
            width: '90%', maxWidth: '400px', border: '1px solid var(--border-color)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Order Details</h3>
              <button onClick={() => setSelectedOrder(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '20px' }}>×</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Order ID:</span>
                <span style={{ fontWeight: '600' }}>#{selectedOrder.id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Name:</span>
                <span style={{ fontWeight: '600' }}>{selectedOrder.symbol}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Placed Time:</span>
                <span style={{ fontWeight: '600' }}>{new Date(selectedOrder.created_at).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Product Type:</span>
                <span style={{ fontWeight: '600' }}>{selectedOrder.product_type === 'INT' ? 'INTRADAY (MIS)' : 'DELIVERY (NRML)'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Order Type:</span>
                <span style={{ fontWeight: '600' }}>{selectedOrder.type === 'TRAILING_STOP' ? 'TRAILING SL' : (selectedOrder.type || (selectedOrder.price ? 'LIMIT' : 'MARKET'))}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{selectedOrder.type === 'TRAILING_STOP' ? 'Trigger Price:' : 'Average Price:'}</span>
                <span style={{ fontWeight: '600' }}>₹{parseFloat((selectedOrder.type === 'TRAILING_STOP' ? selectedOrder.trigger_price : selectedOrder.price) || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Quantity:</span>
                <span style={{ fontWeight: '600' }}>{selectedOrder.quantity}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Order Value:</span>
                <span style={{ fontWeight: '700', color: 'var(--color-blue)' }}>₹{(parseFloat((selectedOrder.type === 'TRAILING_STOP' ? selectedOrder.trigger_price : selectedOrder.price) || 0) * selectedOrder.quantity).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Status:</span>
                <span style={{ fontWeight: '700', color: selectedOrder.status === 'EXECUTED' ? 'var(--color-green-light)' : (selectedOrder.status === 'REJECTED' || selectedOrder.status === 'CANCELLED' ? 'var(--color-red-light)' : 'var(--color-yellow)') }}>
                  {selectedOrder.status}
                </span>
              </div>
            </div>
            
            <button 
              onClick={() => setSelectedOrder(null)} 
              style={{ width: '100%', padding: '12px', background: 'var(--color-blue)', color: 'white', border: 'none', borderRadius: '4px', marginTop: '24px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              CLOSE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
