import { useShallow } from 'zustand/react/shallow';
import React, { useState, useRef } from 'react';
import { useStore, API } from '../store';
import { TrendingUp, TrendingDown, Minus, Search, Plus, X, Trash2, Check, AlignRight, List, Bell, SlidersHorizontal, ArrowDownUp, RotateCcw } from 'lucide-react';
import { getInstantLotsize, isDerivativeContract } from '../utils/lotsizeHelper';

const WatchlistRow = React.memo(({ stock, isSearchMode, activeWatchlistId, watchlists, onStockSelect, swipedSymbol, setSwipedSymbol, isMobile }) => {
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

  const isSwiped = Boolean(isMobile) && swipedSymbol === stock.uniqueSymbol;
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);

  const handleTouchStart = (e) => {
    if (!isMobile) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = true;
  };

  const handleTouchMove = (e) => {
    if (!isMobile || !isSwiping.current) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;

    // If vertical movement dominates, let standard vertical scrolling take place
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
      isSwiping.current = false;
      return;
    }

    // Swiped left > 35px reveals Buy, Sell, Delete
    if (dx < -35) {
      if (setSwipedSymbol) setSwipedSymbol(stock.uniqueSymbol);
      isSwiping.current = false;
    } else if (dx > 25) {
      // Swiped right -> close swipe tray
      if (setSwipedSymbol && isSwiped) setSwipedSymbol(null);
      isSwiping.current = false;
    }
  };

  const handleTouchEnd = () => {
    isSwiping.current = false;
  };

  const handleSelect = () => {
    useStore.getState().setSelectedSymbol(stock.uniqueSymbol);
    if (onStockSelect) onStockSelect(stock.uniqueSymbol);
  };

  const rowContent = (
    <>
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
          {/* Live Price Display - always in DOM, concealed via CSS on hover on desktop */}
          <div className="watchlist-price-container" style={{ textAlign: 'right', flexShrink: 0 }}>
            {data && data.ltp !== undefined ? (
              <>
                <div className={data.tickDirection === 1 ? 'flash-up' : data.tickDirection === -1 ? 'flash-down' : ''} style={{ fontWeight: '600', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', padding: '1px 2px', color: isUp ? 'var(--color-green-light)' : isDown ? 'var(--color-red-light)' : 'var(--text-primary)' }}>
                  {data.ltp.toFixed(2)}
                  {isUp ? <TrendingUp size={10} /> : isDown ? <TrendingDown size={10} /> : null}
                </div>
                <div style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '2px', justifyContent: 'flex-end', color: isUp ? 'var(--color-green-light)' : isDown ? 'var(--color-red-light)' : 'var(--text-secondary)' }}>
                  {data.change !== undefined && data.pct !== undefined ? `${data.pct > 0 ? '+' : ''}${Number(data.change).toFixed(2)} (${data.pct > 0 ? '+' : ''}${Number(data.pct).toFixed(2)}%)` : '—'}
                </div>
              </>
            ) : (
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>—</div>
            )}
          </div>

          {/* Action Buttons - revealed purely via CSS :hover on desktop */}
          <div className="watchlist-hover-actions">
            <div onClick={(e) => { e.stopPropagation(); useStore.getState().openOrderModal(stock.uniqueSymbol, 'BUY', currentLotsize); }} style={{ padding: '2px 6px', background: 'var(--color-blue)', borderRadius: '3px', color: '#fff', fontSize: '10px', fontWeight: 'bold', display: 'flex', cursor: 'pointer' }}>B</div>
            <div onClick={(e) => { e.stopPropagation(); useStore.getState().openOrderModal(stock.uniqueSymbol, 'SELL', currentLotsize); }} style={{ padding: '2px 6px', background: 'var(--color-red)', borderRadius: '3px', color: '#fff', fontSize: '10px', fontWeight: 'bold', display: 'flex', cursor: 'pointer' }}>S</div>
            <div onClick={(e) => { e.stopPropagation(); useStore.getState().setAlertModalSymbol(stock.uniqueSymbol); }} style={{ padding: '3px', background: 'var(--border-color)', borderRadius: '3px', display: 'flex', marginLeft: '2px', cursor: 'pointer' }} title="Set Price Alert"><Bell size={12} color="var(--color-yellow)" /></div>
            <div onClick={(e) => { e.stopPropagation(); useStore.getState().removeStockFromWatchlist(activeWatchlistId, stock.uniqueSymbol); }} style={{ padding: '3px', background: 'var(--border-color)', borderRadius: '3px', display: 'flex', marginLeft: '2px', cursor: 'pointer' }} title="Remove"><Trash2 size={12} color="var(--color-red-light)" /></div>
            <div onClick={(e) => { e.stopPropagation(); useStore.getState().openMarketDepthModal(stock.uniqueSymbol, currentLotsize); }} style={{ padding: '3px', background: 'var(--border-color)', borderRadius: '3px', display: 'flex', marginLeft: '2px', cursor: 'pointer' }} title="Market Depth"><AlignRight size={12} color="var(--color-blue)" /></div>
          </div>
        </div>
      )}
    </>
  );

  // Desktop View: clean, original background with NO swipe container or swipe actions
  if (!isMobile) {
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
        {rowContent}
      </div>
    );
  }

  // Mobile View: row with swipe actions tray underneath
  return (
    <div className="watchlist-swipe-container">
      {/* 3-Action Tray Revealed on Swipe (Buy, Sell, Delete) */}
      <div className="watchlist-swipe-actions">
        <button
          type="button"
          className="watchlist-swipe-btn watchlist-swipe-btn-buy"
          onClick={(e) => {
            e.stopPropagation();
            if (setSwipedSymbol) setSwipedSymbol(null);
            useStore.getState().openOrderModal(stock.uniqueSymbol, 'BUY', currentLotsize);
          }}
          title="Buy"
        >
          B
        </button>
        <button
          type="button"
          className="watchlist-swipe-btn watchlist-swipe-btn-sell"
          onClick={(e) => {
            e.stopPropagation();
            if (setSwipedSymbol) setSwipedSymbol(null);
            useStore.getState().openOrderModal(stock.uniqueSymbol, 'SELL', currentLotsize);
          }}
          title="Sell"
        >
          S
        </button>
        <button
          type="button"
          className="watchlist-swipe-btn watchlist-swipe-btn-delete"
          onClick={(e) => {
            e.stopPropagation();
            if (setSwipedSymbol) setSwipedSymbol(null);
            useStore.getState().removeStockFromWatchlist(activeWatchlistId, stock.uniqueSymbol);
          }}
          title="Remove from Watchlist"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Main Row Content */}
      <div
        onClick={() => {
          if (isSwiped) {
            if (setSwipedSymbol) setSwipedSymbol(null);
            return;
          }
          if (swipedSymbol) {
            if (setSwipedSymbol) setSwipedSymbol(null);
            return;
          }
          if (!isSearchMode) handleSelect();
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`watchlist-item watchlist-swipe-row ${isSelected ? 'selected' : ''}`}
        style={{
          transform: isSwiped ? 'translateX(-165px)' : 'translateX(0)',
          padding: '7px 12px',
          borderBottom: '1px solid var(--border-color)',
          cursor: 'pointer',
          background: isSelected ? 'rgba(37,99,235,0.2)' : 'var(--bg-card, #131722)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative',
          minHeight: '44px'
        }}
      >
        {rowContent}
      </div>
    </div>
  );
});

