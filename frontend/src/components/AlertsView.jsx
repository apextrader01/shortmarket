import React, { useState } from 'react';
import { useStore } from '../store';
import { Bell, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function AlertsView() {
  const alerts = useStore(state => state.alerts);
  const removeAlert = useStore(state => state.removeAlert);
  const clearOldAlerts = useStore(state => state.clearOldAlerts);
  
  const [filter, setFilter] = useState('ALL'); // ALL, ACTIVE, TRIGGERED

  const filteredAlerts = alerts.filter(a => {
    if (filter === 'ACTIVE') return !a.triggered;
    if (filter === 'TRIGGERED') return a.triggered;
    return true;
  });

  return (
    <div style={{ padding: '24px', width: '100%', height: '100%', background: 'var(--bg-dark)', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={24} color="var(--color-blue)" /> Price Alerts
          </h2>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Manage your active and triggered notifications
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button onClick={clearOldAlerts} className="btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-red-light)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
            Clear Old Alerts
          </button>

          {/* Ask for permission button if not granted */}
          {"Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied" && (
            <button 
              onClick={() => Notification.requestPermission()}
              style={{
                background: 'rgba(96, 165, 250, 0.1)', color: '#60A5FA', border: '1px solid #60A5FA',
                padding: '6px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer'
              }}
            >
              Enable Browser Push Notifications
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {['ALL', 'ACTIVE', 'TRIGGERED'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? 'var(--color-blue)' : 'rgba(255,255,255,0.05)',
              color: filter === f ? '#fff' : 'var(--text-secondary)',
              border: 'none', padding: '8px 16px', borderRadius: '6px',
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
          height: '200px', background: 'var(--bg-panel)', borderRadius: '12px', border: '1px dashed #334155'
        }}>
          <Bell size={40} color="#334155" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, color: 'var(--text-secondary)' }}>No alerts found</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Go to the Option Chain and click the Bell icon next to any strike to set an alert.
          </p>
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
