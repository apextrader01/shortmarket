import { subscribeUserToPush, unsubscribeUserFromPush, triggerTestPushNotification, getPushSubscriptionStatus } from '../services/pushManager';
import { Bell, ShieldAlert } from 'lucide-react';
import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useStore, API } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { LogOut, FileText, PieChart, BarChart2, Gift, Users, Star, Settings, Keyboard, Info, HelpCircle, Upload, Loader2, X, ShieldCheck, Wallet, ArrowDownToLine, Send, Sparkles, User, CreditCard, Laptop, Copy, Check } from 'lucide-react';
import ReferralsView from './ReferralsView';
import SettingsView from './SettingsView';
import ResetPortfolioModal from './ResetPortfolioModal';
import { useSocialLinks } from '../utils/socialLinks';
// import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// ✅ Defined OUTSIDE component - stable identity across renders, prevents remount flicker
function Card({ title, desc, icon: Icon, color, onClick, badge }) {
  return (
    <div className="glass-panel hoverable" onClick={onClick} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', cursor: onClick ? 'pointer' : 'default', transition: 'all 0.2s', minHeight: '120px' }}>
      {Icon && <div style={{ color: color || 'var(--color-blue)', background: 'var(--bg-hover)', padding: '10px', borderRadius: '8px', width: 'fit-content' }}><Icon size={20} /></div>}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: '15px', fontWeight: '700', marginBottom: '8px', color: 'var(--text-primary)' }}>{title}</div>
        {desc && <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.5', flex: 1 }}>{desc}</div>}
        {badge && <div style={{ marginTop: '12px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)', width: 'fit-content', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '600' }}>{badge}</div>}
      </div>
    </div>
  );
}





