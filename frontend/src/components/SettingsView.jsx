import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { User, Lock, Mail, LogOut, Phone, CreditCard, Save, Zap, Fingerprint, Shield, KeyRound, Check, X, Smartphone, Clock } from 'lucide-react';
import {
  isUserPinEnabled,
  saveUserPin,
  removeUserPin,
  isBiometricsAvailable,
  isBiometricsEnabled,
  registerBiometrics,
  setAppLocked,
  AUTO_LOCK_OPTIONS,
  getAutoLockDuration,
  setAutoLockDuration
} from '../utils/biometricAuth';

export default function SettingsView() {
  const { user, updatePassword, logout, oneClickMode, setOneClickMode, oneClickMultiplier, setOneClickMultiplier, updateBankDetails } = useStore(useShallow(state => ({ user: state.user, updatePassword: state.updatePassword, logout: state.logout, oneClickMode: state.oneClickMode, setOneClickMode: state.setOneClickMode, oneClickMultiplier: state.oneClickMultiplier, setOneClickMultiplier: state.setOneClickMultiplier, updateBankDetails: state.updateBankDetails })));

  const [bankDetails, setBankDetails] = useState({
    upi_id: user?.upi_id || '',
    bank_account_no: user?.bank_account_no || '',
    bank_ifsc: user?.bank_ifsc || ''
  });
  const [bankLoading, setBankLoading] = useState(false);
  const [bankMsg, setBankMsg] = useState({ type: '', text: '' });

  const handleBankSubmit = async (e) => {
    e.preventDefault();
    setBankLoading(true);
    setBankMsg({ type: '', text: '' });
    try {
      await updateBankDetails(bankDetails);
      setBankMsg({ type: 'success', text: 'Bank details updated successfully!' });
    } catch(err) {
      setBankMsg({ type: 'error', text: err.message });
    }
    setBankLoading(false);
  };

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
    <div className="settings-container" style={{ width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
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

        {/* Bank Details Card (For Withdrawals) */}
        <div style={{ background: 'var(--bg-panel)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CreditCard size={18} color="var(--color-blue)" /> Bank & UPI Details (For Withdrawals)
          </h3>
          {bankMsg.text && (
            <div style={{ padding: '12px', borderRadius: '6px', marginBottom: '16px', background: bankMsg.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: bankMsg.type === 'success' ? 'var(--color-green-light)' : 'var(--color-red-light)', fontSize: '14px' }}>
              {bankMsg.text}
            </div>
          )}
          <form onSubmit={handleBankSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>UPI ID</label>
              <input type="text" className="input" value={bankDetails.upi_id} onChange={e => setBankDetails({...bankDetails, upi_id: e.target.value})} placeholder="username@upi" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Bank Account Number</label>
              <input type="text" className="input" value={bankDetails.bank_account_no} onChange={e => setBankDetails({...bankDetails, bank_account_no: e.target.value})} placeholder="Account Number" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Bank IFSC Code</label>
              <input type="text" className="input" value={bankDetails.bank_ifsc} onChange={e => setBankDetails({...bankDetails, bank_ifsc: e.target.value})} placeholder="IFSC Code" />
            </div>
            <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={bankLoading}>
              <Save size={16} /> {bankLoading ? 'Saving...' : 'Save Bank Details'}
            </button>
          </form>
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

        {/* Biometric & 4-Digit PIN Security Card */}
        <div style={{ background: 'var(--bg-panel)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', gridColumn: '1 / -1' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Fingerprint size={20} color="var(--color-blue)" /> Quick App Unlock (4-Digit PIN & Biometrics)
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
            Set a 4-digit PIN or enable Face ID / Fingerprint to quickly unlock Short Edge on mobile and desktop without typing your full password.
          </p>

          <BiometricSettingsSection user={user} />
        </div>

      </div>

      

    </div>
  );
}

export function BiometricSettingsSection({ user }) {
  const userId = user?.id || 'default';
  const [pinEnabled, setPinEnabled] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [autoLockMinutes, setAutoLockMinutesState] = useState(() => getAutoLockDuration(userId));
  
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [showPinSetup, setShowPinSetup] = useState(false);

  useEffect(() => {
    setPinEnabled(isUserPinEnabled(userId));
    setBioEnabled(isBiometricsEnabled(userId));
    isBiometricsAvailable().then(setBioAvailable);
    setAutoLockMinutesState(getAutoLockDuration(userId));
  }, [userId]);

  const handleSelectAutoLock = (val) => {
    setAutoLockMinutesState(val);
    setAutoLockDuration(val, userId);
    const label = val === 0 ? 'Immediately on background' : val === -1 ? 'Disabled (Off)' : `${val} Minutes`;
    setStatusMsg({ type: 'success', text: `⏱️ Auto-lock timer set to ${label}` });
    setTimeout(() => setStatusMsg({ type: '', text: '' }), 3500);
  };

  const handleSavePin = async (e) => {
    e.preventDefault();
    setStatusMsg({ type: '', text: '' });
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setStatusMsg({ type: 'error', text: 'PIN must be exactly 4 numeric digits.' });
      return;
    }
    if (newPin !== confirmPin) {
      setStatusMsg({ type: 'error', text: 'PIN confirmation does not match.' });
      return;
    }

    try {
      await saveUserPin(newPin, userId);
      setPinEnabled(true);
      setShowPinSetup(false);
      setNewPin('');
      setConfirmPin('');
      setStatusMsg({ type: 'success', text: '✅ 4-Digit Security PIN configured successfully!' });
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to save PIN' });
    }
  };

  const handleDisablePin = () => {
    if (window.confirm('Disable PIN and Biometric unlock for this account?')) {
      removeUserPin(userId);
      setPinEnabled(false);
      setBioEnabled(false);
      setStatusMsg({ type: 'success', text: 'Quick unlock disabled.' });
    }
  };

  const handleToggleBiometrics = async () => {
    if (bioEnabled) {
      removeUserPin(userId);
      setBioEnabled(false);
      setStatusMsg({ type: 'success', text: 'Biometrics disabled.' });
      return;
    }

    if (!pinEnabled) {
      setStatusMsg({ type: 'error', text: 'Please configure a 4-Digit PIN first as a fallback before enabling Biometrics.' });
      return;
    }

    try {
      const res = await registerBiometrics(userId, user?.username || 'Trader');
      if (res) {
        setBioEnabled(true);
        setStatusMsg({ type: 'success', text: '✅ Face ID / Fingerprint enabled successfully!' });
      }
    } catch (err) {
      const isBrowserLimitation = String(err.message || '').includes('browser') || String(err.message || '').includes('supported');
      if (isBrowserLimitation) {
        setStatusMsg({ 
          type: 'error', 
          text: '💡 Web biometrics requires Google Chrome / Safari. Your 4-Digit PIN is active and protects your account!' 
        });
      } else {
        setStatusMsg({ type: 'error', text: 'Biometric setup: ' + (err.message || String(err)) });
      }
    }
  };

  const handleTestLock = () => {
    setAppLocked(true);
    window.location.reload();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {statusMsg.text && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: '600',
          background: statusMsg.type === 'success' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
          color: statusMsg.type === 'success' ? 'var(--color-green-light)' : 'var(--color-red-light)',
          border: `1px solid ${statusMsg.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
        }}>
          {statusMsg.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {/* PIN Status Tile */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)',
          padding: '18px',
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: pinEnabled ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)', padding: '10px', borderRadius: '50%', color: pinEnabled ? '#22c55e' : 'var(--text-secondary)' }}>
              <KeyRound size={20} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>4-Digit Quick PIN</div>
              <div style={{ fontSize: '11.5px', color: pinEnabled ? '#22c55e' : 'var(--text-secondary)', fontWeight: '600', marginTop: '2px' }}>
                {pinEnabled ? '✅ Active & Protected' : '⚪ Not Set Up'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            {pinEnabled ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowPinSetup(true)}
                  style={{ flex: 1, padding: '8px 12px', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.35)', color: '#60a5fa', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Change PIN
                </button>
                <button
                  type="button"
                  onClick={handleDisablePin}
                  style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Disable
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShowPinSetup(true)}
                style={{ width: '100%', padding: '9px 16px', background: 'var(--color-blue)', border: 'none', color: '#fff', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
              >
                Set Up 4-Digit PIN
              </button>
            )}
          </div>
        </div>

        {/* Biometrics Status Tile */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)',
          padding: '18px',
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: bioEnabled ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)', padding: '10px', borderRadius: '50%', color: bioEnabled ? '#22c55e' : 'var(--text-secondary)' }}>
              <Fingerprint size={20} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>Touch ID / Face ID</div>
              <div style={{ fontSize: '11.5px', color: bioEnabled ? '#22c55e' : 'var(--text-secondary)', fontWeight: '600', marginTop: '2px' }}>
                {bioEnabled ? '✅ Biometrics Active' : (bioAvailable ? 'Supported on Device' : 'Tap below to link Biometrics')}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '6px' }}>
            <button
              type="button"
              onClick={handleToggleBiometrics}
              disabled={!pinEnabled && !bioEnabled}
              style={{
                width: '100%',
                padding: '9px 16px',
                background: bioEnabled ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.15)',
                border: bioEnabled ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(59,130,246,0.35)',
                color: bioEnabled ? '#ef4444' : '#60a5fa',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: (!pinEnabled && !bioEnabled) ? 'not-allowed' : 'pointer',
                opacity: (!pinEnabled && !bioEnabled) ? 0.5 : 1
              }}
            >
              {bioEnabled ? 'Disable Biometrics' : 'Enable Touch ID / Face ID'}
            </button>
          </div>
        </div>
      </div>

      {/* PIN Setup Form Overlay / Modal */}
      {showPinSetup && (
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--color-blue)', padding: '20px', borderRadius: '10px', marginTop: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '700', margin: 0, color: '#fff' }}>Configure 4-Digit PIN</h4>
            <X size={16} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setShowPinSetup(false)} />
          </div>

          <form onSubmit={handleSavePin} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '6px' }}>New 4-Digit PIN</label>
              <input
                type="password"
                maxLength={4}
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                style={{ width: '120px', letterSpacing: '4px', textAlign: 'center', fontSize: '16px', fontWeight: '700', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#fff', padding: '8px', borderRadius: '6px' }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Confirm 4-Digit PIN</label>
              <input
                type="password"
                maxLength={4}
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                style={{ width: '120px', letterSpacing: '4px', textAlign: 'center', fontSize: '16px', fontWeight: '700', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#fff', padding: '8px', borderRadius: '6px' }}
                required
              />
            </div>
            <button
              type="submit"
              style={{ background: 'var(--color-blue)', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
            >
              Save PIN
            </button>
          </form>
        </div>
      )}

      {/* Auto-Lock Inactivity Timer Options */}
      {pinEnabled && (
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)',
          padding: '16px 18px',
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div>
            <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={16} color="var(--color-blue-light)" /> Auto-Lock Inactivity Timer
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Automatically lock terminal after period of inactivity or backgrounding
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {AUTO_LOCK_OPTIONS.map(opt => {
              const isSel = autoLockMinutes === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelectAutoLock(opt.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: isSel ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-hover)',
                    border: isSel ? '1px solid var(--color-blue)' : '1px solid var(--border-color)',
                    color: isSel ? 'var(--color-blue-light)' : 'var(--text-secondary)',
                    fontSize: '11.5px',
                    fontWeight: isSel ? '700' : '500',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Test Quick Lock Button */}
      {pinEnabled && (
        <div style={{ display: 'flex', justifyContent: 'flex-start', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
          <button
            type="button"
            onClick={handleTestLock}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-secondary)', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
          >
            <Lock size={14} /> Test Lock Screen Now
          </button>
        </div>
      )}
    </div>
  );
}



