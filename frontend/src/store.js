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
  // Watchlist State
  watchlists: [{ id: 1, name: 'Watchlist 1', symbols: [] }],
  activeWatchlistId: 1,

  createWatchlist: (name) => set((state) => {
    if (state.watchlists.some(w => w.name.toLowerCase() === name.toLowerCase())) {
      alert(`Watchlist "${name}" already exists!`);
      return state;
    }
    return { watchlists: [...state.watchlists, { id: Date.now(), name, symbols: [] }] };
  }),

  renameWatchlist: (id, newName) => set((state) => {
    if (state.watchlists.some(w => w.id !== id && w.name.toLowerCase() === newName.toLowerCase())) {
      alert(`Watchlist "${newName}" already exists!`);
      return state;
    }
    return {
      watchlists: state.watchlists.map(w => 
        w.id === id ? { ...w, name: newName } : w
      )
    };
  }),

  deleteWatchlist: (id) => set((state) => {
    const newWatchlists = state.watchlists.filter(w => w.id !== id);
    if (newWatchlists.length === 0) newWatchlists.push({ id: 1, name: 'Watchlist 1', symbols: [] });
    return {
      watchlists: newWatchlists,
      activeWatchlistId: state.activeWatchlistId === id ? newWatchlists[0].id : state.activeWatchlistId
    };
  }),

  setActiveWatchlist: (id) => {
    set({ activeWatchlistId: id });
    // Fetch prices for the newly selected watchlist instantly
    const list = get().watchlists.find(w => w.id === id);
    if (list && list.symbols.length > 0) {
      get().fetchBatchPrices(list.symbols.slice(0, 50));
    }
  },

  addStockToWatchlist: (watchlistId, symbol) => set((state) => ({
    watchlists: state.watchlists.map(w => 
      w.id === watchlistId && !w.symbols.includes(symbol)
        ? { ...w, symbols: [...w.symbols, symbol] }
        : w
    )
  })),

  removeStockFromWatchlist: (watchlistId, symbol) => set((state) => ({
    watchlists: state.watchlists.map(w => 
      w.id === watchlistId
        ? { ...w, symbols: w.symbols.filter(s => s !== symbol) }
        : w
    )
  })),
  user: { id: 1, username: 'mock_trader', balance: 1000000.0 },
  prices: {},
  positions: [],
  orders: [],
  stocks: [],
  selectedSymbol: 'KOTAKBANK-NSE',
  chartInterval: 'ONE_DAY', // default interval
  candleData: {},
  candleError: null,
  isLoadingCandles: false,

  setChartInterval: async (interval) => {
    const sym = get().selectedSymbol;
    set({ chartInterval: interval, candleError: null });
    await get().loadCandleData(sym, interval);
  },

  setSelectedSymbol: async (symbol) => {
    set({ selectedSymbol: symbol, candleError: null });
    socket.emit('subscribe', symbol);
    await get().loadCandleData(symbol, get().chartInterval);
  },

  loadCandleData: async (symbol, interval = 'ONE_DAY') => {
    set({ isLoadingCandles: true, candleError: null });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
    try {
      const res = await fetch(`${API}/api/candles/${symbol}?interval=${interval}`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`Server error: HTTP ${res.status}`);
      const data = await res.json();
      let candles = Array.isArray(data) ? data : [];
      
      set((state) => {
        // Fallback: if no historical data, create one candle from current price so chart renders
        if (candles.length === 0 && state.prices[symbol]) {
          const p = state.prices[symbol];
          const t = p.timestamp ? Math.floor(new Date(p.timestamp).getTime()/1000) : Math.floor(Date.now()/1000);
          candles = [{ time: t + 19800, open: p.open || p.ltp, high: p.high || p.ltp, low: p.low || p.ltp, close: p.ltp, volume: 0 }];
        }
        return {
          candleData: { ...state.candleData, [symbol]: candles },
          isLoadingCandles: false,
          candleError: candles.length === 0 ? 'No historical data available' : null,
        };
      });
    } catch (err) {
      clearTimeout(timeout);
      const msg = err.name === 'AbortError' ? 'Request timed out — backend may be starting up' : err.message;
      console.error('loadCandleData failed:', msg);
      
      // On error, still try to fall back to current price
      set((state) => {
        let candles = [];
        if (state.prices[symbol]) {
          const p = state.prices[symbol];
          const t = p.timestamp ? Math.floor(new Date(p.timestamp).getTime()/1000) : Math.floor(Date.now()/1000);
          candles = [{ time: t + 19800, open: p.open || p.ltp, high: p.high || p.ltp, low: p.low || p.ltp, close: p.ltp, volume: 0 }];
        }
        return {
          candleData: { ...state.candleData, [symbol]: candles },
          isLoadingCandles: false, 
          candleError: msg 
        };
      });
    }
  },

  initSocket: () => {
    // Handle full price snapshots (all symbols at once)
    socket.off('price_snapshot');
    socket.on('price_snapshot', (snapshot) => {
      set((state) => ({ prices: applySnapshot(snapshot, state) }));
    });

    // Handle individual symbol tick updates
    socket.off('market_data');
    socket.on('market_data', (data) => {
      set((state) => {
        const old = state.prices[data.symbol];
        const tick = old ? (data.ltp > old.ltp ? 'up' : data.ltp < old.ltp ? 'down' : 'flat') : 'flat';
        return {
          prices: { ...state.prices, [data.symbol]: { ...data, tick } }
        };
      });
    });

    // On reconnect, request latest prices via REST
    socket.on('connect', () => {
      get().refreshPrices();
    });
  },

  // Poll /api/prices REST endpoint directly (reliable fallback)
  refreshPrices: async () => {
    try {
      const res = await fetch(`${API}/api/prices`);
      const snapshot = await res.json();
      if (snapshot && Object.keys(snapshot).length > 0) {
        set((state) => ({ prices: applySnapshot(snapshot, state) }));
      }
    } catch (_) {}
  },

  fetchBatchPrices: async (symbols) => {
    try {
      const res = await fetch(`${API}/api/prices/batch?symbols=${symbols.join(',')}`);
      const snapshot = await res.json();
      if (snapshot && Object.keys(snapshot).length > 0) {
        set((state) => ({ prices: applySnapshot(snapshot, state) }));
      }
    } catch (_) {}
  },

  loadStocks: async () => {
    try {
      const res = await fetch(`${API}/api/stocks`);
      const stocks = await res.json();
      if (!Array.isArray(stocks) || stocks.length === 0) return; // Let caller retry
      set({ stocks });
      // Immediately try to get prices from REST (for top 300 stocks)
      get().refreshPrices();
    } catch (err) {
      console.error('Failed to load stocks:', err);
    }
  },

  fetchUserData: async () => {
    try {
      const [posRes, ordRes, userRes] = await Promise.all([
        fetch(`${API}/api/positions/1`),
        fetch(`${API}/api/orders/1`),
        fetch(`${API}/api/user/1`)
      ]);
      const [positions, orders, user] = await Promise.all([
        posRes.json(), ordRes.json(), userRes.json()
      ]);
      set({ positions, orders, user });
    } catch (err) {
      console.error('Failed to fetch user data:', err);
    }
  },

  placeOrder: async (orderPayload) => {
    try {
      const res = await fetch(`${API}/api/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });
      const data = await res.json();
      if (data.success) { get().fetchUserData(); return true; }
      return false;
    } catch (err) { return false; }
  },

  cancelOrder: async (orderId) => {
    try {
      const res = await fetch(`${API}/api/order/${orderId}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (data.success) { get().fetchUserData(); return true; }
      return false;
    } catch (err) { return false; }
  }
}), {
  name: 'shortmarket-storage',
  partialize: (state) => ({ 
    watchlists: state.watchlists, 
    activeWatchlistId: state.activeWatchlistId 
  })
}));
