import { registerServiceWorker } from './services/pushManager';
import React, { useEffect, useState } from 'react';
import MarketWatch from './components/MarketWatch';
import ChartWidget from './components/ChartWidget';
import PositionsView from './components/PositionsView';
import OrdersView from './components/OrdersView';
import PortfolioView from './components/PortfolioView';
import OptionChainView from './components/OptionChainView';
import MutualFundsView from './components/MutualFundsView';
import ClientDataView from './components/ClientDataView';
import AboutUsView from './components/AboutUsView';
import ReportsView from './components/ReportsView';
import AdminDashboard from './components/AdminDashboard';
import SettingsView from './components/SettingsView';

import AnalyticsView from './components/AnalyticsView';
import OrderModal from './components/OrderModal';
import EditOrderModal from './components/EditOrderModal';
import DepositModal from './components/DepositModal';
import MarketDepthModal from './components/MarketDepthModal';
import DOMLadderModal from './components/DOMLadderModal';
import AlertModal from './components/AlertModal';
import ChartModal from './components/ChartModal';
import BasketModal from './components/BasketModal';
import LoginView from './components/LoginView';
import OnboardingWizard from './components/OnboardingWizard';
import PricingView from './components/PricingView';
import ReferralsView from './components/ReferralsView';
import LeaderboardView from './components/LeaderboardView';
import ErrorBoundary from './components/ErrorBoundary';
import { useStore } from './store';
import { useShallow } from 'zustand/react/shallow';
import { Wallet, TrendingUp, TrendingDown, LogOut, Settings, Sun, Moon, User, LineChart, Briefcase, List, CircleDollarSign, Menu, X, Trophy, FileText, Gift, Star, Info, ShieldCheck } from 'lucide-react';

const TOP_INDICES = ['NSE:NIFTY50-INDEX', 'NSE:NIFTYBANK-INDEX', 'BSE:SENSEX-INDEX'];

