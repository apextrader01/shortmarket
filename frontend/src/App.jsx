import React, { useEffect, useState } from 'react';
import MarketWatch from './components/MarketWatch';
import ChartWidget from './components/ChartWidget';
import PositionsView from './components/PositionsView';
import OrdersView from './components/OrdersView';
import PortfolioView from './components/PortfolioView';
import OrderModal from './components/OrderModal';
import LoginView from './components/LoginView';
import { useStore } from './store';
import { Wallet, TrendingUp, TrendingDown, LogOut } from 'lucide-react';

function App() {
  const { 
    initSocket, fetchUserData, loadStocks, refreshPrices, 
    user, token, logout, selectedSymbol, prices, fetchBatchPrices
  } = useStore();
  
  const [activeTab, setActiveTab] = useState('Markets');
  const topIndices = ['NIFTY-NSE', 'BANKNIFTY-NSE', 'SENSEX-BSE', 'FINNIFTY-NSE'];

  // All useEffects must be at the top level before any conditional return
  useEffect(() => {
    fetchBatchPrices(topIndices);
  }, []);

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
  }, [token]);

  // Now safe to do conditional render AFTER all hooks
  if (!user || !token) {
    return (
      <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-primary)' }}>
        <LoginView />
      </div>
    );
  }

  const price = prices[selectedSymbol];
  const isUp = price?.pct >= 0;

  return (
    <div className="app-container">
      <MarketWatch />

      <div className="main-content">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h2 style={{ letterSpacing: '0.5px', fontSize: '18px', fontWeight: '800' }}>DASHBOARD</h2>
            <div style={{ display: 'flex', gap: '12px', marginLeft: '12px' }}>
              {topIndices.map(idx => {
                const p = prices[idx];
                const isIdxUp = p?.pct >= 0;
                return (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: p ? (isIdxUp ? 'rgba(34,197,94,0.12)' : 'rgba(225,42,31,0.12)') : 'rgba(255,255,255,0.05)',
                    color: p ? (isIdxUp ? 'var(--color-green-light)' : 'var(--color-red-light)') : 'var(--text-secondary)',
                    padding: '4px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '600'
                  }}>
                    {p && (isIdxUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />)}
                    {idx.split('-')[0]} {p ? `₹${p.ltp.toFixed(2)}` : '...'}
                    {p && <span style={{ opacity: 0.8 }}>{p.pct > 0 ? '+' : ''}{Number(p.pct || 0).toFixed(2)}%</span>}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            {/* Global Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '13px', fontWeight: '600', marginRight: '20px' }}>
              {['Markets', 'Portfolio', 'Orders', 'Positions'].map(tab => (
                <div 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                    borderBottom: activeTab === tab ? '2px solid var(--color-blue)' : '2px solid transparent',
                    padding: '16px 4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  {tab}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Wallet size={16} style={{ color: 'var(--text-secondary)' }} />
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Available Margin</div>
                <div style={{ fontWeight: '700', fontSize: '15px' }}>
                  ₹{(user.balance || 1000000).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div style={{ width: '1px', height: '32px', background: 'var(--border-color)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '34px', height: '34px', borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--color-red), var(--color-navy-light))',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '14px'
              }}>
                {user.username?.[0]?.toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '13px' }}>{user.username}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-green-light)' }}>● Active</div>
              </div>
              <div 
                onClick={logout}
                style={{ marginLeft: '8px', cursor: 'pointer', padding: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                title="Log out"
              >
                <LogOut size={14} color="var(--text-secondary)" />
              </div>
            </div>
          </div>
        </header>

        <main style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {activeTab === 'Markets' && (
            <div className="dashboard-grid" style={{ width: '100%', height: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <ChartWidget />
              </div>
            </div>
          )}
          {activeTab === 'Portfolio' && <PortfolioView />}
          {activeTab === 'Orders' && <OrdersView />}
          {activeTab === 'Positions' && <PositionsView />}
        </main>
      </div>
      <OrderModal />
    </div>
  );
}

export default App;
