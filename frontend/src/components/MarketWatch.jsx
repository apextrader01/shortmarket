import React, { useState } from 'react';
import { useStore } from '../store';
import { TrendingUp, TrendingDown, Minus, Search, Plus, X, Trash2, Check } from 'lucide-react';

export default function MarketWatch() {
  const { 
    prices, stocks, selectedSymbol, setSelectedSymbol, fetchBatchPrices,
    watchlists, activeWatchlistId, setActiveWatchlist, 
    addStockToWatchlist, removeStockFromWatchlist, createWatchlist, deleteWatchlist, renameWatchlist 
  } = useStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredStock, setHoveredStock] = useState(null);

  const activeWatchlist = watchlists.find(w => w.id === activeWatchlistId) || watchlists[0];
  const isSearchMode = searchQuery.trim().length > 0;

  // Search Results Mode
  const searchResults = isSearchMode ? stocks.filter(s =>
    s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 100) : [];

  // Watchlist Mode
  const watchlistStocks = !isSearchMode ? activeWatchlist.symbols.map(sym => stocks.find(s => s.uniqueSymbol === sym)).filter(Boolean) : [];
  const displayStocks = isSearchMode ? searchResults : watchlistStocks;

  React.useEffect(() => {
    if (isSearchMode && searchResults.length > 0) {
      const timer = setTimeout(() => {
        const missingSymbols = searchResults
          .filter(s => !prices[s.uniqueSymbol])
          .map(s => s.uniqueSymbol)
          .slice(0, 50);
        
        if (missingSymbols.length > 0 && fetchBatchPrices) {
          fetchBatchPrices(missingSymbols);
        }
      }, 400); 
      return () => clearTimeout(timer);
    }
  }, [searchQuery, isSearchMode]);

  return (
    <div className="sidebar">
      <div className="logo-container">
        <div className="logo-text">
          SH<span>O</span>RT MARKET
        </div>
      </div>

      {/* Watchlist Tabs */}
      <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid var(--border-color)', padding: '0 8px', background: 'var(--bg-panel)' }} className="scrollbar-hide">
        {watchlists.map(w => (
          <div
            key={w.id}
            onClick={() => { setActiveWatchlist(w.id); setSearchQuery(''); }}
            onDoubleClick={() => { 
              const newName = prompt('Rename watchlist:', w.name); 
              if (newName && newName.trim()) renameWatchlist(w.id, newName.trim()); 
            }}
            title="Double-click to rename"
            style={{
              padding: '12px 14px',
              fontSize: '12px',
              fontWeight: activeWatchlistId === w.id ? '600' : '500',
              color: activeWatchlistId === w.id ? 'var(--color-blue)' : 'var(--text-secondary)',
              borderBottom: activeWatchlistId === w.id ? '2px solid var(--color-blue)' : '2px solid transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              userSelect: 'none'
            }}
          >
            {w.name}
            {watchlists.length > 1 && activeWatchlistId === w.id && (
               <X size={12} onClick={(e) => { e.stopPropagation(); deleteWatchlist(w.id); }} style={{ opacity: 0.5, cursor: 'pointer' }} />
            )}
          </div>
        ))}
        <div 
          onClick={() => { const name = prompt('Enter watchlist name:'); if (name && name.trim()) createWatchlist(name.trim()); }}
          style={{ padding: '12px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', transition: 'color 0.2s ease' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          <Plus size={14} />
        </div>
      </div>

      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', position: 'relative', background: 'var(--bg-panel)' }}>
        <Search size={14} style={{ position: 'absolute', left: '28px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
        <input
          type="text"
          placeholder="Search stocks to add..."
          className="input-field"
          style={{ width: '100%', paddingLeft: '32px', fontSize: '13px', background: 'var(--bg-dark)' }}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {isSearchMode && (
          <X 
            size={14} 
            onClick={() => setSearchQuery('')}
            style={{ position: 'absolute', right: '28px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', cursor: 'pointer' }} 
          />
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {stocks.length === 0 ? (
          <div style={{ padding: '30px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>Connecting...</div>
          </div>
        ) : !isSearchMode && displayStocks.length === 0 ? (
          <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div style={{ width: '64px', height: '64px', background: 'rgba(255,255,255,0.03)', borderRadius: '50%', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <Search size={28} color="var(--color-blue)" opacity={0.8} />
            </div>
            <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>Add Stocks</div>
            <div style={{ fontSize: '12px', lineHeight: '1.5', color: 'var(--text-muted)' }}>
              This watchlist is empty. Search above to add items to {activeWatchlist.name}.
            </div>
          </div>
        ) : isSearchMode && displayStocks.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
            No stocks found for "{searchQuery}"
          </div>
        ) : displayStocks.map(stock => {
          const data = prices[stock.uniqueSymbol];
          const isSelected = selectedSymbol === stock.uniqueSymbol;
          const isUp = data?.pct > 0;
          const isDown = data?.pct < 0;
          const isInWatchlist = activeWatchlist.symbols.includes(stock.uniqueSymbol);
          const isHovered = hoveredStock === stock.uniqueSymbol;

          return (
            <div
              key={stock.uniqueSymbol}
              onClick={() => setSelectedSymbol(stock.uniqueSymbol)}
              onMouseEnter={() => setHoveredStock(stock.uniqueSymbol)}
              onMouseLeave={() => setHoveredStock(null)}
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                cursor: 'pointer',
                background: isSelected ? 'rgba(225, 42, 31, 0.08)' : isHovered ? 'rgba(255,255,255,0.02)' : 'transparent',
                borderLeft: isSelected ? '3px solid var(--color-red)' : '3px solid transparent',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'background 0.1s ease',
                position: 'relative'
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: '700', fontSize: '13px', letterSpacing: '0.3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {stock.symbol}
                  <span style={{ fontSize: '9px', padding: '1px 4px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', color: 'var(--text-secondary)' }}>
                    {stock.exchange}
                  </span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>{stock.name}</div>
              </div>

              {/* Action Buttons (visible on hover) */}
              {isHovered && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingRight: '12px' }}>
                  {isSearchMode ? (
                    isInWatchlist ? (
                      <Check size={16} color="var(--color-green-light)" />
                    ) : (
                      <div 
                        onClick={(e) => { e.stopPropagation(); addStockToWatchlist(activeWatchlistId, stock.uniqueSymbol); }}
                        style={{ padding: '4px', background: 'var(--color-blue)', borderRadius: '4px', display: 'flex' }}
                      >
                        <Plus size={14} color="#fff" />
                      </div>
                    )
                  ) : (
                    <div 
                      onClick={(e) => { e.stopPropagation(); removeStockFromWatchlist(activeWatchlistId, stock.uniqueSymbol); }}
                      style={{ padding: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', display: 'flex' }}
                    >
                      <Trash2 size={14} color="var(--color-red-light)" />
                    </div>
                  )}
                </div>
              )}

              {/* Prices (hidden when hovered to make room for actions) */}
              {data && !isHovered ? (
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
              ) : !data && !isHovered ? (
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>—</div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-color)', fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', background: 'var(--bg-panel)' }}>
        <span>{displayStocks.length} stocks {isSearchMode ? 'found' : 'in list'}</span>
        <span style={{ color: 'var(--color-green-light)' }}>● LIVE</span>
      </div>
    </div>
  );
}