export default function MarketWatch({ className = '', onStockSelect }) {
  const { stocks, selectedSymbol, setSelectedSymbol, fetchBatchPrices, watchlists, activeWatchlistId, setActiveWatchlist, addStockToWatchlist, removeStockFromWatchlist, createWatchlist, deleteWatchlist, renameWatchlist, openOrderModal, openMarketDepthModal, openDomLadderModal, setAlertModalSymbol } = useStore(useShallow(state => ({ stocks: state.stocks, selectedSymbol: state.selectedSymbol, setSelectedSymbol: state.setSelectedSymbol, fetchBatchPrices: state.fetchBatchPrices, watchlists: state.watchlists, activeWatchlistId: state.activeWatchlistId, setActiveWatchlist: state.setActiveWatchlist, addStockToWatchlist: state.addStockToWatchlist, removeStockFromWatchlist: state.removeStockFromWatchlist, createWatchlist: state.createWatchlist, deleteWatchlist: state.deleteWatchlist, renameWatchlist: state.renameWatchlist, openOrderModal: state.openOrderModal, openMarketDepthModal: state.openMarketDepthModal, openDomLadderModal: state.openDomLadderModal, setAlertModalSymbol: state.setAlertModalSymbol })));
  
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredStock, setHoveredStock] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [swipedSymbol, setSwipedSymbol] = useState(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [sortBy, setSortBy] = useState('DEFAULT');
  const [filterSegment, setFilterSegment] = useState('ALL');
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  const searchLotsizes = useRef({});

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const activeWatchlist = watchlists.find(w => String(w.id) === String(activeWatchlistId)) || watchlists[0];
  const isSearchMode = searchQuery.trim().length > 0;
  const hasActiveFilter = filterSegment !== 'ALL' || sortBy !== 'DEFAULT';

  const isFno = (sym) => isDerivativeContract(sym);

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

  const displayStocks = React.useMemo(() => {
    let list = isSearchMode ? searchResults : watchlistStocks;

    // Filter by Segment
    if (filterSegment !== 'ALL') {
      list = list.filter(s => {
        const sym = s.uniqueSymbol || s.symbol || '';
        const ex = (s.exchange || '').toUpperCase();
        if (filterSegment === 'NSE') return (ex === 'NSE' || sym.startsWith('NSE:')) && !isFno(sym);
        if (filterSegment === 'BSE') return (ex === 'BSE' || sym.startsWith('BSE:')) && !isFno(sym);
        if (filterSegment === 'MCX') return ex === 'MCX' || sym.startsWith('MCX:');
        if (filterSegment === 'FNO') return isFno(sym);
        return true;
      });
    }

    // Sort
    if (sortBy !== 'DEFAULT') {
      const prices = useStore.getState().prices;
      list = [...list].sort((a, b) => {
        const symA = a.symbol || a.uniqueSymbol || '';
        const symB = b.symbol || b.uniqueSymbol || '';
        const dataA = prices[a.uniqueSymbol] || prices[a.symbol] || {};
        const dataB = prices[b.uniqueSymbol] || prices[b.symbol] || {};
        const priceA = Number(dataA.ltp !== undefined ? dataA.ltp : (a.ltp || 0));
        const priceB = Number(dataB.ltp !== undefined ? dataB.ltp : (b.ltp || 0));
        const pctA = Number(dataA.pct || 0);
        const pctB = Number(dataB.pct || 0);

        if (sortBy === 'ALPHA_ASC') return symA.localeCompare(symB);
        if (sortBy === 'ALPHA_DESC') return symB.localeCompare(symA);
        if (sortBy === 'PRICE_DESC') return priceB - priceA;
        if (sortBy === 'PRICE_ASC') return priceA - priceB;
        if (sortBy === 'PCT_DESC') return pctB - pctA;
        if (sortBy === 'PCT_ASC') return pctA - pctB;
        return 0;
      });
    }

    return list;
  }, [isSearchMode, searchResults, watchlistStocks, filterSegment, sortBy]);

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
  }, [isSearchMode, searchResults.map(s => s.uniqueSymbol).join(','), activeWatchlist?.symbols?.join(',') || '']);

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

      {/* Search & Filter Header */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', position: 'relative', background: 'var(--bg-panel)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-secondary)' }} />
          <input
            type="text"
            placeholder={`Search & add stocks`}
            className="input-field search-pill"
            style={{ width: '100%', paddingLeft: '32px', paddingRight: isSearchMode ? '28px' : '10px', fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', height: '36px' }}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearching(e.target.value.trim().length > 0);
            }}
          />
          {isSearchMode && (
            <X 
              size={14} 
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '10px', color: 'var(--text-secondary)', cursor: 'pointer' }} 
            />
          )}
        </div>

        {/* Count and Filter Toggle Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }} title="Stocks count">
            {displayStocks.length}
          </span>
          <button
            type="button"
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            style={{
              background: (hasActiveFilter || showFilterMenu) ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${(hasActiveFilter || showFilterMenu) ? 'var(--color-blue)' : 'var(--border-color)'}`,
              borderRadius: '6px',
              padding: '8px 9px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: (hasActiveFilter || showFilterMenu) ? 'var(--color-blue)' : 'var(--text-secondary)',
              position: 'relative'
            }}
            title="Filter & Sort Watchlist"
          >
            <SlidersHorizontal size={14} />
            {hasActiveFilter && (
              <span style={{ position: 'absolute', top: '-3px', right: '-3px', width: '7px', height: '7px', borderRadius: '50%', background: 'var(--color-blue)' }} />
            )}
          </button>
        </div>
      </div>

      {/* Filter & Sort Dropdown Menu */}
      {showFilterMenu && (
        <div className="watchlist-filter-menu" style={{ padding: '12px 14px', background: 'var(--bg-card, #1e293b)', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Segment Filter */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>Filter Segment</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {[
                { label: 'All', value: 'ALL' },
                { label: 'NSE', value: 'NSE' },
                { label: 'BSE', value: 'BSE' },
                { label: 'MCX', value: 'MCX' },
                { label: 'F&O', value: 'FNO' }
              ].map(seg => (
                <button
                  key={seg.value}
                  type="button"
                  onClick={() => setFilterSegment(seg.value)}
                  style={{
                    padding: '4px 9px',
                    fontSize: '11px',
                    fontWeight: filterSegment === seg.value ? '700' : '500',
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: filterSegment === seg.value ? 'var(--color-blue)' : 'var(--border-color)',
                    background: filterSegment === seg.value ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.03)',
                    color: filterSegment === seg.value ? 'var(--color-blue-light, #93c5fd)' : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  {seg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sort By */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>Sort By</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {[
                { label: 'Default', value: 'DEFAULT' },
                { label: 'A - Z', value: 'ALPHA_ASC' },
                { label: 'Z - A', value: 'ALPHA_DESC' },
                { label: 'Price: High - Low', value: 'PRICE_DESC' },
                { label: 'Price: Low - High', value: 'PRICE_ASC' },
                { label: '% Gainers', value: 'PCT_DESC' },
                { label: '% Losers', value: 'PCT_ASC' },
              ].map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSortBy(s.value)}
                  style={{
                    padding: '4px 9px',
                    fontSize: '11px',
                    fontWeight: sortBy === s.value ? '700' : '500',
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: sortBy === s.value ? 'var(--color-blue)' : 'var(--border-color)',
                    background: sortBy === s.value ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.03)',
                    color: sortBy === s.value ? 'var(--color-blue-light, #93c5fd)' : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reset / Apply */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <button
              type="button"
              onClick={() => { setFilterSegment('ALL'); setSortBy('DEFAULT'); }}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 0' }}
            >
              <RotateCcw size={11} /> Reset Filters
            </button>
            <button
              type="button"
              onClick={() => setShowFilterMenu(false)}
              style={{ background: 'var(--color-blue)', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: '600', padding: '4px 12px', cursor: 'pointer' }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Active Filter Indicator */}
      {!isSearchMode && hasActiveFilter && (
        <div style={{ padding: '6px 14px', background: 'rgba(59, 130, 246, 0.08)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
          <span style={{ color: 'var(--color-blue-light)' }}>
            Active: {filterSegment !== 'ALL' ? `Segment: ${filterSegment}` : ''} {filterSegment !== 'ALL' && sortBy !== 'DEFAULT' ? '• ' : ''} {sortBy !== 'DEFAULT' ? `Sort: ${sortBy.replace('_', ' ')}` : ''}
          </span>
          <X 
            size={13} 
            style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} 
            onClick={() => { setFilterSegment('ALL'); setSortBy('DEFAULT'); }}
            title="Clear Filter" 
          />
        </div>
      )}

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
        {!isSearchMode && displayStocks.length === 0 ? (
          <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div style={{ width: '64px', height: '64px', background: 'rgba(255,255,255,0.03)', borderRadius: '50%', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <Search size={28} color="var(--color-blue)" opacity={0.8} />
            </div>
            <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
              {hasActiveFilter ? 'No Matching Stocks' : 'Add Stocks'}
            </div>
            <div style={{ fontSize: '12px', lineHeight: '1.5', color: 'var(--text-muted)' }}>
              {hasActiveFilter ? 'No stocks match your active filter/sort criteria.' : `This watchlist is empty. Search above to add items to ${activeWatchlist.name}.`}
            </div>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => { setFilterSegment('ALL'); setSortBy('DEFAULT'); }}
                style={{ marginTop: '12px', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid var(--color-blue)', color: 'var(--color-blue-light)', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
              >
                Reset Filter
              </button>
            )}
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
            swipedSymbol={swipedSymbol}
            setSwipedSymbol={setSwipedSymbol}
            isMobile={isMobile}
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


