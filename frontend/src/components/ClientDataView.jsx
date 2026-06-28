import React from 'react';
import { useStore } from '../store';
import { LogOut, FileText, PieChart, BarChart2, PlusCircle, CreditCard, Gift, Users, Star, Settings, Keyboard, Info, HelpCircle } from 'lucide-react';

export default function ClientDataView() {
  const { user, logout } = useStore();

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
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-navy-light), var(--color-blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '700' }}>
            {user?.username ? user.username.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'HV'}
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#FFF', marginBottom: '4px' }}>Hari Krishnan I Vijayan</div>
            <div style={{ fontSize: '12px', color: 'var(--color-blue-light)', fontWeight: '600', cursor: 'pointer' }}>VIEW PROFILE</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '12px' }}>
          <Star size={14} /> Member since 2021
        </div>
      </div>

      {/* Add Funds Banner */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', borderLeft: '4px solid var(--color-blue)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
            ₹
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Get ready to invest</div>
            <div style={{ fontSize: '16px', fontWeight: '700' }}>Add funds to start your trading journey with Short Market</div>
          </div>
        </div>
        <button style={{ background: 'var(--color-blue)', color: '#FFF', border: 'none', padding: '12px 24px', borderRadius: '4px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
          ADD FUNDS TO START TRADING
        </button>
      </div>

      {/* Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
        
        {/* Reports */}
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px', color: '#E2E8F0' }}>Reports</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div className="glass-panel hoverable" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <FileText size={18} color="var(--color-blue-light)" />
              <span style={{ fontSize: '14px', fontWeight: '600' }}>Trades & Charges</span>
            </div>
            <div className="glass-panel hoverable" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <FileText size={18} color="var(--color-blue-light)" />
              <span style={{ fontSize: '14px', fontWeight: '600' }}>Statements</span>
            </div>
            <div className="glass-panel hoverable" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <PieChart size={18} color="var(--color-blue-light)" />
              <span style={{ fontSize: '14px', fontWeight: '600' }}>Profit & Loss</span>
            </div>
            <div className="glass-panel hoverable" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <BarChart2 size={18} color="var(--color-blue-light)" />
              <span style={{ fontSize: '14px', fontWeight: '600' }}>Trading Insights</span>
            </div>
          </div>
        </div>

        {/* Pledging & Pay Later */}
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px', color: '#E2E8F0' }}>Pledging & Pay Later</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <Card title="Pledge Holdings for Extra Margin" desc="Increase your trading balance" color="#EAB308" />
            <Card title="MTF" desc="Buy upto 4 times quantity of equity stocks with just 0.041% interest per day" color="#A855F7" />
            <div className="glass-panel hoverable" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', cursor: 'pointer', background: 'rgba(34,197,94,0.05)', borderColor: 'rgba(34,197,94,0.2)' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '700', marginBottom: '8px', color: '#22C55E' }}>Transfer Stocks</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>Transferring stocks to any Demat account quickly and securely</div>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Incentives */}
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px', color: '#E2E8F0' }}>Financial Incentives</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <Card icon={Gift} title="Offers & Rewards" desc="Save more with special offers for you" color="#60A5FA" />
            <Card icon={Users} title="Refer & Earn" desc="Refer a friend to join Short Market & get rewarded ₹500" color="#34D399" />
            <Card icon={Star} title="Subscription Plans" desc="Curated plans to help you save on trading charges" color="#FBBF24" />
          </div>
        </div>

        {/* Quick Settings */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#E2E8F0' }}>Quick Settings</h3>
            <span style={{ fontSize: '12px', color: 'var(--color-blue-light)', fontWeight: '600', cursor: 'pointer' }}>VIEW ALL &gt;</span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '4px' }}>Font Size</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Customise your font size as per readability</div>
              </div>
              <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '4px' }}>
                <span style={{ fontSize: '12px', padding: '6px 12px', cursor: 'pointer' }}>Small</span>
                <span style={{ fontSize: '12px', padding: '6px 12px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', color: '#FFF' }}>Medium</span>
                <span style={{ fontSize: '12px', padding: '6px 12px', cursor: 'pointer' }}>Large</span>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '4px' }}>Enable Accessibility Mode</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Turning this on will disable all shortcuts</div>
              </div>
              <div style={{ width: '36px', height: '20px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', position: 'relative', cursor: 'pointer' }}>
                <div style={{ width: '16px', height: '16px', background: 'var(--text-secondary)', borderRadius: '50%', position: 'absolute', top: '2px', left: '2px' }} />
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '4px' }}>Appearance Preference</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Choose your theme to look the best for your eyes</div>
              </div>
              <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '4px' }}>
                <span style={{ fontSize: '12px', padding: '6px 12px', cursor: 'pointer' }}>Light</span>
                <span style={{ fontSize: '12px', padding: '6px 12px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', color: '#FFF' }}>Dark</span>
                <span style={{ fontSize: '12px', padding: '6px 12px', cursor: 'pointer' }}>System</span>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '4px' }}>Re-Confirm Order</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Turn this on if you want an order preview every time you place an order</div>
              </div>
              <div style={{ width: '36px', height: '20px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', position: 'relative', cursor: 'pointer' }}>
                <div style={{ width: '16px', height: '16px', background: 'var(--text-secondary)', borderRadius: '50%', position: 'absolute', top: '2px', left: '2px' }} />
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
            <div className="glass-panel hoverable" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '4px' }}><Keyboard size={16} color="var(--color-blue)" /></div>
              <span style={{ fontSize: '14px', fontWeight: '600' }}>Keyboard & Shortcut</span>
            </div>
            <div className="glass-panel hoverable" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
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
      <div style={{ position: 'fixed', bottom: '30px', right: '30px', display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--color-blue)', color: '#FFF', padding: '12px 20px', borderRadius: '30px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.4)' }}>
        <HelpCircle size={18} />
        <span style={{ fontSize: '14px', fontWeight: '700' }}>Ask Support</span>
      </div>
      
    </div>
  );
}
