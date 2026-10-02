import React, { useState } from 'react';
import { useStore } from '../store';
import { Bell, Trash2, CheckCircle2, AlertCircle, Plus, Info, Clock, Check } from 'lucide-react';

export default function AlertsView() {
  const alerts = useStore(state => state.alerts || []);
  const prices = useStore(state => state.prices || {});
  const removeAlert = useStore(state => state.removeAlert);
  const clearOldAlerts = useStore(state => state.clearOldAlerts);
  const selectedSymbol = useStore(state => state.selectedSymbol);
  const setAlertModalSymbol = useStore(state => state.setAlertModalSymbol);
  
  const [filter, setFilter] = useState('ALL'); // ALL, ACTIVE, TRIGGERED

  const activeAlerts = alerts.filter(a => !a.triggered);
  const triggeredAlerts = alerts.filter(a => a.triggered);

  const filteredAlerts = alerts.filter(a => {
    if (filter === 'ACTIVE') return !a.triggered;
    if (filter === 'TRIGGERED') return a.triggered;
    return true;
  });

  return (
    <div style={{ padding: '16px', width: '100%', height: '100%', background: 'var(--bg-dark)', overflowY: 'auto' }}>
      
      {/* Top Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: '#F8FAFC' }}>
            <Bell size={22} color="var(--color-blue)" /> Price Alerts
          </h2>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Live real-time price monitoring and instant target execution alerts
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            type="button"
            onClick={() => setAlertModalSymbol(selectedSymbol || 'NSE:NIFTY50-INDEX')} 
            className="btn" 
            style={{ 
              background: 'var(--color-blue)', color: '#fff', border: 'none', 
              padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: '700', 
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.35)'
            }}
          >
            <Plus size={15} /> Create Alert
          </button>

          {triggeredAlerts.length > 0 && (
            <button 
              type="button"
              onClick={clearOldAlerts} 
              className="btn" 
              style={{ 
                background: 'rgba(239, 68, 68, 0.12)', color: 'var(--color-red-light)', 
                border: '1px solid rgba(239, 68, 68, 0.3)', padding: '8px 14px', 
                borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Clear Triggered ({triggeredAlerts.length})
            </button>
          )}

          {/* Web Push Notification Permission Prompt */}
          {"Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied" && (
            <button 
              onClick={() => Notification.requestPermission()}
              style={{
                background: 'rgba(96, 165, 250, 0.12)', color: '#60A5FA', border: '1px solid rgba(96, 165, 250, 0.3)',
                padding: '7px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Enable Browser Push
            </button>
          )}
        </div>
      </div>

      {/* Automated 08:19 AM Morning Lifecycle Note */}
      <div style={{
        background: 'rgba(59, 130, 246, 0.08)',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        borderRadius: '8px',
        padding: '10px 14px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '12px',
        color: '#93C5FD'
      }}>
        <Clock size={16} style={{ flexShrink: 0, color: '#60A5FA' }} />
        <span>
          <strong>Daily Persistence:</strong> All alerts stay saved and visible across browser reloads throughout the trading day. Daily alerts automatically reset each morning at <strong>08:19 AM IST</strong> before market open.
        </span>
      </div>

      {/* Tabs with Counts */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {[
          { key: 'ALL', label: 'All', count: alerts.length },
          { key: 'ACTIVE', label: 'Active', count: activeAlerts.length },
          { key: 'TRIGGERED', label: 'Triggered', count: triggeredAlerts.length }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            style={{
              background: filter === tab.key ? 'var(--color-blue)' : 'var(--bg-hover)',
              color: filter === tab.key ? '#fff' : 'var(--text-secondary)',
              border: 'none', padding: '7px 16px', borderRadius: '6px',
              fontSize: '12px', fontWeight: '700', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <span>{tab.label}</span>
            <span style={{
              background: filter === tab.key ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
              padding: '1px 6px', borderRadius: '10px', fontSize: '10px'
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {filteredAlerts.length === 0 ? (
        <div style={{ 
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
          padding: '40px 16px', background: 'var(--bg-panel)', borderRadius: '12px', border: '1px dashed var(--border-color)',
          textAlign: 'center'
        }}>
          <Bell size={42} color="var(--color-blue)" style={{ marginBottom: '12px', opacity: 0.8 }} />
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, color: 'var(--text-primary)' }}>
            {filter === 'ALL' && 'No price alerts created yet'}
            {filter === 'ACTIVE' && 'No active price alerts pending'}
            {filter === 'TRIGGERED' && 'No alerts have triggered yet today'}
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', maxWidth: '440px', lineHeight: '1.5' }}>
            {filter === 'TRIGGERED' 
              ? 'When any active alert hits your target price, it will appear here with the exact execution price and time.'
              : 'Set price triggers to receive immediate notifications when a stock, future, or option reaches your target level.'}
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '16px' }}>
            <button
              onClick={() => setAlertModalSymbol(selectedSymbol || 'NSE:NIFTY50-INDEX')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'var(--color-blue)', color: '#fff', border: 'none',
                padding: '9px 20px', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.35)'
              }}
            >
              <Plus size={15} /> Create Alert
            </button>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '16px' }}>
            💡 You can also tap the 🔔 Bell icon in your Watchlist, Stock Overview, or Option Chain to set alerts anytime.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredAlerts.map(alert => {
            const clean = alert.symbol?.includes(':') ? alert.symbol.split(':')[1] : alert.symbol;
            const livePriceObj = prices[alert.symbol] || prices[clean] || prices[`NSE:${clean}`] || prices[`BSE:${clean}`] || prices[`MCX:${clean}`];
            const liveLtp = Number(livePriceObj?.ltp || 0);

            let distanceText = '';
            if (liveLtp > 0 && !alert.triggered) {
              const diff = alert.targetPrice - liveLtp;
              const pct = (diff / liveLtp) * 100;
              distanceText = `${diff > 0 ? '+' : ''}₹${diff.toFixed(2)} (${diff > 0 ? '+' : ''}${pct.toFixed(2)}% away)`;
            }

            return (
              <div key={alert.id} style={{ 
                background: 'var(--bg-panel)', borderRadius: '12px', padding: '16px 20px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                border: `1px solid ${alert.triggered ? 'rgba(16, 185, 129, 0.25)' : 'rgba(96, 165, 250, 0.25)'}`,
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                flexWrap: 'wrap', gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: '220px', flex: 1 }}>
                  <div style={{ 
                    background: alert.triggered ? 'rgba(16, 185, 129, 0.12)' : 'rgba(96, 165, 250, 0.12)',
                    color: alert.triggered ? '#10B981' : '#60A5FA',
                    padding: '12px', borderRadius: '50%', flexShrink: 0
                  }}>
                    {alert.triggered ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '16px', fontWeight: '800', color: '#F8FAFC' }}>
                        {alert.symbol}
                      </span>
                      <span style={{
                        fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px',
                        background: alert.triggered ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                        color: alert.triggered ? '#10B981' : '#60A5FA'
                      }}>
                        {alert.triggered ? 'TRIGGERED' : 'MONITORING LIVE'}
                      </span>
                    </div>

                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Trigger condition: Price crosses <strong style={{ color: '#F8FAFC' }}>{alert.condition.toLowerCase()} ₹{alert.targetPrice}</strong>
                    </div>

                    {liveLtp > 0 && !alert.triggered && (
                      <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>
                        Current LTP: <strong style={{ color: '#F8FAFC' }}>₹{liveLtp.toFixed(2)}</strong> {distanceText && <span style={{ color: '#60A5FA' }}>• {distanceText}</span>}
                      </div>
                    )}

                    {alert.triggered && (
                      <div style={{ fontSize: '12px', color: '#10B981', marginTop: '4px', fontWeight: '600' }}>
                        ✓ Hit target at ₹{alert.triggerPrice?.toFixed(2)} on {new Date(alert.triggeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    )}

                    {alert.createdAt && (
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Created: {new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button 
                    onClick={() => removeAlert(alert.id)}
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-red-light)',
                      border: '1px solid rgba(239, 68, 68, 0.2)', padding: '8px 10px', borderRadius: '6px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '600'
                    }}
                    title="Delete Alert"
                  >
                    <Trash2 size={16} /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
