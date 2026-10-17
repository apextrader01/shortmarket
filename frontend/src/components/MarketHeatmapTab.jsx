// frontend/src/components/MarketHeatmapTab.jsx
// 🗺️ Feature 1: Live Market Heatmap & Sector Treemap (NIFTY 50 / F&O / Sectors)
// 100% Client-Side Proportional Squarified Sizing + Live Tick Sync + 1-Click Order Execution

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, Search, Compass, RefreshCw, Zap,
  BarChart2, ShoppingCart, Layers, ExternalLink, Plus, Check,
  SlidersHorizontal, Flame, Award, Shield, Building2, Cpu, Eye
} from 'lucide-react';
import { API, useStore } from '../store';

const UNIVERSES = [
  { id: 'NIFTY50', label: 'Nifty 50', icon: Award },
  { id: 'NIFTYBANK', label: 'Bank Nifty', icon: Building2 },
  { id: 'NIFTYIT', label: 'Nifty IT', icon: Cpu },
  { id: 'NIFTYAUTO', label: 'Nifty Auto', icon: Zap },
  { id: 'FNO', label: 'F&O Leaders (100)', icon: Flame }
];

const SIZING_OPTIONS = [
  { id: 'MCAP', label: 'Market Cap Weight' },
  { id: 'VOLUME', label: 'Day\'s Turnover (₹ Cr)' }
];

// Color scale helper for % change
function getTileColor(change, isLight) {
  const chg = Number(change || 0);
  if (chg >= 3.0) {
    return {
      bg: isLight ? '#15803d' : '#14532d',
      border: isLight ? '#166534' : '#22c55e',
      text: '#ffffff',
      subtext: '#bbf7d0'
    };
  } else if (chg >= 1.2) {
    return {
      bg: isLight ? '#16a34a' : '#166534',
      border: isLight ? '#15803d' : '#16a34a',
      text: '#ffffff',
      subtext: '#dcfce7'
    };
  } else if (chg >= 0.2) {
    return {
      bg: isLight ? '#22c55e' : '#1e3a29',
      border: isLight ? '#16a34a' : '#22c55e',
      text: '#ffffff',
      subtext: '#f0fdf4'
    };
  } else if (chg <= -3.0) {
    return {
      bg: isLight ? '#b91c1c' : '#7f1d1d',
      border: isLight ? '#991b1b' : '#ef4444',
      text: '#ffffff',
      subtext: '#fecaca'
    };
  } else if (chg <= -1.2) {
    return {
      bg: isLight ? '#dc2626' : '#991b1b',
      border: isLight ? '#b91c1c' : '#dc2626',
      text: '#ffffff',
      subtext: '#fee2e2'
    };
  } else if (chg <= -0.2) {
    return {
      bg: isLight ? '#ef4444' : '#3f1d24',
      border: isLight ? '#dc2626' : '#ef4444',
      text: '#ffffff',
      subtext: '#ffe4e6'
    };
  } else {
    // Neutral
    return {
      bg: isLight ? '#e2e8f0' : '#1e293b',
      border: isLight ? '#cbd5e1' : '#334155',
      text: isLight ? '#0f172a' : '#f8fafc',
      subtext: isLight ? '#475569' : '#94a3b8'
    };
  }
}

