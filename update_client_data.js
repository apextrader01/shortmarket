const fs = require('fs');

const path = 'frontend/src/components/ClientDataView.jsx';
let content = fs.readFileSync(path, 'utf8');

// Update useStore hook
content = content.replace(
  'const { user, logout, updateProfilePicture, theme, toggleTheme, setTheme, resetAccount } = useStore(useShallow(state => ({ user: state.user, logout: state.logout, updateProfilePicture: state.updateProfilePicture, theme: state.theme, toggleTheme: state.toggleTheme, setTheme: state.setTheme, resetAccount: state.resetAccount })));',
  `const { user, logout, updateProfilePicture, theme, toggleTheme, setTheme, resetAccount, fontSize, setFontSize, accessibilityMode, setAccessibilityMode, oneClickMode, setOneClickMode } = useStore(useShallow(state => ({ 
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
  })));`
);

// Replace Quick Settings Section
const oldQuickSettingsStart = '        {/* Quick Settings */}';
const oldQuickSettingsEnd = '        {/* Account Settings */}';

const newQuickSettings = `        {/* Quick Settings */}
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

`;

const startIdx = content.indexOf(oldQuickSettingsStart);
const endIdx = content.indexOf(oldQuickSettingsEnd);
if (startIdx > -1 && endIdx > -1) {
  content = content.substring(0, startIdx) + newQuickSettings + content.substring(endIdx);
} else {
  console.error("Could not find Quick Settings section");
}

fs.writeFileSync(path, content);
console.log('ClientDataView updated');
