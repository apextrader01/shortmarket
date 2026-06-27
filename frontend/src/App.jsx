import React, { useEffect } from 'react';
import MarketWatch from './components/MarketWatch';
import ChartWidget from './components/ChartWidget';
import OrderPad from './components/OrderPad';
import PositionsTable from './components/PositionsTable';
import { useStore } from './store';
import { User, Wallet, TrendingUp } from 'lucide-react';

function App() {
  const { initSocket, fetchUserData, loadStocks, loadCandleData, refreshPrices, user, selectedSymbol, prices, stocks, fetchBatchPrices } = useStore();

  const topIndices = ['NIFTY-NSE', 'BANKNIFTY-NSE', 'SENSEX-BSE', 'FINNIFTY-NSE'];

  useEffect(() => {
    fetchBatchPrices(topIndices);
  }, []);

  useEffect(() => {
    initSocket();
    fetchUserData();
    loadCandleData('NIFTY');

    // Keep retrying loadStocks every 3s until backend is ready
    let stockRetry = null;
    const tryLoadStocks = async () => {
      await loadStocks();
      // If still no stocks, retry in 3s
      if (useStore.getState().stocks.length === 0) {
        stockRetry = setTimeout(tryLoadStocks, 3000);
      } else {
        // Stocks loaded — also fetch prices immediately
        refreshPrices();
      }
    };
    tryLoadStocks();

    // Refresh user data and prices periodically
    const interval = setInterval(() => {
      fetchUserData();
      refreshPrices();
    }, 10000);
    return () => {
      clearInterval(interval);
      if (stockRetry) clearTimeout(stockRetry);
    };
  }, []);

  // Load candle data when symbol changes (handled in setSelectedSymbol but also on first render)
  useEffect(() => {
    loadCandleData(selectedSymbol);
  }, [selectedSymbol]);

  const price = prices[selectedSymbol];
  const isUp = price?.pct >= 0;

  return (
    <div className="app-container">
      <MarketWatch />

      <div className="main-content">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h2 style={{ letterSpacing: '0.5px', fontSize: '18px', fontWeight: '800' }}>DASHBOARD</h2>
            <div style={{ display: 'flex', gap: '12px', marginLeft: '12px' }}>
              {topIndices.map(idx => {
                const p = prices[idx];
                const isIdxUp = p?.pct >= 0;
                return (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: p ? (isIdxUp ? 'rgba(34,197,94,0.12)' : 'rgba(225,42,31,0.12)') : 'rgba(255,255,255,0.05)',
                    color: p ? (isIdxUp ? 'var(--color-green-light)' : 'var(--color-red-light)') : 'var(--text-secondary)',
                    padding: '4px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '600'
                  }}>
                    {p && (isIdxUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />)}
                    {idx.split('-')[0]} {p ? `₹${p.ltp.toFixed(2)}` : '...'}
                    {p && <span style={{ opacity: 0.8 }}>{p.pct > 0 ? '+' : ''}{Number(p.pct || 0).toFixed(2)}%</span>}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Wallet size={16} style={{ color: 'var(--text-secondary)' }} />
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Available Margin</div>
                <div style={{ fontWeight: '700', fontSize: '15px' }}>
                  ₹{user.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div style={{ width: '1px', height: '32px', background: 'var(--border-color)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '34px', height: '34px', borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--color-red), var(--color-navy-light))',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '14px'
              }}>
                {user.username?.[0]?.toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '13px' }}>{user.username}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-green-light)' }}>● Active</div>
              </div>
            </div>
          </div>
        </header>

        <main className="dashboard-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <ChartWidget />
            <PositionsTable />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <OrderPad />
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
