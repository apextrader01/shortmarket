import { registerServiceWorker } from './services/pushManager';
import React, { useEffect, useState, useMemo, Suspense, lazy } from 'react';
import MarketWatch from './components/MarketWatch';
import LoginView from './components/LoginView';
import ErrorBoundary from './components/ErrorBoundary';
import { getInstantLotsize } from './utils/lotsizeHelper';
import { playTargetHitSound } from './utils/soundManager';
import { applyDynamicSEO } from './utils/seoEngine';
import logoImg from './assets/logo.png';

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

// ⚡ Lazy Loaded Dashboard Views for Sub-2s Mobile LCP & Fast Initial Paint
const ChartWidget = lazyWithRetry(() => import('./components/ChartWidget'));
const PositionsView = lazyWithRetry(() => import('./components/PositionsView'));
const OrdersView = lazyWithRetry(() => import('./components/OrdersView'));
const PortfolioView = lazyWithRetry(() => import('./components/PortfolioView'));
const ClientDataView = lazyWithRetry(() => import('./components/ClientDataView'));
const OptionChainView = lazyWithRetry(() => import('./components/OptionChainView'));
const MutualFundsView = lazyWithRetry(() => import('./components/MutualFundsView'));
const AnalyticsView = lazyWithRetry(() => import('./components/AnalyticsView'));
const LeaderboardView = lazyWithRetry(() => import('./components/LeaderboardView'));
const PricingView = lazyWithRetry(() => import('./components/PricingView'));
const AboutUsView = lazyWithRetry(() => import('./components/AboutUsView'));
const ReferralsView = lazyWithRetry(() => import('./components/ReferralsView'));
const OrderModal = lazyWithRetry(() => import('./components/OrderModal'));
const EditOrderModal = lazyWithRetry(() => import('./components/EditOrderModal'));
const DepositModal = lazyWithRetry(() => import('./components/DepositModal'));
const BasketModal = lazyWithRetry(() => import('./components/BasketModal'));
const BroadcastToast = lazyWithRetry(() => import('./components/BroadcastToast'));
const NotificationDrawer = lazyWithRetry(() => import('./components/NotificationDrawer'));
const BroadcastModal = lazyWithRetry(() => import('./components/BroadcastModal'));

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
const TradeDiaryView = lazyWithRetry(() => import('./components/TradeDiaryView'));
const TradingJournalView = lazyWithRetry(() => import('./components/TradingJournalView'));
const ReportsView = lazyWithRetry(() => import('./components/ReportsView'));
const NotFoundView = lazyWithRetry(() => import('./components/NotFoundView'));
const LandingHomeView = lazyWithRetry(() => import('./components/LandingHomeView'));
const PrimaryMarketsView = lazyWithRetry(() => import('./components/PrimaryMarketsView'));
const FinancialCalculatorsModal = lazyWithRetry(() => import('./components/FinancialCalculatorsModal'));
const BrokerConnectModal = lazyWithRetry(() => import('./components/BrokerConnectModal'));
const WealthPersonalFinanceModal = lazyWithRetry(() => import('./components/WealthPersonalFinanceModal'));
const MutualFundsExplorerModal = lazyWithRetry(() => import('./components/MutualFundsExplorerModal'));
const AlgoBridgeDashboardModal = lazyWithRetry(() => import('./components/AlgoBridgeDashboardModal'));
const SkandxAlgoView = lazyWithRetry(() => import('./components/SkandxAlgoView'));
const CalculatorsSuiteView = lazyWithRetry(() => import('./components/CalculatorsSuiteView'));
const AdBannerWidget = lazyWithRetry(() => import('./components/AdBannerWidget'));
const GlobalAdInterstitial = lazyWithRetry(() => import('./components/AdBannerWidget').then(m => ({ default: m.GlobalAdInterstitial })));

const TabLoader = () => (
  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '14px', minHeight: '350px', color: 'var(--text-secondary)' }}>
    <div style={{ width: '32px', height: '32px', border: '3px solid rgba(59, 130, 246, 0.15)', borderTopColor: 'var(--color-blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', letterSpacing: '0.3px' }}>Loading...</span>
  </div>
);

import NetworkStatusBanner from './components/NetworkStatusBanner';
import SessionExpiredModal from './components/SessionExpiredModal';
import PermissionDenied from './components/PermissionDenied';
import GlobalToast from './components/GlobalToast';
import { isUserPinEnabled, isAppLocked, setAppLocked, getAutoLockDuration, recordUserActivity } from './utils/biometricAuth';
import { useStore } from './store';
import { useShallow } from 'zustand/react/shallow';
import { TrendingUp, TrendingDown, LogOut, User, Briefcase, List, CircleDollarSign, Menu, X, Trophy, FileText, Gift, Star, Info, Shield, ShieldCheck, BookOpen, Layers, Bell, Home, Building2, Calculator, Link2, Sparkles, Cpu } from 'lucide-react';

const TOP_INDICES = ['NSE:NIFTY50-INDEX', 'NSE:NIFTYBANK-INDEX', 'BSE:SENSEX-INDEX'];

