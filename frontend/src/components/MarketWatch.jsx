import React, { useState } from 'react';
import { useStore } from '../store';
import { TrendingUp, TrendingDown, Minus, Search } from 'lucide-react';

export default function MarketWatch() {
  const { prices, stocks, selectedSymbol, setSelectedSymbol, fetchBatchPrices } = useStore();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStocks = stocks.filter(s =>
    s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 100);

  React.useEffect(() => {
    if (searchQuery.trim().length > 0 && filteredStocks.length > 0) {
      const timer = setTimeout(() => {
        const missingSymbols = filteredStocks
          .filter(s => !prices[s.uniqueSymbol])
          .map(s => s.uniqueSymbol)
          .slice(0, 50);
        
        if (missingSymbols.length > 0 && fetchBatchPrices) {
          fetchBatchPrices(missingSymbols);
        }
      }, 400); // Wait for user to stop typing before fetching prices
      return () => clearTimeout(timer);
    }
  }, [searchQuery]); // Run when search query changes

  return (
    <div className="sidebar">
      <div className="logo-container">
        <div className="logo-text">
          SH<span>O</span>RT MARKET
        </div>
      </div>

      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: '28px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
        <input
          type="text"
          placeholder="Search stocks..."
          className="input-field"
          style={{ width: '100%', paddingLeft: '32px', fontSize: '13px' }}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {stocks.length === 0 ? (
          <div style={{ padding: '30px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>Connecting to backend...</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Loading 2,489 stocks from Angel One</div>
          </div>
        ) : filteredStocks.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
            No stocks found for "{searchQuery}"
          </div>
        ) : filteredStocks.map(stock => {
          const data = prices[stock.uniqueSymbol];
          const isSelected = selectedSymbol === stock.uniqueSymbol;
          const isUp = data?.pct > 0;
          const isDown = data?.pct < 0;

          return (
            <div
              key={stock.uniqueSymbol}
              onClick={() => setSelectedSymbol(stock.uniqueSymbol)}
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                cursor: 'pointer',
                background: isSelected ? 'rgba(225, 42, 31, 0.08)' : 'transparent',
                borderLeft: isSelected ? '3px solid var(--color-red)' : '3px solid transparent',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'background 0.15s ease',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: '700', fontSize: '13px', letterSpacing: '0.3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {stock.symbol}
                  <span style={{ fontSize: '9px', padding: '1px 4px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', color: 'var(--text-secondary)' }}>
                    {stock.exchange}
                  </span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '110px' }}>{stock.name}</div>
              </div>

              {data ? (
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{
                    fontWeight: '700',
                    fontSize: '13px',
                    color: data.tick === 'up' ? 'var(--color-green-light)' : data.tick === 'down' ? 'var(--color-red-light)' : 'var(--text-primary)'
                  }}>
                    ₹{data.ltp.toFixed(2)}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    justifyContent: 'flex-end',
                    color: isUp ? 'var(--color-green-light)' : isDown ? 'var(--color-red-light)' : 'var(--text-secondary)'
                  }}>
                    {isUp ? <TrendingUp size={10} /> : isDown ? <TrendingDown size={10} /> : <Minus size={10} />}
                    {data.pct !== undefined ? `${data.pct > 0 ? '+' : ''}${Number(data.pct).toFixed(2)}%` : '—'}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>—</div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-color)', fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
        <span>{filteredStocks.length} stocks</span>
        <span style={{ color: 'var(--color-green-light)' }}>● LIVE</span>
      </div>
    </div>
  );
}
