import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { io } from 'socket.io-client';

export let API = '';
if (import.meta.env && import.meta.env.VITE_API_URL) {
  API = import.meta.env.VITE_API_URL.replace(/\/+$/, '');
}

// Global HTTP Fetch Interceptor to support Token-based authentication
// when third-party cookies are blocked by browser settings (e.g. Incognito or Safari)
const originalFetch = window.fetch;
window.fetch = async function (url, options = {}) {
  const token = localStorage.getItem('token');
  if (token && typeof url === 'string' && url.includes('/api/')) {
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };
  }
  return originalFetch(url, options);
};

export const socket = io(API, { withCredentials: false });

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Merge a price snapshot object into the current prices map, tagging each tick direction */
function applySnapshot(snapshot, state) {
  const newPrices = { ...state.prices };
  for (const [symbol, data] of Object.entries(snapshot)) {
    const old = newPrices[symbol];
    const tick = old
      ? data.ltp > old.ltp ? 'up' : data.ltp < old.ltp ? 'down' : 'flat'
      : 'flat';
    newPrices[symbol] = { ...data, tick };
  }
  return newPrices;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useStore = create(persist((set, get) => ({

  // ── Auth ────────────────────────────────────────────────────────────────────
  user:      null,
  
  authError: null,

  login: async (email, password) => {
    try {
      set({ authError: null });
      const res  = await fetch(`${API}/api/auth/login`, { credentials: 'include', method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.token) localStorage.setItem('token', data.token);
        if (data.user?.id) socket.emit('register_user', data.user.id);
        set({
          user:       data.user,
          
          watchlists: data.user.watchlists || [{ id: 1, name: 'Watchlist 1', symbols: [] }],
        });
        get().fetchUserData();
      } else {
        set({ authError: data.error });
      }
    } catch (err) {
      set({ authError: err.message });
    }
  },

  register: async (username, email, password) => {
    try {
      set({ authError: null });
      const res  = await fetch(`${API}/api/auth/register`, { credentials: 'include', method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.token) localStorage.setItem('token', data.token);
        if (data.user?.id) socket.emit('register_user', data.user.id);
        set({
          user:       data.user,
          
          watchlists: data.user.watchlists || [{ id: 1, name: 'Watchlist 1', symbols: [] }],
        });
        get().fetchUserData();
      } else {
        set({ authError: data.error });
      }
    } catch (err) {
      set({ authError: err.message });
    }
  },

  forgotPassword: async (email) => {
    try {
      const res = await fetch(`${API}/api/auth/forgot-password`, { credentials: 'include', method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email })
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
  watchlists:       [{ id: 1, name: 'Watchlist 1', symbols: [] }],
  activeWatchlistId: 1,

  createWatchlist: (name) => {
    if (get().watchlists.some(w => w.name.toLowerCase() === name.toLowerCase())) {
      alert(`Watchlist "${name}" already exists!`);
      return;
    }
    const newWatchlists = [...get().watchlists, { id: Date.now(), name, symbols: [] }];
    set({ watchlists: newWatchlists });
    get().syncWatchlists(newWatchlists);
  },

  renameWatchlist: (id, newName) => {
    if (get().watchlists.some(w => String(w.id) !== String(id) && w.name.toLowerCase() === newName.toLowerCase())) {
      alert(`Watchlist "${newName}" already exists!`);
      return;
    }
    const newWatchlists = get().watchlists.map(w => String(w.id) === String(id) ? { ...w, name: newName } : w);
    set({ watchlists: newWatchlists });
    get().syncWatchlists(newWatchlists);
  },

  deleteWatchlist: (id) => {
    let newWatchlists = get().watchlists.filter(w => String(w.id) !== String(id));
    if (newWatchlists.length === 0) newWatchlists = [{ id: 1, name: 'Watchlist 1', symbols: [] }];
    set({
      watchlists:        newWatchlists,
      activeWatchlistId: String(get().activeWatchlistId) === String(id) ? newWatchlists[0].id : get().activeWatchlistId,
    });
    get().syncWatchlists(newWatchlists);
  },

  setActiveWatchlist: (id) => set({ activeWatchlistId: id }),

  addStockToWatchlist: (watchlistId, uniqueSymbol) => {
    const newWatchlists = get().watchlists.map(w => {
      if (String(w.id) === String(watchlistId) && !w.symbols.includes(uniqueSymbol)) {
        return { ...w, symbols: [...w.symbols, uniqueSymbol] };
      }
      return w;
    });
    set({ watchlists: newWatchlists });
    socket.emit('subscribe', uniqueSymbol);
    get().syncWatchlists(newWatchlists);
  },

  removeStockFromWatchlist: (watchlistId, uniqueSymbol) => {
    const newWatchlists = get().watchlists.map(w => {
      if (w.id === watchlistId) return { ...w, symbols: w.symbols.filter(s => s !== uniqueSymbol) };
      return w;
    });
    set({ watchlists: newWatchlists });
    get().syncWatchlists(newWatchlists);
    // Unsubscribe if not used in any other watchlist
    setTimeout(() => {
      const isUsedElsewhere = get().watchlists.some(w => w.symbols.includes(uniqueSymbol));
      if (!isUsedElsewhere) socket.emit('unsubscribe', uniqueSymbol);
    }, 100);
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

  chartModalSymbol: null,
  setChartModalSymbol: (symbol) => set({ chartModalSymbol: symbol }),

  marketDepthModal: { isOpen: false, symbol: null, lotsize: 1 },
  openMarketDepthModal: (symbol, lotsize) => set({ marketDepthModal: { isOpen: true, symbol, lotsize: lotsize || 1 } }),
  closeMarketDepthModal: () => set({ marketDepthModal: { isOpen: false, symbol: null, lotsize: 1 } }),

  domLadderModal: { isOpen: false, symbol: null, lotsize: 1 },
  openDomLadderModal: (symbol, lotsize) => set({ domLadderModal: { isOpen: true, symbol, lotsize: lotsize || 1 } }),
  closeDomLadderModal: () => set({ domLadderModal: { isOpen: false, symbol: null, lotsize: 1 } }),

  marketDepthData: { symbol: null, bids: [], asks: [] },
  setMarketDepthData: (data) => set({ marketDepthData: data }),

  alerts: [],
  addAlert: (alert) => set((state) => ({ 
    alerts: [...state.alerts, { ...alert, id: Date.now().toString(), triggered: false, createdAt: new Date().toISOString() }] 
  })),
  removeAlert: (id) => set((state) => ({ alerts: state.alerts.filter(a => a.id !== id) })),
  updateAlert: (id, updates) => set((state) => ({ 
    alerts: state.alerts.map(a => a.id === id ? { ...a, ...updates } : a) 
  })),
  clearOldAlerts: () => set((state) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return {
      alerts: state.alerts.filter(a => new Date(a.createdAt).getTime() >= today.getTime())
    };
  }),
  
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
      const res = await fetch(`${API}/api/basket-order`, { credentials: 'include', method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify(basketPayload),
      });
      const data = await res.json();
      if (data.success) { 
        get().fetchUserData(); 
        get().clearBasket();
        get().setBasketModalOpen(false);
        return true; 
      }
      return false;
    } catch (_) { return false; }
  },

  orderModal: { isOpen: false, symbol: null, type: 'BUY', lotsize: 1, productType: 'INT' },

  openOrderModal:  (symbol, type = 'BUY', lotsize = 1, productType = 'INT') => set({ orderModal: { isOpen: true, symbol, type, lotsize, productType } }),
  closeOrderModal: ()                      => set({ orderModal: { isOpen: false, symbol: null, type: 'BUY', lotsize: 1, productType: 'INT' } }),

  editOrderModal: { isOpen: false, order: null },
  openEditOrderModal: (order) => set({ editOrderModal: { isOpen: true, order } }),
  closeEditOrderModal: () => set({ editOrderModal: { isOpen: false, order: null } }),

  // ── Market Data ─────────────────────────────────────────────────────────────
  prices:         {},
  stocks:         [],
  positions:      [],
  holdings:       [],
  orders:         [],
  selectedSymbol: 'RELIANCE-NSE',

  setSelectedSymbol: (symbol) => {
    set({ selectedSymbol: symbol });
    socket.emit('subscribe', symbol);
  },

  subscribeToSymbol: (symbol) => socket.emit('subscribe', symbol),
  unsubscribeFromSymbol: (symbol) => socket.emit('unsubscribe', symbol),
  subscribeToOption: (data) => socket.emit('subscribe', data),
  subscribeToOptionBatch: (dataArray) => socket.emit('subscribe_batch', dataArray),
  unsubscribeFromOption: (data) => socket.emit('unsubscribe', data),
  unsubscribeFromOptionBatch: (dataArray) => {
    if(Array.isArray(dataArray)) {
      dataArray.forEach(data => socket.emit('unsubscribe', data));
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
      set((state) => ({
        candleData:       { ...state.candleData, [symbol]: candles },
        isLoadingCandles: false,
        candleError:      null,
      }));
    } catch (err) {
      set({ isLoadingCandles: false, candleError: err.message });
    }
  },

  // ── Socket ──────────────────────────────────────────────────────────────────
  initSocket: () => {
    socket.off('price_snapshot');
    socket.on('price_snapshot', (snapshot) => {
      set((state) => ({ prices: applySnapshot(snapshot, state) }));
    });

    let batchedPrices = {};
    let batchTimeout = null;

    socket.off('market_data');
    socket.on('market_data', (data) => {
      batchedPrices[data.symbol] = data;
      if (!batchTimeout) {
        batchTimeout = setTimeout(() => {
          set((state) => {
            const nextPrices = { ...state.prices };
            for (const sym in batchedPrices) {
              const d = batchedPrices[sym];
              const old = nextPrices[sym];
              const tick = old ? (d.ltp > old.ltp ? 'up' : d.ltp < old.ltp ? 'down' : 'flat') : 'flat';
              nextPrices[sym] = { ...old, ...d, tick };
            }
            batchedPrices = {};
            batchTimeout = null;
            return { prices: nextPrices };
          });
        }, 150); // Batch state updates to ~6 FPS to prevent UI lag
      }
    });

    socket.off('market_depth_data');
    socket.on('market_depth_data', (data) => {
      get().setMarketDepthData(data);
    });

    socket.off('sync_user_data');
    socket.on('sync_user_data', () => {
      get().fetchUserData();
    });

    const onConnect = () => {
      console.log('Socket connected, refreshing and resubscribing...');
      const currentUser = get().user;
      if (currentUser?.id) {
        socket.emit('register_user', currentUser.id);
      }
      get().refreshPrices();
      
      // Helper to determine exchange from a uniqueSymbol
      const getExchange = (sym) => {
        const dashIdx = sym.lastIndexOf('-');
        if (dashIdx > 0) {
          return sym.substring(dashIdx + 1);
        }
        // No dash — try to detect type from symbol pattern
        if (/\d{2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{2}/.test(sym)) return 'NFO';
        return 'NSE';
      };
      
      // Resubscribe to ALL watchlists (not just active)
      const { watchlists, subscribeToOptionBatch, positions } = get();
      
      const tokensToSub = [];
      const seenSymbols = new Set();
      
      for (const wl of watchlists) {
        if (!wl?.symbols) continue;
        for (const sym of wl.symbols) {
          if (seenSymbols.has(sym)) continue;
          seenSymbols.add(sym);
          tokensToSub.push({ symbol: sym, exchange: getExchange(sym) });
        }
      }
      
      // Resubscribe to positions
      if (positions && positions.length > 0) {
        positions.forEach(pos => {
          if (seenSymbols.has(pos.symbol)) return;
          seenSymbols.add(pos.symbol);
          tokensToSub.push({ symbol: pos.symbol, exchange: getExchange(pos.symbol) });
        });
      }
      
      if (tokensToSub.length > 0) {
        subscribeToOptionBatch(tokensToSub);
      }
    };

    socket.off('connect');
    socket.on('connect', onConnect);
    if (socket.connected) {
      onConnect();
    }
  },

  // ── Price Fetching ───────────────────────────────────────────────────────────
  refreshPrices: async () => {
    // Only fetch fallback prices if socket is connected AND we already have prices
    if (socket && socket.connected && Object.keys(get().prices).length > 0) return;

    try {
      const res      = await fetch(`${API}/api/prices`, { credentials: 'include' });
      const snapshot = await res.json();
      if (snapshot && Object.keys(snapshot).length > 0) {
        set((state) => ({ prices: applySnapshot(snapshot, state) }));
      }
    } catch (_) {}
  },

  fetchBatchPrices: async (symbols) => {
    try {
      const res = await fetch(`${API}/api/ltp-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ symbols }),
      });
      const snapshot = await res.json();
      if (snapshot && Object.keys(snapshot).length > 0) {
        set((state) => ({ prices: applySnapshot(snapshot, state) }));
      }
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
    
    
    try {
      const headers = {  };
      const [posRes, ordRes, userRes, holdRes] = await Promise.all([
        fetch(`${API}/api/positions`, { credentials: 'include', headers }),
        fetch(`${API}/api/orders`, { credentials: 'include', headers }),
        fetch(`${API}/api/user`, { credentials: 'include', headers }),
        fetch(`${API}/api/holdings`, { credentials: 'include', headers }),
      ]);
      const [positions, orders, user, holdData] = await Promise.all([
        posRes.json().catch(() => ({})), 
        ordRes.json().catch(() => ({})), 
        userRes.json().catch(() => ({})),
        holdRes.json().catch(() => ({}))
      ]);
      
      if (userRes.status === 401 || userRes.status === 403 || user?.error) {
        console.error("Auth failed during fetchUserData, logging out.", user?.error);
        get().logout();
        return;
      }
      
      if (!get().user) return;
      set({
        positions: Array.isArray(positions) ? positions : (positions.error ? [] : get().positions), 
        holdings: holdData.success ? holdData.holdings : get().holdings,
        orders: Array.isArray(orders) ? orders : (orders.error ? [] : get().orders), 
        user: (user && !user.error) ? user : get().user 
      });
      
      const posSymbols = (positions || []).map(p => p.symbol);
      const holdSymbols = (holdData.holdings || []).map(h => h.symbol);
      const allSymbolsToSubscribe = [...new Set([...posSymbols, ...holdSymbols])];
      if (allSymbolsToSubscribe.length > 0) {
        get().fetchBatchPrices(allSymbolsToSubscribe);
        allSymbolsToSubscribe.forEach(sym => socket.emit('subscribe', sym));
      }
      
      // Also fetch restricted stocks on load
      get().fetchRestrictedStocks();
      // No initial search; let MutualFundsView handle empty state
    } catch (_) {}
  },
  
  restrictedStocks: [],
  fetchRestrictedStocks: async () => {
      try {
          const res = await fetch(`${API}/api/restricted-stocks`, { credentials: 'include' });
          const data = await res.json();
          if (Array.isArray(data)) set({ restrictedStocks: data });
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

  updateOrder: async (id, quantity, price, sl_price, tgt_price) => {
    try {
      const res = await fetch(`${API}/api/order/${id}`, { credentials: 'include', method: 'PUT',
        headers: { 
          
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ quantity, price, sl_price, tgt_price })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await get().fetchUserData();
      return true;
    } catch (err) {
      set({ authError: err.message });
      return false;
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

  updateUserDetails: async (details) => {
    
    
    try {
      const res = await fetch(`${API}/api/user/details`, { credentials: 'include', method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify(details)
      });
      const data = await res.json();
      if (data.success) { 
        get().fetchUserData(); 
        return { success: true }; 
      }
      return { success: false, error: data.error };
    } catch (err) { return { success: false, error: err.message }; }
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
      const res  = await fetch(`${API}/api/order`, { credentials: 'include', method:  'POST',
        headers: { 'Content-Type': 'application/json', },
        body:    JSON.stringify(orderPayload),
      });
      const data = await res.json();
      if (data.success) { get().fetchUserData(); return true; }
      console.error('[placeOrder FAILED]', data);
      set({ authError: data.error || 'Order failed' });
      return false;
    } catch (err) { 
      console.error('[placeOrder ERROR]', err);
      return false;
    }
  },

  cancelOrder: async (orderId) => {
    
    try {
      const res  = await fetch(`${API}/api/order/${orderId}/cancel`, { credentials: 'include', method:  'POST',
      });
      const data = await res.json();
      if (data.success) { get().fetchUserData(); return true; }
      return false;
    } catch (_) { return false; }
  },

  // ── Wallet / Deposits ───────────────────────────────────────────────────────
  requestDeposit: async (amount) => {
    
    
    try {
      const res = await fetch(`${API}/api/wallet/deposit`, { credentials: 'include', method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ amount })
      });
      const data = await res.json();
      return data.success ? { success: true } : { success: false, error: data.error };
    } catch (e) {
      return { success: false, error: 'Network error' };
    }
  },

  resetAccount: async () => {
    const { user } = get();
    if (!user) return { success: false };
    try {
      const res = await fetch(`${API}/api/user/reset`, { credentials: 'include', method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        // Optimistically update local state to reflect the wipe
        set({ positions: [], orders: [], pendingTriggers: [], alerts: [], user: { ...user, balance: 1000000.0 } });
        return { success: true };
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
      await fetch(`${API}/api/user/watchlists`, { credentials: 'include', method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ watchlists })
      });
    } catch (err) {}
  },

  // ─── Admin ───────────────────────────────────────────────────────────────
  fetchAdminAnalytics: async () => {
    
    
    try {
      const res = await fetch(`${API}/api/admin/analytics`, { credentials: 'include'
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

  fetchAdminOrders: async () => {
    
    
    try {
      const res = await fetch(`${API}/api/admin/orders`, { credentials: 'include' });
      const data = await res.json();
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  fetchAdminPositions: async () => {
    
    
    try {
      const res = await fetch(`${API}/api/admin/positions`, { credentials: 'include' });
      const data = await res.json();
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  fetchAdminLedger: async () => {
    
    
    try {
      const res = await fetch(`${API}/api/admin/ledger`, { credentials: 'include' });
      const data = await res.json();
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  forceCloseUserPosition: async (positionId) => {
    
    
    try {
      const res = await fetch(`${API}/api/admin/force-close`, { credentials: 'include', method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ positionId })
      });
      const data = await res.json();
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // ── Admin ───────────────────────────────────────────────────────────────────
  fetchAdminUsers: async () => {
    
    
    try {
      const res = await fetch(`${API}/api/admin/users`, { credentials: 'include'
      });
      if (res.ok) {
        const users = await res.json();
        return { success: true, users };
      }
      return { success: false, error: 'Unauthorized' };
    } catch (err) {
      return { success: false, error: err.message };
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

  fetchDepositRequests: async () => {
    
    
    try {
      const res = await fetch(`${API}/api/admin/deposits`, { credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        return { success: true, deposits: data.deposits };
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
    localStorage.removeItem('token');
    set({ user: null, positions: [], orders: [] });
    fetch(`${API}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(()=>{});
  },
  
  // ── Theme ───────────────────────────────────────────────────────────────────
  theme: 'dark', // default to dark
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
    if (newTheme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
    return { theme: newTheme };
  }),

  // ── One-Click Scalper Mode ──────────────────────────────────────────────────
  oneClickMode: false,
  oneClickMultiplier: 1,
  setOneClickMode: (val) => set({ oneClickMode: val }),
  setOneClickMultiplier: (val) => set({ oneClickMultiplier: val }),

}), {
  name: 'shortmarket-storage',
  partialize: (state) => ({
    watchlists:        state.watchlists,
    activeWatchlistId: state.activeWatchlistId,
    token:             state.token,
    user:              state.user,
    theme:             state.theme,
    pendingTriggers:   state.pendingTriggers,
    oneClickMode:      state.oneClickMode,
    oneClickMultiplier: state.oneClickMultiplier,
    alerts:            state.alerts,
  }),
}));