// ⚡ Isolated Index Chip: Only re-renders when its own index ticks
const IndexChip = React.memo(({ label, price }) => {
  const isUp = price?.pct >= 0;
  return (
    <div
      style={{
        display:        'flex',
        flexDirection:  'column',
        justifyContent: 'center',
        background:     price
          ? (isUp ? 'rgba(34,197,94,0.12)' : 'rgba(225,42,31,0.12)')
          : 'rgba(255,255,255,0.05)',
        color: price
          ? (isUp ? 'var(--color-green-light)' : 'var(--color-red-light)')
          : 'var(--text-secondary)',
        padding:        '2px 6px',
        borderRadius:   '8px',
        fontSize:       '9px',
        fontWeight:     '700',
        lineHeight:     '1.2',
        whiteSpace:     'nowrap',
        flexShrink:     0
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
        {price && (isUp ? <TrendingUp size={9} /> : <TrendingDown size={9} />)}
        <span>{label}</span>
        {price && price.pct !== undefined && !isNaN(price.pct) && (
          <span style={{ opacity: 0.85, fontSize: '8.5px' }}>
            ({Number(price.pct || 0) > 0 ? '+' : ''}{Number(price.pct || 0).toFixed(2)}%)
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '9.5px' }}>
        <span>{price && price.ltp !== undefined && !isNaN(price.ltp) ? Number(price.ltp).toFixed(2) : '...'}</span>
        {price && price.change !== undefined && !isNaN(price.change) && (
          <span style={{ opacity: 0.8, fontSize: '8.5px' }}>
            {Number(price.change) > 0 ? '+' : ''}{Number(price.change).toFixed(2)}
          </span>
        )}
      </div>
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
        gap: '4px',
        padding: '2px 6px',
        borderRadius: '10px',
        background: isConnected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
        border: `1px solid ${isConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
        fontSize: '9px',
        fontWeight: '700',
        color: isConnected ? '#10b981' : '#f59e0b',
        letterSpacing: '0.3px',
        whiteSpace: 'nowrap',
        userSelect: 'none'
      }}
    >
      <span
        style={{
          width: '5px',
          height: '5px',
          borderRadius: '50%',
          background: isConnected ? '#10b981' : '#f59e0b',
          boxShadow: isConnected ? '0 0 6px #10b981' : '0 0 6px #f59e0b',
          display: 'inline-block'
        }}
      />
      <span>{isConnected ? 'LIVE' : 'PARTIAL'}</span>
    </div>
  );
});

// ⚡ Top Index Ticker Container
const TopIndexTicker = React.memo(() => {
  const nifty = useStore(state => state.prices['NSE:NIFTY50-INDEX']);
  const banknifty = useStore(state => state.prices['NSE:NIFTYBANK-INDEX']);
  const sensex = useStore(state => state.prices['BSE:SENSEX-INDEX']);

  return (
    <div className="hide-on-tablet" style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
      <IndexChip label="NIFTY50" price={nifty} />
      <IndexChip label="BANKNIFTY" price={banknifty} />
      <IndexChip label="SENSEX" price={sensex} />
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

  // Ensure active alert symbols are actively streaming ticks and have current price snapshots
  useEffect(() => {
    if (activeAlertSymbols.length > 0) {
      const { subscribeToSymbol, fetchBatchPrices, pingSubscriptions } = useStore.getState();
      activeAlertSymbols.forEach(sym => {
        if (typeof subscribeToSymbol === 'function') subscribeToSymbol(sym);
      });
      if (typeof fetchBatchPrices === 'function') {
        fetchBatchPrices(activeAlertSymbols);
      }
      if (typeof pingSubscriptions === 'function') {
        pingSubscriptions();
      }
    }
  }, [activeAlertSymbols]);

  useEffect(() => {
    if (!alerts || alerts.length === 0) return;
    const activeAlerts = alerts.filter(a => !a.triggered);
    activeAlerts.forEach(alert => {
      const clean = alert.symbol.includes(':') ? alert.symbol.split(':')[1] : alert.symbol;
      const priceData = alertPrices[alert.symbol] || alertPrices[clean] || alertPrices[`NSE:${clean}`] || alertPrices[`BSE:${clean}`] || alertPrices[`MCX:${clean}`];
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
        try { playTargetHitSound(); } catch (_) {}
        useStore.getState().showToast(
          `${alert.symbol} reached target ₹${alert.targetPrice} (${alert.condition.toLowerCase()} trigger). Current price: ₹${ltp.toFixed(2)}`,
          'info',
          '🚨 Price Alert Triggered!'
        );
        if ("Notification" in window && Notification.permission === "granted") {
          try {
            new Notification("Price Alert Triggered! 🚨", {
              body: `${alert.symbol} crossed ${alert.condition.toLowerCase()} ₹${alert.targetPrice}. Current price is ₹${ltp.toFixed(2)}`,
              icon: '/logo.png'
            });
          } catch (_) {}
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
  const isStagingEnv = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.location.hostname.includes('staging') ||
      window.location.port === '5001' ||
      Boolean(import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.includes('staging'))
    );
  }, []);

  useEffect(() => {
    registerServiceWorker();
  }, []);
  const { user, logout, initSocket, fetchUserData, refreshPrices, fetchBatchPrices, selectedSymbol, theme, setTheme, orderModal, editOrderModal, purgeStaleDailyAlerts, fontSize, setFontSize, hasSkippedOnboarding, announcement, fetchAnnouncement, marketDepthModal, domLadderModal, chartModalSymbol, mobileStockOverviewSymbol, alertModalSymbol, basketModalOpen, unreadNotificationsCount, markAllNotificationsRead, fetchBroadcastNotifications } = useStore(useShallow(state => ({ user: state.user, logout: state.logout, initSocket: state.initSocket, fetchUserData: state.fetchUserData, refreshPrices: state.refreshPrices, fetchBatchPrices: state.fetchBatchPrices, selectedSymbol: state.selectedSymbol, theme: state.theme, setTheme: state.setTheme, orderModal: state.orderModal, editOrderModal: state.editOrderModal, purgeStaleDailyAlerts: state.purgeStaleDailyAlerts, fontSize: state.fontSize, setFontSize: state.setFontSize, hasSkippedOnboarding: state.hasSkippedOnboarding, announcement: state.announcement, fetchAnnouncement: state.fetchAnnouncement, marketDepthModal: state.marketDepthModal, domLadderModal: state.domLadderModal, chartModalSymbol: state.chartModalSymbol, mobileStockOverviewSymbol: state.mobileStockOverviewSymbol, alertModalSymbol: state.alertModalSymbol, basketModalOpen: state.basketModalOpen, unreadNotificationsCount: state.unreadNotificationsCount, markAllNotificationsRead: state.markAllNotificationsRead, fetchBroadcastNotifications: state.fetchBroadcastNotifications })));

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
        return isAppLocked(u.id);
      }
    } catch (e) {}
    return false;
  });

  // Configurable Inactivity & Background Auto-Lock Listener (Throttled to 5s to eliminate 144Hz mouse churn)
  useEffect(() => {
    if (!user || !isUserPinEnabled(user.id)) return;

    recordUserActivity(user.id);

    let lastActivityThrottled = Date.now();
    const updateActivity = () => {
      const now = Date.now();
      if (now - lastActivityThrottled > 5000) {
        lastActivityThrottled = now;
        recordUserActivity(user.id);
      }
    };

    const checkInactivity = () => {
      const lockMinutes = getAutoLockDuration(user.id);
      if (lockMinutes === -1) return; // -1 = Off

      if (isAppLocked(user.id)) {
        setAppLocked(true, user.id);
        setIsLocked(true);
      }
    };

    const handleVisibility = () => {
      const lockMinutes = getAutoLockDuration(user.id);
      if (lockMinutes === -1) return; // Disabled

      if (document.hidden) {
        recordUserActivity(user.id);
        if (lockMinutes === 0) {
          setAppLocked(true, user.id);
          setIsLocked(true);
        }
      } else {
        if (isAppLocked(user.id)) {
          setAppLocked(true, user.id);
          setIsLocked(true);
        } else {
          recordUserActivity(user.id);
        }
      }
    };

    const handleBeforeUnload = () => {
      recordUserActivity(user.id);
      const lockMinutes = getAutoLockDuration(user.id);
      if (lockMinutes === 0) {
        setAppLocked(true, user.id);
      }
    };

    const handleCustomLock = () => {
      setAppLocked(true, user.id);
      setIsLocked(true);
    };

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    activityEvents.forEach(evt => window.addEventListener(evt, updateActivity, { passive: true }));

    const interval = setInterval(checkInactivity, 5000); // Check every 5s

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('skandx_lock_app', handleCustomLock);
    window.addEventListener('shortmarket_lock_app', handleCustomLock);

    return () => {
      activityEvents.forEach(evt => window.removeEventListener(evt, updateActivity));
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('skandx_lock_app', handleCustomLock);
      window.removeEventListener('shortmarket_lock_app', handleCustomLock);
    };
  }, [user?.id]);

  const [activeTab, setActiveTab] = useState(() => {
    const rawPath = window.location.pathname.replace(/^\/+|\/+$/g, '');
    if (!rawPath || rawPath === 'home') return 'Home';
    const firstSeg = rawPath.split('/')[0].toLowerCase();
    
    // Convert path to Match exact tab case (e.g. 'mutualfunds' -> 'MutualFunds')
    const tabsMap = {
      'home': 'Home',
      'calculators': 'Calculators', 'calculator': 'Calculators',
      'wealth': 'WealthOS', 'wealth-hub': 'WealthOS', 'wealth-os': 'WealthOS', 'wealthos': 'WealthOS', 'tax-hub': 'WealthOS',
      'algo': 'Algo', 'algo-trading': 'Algo', 'skandx-algo': 'Algo', 'skandxalgo': 'Algo', 'bridge': 'Algo',
      'tradediary': 'TradeDiary', 'trade-diary': 'TradeDiary',
      'primarymarkets': 'PrimaryMarkets', 'primary-markets': 'PrimaryMarkets', 'bhavcopy': 'PrimaryMarkets', 'ipo': 'PrimaryMarkets', 'ipos': 'PrimaryMarkets',
      'journal': 'Journal', 'tradingjournal': 'Journal', 'trading-journal': 'Journal',
      'markets': 'Markets', 'paper-trading': 'Markets', 'papertrading': 'Markets',
      'options': 'Options', 'positions': 'Positions',
      'orders': 'Orders', 'portfolio': 'Portfolio', 'alerts': 'Orders',
      'analytics': 'Analytics', 'mutualfunds': 'MutualFunds', 'pricing': 'Pricing', 'referrals': 'Referrals',
      'leaderboard': 'Leaderboard',
      'adminpanel': 'AdminPanel', 'clientdata': 'ClientData', 'settings': 'Settings',
      'reports': 'Reports',
      'aboutus': 'AboutUs', 'about': 'AboutUs'
    };
    return tabsMap[rawPath.toLowerCase()] || tabsMap[firstSeg] || 'Home';
  });
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showCalculatorsModal, setShowCalculatorsModal] = useState(false);
  const [calculatorsInitialTab, setCalculatorsInitialTab] = useState('SIP');
  const [calculatorsInitialType, setCalculatorsInitialType] = useState(() => {
    if (typeof window !== 'undefined' && window.location.pathname.toLowerCase().startsWith('/calculators/')) {
      const slug = window.location.pathname.split('/')[2]?.toLowerCase();
      if (slug) return slug;
    }
    return 'all';
  });
  const [tradeDiaryInitialTab, setTradeDiaryInitialTab] = useState('DASHBOARD');
  const [primaryMarketsInitialTab, setPrimaryMarketsInitialTab] = useState('BHAVCOPY');
  const [algoInitialTab, setAlgoInitialTab] = useState('Dashboard');
  const [showBrokerConnectModal, setShowBrokerConnectModal] = useState(false);
  const [showWealthModal, setShowWealthModal] = useState(false);
  const [wealthInitialTab, setWealthInitialTab] = useState('NET_WORTH');
  const [showMutualFundsModal, setShowMutualFundsModal] = useState(false);
  const [showAlgoBridgeModal, setShowAlgoBridgeModal] = useState(false);

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
      const currentPathname = window.location.pathname;
      const lowerPath = currentPathname.toLowerCase();
      const seg0 = (lowerPath.split('/')[1] || '').split('?')[0];

      // Do NOT overwrite standalone legal, auth, referral, callback, or unknown 404 routes
      const standaloneSegments = new Set([
        'privacy', 'privacy-policy', 'privacypolicy',
        'terms', 'terms-of-service', 'termsofservice',
        'delete', 'delete-account', 'deleteaccount',
        'risk', 'risk-policy', 'riskpolicy', 'risk-disclosure',
        'data', 'data-rights', 'datarights',
        'accessibility', 'legal',
        'login', 'register', 'signup', 'forgot', 'reset', 'ref'
      ]);
      const knownSet = new Set([
        '', 'home', 'login', 'register', 'signup', 'forgot', 'reset',
        'calculators', 'calculator',
        'wealth', 'wealth-hub', 'wealth-os', 'wealthos', 'tax-hub',
        'algo', 'algo-trading', 'skandx-algo', 'skandxalgo', 'bridge',
        'markets', 'paper-trading', 'papertrading', 'watchlist', 'chart', 'options', 'optionchain', 'option-chain',
        'positions', 'orders', 'portfolio', 'alerts', 'analytics', 'mutualfunds', 'mutual-funds',
        'pricing', 'referrals', 'leaderboard', 'journal', 'tradingjournal', 'trading-journal',
        'tradediary', 'trade-diary', 'primarymarkets', 'primary-markets', 'bhavcopy', 'ipo', 'ipos',
        'adminpanel', 'clientdata', 'profile', 'account', 'settings',
        'reports', 'aboutus', 'about', 'terms', 'terms-of-service', 'termsofservice', 'privacy', 'privacy-policy', 'privacypolicy',
        'risk', 'riskpolicy', 'risk-policy', 'risk-disclosure', 'delete', 'delete-account', 'deleteaccount',
        'data', 'data-rights', 'datarights', 'legal', 'accessibility', 'manifest.webmanifest',
        'manifest', 'sitemap.xml', 'sitemap', 'robots.txt', 'robots', 'sw.js', 'ref'
      ]);
      const isKnown = !lowerPath || lowerPath === '/' || knownSet.has(seg0) || lowerPath.startsWith('/ref/') || lowerPath.startsWith('/api/');
      if (standaloneSegments.has(seg0) || lowerPath.startsWith('/ref/') || lowerPath.startsWith('/api/') || !isKnown) {
        applyDynamicSEO(window.location.pathname);
        return;
      }

      let newPath = '/';
      if (activeTab === 'Home') newPath = '/';
      else if (activeTab === 'Calculators') newPath = '/calculators';
      else if (activeTab === 'WealthOS') newPath = ['wealth', 'wealth-hub', 'wealth-os', 'wealthos', 'tax-hub'].includes(seg0) ? `/${seg0}` : '/wealth-hub';
      else if (activeTab === 'Algo') newPath = ['algo', 'algo-trading', 'skandx-algo', 'skandxalgo', 'bridge'].includes(seg0) ? `/${seg0}` : '/algo';
      else if (activeTab === 'TradeDiary') newPath = ['tradediary', 'trade-diary'].includes(seg0) ? `/${seg0}` : '/trade-diary';
      else if (activeTab === 'PrimaryMarkets') newPath = ['primarymarkets', 'primary-markets', 'bhavcopy', 'ipo', 'ipos'].includes(seg0) ? `/${seg0}` : '/primary-markets';
      else if (activeTab === 'Markets') newPath = ['markets', 'paper-trading', 'papertrading'].includes(seg0) ? `/${seg0}` : '/markets';
      else if (activeTab === 'Journal') newPath = ['journal', 'tradingjournal', 'trading-journal'].includes(seg0) ? `/${seg0}` : '/journal';
      else if (activeTab === 'AboutUs') newPath = ['aboutus', 'about'].includes(seg0) ? `/${seg0}` : '/aboutus';
      else newPath = `/${activeTab.toLowerCase()}`;

      // Preserve deep-linked /calculators/:slug when already on Calculators tab
      const isAlreadyDeepCalc = activeTab === 'Calculators' && lowerPath.startsWith('/calculators/') && calculatorsInitialType && calculatorsInitialType !== 'all';
      const targetUrl = isAlreadyDeepCalc ? `/calculators/${calculatorsInitialType}` : newPath;

      if (currentPathname !== targetUrl) {
        window.history.pushState(null, '', targetUrl);
      }
      applyDynamicSEO(window.location.pathname);
    }
  }, [activeTab, calculatorsInitialType]);

  useEffect(() => {
    const handlePopState = () => {
      const rawPath = window.location.pathname.replace(/^\/+|\/+$/g, '');
      if (!rawPath || rawPath === 'home') {
        setActiveTab('Home');
        return;
      }
      const firstSeg = rawPath.split('/')[0].toLowerCase();
      if (firstSeg === 'calculators' || firstSeg === 'calculator') {
        const subSlug = rawPath.split('/')[1]?.toLowerCase();
        setCalculatorsInitialType(subSlug || 'all');
        setActiveTab('Calculators');
        return;
      }
      const tabsMap = {
        'home': 'Home',
        'calculators': 'Calculators', 'calculator': 'Calculators',
        'wealth': 'WealthOS', 'wealth-hub': 'WealthOS', 'wealth-os': 'WealthOS', 'wealthos': 'WealthOS', 'tax-hub': 'WealthOS',
        'algo': 'Algo', 'algo-trading': 'Algo', 'skandx-algo': 'Algo', 'skandxalgo': 'Algo', 'bridge': 'Algo',
        'tradediary': 'TradeDiary', 'trade-diary': 'TradeDiary',
        'primarymarkets': 'PrimaryMarkets', 'primary-markets': 'PrimaryMarkets', 'bhavcopy': 'PrimaryMarkets', 'ipo': 'PrimaryMarkets', 'ipos': 'PrimaryMarkets',
        'journal': 'Journal', 'tradingjournal': 'Journal', 'trading-journal': 'Journal',
        'markets': 'Markets', 'paper-trading': 'Markets', 'papertrading': 'Markets',
        'options': 'Options', 'positions': 'Positions',
        'orders': 'Orders', 'portfolio': 'Portfolio', 'alerts': 'Orders',
        'analytics': 'Analytics', 'mutualfunds': 'MutualFunds', 'pricing': 'Pricing', 'referrals': 'Referrals',
        'leaderboard': 'Leaderboard',
        'adminpanel': 'AdminPanel', 'clientdata': 'ClientData', 'settings': 'Settings',
        'reports': 'Reports',
        'aboutus': 'AboutUs', 'about': 'AboutUs'
      };
      setActiveTab(tabsMap[rawPath.toLowerCase()] || tabsMap[firstSeg] || 'Home');
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
    purgeStaleDailyAlerts();
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
    '', 'home', 'login', 'register', 'signup', 'forgot', 'reset',
    'calculators', 'calculator',
    'wealth', 'wealth-hub', 'wealth-os', 'wealthos', 'tax-hub',
    'algo', 'algo-trading', 'skandx-algo', 'skandxalgo', 'bridge',
    'markets', 'paper-trading', 'papertrading', 'watchlist', 'chart', 'options', 'optionchain', 'option-chain',
    'positions', 'orders', 'portfolio', 'alerts', 'analytics', 'mutualfunds', 'mutual-funds',
    'pricing', 'referrals', 'leaderboard', 'journal', 'tradingjournal', 'trading-journal',
    'tradediary', 'trade-diary', 'primarymarkets', 'primary-markets', 'bhavcopy', 'ipo', 'ipos',
    'adminpanel', 'clientdata', 'profile', 'account', 'settings',
    'reports', 'aboutus', 'about', 'terms', 'terms-of-service', 'termsofservice', 'privacy', 'privacy-policy', 'privacypolicy',
    'risk', 'riskpolicy', 'risk-policy', 'risk-disclosure', 'delete', 'delete-account', 'deleteaccount',
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
      Home: 'SkandX | Next-Gen Paper Trading & Wealth Operating System',
      Calculators: 'Financial Calculators Suite & Amortization Terminal | SkandX',
      WealthOS: 'Wealth OS & Tax Hub — Net Worth, ITR Tax Saving & FIRE Planner | SkandX',
      Algo: 'SkandX Algo Trading Bridge — TradingView Webhook to Zerodha, Angel, Upstox | SkandX',
      Markets: 'Live Markets & Paper Trading | SkandX',
      PrimaryMarkets: 'Primary Markets, Bhavcopy & IPO Hub | SkandX',
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

    if (currentPath.includes('terms')) {
      document.title = 'Terms of Service | SkandX';
    } else if (currentPath.includes('privacy')) {
      document.title = 'Privacy Policy | SkandX';
    } else if (currentPath.includes('delete')) {
      document.title = 'Request Account Deletion & Data Purge | SkandX';
    } else if (currentPath.includes('risk')) {
      document.title = 'Risk Disclosure Document | SkandX';
    } else if (currentPath.includes('data')) {
      document.title = 'Data Principal Rights Portal (DPDP Act) | SkandX';
    } else if (currentPath.includes('accessibility')) {
      document.title = 'Accessibility Statement | SkandX';
    } else if (!user) {
      if (cleanFirstSegment === 'pricing') {
        document.title = 'Subscription Plans & Pricing | SkandX';
      } else if (cleanFirstSegment === 'aboutus' || cleanFirstSegment === 'about') {
        document.title = 'About Us & Company Disclosures | SkandX';
      } else if (!isKnownRoute && currentPath !== '') {
        document.title = '404 - Page Not Found | SkandX';
      } else {
        document.title = "SkandX | India's #1 Real-Time Paper Trading & Algo Terminal";
      }
    } else {
      document.title = tabTitleMap[activeTab] || "SkandX | India's #1 Real-Time Paper Trading & Algo Terminal";
    }
    applyDynamicSEO(window.location.pathname);
  }, [activeTab, user, currentPath, cleanFirstSegment, isKnownRoute]);

  // Public Legal & Compliance routes (Accessible without login for Google Play reviewers and search bots)
  const legalRouteSegments = new Set([
    'privacy', 'privacy-policy', 'privacypolicy',
    'terms', 'terms-of-service', 'termsofservice',
    'delete', 'delete-account', 'deleteaccount',
    'risk', 'risk-policy', 'riskpolicy', 'risk-disclosure',
    'data', 'data-rights', 'datarights',
    'accessibility', 'legal'
  ]);
  if (
    legalRouteSegments.has(cleanFirstSegment) ||
    currentPath.includes('privacy') || 
    currentPath.includes('terms') || 
    currentPath.includes('delete-account') || 
    currentPath.includes('deleteaccount') || 
    currentPath.includes('risk-policy') || 
    currentPath.includes('riskpolicy') ||
    currentPath.includes('risk-disclosure') ||
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
  if (cleanFirstSegment === 'pricing' && !user) {
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

  if ((cleanFirstSegment === 'aboutus' || cleanFirstSegment === 'about') && !user) {
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

  // Public Google Search Crawlable Tool Routes (/calculators/*, /wealth-hub, /algo-trading, /primary-markets, /trade-diary)
  if (!user && (cleanFirstSegment === 'calculators' || cleanFirstSegment === 'calculator')) {
    const slug = currentPath.split('/')[2] || 'all';
    return (
      <Suspense fallback={<TabLoader />}>
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary, #0a0b0d)' }}>
          <CalculatorsSuiteView
            initialType={slug}
            onBack={() => { window.location.href = '/'; }}
            onOpenPaperTrading={() => { window.location.href = '/login'; }}
          />
          <Suspense fallback={null}>
            <ConsentBanner />
          </Suspense>
        </div>
      </Suspense>
    );
  }

  if (!user && ['wealth', 'wealth-hub', 'wealth-os', 'wealthos', 'tax-hub'].includes(cleanFirstSegment)) {
    return (
      <Suspense fallback={<TabLoader />}>
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary, #0a0b0d)' }}>
          <WealthPersonalFinanceModal
            isFullPage={true}
            initialTab="NET_WORTH"
            onBack={() => { window.location.href = '/'; }}
            onOpenPaperTrading={() => { window.location.href = '/login'; }}
            onOpenCalculators={() => { window.location.href = '/calculators'; }}
          />
          <Suspense fallback={null}>
            <ConsentBanner />
          </Suspense>
        </div>
      </Suspense>
    );
  }

  if (!user && ['algo', 'algo-trading', 'skandx-algo', 'skandxalgo', 'bridge'].includes(cleanFirstSegment)) {
    return (
      <Suspense fallback={<TabLoader />}>
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary, #0a0b0d)' }}>
          <SkandxAlgoView
            initialTab="Dashboard"
            onBack={() => { window.location.href = '/'; }}
            onOpenPaperTrading={() => { window.location.href = '/login'; }}
          />
          <Suspense fallback={null}>
            <ConsentBanner />
          </Suspense>
        </div>
      </Suspense>
    );
  }

  if (!user && ['primarymarkets', 'primary-markets', 'bhavcopy', 'ipo', 'ipos'].includes(cleanFirstSegment)) {
    return (
      <Suspense fallback={<TabLoader />}>
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary, #0a0b0d)' }}>
          <PrimaryMarketsView
            initialTab={cleanFirstSegment.includes('ipo') ? 'IPOS' : 'BHAVCOPY'}
            onBack={() => { window.location.href = '/'; }}
            onOpenPaperTrading={() => { window.location.href = '/login'; }}
          />
          <Suspense fallback={null}>
            <ConsentBanner />
          </Suspense>
        </div>
      </Suspense>
    );
  }

  if (!user && ['tradediary', 'trade-diary'].includes(cleanFirstSegment)) {
    return (
      <Suspense fallback={<TabLoader />}>
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary, #0a0b0d)' }}>
          <TradeDiaryView
            initialTab="DASHBOARD"
            onBack={() => { window.location.href = '/'; }}
            onOpenPaperTrading={() => { window.location.href = '/login'; }}
            onOpenProfile={() => { window.location.href = '/login'; }}
            onNavigate={() => { window.location.href = '/login'; }}
          />
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

  const isScrollableTab = ['Home', 'PrimaryMarkets', 'TradeDiary', 'Calculators', 'WealthOS'].includes(activeTab);

  return (
    <div 
      className={`app-container ${isScrollableTab ? 'scrollable-page' : ''}`} 
      data-theme={theme} 
      style={{ 
        flexDirection: 'column', 
        color: 'var(--text-primary)', 
        backgroundColor: 'var(--bg-primary)',
        height: '100vh',
        overflowY: isScrollableTab ? 'auto' : 'hidden',
        overflowX: 'hidden'
      }}
    >
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

      {activeTab === 'Home' ? (
        <Suspense fallback={<TabLoader />}>
          <LandingHomeView 
            onOpenPaperTrading={() => setActiveTab('Markets')} 
            onOpenTradeDiary={(tab) => {
              setTradeDiaryInitialTab(tab || 'DASHBOARD');
              setActiveTab('TradeDiary');
            }} 
            onOpenPrimaryMarkets={(tab) => {
              setPrimaryMarketsInitialTab(tab || 'BHAVCOPY');
              setActiveTab('PrimaryMarkets');
            }} 
            onOpenCalculators={(tab) => {
              setCalculatorsInitialType(tab || 'all');
              setActiveTab('Calculators');
            }} 
            onOpenBrokerConnect={() => setShowBrokerConnectModal(true)} 
            onOpenWealthFinance={(tab) => {
              setWealthInitialTab(tab || 'NET_WORTH');
              setActiveTab('WealthOS');
            }} 
            onOpenMutualFunds={() => setShowMutualFundsModal(true)} 
            onOpenLeaderboard={() => setActiveTab('Leaderboard')} 
            onOpenAlgoBridge={(tab) => {
              setAlgoInitialTab(tab || 'Dashboard');
              setActiveTab('Algo');
            }} 
          />
        </Suspense>
      ) : activeTab === 'PrimaryMarkets' ? (
        <Suspense fallback={<TabLoader />}>
          <PrimaryMarketsView 
            initialTab={primaryMarketsInitialTab}
            onOpenPaperTrading={() => setActiveTab('Markets')} 
            onBack={() => setActiveTab('Home')} 
          />
          <AdBannerWidget onUpgradeClick={() => setActiveTab('Pricing')} />
        </Suspense>
      ) : activeTab === 'TradeDiary' ? (
        <Suspense fallback={<TabLoader />}>
          <TradeDiaryView 
            initialTab={tradeDiaryInitialTab}
            onOpenPaperTrading={() => setActiveTab('Markets')} 
            onBack={() => setActiveTab('Home')} 
            onOpenProfile={() => setActiveTab('ClientData')}
            onNavigate={(tab) => setActiveTab(tab)}
          />
          <AdBannerWidget onUpgradeClick={() => setActiveTab('Pricing')} />
        </Suspense>
      ) : activeTab === 'Algo' ? (
        <Suspense fallback={<TabLoader />}>
          <SkandxAlgoView 
            initialTab={algoInitialTab}
            onBack={() => setActiveTab('Home')} 
            onOpenPaperTrading={() => setActiveTab('Markets')} 
          />
          <AdBannerWidget onUpgradeClick={() => setActiveTab('Pricing')} />
        </Suspense>
      ) : activeTab === 'Calculators' ? (
        <Suspense fallback={<TabLoader />}>
          <CalculatorsSuiteView 
            initialType={calculatorsInitialType}
            onBack={() => setActiveTab('Home')} 
            onOpenPaperTrading={() => setActiveTab('Markets')} 
          />
          <AdBannerWidget onUpgradeClick={() => setActiveTab('Pricing')} />
        </Suspense>
      ) : activeTab === 'WealthOS' ? (
        <Suspense fallback={<TabLoader />}>
          <WealthPersonalFinanceModal 
            isFullPage={true}
            initialTab={wealthInitialTab}
            onBack={() => setActiveTab('Home')} 
            onOpenPaperTrading={() => setActiveTab('Markets')}
            onOpenCalculators={(t) => {
              setCalculatorsInitialType(t || 'all');
              setActiveTab('Calculators');
            }}
          />
          <AdBannerWidget onUpgradeClick={() => setActiveTab('Pricing')} />
        </Suspense>
      ) : (
        <>
          <header className="topbar glass-header" style={{ width: '100%', flexShrink: 0, zIndex: 10, borderBottom: '1px solid var(--border-color)', padding: '0 10px', gap: '6px' }}>
              {/* Left: title + index pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '4px' }}>
                  <div 
                    onClick={() => setActiveTab('Home')}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}
                    title="SkandX Trading Platform"
                  >
                    <img 
                      src={logoImg} 
                      alt="SkandX Logo" 
                      style={{ width: '24px', height: '24px', borderRadius: '6px', boxShadow: '0 0 10px rgba(56, 189, 248, 0.35)' }} 
                    />
                    <span style={{ fontSize: '16px', fontWeight: '800', letterSpacing: '-0.5px', color: '#fff', fontFamily: "'Outfit', sans-serif" }}>
                      Skand<span style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #34d399 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>X</span>
                    </span>
                    {isStagingEnv && (
                      <span style={{
                        background: 'rgba(245, 158, 11, 0.18)',
                        color: '#f59e0b',
                        border: '1px solid rgba(245, 158, 11, 0.45)',
                        borderRadius: '4px',
                        padding: '1px 4px',
                        fontSize: '8.5px',
                        fontWeight: '800',
                        letterSpacing: '0.4px',
                        textTransform: 'uppercase',
                        lineHeight: '1.2'
                      }}>
                        STAGING
                      </span>
                    )}
                  </div>
                </div>

                <TopIndexTicker />
              </div>

              {/* Right: nav tabs + user info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, minWidth: 0 }}>
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
                <nav aria-label="Main Navigation" className="hide-on-mobile" style={{
                  display: 'flex', alignItems: 'center', gap: '2px',
                  fontSize: '9.5px', fontWeight: '700', marginRight: '2px', whiteSpace: 'nowrap'
                }}>
                  {[
                    { key: 'Home', label: 'Home' },
                    { key: 'Markets', label: 'Paper Trading' },
                    { key: 'TradeDiary', label: 'Trade Diary' },
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
                        letterSpacing:  '0.2px',
                        whiteSpace:     'nowrap'
                      }}
                    >
                      {tabItem.label}
                    </div>
                  ))}
                </nav>

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
                    borderRadius: '7px',
                    padding: '5px 6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: unreadNotificationsCount > 0 ? '#38bdf8' : 'var(--text-secondary)',
                    transition: 'all 0.2s ease',
                    height: '28px',
                    minWidth: '28px',
                    flexShrink: 0
                  }}
                  title="Notifications & Trade Signals"
                >
                  <Bell size={14} />
                  {unreadNotificationsCount > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      background: '#ef4444',
                      color: '#fff',
                      fontSize: '9px',
                      fontWeight: '800',
                      borderRadius: '10px',
                      minWidth: '15px',
                      height: '15px',
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
                  <Menu size={22} color="var(--text-primary)" />
                </div>

                {/* User avatar + logout */}
                <div className="hide-on-mobile" style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                  <div 
                    onClick={() => setActiveTab('ClientData')}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', padding: '3px 6px', borderRadius: '8px' }}
                    className="hover:bg-white/5 transition-colors"
                    title={user.username}
                  >
                    <div style={{
                      width: '24px', height: '24px', borderRadius: '50%',
                      background: 'var(--bg-panel)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '1px solid var(--border-color)', overflow: 'hidden', flexShrink: 0
                    }}>
                      {user?.profile_picture_url ? (
                        <img src={user.profile_picture_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <User size={13} color="var(--text-secondary)" />
                      )}
                    </div>
                    <div style={{ fontWeight: '700', fontSize: '11.5px', maxWidth: '85px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.username}
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
              {['Markets', 'Chart', 'Options', 'Watchlist', 'Positions', 'Orders', 'Portfolio', 'Reports', 'Leaderboard', 'MutualFunds', 'Analytics', 'Journal', 'Referrals', 'ClientData', 'Settings', 'AboutUs'].includes(activeTab) && (
                <Suspense fallback={null}>
                  <AdBannerWidget onUpgradeClick={() => setActiveTab('Pricing')} />
                </Suspense>
              )}
              </main>
            </div>
          </div>
        </>
      )}

      <Suspense fallback={null}>
        <ErrorBoundary>
          <GlobalAdInterstitial />
          {orderModal?.isOpen && <OrderModal />}
          {editOrderModal?.isOpen && <EditOrderModal />}
          {showDepositModal && <DepositModal onClose={() => setShowDepositModal(false)} />}
          {marketDepthModal?.isOpen && <MarketDepthModal />}
          {domLadderModal?.isOpen && <DOMLadderModal />}
          {chartModalSymbol && <ChartModal />}
          {mobileStockOverviewSymbol && <MobileStockOverviewModal />}
          {alertModalSymbol && <AlertModal />}
          {basketModalOpen && <BasketModal />}
          {showCalculatorsModal && (
            <FinancialCalculatorsModal 
              isOpen={showCalculatorsModal} 
              initialTab={calculatorsInitialTab}
              onClose={() => setShowCalculatorsModal(false)} 
              onOpenMutualFunds={() => {
                setShowCalculatorsModal(false);
                setShowMutualFundsModal(true);
              }}
            />
          )}
          {showBrokerConnectModal && (
            <BrokerConnectModal 
              isOpen={showBrokerConnectModal} 
              onClose={() => setShowBrokerConnectModal(false)} 
              onOpenMutualFunds={() => {
                setShowBrokerConnectModal(false);
                setShowMutualFundsModal(true);
              }}
            />
          )}
          {showMutualFundsModal && (
            <MutualFundsExplorerModal 
              isOpen={showMutualFundsModal} 
              onClose={() => setShowMutualFundsModal(false)} 
              onOpenSipCalculator={(fund) => {
                setShowMutualFundsModal(false);
                setCalculatorsInitialTab('SIP');
                setShowCalculatorsModal(true);
              }}
              onOpenPaperTradingMf={(fund) => {
                setShowMutualFundsModal(false);
                setActiveTab('MutualFunds');
              }}
            />
          )}
          {showWealthModal && (
            <WealthPersonalFinanceModal 
              isOpen={showWealthModal} 
              initialTab={wealthInitialTab}
              onClose={() => setShowWealthModal(false)} 
            />
          )}
          {showAlgoBridgeModal && (
            <AlgoBridgeDashboardModal 
              isOpen={showAlgoBridgeModal} 
              onClose={() => setShowAlgoBridgeModal(false)} 
            />
          )}
          {user && isLocked && isUserPinEnabled(user.id) && (
            <BiometricLockModal onUnlock={() => setIsLocked(false)} />
          )}
        </ErrorBoundary>
      </Suspense>

      {/* Real-time Broadcast Toast & Notifications */}
      <Suspense fallback={null}>
        <BroadcastToast />
        <NotificationDrawer
          isOpen={notificationDrawerOpen}
          onClose={() => setNotificationDrawerOpen(false)}
          onOpenBroadcastModal={() => {
            setNotificationDrawerOpen(false);
            setBroadcastModalOpen(true);
          }}
        />
        {broadcastModalOpen && (
          <BroadcastModal
            isOpen={broadcastModalOpen}
            onClose={() => setBroadcastModalOpen(false)}
          />
        )}
      </Suspense>
      
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
                {user.subscription_tier === 'LIFETIME' && (
                  <span style={{ fontSize: '10px', background: 'linear-gradient(135deg, #e11d48, #f59e0b)', color: 'white', padding: '2px 6px', borderRadius: '12px', fontWeight: '800' }}>👑 LIFETIME</span>
                )}
                {user.subscription_tier === 'MASTERCLASS' && (
                  <span style={{ fontSize: '10px', background: 'linear-gradient(135deg, #0d9488, #10b981)', color: 'white', padding: '2px 6px', borderRadius: '12px', fontWeight: '800' }}>🎓 MASTERCLASS</span>
                )}
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
            { label: 'Home', key: 'Home', icon: Home },
            { label: 'Paper Trading Terminal', key: 'Markets', icon: TrendingUp },
            { label: 'Trade Diary', key: 'TradeDiary', icon: BookOpen },
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
      {!['Home', 'TradeDiary', 'PrimaryMarkets', 'Calculators', 'Algo', 'WealthOS'].includes(activeTab) && (
        <nav aria-label="Mobile Navigation" className="mobile-bottom-nav">
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
        </nav>
      )}

      {/* DPDP Act 2023 & GDPR Cookie / Privacy Consent Banner */}
      <Suspense fallback={null}>
        <ConsentBanner />
      </Suspense>
    </div>
  );
}

export default App;

