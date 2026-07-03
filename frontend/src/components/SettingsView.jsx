import React, { useState } from 'react';
import { useStore } from '../store';
import { User, Lock, Mail, LogOut, Phone, CreditCard, Save, Zap } from 'lucide-react';

export default function SettingsView() {
  const { user, updatePassword, logout, oneClickMode, setOneClickMode, oneClickMultiplier, setOneClickMultiplier } = useStore();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage('New passwords do not match!');
      return;
    }
    setLoading(true);
    const res = await updatePassword(oldPassword, newPassword);
    if (res.success) {
      setMessage('Password updated successfully!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setMessage(res.error || 'Failed to update password');
    }
    setLoading(false);
  };

  return (
    <div className="settings-container" style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>Account Settings</h2>
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Manage your profile and security preferences</div>
        </div>
        <button 
          onClick={logout}
          className="btn btn-secondary" 
          style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-red)' }}
        >
          <LogOut size={16} /> Sign Out
        </button>
      </div>

      <div className="settings-grid">
        
        {/* Profile Card */}
        <div style={{ background: 'var(--bg-panel)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={18} color="var(--color-blue)" /> Profile Information
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Username</div>
              <div style={{ fontSize: '14px', fontWeight: '500' }}>{user?.username}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}><Mail size={12}/> Email Address</div>
              <div style={{ fontSize: '14px', fontWeight: '500', wordBreak: 'break-all' }}>{user?.email}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={12}/> Phone Number</div>
              <div style={{ fontSize: '14px', fontWeight: '500' }}>{user?.phone || 'Not provided'}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}><CreditCard size={12}/> PAN Card</div>
              <div style={{ fontSize: '14px', fontWeight: '500' }}>{user?.pan_card || 'Not provided'}</div>
            </div>
          </div>
        </div>

        {/* Security Card */}
        <div style={{ background: 'var(--bg-panel)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={18} color="var(--color-blue)" /> Change Password
          </h3>
          
          <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Current Password</label>
              <input 
                type="password" 
                className="input-field" 
                value={oldPassword} 
                onChange={e => setOldPassword(e.target.value)} 
                required 
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>New Password</label>
              <input 
                type="password" 
                className="input-field" 
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value)} 
                required 
                minLength={6}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Confirm New Password</label>
              <input 
                type="password" 
                className="input-field" 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                required 
                minLength={6}
              />
            </div>
            
            {message && (
              <div style={{ padding: '12px', borderRadius: '6px', fontSize: '13px', background: message.includes('success') ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: message.includes('success') ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                {message}
              </div>
            )}
            
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Save size={16} /> {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>

      </div>

      {/* Trading Preferences Card */}
      <div style={{ background: 'var(--bg-panel)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', marginTop: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={18} color="var(--color-yellow)" /> Trading Preferences
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="toggle-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px', color: oneClickMode ? 'var(--color-red)' : 'inherit' }}>One-Click Scalper Mode</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Bypass the order confirmation modal to execute market orders instantly. <strong style={{ color: 'var(--color-red)' }}>Use with extreme caution.</strong></div>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={oneClickMode}
                onChange={(e) => setOneClickMode(e.target.checked)}
              />
              <span className="slider round"></span>
            </label>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', opacity: oneClickMode ? 1 : 0.5, pointerEvents: oneClickMode ? 'auto' : 'none', transition: 'opacity 0.2s' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>Default Lot Multiplier</label>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Multiply the standard lot size by this value when using One-Click Mode. (e.g., 2x BankNifty = 30 Qty)
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[1, 2, 5, 10, 20].map(mult => (
                <button
                  key={mult}
                  onClick={() => setOneClickMultiplier(mult)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: oneClickMultiplier === mult ? '1px solid var(--color-blue)' : '1px solid var(--border-color)',
                    background: oneClickMultiplier === mult ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-elevated)',
                    color: oneClickMultiplier === mult ? 'var(--color-blue)' : 'var(--text-primary)',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  {mult}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
