import React, { useState, useEffect, useMemo } from 'react';
import { useStore, API } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { 
  BookOpen, Plus, Tag, Smile, Frown, Sparkles, Filter, Search, 
  Share2, Star, Edit3, Trash2, Check, X, TrendingUp, TrendingDown, 
  AlertTriangle, ShieldCheck, Flame, Zap, Award, BarChart3, ChevronRight 
} from 'lucide-react';
import PnLShareCardModal from './PnLShareCardModal';

export const STRATEGY_TAGS = [
  '🔥 Breakout',
  '⚡ Scalping',
  '🎯 Trend Follow',
  '🔄 Mean Reversion',
  '📊 Support & Resistance',
  '⚡ Option Buying (Momentum)',
  '🛡️ Option Selling (Theta Decay)'
];

export const EMOTION_TAGS = [
  '🎯 Disciplined Execution',
  '🛡️ Plan Followed',
  '⚠️ FOMO Entry',
  '😡 Revenge Trade',
  '⏳ Greed (Late Exit)',
  '😨 Panic Exit (Fear)'
];

export default function TradingJournalView({ onBack }) {
  const { user, positions, orders } = useStore(useShallow(state => ({
    user: state.user,
    positions: state.positions,
    orders: state.orders
  })));

  const userId = user?.id || 'default';
  const storageKey = shortmarket_journal_;

  // Journal entries stored in localStorage: { [tradeId]: { strategy, emotion, notes, rating, updatedAt } }
  const [journalEntries, setJournalEntries] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [selectedTradeForShare, setSelectedTradeForShare] = useState(null);
  const [editingTrade, setEditingTrade] = useState(null); // trade object being edited
  const [editForm, setEditForm] = useState({ strategy: '', emotion: '', notes: '', rating: 5 });

  const [filterStrategy, setFilterStrategy] = useState('ALL');
  const [filterEmotion, setFilterEmotion] = useState('ALL');
  const [filterResult, setFilterResult] = useState('ALL'); // 'ALL' | 'WIN' | 'LOSS'
  const [searchQuery, setSearchQuery] = useState('');

  const saveJournalEntry = (tradeId, data) => {
    const updated = {
      ...journalEntries,
      [tradeId]: {
        ...data,
        updatedAt: new Date().toISOString()
      }
    };
    setJournalEntries(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save journal entry to localStorage', e);
    }
  };

  // Compile executed/closed trades list from positions and orders
  const tradesList = useMemo(() => {
    const list = [];
    const seen = new Set();

    // 1. Closed positions
    (positions || []).forEach(p => {
      const pnl = Number(p.realized_pnl || 0);
      const isClosed = Number(p.quantity) === 0 || p.closed_quantity > 0;
      const key = pos--;
      if (isClosed && !seen.has(key)) {
        seen.add(key);
        list.push({
          id: key,
          rawId: p.id,
          symbol: p.symbol,
          product_type: p.product_type || 'INT',
          side: pnl >= 0 ? 'BUY' : 'SELL',
          qty: Math.abs(p.closed_quantity || p.quantity || 1),
          avg: Number(p.average_price || 0),
          exit_price: Number(p.exit_price || p.average_price || 0),
          pnl: pnl,
          date: p.updated_at ? new Date(p.updated_at).toLocaleDateString('en-IN') : 'Today',
          rawDate: p.updated_at || p.created_at || new Date().toISOString()
        });
      }
    });

    // 2. Executed Orders
    (orders || []).forEach(o => {
      const isExecuted = o.status === 'COMPLETED' || o.status === 'COMPLETE' || o.status === 'EXECUTED';
      const pnl = Number(o.realized_pnl || 0);
      const key = `ord-${o.id}`;
      if (isExecuted && !seen.has(key)) {
        seen.add(key);
        list.push({
          id: key,
          rawId: o.id,
          symbol: o.symbol,
          product_type: o.product_type || 'INT',
          side: o.side,
          qty: Math.abs(o.quantity || 1),
          avg: Number(o.price || o.average_price || 0),
          exit_price: Number(o.average_price || o.price || 0),
          pnl: pnl,
          date: o.created_at ? new Date(o.created_at).toLocaleDateString('en-IN') : 'Today',
          rawDate: o.created_at || new Date().toISOString()
        });
      }
    });

    // Sort newest first
    list.sort((a, b) => new Date(b.rawDate) - new Date(a.rawDate));
    return list;
  }, [positions, orders]);

  // Merge journal metadata into trades
  const enrichedTrades = useMemo(() => {
    return tradesList.map(t => {
      const entry = journalEntries[t.id] || {};
      return {
        ...t,
        strategy: entry.strategy || '🔥 Breakout',
        emotion: entry.emotion || (t.pnl >= 0 ? '🎯 Disciplined Execution' : '🛡️ Plan Followed'),
        notes: entry.notes || '',
        rating: entry.rating || 5,
        isJournaled: Boolean(journalEntries[t.id])
      };
    });
  }, [tradesList, journalEntries]);

  // Apply filters
  const filteredTrades = useMemo(() => {
    return enrichedTrades.filter(t => {
      if (filterStrategy !== 'ALL' && t.strategy !== filterStrategy) return false;
      if (filterEmotion !== 'ALL' && t.emotion !== filterEmotion) return false;
      if (filterResult === 'WIN' && t.pnl <= 0) return false;
      if (filterResult === 'LOSS' && t.pnl >= 0) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const sym = t.symbol.toLowerCase();
        const notes = (t.notes || '').toLowerCase();
        if (!sym.includes(q) && !notes.includes(q)) return false;
      }
      return true;
    });
  }, [enrichedTrades, filterStrategy, filterEmotion, filterResult, searchQuery]);

  // Analytics Stats
  const stats = useMemo(() => {
    let totalPnl = 0;
    let wins = 0;
    let losses = 0;
    const strategyCounts = {};
    const strategyPnls = {};
    const emotionCounts = {};

    tradesList.forEach(t => {
      totalPnl += t.pnl;
      if (t.pnl > 0) wins++;
      else if (t.pnl < 0) losses++;

      const entry = journalEntries[t.id] || {};
      const strat = entry.strategy || '🔥 Breakout';
      const emo = entry.emotion || '🎯 Disciplined Execution';

      strategyCounts[strat] = (strategyCounts[strat] || 0) + 1;
      strategyPnls[strat] = (strategyPnls[strat] || 0) + t.pnl;
      emotionCounts[emo] = (emotionCounts[emo] || 0) + 1;
    });

    const totalTrades = tradesList.length;
    const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0.0';

    // Best strategy
    let bestStrat = 'None';
    let bestStratPnl = -Infinity;
    Object.entries(strategyPnls).forEach(([strat, pnl]) => {
      if (pnl > bestStratPnl) {
        bestStratPnl = pnl;
        bestStrat = strat;
      }
    });

    return {
      totalTrades,
      wins,
      losses,
      totalPnl,
      winRate,
      bestStrat: bestStratPnl > -Infinity ? bestStrat : 'Breakout',
      journaledCount: Object.keys(journalEntries).length
    };
  }, [tradesList, journalEntries]);

  const handleOpenEdit = (trade) => {
    setEditingTrade(trade);
    const existing = journalEntries[trade.id] || {};
    setEditForm({
      strategy: existing.strategy || '🔥 Breakout',
      emotion: existing.emotion || (trade.pnl >= 0 ? '🎯 Disciplined Execution' : '🛡️ Plan Followed'),
      notes: existing.notes || '',
      rating: existing.rating || 5
    });
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editingTrade) return;
    saveJournalEntry(editingTrade.id, editForm);
    setEditingTrade(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      {/* Header Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '14px'
      }}>
        {/* Total PnL Card */}
        <div style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: '600' }}>TOTAL REALIZED P&L</div>
          <div style={{
            fontSize: '22px',
            fontWeight: '800',
            color: stats.totalPnl >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)',
            marginTop: '4px'
          }}>
            {stats.totalPnl >= 0 ? '+' : ''}₹{stats.totalPnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {stats.wins} Wins • {stats.losses} Losses
          </div>
        </div>

        {/* Win Rate Card */}
        <div style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: '600' }}>JOURNAL WIN RATE</div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#38bdf8', marginTop: '4px' }}>
            {stats.winRate}%
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {stats.totalTrades} Total Closed Setups
          </div>
        </div>

        {/* Best Strategy Card */}
        <div style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: '600' }}>TOP STRATEGY EDGE</div>
          <div style={{ fontSize: '15px', fontWeight: '700', color: '#fbbf24', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {stats.bestStrat}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Highest Profit Generator
          </div>
        </div>

        {/* Journaled Ratio Card */}
        <div style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: '600' }}>LOGGED LESSONS</div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#a855f7', marginTop: '4px' }}>
            {stats.journaledCount} / {stats.totalTrades}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Trades with Notes & Tags
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '14px 18px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px' }}>
          <Search size={15} color="var(--text-secondary)" />
          <input
            type="text"
            placeholder="Search by symbol, setups, notes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '12px',
              outline: 'none',
              width: '100%'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Result Filter */}
          <select
            value={filterResult}
            onChange={e => setFilterResult(e.target.value)}
            style={{
              background: 'var(--bg-hover)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '11.5px',
              fontWeight: '600'
            }}
          >
            <option value="ALL">All Outcomes</option>
            <option value="WIN">Profitable Trades (Wins)</option>
            <option value="LOSS">Losing Trades (Losses)</option>
          </select>

          {/* Strategy Filter */}
          <select
            value={filterStrategy}
            onChange={e => setFilterStrategy(e.target.value)}
            style={{
              background: 'var(--bg-hover)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '11.5px',
              fontWeight: '600'
            }}
          >
            <option value="ALL">All Strategies</option>
            {STRATEGY_TAGS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Emotion Filter */}
          <select
            value={filterEmotion}
            onChange={e => setFilterEmotion(e.target.value)}
            style={{
              background: 'var(--bg-hover)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '11.5px',
              fontWeight: '600'
            }}
          >
            <option value="ALL">All Mindsets</option>
            {EMOTION_TAGS.map(em => <option key={em} value={em}>{em}</option>)}
          </select>
        </div>
      </div>

      {/* Trades Journal List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredTrades.length === 0 ? (
          <div style={{
            padding: '48px 24px',
            textAlign: 'center',
            background: 'var(--bg-panel)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)'
          }}>
            <BookOpen size={36} color="var(--text-secondary)" style={{ margin: '0 auto 12px auto', opacity: 0.6 }} />
            <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
              No Trades in Journal
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Execute or close trades to log your strategy, lessons, and generate social P&L cards.
            </div>
          </div>
        ) : (
          filteredTrades.map(trade => {
            const isProfit = trade.pnl >= 0;
            const displaySymbol = trade.symbol.includes(':') ? trade.symbol.split(':')[1] : trade.symbol;

            return (
              <div
                key={trade.id}
                style={{
                  background: 'var(--bg-panel)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '14px',
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  transition: 'border-color 0.15s ease',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
              >
                {/* Row 1: Instrument & Tags (Left) | PnL & Action (Right) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
                      {displaySymbol}
                    </span>
                    <span style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: trade.side === 'BUY' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                      color: trade.side === 'BUY' ? 'var(--color-green-light)' : 'var(--color-red-light)',
                      fontWeight: '700'
                    }}>
                      {trade.side}
                    </span>
                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: '600' }}>
                      {trade.product_type}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      • {trade.date}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: '15px',
                        fontWeight: '800',
                        color: isProfit ? 'var(--color-green-light)' : 'var(--color-red-light)'
                      }}>
                        {isProfit ? '+' : ''}₹{Number(trade.pnl).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                        Qty: {trade.qty} • Avg: ₹{trade.avg.toFixed(2)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedTradeForShare(trade)}
                      title="Generate Social P&L Card"
                      style={{
                        padding: '7px 12px',
                        borderRadius: '8px',
                        background: 'rgba(56, 189, 248, 0.12)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        color: '#38bdf8',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <Share2 size={13} /> Share P&L
                    </button>
                  </div>
                </div>

                {/* Row 2: Strategy & Psychology Badges */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    color: '#60a5fa',
                    fontWeight: '600'
                  }}>
                    {trade.strategy}
                  </span>

                  <span style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: trade.emotion.includes('⚠️') || trade.emotion.includes('😡') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                    border: trade.emotion.includes('⚠️') || trade.emotion.includes('😡') ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(34, 197, 94, 0.25)',
                    color: trade.emotion.includes('⚠️') || trade.emotion.includes('😡') ? '#f87171' : '#4ade80',
                    fontWeight: '600'
                  }}>
                    {trade.emotion}
                  </span>

                  {/* Rating Stars */}
                  <div style={{ display: 'flex', gap: '2px', marginLeft: 'auto' }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star
                        key={star}
                        size={12}
                        fill={trade.rating >= star ? '#fbbf24' : 'none'}
                        color={trade.rating >= star ? '#fbbf24' : 'var(--text-secondary)'}
                      />
                    ))}
                  </div>
                </div>

                {/* Row 3: Notes Log & Edit Button */}
                <div style={{
                  background: 'var(--bg-hover)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '12px',
                  color: trade.notes ? 'var(--text-primary)' : 'var(--text-secondary)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{ fontStyle: trade.notes ? 'normal' : 'italic', flex: 1, whiteSpace: 'pre-wrap' }}>
                    {trade.notes || 'No notes added yet. Click edit to log strategy reasoning, SL adherence, and takeaways.'}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(trade)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--color-blue)',
                      cursor: 'pointer',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      flexShrink: 0
                    }}
                  >
                    <Edit3 size={13} /> {trade.notes ? 'Edit Notes' : 'Add Notes'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Note / Journal Editor Modal */}
      {editingTrade && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            maxWidth: '480px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>
                  Journal Trade: {editingTrade.symbol}
                </h3>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                  Log your execution psychology and technical thesis
                </div>
              </div>
              <X size={18} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setEditingTrade(null)} />
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Strategy Tag Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '600' }}>
                  Trading Setup / Strategy
                </label>
                <select
                  value={editForm.strategy}
                  onChange={e => setEditForm({ ...editForm, strategy: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'var(--bg-hover)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}
                >
                  {STRATEGY_TAGS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Psychology Tag Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '600' }}>
                  Execution Psychology / Mindset
                </label>
                <select
                  value={editForm.emotion}
                  onChange={e => setEditForm({ ...editForm, emotion: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'var(--bg-hover)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}
                >
                  {EMOTION_TAGS.map(em => <option key={em} value={em}>{em}</option>)}
                </select>
              </div>

              {/* Rating */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '600' }}>
                  Execution Discipline Score (1 to 5 Stars)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setEditForm({ ...editForm, rating: star })}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                    >
                      <Star
                        size={22}
                        fill={editForm.rating >= star ? '#fbbf24' : 'none'}
                        color={editForm.rating >= star ? '#fbbf24' : 'var(--text-secondary)'}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes Textarea */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '600' }}>
                  Trade Notes & Lessons Learned
                </label>
                <textarea
                  rows={4}
                  value={editForm.notes}
                  onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="e.g. Waited for 15-min candle confirmation above VWAP. Exited when price rejected 200 EMA..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'var(--bg-hover)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setEditingTrade(null)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    background: 'transparent',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 18px',
                    borderRadius: '6px',
                    background: 'var(--color-blue)',
                    border: 'none',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Social PnL Card Modal */}
      {selectedTradeForShare && (
        <PnLShareCardModal
          trade={selectedTradeForShare}
          onClose={() => setSelectedTradeForShare(null)}
        />
      )}
    </div>
  );
}
