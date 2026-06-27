import { create } from 'zustand';
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

export const useStore = create((set, get) => ({
  user: { id: 1, username: 'mock_trader', balance: 1000000.0 },
  prices: {},
  positions: [],
  orders: [],
  stocks: [],
  selectedSymbol: 'NIFTY',
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
      const candles = Array.isArray(data) ? data : [];
      set((state) => ({
        candleData: { ...state.candleData, [symbol]: candles },
        isLoadingCandles: false,
        candleError: candles.length === 0 ? 'No historical data available' : null,
      }));
    } catch (err) {
      clearTimeout(timeout);
      const msg = err.name === 'AbortError' ? 'Request timed out — backend may be starting up' : err.message;
      console.error('loadCandleData failed:', msg);
      set({ isLoadingCandles: false, candleError: msg });
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

  loadStocks: async () => {
    try {
      const res = await fetch(`${API}/api/stocks`);
      const stocks = await res.json();
      if (!Array.isArray(stocks) || stocks.length === 0) return; // Let caller retry
      set({ stocks });
      // Subscribe to all symbols for live updates
      stocks.forEach(s => socket.emit('subscribe', s.symbol));
      // Immediately try to get prices from REST
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
}));
