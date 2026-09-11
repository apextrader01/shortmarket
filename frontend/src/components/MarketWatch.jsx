import { useShallow } from 'zustand/react/shallow';
import React, { useState, useRef } from 'react';
import { useStore, API } from '../store';
import { TrendingUp, TrendingDown, Minus, Search, Plus, X, Trash2, Check, AlignRight, List, Bell } from 'lucide-react';
import { getInstantLotsize } from '../utils/lotsizeHelper';

const WatchlistRow = React.memo(({ stock, isSearchMode, activeWatchlistId, watchlists, onStockSelect }) => {
  const isSelected = useStore(state => state.selectedSymbol === stock.uniqueSymbol);
  const data = useStore(state => 
    state.prices[stock.uniqueSymbol] || 
    state.prices[stock.symbol] || 
    (stock.exchange ? state.prices[`${stock.exchange}:${stock.symbol}`] : null) ||
    state.prices[`NSE:${stock.symbol}`] ||
    state.prices[`MCX:${stock.symbol}`] ||
    state.prices[`BSE:${stock.symbol}`]
  );
  
  const isUp = data?.pct >= 0;
  const isDown = data?.pct < 0;
  
  const activeWatchlist = watchlists.find(w => String(w.id) === String(activeWatchlistId)) || watchlists[0];
  const isInWatchlist = (activeWatchlist?.symbols || []).includes(stock.uniqueSymbol);
  const currentLotsize = (stock.lotsize && Number(stock.lotsize) > 1) ? Number(stock.lotsize) : (data?.lotsize && Number(data.lotsize) > 1) ? Number(data.lotsize) : getInstantLotsize(stock.uniqueSymbol);

  const handleSelect = () => {
    useStore.getState().setSelectedSymbol(stock.uniqueSymbol);
    if (onStockSelect) onStockSelect();
  };

  return (
    <div
      onClick={() => {
        if (!isSearchMode) handleSelect();
      }}
      className={`watchlist-item ${isSelected ? 'selected' : ''}`}
      style={{
        padding: '7px 12px',
        borderBottom: '1px solid var(--border-color)',
        cursor: 'pointer',
        background: isSelected ? 'rgba(37,99,235,0.08)' : 'transparent',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative',
        minHeight: '44px'
      }}
    >
      <div 
        style={{ minWidth: 0, flex: 1, paddingRight: '8px' }}
        onClick={() => {
          if (isSearchMode) handleSelect();
        }}
      >
        <div style={{ fontWeight: isSelected ? '700' : '600', fontSize: '12px', letterSpacing: '0.2px', display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-primary)' }}>
          {stock.symbol}
          <span className={`badge-${stock.exchange?.toLowerCase() || 'nse'}`} style={{ fontSize: '9px', padding: '1px 3px', borderRadius: '3px' }}>{stock.exchange}</span>
          {isSearchMode && isInWatchlist && (
            <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(16,185,129,0.15)', color: 'var(--color-green-light)', fontWeight: '600' }}>✓ In Watchlist</span>
          )}
        </div>
        <div style={{ fontSize: '9px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>{stock.description || stock.name}</div>
      </div>

      {isSearchMode ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {isInWatchlist ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                useStore.getState().removeStockFromWatchlist(activeWatchlistId, stock.uniqueSymbol);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 8px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '4px',
                color: 'var(--color-red-light)',
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
              title="Remove from Watchlist"
            >
              <Minus size={12} />
              <span>Remove</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                useStore.getState().addStockToWatchlist(activeWatchlistId, stock.uniqueSymbol);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 10px',
                background: 'var(--color-blue)',
                border: 'none',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(37,99,235,0.3)'
              }}
              title="Add to Watchlist"
            >
              <Plus size={12} />
              <span>Add</span>
            </button>
          )}
        </div>
      ) : (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: '75px', minHeight: '30px' }}>
          {/* Live Price Display - always in DOM, concealed via CSS on hover */}
          <div className="watchlist-price-container" style={{ textAlign: 'right', flexShrink: 0 }}>
            {data && data.ltp !== undefined ? (
              <>
                <div key={data.last_update_time || data.ltp} className={data.tickDirection === 1 ? 'flash-up' : data.tickDirection === -1 ? 'flash-down' : ''} style={{ fontWeight: '600', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', padding: '1px 2px', color: isUp ? 'var(--color-green-light)' : isDown ? 'var(--color-red-light)' : 'var(--text-primary)' }}>
                  {data.ltp.toFixed(2)}
                  {isUp ? <TrendingUp size={10} /> : isDown ? <TrendingDown size={10} /> : null}
                </div>
                <div style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '2px', justifyContent: 'flex-end', color: isUp ? 'var(--color-green-light)' : isDown ? 'var(--color-red-light)' : 'var(--text-secondary)' }}>
                  {data.change !== undefined && data.pct !== undefined ? `${data.pct > 0 ? '+' : ''}${Number(data.change).toFixed(2)} (${data.pct > 0 ? '+' : ''}${Number(data.pct).toFixed(2)}%)` : '?'}
                </div>
              </>
            ) : (
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>?</div>
            )}
          </div>

          {/* Action Buttons - revealed purely via CSS :hover (cannot get stuck on mouse sweep) */}
          <div className="watchlist-hover-actions">
            <div onClick={(e) => { e.stopPropagation(); useStore.getState().openOrderModal(stock.uniqueSymbol, 'BUY', currentLotsize); }} style={{ padding: '2px 6px', background: 'var(--color-blue)', borderRadius: '3px', color: '#fff', fontSize: '10px', fontWeight: 'bold', display: 'flex', cursor: 'pointer' }}>B</div>
            <div onClick={(e) => { e.stopPropagation(); useStore.getState().openOrderModal(stock.uniqueSymbol, 'SELL', currentLotsize); }} style={{ padding: '2px 6px', background: 'var(--color-red)', borderRadius: '3px', color: '#fff', fontSize: '10px', fontWeight: 'bold', display: 'flex', cursor: 'pointer' }}>S</div>
            <div onClick={(e) => { e.stopPropagation(); useStore.getState().setAlertModalSymbol(stock.uniqueSymbol); }} style={{ padding: '3px', background: 'var(--border-color)', borderRadius: '3px', display: 'flex', marginLeft: '2px', cursor: 'pointer' }} title="Set Price Alert"><Bell size={12} color="var(--color-yellow)" /></div>
            <div onClick={(e) => { e.stopPropagation(); useStore.getState().removeStockFromWatchlist(activeWatchlistId, stock.uniqueSymbol); }} style={{ padding: '3px', background: 'var(--border-color)', borderRadius: '3px', display: 'flex', marginLeft: '2px', cursor: 'pointer' }} title="Remove"><Trash2 size={12} color="var(--color-red-light)" /></div>
            <div onClick={(e) => { e.stopPropagation(); useStore.getState().openMarketDepthModal(stock.uniqueSymbol, currentLotsize); }} style={{ padding: '3px', background: 'var(--border-color)', borderRadius: '3px', display: 'flex', marginLeft: '2px', cursor: 'pointer' }} title="Market Depth"><AlignRight size={12} color="var(--color-blue)" /></div>
          </div>
        </div>
      )}
    </div>
  );
});

