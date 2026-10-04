import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { User, Lock, Mail, LogOut, Phone, CreditCard, Save, Zap, Fingerprint, Shield, KeyRound, Check, X, Smartphone, Tablet, Clock, MapPin, Edit3, Loader2, Laptop, Monitor, Trash2, Globe, ShieldAlert, RefreshCw, AlertCircle, Volume2, VolumeX, Play, Bell, Send, MessageSquare, ExternalLink, ShieldCheck, Copy, ChevronDown, ChevronUp, Layers, Cpu, History, Sparkles, CheckCheck } from 'lucide-react';
import {
  isUserPinEnabled,
  saveUserPin,
  removeUserPin,
  removeBiometrics,
  isBiometricsAvailable,
  isBiometricsEnabled,
  registerBiometrics,
  setAppLocked,
  AUTO_LOCK_OPTIONS,
  getAutoLockDuration,
  setAutoLockDuration
} from '../utils/biometricAuth';
import {
  isSoundEnabled,
  setSoundEnabled,
  getSoundVolume,
  setSoundVolume,
  getSoundConfig,
  setSoundConfig,
  playTargetHitSound,
  playStopLossHitSound,
  playOrderExecutedSound,
  playRiskAlertSound
} from '../utils/soundManager';

export default function SettingsView() {
  const { 
    user, updatePassword, logout, oneClickMode, setOneClickMode, 
    oneClickMultiplier, setOneClickMultiplier, updateBankDetails, updateUserDetails,
    userSessions, userSessionsLoading, fetchUserSessions, revokeOtherSessions, revokeSession,
    telegramSettings, telegramSettingsLoading, fetchTelegramSettings, saveTelegramSettings, sendTelegramTest
  } = useStore(useShallow(state => ({ 
    user: state.user, 
    updatePassword: state.updatePassword, 
    logout: state.logout, 
    oneClickMode: state.oneClickMode, 
    setOneClickMode: state.setOneClickMode, 
    oneClickMultiplier: state.oneClickMultiplier, 
    setOneClickMultiplier: state.setOneClickMultiplier, 
    updateBankDetails: state.updateBankDetails,
    updateUserDetails: state.updateUserDetails,
    userSessions: state.userSessions,
    userSessionsLoading: state.userSessionsLoading,
    fetchUserSessions: state.fetchUserSessions,
    revokeOtherSessions: state.revokeOtherSessions,
    revokeSession: state.revokeSession,
    telegramSettings: state.telegramSettings,
    telegramSettingsLoading: state.telegramSettingsLoading,
    fetchTelegramSettings: state.fetchTelegramSettings,
    saveTelegramSettings: state.saveTelegramSettings,
    sendTelegramTest: state.sendTelegramTest
  })));

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [revokingOthers, setRevokingOthers] = useState(false);
  const [sessionMsg, setSessionMsg] = useState({ type: '', text: '' });
  const [soundActive, setSoundActive] = useState(() => isSoundEnabled());
  const [soundVolume, setSoundVolumeState] = useState(() => Math.round(getSoundVolume() * 100));
  const [soundConfig, setSoundConfigState] = useState(() => getSoundConfig());

  const [telegramChatId, setTelegramChatId] = useState('');
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramOrders, setTelegramOrders] = useState(true);
  const [telegramTargets, setTelegramTargets] = useState(true);
  const [telegramStoploss, setTelegramStoploss] = useState(true);
  const [telegramRisk, setTelegramRisk] = useState(true);
  const [telegramTesting, setTelegramTesting] = useState(false);
  const [telegramSaving, setTelegramSaving] = useState(false);
  const [telegramMsg, setTelegramMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchTelegramSettings();
  }, []);

  useEffect(() => {
    if (telegramSettings) {
      setTelegramChatId(telegramSettings.telegram_chat_id || '');
      setTelegramEnabled(!!telegramSettings.telegram_alerts_enabled);
      setTelegramOrders(telegramSettings.telegram_alert_orders !== false);
      setTelegramTargets(telegramSettings.telegram_alert_targets !== false);
      setTelegramStoploss(telegramSettings.telegram_alert_stoploss !== false);
      setTelegramRisk(telegramSettings.telegram_alert_risk !== false);
    }
  }, [telegramSettings]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchUserSessions();
  }, []);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    username: (user?.username || '').replace(/[^A-Za-z\s]/g, '').slice(0, 15),
    phone: user?.phone || '',
    pan_card: user?.pan_card || '',
    address: user?.address || ''
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    if (user) {
      setProfileForm({
        username: (user.username || '').replace(/[^A-Za-z\s]/g, '').slice(0, 15),
        phone: user.phone || '',
        pan_card: user.pan_card || '',
        address: user.address || ''
      });
      setBankDetails({
        upi_id: user.upi_id || '',
        bank_account_no: user.bank_account_no || '',
        bank_ifsc: user.bank_ifsc || ''
      });
    }
  }, [user]);

  const [profileNameAvailability, setProfileNameAvailability] = useState({ status: 'idle', message: '' });

  useEffect(() => {
    if (!isEditingProfile) {
      setProfileNameAvailability({ status: 'idle', message: '' });
      return;
    }
    const cleanName = String(profileForm.username || '').replace(/[^A-Za-z\s]/g, '').replace(/\s+/g, ' ').trim();
    const currentClean = String(user?.username || '').replace(/[^A-Za-z\s]/g, '').replace(/\s+/g, ' ').trim();
    const letterCount = cleanName.replace(/[^A-Za-z]/g, '').length;
    if (!cleanName || cleanName.length < 6 || letterCount < 5 || cleanName.replace(/\s+/g, '').toLowerCase() === currentClean.replace(/\s+/g, '').toLowerCase()) {
      setProfileNameAvailability({ status: 'idle', message: '' });
      return;
    }

    setProfileNameAvailability({ status: 'checking', message: 'Checking availability...' });
    const timer = setTimeout(async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || '';
        const res = await fetch(`${API_URL}/api/auth/check-username?username=${encodeURIComponent(cleanName)}&exclude_id=${encodeURIComponent(user?.id || '')}`);
        const data = await res.json();
        if (data && data.valid === false) {
          setProfileNameAvailability({ status: 'idle', message: '' });
        } else if (data && data.available) {
          setProfileNameAvailability({ status: 'available', message: `"${cleanName}" is available` });
        } else {
          setProfileNameAvailability({ status: 'unavailable', message: data?.message || `"${cleanName}" is unavailable` });
        }
      } catch (e) {
        setProfileNameAvailability({ status: 'idle', message: '' });
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [profileForm.username, isEditingProfile, user?.id, user?.username]);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    const cleanName = (profileForm.username || '').replace(/[^A-Za-z\s]/g, '').replace(/\s+/g, ' ').trim();
    const letterCount = cleanName.replace(/[^A-Za-z]/g, '').length;
    if (!cleanName || cleanName.length < 6 || cleanName.length > 15 || !/^[A-Za-z\s]{6,15}$/.test(cleanName) || letterCount < 5) {
      setProfileMsg({ type: 'error', text: 'Name must contain letters only and be between 6 and 15 characters.' });
      return;
    }
    if (profileNameAvailability.status === 'unavailable') {
      setProfileMsg({ type: 'error', text: `"${cleanName}" is unavailable. Please choose another name.` });
      return;
    }
    setProfileLoading(true);
    setProfileMsg({ type: '', text: '' });
    const res = await updateUserDetails({ ...profileForm, username: cleanName });
    if (res.success) {
      setProfileMsg({ type: 'success', text: 'Profile details updated successfully!' });
      setIsEditingProfile(false);
      setTimeout(() => setProfileMsg({ type: '', text: '' }), 3000);
    } else {
      setProfileMsg({ type: 'error', text: res.error || 'Failed to update profile details' });
    }
    setProfileLoading(false);
  };

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
      setTimeout(() => setBankMsg({ type: '', text: '' }), 3000);
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
    <div className="settings-container" style={{ width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: isMobile ? '90px' : '40px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '12px' : '0' }}>
        <div>
          <h2 style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: '700', marginBottom: '8px' }}>Account Settings</h2>
          <div style={{ color: 'var(--text-secondary)', fontSize: isMobile ? '13px' : '14px' }}>Manage your profile and security preferences</div>
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
        <div style={{ background: 'var(--bg-panel)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <User size={18} color="var(--color-blue)" /> Profile Information
              </h3>
              <button
                type="button"
                onClick={() => { setIsEditingProfile(!isEditingProfile); setProfileMsg({ type: '', text: '' }); }}
                style={{
                  background: isEditingProfile ? 'var(--bg-hover)' : 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid var(--border-color)',
                  color: isEditingProfile ? 'var(--text-secondary)' : 'var(--color-blue-light)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background 0.15s'
                }}
              >
                <Edit3 size={13} /> {isEditingProfile ? 'Cancel' : 'Edit Details'}
              </button>
            </div>

            {profileMsg.text && (
              <div style={{ 
                padding: '10px 14px', 
                borderRadius: '6px', 
                marginBottom: '16px', 
                background: profileMsg.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', 
                color: profileMsg.type === 'success' ? 'var(--color-green-light)' : 'var(--color-red-light)', 
                fontSize: '13px', 
                border: `1px solid ${profileMsg.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` 
              }}>
                {profileMsg.text}
              </div>
            )}

            {!isEditingProfile ? (
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
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={12}/> Address</div>
                  <div style={{ fontSize: '14px', fontWeight: '500', lineHeight: '1.4', whiteSpace: 'pre-line' }}>{user?.address || 'Not provided'}</div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>Full Name (Unique)</label>
                    <span style={{
                      fontSize: '11px',
                      color: profileNameAvailability.status === 'unavailable'
                        ? '#ef4444'
                        : profileNameAvailability.status === 'available'
                          ? '#10b981'
                          : ((profileForm.username || '').trim().length >= 6 && (profileForm.username || '').replace(/[^A-Za-z]/g, '').length >= 5 ? '#10b981' : 'var(--text-secondary)'),
                      fontWeight: '700'
                    }}>
                      {profileNameAvailability.status === 'unavailable'
                        ? `✗ Unavailable · ${(profileForm.username || '').length}/15`
                        : profileNameAvailability.status === 'available'
                          ? `✓ Available · ${(profileForm.username || '').length}/15`
                          : `Letters only (6–15) · ${(profileForm.username || '').length}/15`}
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    minLength={6}
                    maxLength={15}
                    pattern="[A-Za-z\s]{6,15}"
                    title="Letters only, minimum 6 and maximum 15 characters"
                    className="input"
                    value={profileForm.username || ''}
                    onChange={e => setProfileForm({ ...profileForm, username: e.target.value.replace(/[^A-Za-z\s]/g, '').slice(0, 15) })}
                    placeholder="e.g. Hari J (6-15 letters)"
                  />
                  {profileNameAvailability.status === 'unavailable' && (
                    <div style={{ marginTop: '5px', fontSize: '11.5px', color: '#ef4444', fontWeight: '600' }}>
                      ⚠️ {profileNameAvailability.message}
                    </div>
                  )}
                  {profileNameAvailability.status === 'available' && (
                    <div style={{ marginTop: '5px', fontSize: '11.5px', color: '#10b981', fontWeight: '600' }}>
                      ✓ {profileNameAvailability.message}
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Phone Number</label>
                  <input
                    type="tel"
                    className="input"
                    value={profileForm.phone}
                    onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                    placeholder="e.g. 9876543210"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>PAN Card</label>
                  <input
                    type="text"
                    className="input"
                    value={profileForm.pan_card}
                    onChange={e => setProfileForm({ ...profileForm, pan_card: e.target.value.toUpperCase() })}
                    placeholder="e.g. ABCDE1234F"
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Residential / Communication Address</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={profileForm.address}
                    onChange={e => setProfileForm({ ...profileForm, address: e.target.value })}
                    placeholder="Enter complete address (House No, Street, City, State, PIN Code)"
                    style={{ resize: 'vertical', width: '100%', boxSizing: 'border-box', minHeight: '70px', fontFamily: 'inherit' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <button type="submit" className="btn btn-primary" disabled={profileLoading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {profileLoading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {profileLoading ? 'Saving...' : 'Save Profile Details'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsEditingProfile(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
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

        {/* Audio Cues & Sound Engine Card */}
        <div style={{ background: 'var(--bg-panel)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: '14px', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Volume2 size={20} color="var(--color-blue)" /> Audio Cues & Sound Engine (Only When Hit)
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                Synthesizes instant real-time sound effects when your orders execute, stop-loss triggers, or target prices are hit.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                const next = !soundActive;
                setSoundActive(next);
                setSoundEnabled(next);
                if (next) playOrderExecutedSound();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '8px',
                background: soundActive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.12)',
                border: soundActive ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(239, 68, 68, 0.35)',
                color: soundActive ? '#4ade80' : '#ef4444',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              {soundActive ? <Volume2 size={16} /> : <VolumeX size={16} />}
              {soundActive ? 'Audio Enabled (Active)' : 'Audio Muted (Off)'}
            </button>
          </div>

          {/* Master Volume Slider */}
          <div style={{ marginTop: '16px', padding: '14px 18px', background: 'var(--bg-dark)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Volume2 size={16} color="var(--color-blue-light)" /> Master Audio Volume: {soundVolume}%
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Adjust synthesized chime and alert volume for order fills and triggers
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: isMobile ? '100%' : '240px' }}>
              <VolumeX size={16} color="var(--text-secondary)" />
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={soundVolume} 
                onChange={e => {
                  const val = Number(e.target.value);
                  setSoundVolumeState(val);
                  setSoundVolume(val / 100);
                }}
                style={{ flex: 1, accentColor: 'var(--color-blue)' }} 
              />
              <Volume2 size={16} color="var(--color-blue-light)" />
            </div>
          </div>

          {/* Granular Sound Triggers */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '10px', marginTop: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'var(--bg-dark)', borderRadius: '6px', border: '1px solid var(--border-color)', cursor: 'pointer', fontSize: '12px', color: '#fff' }}>
              <input 
                type="checkbox" 
                checked={soundConfig.targetHit} 
                onChange={e => {
                  const val = e.target.checked;
                  setSoundConfig('target', val);
                  setSoundConfigState(prev => ({ ...prev, targetHit: val }));
                }}
                style={{ accentColor: '#4ade80' }}
              />
              <span>🎯 Target Hit</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'var(--bg-dark)', borderRadius: '6px', border: '1px solid var(--border-color)', cursor: 'pointer', fontSize: '12px', color: '#fff' }}>
              <input 
                type="checkbox" 
                checked={soundConfig.stopLoss} 
                onChange={e => {
                  const val = e.target.checked;
                  setSoundConfig('sl', val);
                  setSoundConfigState(prev => ({ ...prev, stopLoss: val }));
                }}
                style={{ accentColor: '#ef4444' }}
              />
              <span>🛑 Stop Loss</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'var(--bg-dark)', borderRadius: '6px', border: '1px solid var(--border-color)', cursor: 'pointer', fontSize: '12px', color: '#fff' }}>
              <input 
                type="checkbox" 
                checked={soundConfig.orderExecuted} 
                onChange={e => {
                  const val = e.target.checked;
                  setSoundConfig('exec', val);
                  setSoundConfigState(prev => ({ ...prev, orderExecuted: val }));
                }}
                style={{ accentColor: 'var(--color-blue)' }}
              />
              <span>🔔 Order Fill</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'var(--bg-dark)', borderRadius: '6px', border: '1px solid var(--border-color)', cursor: 'pointer', fontSize: '12px', color: '#fff' }}>
              <input 
                type="checkbox" 
                checked={soundConfig.riskAlert} 
                onChange={e => {
                  const val = e.target.checked;
                  setSoundConfig('risk', val);
                  setSoundConfigState(prev => ({ ...prev, riskAlert: val }));
                }}
                style={{ accentColor: '#fbbf24' }}
              />
              <span>⚠️ Risk Limit</span>
            </label>
          </div>

          {/* Audio Test Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '14px' }}>
            <button
              type="button"
              onClick={() => playTargetHitSound()}
              disabled={!soundActive}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: '8px',
                background: 'rgba(34, 197, 94, 0.08)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                color: '#4ade80',
                fontSize: '12.5px',
                fontWeight: '600',
                cursor: soundActive ? 'pointer' : 'not-allowed',
                opacity: soundActive ? 1 : 0.5
              }}
            >
              <span>🎯 Test Target Hit</span>
              <Play size={14} />
            </button>

            <button
              type="button"
              onClick={() => playStopLossHitSound()}
              disabled={!soundActive}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#ef4444',
                fontSize: '12.5px',
                fontWeight: '600',
                cursor: soundActive ? 'pointer' : 'not-allowed',
                opacity: soundActive ? 1 : 0.5
              }}
            >
              <span>🛑 Test Stop Loss Hit</span>
              <Play size={14} />
            </button>

            <button
              type="button"
              onClick={() => playOrderExecutedSound()}
              disabled={!soundActive}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: '8px',
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                color: 'var(--color-blue-light)',
                fontSize: '12.5px',
                fontWeight: '600',
                cursor: soundActive ? 'pointer' : 'not-allowed',
                opacity: soundActive ? 1 : 0.5
              }}
            >
              <span>🔔 Test Order Executed</span>
              <Play size={14} />
            </button>

            <button
              type="button"
              onClick={() => playRiskAlertSound()}
              disabled={!soundActive}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                color: '#fbbf24',
                fontSize: '12.5px',
                fontWeight: '600',
                cursor: soundActive ? 'pointer' : 'not-allowed',
                opacity: soundActive ? 1 : 0.5
              }}
            >
              <span>⚠️ Test Risk Guardian Alert</span>
              <Play size={14} />
            </button>
          </div>
        </div>

        {/* Telegram Live Trade & Risk Alerts Card */}
        <div style={{ background: 'var(--bg-panel)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: '14px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'rgba(0, 136, 204, 0.15)', color: '#0088cc', padding: '10px', borderRadius: '50%' }}>
                <Send size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
                  Telegram Live Trade & Risk Alerts
                  <span style={{
                    fontSize: '10.5px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: telegramEnabled && telegramChatId ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.06)',
                    color: telegramEnabled && telegramChatId ? '#4ade80' : 'var(--text-secondary)',
                    border: telegramEnabled && telegramChatId ? '1px solid rgba(34,197,94,0.4)' : '1px solid var(--border-color)'
                  }}>
                    {telegramEnabled && telegramChatId ? '🟢 ACTIVE' : '⚪ NOT LINKED'}
                  </span>
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0 }}>
                  Receive instant, zero-delay trade execution, target hit, stop-loss trigger, and risk limit alerts directly on your phone via Telegram.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={async () => {
                const next = !telegramEnabled;
                setTelegramEnabled(next);
                setTelegramSaving(true);
                const res = await saveTelegramSettings({
                  telegram_chat_id: telegramChatId,
                  telegram_alerts_enabled: next,
                  telegram_alert_orders: telegramOrders,
                  telegram_alert_targets: telegramTargets,
                  telegram_alert_stoploss: telegramStoploss,
                  telegram_alert_risk: telegramRisk
                });
                setTelegramSaving(false);
                if (res.success) {
                  setTelegramMsg({ type: 'success', text: next ? 'Telegram alerts enabled!' : 'Telegram alerts disabled.' });
                  setTimeout(() => setTelegramMsg({ type: '', text: '' }), 3000);
                } else {
                  setTelegramMsg({ type: 'error', text: res.error || 'Failed to update Telegram status' });
                }
              }}
              disabled={telegramSaving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '8px',
                background: telegramEnabled ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.12)',
                border: telegramEnabled ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(239, 68, 68, 0.35)',
                color: telegramEnabled ? '#4ade80' : '#ef4444',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              {telegramEnabled ? <Check size={16} /> : <X size={16} />}
              {telegramEnabled ? 'Telegram Alerts (ON)' : 'Telegram Alerts (OFF)'}
            </button>
          </div>

          {telegramMsg.text && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: '600',
              marginBottom: '16px',
              background: telegramMsg.type === 'success' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              border: `1px solid ${telegramMsg.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              color: telegramMsg.type === 'success' ? '#4ade80' : '#ef4444'
            }}>
              {telegramMsg.text}
            </div>
          )}

          {/* Telegram Bot Setup Step Guide */}
          <div style={{
            background: 'rgba(0, 136, 204, 0.05)',
            border: '1px solid rgba(0, 136, 204, 0.2)',
            borderRadius: '10px',
            padding: '16px 20px',
            marginBottom: '20px'
          }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#38bdf8', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>📱 3 Simple Steps to Connect:</span>
            </div>
            <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
              <li>Open our official Telegram Bot: <a href={`https://t.me/${telegramSettings?.bot_username || 'SkandXAlerts_bot'}`} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', fontWeight: '700', textDecoration: 'underline' }}>@{telegramSettings?.bot_username || 'SkandXAlerts_bot'} <ExternalLink size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /></a></li>
              <li>Click <strong>Start</strong> (or send <code>/start</code>) in the chat. The bot will reply with your unique <strong>Chat ID</strong>.</li>
              <li>Paste your <strong>Chat ID</strong> below, choose your alert preferences, and click <strong>Save & Connect</strong>.</li>
            </ol>
          </div>

          {/* Chat ID Input & Test Button Form */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto auto', gap: '12px', alignItems: 'flex-end', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '600' }}>
                Telegram Chat ID
              </label>
              <input
                type="text"
                className="input-field"
                value={telegramChatId}
                onChange={e => setTelegramChatId(e.target.value)}
                placeholder="e.g. 1234567890"
                style={{ width: '100%' }}
              />
            </div>

            <button
              type="button"
              onClick={async () => {
                setTelegramSaving(true);
                setTelegramMsg({ type: '', text: '' });
                const res = await saveTelegramSettings({
                  telegram_chat_id: telegramChatId,
                  telegram_alerts_enabled: telegramEnabled,
                  telegram_alert_orders: telegramOrders,
                  telegram_alert_targets: telegramTargets,
                  telegram_alert_stoploss: telegramStoploss,
                  telegram_alert_risk: telegramRisk
                });
                setTelegramSaving(false);
                if (res.success) {
                  setTelegramMsg({ type: 'success', text: '✅ Telegram Chat ID saved successfully!' });
                  setTimeout(() => setTelegramMsg({ type: '', text: '' }), 3500);
                } else {
                  setTelegramMsg({ type: 'error', text: res.error || 'Failed to save Chat ID' });
                }
              }}
              disabled={telegramSaving}
              className="btn btn-primary"
              style={{ padding: '10px 20px', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {telegramSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save & Connect
            </button>

            <button
              type="button"
              onClick={async () => {
                if (!telegramChatId) {
                  setTelegramMsg({ type: 'error', text: 'Please enter your Telegram Chat ID first.' });
                  return;
                }
                setTelegramTesting(true);
                setTelegramMsg({ type: '', text: '' });
                const res = await sendTelegramTest(telegramChatId);
                setTelegramTesting(false);
                if (res.success) {
                  setTelegramMsg({ type: 'success', text: '🚀 Test alert sent! Please check your Telegram chat.' });
                } else {
                  setTelegramMsg({ type: 'error', text: res.error || 'Failed to send test message to Telegram.' });
                }
              }}
              disabled={telegramTesting || !telegramChatId}
              className="btn btn-secondary"
              style={{ padding: '10px 18px', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {telegramTesting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Send Test Alert
            </button>
          </div>

          {/* Granular Alert Preferences Toggles */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff', marginBottom: '12px' }}>
              🔔 Active Alert Triggers:
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '12px 14px', borderRadius: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={telegramOrders}
                  onChange={e => setTelegramOrders(e.target.checked)}
                  style={{ accentColor: 'var(--color-blue)', width: '16px', height: '16px' }}
                />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>⚡ Order Executions</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Instant fill pings for Market & Limit</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '12px 14px', borderRadius: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={telegramTargets}
                  onChange={e => setTelegramTargets(e.target.checked)}
                  style={{ accentColor: 'var(--color-blue)', width: '16px', height: '16px' }}
                />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>🎯 Target Hits</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Take-Profit reached with realized profit</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '12px 14px', borderRadius: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={telegramStoploss}
                  onChange={e => setTelegramStoploss(e.target.checked)}
                  style={{ accentColor: 'var(--color-blue)', width: '16px', height: '16px' }}
                />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>🛑 Stop-Loss Triggers</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Instant risk exit alerts</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '12px 14px', borderRadius: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={telegramRisk}
                  onChange={e => setTelegramRisk(e.target.checked)}
                  style={{ accentColor: 'var(--color-blue)', width: '16px', height: '16px' }}
                />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>⚠️ Risk Guardian</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Daily loss / trade limit warnings</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Security, Two-Factor Authentication & App Unlock Card */}
        <div id="security-2fa-section" style={{ background: 'var(--bg-panel)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', gridColumn: '1 / -1' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={20} color="var(--color-blue)" /> Two-Factor Authentication (Google 2FA) & Quick App Security
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
            Set up Google Authenticator (TOTP) 6-digit dynamic codes, 4-digit quick PIN, or Face ID / Fingerprint to secure your SkandX trading account.
          </p>

          <BiometricSettingsSection user={user} />
        </div>

      </div>

      

    </div>
  );
}

export function BiometricSettingsSection({ user }) {
  const userId = user?.id || 'default';
  const { 
    userSessions, userSessionsLoading, fetchUserSessions, revokeOtherSessions, revokeSession, cleanDuplicateSessions,
    fetchTotpSetup, enableTotp, disableTotp, totpLoading,
    trustedDevices, trustedDevicesLoading, fetchTrustedDevices, revokeTrustedDevice
  } = useStore(useShallow(state => ({ 
    userSessions: state.userSessions || [],
    userSessionsLoading: state.userSessionsLoading,
    fetchUserSessions: state.fetchUserSessions,
    revokeOtherSessions: state.revokeOtherSessions,
    revokeSession: state.revokeSession,
    cleanDuplicateSessions: state.cleanDuplicateSessions,
    fetchTotpSetup: state.fetchTotpSetup,
    enableTotp: state.enableTotp,
    disableTotp: state.disableTotp,
    totpLoading: state.totpLoading,
    trustedDevices: state.trustedDevices || [],
    trustedDevicesLoading: state.trustedDevicesLoading,
    fetchTrustedDevices: state.fetchTrustedDevices,
    revokeTrustedDevice: state.revokeTrustedDevice
  })));

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [revokingOthers, setRevokingOthers] = useState(false);
  const [sessionMsg, setSessionMsg] = useState({ type: '', text: '' });
  const [sessionViewMode, setSessionViewMode] = useState('DEVICES'); // 'DEVICES' or 'RAW_LOGS'
  const [expandedDeviceKey, setExpandedDeviceKey] = useState(null);
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [cleaningDuplicates, setCleaningDuplicates] = useState(false);
  const [copiedIp, setCopiedIp] = useState(null);

  // TOTP & 30-day Trusted Devices States
  const [showTotpSetup, setShowTotpSetup] = useState(false);
  const [totpSetupData, setTotpSetupData] = useState(null);
  const [totpVerificationCode, setTotpVerificationCode] = useState('');
  const [totpCopied, setTotpCopied] = useState(false);
  const [showTotpDisable, setShowTotpDisable] = useState(false);
  const [totpDisablePassword, setTotpDisablePassword] = useState('');

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (fetchUserSessions) {
      fetchUserSessions();
    }
    if (fetchTrustedDevices) {
      fetchTrustedDevices();
    }
  }, []);

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

  const handleStartTotpSetup = async () => {
    setStatusMsg({ type: '', text: '' });
    const data = await fetchTotpSetup();
    if (data && data.success) {
      setTotpSetupData(data);
      setShowTotpSetup(true);
      setShowTotpDisable(false);
    } else {
      setStatusMsg({ type: 'error', text: data?.error || 'Failed to initialize Google Authenticator' });
    }
  };

  const handleConfirmTotpEnable = async (e) => {
    e.preventDefault();
    if (!totpSetupData?.secret || !totpVerificationCode) return;
    const res = await enableTotp(totpSetupData.secret, totpVerificationCode);
    if (res && res.success) {
      setShowTotpSetup(false);
      setTotpSetupData(null);
      setTotpVerificationCode('');
      setStatusMsg({ type: 'success', text: '✅ Google Authenticator (TOTP) successfully activated!' });
    } else {
      setStatusMsg({ type: 'error', text: res?.error || 'Invalid 6-digit code. Please check app and try again.' });
    }
  };

  const handleConfirmTotpDisable = async (e) => {
    e.preventDefault();
    if (!totpDisablePassword) return;
    const res = await disableTotp(totpDisablePassword);
    if (res && res.success) {
      setShowTotpDisable(false);
      setTotpDisablePassword('');
      setStatusMsg({ type: 'success', text: 'Google Authenticator has been disabled.' });
    } else {
      setStatusMsg({ type: 'error', text: res?.error || 'Failed to disable 2FA. Incorrect password.' });
    }
  };

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
      removeBiometrics(userId);
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
          text: '💡 Biometrics requires device hardware or Google Chrome / Safari on Web. Your 4-Digit PIN is active and protects your account!' 
        });
      } else {
        setStatusMsg({ type: 'error', text: 'Biometric setup: ' + (err.message || String(err)) });
      }
    }
  };

  const handleTestLock = () => {
    setAppLocked(true, userId);
    window.dispatchEvent(new CustomEvent('skandx_lock_app'));
  };

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return 'Just now';
    try {
      const date = new Date(dateStr);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString('en-GB');
    } catch {
      return 'Just now';
    }
  };

  const getDeviceIconDetails = (device) => {
    const model = (device?.device_model || '').toLowerCase();
    const os = (device?.os_name || '').toLowerCase();

    if (model.includes('iphone') || model.includes('android') || model.includes('phone') || model.includes('mobile') || model.includes('sm-')) {
      return {
        icon: Smartphone,
        color: '#3B82F6',
        bg: 'rgba(59, 130, 246, 0.12)',
        typeLabel: 'Mobile Phone'
      };
    }
    if (model.includes('ipad') || model.includes('tablet')) {
      return {
        icon: Tablet,
        color: '#A855F7',
        bg: 'rgba(168, 85, 247, 0.12)',
        typeLabel: 'Tablet'
      };
    }
    if (os.includes('mac')) {
      return {
        icon: Laptop,
        color: '#F43F5E',
        bg: 'rgba(244, 63, 94, 0.12)',
        typeLabel: 'Mac OS'
      };
    }
    if (os.includes('linux')) {
      return {
        icon: Cpu,
        color: '#F59E0B',
        bg: 'rgba(245, 158, 11, 0.12)',
        typeLabel: 'Linux System'
      };
    }
    return {
      icon: Monitor,
      color: '#06B6D4',
      bg: 'rgba(6, 182, 212, 0.12)',
      typeLabel: os.includes('windows') ? 'Windows PC' : 'Desktop PC'
    };
  };

  const deviceGroups = useMemo(() => {
    if (!Array.isArray(userSessions) || userSessions.length === 0) return [];
    const map = new Map();

    userSessions.forEach(session => {
      const key = `${session.device_model || 'Unknown'}_${session.os_name || 'Unknown'}_${session.browser_name || 'Browser'}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          device_model: session.device_model || 'Desktop PC',
          os_name: session.os_name || 'Unknown OS',
          browser_name: session.browser_name || 'Browser',
          city: session.city || '',
          state: session.state || '',
          ip_address: session.ip_address || '',
          is_current: !!session.is_current,
          latest_active: session.last_active_at,
          sessions: [session]
        });
      } else {
        const group = map.get(key);
        group.sessions.push(session);
        if (session.is_current) group.is_current = true;
        if (!group.city && session.city) group.city = session.city;
        if (!group.state && session.state) group.state = session.state;
        if (!group.ip_address && session.ip_address) group.ip_address = session.ip_address;
        if (new Date(session.last_active_at) > new Date(group.latest_active)) {
          group.latest_active = session.last_active_at;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.is_current) return -1;
      if (b.is_current) return 1;
      return new Date(b.latest_active) - new Date(a.latest_active);
    });
  }, [userSessions]);

  const currentDeviceGroup = useMemo(() => {
    return deviceGroups.find(g => g.is_current) || null;
  }, [deviceGroups]);

  const otherDeviceGroups = useMemo(() => {
    return deviceGroups.filter(g => !g.is_current);
  }, [deviceGroups]);

  const duplicateSessionsCount = useMemo(() => {
    return Math.max(0, userSessions.length - deviceGroups.length);
  }, [userSessions, deviceGroups]);

  const handleRevokeDevice = async (device) => {
    if (!device?.sessions?.length) return;
    const count = device.sessions.length;
    if (!window.confirm(`Revoke all ${count} active session token(s) for "${device.device_model}"? This device will be signed out.`)) {
      return;
    }
    try {
      await Promise.all(device.sessions.map(s => revokeSession(s.id)));
      setSessionMsg({ type: 'success', text: `Revoked ${count} session(s) on ${device.device_model}.` });
      setTimeout(() => setSessionMsg({ type: '', text: '' }), 4000);
      if (fetchUserSessions) fetchUserSessions();
    } catch (err) {
      setSessionMsg({ type: 'error', text: 'Failed to revoke device sessions' });
    }
  };

  const handleCleanDuplicates = async () => {
    setCleaningDuplicates(true);
    setSessionMsg({ type: '', text: '' });
    try {
      const res = await cleanDuplicateSessions();
      if (res && res.success) {
        setSessionMsg({ type: 'success', text: res.message || 'Duplicate sessions cleaned successfully!' });
      } else {
        setSessionMsg({ type: 'error', text: res?.error || 'Failed to clean duplicate sessions' });
      }
    } catch (err) {
      setSessionMsg({ type: 'error', text: err.message || 'Failed to clean duplicate sessions' });
    } finally {
      setCleaningDuplicates(false);
      setTimeout(() => setSessionMsg({ type: '', text: '' }), 4000);
    }
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
        {/* Google Authenticator (TOTP) Status Tile - Highlighted as Top Security Option */}
        <div style={{
          background: user?.totp_enabled ? 'rgba(34,197,94,0.04)' : 'rgba(59,130,246,0.05)',
          border: user?.totp_enabled ? '1px solid rgba(34,197,94,0.35)' : '1px solid rgba(59,130,246,0.4)',
          padding: '18px',
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: user?.totp_enabled ? 'rgba(34,197,94,0.15)' : 'rgba(59,130,246,0.15)', padding: '10px', borderRadius: '50%', color: user?.totp_enabled ? '#22c55e' : '#60a5fa' }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>Google Authenticator (2FA)</div>
              <div style={{ fontSize: '11.5px', color: user?.totp_enabled ? '#22c55e' : '#f59e0b', fontWeight: '600', marginTop: '2px' }}>
                {user?.totp_enabled ? '✅ Active (Dynamic 6-Digit App Code)' : '⚠️ Recommended (Scan QR & Save Key)'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            {user?.totp_enabled ? (
              <button
                type="button"
                onClick={() => setShowTotpDisable(true)}
                style={{ width: '100%', padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
              >
                Disable 2FA
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartTotpSetup}
                disabled={totpLoading}
                style={{ width: '100%', padding: '9px 16px', background: 'var(--color-blue)', border: 'none', color: '#fff', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
              >
                {totpLoading ? 'Loading QR Code...' : '⚡ Set Up Google Authenticator'}
              </button>
            )}
          </div>
        </div>

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
              <div style={{ fontSize: '11.5px', color: bioEnabled ? '#22c55e' : (!pinEnabled ? '#f59e0b' : (bioAvailable ? 'var(--text-secondary)' : '#94a3b8')), fontWeight: '600', marginTop: '2px' }}>
                {bioEnabled ? '✅ Biometrics Active' : (!pinEnabled ? '⚠️ Requires 4-Digit PIN First' : (bioAvailable ? 'Supported on Device' : 'Requires Chrome/Safari or Native APK'))}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '6px' }}>
            <button
              type="button"
              onClick={handleToggleBiometrics}
              style={{
                width: '100%',
                padding: '9px 16px',
                background: bioEnabled ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.15)',
                border: bioEnabled ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(59,130,246,0.35)',
                color: bioEnabled ? '#ef4444' : '#60a5fa',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              {bioEnabled ? 'Disable Biometrics' : 'Enable Touch ID / Face ID'}
            </button>
          </div>
        </div>

        {/* Auto-Lock Inactivity Timer Card (Side-by-Side) */}
        {pinEnabled && (
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
              <div style={{ background: autoLockMinutes > 0 ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.06)', padding: '10px', borderRadius: '50%', color: autoLockMinutes > 0 ? 'var(--color-blue-light)' : 'var(--text-secondary)' }}>
                <Clock size={20} />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>Auto-Lock Timer</div>
                <div style={{ fontSize: '11.5px', color: autoLockMinutes > 0 ? 'var(--color-blue-light)' : 'var(--text-secondary)', fontWeight: '600', marginTop: '2px' }}>
                  {autoLockMinutes === 0 ? '⚡ Immediately on Background' : autoLockMinutes === -1 ? 'Off / Never' : `Locks after ${autoLockMinutes}m idle`}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
              {AUTO_LOCK_OPTIONS.map(opt => {
                const isSel = autoLockMinutes === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelectAutoLock(opt.value)}
                    style={{
                      padding: '5px 8px',
                      borderRadius: '5px',
                      background: isSel ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255,255,255,0.04)',
                      border: isSel ? '1px solid var(--color-blue)' : '1px solid var(--border-color)',
                      color: isSel ? 'var(--color-blue-light)' : 'var(--text-secondary)',
                      fontSize: '11px',
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
      </div>

      {/* Google Authenticator Setup Card / Modal */}
      {showTotpSetup && totpSetupData && (
        <div style={{ background: 'rgba(15, 23, 42, 0.85)', border: '1px solid var(--color-blue)', padding: '24px', borderRadius: '12px', marginTop: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: '700', margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color="var(--color-blue-light)" /> Set Up Google Authenticator (TOTP)
            </h4>
            <X size={18} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setShowTotpSetup(false)} />
          </div>

          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '18px', lineHeight: '1.5' }}>
            Scan this QR code with <strong>Google Authenticator</strong>, <strong>Authy</strong>, or any TOTP app, then enter the 6-digit code below to activate.
          </p>

          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '24px', alignItems: 'center' }}>
            {(totpSetupData.qrCode || totpSetupData.otpauth_url) && (
              <div style={{ background: '#fff', padding: '12px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', flexShrink: 0 }}>
                <img
                  src={totpSetupData.qrCode || `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(totpSetupData.otpauth_url || '')}`}
                  alt="TOTP QR Code"
                  style={{ width: '160px', height: '160px', display: 'block' }}
                />
                <div style={{ textAlign: 'center', fontSize: '10px', color: '#334155', fontWeight: '700', marginTop: '6px' }}>
                  Scan in Authenticator
                </div>
              </div>
            )}

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Manual Secret Key (if camera scan is unavailable):
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="text"
                    readOnly
                    value={totpSetupData.secret}
                    style={{ flex: 1, fontFamily: 'monospace', letterSpacing: '1px', fontSize: '13px', fontWeight: '700', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#38bdf8', padding: '8px 12px', borderRadius: '6px' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(totpSetupData.secret);
                      setTotpCopied(true);
                      setTimeout(() => setTotpCopied(false), 2500);
                    }}
                    style={{ padding: '8px 14px', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60a5fa', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Copy size={13} /> {totpCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <form onSubmit={handleConfirmTotpEnable} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '160px' }}>
                  <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Enter 6-Digit Code from App to Confirm:
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={totpVerificationCode}
                    onChange={e => setTotpVerificationCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    style={{ width: '100%', boxSizing: 'border-box', letterSpacing: '6px', textAlign: 'center', fontSize: '18px', fontWeight: '700', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#fff', padding: '8px', borderRadius: '6px' }}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={totpLoading || totpVerificationCode.length !== 6}
                  style={{ background: 'var(--color-blue)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {totpLoading ? 'Verifying...' : 'Verify & Activate'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Google Authenticator Disable Modal */}
      {showTotpDisable && (
        <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '20px', borderRadius: '10px', marginTop: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '700', margin: 0, color: '#ef4444' }}>Disable Google Authenticator</h4>
            <X size={16} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setShowTotpDisable(false)} />
          </div>
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
            Enter your account password to confirm disabling Google Authenticator:
          </p>
          <form onSubmit={handleConfirmTotpDisable} style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="password"
              placeholder="Account Password"
              value={totpDisablePassword}
              onChange={e => setTotpDisablePassword(e.target.value)}
              style={{ flex: 1, minWidth: '180px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#fff', padding: '8px 12px', borderRadius: '6px', fontSize: '13px' }}
              required
            />
            <button
              type="submit"
              disabled={totpLoading}
              style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
            >
              {totpLoading ? 'Disabling...' : 'Confirm Disable'}
            </button>
          </form>
        </div>
      )}

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

      {/* Auto-Lock / PIN Screen Test */}
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

      {/* ─── Session & Device Security Command Center ───────────────────────── */}
      <div style={{
        background: 'var(--bg-panel)',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        padding: isMobile ? '16px' : '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
      }}>
        {/* Header with Title & Action Buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'flex-start' : 'center',
          flexDirection: isMobile ? 'column' : 'row',
          gap: '14px',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '18px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                padding: '8px',
                borderRadius: '10px',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <ShieldAlert size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: '800', margin: 0, color: '#fff', letterSpacing: '-0.3px' }}>
                  Device & Session Security Center
                </h3>
                <div style={{ color: 'var(--text-secondary)', fontSize: '12.5px', marginTop: '2px' }}>
                  Manage authorized hardware, monitor active logins, and safeguard your trading account
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: isMobile ? '100%' : 'auto', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => fetchUserSessions()}
              disabled={userSessionsLoading}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '7px 12px' }}
              title="Refresh sessions list"
            >
              <RefreshCw size={13} className={userSessionsLoading ? 'animate-spin' : ''} />
              Refresh
            </button>

            {duplicateSessionsCount > 0 && (
              <button
                type="button"
                onClick={handleCleanDuplicates}
                disabled={cleaningDuplicates}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(139, 92, 246, 0.15)',
                  border: '1px solid rgba(139, 92, 246, 0.4)',
                  color: '#C084FC',
                  padding: '7px 13px',
                  borderRadius: '7px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: cleaningDuplicates ? 'not-allowed' : 'pointer'
                }}
                title="Consolidate duplicate login tokens into unique recognized devices"
              >
                {cleaningDuplicates ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                Clean {duplicateSessionsCount} Duplicates
              </button>
            )}

            {userSessions.filter(s => !s.is_current).length > 0 && (
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm('Are you sure you want to log out all other devices? They will need to sign in again.')) {
                    setRevokingOthers(true);
                    setSessionMsg({ type: '', text: '' });
                    const res = await revokeOtherSessions();
                    if (res.success) {
                      setSessionMsg({ type: 'success', text: res.message || 'All other devices have been logged out.' });
                      setTimeout(() => setSessionMsg({ type: '', text: '' }), 4000);
                    } else {
                      setSessionMsg({ type: 'error', text: res.error || 'Failed to revoke other sessions' });
                    }
                    setRevokingOthers(false);
                  }
                }}
                disabled={revokingOthers}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(185, 28, 28, 0.25) 100%)',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                  color: '#F87171',
                  padding: '7px 14px',
                  borderRadius: '7px',
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: revokingOthers ? 'not-allowed' : 'pointer'
                }}
              >
                {revokingOthers ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
                Log Out All Other Devices
              </button>
            )}
          </div>
        </div>

        {/* Status notification banner if any */}
        {sessionMsg.text && (
          <div style={{
            padding: '11px 16px',
            borderRadius: '8px',
            fontSize: '12.5px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: sessionMsg.type === 'success' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            border: `1px solid ${sessionMsg.type === 'success' ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
            color: sessionMsg.type === 'success' ? '#4ade80' : '#ef4444'
          }}>
            {sessionMsg.type === 'success' ? <Check size={15} /> : <AlertCircle size={15} />}
            {sessionMsg.text}
          </div>
        )}

        {/* ─── Security Overview Metrics Bar (3 Glass Cards) ─── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: '12px'
        }}>
          {/* Card 1: Account Defense Level */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '10px',
              padding: '10px',
              color: '#10B981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Protection Status
              </div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#10B981', marginTop: '1px' }}>
                High Security Active
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                2FA & Token Isolation Guard
              </div>
            </div>
          </div>

          {/* Card 2: Connected Hardware Summary */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              background: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '10px',
              padding: '10px',
              color: '#60A5FA',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Layers size={22} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Recognized Devices
              </div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#fff', marginTop: '1px' }}>
                {deviceGroups.length} Unique {deviceGroups.length === 1 ? 'Device' : 'Devices'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {userSessions.length} total active session tokens
              </div>
            </div>
          </div>

          {/* Card 3: Quick Security Status */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              background: 'rgba(168, 85, 247, 0.15)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              borderRadius: '10px',
              padding: '10px',
              color: '#C084FC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Lock size={22} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Session Isolation
              </div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#C084FC', marginTop: '1px' }}>
                Single-Device Bound
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Automatic expiry in 60 days
              </div>
            </div>
          </div>
        </div>

        {/* ─── Hero Showcase: CURRENT DEVICE (Active Now) ─── */}
        {currentDeviceGroup && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.7) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: '14px',
            padding: isMobile ? '16px' : '18px 22px',
            display: 'flex',
            alignItems: isMobile ? 'flex-start' : 'center',
            justifyContent: 'space-between',
            flexDirection: isMobile ? 'column' : 'row',
            gap: '16px',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                background: 'rgba(16, 185, 129, 0.18)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                padding: '14px',
                borderRadius: '12px',
                color: '#10B981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 20px rgba(16, 185, 129, 0.2)'
              }}>
                {(() => {
                  const details = getDeviceIconDetails(currentDeviceGroup);
                  const Icon = details.icon;
                  return <Icon size={26} color="#10B981" />;
                })()}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h4 style={{ fontSize: '15.5px', fontWeight: '800', margin: 0, color: '#fff' }}>
                    {currentDeviceGroup.device_model || 'Windows PC'}
                  </h4>
                  <span style={{
                    background: 'rgba(16, 185, 129, 0.2)',
                    border: '1px solid #10B981',
                    color: '#34D399',
                    fontSize: '10.5px',
                    fontWeight: '900',
                    padding: '3px 9px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    letterSpacing: '0.4px'
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981', display: 'inline-block', boxShadow: '0 0 8px #10B981' }} />
                    THIS DEVICE (CURRENT SESSION)
                  </span>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  flexWrap: 'wrap',
                  marginTop: '6px',
                  fontSize: '12px',
                  color: 'var(--text-secondary)'
                }}>
                  <span style={{ color: '#E2E8F0', fontWeight: '600' }}>
                    {currentDeviceGroup.os_name} · {currentDeviceGroup.browser_name}
                  </span>
                  {(currentDeviceGroup.city || currentDeviceGroup.state) && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#93C5FD' }}>
                      <MapPin size={12} /> {[currentDeviceGroup.city, currentDeviceGroup.state].filter(Boolean).join(', ')}
                    </span>
                  )}
                  {currentDeviceGroup.ip_address && (
                    <span 
                      onClick={() => {
                        navigator.clipboard?.writeText(currentDeviceGroup.ip_address);
                        setCopiedIp(currentDeviceGroup.ip_address);
                        setTimeout(() => setCopiedIp(null), 2000);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                        background: 'rgba(255,255,255,0.06)',
                        padding: '1px 7px',
                        borderRadius: '4px',
                        color: 'var(--text-muted)'
                      }}
                      title="Click to copy IP"
                    >
                      IP: {currentDeviceGroup.ip_address}
                      {copiedIp === currentDeviceGroup.ip_address ? <Check size={11} color="#34D399" /> : <Copy size={11} />}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
              <div style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34D399',
                fontSize: '11.5px',
                fontWeight: '800',
                padding: '4px 10px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                ● Active Now
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Primary session token
              </div>
            </div>
          </div>
        )}

        {/* ─── View Switcher Tabs ─── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setSessionViewMode('DEVICES')}
              style={{
                background: sessionViewMode === 'DEVICES' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                border: sessionViewMode === 'DEVICES' ? '1px solid var(--color-blue)' : '1px solid transparent',
                color: sessionViewMode === 'DEVICES' ? '#60A5FA' : 'var(--text-secondary)',
                fontWeight: '700',
                fontSize: '12.5px',
                padding: '6px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: '0.15s'
              }}
            >
              <Smartphone size={14} /> Recognized Hardware ({deviceGroups.length})
            </button>
            <button
              type="button"
              onClick={() => setSessionViewMode('RAW_LOGS')}
              style={{
                background: sessionViewMode === 'RAW_LOGS' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                border: sessionViewMode === 'RAW_LOGS' ? '1px solid var(--color-blue)' : '1px solid transparent',
                color: sessionViewMode === 'RAW_LOGS' ? '#60A5FA' : 'var(--text-secondary)',
                fontWeight: '700',
                fontSize: '12.5px',
                padding: '6px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: '0.15s'
              }}
            >
              <History size={14} /> Session History ({userSessions.length})
            </button>
          </div>

          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
            Auto-prunes after 60 days
          </div>
        </div>

        {/* ─── Tab Content 1: GROUPED RECOGNIZED DEVICES (Clean & Organized!) ─── */}
        {sessionViewMode === 'DEVICES' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {userSessionsLoading && userSessions.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto 8px auto' }} />
                Loading authorized devices...
              </div>
            ) : otherDeviceGroups.length === 0 ? (
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '24px',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                fontSize: '13px'
              }}>
                <CheckCheck size={24} color="#10B981" style={{ margin: '0 auto 8px auto' }} />
                <div style={{ fontWeight: '700', color: '#fff', fontSize: '14px', marginBottom: '2px' }}>
                  No other active devices
                </div>
                Your trading account is only signed in on this current device.
              </div>
            ) : (
              otherDeviceGroups.map((device) => {
                const details = getDeviceIconDetails(device);
                const Icon = details.icon;
                const isExpanded = expandedDeviceKey === device.key;

                return (
                  <div
                    key={device.key}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{
                          background: details.bg,
                          border: `1px solid ${details.color}40`,
                          padding: '11px',
                          borderRadius: '10px',
                          color: details.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Icon size={20} />
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '14px', fontWeight: '800', color: '#fff' }}>
                              {device.device_model}
                            </span>
                            <span style={{
                              fontSize: '10.5px',
                              fontWeight: '700',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              background: details.bg,
                              color: details.color
                            }}>
                              {details.typeLabel}
                            </span>
                            {device.sessions.length > 1 && (
                              <span style={{
                                fontSize: '10px',
                                fontWeight: '700',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: 'rgba(255,255,255,0.06)',
                                color: 'var(--text-secondary)'
                              }}>
                                {device.sessions.length} active sessions
                              </span>
                            )}
                          </div>

                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            flexWrap: 'wrap',
                            fontSize: '11.5px',
                            color: 'var(--text-secondary)',
                            marginTop: '3px'
                          }}>
                            <span>{device.os_name} · {device.browser_name}</span>
                            {(device.city || device.state) && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--text-muted)' }}>
                                <MapPin size={11} /> {[device.city, device.state].filter(Boolean).join(', ')}
                              </span>
                            )}
                            {device.ip_address && (
                              <span style={{ color: 'var(--text-muted)' }}>
                                • IP: {device.ip_address}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: isMobile ? '0' : 'auto' }}>
                        <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                            Last active: {formatRelativeTime(device.latest_active)}
                          </div>
                        </div>

                        {device.sessions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setExpandedDeviceKey(isExpanded ? null : device.key)}
                            style={{
                              background: 'transparent',
                              border: '1px solid var(--border-color)',
                              color: 'var(--text-secondary)',
                              padding: '5px 8px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px'
                            }}
                            title="Toggle session details"
                          >
                            <span>{isExpanded ? 'Hide' : 'Details'}</span>
                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRevokeDevice(device)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#ef4444',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          className="hoverable"
                          title="Sign out this device"
                        >
                          <Trash2 size={12} /> Revoke Device
                        </button>
                      </div>
                    </div>

                    {/* Expandable Session Details Tray */}
                    {isExpanded && device.sessions.length > 1 && (
                      <div style={{
                        background: 'rgba(0,0,0,0.25)',
                        borderTop: '1px solid var(--border-color)',
                        padding: '12px 18px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>
                          Active Login Tokens on this Device:
                        </div>
                        {device.sessions.map((sess, idx) => (
                          <div
                            key={sess.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '11.5px',
                              padding: '6px 10px',
                              background: 'rgba(255,255,255,0.02)',
                              borderRadius: '6px',
                              border: '1px solid rgba(255,255,255,0.04)'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ color: 'var(--text-muted)' }}>#{idx + 1}</span>
                              <span style={{ color: '#fff' }}>IP: {sess.ip_address || '—'}</span>
                              <span style={{ color: 'var(--text-secondary)' }}>· {formatRelativeTime(sess.last_active_at)}</span>
                            </div>
                            <button
                              type="button"
                              onClick={async () => {
                                const res = await revokeSession(sess.id);
                                if (res.success) {
                                  setSessionMsg({ type: 'success', text: 'Session revoked.' });
                                  setTimeout(() => setSessionMsg({ type: '', text: '' }), 3000);
                                }
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#EF4444',
                                fontSize: '11px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                padding: '2px 6px'
                              }}
                            >
                              Revoke Token
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ─── Tab Content 2: RAW SESSION AUDIT LOGS (Capped with Show More) ─── */}
        {sessionViewMode === 'RAW_LOGS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(() => {
              const displayLogs = showAllLogs ? userSessions : userSessions.slice(0, 5);
              return (
                <>
                  {displayLogs.map((session) => {
                    const isPhone = (session.device_model || '').toLowerCase().includes('phone') || (session.os_name || '').toLowerCase().includes('android');
                    return (
                      <div
                        key={session.id}
                        style={{
                          background: session.is_current ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                          border: session.is_current ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-color)',
                          borderRadius: '8px',
                          padding: '10px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '10px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {session.is_current ? <Monitor size={16} color="#10B981" /> : (isPhone ? <Smartphone size={16} color="#94A3B8" /> : <Monitor size={16} color="#94A3B8" />)}
                          <div>
                            <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {session.device_model}
                              {session.is_current && (
                                <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34D399', fontSize: '9px', fontWeight: '800', padding: '1px 5px', borderRadius: '4px' }}>
                                  CURRENT
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              {session.os_name} · {session.browser_name} · IP: {session.ip_address || '—'}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', color: session.is_current ? '#34D399' : 'var(--text-secondary)' }}>
                            {session.is_current ? 'Active now' : formatRelativeTime(session.last_active_at)}
                          </span>
                          {!session.is_current && (
                            <button
                              type="button"
                              onClick={async () => {
                                await revokeSession(session.id);
                              }}
                              style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '2px' }}
                              title="Revoke session"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {userSessions.length > 5 && (
                    <button
                      type="button"
                      onClick={() => setShowAllLogs(!showAllLogs)}
                      style={{
                        padding: '8px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        color: 'var(--color-blue)',
                        fontWeight: '700',
                        fontSize: '12px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        marginTop: '4px'
                      }}
                    >
                      {showAllLogs ? '▲ Collapse Sessions' : `▼ Show All ${userSessions.length} Sessions (+${userSessions.length - 5} more)`}
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Security Footnote */}
        <div style={{
          background: 'rgba(59, 130, 246, 0.05)',
          border: '1px solid rgba(59, 130, 246, 0.15)',
          borderRadius: '10px',
          padding: '12px 16px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <Shield size={18} color="var(--color-blue)" style={{ flexShrink: 0 }} />
          <span>
            <strong>Security Recommendation:</strong> If you see an unrecognized device or suspicious IP location, immediately click <strong>Log Out All Other Devices</strong> to terminate all external sessions and reset your password.
          </span>
        </div>
      </div>

      {/* ─── 60-Day Trusted Devices (Bypass Daily 2FA) ───────────────── */}
      <div style={{
        background: 'var(--bg-panel)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 4px 0', color: '#fff' }}>
              <ShieldCheck size={18} color="var(--color-blue)" /> 60-Day Trusted Devices (Bypass Daily 2FA)
            </h3>
            <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              These browsers & devices are authorized to bypass daily SMS/OTP challenges for 60 days.
            </div>
          </div>

          <button
            type="button"
            onClick={() => fetchTrustedDevices()}
            disabled={trustedDevicesLoading}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px' }}
            title="Refresh trusted devices"
          >
            <RefreshCw size={13} className={trustedDevicesLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {trustedDevicesLoading && trustedDevices.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
              <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto 8px auto' }} />
              Loading trusted devices...
            </div>
          ) : trustedDevices.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              No trusted devices registered yet. Check <strong>"Trust this device for 60 days"</strong> during login to remember this device.
            </div>
          ) : (
            trustedDevices.map((device) => {
              const expiresDate = new Date(device.expires_at);
              const daysRemaining = Math.max(0, Math.ceil((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
              return (
                <div key={device.id} style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '14px',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: 'rgba(59,130,246,0.15)', padding: '10px', borderRadius: '50%', color: 'var(--color-blue-light)' }}>
                      <Laptop size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {device.device_name || `${device.browser_name || 'Browser'} on ${device.os_name || 'Device'}`}
                        <span style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', fontSize: '10px', padding: '2px 7px', borderRadius: '12px', fontWeight: '700' }}>
                          TRUSTED ({daysRemaining}d left)
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <span>IP: {device.ip_address || '—'}</span>
                        <span>Last active: {device.last_used_at ? new Date(device.last_used_at).toLocaleDateString('en-GB') : '—'}</span>
                        <span>Expires: {expiresDate.toLocaleDateString('en-GB')}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      if (window.confirm('Revoke trust for this device? You will need 2FA to log in on it next time.')) {
                        const res = await revokeTrustedDevice(device.id);
                        if (res && res.success) {
                          setStatusMsg({ type: 'success', text: 'Device trust revoked successfully.' });
                          setTimeout(() => setStatusMsg({ type: '', text: '' }), 3500);
                        }
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: '#ef4444',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={13} /> Revoke Trust
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}



