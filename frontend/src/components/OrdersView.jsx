import React, { useState } from 'react';
import { useStore, API } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { Box, Clock, Target, History, ShoppingBag } from 'lucide-react';
import AlertsView from './AlertsView';

export default function OrdersView() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const { orders, pendingTriggers, removePendingTrigger, setBasketModalOpen } = useStore(useShallow(state => ({ orders: state.orders, pendingTriggers: state.pendingTriggers, removePendingTrigger: state.removePendingTrigger, setBasketModalOpen: state.setBasketModalOpen })));
  const [activeTab, setActiveTab] = useState('Open Orders');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [tagModalOrder, setTagModalOrder] = useState(null);
  const [activeTag, setActiveTag] = useState('');
  const [tradeNotes, setTradeNotes] = useState('');
  const [isSavingTag, setIsSavingTag] = useState(false);

  const openTagModal = (order) => {
    setTagModalOrder(order);
    setActiveTag(order.tag || '');
    setTradeNotes(order.notes || '');
  };

  const handleSaveTag = async (tagToSave, notesToSave) => {
    if (!tagModalOrder) return;
    try {
      setIsSavingTag(true);
      const res = await fetch(`${API}/api/order/${tagModalOrder.id}/tag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: tagToSave, notes: notesToSave })
      });
      if (res.ok) {
        useStore.getState().fetchUserData();
        setTagModalOrder(null);
      }
    } catch (e) {
      alert('Error saving tag: ' + e.message);
    } finally {
      setIsSavingTag(false);
    }
  };

  const tabs = ['Open Orders', 'Pending Triggers', 'Order History', 'Alerts'];

  const isToday = (dateString) => {
     if (!dateString) return false;
     const d = new Date(dateString);
     const today = new Date();
     return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };

  // Filter orders based on active tab
  let displayOrders = orders.filter(order => {
    if (activeTab === 'Open Orders') return order.status === 'PENDING' && !order.parent_order_id;
    if (activeTab === 'Order History') return order.status !== 'PENDING' && order.status !== 'PENDING_TRIGGER' && isToday(order.updated_at || order.created_at);
    return false;
  });
  
  const boLegTriggers = orders
    .filter(order => order.status === 'PENDING_TRIGGER')
    .map(order => {
      let pType = order.product_type || 'INT';
      if (order.trigger_type === 'BO') pType = 'BO';
      else if (order.trigger_type === 'CO') pType = 'CO';
      if (pType === 'DEL' && order.parent_order_id) pType = 'INT'; // Legs are never DEL

      return {
        ...order,
        id: order.id,
        symbol: order.symbol,
        type: order.type,
        side: order.side,
        quantity: order.quantity,
        price: order.price,
        trigger_price: order.trigger_price,
        limitPrice: order.price ? parseFloat(order.price) : null,
        triggerPrice: order.trigger_price ? parseFloat(order.trigger_price) : null,
        productType: pType,
        status: 'PENDING_TRIGGER',
        createdAt: order.created_at,
        isBackendOrder: true
      };
    });

  let displayTriggers = [...(pendingTriggers || []), ...boLegTriggers];
  


  if (statusFilter !== 'ALL') {
    displayOrders = displayOrders.filter(order => order.status === statusFilter);
    displayTriggers = displayTriggers.filter(trigger => trigger.status === statusFilter);
  }

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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-main)', minHeight: 0 }}>
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
                color: activeTab === tab ? '#2563eb' : 'var(--text-secondary)',
                borderBottom: activeTab === tab ? '2px solid #2563eb' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {tab}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {activeTab === 'Order History' && (
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-color)', 
                padding: '6px 12px', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '13px',
                outline: 'none', cursor: 'pointer'
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="EXECUTED">Executed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="REJECTED">Rejected</option>
            </select>
          )}
          <button
            type="button"
            onClick={() => setBasketModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(37, 99, 235, 0.12)',
              border: '1px solid rgba(37, 99, 235, 0.3)',
              color: '#2563eb',
              borderRadius: '4px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease'
            }}
          >
            <ShoppingBag size={14} /> Basket Orders
          </button>
          <input
            type="text"
            placeholder="Filter orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-color)', 
              padding: '6px 12px', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '13px',
              width: '200px', outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Content Area */}
      {activeTab === 'Alerts' ? (
        <AlertsView />
      ) : (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: (activeTab === 'Pending Triggers' ? displayTriggers.length === 0 : displayOrders.length === 0) ? 'center' : 'flex-start', minHeight: 0, width: '100%' }}>
        {(activeTab === 'Pending Triggers' ? displayTriggers.length === 0 : displayOrders.length === 0) ? (
          <div style={{ textAlign: 'center' }}>
            {(() => {
              let Icon = Box;
              let subtitle = '';
              if (activeTab === 'Open Orders') { Icon = Clock; subtitle = 'Limit and Stop orders waiting to be executed will appear here.'; }
              else if (activeTab === 'Pending Triggers') { Icon = Target; subtitle = 'Bracket (BO), Cover (CO), and GTT orders waiting for a price trigger will be listed here.'; }
              else if (activeTab === 'Order History') { Icon = History; subtitle = 'Your executed, cancelled, and rejected orders for today will appear here.'; }
              else if (activeTab === 'Basket Orders') { Icon = ShoppingBag; subtitle = 'Create and execute multiple orders simultaneously.'; }

              return (
                <>
                  <div style={{ 
                    width: '120px', height: '100px', background: 'var(--bg-panel)', 
                    borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.2)', margin: '0 auto 24px', position: 'relative'
                  }}>
                    <Icon size={40} color="var(--color-green-light)" />
                    <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '24px' }}>✨</div>
                  </div>
                  <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>You don't have any {activeTab.toLowerCase()}</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '300px', margin: '0 auto', lineHeight: '1.5' }}>{subtitle}</p>
                </>
              );
            })()}
          </div>
        ) : (
          <div style={{ padding: window.innerWidth <= 1200 ? '12px' : '24px', width: '100%', height: '100%', overflowY: 'auto', flex: 1, minHeight: 0 }}>
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
            {/* 📱 High-Density Kite/Fyers-Style Mobile Order List (Only renders on mobile screens) */}
            {isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                {activeTab === 'Pending Triggers' ? (
                  displayTriggers.map(trigger => {
                    const isBuy = trigger.side === 'BUY';
                    const timeStr = trigger.createdAt ? new Date(trigger.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
                    return (
                      <div
                        key={trigger.id}
                        style={{
                          padding: '12px 14px',
                          borderBottom: '1px solid rgba(255,255,255,0.06)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: isBuy ? 'var(--color-green-light)' : 'var(--color-red-light)', background: isBuy ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', padding: '1px 6px', borderRadius: '3px' }}>
                              {trigger.side}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Qty. {Number(trigger.quantity)}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>🕒 {timeStr}</span>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-yellow)' }}>TRIGGER PENDING</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
                            {(trigger.symbol || '').split('-')[0]}
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-blue)' }}>
                            Trg: ₹{(trigger.triggerPrice || trigger.limitPrice || 0).toFixed(2)}
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          <div>{trigger.productType} • {trigger.type}</div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {trigger.isBackendOrder && (
                              <button onClick={() => useStore.getState().openEditOrderModal(trigger)} style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--color-blue)', border: '1px solid rgba(59,130,246,0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}>
                                EDIT
                              </button>
                            )}
                            <button onClick={() => { if (window.confirm('Cancel trigger?')) { if (trigger.isBackendOrder) useStore.getState().cancelOrder(trigger.id); else removePendingTrigger(trigger.id); } }} style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--color-red-light)', border: '1px solid rgba(239,68,68,0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}>
                              CANCEL
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  displayOrders.map(order => {
                    const isBuy = order.side === 'BUY';
                    const isExecuted = order.status === 'EXECUTED' || order.status === 'COMPLETED' || order.status === 'COMPLETE';
                    const isPending = order.status === 'PENDING';
                    const statusColor = isExecuted ? 'var(--color-green-light)' : (isPending ? 'var(--color-yellow)' : 'var(--color-red-light)');
                    const timeStr = order.created_at ? new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
                    const pnlVal = order.realized_pnl ? parseFloat(order.realized_pnl) : 0;
                    const priceVal = parseFloat(order.average_price || order.price || 0);

                    return (
                      <div
                        key={order.id}
                        onClick={() => setSelectedOrder(order)}
                        style={{
                          padding: '10px 14px',
                          borderBottom: '1px solid rgba(255,255,255,0.06)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '3px',
                          cursor: 'pointer'
                        }}
                      >
                        {/* Top Line: Side & Qty (Left) | Time & Status (Right) */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '10.5px', fontWeight: '700', color: isBuy ? 'var(--color-green-light)' : 'var(--color-red-light)', background: isBuy ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', padding: '1px 5px', borderRadius: '3px' }}>
                              {order.side}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              Qty. {Number(order.quantity)}/{Number(order.quantity)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>🕒 {timeStr}</span>
                            <span style={{ fontSize: '10.5px', fontWeight: '700', color: statusColor }}>
                              {order.status}
                            </span>
                          </div>
                        </div>

                        {/* Main Line: Symbol Name (Left) | Execution Price (Right) */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '65%' }}>
                            {(order.symbol || '').split('-')[0]}
                          </div>
                          <div style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-primary)' }}>
                            ₹{priceVal.toFixed(2)}
                          </div>
                        </div>

                        {/* Bottom Line: Product/Exchange (Left) | Tag & Realized P&L (Right) */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span>{order.symbol?.includes(':') ? order.symbol.split(':')[0] : (((order.symbol || '').endsWith('-MF') || /^\d{5,6}$/.test(order.symbol || '') || ['EDEL', 'MIRA', 'NIPP'].includes(order.symbol)) ? 'MF' : 'NSE')}</span>
                            <span>{order.product_type || 'NRML'}</span>
                            <span>{order.type || 'MKT'}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            {pnlVal !== 0 && (
                              <span style={{ color: pnlVal > 0 ? 'var(--color-green-light)' : 'var(--color-red-light)', fontWeight: '600' }}>
                                {pnlVal > 0 ? '+' : ''}₹{pnlVal.toFixed(2)}
                              </span>
                            )}
                            {activeTab === 'Order History' && (
                              order.tag ? (
                                <span 
                                  onClick={(e) => { e.stopPropagation(); openTagModal(order); }}
                                  style={{ fontSize: '10px', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)', padding: '1px 5px', borderRadius: '3px', fontWeight: '600' }}
                                >
                                  {order.tag}
                                </span>
                              ) : (
                                <span 
                                  onClick={(e) => { e.stopPropagation(); openTagModal(order); }}
                                  style={{ fontSize: '10px', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', padding: '1px 5px', borderRadius: '3px' }}
                                >
                                  + Tag
                                </span>
                              )
                            )}
                            {activeTab === 'Open Orders' && (
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button onClick={(e) => { e.stopPropagation(); useStore.getState().openEditOrderModal(order); }} style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--color-blue)', border: '1px solid rgba(59,130,246,0.3)', padding: '2px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}>
                                  EDIT
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); if (window.confirm('Cancel order?')) useStore.getState().cancelOrder(order.id); }} style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--color-red-light)', border: '1px solid rgba(239,68,68,0.3)', padding: '2px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}>
                                  CANCEL
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              /* 🖥️ Full Desktop Table (Unchanged for web screens) */
            <table className="desktop-orders-table" style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                {activeTab === 'Pending Triggers' ? (
                  <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Time</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Symbol</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Type</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Qty</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Target/Trigger</th>
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
                    {activeTab === 'Order History' && <th style={{ padding: '12px 16px', fontWeight: '500' }}>Tag / Journal</th>}
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Status</th>
                    {activeTab === 'Open Orders' && <th style={{ padding: '12px 16px', fontWeight: '500', textAlign: 'right' }}>Actions</th>}
                  </tr>
                )}
              </thead>
              <tbody>
                {activeTab === 'Pending Triggers' ? (
                  displayTriggers.map(trigger => (
                    <tr key={trigger.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        {(() => {
                          if (!trigger.createdAt) return '—';
                          const d = new Date(trigger.createdAt);
                          return isNaN(d.getTime()) ? '—' : d.toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' });
                        })()}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }} title={trigger.symbol || ''}>
                        {(trigger.symbol || '').split('-')[0] || '—'}
                      </td>
                      <td style={{ padding: '12px 16px', color: trigger.side === 'BUY' ? 'var(--color-green-light)' : 'var(--color-red-light)', fontWeight: '600' }}>
                        <span style={{ background: trigger.side === 'BUY' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span>{trigger.side}</span>
                          <span style={{ fontSize: '10px', opacity: 0.8 }}>({trigger.productType})</span>
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>{Number(trigger.quantity)}</td>
                      <td style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--color-blue)' }}>₹{(trigger.triggerPrice || trigger.limitPrice || 0).toFixed(2)}</td>
                      <td style={{ padding: '12px 16px' }}>{trigger.trailingJump ? `₹${trigger.trailingJump}` : '—'}</td>
                      <td style={{ padding: '12px 16px', fontWeight: '600' }}>{trigger.type.replace('_', ' ')}</td>
                      <td style={{ padding: '12px 16px', fontWeight: '600', color: trigger.status === 'PENDING_TRIGGER' ? 'var(--color-yellow)' : 'var(--color-green-light)' }}>
                        {trigger.status.replace('_', ' ')}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {trigger.status === 'PENDING_TRIGGER' && (
                           <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                             {trigger.isBackendOrder && (
                               <button 
                                 onClick={() => useStore.getState().openEditOrderModal(trigger)}
                                 style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-blue)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '4px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                               >
                                 EDIT
                               </button>
                             )}
                             <button 
                               onClick={() => {
                                 if (window.confirm('Cancel this pending trigger?')) {
                                   if (trigger.isBackendOrder) {
                                     useStore.getState().cancelOrder(trigger.id);
                                   } else {
                                     removePendingTrigger(trigger.id);
                                   }
                                 }
                               }}
                               style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-red-light)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '4px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                             >
                               CANCEL
                             </button>
                           </div>
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
                      ...({})
                    }}
                    onMouseEnter={(e) => activeTab === 'Order History' && (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={(e) => activeTab === 'Order History' && (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      {(() => {
                        const dateStr = activeTab === 'Order History' ? (order.updated_at || order.created_at) : order.created_at;
                        if (!dateStr) return '—';
                        const d = new Date(dateStr);
                        return isNaN(d.getTime()) ? '—' : d.toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' });
                      })()}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: '600' }}>
                      {(() => {
                        const clean = (order.symbol || '').includes(':') ? (order.symbol || '').split(':')[1] : (order.symbol || '');
                        const isMf = clean.endsWith('-MF') || /^\d{5,6}$/.test(clean) || ['EDEL', 'MIRA', 'NIPP', 'EDEL-MF', 'MIRA-MF', 'NIPP-MF'].includes(clean);
                        return (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <span>{(order.symbol || '').split('-')[0] || '—'}</span>
                            {isMf && (
                              <span style={{ fontSize: '9px', color: 'var(--color-blue-light)', background: 'rgba(59,130,246,0.12)', padding: '1px 5px', borderRadius: '3px', fontWeight: '700' }}>
                                MF
                              </span>
                            )}
                          </div>
                        );
                      })()}
                      {order.tag && (
                        <span style={{ fontSize: '10px', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px', fontWeight: '600' }}>
                          {order.tag}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', color: order.side === 'BUY' ? 'var(--color-green-light)' : 'var(--color-red-light)', fontWeight: '600' }}>
                      <span style={{ background: order.side === 'BUY' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span>{order.side}</span>
                        <span style={{ fontSize: '10px', opacity: 0.8 }}>
                          ({(order.sl_price && order.tgt_price) ? 'BO' : (order.sl_price && !order.parent_order_id) ? 'CO' : (order.product_type || 'DEL')})
                        </span>
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>{Number(order.quantity)}</td>
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
                      {order.tgt_price && order.sl_price && <span style={{ fontSize: '9px', background: '#f59e0b', color: '#000', padding: '2px 4px', borderRadius: '4px', marginLeft: '6px', fontWeight: '700' }}>BO</span>}
                      {order.sl_price && !order.tgt_price && <span style={{ fontSize: '9px', background: '#8b5cf6', color: '#fff', padding: '2px 4px', borderRadius: '4px', marginLeft: '6px', fontWeight: '700' }}>CO</span>}
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
                    {activeTab === 'Order History' && (
                      <td style={{ padding: '12px 16px' }} onClick={(e) => { e.stopPropagation(); openTagModal(order); }}>
                        {order.tag ? (
                          <span style={{ fontSize: '11px', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)', padding: '3px 8px', borderRadius: '4px', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
                            {order.tag}
                          </span>
                        ) : (
                          <button style={{ background: 'var(--bg-hover)', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}>
                            + Tag
                          </button>
                        )}
                      </td>
                    )}
                    <td style={{ padding: '12px 16px', fontWeight: '600', color: order.status === 'PENDING' ? 'var(--color-yellow)' : ((order.status === 'EXECUTED' || order.status === 'COMPLETED' || order.status === 'COMPLETE') ? 'var(--color-green-light)' : 'var(--color-red-light)') }}>
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
            )}
            </div>
          </div>
        )}
      </div>

      )}

      {/* Dedicated Trade Tagging & Journal Modal */}
      {tagModalOrder && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.65)', zIndex: 1100,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => setTagModalOrder(null)}>
          <div style={{
            background: 'var(--bg-panel)', padding: '24px', borderRadius: '12px',
            width: '90%', maxWidth: '420px', border: '1px solid var(--border-color)',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '16px'
          }} onClick={e => e.stopPropagation()}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  🏷️ Tag Trade — {(tagModalOrder.symbol || '').split('-')[0]}
                </h3>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {tagModalOrder.side} {Number(tagModalOrder.quantity)} Qty @ ₹{parseFloat(tagModalOrder.price || tagModalOrder.average_price || 0).toFixed(2)}
                </div>
              </div>
              <button onClick={() => setTagModalOrder(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '20px' }}>×</button>
            </div>

            {/* Quick Preset Tags */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>Select Trade Reason / Tag:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  { tag: 'Breakout 🚀', color: '#3b82f6' },
                  { tag: 'Scalp ⚡', color: '#10b981' },
                  { tag: 'FOMO ⚠️', color: '#ef4444' },
                  { tag: 'Reversal 🔄', color: '#8b5cf6' },
                  { tag: 'News 📰', color: '#f59e0b' },
                  { tag: 'Support/Res 📊', color: '#06b6d4' }
                ].map(item => (
                  <button
                    key={item.tag}
                    onClick={() => setActiveTag(activeTag === item.tag ? '' : item.tag)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: activeTag === item.tag ? `1px solid ${item.color}` : '1px solid var(--border-color)',
                      background: activeTag === item.tag ? `${item.color}25` : 'var(--bg-hover)',
                      color: activeTag === item.tag ? '#fff' : 'var(--text-primary)',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    {item.tag} {activeTag === item.tag ? '✓' : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* Trade Notes */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Notes & Journal (Optional):</div>
              <textarea
                value={tradeNotes}
                onChange={(e) => setTradeNotes(e.target.value)}
                placeholder="What was your setup or emotional state?"
                rows={3}
                style={{
                  width: '100%',
                  background: 'var(--bg-hover)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  padding: '8px 12px',
                  fontSize: '12px',
                  resize: 'none',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              {tagModalOrder.tag && (
                <button
                  onClick={() => handleSaveTag('', '')}
                  disabled={isSavingTag}
                  style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--color-red-light)', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Clear Tag
                </button>
              )}
              <button
                onClick={() => handleSaveTag(activeTag, tradeNotes)}
                disabled={isSavingTag}
                style={{ flex: 2, padding: '10px', background: 'var(--color-blue)', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
              >
                {isSavingTag ? 'Saving...' : 'Save Tag & Note ✓'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                <span style={{ fontWeight: '600' }}>{selectedOrder.created_at ? (() => { const d = new Date(selectedOrder.created_at); return isNaN(d.getTime()) ? '—' : d.toLocaleString(); })() : '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Product Type:</span>
                <span style={{ fontWeight: '600' }}>
                  {(selectedOrder.sl_price && selectedOrder.tgt_price) ? 'BRACKET ORDER (BO)' : 
                   (selectedOrder.sl_price && !selectedOrder.parent_order_id) ? 'COVER ORDER (CO)' : 
                   selectedOrder.product_type === 'INT' ? 'INTRADAY (MIS)' : 'DELIVERY (NRML)'}
                </span>
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
                <span style={{ fontWeight: '600' }}>{Number(selectedOrder.quantity)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Order Value:</span>
                <span style={{ fontWeight: '700', color: 'var(--color-blue)' }}>₹{(parseFloat((selectedOrder.type === 'TRAILING_STOP' ? selectedOrder.trigger_price : selectedOrder.price) || 0) * Number(selectedOrder.quantity)).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Status:</span>
                <span style={{ fontWeight: '700', color: (selectedOrder.status === 'EXECUTED' || selectedOrder.status === 'COMPLETED' || selectedOrder.status === 'COMPLETE') ? 'var(--color-green-light)' : (selectedOrder.status === 'REJECTED' || selectedOrder.status === 'CANCELLED' ? 'var(--color-red-light)' : 'var(--color-yellow)') }}>
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



