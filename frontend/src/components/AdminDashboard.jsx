import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Users, CreditCard, CheckCircle, Clock, Search, Shield, X, RefreshCw } from 'lucide-react';

export default function AdminDashboard() {
  const { fetchAdminUsers, updateUserBalance } = useStore();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal state
  const [selectedUser, setSelectedUser] = useState(null);
  const [newBalance, setNewBalance] = useState('');
  const [updating, setUpdating] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    const res = await fetchAdminUsers();
    if (res.success) {
      setUsers(res.users);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleUpdateBalance = async (e) => {
    e.preventDefault();
    if (!selectedUser || !newBalance) return;
    setUpdating(true);
    const res = await updateUserBalance(selectedUser.id, newBalance);
    if (res.success) {
      alert('Balance updated successfully!');
      setSelectedUser(null);
      loadUsers();
    } else {
      alert(`Error updating balance: ${res.error}`);
    }
    setUpdating(false);
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
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
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Manage clients, funds, and KYC documents
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
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
            onClick={loadUsers}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div style={{ background: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid var(--border-color)', flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading clients...</div>
        ) : (
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
                            {u.username.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: '600' }}>{u.username} {u.is_admin && <span style={{ fontSize: '9px', background: 'var(--color-red)', padding: '2px 4px', borderRadius: '4px', marginLeft: '6px' }}>ADMIN</span>}</div>
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
