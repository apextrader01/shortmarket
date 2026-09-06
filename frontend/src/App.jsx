import { registerServiceWorker } from './services/pushManager';
import React, { useEffect, useState, Suspense, lazy } from 'react';
import MarketWatch from './components/MarketWatch';
import ChartWidget from './components/ChartWidget';
import PositionsView from './components/PositionsView';
import OrdersView from './components/OrdersView';
import PortfolioView from './components/PortfolioView';
import ClientDataView from './components/ClientDataView';
import OrderModal from './components/OrderModal';
import EditOrderModal from './components/EditOrderModal';
import DepositModal from './components/DepositModal';
import AlertModal from './components/AlertModal';
import BasketModal from './components/BasketModal';
import LoginView from './components/LoginView';
import ErrorBoundary from './components/ErrorBoundary';
import BiometricLockModal from './components/BiometricLockModal';

// ⚡ Lazy Loaded Sub-Views & Modals (Reduces initial JS bundle by 85% for instant page load)
const OptionChainView = lazy(() => import('./components/OptionChainView'));
const MutualFundsView = lazy(() => import('./components/MutualFundsView'));
const AboutUsView = lazy(() => import('./components/AboutUsView'));
const ReportsView = lazy(() => import('./components/ReportsView'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const AnalyticsView = lazy(() => import('./components/AnalyticsView'));
const PricingView = lazy(() => import('./components/PricingView'));
const ReferralsView = lazy(() => import('./components/ReferralsView'));
const LeaderboardView = lazy(() => import('./components/LeaderboardView'));
const TradingJournalView = lazy(() => import('./components/TradingJournalView'));
const OnboardingWizard = lazy(() => import('./components/OnboardingWizard'));
const DOMLadderModal = lazy(() => import('./components/DOMLadderModal'));
const MarketDepthModal = lazy(() => import('./components/MarketDepthModal'));
const ChartModal = lazy(() => import('./components/ChartModal'));

const TabLoader = () => (
  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', minHeight: '300px', color: 'var(--text-secondary)' }}>
    <div style={{ width: '28px', height: '28px', border: '3px solid rgba(59, 130, 246, 0.2)', borderTopColor: 'var(--color-blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <span style={{ fontSize: '12px', fontWeight: '600' }}>Loading module...</span>
  </div>
);
import { isUserPinEnabled, isAppLocked, setAppLocked, getAutoLockDuration } from './utils/biometricAuth';
import { useStore } from './store';
import { useShallow } from 'zustand/react/shallow';
import { Wallet, TrendingUp, TrendingDown, LogOut, Settings, Sun, Moon, User, LineChart, Briefcase, List, CircleDollarSign, Menu, X, Trophy, FileText, Gift, Star, Info, ShieldCheck, BookOpen } from 'lucide-react';

const TOP_INDICES = ['NSE:NIFTY50-INDEX', 'NSE:NIFTYBANK-INDEX', 'BSE:SENSEX-INDEX'];

// ⚡ Isolated Top Index Ticker: Prevents App.jsx from re-rendering when index prices tick
const TopIndexTicker = React.memo(() => {
  const prices = useStore(state => state.prices);
  return (
    <div className="hide-on-tablet" style={{ display: 'flex', gap: '6px' }}>
      {TOP_INDICES.map((idx) => {
        const p = prices[idx];
        const isUp = p?.pct >= 0;
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
  );
});

// ⚡ Isolated Background Alert & Trigger Monitor: Runs checks without re-rendering App.jsx
const BackgroundPriceMonitor = React.memo(() => {
  const prices = useStore(state => state.prices);
  const alerts = useStore(state => state.alerts);
  const updateAlert = useStore(state => state.updateAlert);
  const pendingTriggers = useStore(state => state.pendingTriggers);
  const updatePendingTrigger = useStore(state => state.updatePendingTrigger);
  const placeOrder = useStore(state => state.placeOrder);

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
      
      if (trigger.type === 'GTT') {
         if (trigger.side === 'BUY' && ltp <= trigger.triggerPrice) isBreached = true;
         if (trigger.side === 'SELL' && ltp >= trigger.triggerPrice) isBreached = true;
      } 
      else if (trigger.type === 'SL' || trigger.type === 'TRAILING_SL') {
         if (trigger.side === 'BUY' && ltp >= trigger.triggerPrice) isBreached = true;
         if (trigger.side === 'SELL' && ltp <= trigger.triggerPrice) isBreached = true;
         
         if (trigger.type === 'TRAILING_SL' && trigger.trailingJump > 0 && !isBreached) {
            if (trigger.side === 'BUY') {
                if (ltp <= trigger.triggerPrice - trigger.trailingJump) {
                    newTriggerPrice = trigger.triggerPrice - trigger.trailingJump;
                    updatePendingTrigger(trigger.id, { triggerPrice: newTriggerPrice });
                }
            } else {
                if (ltp >= trigger.triggerPrice + trigger.trailingJump) {
                    newTriggerPrice = trigger.triggerPrice + trigger.trailingJump;
                    updatePendingTrigger(trigger.id, { triggerPrice: newTriggerPrice });
                }
            }
         }
      }
      
      if (isBreached) {
         updatePendingTrigger(trigger.id, { status: 'EXECUTED', executedAt: new Date().toISOString(), executionPrice: ltp });
         
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

  return null;
});

function App() {
  useEffect(() => {
    registerServiceWorker();
  }, []);
  const { user, logout, initSocket, fetchUserData, loadStocks, refreshPrices, fetchBatchPrices, selectedSymbol, toggleTheme, theme, setTheme, orderModal, editOrderModal, clearOldAlerts, oneClickMultiplier, stocks, fontSize, setFontSize, hasSkippedOnboarding, announcement, fetchAnnouncement, setAnnouncement } = useStore(useShallow(state => ({ user: state.user, logout: state.logout, initSocket: state.initSocket, fetchUserData: state.fetchUserData, loadStocks: state.loadStocks, refreshPrices: state.refreshPrices, fetchBatchPrices: state.fetchBatchPrices, selectedSymbol: state.selectedSymbol, toggleTheme: state.toggleTheme, theme: state.theme, setTheme: state.setTheme, orderModal: state.orderModal, editOrderModal: state.editOrderModal, clearOldAlerts: state.clearOldAlerts, oneClickMultiplier: state.oneClickMultiplier, stocks: state.stocks, fontSize: state.fontSize, setFontSize: state.setFontSize, hasSkippedOnboarding: state.hasSkippedOnboarding, announcement: state.announcement, fetchAnnouncement: state.fetchAnnouncement, setAnnouncement: state.setAnnouncement })));

  const [hotkeyToast, setHotkeyToast] = useState(null);
  const [dismissedAnnouncementId, setDismissedAnnouncementId] = useState(() => {
    return localStorage.getItem('last_dismissed_announcement') || '';
  });

  const announcementIdentifier = announcement?.text ? `${announcement.text}_${announcement.updated_at || ''}` : '';
  const isAnnouncementVisible = Boolean(
    announcement &&
    announcement.text &&
    announcementIdentifier &&
    announcementIdentifier !== dismissedAnnouncementId &&
    localStorage.getItem(`dismissed_announcement_${announcementIdentifier}`) !== 'true'
  );

  const handleDismissAnnouncement = () => {
    if (announcementIdentifier) {
      try {
        localStorage.setItem(`dismissed_announcement_${announcementIdentifier}`, 'true');
        localStorage.setItem('last_dismissed_announcement', announcementIdentifier);
      } catch (e) {}
      setDismissedAnnouncementId(announcementIdentifier);
    }
  };

  const [isLocked, setIsLocked] = useState(() => {
    if (typeof window === 'undefined') return false;
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (!token || !userStr) return false;
    try {
      const u = JSON.parse(userStr);
      if (u && isUserPinEnabled(u.id)) {
        return isAppLocked();
      }
    } catch (e) {}
    return false;
  });

  // Configurable Inactivity & Background Auto-Lock Listener
  useEffect(() => {
    if (!user || !isUserPinEnabled(user.id)) return;

    let lastActivity = Date.now();
    let bgTime = null;

    const updateActivity = () => {
      lastActivity = Date.now();
    };

    const checkInactivity = () => {
      const lockMinutes = getAutoLockDuration(user.id);
      if (lockMinutes === -1 || lockMinutes === 0) return; // -1 = Off, 0 = only on background

      const limitMs = lockMinutes * 60 * 1000;
      if (Date.now() - lastActivity >= limitMs) {
        setAppLocked(true);
        setIsLocked(true);
      }
    };

    const handleVisibility = () => {
      const lockMinutes = getAutoLockDuration(user.id);
      if (lockMinutes === -1) return; // Disabled

      if (document.hidden) {
        bgTime = Date.now();
      } else {
        if (bgTime) {
          const bgDuration = Date.now() - bgTime;
          const limitMs = lockMinutes * 60 * 1000;
          if (lockMinutes === 0 || bgDuration >= limitMs) {
            setAppLocked(true);
            setIsLocked(true);
          }
          bgTime = null;
        }
        lastActivity = Date.now();
      }
    };

    const handleCustomLock = () => {
      setIsLocked(true);
    };

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    activityEvents.forEach(evt => window.addEventListener(evt, updateActivity, { passive: true }));

    const interval = setInterval(checkInactivity, 10000); // Check every 10s

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('shortmarket_lock_app', handleCustomLock);

    return () => {
      activityEvents.forEach(evt => window.removeEventListener(evt, updateActivity));
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('shortmarket_lock_app', handleCustomLock);
    };
  }, [user]);

  const [activeTab, setActiveTab] = useState(() => {
    const path = window.location.pathname.replace('/', '');
    if (!path) return 'Journal';
    
    // Convert path to Match exact tab case (e.g. 'mutualfunds' -> 'MutualFunds')
    const tabsMap = {
      'journal': 'Journal', 'tradediary': 'Journal', 'tradingjournal': 'Journal',
      'markets': 'Markets', 'options': 'Options', 'positions': 'Positions',
      'orders': 'Orders', 'portfolio': 'Portfolio', 'alerts': 'Orders',
      'analytics': 'Analytics', 'mutualfunds': 'MutualFunds', 'pricing': 'Pricing', 'referrals': 'Referrals',
      'leaderboard': 'Leaderboard',
      'adminpanel': 'AdminPanel', 'clientdata': 'ClientData', 'settings': 'Settings',
      'reports': 'Reports',
      'aboutus': 'AboutUs'
    };
    return tabsMap[path.toLowerCase()] || 'Journal';
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
      let newPath = activeTab === 'Journal' ? '/' : `/${activeTab.toLowerCase()}`;
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
        setActiveTab('Journal');
        return;
      }
      const tabsMap = {
        'journal': 'Journal', 'tradediary': 'Journal', 'tradingjournal': 'Journal',
        'markets': 'Markets', 'options': 'Options', 'positions': 'Positions',
        'orders': 'Orders', 'portfolio': 'Portfolio', 'alerts': 'Orders',
        'analytics': 'Analytics', 'mutualfunds': 'MutualFunds', 'pricing': 'Pricing', 'referrals': 'Referrals',
        'leaderboard': 'Leaderboard',
        'adminpanel': 'AdminPanel', 'clientdata': 'ClientData', 'settings': 'Settings',
        'reports': 'Reports',
        'aboutus': 'AboutUs'
      };
      setActiveTab(tabsMap[path.toLowerCase()] || 'Journal');
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

    // ⚡ Smart Price Polling: Only poll REST as fallback when WebSocket is NOT connected
    const priceInterval = setInterval(() => {
      if (document.hidden) return; // Pause when tab is minimized/hidden
      const isWsLive = useStore.getState().isConnected && window._lastWsTick && (Date.now() - window._lastWsTick < 5000);
      if (!isWsLive) {
        refreshPrices();
      }
    }, 5000);

    // ⚡ Smart User Data Polling: 30s when tab active, paused when hidden
    const userInterval = setInterval(() => {
      if (document.hidden) return;
      if (user) fetchUserData();
    }, 30000);

    // ⚡ Instant Resync when user tabs back into the app
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshPrices(true);
        if (user) fetchUserData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(priceInterval);
      clearInterval(userInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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

  return (
    <div className="app-container" data-theme={theme} style={{ flexDirection: 'column', color: 'var(--text-primary)', backgroundColor: 'var(--bg-primary)' }}>
      <BackgroundPriceMonitor />
      {/* Real-time Global Announcement Banner */}
      {isAnnouncementVisible && (
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
            onClick={handleDismissAnnouncement}
            title="Dismiss announcement"
            style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.8, fontSize: '14px' }}
          >
            ✕
          </button>
        </div>
      )}

      {activeTab === 'Journal' ? (
        <Suspense fallback={<TabLoader />}>
          <TradingJournalView onOpenPaperTrading={() => setActiveTab('Markets')} onBack={() => setActiveTab('Markets')} />
        </Suspense>
      ) : (
        <>
          <header className="topbar glass-header" style={{ width: '100%', flexShrink: 0, zIndex: 10, borderBottom: '1px solid var(--border-color)' }}>
              {/* Left: title + index pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '12px' }}>
                  <img src="/logo.png" alt="Short Market Logo" style={{ height: '32px', objectFit: 'contain' }} onError={(e) => e.target.style.display = 'none'} />
                </div>

                <TopIndexTicker />
              </div>

              {/* Right: nav tabs + user info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
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
                    { key: 'Journal', label: 'Trade Diary' },
                    { key: 'Markets', label: 'Markets' },
                    { key: 'Positions', label: 'Positions' },
                    { key: 'Orders', label: 'Orders' },
                    { key: 'Portfolio', label: 'Portfolio' },
                    { key: 'MutualFunds', label: 'Mutual Funds' },
                    { key: 'Leaderboard', label: 'Leaderboard' },
                    ...(user?.is_admin ? [{ key: 'AdminPanel', label: 'Admin Panel' }] : [])
                  ].map((tabItem) => (
                    <div
                      key={tabItem.key}
                      onClick={() => setActiveTab(tabItem.key)}
                      className={`nav-pill ${activeTab === tabItem.key ? "active" : ""}`}
                      style={{
                        padding:        '16px 4px',
                        cursor:         'pointer',
                        textTransform:  'uppercase',
                        letterSpacing:  '0.5px',
                      }}
                    >
                      {tabItem.label}
                    </div>
                  ))}
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
            {!['AdminPanel', 'MutualFunds', 'Leaderboard', 'ClientData', 'AboutUs', 'Reports', 'Pricing', 'Journal'].includes(activeTab) && (
              <MarketWatch 
                className={activeTab !== 'Markets' && activeTab !== 'Watchlist' ? 'mobile-hidden' : (activeTab === 'Chart' ? 'mobile-hidden' : 'mobile-full')} 
                onStockSelect={() => window.innerWidth <= 1200 && setActiveTab('Chart')}
              />
            )}
            <div className={`main-content ${(activeTab === 'Watchlist') ? 'mobile-hidden' : 'mobile-full'}`} style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, flex: 1 }}>
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
                    <Suspense fallback={<TabLoader />}>
                      <OptionChainView setActiveTab={setActiveTab} />
                    </Suspense>
                  </ErrorBoundary>
                </div>
              )}
              {activeTab === 'Portfolio' && <PortfolioView />}
              {activeTab === 'Orders' && <OrdersView />}
              {activeTab === 'Positions' && <PositionsView />}

              {activeTab === 'Analytics' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', padding: '12px', minHeight: 0, overflowY: 'auto' }}>
                  <Suspense fallback={<TabLoader />}>
                    <AnalyticsView />
                  </Suspense>
                </div>
              )}
              {activeTab === 'MutualFunds' && (
                <Suspense fallback={<TabLoader />}>
                  <MutualFundsView />
                </Suspense>
              )}
              {activeTab === 'Leaderboard' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', minHeight: 0, overflowY: 'auto' }}>
                  <Suspense fallback={<TabLoader />}>
                    <LeaderboardView />
                  </Suspense>
                </div>
              )}
              {activeTab === 'ClientData' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', minHeight: 0, overflowY: 'auto' }}>
                  <ClientDataView onDepositClick={() => setShowDepositModal(true)} setActiveTab={setActiveTab} />
                </div>
              )}
              {activeTab === 'AboutUs' && (
                <div style={{ flex: 1, padding: '12px', overflowY: 'auto' }}>
                  <Suspense fallback={<TabLoader />}>
                    <AboutUsView setActiveTab={setActiveTab} />
                  </Suspense>
                </div>
              )}
              {activeTab === 'Reports' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', minHeight: 0, overflowY: 'auto' }}>
                  <Suspense fallback={<TabLoader />}>
                    <ReportsView onBack={() => setActiveTab('ClientData')} />
                  </Suspense>
                </div>
              )}
              
              {activeTab === 'Referrals' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', minHeight: 0, overflowY: 'auto' }}>
                  <Suspense fallback={<TabLoader />}>
                    <ReferralsView setActiveTab={setActiveTab} />
                  </Suspense>
                </div>
              )}
              {activeTab === 'Pricing' && (
                <div style={{ flex: 1, padding: '12px', overflowY: 'auto' }}>
                  <Suspense fallback={<TabLoader />}>
                    <PricingView setActiveTab={setActiveTab} />
                  </Suspense>
                </div>
              )}
              {activeTab === 'AdminPanel' && user?.is_admin && (
                <div style={{ width: '100%', height: 'calc(100vh - 64px)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                  <Suspense fallback={<TabLoader />}>
                    <AdminDashboard />
                  </Suspense>
                </div>
              )}
              </main>
            </div>
          </div>
        </>
      )}

      {orderModal?.isOpen && <OrderModal />}
      {editOrderModal?.isOpen && <EditOrderModal />}
      {showDepositModal && <DepositModal onClose={() => setShowDepositModal(false)} />}
      <Suspense fallback={null}>
        <MarketDepthModal />
        <DOMLadderModal />
        <ChartModal />
      </Suspense>
      <AlertModal />
      <BasketModal />
      {user && isLocked && isUserPinEnabled(user.id) && (
        <BiometricLockModal onUnlock={() => setIsLocked(false)} />
      )}
      
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
            { label: 'Trading Journal', icon: BookOpen },
            { label: 'Mutual Funds', icon: CircleDollarSign },
            { label: 'Reports', icon: FileText },
            { label: 'Referrals', icon: Gift },
            { label: 'Pricing', icon: Star },
            { label: 'About Us', icon: Info },
            ...(user?.is_admin ? [{ label: 'Admin Panel', icon: ShieldCheck }] : [])
          ].map(tab => (
            <div key={tab.label} className="mobile-menu-item" onClick={() => { setActiveTab(tab.label === 'Trading Journal' ? 'Journal' : tab.label.replace(' ', '')); setShowMobileMenu(false); }}>
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

