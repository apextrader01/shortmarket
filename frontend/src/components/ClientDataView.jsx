import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { LogOut, FileText, PieChart, BarChart2, PlusCircle, CreditCard, Gift, Users, Star, Settings, Keyboard, Info, HelpCircle, Upload, Loader2, X } from 'lucide-react';
import ReferralsView from './ReferralsView';
import SettingsView from './SettingsView';

function Card({ title, desc, icon: Icon, color, onClick, badge }) {
  return (
    <div className="glass-panel hoverable" onClick={onClick} style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px', cursor: onClick ? 'pointer' : 'default', transition: 'all 0.2s', minHeight: '110px' }}>
      {Icon && <div style={{ color: color || 'var(--color-blue)', background: 'var(--bg-hover)', padding: '8px', borderRadius: '8px', width: 'fit-content' }}><Icon size={18} /></div>}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '4px', color: 'var(--text-primary)' }}>{title}</div>
        {desc && <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4', flex: 1 }}>{desc}</div>}
        {badge && <div style={{ marginTop: '10px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)', width: 'fit-content', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '600' }}>{badge}</div>}
      </div>
    </div>
  );
}

export default function ClientDataView({ onDepositClick, setActiveTab }) {
  const { user, logout, updateProfilePicture, theme, toggleTheme, setTheme, resetAccount, fontSize, setFontSize, accessibilityMode, setAccessibilityMode, oneClickMode, setOneClickMode } = useStore(useShallow(state => ({ 
    user: state.user, 
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
  
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [showHotkeysModal, setShowHotkeysModal] = useState(false);
  const [showReferrals, setShowReferrals] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

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
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Image size must be less than 2MB');
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);
      
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64Image = event.target.result;
          await updateProfilePicture(base64Image);
          setIsUploading(false);
        } catch (err) {
          console.error(err);
          setUploadError('Failed to save profile picture');
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setUploadError('Failed to upload image');
      setIsUploading(false);
    }
  };

  if (showReferrals) {
    return <ReferralsView setActiveTab={() => setShowReferrals(false)} />;
  }

  if (showProfile) {
    return (
      <div style={{ padding: isMobile ? '12px 8px' : '24px' }}>
        <button onClick={() => setShowProfile(false)} className="btn" style={{ marginBottom: '16px', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
          &larr; Back to Account
        </button>
        <SettingsView />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '20px' : '32px', maxWidth: '1000px', margin: '0 auto', width: '100%', padding: isMobile ? '8px 4px 60px 4px' : '16px 16px 40px 16px' }}>
      
      {/* Profile Header */}
      <div className="glass-panel" style={{ padding: isMobile ? '16px' : '24px', display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '20px' }}>
          
          <div style={{ position: 'relative' }}>
            <div style={{
              width: isMobile ? '56px' : '68px',
              height: isMobile ? '56px' : '68px',
              borderRadius: '50%',
              background: 'var(--bg-hover)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--border-color)',
              overflow: 'hidden'
            }}>
              {isUploading ? (
                <Loader2 className="spinner" size={24} color="var(--color-blue)" />
              ) : user?.profile_picture_url ? (
                <img src={user.profile_picture_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {user?.username ? user.username.substring(0, 2).toUpperCase() : 'U'}
                </span>
              )}
            </div>
            
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              style={{
                position: 'absolute',
                bottom: '-2px',
                right: '-2px',
                background: 'var(--color-blue)',
                border: '2px solid var(--bg-dark)',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                cursor: 'pointer'
              }}
              title="Change Profile Picture"
            >
              <Upload size={12} />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              style={{ display: 'none' }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
                {user?.username || 'Client User'}
              </h2>
              {user?.subscription_tier === 'PRO' && (
                <span style={{ fontSize: '10px', background: 'var(--color-blue)', color: 'white', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>PRO</span>
              )}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {user?.client_id || user?.id || 'CLIENT_ID'}
            </div>
            {uploadError && (
              <div style={{ color: 'var(--color-red-light)', fontSize: '11px', marginTop: '4px' }}>
                {uploadError}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', width: isMobile ? '100%' : 'auto' }}>
          <button onClick={() => setShowProfile(true)} className="btn" style={{ flex: isMobile ? 1 : 'none', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
            Profile Settings
          </button>
          <button onClick={logout} className="btn" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--color-red-light)', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <LogOut size={14} /> Logout
          </button>
        </div>
      </div>

      {/* Balance Card */}
      <div className="glass-panel" style={{ padding: isMobile ? '16px' : '24px', display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>AVAILABLE TRADING BALANCE</div>
          <div style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: '800', color: 'var(--color-green-light)' }}>
            ₹{Number(user?.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', width: isMobile ? '100%' : 'auto' }}>
          <button onClick={onDepositClick} style={{ flex: 1, background: 'var(--color-blue)', color: '#FFF', border: 'none', padding: '10px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
            DEPOSIT
          </button>
          <button onClick={handleResetAccount} style={{ flex: 1, background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-red-light)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '10px 16px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
            RESET ACCOUNT
          </button>
        </div>
      </div>

      {/* Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '24px' : '36px' }}>
        
        {/* Reports */}
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '14px', color: 'var(--text-primary)' }}>Reports & Insights</h3>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
            <div onClick={() => setActiveTab('Reports')} className="glass-panel hoverable" style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', borderRadius: '8px' }}>
              <FileText size={16} color="var(--color-blue-light)" />
              <span style={{ fontSize: '12px', fontWeight: '600' }}>Ledger Passbook</span>
            </div>
            <div onClick={() => setActiveTab('Reports')} className="glass-panel hoverable" style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', borderRadius: '8px' }}>
              <FileText size={16} color="var(--color-blue-light)" />
              <span style={{ fontSize: '12px', fontWeight: '600' }}>Trades & Charges</span>
            </div>
            <div onClick={() => setActiveTab('Reports')} className="glass-panel hoverable" style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', borderRadius: '8px' }}>
              <PieChart size={16} color="var(--color-blue-light)" />
              <span style={{ fontSize: '12px', fontWeight: '600' }}>Profit & Loss</span>
            </div>
            <div onClick={() => setActiveTab('Reports')} className="glass-panel hoverable" style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', borderRadius: '8px' }}>
              <BarChart2 size={16} color="var(--color-blue-light)" />
              <span style={{ fontSize: '12px', fontWeight: '600' }}>Trading Insights</span>
            </div>
          </div>
        </div>

        {/* Subscription Plan & Referrals */}
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '14px', color: 'var(--text-primary)' }}>Plans & Earnings</h3>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
            <Card icon={Users} title="Refer & Earn" desc="Refer a friend & get 10% of their subscription fee directly" color="#34D399" onClick={() => setShowReferrals(true)} />
            <Card icon={Star} title="Subscription Plans" desc="Curated plans to save on charges and unlock PRO features" color="#FBBF24" onClick={() => setActiveTab('Pricing')} />
          </div>
        </div>

        {/* Quick Settings (Fully Optimized for Mobile) */}
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '14px', color: 'var(--text-primary)' }}>Quick Settings</h3>
          
          <div className="glass-panel" style={{ overflow: 'hidden', padding: 0, borderRadius: '12px' }}>
            
            {/* Font Size Row */}
            <div style={{ padding: '16px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: '12px', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '2px' }}>Font Size</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Customise readability across all pages</div>
              </div>
              <div style={{ display: 'flex', gap: '6px', width: isMobile ? '100%' : 'auto' }}>
                {['small', 'medium', 'large'].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setFontSize(size)}
                    style={{
                      flex: isMobile ? 1 : 'none',
                      fontSize: '11px',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      background: fontSize === size ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-hover)',
                      border: fontSize === size ? '1px solid var(--color-blue)' : '1px solid var(--border-color)',
                      borderRadius: '6px',
                      color: fontSize === size ? 'var(--color-blue-light)' : 'var(--text-secondary)',
                      fontWeight: fontSize === size ? '700' : '500',
                      textTransform: 'capitalize'
                    }}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Appearance Theme Row */}
            <div style={{ padding: '16px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: '12px', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '2px' }}>Appearance Preference</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Choose your preferred color theme</div>
              </div>
              <div style={{ display: 'flex', gap: '6px', width: isMobile ? '100%' : 'auto' }}>
                {['light', 'dark', 'system'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTheme(t)}
                    style={{
                      flex: isMobile ? 1 : 'none',
                      fontSize: '11px',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      background: theme === t ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-hover)',
                      border: theme === t ? '1px solid var(--color-blue)' : '1px solid var(--border-color)',
                      borderRadius: '6px',
                      color: theme === t ? 'var(--color-blue-light)' : 'var(--text-secondary)',
                      fontWeight: theme === t ? '700' : '500',
                      textTransform: 'capitalize'
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Accessibility Mode Toggle */}
            <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '2px' }}>Enable Accessibility Mode</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Disables high-speed keyboard shortcuts</div>
              </div>
              <div onClick={() => setAccessibilityMode(!accessibilityMode)} style={{ width: '42px', height: '24px', background: accessibilityMode ? 'var(--color-blue)' : 'rgba(255,255,255,0.1)', borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
                <div style={{ width: '18px', height: '18px', background: '#FFF', borderRadius: '50%', position: 'absolute', top: '3px', left: accessibilityMode ? '21px' : '3px', transition: 'left 0.2s' }} />
              </div>
            </div>

            {/* Re-Confirm Order Toggle */}
            <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '2px' }}>Re-Confirm Order</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Show confirmation preview before placing trade</div>
              </div>
              <div onClick={() => setOneClickMode(!oneClickMode)} style={{ width: '42px', height: '24px', background: !oneClickMode ? 'var(--color-blue)' : 'rgba(255,255,255,0.1)', borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
                <div style={{ width: '18px', height: '18px', background: '#FFF', borderRadius: '50%', position: 'absolute', top: '3px', left: !oneClickMode ? '21px' : '3px', transition: 'left 0.2s' }} />
              </div>
            </div>

          </div>
        </div>

        {/* Account Info & Shortcuts */}
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '14px', color: 'var(--text-primary)' }}>Account Info & Tools</h3>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' }}>
            <div className="glass-panel hoverable" onClick={() => setActiveTab('Pricing')} style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', borderRadius: '8px' }}>
              <div style={{ background: 'var(--bg-hover)', padding: '8px', borderRadius: '6px' }}><Star size={16} color="var(--color-blue)" /></div>
              <span style={{ fontSize: '13px', fontWeight: '600' }}>Subscription Plans</span>
            </div>
            <div className="glass-panel hoverable" onClick={() => setShowHotkeysModal(true)} style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', borderRadius: '8px' }}>
              <div style={{ background: 'var(--bg-hover)', padding: '8px', borderRadius: '6px' }}><Keyboard size={16} color="var(--color-blue)" /></div>
              <span style={{ fontSize: '13px', fontWeight: '600' }}>Keyboard & Shortcuts</span>
            </div>
            <div className="glass-panel hoverable" onClick={() => setActiveTab('AboutUs')} style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', borderRadius: '8px' }}>
              <div style={{ background: 'var(--bg-hover)', padding: '8px', borderRadius: '6px' }}><Info size={16} color="var(--color-blue)" /></div>
              <span style={{ fontSize: '13px', fontWeight: '600' }}>About Us</span>
            </div>
          </div>
        </div>

      </div>

      {/* Hotkeys Modal */}
      {showHotkeysModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '20px', position: 'relative', borderRadius: '12px' }}>
            <button 
              onClick={() => setShowHotkeysModal(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '20px' }}
            >&times;</button>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-blue-light)' }}>
              <Keyboard size={18} /> Global Hotkeys
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.4' }}>
              Execute market orders instantly via keyboard shortcuts for the currently selected symbol.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-hover)', borderRadius: '6px' }}>
                <span>Buy Market Order</span>
                <kbd style={{ background: 'var(--bg-dark)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', fontWeight: '700' }}>Shift + B</kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-hover)', borderRadius: '6px' }}>
                <span>Sell Market Order</span>
                <kbd style={{ background: 'var(--bg-dark)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', fontWeight: '700' }}>Shift + S</kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-hover)', borderRadius: '6px' }}>
                <span>Square Off Position</span>
                <kbd style={{ background: 'var(--bg-dark)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', fontWeight: '700' }}>Shift + X</kbd>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
