import { useShallow } from 'zustand/react/shallow';
import React, { useState, useRef } from 'react';
import { useStore, API } from '../store';
import { TrendingUp, TrendingDown, Minus, Search, Plus, X, Trash2, Check, AlignRight, List, Bell } from 'lucide-react';

export default function MarketWatch({ className = '' }) {
  const { prices, stocks, selectedSymbol, setSelectedSymbol, fetchBatchPrices, watchlists, activeWatchlistId, setActiveWatchlist, addStockToWatchlist, removeStockFromWatchlist, createWatchlist, deleteWatchlist, renameWatchlist, openOrderModal, openMarketDepthModal, openDomLadderModal, setAlertModalSymbol } = useStore(useShallow(state => ({ prices: state.prices, stocks: state.stocks, selectedSymbol: state.selectedSymbol, setSelectedSymbol: state.setSelectedSymbol, fetchBatchPrices: state.fetchBatchPrices, watchlists: state.watchlists, activeWatchlistId: state.activeWatchlistId, setActiveWatchlist: state.setActiveWatchlist, addStockToWatchlist: state.addStockToWatchlist, removeStockFromWatchlist: state.removeStockFromWatchlist, createWatchlist: state.createWatchlist, deleteWatchlist: state.deleteWatchlist, renameWatchlist: state.renameWatchlist, openOrderModal: state.openOrderModal, openMarketDepthModal: state.openMarketDepthModal, openDomLadderModal: state.openDomLadderModal, setAlertModalSymbol: state.setAlertModalSymbol })));
  
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredStock, setHoveredStock] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchLotsizes = useRef({});

  const activeWatchlist = watchlists.find(w => String(w.id) === String(activeWatchlistId)) || watchlists[0];
  const isSearchMode = searchQuery.trim().length > 0;

  React.useEffect(() => {
    if (!isSearchMode) {
      setSearchResults([]);
      return;
    }
    
    const controller = new AbortController();
    const signal = controller.signal;
    
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`${API}/api/stocks/search?q=${encodeURIComponent(searchQuery)}`, { signal });
        if (res.ok) {
          const data = await res.json();
          // Cache the lotsize locally so we have it instantly if the user adds to watchlist
          data.forEach(item => {
            searchLotsizes.current[item.uniqueSymbol] = item.lotsize;
          });
          setSearchResults(data);
        }
      } catch (e) {
        if (e.name !== 'AbortError') {
          console.error("Search error:", e);
        }
      } finally {
        if (!signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 300);
    
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, isSearchMode]);

  // Watchlist Mode
  const watchlistStocks = !isSearchMode ? activeWatchlist.symbols.map(sym => {
    const found = stocks.find(s => s.uniqueSymbol === sym);
    if (found) return found;
    // For Options/Futures that are not in the stocks list
    const dashIdx = sym.lastIndexOf('-');
    let symbol, exchange;
    if (dashIdx > 0) {
      symbol = sym.substring(0, dashIdx);
      exchange = sym.substring(dashIdx + 1);
    } else {
      symbol = sym;
      // Detect derivatives by pattern (e.g. NIFTY07JUL2624000CE)
      exchange = /\d{2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{2}/.test(sym) ? 'NFO' : 'NSE';
    }
    return { uniqueSymbol: sym, symbol: symbol, name: symbol, exchange: exchange, token: '' };
  }).filter(Boolean) : [];
  const displayStocks = isSearchMode ? searchResults : watchlistStocks;

  React.useEffect(() => {
    // Collect all stocks currently visible (watchlist or search results)
    const visibleStocks = isSearchMode ? searchResults : watchlistStocks;
    
    // Subscribe to all of them for instant updates
    if (visibleStocks.length > 0) {
      const subscribeBatch = useStore.getState().subscribeToOptionBatch;
      const unsubscribeBatch = useStore.getState().unsubscribeFromOptionBatch;
      
      const tokensToSub = visibleStocks.map(s => ({
        token: s.token,
        symbol: s.uniqueSymbol,
        exchange: s.exchange,
        name: s.name
      }));
      
      // 1. Subscribe to WebSocket for live ticks
      subscribeBatch(tokensToSub);
      
      // 2. Also fetch latest snapshot manually (fallback)
      useStore.getState().fetchBatchPrices(visibleStocks.map(s => s.uniqueSymbol));
      
      // 3. Fetch missing lotsizes for derivatives not in main stocks list
      const missingLotsizes = visibleStocks.filter(s => !s.lotsize && !searchLotsizes.current[s.uniqueSymbol]).map(s => s.uniqueSymbol);
      if (missingLotsizes.length > 0) {
        fetch(`${API}/api/stocks/lotsizes?symbols=${missingLotsizes.join(',')}`)
          .then(r => r.json())
          .then(data => {
            Object.keys(data).forEach(sym => {
              searchLotsizes.current[sym] = data[sym];
            });
          }).catch(console.error);
      }
      
      return () => {
        unsubscribeBatch(tokensToSub);
      };
    }
  }, [isSearchMode, searchResults.map(s => s.uniqueSymbol).join(','), activeWatchlist.symbols.join(',')]);

  return (
    <div className={`sidebar glass-panel ${className}`}>
      {/* Watchlist Tabs */}
      <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid var(--border-color)', padding: '0 8px', background: 'var(--bg-panel)' }} className="scrollbar-hide">
        {watchlists.map(w => (
          <div
            key={w.id}
            onClick={() => { setActiveWatchlist(w.id); setSearchQuery(''); setSearchResults([]); }}
            onDoubleClick={() => { 
              const newName = prompt('Rename watchlist:', w.name); 
              if (newName && newName.trim()) renameWatchlist(w.id, newName.trim()); 
            }}
            title="Double-click to rename"
            style={{
              padding: '12px 14px',
              fontSize: '12px',
              fontWeight: String(activeWatchlistId) === String(w.id) ? '600' : '500',
              color: String(activeWatchlistId) === String(w.id) ? 'var(--color-blue)' : 'var(--text-secondary)',
              borderBottom: String(activeWatchlistId) === String(w.id) ? '2px solid var(--color-blue)' : '2px solid transparent',
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
            {watchlists.length > 1 && String(activeWatchlistId) === String(w.id) && (
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
          className="input-field search-pill"
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
                padding: '6px 12px',
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
                <div style={{ fontWeight: '600', fontSize: '12px', letterSpacing: '0.2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {stock.symbol}
                  <span style={{ fontSize: '9px', padding: '1px 3px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', color: 'var(--text-secondary)' }}>
                    {stock.exchange}
                  </span>
                </div>
                <div style={{ fontSize: '9px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>{stock.name}</div>
              </div>

              {/* Action Buttons (visible on hover) */}
              {isHovered && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingRight: '8px' }}>
                  {isSearchMode ? (
                    isInWatchlist ? (
                      <Check size={14} color="var(--color-green-light)" />
                    ) : (
                      <div 
                        onClick={(e) => { e.stopPropagation(); addStockToWatchlist(activeWatchlistId, stock.uniqueSymbol); }}
                        style={{ padding: '3px', background: 'var(--color-blue)', borderRadius: '4px', display: 'flex' }}
                      >
                        <Plus size={12} color="#fff" />
                      </div>
                    )
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div 
                        onClick={(e) => { e.stopPropagation(); openOrderModal(stock.uniqueSymbol, 'BUY', stock.lotsize || searchLotsizes.current[stock.uniqueSymbol] || prices[stock.uniqueSymbol]?.lotsize || 1); }}
                        style={{ padding: '2px 6px', background: 'var(--color-blue)', borderRadius: '3px', color: '#fff', fontSize: '10px', fontWeight: 'bold', display: 'flex', cursor: 'pointer' }}
                      >
                        B
                      </div>
                      <div 
                        onClick={(e) => { e.stopPropagation(); openOrderModal(stock.uniqueSymbol, 'SELL', stock.lotsize || searchLotsizes.current[stock.uniqueSymbol] || prices[stock.uniqueSymbol]?.lotsize || 1); }}
                        style={{ padding: '2px 6px', background: 'var(--color-red)', borderRadius: '3px', color: '#fff', fontSize: '10px', fontWeight: 'bold', display: 'flex', cursor: 'pointer' }}
                      >
                        S
                      </div>
                      <div 
                        onClick={(e) => { e.stopPropagation(); setAlertModalSymbol(stock.uniqueSymbol); }}
                        style={{ padding: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', display: 'flex', marginLeft: '2px', cursor: 'pointer' }}
                        title="Set Price Alert"
                      >
                        <Bell size={12} color="var(--color-yellow)" />
                      </div>
                      <div 
                        onClick={(e) => { e.stopPropagation(); removeStockFromWatchlist(activeWatchlistId, stock.uniqueSymbol); }}
                        style={{ padding: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', display: 'flex', marginLeft: '2px' }}
                        title="Remove"
                      >
                        <Trash2 size={12} color="var(--color-red-light)" />
                      </div>
                      <div 
                        onClick={(e) => { e.stopPropagation(); openMarketDepthModal(stock.uniqueSymbol, stock.lotsize || searchLotsizes.current[stock.uniqueSymbol] || prices[stock.uniqueSymbol]?.lotsize || 1); }}
                        style={{ padding: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', display: 'flex', marginLeft: '2px' }}
                        title="Market Depth"
                      >
                        <AlignRight size={12} color="var(--color-blue)" />
                      </div>
                      <div 
                        onClick={(e) => { e.stopPropagation(); openDomLadderModal(stock.uniqueSymbol, stock.lotsize || searchLotsizes.current[stock.uniqueSymbol] || prices[stock.uniqueSymbol]?.lotsize || 1); }}
                        style={{ padding: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', display: 'flex', marginLeft: '2px' }}
                        title="DOM Ladder"
                      >
                        <List size={12} color="var(--color-purple)" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Prices (hidden when hovered to make room for actions) */}
              {data && !isHovered ? (
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{
                    fontWeight: '600',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '4px',
                    color: isUp ? 'var(--color-green-light)' : isDown ? 'var(--color-red-light)' : 'var(--text-primary)'
                  }}>
                    {data.ltp.toFixed(2)}
                    {isUp ? <TrendingUp size={10} /> : isDown ? <TrendingDown size={10} /> : null}
                  </div>
                  <div style={{
                    fontSize: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    justifyContent: 'flex-end',
                    color: isUp ? 'var(--color-green-light)' : isDown ? 'var(--color-red-light)' : 'var(--text-secondary)'
                  }}>
                    {data.change !== undefined && data.pct !== undefined 
                      ? `${data.pct > 0 ? '+' : ''}${Number(data.change).toFixed(2)} (${data.pct > 0 ? '+' : ''}${Number(data.pct).toFixed(2)}%)` 
                      : '—'}
                  </div>
                </div>
              ) : !data && !isHovered ? (
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>—</div>
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
