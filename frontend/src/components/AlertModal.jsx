import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { X, Bell } from 'lucide-react';

export default function AlertModal() {
  const symbol = useStore(state => state.alertModalSymbol);
  const setAlertModalSymbol = useStore(state => state.setAlertModalSymbol);
  const addAlert = useStore(state => state.addAlert);
  const prices = useStore(state => state.prices);

  const [condition, setCondition] = useState('ABOVE');
  const [targetPrice, setTargetPrice] = useState('');

  const ltp = prices[symbol]?.ltp || 0;

  useEffect(() => {
    if (symbol) {
      setTargetPrice('');
    }
  }, [symbol]);

  if (!symbol) return null;

  const handleSave = () => {
    const val = parseFloat(targetPrice);
    if (isNaN(val) || val <= 0) {
      alert("Please enter a valid target price");
      return;
    }
    
    // Request notification permission if not granted
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }

    addAlert({
      symbol,
      condition,
      targetPrice: val
    });
    setAlertModalSymbol(null);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)',
      zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: '#1E293B', borderRadius: '12px', width: '90%', maxWidth: '400px',
        display: 'flex', flexDirection: 'column', border: '1px solid #334155',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
          padding: '16px 20px', borderBottom: '1px solid #334155' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={18} color="#60A5FA" />
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, color: '#F8FAFC' }}>
              Create Price Alert
            </h2>
          </div>
          <button 
            onClick={() => setAlertModalSymbol(null)}
            style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Instrument</div>
            <div style={{ fontSize: '18px', fontWeight: '800' }}>{symbol}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Current Price: <span style={{ fontWeight: 'bold', color: 'var(--color-blue)' }}>₹{ltp.toFixed(2)}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Condition</label>
              <select 
                value={condition} 
                onChange={(e) => setCondition(e.target.value)}
                style={{
                  width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid #334155',
                  borderRadius: '6px', color: '#fff', fontSize: '14px', outline: 'none'
                }}
              >
                <option value="ABOVE">Crosses Above</option>
                <option value="BELOW">Crosses Below</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Target Price</label>
              <input 
                type="number"
                placeholder="e.g. 150"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                style={{
                  width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid #334155',
                  borderRadius: '6px', color: '#fff', fontSize: '14px', outline: 'none'
                }}
              />
            </div>
          </div>

          <button 
            onClick={handleSave}
            style={{
              width: '100%', background: 'var(--color-blue)', color: '#fff', border: 'none',
              padding: '12px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold',
              cursor: 'pointer', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}
          >
            <Bell size={16} /> SET ALERT
          </button>
        </div>
      </div>
    </div>
  );
}