export default function MarketWatch({ className = '', onStockSelect }) {
  const { stocks, selectedSymbol, setSelectedSymbol, fetchBatchPrices, watchlists, activeWatchlistId, setActiveWatchlist, addStockToWatchlist, removeStockFromWatchlist, createWatchlist, deleteWatchlist, renameWatchlist, openOrderModal, openMarketDepthModal, openDomLadderModal, setAlertModalSymbol } = useStore(useShallow(state => ({ stocks: state.stocks, selectedSymbol: state.selectedSymbol, setSelectedSymbol: state.setSelectedSymbol, fetchBatchPrices: state.fetchBatchPrices, watchlists: state.watchlists, activeWatchlistId: state.activeWatchlistId, setActiveWatchlist: state.setActiveWatchlist, addStockToWatchlist: state.addStockToWatchlist, removeStockFromWatchlist: state.removeStockFromWatchlist, createWatchlist: state.createWatchlist, deleteWatchlist: state.deleteWatchlist, renameWatchlist: state.renameWatchlist, openOrderModal: state.openOrderModal, openMarketDepthModal: state.openMarketDepthModal, openDomLadderModal: state.openDomLadderModal, setAlertModalSymbol: state.setAlertModalSymbol })));
  
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

  // Fast O(1) indexed stock lookup map
  const stockMap = React.useMemo(() => {
    const map = new Map();
    (stocks || []).forEach(s => {
      const sym = s.uniqueSymbol || s.unique_symbol || s.symbol;
      if (sym) {
        map.set(sym, s);
        if (s.symbol && s.symbol !== sym) map.set(s.symbol, s);
      }
    });
    return map;
  }, [stocks]);

  // Watchlist Mode with memoization
  const watchlistStocks = React.useMemo(() => {
    if (isSearchMode) return [];
    return (activeWatchlist?.symbols || []).map(sym => {
      const found = stockMap.get(sym);
      if (found) return {
        ...found,
        uniqueSymbol: found.uniqueSymbol || found.unique_symbol || found.symbol
      };
      // For Options/Futures that are not in the stocks list
      const colonIdx = sym.indexOf(':');
      let symbol, exchange;
      if (colonIdx > 0) {
        exchange = sym.substring(0, colonIdx);
        symbol = sym.substring(colonIdx + 1);
      } else {
        symbol = sym;
        exchange = 'NSE';
      }
      const lotsize = getInstantLotsize(sym);
      return { uniqueSymbol: sym, symbol: symbol, name: symbol, exchange: exchange, lotsize: lotsize, token: '' };
    }).filter(Boolean);
  }, [isSearchMode, activeWatchlist?.symbols, stockMap]);
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
          placeholder={`Search & add to Watchlist ${watchlists.findIndex(w => String(w.id) === String(activeWatchlistId)) + 1}`}
          className="input-field search-pill"
          style={{ width: '100%', paddingLeft: '32px', fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (e.target.value.trim().length > 0) {
              setIsSearching(true);
            } else {
              setIsSearching(false);
            }
          }}
        />
        {isSearchMode && (
          <X 
            size={14} 
            onClick={() => setSearchQuery('')}
            style={{ position: 'absolute', right: '28px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', cursor: 'pointer' }} 
          />
        )}
      </div>

      {isSearchMode && (
        <div style={{ padding: '8px 16px', background: 'rgba(59, 130, 246, 0.08)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            Search results for <strong style={{ color: 'var(--text-primary)' }}>"{searchQuery}"</strong>
          </span>
          <button
            type="button"
            onClick={() => { setSearchQuery(''); setSearchResults([]); }}
            style={{
              background: 'var(--color-blue)',
              color: '#fff',
              border: 'none',
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            Done / Watchlist
          </button>
        </div>
      )}

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
        ) : <div className="watchlist-list" style={{ flex: 1, overflowY: 'auto' }}>
        {displayStocks.map(stock => (
          <WatchlistRow
            key={stock.uniqueSymbol}
            stock={stock}
            isSearchMode={isSearchMode}
            activeWatchlistId={activeWatchlistId}
            watchlists={watchlists}
            onStockSelect={onStockSelect}
          />
        ))}
      </div>}
      </div>

      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-color)', fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', background: 'var(--bg-panel)' }}>
        <span>{displayStocks.length} stocks {isSearchMode ? 'found' : 'in list'}</span>
        <span style={{ color: 'var(--color-green-light)' }}>● LIVE</span>
      </div>
    </div>
  );
}


