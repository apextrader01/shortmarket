import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { io } from 'socket.io-client';

const API = ''; // Relative path — works for both REST and Socket.IO via Vite proxy

export const socket = io(API);

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
  token:     null,
  authError: null,

  login: async (email, password) => {
    try {
      set({ authError: null });
      const res  = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        set({
          user:       data.user,
          token:      data.token,
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
      const res  = await fetch(`${API}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();
      if (data.success) {
        set({
          user:       data.user,
          token:      data.token,
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
      const res = await fetch(`${API}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
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
      const res = await fetch(`${API}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  logout: () => {
    set({
      user:       null,
      token:      null,
      positions:  [],
      orders:     [],
      watchlists: [{ id: 1, name: 'Watchlist 1', symbols: [] }],
    });
  },

  // ── Watchlists ──────────────────────────────────────────────────────────────
  watchlists:       [{ id: 1, name: 'Watchlist 1', symbols: [] }],
  activeWatchlistId: 1,

  syncWatchlists: async (newWatchlists) => {
    const { token } = get();
    if (!token) return;
    try {
      await fetch(`${API}/api/user/watchlists`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ watchlists: newWatchlists }),
      });
    } catch (_) {}
  },

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
    const { token } = get();
    try {
      const res = await fetch(`${API}/api/basket-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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

  orderModal: { isOpen: false, symbol: null, type: 'BUY', lotsize: 1 },

  openOrderModal:  (symbol, type = 'BUY', lotsize = 1) => set({ orderModal: { isOpen: true, symbol, type, lotsize } }),
  closeOrderModal: ()                      => set({ orderModal: { isOpen: false, symbol: null, type: 'BUY', lotsize: 1 } }),

  editOrderModal: { isOpen: false, order: null },
  openEditOrderModal: (order) => set({ editOrderModal: { isOpen: true, order } }),
  closeEditOrderModal: () => set({ editOrderModal: { isOpen: false, order: null } }),

  cancelOrder: async (id) => {
    try {
      const res = await fetch(`${API}/api/order/${id}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${get().token}` }
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

  updateOrder: async (id, quantity, price, sl_price, tgt_price) => {
    try {
      const res = await fetch(`${API}/api/order/${id}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${get().token}`,
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

  // ── Market Data ─────────────────────────────────────────────────────────────
  prices:         {},
  stocks:         [],
  positions:      [],
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

    socket.on('connect', () => {
      console.log('Socket connected, refreshing and resubscribing...');
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
    });
  },

  // ── Price Fetching ───────────────────────────────────────────────────────────
  refreshPrices: async () => {
    try {
      const res      = await fetch(`${API}/api/prices`);
      const snapshot = await res.json();
      if (snapshot && Object.keys(snapshot).length > 0) {
        set((state) => ({ prices: applySnapshot(snapshot, state) }));
      }
    } catch (_) {}
  },

  fetchBatchPrices: async (symbols) => {
    try {
      const res      = await fetch(`${API}/api/prices/batch?symbols=${symbols.join(',')}`);
      const snapshot = await res.json();
      if (snapshot && Object.keys(snapshot).length > 0) {
        set((state) => ({ prices: applySnapshot(snapshot, state) }));
      }
    } catch (_) {}
  },

  // ── Stock List ───────────────────────────────────────────────────────────────
  loadStocks: async () => {
    try {
      const res    = await fetch(`${API}/api/stocks`);
      const stocks = await res.json();
      if (!Array.isArray(stocks) || stocks.length === 0) return;
      set({ stocks });
      get().refreshPrices();
    } catch (_) {}
  },

  // ── User Data ────────────────────────────────────────────────────────────────
  fetchUserData: async () => {
    const { token } = get();
    if (!token) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [posRes, ordRes, userRes] = await Promise.all([
        fetch(`${API}/api/positions`, { headers }),
        fetch(`${API}/api/orders`,    { headers }),
        fetch(`${API}/api/user`,      { headers }),
      ]);
      const [positions, orders, user] = await Promise.all([
        posRes.json().catch(() => ({})), 
        ordRes.json().catch(() => ({})), 
        userRes.json().catch(() => ({}))
      ]);
      
      if (userRes.status === 401 || userRes.status === 403 || user?.error) {
        console.error("Auth failed during fetchUserData, logging out.", user?.error);
        get().logout();
        return;
      }
      
      set({ 
        positions: Array.isArray(positions) ? positions : (positions.error ? [] : get().positions), 
        orders: Array.isArray(orders) ? orders : (orders.error ? [] : get().orders), 
        user: (user && !user.error) ? user : get().user 
      });
      
      const posSymbols = (positions || []).map(p => p.symbol);
      if (posSymbols.length > 0) {
        get().fetchBatchPrices(posSymbols);
        posSymbols.forEach(sym => socket.emit('subscribe', sym));
      }
      
      // Also fetch restricted stocks on load
      get().fetchRestrictedStocks();
      // No initial search; let MutualFundsView handle empty state
    } catch (_) {}
  },
  
  restrictedStocks: [],
  fetchRestrictedStocks: async () => {
      try {
          const res = await fetch(`${API}/api/restricted-stocks`);
          const data = await res.json();
          if (Array.isArray(data)) set({ restrictedStocks: data });
      } catch (_) {}
  },

  mutualFunds: [],
  searchMfRequestId: 0,
  searchMutualFunds: async (query) => {
      try {
          const currentRequestId = ++get().searchMfRequestId;
          const res = await fetch(`${API}/api/mf/search?q=${encodeURIComponent(query)}`);
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
          const res = await fetch(`${API}/api/mf/enrich?ids=${ids.join(',')}`);
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
      const res = await fetch(`${API}/api/order/${id}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${get().token}`,
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
          const res = await fetch(`${API}/api/mf/details?name=${encodeURIComponent(schemeName)}`);
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
          const res = await fetch(`${API}/api/mf/${schemeCode}`);
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
      const { token } = get();
      try {
          const res = await fetch(`${API}/api/position/convert`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ positionId, newProductType, requiredMargin }),
          });
          const data = await res.json();
          if (data.success) { get().fetchUserData(); return { success: true }; }
          return { success: false, error: data.error };
      } catch (err) { return { success: false, error: err.message }; }
  },

  updateProfilePicture: async (url) => {
    const { token } = get();
    if (!token) return { success: false };
    try {
      const res = await fetch(`${API}/api/user/profile_picture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
    const { token } = get();
    if (!token) return { success: false };
    try {
      const res = await fetch(`${API}/api/user/details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
    const { token } = get();
    if (!token) return { success: false };
    try {
      const res = await fetch(`${API}/api/user/kyc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
    const { token } = get();
    try {
      const res  = await fetch(`${API}/api/order`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
    const { token } = get();
    try {
      const res  = await fetch(`${API}/api/order/${orderId}/cancel`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) { get().fetchUserData(); return true; }
      return false;
    } catch (_) { return false; }
  },

  // ── Wallet / Deposits ───────────────────────────────────────────────────────
  requestDeposit: async (amount) => {
    const { token } = get();
    if (!token) return { success: false };
    try {
      const res = await fetch(`${API}/api/wallet/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount })
      });
      const data = await res.json();
      return data.success ? { success: true } : { success: false, error: data.error };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // ── Settings ────────────────────────────────────────────────────────────────
  updatePassword: async (oldPassword, newPassword) => {
    const { token } = get();
    if (!token) return { success: false };
    try {
      const res = await fetch(`${API}/api/user/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ oldPassword, newPassword })
      });
      const data = await res.json();
      return data.success ? { success: true } : { success: false, error: data.error };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  syncWatchlists: async (watchlists) => {
    const { token } = get();
    if (!token) return;
    try {
      await fetch(`${API}/api/user/watchlists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ watchlists })
      });
    } catch (err) {}
  },

  // ─── Admin ───────────────────────────────────────────────────────────────
  fetchAdminAnalytics: async () => {
    const { token } = get();
    if (!token) return { success: false };
    try {
      const res = await fetch(`${API}/api/admin/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
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
    const { token } = get();
    if (!token) return { success: false };
    try {
      const res = await fetch(`${API}/api/admin/orders`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  fetchAdminPositions: async () => {
    const { token } = get();
    if (!token) return { success: false };
    try {
      const res = await fetch(`${API}/api/admin/positions`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  fetchAdminLedger: async () => {
    const { token } = get();
    if (!token) return { success: false };
    try {
      const res = await fetch(`${API}/api/admin/ledger`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  forceCloseUserPosition: async (positionId) => {
    const { token } = get();
    if (!token) return { success: false };
    try {
      const res = await fetch(`${API}/api/admin/force-close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
    const { token } = get();
    if (!token) return { success: false };
    try {
      const res = await fetch(`${API}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
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

  updateUserBalance: async (userId, balance) => {
    const { token } = get();
    if (!token) return { success: false };
    try {
      const res = await fetch(`${API}/api/admin/user/${userId}/balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ balance })
      });
      const data = await res.json();
      return data.success ? { success: true } : { success: false, error: data.error };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  fetchDepositRequests: async () => {
    const { token } = get();
    if (!token) return { success: false };
    try {
      const res = await fetch(`${API}/api/admin/deposits`, {
        headers: { Authorization: `Bearer ${token}` }
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
    const { token } = get();
    if (!token) return { success: false };
    try {
      const res = await fetch(`${API}/api/admin/deposits/${depositId}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      return data.success ? { success: true } : { success: false, error: data.error };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  setToken: (token) => set({ token }),
  setUser:  (user)  => set({ user }),
  logout:   ()      => set({ token: null, user: null }),
  
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
  }),
}));