export default function ClientDataView({ onDepositClick, setActiveTab, activeTab }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const { links: socialLinks } = useSocialLinks();
  const [showSupportChannelsModal, setShowSupportChannelsModal] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const { 
    user, orders, logout, updateProfilePicture, theme, setTheme, resetAccount, 
    fontSize, setFontSize, accessibilityMode, setAccessibilityMode, oneClickMode, setOneClickMode,
    telegramSettings, fetchTelegramSettings
  } = useStore(useShallow(state => ({ 
    user: state.user,
    orders: state.orders, 
    logout: state.logout, 
    updateProfilePicture: state.updateProfilePicture, 
    theme: state.theme, 
    setTheme: state.setTheme, 
    resetAccount: state.resetAccount,
    fontSize: state.fontSize,
    setFontSize: state.setFontSize,
    accessibilityMode: state.accessibilityMode,
    setAccessibilityMode: state.setAccessibilityMode,
    oneClickMode: state.oneClickMode,
    setOneClickMode: state.setOneClickMode,
    telegramSettings: state.telegramSettings,
    fetchTelegramSettings: state.fetchTelegramSettings
  })));
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [showHotkeysModal, setShowHotkeysModal] = useState(false);
  const [showReferrals, setShowReferrals] = useState(false);
  const [showProfile, setShowProfile] = useState(() => activeTab === 'Settings');
  const [settingsTab, setSettingsTab] = useState('all');
  const [showResetModal, setShowResetModal] = useState(false);

  useEffect(() => {
    if (activeTab === 'Settings') {
      setShowProfile(true);
    } else if (activeTab === 'ClientData') {
      setShowProfile(false);
    }
  }, [activeTab]);

  const openSettingsTab = (tab = 'all') => {
    setSettingsTab(tab);
    setShowProfile(true);
    if (setActiveTab) {
      setActiveTab('Settings');
    }
  };

  const handleBackToDashboard = () => {
    setShowProfile(false);
    if (setActiveTab) {
      setActiveTab('ClientData');
    }
  };

  const [copiedId, setCopiedId] = useState(false);
  const handleCopyClientId = (e) => {
    e?.stopPropagation?.();
    const idToCopy = user?.client_id || user?.id || '';
    if (idToCopy && navigator.clipboard) {
      navigator.clipboard.writeText(String(idToCopy));
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  useEffect(() => {
    fetchTelegramSettings?.();
  }, [fetchTelegramSettings]);
    // 🛡️ Risk Guardian State
  const [isRiskActive, setIsRiskActive] = useState(() => !!(user && user.risk_guardian_active));
  const [maxTrades, setMaxTrades] = useState(() => (user && user.max_daily_trades) || 4);
  const [maxLoss, setMaxLoss] = useState(() => (user && user.max_daily_loss) || 5000);
  const [isCustomTrades, setIsCustomTrades] = useState(() => (user?.max_daily_trades && ![2, 4, 10].includes(Number(user.max_daily_trades))));
  const [isCustomLoss, setIsCustomLoss] = useState(() => (user?.max_daily_loss && ![2000, 5000, 10000].includes(Number(user.max_daily_loss))));
  const [tradesSaved, setTradesSaved] = useState(false);
  const [lossSaved, setLossSaved] = useState(false);
  const [riskMsg, setRiskMsg] = useState('');

  // Calculate today's discipline status
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayCompletedOrders = (orders || []).filter(o => (o.status === 'COMPLETED' || o.status === 'COMPLETE' || o.status === 'EXECUTED') && new Date(o.created_at) >= todayStart);
  const todayTradesCount = todayCompletedOrders.length;
  let todayNetPnL = 0;
  todayCompletedOrders.forEach(o => {
    if (o.realized_pnl !== null && o.realized_pnl !== undefined) {
      todayNetPnL += parseFloat(o.realized_pnl);
    }
  });
  const todayRealizedLoss = todayNetPnL < 0 ? Math.abs(todayNetPnL) : 0;
  const isTradesLocked = isRiskActive && maxTrades && todayTradesCount >= Number(maxTrades);
  const isLossLocked = isRiskActive && maxLoss && todayRealizedLoss >= Number(maxLoss);
  const isLockedTonight = isTradesLocked || isLossLocked;

  const handleSaveRiskGuardian = async (activeOverride, tradesOverride, lossOverride) => {
    try {
      const activeVal = activeOverride !== undefined ? activeOverride : isRiskActive;
      const tradesVal = tradesOverride !== undefined ? tradesOverride : maxTrades;
      const lossVal = lossOverride !== undefined ? lossOverride : maxLoss;
      
      setRiskMsg('Saving rules...');
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API}/api/user/risk-guardian`, {
        credentials: 'include',
        method: 'POST',
        headers,
        body: JSON.stringify({
          risk_guardian_active: activeVal,
          max_daily_trades: tradesVal ? Number(tradesVal) : null,
          max_daily_loss: lossVal ? Number(lossVal) : null
        })
      });
      const data = await res.json();
      if (res.ok) {
        setRiskMsg('Rules Saved & Enforced! 🛡️');
        setTradesSaved(true);
        setLossSaved(true);
        if (data.user) useStore.getState().fetchUserData();
        setTimeout(() => { setRiskMsg(''); setTradesSaved(false); setLossSaved(false); }, 3000);
      } else {
        alert(data.error || 'Failed to save Risk Guardian');
        setRiskMsg('');
      }
    } catch (e) {
      alert('Error saving Risk Guardian: ' + e.message);
      setRiskMsg('');
    }
  };
  const [isPushEnabled, setIsPushEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      if (localStorage.getItem('web_push_enabled') === 'false') return false;
      const hasNativeToken = !!localStorage.getItem('fcm_device_token');
      const hasWebPref = localStorage.getItem('web_push_enabled') === 'true';
      const isGranted = typeof window.Notification !== 'undefined' && window.Notification.permission === 'granted';
      return (hasWebPref && isGranted) || hasNativeToken;
    }
    return false;
  });
  const [pushStatusMsg, setPushStatusMsg] = useState(() => {
    if (typeof window !== 'undefined') {
      if (localStorage.getItem('web_push_enabled') === 'false') return '';
      const hasNativeToken = !!localStorage.getItem('fcm_device_token');
      const hasWebPref = localStorage.getItem('web_push_enabled') === 'true';
      const isGranted = typeof window.Notification !== 'undefined' && window.Notification.permission === 'granted';
      if ((hasWebPref && isGranted) || hasNativeToken) {
        return 'Push Notifications Active! 🔔';
      }
    }
    return '';
  });
  
  useEffect(() => {
    const token = localStorage.getItem('token') || (user && user.token);
    getPushSubscriptionStatus(token).then((enabled) => {
      setIsPushEnabled(enabled);
      if (enabled) {
        setPushStatusMsg('Push Notifications Active! 🔔');
      } else {
        setPushStatusMsg('');
      }
    });
  }, [user]);

  const handleTogglePush = async () => {
    const token = localStorage.getItem('token') || (user && user.token);
    if (isPushEnabled) {
      // Turn OFF
      setPushStatusMsg('Disabling push...');
      await unsubscribeUserFromPush(token);
      setIsPushEnabled(false);
      setPushStatusMsg('Push Notifications Disabled');
      setTimeout(() => setPushStatusMsg(''), 3000);
    } else {
      // Turn ON
      try {
        setPushStatusMsg('Activating push alerts...');
        await subscribeUserToPush(token);
        setIsPushEnabled(true);
        setPushStatusMsg('Push Notifications Active! 🔔');
        setTimeout(() => setPushStatusMsg(''), 4000);
      } catch (err) {
        alert('Notification Setup: ' + err.message);
        setPushStatusMsg('');
      }
    }
  };

  const handleTestPush = async () => {
    try {
      const token = localStorage.getItem('token') || (user && user.token);
      await triggerTestPushNotification(token);
      setPushStatusMsg('Test alert sent! Check your notification center.');
      setTimeout(() => setPushStatusMsg(''), 4000);
    } catch (err) {
      alert('Test push error: ' + err.message);
    }
  };

  // 💰 Real Money Rewards & Withdrawal State
  const [rewardStats, setRewardStats] = useState({ availableRewardBalance: 0, totalEarned: 0 });
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawMsg, setWithdrawMsg] = useState({ type: '', text: '' });

  const fetchRewardStats = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch(`${API}/api/referrals`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json && json.success && json.stats) {
        setRewardStats(json.stats);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchRewardStats();
  }, []);

  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    if (!withdrawAmount || Number(withdrawAmount) <= 0) {
      setWithdrawMsg({ type: 'error', text: 'Please enter a valid withdrawal amount.' });
      return;
    }
    if (Number(withdrawAmount) > (rewardStats.availableRewardBalance || 0)) {
      setWithdrawMsg({ type: 'error', text: `Amount exceeds available reward balance (₹${rewardStats.availableRewardBalance?.toFixed(2) || '0.00'})` });
      return;
    }
    if (!user?.upi_id && (!user?.bank_account_no || !user?.bank_ifsc)) {
      setWithdrawMsg({ type: 'error', text: 'Please add your UPI ID or Bank Details in Profile Settings first.' });
      return;
    }

    setWithdrawLoading(true);
    setWithdrawMsg({ type: '', text: '' });
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/withdrawals/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ amount: parseFloat(withdrawAmount) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Withdrawal request failed');
      setWithdrawMsg({ type: 'success', text: '✅ Referral reward payout request submitted! Admin will credit your registered UPI/Bank.' });
      setWithdrawAmount('');
      fetchRewardStats();
      setTimeout(() => {
        setShowWithdrawModal(false);
        setWithdrawMsg({ type: '', text: '' });
      }, 2500);
    } catch (err) {
      setWithdrawMsg({ type: 'error', text: err.message || 'Withdrawal failed' });
    } finally {
      setWithdrawLoading(false);
    }
  };

  const handleResetAccount = async () => {
    if (window.confirm('Are you absolutely sure you want to reset your account? This will permanently delete all your trades, positions, and reset your balance to Rs. 10,00,000. This cannot be undone.')) {
      const res = await resetAccount();
      if (!res.success) {
        alert('Failed to reset account: ' + (res.error || 'Unknown error'));
      } else {
        alert('Account successfully reset to ₹10,00,000!');
      }
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file.');
      if (e.target) e.target.value = '';
      return;
    }

    if (file.size > 7 * 1024 * 1024) {
      setUploadError('Image is too large. Please select a file smaller than 7MB.');
      if (e.target) e.target.value = '';
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = async () => {
          try {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 512;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_SIZE) {
                height = Math.round((height * MAX_SIZE) / width);
                width = MAX_SIZE;
              }
            } else {
              if (height > MAX_SIZE) {
                width = Math.round((width * MAX_SIZE) / height);
                height = MAX_SIZE;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Compress to optimized JPEG at 85% quality (~30-60KB)
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
            const res = await updateProfilePicture(compressedBase64);

            if (!res.success) {
              setUploadError('Failed to save profile picture: ' + (res.error || 'Unknown error'));
            }
          } catch (err) {
            setUploadError('Failed to process image: ' + (err.message || 'Unknown error'));
          } finally {
            setIsUploading(false);
            if (e.target) e.target.value = '';
          }
        };

        img.onerror = () => {
          setIsUploading(false);
          setUploadError('Failed to load image for processing.');
          if (e.target) e.target.value = '';
        };

        img.src = reader.result;
      };

      reader.onerror = () => {
        setIsUploading(false);
        setUploadError('Failed to read image file.');
        if (e.target) e.target.value = '';
      };

      reader.readAsDataURL(file);
    } catch (err) {
      setIsUploading(false);
      setUploadError(err.message || 'Failed to process image.');
      if (e.target) e.target.value = '';
    }
  };
  if (showProfile) {
    return (
      <div style={{ flex: 1, height: '100%', overflowY: 'auto', background: 'var(--bg-dark)', padding: isMobile ? '16px 12px 90px 12px' : '20px 24px 60px 24px', animation: 'fadeIn 0.3s ease-out', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
          <button 
            type="button"
            className="btn btn-secondary" 
            onClick={handleBackToDashboard} 
            style={{ marginBottom: '20px', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '13.5px', fontWeight: '700', borderRadius: '8px', cursor: 'pointer', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
          >
            &larr; Back to Dashboard
          </button>
          <SettingsView initialTab={settingsTab} onBack={handleBackToDashboard} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, height: '100%', padding: isMobile ? '16px 12px 90px 12px' : '20px 24px 60px 24px', overflowY: 'auto', background: 'var(--bg-dark)', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>My Account</h2>
            <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '12px', border: '1px solid var(--border-color)', fontWeight: '600' }}>
              Client Portal
            </span>
          </div>
          <button 
            type="button"
            onClick={logout} 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              color: 'var(--color-red-light, #f87171)', 
              cursor: 'pointer', 
              fontSize: '11px', 
              fontWeight: '700', 
              padding: '6px 14px', 
              border: '1px solid rgba(225,42,31,0.3)', 
              borderRadius: '20px', 
              background: 'rgba(225,42,31,0.08)',
              transition: 'all 0.15s ease'
            }}
            className="hover:bg-red-500/20"
          >
            <LogOut size={13} /> LOGOUT
          </button>
        </div>

        {/* Profile Card */}
        <div className="glass-panel" style={{ 
          padding: isMobile ? '16px' : '18px 22px', 
          borderRadius: '12px', 
          marginBottom: '18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'flex-start' : 'center',
          flexDirection: isMobile ? 'column' : 'row',
          gap: '16px',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
            <div 
              onClick={() => !isUploading && fileInputRef.current?.click()}
              style={{ 
                width: '52px', height: '52px', borderRadius: '50%', 
                background: user?.profile_picture_url ? `url(${user.profile_picture_url}) center/cover` : 'linear-gradient(135deg, var(--color-navy-light), var(--color-blue))', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                fontSize: '18px', fontWeight: '800', cursor: 'pointer',
                position: 'relative', overflow: 'hidden', flexShrink: 0,
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                border: '1.5px solid var(--border-color)'
              }}
              title="Upload Profile Picture"
            >
              {isUploading ? (
                <Loader2 size={24} className="animate-spin" color="var(--text-primary)" />
              ) : !user?.profile_picture_url ? (
                user?.username ? String(user.username).split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'HV'
              ) : null}
              
              {!isUploading && (
                <div style={{ position: 'absolute', bottom: 0, width: '100%', height: '32%', background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <Upload size={11} color="#ffffff" />
                </div>
              )}
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*" 
              style={{ display: 'none' }} 
            />

            <div style={{ flex: 1, minWidth: '220px' }}>
              <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '3px', letterSpacing: '-0.3px' }}>
                {user?.username || 'Hari Krishnan I Vijayan'}
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Client ID: <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{user?.client_id || user?.id || 'SE000002'}</strong>
                </span>
                <button 
                  type="button"
                  onClick={handleCopyClientId}
                  style={{
                    background: copiedId ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${copiedId ? 'rgba(34, 197, 94, 0.4)' : 'var(--border-color)'}`,
                    borderRadius: '4px',
                    padding: '2px 7px',
                    cursor: 'pointer',
                    fontSize: '10px',
                    fontWeight: '700',
                    color: copiedId ? '#4ade80' : 'var(--text-secondary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease'
                  }}
                  title="Copy Client ID"
                >
                  {copiedId ? <Check size={11} color="#4ade80" /> : <Copy size={11} />}
                  <span>{copiedId ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div style={{ fontSize: '13px', color: 'var(--color-green-light)', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Available Margin:</span>
                <span style={{ fontSize: '14.5px', fontWeight: '800' }}>
                  &#8377;{Number(user?.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* 5 Action Shortcuts Under Margin */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button 
                  type="button"
                  onClick={() => openSettingsTab('profile')} 
                  style={{ 
                    fontSize: '11px', 
                    fontWeight: '700', 
                    padding: '5px 11px', 
                    borderRadius: '6px', 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '5px',
                    background: 'rgba(59, 130, 246, 0.12)',
                    border: '1px solid rgba(59, 130, 246, 0.35)',
                    color: 'var(--color-blue-light)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  className="hover:bg-blue-500/20"
                >
                  <User size={12} /> Profile & KYC
                </button>

                <button 
                  type="button"
                  onClick={() => openSettingsTab('security')} 
                  style={{ 
                    fontSize: '11px', 
                    fontWeight: '700', 
                    padding: '5px 11px', 
                    borderRadius: '6px', 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '5px',
                    background: user?.totp_enabled ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    border: user?.totp_enabled ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
                    color: user?.totp_enabled ? '#4ade80' : '#f59e0b',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  className="hover:opacity-90"
                >
                  <ShieldCheck size={12} /> {user?.totp_enabled ? '2-Step 2FA: Active 🟢' : '2-Step Authenticator 🔑'}
                </button>

                <button 
                  type="button"
                  onClick={() => openSettingsTab('devices')} 
                  style={{ 
                    fontSize: '11px', 
                    fontWeight: '700', 
                    padding: '5px 11px', 
                    borderRadius: '6px', 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '5px',
                    background: 'rgba(139, 92, 246, 0.12)',
                    border: '1px solid rgba(139, 92, 246, 0.35)',
                    color: '#c084fc',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  className="hover:bg-purple-500/20"
                >
                  <Laptop size={12} /> Device Security
                </button>

                <button 
                  type="button"
                  onClick={() => openSettingsTab('devices')} 
                  style={{ 
                    fontSize: '11px', 
                    fontWeight: '700', 
                    padding: '5px 11px', 
                    borderRadius: '6px', 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '5px',
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    color: '#34d399',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  className="hover:bg-emerald-500/20"
                >
                  <Sparkles size={12} /> 60-Day Trusted Devices
                </button>

                <button 
                  type="button"
                  onClick={() => openSettingsTab('bank')} 
                  style={{ 
                    fontSize: '11px', 
                    fontWeight: '700', 
                    padding: '5px 11px', 
                    borderRadius: '6px', 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '5px',
                    background: (user?.upi_id || user?.bank_account_no) ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    color: (user?.upi_id || user?.bank_account_no) ? 'var(--color-blue-light)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  className="hover:bg-white/10"
                >
                  <CreditCard size={12} /> {(user?.upi_id || user?.bank_account_no) ? 'Bank & UPI 💳' : 'Bank & UPI ⚡'}
                </button>
              </div>

              {uploadError && <div style={{ fontSize: '10px', color: 'var(--color-red)', marginTop: '4px' }}>{uploadError}</div>}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'flex-start' : 'flex-end', gap: '4px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '11.5px', fontWeight: '600' }}>
              <Star size={13} color="#fbbf24" /> Member since {user?.created_at ? new Date(user.created_at).getFullYear() : '2024'}
            </div>
            <div style={{ fontSize: '10.5px', color: '#10b981', fontWeight: '700', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
              Verified Client Account ✓
            </div>
          </div>
        </div>

        {/* 2-Column Responsive Banner Grid: Add Funds + Real Cash Rewards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: '16px',
          marginBottom: '20px'
        }}>
          {/* Card 1: Ready to Invest / Deposit */}
          <div className="glass-panel" style={{
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '14px',
            borderLeft: '4px solid var(--color-blue)',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.06) 0%, rgba(15, 23, 42, 0.4) 100%)',
            borderRadius: '12px',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '800', color: 'var(--color-blue-light)', flexShrink: 0 }}>
                ₹
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--color-blue-light)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', background: 'rgba(59, 130, 246, 0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                    Paper Trading Margin
                  </span>
                </div>
                <div style={{ fontSize: '14.5px', fontWeight: '700', lineHeight: '1.3', color: 'var(--text-primary)' }}>
                  Add funds to start trading with SkandX
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Instant paper margin top-up or reset anytime.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: 'auto' }}>
              <button 
                type="button"
                onClick={onDepositClick} 
                style={{ 
                  flex: 1, 
                  background: 'var(--color-blue)', 
                  color: '#fff', 
                  border: 'none', 
                  padding: '10px 16px', 
                  borderRadius: '8px', 
                  fontSize: '11.5px', 
                  fontWeight: '700', 
                  cursor: 'pointer', 
                  transition: 'opacity 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Wallet size={14} /> DEPOSIT
              </button>
              <button 
                type="button"
                onClick={() => setShowResetModal(true)} 
                style={{ 
                  flex: 1, 
                  background: 'rgba(239, 68, 68, 0.1)', 
                  color: 'var(--color-red-light)', 
                  border: '1px solid rgba(239, 68, 68, 0.3)', 
                  padding: '10px 16px', 
                  borderRadius: '8px', 
                  fontSize: '11.5px', 
                  fontWeight: '700', 
                  cursor: 'pointer', 
                  transition: 'background 0.15s' 
                }}
              >
                RESET ACCOUNT
              </button>
            </div>
          </div>

          {/* Card 2: Real Cash Earnings / Rewards */}
          <div className="glass-panel" style={{
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '14px',
            borderLeft: '4px solid #10b981',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(6, 78, 59, 0.15) 100%)',
            borderColor: 'rgba(16, 185, 129, 0.3)',
            borderRadius: '12px',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div style={{ 
                width: '40px', 
                height: '40px', 
                borderRadius: '10px', 
                background: 'rgba(16, 185, 129, 0.18)', 
                border: '1px solid rgba(16, 185, 129, 0.4)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: '#34d399', 
                flexShrink: 0 
              }}>
                <Wallet size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '10px', color: '#34d399', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                    Real Cash Earnings
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Total: <strong style={{ color: 'var(--text-primary)' }}>&#8377;{Number(rewardStats?.totalEarned || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </span>
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                  <span>Available to Withdraw:</span>
                  <span style={{ color: '#10b981', fontSize: '17px', fontWeight: '900' }}>
                    &#8377;{Number(rewardStats?.availableRewardBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Direct payout to UPI or Bank Account within 24 hrs.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: 'auto' }}>
              <button 
                type="button"
                onClick={() => { setShowWithdrawModal(true); setWithdrawMsg({ type: '', text: '' }); }}
                style={{ 
                  flex: 1, 
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
                  color: '#ffffff', 
                  border: 'none', 
                  padding: '10px 16px', 
                  borderRadius: '8px', 
                  fontSize: '11.5px', 
                  fontWeight: '800', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '6px',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                  transition: 'all 0.15s' 
                }}
              >
                <ArrowDownToLine size={14} /> WITHDRAW CASH 💸
              </button>
              <button 
                type="button"
                onClick={() => setShowReferrals(true)} 
                style={{ 
                  flex: 1, 
                  background: 'rgba(255, 255, 255, 0.05)', 
                  color: 'var(--text-primary)', 
                  border: '1px solid var(--border-color)', 
                  padding: '10px 16px', 
                  borderRadius: '8px', 
                  fontSize: '11.5px', 
                  fontWeight: '700', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '6px',
                  transition: 'background 0.15s' 
                }}
              >
                <Gift size={14} color="#fbbf24" /> INVITE & EARN 🎁
              </button>
            </div>
          </div>
        </div>

        {/* Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          
          {/* Reports */}
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '12px', color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>Reports & Statements</h3>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
              <div onClick={() => setActiveTab('Reports')} className="glass-panel hoverable" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', borderRadius: '10px' }}>
                <FileText size={17} color="var(--color-blue-light)" />
                <span style={{ fontSize: '12.5px', fontWeight: '600' }}>Funds / Passbook</span>
              </div>
              <div onClick={() => setActiveTab('Reports')} className="glass-panel hoverable" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', borderRadius: '10px' }}>
                <FileText size={17} color="var(--color-blue-light)" />
                <span style={{ fontSize: '12.5px', fontWeight: '600' }}>Trades & Charges</span>
              </div>
              <div onClick={() => setActiveTab('Reports')} className="glass-panel hoverable" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', borderRadius: '10px' }}>
                <FileText size={17} color="var(--color-blue-light)" />
                <span style={{ fontSize: '12.5px', fontWeight: '600' }}>Statements</span>
              </div>
              <div onClick={() => setActiveTab('Reports')} className="glass-panel hoverable" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', borderRadius: '10px' }}>
                <PieChart size={17} color="var(--color-blue-light)" />
                <span style={{ fontSize: '12.5px', fontWeight: '600' }}>Profit & Loss</span>
              </div>
              <div onClick={() => setActiveTab('Reports')} className="glass-panel hoverable" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', borderRadius: '10px' }}>
                <BarChart2 size={17} color="var(--color-blue-light)" />
                <span style={{ fontSize: '12.5px', fontWeight: '600' }}>Trading Insights</span>
              </div>
            </div>
          </div>

        {/* Coming Features */}
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px', color: 'var(--text-primary)' }}>Coming Features</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: '16px' }}>
            <Card title="MTF (Margin Trading Facility)" desc="Buy upto 4 times quantity of equity stocks with just 0.045% interest per day" color="#A855F7" badge="Coming Soon" />
          </div>
        </div>

        {/* Subscription Plan */}
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px', color: 'var(--text-primary)' }}>Subscription Plan</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: '16px' }}>
            <Card icon={Users} title="Refer & Earn" desc="Refer a friend & get 10% of their subscription" color="#34D399" onClick={() => setShowReferrals(true)} />
            <Card icon={Star} title="Subscription Plans" desc="Curated plans to help you save on trading charges" color="#FBBF24" onClick={() => setActiveTab('Pricing')} />
            <Card icon={FileText} title="Trade Diary & Analytics" desc="Audit your edge, track mistakes, and access the 30-Day Discipline Challenge" color="#3B82F6" onClick={() => setActiveTab('TradeDiary')} />
          </div>
        </div>

        {/* Quick Settings */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>Quick Settings</h3>
          </div>
          
          <div className="glass-panel" style={{ overflow: 'hidden', padding: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 600px), 1fr))', gap: '1px', background: 'var(--border-color)' }}>
              
              {/* Push & Trade Alerts (Web & Mobile) */}
              <div style={{ padding: isMobile ? '16px 12px' : '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: 'var(--bg-panel)' }}>
                <div style={{ minWidth: '200px', flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Bell size={15} color={isPushEnabled ? 'var(--color-blue-light)' : 'var(--text-secondary)'} /> Push & Trade Alerts (Web & Mobile App)
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Receive real-time phone lock-screen and desktop alerts on order executions and triggers
                  </div>
                  {pushStatusMsg && (
                    <div style={{ fontSize: '11px', color: isPushEnabled ? 'var(--color-green-light)' : '#f87171', marginTop: '4px', fontWeight: '600' }}>
                      {pushStatusMsg}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {isPushEnabled && (
                    <button 
                      onClick={handleTestPush}
                      style={{ padding: '6px 12px', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                    >
                      Test Alert 🔔
                    </button>
                  )}
                  {/* Modern Toggle Switch: Blue when ON, Gray when OFF */}
                  <div 
                    onClick={handleTogglePush} 
                    title={isPushEnabled ? 'Click to Turn OFF' : 'Click to Turn ON'}
                    style={{ 
                      width: '40px', 
                      height: '22px', 
                      background: isPushEnabled ? 'var(--color-blue)' : 'var(--border-color)', 
                      borderRadius: '11px', 
                      position: 'relative', 
                      cursor: 'pointer', 
                      transition: 'background 0.2s',
                      flexShrink: 0
                    }}
                  >
                    <div 
                      style={{ 
                        width: '18px', 
                        height: '18px', 
                        background: isPushEnabled ? '#FFF' : 'var(--text-secondary)', 
                        borderRadius: '50%', 
                        position: 'absolute', 
                        top: '2px', 
                        left: isPushEnabled ? '20px' : '2px', 
                        transition: 'left 0.2s' 
                      }} 
                    />
                  </div>
                </div>
              </div>

              {/* Telegram Live Trade Alerts (Zero Delay Bot) */}
              <div style={{ padding: isMobile ? '16px 12px' : '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ minWidth: '200px', flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Send size={15} color="#0088cc" /> Telegram Live Alerts & Notifications
                    <span style={{
                      fontSize: '10px',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontWeight: '700',
                      background: telegramSettings?.settings?.telegram_chat_id && telegramSettings?.settings?.telegram_alerts_enabled ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.06)',
                      color: telegramSettings?.settings?.telegram_chat_id && telegramSettings?.settings?.telegram_alerts_enabled ? '#4ade80' : 'var(--text-secondary)',
                      border: telegramSettings?.settings?.telegram_chat_id && telegramSettings?.settings?.telegram_alerts_enabled ? '1px solid rgba(34,197,94,0.35)' : '1px solid var(--border-color)'
                    }}>
                      {telegramSettings?.settings?.telegram_chat_id && telegramSettings?.settings?.telegram_alerts_enabled ? '🟢 Connected' : '⚪ Not Linked'}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {telegramSettings?.settings?.telegram_chat_id 
                      ? `Linked to Chat ID: ${telegramSettings.settings.telegram_chat_id}. Instant order fills, target hits & stop-loss alerts active.`
                      : 'Receive instant, zero-delay order fill, target hit & stop-loss notifications directly on your phone via Telegram.'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => openSettingsTab('alerts')}
                    style={{
                      padding: '7px 14px',
                      background: 'linear-gradient(135deg, #0088cc 0%, #006699 100%)',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 6px rgba(0, 136, 204, 0.3)'
                    }}
                  >
                    <Send size={12} /> {telegramSettings?.settings?.telegram_chat_id ? 'Manage Telegram Settings' : 'Connect Telegram Bot 📲'}
                  </button>
                </div>
              </div>

              {/* 🛡️ Risk Guardian (Capital & Trade Discipline) */}
              <div style={{ padding: isMobile ? '16px 12px' : '20px', display: 'flex', flexDirection: 'column', gap: '14px', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ minWidth: '200px', flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShieldAlert size={15} color={isRiskActive ? '#f59e0b' : 'var(--text-secondary)'} /> Risk Guardian (Discipline & Capital Protection)
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                      Auto-squares off all open positions and locks trading if daily max loss or trade count is exceeded to protect your capital from runaway losses. Unlocks automatically next trading morning.
                    </div>
                    {riskMsg && <div style={{ fontSize: '11px', color: 'var(--color-green-light)', marginTop: '4px', fontWeight: '600' }}>{riskMsg}</div>}
                  </div>
                  <div 
                    onClick={() => {
                      const next = !isRiskActive;
                      setIsRiskActive(next);
                      handleSaveRiskGuardian(next, maxTrades, maxLoss);
                    }} 
                    title={isRiskActive ? 'Click to Disable' : 'Click to Enable'}
                    style={{ 
                      width: '40px', 
                      height: '22px', 
                      background: isRiskActive ? '#f59e0b' : 'var(--border-color)', 
                      borderRadius: '11px', 
                      position: 'relative', 
                      cursor: 'pointer', 
                      transition: 'background 0.2s',
                      flexShrink: 0
                    }}
                  >
                    <div 
                      style={{ 
                        width: '18px', 
                        height: '18px', 
                        background: isRiskActive ? '#FFF' : 'var(--text-secondary)', 
                        borderRadius: '50%', 
                        position: 'absolute', 
                        top: '2px', 
                        left: isRiskActive ? '20px' : '2px', 
                        transition: 'left 0.2s' 
                      }} 
                    />
                  </div>
                </div>

                {/* Live Status Badge */}
                {isRiskActive && (
                  <div>
                    {isLockedTonight ? (
                      <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '6px', color: '#f87171', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>🔒</span> Trading is LOCKED for tonight ({isTradesLocked ? `Hit ${maxTrades} trades limit` : `Hit ₹${Number(maxLoss).toLocaleString('en-IN')} max loss limit`}). Will unlock next morning.
                      </div>
                    ) : (
                      <div style={{ padding: '8px 12px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '6px', color: 'var(--color-green-light)', fontSize: '11px', fontWeight: '600', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <span>🛡️ Status: Active & Protecting Capital</span>
                        <span>Today: {todayTradesCount} / {maxTrades || '∞'} Trades | Realized Loss: ₹{todayRealizedLoss.toFixed(2)} / ₹{maxLoss ? Number(maxLoss).toLocaleString('en-IN') : '∞'}</span>
                      </div>
                    )}
                  </div>
                )}

                {isRiskActive && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    {/* Max Trades row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Max Trades Per Day:</span>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {[2, 4, 10].map(cnt => (
                          <span 
                            key={cnt}
                            onClick={() => { 
                              setIsCustomTrades(false);
                              setMaxTrades(cnt); 
                              handleSaveRiskGuardian(isRiskActive, cnt, maxLoss); 
                            }}
                            style={{ padding: '4px 10px', fontSize: '11px', cursor: 'pointer', borderRadius: '4px', background: (!isCustomTrades && Number(maxTrades) === cnt) ? 'rgba(245, 158, 11, 0.2)' : 'var(--bg-hover)', border: (!isCustomTrades && Number(maxTrades) === cnt) ? '1px solid #f59e0b' : '1px solid var(--border-color)', color: (!isCustomTrades && Number(maxTrades) === cnt) ? '#f59e0b' : 'var(--text-secondary)', fontWeight: '600' }}
                          >
                            {cnt} Trades
                          </span>
                        ))}
                        <span
                          onClick={() => setIsCustomTrades(true)}
                          style={{ padding: '4px 10px', fontSize: '11px', cursor: 'pointer', borderRadius: '4px', background: isCustomTrades ? 'rgba(245, 158, 11, 0.2)' : 'var(--bg-hover)', border: isCustomTrades ? '1px solid #f59e0b' : '1px solid var(--border-color)', color: isCustomTrades ? '#f59e0b' : 'var(--text-secondary)', fontWeight: '600' }}
                        >
                          Custom
                        </span>
                        {isCustomTrades && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={maxTrades}
                              onChange={(e) => { setMaxTrades(e.target.value); setTradesSaved(false); }}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveRiskGuardian(isRiskActive, maxTrades, maxLoss); }}
                              placeholder="Trades"
                              style={{ width: '65px', background: 'var(--bg-hover)', border: '1px solid #f59e0b', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', outline: 'none' }}
                            />
                            <button
                              onClick={() => handleSaveRiskGuardian(isRiskActive, maxTrades, maxLoss)}
                              style={{ padding: '4px 8px', background: tradesSaved ? 'var(--color-green-light)' : '#f59e0b', color: '#000', border: 'none', borderRadius: '4px', fontSize: '10px', fontWeight: '700', cursor: 'pointer', transition: 'background 0.2s' }}
                            >
                              {tradesSaved ? '✓ Saved' : 'Save'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Max Loss row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Max Daily Loss Limit:</span>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {[2000, 5000, 10000].map(amt => (
                          <span 
                            key={amt}
                            onClick={() => { 
                              setIsCustomLoss(false);
                              setMaxLoss(amt); 
                              handleSaveRiskGuardian(isRiskActive, maxTrades, amt); 
                            }}
                            style={{ padding: '4px 10px', fontSize: '11px', cursor: 'pointer', borderRadius: '4px', background: (!isCustomLoss && Number(maxLoss) === amt) ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-hover)', border: (!isCustomLoss && Number(maxLoss) === amt) ? '1px solid #ef4444' : '1px solid var(--border-color)', color: (!isCustomLoss && Number(maxLoss) === amt) ? '#f87171' : 'var(--text-secondary)', fontWeight: '600' }}
                          >
                            ₹{amt.toLocaleString('en-IN')}
                          </span>
                        ))}
                        <span
                          onClick={() => setIsCustomLoss(true)}
                          style={{ padding: '4px 10px', fontSize: '11px', cursor: 'pointer', borderRadius: '4px', background: isCustomLoss ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-hover)', border: isCustomLoss ? '1px solid #ef4444' : '1px solid var(--border-color)', color: isCustomLoss ? '#f87171' : 'var(--text-secondary)', fontWeight: '600' }}
                        >
                          Custom
                        </span>
                        {isCustomLoss && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                              type="number"
                              min="100"
                              step="500"
                              value={maxLoss}
                              onChange={(e) => { setMaxLoss(e.target.value); setLossSaved(false); }}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveRiskGuardian(isRiskActive, maxTrades, maxLoss); }}
                              placeholder="₹ Max Loss"
                              style={{ width: '85px', background: 'var(--bg-hover)', border: '1px solid #ef4444', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', outline: 'none' }}
                            />
                            <button
                              onClick={() => handleSaveRiskGuardian(isRiskActive, maxTrades, maxLoss)}
                              style={{ padding: '4px 8px', background: lossSaved ? 'var(--color-green-light)' : '#ef4444', color: lossSaved ? '#000' : '#fff', border: 'none', borderRadius: '4px', fontSize: '10px', fontWeight: '700', cursor: 'pointer', transition: 'background 0.2s' }}
                            >
                              {lossSaved ? '✓ Saved' : 'Save'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
<div style={{ padding: isMobile ? '16px 12px' : '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: 'var(--bg-panel)' }}>
                <div style={{ minWidth: '200px', flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '2px' }}>Font Size</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Customise your font size as per readability</div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <span onClick={() => setFontSize('small')} style={{ fontSize: '12px', padding: '6px 16px', cursor: 'pointer', background: fontSize === 'small' ? 'rgba(37, 99, 235, 0.1)' : 'transparent', border: fontSize === 'small' ? '1px solid var(--color-blue)' : '1px solid var(--border-color)', borderRadius: '4px', color: fontSize === 'small' ? 'var(--color-blue)' : 'var(--text-secondary)', fontWeight: fontSize === 'small' ? '600' : '500' }}>Small</span>
                <span onClick={() => setFontSize('medium')} style={{ fontSize: '12px', padding: '6px 16px', cursor: 'pointer', background: fontSize === 'medium' ? 'rgba(37, 99, 235, 0.1)' : 'transparent', border: fontSize === 'medium' ? '1px solid var(--color-blue)' : '1px solid var(--border-color)', borderRadius: '4px', color: fontSize === 'medium' ? 'var(--color-blue)' : 'var(--text-secondary)', fontWeight: fontSize === 'medium' ? '600' : '500' }}>Medium</span>
                <span onClick={() => setFontSize('large')} style={{ fontSize: '12px', padding: '6px 16px', cursor: 'pointer', background: fontSize === 'large' ? 'rgba(37, 99, 235, 0.1)' : 'transparent', border: fontSize === 'large' ? '1px solid var(--color-blue)' : '1px solid var(--border-color)', borderRadius: '4px', color: fontSize === 'large' ? 'var(--color-blue)' : 'var(--text-secondary)', fontWeight: fontSize === 'large' ? '600' : '500' }}>Large</span>
              </div>
            </div>

            <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-panel)' }}>
              <div style={{ minWidth: '200px', flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '2px' }}>Enable Accessibility Mode</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Turning this on will disable all shortcuts</div>
              </div>
              <div onClick={() => setAccessibilityMode(!accessibilityMode)} style={{ width: '36px', height: '20px', background: accessibilityMode ? 'var(--color-blue)' : 'var(--border-color)', borderRadius: '10px', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
                <div style={{ width: '16px', height: '16px', background: accessibilityMode ? '#FFF' : 'var(--text-secondary)', borderRadius: '50%', position: 'absolute', top: '2px', left: accessibilityMode ? '18px' : '2px', transition: 'left 0.2s' }} />
              </div>
            </div>

            <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-panel)', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ minWidth: '200px', flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '2px' }}>Appearance Preference</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Choose your high-contrast trading theme</div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { id: 'oled', label: '🖤 OLED Black', bg: '#000000', border: '#333333', color: '#ffffff' },
                  { id: 'midnight', label: '🌌 Midnight', bg: '#070c18', border: '#1e3a8a', color: '#ffffff' },
                  { id: 'charcoal', label: '🪙 Charcoal', bg: '#121214', border: '#2a2a30', color: '#ffffff' },
                  { id: 'dark', label: '🚀 Deep Space', bg: '#0B1121', border: '#1e293b', color: '#ffffff' },
                  { id: 'light', label: '☀️ Light', bg: '#FFFFFF', border: '#cbd5e1', color: '#0f172a' }
                ].map(t => {
                  const isSel = theme === t.id;
                  const isLightMode = theme === 'light';
                  return (
                    <span
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      style={{
                        fontSize: '11.5px',
                        padding: '6px 14px',
                        cursor: 'pointer',
                        background: isSel ? (isLightMode ? '#eff6ff' : 'rgba(59, 130, 246, 0.25)') : t.bg,
                        border: isSel ? '1.5px solid var(--color-blue)' : `1px solid ${t.border}`,
                        borderRadius: '6px',
                        color: isSel ? 'var(--color-blue)' : t.color,
                        fontWeight: isSel ? '700' : '500',
                        boxShadow: isSel ? (isLightMode ? '0 0 0 2px rgba(37,99,235,0.15)' : '0 0 10px rgba(59, 130, 246, 0.3)') : 'none',
                        transition: 'all 0.15s'
                      }}
                    >
                      {t.label}
                    </span>
                  );
                })}
              </div>
            </div>

            <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-panel)' }}>
              <div style={{ minWidth: '200px', flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '2px' }}>Re-Confirm Order</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Turn this on if you want an order preview every time you place an order</div>
              </div>
              <div onClick={() => setOneClickMode(!oneClickMode)} style={{ width: '36px', height: '20px', background: !oneClickMode ? 'var(--color-blue)' : 'var(--border-color)', borderRadius: '10px', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
                <div style={{ width: '16px', height: '16px', background: !oneClickMode ? '#FFF' : 'var(--text-secondary)', borderRadius: '50%', position: 'absolute', top: '2px', left: !oneClickMode ? '18px' : '2px', transition: 'left 0.2s' }} />
              </div>
            </div>
          </div>
        </div>
        </div>

        {/* Account Settings */}
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px', color: 'var(--text-primary)' }}>Account Settings & Other Info</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: '16px' }}>
            <div className="glass-panel hoverable" onClick={() => setActiveTab('Pricing')} style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <div style={{ background: 'var(--bg-hover)', padding: '8px', borderRadius: '4px' }}><Star size={16} color="var(--color-blue)" /></div>
              <span style={{ fontSize: '13px', fontWeight: '600' }}>Subscription Plans</span>
            </div>
            <div 
              className="glass-panel hoverable" 
              onClick={() => {
                try {
                  localStorage.setItem('skandx_show_feature_tour', 'true');
                  localStorage.removeItem('skandx_feature_tour_completed');
                  if (user?.id) {
                    localStorage.removeItem(`skandx_feature_tour_completed_${user.id}`);
                  }
                } catch (_) {}
                setActiveTab('Home');
              }}
              style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
            >
              <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '8px', borderRadius: '4px' }}>
                <Sparkles size={16} color="#38bdf8" />
              </div>
              <span style={{ fontSize: '13px', fontWeight: '600' }}>Platform Feature Tour</span>
            </div>
            <div 
              className="glass-panel hoverable" 
              onClick={() => setShowHotkeysModal(true)}
              style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
            >
              <div style={{ background: 'var(--bg-hover)', padding: '8px', borderRadius: '4px' }}><Keyboard size={16} color="var(--color-blue)" /></div>
              <span style={{ fontSize: '13px', fontWeight: '600' }}>Keyboard & Shortcut</span>
            </div>
            <div className="glass-panel hoverable" onClick={() => setActiveTab('AboutUs')} style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <div style={{ background: 'var(--bg-hover)', padding: '8px', borderRadius: '4px' }}><Info size={16} color="var(--color-blue)" /></div>
              <span style={{ fontSize: '13px', fontWeight: '600' }}>About Us</span>
            </div>
            <a
              href="/privacy-policy"
              className="glass-panel hoverable"
              style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{ background: 'var(--bg-hover)', padding: '8px', borderRadius: '4px' }}><ShieldCheck size={16} color="#10b981" /></div>
              <span style={{ fontSize: '13px', fontWeight: '600' }}>Privacy, Terms & Data Rights</span>
            </a>
            <a
              href="/delete-account"
              className="glass-panel hoverable"
              style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textDecoration: 'none', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.2)' }}
            >
              <div style={{ background: 'rgba(239, 68, 68, 0.12)', padding: '8px', borderRadius: '4px' }}><ShieldAlert size={16} color="#ef4444" /></div>
              <span style={{ fontSize: '13px', fontWeight: '600' }}>Request Account Deletion</span>
            </a>
          </div>
        </div>

        {/* Official Social Channels & Instant Connect */}
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: 'var(--text-primary)' }}>
            Official Channels &amp; Direct Support
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '14px' }}>
            <a
              href={socialLinks.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-panel hoverable"
              style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: 'inherit', border: '1px solid rgba(225, 48, 108, 0.35)' }}
            >
              <div style={{ background: 'rgba(225, 48, 108, 0.15)', padding: '10px', borderRadius: '8px', fontSize: '18px' }}>📸</div>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-primary)' }}>Instagram Channel</div>
                <div style={{ fontSize: '11px', color: '#f472b6', fontWeight: '600' }}>Follow Official Updates →</div>
              </div>
            </a>

            <a
              href={socialLinks.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-panel hoverable"
              style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: 'inherit', border: '1px solid rgba(24, 119, 242, 0.35)' }}
            >
              <div style={{ background: 'rgba(24, 119, 242, 0.15)', padding: '10px', borderRadius: '8px', fontSize: '18px' }}>📘</div>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-primary)' }}>Facebook Page</div>
                <div style={{ fontSize: '11px', color: '#60a5fa', fontWeight: '600' }}>Join Facebook Community →</div>
              </div>
            </a>

            <a
              href={socialLinks.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-panel hoverable"
              style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: 'inherit', border: '1px solid rgba(37, 211, 102, 0.35)' }}
            >
              <div style={{ background: 'rgba(37, 211, 102, 0.15)', padding: '10px', borderRadius: '8px', fontSize: '18px' }}>💬</div>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-primary)' }}>WhatsApp Account</div>
                <div style={{ fontSize: '11px', color: '#4ade80', fontWeight: '600' }}>Chat on {socialLinks.whatsappNumber || '+91 9497861379'} →</div>
              </div>
            </a>

            <a
              href={socialLinks.telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-panel hoverable"
              style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: 'inherit', border: '1px solid rgba(0, 136, 204, 0.35)' }}
            >
              <div style={{ background: 'rgba(0, 136, 204, 0.15)', padding: '10px', borderRadius: '8px', fontSize: '18px' }}>✈️</div>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-primary)' }}>Telegram Channel</div>
                <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '600' }}>Join Live Signals &amp; Alerts →</div>
              </div>
            </a>
          </div>
        </div>

        {/* OneHelp */}
        <div
          className="glass-panel hoverable"
          onClick={() => setShowSupportChannelsModal(true)}
          style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', cursor: 'pointer' }}
        >
          <div>
            <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              OneHelp &amp; Direct Connect
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Connect with us on WhatsApp, Telegram, Instagram or Facebook</div>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowSupportChannelsModal(true); }}
            style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px 20px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
          >
            CONNECT NOW
          </button>
        </div>
      </div>
      
      {/* Floating Ask Support Button */}
      <div
        className="support-fab"
        onClick={() => setShowSupportChannelsModal(true)}
        style={{ position: 'fixed', bottom: isMobile ? '70px' : '30px', right: isMobile ? '16px' : '30px', display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--color-blue)', color: 'var(--text-primary)', padding: '12px 20px', borderRadius: '30px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.4)', zIndex: 100 }}
      >
        <HelpCircle size={18} />
        <span style={{ fontSize: '13px', fontWeight: '700' }}>Ask Support</span>
      </div>

      {/* Support & Social Channels Modal */}
      {showSupportChannelsModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '16px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '22px', position: 'relative', borderRadius: '14px' }}>
            <button
              onClick={() => setShowSupportChannelsModal(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '20px' }}
            >&times;</button>
            <h3 style={{ fontSize: '17px', fontWeight: '800', marginBottom: '6px', color: 'var(--text-primary)' }}>
              Connect with SkandX Official Channels
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Reach our team on WhatsApp or follow our official Telegram, Instagram, and Facebook channels:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a href={socialLinks.whatsapp} target="_blank" rel="noopener noreferrer" style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(37, 211, 102, 0.14)', border: '1px solid rgba(37, 211, 102, 0.4)', color: '#4ade80', textDecoration: 'none', fontWeight: '800', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>💬 WhatsApp Support ({socialLinks.whatsappNumber || '+91 9497861379'})</span>
                <span>Open ↗</span>
              </a>
              <a href={socialLinks.telegram} target="_blank" rel="noopener noreferrer" style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(0, 136, 204, 0.16)', border: '1px solid rgba(0, 136, 204, 0.4)', color: '#38bdf8', textDecoration: 'none', fontWeight: '800', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>✈️ Official Telegram Channel</span>
                <span>Join ↗</span>
              </a>
              <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(225, 48, 108, 0.15)', border: '1px solid rgba(225, 48, 108, 0.4)', color: '#f472b6', textDecoration: 'none', fontWeight: '800', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>📸 Official Instagram Channel</span>
                <span>Follow ↗</span>
              </a>
              <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(24, 119, 242, 0.15)', border: '1px solid rgba(24, 119, 242, 0.4)', color: '#60a5fa', textDecoration: 'none', fontWeight: '800', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>📘 Official Facebook Page</span>
                <span>Visit ↗</span>
              </a>
            </div>
          </div>
        </div>
      )}
      
      {/* Hotkeys Modal */}
      {showHotkeysModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="glass-panel" style={{ width: '400px', padding: '20px', position: 'relative' }}>
            <button 
              onClick={() => setShowHotkeysModal(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '20px' }}
            >&times;</button>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-blue)' }}>
              <Keyboard size={20} /> Global Hotkeys
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.5' }}>
              You can execute Market Orders instantly using keyboard shortcuts. Hotkeys always target the <strong>currently selected symbol</strong> and use your default lot multiplier.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-hover)', padding: '12px 16px', borderRadius: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '500' }}>Instant Buy (Market)</span>
                <span style={{ fontSize: '13px', background: 'var(--color-blue)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 'bold' }}>Shift + B</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-hover)', padding: '12px 16px', borderRadius: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '500' }}>Instant Sell (Market)</span>
                <span style={{ fontSize: '13px', background: 'var(--color-red)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 'bold' }}>Shift + S</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real Money Withdrawal Modal */}
      {showWithdrawModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '16px'
        }}>
          <div className="glass-panel" style={{ 
            width: '100%', 
            maxWidth: '460px', 
            padding: '24px', 
            position: 'relative', 
            borderRadius: '16px',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
          }}>
            <button 
              onClick={() => { setShowWithdrawModal(false); setWithdrawMsg({ type: '', text: '' }); }}
              style={{ position: 'absolute', top: '18px', right: '18px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '8px', borderRadius: '8px', color: '#10b981' }}>
                <Wallet size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                  Referral Rewards Payout
                </h3>
                <div style={{ fontSize: '11px', color: '#10b981', fontWeight: '600' }}>
                  Direct Affiliate Commission Payout to UPI / Bank Account
                </div>
              </div>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
              Withdraw your earned referral commissions &amp; affiliate rewards directly to your registered bank account or UPI ID.
            </p>

            {/* Available Balance Box */}
            <div style={{ 
              background: 'rgba(16, 185, 129, 0.08)', 
              border: '1px solid rgba(16, 185, 129, 0.25)', 
              borderRadius: '10px', 
              padding: '14px 16px', 
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Available Cash Balance:</span>
              <span style={{ fontSize: '18px', fontWeight: '900', color: '#10b981' }}>
                ₹{Number(rewardStats?.availableRewardBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Destination Payout Account */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>
                Payout Destination
              </div>
              {user?.upi_id || user?.bank_account_no ? (
                <div style={{ 
                  background: 'var(--bg-hover)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '8px', 
                  padding: '12px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    {user?.upi_id ? (
                      <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                        UPI ID: <span style={{ color: '#34d399' }}>{user.upi_id}</span>
                      </div>
                    ) : (
                      <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                        Bank A/C: <span style={{ color: '#34d399' }}>{user.bank_account_no}</span> ({user.bank_ifsc})
                      </div>
                    )}
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Auto-credited upon approval
                    </div>
                  </div>
                  <button 
                    onClick={() => { setShowWithdrawModal(false); openSettingsTab('bank'); }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--color-blue-light)', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div style={{ 
                  background: 'rgba(239, 68, 68, 0.1)', 
                  border: '1px solid rgba(239, 68, 68, 0.3)', 
                  borderRadius: '8px', 
                  padding: '12px 14px' 
                }}>
                  <div style={{ fontSize: '12px', color: '#f87171', fontWeight: '600', marginBottom: '6px' }}>
                    ⚠️ No Bank or UPI details found!
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                    Please add your UPI ID or Bank Account in Profile Settings to receive payouts.
                  </div>
                  <button 
                    onClick={() => { setShowWithdrawModal(false); openSettingsTab('bank'); }}
                    style={{ 
                      background: 'var(--color-blue)', 
                      color: '#fff', 
                      border: 'none', 
                      padding: '6px 12px', 
                      borderRadius: '6px', 
                      fontSize: '11px', 
                      fontWeight: '700', 
                      cursor: 'pointer' 
                    }}
                  >
                    Add Bank / UPI Details &rarr;
                  </button>
                </div>
              )}
            </div>

            {/* Withdrawal Form */}
            <form onSubmit={handleWithdrawSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Withdrawal Amount (₹)
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', fontWeight: '700', color: 'var(--text-secondary)' }}>₹</span>
                  <input 
                    type="number" 
                    min="1" 
                    max={rewardStats?.availableRewardBalance || 0}
                    step="any"
                    placeholder="Enter amount"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px 12px 32px',
                      background: 'var(--bg-hover)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '15px',
                      fontWeight: '700',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Preset Fast Select Buttons */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  {[100, 500, 1000].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setWithdrawAmount(String(val))}
                      style={{
                        padding: '4px 10px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        fontSize: '11px',
                        color: 'var(--text-primary)',
                        cursor: 'pointer'
                      }}
                    >
                      +₹{val}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setWithdrawAmount(String(rewardStats?.availableRewardBalance || 0))}
                    style={{
                      padding: '4px 10px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '4px',
                      fontSize: '11px',
                      color: '#34d399',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    MAX
                  </button>
                </div>
              </div>

              {withdrawMsg.text && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '600',
                  marginBottom: '16px',
                  background: withdrawMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: withdrawMsg.type === 'success' ? '#34d399' : '#f87171',
                  border: `1px solid ${withdrawMsg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                }}>
                  {withdrawMsg.text}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'var(--bg-hover)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={withdrawLoading || !withdrawAmount || Number(withdrawAmount) <= 0 || Number(withdrawAmount) > (rewardStats?.availableRewardBalance || 0)}
                  style={{
                    flex: 2,
                    padding: '12px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: '800',
                    cursor: (withdrawLoading || !withdrawAmount || Number(withdrawAmount) <= 0 || Number(withdrawAmount) > (rewardStats?.availableRewardBalance || 0)) ? 'not-allowed' : 'pointer',
                    opacity: (withdrawLoading || !withdrawAmount || Number(withdrawAmount) <= 0 || Number(withdrawAmount) > (rewardStats?.availableRewardBalance || 0)) ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {withdrawLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowDownToLine size={16} />}
                  {withdrawLoading ? 'Processing...' : 'Request Cashout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Referrals Full-Screen Overlay - no routing needed */}
      {showReferrals && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--bg-dark)', zIndex: 200, overflowY: 'auto' }}>
          <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading referrals...</div>}>
            <ReferralsView setActiveTab={() => setShowReferrals(false)} />
          </Suspense>
        </div>
      )}

      {/* Reset Portfolio Modal with Custom Amount up to 10 Crore */}
      <ResetPortfolioModal 
        isOpen={showResetModal} 
        onClose={() => setShowResetModal(false)} 
      />

      </div>
    </div>
  );
}
