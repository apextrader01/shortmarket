import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { io } from 'socket.io-client';
import { getInstantLotsize, updateLiveLotsizeMap, syncLiveLotsizeMap, setContractLotsize } from './utils/lotsizeHelper';
import { fetchClientPublicInfo, getCachedPublicIp, syncClientTelemetry } from './utils/clientTelemetry';
import { calculateOrderSlices, getFreezeLimit, updateLiveFreezeConfig, syncLiveFreezeConfig } from './utils/freezeLimits';
import { playTargetHitSound, playStopLossHitSound, playOrderExecutedSound } from './utils/soundManager';
import { setAppLocked } from './utils/biometricAuth';
import { filterStaleAlerts } from './utils/alertUtils';

export let API = '';
if (import.meta.env && import.meta.env.VITE_API_URL) {
  API = import.meta.env.VITE_API_URL.replace(/\/+$/, '');
} else if (typeof window !== 'undefined') {
  const isStaging = window.location.hostname.includes('staging') || window.location.port === '5001';
  if (isStaging) {
    API = 'https://staging.skandx.in';
  } else if (
    window.Capacitor?.isNativePlatform() ||
    window.location.protocol === 'capacitor:' ||
    (window.location.hostname === 'localhost' && window.location.port !== '5173')
  ) {
    // Standalone Android/iOS native mobile builds must talk to the production backend
    API = 'https://www.skandx.in';
  }
}

export function isIndexContract(sym) {
  if (!sym || typeof sym !== 'string') return false;
  const clean = sym.replace(/^(NSE:|BSE:|MCX:)/i, '').trim().toUpperCase();
  if (clean.includes('INDEX')) return true;
  const INDEX_PREFIXES = [
    'NIFTY',
    'BANKNIFTY',
    'FINNIFTY',
    'MIDCPNIFTY',
    'MIDCAPNIFTY',
    'NIFTYNXT50',
    'NIFTYFPI',
    'SENSEX',
    'BANKEX'
  ];
  return INDEX_PREFIXES.some(prefix => clean.startsWith(prefix));
}

// Global HTTP Fetch Interceptor to support Token-based authentication and real IP propagation
const originalFetch = window.fetch;
window.fetch = async function (url, options = {}) {
  const token = localStorage.getItem('token');
  const clientIp = getCachedPublicIp();
  const headers = { ...(options.headers || {}) };

  // Only add Authorization header when token is a valid non-empty string
  if (token && token.length > 10 && typeof url === 'string' && url.includes('/api/')) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  // Inject client public IP header for accurate GeoIP & device security audit
  if (clientIp && typeof url === 'string' && url.includes('/api/')) {
    headers['X-Client-Public-IP'] = clientIp;
  }

  options.headers = headers;
  const res = await originalFetch(url, options);

  // State 9: Session Expiry (catch 401 Unauthorized on protected endpoints)
  if (
    res.status === 401 &&
    typeof url === 'string' &&
    url.includes('/api/') &&
    !url.includes('/api/auth/login') &&
    !url.includes('/api/auth/pre-login') &&
    !url.includes('/api/auth/register') &&
    !url.includes('/api/auth/verify-2fa')
  ) {
    if (typeof window !== 'undefined' && window.__triggerSessionExpired) {
      window.__triggerSessionExpired();
    }
  }

  return res;
};

export const socket = io(API, { 
  withCredentials: false,
  transports: ['websocket'], // Force websocket to bypass PM2 cluster long-polling issues
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
  randomizationFactor: 0.5, // Jitter prevents thundering-herd reconnect storms at 1 Lakh+ users
  timeout: 20000
});

// ── Helpers ───────────────────────────────────────────────────────────────────
export const DEFAULT_WATCHLIST_SYMBOLS = [
  'NSE:NIFTY50-INDEX',
  'NSE:NIFTYBANK-INDEX',
  'BSE:SENSEX-INDEX',
  'NSE:RELIANCE',
  'NSE:TCS',
  'NSE:HDFCBANK',
  'NSE:INFY',
  'NSE:ICICIBANK',
  'NSE:SBIN'
];

export function ensureWatchlistsWithDefaults(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [{ id: 1, name: 'Watchlist 1', symbols: DEFAULT_WATCHLIST_SYMBOLS }];
  }
  const formatted = raw.map((w, idx) => ({
    id: w.id || (idx + 1),
    name: w.name || `Watchlist ${idx + 1}`,
    symbols: Array.isArray(w.symbols) ? w.symbols : []
  }));
  if (formatted[0] && (!formatted[0].symbols || formatted[0].symbols.length === 0)) {
    formatted[0].symbols = DEFAULT_WATCHLIST_SYMBOLS;
  }
  return formatted;
}

const temporaryOptionSubscriptions = new Set();

/** Merge a price snapshot object into the current prices map, tagging each tick direction */
function applySnapshot(snapshot, state, isFromWebSocket = false) {
  let hasChanges = false;
  let newPrices = null;
  const now = Date.now();

  for (const [symbol, rawData] of Object.entries(snapshot)) {
    // Data Compression logic: Decompress Array to Object if needed
    let data = rawData;
    if (Array.isArray(rawData)) {
      // [ltp, ch, chp, timestamp, open, high, low, close, vol, totBuyQuan, totSellQuan]
      data = {
        symbol: symbol,
        ltp: rawData[0],
        ch: rawData[1],
        change: rawData[1],
        chp: rawData[2],
        pct: rawData[2],
        timestamp: rawData[3],
        open: rawData[4],
        high: rawData[5],
        low: rawData[6],
        close: rawData[7],
        vol: rawData[8],
        volume: rawData[8],
        totBuyQuan: rawData[9],
        totSellQuan: rawData[10],
        upper_circuit: rawData[11] || 0,
        lower_circuit: rawData[12] || 0
      };
    } else if (rawData && typeof rawData === 'object') {
      data = {
        ...rawData,
        ch: rawData.ch ?? rawData.change ?? 0,
        change: rawData.change ?? rawData.ch ?? 0,
        chp: rawData.chp ?? rawData.pct ?? 0,
        pct: rawData.pct ?? rawData.chp ?? 0,
        vol: rawData.vol ?? rawData.volume ?? 0,
        volume: rawData.volume ?? rawData.vol ?? 0,
      };
    }

    const old = (newPrices || state.prices)[symbol];
    
    // Ignore REST API updates if the WebSocket has successfully updated this symbol in the last 4 seconds.
    if (!isFromWebSocket && old && old.lastWsUpdate && (now - old.lastWsUpdate < 4000)) {
        continue;
    }

    // Block stale data: Never overwrite a newer price with an older price based on backend timestamp.
    if (old && old.timestamp && data.timestamp && data.timestamp < old.timestamp) {
        continue;
    }

    // ⚡ Value Equality Guard: If prices, volume, and change are identical, skip re-allocation
    if (
      old &&
      old.ltp === data.ltp &&
      old.ch === data.ch &&
      old.vol === data.vol &&
      (!data.timestamp || old.timestamp === data.timestamp)
    ) {
      if (isFromWebSocket) {
        old.lastWsUpdate = now;
      }
      continue;
    }

    if (!newPrices) {
      newPrices = { ...state.prices };
    }
    hasChanges = true;
    
    const tick = old
      ? data.ltp > old.ltp ? 'up' : data.ltp < old.ltp ? 'down' : 'flat'
      : 'flat';
    
    const tickObj = { ...old, ...data, tick };
    if (isFromWebSocket) {
        tickObj.lastWsUpdate = now;
    }
    newPrices[symbol] = tickObj;

    // ⚡ Dual-key prices with and without exchange prefix so watchlists and modals always find the price
    // Re-use tickObj reference directly to eliminate redundant heap allocations per tick
    if (symbol.includes(':')) {
        const rawSym = symbol.split(':')[1];
        newPrices[rawSym] = tickObj;
        const base = rawSym.replace(/-(EQ|A|B|T|X|XT|Z|P|M|SM|BE|BZ|INDEX)$/i, '');
        if (base !== rawSym) {
            newPrices[base] = tickObj;
            newPrices[`NSE:${base}`] = tickObj;
            newPrices[`BSE:${base}`] = tickObj;
        } else {
            newPrices[`NSE:${base}-EQ`] = tickObj;
        }
    } else {
        const isCommodity = ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER', 'ZINC', 'LEAD', 'ALUMINIUM', 'MENTHAOIL', 'COTTON', 'NICKEL'].some(c => symbol.startsWith(c)) || symbol.includes('-MCX');
        if (isCommodity) {
            newPrices[`MCX:${symbol}`] = tickObj;
        } else {
            newPrices[`NSE:${symbol}`] = tickObj;
            newPrices[`BSE:${symbol}`] = tickObj;
            const base = symbol.replace(/-(EQ|A|B|T|X|XT|Z|P|M|SM|BE|BZ|INDEX)$/i, '');
            if (base !== symbol) {
                newPrices[base] = tickObj;
                newPrices[`NSE:${base}`] = tickObj;
                newPrices[`BSE:${base}`] = tickObj;
            } else {
                newPrices[`NSE:${base}-EQ`] = tickObj;
            }
        }
    }
  }

  return hasChanges ? newPrices : state.prices;
}

// ── Store ─────────────────────────────────────────────────────────────────────

try {
  if (typeof window !== 'undefined' && window.localStorage) {
    if (!localStorage.getItem('skandx-storage') && localStorage.getItem('shortmarket-storage')) {
      localStorage.setItem('skandx-storage', localStorage.getItem('shortmarket-storage'));
    }
  }
} catch (e) {}

