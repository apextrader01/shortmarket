import React, { useState } from 'react';
import { X, TrendingUp, Calendar, Info } from 'lucide-react';
import { useStore } from '../store';
import MutualFundChart from './MutualFundChart';

export default function MutualFundModal({ fund, onClose }) {
  const [tab, setTab] = useState('SIP'); // SIP, Lumpsum
  const [amount, setAmount] = useState('5000');
  const [sipDate, setSipDate] = useState('5'); // Day of month

  const { user } = useStore();
  const balanceNum = Number(user?.balance) || 0;
  const isInsufficient = tab === 'Lumpsum' && balanceNum < Number(amount);

  const handleInvest = () => {
      // In a real app, this would dispatch to backend. For now, just show a success alert and close.
      if (tab === 'SIP') {
          alert(`Success! Started a monthly SIP of ₹${amount} in ${fund.name} to be deducted on the ${sipDate}th of every month.`);
      } else {
          alert(`Success! Placed a one-time Lumpsum order of ₹${amount} in ${fund.name}.`);
      }
      onClose();
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{
        width: '800px', height: '600px', background: 'var(--bg-dark)', borderRadius: '12px', 
        border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column'
      }}>
        
        {/* Header */}
        <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-panel)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-blue)', border: '1px solid var(--border-color)' }}>
                    <TrendingUp size={12} />
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{fund.amc} Mutual Fund</div>
                <div style={{ fontSize: '11px', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '12px', color: 'var(--text-secondary)' }}>{fund.category}</div>
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '8px', color: 'var(--text-primary)' }}>{fund.name}</h2>
            <div style={{ display: 'flex', gap: '24px', fontSize: '13px' }}>
                <div>NAV: <span style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '15px' }}>₹{fund.nav.toFixed(2)}</span></div>
                <div>3Y Return: <span style={{ color: 'var(--color-green-light)', fontWeight: '700', fontSize: '15px' }}>+{fund.return3y}%</span></div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.2s' }}><X size={18} /></button>
        </div>

        {/* Layout Split */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            
            {/* Left side: Chart */}
            <div style={{ flex: 1, borderRight: '1px solid var(--border-color)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-secondary)' }}>Historical NAV (5Y)</div>
                <div style={{ flex: 1, background: 'rgba(0,0,0,0.1)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                    <MutualFundChart schemeCode={fund.id} color="#3b82f6" />
                </div>
            </div>

            {/* Right side: Order Form */}
            <div style={{ width: '320px', display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.01)' }}>
                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-panel)' }}>
                  {['SIP', 'Lumpsum'].map(t => (
                    <div key={t} onClick={() => setTab(t)} style={{ 
                      flex: 1, textAlign: 'center', padding: '16px 0', fontSize: '13px', fontWeight: tab === t ? '700' : '500', 
                      color: tab === t ? 'var(--color-blue)' : 'var(--text-secondary)',
                      borderBottom: tab === t ? '2px solid var(--color-blue)' : '2px solid transparent',
                      cursor: 'pointer', transition: 'all 0.2s'
                    }}>{t}</div>
                  ))}
                </div>

                <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Investment Amount (₹)</div>
              <input 
                type="number" 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
                style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '4px', color: '#fff', fontSize: '16px', outline: 'none', fontWeight: '600' }} 
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  {['1000', '5000', '10000'].map(val => (
                      <button key={val} onClick={() => setAmount(val)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '4px 12px', borderRadius: '12px', fontSize: '11px', cursor: 'pointer' }}>+₹{val}</button>
                  ))}
              </div>
            </div>

            {tab === 'SIP' && (
                <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>SIP Date (Monthly)</div>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '4px' }}>
                        <Calendar size={16} color="var(--text-secondary)" style={{ marginRight: '8px' }} />
                        <select 
                            value={sipDate} 
                            onChange={e => setSipDate(e.target.value)}
                            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '14px', outline: 'none', width: '100%', cursor: 'pointer' }}
                        >
                            {[1, 5, 10, 15, 20, 25].map(d => <option key={d} value={d}>{d}th of every month</option>)}
                        </select>
                    </div>
                </div>
            )}

                {/* Note */}
                <div style={{ display: 'flex', gap: '8px', background: 'rgba(59, 130, 246, 0.1)', padding: '12px', borderRadius: '4px', color: 'var(--color-blue)', fontSize: '11px', lineHeight: '1.4' }}>
                    <Info size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>Investments are subject to market risks. Cut-off time for same day NAV is 2:00 PM.</span>
                </div>

                {isInsufficient && (
                  <div style={{ color: 'var(--color-red-light)', fontSize: '12px', marginTop: '12px', fontWeight: '600', padding: '8px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                      Insufficient balance! You need ₹{amount} for this Lumpsum investment.
                  </div>
                )}
                </div>

                {/* Footer */}
                <div style={{ padding: '20px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-panel)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Available Margin</div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>₹{balanceNum.toFixed(2)}</div>
                  </div>
                  
                  <button 
                    onClick={handleInvest}
                    disabled={isInsufficient || Number(amount) < 100}
                    style={{ 
                      width: '100%',
                      background: 'var(--color-blue)', 
                      color: '#fff', 
                      padding: '14px', borderRadius: '6px', fontSize: '14px', fontWeight: '700', letterSpacing: '0.5px',
                      border: 'none', cursor: (isInsufficient || Number(amount) < 100) ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease',
                      opacity: (isInsufficient || Number(amount) < 100) ? 0.5 : 1
                    }}
                  >
                    START {tab.toUpperCase()}
                  </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
