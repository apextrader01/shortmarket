import React, { useState, useEffect } from 'react';
import { Users, Copy, CheckCircle, Clock, TrendingUp, Loader2, ArrowLeft } from 'lucide-react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { API } from '../store';

export default function ReferralsView({ setActiveTab }) {
  const { user, requestWithdrawal } = useStore(useShallow(state => ({ user: state.user, requestWithdrawal: state.requestWithdrawal })));
  
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawMsg, setWithdrawMsg] = useState({ type: '', text: '' });
  const [copied, setCopied] = useState(false);
  
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
  
  const refCode = user?.client_id || user?.id || 'unknown';
  const refLink = `${window.location.origin}/register?ref=${refCode}`;

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
    <div style={{ padding: isMobile ? '12px 8px 60px 8px' : '24px', background: 'var(--bg-dark)', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: '12px', marginBottom: isMobile ? '20px' : '32px' }}>
        <div>
          <h2 style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: '800', marginBottom: '4px', color: 'var(--text-primary)' }}>Referrals Dashboard</h2>
          <div style={{ fontSize: isMobile ? '12px' : '14px', color: 'var(--text-secondary)' }}>Track your invites and earnings</div>
        </div>
        <button onClick={() => setActiveTab('ClientData')} className="btn" style={{ padding: '8px 16px', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', width: isMobile ? '100%' : 'auto', justifyContent: 'center' }}>
          <ArrowLeft size={14} /> Back to Profile
        </button>
      </div>

      {/* Top Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))', gap: isMobile ? '12px' : '20px', marginBottom: isMobile ? '20px' : '32px' }}>
        <div className="glass-panel" style={{ padding: isMobile ? '18px' : '24px', display: 'flex', flexDirection: 'column', gap: '12px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '600' }}>Total Earned</div>
            <div style={{ background: 'rgba(52, 211, 153, 0.1)', padding: '6px 10px', borderRadius: '8px' }}><span style={{color: "#34D399", fontSize: "18px", fontWeight: "bold"}}>₹</span></div>
          </div>
          <div style={{ fontSize: isMobile ? '26px' : '32px', fontWeight: '800', color: '#34D399' }}>₹{data.stats.totalEarned.toFixed(2)}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Available to Withdraw: <strong style={{ color: '#fff' }}>₹{data.stats.availableRewardBalance?.toFixed(2) || '0.00'}</strong>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: isMobile ? '18px' : '24px', display: 'flex', flexDirection: 'column', gap: '12px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '600' }}>Total Signups</div>
            <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '6px 10px', borderRadius: '8px' }}><Users size={18} color="#3B82F6" /></div>
          </div>
          <div style={{ fontSize: isMobile ? '26px' : '32px', fontWeight: '800', color: 'var(--text-primary)' }}>{data.stats.totalCount}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Total registered friends using your link
          </div>
        </div>

        <div className="glass-panel" style={{ padding: isMobile ? '18px' : '24px', display: 'flex', flexDirection: 'column', gap: '12px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '600' }}>Pending Subscriptions</div>
            <div style={{ background: 'rgba(251, 191, 36, 0.1)', padding: '6px 10px', borderRadius: '8px' }}><Clock size={18} color="#FBBF24" /></div>
          </div>
          <div style={{ fontSize: isMobile ? '26px' : '32px', fontWeight: '800', color: '#FBBF24' }}>{data.stats.pendingCount}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Signups waiting to upgrade to PRO
          </div>
        </div>
      </div>

      {/* WITHDRAWAL SECTION */}
      <div className="glass-panel" style={{ padding: isMobile ? '18px' : '28px', marginBottom: isMobile ? '20px' : '32px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}>
        <h3 style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          Withdraw Rewards
        </h3>
        {withdrawMsg.text && (
          <div style={{ padding: '10px 14px', borderRadius: '6px', marginBottom: '14px', background: withdrawMsg.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: withdrawMsg.type === 'success' ? 'var(--color-green-light)' : 'var(--color-red-light)', fontSize: '13px' }}>
            {withdrawMsg.text}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '12px', alignItems: isMobile ? 'stretch' : 'center' }}>
          <input 
            type="number" 
            className="input" 
            placeholder="Amount to withdraw (min ₹100)" 
            value={withdrawAmount} 
            onChange={e => setWithdrawAmount(e.target.value)}
            style={{ flex: 1, padding: '10px 14px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', outline: 'none' }}
          />
          <button 
            className="btn btn-primary" 
            onClick={handleWithdraw} 
            disabled={withdrawLoading || !withdrawAmount || withdrawAmount <= 0}
            style={{ padding: '10px 20px', fontWeight: '700', borderRadius: '6px', whiteSpace: 'nowrap' }}
          >
            {withdrawLoading ? 'Requesting...' : 'Request Withdrawal'}
          </button>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '10px' }}>
          Note: Update your Bank/UPI details in Settings before withdrawing. Minimum withdrawal is ₹100.
        </div>
      </div>

      {/* Share Widget */}
      <div className="glass-panel" style={{ padding: isMobile ? '18px' : '28px', marginBottom: isMobile ? '20px' : '32px', background: 'linear-gradient(145deg, var(--bg-panel), rgba(52, 211, 153, 0.05))', border: '1px solid rgba(52, 211, 153, 0.2)', borderRadius: '12px' }}>
        <h3 style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '700', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}><TrendingUp size={18} color="#34D399" /> Invite & Earn 10%</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.4', fontSize: '13px' }}>Share this link with your network. When they sign up and purchase a Pro subscription, you will automatically receive 10% of their subscription fee directly into your wallet!</p>
        
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '10px' }}>
          <input type="text" readOnly value={refLink} style={{ flex: 1, background: 'var(--bg-dark)', border: '1px solid var(--border-color)', padding: '10px 14px', borderRadius: '6px', color: 'var(--text-primary)', outline: 'none', fontSize: '12px' }} />
          <button onClick={() => { navigator.clipboard.writeText(refLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="btn btn-primary" style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold', borderRadius: '6px' }}>
            <Copy size={16} /> {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>

      {/* Table / Mobile Cards */}
      <div className="glass-panel" style={{ padding: isMobile ? '16px' : '24px', borderRadius: '12px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px' }}>Referral History</h3>
        
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}><Loader2 className="spinner" size={24} /></div>
        ) : data.referrals.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Users size={40} style={{ opacity: 0.2, marginBottom: '12px' }} />
            <div style={{ fontSize: '13px' }}>You haven't referred anyone yet. Share your link to start earning!</div>
          </div>
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {data.referrals.map(ref => (
              <div key={ref.id} style={{ padding: '12px', background: 'var(--bg-hover)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '13px' }}>
                    {ref.client_id && <span style={{ fontSize: '11px', color: '#60a5fa', marginRight: '6px', fontWeight: '800' }}>[{ref.client_id}]</span>}
                    {ref.username}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{maskEmail(ref.email)}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>{new Date(ref.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: ref.status === 'COMPLETED' ? 'rgba(34,197,94,0.1)' : 'rgba(234,179,8,0.1)', color: ref.status === 'COMPLETED' ? 'var(--color-green-light)' : 'var(--color-yellow)', fontWeight: '700' }}>
                    {ref.status}
                  </span>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#34D399', marginTop: '4px' }}>
                    ₹{ref.reward_amount ? Number(ref.reward_amount).toFixed(2) : '0.00'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
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
                      <div style={{ fontWeight: '600' }}>
                        {ref.client_id && <span style={{ fontSize: '11px', color: '#60a5fa', marginRight: '6px', fontWeight: '700' }}>[{ref.client_id}]</span>}
                        {ref.username}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{maskEmail(ref.email)}</div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '12px', background: ref.status === 'COMPLETED' ? 'rgba(34,197,94,0.1)' : 'rgba(234,179,8,0.1)', color: ref.status === 'COMPLETED' ? 'var(--color-green-light)' : 'var(--color-yellow)', fontWeight: '600' }}>
                        {ref.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>
                      {new Date(ref.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right', fontWeight: '700', color: '#34D399' }}>
                      ₹{ref.reward_amount ? Number(ref.reward_amount).toFixed(2) : '0.00'}
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
