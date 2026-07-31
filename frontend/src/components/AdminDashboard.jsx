import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Users, CreditCard, CheckCircle, Clock, Search, Shield, X, RefreshCw, Check, XCircle } from 'lucide-react';

export default function AdminDashboard() {
  const { 
    fetchAdminUsers, updateUserBalance, fetchDepositRequests, processDeposit, fetchAdminAnalytics,
    fetchAdminOrders, fetchAdminPositions, fetchAdminLedger, forceCloseUserPosition, adminResetUser
  } = useStore();
  
  const [activeTab, setActiveTab] = useState('analytics');
  const [users, setUsers] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  
  const [orders, setOrders] = useState([]);
  const [positions, setPositions] = useState([]);
  const [ledger, setLedger] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal state
  const [selectedUser, setSelectedUser] = useState(null);
  const [newBalance, setNewBalance] = useState('');
  const [updating, setUpdating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'users') {
        const res = await fetchAdminUsers?.();
        if (res?.success) setUsers(res.users || []);
      } else if (activeTab === 'deposits') {
        const res = await fetchDepositRequests?.();
        if (res?.success) setDeposits(res.deposits || []);
      } else if (activeTab === 'analytics') {
        const res = await fetchAdminAnalytics?.();
        if (res?.success) setAnalytics(res.data);
      } else if (activeTab === 'orders') {
        const res = await fetchAdminOrders?.();
        if (res?.success) setOrders(res.orders || []);
      } else if (activeTab === 'positions') {
        const res = await fetchAdminPositions?.();
        if (res?.success) setPositions(res.positions || []);
      } else if (activeTab === 'ledger') {
        const res = await fetchAdminLedger?.();
        if (res?.success) setLedger(res.ledger || []);
      }
    } catch (err) {
      console.error("Error loading admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleUpdateBalance = async (e) => {
    e.preventDefault();
    if (!selectedUser || !newBalance) return;
    setUpdating(true);
    const res = await updateUserBalance(selectedUser.id, parseFloat(newBalance));
    if (res.success) {
      alert('Balance updated successfully!');
      setSelectedUser(null);
      loadData();
    } else {
      alert(`Error updating balance: ${res.error}`);
    }
    setUpdating(false);
  };

  const handleResetUser = async () => {
    if (!selectedUser) return;
    if (window.confirm(`Are you absolutely sure you want to reset ${selectedUser.username}'s account? This will permanently delete ALL their trades, positions, and reset their balance to ₹10,00,000. This CANNOT be undone.`)) {
      setUpdating(true);
      const res = await adminResetUser(selectedUser.id);
      if (res.success) {
        alert(`${selectedUser.username}'s account successfully reset to ₹10,00,000!`);
        loadData();
        setSelectedUser(null);
      } else {
        alert(res.error || 'Failed to reset user account');
      }
      setUpdating(false);
    }
  };

  const handleProcessDeposit = async (id, action) => {
    const res = await processDeposit(id, action);
    if (res.success) {
      loadData();
    } else {
      alert(`Error: ${res.error}`);
    }
  };

  const handleForceClose = async (id) => {
    if (!window.confirm("Are you sure you want to force close this position? A market order will be placed to close it.")) return;
    const res = await forceCloseUserPosition(id);
    if (res.success) {
      alert(`Force close order placed (ID: ${res.orderId})`);
      loadData();
    } else {
      alert(`Error: ${res.error}`);
    }
  };

  const filteredUsers = users.filter(u => 
    (u.username?.toLowerCase() || '').includes(search.toLowerCase()) || 
    (u.email?.toLowerCase() || '').includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={24} style={{ color: 'var(--color-red)' }} />
            Admin Control Center
          </h2>
          <div style={{ display: 'flex', gap: '16px', marginTop: '16px', overflowX: 'auto' }} className="scrollbar-hide">
            <button 
              onClick={() => setActiveTab('analytics')} 
              style={{ background: 'none', border: 'none', padding: '8px 0', borderBottom: activeTab === 'analytics' ? '2px solid var(--color-blue)' : '2px solid transparent', color: activeTab === 'analytics' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: activeTab === 'analytics' ? '600' : '500', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Analytics & Insights
            </button>
            <button 
              onClick={() => setActiveTab('users')} 
              style={{ background: 'none', border: 'none', padding: '8px 0', borderBottom: activeTab === 'users' ? '2px solid var(--color-blue)' : '2px solid transparent', color: activeTab === 'users' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: activeTab === 'users' ? '600' : '500', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Client Management
            </button>
            <button 
              onClick={() => setActiveTab('positions')} 
              style={{ background: 'none', border: 'none', padding: '8px 0', borderBottom: activeTab === 'positions' ? '2px solid var(--color-blue)' : '2px solid transparent', color: activeTab === 'positions' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: activeTab === 'positions' ? '600' : '500', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Live Positions
            </button>
            <button 
              onClick={() => setActiveTab('orders')} 
              style={{ background: 'none', border: 'none', padding: '8px 0', borderBottom: activeTab === 'orders' ? '2px solid var(--color-blue)' : '2px solid transparent', color: activeTab === 'orders' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: activeTab === 'orders' ? '600' : '500', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Order Flow
            </button>
            <button 
              onClick={() => setActiveTab('ledger')} 
              style={{ background: 'none', border: 'none', padding: '8px 0', borderBottom: activeTab === 'ledger' ? '2px solid var(--color-blue)' : '2px solid transparent', color: activeTab === 'ledger' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: activeTab === 'ledger' ? '600' : '500', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Platform Ledger
            </button>
            <button 
              onClick={() => setActiveTab('deposits')} 
              style={{ background: 'none', border: 'none', padding: '8px 0', borderBottom: activeTab === 'deposits' ? '2px solid var(--color-blue)' : '2px solid transparent', color: activeTab === 'deposits' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: activeTab === 'deposits' ? '600' : '500', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Deposit Requests
            </button>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button
            className="btn btn-primary"
            onClick={async () => {
              try {
                const API_URL = import.meta.env.VITE_API_URL || '';
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_URL}/api/fyers/auth-url`, {
                  headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
                });
                const data = await res.json();
                if (data.url) {
                  window.location.href = data.url;
                } else {
                  alert('Failed to get Fyers auth URL');
                }
              } catch (e) {
                console.error(e);
                alert('Error connecting Fyers');
              }
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--color-blue)', color: '#fff' }}
          >
            Connect Fyers API
          </button>
          <div className="input-group" style={{ width: '250px' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              placeholder="Search users..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '32px' }}
            />
          </div>
          <button 
            className="btn btn-secondary" 
            onClick={loadData}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ background: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid var(--border-color)', flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading...</div>
        ) : activeTab === 'analytics' ? (
          <div style={{ padding: '24px' }}>
            {analytics ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Total Platform AUM</div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>₹{(analytics.totalAum || 0).toFixed(2)}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Today's Realized P&L</div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: (analytics.todayRealizedPnl || 0) >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                    {(analytics.todayRealizedPnl || 0) >= 0 ? '+' : '-'}₹{Math.abs(analytics.todayRealizedPnl || 0).toFixed(2)}
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Today's Total Volume</div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--color-blue)' }}>₹{(analytics.todayVolume || 0).toFixed(2)}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>Top Traded Symbols</div>
                  {(analytics.topSymbols || []).length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(analytics.topSymbols || []).map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                          <span style={{ fontWeight: '500' }}>{item.symbol}</span>
                          <span style={{ color: 'var(--text-secondary)' }}>₹{(item.volume || 0).toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                  ) : <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No trades today.</div>}
                </div>
              </div>
            ) : <div style={{ color: 'var(--text-secondary)' }}>No analytics data available.</div>}
          </div>
        ) : activeTab === 'orders' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                <th style={{ padding: '16px', fontWeight: '500' }}>Date</th>
                <th style={{ padding: '16px', fontWeight: '500' }}>Client</th>
                <th style={{ padding: '16px', fontWeight: '500' }}>Symbol</th>
                <th style={{ padding: '16px', fontWeight: '500', textAlign: 'center' }}>Type</th>
                <th style={{ padding: '16px', fontWeight: '500', textAlign: 'right' }}>Qty @ Price</th>
                <th style={{ padding: '16px', fontWeight: '500', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {(!orders || orders.length === 0) ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>No orders found</td>
                </tr>
              ) : (
                orders.map(o => (
                  <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{o.created_at ? new Date(o.created_at).toLocaleString() : '-'}</td>
                    <td style={{ padding: '16px' }}><div style={{ fontWeight: '600' }}>{o.username || 'Unknown'}</div></td>
                    <td style={{ padding: '16px', fontWeight: '600' }}>{o.symbol}</td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <span style={{ color: o.side === 'BUY' ? 'var(--color-blue)' : 'var(--color-red)' }}>{o.side}</span> {o.type}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right' }}>{o.quantity} @ ₹{Number(o.average_price || o.price || 0).toFixed(2)}</td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <span style={{ 
                        color: o.status === 'EXECUTED' ? 'var(--color-green-light)' : o.status === 'REJECTED' ? 'var(--color-red-light)' : 'var(--color-yellow)',
                        background: o.status === 'EXECUTED' ? 'rgba(34,197,94,0.1)' : o.status === 'REJECTED' ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)',
                        padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600'
                      }}>{o.status}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : activeTab === 'positions' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                <th style={{ padding: '16px', fontWeight: '500' }}>Client</th>
                <th style={{ padding: '16px', fontWeight: '500' }}>Symbol</th>
                <th style={{ padding: '16px', fontWeight: '500', textAlign: 'right' }}>Qty</th>
                <th style={{ padding: '16px', fontWeight: '500', textAlign: 'right' }}>Avg Price</th>
                <th style={{ padding: '16px', fontWeight: '500', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(!positions || positions.length === 0) ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>No active positions found</td>
                </tr>
              ) : (
                positions.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '16px' }}><div style={{ fontWeight: '600' }}>{p.username || 'Unknown'}</div></td>
                    <td style={{ padding: '16px', fontWeight: '600' }}>{p.symbol}</td>
                    <td style={{ padding: '16px', textAlign: 'right', color: p.quantity > 0 ? 'var(--color-blue)' : 'var(--color-red)' }}>{p.quantity}</td>
                    <td style={{ padding: '16px', textAlign: 'right' }}>₹{Number(p.average_price || 0).toFixed(2)}</td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <button 
                        onClick={() => handleForceClose(p.id)}
                        className="btn"
                        style={{ padding: '4px 8px', fontSize: '11px', background: 'rgba(239,68,68,0.1)', color: 'var(--color-red-light)', border: '1px solid rgba(239,68,68,0.2)' }}
                      >
                        Force Close
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : activeTab === 'ledger' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                <th style={{ padding: '16px', fontWeight: '500' }}>Date</th>
                <th style={{ padding: '16px', fontWeight: '500' }}>Client</th>
                <th style={{ padding: '16px', fontWeight: '500' }}>Type</th>
                <th style={{ padding: '16px', fontWeight: '500' }}>Description</th>
                <th style={{ padding: '16px', fontWeight: '500', textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {(!ledger || ledger.length === 0) ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>No ledger entries found</td>
                </tr>
              ) : (
                ledger.map(l => (
                  <tr key={l.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{l.created_at ? new Date(l.created_at).toLocaleString() : '-'}</td>
                    <td style={{ padding: '16px' }}><div style={{ fontWeight: '600' }}>{l.username || 'Unknown'}</div></td>
                    <td style={{ padding: '16px' }}>
                      <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>{l.type}</span>
                    </td>
                    <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{l.description}</td>
                    <td style={{ padding: '16px', textAlign: 'right', fontWeight: '600', color: l.amount >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                      {l.amount >= 0 ? '+' : ''}₹{Number(l.amount || 0).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : activeTab === 'users' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                <th style={{ padding: '16px', fontWeight: '500' }}>Client</th>
                <th style={{ padding: '16px', fontWeight: '500' }}>Contact</th>
                <th style={{ padding: '16px', fontWeight: '500', textAlign: 'right' }}>Margin Balance</th>
                <th style={{ padding: '16px', fontWeight: '500', textAlign: 'center' }}>KYC Status</th>
                <th style={{ padding: '16px', fontWeight: '500', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => {
                  const hasKyc = Boolean(u.kyc_pan_url && u.kyc_aadhar_url);
                  const hasPartialKyc = Boolean(u.kyc_pan_url || u.kyc_aadhar_url);
                  
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: u.is_admin ? 'var(--color-red)' : 'var(--color-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                            {(u.username || 'U').substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: '600' }}>{u.username || 'Unknown User'} {u.is_admin && <span style={{ fontSize: '9px', background: 'var(--color-red)', padding: '2px 4px', borderRadius: '4px', marginLeft: '6px' }}>ADMIN</span>}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>ID: {u.id}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>
                        <div>{u.email}</div>
                        <div style={{ fontSize: '11px' }}>{u.phone || 'No phone'}</div>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right', fontWeight: '600' }}>
                        ₹{Number(u.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        {hasKyc ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--color-green-light)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                            <CheckCircle size={12} /> Verified
                          </div>
                        ) : hasPartialKyc ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(234, 179, 8, 0.1)', color: 'var(--color-yellow)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                            <Clock size={12} /> Pending
                          </div>
                        ) : (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                            Missing
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right' }}>
                        <button 
                          className="btn btn-primary" 
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          onClick={() => { setSelectedUser(u); setNewBalance(u.balance); }}
                        >
                          Manage Client
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                <th style={{ padding: '16px', fontWeight: '500' }}>Date</th>
                <th style={{ padding: '16px', fontWeight: '500' }}>Client</th>
                <th style={{ padding: '16px', fontWeight: '500', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '16px', fontWeight: '500', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '16px', fontWeight: '500', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {deposits.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No deposit requests found
                  </td>
                </tr>
              ) : (
                deposits.map(d => (
                  <tr key={d.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{new Date(d.created_at).toLocaleString()}</td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontWeight: '600' }}>{d.username}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{d.email}</div>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right', fontWeight: '600' }}>
                      ₹{Number(d.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      {d.status === 'PENDING' && <span style={{ color: 'var(--color-yellow)', background: 'rgba(234,179,8,0.1)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>PENDING</span>}
                      {d.status === 'APPROVED' && <span style={{ color: 'var(--color-green-light)', background: 'rgba(34,197,94,0.1)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>APPROVED</span>}
                      {d.status === 'REJECTED' && <span style={{ color: 'var(--color-red-light)', background: 'rgba(239,68,68,0.1)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>REJECTED</span>}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right' }}>
                      {d.status === 'PENDING' && (
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button onClick={() => handleProcessDeposit(d.id, 'approve')} className="btn" style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--color-green-light)', border: '1px solid rgba(34,197,94,0.2)', padding: '6px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}>
                            <Check size={16} />
                          </button>
                          <button onClick={() => handleProcessDeposit(d.id, 'reject')} className="btn" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--color-red-light)', border: '1px solid rgba(239,68,68,0.2)', padding: '6px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}>
                            <XCircle size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Manage User Modal */}
      {selectedUser && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'var(--bg-panel)', border: '1px solid var(--border-color)',
            borderRadius: '16px', width: '500px', maxWidth: '90vw', overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600' }}>Manage {selectedUser.username}</h3>
              <X size={20} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setSelectedUser(null)} />
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Balance Editor */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CreditCard size={14} style={{ color: 'var(--color-blue)' }} /> Margin Balance
                </h4>
                <form onSubmit={handleUpdateBalance} style={{ display: 'flex', gap: '12px' }}>
                  <div className="input-group" style={{ flex: 1 }}>
                    <span style={{ position: 'absolute', left: '12px', color: 'var(--text-secondary)' }}>₹</span>
                    <input 
                      type="number" 
                      step="0.01"
                      value={newBalance}
                      onChange={e => setNewBalance(e.target.value)}
                      style={{ paddingLeft: '24px', width: '100%' }}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={updating}>
                    {updating ? 'Saving...' : 'Update Balance'}
                  </button>
                </form>
              </div>

              {/* KYC Documents */}
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={14} style={{ color: 'var(--color-blue)' }} /> Identity Documents
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>PAN Card (ID: {selectedUser.pan_card || 'Not set'})</div>
                    {selectedUser.kyc_pan_url ? (
                      <a href={selectedUser.kyc_pan_url} target="_blank" rel="noreferrer">
                        <img src={selectedUser.kyc_pan_url} alt="PAN" style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '4px' }} />
                      </a>
                    ) : (
                      <div style={{ height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>No Document</div>
                    )}
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Aadhar (ID: {selectedUser.aadhar_number || 'Not set'})</div>
                    {selectedUser.kyc_aadhar_url ? (
                      <a href={selectedUser.kyc_aadhar_url} target="_blank" rel="noreferrer">
                        <img src={selectedUser.kyc_aadhar_url} alt="Aadhar" style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '4px' }} />
                      </a>
                    ) : (
                      <div style={{ height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>No Document</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', marginTop: '8px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: 'var(--color-red-light)' }}>Danger Zone</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Wipe all trades, positions, ledger, and reset balance to ₹10,00,000.
                  </div>
                  <button 
                    onClick={handleResetUser}
                    disabled={updating}
                    style={{ background: 'var(--color-red)', color: '#FFF', border: 'none', padding: '8px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    {updating ? 'RESETTING...' : 'RESET ACCOUNT'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
