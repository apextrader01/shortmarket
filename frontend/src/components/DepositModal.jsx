import React, { useState } from 'react';
import { X, Wallet, ArrowRight } from 'lucide-react';
import { useStore } from '../store';

export default function DepositModal({ onClose }) {
  const { requestDeposit, user } = useStore();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const quickAmounts = [10000, 50000, 100000, 500000];

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
      }, 2000);
    } else {
      setError(res.error || 'Failed to request deposit');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'var(--bg-panel)', padding: '40px', borderRadius: '16px', textAlign: 'center', width: '400px', border: '1px solid var(--border-color)' }}>
          <div style={{ width: '64px', height: '64px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' }}>
            <Wallet size={32} color="var(--color-green-light)" />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>Request Submitted!</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Your request to deposit ₹{Number(amount).toLocaleString('en-IN')} is pending admin approval.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-panel)', borderRadius: '16px', width: '400px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wallet size={20} color="var(--color-blue)" /> Add Funds
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20}/></button>
        </div>
        
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Amount (₹)</label>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Current: ₹{Number(user?.balance || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="input-group">
              <span style={{ position: 'absolute', left: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>₹</span>
              <input 
                type="number" 
                autoFocus
                className="input-field" 
                style={{ paddingLeft: '28px', fontSize: '18px', fontWeight: '600' }}
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
                placeholder="0.00"
                required 
              />
            </div>
            
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              {quickAmounts.map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(amt.toString())}
                  style={{ flex: 1, padding: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer' }}
                >
                  +{amt/1000}k
                </button>
              ))}
            </div>
          </div>
          
          {error && <div style={{ color: 'var(--color-red-light)', fontSize: '13px', marginBottom: '16px', background: 'rgba(239, 68, 68, 0.1)', padding: '8px 12px', borderRadius: '4px' }}>{error}</div>}
          
          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: '15px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }} disabled={loading}>
            {loading ? 'Processing...' : (
              <>Request Deposit <ArrowRight size={16} /></>
            )}
          </button>
          
          <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Funds will be credited once approved by an administrator.
          </div>
        </form>
      </div>
    </div>
  );
}
