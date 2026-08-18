import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { LogOut, FileText, PieChart, BarChart2, PlusCircle, CreditCard, Gift, Users, Star, Settings, Keyboard, Info, HelpCircle, Upload, Loader2 } from 'lucide-react';
// import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';



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
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [showHotkeysModal, setShowHotkeysModal] = useState(false);

  const handleResetAccount = async () => {
    if (window.confirm('Are you absolutely sure you want to reset your account? This will permanently delete all your trades, positions, and reset your balance to ₹10,00,000. This cannot be undone.')) {
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

  // Removed LedgerSection to outside



  const Card = ({ title, desc, icon: Icon, color }) => (
    <div className="glass-panel hoverable" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', cursor: 'pointer', transition: 'all 0.2s', minHeight: '120px' }}>
      {Icon && <div style={{ color: color || 'var(--color-blue)', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', width: 'fit-content' }}><Icon size={20} /></div>}
      <div>
        <div style={{ fontSize: '15px', fontWeight: '700', marginBottom: '8px', color: '#E2E8F0' }}>{title}</div>
        {desc && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{desc}</div>}
      </div>
    </div>
  );

  return (
    <div style={{ flex: 1, padding: '32px', overflowY: 'auto', background: 'var(--bg-dark)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '700' }}>My Account</h2>
        <div onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-red)', cursor: 'pointer', fontSize: '12px', fontWeight: '700', padding: '8px 16px', border: '1px solid rgba(225,42,31,0.2)', borderRadius: '20px', background: 'rgba(225,42,31,0.05)' }}>
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
              <Loader2 size={24} className="animate-spin" color="#FFF" />
            ) : !user?.profile_picture_url ? (
              user?.username ? String(user.username).split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'HV'
            ) : null}
            
            {!isUploading && (
              <div style={{ position: 'absolute', bottom: 0, width: '100%', height: '30%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Upload size={12} color="#FFF" />
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
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#FFF', marginBottom: '4px' }}>
              {user?.username || 'Hari Krishnan I Vijayan'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
              Client ID: {user?.id}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--color-green-light)', fontWeight: '600', marginBottom: '4px' }}>
              Available Margin: ₹{Number(user?.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-blue-light)', fontWeight: '600', cursor: 'pointer' }}>VIEW PROFILE</div>
            {uploadError && <div style={{ fontSize: '10px', color: 'var(--color-red)' }}>{uploadError}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '12px' }}>
          <Star size={14} /> Member since {user?.created_at ? new Date(user.created_at).getFullYear() : '2024'}
        </div>
      </div>

      {/* Add Funds Banner */}
      {/* Add Funds Banner */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '16px', marginBottom: '40px', borderLeft: '4px solid var(--color-blue)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
            ₹
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Get ready to invest</div>
            <div style={{ fontSize: '15px', fontWeight: '700', lineHeight: '1.4' }}>Add funds to start your trading journey with Short Market</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: '300px' }}>
          <button onClick={onDepositClick} style={{ flex: 1, background: 'var(--color-blue)', color: '#FFF', border: 'none', padding: '12px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
            DEPOSIT
          </button>
          <button onClick={handleResetAccount} style={{ flex: 1, background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-red-light)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '12px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
            RESET ACCOUNT
          </button>
        </div>
      </div>


      {/* Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
        
        {/* Reports */}
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px', color: '#E2E8F0' }}>Reports</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div onClick={() => setActiveTab('Reports')} className="glass-panel hoverable" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <FileText size={18} color="var(--color-blue-light)" />
                <span style={{ fontSize: '14px', fontWeight: '600' }}>Funds / Ledger Passbook</span>
              </div>
              <div onClick={() => setActiveTab('Reports')} className="glass-panel hoverable" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <FileText size={18} color="var(--color-blue-light)" />
                <span style={{ fontSize: '14px', fontWeight: '600' }}>Trades & Charges</span>
              </div>
              <div onClick={() => setActiveTab('Reports')} className="glass-panel hoverable" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <FileText size={18} color="var(--color-blue-light)" />
                <span style={{ fontSize: '14px', fontWeight: '600' }}>Statements</span>
              </div>
              <div onClick={() => setActiveTab('Reports')} className="glass-panel hoverable" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <PieChart size={18} color="var(--color-blue-light)" />
                <span style={{ fontSize: '14px', fontWeight: '600' }}>Profit & Loss</span>
              </div>
              <div onClick={() => setActiveTab('Reports')} className="glass-panel hoverable" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <BarChart2 size={18} color="var(--color-blue-light)" />
                <span style={{ fontSize: '14px', fontWeight: '600' }}>Trading Insights</span>
              </div>
            </div>
          </div>

        {/* Coming Features */}
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px', color: '#E2E8F0' }}>Coming Features</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <Card title="MTF" desc="Buy upto 4 times quantity of equity stocks with just 0.041% interest per day" color="#A855F7" />
            <div onClick={() => setActiveTab('Options')} style={{ textDecoration: 'none', color: 'inherit' }}>
              <Card title="Option Chain" desc="Advanced options trading with strategy builder" color="#3B82F6" />
            </div>
          </div>
        </div>

        {/* Subscription Plan */}
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px', color: '#E2E8F0' }}>Subscription Plan</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <Card icon={Users} title="Refer & Earn" desc="Refer a friend to join Short Market & get rewarded ₹500" color="#34D399" />
            <div onClick={() => setActiveTab('Pricing')} style={{ textDecoration: 'none', color: 'inherit' }}>
              <Card icon={Star} title="Subscription Plans" desc="Curated plans to help you save on trading charges" color="#FBBF24" />
            </div>
          </div>
        </div>

        {/* Quick Settings */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#E2E8F0' }}>Quick Settings</h3>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '4px' }}>Font Size</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Customise your font size as per readability</div>
              </div>
              <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '4px' }}>
                <span onClick={() => setFontSize('small')} style={{ fontSize: '12px', padding: '6px 12px', cursor: 'pointer', background: fontSize === 'small' ? 'rgba(255,255,255,0.1)' : 'transparent', borderRadius: '4px', color: fontSize === 'small' ? '#FFF' : 'inherit' }}>Small</span>
                <span onClick={() => setFontSize('medium')} style={{ fontSize: '12px', padding: '6px 12px', cursor: 'pointer', background: fontSize === 'medium' ? 'rgba(255,255,255,0.1)' : 'transparent', borderRadius: '4px', color: fontSize === 'medium' ? '#FFF' : 'inherit' }}>Medium</span>
                <span onClick={() => setFontSize('large')} style={{ fontSize: '12px', padding: '6px 12px', cursor: 'pointer', background: fontSize === 'large' ? 'rgba(255,255,255,0.1)' : 'transparent', borderRadius: '4px', color: fontSize === 'large' ? '#FFF' : 'inherit' }}>Large</span>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '4px' }}>Enable Accessibility Mode</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Turning this on will disable all shortcuts</div>
              </div>
              <div onClick={() => setAccessibilityMode(!accessibilityMode)} style={{ width: '36px', height: '20px', background: accessibilityMode ? 'var(--color-blue)' : 'rgba(255,255,255,0.1)', borderRadius: '10px', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
                <div style={{ width: '16px', height: '16px', background: accessibilityMode ? '#FFF' : 'var(--text-secondary)', borderRadius: '50%', position: 'absolute', top: '2px', left: accessibilityMode ? '18px' : '2px', transition: 'left 0.2s' }} />
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '4px' }}>Appearance Preference</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Choose your theme to look the best for your eyes</div>
              </div>
              <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '4px' }}>
                <span 
                  onClick={() => setTheme('light')} 
                  style={{ fontSize: '12px', padding: '6px 12px', cursor: 'pointer', background: theme === 'light' ? 'rgba(255,255,255,0.1)' : 'transparent', borderRadius: '4px', color: theme === 'light' ? '#000' : 'var(--text-secondary)' }}
                >
                  Light
                </span>
                <span 
                  onClick={() => setTheme('dark')} 
                  style={{ fontSize: '12px', padding: '6px 12px', cursor: 'pointer', background: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'transparent', borderRadius: '4px', color: theme === 'dark' ? '#FFF' : 'var(--text-secondary)' }}
                >
                  Dark
                </span>
                <span 
                  onClick={() => setTheme('system')} 
                  style={{ fontSize: '12px', padding: '6px 12px', cursor: 'pointer', background: theme === 'system' ? 'rgba(255,255,255,0.1)' : 'transparent', borderRadius: '4px', color: theme === 'system' ? '#FFF' : 'var(--text-secondary)' }}
                >
                  System
                </span>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '4px' }}>Re-Confirm Order</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Turn this on if you want an order preview every time you place an order</div>
              </div>
              <div onClick={() => setOneClickMode(!!oneClickMode)} style={{ width: '36px', height: '20px', background: !oneClickMode ? 'var(--color-blue)' : 'rgba(255,255,255,0.1)', borderRadius: '10px', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
                <div style={{ width: '16px', height: '16px', background: !oneClickMode ? '#FFF' : 'var(--text-secondary)', borderRadius: '50%', position: 'absolute', top: '2px', left: !oneClickMode ? '18px' : '2px', transition: 'left 0.2s' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Account Settings */}
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px', color: '#E2E8F0' }}>Account Settings & Other Info</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div className="glass-panel hoverable" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '4px' }}><Star size={16} color="var(--color-blue)" /></div>
              <span style={{ fontSize: '14px', fontWeight: '600' }}>Subscription Plans</span>
            </div>
            <div 
              className="glass-panel hoverable" 
              onClick={() => setShowHotkeysModal(true)}
              style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
            >
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '4px' }}><Keyboard size={16} color="var(--color-blue)" /></div>
              <span style={{ fontSize: '14px', fontWeight: '600' }}>Keyboard & Shortcut</span>
            </div>
            <div className="glass-panel hoverable" onClick={() => setActiveTab('AboutUs')} style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '4px' }}><Info size={16} color="var(--color-blue)" /></div>
              <span style={{ fontSize: '14px', fontWeight: '600' }}>About Us</span>
            </div>
          </div>
        </div>

        {/* OneHelp */}
        <div className="glass-panel hoverable" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', cursor: 'pointer' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              OneHelp
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Your all-in-one place for help and support</div>
          </div>
          <button style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#FFF', padding: '10px 20px', borderRadius: '4px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
            KNOW MORE
          </button>
        </div>
      </div>
      
      {/* Floating Ask Angel / Support Button */}
      <div className="support-fab" style={{ position: 'fixed', bottom: '30px', right: '30px', display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--color-blue)', color: '#FFF', padding: '12px 20px', borderRadius: '30px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.4)', zIndex: 100 }}>
        <HelpCircle size={18} />
        <span style={{ fontSize: '14px', fontWeight: '700' }}>Ask Support</span>
      </div>
      
      {/* Hotkeys Modal */}
      {showHotkeysModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="glass-panel" style={{ width: '400px', padding: '24px', position: 'relative' }}>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: '500' }}>Instant Buy (Market)</span>
                <span style={{ fontSize: '13px', background: 'var(--color-blue)', color: '#FFF', padding: '4px 8px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 'bold' }}>Shift + B</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: '500' }}>Instant Sell (Market)</span>
                <span style={{ fontSize: '13px', background: 'var(--color-red)', color: '#FFF', padding: '4px 8px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 'bold' }}>Shift + S</span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

