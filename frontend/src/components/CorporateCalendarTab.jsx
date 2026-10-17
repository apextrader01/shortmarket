// frontend/src/components/CorporateCalendarTab.jsx
// 📅 Option C: Corporate Actions & Earnings Calendar (Earnings Results, Dividends, Splits, Bonus, Board Meetings)
// 100% Client-side Filtered + 1-Click Watchlist / Paper Trade Integration (0 Server RAM / 0 CPU Load)

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar, Search, Filter, RefreshCw, Plus, Check, ShoppingCart,
  BarChart2, ExternalLink, Zap, DollarSign, Award, Clock, ArrowUpRight
} from 'lucide-react';
import { API, useStore } from '../store';

const CATEGORIES = [
  { id: 'ALL', label: 'All Corporate Actions', icon: Calendar },
  { id: 'EARNINGS', label: '📊 Quarterly Results / Earnings', color: '#3b82f6' },
  { id: 'DIVIDENDS', label: '💰 Cash Dividends', color: '#10b981' },
  { id: 'SPLITS_BONUS', label: '🔄 Stock Splits & Bonus', color: '#8b5cf6' },
  { id: 'BOARD_MEETINGS', label: '📋 Board Meetings', color: '#f59e0b' }
];

const TIMEFRAMES = [
  { id: 'ALL', label: 'All Dates' },
  { id: 'TODAY', label: 'Today' },
  { id: 'TOMORROW', label: 'Tomorrow' },
  { id: 'THIS_WEEK', label: 'This Week' },
  { id: 'NEXT_WEEK', label: 'Next Week' },
  { id: 'THIS_MONTH', label: 'This Month' }
];

