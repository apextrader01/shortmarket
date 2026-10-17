// frontend/src/components/MarketScreenerTab.jsx
// ⚡ Option A: Live Technical & Multi-Factor Market Screener (Breakouts, 52W High/Low, Volume Shockers, RSI)
// 100% Client-side Filtered + 1-Click Paper Trade Order Placement (0 Server RAM / 0 CPU Load)

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, Search, Filter, Sparkles, BarChart2,
  Zap, Flame, ArrowUpRight, ArrowDownRight, Check, Plus, ShoppingCart,
  ExternalLink, RefreshCw, Compass, SlidersHorizontal, Layers, Award
} from 'lucide-react';
import { API, useStore } from '../store';

const PRESETS = [
  { id: 'ALL', label: 'All Stocks', icon: Compass },
  { id: '52W_HIGH', label: '🔥 52W High Breakouts', icon: Flame, color: '#10b981' },
  { id: 'VOLUME_SHOCKER', label: '⚡ Volume Shockers (2.2x+)', icon: Zap, color: '#f59e0b' },
  { id: 'TOP_GAINERS', label: '🚀 Top Gainers (>2.5%)', icon: TrendingUp, color: '#10b981' },
  { id: 'TOP_LOSERS', label: '🔻 Top Losers (<-2%)', icon: TrendingDown, color: '#ef4444' },
  { id: 'RSI_OVERSOLD', label: '🟢 RSI Oversold (<32)', icon: Sparkles, color: '#38bdf8' },
  { id: 'RSI_OVERBOUGHT', label: '🔴 RSI Overbought (>68)', icon: Sparkles, color: '#ec4899' },
  { id: 'GAP_UP', label: '📈 Gap Up Openers', icon: ArrowUpRight, color: '#10b981' },
  { id: 'HIGH_DELIVERY', label: '📦 High Delivery (>65%)', icon: Layers, color: '#8b5cf6' }
];

const SEGMENTS = [
  { id: 'ALL', label: 'All Segments' },
  { id: 'NIFTY50', label: 'Nifty 50' },
  { id: 'FNO', label: 'F&O Stocks' },
  { id: 'MIDCAP', label: 'Midcap' },
  { id: 'SMALLCAP', label: 'Smallcap' }
];

const PRICE_RANGES = [
  { id: 'ALL', label: 'All Prices' },
  { id: 'PENNY', label: 'Under ₹50' },
  { id: 'MID', label: '₹50 - ₹500' },
  { id: 'LARGE', label: 'Above ₹500' }
];

