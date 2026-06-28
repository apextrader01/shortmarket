import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { io } from 'socket.io-client';

const API = ''; // Relative path — works for both REST and Socket.IO via Vite proxy

const socket = io(API);

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
    if (get().watchlists.some(w => w.id !== id && w.name.toLowerCase() === newName.toLowerCase())) {
      alert(`Watchlist "${newName}" already exists!`);
      return;
    }
    const newWatchlists = get().watchlists.map(w => w.id === id ? { ...w, name: newName } : w);
    set({ watchlists: newWatchlists });
    get().syncWatchlists(newWatchlists);
  },

  deleteWatchlist: (id) => {
    let newWatchlists = get().watchlists.filter(w => w.id !== id);
    if (newWatchlists.length === 0) newWatchlists = [{ id: 1, name: 'Watchlist 1', symbols: [] }];
    set({
      watchlists:        newWatchlists,
      activeWatchlistId: get().activeWatchlistId === id ? newWatchlists[0].id : get().activeWatchlistId,
    });
    get().syncWatchlists(newWatchlists);
  },

  setActiveWatchlist: (id) => set({ activeWatchlistId: id }),

  addStockToWatchlist: (watchlistId, uniqueSymbol) => {
    const newWatchlists = get().watchlists.map(w => {
      if (w.id === watchlistId && !w.symbols.includes(uniqueSymbol)) {
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

  updateOrder: async (id, quantity, price) => {
    try {
      const res = await fetch(`${API}/api/order/${id}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${get().token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ quantity, price })
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
    const { selectedSymbol } = get();
    if (selectedSymbol) get().loadCandleData(selectedSymbol, interval);
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

    socket.off('market_data');
    socket.on('market_data', (data) => {
      set((state) => {
        const old  = state.prices[data.symbol];
        const tick = old
          ? data.ltp > old.ltp ? 'up' : data.ltp < old.ltp ? 'down' : 'flat'
          : 'flat';
        return { prices: { ...state.prices, [data.symbol]: { ...old, ...data, tick } } };
      });
    });

    socket.on('connect', () => get().refreshPrices());
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
        posRes.json(), ordRes.json(), userRes.json(),
      ]);
      set({ positions: positions || [], orders: orders || [], user: user || get().user });
      
      const posSymbols = (positions || []).map(p => p.symbol);
      if (posSymbols.length > 0) {
        get().fetchBatchPrices(posSymbols);
        posSymbols.forEach(sym => socket.emit('subscribe', sym));
      }
    } catch (_) {}
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
      return false;
    } catch (_) { return false; }
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

}), {
  name: 'shortmarket-storage',
  partialize: (state) => ({
    watchlists:        state.watchlists,
    activeWatchlistId: state.activeWatchlistId,
    token:             state.token,
    user:              state.user,
  }),
}));