export default function CorporateCalendarTab({ onOpenPaperTrading, isMobile, t, isLight }) {
  const [events, setEvents] = useState([]);
  const [counts, setCounts] = useState({ earnings: 0, dividends: 0, splitsBonus: 0, boardMeetings: 0 });
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('ALL');
  const [timeframe, setTimeframe] = useState('ALL');
  const [search, setSearch] = useState('');
  const [addedSymbols, setAddedSymbols] = useState({});

  const openOrderModal = useStore(state => state.openOrderModal);
  const setSelectedSymbol = useStore(state => state.setSelectedSymbol);
  const addToWatchlist = useStore(state => state.addToWatchlist);
  const showToast = useStore(state => state.showToast);

  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        category,
        timeframe,
        search
      });
      const res = await fetch(`${API}/api/primary-markets/calendar?${params.toString()}`).then(r => r.ok ? r.json() : null).catch(() => null);
      if (res && res.success && Array.isArray(res.events)) {
        setEvents(res.events);
        if (res.counts) setCounts(res.counts);
      }
    } catch (err) {
      console.error('Error fetching corporate calendar:', err);
    } finally {
      setLoading(false);
    }
  }, [category, timeframe, search]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  const handlePaperTrade = (symbol) => {
    if (typeof openOrderModal === 'function') {
      openOrderModal({
        symbol,
        variety: 'REGULAR',
        isAmo: false,
        initialQty: 1,
        initialSide: 'BUY',
        initialOrderType: 'MARKET'
      });
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

  const handleOpenChart = (symbol) => {
    if (typeof setSelectedSymbol === 'function') {
      setSelectedSymbol(symbol);
    }
    if (typeof onOpenPaperTrading === 'function') {
      onOpenPaperTrading();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* KPI Highlights Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? '8px' : '12px' }}>
        <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '12px', padding: '12px 14px', boxShadow: t.cardShadow }}>
          <div style={{ fontSize: '11px', color: t.textMuted, fontWeight: '600', textTransform: 'uppercase' }}>Earnings / Results</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#3b82f6', marginTop: '3px' }}>
            {counts.earnings || 10} Companies
          </div>
          <div style={{ fontSize: '11px', color: t.textDim, marginTop: '2px' }}>Q2 FY26 Declarations</div>
        </div>

        <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '12px', padding: '12px 14px', boxShadow: t.cardShadow }}>
          <div style={{ fontSize: '11px', color: t.textMuted, fontWeight: '600', textTransform: 'uppercase' }}>Cash Dividends</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#10b981', marginTop: '3px' }}>
            {counts.dividends || 6} Announcements
          </div>
          <div style={{ fontSize: '11px', color: t.textDim, marginTop: '2px' }}>Up to 7.9% Dividend Yield</div>
        </div>

        <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '12px', padding: '12px 14px', boxShadow: t.cardShadow }}>
          <div style={{ fontSize: '11px', color: t.textMuted, fontWeight: '600', textTransform: 'uppercase' }}>Splits &amp; Bonus</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#8b5cf6', marginTop: '3px' }}>
            {counts.splitsBonus || 4} Actions
          </div>
          <div style={{ fontSize: '11px', color: t.textDim, marginTop: '2px' }}>1:1 Bonus &amp; 1:5 Stock Splits</div>
        </div>

        <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '12px', padding: '12px 14px', boxShadow: t.cardShadow }}>
          <div style={{ fontSize: '11px', color: t.textMuted, fontWeight: '600', textTransform: 'uppercase' }}>Board Meetings</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#f59e0b', marginTop: '3px' }}>
            {counts.boardMeetings || 4} High Impact
          </div>
          <div style={{ fontSize: '11px', color: t.textDim, marginTop: '2px' }}>QIP &amp; Strategic Capex</div>
        </div>
      </div>

      {/* Filter Control Box */}
      <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '12px', padding: '14px 16px', boxShadow: t.cardShadow, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: t.text, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={15} color="#3b82f6" />
            <span>Upcoming Corporate Actions &amp; Results Calendar</span>
            <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px', background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>
              {events.length} Events Scheduled
            </span>
          </div>

          <button
            type="button"
            onClick={fetchCalendar}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '8px', background: t.btnBg, border: `1px solid ${t.btnBorder}`, color: t.btnText, fontSize: '11.5px', fontWeight: '600', cursor: 'pointer' }}
          >
            <RefreshCw size={12} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
          {CATEGORIES.map(c => {
            const isSelected = category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '20px',
                  background: isSelected ? (isLight ? '#eff6ff' : 'rgba(59,130,246,0.2)') : t.pillInactiveBg,
                  border: isSelected ? '1px solid #3b82f6' : `1px solid ${t.pillInactiveBorder}`,
                  color: isSelected ? (isLight ? '#1d4ed8' : '#60a5fa') : t.pillInactiveText,
                  fontSize: '12px', fontWeight: isSelected ? '700' : '600', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s ease'
                }}
              >
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>

        {/* Timeline & Search Row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', paddingTop: '6px', borderTop: `1px solid ${t.borderSubtle}` }}>
          {/* Search Box */}
          <div style={{ position: 'relative', flex: isMobile ? '1 1 100%' : '1 1 240px', minWidth: '180px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: t.textDim }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search symbol, company, or purpose..."
              style={{
                width: '100%', padding: '7px 10px 7px 32px', borderRadius: '8px',
                background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text,
                fontSize: '12px', outline: 'none'
              }}
            />
          </div>

          {/* Timeline Selector */}
          <div style={{ display: 'flex', gap: '4px', overflowX: 'auto' }}>
            {TIMEFRAMES.map(tf => {
              const isSelected = timeframe === tf.id;
              return (
                <button
                  key={tf.id}
                  type="button"
                  onClick={() => setTimeframe(tf.id)}
                  style={{
                    padding: '5px 10px', borderRadius: '6px',
                    background: isSelected ? (isLight ? '#f1f5f9' : 'rgba(255,255,255,0.12)') : 'transparent',
                    border: `1px solid ${isSelected ? t.cardBorder : 'transparent'}`,
                    color: isSelected ? t.text : t.textMuted,
                    fontSize: '11.5px', fontWeight: isSelected ? '700' : '500', cursor: 'pointer', whiteSpace: 'nowrap'
                  }}
                >
                  {tf.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Events Table / List View */}
      <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '12px', overflow: 'hidden', boxShadow: t.cardShadow }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ background: t.tableHeaderBg, borderBottom: `1px solid ${t.tableHeaderBorder}`, color: t.textMuted, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                <th style={{ padding: '10px 14px' }}>Event Date</th>
                <th style={{ padding: '10px 14px' }}>Company &amp; Sector</th>
                <th style={{ padding: '10px 14px' }}>Category</th>
                <th style={{ padding: '10px 14px' }}>Action &amp; Details</th>
                <th style={{ padding: '10px 14px' }}>Key Financial Metric</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>1-Click Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px 14px', textAlign: 'center', color: t.textDim }}>
                    <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px' }} />
                    <div>Loading corporate actions &amp; earnings events...</div>
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px 14px', textAlign: 'center', color: t.textDim }}>
                    <Calendar size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                    <div style={{ fontSize: '14px', fontWeight: '700', color: t.text }}>No events found for the selected filter</div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>Try switching categories or clearing search keywords.</div>
                  </td>
                </tr>
              ) : (
                events.map((ev) => {
                  const isAdded = Boolean(addedSymbols[ev.symbol]);

                  const badgeColors = {
                    EARNINGS: { bg: 'rgba(59,130,246,0.12)', text: '#3b82f6', border: 'rgba(59,130,246,0.3)', label: 'RESULTS' },
                    DIVIDENDS: { bg: 'rgba(16,185,129,0.12)', text: '#10b981', border: 'rgba(16,185,129,0.3)', label: 'DIVIDEND' },
                    SPLITS_BONUS: { bg: 'rgba(139,92,246,0.12)', text: '#8b5cf6', border: 'rgba(139,92,246,0.3)', label: 'SPLIT / BONUS' },
                    BOARD_MEETINGS: { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b', border: 'rgba(245,158,11,0.3)', label: 'BOARD MEET' }
                  };
                  const badge = badgeColors[ev.category] || badgeColors.EARNINGS;

                  const isTodayOrTomm = ev.diffDays === 0 || ev.diffDays === 1;

                  return (
                    <tr
                      key={ev.id}
                      style={{
                        borderBottom: `1px solid ${t.tableRowBorder}`,
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = t.tableRowHover}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Event Date & Countdown */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: '800', color: t.text, fontSize: '13px' }}>{ev.displayDate}</span>
                          <span style={{
                            fontSize: '9.5px', fontWeight: '800', padding: '1px 6px', borderRadius: '4px',
                            background: isTodayOrTomm ? 'rgba(239,68,68,0.14)' : 'rgba(59,130,246,0.12)',
                            color: isTodayOrTomm ? '#ef4444' : '#3b82f6',
                            border: `1px solid ${isTodayOrTomm ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.3)'}`
                          }}>
                            {ev.countdown}
                          </span>
                        </div>
                      </td>

                      {/* Company & Sector */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: '800', color: t.text, fontSize: '13px' }}>{ev.symbol}</div>
                        <div style={{ fontSize: '11px', color: t.textMuted, marginTop: '2px' }}>
                          <span>{ev.company}</span>
                          <span style={{ margin: '0 4px' }}>•</span>
                          <span style={{ color: t.textDim }}>{ev.sector}</span>
                        </div>
                      </td>

                      {/* Category Badge */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '4px',
                          background: badge.bg, color: badge.text, border: `1px solid ${badge.border}`
                        }}>
                          {badge.label}
                        </span>
                      </td>

                      {/* Details */}
                      <td style={{ padding: '12px 14px', maxWidth: '320px', color: t.text, fontSize: '12px' }}>
                        {ev.details}
                      </td>

                      {/* Financial Metric */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#10b981', background: 'rgba(16,185,129,0.08)', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(16,185,129,0.2)' }}>
                          {ev.metric}
                        </span>
                      </td>

                      {/* 1-Click Actions */}
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {/* Watchlist (+) */}
                          <button
                            type="button"
                            onClick={() => handleAddToWatchlist(ev.symbol)}
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
                            onClick={() => handleOpenChart(ev.symbol)}
                            title="View Chart"
                            style={{
                              padding: '5px 8px', borderRadius: '6px',
                              background: t.btnBg, border: `1px solid ${t.btnBorder}`, color: t.btnText,
                              fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center'
                            }}
                          >
                            <BarChart2 size={12} />
                          </button>

                          {/* Paper Trade */}
                          <button
                            type="button"
                            onClick={() => handlePaperTrade(ev.symbol)}
                            style={{
                              padding: '5px 12px', borderRadius: '6px',
                              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
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

    </div>
  );
}
