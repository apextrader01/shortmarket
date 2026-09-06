import { subscribeUserToPush, unsubscribeUserFromPush, triggerTestPushNotification, getPushSubscriptionStatus } from '../services/pushManager';
import { Bell, CheckCircle, ShieldAlert, Tag } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import { useStore, API } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { LogOut, FileText, PieChart, BarChart2, PlusCircle, CreditCard, Gift, Users, Star, Settings, Keyboard, Info, HelpCircle, Upload, Loader2, X, Fingerprint, Shield, KeyRound } from 'lucide-react';
import ReferralsView from './ReferralsView';
import SettingsView, { BiometricSettingsSection } from './SettingsView';
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





export default function ClientDataView({ onDepositClick, setActiveTab }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const { user, orders, logout, updateProfilePicture, theme, toggleTheme, setTheme, resetAccount, fontSize, setFontSize, accessibilityMode, setAccessibilityMode, oneClickMode, setOneClickMode } = useStore(useShallow(state => ({ 
    user: state.user,
    orders: state.orders, 
    logout: state.logout, 
    updateProfilePicture: state.updateProfilePicture, 
    theme: state.theme, 
    toggleTheme: state.toggleTheme, 
    setTheme: state.setTheme, 
    resetAccount: state.resetAccount,
    fontSize: state.fontSize,
    setFontSize: state.setFontSize,
    accessibilityMode: state.accessibilityMode,
    setAccessibilityMode: state.setAccessibilityMode,
    oneClickMode: state.oneClickMode,
    setOneClickMode: state.setOneClickMode
  })));
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [showHotkeysModal, setShowHotkeysModal] = useState(false);
  const [showReferrals, setShowReferrals] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
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
  let todayRealizedLoss = 0;
  todayCompletedOrders.forEach(o => {
    if (o.realized_pnl && parseFloat(o.realized_pnl) < 0) {
      todayRealizedLoss += Math.abs(parseFloat(o.realized_pnl));
    }
  });
  const isTradesLocked = isRiskActive && maxTrades && todayTradesCount >= Number(maxTrades);
  const isLossLocked = isRiskActive && maxLoss && todayRealizedLoss >= Number(maxLoss);
  const isLockedTonight = isTradesLocked || isLossLocked;

  const handleSaveRiskGuardian = async (activeOverride, tradesOverride, lossOverride) => {
    try {
      const activeVal = activeOverride !== undefined ? activeOverride : isRiskActive;
      const tradesVal = tradesOverride !== undefined ? tradesOverride : maxTrades;
      const lossVal = lossOverride !== undefined ? lossOverride : maxLoss;
      
      setRiskMsg('Saving rules...');
      const res = await fetch(`${API}/api/user/risk-guardian`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const [pushStatusMsg, setPushStatusMsg] = useState('');
  
  useEffect(() => {
    getPushSubscriptionStatus().then(setIsPushEnabled);
  }, []);

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
        setPushStatusMsg('Requesting browser permission...');
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

    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Image is too large. Please select a file smaller than 2MB.');
      if (e.target) e.target.value = '';
      return;
    }

    setIsUploading(true);
    setUploadError(null);

      try {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64String = reader.result;
          const res = await updateProfilePicture(base64String);
          
          if (!res.success) {
            setUploadError('Failed to save profile picture: ' + (res.error || 'Unknown error'));
          }
          
          setIsUploading(false);
          if (e.target) e.target.value = '';
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
      <div style={{ padding: isMobile ? '16px 12px' : '24px 28px', animation: 'fadeIn 0.3s ease-out', width: '100%', boxSizing: 'border-box' }}>
        <button 
          className="btn btn-secondary" 
          onClick={() => setShowProfile(false)} 
          style={{ marginBottom: '24px', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '14px', borderRadius: '8px', cursor: 'pointer', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
        >
          &larr; Back to Dashboard
        </button>
        <SettingsView />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, padding: isMobile ? '16px 12px 70px 12px' : '24px 28px 60px 28px', overflowY: 'auto', background: 'var(--bg-dark)', width: '100%', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '700' }}>My Account</h2>
        <div onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-red)', cursor: 'pointer', fontSize: '11px', fontWeight: '700', padding: '8px 16px', border: '1px solid rgba(225,42,31,0.2)', borderRadius: '20px', background: 'rgba(225,42,31,0.05)' }}>
          <LogOut size={14} /> LOGOUT
        </div>
      </div>

      {/* Profile Section */}
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          
          <div 
            onClick={() => !isUploading && fileInputRef.current?.click()}
            style={{ 
              width: '48px', height: '48px', borderRadius: '50%', 
              background: user?.profile_picture_url ? `url(${user.profile_picture_url}) center/cover` : 'linear-gradient(135deg, var(--color-navy-light), var(--color-blue))', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              fontSize: '18px', fontWeight: '700', cursor: 'pointer',
              position: 'relative', overflow: 'hidden'
            }}
            title="Upload Profile Picture"
          >
            {isUploading ? (
              <Loader2 size={24} className="animate-spin" color="var(--text-primary)" />
            ) : !user?.profile_picture_url ? (
              user?.username ? String(user.username).split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'HV'
            ) : null}
            
            {!isUploading && (
              <div style={{ position: 'absolute', bottom: 0, width: '100%', height: '30%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Upload size={12} color="var(--text-primary)" />
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

          <div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '2px' }}>
              {user?.username || 'Hari Krishnan I Vijayan'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
              Client ID: {user?.client_id || user?.id}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--color-green-light)', fontWeight: '600', marginBottom: '2px' }}>
              Available Margin: &#8377;{Number(user?.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div onClick={() => setShowProfile(true)} style={{ fontSize: '11px', color: 'var(--color-blue-light)', fontWeight: '600', cursor: 'pointer' }}>VIEW PROFILE &rarr;</div>
            {uploadError && <div style={{ fontSize: '10px', color: 'var(--color-red)' }}>{uploadError}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '11px' }}>
          <Star size={14} /> Member since {user?.created_at ? new Date(user.created_at).getFullYear() : '2024'}
        </div>
      </div>

      {/* Add Funds Banner */}
      <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: '16px', marginBottom: '36px', borderLeft: '4px solid var(--color-blue)', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '800', color: 'var(--color-blue-light)', flexShrink: 0 }}>
            ₹
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Get ready to invest</div>
            <div style={{ fontSize: '15px', fontWeight: '700', lineHeight: '1.4' }}>Add funds to start your trading journey with Short Edge</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', width: isMobile ? '100%' : 'auto', minWidth: isMobile ? 'auto' : '280px' }}>
          <button onClick={onDepositClick} style={{ flex: 1, background: 'var(--color-blue)', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', transition: 'opacity 0.15s' }}>
            DEPOSIT
          </button>
          <button onClick={handleResetAccount} style={{ flex: 1, background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-red-light)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '12px 20px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', transition: 'background 0.15s' }}>
            RESET ACCOUNT
          </button>
        </div>
      </div>


      {/* Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
        
        {/* Reports */}
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px', color: 'var(--text-primary)' }}>Reports</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div onClick={() => setActiveTab('Reports')} className="glass-panel hoverable" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <FileText size={18} color="var(--color-blue-light)" />
                <span style={{ fontSize: '13px', fontWeight: '600' }}>Funds / Ledger Passbook</span>
              </div>
              <div onClick={() => setActiveTab('Reports')} className="glass-panel hoverable" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <FileText size={18} color="var(--color-blue-light)" />
                <span style={{ fontSize: '13px', fontWeight: '600' }}>Trades & Charges</span>
              </div>
              <div onClick={() => setActiveTab('Reports')} className="glass-panel hoverable" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <FileText size={18} color="var(--color-blue-light)" />
                <span style={{ fontSize: '13px', fontWeight: '600' }}>Statements</span>
              </div>
              <div onClick={() => setActiveTab('Reports')} className="glass-panel hoverable" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <PieChart size={18} color="var(--color-blue-light)" />
                <span style={{ fontSize: '13px', fontWeight: '600' }}>Profit & Loss</span>
              </div>
              <div onClick={() => setActiveTab('Reports')} className="glass-panel hoverable" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <BarChart2 size={18} color="var(--color-blue-light)" />
                <span style={{ fontSize: '13px', fontWeight: '600' }}>Trading Insights</span>
              </div>
            </div>
          </div>

        {/* Coming Features */}
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px', color: 'var(--text-primary)' }}>Coming Features</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: '16px' }}>
            <Card title="MTF" desc="Buy upto 4 times quantity of equity stocks with just 0.045% interest per day" color="#A855F7" badge="Coming Soon" />
            <Card title="Option Chain" desc="Advanced options trading with strategy builder" color="#3B82F6" onClick={() => setActiveTab('Options')} badge="Coming Soon" />
          </div>
        </div>

        {/* Subscription Plan */}
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px', color: 'var(--text-primary)' }}>Subscription Plan</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: '16px' }}>
            <Card icon={Users} title="Refer & Earn" desc="Refer a friend & get 10% of their subscription" color="#34D399" onClick={() => setShowReferrals(true)} />
            <Card icon={Star} title="Subscription Plans" desc="Curated plans to help you save on trading charges" color="#FBBF24" onClick={() => setActiveTab('Pricing')} />
          </div>
        </div>

        {/* Quick Settings */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>Quick Settings</h3>
          </div>
          
          <div className="glass-panel" style={{ overflow: 'hidden', padding: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 600px), 1fr))', gap: '1px', background: 'var(--border-color)' }}>
              
              {/* Push & Trade Alerts (PWA) */}
              <div style={{ padding: isMobile ? '16px 12px' : '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: 'var(--bg-panel)' }}>
                <div style={{ minWidth: '200px', flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Bell size={15} color={isPushEnabled ? 'var(--color-blue-light)' : 'var(--text-secondary)'} /> Push & Trade Alerts (PWA)
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
                              style={{ width: '65px', background: 'var(--bg-hover)', border: '1px solid #f59e0b', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', outline: 'none' }}
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
                              style={{ width: '85px', background: 'var(--bg-hover)', border: '1px solid #ef4444', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', outline: 'none' }}
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
                  { id: 'oled', label: '🖤 OLED Black', bg: '#000000', border: '#333' },
                  { id: 'midnight', label: '🌌 Midnight', bg: '#070c18', border: '#1e3a8a' },
                  { id: 'charcoal', label: '🪙 Charcoal', bg: '#121214', border: '#2a2a30' },
                  { id: 'dark', label: '🚀 Deep Space', bg: '#0B1121', border: '#1e293b' },
                  { id: 'light', label: '☀️ Light', bg: '#FFFFFF', border: '#cbd5e1' }
                ].map(t => {
                  const isSel = theme === t.id;
                  return (
                    <span
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      style={{
                        fontSize: '11.5px',
                        padding: '6px 12px',
                        cursor: 'pointer',
                        background: isSel ? 'rgba(59, 130, 246, 0.2)' : t.bg,
                        border: isSel ? '1px solid var(--color-blue)' : `1px solid ${t.border}`,
                        borderRadius: '6px',
                        color: isSel ? 'var(--color-blue-light)' : (t.id === 'light' && theme !== 'light' ? '#0f172a' : 'var(--text-primary)'),
                        fontWeight: isSel ? '700' : '500',
                        boxShadow: isSel ? '0 0 10px rgba(59, 130, 246, 0.3)' : 'none',
                        transition: 'all 0.15s'
                      }}
                    >
                      {t.label}
                    </span>
                  );
                })}
              </div>
            </div>

            <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ minWidth: '200px', flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '2px' }}>Re-Confirm Order</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Turn this on if you want an order preview every time you place an order</div>
              </div>
              <div onClick={() => setOneClickMode(!!oneClickMode)} style={{ width: '36px', height: '20px', background: !oneClickMode ? 'var(--color-blue)' : 'var(--border-color)', borderRadius: '10px', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
                <div style={{ width: '16px', height: '16px', background: !oneClickMode ? '#FFF' : 'var(--text-secondary)', borderRadius: '50%', position: 'absolute', top: '2px', left: !oneClickMode ? '18px' : '2px', transition: 'left 0.2s' }} />
              </div>
            </div>

            {/* 🔐 Biometric & 4-Digit PIN Security */}
            <div style={{ padding: isMobile ? '16px 12px' : '20px', display: 'flex', flexDirection: 'column', gap: '14px', background: 'var(--bg-panel)' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Fingerprint size={16} color="var(--color-blue-light)" /> Quick App Unlock (4-Digit PIN & Biometrics)
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Set a 4-digit PIN or enable Face ID / Fingerprint to quickly unlock Short Edge on mobile and desktop without typing your full password.
                </div>
              </div>
              <BiometricSettingsSection user={user} />
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
          </div>
        </div>

        {/* OneHelp */}
        <div className="glass-panel hoverable" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', cursor: 'pointer' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              OneHelp
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Your all-in-one place for help and support</div>
          </div>
          <button style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px 20px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
            KNOW MORE
          </button>
        </div>
      </div>
      
      {/* Floating Ask Angel / Support Button */}
      <div className="support-fab" style={{ position: 'fixed', bottom: isMobile ? '70px' : '30px', right: isMobile ? '16px' : '30px', display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--color-blue)', color: 'var(--text-primary)', padding: '12px 20px', borderRadius: '30px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.4)', zIndex: 100 }}>
        <HelpCircle size={18} />
        <span style={{ fontSize: '13px', fontWeight: '700' }}>Ask Support</span>
      </div>
      
      {/* Hotkeys Modal */}
      {showHotkeysModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
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

      {/* Referrals Full-Screen Overlay - no routing needed */}
      {showReferrals && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--bg-dark)', zIndex: 200, overflowY: 'auto' }}>
          <ReferralsView setActiveTab={() => setShowReferrals(false)} />
        </div>
      )}

    </div>
  );
}