export const useStore = create(persist((set, get) => ({

  // ── Global UI Feedback & Session Management ─────────────────────────────────
  isInitialUserDataLoaded: false,
  toast: null,
  showToast: (toastOrMessage, type = 'info', title = null) => {
    let toastObj;
    if (typeof toastOrMessage === 'string') {
      toastObj = { message: toastOrMessage, type, title, id: Date.now() };
    } else {
      toastObj = { ...toastOrMessage, id: Date.now() };
    }
    set({ toast: toastObj });
    if (get()._toastTimer) clearTimeout(get()._toastTimer);
    const timer = setTimeout(() => {
      set({ toast: null });
    }, toastObj.duration || 4000);
    set({ _toastTimer: timer });
  },
  hideToast: () => {
    if (get()._toastTimer) clearTimeout(get()._toastTimer);
    set({ toast: null, _toastTimer: null });
  },

  isSessionExpired: false,
  setSessionExpired: (isExpired) => set({ isSessionExpired: Boolean(isExpired) }),

  // ── Auth ────────────────────────────────────────────────────────────────────
  user:      null,
  hasSkippedOnboarding: false,
  skipOnboarding: async () => {
    const currentUserId = get().user?.id;
    if (currentUserId) {
      localStorage.setItem(`hasSkippedOnboarding_${currentUserId}`, "true");
    }
    set({ hasSkippedOnboarding: true });
    try { 
      const token = localStorage.getItem('token') || get().token;
      await fetch(`${API}/api/auth/skip-onboarding`, { 
        method: "POST", 
        headers: { "Authorization": `Bearer ${token}` } 
      }); 
    } catch (e) {}
  },
  
  authError: null,

    preLogin: async (email, password, trustedDeviceToken = null) => {
    try {
      set({ authError: null });
      const deviceToken = trustedDeviceToken || localStorage.getItem('skandx_trusted_device') || localStorage.getItem('shortmarket_trusted_device') || undefined;
      const res = await fetch(`${API}/api/auth/pre-login`, {
        credentials: 'include', method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, trusted_device_token: deviceToken })
      });
      const data = await res.json();
      if (data.success) {
        if (data.trusted && data.token && data.user) {
          localStorage.setItem('token', data.token);
          if (data.user?.id) {
            setAppLocked(false, data.user.id);
            socket.emit('register_user', data.user.id);
          }
          set({
            token: data.token,
            user: data.user,
            watchlists: ensureWatchlistsWithDefaults(data.user.watchlists),
          });
          get().fetchUserData();
          syncClientTelemetry(API, true);
          return { success: true, trusted: true, user: data.user };
        }
        return {
          success: true,
          trusted: false,
          phone: data.phone,
          email: data.email,
          totp_enabled: data.totp_enabled
        };
      }
      set({ authError: data.error });
      return { success: false, error: data.error, needs_email_verification: data.needs_email_verification, email: data.email };
    } catch (err) {
      set({ authError: err.message });
      return { success: false, error: err.message };
    }
  },

  sendLoginEmailOtp: async (email, password) => {
    try {
      const res = await fetch(`${API}/api/auth/send-login-email-otp`, {
        credentials: 'include', method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  verify2FA: async ({ email, password, method, code, trust_device = false, device_name = '' }) => {
    try {
      set({ authError: null });
      const res = await fetch(`${API}/api/auth/verify-2fa`, {
        credentials: 'include', method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, method, code, trust_device, device_name })
      });
      const data = await res.json();
      if (data.success) {
        if (data.token) localStorage.setItem('token', data.token);
        if (data.trusted_device_token) {
          localStorage.setItem('skandx_trusted_device', data.trusted_device_token);
        }
        if (data.user?.id) {
          setAppLocked(false, data.user.id);
          socket.emit('register_user', data.user.id);
        }
        set({
          token: data.token,
          user: data.user,
          watchlists: ensureWatchlistsWithDefaults(data.user.watchlists),
        });
        get().fetchUserData();
        syncClientTelemetry(API, true);
        return { success: true, user: data.user };
      }
      set({ authError: data.error });
      return { success: false, error: data.error };
    } catch (err) {
      set({ authError: err.message });
      return { success: false, error: err.message };
    }
  },

  login: async (email, password, options = {}) => {
    try {
      set({ authError: null });
      const publicInfo = await fetchClientPublicInfo().catch(() => ({ ip: null, city: '', state: '' }));
      const payload = {
        email,
        password,
        trust_device: options.trust_device || false,
        device_name: options.device_name || undefined,
        client_ip: publicInfo?.ip || undefined,
        client_city: publicInfo?.city || undefined,
        client_state: publicInfo?.state || undefined
      };
      const res  = await fetch(`${API}/api/auth/login`, { credentials: 'include', method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        if (data.token) localStorage.setItem('token', data.token);
        if (data.trusted_device_token) {
          localStorage.setItem('skandx_trusted_device', data.trusted_device_token);
        }
        if (data.user?.id) {
          setAppLocked(false, data.user.id);
          socket.emit('register_user', data.user.id);
        }
        set({
          token: data.token,
          user:       data.user,
          watchlists: ensureWatchlistsWithDefaults(data.user.watchlists),
        });
        get().fetchUserData();
        syncClientTelemetry(API, true);
        return { success: true };
      } else {
        set({ authError: data.error });
        return { success: false, error: data.error };
      }
    } catch (err) {
      set({ authError: err.message });
      return { success: false, error: err.message };
    }
  },

  sendRegistrationOtp: async (username, email, phone) => {
    try {
      set({ authError: null });
      const res = await fetch(`${API}/api/auth/send-registration-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, phone })
      });
      const data = await res.json();
      if (data.success) {
        return { success: true, message: data.message };
      } else {
        set({ authError: data.error });
        return { success: false, error: data.error };
      }
    } catch (err) {
      set({ authError: err.message });
      return { success: false, error: err.message };
    }
  },

  register: async (username, email, phone, password, firebaseToken = null, otp = null, consents = {}) => {
    try {
      set({ authError: null });
      const publicInfo = await fetchClientPublicInfo().catch(() => ({ ip: null, city: '', state: '' }));
      const payload = {
        username,
        email,
        phone,
        password,
        otp: otp || undefined,
        firebase_token: firebaseToken || undefined,
        referral_code: localStorage.getItem('referral_code'),
        client_ip: publicInfo?.ip || undefined,
        client_city: publicInfo?.city || undefined,
        client_state: publicInfo?.state || undefined,
        consent_terms: Boolean(consents?.terms),
        consent_data_processing: Boolean(consents?.dataProcessing),
        consent_marketing: Boolean(consents?.marketing)
      };
      const res  = await fetch(`${API}/api/auth/register`, { credentials: 'include', method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        if (data.needs_verification) {
          // Keep user in unauthenticated state until email link is verified
          return { success: true, message: data.message, needs_verification: true, email: data.email };
        }
        if (data.token) localStorage.setItem('token', data.token);
        if (data.user?.id) socket.emit('register_user', data.user.id);
        set({
          user:       data.user,
          watchlists: ensureWatchlistsWithDefaults(data.user.watchlists),
        });
        get().fetchUserData();
        syncClientTelemetry(API, true);
        return { success: true, message: data.message, needs_verification: false, email: data.email };
      } else {
        set({ authError: data.error });
        return { success: false, error: data.error };
      }
    } catch (err) {
      set({ authError: err.message });
      return { success: false, error: err.message };
    }
  },

  resendVerificationEmail: async (email) => {
    try {
      const res = await fetch(`${API}/api/auth/resend-verification-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  forgotPassword: async (email) => {
    try {
      const res = await fetch(`${API}/api/auth/forgot-password`, { credentials: 'include', method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  verifyResetOtp: async (email, otp) => {
    try {
      const res = await fetch(`${API}/api/auth/verify-reset-otp`, { credentials: 'include', method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, otp })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  resetPassword: async (email, otp, newPassword) => {
    try {
      const res = await fetch(`${API}/api/auth/reset-password`, { credentials: 'include', method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, otp, newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },



  // ── Watchlists ──────────────────────────────────────────────────────────────
  watchlists:       ensureWatchlistsWithDefaults([]),
  activeWatchlistId: (function() {
    try {
      const saved = localStorage.getItem('active_watchlist_id');
      if (saved) return saved;
    } catch(e) {}
    return 1;
  })(),
  lastWatchlistEdit: 0, // Timestamp to prevent background fetchUserData from overwriting optimistic UI

  createWatchlist: (name) => {
    const user = get().user;
    const isAdmin = Boolean(user?.is_admin);
    const tier = (user?.subscription_tier || 'BASIC').toUpperCase();
    const isExpired = user?.subscription_expires && new Date(user.subscription_expires).getTime() <= Date.now();
    const activeTier = isExpired ? 'BASIC' : tier;
    const isHighest = ['HIGHEST', 'FEATURE', 'VIP'].includes(activeTier);
    const isYearlyOrMonthly = ['YEARLY', 'PRO', 'MONTHLY', 'LIFETIME'].includes(activeTier);
    const maxWatchlists = isAdmin ? Infinity : (isHighest ? 5 : (isYearlyOrMonthly ? 4 : 2));

    if (!isAdmin && get().watchlists.length >= maxWatchlists) {
      alert(`Your ${activeTier} plan allows a maximum of ${maxWatchlists} custom watchlists. Please upgrade to Monthly/Yearly (4) or Feature Plan (5) to create more watchlists.`);
      return;
    }

    if (get().watchlists.some(w => w.name.toLowerCase() === name.toLowerCase())) {
      alert(`Watchlist "${name}" already exists!`);
      return;
    }
    const newWatchlists = [...get().watchlists, { id: Date.now(), name, symbols: [] }];
    set({ watchlists: newWatchlists, lastWatchlistEdit: Date.now() });
    get().syncWatchlists(newWatchlists);
  },

  renameWatchlist: (id, newName) => {
    if (get().watchlists.some(w => String(w.id) !== String(id) && w.name.toLowerCase() === newName.toLowerCase())) {
      alert(`Watchlist "${newName}" already exists!`);
      return;
    }
    const newWatchlists = get().watchlists.map(w => String(w.id) === String(id) ? { ...w, name: newName } : w);
    set({ watchlists: newWatchlists, lastWatchlistEdit: Date.now() });
    get().syncWatchlists(newWatchlists);
  },

  deleteWatchlist: (id) => {
    let newWatchlists = get().watchlists.filter(w => String(w.id) !== String(id));
    if (newWatchlists.length === 0) newWatchlists = [{ id: 1, name: 'Watchlist 1', symbols: [] }];
    const nextActiveId = String(get().activeWatchlistId) === String(id) ? newWatchlists[0].id : get().activeWatchlistId;
    try { localStorage.setItem('active_watchlist_id', String(nextActiveId)); } catch(e) {}
    set({
      watchlists:        newWatchlists,
      activeWatchlistId: nextActiveId,
      lastWatchlistEdit: Date.now()
    });
    get().syncWatchlists(newWatchlists);
  },

  setActiveWatchlist: (id) => {
    try { localStorage.setItem('active_watchlist_id', String(id)); } catch(e) {}
    set({ activeWatchlistId: id });
    get().pingSubscriptions();
  },

  addStockToWatchlist: (watchlistId, uniqueSymbol) => {
    const user = get().user;
    const isAdmin = Boolean(user?.is_admin);
    const tier = (user?.subscription_tier || 'BASIC').toUpperCase();
    const isExpired = user?.subscription_expires && new Date(user.subscription_expires).getTime() <= Date.now();
    const activeTier = isExpired ? 'BASIC' : tier;
    const isHighest = ['HIGHEST', 'FEATURE', 'VIP'].includes(activeTier);
    const isYearlyOrMonthly = ['YEARLY', 'PRO', 'MONTHLY', 'LIFETIME'].includes(activeTier);
    const maxSymbols = isAdmin ? Infinity : (isHighest ? 100 : (isYearlyOrMonthly ? 75 : 30));

    const targetWlId = String(watchlistId);
    const targetWl = get().watchlists.find(w => String(w.id) === targetWlId);
    if (!isAdmin && targetWl && (targetWl.symbols || []).length >= maxSymbols && !(targetWl.symbols || []).includes(uniqueSymbol)) {
      alert(`Your ${activeTier} plan allows up to ${maxSymbols} symbols per watchlist. Please upgrade your plan to add more symbols.`);
      return;
    }

    const newWatchlists = get().watchlists.map(w => {
      if (String(w.id) === targetWlId && !(w.symbols || []).includes(uniqueSymbol)) {
        return { ...w, symbols: [...(w.symbols || []), uniqueSymbol] };
      }
      return w;
    });
    set({ watchlists: newWatchlists, lastWatchlistEdit: Date.now() });
    get().syncWatchlists(newWatchlists);

    // ⚡ Immediately subscribe via WebSocket using canonical uniqueSymbol
    socket.emit('subscribe', uniqueSymbol);
    get().pingSubscriptions();
    get().fetchBatchPrices([uniqueSymbol], true);
  },

  removeStockFromWatchlist: (watchlistId, uniqueSymbol) => {
    const targetWlId = String(watchlistId);
    const newWatchlists = get().watchlists.map(w => {
      if (String(w.id) === targetWlId) return { ...w, symbols: (w.symbols || []).filter(s => s !== uniqueSymbol) };
      return w;
    });
    set({ watchlists: newWatchlists, lastWatchlistEdit: Date.now() });
    get().syncWatchlists(newWatchlists);
    get().pingSubscriptions();
  },

  // ── Order Modal ─────────────────────────────────────────────────────────────
  // ── Basket Modal & State ───────────────────────────────────────────────────
  basketMode: false,
  setBasketMode: (mode) => set({ basketMode: mode }),
  
  basketItems: [],
  addToBasket: (item) => set((state) => ({ basketItems: [...state.basketItems, item] })),
  removeFromBasket: (index) => set((state) => ({ basketItems: state.basketItems.filter((_, i) => i !== index) })),
  updateBasketItem: (index, updates) => set((state) => {
    const newItems = [...state.basketItems];
    newItems[index] = { ...newItems[index], ...updates };
    return { basketItems: newItems };
  }),
  clearBasket: () => set({ basketItems: [] }),
  
  basketModalOpen: false,
  setBasketModalOpen: (isOpen) => set({ basketModalOpen: isOpen }),

  isAdModalOpen: false,
  setIsAdModalOpen: (isOpen) => set({ isAdModalOpen: Boolean(isOpen) }),

  chartModalSymbol: null,
  setChartModalSymbol: (symbol) => set({ chartModalSymbol: symbol }),

  mobileStockOverviewSymbol: null,
  setMobileStockOverviewSymbol: (symbol) => set({ mobileStockOverviewSymbol: symbol }),

  marketDepthModal: { isOpen: false, symbol: null, lotsize: 1 },
  openMarketDepthModal: (symbol, lotsize) => {
    const effectiveLotsize = (lotsize && Number(lotsize) > 1) ? Number(lotsize) : getInstantLotsize(symbol);
    set({ marketDepthModal: { isOpen: true, symbol, lotsize: effectiveLotsize } });
  },
  closeMarketDepthModal: () => set({ marketDepthModal: { isOpen: false, symbol: null, lotsize: 1 } }),

  domLadderModal: { isOpen: false, symbol: null, lotsize: 1 },
  openDomLadderModal: (symbol, lotsize) => {
    const effectiveLotsize = (lotsize && Number(lotsize) > 1) ? Number(lotsize) : getInstantLotsize(symbol);
    set({ domLadderModal: { isOpen: true, symbol, lotsize: effectiveLotsize } });
  },
  closeDomLadderModal: () => set({ domLadderModal: { isOpen: false, symbol: null, lotsize: 1 } }),

  marketDepthData: { symbol: null, bids: [], asks: [] },
  setMarketDepthData: (data) => set({ marketDepthData: data }),

  alerts: [],
  addAlert: (alert) => {
    const sym = alert.symbol;
    if (sym) {
      if (typeof get().subscribeToSymbol === 'function') get().subscribeToSymbol(sym);
      if (typeof get().fetchBatchPrices === 'function') get().fetchBatchPrices([sym]);
      if (typeof get().pingSubscriptions === 'function') get().pingSubscriptions();
    }
    set((state) => ({ 
      alerts: [...state.alerts, { ...alert, id: Date.now().toString(), triggered: false, createdAt: new Date().toISOString() }] 
    }));
  },
  removeAlert: (id) => set((state) => ({ alerts: state.alerts.filter(a => a.id !== id) })),
  updateAlert: (id, updates) => set((state) => ({ 
    alerts: state.alerts.map(a => a.id === id ? { ...a, ...updates } : a) 
  })),
  clearOldAlerts: () => set((state) => {
    // Only purge alerts that have already been triggered. Active/pending alerts remain intact.
    return {
      alerts: state.alerts.filter(a => !a.triggered && a.status !== 'TRIGGERED')
    };
  }),
  purgeDailyAlerts: () => set({ alerts: [] }),
  purgeStaleDailyAlerts: () => set((state) => ({
    alerts: filterStaleAlerts(state.alerts)
  })),
  
  alertModalSymbol: null,
  setAlertModalSymbol: (symbol) => set({ alertModalSymbol: symbol }),

  // ── Advanced Order Triggers (SL, TSL, GTT) ──────────────────────────────────
  pendingTriggers: [],
  addPendingTrigger: (trigger) => set((state) => ({
    pendingTriggers: [...state.pendingTriggers, { 
      id: `TRG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      ...trigger 
    }]
  })),
  removePendingTrigger: (id) => set((state) => ({
    pendingTriggers: state.pendingTriggers.filter(t => t.id !== id)
  })),
  updatePendingTrigger: (id, updates) => set((state) => ({
    pendingTriggers: state.pendingTriggers.map(t => t.id === id ? { ...t, ...updates } : t)
  })),
  clearPendingTriggersForSymbol: (symbol) => set((state) => ({
    pendingTriggers: state.pendingTriggers.filter(t => t.symbol !== symbol)
  })),

  placeBasketOrder: async (basketPayload) => {
    try {
      const items = basketPayload?.items || [];
      if (items.length === 0) return { success: false, error: 'Basket is empty' };

      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API}/api/basket-order`, {
        credentials: 'include',
        method: 'POST',
        headers,
        body: JSON.stringify(basketPayload),
      });
      const data = await res.json();
      if (res.ok && data.success) { 
        get().fetchUserData(); 
        get().clearBasket();
        get().setBasketModalOpen(false);
        return { success: true, orders: data.orders }; 
      }
      return { success: false, error: data.error || data.message || 'Failed to place basket order' };
    } catch (err) {
      return { success: false, error: err.message || 'Network error while placing basket order' };
    }
  },

  orderModal: { isOpen: false, symbol: null, type: 'BUY', lotsize: 1, productType: 'INT', isExit: false, totalExitQty: 0, initialPrice: null, target: null, stopLoss: null },
  openOrderModal: (symbol, type = 'BUY', lotsize = 1, productType = 'INT', isExit = false, totalExitQty = 0, initialPrice = null, target = null, stopLoss = null) => {
    if (lotsize && Number(lotsize) > 1 && symbol) {
      setContractLotsize(symbol, Number(lotsize));
    }
    const effectiveLotsize = (lotsize && Number(lotsize) > 1) ? Number(lotsize) : getInstantLotsize(symbol);
    
    // Proactively fetch live price and subscribe to WebSocket ticks so OrderModal never opens with 0.00
    if (symbol) {
      const clean = symbol.replace(/^(NSE:|BSE:|MCX:)/i, '');
      const base = clean.replace(/-(EQ|A|B|T|X|XT|Z|P|M|SM|BE|BZ|INDEX)$/i, '');
      const symList = [symbol, clean, base, `NSE:${clean}`, `NSE:${base}`, `NSE:${base}-EQ`];
      try {
        if (typeof get().fetchBatchPrices === 'function') get().fetchBatchPrices(symList, true);
        if (typeof get().subscribeToSymbol === 'function') get().subscribeToSymbol(symbol);
        if (socket && typeof socket.emit === 'function') socket.emit('subscribe', symbol);
      } catch (_) {}
    }

    const openNow = () => set({ orderModal: { isOpen: true, symbol, type, lotsize: effectiveLotsize, productType, isExit, totalExitQty, initialPrice, target, stopLoss } });
    if (isExit && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('skandx-trigger-ad', {
        detail: {
          mode: 'pre_exit',
          symbol: symbol || '',
          side: type || 'SELL',
          onProceed: openNow
        }
      }));
      return;
    }
    openNow();
  },
  setOrderModalLotsize: (lotsize) => set(state => ({ orderModal: { ...state.orderModal, lotsize } })),
  closeOrderModal: () => set({ orderModal: { isOpen: false, symbol: null, type: 'BUY', lotsize: 1, productType: 'INT', isExit: false, totalExitQty: 0, initialPrice: null, target: null, stopLoss: null } }),

  editOrderModal: { isOpen: false, order: null },
  openEditOrderModal: (order) => {
    const openNow = () => set({ editOrderModal: { isOpen: true, order } });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('skandx-trigger-ad', {
        detail: {
          mode: 'pre_exit',
          symbol: order?.symbol || 'ORDER',
          side: 'MODIFY',
          onProceed: openNow
        }
      }));
      return;
    }
    openNow();
  },
  closeEditOrderModal: () => set({ editOrderModal: { isOpen: false, order: null } }),

  // ── Market Data ─────────────────────────────────────────────────────────────
  prices:         {},
  stocks:         [],
  positions:      [],
  holdings:       [],
  sips:           [],
  orders:         [],
  selectedSymbol: localStorage.getItem('lastSelectedSymbol') || 'NSE:NIFTY50-INDEX',
  isConnected: false,

  setSelectedSymbol: (symbol) => {
    set({ selectedSymbol: symbol });
    socket.emit('subscribe', symbol);
  },

  subscribeToSymbol: (symbol) => socket.emit('subscribe', symbol),
  unsubscribeFromSymbol: (symbol) => socket.emit('unsubscribe', symbol),
  subscribeToOption: (data) => socket.emit('subscribe', data),
  subscribeToOptionBatch: (dataArray) => {
    if(Array.isArray(dataArray)) {
      dataArray.forEach(data => temporaryOptionSubscriptions.add(data.uniqueSymbol || data.symbol || data.token));
      get().pingSubscriptions();
    }
  },
  unsubscribeFromOptionBatch: (dataArray) => {
    if (Array.isArray(dataArray)) {
      const symbolsToLeave = [];
      dataArray.forEach(data => {
        const sym = data.uniqueSymbol || data.symbol || data.token;
        if (sym) {
          temporaryOptionSubscriptions.delete(sym);
          symbolsToLeave.push(sym);
        }
      });
      if (socket && socket.connected && symbolsToLeave.length > 0) {
        socket.emit('unsubscribe', symbolsToLeave);
      }
      get().pingSubscriptions();
    }
  },
  pingSubscriptions: () => {
    const { watchlists, activeWatchlistId, positions, selectedSymbol } = get();
    const activeWl = watchlists.find(w => String(w.id) === String(activeWatchlistId)) || watchlists[0];
    
    const symbols = new Set();
    if (activeWl?.symbols) {
      activeWl.symbols.forEach(s => symbols.add(s));
    }
    
    if (positions && positions.length > 0) {
      positions.forEach(p => symbols.add(p.symbol));
    }

    const orders = get().orders;
    if (orders && orders.length > 0) {
      const activeOrderStatuses = ['PENDING', 'PENDING_TRIGGER', 'PARTIAL_FILLED', 'PARTIALLY_FILLED', 'OPEN', 'AMO_PENDING'];
      orders.forEach(o => {
        if (o.symbol && activeOrderStatuses.includes(o.status)) {
          symbols.add(o.symbol);
        }
      });
    }
    
    const holdings = get().holdings;
    if (holdings && holdings.length > 0) {
      holdings.forEach(h => symbols.add(h.symbol));
    }

    if (selectedSymbol) {
      symbols.add(selectedSymbol);
    }

    // Add active alert symbols so price ticks always stream even if instrument is not on active watchlist
    const alerts = get().alerts;
    if (alerts && alerts.length > 0) {
      alerts.forEach(a => {
        if (!a.triggered && a.symbol) {
          symbols.add(a.symbol);
        }
      });
    }
    
    // Add temporary options
    temporaryOptionSubscriptions.forEach(s => symbols.add(s));
    
    // Add indices — MUST use exact Fyers-format symbols (not the old aliases)
    symbols.add('NSE:NIFTY50-INDEX');
    symbols.add('NSE:NIFTYBANK-INDEX');
    symbols.add('BSE:SENSEX-INDEX');
    
    const symbolsArray = Array.from(symbols).filter(Boolean);
    
    if (symbolsArray.length > 0) {
        socket.emit('ping_subscriptions', symbolsArray);
    }
  },

  // ── Chart / Candle State (used by ChartWidget.jsx) ──────────────────────────
  candleData:       {},   // { [symbol]: CandleBar[] }
  isLoadingCandles: false,
  candleError:      null,
  chartInterval:    'ONE_DAY',

  setChartInterval: (interval) => {
    set({ chartInterval: interval });
  },

  loadCandleData: async (symbol, interval) => {
    if (!symbol) return;
    const resolvedInterval = interval || get().chartInterval;
    set({ isLoadingCandles: true, candleError: null });
    try {
      const res = await fetch(
        `${API}/api/candles/${encodeURIComponent(symbol)}?interval=${resolvedInterval}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const candles = await res.json();
      if (!Array.isArray(candles)) throw new Error('Invalid candle data');
      set((state) => {
        const nextCandleData = { ...state.candleData, [symbol]: candles };
        const keys = Object.keys(nextCandleData);
        if (keys.length > 5) {
          delete nextCandleData[keys[0]];
        }
        return {
          candleData:       nextCandleData,
          isLoadingCandles: false,
          candleError:      null,
        };
      });
    } catch (err) {
      set({ isLoadingCandles: false, candleError: err.message });
    }
  },

  // ── Socket ──────────────────────────────────────────────────────────────────
  _lastPriceFetchTime: 0,

  initSocket: () => {
    // FIX: Use separate event for initial snapshot vs live ticks.
    // The initial snapshot on connect is OLD CACHE DATA — it must NOT block REST fallback.
    // Only real live ticks from the 100ms batch interval tag symbols as "fresh WebSocket".
    socket.off('price_init');
    socket.on('price_init', (snapshot) => {
      // isFromWebSocket = false so REST can still override stale cache values
      set((state) => ({ prices: applySnapshot(snapshot, state, false) }));
    });

    let pendingSnapshots = {};
    let snapshotThrottleTimer = null;

    const flushSnapshots = () => {
      if (Object.keys(pendingSnapshots).length > 0) {
        const batch = pendingSnapshots;
        pendingSnapshots = {};
        set((state) => {
          const next = applySnapshot(batch, state, true);
          return next === state.prices ? {} : { prices: next };
        });
      }
      snapshotThrottleTimer = null;
    };

    socket.off('price_snapshot');
    socket.on('price_snapshot', (snapshot) => {
      // isFromWebSocket = true — these are real live ticks, block REST for 4s
      window._lastWsTick = Date.now();
      Object.assign(pendingSnapshots, snapshot);
      if (!snapshotThrottleTimer) {
        // ⚡ When tab is hidden/minimized, throttle to 3000ms to slash background CPU & battery drain by 85%.
        // When tab is active, run at smooth 200ms (~5 FPS).
        const delay = (typeof document !== 'undefined' && document.hidden) ? 3000 : 200;
        snapshotThrottleTimer = setTimeout(flushSnapshots, delay);
      }
    });

    if (typeof document !== 'undefined' && !window._hasWsVisibilityHandler) {
      window._hasWsVisibilityHandler = true;
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          get().pingSubscriptions();
          if (Object.keys(pendingSnapshots).length > 0) {
            if (snapshotThrottleTimer) {
              clearTimeout(snapshotThrottleTimer);
              snapshotThrottleTimer = null;
            }
            flushSnapshots();
          }
          if (batchTimeout) {
            clearTimeout(batchTimeout);
            batchTimeout = null;
          }
          if (Object.keys(batchedPrices).length > 0) {
            set((state) => {
              const next = applySnapshot(batchedPrices, state, true);
              batchedPrices = {};
              return next === state.prices ? {} : { prices: next };
            });
          }
        }
      });
    }

    // Polling fallback: Force sync only active/held symbols from REST API every 15s
    // ONLY if the WebSocket is disconnected, to prevent flickering between REST and WS prices
    if (!window._forceSyncInterval) {
      window._forceSyncInterval = setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return;
        if (!get().isConnected) {
          const { watchlists, activeWatchlistId, positions, holdings, selectedSymbol } = get();
          const activeWl = (watchlists || []).find(w => String(w.id) === String(activeWatchlistId)) || watchlists?.[0];
          const allSymbols = new Set([
            'NSE:NIFTY50-INDEX',
            'NSE:NIFTYBANK-INDEX',
            'BSE:SENSEX-INDEX',
            ...(activeWl?.symbols || []),
            ...(positions || []).map(p => p.symbol),
            ...(holdings || []).map(h => h.symbol),
            ...(selectedSymbol ? [selectedSymbol] : []),
            ...temporaryOptionSubscriptions
          ]);
          const arr = [...allSymbols].filter(Boolean);
          if (arr.length > 0) {
            get().fetchBatchPrices(arr, false);
          }
        }
      }, 15000);
    }

    let batchedPrices = {};
    let batchTimeout = null;

    socket.off('market_data');
    socket.on('market_data', (data) => {
      batchedPrices[data.symbol] = data;
      if (!batchTimeout) {
        const delay = (typeof document !== 'undefined' && document.hidden) ? 3000 : 150;
        batchTimeout = setTimeout(() => {
          set((state) => {
            const next = applySnapshot(batchedPrices, state, true);
            batchedPrices = {};
            batchTimeout = null;
            return next === state.prices ? {} : { prices: next };
          });
        }, delay); // Batch state updates to ~6 FPS to prevent UI lag (3s when tab is hidden)
      }
    });

    socket.off('market_depth_data');
    socket.on('market_depth_data', (data) => {
      get().setMarketDepthData(data);
    });

    let syncUserDataTimer = null;
    socket.off('sync_user_data');
    socket.on('sync_user_data', () => {
      if (syncUserDataTimer) clearTimeout(syncUserDataTimer);
      syncUserDataTimer = setTimeout(() => {
        get().fetchUserData();
      }, 150);
    });

    socket.off('market_status_updated');
    socket.on('market_status_updated', (data) => {
      set({ marketStatus: { equity: data.equity || 'AUTO', commodity: data.commodity || 'AUTO' } });
    });

    socket.off('market_calendar_updated');
    socket.on('market_calendar_updated', (payload) => {
      if (payload && payload.date) {
        const dStr = typeof payload.date === 'string' ? payload.date.split('T')[0] : payload.date;
        const current = get().marketCalendar || [];
        if (payload.deleted) {
          set({ marketCalendar: current.filter(r => (r.date || '').split('T')[0] !== dStr) });
        } else {
          const next = current.filter(r => (r.date || '').split('T')[0] !== dStr).concat({ ...payload, date: dStr });
          next.sort((a, b) => ((a.date || '') > (b.date || '') ? 1 : -1));
          set({ marketCalendar: next });
        }
      }
      get().fetchMarketCalendar(null, true);
      get().fetchTodayMarketSchedule(true);
    });

    socket.off('announcement_update');
    socket.on('announcement_update', (data) => {
      set({ announcement: data || null });
    });

    socket.off('broadcast_notification');
    socket.on('broadcast_notification', (data) => {
      if (!data) return;
      const currentList = get().broadcastNotifications || [];
      const updated = [data, ...currentList.filter(n => n.id !== data.id)];
      set({ 
        broadcastNotifications: updated,
        activeBroadcastToast: data,
        unreadNotificationsCount: (get().unreadNotificationsCount || 0) + 1
      });
      try { playOrderExecutedSound(); } catch(_) {}
    });

    socket.off('broadcast_notification_removed');
    socket.on('broadcast_notification_removed', ({ id }) => {
      const currentList = get().broadcastNotifications || [];
      set({ broadcastNotifications: currentList.filter(n => n.id !== id) });
    });

    socket.off('broadcast_notifications_refreshed');
    socket.on('broadcast_notifications_refreshed', () => {
      get().fetchBroadcastNotifications();
    });

    socket.off('purge_daily_alerts');
    socket.on('purge_daily_alerts', (data) => {
      console.log('🌅 [SOCKET] 08:19 AM Daily alerts purge received:', data);
      set({ alerts: [] });
    });

    socket.off('lotsize_map_updated');
    socket.on('lotsize_map_updated', (mapData) => {
      if (mapData && typeof mapData === 'object') {
        updateLiveLotsizeMap(mapData);
        const currentSym = get().orderModal?.symbol;
        if (get().orderModal?.isOpen && currentSym) {
          const updatedLs = getInstantLotsize(currentSym);
          if (updatedLs > 1 && updatedLs !== get().orderModal?.lotsize) {
            get().setOrderModalLotsize(updatedLs);
          }
        }
      }
    });

    socket.off('freeze_limits_updated');
    socket.on('freeze_limits_updated', (cfgData) => {
      if (cfgData && typeof cfgData === 'object') {
        updateLiveFreezeConfig(cfgData);
      }
    });

    socket.off('subscription_updated');
    socket.on('subscription_updated', (data) => {
      if (!data) return;
      const curUser = get().user;
      if (curUser && (!data.userId || String(curUser.id) === String(data.userId))) {
        set({
          user: {
            ...curUser,
            subscription_tier: data.subscription_tier || 'BASIC',
            subscription_expires: data.subscription_expires ?? null
          }
        });
      }
    });

    socket.off('trade_alert');
    socket.on('trade_alert', (data) => {
      if (!data) return;
      if (data.event === 'TARGET_HIT') {
        playTargetHitSound();
      } else if (data.event === 'SL_HIT') {
        playStopLossHitSound();
      } else if (data.event === 'EXECUTED') {
        playOrderExecutedSound();
      }
    });

    const onConnect = () => {
      set({ isConnected: true });
      const currentUser = get().user;
      if (currentUser?.id) {
        socket.emit('register_user', currentUser.id);
      }
      syncLiveLotsizeMap(API).catch(() => {});
      syncLiveFreezeConfig(API).catch(() => {});
      get().fetchMarketStatus();
      get().fetchMarketCalendar();
      get().fetchTodayMarketSchedule();
      get().fetchAnnouncement();
      get().fetchBroadcastNotifications();
      // Force a fresh REST price fetch on every socket connect/reconnect
      get().refreshPrices(true);
      
      // FIX: Ping immediately to re-join rooms for already-loaded symbols
      get().pingSubscriptions();
      
      // A single 3s safety re-verify on initial connect
      setTimeout(() => { if (get().isConnected) get().pingSubscriptions(); }, 3000);
      
      // Background-aware heartbeat: 15s when active; throttled to 45s when tab is hidden/minimized
      // (Fyers server GC window is 60s, so 45s preserves keepalive while cutting idle socket requests by 78%)
      if (!get().subscriptionPingInterval) {
          let lastPingTime = Date.now();
          const interval = setInterval(() => {
              if (!get().isConnected) return;
              const isHidden = typeof document !== 'undefined' && document.hidden;
              const elapsed = Date.now() - lastPingTime;
              if (isHidden && elapsed < 45000) return;
              lastPingTime = Date.now();
              get().pingSubscriptions();
          }, 15000);
          set({ subscriptionPingInterval: interval });
      }
    };

    socket.off('connect');
    socket.on('connect', onConnect);
    
    // ── Disconnect handler: start fallback REST polling ──
    socket.off('disconnect');
    socket.on('disconnect', (reason) => {
      console.warn('⚠️ Socket disconnected:', reason);
      set({ isConnected: false });
      const interval = get().subscriptionPingInterval;
      if (interval) {
          clearInterval(interval);
          set({ subscriptionPingInterval: null });
      }
    });
    
    socket.off('connect_error');
    socket.on('connect_error', (err) => {
      console.warn('⚠️ Socket connect error:', err.message);
      set({ isConnected: false });
    });
    
    if (socket.connected) {
      onConnect();
    }
    
    // ── Heartbeat: Periodic REST price polling as safety net ──
  },

  // ── Price Fetching ───────────────────────────────────────────────────────────
  refreshPrices: async (force = false) => {
    const now = Date.now();
    // Throttle: skip if last fetch was < 2s ago (unless forced by socket reconnect)
    if (!force && (now - get()._lastPriceFetchTime) < 2000) return;

    // To prevent flicker, if WebSocket has ticked recently (within 5s), do NOT fetch REST.
    // Only fetch REST as a true fallback when WebSocket is totally dead or not ticking.
    if (!force && window._lastWsTick && (now - window._lastWsTick < 5000)) return;

    try {
      const { watchlists, activeWatchlistId, positions, holdings, selectedSymbol } = get();
      const activeWl = (watchlists || []).find(w => String(w.id) === String(activeWatchlistId)) || watchlists?.[0];
      const symbolsSet = new Set([
        'NSE:NIFTY50-INDEX',
        'NSE:NIFTYBANK-INDEX',
        'BSE:SENSEX-INDEX',
        ...(activeWl?.symbols || []),
        ...(positions || []).map(p => p.symbol),
        ...(holdings || []).map(h => h.symbol),
        ...(selectedSymbol ? [selectedSymbol] : []),
        ...temporaryOptionSubscriptions
      ]);
      const symbols = [...symbolsSet].filter(Boolean);
      if (symbols.length > 0) {
        await get().fetchBatchPrices(symbols, force);
        set({ _lastPriceFetchTime: now });
      }
    } catch (_) {}
  },

  fetchBatchPrices: async (symbols, force = false) => {
    try {
      const res = await fetch(`${API}/api/ltp-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols, force }),
      });
      if (!res.ok) return;
      const data = await res.json();
      set((state) => ({ prices: applySnapshot(data, state) }));
    } catch (_) {}
  },

  // ── Stock List ───────────────────────────────────────────────────────────────
  loadStocks: async () => {
    try {
      const res    = await fetch(`${API}/api/stocks`, { credentials: 'include' });
      const stocks = await res.json();
      if (!Array.isArray(stocks) || stocks.length === 0) return;
      set({ stocks });
      get().refreshPrices();
    } catch (_) {}
  },

  // ── User Data ────────────────────────────────────────────────────────────────
  fetchUserData: async () => {
    if (window._activeFetchUserDataPromise) return window._activeFetchUserDataPromise;
    window._activeFetchUserDataPromise = (async () => {
      try {
        syncClientTelemetry(API).catch(() => {});
        const token = localStorage.getItem('token') || get().token;
        const headers = {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        };

        let positions, orders, user, holdData, sipsList;
        let authFailed = false;
        let isAccountDeleted = false;

        try {
          const bootRes = await fetch(`${API}/api/user/bootstrap`, { credentials: 'include', headers });
          if (bootRes.ok) {
            const data = await bootRes.json();
            user = data.user;
            positions = data.positions;
            orders = data.orders;
            holdData = data.holdings;
            sipsList = data.sips;
          } else if (bootRes.status === 401 || bootRes.status === 403 || bootRes.status === 404) {
            authFailed = true;
            const bData = await bootRes.json().catch(() => ({}));
            if (bData?.account_deleted || bootRes.status === 404 || bootRes.status === 401) {
              isAccountDeleted = true;
            }
          }
        } catch (_) {
          // Network or parsing error on bootstrap, will fallback below
        }

        // Graceful Fallback to individual requests if bootstrap endpoint fails or returns error
        if (!user && !isAccountDeleted) {
          try {
            const userRes = await fetch(`${API}/api/user`, { credentials: 'include', headers });
            if (userRes.ok) {
              const uData = await userRes.json();
              if (uData && !uData.error && uData.id) {
                user = uData;
                authFailed = false; // Auth verified successfully via fallback!
                const [posRes, ordRes, holdRes, sipsRes] = await Promise.all([
                  fetch(`${API}/api/positions`, { credentials: 'include', headers }),
                  fetch(`${API}/api/orders`, { credentials: 'include', headers }),
                  fetch(`${API}/api/holdings`, { credentials: 'include', headers }),
                  fetch(`${API}/api/sips`, { credentials: 'include', headers }),
                ]);
                const [pData, oData, hData, sData] = await Promise.all([
                  posRes.json().catch(() => ([])), 
                  ordRes.json().catch(() => ([])), 
                  holdRes.json().catch(() => ([])),
                  sipsRes.json().catch(() => ({}))
                ]);
                positions = pData;
                orders = oData;
                holdData = hData;
                sipsList = (sData && sData.success && Array.isArray(sData.sips)) ? sData.sips : [];
              }
            } else if (userRes.status === 401 || userRes.status === 403 || userRes.status === 404) {
              authFailed = true;
              isAccountDeleted = true;
            }
          } catch (_) {}
        }
        
        // Handle authentication failure: instant logout if account deleted, prompt session expiry if temporary
        if (isAccountDeleted) {
          console.warn("User account not found or permanently deleted. Wiping local session.");
          get().logout();
          return;
        }

        if (authFailed) {
          if (!user && !get().user) {
            console.error("Auth definitively failed during fetchUserData, logging out.");
            get().logout();
            return;
          } else if (get().user && !get().isSessionExpired) {
            console.warn("Session expired during fetchUserData, showing session expiry modal.");
            get().setSessionExpired(true);
          }
        }
        
        if (!get().user && !user) return;
        
        const incomingWatchlists = user?.watchlists ? ensureWatchlistsWithDefaults(user.watchlists) : null;
        const shouldUpdateWatchlists = (incomingWatchlists && (now - get().lastWatchlistEdit > 3000));
        
        const prevUser = get().user;
        let finalUser = prevUser;
        if (user && !user.error) {
          finalUser = { ...(prevUser || {}), ...user };
        }
        
        set({
          positions: Array.isArray(positions) ? positions : get().positions, 
          holdings: Array.isArray(holdData) ? holdData : get().holdings,
          sips: Array.isArray(sipsList) ? sipsList : get().sips,
          orders: Array.isArray(orders) ? orders : get().orders, 
          user: finalUser,
          watchlists: shouldUpdateWatchlists ? incomingWatchlists : ensureWatchlistsWithDefaults(get().watchlists)
        });
        
        if (shouldUpdateWatchlists) {
          get().pingSubscriptions();
        }
        const activeWl = (get().watchlists || []).find(w => String(w.id) === String(get().activeWatchlistId)) || get().watchlists?.[0];
        const wlSymbols = activeWl?.symbols || [];
        const posSymbols = get().positions.map(p => p.symbol);
        const holdSymbols = get().holdings.map(h => h.symbol);
        const alertSymbols = (get().alerts || []).filter(a => !a.triggered && a.symbol).map(a => a.symbol);
        const allSymbolsToSubscribe = [...new Set([...wlSymbols, ...posSymbols, ...holdSymbols, ...alertSymbols])];
        if (allSymbolsToSubscribe.length > 0) {
          if (!window._subscribedUserSymbols) window._subscribedUserSymbols = new Set();
          const newSymbols = allSymbolsToSubscribe.filter(sym => !window._subscribedUserSymbols.has(sym));
          
          if (newSymbols.length > 0) {
            newSymbols.forEach(sym => {
              window._subscribedUserSymbols.add(sym);
              socket.emit('subscribe', sym);
            });
            const missingPriceSyms = newSymbols.filter(sym => !get().prices[sym]?.ltp);
            if (missingPriceSyms.length > 0) {
              get().fetchBatchPrices(missingPriceSyms);
            }
          }
        }
        
        // Fetch restricted stocks (cached for 15m to stop 30s polling churn)
        get().fetchRestrictedStocks();
        // No initial search; let MutualFundsView handle empty state
      } catch (_) {
      } finally {
        window._activeFetchUserDataPromise = null;
        if (!get().isInitialUserDataLoaded) {
          set({ isInitialUserDataLoaded: true });
        }
      }
    })();
    return window._activeFetchUserDataPromise;
  },
  
  restrictedStocks: [],
  fetchRestrictedStocks: async () => {
      const now = Date.now();
      if (get()._lastRestrictedFetch && (now - get()._lastRestrictedFetch < 15 * 60 * 1000) && get().restrictedStocks.length > 0) {
          return;
      }
      try {
          const res = await fetch(`${API}/api/restricted-stocks`, { credentials: 'include' });
          const data = await res.json();
          if (Array.isArray(data)) set({ restrictedStocks: data, _lastRestrictedFetch: now });
      } catch (_) {}
  },

  mutualFunds: [],
  searchMfRequestId: 0,
  searchMutualFunds: async (query) => {
      try {
          const currentRequestId = ++get().searchMfRequestId;
          const res = await fetch(`${API}/api/mf/search?q=${encodeURIComponent(query)}`, { credentials: 'include' });
          const data = await res.json();
          
          // Only update if this is still the latest search request!
          if (Array.isArray(data) && currentRequestId === get().searchMfRequestId) {
              set({ mutualFunds: data });
              
              // Background enrich: take first 10 non-enriched funds and fetch their NAV/returns
              const toEnrich = data.filter(f => !f.enriched).slice(0, 10).map(f => f.id);
              if (toEnrich.length > 0) {
                  try {
                      const enrichRes = await fetch(`${API}/api/mf/enrich?ids=${toEnrich.join(',')}`);
                      const enrichData = await enrichRes.json();
                      
                      // Check AGAIN if this is still the latest search before merging enrich data
                      if (Array.isArray(enrichData) && currentRequestId === get().searchMfRequestId) {
                          const enrichMap = {};
                          enrichData.forEach(e => { enrichMap[e.id] = e; });
                          
                          const currentFunds = get().mutualFunds;
                          const updatedFunds = currentFunds.map(f => {
                              if (enrichMap[f.id]) {
                                  return { ...f, ...enrichMap[f.id], enriched: true };
                              }
                              return f;
                          });
                          set({ mutualFunds: updatedFunds });
                      }
                  } catch (_) {} // Silent fail for enrichment
              }
          }
      } catch (_) {}
  },

  enrichFundsBatch: async (ids) => {
      if (!ids || ids.length === 0) return;
      try {
          const res = await fetch(`${API}/api/mf/enrich?ids=${ids.join(',')}`, { credentials: 'include' });
          const data = await res.json();
          if (Array.isArray(data)) {
              const enrichMap = {};
              data.forEach(e => { enrichMap[e.id] = e; });
              
              const currentFunds = get().mutualFunds;
              const updatedFunds = currentFunds.map(f => {
                  if (enrichMap[f.id]) {
                      return { ...f, ...enrichMap[f.id], enriched: true };
                  }
                  return f;
              });
              set({ mutualFunds: updatedFunds });
          }
      } catch (_) {}
  },

  updateOrder: async (id, quantity, price, sl_price, tgt_price, isMarket = false, trigger_price = null) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/order/${id}`, { credentials: 'include', method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ quantity, price, sl_price, tgt_price, isMarket, trigger_price })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update order');
      await get().fetchUserData();
      return { success: true };
    } catch (err) {
      set({ authError: err.message });
      return { success: false, error: err.message };
    }
  },


  fundDetailsCache: {},
  fetchFundDetails: async (schemeName) => {
      if (!schemeName) return null;
      const currentCache = get().fundDetailsCache;
      if (currentCache[schemeName] && (Date.now() - currentCache[schemeName].timestamp < 43200000)) {
          return currentCache[schemeName].data;
      }
      try {
          const res = await fetch(`${API}/api/mf/details?name=${encodeURIComponent(schemeName)}`, { credentials: 'include' });
          if (!res.ok) return null;
          const data = await res.json();
          set({ fundDetailsCache: { ...currentCache, [schemeName]: { timestamp: Date.now(), data } } });
          return data;
      } catch (e) {
          console.error("Failed to fetch rich fund details:", e);
          return null;
      }
  },

  fundHistoryCache: {},
  fetchFundHistory: async (schemeCode) => {
      const currentCache = get().fundHistoryCache;
      if (currentCache[schemeCode]) return currentCache[schemeCode]; // already fetched

      try {
          const res = await fetch(`${API}/api/mf/${schemeCode}`, { credentials: 'include' });
          const data = await res.json();
          
          if (data && data.data) {
              // mfapi.in returns data.data as an array of { date: "DD-MM-YYYY", nav: "123.45" }
              // reverse it (descending -> ascending for chart)
              const historicalData = data.data.reverse().map(item => {
                  const [dd, mm, yyyy] = item.date.split('-');
                  return {
                      time: `${yyyy}-${mm}-${dd}`,
                      value: parseFloat(item.nav)
                  };
              });

              const newCache = { ...currentCache, [schemeCode]: historicalData };
              set({ fundHistoryCache: newCache });
              return historicalData;
          }
      } catch (_) {}
      return null;
  },

  convertPosition: async (positionId, newProductType, requiredMargin) => {
      
      try {
          const res = await fetch(`${API}/api/position/convert`, { credentials: 'include', method: 'POST',
              headers: { 'Content-Type': 'application/json', },
              body: JSON.stringify({ positionId, newProductType, requiredMargin }),
          });
          const data = await res.json();
          if (data.success) { get().fetchUserData(); return { success: true }; }
          return { success: false, error: data.error };
      } catch (err) { return { success: false, error: err.message }; }
  },

  updateProfilePicture: async (url) => {
    
    
    try {
      const res = await fetch(`${API}/api/user/profile_picture`, { credentials: 'include', method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ profile_picture_url: url })
      });
      const data = await res.json();
      if (data.success) { 
        get().fetchUserData(); 
        return { success: true }; 
      }
      return { success: false, error: data.error };
    } catch (err) { return { success: false, error: err.message }; }
  },

  saveProfile: async (profileData) => {
    try {
      const token = localStorage.getItem('token') || get().token;
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API}/api/auth/profile`, { 
        credentials: 'include', 
        method: 'POST',
        headers,
        body: JSON.stringify(profileData)
      });
      const data = await res.json();
      if (data.success) { 
        get().fetchUserData(); 
        return { success: true }; 
      }
      return { success: false, error: data.error };
    } catch (err) { 
      return { success: false, error: err.message }; 
    }
  },

  updateUserDetails: async (details) => {
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API}/api/user/details`, {
        method: 'POST',
        headers,
        body: JSON.stringify(details),
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        set({ user: { ...get().user, ...details } });
        if (get().fetchUserData) get().fetchUserData();
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Failed to update profile details' };
      }
    } catch(err) {
      return { success: false, error: err.message };
    }
  },

  updateBankDetails: async (details) => {
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API}/api/user/bank_details`, {
        method: 'POST',
        headers,
        body: JSON.stringify(details),
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        set({ user: { ...get().user, ...details } });
        if (get().fetchUserData) get().fetchUserData();
        return data;
      } else {
        throw new Error(data.error || 'Failed to save bank details');
      }
    } catch(err) {
      throw err;
    }
  },

  requestWithdrawal: async (amount) => {
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API}/api/withdrawals/request`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ amount }),
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        if (get().fetchUserData) get().fetchUserData();
        return data;
      } else {
        throw new Error(data.error || 'Withdrawal request failed');
      }
    } catch(err) {
      throw err;
    }
  },

  // Privacy & Data Rights (DPDP Act 2023 & GDPR)
  recordUserConsent: async (consent_type, status = 'GRANTED', email = null) => {
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API}/api/user/consent`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ consent_type, status, email }),
        credentials: 'include'
      });
      return await res.json();
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  fetchUserConsents: async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API}/api/user/consents`, { headers, credentials: 'include' });
      const data = await res.json();
      return data.consents || [];
    } catch (e) {
      return [];
    }
  },

  submitDataRightsRequest: async (email, request_type, details) => {
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API}/api/user/data-rights-request`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, request_type, details }),
        credentials: 'include'
      });
      return await res.json();
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  downloadDataExport: async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API}/api/user/data-export`, { headers, credentials: 'include' });
      if (!res.ok) throw new Error('Data export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `skandx_data_export_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  fetchAdminWithdrawals: async (page = 1, limit = 50, search = '', startDate = '', endDate = '', isExport = false) => {
    try {
      let url = `${API}/api/admin/withdrawals?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`;
      if (startDate) url += `&startDate=${encodeURIComponent(startDate)}`;
      if (endDate) url += `&endDate=${encodeURIComponent(endDate)}`;
      if (isExport) url += `&export=true`;
      const token = localStorage.getItem('token');
      const res = await fetch(url, { 
        credentials: 'include',
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (res.ok) return { success: true, ...data };
      return { success: false, withdrawals: [], total: 0, totalPages: 1 };
    } catch (e) {
      console.error(e);
      return { success: false, withdrawals: [], total: 0, totalPages: 1 };
    }
  },

  processAdminWithdrawal: async (id, status, remarks = '', utr = '') => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/admin/withdrawals/${id}/process`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ status, remarks, utr }),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data;
    } catch(err) {
      throw err;
    }
  },

  updateKycDocuments: async (kycDocs) => {
    
    
    try {
      const res = await fetch(`${API}/api/user/kyc`, { credentials: 'include', method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify(kycDocs)
      });
      const data = await res.json();
      if (data.success) { 
        get().fetchUserData(); 
        return { success: true }; 
      }
      return { success: false, error: data.error };
    } catch (err) { return { success: false, error: err.message }; }
  },

  // ── Orders ───────────────────────────────────────────────────────────────────
  placeOrder: async (orderPayload) => {
    try {
      const normalizedPayload = {
        ...orderPayload,
        type: orderPayload.type || orderPayload.orderType || 'MARKET',
        product_type: orderPayload.product_type || orderPayload.productType || 'INT'
      };
      const { symbol, quantity, lotsize } = normalizedPayload;

      // Strict Exchange Freeze Limit Validation (Client-Side Protection)
      const cleanSym = symbol ? (symbol.includes(':') ? symbol.split(':')[1] : symbol) : '';
      const isMF = cleanSym.endsWith('-MF') || ['EDEL-MF', 'MIRA-MF', 'NIPP-MF'].includes(cleanSym);
      if (!isMF) {
        const freezeLimit = getFreezeLimit(symbol, lotsize);
        if (freezeLimit && Number(quantity) > freezeLimit) {
          const maxLots = (lotsize && lotsize > 1) ? Math.floor(freezeLimit / lotsize) : freezeLimit;
          const err = (lotsize && lotsize > 1)
            ? `Order quantity (${Number(quantity).toLocaleString('en-IN')} qty / ${Math.round(quantity / lotsize)} lots) exceeds exchange freeze limit of ${freezeLimit.toLocaleString('en-IN')} qty (${maxLots} lots) for ${symbol}. Please place an order within the freeze limit.`
            : `Order quantity (${Number(quantity).toLocaleString('en-IN')} shares) exceeds exchange freeze limit of ${freezeLimit.toLocaleString('en-IN')} shares for ${symbol}. Please place an order within the freeze limit.`;
          return { success: false, error: err };
        }
      }

      // Index Buy Restriction (Subscription Required & Single Active Index Trade Limit)
      const isOrderBuy = String(normalizedPayload.side).toUpperCase() === 'BUY';
      const isTargetIndex = isIndexContract(symbol);
      const isExit = Boolean(normalizedPayload.is_exit || (normalizedPayload.remarks && /exit|square-off|close/i.test(normalizedPayload.remarks)));

      if (isOrderBuy && isTargetIndex && !isExit) {
        const positions = get().positions || [];
        const existingShort = positions.find(p => {
          const s = p.symbol || '';
          const sClean = s.includes(':') ? s.split(':')[1] : s;
          return (s === symbol || sClean === cleanSym) && Number(p.quantity) < 0;
        });
        const isCoveringShort = Boolean(existingShort && Math.abs(Number(existingShort.quantity)) > 0);

        if (!isCoveringShort) {
          const user = get().user;
          const isAdmin = Boolean(user?.is_admin);
          const tier = (user?.subscription_tier || 'BASIC').toUpperCase();
          const isExpired = user?.subscription_expires && new Date(user.subscription_expires).getTime() <= Date.now();
          const activeTier = isExpired ? 'BASIC' : tier;
          const isPaidTier = isAdmin || ['PRO', 'MONTHLY', 'YEARLY', 'HIGHEST', 'FEATURE', 'VIP', 'LIFETIME'].includes(activeTier);

          if (!isPaidTier) {
            const err = 'Index trading (NIFTY, BANKNIFTY, FINNIFTY, SENSEX, etc.) is an exclusive Pro feature. Please upgrade your subscription to trade index options and futures.';
            if (get().showToast) get().showToast(err, 'error', 'Subscription Required');
            return { success: false, error: err, requires_subscription: true };
          }
        }
      }

      const slices = calculateOrderSlices(symbol, quantity, lotsize);

      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // Single unified HTTP request: Backend manages freeze limit slicing, brokerage, and volume matching atomically
      // This eliminates parallel HTTP connection flooding, Node.js event loop lag, and database row explosion
      const payloadToSend = {
        ...normalizedPayload,
        slice_total: slices && slices.length > 1 ? slices.length : 1
      };

      const res = await fetch(`${API}/api/order`, { 
        credentials: 'include', 
        method: 'POST',
        headers,
        body: JSON.stringify(payloadToSend),
      });
      const data = await res.json();
      if (data.success) {
        playOrderExecutedSound();

        // 1. Instantly inject the newly placed order into Zustand state for immediate display
        if (data.orderId) {
          const newOrderRecord = {
            id: data.orderId,
            symbol: normalizedPayload.symbol,
            type: normalizedPayload.type || 'MARKET',
            side: normalizedPayload.side || 'BUY',
            quantity: Number(normalizedPayload.quantity),
            price: Number(normalizedPayload.price || normalizedPayload.quoted_price || 0),
            status: data.status || 'PENDING',
            product_type: normalizedPayload.product_type || 'INT',
            order_variety: normalizedPayload.order_variety || (normalizedPayload.is_amo ? 'AMO' : 'REGULAR'),
            filled_quantity: (data.status === 'EXECUTED' || data.status === 'COMPLETED' || data.status === 'COMPLETE') ? Number(normalizedPayload.quantity) : 0,
            pending_quantity: (data.status === 'EXECUTED' || data.status === 'COMPLETED' || data.status === 'COMPLETE') ? 0 : Number(normalizedPayload.quantity),
            average_price: Number(normalizedPayload.price || normalizedPayload.quoted_price || 0),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          const curOrders = get().orders || [];
          if (!curOrders.some(o => o.id === data.orderId)) {
            set({ orders: [newOrderRecord, ...curOrders] });
          }
        }

        // 2. Force fresh fetch of user data from backend (clear in-flight lock so this fetch is guaranteed)
        window._activeFetchUserDataPromise = null;
        get().fetchUserData().catch(() => {});

        // Show Sponsored Ad right when Buy/New order is placed (Open, Pending, AMO, or Executed)
        if (typeof window !== 'undefined' && data.status !== 'REJECTED') {
          const recentlyWatchedPreExit = Boolean(window.__lastPreExitAdTs && (Date.now() - window.__lastPreExitAdTs < 90000));
          if (normalizedPayload.is_exit && recentlyWatchedPreExit) {
            window.__lastPreExitAdTs = 0;
          } else {
            window.dispatchEvent(new CustomEvent('skandx-trigger-ad', {
              detail: {
                mode: 'post_order',
                symbol: normalizedPayload.symbol || '',
                side: normalizedPayload.side || 'BUY',
                status: data.status || 'EXECUTED'
              }
            }));
          }
        }

        return {
          ...data,
          isSliced: slices && slices.length > 1,
          slicesCount: slices ? slices.length : 1,
          message: slices && slices.length > 1 ? `Successfully placed order (${quantity} total qty across ${slices.length} exchange freeze slices)` : (data.message || 'Order placed successfully')
        };
      }
      if (res.status === 401 && (data?.account_deleted || data?.error?.toLowerCase().includes('deleted') || data?.error?.toLowerCase().includes('not found'))) {
        get().logout();
      }
      console.error('[placeOrder FAILED]', data);
      return { success: false, error: data.error || 'Order failed' };
    } catch (err) { 
      console.error('[placeOrder ERROR]', err);
      return { success: false, error: err.message || 'Network error occurred while placing order.' };
    }
  },

  setupSip: async (sipPayload) => {
    try {
      const res = await fetch(`${API}/api/sip`, { credentials: 'include', method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sipPayload)
      });
      const data = await res.json();
      if (data.success) {
        get().fetchUserData();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('skandx-trigger-ad', {
            detail: {
              mode: 'post_order',
              symbol: sipPayload.symbol || 'MUTUAL FUND',
              side: 'SIP BUY',
              status: 'ACTIVE'
            }
          }));
        }
        return data;
      }
      if (res.status === 401 && (data?.account_deleted || data?.error?.toLowerCase().includes('deleted') || data?.error?.toLowerCase().includes('not found'))) {
        get().logout();
      }
      console.error('[setupSip FAILED]', data);
      return data;
    } catch (err) {
      console.error('[setupSip ERROR]', err);
      return null;
    }
  },

  // Defect 42: Create SIP action for MutualFundModal and general SIP creation
  createSip: async (sipPayload) => {
    try {
      const symbol = String(sipPayload.scheme_code || sipPayload.symbol || '');
      const symWithSuffix = symbol.endsWith('-MF') ? symbol : `${symbol}-MF`;
      const payload = {
        symbol: symWithSuffix,
        amount: Number(sipPayload.amount),
        frequency: sipPayload.frequency || 'MONTHLY',
        anchor_day: sipPayload.sip_day || sipPayload.anchor_day,
        name: sipPayload.scheme_name || sipPayload.name
      };
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API}/api/sip`, {
        credentials: 'include',
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        get().fetchUserData().catch(() => {});
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('skandx-trigger-ad', {
            detail: {
              mode: 'post_order',
              symbol: symWithSuffix,
              side: 'SIP BUY',
              status: 'ACTIVE'
            }
          }));
        }
        return data;
      }
      return { success: false, error: data.error || 'Failed to create SIP' };
    } catch (err) {
      console.error('[createSip ERROR]', err);
      return { success: false, error: err.message };
    }
  },

  // Defect 41: Lumpsum Mutual Fund Purchase action
  buyMutualFund: async (schemeCode, amount) => {
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API}/api/mutual-funds/buy`, {
        credentials: 'include',
        method: 'POST',
        headers,
        body: JSON.stringify({ scheme_code: schemeCode, amount: Number(amount) })
      });
      const data = await res.json();
      if (data.success) {
        get().fetchUserData().catch(() => {});
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('skandx-trigger-ad', {
            detail: {
              mode: 'post_order',
              symbol: `${schemeCode}-MF`,
              side: 'BUY',
              status: 'EXECUTED'
            }
          }));
        }
        return data;
      }
      return { success: false, error: data.error || 'Mutual fund purchase failed' };
    } catch (err) {
      console.error('[buyMutualFund ERROR]', err);
      return { success: false, error: err.message };
    }
  },

  executeSipNow: async (id) => {
    try {
      const res = await fetch(`${API}/api/sip/${id}/execute-now`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        get().fetchUserData();
      }
      return data;
    } catch (err) {
      console.error('[executeSipNow ERROR]', err);
      return { success: false, error: err.message };
    }
  },
  cancelSip: async (id) => {
    try {
      const res = await fetch(`${API}/api/sip/${id}`, { credentials: 'include', method: 'DELETE' });
      const data = await res.json();
      if (data.success) { get().fetchUserData(); return data; }
      return data;
    } catch (err) {
      console.error('[cancelSip ERROR]', err);
      return null;
    }
  },

  cancelOrder: async (orderId) => {
    try {
      const token = localStorage.getItem('token');
      const res  = await fetch(`${API}/api/order/${orderId}/cancel`, { 
        credentials: 'include', 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      const data = await res.json();
      if (data.success) { 
        get().fetchUserData(); 
        if (data.autoExited && data.message) {
          alert("ℹ️ " + data.message);
        }
        return true; 
      }
      if (data.error) set({ authError: data.error });
      return false;
    } catch (_) { return false; }
  },

  // ── Wallet / Deposits ───────────────────────────────────────────────────────
  requestDeposit: async (amount) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/wallet/deposit`, { 
        credentials: 'include', 
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ amount })
      });
      const data = await res.json();
      return data.success ? { success: true } : { success: false, error: data.error };
    } catch (e) {
      return { success: false, error: 'Network error' };
    }
  },

  resetAccount: async (amount) => {
    const { user } = get();
    if (!user) return { success: false };
    try {
      const token = localStorage.getItem('token') || user.token;
      const res = await fetch(`${API}/api/user/reset`, { 
        credentials: 'include', 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ amount: amount ? parseFloat(amount) : undefined })
      });
      const data = await res.json();
      if (data.success) {
        const newBal = data.balance !== undefined ? data.balance : (parseFloat(amount) || 1000000.0);
        // Optimistically update local state to reflect the wipe and new balance
        set({ 
          positions: [], 
          orders: [], 
          holdings: [], 
          sips: [], 
          pendingTriggers: [], 
          alerts: [], 
          user: { ...user, balance: newBal } 
        });
        return { success: true, balance: newBal, message: data.message };
      }
      return { success: false, error: data.error };
    } catch (e) {
      return { success: false, error: 'Network error' };
    }
  },

  // ── Settings ────────────────────────────────────────────────────────────────
  updatePassword: async (oldPassword, newPassword) => {
    
    
    try {
      const res = await fetch(`${API}/api/user/password`, { credentials: 'include', method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ oldPassword, newPassword })
      });
      const data = await res.json();
      return data.success ? { success: true } : { success: false, error: data.error };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  syncWatchlists: async (watchlists) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/user/watchlists`, { credentials: 'include', method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ watchlists })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data && data.error) {
          get().showToast(data.error, 'error', 'Watchlist Limit');
          get().fetchUserData();
        }
      }
    } catch (err) {}
  },

  // ─── Admin ───────────────────────────────────────────────────────────────
  fetchAdminAnalytics: async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/admin/analytics`, { 
        credentials: 'include',
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      if (res.ok) {
        const data = await res.json();
        return { success: true, data };
      }
      return { success: false, error: 'Failed' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  fetchAdminOrders: async (page = 1, limit = 50, search = '', startDate = '', endDate = '', isExport = false) => {
    try {
      let url = `${API}/api/admin/orders?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`;
      if (startDate) url += `&startDate=${encodeURIComponent(startDate)}`;
      if (endDate) url += `&endDate=${encodeURIComponent(endDate)}`;
      if (isExport) url += `&export=true`;
      const token = localStorage.getItem('token');
      const res = await fetch(url, { 
        credentials: 'include',
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  fetchAdminPositions: async (page = 1, limit = 50, search = '', startDate = '', endDate = '', isExport = false) => {
    try {
      let url = `${API}/api/admin/positions?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`;
      if (startDate) url += `&startDate=${encodeURIComponent(startDate)}`;
      if (endDate) url += `&endDate=${encodeURIComponent(endDate)}`;
      if (isExport) url += `&export=true`;
      const token = localStorage.getItem('token');
      const res = await fetch(url, { 
        credentials: 'include',
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  fetchAdminTelemetry: async (timeframe = 'all') => {
    try {
      const res = await fetch(`${API}/api/admin/telemetry?timeframe=${timeframe}`, { credentials: 'omit' });
      const data = await res.json();
      if (data && !data.error) {
        set({ adminTelemetry: data });
      }
      return data;
    } catch (err) {
      console.error('Failed to load telemetry:', err);
    }
  },

  resetAdminTelemetry: async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/admin/telemetry/reset`, {
        method: 'POST',
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (data.success) {
        set({ adminTelemetry: { api: [], users: [] } });
      }
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  fetchAdminLedger: async (page = 1, limit = 50, search = '', startDate = '', endDate = '', isExport = false) => {
    try {
      let url = `${API}/api/admin/ledger?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`;
      if (startDate) url += `&startDate=${encodeURIComponent(startDate)}`;
      if (endDate) url += `&endDate=${encodeURIComponent(endDate)}`;
      if (isExport) url += `&export=true`;
      const token = localStorage.getItem('token');
      const res = await fetch(url, { 
        credentials: 'include',
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  forceCloseUserPosition: async (positionId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/admin/force-close`, { 
        credentials: 'include', 
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ positionId })
      });
      const data = await res.json();
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // ── Admin ───────────────────────────────────────────────────────────────────
  toggleUserBan: async (userId) => {
    try {
      const res = await fetch(`${API}/api/admin/users/${userId}/toggle_ban`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        // Refresh admin users list after ban status changes
        get().fetchAdminUsers();
        return data;
      } else {
        throw new Error(data.error || 'Failed to toggle ban');
      }
    } catch(err) {
      console.error(err);
      throw err;
    }
  },

  
  adminMasterSquareOff: async () => {
    try {
      const res = await fetch(`${API}/api/admin/master_square_off`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        return data;
      } else {
        throw new Error(data.error || 'Failed to trigger Master Square-Off');
      }
    } catch(err) {
      console.error(err);
      throw err;
    }
  },

  fetchAdminUsers: async (page = 1, limit = 50, search = '', startDate = '', endDate = '', isExport = false) => {
    try {
      let url = `${API}/api/admin/users?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`;
      if (startDate) url += `&startDate=${encodeURIComponent(startDate)}`;
      if (endDate) url += `&endDate=${encodeURIComponent(endDate)}`;
      if (isExport) url += `&export=true`;
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        return { success: true, ...data }; // returns { success, users, total, page, totalPages }
      }
      return { success: false };
    } catch (err) {
      console.error(err);
      return { success: false };
    }
  },

  adminResetUser: async (userId) => {
    
    
    try {
      const res = await fetch(`${API}/api/admin/user/${userId}/reset`, { credentials: 'include', method: 'POST'
      });
      const data = await res.json();
      return data.success ? { success: true } : { success: false, error: data.error };
    } catch (e) {
      return { success: false, error: 'Network error' };
    }
  },

  adminDeleteUser: async (userId) => {
    try {
      const res = await fetch(`${API}/api/admin/user/${userId}`, { credentials: 'include', method: 'DELETE' });
      const data = await res.json();
      return data.success ? { success: true } : { success: false, error: data.error };
    } catch (e) {
      return { success: false, error: 'Network error' };
    }
  },

  updateUserBalance: async (userId, balance) => {
    try {
      const res = await fetch(`${API}/api/admin/user/${userId}/balance`, { credentials: 'include', method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ balance })
      });
      const data = await res.json();
      return data.success ? { success: true } : { success: false, error: data.error };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  adminUpdateUserDetails: async (userId, details) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/admin/user/${userId}`, { 
        credentials: 'include', 
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(details)
      });
      if (res.ok) {
        return { success: true };
      }
      const data = await res.json();
      return { success: false, error: data.error };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  adminImpersonateUser: async (userId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/admin/impersonate/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      const data = await res.json();
      if (data && data.success && data.token && data.user) {
        localStorage.setItem('admin_token_backup', token);
        localStorage.setItem('token', data.token);
        set({
          token: data.token,
          user: data.user,
          watchlists: ensureWatchlistsWithDefaults(data.user.watchlists)
        });
        get().fetchUserData();
        return { success: true, user: data.user };
      }
      return { success: false, error: data?.error || 'Failed to impersonate user' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  exitImpersonation: () => {
    try {
      const adminToken = localStorage.getItem('admin_token_backup');
      if (adminToken) {
        localStorage.setItem('token', adminToken);
        localStorage.removeItem('admin_token_backup');
        window.location.href = '/adminpanel';
        return true;
      }
    } catch (e) {}
    return false;
  },

  fetchDepositRequests: async (page = 1, limit = 50, search = '', startDate = '', endDate = '', isExport = false) => {
    try {
      let url = `${API}/api/admin/deposits?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`;
      if (startDate) url += `&startDate=${encodeURIComponent(startDate)}`;
      if (endDate) url += `&endDate=${encodeURIComponent(endDate)}`;
      if (isExport) url += `&export=true`;
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        return { success: true, ...data };
      }
      return { success: false, error: 'Unauthorized' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  processDeposit: async (depositId, action) => {
    // action should be 'approve' or 'reject'
    
    
    try {
      const res = await fetch(`${API}/api/admin/deposits/${depositId}/${action}`, { credentials: 'include', method: 'POST'
      });
      const data = await res.json();
      return data.success ? { success: true } : { success: false, error: data.error };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  setToken: (token) => set({ token }),
  setUser:  (user)  => set({ user }),
  logout: () => {
    const u = get().user;
    if (u?.id) {
      setAppLocked(false, u.id);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('admin_token_backup');
    localStorage.removeItem('hasSkippedOnboarding');
    set({
      hasSkippedOnboarding: false,
      token: null,
      user: null,
      isSessionExpired: false,
      toast: null,
      positions: [],
      orders: [],
      holdings: [],
      sips: [],
      pendingTriggers: [],
      alerts: [],
      basketItems: []
    });
    fetch(`${API}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(()=>{});
  },
  
  // ── Mutual Fund Watchlist ──────────────────────────────────────────────────
  mfWatchlist: (() => {
    try {
      const saved = localStorage.getItem('mfWatchlist');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  })(),

  mfWatchlistFunds: (() => {
    try {
      const saved = localStorage.getItem('mfWatchlistFunds');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  })(),

  fetchMfWatchlistFunds: async () => {
    const list = get().mfWatchlist || [];
    if (!Array.isArray(list) || list.length === 0) return;
    try {
      const res = await fetch(`${API}/api/mf/by-ids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: list })
      });
      if (!res.ok) return;
      const funds = await res.json();
      if (Array.isArray(funds) && funds.length > 0) {
        const updated = { ...(get().mfWatchlistFunds || {}) };
        funds.forEach(f => {
          if (f && f.id) {
            const cleanId = String(f.id).replace('-MF', '');
            updated[cleanId] = f;
            updated[`${cleanId}-MF`] = f;
          }
        });
        set({ mfWatchlistFunds: updated });
        try { localStorage.setItem('mfWatchlistFunds', JSON.stringify(updated)); } catch (e) {}
      }
    } catch (err) {
      console.warn('Failed to fetch mf watchlist funds:', err);
    }
  },
  
  toggleMfWatchlist: (fundOrSymbol) => {
    let current = get().mfWatchlist || [];
    let currentFunds = { ...(get().mfWatchlistFunds || {}) };

    let id = fundOrSymbol;
    let fundObj = null;

    if (fundOrSymbol && typeof fundOrSymbol === 'object') {
      id = fundOrSymbol.id;
      fundObj = fundOrSymbol;
    }

    const symStr = String(id);
    const cleanId = symStr.replace('-MF', '');

    if (current.some(s => String(s) === symStr || String(s).replace('-MF', '') === cleanId)) {
      // Remove from watchlist
      current = current.filter(s => String(s) !== symStr && String(s).replace('-MF', '') !== cleanId);
      delete currentFunds[symStr];
      delete currentFunds[cleanId];
      delete currentFunds[`${cleanId}-MF`];
    } else {
      // Add to watchlist
      current = [...current, cleanId];
      if (!fundObj) {
        fundObj = (get().mutualFunds || []).find(f => String(f.id) === cleanId || String(f.id) === symStr);
      }
      if (fundObj) {
        currentFunds[cleanId] = fundObj;
        currentFunds[`${cleanId}-MF`] = fundObj;
      }
    }

    set({ mfWatchlist: current, mfWatchlistFunds: currentFunds });
    try {
      localStorage.setItem('mfWatchlist', JSON.stringify(current));
      localStorage.setItem('mfWatchlistFunds', JSON.stringify(currentFunds));
    } catch (e) {}

    // If added without full object, fetch details from backend
    if (!fundObj && current.some(s => String(s).replace('-MF', '') === cleanId)) {
      get().fetchMfWatchlistFunds();
    }
  },

  // ── Theme ───────────────────────────────────────────────────────────────────
  theme: 'dark', // default to dark
  fontSize: 'medium',
  accessibilityMode: false,
  setFontSize: (size) => set((state) => {
    document.body.classList.remove('font-small', 'font-medium', 'font-large');
    document.body.classList.add('font-' + size);
    
    // Direct DOM manipulation for instant scaling bypassing CSS cache
    if (size === 'small') {
      document.body.style.zoom = '0.85';
      document.documentElement.style.setProperty('--app-scale', '0.85');
      document.body.style.MozTransform = 'scale(0.85)';
      document.body.style.MozTransformOrigin = 'top left';
    } else if (size === 'large') {
      document.body.style.zoom = '1.1';
      document.documentElement.style.setProperty('--app-scale', '1.1');
      document.body.style.MozTransform = 'scale(1.1)';
      document.body.style.MozTransformOrigin = 'top left';
    } else {
      document.body.style.zoom = '1';
      document.documentElement.style.setProperty('--app-scale', '1');
      document.body.style.MozTransform = 'scale(1)';
      document.body.style.MozTransformOrigin = 'top left';
    }
    
    return { fontSize: size };
  }),
  setAccessibilityMode: (mode) => set({ accessibilityMode: mode }),
  toggleTheme: () => set((state) => {
    const newTheme = state.theme === 'dark' ? 'light' : 'dark';
    if (newTheme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
    return { theme: newTheme };
  }),
  setTheme: (newTheme) => set((state) => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', newTheme);
      if (newTheme === 'light') {
        document.body.classList.add('light-mode');
      } else {
        document.body.classList.remove('light-mode');
      }
    }
    return { theme: newTheme };
  }),

  // ── One-Click Scalper Mode ──────────────────────────────────────────────────
  oneClickMode: false,
  oneClickMultiplier: 1,
  setOneClickMode: (val) => set({ oneClickMode: val }),
  setOneClickMultiplier: (val) => set({ oneClickMultiplier: val }),

  // ── Leaderboard ─────────────────────────────────────────────────────────────
  leaderboard: [],
  leaderboardLoading: false,
  leaderboardSegment: 'ALL',
  fetchLeaderboard: async (params = {}) => {
    try {
      set({ leaderboardLoading: true });
      const queryParams = new URLSearchParams();
      if (params.contest_id) queryParams.set('contest_id', params.contest_id);
      if (params.segment && params.segment !== 'ALL') queryParams.set('segment', params.segment);
      if (params.timeframe) queryParams.set('timeframe', params.timeframe);

      const url = `${API}/api/leaderboard${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const res = await fetch(url, { credentials: 'omit' });
      const data = await res.json();
      if (data?.success) {
        set({
          leaderboard: data.leaderboard || [],
          leaderboardSegment: data.segment || 'ALL',
          leaderboardLoading: false
        });
      } else {
        set({ leaderboardLoading: false });
      }
      return data;
    } catch (err) {
      set({ leaderboardLoading: false });
      return { success: false, error: err.message };
    }
  },

  // ── Announcements ───────────────────────────────────────────────────────────
  announcement: null,
  _lastAnnouncementFetch: 0,
  fetchAnnouncement: async (force = false) => {
    const now = Date.now();
    if (!force && (now - (get()._lastAnnouncementFetch || 0) < 300000)) return;
    try {
      const res = await fetch(`${API}/api/announcement`, { credentials: 'omit' });
      const data = await res.json();
      if (data?.success) {
        set({ announcement: data.announcement, _lastAnnouncementFetch: now });
      }
      return data;
    } catch (err) {
      console.error('Failed to fetch announcement:', err);
    }
  },
  setAdminAnnouncement: async (text, type = 'info') => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/admin/announcement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ text, type })
      });
      const data = await res.json();
      if (data?.success) {
        set({ announcement: data.announcement || null });
      }
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
  setAnnouncement: (announcement) => set({ announcement }),

  broadcastNotifications: [],
  unreadNotificationsCount: 0,
  activeBroadcastToast: null,
  dismissBroadcastToast: () => set({ activeBroadcastToast: null }),
  markAllNotificationsRead: () => set({ unreadNotificationsCount: 0 }),
  fetchBroadcastNotifications: async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/notifications`, {
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (data?.success && Array.isArray(data.notifications)) {
        let clearedIds = [];
        try {
          clearedIds = JSON.parse(localStorage.getItem('skandx_cleared_notifications') || '[]');
        } catch (_) {}
        const clearedSet = new Set(clearedIds);
        const activeList = data.notifications.filter(n => !clearedSet.has(n.id));
        set({ broadcastNotifications: activeList });
      }
      return data;
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  },
  dismissNotification: (id) => {
    try {
      const clearedIds = JSON.parse(localStorage.getItem('skandx_cleared_notifications') || '[]');
      if (!clearedIds.includes(id)) clearedIds.push(id);
      localStorage.setItem('skandx_cleared_notifications', JSON.stringify(clearedIds.slice(-200)));
    } catch (_) {}
    const currentList = get().broadcastNotifications || [];
    set({ broadcastNotifications: currentList.filter(n => n.id !== id) });
  },
  clearAllNotifications: () => {
    try {
      const currentList = get().broadcastNotifications || [];
      const clearedIds = JSON.parse(localStorage.getItem('skandx_cleared_notifications') || '[]');
      currentList.forEach(n => {
        if (!clearedIds.includes(n.id)) clearedIds.push(n.id);
      });
      localStorage.setItem('skandx_cleared_notifications', JSON.stringify(clearedIds.slice(-200)));
    } catch (_) {}
    set({ broadcastNotifications: [], unreadNotificationsCount: 0 });
  },
  sendBroadcastNotification: async (payload) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/admin/broadcast-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data?.success && data?.notification) {
        const currentList = get().broadcastNotifications || [];
        set({ broadcastNotifications: [data.notification, ...currentList] });
      }
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
  deleteBroadcastNotification: async (id) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/admin/broadcast-notification/${id}`, {
        method: 'DELETE',
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (data?.success) {
        const currentList = get().broadcastNotifications || [];
        set({ broadcastNotifications: currentList.filter(n => n.id !== id) });
      }
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
  clearOldBroadcasts: async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/admin/broadcast-notifications/clear-old`, {
        method: 'POST',
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (data?.success) {
        await get().fetchBroadcastNotifications();
      }
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
  revokeAllBroadcasts: async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/admin/broadcast-notifications/clear-all`, {
        method: 'POST',
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (data?.success) {
        set({ broadcastNotifications: [], unreadNotificationsCount: 0 });
      }
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  bannedEntities: [],
  fetchBannedEntities: async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/admin/banned`, {
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (data?.bans) {
        set({ bannedEntities: data.bans });
      }
      return data;
    } catch (err) {
      console.error('Failed to fetch banned entities:', err);
      return { bans: [] };
    }
  },

  banEntity: async (type, value, reason = '') => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/admin/ban`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ type, value, reason })
      });
      const data = await res.json();
      if (data?.success) {
        get().fetchBannedEntities();
      }
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  unbanEntity: async ({ id, type, value }) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/admin/unban`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ id, type, value })
      });
      const data = await res.json();
      if (data?.success) {
        get().fetchBannedEntities();
      }
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // ── Market Status & Fyers Health ───────────────────────────────────────────
  marketStatus: { equity: 'AUTO', commodity: 'AUTO' },
  fyersStatus: null,
  _lastMarketStatusFetch: 0,

  fetchMarketStatus: async (force = false) => {
    const now = Date.now();
    if (!force && (now - (get()._lastMarketStatusFetch || 0) < 120000)) return;
    try {
      const res = await fetch(`${API}/api/market-status`);
      const data = await res.json();
      if (data && data.success) {
        set({ 
          marketStatus: { equity: data.equity || 'AUTO', commodity: data.commodity || 'AUTO' },
          _lastMarketStatusFetch: now
        });
      }
    } catch (e) {}
  },

  fetchFyersStatus: async () => {
    try {
      const res = await fetch(`${API}/api/fyers/status`);
      const data = await res.json();
      set({ fyersStatus: data });
      return data;
    } catch (e) {
      return null;
    }
  },

  updateMarketStatus: async (equity, commodity) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/admin/market-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ equity, commodity })
      });
      const data = await res.json();
      if (data && data.success) {
        set({ marketStatus: { equity: data.equity, commodity: data.commodity } });
        return { success: true };
      }
      return { success: false, error: data?.error || 'Failed to update market status' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  // ── Market Calendar & Scheduled Holidays ───────────────────────────────────
  marketCalendar: [],
  todayMarketSchedule: null,
  _lastMarketCalendarFetch: 0,
  _lastTodayScheduleFetch: 0,

  fetchMarketCalendar: async (month, force = false) => {
    const now = Date.now();
    if (!month && !force && (now - (get()._lastMarketCalendarFetch || 0) < 60000) && get().marketCalendar.length > 0) {
      return get().marketCalendar;
    }
    try {
      const url = month ? `${API}/api/market-calendar?month=${month}` : `${API}/api/market-calendar`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.success) {
        const rawCalendar = data.calendar || [];
        const normalized = rawCalendar.map(r => ({
          ...r,
          date: typeof r.date === 'string' ? r.date.split('T')[0] : r.date
        }));
        normalized.sort((a, b) => ((a.date || '') > (b.date || '') ? 1 : -1));
        set({ marketCalendar: normalized, _lastMarketCalendarFetch: now });
        return normalized;
      }
    } catch (e) {
      console.error('fetchMarketCalendar error', e);
    }
    return get().marketCalendar || [];
  },

  fetchTodayMarketSchedule: async (force = false) => {
    const now = Date.now();
    if (!force && (now - (get()._lastTodayScheduleFetch || 0) < 60000) && get().todayMarketSchedule) {
      return get().todayMarketSchedule;
    }
    try {
      const res = await fetch(`${API}/api/market-calendar/today`);
      const data = await res.json();
      if (data && data.success) {
        set({ todayMarketSchedule: data, _lastTodayScheduleFetch: now });
        return data;
      }
    } catch (e) {}
    return get().todayMarketSchedule;
  },

  saveMarketCalendarDate: async (entry) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/admin/market-calendar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(entry)
      });
      const data = await res.json();
      if (data && data.success) {
        const savedEntry = data.entry || entry;
        const dStr = typeof savedEntry.date === 'string' ? savedEntry.date.split('T')[0] : savedEntry.date;
        const normalizedEntry = { ...savedEntry, date: dStr };
        const current = get().marketCalendar || [];
        const next = current.filter(r => (r.date || '').split('T')[0] !== dStr).concat(normalizedEntry);
        next.sort((a, b) => ((a.date || '') > (b.date || '') ? 1 : -1));
        set({ marketCalendar: next, _lastMarketCalendarFetch: Date.now() });

        // Force fetch fresh from server to ensure 100% parity
        get().fetchMarketCalendar(null, true);
        get().fetchTodayMarketSchedule(true);
        return { success: true, entry: normalizedEntry };
      }
      return { success: false, error: data?.error || 'Failed to save calendar rule' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  deleteMarketCalendarDate: async (date) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/admin/market-calendar/${date}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      const data = await res.json();
      if (data && data.success) {
        const dStr = typeof date === 'string' ? date.split('T')[0] : date;
        const current = get().marketCalendar || [];
        const next = current.filter(r => (r.date || '').split('T')[0] !== dStr);
        set({ marketCalendar: next, _lastMarketCalendarFetch: Date.now() });

        // Force fetch fresh from server to ensure 100% parity
        get().fetchMarketCalendar(null, true);
        get().fetchTodayMarketSchedule(true);
        return { success: true };
      }
      return { success: false, error: data?.error || 'Failed to delete calendar rule' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  seedMarketHolidays: async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/admin/market-calendar/bulk-holidays`, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      const data = await res.json();
      if (data && data.success) {
        await get().fetchMarketCalendar(null, true);
        await get().fetchTodayMarketSchedule(true);
        return { success: true, count: data.count };
      }
      return { success: false, error: data?.error || 'Failed to seed holidays' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  // ── Contests & Tournaments ────────────────────────────────────────────────
  activeContest: null,
  activeContests: [],
  pastContests: [],
  activeContestLoading: false,
  adminContests: [],

  fetchActiveContest: async () => {
    try {
      set({ activeContestLoading: true });
      const res = await fetch(`${API}/api/contests/active`);
      const data = await res.json();
      if (data && data.success) {
        const contests = data.contests || (data.contest ? [data.contest] : []);
        set({
          activeContests: contests,
          activeContest: data.contest || contests[0] || null,
          activeContestTop: data.topContenders || []
        });
        return data;
      }
    } catch (e) {
      console.error('fetchActiveContest error:', e);
    } finally {
      set({ activeContestLoading: false });
    }
    return null;
  },

  fetchPastContests: async () => {
    try {
      const res = await fetch(`${API}/api/contests/past`);
      const data = await res.json();
      if (data && data.success) {
        set({ pastContests: data.contests || [] });
        return data.contests || [];
      }
    } catch (e) {
      console.error('fetchPastContests error:', e);
    }
    return [];
  },

  selectActiveContest: (contest) => {
    set({ activeContest: contest });
  },

  fetchAdminContests: async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/admin/contests`, {
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (data && data.success) {
        set({ adminContests: data.contests || [] });
        return data.contests || [];
      }
    } catch (e) {
      console.error('fetchAdminContests error:', e);
    }
    return [];
  },

  saveContest: async (contestData) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/admin/contests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(contestData)
      });
      const data = await res.json();
      if (data && data.success) {
        get().fetchActiveContest();
        get().fetchAdminContests();
        get().fetchPastContests();
        return { success: true };
      }
      return { success: false, error: data?.error || 'Failed to save contest' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  deleteContest: async (contestId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/admin/contests/${contestId}`, {
        method: 'DELETE',
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (data && data.success) {
        get().fetchActiveContest();
        get().fetchAdminContests();
        get().fetchPastContests();
        return { success: true };
      }
      return { success: false, error: data?.error || 'Failed to delete contest' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  awardContest: async (contestId, awardData) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/admin/contests/${contestId}/award`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(awardData)
      });
      const data = await res.json();
      if (data && data.success) {
        get().fetchActiveContest();
        get().fetchAdminContests();
        get().fetchPastContests();
        return { success: true };
      }
      return { success: false, error: data?.error || 'Failed to award contest' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  // ── Session & Device Security Manager ─────────────────────────────────────
  userSessions: [],
  userSessionsLoading: false,

  fetchUserSessions: async () => {
    try {
      set({ userSessionsLoading: true });
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/user/sessions`, {
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (data && data.success) {
        set({ userSessions: data.sessions || [] });
        return data.sessions || [];
      }
    } catch (e) {
      console.error('fetchUserSessions error:', e);
    } finally {
      set({ userSessionsLoading: false });
    }
    return [];
  },

  revokeOtherSessions: async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/user/sessions/revoke-others`, {
        method: 'POST',
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (data && data.success) {
        get().fetchUserSessions();
        return { success: true, message: data.message };
      }
      return { success: false, error: data?.error || 'Failed to revoke other sessions' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  cleanDuplicateSessions: async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/user/sessions/clean-duplicates`, {
        method: 'POST',
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (data && data.success) {
        get().fetchUserSessions();
        return { success: true, message: data.message, count: data.cleanedCount };
      }
      return { success: false, error: data?.error || 'Failed to clean duplicate sessions' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  revokeSession: async (sessionId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/user/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (data && data.success) {
        get().fetchUserSessions();
        return { success: true };
      }
      return { success: false, error: data?.error || 'Failed to revoke session' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  // ── Google Authenticator (TOTP) & 30-Day Device Trust ──────────────────────
  totpLoading: false,
  trustedDevices: [],
  trustedDevicesLoading: false,

  fetchTotpSetup: async () => {
    try {
      set({ totpLoading: true });
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/user/totp/setup`, {
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (data && data.success && !data.qrCode && data.otpauth_url) {
        data.qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data.otpauth_url)}`;
      }
      return data;
    } catch (e) {
      return { success: false, error: e.message };
    } finally {
      set({ totpLoading: false });
    }
  },

  enableTotp: async (secret, code) => {
    try {
      set({ totpLoading: true });
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/user/totp/enable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ secret, code })
      });
      const data = await res.json();
      if (data && data.success) {
        if (get().user) set({ user: { ...get().user, totp_enabled: true } });
        return { success: true, message: data.message };
      }
      return { success: false, error: data?.error || 'Failed to enable Google Authenticator' };
    } catch (e) {
      return { success: false, error: e.message };
    } finally {
      set({ totpLoading: false });
    }
  },

  disableTotp: async (password) => {
    try {
      set({ totpLoading: true });
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/user/totp/disable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (data && data.success) {
        if (get().user) set({ user: { ...get().user, totp_enabled: false } });
        return { success: true, message: data.message };
      }
      return { success: false, error: data?.error || 'Failed to disable Google Authenticator' };
    } catch (e) {
      return { success: false, error: e.message };
    } finally {
      set({ totpLoading: false });
    }
  },

  fetchTrustedDevices: async () => {
    try {
      set({ trustedDevicesLoading: true });
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/user/trusted-devices`, {
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (data && data.success) {
        set({ trustedDevices: data.devices || [] });
        return data.devices || [];
      }
    } catch (e) {
      console.error('fetchTrustedDevices error:', e);
    } finally {
      set({ trustedDevicesLoading: false });
    }
    return [];
  },

  revokeTrustedDevice: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/user/trusted-devices/${deviceId}`, {
        method: 'DELETE',
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (data && data.success) {
        get().fetchTrustedDevices();
        return { success: true };
      }
      return { success: false, error: data?.error || 'Failed to revoke device trust' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  // ── Telegram Live Trade & Risk Alerts ─────────────────────────────────────
  telegramSettings: null,
  telegramSettingsLoading: false,

  fetchTelegramSettings: async () => {
    try {
      set({ telegramSettingsLoading: true });
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/telegram/settings`, {
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (data && data.success) {
        set({ telegramSettings: data });
        return data;
      }
    } catch (e) {
      console.error('fetchTelegramSettings error:', e);
    } finally {
      set({ telegramSettingsLoading: false });
    }
    return null;
  },

  saveTelegramSettings: async (settings) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/telegram/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data && data.success) {
        get().fetchTelegramSettings();
        return { success: true, message: data.message };
      }
      return { success: false, error: data?.error || 'Failed to save Telegram settings' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  sendTelegramTest: async (chatId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/telegram/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ chat_id: chatId })
      });
      const data = await res.json();
      if (data && data.success) {
        return { success: true, message: data.message };
      }
      return { success: false, error: data?.error || 'Failed to send test message' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  // Admin Telegram Traffic & Peak Protection
  telegramAdminConfig: null,
  fetchTelegramAdminConfig: async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/admin/telegram/config`, {
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (data && data.success) {
        set({ telegramAdminConfig: data });
        return data;
      }
    } catch (e) {
      console.error('fetchTelegramAdminConfig error:', e);
    }
    return null;
  },

  updateTelegramAdminConfig: async (config) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/admin/telegram/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (data && data.success) {
        get().fetchTelegramAdminConfig();
        return { success: true, message: data.message };
      }
      return { success: false, error: data?.error || 'Failed to update Telegram admin config' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  broadcastTelegramMessage: async (message) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/admin/telegram/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ message })
      });
      const data = await res.json();
      return data;
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

}), {
  name: 'skandx-storage',
  partialize: (state) => ({
    watchlists:        state.watchlists,
    activeWatchlistId: state.activeWatchlistId,
    token:             state.token,
    user:              state.user,
    theme:             state.theme,
      fontSize:          state.fontSize,
      accessibilityMode: state.accessibilityMode,
    pendingTriggers:   state.pendingTriggers,
    oneClickMode:      state.oneClickMode,
    oneClickMultiplier: state.oneClickMultiplier,
    alerts:            state.alerts,
  }),
}));

if (typeof window !== 'undefined') {
  window.__triggerSessionExpired = () => {
    try {
      const s = useStore.getState();
      if (s.user && !s.isSessionExpired) {
        s.setSessionExpired(true);
      }
    } catch (_) {}
  };
}













