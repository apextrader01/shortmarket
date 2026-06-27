import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { io } from 'socket.io-client';

const API = ''; // Empty string means use relative path, works for both API and Socket.IO

const socket = io(API);

// Apply a snapshot (object of symbol -> price data) to store state
function applySnapshot(snapshot, state) {
  const newPrices = { ...state.prices };
  for (const [symbol, data] of Object.entries(snapshot)) {
    const old = newPrices[symbol];
    const tick = old ? (data.ltp > old.ltp ? 'up' : data.ltp < old.ltp ? 'down' : 'flat') : 'flat';
    newPrices[symbol] = { ...data, tick };
  }
  return newPrices;
}

export const useStore = create(persist((set, get) => ({
  // Auth State
  user: null,
  token: null,
  authError: null,

  login: async (email, password) => {
    try {
      set({ authError: null });
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success) {
        set({ user: data.user, token: data.token, watchlists: data.user.watchlists || [{ id: 1, name: 'Watchlist 1', symbols: [] }] });
        get().fetchUserData();
      } else {
        set({ authError: data.error });
      }
    } catch(err) { set({ authError: err.message }); }
  },

  register: async (username, email, password) => {
    try {
      set({ authError: null });
      const res = await fetch(`${API}/api/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });
      const data = await res.json();
      if (data.success) {
        set({ user: data.user, token: data.token, watchlists: data.user.watchlists });
        get().fetchUserData();
      } else {
        set({ authError: data.error });
      }
    } catch(err) { set({ authError: err.message }); }
  },

  logout: () => {
    set({ user: null, token: null, positions: [], orders: [], watchlists: [{ id: 1, name: 'Watchlist 1', symbols: [] }] });
  },

  syncWatchlists: async (newWatchlists) => {
    const token = get().token;
    if (!token) return;
    try {
      await fetch(`${API}/api/user/watchlists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ watchlists: newWatchlists })
      });
    } catch(err) {}
  },

  // Watchlist State
  watchlists: [{ id: 1, name: 'Watchlist 1', symbols: [] }],
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
      watchlists: newWatchlists,
      activeWatchlistId: get().activeWatchlistId === id ? newWatchlists[0].id : get().activeWatchlistId
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
    
    // Subscribe to Socket.IO and sync
    socket.emit('subscribe', uniqueSymbol);
    get().syncWatchlists(newWatchlists);
  },

  removeStockFromWatchlist: (watchlistId, uniqueSymbol) => {
    const newWatchlists = get().watchlists.map(w => {
      if (w.id === watchlistId) {
        return { ...w, symbols: w.symbols.filter(s => s !== uniqueSymbol) };
      }
      return w;
    });
    set({ watchlists: newWatchlists });
    get().syncWatchlists(newWatchlists);

    // Unsubscribe logic
    setTimeout(() => {
      const isUsedElsewhere = get().watchlists.some(w => w.symbols.includes(uniqueSymbol));
      if (!isUsedElsewhere) socket.emit('unsubscribe', uniqueSymbol);
    }, 100);
  },

  // Modal States
  orderModal: { isOpen: false, symbol: null, type: 'BUY' },
  openOrderModal: (symbol, type = 'BUY') => set({ orderModal: { isOpen: true, symbol, type } }),
  closeOrderModal: () => set({ orderModal: { isOpen: false, symbol: null, type: 'BUY' } }),

  // Market Data
  prices: {},
  stocks: [],
  positions: [],
  orders: [],
  selectedSymbol: 'RELIANCE-NSE',
  setSelectedSymbol: (symbol) => {
    set({ selectedSymbol: symbol });
    socket.emit('subscribe', symbol);
  },

  // ... (Socket Logic)
  initSocket: () => {
    socket.off('price_snapshot');
    socket.on('price_snapshot', (snapshot) => {
      set((state) => ({ prices: applySnapshot(snapshot, state) }));
    });
    socket.off('market_data');
    socket.on('market_data', (data) => {
      set((state) => {
        const old = state.prices[data.symbol];
        const tick = old ? (data.ltp > old.ltp ? 'up' : data.ltp < old.ltp ? 'down' : 'flat') : 'flat';
        return { prices: { ...state.prices, [data.symbol]: { ...data, tick } } };
      });
    });
    socket.on('connect', () => { get().refreshPrices(); });
  },

  refreshPrices: async () => {
    try {
      const res = await fetch(`${API}/api/prices`);
      const snapshot = await res.json();
      if (snapshot && Object.keys(snapshot).length > 0) set((state) => ({ prices: applySnapshot(snapshot, state) }));
    } catch (_) {}
  },

  fetchBatchPrices: async (symbols) => {
    try {
      const res = await fetch(`${API}/api/prices/batch?symbols=${symbols.join(',')}`);
      const snapshot = await res.json();
      if (snapshot && Object.keys(snapshot).length > 0) set((state) => ({ prices: applySnapshot(snapshot, state) }));
    } catch (_) {}
  },

  loadStocks: async () => {
    try {
      const res = await fetch(`${API}/api/stocks`);
      const stocks = await res.json();
      if (!Array.isArray(stocks) || stocks.length === 0) return;
      set({ stocks });
      get().refreshPrices();
    } catch (err) {}
  },

  fetchUserData: async () => {
    const token = get().token;
    if (!token) return;
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [posRes, ordRes, userRes] = await Promise.all([
        fetch(`${API}/api/positions`, { headers }),
        fetch(`${API}/api/orders`, { headers }),
        fetch(`${API}/api/user`, { headers })
      ]);
      const [positions, orders, user] = await Promise.all([
        posRes.json(), ordRes.json(), userRes.json()
      ]);
      set({ positions: positions || [], orders: orders || [], user: user || get().user });
    } catch (err) { }
  },

  placeOrder: async (orderPayload) => {
    const token = get().token;
    try {
      const res = await fetch(`${API}/api/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(orderPayload)
      });
      const data = await res.json();
      if (data.success) { get().fetchUserData(); return true; }
      return false;
    } catch (err) { return false; }
  },

  cancelOrder: async (orderId) => {
    const token = get().token;
    try {
      const res = await fetch(`${API}/api/order/${orderId}/cancel`, { 
        method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) { get().fetchUserData(); return true; }
      return false;
    } catch (err) { return false; }
  }
}), {
  name: 'shortmarket-storage',
  partialize: (state) => ({ 
    watchlists: state.watchlists, 
    activeWatchlistId: state.activeWatchlistId,
    token: state.token,
    user: state.user
  })
}));