export default function MarketHeatmapTab({ onOpenPaperTrading, isMobile, t, isLight }) {
  const [universe, setUniverse] = useState('NIFTY50');
  const [sizeBy, setSizeBy] = useState('MCAP');
  const [search, setSearch] = useState('');
  const [heatmapData, setHeatmapData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedStock, setSelectedStock] = useState(null);
  const [addedSymbols, setAddedSymbols] = useState({});

  const openOrderModal = useStore(state => state.openOrderModal);
  const setSelectedSymbol = useStore(state => state.setSelectedSymbol);
  const addToWatchlist = useStore(state => state.addToWatchlist);
  const showToast = useStore(state => state.showToast);

  const fetchHeatmap = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ universe, sizeBy, search });
      const res = await fetch(`${API}/api/primary-markets/heatmap?${params.toString()}`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null);
      if (res && res.success) {
        setHeatmapData(res);
      }
    } catch (err) {
      console.error('Error fetching heatmap data:', err);
    } finally {
      setLoading(false);
    }
  }, [universe, sizeBy, search]);

  useEffect(() => {
    fetchHeatmap();
  }, [fetchHeatmap]);

  const handlePaperTrade = (stock, side = 'BUY') => {
    if (typeof openOrderModal === 'function') {
      openOrderModal({
        symbol: stock.symbol,
        variety: 'REGULAR',
        isAmo: false,
        initialQty: stock.lotsize || 1,
        initialSide: side,
        initialOrderType: 'MARKET'
      });
    }
    if (typeof onOpenPaperTrading === 'function') {
      onOpenPaperTrading();
    }
  };

  const handleOpenChart = (symbol) => {
    if (typeof setSelectedSymbol === 'function') {
      setSelectedSymbol(symbol);
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
      showToast(`${stock.symbol} added to Watchlist!`, 'success', 'Watchlist Updated');
    }
    setTimeout(() => {
      setAddedSymbols(prev => {
        const next = { ...prev };
        delete next[stock.symbol];
        return next;
      });
    }, 2500);
  };

  const stats = heatmapData?.stats || {};
  const sectors = heatmapData?.sectors || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 🧭 Top Filter & Control Toolbar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        background: t.cardBg,
        border: `1px solid ${t.cardBorder}`,
        borderRadius: '14px',
        padding: isMobile ? '12px' : '16px',
        boxShadow: t.cardShadow
      }}>
        {/* Universe Selector Pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {UNIVERSES.map(u => {
            const Icon = u.icon;
            const active = universe === u.id;
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => setUniverse(u.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: isMobile ? '6px 10px' : '7px 14px',
                  borderRadius: '10px',
                  border: active ? '1px solid #3b82f6' : `1px solid ${t.pillInactiveBorder}`,
                  background: active ? (isLight ? '#dbeafe' : 'rgba(59,130,246,0.18)') : t.pillInactiveBg,
                  color: active ? (isLight ? '#1d4ed8' : '#60a5fa') : t.pillInactiveText,
                  fontSize: isMobile ? '11px' : '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={13} /> {u.label}
              </button>
            );
          })}
        </div>

        {/* Sizing & Search Controls */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
          {/* Sizing Mode Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: t.textDim, fontWeight: '600', whiteSpace: 'nowrap' }}>Size By:</span>
            <select
              value={sizeBy}
              onChange={e => setSizeBy(e.target.value)}
              style={{
                background: t.inputBg,
                border: `1px solid ${t.inputBorder}`,
                color: t.text,
                fontSize: '11.5px',
                fontWeight: '600',
                padding: '6px 10px',
                borderRadius: '8px',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              {SIZING_OPTIONS.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Quick Search Input */}
          <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            flex: isMobile ? '1' : 'none',
            minWidth: isMobile ? '100%' : '200px'
          }}>
            <Search size={14} color={t.textDim} style={{ position: 'absolute', left: '10px' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter stock (e.g. INFY, Tata)..."
              style={{
                width: '100%',
                padding: '7px 10px 7px 30px',
                borderRadius: '8px',
                background: t.inputBg,
                border: `1px solid ${t.inputBorder}`,
                color: t.text,
                fontSize: '12px',
                outline: 'none'
              }}
            />
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchHeatmap}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '8px',
              border: `1px solid ${t.btnBorder}`,
              background: t.btnBg,
              color: t.btnText,
              fontSize: '11.5px',
              fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            {!isMobile && 'Refresh'}
          </button>
        </div>
      </div>

      {/* 📊 KPI Summary & Market Breadth Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)',
        gap: '10px'
      }}>
        <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '12px', padding: '10px 14px', boxShadow: t.cardShadow }}>
          <div style={{ fontSize: '10.5px', color: t.textDim, fontWeight: '700', textTransform: 'uppercase' }}>Market Breadth (A/D)</div>
          <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '800', color: isLight ? '#15803d' : '#22c55e', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>{stats.advances || 0} Advances</span>
            <span style={{ fontSize: '12px', color: isLight ? '#dc2626' : '#ef4444' }}>/ {stats.declines || 0} Declines</span>
          </div>
          <div style={{ fontSize: '10.5px', color: t.textMuted, marginTop: '2px' }}>A/D Ratio: <strong>{stats.adRatio || 1.0}x</strong></div>
        </div>

        <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '12px', padding: '10px 14px', boxShadow: t.cardShadow }}>
          <div style={{ fontSize: '10.5px', color: t.textDim, fontWeight: '700', textTransform: 'uppercase' }}>Avg Market Change</div>
          <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '800', color: (stats.avgMarketChange || 0) >= 0 ? (isLight ? '#15803d' : '#22c55e') : (isLight ? '#dc2626' : '#ef4444'), marginTop: '2px' }}>
            {(stats.avgMarketChange || 0) >= 0 ? '+' : ''}{(stats.avgMarketChange || 0).toFixed(2)}%
          </div>
          <div style={{ fontSize: '10.5px', color: t.textMuted, marginTop: '2px' }}>Universe Average Pulse</div>
        </div>

        <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '12px', padding: '10px 14px', boxShadow: t.cardShadow }}>
          <div style={{ fontSize: '10.5px', color: t.textDim, fontWeight: '700', textTransform: 'uppercase' }}>Top Sector Today</div>
          <div style={{ fontSize: isMobile ? '14px' : '15px', fontWeight: '800', color: isLight ? '#1d4ed8' : '#60a5fa', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {stats.bestSector?.name || 'Loading...'}
          </div>
          <div style={{ fontSize: '11px', color: isLight ? '#15803d' : '#22c55e', fontWeight: '700', marginTop: '2px' }}>
            +{Number(stats.bestSector?.avgChange || 0).toFixed(2)}%
          </div>
        </div>

        <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '12px', padding: '10px 14px', boxShadow: t.cardShadow }}>
          <div style={{ fontSize: '10.5px', color: t.textDim, fontWeight: '700', textTransform: 'uppercase' }}>Top Gainer</div>
          <div style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: '800', color: isLight ? '#15803d' : '#22c55e', marginTop: '2px' }}>
            {stats.topGainer?.symbol || '—'}
          </div>
          <div style={{ fontSize: '11px', color: isLight ? '#15803d' : '#4ade80', fontWeight: '700' }}>
            +{Number(stats.topGainer?.change || 0).toFixed(2)}% (₹{stats.topGainer?.ltp || 0})
          </div>
        </div>

        <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '12px', padding: '10px 14px', boxShadow: t.cardShadow, gridColumn: isMobile ? 'span 2' : 'auto' }}>
          <div style={{ fontSize: '10.5px', color: t.textDim, fontWeight: '700', textTransform: 'uppercase' }}>Top Loser / Drag</div>
          <div style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: '800', color: isLight ? '#dc2626' : '#ef4444', marginTop: '2px' }}>
            {stats.topLoser?.symbol || '—'}
          </div>
          <div style={{ fontSize: '11px', color: isLight ? '#dc2626' : '#f87171', fontWeight: '700' }}>
            {Number(stats.topLoser?.change || 0).toFixed(2)}% (₹{stats.topLoser?.ltp || 0})
          </div>
        </div>
      </div>

      {/* 🎨 Heatmap Color Gradient Legend */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        background: t.cardBg,
        border: `1px solid ${t.cardBorder}`,
        borderRadius: '10px',
        padding: '8px 14px',
        fontSize: '11px',
        flexWrap: 'wrap'
      }}>
        <span style={{ fontWeight: '700', color: t.textMuted, marginRight: '6px' }}>Change Scale:</span>
        <span style={{ padding: '2px 8px', borderRadius: '4px', background: isLight ? '#b91c1c' : '#7f1d1d', color: '#fff', fontWeight: '700' }}>&le; -3%</span>
        <span style={{ padding: '2px 8px', borderRadius: '4px', background: isLight ? '#dc2626' : '#991b1b', color: '#fff', fontWeight: '700' }}>-1.2%</span>
        <span style={{ padding: '2px 8px', borderRadius: '4px', background: isLight ? '#ef4444' : '#3f1d24', color: '#fff', fontWeight: '700' }}>-0.2%</span>
        <span style={{ padding: '2px 8px', borderRadius: '4px', background: isLight ? '#e2e8f0' : '#1e293b', color: isLight ? '#0f172a' : '#fff', fontWeight: '700' }}>0%</span>
        <span style={{ padding: '2px 8px', borderRadius: '4px', background: isLight ? '#22c55e' : '#1e3a29', color: '#fff', fontWeight: '700' }}>+0.2%</span>
        <span style={{ padding: '2px 8px', borderRadius: '4px', background: isLight ? '#16a34a' : '#166534', color: '#fff', fontWeight: '700' }}>+1.2%</span>
        <span style={{ padding: '2px 8px', borderRadius: '4px', background: isLight ? '#15803d' : '#14532d', color: '#fff', fontWeight: '700' }}>&ge; +3%</span>
      </div>

      {/* 🗺️ SQUARIFIED SECTOR TREEMAP CONTAINER */}
      {loading ? (
        <div style={{
          minHeight: '400px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          background: t.cardBg,
          borderRadius: '14px',
          border: `1px solid ${t.cardBorder}`
        }}>
          <div style={{ width: '36px', height: '36px', border: '3px solid rgba(59,130,246,0.2)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: '13px', color: t.textDim, fontWeight: '600' }}>Rendering live sector treemap...</span>
        </div>
      ) : sectors.length === 0 ? (
        <div style={{
          minHeight: '260px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          background: t.cardBg,
          borderRadius: '14px',
          border: `1px solid ${t.cardBorder}`,
          color: t.textDim
        }}>
          <Compass size={32} />
          <span style={{ fontSize: '14px', fontWeight: '600' }}>No matching stocks in this filter</span>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '14px'
        }}>
          {sectors.map(sec => {
            const isSecPositive = (sec.avgChange || 0) >= 0;
            return (
              <div
                key={sec.name}
                style={{
                  background: t.cardBg,
                  border: `1px solid ${t.cardBorder}`,
                  borderRadius: '14px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  boxShadow: t.cardShadow
                }}
              >
                {/* Sector Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: '8px',
                  borderBottom: `1px solid ${t.borderSubtle}`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: t.text }}>{sec.name}</span>
                    <span style={{
                      fontSize: '10.5px',
                      fontWeight: '700',
                      padding: '1px 6px',
                      borderRadius: '6px',
                      background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)',
                      color: t.textDim
                    }}>
                      {sec.stocks.length} Stocks
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', fontWeight: '700' }}>
                    <span style={{ color: isSecPositive ? (isLight ? '#15803d' : '#22c55e') : (isLight ? '#dc2626' : '#ef4444') }}>
                      {isSecPositive ? '+' : ''}{(sec.avgChange || 0).toFixed(2)}%
                    </span>
                    <span style={{ fontSize: '10px', color: t.textDim }}>₹{sec.totalTurnoverCr || 0}Cr</span>
                  </div>
                </div>

                {/* Nested Stock Tiles Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(95px, 1fr))',
                  gap: '6px'
                }}>
                  {sec.stocks.map(stock => {
                    const themeColors = getTileColor(stock.change, isLight);
                    const isSelected = selectedStock?.symbol === stock.symbol;
                    const isUp = stock.change >= 0;

                    return (
                      <div
                        key={stock.symbol}
                        onClick={() => setSelectedStock(stock)}
                        style={{
                          background: themeColors.bg,
                          border: isSelected ? '2px solid #38bdf8' : `1px solid ${themeColors.border}`,
                          borderRadius: '8px',
                          padding: '8px 6px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          minHeight: '68px',
                          cursor: 'pointer',
                          transition: 'transform 0.12s ease, box-shadow 0.12s ease',
                          boxShadow: isSelected ? '0 0 12px rgba(56,189,248,0.4)' : 'none',
                          transform: isSelected ? 'scale(1.02)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                          <span style={{ fontWeight: '800', fontSize: '12px', color: themeColors.text, letterSpacing: '0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {stock.symbol}
                          </span>
                        </div>

                        <div>
                          <div style={{ fontSize: '12px', fontWeight: '800', color: themeColors.text }}>
                            {isUp ? '+' : ''}{(stock.change || 0).toFixed(2)}%
                          </div>
                          <div style={{ fontSize: '10px', fontWeight: '600', color: themeColors.subtext }}>
                            ₹{Number(stock.ltp || 0).toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 🚀 Interactive Stock Action Drawer (When a Tile is Clicked) */}
      {selectedStock && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          background: t.cardBg,
          border: `1.5px solid ${isLight ? '#3b82f6' : '#60a5fa'}`,
          borderRadius: '16px',
          padding: '14px 20px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '18px',
          maxWidth: '92vw',
          flexWrap: 'wrap'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px', fontWeight: '900', color: t.text }}>{selectedStock.symbol}</span>
              <span style={{ fontSize: '11px', fontWeight: '700', padding: '1px 6px', borderRadius: '4px', background: isLight ? '#dbeafe' : 'rgba(59,130,246,0.15)', color: isLight ? '#1d4ed8' : '#60a5fa' }}>
                {selectedStock.sector}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: t.textDim, marginTop: '2px' }}>
              LTP: <strong>₹{selectedStock.ltp}</strong> &bull; Change: <strong style={{ color: selectedStock.change >= 0 ? (isLight ? '#15803d' : '#22c55e') : (isLight ? '#dc2626' : '#ef4444') }}>{selectedStock.change >= 0 ? '+' : ''}{selectedStock.change}%</strong>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => handlePaperTrade(selectedStock, 'BUY')}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                background: '#16a34a', color: '#fff', border: 'none',
                padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer'
              }}
            >
              <ShoppingCart size={13} /> Buy
            </button>

            <button
              type="button"
              onClick={() => handlePaperTrade(selectedStock, 'SELL')}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                background: '#dc2626', color: '#fff', border: 'none',
                padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer'
              }}
            >
              <ShoppingCart size={13} /> Sell
            </button>

            <button
              type="button"
              onClick={() => handleOpenChart(selectedStock.symbol)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                background: isLight ? '#dbeafe' : 'rgba(59,130,246,0.18)',
                border: '1px solid #3b82f6', color: isLight ? '#1d4ed8' : '#60a5fa',
                padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer'
              }}
            >
              <BarChart2 size={13} /> Chart
            </button>

            <button
              type="button"
              onClick={() => handleAddToWatchlist(selectedStock)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                background: addedSymbols[selectedStock.symbol] ? '#10b981' : t.pillInactiveBg,
                border: `1px solid ${t.pillInactiveBorder}`, color: addedSymbols[selectedStock.symbol] ? '#fff' : t.text,
                padding: '7px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer'
              }}
            >
              {addedSymbols[selectedStock.symbol] ? <Check size={13} /> : <Plus size={13} />}
            </button>

            <button
              type="button"
              onClick={() => setSelectedStock(null)}
              style={{
                background: 'transparent', border: 'none', color: t.textDim,
                fontSize: '18px', fontWeight: '800', cursor: 'pointer', padding: '0 6px'
              }}
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