export default function MarketScreenerTab({ onOpenPaperTrading, isMobile, t, isLight }) {
  const [stocks, setStocks] = useState([]);
  const [stats, setStats] = useState({
    highs52wCount: 0,
    lows52wCount: 0,
    volumeShockersCount: 0,
    gainersCount: 0,
    losersCount: 0,
    oversoldCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState('ALL');
  const [segment, setSegment] = useState('ALL');
  const [priceRange, setPriceRange] = useState('ALL');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('SURGE_DESC');
  const [addedSymbols, setAddedSymbols] = useState({});
  const [screenerViewMode, setScreenerViewMode] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768 ? 'CARDS' : 'TABLE');

  const openOrderModal = useStore(state => state.openOrderModal);
  const setSelectedSymbol = useStore(state => state.setSelectedSymbol);
  const addToWatchlist = useStore(state => state.addToWatchlist);
  const showToast = useStore(state => state.showToast);

  const fetchScreenerData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        preset,
        segment,
        priceRange,
        search,
        sortBy,
        limit: '100'
      });
      const res = await fetch(`${API}/api/primary-markets/screener?${params.toString()}`).then(r => r.ok ? r.json() : null).catch(() => null);
      if (res && res.success && Array.isArray(res.stocks)) {
        setStocks(res.stocks);
        if (res.stats) setStats(res.stats);
      }
    } catch (err) {
      console.error('Error fetching screener data:', err);
    } finally {
      setLoading(false);
    }
  }, [preset, segment, priceRange, search, sortBy]);

  useEffect(() => {
    fetchScreenerData();
  }, [fetchScreenerData]);

  // 1-Click Action Handlers
  const handlePaperTrade = (stock) => {
    if (typeof openOrderModal === 'function') {
      openOrderModal({
        symbol: stock.symbol,
        variety: 'REGULAR',
        isAmo: false,
        initialQty: stock.lotsize || 1,
        initialSide: stock.change >= 0 ? 'BUY' : 'SELL',
        initialOrderType: 'MARKET'
      });
    }
    if (typeof onOpenPaperTrading === 'function') {
      onOpenPaperTrading();
    }
  };

  const handleAddToWatchlist = (stock) => {
    if (typeof addToWatchlist === 'function') {
      addToWatchlist(stock.symbol);
    }
    setAddedSymbols(prev => ({ ...prev, [stock.symbol]: true }));
    if (typeof showToast === 'function') {
      showToast(`${stock.symbol} added to active Watchlist!`, 'success', 'Watchlist Updated');
    }
    setTimeout(() => {
      setAddedSymbols(prev => {
        const next = { ...prev };
        delete next[stock.symbol];
        return next;
      });
    }, 2500);
  };

  const handleOpenChart = (stock) => {
    if (typeof setSelectedSymbol === 'function') {
      setSelectedSymbol(stock.symbol);
    }
    if (typeof onOpenPaperTrading === 'function') {
      onOpenPaperTrading();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* KPI Highlights Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(180px, 1fr))', gap: isMobile ? '8px' : '12px' }}>
        <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '12px', padding: '12px 14px', boxShadow: t.cardShadow }}>
          <div style={{ fontSize: '11px', color: t.textMuted, fontWeight: '600', textTransform: 'uppercase' }}>52W Breakouts</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#10b981', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Flame size={18} /> {stats.highs52wCount || 0}
          </div>
          <div style={{ fontSize: '11px', color: t.textDim, marginTop: '2px' }}>Within 2.5% of 52W High</div>
        </div>

        <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '12px', padding: '12px 14px', boxShadow: t.cardShadow }}>
          <div style={{ fontSize: '11px', color: t.textMuted, fontWeight: '600', textTransform: 'uppercase' }}>Volume Shockers</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#f59e0b', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={18} /> {stats.volumeShockersCount || 0}
          </div>
          <div style={{ fontSize: '11px', color: t.textDim, marginTop: '2px' }}>Traded Volume &gt; 2.2x Avg</div>
        </div>

        <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '12px', padding: '12px 14px', boxShadow: t.cardShadow }}>
          <div style={{ fontSize: '11px', color: t.textMuted, fontWeight: '600', textTransform: 'uppercase' }}>Momentum Gainers</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#10b981', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <TrendingUp size={18} /> {stats.gainersCount || 0}
          </div>
          <div style={{ fontSize: '11px', color: t.textDim, marginTop: '2px' }}>Daily Price Gain &gt; 2.5%</div>
        </div>

        <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '12px', padding: '12px 14px', boxShadow: t.cardShadow }}>
          <div style={{ fontSize: '11px', color: t.textMuted, fontWeight: '600', textTransform: 'uppercase' }}>RSI Oversold (&lt;32)</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#38bdf8', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={18} /> {stats.oversoldCount || 0}
          </div>
          <div style={{ fontSize: '11px', color: t.textDim, marginTop: '2px' }}>Mean Reversion Setup</div>
        </div>
      </div>

      {/* Preset Strategy Filters & View Mode Switcher */}
      <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '12px', padding: isMobile ? '10px 12px' : '14px 16px', boxShadow: t.cardShadow, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: t.text, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <SlidersHorizontal size={15} color="#3b82f6" />
            <span>Preset Screener Strategies</span>
            <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px', background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>
              {stocks.length} Stocks Matched
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* View Mode Toggle (Cards vs Table) */}
            <div style={{ display: 'inline-flex', padding: '2px', borderRadius: '8px', background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)', border: `1px solid ${t.cardBorder}` }}>
              <button
                type="button"
                onClick={() => setScreenerViewMode('CARDS')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  background: screenerViewMode === 'CARDS' ? (isLight ? '#ffffff' : 'rgba(59,130,246,0.3)') : 'transparent',
                  color: screenerViewMode === 'CARDS' ? (isLight ? '#1d4ed8' : '#60a5fa') : t.textMuted
                }}
              >
                📊 Cards
              </button>
              <button
                type="button"
                onClick={() => setScreenerViewMode('TABLE')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  background: screenerViewMode === 'TABLE' ? (isLight ? '#ffffff' : 'rgba(59,130,246,0.3)') : 'transparent',
                  color: screenerViewMode === 'TABLE' ? (isLight ? '#1d4ed8' : '#60a5fa') : t.textMuted
                }}
              >
                📋 Table
              </button>
            </div>

            <button
              type="button"
              onClick={fetchScreenerData}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '8px', background: t.btnBg, border: `1px solid ${t.btnBorder}`, color: t.btnText, fontSize: '11.5px', fontWeight: '600', cursor: 'pointer' }}
            >
              <RefreshCw size={12} className={loading ? 'spin' : ''} /> {!isMobile && 'Refresh'}
            </button>
          </div>
        </div>

        {/* Preset Pills (Horizontally scrollable with smooth finger touch) */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch', flexWrap: 'nowrap', paddingBottom: '4px' }}>
          {PRESETS.map(p => {
            const isSelected = preset === p.id;
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px', padding: isMobile ? '6px 10px' : '7px 12px', borderRadius: '20px',
                  background: isSelected ? (isLight ? '#eff6ff' : 'rgba(59,130,246,0.2)') : t.pillInactiveBg,
                  border: isSelected ? '1px solid #3b82f6' : `1px solid ${t.pillInactiveBorder}`,
                  color: isSelected ? (isLight ? '#1d4ed8' : '#60a5fa') : t.pillInactiveText,
                  fontSize: isMobile ? '11.5px' : '12px', fontWeight: isSelected ? '700' : '600', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s ease'
                }}
              >
                <Icon size={13} color={p.color || '#3b82f6'} />
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>

        {/* Secondary Filter Row: Responsive Grid on Mobile */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', alignItems: 'center', paddingTop: '6px', borderTop: `1px solid ${t.borderSubtle}` }}>
          {/* Search Box */}
          <div style={{ position: 'relative', gridColumn: isMobile ? '1 / -1' : 'auto', minWidth: '160px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: t.textDim }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter symbol, company, sector..."
              style={{
                width: '100%', boxSizing: 'border-box', padding: '7px 10px 7px 32px', borderRadius: '8px',
                background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text,
                fontSize: '12px', outline: 'none'
              }}
            />
          </div>

          {/* Segment Selector */}
          <select
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '8px', background: t.inputBg,
              border: `1px solid ${t.inputBorder}`, color: t.text, fontSize: '12px', outline: 'none', cursor: 'pointer'
            }}
          >
            {SEGMENTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>

          {/* Price Range Selector */}
          <select
            value={priceRange}
            onChange={(e) => setPriceRange(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '8px', background: t.inputBg,
              border: `1px solid ${t.inputBorder}`, color: t.text, fontSize: '12px', outline: 'none', cursor: 'pointer'
            }}
          >
            {PRICE_RANGES.map(pr => <option key={pr.id} value={pr.id}>{pr.label}</option>)}
          </select>

          {/* Sort Selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              gridColumn: isMobile ? '1 / -1' : 'auto',
              width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '8px', background: t.inputBg,
              border: `1px solid ${t.inputBorder}`, color: t.text, fontSize: '12px', outline: 'none', cursor: 'pointer'
            }}
          >
            <option value="SURGE_DESC">Sort: Volume Surge (High to Low)</option>
            <option value="CHANGE_DESC">Sort: % Gainers (High to Low)</option>
            <option value="CHANGE_ASC">Sort: % Losers (Low to High)</option>
            <option value="DELIVERY_DESC">Sort: Delivery % (High to Low)</option>
            <option value="RSI_ASC">Sort: RSI (Most Oversold)</option>
            <option value="RSI_DESC">Sort: RSI (Most Overbought)</option>
          </select>
        </div>
      </div>

      {/* Screener Results: Cards vs Table */}
      {screenerViewMode === 'CARDS' ? (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(330px, 1fr))', gap: '10px' }}>
          {loading ? (
            <div style={{ gridColumn: '1 / -1', padding: '40px 14px', textAlign: 'center', color: t.textDim, background: t.cardBg, borderRadius: '12px', border: `1px solid ${t.cardBorder}` }}>
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px' }} />
              <div>Scanning live market technicals &amp; volume patterns...</div>
            </div>
          ) : stocks.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: '40px 14px', textAlign: 'center', color: t.textDim, background: t.cardBg, borderRadius: '12px', border: `1px solid ${t.cardBorder}` }}>
              <Compass size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <div style={{ fontSize: '14px', fontWeight: '700', color: t.text }}>No stocks matching the selected criteria</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>Try switching presets, selecting 'All Segments', or clearing the search box.</div>
            </div>
          ) : (
            stocks.map(stock => {
              const isPositive = stock.change >= 0;
              const isAdded = Boolean(addedSymbols[stock.symbol]);

              return (
                <div
                  key={stock.symbol}
                  style={{
                    background: t.cardBg,
                    border: `1px solid ${t.cardBorder}`,
                    borderRadius: '12px',
                    padding: '12px 14px',
                    boxShadow: t.cardShadow,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  {/* Top row: Symbol, Name, Badges, LTP & Change */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: '800', color: t.text, fontSize: '14px' }}>{stock.symbol}</span>
                        {stock.isFnO && (
                          <span style={{ fontSize: '9px', fontWeight: '800', padding: '1px 5px', borderRadius: '4px', background: 'rgba(59,130,246,0.12)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)' }}>
                            F&amp;O
                          </span>
                        )}
                        {stock.is52wHigh && (
                          <span style={{ fontSize: '9px', fontWeight: '800', padding: '1px 5px', borderRadius: '4px', background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                            52W HIGH
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: t.textMuted, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {stock.name} • <span style={{ color: t.textDim }}>{stock.sector}</span>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: '800', color: t.text, fontSize: '14px' }}>
                        ₹{Number(stock.ltp).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontWeight: '700', fontSize: '11.5px', color: isPositive ? '#10b981' : '#ef4444' }}>
                        {isPositive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                        <span>{isPositive ? '+' : ''}{Number(stock.change).toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Metrics Pills Grid (Volume surge, Delivery %, 52W Proximity, RSI) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', background: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: '8px', border: `1px solid ${t.borderSubtle}` }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '9.5px', color: t.textMuted, textTransform: 'uppercase' }}>Surge</div>
                      <div style={{ fontSize: '11.5px', fontWeight: '800', color: stock.surgeMult >= 2.0 ? '#f59e0b' : t.text, marginTop: '1px' }}>
                        {Number(stock.surgeMult).toFixed(1)}x
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '9.5px', color: t.textMuted, textTransform: 'uppercase' }}>Delivery</div>
                      <div style={{ fontSize: '11.5px', fontWeight: '800', color: stock.delivPct >= 65 ? '#10b981' : t.text, marginTop: '1px' }}>
                        {Number(stock.delivPct).toFixed(1)}%
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '9.5px', color: t.textMuted, textTransform: 'uppercase' }}>52W Range</div>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: stock.proximity52wHigh <= 3 ? '#10b981' : t.textMuted, marginTop: '1px' }}>
                        {stock.proximity52wHigh <= 3 ? `${stock.proximity52wHigh}%` : `₹${stock.high52w}`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '9.5px', color: t.textMuted, textTransform: 'uppercase' }}>RSI (14)</div>
                      <div style={{ fontSize: '11.5px', fontWeight: '800', color: stock.rsi <= 32 ? '#38bdf8' : (stock.rsi >= 68 ? '#ec4899' : t.text), marginTop: '1px' }}>
                        {Number(stock.rsi).toFixed(0)}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons (Watchlist, Chart, Trade) */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                    <button
                      type="button"
                      onClick={() => handleAddToWatchlist(stock)}
                      style={{
                        flex: 1, padding: '7px 10px', borderRadius: '6px',
                        background: isAdded ? 'rgba(16,185,129,0.15)' : t.btnBg,
                        border: isAdded ? '1px solid #10b981' : `1px solid ${t.btnBorder}`,
                        color: isAdded ? '#10b981' : t.btnText,
                        fontSize: '11.5px', fontWeight: '600', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                        minHeight: '36px'
                      }}
                    >
                      {isAdded ? <Check size={13} /> : <Plus size={13} />} Watchlist
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenChart(stock)}
                      style={{
                        padding: '7px 12px', borderRadius: '6px',
                        background: t.btnBg, border: `1px solid ${t.btnBorder}`, color: t.btnText,
                        fontSize: '11.5px', fontWeight: '600', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        minHeight: '36px'
                      }}
                      title="View Live Chart"
                    >
                      <BarChart2 size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePaperTrade(stock)}
                      style={{
                        flex: 1.4, padding: '7px 12px', borderRadius: '6px',
                        background: isPositive ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                        border: 'none', color: '#ffffff', fontSize: '12px', fontWeight: '700',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                        minHeight: '36px'
                      }}
                    >
                      <ShoppingCart size={13} /> Trade Live
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Screener Results Table */
        <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '12px', overflow: 'hidden', boxShadow: t.cardShadow }}>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ background: t.tableHeaderBg, borderBottom: `1px solid ${t.tableHeaderBorder}`, color: t.textMuted, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                <th style={{ padding: '10px 14px' }}>Stock &amp; Sector</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>LTP (₹)</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Change %</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Volume Surge</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Delivery %</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>52W Proximity</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>RSI(14)</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>1-Click Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px 14px', textAlign: 'center', color: t.textDim }}>
                    <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px' }} />
                    <div>Scanning live market technicals &amp; volume patterns...</div>
                  </td>
                </tr>
              ) : stocks.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px 14px', textAlign: 'center', color: t.textDim }}>
                    <Compass size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                    <div style={{ fontSize: '14px', fontWeight: '700', color: t.text }}>No stocks matching the selected criteria</div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>Try switching presets, selecting 'All Segments', or clearing the search box.</div>
                  </td>
                </tr>
              ) : (
                stocks.map((stock) => {
                  const isPositive = stock.change >= 0;
                  const isAdded = Boolean(addedSymbols[stock.symbol]);

                  return (
                    <tr
                      key={stock.symbol}
                      style={{
                        borderBottom: `1px solid ${t.tableRowBorder}`,
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = t.tableRowHover}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Stock & Sector */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: '800', color: t.text, fontSize: '13px' }}>{stock.symbol}</span>
                          {stock.isFnO && (
                            <span style={{ fontSize: '9px', fontWeight: '800', padding: '1px 5px', borderRadius: '4px', background: 'rgba(59,130,246,0.12)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)' }}>
                              F&amp;O
                            </span>
                          )}
                          {stock.is52wHigh && (
                            <span style={{ fontSize: '9px', fontWeight: '800', padding: '1px 5px', borderRadius: '4px', background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                              52W HIGH
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: t.textMuted, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{stock.name}</span>
                          <span>•</span>
                          <span style={{ color: t.textDim }}>{stock.sector}</span>
                        </div>
                      </td>

                      {/* LTP */}
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', color: t.text }}>
                        ₹{Number(stock.ltp).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Change % */}
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: '700', color: isPositive ? '#10b981' : '#ef4444' }}>
                          {isPositive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                          <span>{isPositive ? '+' : ''}{Number(stock.change).toFixed(2)}%</span>
                        </div>
                      </td>

                      {/* Volume Surge */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 8px', borderRadius: '10px',
                          background: stock.surgeMult >= 2.0 ? 'rgba(245,158,11,0.14)' : 'rgba(255,255,255,0.04)',
                          color: stock.surgeMult >= 2.0 ? '#f59e0b' : t.textMuted,
                          fontWeight: '700', fontSize: '11.5px',
                          border: stock.surgeMult >= 2.0 ? '1px solid rgba(245,158,11,0.35)' : '1px solid transparent'
                        }}>
                          {stock.surgeMult >= 2.0 && <Flame size={12} />}
                          {Number(stock.surgeMult).toFixed(1)}x
                        </span>
                      </td>

                      {/* Delivery % */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                          <span style={{ fontWeight: '700', color: stock.delivPct >= 65 ? '#10b981' : t.text }}>
                            {Number(stock.delivPct).toFixed(1)}%
                          </span>
                          <div style={{ width: '48px', height: '4px', background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, stock.delivPct)}%`, height: '100%', background: stock.delivPct >= 65 ? '#10b981' : '#3b82f6' }} />
                          </div>
                        </div>
                      </td>

                      {/* 52W Proximity */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: t.textDim }}>
                          <span style={{ color: stock.proximity52wHigh <= 3 ? '#10b981' : t.textMuted, fontWeight: '600' }}>
                            {stock.proximity52wHigh <= 3 ? `Near High (${stock.proximity52wHigh}%)` : `₹${stock.high52w}`}
                          </span>
                        </div>
                      </td>

                      {/* RSI */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '800',
                          background: stock.rsi <= 32 ? 'rgba(56,189,248,0.15)' : (stock.rsi >= 68 ? 'rgba(236,72,153,0.15)' : 'rgba(255,255,255,0.04)'),
                          color: stock.rsi <= 32 ? '#38bdf8' : (stock.rsi >= 68 ? '#ec4899' : t.textMuted),
                          border: stock.rsi <= 32 ? '1px solid rgba(56,189,248,0.3)' : (stock.rsi >= 68 ? '1px solid rgba(236,72,153,0.3)' : '1px solid transparent')
                        }}>
                          {Number(stock.rsi).toFixed(1)}
                        </span>
                      </td>

                      {/* 1-Click Action Buttons */}
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {/* Watchlist (+) */}
                          <button
                            type="button"
                            onClick={() => handleAddToWatchlist(stock)}
                            title="Add to Watchlist"
                            style={{
                              padding: '5px 8px', borderRadius: '6px',
                              background: isAdded ? 'rgba(16,185,129,0.15)' : t.btnBg,
                              border: isAdded ? '1px solid #10b981' : `1px solid ${t.btnBorder}`,
                              color: isAdded ? '#10b981' : t.btnText,
                              fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px'
                            }}
                          >
                            {isAdded ? <Check size={12} /> : <Plus size={12} />}
                          </button>

                          {/* Chart Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenChart(stock)}
                            title="View Chart in Terminal"
                            style={{
                              padding: '5px 8px', borderRadius: '6px',
                              background: t.btnBg, border: `1px solid ${t.btnBorder}`, color: t.btnText,
                              fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center'
                            }}
                          >
                            <BarChart2 size={12} />
                          </button>

                          {/* 1-Click Trade in Paper Trade */}
                          <button
                            type="button"
                            onClick={() => handlePaperTrade(stock)}
                            style={{
                              padding: '5px 12px', borderRadius: '6px',
                              background: isPositive ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                              border: 'none', color: '#ffffff', fontSize: '11.5px', fontWeight: '700',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                            }}
                          >
                            <ShoppingCart size={12} /> Trade
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

    </div>
  );
}
