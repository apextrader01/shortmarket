// frontend/src/components/MarketNewsSentimentTab.jsx
// 🤖 Feature 2: Live AI Financial News & Sentiment Feed (Powered by Gemini AI & FinLex Engine)
// Real-Time RSS Ingestion + AI Sentiment Classifications + Market Mood Index + 1-Click Trading

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, Search, Sparkles, RefreshCw,
  ExternalLink, ShoppingCart, BarChart2, Plus, Check, Filter,
  Shield, AlertTriangle, Clock, Layers, Flame, Compass, Newspaper
} from 'lucide-react';
import { API, useStore } from '../store';

const SENTIMENT_FILTERS = [
  { id: 'ALL', label: 'All News' },
  { id: 'BULLISH', label: '🐂 Bullish Only', color: '#16a34a' },
  { id: 'BEARISH', label: '🐻 Bearish Only', color: '#dc2626' },
  { id: 'NEUTRAL', label: '⚖️ Neutral', color: '#64748b' }
];

export default function MarketNewsSentimentTab({ onOpenPaperTrading, isMobile, t, isLight }) {
  const [sentimentFilter, setSentimentFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [newsData, setNewsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addedSymbols, setAddedSymbols] = useState({});

  const openOrderModal = useStore(state => state.openOrderModal);
  const setSelectedSymbol = useStore(state => state.setSelectedSymbol);
  const addToWatchlist = useStore(state => state.addToWatchlist);
  const showToast = useStore(state => state.showToast);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sentiment: sentimentFilter,
        search
      });
      const res = await fetch(`${API}/api/primary-markets/news-sentiment?${params.toString()}`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null);
      if (res && res.success) {
        setNewsData(res);
      }
    } catch (err) {
      console.error('Error fetching market news sentiment:', err);
    } finally {
      setLoading(false);
    }
  }, [sentimentFilter, search]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const handlePaperTrade = (symbol, side = 'BUY') => {
    if (typeof openOrderModal === 'function') {
      openOrderModal({
        symbol,
        variety: 'REGULAR',
        isAmo: false,
        initialQty: 1,
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

  const handleAddToWatchlist = (symbol) => {
    if (typeof addToWatchlist === 'function') {
      addToWatchlist(symbol);
    }
    setAddedSymbols(prev => ({ ...prev, [symbol]: true }));
    if (typeof showToast === 'function') {
      showToast(`${symbol} added to Watchlist!`, 'success', 'Watchlist Updated');
    }
    setTimeout(() => {
      setAddedSymbols(prev => {
        const next = { ...prev };
        delete next[symbol];
        return next;
      });
    }, 2500);
  };

  const mmi = newsData?.mmi || {};
  const newsList = newsData?.news || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 🧭 Market Mood Index (MMI) Gauge Banner */}
      <div style={{
        background: t.cardBg,
        border: `1px solid ${t.cardBorder}`,
        borderRadius: '16px',
        padding: isMobile ? '14px' : '20px',
        boxShadow: t.cardShadow,
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* MMI Radial Badge */}
          <div style={{
            width: isMobile ? '52px' : '64px',
            height: isMobile ? '52px' : '64px',
            borderRadius: '50%',
            background: (mmi.score || 50) >= 60 ? (isLight ? '#dcfce7' : 'rgba(22,163,74,0.18)') : (mmi.score || 50) <= 40 ? (isLight ? '#fee2e2' : 'rgba(220,38,38,0.18)') : (isLight ? '#f1f5f9' : 'rgba(100,116,139,0.18)'),
            border: `2.5px solid ${(mmi.score || 50) >= 60 ? '#16a34a' : (mmi.score || 50) <= 40 ? '#dc2626' : '#64748b'}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <span style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: '900', color: (mmi.score || 50) >= 60 ? (isLight ? '#15803d' : '#22c55e') : (mmi.score || 50) <= 40 ? (isLight ? '#dc2626' : '#ef4444') : t.text }}>
              {mmi.score || 50}
            </span>
            <span style={{ fontSize: '8.5px', fontWeight: '700', color: t.textDim, marginTop: '-2px' }}>MMI</span>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: isMobile ? '15px' : '17px', fontWeight: '800', color: t.text }}>
                Live Market Mood Index (MMI)
              </span>
              <span style={{
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '8px',
                background: (mmi.score || 50) >= 60 ? (isLight ? '#dcfce7' : 'rgba(22,163,74,0.15)') : (mmi.score || 50) <= 40 ? (isLight ? '#fee2e2' : 'rgba(220,38,38,0.15)') : (isLight ? '#f1f5f9' : 'rgba(100,116,139,0.15)'),
                color: (mmi.score || 50) >= 60 ? (isLight ? '#15803d' : '#4ade80') : (mmi.score || 50) <= 40 ? (isLight ? '#dc2626' : '#f87171') : t.textDim,
                border: `1px solid ${(mmi.score || 50) >= 60 ? (isLight ? '#86efac' : 'rgba(34,197,94,0.3)') : (mmi.score || 50) <= 40 ? (isLight ? '#fca5a5' : 'rgba(239,68,68,0.3)') : t.cardBorder}`
              }}>
                {mmi.label || 'Balanced Market Sentiment'}
              </span>
            </div>
            <div style={{ fontSize: '11.5px', color: t.textMuted, marginTop: '3px' }}>
              Real-time algorithmic financial sentiment parsed from breaking NSE corporate disclosures and Indian financial news wires.
            </div>
          </div>
        </div>

        {/* Sentiment Score Counters */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ padding: '6px 12px', borderRadius: '10px', background: isLight ? '#dcfce7' : 'rgba(22,163,74,0.12)', border: isLight ? '1px solid #86efac' : '1px solid rgba(34,197,94,0.25)', textAlign: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: '800', color: isLight ? '#15803d' : '#22c55e' }}>{mmi.bullishCount || 0}</div>
            <div style={{ fontSize: '9.5px', fontWeight: '700', color: isLight ? '#15803d' : '#4ade80' }}>🐂 Bullish</div>
          </div>

          <div style={{ padding: '6px 12px', borderRadius: '10px', background: isLight ? '#fee2e2' : 'rgba(220,38,38,0.12)', border: isLight ? '1px solid #fca5a5' : '1px solid rgba(239,68,68,0.25)', textAlign: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: '800', color: isLight ? '#dc2626' : '#ef4444' }}>{mmi.bearishCount || 0}</div>
            <div style={{ fontSize: '9.5px', fontWeight: '700', color: isLight ? '#dc2626' : '#f87171' }}>🐻 Bearish</div>
          </div>

          <div style={{ padding: '6px 12px', borderRadius: '10px', background: isLight ? '#f1f5f9' : 'rgba(100,116,139,0.12)', border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(148,163,184,0.25)', textAlign: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: '800', color: isLight ? '#475569' : '#94a3b8' }}>{mmi.neutralCount || 0}</div>
            <div style={{ fontSize: '9.5px', fontWeight: '700', color: isLight ? '#475569' : '#94a3b8' }}>⚖️ Neutral</div>
          </div>
        </div>
      </div>

      {/* 🔍 Filter & Search Toolbar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        background: t.cardBg,
        border: `1px solid ${t.cardBorder}`,
        borderRadius: '14px',
        padding: isMobile ? '12px' : '14px',
        boxShadow: t.cardShadow
      }}>
        {/* Sentiment Filter Pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {SENTIMENT_FILTERS.map(f => {
            const active = sentimentFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setSentimentFilter(f.id)}
                style={{
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
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Search & Refresh */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: isMobile ? '1' : 'none', minWidth: isMobile ? '100%' : '240px' }}>
            <Search size={14} color={t.textDim} style={{ position: 'absolute', left: '10px' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search symbol, headline, takeaway..."
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

          <button
            type="button"
            onClick={fetchNews}
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

      {/* 📰 Live AI News Stream Cards */}
      {loading ? (
        <div style={{
          minHeight: '350px',
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
          <span style={{ fontSize: '13px', color: t.textDim, fontWeight: '600' }}>Analyzing live news with Google Gemini AI...</span>
        </div>
      ) : newsList.length === 0 ? (
        <div style={{
          minHeight: '220px',
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
          <Newspaper size={32} />
          <span style={{ fontSize: '14px', fontWeight: '600' }}>No matching news found</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {newsList.map(item => {
            const isBullish = item.sentiment === 'BULLISH';
            const isBearish = item.sentiment === 'BEARISH';
            const primarySymbol = (item.symbols && item.symbols[0]) || 'NIFTY50';

            return (
              <div
                key={item.id}
                style={{
                  background: t.cardBg,
                  border: `1px solid ${t.cardBorder}`,
                  borderRadius: '14px',
                  padding: isMobile ? '12px' : '16px',
                  boxShadow: t.cardShadow,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  transition: 'border-color 0.15s ease'
                }}
              >
                {/* Header: Sentiment Pill, Impact, Time & Publisher */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '800',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: isBullish ? (isLight ? '#dcfce7' : 'rgba(22,163,74,0.18)') : isBearish ? (isLight ? '#fee2e2' : 'rgba(220,38,38,0.18)') : (isLight ? '#f1f5f9' : 'rgba(100,116,139,0.18)'),
                      color: isBullish ? (isLight ? '#15803d' : '#4ade80') : isBearish ? (isLight ? '#dc2626' : '#f87171') : t.textDim,
                      border: `1px solid ${isBullish ? (isLight ? '#86efac' : 'rgba(34,197,94,0.3)') : isBearish ? (isLight ? '#fca5a5' : 'rgba(239,68,68,0.3)') : t.cardBorder}`
                    }}>
                      {isBullish ? `🐂 BULLISH (+${Math.abs(item.score)}%)` : isBearish ? `🐻 BEARISH (-${Math.abs(item.score)}%)` : '⚖️ NEUTRAL'}
                    </span>

                    <span style={{
                      fontSize: '10.5px',
                      fontWeight: '700',
                      padding: '2px 6px',
                      borderRadius: '5px',
                      background: item.impact === 'HIGH' ? (isLight ? '#fef3c7' : 'rgba(245,158,11,0.15)') : (isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)'),
                      color: item.impact === 'HIGH' ? (isLight ? '#b45309' : '#f59e0b') : t.textDim
                    }}>
                      {item.impact} IMPACT
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', color: t.textDim }}>
                    <span>{item.publisher}</span>
                    <span>&bull;</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={11} /> {item.timeAgo}</span>
                  </div>
                </div>

                {/* Main Headline */}
                <div style={{ fontSize: isMobile ? '13.5px' : '15px', fontWeight: '800', color: t.text, lineHeight: '1.4' }}>
                  {item.title}
                </div>

                {/* 🤖 Gemini AI Institutional Takeaway Box */}
                {item.takeaway && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    background: isLight ? '#f0f9ff' : 'rgba(2,132,199,0.08)',
                    border: `1px solid ${isLight ? '#bae6fd' : 'rgba(56,189,248,0.25)'}`,
                    borderRadius: '10px',
                    padding: '10px 12px'
                  }}>
                    <Sparkles size={16} color={isLight ? '#0284c7' : '#38bdf8'} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ fontSize: '12px', color: isLight ? '#0369a1' : '#7dd3fc', lineHeight: '1.45' }}>
                      <strong style={{ fontWeight: '800' }}>AI Key Takeaway:</strong> {item.takeaway}
                    </div>
                  </div>
                )}

                {/* Footer: Tagged Stocks & Quick Trade Actions */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                  paddingTop: '6px',
                  borderTop: `1px solid ${t.borderSubtle}`
                }}>
                  {/* Tagged Stock Pills */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {(item.enrichedSymbols || []).map(symObj => {
                      const isUp = (symObj.change || 0) >= 0;
                      return (
                        <div
                          key={symObj.symbol}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${t.cardBorder}`,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700'
                          }}
                        >
                          <span style={{ color: t.text }}>{symObj.symbol}</span>
                          <span style={{ color: isUp ? (isLight ? '#15803d' : '#22c55e') : (isLight ? '#dc2626' : '#ef4444') }}>
                            ₹{symObj.ltp} ({isUp ? '+' : ''}{symObj.change}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* 1-Click Action Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => handlePaperTrade(primarySymbol, 'BUY')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        background: '#16a34a', color: '#fff', border: 'none',
                        padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer'
                      }}
                    >
                      <ShoppingCart size={11} /> Buy {primarySymbol}
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePaperTrade(primarySymbol, 'SELL')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        background: '#dc2626', color: '#fff', border: 'none',
                        padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer'
                      }}
                    >
                      <ShoppingCart size={11} /> Sell
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenChart(primarySymbol)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        background: isLight ? '#dbeafe' : 'rgba(59,130,246,0.15)',
                        border: '1px solid #3b82f6', color: isLight ? '#1d4ed8' : '#60a5fa',
                        padding: '5px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer'
                      }}
                    >
                      <BarChart2 size={11} /> Chart
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAddToWatchlist(primarySymbol)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        background: addedSymbols[primarySymbol] ? '#10b981' : t.pillInactiveBg,
                        border: `1px solid ${t.pillInactiveBorder}`, color: addedSymbols[primarySymbol] ? '#fff' : t.text,
                        padding: '5px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer'
                      }}
                    >
                      {addedSymbols[primarySymbol] ? <Check size={11} /> : <Plus size={11} />}
                    </button>

                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex', alignItems: 'center', gap: '3px',
                          color: t.textDim, textDecoration: 'none', fontSize: '11px', padding: '5px'
                        }}
                        title="Read full article on publisher site"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
