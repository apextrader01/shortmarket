import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { Users, CreditCard, CheckCircle, Clock, Search, Shield, X, RefreshCw, Check, XCircle, Activity, Mail, Phone, Edit, User } from 'lucide-react';


function SystemStatusTab() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/fyers/status`);
        const data = await res.json();
        setStatus(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div style={{ padding: '24px', color: 'var(--text-secondary)' }}>Loading system status...</div>;
  if (!status) return <div style={{ padding: '24px', color: 'var(--color-red)' }}>Failed to fetch system status. Is the backend running?</div>;

  const isHealthy = status.isFyersConnected && status.hasAccessToken && status.secondsSinceLastTick < 15;

  return (
    <div style={{ padding: '24px', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-panel)', padding: '20px', borderRadius: '12px', border: `1px solid ${isHealthy ? 'var(--color-green)' : 'var(--color-red)'}` }}>
        <Activity size={32} color={isHealthy ? 'var(--color-green)' : 'var(--color-red)'} />
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '18px' }}>Broker Connection Status</h3>
          <div style={{ color: isHealthy ? 'var(--color-green)' : 'var(--color-red)', fontWeight: 'bold' }}>
            {isHealthy ? 'System is Healthy & Receiving Live Data' : 'System is Disconnected or Stalled'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }}>Fyers Access Token</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: status.hasAccessToken ? 'var(--color-green)' : 'var(--color-red)' }}>
            {status.hasAccessToken ? 'Valid & Loaded' : 'Missing'}
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }}>WebSocket Connection</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: status.isFyersConnected ? 'var(--color-green)' : 'var(--color-red)' }}>
            {status.isFyersConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }}>Time Since Last Tick</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: status.secondsSinceLastTick < 10 ? 'var(--color-green)' : 'var(--color-yellow)' }}>
            {status.secondsSinceLastTick.toFixed(1)} seconds ago
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }}>Active Subscriptions</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
            {status.subscriptions?.length || 0} symbols
          </div>
        </div>
      </div>

      {status.lastDataSocketError && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--color-red)', padding: '16px', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: 'var(--color-red)' }}>Recent WebSocket Error</h4>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '12px', color: 'var(--color-red-light)' }}>
            {status.lastDataSocketError}
          </pre>
        </div>
      )}

      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <h4 style={{ margin: '0 0 12px 0', color: 'var(--text-primary)' }}>Currently Subscribed Symbols (Live Data)</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {status.subscriptions && status.subscriptions.length > 0 ? status.subscriptions.map(sym => (
            <span key={sym} style={{ background: 'var(--bg-panel)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', border: '1px solid var(--border-color)' }}>
              {sym}
            </span>
          )) : (
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>No active subscriptions</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { fetchAdminUsers, updateUserBalance, fetchDepositRequests, processDeposit, fetchAdminAnalytics, fetchAdminOrders, fetchAdminPositions, fetchAdminLedger, forceCloseUserPosition, adminResetUser, adminDeleteUser, updateUserDetails } = useStore(useShallow(state => ({ fetchAdminUsers: state.fetchAdminUsers, updateUserBalance: state.updateUserBalance, fetchDepositRequests: state.fetchDepositRequests, processDeposit: state.processDeposit, fetchAdminAnalytics: state.fetchAdminAnalytics, fetchAdminOrders: state.fetchAdminOrders, fetchAdminPositions: state.fetchAdminPositions, fetchAdminLedger: state.fetchAdminLedger, forceCloseUserPosition: state.forceCloseUserPosition, adminResetUser: state.adminResetUser, adminDeleteUser: state.adminDeleteUser, updateUserDetails: state.updateUserDetails })));
  
  const [activeTab, setActiveTab] = useState('analytics');
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deposits, setDeposits] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  
  const [orders, setOrders] = useState([]);
  const [positions, setPositions] = useState([]);
  const [ledger, setLedger] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // reset to page 1 on search
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Modal state
  const [selectedUser, setSelectedUser] = useState(null);
  const [newBalance, setNewBalance] = useState('');
  const [newSubTier, setNewSubTier] = useState('BASIC');
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [updating, setUpdating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'users') {
        const res = await fetchAdminUsers?.(page, 50, debouncedSearch);
        if (res?.success) {
          setUsers(res.users || []);
          setTotalPages(res.totalPages || 1);
        }
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
  }, [activeTab, page, debouncedSearch]);

  const handleUpdateSubscription = async (e) => {
    e.preventDefault();
    if (!selectedUser || !newSubTier) return;
    
    // Set expiry to 1 year from now if PRO, else null
    let expires = null;
    if (newSubTier === 'PRO') {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 1);
      expires = d.toISOString();
    }
    
    setUpdating(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || '';
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/user/${selectedUser.id}/subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ tier: newSubTier, expires })
      });
      const data = await res.json();
      if (data.success) {
        alert('Subscription updated successfully!');
        setUsers(users.map(u => u.id === selectedUser.id ? { ...u, subscription_tier: newSubTier, subscription_expires: expires } : u));
        setSelectedUser({ ...selectedUser, subscription_tier: newSubTier, subscription_expires: expires });
      } else throw new Error(data.error);
    } catch (err) {
      alert(err.message);
    } finally {
      setUpdating(false);
    }
  };

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

  const handleUpdateDetails = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    setUpdating(true);
    const res = await updateUserDetails(selectedUser.id, {
      username: newUsername,
      email: newEmail,
      phone: newPhone
    });
    if (res.success) {
      alert('Client details updated successfully!');
      setSelectedUser(null);
      loadData();
    } else {
      alert(`Error updating details: ${res.error}`);
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

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    const confirmation = window.prompt(
      `⚠️ PERMANENT DELETE ⚠️\n\nThis will PERMANENTLY delete ${selectedUser.username}'s account and ALL their data (orders, positions, holdings, ledger, deposits).\n\nThis CANNOT be undone!\n\nType the username "${selectedUser.username}" to confirm:`
    );
    if (confirmation !== selectedUser.username) {
      if (confirmation !== null) alert('Username did not match. Deletion cancelled.');
      return;
    }
    setUpdating(true);
    const res = await adminDeleteUser(selectedUser.id);
    if (res.success) {
      alert(`✅ ${selectedUser.username}'s account has been permanently deleted.`);
      loadData();
      setSelectedUser(null);
    } else {
      alert(res.error || 'Failed to delete user account');
    }
    setUpdating(false);
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
                onClick={() => setActiveTab('system')} 
                style={{ background: 'none', border: 'none', padding: '8px 0', borderBottom: activeTab === 'system' ? '2px solid var(--color-blue)' : '2px solid transparent', color: activeTab === 'system' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: activeTab === 'system' ? '600' : '500', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                System Status
              </button>
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
        ) : activeTab === 'system' ? (
          <SystemStatusTab />
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
          <>
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
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No users found
                  </td>
                </tr>
              ) : (
                users.map(u => {
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
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{u.client_id || u.id}</div>
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
                          onClick={() => { 
                            setSelectedUser(u); 
                            setNewBalance(u.balance); 
                            setNewSubTier(u.subscription_tier || 'BASIC');
                            setNewUsername(u.username || '');
                            setNewEmail(u.email || '');
                            setNewPhone(u.phone || '');
                          }}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Page {page} of {totalPages}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn btn-outline" 
                onClick={() => setPage(p => Math.max(1, p - 1))} 
                disabled={page === 1}
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                Previous
              </button>
              <button 
                className="btn btn-outline" 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                disabled={page >= totalPages}
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                Next
              </button>
            </div>
          </div>
          </>
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
            borderRadius: '16px', width: '500px', maxWidth: '90vw', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600' }}>Manage {selectedUser.username}</h3>
              <X size={20} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setSelectedUser(null)} />
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
              {/* Client Details Editor */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Edit size={14} style={{ color: 'var(--color-blue)' }} /> Client Details
                </h4>
                <form onSubmit={handleUpdateDetails} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="input-group">
                    <User size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-secondary)' }} />
                    <input type="text" className="input-field" placeholder="Username" value={newUsername} onChange={e => setNewUsername(e.target.value)} style={{ paddingLeft: '36px' }} required />
                  </div>
                  <div className="input-group">
                    <Mail size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-secondary)' }} />
                    <input type="email" className="input-field" placeholder="Email" value={newEmail} onChange={e => setNewEmail(e.target.value)} style={{ paddingLeft: '36px' }} required />
                  </div>
                  <div className="input-group">
                    <Phone size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-secondary)' }} />
                    <input type="text" className="input-field" placeholder="Phone (optional)" value={newPhone} onChange={e => setNewPhone(e.target.value)} style={{ paddingLeft: '36px' }} />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={updating}>
                    {updating ? 'Saving...' : 'Update Details'}
                  </button>
                </form>
              </div>

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

              {/* Subscription Editor */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Activity size={14} style={{ color: 'var(--color-blue)' }} /> Subscription Tier
                </h4>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  Current Tier: <strong style={{ color: selectedUser.subscription_tier === 'PRO' ? 'var(--color-green-light)' : 'var(--text-primary)' }}>{selectedUser.subscription_tier || 'BASIC'}</strong>
                  {selectedUser.subscription_expires && ` (Expires: ${new Date(selectedUser.subscription_expires).toLocaleDateString()})`}
                </div>
                <form onSubmit={handleUpdateSubscription} style={{ display: 'flex', gap: '12px' }}>
                  <select 
                    className="input-field" 
                    value={newSubTier} 
                    onChange={e => setNewSubTier(e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="BASIC">Basic (3 Watchlists)</option>
                    <option value="PRO">PRO (5 Watchlists)</option>
                  </select>
                  <button type="submit" className="btn btn-primary" disabled={updating}>
                    {updating ? 'Saving...' : 'Update Tier'}
                  </button>
                </form>
              </div>

              {/* User Profile Details */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={14} style={{ color: 'var(--color-blue)' }} /> Client Profile (Onboarding Data)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                  <div><span style={{ color: 'var(--text-secondary)' }}>DOB:</span> <span style={{ color: 'white' }}>{selectedUser.dob || 'N/A'}</span></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Gender:</span> <span style={{ color: 'white' }}>{selectedUser.gender || 'N/A'}</span></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>State:</span> <span style={{ color: 'white' }}>{selectedUser.state || 'N/A'}</span></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>City:</span> <span style={{ color: 'white' }}>{selectedUser.city || 'N/A'}</span></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Occupation:</span> <span style={{ color: 'white' }}>{selectedUser.occupation || 'N/A'}</span></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Income:</span> <span style={{ color: 'white' }}>{selectedUser.annual_income || 'N/A'}</span></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Goal:</span> <span style={{ color: 'white' }}>{selectedUser.financial_goal || 'N/A'}</span></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Experience:</span> <span style={{ color: 'white' }}>{selectedUser.trading_experience || 'N/A'}</span></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Segment:</span> <span style={{ color: 'white' }}>{selectedUser.preferred_segment || 'N/A'}</span></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Style:</span> <span style={{ color: 'white' }}>{selectedUser.trading_style || 'N/A'}</span></div>
                </div>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Wipe all trades, positions, ledger, and reset balance to ₹10,00,000.
                  </div>
                  <button 
                    onClick={handleResetUser}
                    disabled={updating}
                    style={{ background: 'var(--color-red)', color: '#FFF', border: 'none', padding: '8px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', marginLeft: '12px' }}
                  >
                    {updating ? 'WORKING...' : 'RESET ACCOUNT'}
                  </button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <span style={{ color: '#ff4444', fontWeight: '700' }}>PERMANENT:</span> Delete this account and all associated data. This cannot be undone.
                  </div>
                  <button
                    onClick={handleDeleteUser}
                    disabled={updating}
                    style={{ background: '#7f1d1d', color: '#fca5a5', border: '1px solid #dc2626', padding: '8px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', marginLeft: '12px' }}
                  >
                    {updating ? 'WORKING...' : '🗑️ DELETE ACCOUNT'}
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
