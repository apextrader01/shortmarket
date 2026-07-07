import React, { useEffect, useState } from 'react';
import MarketWatch from './components/MarketWatch';
import ChartWidget from './components/ChartWidget';
import PositionsView from './components/PositionsView';
import OrdersView from './components/OrdersView';
import PortfolioView from './components/PortfolioView';
import OptionChainView from './components/OptionChainView';
import ClientDataView from './components/ClientDataView';
import ReportsView from './components/ReportsView';
import AdminDashboard from './components/AdminDashboard';
import SettingsView from './components/SettingsView';
import AlertsView from './components/AlertsView';
import AnalyticsView from './components/AnalyticsView';
import OrderModal from './components/OrderModal';
import EditOrderModal from './components/EditOrderModal';
import DepositModal from './components/DepositModal';
import MarketDepthModal from './components/MarketDepthModal';
import DOMLadderModal from './components/DOMLadderModal';
import LoginView from './components/LoginView';
import ErrorBoundary from './components/ErrorBoundary';
import { useStore } from './store';
import { Wallet, TrendingUp, TrendingDown, LogOut, Settings, Sun, Moon, User, LineChart, Briefcase, List, CircleDollarSign } from 'lucide-react';

const TOP_INDICES = ['NIFTY-NSE', 'BANKNIFTY-NSE', 'SENSEX-BSE'];

