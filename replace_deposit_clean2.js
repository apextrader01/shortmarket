const fs = require('fs');
const content = `import React, { useState } from 'react';
import { X, Wallet, ArrowRight, CheckCircle, ShieldCheck } from 'lucide-react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';

export default function DepositModal({ onClose }) {
  const { requestDeposit, user } = useStore(useShallow(state => ({ requestDeposit: state.requestDeposit, user: state.user })));
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const quickAmounts = [5000, 10000, 50000, 100000];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    setLoading(true);
    setError('');
    
    const res = await requestDeposit(amount);
    if (res.success) {
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2500);
    } else {
      setError(res.error || 'Failed to request deposit');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div style={{ background: 'var(--bg-panel)', padding: '40px', borderRadius: '16px', textAlign: 'center', width: '400px', border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
          <div style={{ width: '80px', height: '80px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto', animation: 'scaleIn 0.5s ease-out' }}>
            <CheckCircle size={40} color="var(--color-green-light)" />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '12px', color: 'var(--text-primary)' }}>Request Sent!</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: '1.5' }}>
            Your request to add <strong style={{ color: 'var(--text-primary)' }}>\\u20B9{Number(amount).toLocaleString('en-IN')}</strong> has been received and is pending admin approval.
          </p>
        </div>
        <style>{\`@keyframes scaleIn { 0% { transform: scale(0); opacity: 0; } 50% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }\`}</style>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <style>{\`
        .no-spinners::-webkit-inner-spin-button,
        .no-spinners::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .no-spinners {
          -moz-appearance: textfield;
        }
      \`}</style>
      <div style={{ background: 'var(--bg-panel)', borderRadius: '20px', width: '420px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
        
        {/* Header */}
        <div style={{ padding: '24px 24px 20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)' }}>
              <Wallet size={22} color="var(--color-blue)" /> Add Funds
            </h2>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Available Margin: <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>\\u20B9{Number(user?.balance || 0).toLocaleString('en-IN')}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'var(--bg-hover)', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}>
            <X size={18}/>
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '0 24px' }}>
            
            {/* Amount Input */}
            <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px 20px', textAlign: 'center', transition: 'border-color 0.2s', ...(amount ? { borderColor: 'var(--color-blue)' } : {}) }}>
              <label style={{ fontSize: '14px', color: 'var(--text-secondary)', display: 'block', marginBottom: '12px', fontWeight: '500' }}>Enter Amount</label>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <span style={{ fontSize: '32px', fontWeight: '500', color: amount ? 'var(--text-primary)' : 'var(--text-secondary)' }}>\\u20B9</span>
                <input 
                  type="number" 
                  autoFocus
                  className="no-spinners"
                  style={{ 
                    background: 'transparent', border: 'none', color: 'var(--text-primary)', 
                    fontSize: '40px', fontWeight: '700', width: '100%', outline: 'none',
                    textAlign: 'center', padding: '0', maxWidth: '220px'
                  }}
                  value={amount} 
                  onChange={e => setAmount(e.target.value)} 
                  placeholder="0"
                  required 
                />
              </div>
            </div>
            
            {/* Quick Chips */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', marginBottom: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {quickAmounts.map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(amt.toString())}
                  style={{ 
                    padding: '8px 16px', background: amount === amt.toString() ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-hover)', 
                    border: '1px solid', borderColor: amount === amt.toString() ? 'var(--color-blue)' : 'var(--border-color)', 
                    borderRadius: '20px', color: amount === amt.toString() ? 'var(--color-blue)' : 'var(--text-secondary)', 
                    fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' 
                  }}
                >
                  +{amt >= 1000 ? (amt/1000) + 'k' : amt}
                </button>
              ))}
            </div>

            {error && <div style={{ color: 'var(--color-red-light)', fontSize: '13px', marginBottom: '24px', background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>{error}</div>}
          </div>
          
          {/* Footer Area */}
          <div style={{ background: 'var(--bg-elevated)', padding: '24px', borderTop: '1px solid var(--border-color)', marginTop: '8px' }}>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px', fontSize: '16px', fontWeight: '600', borderRadius: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }} disabled={loading}>
              {loading ? 'Processing...' : (
                <>Request Deposit {amount ? `(\\u20B9${Number(amount).toLocaleString('en-IN')})` : ''} <ArrowRight size={18} /></>
              )}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <ShieldCheck size={14} /> Funds will be credited once approved by an administrator.
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
`;
fs.writeFileSync('frontend/src/components/DepositModal.jsx', content);
