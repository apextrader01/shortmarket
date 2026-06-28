import React, { useEffect, useState } from 'react';
import MarketWatch from './components/MarketWatch';
import ChartWidget from './components/ChartWidget';
import PositionsView from './components/PositionsView';
import OrdersView from './components/OrdersView';
import PortfolioView from './components/PortfolioView';
import OptionChainView from './components/OptionChainView';
import MutualFundsView from './components/MutualFundsView';
import ClientDataView from './components/ClientDataView';
import AdminDashboard from './components/AdminDashboard';
import SettingsView from './components/SettingsView';
import OrderModal from './components/OrderModal';
import DepositModal from './components/DepositModal';
import LoginView from './components/LoginView';
import { useStore } from './store';
import { Wallet, TrendingUp, TrendingDown, LogOut, Settings, Sun, Moon, User, LineChart, Briefcase, List, CircleDollarSign } from 'lucide-react';

const TOP_INDICES = ['NIFTY-NSE', 'BANKNIFTY-NSE', 'SENSEX-BSE'];

function App() {
  const {
    user, token, logout,
    initSocket, fetchUserData, loadStocks, refreshPrices, fetchBatchPrices,
    selectedSymbol, prices, toggleTheme, theme
  } = useStore();

  const [activeTab, setActiveTab] = useState('Markets');
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);

  // ── ALL hooks must be declared before any conditional return ─────────────────

  // Pre-fetch top index prices (runs on mount regardless of auth state)
  useEffect(() => {
    fetchBatchPrices(TOP_INDICES);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialise socket, load stocks, and start polling (re-runs when token changes)
  useEffect(() => {
    initSocket();
    if (token) fetchUserData();

    let stockRetry = null;
    const tryLoadStocks = async () => {
      await loadStocks();
      if (useStore.getState().stocks.length === 0) {
        stockRetry = setTimeout(tryLoadStocks, 3000);
      } else {
        refreshPrices();
      }
    };
    tryLoadStocks();

    const interval = setInterval(() => {
      if (token) fetchUserData();
      refreshPrices();
    }, 10000);

    return () => {
      clearInterval(interval);
      if (stockRetry) clearTimeout(stockRetry);
    };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Guard: show login screen when not authenticated ──────────────────────────
  if (!user || !token) {
    return <LoginView />;
  }

  // ── Authenticated layout ─────────────────────────────────────────────────────
  const price = prices[selectedSymbol];

  return (
    <div className="app-container" style={{ flexDirection: 'column' }}>
      <header className="topbar" style={{ width: '100%', flexShrink: 0, zIndex: 10, borderBottom: '1px solid var(--border-color)' }}>
          {/* Left: title + index pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '12px' }}>
              <img src="/logo.png" alt="" style={{ height: '24px', objectFit: 'contain' }} onError={(e) => e.target.style.display = 'none'} />
              <div className="logo-text" style={{ fontSize: '15px' }}>
                SH<span>O</span>RT MARKET
              </div>
            </div>

            <div className="hide-on-tablet" style={{ display: 'flex', gap: '6px' }}>
              {TOP_INDICES.map((idx) => {
                const p      = prices[idx];
                const isUp   = p?.pct >= 0;
                return (
                  <div
                    key={idx}
                    style={{
                      display:      'flex',
                      alignItems:   'center',
                      gap:          '4px',
                      background:   p
                        ? (isUp ? 'rgba(34,197,94,0.12)' : 'rgba(225,42,31,0.12)')
                        : 'rgba(255,255,255,0.05)',
                      color: p
                        ? (isUp ? 'var(--color-green-light)' : 'var(--color-red-light)')
                        : 'var(--text-secondary)',
                      padding:      '2px 6px',
                      borderRadius: '12px',
                      fontSize:     '10px',
                      fontWeight:   '700',
                    }}
                  >
                    {p && (isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />)}
                    {idx.split('-')[0]}{' '}
                    {p ? `${p.ltp.toFixed(2)}` : '...'}
                    {p && (
                      <span style={{ opacity: 0.8, fontSize: '9px', marginLeft: '2px' }}>
                        {p.change !== undefined ? `${p.change > 0 ? '+' : ''}${Number(p.change).toFixed(2)} (${p.pct > 0 ? '+' : ''}${Number(p.pct).toFixed(2)}%)` : ''}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: nav tabs + user info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {/* Tab Navigation */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              fontSize: '10px', fontWeight: '700', marginRight: '4px',
            }}>
              {[
                'Markets', 'Options', 'Positions', 'Orders', 'Portfolio', 'Mutual Funds', 'Client Data', 'Settings',
                ...(user?.is_admin ? ['Admin Panel'] : [])
              ].map((tab) => {
                const tabKey = tab.replace(' ', ''); // e.g. "Mutual Funds" -> "MutualFunds"
                return (
                <div
                  key={tab}
                  onClick={() => setActiveTab(tabKey)}
                  style={{
                    color:        activeTab === tabKey ? 'var(--text-primary)' : 'var(--text-secondary)',
                    borderBottom: activeTab === tabKey
                      ? (tabKey === 'AdminPanel' ? '2px solid var(--color-red)' : '2px solid var(--color-blue)')
                      : '2px solid transparent',
                    padding:        '16px 2px',
                    cursor:         'pointer',
                    transition:     'all 0.2s ease',
                    textTransform:  'uppercase',
                    letterSpacing:  '0.5px',
                  }}
                >
                  {tab}
                </div>
              )})}
            </div>

            {/* Margin & Deposit */}
            <div className="hide-on-mobile" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Wallet size={12} style={{ color: 'var(--text-secondary)' }} />
                <div>
                  <div style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>
                    Available Margin
                  </div>
                  <div style={{ fontWeight: '700', fontSize: '11px' }}>
                    ₹{(user.balance || 1000000).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
              <button 
                className="btn btn-primary" 
                style={{ padding: '6px 12px', fontSize: '11px' }}
                onClick={() => setShowDepositModal(true)}
              >
                Deposit
              </button>
            </div>

            <div className="hide-on-mobile" style={{ width: '1px', height: '24px', background: 'var(--border-color)' }} />

            {/* User avatar + logout */}
            <div className="hide-on-mobile" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button 
                onClick={toggleTheme}
                style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              </button>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: 'var(--bg-panel)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--border-color)', overflow: 'hidden'
              }}>
                {user?.profile_picture_url ? (
                  <img src={user.profile_picture_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <User size={14} color="var(--text-secondary)" />
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '11px', fontWeight: '600' }}>{user.username}</span>
                <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{user.id}</span>
              </div>
              <div
                onClick={logout}
                title="Log out"
                style={{
                  marginLeft:   '8px',
                  cursor:       'pointer',
                  padding:      '6px',
                  background:   'rgba(255,255,255,0.05)',
                  borderRadius: '4px',
                  display:      'flex',
                  alignItems:   'center',
                }}
              >
                <LogOut size={14} color="var(--text-secondary)" />
              </div>
            </div>
          </div>
        </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', width: '100%', minWidth: 0 }}>
        <MarketWatch className={activeTab !== 'Markets' ? 'mobile-hidden' : ''} />
        <div className={`main-content ${activeTab === 'Markets' ? '' : 'mobile-full'}`} style={{ flex: 1, display: 'flex', overflow: 'hidden', minWidth: 0 }}>
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {activeTab === 'Markets' && (
            <div className="dashboard-grid" style={{ width: '100%', height: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <ChartWidget />
              </div>
            </div>
          )}
          {activeTab === 'Options' && (
            <div className="dashboard-grid" style={{ width: '100%', height: '100%' }}>
              <OptionChainView />
            </div>
          )}
          {activeTab === 'Portfolio' && <PortfolioView />}
          {activeTab === 'Orders' && <OrdersView />}
          {activeTab === 'Positions' && <PositionsView />}
          {activeTab === 'MutualFunds' && <MutualFundsView />}
          {activeTab === 'ClientData' && (
            <div className="dashboard-grid" style={{ width: '100%', height: '100%', gridTemplateColumns: '1fr' }}>
              <ClientDataView />
            </div>
          )}
          {activeTab === 'Settings' && (
            <div className="dashboard-grid" style={{ width: '100%', height: '100%', gridTemplateColumns: '1fr' }}>
              <SettingsView />
            </div>
          )}
          {activeTab === 'AdminPanel' && user?.is_admin && (
            <div className="dashboard-grid" style={{ width: '100%', height: '100%', gridTemplateColumns: '1fr' }}>
              <AdminDashboard />
            </div>
          )}
          </main>
        </div>
      </div>

      {showOrderModal && <OrderModal onClose={() => setShowOrderModal(false)} defaultSymbol={selectedSymbol} />}
      {showDepositModal && <DepositModal onClose={() => setShowDepositModal(false)} />}
      
      {/* Mobile Bottom Navigation */}
      <div className="mobile-bottom-nav">
        <div className={`mobile-nav-item ${activeTab === 'Markets' ? 'active' : ''}`} onClick={() => setActiveTab('Markets')}>
          <TrendingUp size={20} />
          <span>Markets</span>
        </div>
        <div className={`mobile-nav-item ${activeTab === 'Orders' ? 'active' : ''}`} onClick={() => setActiveTab('Orders')}>
          <List size={20} />
          <span>Orders</span>
        </div>
        <div className={`mobile-nav-item ${activeTab === 'Portfolio' ? 'active' : ''}`} onClick={() => setActiveTab('Portfolio')}>
          <Briefcase size={20} />
          <span>Portfolio</span>
        </div>
        <div className="mobile-nav-item" onClick={() => setShowDepositModal(true)}>
          <CircleDollarSign size={20} />
          <span>Funds</span>
        </div>
        <div className={`mobile-nav-item ${activeTab === 'Settings' ? 'active' : ''}`} onClick={() => setActiveTab('Settings')}>
          <User size={20} />
          <span>Profile</span>
        </div>
      </div>
    </div>
  );
}

export default App;
