import React, { useState, useEffect } from 'react';
import { Users, Copy, CheckCircle, Clock, TrendingUp,  Loader2 } from 'lucide-react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { API } from '../store';

export default function ReferralsView({ setActiveTab }) {
  const { user, requestWithdrawal } = useStore(useShallow(state => ({ user: state.user, requestWithdrawal: state.requestWithdrawal })));
  
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawMsg, setWithdrawMsg] = useState({ type: '', text: '' });
  
  const handleWithdraw = async (e) => {
    e.preventDefault();
    setWithdrawLoading(true);
    setWithdrawMsg({ type: '', text: '' });
    try {
      if (!user?.upi_id && (!user?.bank_account_no || !user?.bank_ifsc)) {
         throw new Error('Please go to Settings to add your UPI or Bank Account details first.');
      }
      await requestWithdrawal(withdrawAmount);
      setWithdrawMsg({ type: 'success', text: 'Withdrawal requested successfully!' });
      setWithdrawAmount('');
      fetchReferrals(); // refresh balances
    } catch(err) {
      setWithdrawMsg({ type: 'error', text: err.message });
    }
    setWithdrawLoading(false);
  };

  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ referrals: [], stats: { totalEarned: 0, pendingCount: 0, completedCount: 0, totalCount: 0, totalWithdrawn: 0, pendingWithdrawalAmount: 0, availableRewardBalance: 0 } });
  
  const refLink = `${window.location.origin}/register?ref=${user?.id || 'unknown'}`;

  useEffect(() => {
    fetchReferrals();
  }, []);

  const fetchReferrals = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/referrals`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setData({ referrals: json.referrals, stats: json.stats });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const maskEmail = (email) => {
    if (!email) return '***@***.com';
    const [name, domain] = email.split('@');
    return `${name.substring(0, 3)}***@${domain}`;
  };

  return (
    <div style={{ padding: '24px', background: 'var(--bg-dark)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '4px' }}>Referrals Dashboard</h2>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Track your invites and earnings</div>
        </div>
        <button onClick={() => setActiveTab('ClientData')} className="btn" style={{ padding: '8px 16px', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', cursor: 'pointer' }}>Back to Profile</button>
      </div>

      {/* Top Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '600' }}>Total Earned</div>
            <div style={{ background: 'rgba(52, 211, 153, 0.1)', padding: '8px', borderRadius: '8px' }}><span style={{color: "#34D399", fontSize: "20px", fontWeight: "bold"}}>₹</span></div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#34D399' }}>₹{data.stats.totalEarned.toFixed(2)}</div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>
            Available to Withdraw: ?{data.stats.availableRewardBalance?.toFixed(2) || '0.00'}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '600' }}>Total Signups</div>
            <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '8px', borderRadius: '8px' }}><Users size={20} color="#3B82F6" /></div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-primary)' }}>{data.stats.totalCount}</div>
        </div>

        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '600' }}>Pending Subscriptions</div>
            <div style={{ background: 'rgba(251, 191, 36, 0.1)', padding: '8px', borderRadius: '8px' }}><Clock size={20} color="#FBBF24" /></div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#FBBF24' }}>{data.stats.pendingCount}</div>
        </div>
      </div>

      {/* WITHDRAWAL SECTION */}
      <div className="glass-panel" style={{ padding: '32px', marginBottom: '32px', border: '1px solid rgba(255,255,255,0.1)' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          Withdraw Rewards
        </h3>
        {withdrawMsg.text && (
          <div style={{ padding: '12px', borderRadius: '6px', marginBottom: '16px', background: withdrawMsg.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: withdrawMsg.type === 'success' ? 'var(--color-green-light)' : 'var(--color-red-light)', fontSize: '14px' }}>
            {withdrawMsg.text}
          </div>
        )}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <input 
            type="number" 
            className="input" 
            placeholder="Amount to withdraw" 
            value={withdrawAmount} 
            onChange={e => setWithdrawAmount(e.target.value)}
            style={{ maxWidth: '200px' }}
          />
          <button 
            className="btn btn-primary" 
            onClick={handleWithdraw} 
            disabled={withdrawLoading || !withdrawAmount || withdrawAmount <= 0}
          >
            {withdrawLoading ? 'Requesting...' : 'Request Withdrawal'}
          </button>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '12px' }}>
          Note: Update your Bank/UPI details in Settings before withdrawing. Minimum withdrawal is ?100.
        </div>
      </div>

      {/* Share Widget */}
      <div className="glass-panel" style={{ padding: '32px', marginBottom: '32px', background: 'linear-gradient(145deg, var(--bg-panel), rgba(52, 211, 153, 0.05))', border: '1px solid rgba(52, 211, 153, 0.2)' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><TrendingUp size={20} color="#34D399" /> Invite & Earn 10%</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.5' }}>Share this link with your network. When they sign up and purchase a Pro subscription, you will automatically receive 10% of their subscription fee directly into your wallet!</p>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <input type="text" readOnly value={refLink} style={{ flex: 1, background: 'var(--bg-dark)', border: '1px solid var(--border-color)', padding: '12px 16px', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }} />
          <button onClick={() => { navigator.clipboard.writeText(refLink); alert('Link Copied!'); }} className="btn btn-primary" style={{ padding: '0 24px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
            <Copy size={18} /> Copy Link
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '24px' }}>Referral History</h3>
        
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}><Loader2 className="spinner" size={24} /></div>
        ) : data.referrals.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Users size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
            <div>You haven't referred anyone yet. Share your link to start earning!</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>User</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Date</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Reward</th>
                </tr>
              </thead>
              <tbody>
                {data.referrals.map(ref => (
                  <tr key={ref.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontWeight: '600' }}>{ref.username}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{maskEmail(ref.email)}</div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      {ref.status === 'completed' ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(52, 211, 153, 0.1)', color: '#34D399', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600' }}>
                          <CheckCircle size={14} /> Completed
                        </div>
                      ) : (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(251, 191, 36, 0.1)', color: '#FBBF24', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600' }}>
                          <Clock size={14} /> Pending
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {new Date(ref.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right', fontWeight: '700', color: ref.status === 'completed' ? '#34D399' : 'var(--text-secondary)' }}>
                      ₹{parseFloat(ref.reward_amount || 0).toFixed(2)}
                    </td>
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