function App() {
  useEffect(() => {
    registerServiceWorker();
  }, []);
  const { user, logout, initSocket, fetchUserData, loadStocks, refreshPrices, fetchBatchPrices, selectedSymbol, prices, toggleTheme, theme, setTheme, orderModal, editOrderModal, alerts, updateAlert, clearOldAlerts, pendingTriggers, updatePendingTrigger, placeOrder, oneClickMultiplier, stocks, fontSize, setFontSize, hasSkippedOnboarding, announcement, fetchAnnouncement, setAnnouncement } = useStore(useShallow(state => ({ user: state.user, logout: state.logout, initSocket: state.initSocket, fetchUserData: state.fetchUserData, loadStocks: state.loadStocks, refreshPrices: state.refreshPrices, fetchBatchPrices: state.fetchBatchPrices, selectedSymbol: state.selectedSymbol, prices: state.prices, toggleTheme: state.toggleTheme, theme: state.theme, setTheme: state.setTheme, orderModal: state.orderModal, editOrderModal: state.editOrderModal, alerts: state.alerts, updateAlert: state.updateAlert, clearOldAlerts: state.clearOldAlerts, pendingTriggers: state.pendingTriggers, updatePendingTrigger: state.updatePendingTrigger, placeOrder: state.placeOrder, oneClickMultiplier: state.oneClickMultiplier, stocks: state.stocks, fontSize: state.fontSize, setFontSize: state.setFontSize, hasSkippedOnboarding: state.hasSkippedOnboarding, announcement: state.announcement, fetchAnnouncement: state.fetchAnnouncement, setAnnouncement: state.setAnnouncement })));

  const [hotkeyToast, setHotkeyToast] = useState(null);
  const [isDismissedAnnouncement, setIsDismissedAnnouncement] = useState(false);

  const [activeTab, setActiveTab] = useState(() => {
    const path = window.location.pathname.replace('/', '');
    if (!path) return 'Markets';
    
    // Convert path to Match exact tab case (e.g. 'mutualfunds' -> 'MutualFunds')
    const tabsMap = {
      'markets': 'Markets', 'options': 'Options', 'positions': 'Positions',
      'orders': 'Orders', 'portfolio': 'Portfolio', 'alerts': 'Orders',
      'analytics': 'Analytics', 'mutualfunds': 'MutualFunds', 'pricing': 'Pricing', 'referrals': 'Referrals',
      'leaderboard': 'Leaderboard',
      'adminpanel': 'AdminPanel', 'clientdata': 'ClientData', 'settings': 'Settings',
      'reports': 'Reports',
        'aboutus': 'AboutUs'
    };
    return tabsMap[path.toLowerCase()] || 'Markets';
  });
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Apply persisted UI settings on load
  useEffect(() => {
    setFontSize(fontSize);
    if (theme) setTheme(theme);
    if (fetchAnnouncement) fetchAnnouncement();
  }, []);

  // Sync activeTab to URL and handle browser back/forward buttons
  useEffect(() => {
    if (activeTab) {
      let newPath = `/${activeTab.toLowerCase()}`;
      if (activeTab === 'Portfolio' && typeof portfolioSubTab !== 'undefined') {
        newPath = `/portfolio/${portfolioSubTab.toLowerCase()}`;
      }
      if (window.location.pathname !== newPath) {
        window.history.pushState(null, '', newPath);
      }
    }
  }, [activeTab, typeof portfolioSubTab !== 'undefined' ? portfolioSubTab : null]);

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.replace('/', '');
      if (!path) {
        setActiveTab('Markets');
        return;
      }
      const tabsMap = {
        'markets': 'Markets', 'options': 'Options', 'positions': 'Positions',
        'orders': 'Orders', 'portfolio': 'Portfolio', 'alerts': 'Orders',
        'analytics': 'Analytics', 'mutualfunds': 'MutualFunds', 'pricing': 'Pricing', 'referrals': 'Referrals',
        'adminpanel': 'AdminPanel', 'clientdata': 'ClientData', 'settings': 'Settings',
        'reports': 'Reports',
        'aboutus': 'AboutUs'
      };
      setActiveTab(tabsMap[path.toLowerCase()] || 'Markets');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // ── ALL hooks must be declared before any conditional return ─────────────────

  // Fyers API OAuth Callback Interceptor
  useEffect(() => {
    const checkFyersCallback = async () => {
      if (window.location.pathname === '/api/fyers/callback') {
        const urlParams = new URLSearchParams(window.location.search);
        const authCode = urlParams.get('auth_code');
        if (authCode) {
          try {
            const API_URL = import.meta.env.VITE_API_URL || '';
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/api/fyers/verify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
              },
              body: JSON.stringify({ auth_code: authCode })
            });
            const data = await res.json();
            if (data.success) {
              alert('Fyers API connected successfully!');
            } else {
              alert('Fyers API connection failed: ' + (data.error || 'Unknown error'));
            }
          } catch (e) {
            console.error(e);
            alert('Error connecting Fyers API');
          }
        }
        // Remove callback from URL and go back to home
        window.history.replaceState({}, document.title, '/');
      }
    };
    checkFyersCallback();
  }, []);
  // Pre-fetch top index prices (runs on mount regardless of auth state)
  useEffect(() => {
    fetchBatchPrices(TOP_INDICES);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialise socket, load stocks, and start polling
  useEffect(() => {
    clearOldAlerts();
    initSocket();
    if (user) fetchUserData();
    loadStocks();
    refreshPrices();

    const priceInterval = setInterval(() => {
      refreshPrices();
    }, 2000);

    const userInterval = setInterval(() => {
      if (user) fetchUserData();
    }, 20000); // Fallback database poll every 20 seconds

    return () => {
      clearInterval(priceInterval);
      clearInterval(userInterval);
    };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

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
        
        useStore.getState().openOrderModal(selectedSymbol, 'BUY', lotsize);
      }
      
      if (e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (!selectedSymbol) return;
        const stockInfo = stocks.find(s => s.uniqueSymbol === selectedSymbol) || {};
        const lotsize = stockInfo.lotsize || 1;
        
        useStore.getState().openOrderModal(selectedSymbol, 'SELL', lotsize);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSymbol, stocks]);

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
  
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  if (!user) {
    return <LoginView />;
  }
  if (user && !user.is_onboarded && !hasSkippedOnboarding && !user.is_admin && window.location.pathname !== '/adminpanel') {
    return <OnboardingWizard />;
  }

  // ── Authenticated layout ─────────────────────────────────────────────────────
  const price = prices[selectedSymbol];

  return (
    <div className="app-container" data-theme={theme} style={{ flexDirection: 'column', color: 'var(--text-primary)', backgroundColor: 'var(--bg-primary)' }}>
      {/* Real-time Global Announcement Banner */}
      {announcement && announcement.text && !isDismissedAnnouncement && (
        <div style={{
          background: announcement.type === 'alert' ? 'linear-gradient(90deg, #b91c1c, #991b1b)' : (announcement.type === 'warning' ? 'linear-gradient(90deg, #b45309, #d97706)' : 'linear-gradient(90deg, #1d4ed8, #2563eb)'),
          color: '#fff',
          padding: '7px 16px',
          fontSize: '12px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.15)',
          zIndex: 100
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>📢</span>
            <span>{announcement.text}</span>
          </div>
          <button
            onClick={() => setIsDismissedAnnouncement(true)}
            style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.8, fontSize: '14px' }}
          >
            ✕
          </button>
        </div>
      )}

      <header className="topbar glass-header" style={{ width: '100%', flexShrink: 0, zIndex: 10, borderBottom: '1px solid var(--border-color)' }}>
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
                'Markets', 'Positions', 'Orders', 'Portfolio', 'Analytics', 'Mutual Funds', 'Leaderboard',
                ...(user?.is_admin ? ['Admin Panel'] : [])
              ].map((tab) => {
                const tabKey = tab.replace(' ', ''); // e.g. "Mutual Funds" -> "MutualFunds"
                return (
                <div
                  key={tab}
                  onClick={() => setActiveTab(tabKey)}
                  className={`nav-pill ${activeTab === tabKey ? "active" : ""}`}
                  style={{
                    padding:        '16px 2px',
                    cursor:         'pointer',
                    textTransform:  'uppercase',
                    letterSpacing:  '0.5px',
                  }}
                >
                  {tab}
                </div>
              )})}
            </div>

            {/* Hamburger Menu (Mobile Only) */}
            <div className="mobile-only" onClick={() => setShowMobileMenu(true)} style={{ cursor: 'pointer', padding: '4px' }}>
              <Menu size={24} color="var(--text-primary)" />
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
                <div>
                  <div style={{ fontWeight: '700', fontSize: '15px' }}>{user.username}</div>
                </div>
              </div>
              
            </div>
          </div>
        </header>

      <div className="content-wrapper" style={{ display: 'flex', flex: 1, overflow: 'hidden', width: '100%', minWidth: 0 }}>
        <MarketWatch 
          className={activeTab !== 'Markets' && activeTab !== 'Watchlist' ? 'mobile-hidden' : (activeTab === 'Chart' ? 'mobile-hidden' : 'mobile-full')} 
          onStockSelect={() => window.innerWidth <= 1200 && setActiveTab('Chart')}
        />
        <div className={`main-content ${(activeTab === 'Watchlist') ? 'mobile-hidden' : 'mobile-full'}`} style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          {(activeTab === 'Markets' || activeTab === 'Chart') && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0, minHeight: 0, padding: window.innerWidth <= 1200 ? '0' : '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0 }}>
                <ChartWidget />
              </div>
            </div>
          )}
          {activeTab === 'Options' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', padding: '12px', minHeight: 0, overflow: 'hidden' }}>
              <ErrorBoundary>
                <OptionChainView setActiveTab={setActiveTab} />
              </ErrorBoundary>
            </div>
          )}
          {activeTab === 'Portfolio' && <PortfolioView />}
          {activeTab === 'Orders' && <OrdersView />}
          {activeTab === 'Positions' && <PositionsView />}

          {activeTab === 'Analytics' && <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', padding: '12px', minHeight: 0, overflowY: 'auto' }}><AnalyticsView /></div>}
          {activeTab === 'MutualFunds' && <MutualFundsView />}
          {activeTab === 'Leaderboard' && <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', minHeight: 0, overflowY: 'auto' }}><LeaderboardView /></div>}
          {activeTab === 'ClientData' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', padding: '12px', minHeight: 0, overflowY: 'auto' }}>
              <ClientDataView onDepositClick={() => setShowDepositModal(true)} setActiveTab={setActiveTab} />
            </div>
          )}
          {activeTab === 'AboutUs' && (
            <div style={{ flex: 1, padding: '12px', overflowY: 'auto' }}>
              <AboutUsView setActiveTab={setActiveTab} />
            </div>
          )}
          {activeTab === 'Reports' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', padding: '12px', minHeight: 0, overflowY: 'auto' }}>
              <ReportsView onBack={() => setActiveTab('ClientData')} />
            </div>
          )}
          
          {activeTab === 'Referrals' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', minHeight: 0, overflowY: 'auto' }}>
              <ReferralsView setActiveTab={setActiveTab} />
            </div>
          )}
            {activeTab === 'Pricing' && (
            <div style={{ flex: 1, padding: '12px', overflowY: 'auto' }}>
              <PricingView setActiveTab={setActiveTab} />
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
      <AlertModal />
      <ChartModal />
      <BasketModal />
      
      {/* Mobile Menu Overlay */}
      <div className={`mobile-menu-overlay ${showMobileMenu ? 'open' : ''}`}>
        <div className="mobile-menu-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => { setActiveTab('ClientData'); setShowMobileMenu(false); }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-panel)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
              {user?.profile_picture_url ? <img src={user.profile_picture_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={20} />}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{user.username}</span>
                {user.subscription_tier === 'PRO' && (
                  <span style={{ fontSize: '10px', background: 'var(--color-blue)', color: 'white', padding: '2px 6px', borderRadius: '12px', fontWeight: 'bold' }}>PRO</span>
                )}
              </div>
            </div>
          </div>
          <div onClick={() => setShowMobileMenu(false)} style={{ cursor: 'pointer', padding: '8px' }}>
            <X size={24} color="var(--text-primary)" />
          </div>
        </div>
        <div className="mobile-menu-content">
          {[
            { label: 'Markets', icon: TrendingUp },
            { label: 'Positions', icon: Briefcase },
            { label: 'Orders', icon: List },
            { label: 'Portfolio', icon: Briefcase },
            { label: 'Leaderboard', icon: Trophy },
            { label: 'Analytics', icon: LineChart },
            { label: 'Mutual Funds', icon: CircleDollarSign },
            { label: 'Reports', icon: FileText },
            { label: 'Referrals', icon: Gift },
            { label: 'Pricing', icon: Star },
            { label: 'About Us', icon: Info },
            ...(user?.is_admin ? [{ label: 'Admin Panel', icon: ShieldCheck }] : [])
          ].map(tab => (
            <div key={tab.label} className="mobile-menu-item" onClick={() => { setActiveTab(tab.label.replace(' ', '')); setShowMobileMenu(false); }}>
              <tab.icon size={20} />
              {tab.label}
            </div>
          ))}
          <div className="mobile-menu-item" onClick={logout} style={{ color: 'var(--color-red)', marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <LogOut size={20} />
            Logout
          </div>
        </div>
      </div>
      
      {/* Mobile Bottom Navigation */}
      <div className="mobile-bottom-nav">
        <div className={`mobile-nav-item ${activeTab === 'Markets' || activeTab === 'Watchlist' ? 'active' : ''}`} onClick={() => setActiveTab('Watchlist')}>
          <List size={20} />
          <span>Watchlist</span>
        </div>
        <div className={`mobile-nav-item ${activeTab === 'Chart' ? 'active' : ''}`} onClick={() => setActiveTab('Chart')}>
          <TrendingUp size={20} />
          <span>Chart</span>
        </div>
        <div className={`mobile-nav-item ${activeTab === 'Orders' ? 'active' : ''}`} onClick={() => setActiveTab('Orders')}>
          <List size={20} />
          <span>Orders</span>
        </div>
        <div className={`mobile-nav-item ${activeTab === 'Portfolio' || activeTab === 'Positions' ? 'active' : ''}`} onClick={() => setActiveTab('Portfolio')}>
          <Briefcase size={20} />
          <span>Portfolio</span>
        </div>
        <div className={`mobile-nav-item ${activeTab === 'ClientData' ? 'active' : ''}`} onClick={() => setActiveTab('ClientData')}>
          <User size={20} />
          <span>Profile</span>
        </div>
      </div>
    </div>
  );
}

export default App;

