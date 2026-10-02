import React, { useState } from 'react';
import { useStore } from '../store';
import { Bell, Trash2, CheckCircle2, AlertCircle, Plus } from 'lucide-react';

export default function AlertsView() {
  const alerts = useStore(state => state.alerts);
  const removeAlert = useStore(state => state.removeAlert);
  const clearOldAlerts = useStore(state => state.clearOldAlerts);
  const selectedSymbol = useStore(state => state.selectedSymbol);
  const setAlertModalSymbol = useStore(state => state.setAlertModalSymbol);
  
  const [filter, setFilter] = useState('ALL'); // ALL, ACTIVE, TRIGGERED

  const filteredAlerts = alerts.filter(a => {
    if (filter === 'ACTIVE') return !a.triggered;
    if (filter === 'TRIGGERED') return a.triggered;
    return true;
  });

  return (
    <div style={{ padding: '16px', width: '100%', height: '100%', background: 'var(--bg-dark)', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Bell size={22} color="var(--color-blue)" /> Price Alerts
          </h2>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Active and triggered notifications for your price targets
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            type="button"
            onClick={() => setAlertModalSymbol(selectedSymbol || 'NSE:NIFTY50')} 
            className="btn" 
            style={{ 
              background: 'var(--color-blue)', color: '#fff', border: 'none', 
              padding: '7px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', 
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
              boxShadow: '0 2px 4px rgba(37, 99, 235, 0.3)'
            }}
          >
            <Plus size={14} /> Create Alert
          </button>

          {alerts.some(a => a.triggered) && (
            <button 
              type="button"
              onClick={clearOldAlerts} 
              className="btn" 
              style={{ 
                background: 'rgba(239, 68, 68, 0.12)', color: 'var(--color-red-light)', 
                border: '1px solid rgba(239, 68, 68, 0.3)', padding: '7px 12px', 
                borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Clear Triggered
            </button>
          )}

          {/* Ask for permission button if not granted */}
          {"Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied" && (
            <button 
              onClick={() => Notification.requestPermission()}
              style={{
                background: 'rgba(96, 165, 250, 0.1)', color: '#60A5FA', border: '1px solid #60A5FA',
                padding: '6px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Enable Push
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {['ALL', 'ACTIVE', 'TRIGGERED'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? 'var(--color-blue)' : 'var(--bg-hover)',
              color: filter === f ? '#fff' : 'var(--text-secondary)',
              border: 'none', padding: '6px 14px', borderRadius: '6px',
              fontSize: '12px', fontWeight: 'bold', cursor: 'pointer'
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {filteredAlerts.length === 0 ? (
        <div style={{ 
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
          padding: '36px 16px', background: 'var(--bg-panel)', borderRadius: '12px', border: '1px dashed var(--border-color)',
          textAlign: 'center'
        }}>
          <Bell size={42} color="var(--color-blue)" style={{ marginBottom: '12px', opacity: 0.8 }} />
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, color: 'var(--text-primary)' }}>No price alerts active</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', maxWidth: '400px', lineHeight: '1.5' }}>
            Set price triggers to receive immediate alerts when a stock, future, or option reaches your target level.
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '16px' }}>
            <button
              onClick={() => setAlertModalSymbol(selectedSymbol || 'NSE:NIFTY50')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'var(--color-blue)', color: '#fff', border: 'none',
                padding: '8px 18px', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.35)'
              }}
            >
              <Plus size={15} /> Set Alert on {selectedSymbol || 'NIFTY50'}
            </button>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '16px' }}>
            💡 You can also tap the 🔔 Bell icon in your Watchlist, Stock Overview, or Option Chain to set alerts anytime.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredAlerts.map(alert => (
            <div key={alert.id} style={{ 
              background: 'var(--bg-panel)', borderRadius: '12px', padding: '16px 20px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              border: `1px solid ${alert.triggered ? 'rgba(16, 185, 129, 0.2)' : 'rgba(96, 165, 250, 0.2)'}`,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ 
                  background: alert.triggered ? 'rgba(16, 185, 129, 0.1)' : 'rgba(96, 165, 250, 0.1)',
                  color: alert.triggered ? '#10B981' : '#60A5FA',
                  padding: '10px', borderRadius: '50%'
                }}>
                  {alert.triggered ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '800' }}>{alert.symbol}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Alert me when price crosses <strong style={{ color: '#fff' }}>{alert.condition.toLowerCase()} ₹{alert.targetPrice}</strong>
                  </div>
                  {alert.triggered && (
                    <div style={{ fontSize: '12px', color: '#10B981', marginTop: '6px', fontWeight: '600' }}>
                      Triggered at ₹{alert.triggerPrice?.toFixed(2)} on {new Date(alert.triggeredAt).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>

              <button 
                onClick={() => removeAlert(alert.id)}
                style={{
                  background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-red-light)',
                  border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
                title="Delete Alert"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


