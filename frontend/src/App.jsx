import { registerServiceWorker } from './services/pushManager';
import React, { useEffect, useState, useMemo, Suspense, lazy } from 'react';
import MarketWatch from './components/MarketWatch';
import LoginView from './components/LoginView';
import ErrorBoundary from './components/ErrorBoundary';
import { getInstantLotsize } from './utils/lotsizeHelper';

// ⚡ Resilient Lazy Loader: Auto-reloads on deployment chunk hash changes
const lazyWithRetry = (importFn) => lazy(async () => {
  try {
    return await importFn();
  } catch (error) {
    const msg = error?.message || String(error || '');
    if (
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('dynamically imported module') ||
      msg.includes('Loading chunk') ||
      msg.includes('Importing a module script failed')
    ) {
      const lastReload = parseInt(sessionStorage.getItem('last_chunk_reload') || '0', 10);
      if (Date.now() - lastReload > 10000) {
        sessionStorage.setItem('last_chunk_reload', String(Date.now()));
        window.location.reload();
      }
    }
    throw error;
  }
});

// ⚡ Core Dashboard Views (Imported directly for instant 0ms switching with zero "Loading module..." delay)
import ChartWidget from './components/ChartWidget';
import PositionsView from './components/PositionsView';
import OrdersView from './components/OrdersView';
import PortfolioView from './components/PortfolioView';
import ClientDataView from './components/ClientDataView';
import OptionChainView from './components/OptionChainView';
import MutualFundsView from './components/MutualFundsView';
import AnalyticsView from './components/AnalyticsView';
import LeaderboardView from './components/LeaderboardView';
import TradingJournalView from './components/TradingJournalView';
import TradeDiaryView from './components/TradeDiaryView';
import ReportsView from './components/ReportsView';
import PricingView from './components/PricingView';
import AboutUsView from './components/AboutUsView';
import ReferralsView from './components/ReferralsView';
import OrderModal from './components/OrderModal';
import EditOrderModal from './components/EditOrderModal';
import DepositModal from './components/DepositModal';
import BasketModal from './components/BasketModal';
import BroadcastToast from './components/BroadcastToast';
import NotificationDrawer from './components/NotificationDrawer';
import BroadcastModal from './components/BroadcastModal';

// ⚡ Lazy Loaded Secondary / Heavy Auxiliary Views
const AdminDashboard = lazyWithRetry(() => import('./components/AdminDashboard'));
const AlertModal = lazyWithRetry(() => import('./components/AlertModal'));
const BiometricLockModal = lazyWithRetry(() => import('./components/BiometricLockModal'));
const OnboardingWizard = lazyWithRetry(() => import('./components/OnboardingWizard'));
const DOMLadderModal = lazyWithRetry(() => import('./components/DOMLadderModal'));
const MarketDepthModal = lazyWithRetry(() => import('./components/MarketDepthModal'));
const ChartModal = lazyWithRetry(() => import('./components/ChartModal'));
const MobileStockOverviewModal = lazyWithRetry(() => import('./components/MobileStockOverviewModal'));
const LegalView = lazyWithRetry(() => import('./components/LegalView'));
const ConsentBanner = lazyWithRetry(() => import('./components/ConsentBanner'));
const NotFoundView = lazyWithRetry(() => import('./components/NotFoundView'));

const TabLoader = () => (
  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '14px', minHeight: '350px', color: 'var(--text-secondary)' }}>
    <div style={{ width: '32px', height: '32px', border: '3px solid rgba(59, 130, 246, 0.15)', borderTopColor: 'var(--color-blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', letterSpacing: '0.3px' }}>Loading...</span>
  </div>
);

// Core views are loaded synchronously - prefetchTab is a safe no-op
const prefetchTab = () => {};
import NetworkStatusBanner from './components/NetworkStatusBanner';
import SessionExpiredModal from './components/SessionExpiredModal';
import PermissionDenied from './components/PermissionDenied';
import GlobalToast from './components/GlobalToast';
import { isUserPinEnabled, isAppLocked, setAppLocked, getAutoLockDuration } from './utils/biometricAuth';
import { useStore } from './store';
import { useShallow } from 'zustand/react/shallow';
import { Wallet, TrendingUp, TrendingDown, LogOut, Settings, Sun, Moon, User, LineChart, Briefcase, List, CircleDollarSign, Menu, X, Trophy, FileText, Gift, Star, Info, Shield, ShieldCheck, BookOpen, Layers, Bell } from 'lucide-react';

const TOP_INDICES = ['NSE:NIFTY50-INDEX', 'NSE:NIFTYBANK-INDEX', 'BSE:SENSEX-INDEX'];