function App() {
  const {
    user, token, logout,
    initSocket, fetchUserData, loadStocks, refreshPrices, fetchBatchPrices,
    selectedSymbol, prices, toggleTheme, theme, orderModal, editOrderModal,
    alerts, updateAlert, pendingTriggers, updatePendingTrigger, placeOrder,
    oneClickMultiplier, stocks
  } = useStore();

  const [hotkeyToast, setHotkeyToast] = useState(null);

  const [activeTab, setActiveTab] = useState('Markets');
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
    }, 2000);

    return () => {
      clearInterval(interval);
      if (stockRetry) clearTimeout(stockRetry);
    };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Global Hotkey Engine (Shift+B, Shift+S)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is typing in an input or textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.shiftKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        if (!selectedSymbol) return;
        const stockInfo = stocks.find(s => s.uniqueSymbol === selectedSymbol) || {};
        const lotsize = stockInfo.lotsize || 1;
        
        placeOrder({
          symbol: selectedSymbol,
          type: 'MARKET',
          side: 'BUY',
          quantity: lotsize * (oneClickMultiplier || 1),
          price: 0,
          product_type: 'INT'
        });
        
        setHotkeyToast('🔥 BUY MARKET: ' + selectedSymbol);
        setTimeout(() => setHotkeyToast(null), 1500);
      }
      
      if (e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (!selectedSymbol) return;
        const stockInfo = stocks.find(s => s.uniqueSymbol === selectedSymbol) || {};
        const lotsize = stockInfo.lotsize || 1;
        
        placeOrder({
          symbol: selectedSymbol,
          type: 'MARKET',
          side: 'SELL',
          quantity: lotsize * (oneClickMultiplier || 1),
          price: 0,
          product_type: 'INT'
        });
        
        setHotkeyToast('🔥 SELL MARKET: ' + selectedSymbol);
        setTimeout(() => setHotkeyToast(null), 1500);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSymbol, stocks, oneClickMultiplier, placeOrder]);

  // Background Alert Checking Engine
  useEffect(() => {
    alerts.forEach(alert => {
      if (alert.triggered) return;
      const priceData = prices[alert.symbol];
      if (!priceData) return;
      
      const ltp = priceData.ltp;
      let triggered = false;
      
      if (alert.condition === 'ABOVE' && ltp >= alert.targetPrice) {
        triggered = true;
      } else if (alert.condition === 'BELOW' && ltp <= alert.targetPrice) {
        triggered = true;
      }
      
      if (triggered) {
        updateAlert(alert.id, { triggered: true, triggeredAt: new Date().toISOString(), triggerPrice: ltp });
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Price Alert Triggered! 🚨", {
            body: `${alert.symbol} crossed ${alert.condition.toLowerCase()} ₹${alert.targetPrice}. Current price is ₹${ltp.toFixed(2)}`,
            icon: '/logo.png'
          });
        }
      }
    });
  }, [prices, alerts, updateAlert]);

  // Client-Side Advanced Order Trigger Engine
  useEffect(() => {
    pendingTriggers.forEach(trigger => {
      if (trigger.status !== 'PENDING_TRIGGER') return;
      const priceData = prices[trigger.symbol];
      if (!priceData) return;
      
      const ltp = priceData.ltp;
      
      let isBreached = false;
      let newTriggerPrice = trigger.triggerPrice;
      
      // GTT Logic: usually GTT BUY is when price drops to/below trigger, GTT SELL is when price rises to/above trigger.
      if (trigger.type === 'GTT') {
         if (trigger.side === 'BUY' && ltp <= trigger.triggerPrice) isBreached = true;
         if (trigger.side === 'SELL' && ltp >= trigger.triggerPrice) isBreached = true;
      } 
      // Stop Loss Logic: SL BUY is when price rises to/above trigger, SL SELL is when price drops to/below trigger.
      else if (trigger.type === 'SL' || trigger.type === 'TRAILING_SL') {
         if (trigger.side === 'BUY' && ltp >= trigger.triggerPrice) isBreached = true;
         if (trigger.side === 'SELL' && ltp <= trigger.triggerPrice) isBreached = true;
         
         // Trailing logic
         if (trigger.type === 'TRAILING_SL' && trigger.trailingJump > 0 && !isBreached) {
            if (trigger.side === 'BUY') {
                // If we are short (buy to cover SL), as price drops, we trail SL down.
                // But normally trailing SL is relative to a reference price. 
                // For simplicity: if LTP drops below (triggerPrice - trailingJump), we move triggerPrice down.
                if (ltp <= trigger.triggerPrice - trigger.trailingJump) {
                    newTriggerPrice = trigger.triggerPrice - trigger.trailingJump;
                    updatePendingTrigger(trigger.id, { triggerPrice: newTriggerPrice });
                }
            } else {
                // If we are long (sell SL), as price rises, we trail SL up.
                if (ltp >= trigger.triggerPrice + trigger.trailingJump) {
                    newTriggerPrice = trigger.triggerPrice + trigger.trailingJump;
                    updatePendingTrigger(trigger.id, { triggerPrice: newTriggerPrice });
                }
            }
         }
      }
      
      if (isBreached) {
         updatePendingTrigger(trigger.id, { status: 'EXECUTED', executedAt: new Date().toISOString(), executionPrice: ltp });
         
         // Fire the real order!
         placeOrder({
            symbol: trigger.symbol,
            type: trigger.limitPrice ? 'LIMIT' : 'MARKET',
            side: trigger.side,
            quantity: trigger.quantity,
            price: trigger.limitPrice || 0,
            product_type: trigger.productType
         });
         
         if ("Notification" in window && Notification.permission === "granted") {
           new Notification(`${trigger.type} Order Triggered! 🎯`, {
             body: `${trigger.side} ${trigger.quantity} ${trigger.symbol} @ ₹${ltp.toFixed(2)}`,
             icon: '/logo.png'
           });
         }
      }
    });
  }, [prices, pendingTriggers, updatePendingTrigger, placeOrder]);

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
              <img src="/logo.png" alt="Short Market Logo" style={{ height: '32px', objectFit: 'contain' }} onError={(e) => e.target.style.display = 'none'} />
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
            {/* Background Alerts Engine Audio Output */}
            {/* (Can put a hidden audio element here if we add sound) */}
            
            {/* Hotkey Toast Notification */}
            {hotkeyToast && (
              <div style={{
                position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(234, 179, 8, 0.9)', color: '#000', padding: '12px 24px',
                borderRadius: '8px', fontWeight: 'bold', fontSize: '18px', zIndex: 9999,
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                animation: 'fadeInOut 1.5s forwards'
              }}>
                {hotkeyToast}
              </div>
            )}
            
            {/* Tab Navigation */}
            <div className="hide-on-mobile" style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              fontSize: '10px', fontWeight: '700', marginRight: '4px',
            }}>
              {[
                'Markets', 'Options', 'Positions', 'Orders', 'Portfolio', 'Alerts', 'Analytics', 'Mutual Funds',
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

            {/* User avatar + logout */}
            <div className="hide-on-mobile" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div 
                onClick={() => setActiveTab('ClientData')}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px 8px', borderRadius: '8px' }}
                className="hover:bg-white/5 transition-colors"
              >
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
                  <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>Client ID: {user.id}</span>
                </div>
              </div>
              <div
                onClick={() => setActiveTab('Settings')}
                title="Settings"
                style={{
                  cursor:       'pointer',
                  padding:      '6px',
                  background:   'rgba(255,255,255,0.05)',
                  borderRadius: '4px',
                  display:      'flex',
                  alignItems:   'center',
                }}
              >
                <Settings size={14} color="var(--text-secondary)" />
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

      <div className="content-wrapper" style={{ display: 'flex', flex: 1, overflow: 'hidden', width: '100%', minWidth: 0 }}>
        <MarketWatch className={activeTab !== 'Markets' ? 'mobile-hidden' : ''} />
        <div className={`main-content ${activeTab === 'Markets' ? '' : 'mobile-full'}`} style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          {activeTab === 'Markets' && (
            <div className="dashboard-grid" style={{ width: '100%', minWidth: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
                <ChartWidget />
              </div>
            </div>
          )}
          {activeTab === 'Options' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', padding: '12px', minHeight: 0, overflow: 'hidden' }}>
              <ErrorBoundary>
                <OptionChainView />
              </ErrorBoundary>
            </div>
          )}
          {activeTab === 'Portfolio' && <PortfolioView />}
          {activeTab === 'Orders' && <OrdersView />}
          {activeTab === 'Positions' && <PositionsView />}
          {activeTab === 'Alerts' && <div style={{ flex: 1, padding: '12px' }}><AlertsView /></div>}
          {activeTab === 'Analytics' && <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', padding: '12px', minHeight: 0, overflowY: 'auto' }}><AnalyticsView /></div>}
          {activeTab === 'MutualFunds' && <MutualFundsView />}
          {activeTab === 'ClientData' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', padding: '12px', minHeight: 0, overflowY: 'auto' }}>
              <ClientDataView onDepositClick={() => setShowDepositModal(true)} setActiveTab={setActiveTab} />
            </div>
          )}
          {activeTab === 'Reports' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', padding: '12px', minHeight: 0, overflowY: 'auto' }}>
              <ReportsView onBack={() => setActiveTab('ClientData')} />
            </div>
          )}
          {activeTab === 'Settings' && (
            <div className="dashboard-grid" style={{ width: '100%', gridTemplateColumns: '1fr' }}>
              <SettingsView />
            </div>
          )}
          {activeTab === 'AdminPanel' && user?.is_admin && (
            <div className="dashboard-grid" style={{ width: '100%', gridTemplateColumns: '1fr' }}>
              <AdminDashboard />
            </div>
          )}
          </main>
        </div>
      </div>

      {orderModal?.isOpen && <OrderModal />}
      {editOrderModal?.isOpen && <EditOrderModal />}
      {showDepositModal && <DepositModal onClose={() => setShowDepositModal(false)} />}
      <MarketDepthModal />
      <DOMLadderModal />
      
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