// ⚡ Isolated Index Chip: Only re-renders when its own index ticks
const IndexChip = React.memo(({ label, price }) => {
  const isUp = price?.pct >= 0;
  return (
    <div
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          '4px',
        background:   price
          ? (isUp ? 'rgba(34,197,94,0.12)' : 'rgba(225,42,31,0.12)')
          : 'rgba(255,255,255,0.05)',
        color: price
          ? (isUp ? 'var(--color-green-light)' : 'var(--color-red-light)')
          : 'var(--text-secondary)',
        padding:      '2px 6px',
        borderRadius: '12px',
        fontSize:     '10px',
        fontWeight:   '700',
      }}
    >
      {price && (isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />)}
      {label}{' '}
      {price && price.ltp !== undefined && !isNaN(price.ltp) ? Number(price.ltp).toFixed(2) : '...'}
      {price && price.change !== undefined && !isNaN(price.change) && (
        <span style={{ opacity: 0.8, fontSize: '9px', marginLeft: '2px' }}>
          {Number(price.change) > 0 ? '+' : ''}{Number(price.change).toFixed(2)} ({Number(price.pct || 0) > 0 ? '+' : ''}{Number(price.pct || 0).toFixed(2)}%)
        </span>
      )}
    </div>
  );
});

// ⚡ State 7: Partial Data / Live Stream Badge
const DataStatusBadge = React.memo(() => {
  const isConnected = useStore(state => state.isConnected);
  return (
    <div
      title={isConnected ? "WebSocket connected: Real-time price feed active" : "WebSocket reconnecting: Running on REST fallback feed (Partial Data)"}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '2px 7px',
        borderRadius: '12px',
        background: isConnected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
        border: `1px solid ${isConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
        fontSize: '9.5px',
        fontWeight: '700',
        color: isConnected ? '#10b981' : '#f59e0b',
        letterSpacing: '0.4px',
        userSelect: 'none'
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: isConnected ? '#10b981' : '#f59e0b',
          boxShadow: isConnected ? '0 0 6px #10b981' : '0 0 6px #f59e0b',
          display: 'inline-block'
        }}
      />
      <span>{isConnected ? 'LIVE' : 'PARTIAL DATA'}</span>
    </div>
  );
});

// ⚡ Top Index Ticker Container
const TopIndexTicker = React.memo(() => {
  const nifty = useStore(state => state.prices['NSE:NIFTY50-INDEX']);
  const banknifty = useStore(state => state.prices['NSE:NIFTYBANK-INDEX']);
  const sensex = useStore(state => state.prices['BSE:SENSEX-INDEX']);

  return (
    <div className="hide-on-tablet" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <IndexChip label="NSE:NIFTY50" price={nifty} />
      <IndexChip label="NSE:NIFTYBANK" price={banknifty} />
      <IndexChip label="BSE:SENSEX" price={sensex} />
      <DataStatusBadge />
    </div>
  );
});

// ⚡ Isolated Background Alert Monitor: Runs checks only when active alerts exist
const ActiveAlertChecker = React.memo(() => {
  const alerts = useStore(state => state.alerts);
  const updateAlert = useStore(state => state.updateAlert);

  const activeAlertSymbols = useMemo(() => {
    if (!alerts || alerts.length === 0) return [];
    return [...new Set(alerts.filter(a => !a.triggered).map(a => a.symbol))];
  }, [alerts]);

  const alertPrices = useStore(useShallow(state => {
    if (activeAlertSymbols.length === 0) return {};
    const map = {};
    for (const sym of activeAlertSymbols) {
      const clean = sym.includes(':') ? sym.split(':')[1] : sym;
      const priceObj = state.prices[sym] || state.prices[clean] || state.prices[`NSE:${clean}`] || state.prices[`BSE:${clean}`] || state.prices[`MCX:${clean}`];
      if (priceObj) map[sym] = priceObj;
    }
    return map;
  }));

  useEffect(() => {
    if (!alerts || alerts.length === 0) return;
    const activeAlerts = alerts.filter(a => !a.triggered);
    activeAlerts.forEach(alert => {
      const clean = alert.symbol.includes(':') ? alert.symbol.split(':')[1] : alert.symbol;
      const priceData = alertPrices[alert.symbol] || alertPrices[clean];
      if (!priceData) return;
      
      const ltp = parseFloat(priceData.ltp || 0);
      if (!ltp || ltp <= 0) return;
      let triggered = false;
      
      if (alert.condition === 'ABOVE') {
        if (alert.createdPrice && alert.createdPrice >= alert.targetPrice) return;
        if (ltp >= alert.targetPrice) triggered = true;
      } else if (alert.condition === 'BELOW') {
        if (alert.createdPrice && alert.createdPrice <= alert.targetPrice) return;
        if (ltp <= alert.targetPrice) triggered = true;
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
  }, [alertPrices, alerts, updateAlert]);

  return null;
});

const BackgroundPriceMonitor = React.memo(() => {
  // ⚡ Uses boolean primitive (true/false) so Zustand never re-triggers when alerts are empty
  const hasActiveAlerts = useStore(state => Boolean(state.alerts && state.alerts.some(a => !a.triggered)));
  if (!hasActiveAlerts) return null;
  return <ActiveAlertChecker />;
});

function App() {
  useEffect(() => {
    registerServiceWorker();
  }, []);
  const { user, logout, initSocket, fetchUserData, refreshPrices, fetchBatchPrices, selectedSymbol, toggleTheme, theme, setTheme, orderModal, editOrderModal, clearOldAlerts, oneClickMultiplier, fontSize, setFontSize, hasSkippedOnboarding, announcement, fetchAnnouncement, setAnnouncement, marketDepthModal, domLadderModal, chartModalSymbol, mobileStockOverviewSymbol, alertModalSymbol, basketModalOpen, unreadNotificationsCount, markAllNotificationsRead, fetchBroadcastNotifications } = useStore(useShallow(state => ({ user: state.user, logout: state.logout, initSocket: state.initSocket, fetchUserData: state.fetchUserData, refreshPrices: state.refreshPrices, fetchBatchPrices: state.fetchBatchPrices, selectedSymbol: state.selectedSymbol, toggleTheme: state.toggleTheme, theme: state.theme, setTheme: state.setTheme, orderModal: state.orderModal, editOrderModal: state.editOrderModal, clearOldAlerts: state.clearOldAlerts, oneClickMultiplier: state.oneClickMultiplier, fontSize: state.fontSize, setFontSize: state.setFontSize, hasSkippedOnboarding: state.hasSkippedOnboarding, announcement: state.announcement, fetchAnnouncement: state.fetchAnnouncement, setAnnouncement: state.setAnnouncement, marketDepthModal: state.marketDepthModal, domLadderModal: state.domLadderModal, chartModalSymbol: state.chartModalSymbol, mobileStockOverviewSymbol: state.mobileStockOverviewSymbol, alertModalSymbol: state.alertModalSymbol, basketModalOpen: state.basketModalOpen, unreadNotificationsCount: state.unreadNotificationsCount, markAllNotificationsRead: state.markAllNotificationsRead, fetchBroadcastNotifications: state.fetchBroadcastNotifications })));

  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
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

  // Configurable Inactivity & Background Auto-Lock Listener (Throttled to 5s to eliminate 144Hz mouse churn)
  useEffect(() => {
    if (!user || !isUserPinEnabled(user.id)) return;

    let lastActivity = Date.now();
    let bgTime = null;

    const updateActivity = () => {
      const now = Date.now();
      if (now - lastActivity > 5000) {
        lastActivity = now;
      }
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
    window.addEventListener('skandx_lock_app', handleCustomLock);
    window.addEventListener('shortmarket_lock_app', handleCustomLock);

    return () => {
      activityEvents.forEach(evt => window.removeEventListener(evt, updateActivity));
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('skandx_lock_app', handleCustomLock);
      window.removeEventListener('shortmarket_lock_app', handleCustomLock);
    };
  }, [user?.id]);

  const [activeTab, setActiveTab] = useState(() => {
    const path = window.location.pathname.replace('/', '');
    if (!path) return 'TradeDiary';
    
    // Convert path to Match exact tab case (e.g. 'mutualfunds' -> 'MutualFunds')
    const tabsMap = {
      'tradediary': 'TradeDiary', 'trade-diary': 'TradeDiary',
      'journal': 'Journal', 'tradingjournal': 'Journal', 'trading-journal': 'Journal',
      'markets': 'Markets', 'options': 'Options', 'positions': 'Positions',
      'orders': 'Orders', 'portfolio': 'Portfolio', 'alerts': 'Orders',
      'analytics': 'Analytics', 'mutualfunds': 'MutualFunds', 'pricing': 'Pricing', 'referrals': 'Referrals',
      'leaderboard': 'Leaderboard',
      'adminpanel': 'AdminPanel', 'clientdata': 'ClientData', 'settings': 'Settings',
      'reports': 'Reports',
      'aboutus': 'AboutUs'
    };
    return tabsMap[path.toLowerCase()] || 'TradeDiary';
  });
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Apply persisted UI settings on load
  useEffect(() => {
    setFontSize(fontSize);
    if (theme) setTheme(theme);
    if (fetchAnnouncement) fetchAnnouncement();
    if (fetchBroadcastNotifications) fetchBroadcastNotifications();
  }, []);


  // Sync activeTab to URL and handle browser back/forward buttons
  useEffect(() => {
    if (activeTab) {
      const newPath = activeTab === 'TradeDiary' ? '/' : `/${activeTab.toLowerCase()}`;
      if (window.location.pathname !== newPath) {
        window.history.pushState(null, '', newPath);
      }
    }
  }, [activeTab]);

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.replace('/', '');
      if (!path) {
        setActiveTab('TradeDiary');
        return;
      }
      const tabsMap = {
        'tradediary': 'TradeDiary', 'trade-diary': 'TradeDiary',
        'journal': 'Journal', 'tradingjournal': 'Journal', 'trading-journal': 'Journal',
        'markets': 'Markets', 'options': 'Options', 'positions': 'Positions',
        'orders': 'Orders', 'portfolio': 'Portfolio', 'alerts': 'Orders',
        'analytics': 'Analytics', 'mutualfunds': 'MutualFunds', 'pricing': 'Pricing', 'referrals': 'Referrals',
        'leaderboard': 'Leaderboard',
        'adminpanel': 'AdminPanel', 'clientdata': 'ClientData', 'settings': 'Settings',
        'reports': 'Reports',
        'aboutus': 'AboutUs'
      };
      setActiveTab(tabsMap[path.toLowerCase()] || 'TradeDiary');
    };
    window.addEventListener('popstate', handlePopState);
    const handleOpenDeposit = () => setShowDepositModal(true);
    window.addEventListener('open-deposit-modal', handleOpenDeposit);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('open-deposit-modal', handleOpenDeposit);
    };
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

  // Initialise socket and start polling
  useEffect(() => {
    clearOldAlerts();
    initSocket();
    if (user) fetchUserData();
    refreshPrices();

    // ⚡ Smart Price Polling: Only poll REST as fallback when WebSocket is truly disconnected
    const priceInterval = setInterval(() => {
      if (document.hidden) return; // Pause when tab is minimized/hidden
      const isConnected = useStore.getState().isConnected;
      // If WebSocket is connected and healthy, do not spam REST prices (saves ~14 lakh requests)
      if (!isConnected) {
        refreshPrices();
      }
    }, 10000);

    // ⚡ Smart User Data Polling: 30s during active market hours, 2m when markets are closed
    let lastUserPoll = Date.now();
    const userInterval = setInterval(() => {
      if (document.hidden) return;
      if (!user) return;

      const now = new Date();
      const istHours = (now.getUTCHours() + 5.5) % 24;
      const isMarketTime = istHours >= 9 && istHours <= 23.5;
      const intervalMs = isMarketTime ? 30000 : 120000;

      if (Date.now() - lastUserPoll >= intervalMs) {
        lastUserPoll = Date.now();
        fetchUserData();
      }
    }, 15000);

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
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Global Hotkey Engine (Shift+B, Shift+S)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is typing in an input or textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.shiftKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        if (!selectedSymbol) return;
        const lotsize = getInstantLotsize(selectedSymbol);
        useStore.getState().openOrderModal(selectedSymbol, 'BUY', lotsize);
      }
      
      if (e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (!selectedSymbol) return;
        const lotsize = getInstantLotsize(selectedSymbol);
        useStore.getState().openOrderModal(selectedSymbol, 'SELL', lotsize);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSymbol]);

  // ── Guard: show login screen when not authenticated ──────────────────────────
  
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // ── Guard & Route Detection ──────────────────────────────────────────────────
  const currentPath = (typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '');
  const cleanFirstSegment = (currentPath.split('/')[1] || '').split('?')[0];

  const knownAppRoutes = new Set([
    '', 'login', 'register', 'signup', 'forgot', 'reset',
    'markets', 'watchlist', 'chart', 'options', 'optionchain', 'option-chain',
    'positions', 'orders', 'portfolio', 'alerts', 'analytics', 'mutualfunds', 'mutual-funds',
    'pricing', 'referrals', 'leaderboard', 'journal', 'tradingjournal', 'trading-journal',
    'tradediary', 'trade-diary', 'adminpanel', 'clientdata', 'profile', 'account', 'settings',
    'reports', 'aboutus', 'about', 'terms', 'privacy', 'privacy-policy', 'privacypolicy',
    'risk', 'riskpolicy', 'risk-policy', 'delete', 'delete-account', 'deleteaccount',
    'data', 'data-rights', 'datarights', 'legal', 'accessibility', 'manifest.webmanifest',
    'manifest', 'sitemap.xml', 'sitemap', 'robots.txt', 'robots', 'sw.js', 'ref'
  ]);

  const isKnownRoute = 
    !currentPath ||
    currentPath === '/' ||
    knownAppRoutes.has(cleanFirstSegment) ||
    currentPath.startsWith('/ref/') ||
    currentPath.startsWith('/apple-touch-icon') ||
    currentPath.startsWith('/favicon') ||
    currentPath.startsWith('/pwa-') ||
    currentPath.startsWith('/skandx-');

  // Dynamic SEO Page Titles (Item 10)
  useEffect(() => {
    const tabTitleMap = {
      Markets: 'Live Markets & Paper Trading | SkandX',
      Orders: 'Order Book & Executions | SkandX',
      Positions: 'Open Positions & P&L | SkandX',
      Portfolio: 'Portfolio & Holdings | SkandX',
      OptionChain: 'Option Chain Analytics | SkandX',
      MutualFunds: 'Mutual Funds Terminal | SkandX',
      Pricing: 'Subscription Plans & Pricing | SkandX',
      AboutUs: 'About Us & Company Disclosures | SkandX',
      ClientData: 'Account Profile & Banking | SkandX',
      Settings: 'Security & Terminal Settings | SkandX',
      Reports: 'P&L Reports & Tax Statements | SkandX',
      Leaderboard: 'Trader Leaderboard | SkandX',
      Journal: 'Trading Journal & Logs | SkandX',
      TradeDiary: 'Trade Diary & Insights | SkandX',
      AdminPanel: 'System Administration | SkandX'
    };

    if (!user) {
      if (currentPath.includes('terms')) {
        document.title = 'Terms of Service | SkandX';
      } else if (currentPath.includes('privacy')) {
        document.title = 'Privacy Policy | SkandX';
      } else if (currentPath.includes('risk')) {
        document.title = 'Risk Disclosure Document | SkandX';
      } else if (currentPath === '/pricing') {
        document.title = 'Subscription Plans & Pricing | SkandX';
      } else if (currentPath.includes('about')) {
        document.title = 'About Us & Company Disclosures | SkandX';
      } else if (!isKnownRoute && currentPath !== '') {
        document.title = '404 - Page Not Found | SkandX';
      } else {
        document.title = "SkandX | India's #1 Real-Time Paper Trading & Algo Terminal";
      }
    } else {
      document.title = tabTitleMap[activeTab] || "SkandX | India's #1 Real-Time Paper Trading & Algo Terminal";
    }
  }, [activeTab, user, currentPath, isKnownRoute]);

  // Public Legal & Compliance routes (Accessible without login for Google Play reviewers and search bots)
  if (
    currentPath.includes('privacy') || 
    currentPath.includes('terms') || 
    currentPath.includes('delete-account') || 
    currentPath.includes('deleteaccount') || 
    currentPath.includes('risk-policy') || 
    currentPath.includes('riskpolicy') ||
    currentPath.includes('data-rights') ||
    currentPath.includes('datarights') ||
    currentPath.includes('accessibility') ||
    currentPath.includes('legal')
  ) {
    const initialTab = currentPath.includes('terms') ? 'terms' : 
                       (currentPath.includes('delete') ? 'delete-account' : 
                       (currentPath.includes('risk') ? 'risk' : 
                       (currentPath.includes('data') ? 'data-rights' : 
                       (currentPath.includes('accessibility') ? 'accessibility' : 'privacy'))));
    return (
      <Suspense fallback={<TabLoader />}>
        <LegalView initialTab={initialTab} />
        <Suspense fallback={null}>
          <ConsentBanner />
        </Suspense>
      </Suspense>
    );
  }

  // Public Pricing & About pages (Accessible directly without requiring login)
  if (currentPath === '/pricing' && !user) {
    return (
      <Suspense fallback={<TabLoader />}>
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary, #0a0b0d)' }}>
          <PricingView setActiveTab={() => { window.location.href = '/'; }} />
          <Suspense fallback={null}>
            <ConsentBanner />
          </Suspense>
        </div>
      </Suspense>
    );
  }

  if ((currentPath === '/aboutus' || currentPath === '/about') && !user) {
    return (
      <Suspense fallback={<TabLoader />}>
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary, #0a0b0d)' }}>
          <AboutUsView setActiveTab={() => { window.location.href = '/'; }} />
          <Suspense fallback={null}>
            <ConsentBanner />
          </Suspense>
        </div>
      </Suspense>
    );
  }

  if (!isKnownRoute) {
    return (
      <Suspense fallback={<TabLoader />}>
        <NetworkStatusBanner />
        <NotFoundView onNavigateHome={() => { window.location.href = '/'; }} initialRequestedPath={currentPath} />
        <Suspense fallback={null}>
          <ConsentBanner />
        </Suspense>
      </Suspense>
    );
  }

  if (!user) {
    return (
      <>
        <NetworkStatusBanner />
        <GlobalToast />
        <LoginView />
        <Suspense fallback={null}>
          <ConsentBanner />
        </Suspense>
      </>
    );
  }
  if (user && !user.is_onboarded && !hasSkippedOnboarding && !user.is_admin && window.location.pathname !== '/adminpanel') {
    return (
      <>
        <NetworkStatusBanner />
        <GlobalToast />
        <SessionExpiredModal />
        <OnboardingWizard />
        <Suspense fallback={null}>
          <ConsentBanner />
        </Suspense>
      </>
    );
  }

  // ── Authenticated layout ─────────────────────────────────────────────────────

  return (
    <div className="app-container" data-theme={theme} style={{ flexDirection: 'column', color: 'var(--text-primary)', backgroundColor: 'var(--bg-primary)' }}>
      <NetworkStatusBanner />
      <GlobalToast />
      <SessionExpiredModal />
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

      {activeTab === 'TradeDiary' ? (
        <Suspense fallback={<TabLoader />}>
          <TradeDiaryView 
            onOpenPaperTrading={() => setActiveTab('Markets')} 
            onBack={() => setActiveTab('Markets')} 
            onOpenProfile={() => setActiveTab('ClientData')}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        </Suspense>
      ) : (
        <>
          <header className="topbar glass-header" style={{ width: '100%', flexShrink: 0, zIndex: 10, borderBottom: '1px solid var(--border-color)' }}>
              {/* Left: title + index pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '12px' }}>
                  <div 
                    onClick={() => setActiveTab('Markets')}
                    style={{ display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer', userSelect: 'none' }}
                    title="SkandX Trading Platform"
                  >
                    <img 
                      src="/pwa-192x192.png" 
                      alt="SkandX Logo" 
                      style={{ width: '28px', height: '28px', borderRadius: '7px', boxShadow: '0 0 12px rgba(56, 189, 248, 0.35)' }} 
                    />
                    <span style={{ fontSize: '18px', fontWeight: '800', letterSpacing: '-0.5px', color: '#fff', fontFamily: "'Outfit', sans-serif" }}>
                      Skand<span style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #34d399 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>X</span>
                    </span>
                  </div>
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
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
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
                    { key: 'TradeDiary', label: 'Trade Diary' },
                    { key: 'Markets', label: 'Markets' },
                    { key: 'Positions', label: 'Positions' },
                    { key: 'Orders', label: 'Orders' },
                    { key: 'Portfolio', label: 'Portfolio' },
                    { key: 'MutualFunds', label: 'Mutual Funds' },
                    { key: 'Leaderboard', label: 'Leaderboard' },
                    { key: 'Journal', label: 'Trading Journal' },
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

                {/* Real-time Notification Bell (Desktop & Mobile) */}
                <button
                  onClick={() => {
                    setNotificationDrawerOpen(prev => !prev);
                    if (!notificationDrawerOpen && markAllNotificationsRead) {
                      markAllNotificationsRead();
                    }
                  }}
                  style={{
                    position: 'relative',
                    background: unreadNotificationsCount > 0 ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${unreadNotificationsCount > 0 ? 'rgba(56, 189, 248, 0.35)' : 'var(--border-color)'}`,
                    borderRadius: '8px',
                    padding: '6px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: unreadNotificationsCount > 0 ? '#38bdf8' : 'var(--text-secondary)',
                    transition: 'all 0.2s ease',
                    height: '32px',
                    minWidth: '34px'
                  }}
                  title="Notifications & Trade Signals"
                >
                  <Bell size={16} />
                  {unreadNotificationsCount > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: '-5px',
                      right: '-5px',
                      background: '#ef4444',
                      color: '#fff',
                      fontSize: '9.5px',
                      fontWeight: '800',
                      borderRadius: '10px',
                      minWidth: '17px',
                      height: '17px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 3px',
                      boxShadow: '0 0 10px rgba(239, 68, 68, 0.9)',
                      border: '1.5px solid var(--bg-dark, #0f172a)'
                    }}>
                      {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                    </span>
                  )}
                </button>

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
            {!['AdminPanel', 'MutualFunds', 'Leaderboard', 'ClientData', 'Settings', 'AboutUs', 'Reports', 'Pricing', 'Journal'].includes(activeTab) && (
              <MarketWatch 
                className={activeTab !== 'Markets' && activeTab !== 'Watchlist' ? 'mobile-hidden' : (activeTab === 'Chart' ? 'mobile-hidden' : 'mobile-full')} 
                onStockSelect={(sym) => {
                  if (window.innerWidth <= 768) {
                    useStore.getState().setMobileStockOverviewSymbol(sym || selectedSymbol);
                  } else if (window.innerWidth <= 1200) {
                    setActiveTab('Chart');
                  }
                }}
              />
            )}
            <div className={`main-content ${(activeTab === 'Watchlist') ? 'mobile-hidden' : 'mobile-full'}`} style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, flex: 1 }}>
              <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
              {(activeTab === 'Markets' || activeTab === 'Chart') && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0, minHeight: 0, padding: window.innerWidth <= 1200 ? '0' : '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0 }}>
                    <Suspense fallback={<TabLoader />}>
                      <ChartWidget />
                    </Suspense>
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
              {activeTab === 'Portfolio' && (
                <Suspense fallback={<TabLoader />}>
                  <PortfolioView />
                </Suspense>
              )}
              {activeTab === 'Orders' && (
                <Suspense fallback={<TabLoader />}>
                  <OrdersView />
                </Suspense>
              )}
              {activeTab === 'Positions' && (
                <Suspense fallback={<TabLoader />}>
                  <PositionsView />
                </Suspense>
              )}

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
                    <LeaderboardView setActiveTab={setActiveTab} />
                  </Suspense>
                </div>
              )}
              {activeTab === 'Journal' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', padding: '16px', minHeight: 0, overflowY: 'auto' }}>
                  <Suspense fallback={<TabLoader />}>
                    <TradingJournalView onBack={() => setActiveTab('Markets')} />
                  </Suspense>
                </div>
              )}
              {(activeTab === 'ClientData' || activeTab === 'Settings') && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', minHeight: 0, overflowY: 'auto' }}>
                  <Suspense fallback={<TabLoader />}>
                    <ClientDataView onDepositClick={() => setShowDepositModal(true)} setActiveTab={setActiveTab} />
                  </Suspense>
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
              {activeTab === 'AdminPanel' && (
                user?.is_admin ? (
                  <div style={{ width: '100%', height: 'calc(100vh - 64px)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                    <Suspense fallback={<TabLoader />}>
                      <AdminDashboard />
                    </Suspense>
                  </div>
                ) : (
                  <PermissionDenied onBack={() => setActiveTab('Markets')} />
                )
              )}
              {(activeTab === 'Legal' || activeTab === 'Privacy') && (
                <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-main)' }}>
                  <Suspense fallback={<TabLoader />}>
                    <LegalView initialTab="privacy" onBack={() => setActiveTab('Markets')} />
                  </Suspense>
                </div>
              )}
              </main>
            </div>
          </div>
        </>
      )}

      <Suspense fallback={null}>
        {orderModal?.isOpen && <OrderModal />}
        {editOrderModal?.isOpen && <EditOrderModal />}
        {showDepositModal && <DepositModal onClose={() => setShowDepositModal(false)} />}
        {marketDepthModal?.isOpen && <MarketDepthModal />}
        {domLadderModal?.isOpen && <DOMLadderModal />}
        {chartModalSymbol && <ChartModal />}
        {mobileStockOverviewSymbol && <MobileStockOverviewModal />}
        {alertModalSymbol && <AlertModal />}
        {basketModalOpen && <BasketModal />}
        {user && isLocked && isUserPinEnabled(user.id) && (
          <BiometricLockModal onUnlock={() => setIsLocked(false)} />
        )}
      </Suspense>

      {/* Real-time Broadcast Toast */}
      <BroadcastToast />

      {/* Slide-out Notification Drawer */}
      <NotificationDrawer
        isOpen={notificationDrawerOpen}
        onClose={() => setNotificationDrawerOpen(false)}
        onOpenBroadcastModal={() => {
          setNotificationDrawerOpen(false);
          setBroadcastModalOpen(true);
        }}
      />

      {/* Broadcast Studio Modal for Admin */}
      {broadcastModalOpen && (
        <BroadcastModal
          isOpen={broadcastModalOpen}
          onClose={() => setBroadcastModalOpen(false)}
        />
      )}
      
      {/* Mobile Menu Overlay */}
      <div className={`mobile-menu-overlay ${showMobileMenu ? 'open' : ''}`}>
        <div className="mobile-menu-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => { setActiveTab('ClientData'); setShowMobileMenu(false); }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-panel)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
              {user?.profile_picture_url ? <img src={user.profile_picture_url} alt="User Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={20} />}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{user.username}</span>
                {['HIGHEST', 'FEATURE'].includes(user.subscription_tier) && (
                  <span style={{ fontSize: '10px', background: 'linear-gradient(135deg, #f59e0b, #a855f7)', color: 'white', padding: '2px 6px', borderRadius: '12px', fontWeight: '800' }}>👑 VIP</span>
                )}
                {user.subscription_tier === 'YEARLY' && (
                  <span style={{ fontSize: '10px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#000', padding: '2px 6px', borderRadius: '12px', fontWeight: '800' }}>⭐ YEARLY</span>
                )}
                {(user.subscription_tier === 'MONTHLY' || user.subscription_tier === 'PRO') && (
                  <span style={{ fontSize: '10px', background: 'var(--color-blue)', color: 'white', padding: '2px 6px', borderRadius: '12px', fontWeight: 'bold' }}>⚡ PRO</span>
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
            { label: 'Notifications', key: 'Notifications_Drawer', icon: Bell, badge: unreadNotificationsCount },
            { label: 'Trade Diary', key: 'TradeDiary', icon: BookOpen },
            { label: 'Markets', key: 'Markets', icon: TrendingUp },
            { label: 'Positions', key: 'Positions', icon: Briefcase },
            { label: 'Orders', key: 'Orders', icon: List },
            { label: 'Portfolio', key: 'Portfolio', icon: Briefcase },
            { label: 'Leaderboard', key: 'Leaderboard', icon: Trophy },
            { label: 'Trading Journal', key: 'Journal', icon: BookOpen },
            { label: 'Mutual Funds', key: 'MutualFunds', icon: CircleDollarSign },
            { label: 'Reports', key: 'Reports', icon: FileText },
            { label: 'Referrals', key: 'Referrals', icon: Gift },
            { label: 'Pricing', key: 'Pricing', icon: Star },
            { label: 'About Us', key: 'AboutUs', icon: Info },
            { label: 'Privacy & Legal', key: 'Legal', icon: Shield },
            ...(user?.is_admin ? [{ label: 'Admin Panel', key: 'AdminPanel', icon: ShieldCheck }] : [])
          ].map(tab => (
            <div 
              key={tab.label} 
              className="mobile-menu-item" 
              onClick={() => { 
                if (tab.key === 'Notifications_Drawer') {
                  setShowMobileMenu(false);
                  setNotificationDrawerOpen(true);
                  if (markAllNotificationsRead) markAllNotificationsRead();
                } else {
                  setActiveTab(tab.key); 
                  setShowMobileMenu(false); 
                }
              }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <tab.icon size={20} />
                {tab.label}
              </div>
              {tab.badge > 0 && (
                <span style={{
                  background: '#ef4444',
                  color: '#fff',
                  fontSize: '10.5px',
                  fontWeight: '800',
                  borderRadius: '12px',
                  padding: '2px 8px'
                }}>
                  {tab.badge}
                </span>
              )}
            </div>
          ))}
          <div className="mobile-menu-item" onClick={logout} style={{ color: 'var(--color-red)', marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <LogOut size={20} />
            Logout
          </div>
        </div>
      </div>
      
      {/* Mobile Bottom Navigation (Only for Paper Trading Terminal) */}
      {activeTab !== 'TradeDiary' && (
        <div className="mobile-bottom-nav">
          <div className={`mobile-nav-item ${activeTab === 'Markets' || activeTab === 'Watchlist' ? 'active' : ''}`} onClick={() => setActiveTab('Watchlist')}>
            <List size={20} />
            <span>Watchlist</span>
          </div>
          <div className={`mobile-nav-item ${activeTab === 'Positions' ? 'active' : ''}`} onClick={() => setActiveTab('Positions')}>
            <Layers size={20} />
            <span>Positions</span>
          </div>
          <div className={`mobile-nav-item ${activeTab === 'Orders' ? 'active' : ''}`} onClick={() => setActiveTab('Orders')}>
            <FileText size={20} />
            <span>Orders</span>
          </div>
          <div className={`mobile-nav-item ${activeTab === 'Portfolio' ? 'active' : ''}`} onClick={() => setActiveTab('Portfolio')}>
            <Briefcase size={20} />
            <span>Portfolio</span>
          </div>
          <div className={`mobile-nav-item ${activeTab === 'ClientData' ? 'active' : ''}`} onClick={() => setActiveTab('ClientData')}>
            <User size={20} />
            <span>Profile</span>
          </div>
        </div>
      )}

      {/* DPDP Act 2023 & GDPR Cookie / Privacy Consent Banner */}
      <Suspense fallback={null}>
        <ConsentBanner />
      </Suspense>
    </div>
  );
}

export default App;

