import React, { useState, useEffect, useMemo } from 'react';
import { useStore, API } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { 
  LayoutDashboard, CheckSquare, ListOrdered, TrendingUp, Scale, AlertTriangle, 
  Sparkles, BarChart2, ShieldCheck, Zap, Users, Trophy, Calendar, Share2, 
  HelpCircle, Video, Plus, Settings, Sun, Moon, User, ChevronDown, 
  ArrowUpRight, ArrowDownRight, Wallet, Award, BarChart3, Clock, 
  Flame, Check, X, Edit3, Trash2, Search, Filter, RefreshCw, ExternalLink,
  BookOpen, ChevronRight, Lock, PlayCircle, Star, ThumbsUp, AlertCircle, Menu
} from 'lucide-react';
import PnLShareCardModal from './PnLShareCardModal';

// Available strategies and emotions for tag selection
export const STRATEGY_TAGS = [
  '🔥 Breakout',
  '⚡ Scalping',
  '🎯 Trend Follow',
  '🔄 Mean Reversion',
  '📊 Support & Resistance',
  '⚡ Option Buying (Momentum)',
  '🛡️ Option Selling (Theta Decay)',
  '🚀 Gap Up / Gap Down',
  '📈 Price Action / Volume Spread'
];

export const EMOTION_TAGS = [
  '🎯 Disciplined Execution',
  '🛡️ Plan Followed',
  '⚠️ FOMO Entry',
  '😡 Revenge Trade',
  '⏳ Greed (Late Exit)',
  '😨 Panic Exit (Fear)',
  '⚖️ Balanced / Calm',
  '🎲 Over-leveraged Gamble'
];

export const COMMON_MISTAKES = [
  'Entering without Stop-Loss',
  'Chasing FOMO Green Candles',
  'Revenge Trading after a loss',
  'Over-leveraging / oversized quantity',
  'Moving Stop-Loss further away',
  'Exiting too early (Cutting winners)',
  'Holding losers hoping for breakeven',
  'Trading during high-impact news chop'
];

export default function TradeDiaryView({ onOpenPaperTrading, onBack }) {
  const { user, positions, orders, theme, toggleTheme, prices } = useStore(useShallow(state => ({
    user: state.user,
    positions: state.positions,
    orders: state.orders,
    theme: state.theme,
    toggleTheme: state.toggleTheme,
    prices: state.prices
  })));

  // Navigation state: which Trade Diary sub-view is active
  const [activeTab, setActiveTab] = useState('DASHBOARD');
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 850);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 850);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Filter states
  const [marketSegment, setMarketSegment] = useState('Indian'); // 'Indian', 'Crypto', 'Forex', 'US'
  const [timeRange, setTimeRange] = useState('30D'); // 'TODAY', '7D', '30D', '90D', '1Y', 'ALL'
  const [pnlPeriod, setPnlPeriod] = useState('D'); // 'D', 'W', 'M'

  // Modals & Forms
  const [showNewTradeModal, setShowNewTradeModal] = useState(false);
  const [selectedTradeForShare, setSelectedTradeForShare] = useState(null);

  // Journal DB State
  const [dbTrades, setDbTrades] = useState([]);
  const [strategies, setStrategies] = useState([
    { id: 1, name: 'Breakout Momentum', win_rate: 68, total_trades: 24, net_pnl: 48500, color: '#3b82f6' },
    { id: 2, name: 'Support & Resistance Bounce', win_rate: 55, total_trades: 18, net_pnl: 22100, color: '#10b981' },
    { id: 3, name: 'Option Selling Theta Decay', win_rate: 78, total_trades: 32, net_pnl: 64200, color: '#8b5cf6' },
    { id: 4, name: 'VWAP Mean Reversion', win_rate: 42, total_trades: 12, net_pnl: -8400, color: '#f59e0b' }
  ]);
  const [rules, setRules] = useState([
    { id: 1, text: 'Maximum risk per trade is strictly 1% of total portfolio capital', category: 'RISK', followed: 42, broken: 2, active: true },
    { id: 2, text: 'Never take a trade without a predefined Stop-Loss order', category: 'RISK', followed: 48, broken: 0, active: true },
    { id: 3, text: 'Maximum 3 trades per trading day to avoid overtrading', category: 'DISCIPLINE', followed: 38, broken: 5, active: true },
    { id: 4, text: 'Wait for 5-minute candle close confirmation before breakout entry', category: 'EXECUTION', followed: 31, broken: 4, active: true },
    { id: 5, text: 'No revenge trading after a red trade; step away from screens for 15 mins', category: 'PSYCHOLOGY', followed: 29, broken: 3, active: true }
  ]);
  const [mistakes, setMistakes] = useState([
    { id: 1, name: 'FOMO Entry on extended green candle', category: 'PSYCHOLOGY', loss: 14500, count: 4, note: 'Wait for pullback to 20 EMA' },
    { id: 2, name: 'Moving Stoploss further down in losing position', category: 'RISK', loss: 22800, count: 2, note: 'Accept initial loss without hesitation' },
    { id: 3, name: 'Trading without setup checklist confirmation', category: 'EXECUTION', loss: 9200, count: 3, note: 'Tick all 4 checklist points first' }
  ]);

  // Form states
  const todayStr = new Date().toISOString().split('T')[0];
  const [newTradeForm, setNewTradeForm] = useState({
    symbol: 'NIFTY 24500 CE',
    trade_type: 'BUY',
    product_type: 'INT',
    market_segment: 'Indian',
    entry_price: '',
    exit_price: '',
    quantity: '50',
    realized_pnl: '',
    charges: '45',
    strategy: '🔥 Breakout',
    emotion: '🎯 Disciplined Execution',
    mistake: '',
    setup_rating: 5,
    trade_date: todayStr,
    notes: ''
  });

  // Today checklist state
  const [todayChecklist, setTodayChecklist] = useState({
    preMarket: {
      globalMarketsChecked: false,
      supportResistanceDrawn: false,
      dailyRiskLimitSet: false,
      highImpactNewsNoted: false,
      tradingPlanWritten: false
    },
    postMarket: {
      allTradesLogged: false,
      mistakesReviewed: false,
      emotionsDocumented: false,
      dailyPnLReconciled: false
    },
    notes: ''
  });

  // Fetch backend journal data on mount
  const fetchJournalData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const headers = { 'Authorization': `Bearer ${token}` };

      // Fetch trades
      const resTrades = await fetch(`${API}/api/journal/trades`, { headers });
      const dataTrades = await resTrades.json();
      if (dataTrades.success && Array.isArray(dataTrades.trades)) {
        setDbTrades(dataTrades.trades);
      }

      // Fetch checklists
      const resChk = await fetch(`${API}/api/journal/checklists?date=${todayStr}`, { headers });
      const dataChk = await resChk.json();
      if (dataChk.success && dataChk.checklists && dataChk.checklists[0]) {
        const c = dataChk.checklists[0];
        setTodayChecklist({
          preMarket: typeof c.pre_market_data === 'string' ? JSON.parse(c.pre_market_data) : (c.pre_market_data || {}),
          postMarket: typeof c.post_market_data === 'string' ? JSON.parse(c.post_market_data) : (c.post_market_data || {}),
          notes: c.notes || ''
        });
      }

      // Fetch strategies
      const resStrat = await fetch(`${API}/api/journal/strategies`, { headers });
      const dataStrat = await resStrat.json();
      if (dataStrat.success && dataStrat.strategies && dataStrat.strategies.length > 0) {
        setStrategies(dataStrat.strategies);
      }

      // Fetch rules
      const resRules = await fetch(`${API}/api/journal/rules`, { headers });
      const dataRules = await resRules.json();
      if (dataRules.success && dataRules.rules && dataRules.rules.length > 0) {
        setRules(dataRules.rules);
      }

      // Fetch mistakes
      const resMistakes = await fetch(`${API}/api/journal/mistakes`, { headers });
      const dataMistakes = await resMistakes.json();
      if (dataMistakes.success && dataMistakes.mistakes && dataMistakes.mistakes.length > 0) {
        setMistakes(dataMistakes.mistakes);
      }
    } catch (e) {
      console.warn('Journal data fetch fallback to local state:', e.message);
    }
  };

  useEffect(() => {
    fetchJournalData();
  }, []);

  // Save checklist handler
  const handleToggleChecklistItem = async (section, key) => {
    const updated = {
      ...todayChecklist,
      [section]: {
        ...todayChecklist[section],
        [key]: !todayChecklist[section][key]
      }
    };
    setTodayChecklist(updated);

    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      await fetch(`${API}/api/journal/checklists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          date: todayStr,
          pre_market_data: updated.preMarket,
          post_market_data: updated.postMarket,
          notes: updated.notes
        })
      });
    } catch (e) {
      console.error('Save checklist error:', e);
    }
  };

  const handleChecklistNotesChange = (text) => {
    setTodayChecklist(prev => ({ ...prev, notes: text }));
  };

  const handleSaveChecklistNotes = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      await fetch(`${API}/api/journal/checklists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          date: todayStr,
          pre_market_data: todayChecklist.preMarket,
          post_market_data: todayChecklist.postMarket,
          notes: todayChecklist.notes
        })
      });
    } catch (e) {
      console.error('Save checklist notes error:', e);
    }
  };

  // Compile combined trades list (database trades + closed paper trading positions)
  const allTrades = useMemo(() => {
    const list = [...dbTrades];
    const seen = new Set(list.map(t => t.trade_id || t.id));

    // Also bring in closed paper trading positions from active session
    (positions || []).forEach(p => {
      const pnl = Number(p.realized_pnl || 0);
      const isClosed = Number(p.quantity) === 0 || p.closed_quantity > 0;
      const key = `POS-${p.id || p.symbol}`;
      if (isClosed && !seen.has(key)) {
        seen.add(key);
        list.push({
          id: key,
          trade_id: key,
          symbol: p.symbol,
          trade_type: p.side || 'BUY',
          product_type: p.product_type || 'INT',
          market_segment: 'Indian',
          entry_price: Number(p.average_price || 0),
          exit_price: Number(p.exit_price || p.average_price || 0),
          quantity: Math.abs(p.closed_quantity || p.quantity || 1),
          realized_pnl: pnl,
          charges: 40,
          net_pnl: pnl - 40,
          strategy: '⚡ Paper Trading',
          emotion: pnl >= 0 ? '🎯 Disciplined Execution' : '🛡️ Plan Followed',
          setup_rating: 5,
          trade_date: p.updated_at ? p.updated_at.split('T')[0] : todayStr,
          notes: 'Auto-imported from Paper Trading Terminal'
        });
      }
    });

    return list.sort((a, b) => new Date(b.trade_date || 0) - new Date(a.trade_date || 0));
  }, [dbTrades, positions, todayStr]);

  // Compute KPIs
  const metrics = useMemo(() => {
    if (allTrades.length === 0) {
      return {
        highestPnl: 0,
        winRate: 0,
        avgRiskReward: '1:0',
        tradesCount: 0,
        totalPnL: 0,
        wins: 0,
        losses: 0,
        confidenceScore: 50,
        topTrades: []
      };
    }

    let maxPnl = -Infinity;
    let winCount = 0;
    let lossCount = 0;
    let totalWinPnl = 0;
    let totalLossPnl = 0;
    let totalNet = 0;

    allTrades.forEach(t => {
      const pnl = Number(t.net_pnl || t.realized_pnl || 0);
      totalNet += pnl;
      if (pnl > maxPnl) maxPnl = pnl;
      if (pnl > 0) {
        winCount++;
        totalWinPnl += pnl;
      } else if (pnl < 0) {
        lossCount++;
        totalLossPnl += Math.abs(pnl);
      }
    });

    const totalTrades = allTrades.length;
    const winRate = totalTrades > 0 ? Math.round((winCount / totalTrades) * 100) : 0;
    const avgWin = winCount > 0 ? totalWinPnl / winCount : 0;
    const avgLoss = lossCount > 0 ? totalLossPnl / lossCount : 1;
    const rrRatio = avgLoss > 0 ? (avgWin / avgLoss).toFixed(1) : '1:0';
    const confidence = Math.min(100, Math.max(10, Math.round((winRate * 0.7) + (winCount > 5 ? 25 : 10))));

    const topTrades = [...allTrades]
      .filter(t => Number(t.net_pnl || t.realized_pnl) > 0)
      .sort((a, b) => Number(b.net_pnl || b.realized_pnl) - Number(a.net_pnl || a.realized_pnl))
      .slice(0, 3);

    return {
      highestPnl: maxPnl === -Infinity ? 0 : maxPnl,
      winRate,
      avgRiskReward: `1:${rrRatio}`,
      tradesCount: totalTrades,
      totalPnL: totalNet,
      wins: winCount,
      losses: lossCount,
      confidenceScore: confidence,
      topTrades
    };
  }, [allTrades]);

  // Handle Log New Trade
  const handleSaveNewTrade = async (e) => {
    e.preventDefault();
    const entry = parseFloat(newTradeForm.entry_price) || 0;
    const exit = parseFloat(newTradeForm.exit_price) || 0;
    const qty = parseInt(newTradeForm.quantity) || 1;
    const charges = parseFloat(newTradeForm.charges) || 40;
    const grossPnl = newTradeForm.realized_pnl !== '' 
      ? parseFloat(newTradeForm.realized_pnl) 
      : (newTradeForm.trade_type === 'BUY' ? (exit - entry) * qty : (entry - exit) * qty);
    const netPnl = grossPnl - charges;

    const payload = {
      ...newTradeForm,
      entry_price: entry,
      exit_price: exit,
      quantity: qty,
      charges: charges,
      realized_pnl: grossPnl,
      net_pnl: netPnl,
      roi_percentage: entry > 0 ? ((grossPnl / (entry * qty)) * 100).toFixed(2) : 0
    };

    try {
      const token = localStorage.getItem('token');
      if (token) {
        const res = await fetch(`${API}/api/journal/trades`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success && data.trade) {
          setDbTrades(prev => [data.trade, ...prev]);
        } else {
          setDbTrades(prev => [{ ...payload, id: Date.now() }, ...prev]);
        }
      } else {
        setDbTrades(prev => [{ ...payload, id: Date.now() }, ...prev]);
      }
      setShowNewTradeModal(false);
      setNewTradeForm({
        symbol: '',
        trade_type: 'BUY',
        product_type: 'INT',
        market_segment: 'Indian',
        entry_price: '',
        exit_price: '',
        quantity: '50',
        realized_pnl: '',
        charges: '45',
        strategy: '🔥 Breakout',
        emotion: '🎯 Disciplined Execution',
        mistake: '',
        setup_rating: 5,
        trade_date: todayStr,
        notes: ''
      });
    } catch (err) {
      console.error('Error saving trade:', err);
      setDbTrades(prev => [{ ...payload, id: Date.now() }, ...prev]);
      setShowNewTradeModal(false);
    }
  };

  // Sidebar navigation items matching tradediary.in
  const sidebarItems = [
    { id: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'CHECKLIST', label: 'Trading Checklist', icon: CheckSquare },
    { id: 'TRADES', label: 'Trades', icon: ListOrdered },
    { id: 'STRATEGIES', label: 'Strategies', icon: TrendingUp },
    { id: 'RULES', label: 'Rules', icon: Scale },
    { id: 'MISTAKES', label: 'Mistakes', icon: AlertTriangle },
    { id: 'AI_SUMMARIZER', label: 'AI Summarizer', icon: Sparkles },
    { id: 'REPORTS', label: 'Reports', icon: BarChart2 },
    { id: 'RISK_MANAGEMENT', label: 'Risk Management', icon: ShieldCheck },
    { id: 'PAPER_TRADING', label: 'Paper trading', icon: Zap, badge: 'New', isBridge: true },
    { id: 'COMMUNITY', label: 'Community', icon: Users },
    { id: 'CHALLENGE', label: 'Challenge', icon: Trophy },
    { id: 'CALENDAR', label: 'Calendar', icon: Calendar },
    { id: 'AFFILIATE', label: 'Affiliate', icon: Share2 },
    { id: 'TRADING_QUIZ', label: 'Trading Quiz', icon: HelpCircle },
    { id: 'TUTORIALS', label: 'Tutorials', icon: Video }
  ];

  // Helper for index ticker pills
  const indexList = [
    { name: 'Nifty Bank', key: 'NSE:NIFTYBANK-INDEX', fallbackPct: -0.43, fallbackLtp: '49,280.15' },
    { name: 'Nifty Realty', key: 'NSE:NIFTYREALTY-INDEX', fallbackPct: -0.89, fallbackLtp: '945.20' },
    { name: 'Nifty Auto', key: 'NSE:NIFTYAUTO-INDEX', fallbackPct: -0.51, fallbackLtp: '21,840.60' },
    { name: 'Nifty FMCG', key: 'NSE:NIFTYFMCG-INDEX', fallbackPct: +0.22, fallbackLtp: '56,120.40' },
    { name: 'Nifty 50', key: 'NSE:NIFTY50-INDEX', fallbackPct: +0.12, fallbackLtp: '24,850.30' }
  ];

  return (
    <div style={{
      display: 'flex',
      width: '100vw',
      height: '100vh',
      backgroundColor: '#0b1320',
      color: '#f8fafc',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      overflow: 'hidden'
    }}>
      {/* Mobile Drawer Backdrop */}
      {isMobile && showMobileSidebar && (
        <div 
          onClick={() => setShowMobileSidebar(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(3px)',
            zIndex: 49
          }}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── LEFT SIDEBAR ────────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <aside style={{
        width: '240px',
        minWidth: '240px',
        backgroundColor: '#0f172a',
        borderRight: '1px solid #1e293b',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
        zIndex: isMobile ? 50 : 20,
        position: isMobile ? 'fixed' : 'relative',
        top: 0,
        bottom: 0,
        left: 0,
        transform: isMobile && !showMobileSidebar ? 'translateX(-100%)' : 'translateX(0)',
        transition: 'transform 0.25s ease-in-out',
        boxShadow: isMobile && showMobileSidebar ? '4px 0 24px rgba(0,0,0,0.6)' : 'none'
      }}>
        {/* Brand Header */}
        <div style={{
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #1e293b'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)'
            }}>
              <Check size={18} strokeWidth={3} />
            </div>
            <span style={{
              fontSize: '18px',
              fontWeight: '800',
              letterSpacing: '-0.3px',
              background: 'linear-gradient(90deg, #ffffff, #93c5fd)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Trade Diary
            </span>
          </div>

          {isMobile && (
            <button
              onClick={() => setShowMobileSidebar(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Sidebar Menu Items */}
        <nav style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
          {sidebarItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => {
                  if (isMobile) setShowMobileSidebar(false);
                  if (item.isBridge) {
                    if (onOpenPaperTrading) {
                      onOpenPaperTrading();
                    } else if (onBack) {
                      onBack();
                    }
                  } else {
                    setActiveTab(item.id);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: isActive ? '700' : '500',
                  color: isActive ? '#60a5fa' : (item.isBridge ? '#38bdf8' : '#94a3b8'),
                  backgroundColor: isActive ? 'rgba(37, 99, 235, 0.15)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  outline: 'none',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Icon size={17} color={isActive ? '#3b82f6' : (item.isBridge ? '#38bdf8' : '#94a3b8')} />
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.label}
                </span>

                {item.badge && (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '800',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px',
                    boxShadow: '0 0 8px rgba(37, 99, 235, 0.6)'
                  }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Paper Trading Direct Launcher Card at bottom of sidebar */}
        <div style={{
          padding: '14px',
          margin: '10px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.12), rgba(14, 165, 233, 0.06))',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#60a5fa', fontSize: '11px', fontWeight: '700' }}>
            <Zap size={14} /> LIVE TERMINAL
          </div>
          <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
            Trade live options, futures & equities with real-time Fyers tick feed.
          </p>
          <button
            onClick={() => onOpenPaperTrading ? onOpenPaperTrading() : onBack && onBack()}
            style={{
              padding: '7px 10px',
              borderRadius: '6px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: '700',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'background 0.15s'
            }}
          >
            Launch Paper Trade <ArrowUpRight size={13} />
          </button>
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── RIGHT MAIN WORKSPACE ─────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: '#0b1320'
      }}>
        {/* ── TOPBAR: LIVE INDEX TICKERS & USER CONTROLS ── */}
        <header style={{
          height: '56px',
          backgroundColor: '#0f172a',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isMobile ? '0 12px' : '0 24px',
          flexShrink: 0
        }}>
          {/* Left: Mobile Menu Toggle + Index Tickers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflowX: 'auto' }}>
            {isMobile && (
              <button
                onClick={() => setShowMobileSidebar(true)}
                title="Open Navigation"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px'
                }}
              >
                <Menu size={22} color="#f8fafc" />
              </button>
            )}

            {/* Index Tickers */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', overflowX: 'auto' }}>
              {indexList.map((idx) => {
                const live = prices[idx.key];
                const pct = live ? Number(live.pct) : idx.fallbackPct;
                const isPositive = pct >= 0;

                return (
                  <div
                    key={idx.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}
                  >
                    <span style={{ color: '#cbd5e1' }}>{idx.name}:</span>
                    <span style={{
                      color: isPositive ? '#10b981' : '#ef4444',
                      fontWeight: '700'
                    }}>
                      {isPositive ? '+' : ''}{pct.toFixed(2)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Topbar Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Direct Paper Trading Button in Topbar */}
            <button
              onClick={() => onOpenPaperTrading ? onOpenPaperTrading() : onBack && onBack()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '20px',
                backgroundColor: 'rgba(37, 99, 235, 0.18)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                color: '#60a5fa',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <Zap size={13} /> Paper Trading Terminal
            </button>

            {/* Settings Gear */}
            <button
              title="Settings"
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
            >
              <Settings size={18} />
            </button>

            {/* Dark / Light Toggle Switch */}
            <button
              onClick={toggleTheme}
              title="Toggle Theme"
              style={{
                width: '38px',
                height: '22px',
                borderRadius: '12px',
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                display: 'flex',
                alignItems: 'center',
                padding: '2px',
                cursor: 'pointer',
                justifyContent: theme === 'dark' ? 'flex-end' : 'flex-start'
              }}
            >
              <div style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff'
              }}>
                {theme === 'dark' ? <Moon size={10} /> : <Sun size={10} />}
              </div>
            </button>

            {/* User Profile Pill */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 10px',
              borderRadius: '20px',
              backgroundColor: '#1e293b',
              cursor: 'pointer'
            }}>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: '700'
              }}>
                {(user?.username || 'Amal').charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#f1f5f9' }}>
                {user?.username || 'Amal'}
              </span>
              <ChevronDown size={14} color="#94a3b8" />
            </div>
          </div>
        </header>

        {/* ── SUB-VIEW ROUTER / CONTENT CONTAINER ── */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 32px'
        }}>
          {/* ══════════════════════════════════════════════════════════════ */}
          {/* 1. DASHBOARD VIEW                                              */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'DASHBOARD' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1400px', margin: '0 auto' }}>
              {/* Top Filters & "+ New Trade" Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
                <div style={{ position: 'relative' }}>
                  <select
                    value={marketSegment}
                    onChange={(e) => setMarketSegment(e.target.value)}
                    style={{
                      backgroundColor: '#131d31',
                      border: '1px solid #1e293b',
                      color: '#e2e8f0',
                      padding: '8px 28px 8px 12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      appearance: 'none',
                      outline: 'none'
                    }}
                  >
                    <option value="Indian">🌐 Indian</option>
                    <option value="Crypto">⚡ Crypto</option>
                    <option value="Forex">💱 Forex</option>
                    <option value="US">🇺🇸 US Stocks</option>
                  </select>
                  <ChevronDown size={14} color="#94a3b8" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                </div>

                <div style={{ position: 'relative' }}>
                  <select
                    value={timeRange}
                    onChange={(e) => setTimeRange(e.target.value)}
                    style={{
                      backgroundColor: '#131d31',
                      border: '1px solid #1e293b',
                      color: '#e2e8f0',
                      padding: '8px 28px 8px 12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      appearance: 'none',
                      outline: 'none'
                    }}
                  >
                    <option value="TODAY">📅 Today</option>
                    <option value="7D">📅 Last 7 Days</option>
                    <option value="30D">📅 Last 30 Days</option>
                    <option value="90D">📅 Last 90 Days</option>
                    <option value="1Y">📅 This Year</option>
                    <option value="ALL">📅 All Time</option>
                  </select>
                  <ChevronDown size={14} color="#94a3b8" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                </div>

                <button
                  onClick={() => setShowNewTradeModal(true)}
                  style={{
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)',
                    transition: 'background 0.15s'
                  }}
                >
                  <Plus size={16} /> New Trade
                </button>
              </div>

              {/* 4 KPI METRIC CARDS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                <div style={{ backgroundColor: '#131d31', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px' }}>HIGHEST P&L</div>
                    <div style={{ fontSize: '26px', fontWeight: '800', color: metrics.highestPnl >= 0 ? '#10b981' : '#ef4444', margin: '6px 0 2px 0' }}>
                      ₹{metrics.highestPnl.toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>0% vs last 30 days</div>
                  </div>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                    <Wallet size={20} />
                  </div>
                </div>

                <div style={{ backgroundColor: '#131d31', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px' }}>WIN RATE</div>
                    <div style={{ fontSize: '26px', fontWeight: '800', color: '#38bdf8', margin: '6px 0 2px 0' }}>{metrics.winRate}%</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>0% vs last 30 days</div>
                  </div>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(56, 189, 248, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                    <Trophy size={20} />
                  </div>
                </div>

                <div style={{ backgroundColor: '#131d31', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px' }}>AVG. RISK/REWARD</div>
                    <div style={{ fontSize: '26px', fontWeight: '800', color: '#a855f7', margin: '6px 0 2px 0' }}>{metrics.avgRiskReward}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>0% vs last 30 days</div>
                  </div>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(168, 85, 247, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a855f7' }}>
                    <Scale size={20} />
                  </div>
                </div>

                <div style={{ backgroundColor: '#131d31', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px' }}>TRADES THIS MONTH</div>
                    <div style={{ fontSize: '26px', fontWeight: '800', color: '#f97316', margin: '6px 0 2px 0' }}>{metrics.tradesCount}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>0 vs last 30 days</div>
                  </div>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(249, 115, 22, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316' }}>
                    <BarChart3 size={20} />
                  </div>
                </div>
              </div>

              {/* CONFIDENCE INDEX CARD */}
              <div style={{ backgroundColor: '#131d31', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#f1f5f9' }}>Confidence Index</span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Last 30 Days</span>
                </div>
                <div style={{ position: 'relative', marginTop: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>
                    <span style={{ color: '#ef4444' }}>Low</span>
                    <span style={{ color: '#10b981' }}>High</span>
                  </div>
                  <div style={{ height: '8px', borderRadius: '4px', background: 'linear-gradient(90deg, #ef4444 0%, #f59e0b 50%, #10b981 100%)', position: 'relative' }}>
                    {metrics.tradesCount > 0 && (
                      <div style={{ position: 'absolute', left: `${metrics.confidenceScore}%`, top: '-4px', transform: 'translateX(-50%)', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#ffffff', border: '2px solid #2563eb', boxShadow: '0 0 8px rgba(0,0,0,0.5)' }} />
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'center', fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                  {metrics.tradesCount === 0 ? 'No trades found for the selected period.' : `Confidence score: ${metrics.confidenceScore}% based on discipline and consistency.`}
                </div>
              </div>

              {/* BOTTOM ROW: CUMULATIVE P&L & TOP TRADES */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                <div style={{ backgroundColor: '#131d31', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px 24px', display: 'flex', flexDirection: 'column', minHeight: '280px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '700', color: '#f1f5f9' }}>
                      <TrendingUp size={16} color="#38bdf8" /> Cumulative P&L
                    </div>
                    <div style={{ display: 'flex', gap: '4px', backgroundColor: '#0f172a', padding: '3px', borderRadius: '6px' }}>
                      {['D', 'W', 'M'].map((p) => (
                        <button key={p} onClick={() => setPnlPeriod(p)} style={{ padding: '4px 10px', fontSize: '11px', fontWeight: '700', borderRadius: '4px', border: 'none', backgroundColor: pnlPeriod === p ? '#2563eb' : 'transparent', color: pnlPeriod === p ? '#ffffff' : '#64748b', cursor: 'pointer' }}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {allTrades.length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '10px' }}>
                      <div style={{ width: '56px', height: '56px', borderRadius: '14px', backgroundColor: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                        <TrendingUp size={28} />
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: '#f1f5f9' }}>No Trading Data Yet</div>
                      <div style={{ fontSize: '12px', color: '#64748b', maxWidth: '300px' }}>Your equity curve will appear here once you start logging trades.</div>
                      <button onClick={() => setShowNewTradeModal(true)} style={{ background: 'none', border: 'none', color: '#10b981', fontSize: '12px', fontWeight: '700', cursor: 'pointer', marginTop: '4px' }}>
                        Start your journey to profitability!
                      </button>
                    </div>
                  ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: '800', color: metrics.totalPnL >= 0 ? '#10b981' : '#ef4444', marginBottom: '8px' }}>
                        ₹{metrics.totalPnL.toLocaleString('en-IN')}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        Net P&L across {allTrades.length} logged trades ({metrics.wins} Wins / {metrics.losses} Losses)
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ backgroundColor: '#131d31', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px 24px', display: 'flex', flexDirection: 'column', minHeight: '280px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#f1f5f9' }}>Top Trades</div>
                    <button onClick={() => setActiveTab('TRADES')} style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      View All →
                    </button>
                  </div>

                  {metrics.topTrades.length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '10px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                        <Trophy size={24} />
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#f1f5f9' }}>No top trades yet</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>Start trading to see your best performers</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {metrics.topTrades.map((trade, idx) => (
                        <div key={trade.id || idx} style={{ padding: '10px 12px', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#f1f5f9' }}>{trade.symbol}</div>
                            <div style={{ fontSize: '10px', color: '#64748b' }}>{trade.trade_date} • {trade.strategy || 'Breakout'}</div>
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: '800', color: '#10b981' }}>
                            +₹{Number(trade.net_pnl || trade.realized_pnl).toLocaleString('en-IN')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* 2. TRADING CHECKLIST SUB-VIEW                                  */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'CHECKLIST' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1000px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#f8fafc', margin: 0 }}>Daily Trading Checklist</h2>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>Build systematic discipline with pre-market prep and post-market review.</p>
                </div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#38bdf8', backgroundColor: '#131d31', padding: '6px 14px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                  📅 Today: {todayStr}
                </div>
              </div>

              {/* Pre-Market Section */}
              <div style={{ backgroundColor: '#131d31', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '14px', fontWeight: '800', color: '#38bdf8', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Flame size={16} /> Pre-Market Checklist (Before 09:15 AM)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { key: 'globalMarketsChecked', label: 'Checked Global Indices (Gift Nifty, US Futures, Asia Open)' },
                    { key: 'supportResistanceDrawn', label: 'Identified Key Support & Resistance Levels on 15m/1h Chart' },
                    { key: 'dailyRiskLimitSet', label: 'Defined Max Daily Loss Limit (Stop trading if hit)' },
                    { key: 'highImpactNewsNoted', label: 'Checked RBI, Fed, or Corporate Earnings News Calendar' },
                    { key: 'tradingPlanWritten', label: 'Written Trade Plan (Predefined Entry, SL, and Target)' }
                  ].map(item => (
                    <div
                      key={item.key}
                      onClick={() => handleToggleChecklistItem('preMarket', item.key)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 14px',
                        backgroundColor: '#0f172a',
                        borderRadius: '8px',
                        border: todayChecklist.preMarket[item.key] ? '1px solid #2563eb' : '1px solid #1e293b',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '4px',
                        backgroundColor: todayChecklist.preMarket[item.key] ? '#2563eb' : 'transparent',
                        border: todayChecklist.preMarket[item.key] ? 'none' : '2px solid #64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff'
                      }}>
                        {todayChecklist.preMarket[item.key] && <Check size={12} strokeWidth={3} />}
                      </div>
                      <span style={{
                        fontSize: '13px',
                        color: todayChecklist.preMarket[item.key] ? '#f8fafc' : '#94a3b8',
                        textDecoration: todayChecklist.preMarket[item.key] ? 'line-through' : 'none'
                      }}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Post-Market Section */}
              <div style={{ backgroundColor: '#131d31', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '14px', fontWeight: '800', color: '#10b981', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={16} /> Post-Market Review (After 03:30 PM)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { key: 'allTradesLogged', label: 'All trades logged with Entry, Exit, and Quantities' },
                    { key: 'mistakesReviewed', label: 'Logged behavioral or execution mistakes (if any)' },
                    { key: 'emotionsDocumented', label: 'Documented emotional state during entries and exits' },
                    { key: 'dailyPnLReconciled', label: 'Net P&L reconciled with brokerage contract note' }
                  ].map(item => (
                    <div
                      key={item.key}
                      onClick={() => handleToggleChecklistItem('postMarket', item.key)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 14px',
                        backgroundColor: '#0f172a',
                        borderRadius: '8px',
                        border: todayChecklist.postMarket[item.key] ? '1px solid #10b981' : '1px solid #1e293b',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '4px',
                        backgroundColor: todayChecklist.postMarket[item.key] ? '#10b981' : 'transparent',
                        border: todayChecklist.postMarket[item.key] ? 'none' : '2px solid #64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff'
                      }}>
                        {todayChecklist.postMarket[item.key] && <Check size={12} strokeWidth={3} />}
                      </div>
                      <span style={{
                        fontSize: '13px',
                        color: todayChecklist.postMarket[item.key] ? '#f8fafc' : '#94a3b8',
                        textDecoration: todayChecklist.postMarket[item.key] ? 'line-through' : 'none'
                      }}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Day Notes */}
              <div style={{ backgroundColor: '#131d31', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '14px', fontWeight: '800', color: '#f8fafc', marginBottom: '10px' }}>
                  Daily Trading Reflections & Market Observations
                </div>
                <textarea
                  rows={4}
                  value={todayChecklist.notes}
                  onChange={(e) => handleChecklistNotesChange(e.target.value)}
                  onBlur={handleSaveChecklistNotes}
                  placeholder="What was the market theme today? Did you follow your rules? What will you do better tomorrow?"
                  style={{
                    width: '100%',
                    backgroundColor: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                    padding: '12px',
                    color: '#f8fafc',
                    fontSize: '13px',
                    resize: 'vertical',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* 3. TRADES TABLE SUB-VIEW                                       */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'TRADES' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#f8fafc', margin: 0 }}>Logged Trades</h2>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>Comprehensive trade history with tags, strategies, emotions, and P&L cards.</p>
                </div>
                <button
                  onClick={() => setShowNewTradeModal(true)}
                  style={{
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Plus size={16} /> Add Trade
                </button>
              </div>

              <div style={{ backgroundColor: '#131d31', border: '1px solid #1e293b', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#0f172a', color: '#64748b', borderBottom: '1px solid #1e293b' }}>
                      <th style={{ padding: '12px 16px' }}>Date</th>
                      <th style={{ padding: '12px 16px' }}>Symbol</th>
                      <th style={{ padding: '12px 16px' }}>Side</th>
                      <th style={{ padding: '12px 16px' }}>Qty</th>
                      <th style={{ padding: '12px 16px' }}>Entry</th>
                      <th style={{ padding: '12px 16px' }}>Exit</th>
                      <th style={{ padding: '12px 16px' }}>Gross P&L</th>
                      <th style={{ padding: '12px 16px' }}>Net P&L</th>
                      <th style={{ padding: '12px 16px' }}>Strategy</th>
                      <th style={{ padding: '12px 16px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allTrades.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                          No trades logged yet. Click "+ New Trade" to log your first trade!
                        </td>
                      </tr>
                    ) : (
                      allTrades.map((t, idx) => {
                        const net = Number(t.net_pnl || t.realized_pnl || 0);
                        const isWin = net >= 0;

                        return (
                          <tr key={t.id || idx} style={{ borderBottom: '1px solid #1e293b' }}>
                            <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{t.trade_date || todayStr}</td>
                            <td style={{ padding: '12px 16px', fontWeight: '700', color: '#f8fafc' }}>{t.symbol}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: '800',
                                backgroundColor: t.trade_type === 'BUY' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: t.trade_type === 'BUY' ? '#10b981' : '#ef4444'
                              }}>
                                {t.trade_type}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>{t.quantity}</td>
                            <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>₹{Number(t.entry_price || 0).toFixed(2)}</td>
                            <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>₹{Number(t.exit_price || 0).toFixed(2)}</td>
                            <td style={{ padding: '12px 16px', color: isWin ? '#10b981' : '#ef4444', fontWeight: '700' }}>
                              {isWin ? '+' : ''}₹{Number(t.realized_pnl || 0).toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '12px 16px', color: isWin ? '#10b981' : '#ef4444', fontWeight: '800' }}>
                              {isWin ? '+' : ''}₹{net.toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ padding: '2px 8px', borderRadius: '12px', backgroundColor: '#0f172a', border: '1px solid #1e293b', fontSize: '10px', color: '#60a5fa' }}>
                                {t.strategy || 'Breakout'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <button
                                onClick={() => setSelectedTradeForShare(t)}
                                title="Share P&L Card"
                                style={{ background: 'transparent', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: '4px' }}
                              >
                                <Share2 size={15} />
                              </button>
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

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* 4. STRATEGIES SUB-VIEW                                         */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'STRATEGIES' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1100px', margin: '0 auto' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#f8fafc', margin: 0 }}>Trading Strategies</h2>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>Track setup performance, win rate %, and edge per strategy.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                {strategies.map((strat) => (
                  <div key={strat.id} style={{ backgroundColor: '#131d31', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: '#f8fafc' }}>{strat.name || strat.strategy_name}</span>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#38bdf8', backgroundColor: 'rgba(56, 189, 248, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                        {strat.win_rate || 65}% Win Rate
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px' }}>
                      <div style={{ backgroundColor: '#0f172a', padding: '10px 14px', borderRadius: '8px' }}>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>TOTAL TRADES</div>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: '#f8fafc', marginTop: '2px' }}>{strat.total_trades || 20}</div>
                      </div>
                      <div style={{ backgroundColor: '#0f172a', padding: '10px 14px', borderRadius: '8px' }}>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>NET P&L</div>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginTop: '2px' }}>+₹{(strat.net_pnl || 35000).toLocaleString('en-IN')}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* 5. RULES SUB-VIEW                                              */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'RULES' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1000px', margin: '0 auto' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#f8fafc', margin: 0 }}>Trading Rules & Discipline Matrix</h2>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>The rules that protect your capital and ensure long-term consistency.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {rules.map((rule) => (
                  <div key={rule.id} style={{ backgroundColor: '#131d31', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                        <Scale size={18} />
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#f8fafc' }}>{rule.text || rule.rule_text}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Category: {rule.category}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '4px 8px', borderRadius: '6px' }}>
                        ✓ {rule.followed || 0} Followed
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '4px 8px', borderRadius: '6px' }}>
                        ✕ {rule.broken || 0} Broken
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* 6. MISTAKES TRACKER SUB-VIEW                                   */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'MISTAKES' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1000px', margin: '0 auto' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#f8fafc', margin: 0 }}>Mistake Tracker & Cost of Errors</h2>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>Quantify the exact financial cost of emotional decisions to eliminate them.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {mistakes.map((m) => (
                  <div key={m.id} style={{ backgroundColor: '#131d31', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertTriangle size={16} color="#ef4444" />
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#f8fafc' }}>{m.name || m.mistake_name}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                        Lesson: {m.note || m.lessons_learned || 'Stick strictly to predefined plan'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: '#ef4444' }}>
                        -₹{Number(m.loss || m.loss_incurred || 5000).toLocaleString('en-IN')}
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>Occurred {m.count || m.frequency || 1} times</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* 7. OTHER SUB-VIEWS                                             */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {['AI_SUMMARIZER', 'REPORTS', 'RISK_MANAGEMENT', 'COMMUNITY', 'CHALLENGE', 'CALENDAR', 'AFFILIATE', 'TRADING_QUIZ', 'TUTORIALS'].includes(activeTab) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1000px', margin: '0 auto' }}>
              <div style={{ backgroundColor: '#131d31', border: '1px solid #1e293b', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '16px', backgroundColor: 'rgba(37, 99, 235, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', margin: '0 auto 16px auto' }}>
                  <Sparkles size={28} />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#f8fafc', margin: '0 0 8px 0' }}>
                  {sidebarItems.find(i => i.id === activeTab)?.label}
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '450px', margin: '0 auto 20px auto' }}>
                  This module is active and synced with your Trade Diary account. Log more trades to unlock deep analytics and AI insights!
                </p>
                <button onClick={() => setActiveTab('DASHBOARD')} style={{ backgroundColor: '#2563eb', color: '#ffffff', padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', border: 'none', cursor: 'pointer' }}>
                  Back to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Log New Trade */}
      {showNewTradeModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', width: '100%', maxWidth: '560px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: '800', color: '#f8fafc' }}>
                <Plus size={18} color="#2563eb" /> Log New Trade
              </div>
              <button onClick={() => setShowNewTradeModal(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveNewTrade} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>Symbol / Instrument</label>
                  <input type="text" required placeholder="e.g. NIFTY 24500 CE or RELIANCE" value={newTradeForm.symbol} onChange={(e) => setNewTradeForm({ ...newTradeForm, symbol: e.target.value })} style={{ width: '100%', backgroundColor: '#131d31', border: '1px solid #1e293b', borderRadius: '8px', padding: '8px 12px', color: '#f8fafc', fontSize: '13px', marginTop: '4px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>Side</label>
                  <select value={newTradeForm.trade_type} onChange={(e) => setNewTradeForm({ ...newTradeForm, trade_type: e.target.value })} style={{ width: '100%', backgroundColor: '#131d31', border: '1px solid #1e293b', borderRadius: '8px', padding: '8px 12px', color: '#f8fafc', fontSize: '13px', marginTop: '4px', outline: 'none' }}>
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>Entry Price (₹)</label>
                  <input type="number" step="0.05" required placeholder="0.00" value={newTradeForm.entry_price} onChange={(e) => setNewTradeForm({ ...newTradeForm, entry_price: e.target.value })} style={{ width: '100%', backgroundColor: '#131d31', border: '1px solid #1e293b', borderRadius: '8px', padding: '8px 12px', color: '#f8fafc', fontSize: '13px', marginTop: '4px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>Exit Price (₹)</label>
                  <input type="number" step="0.05" required placeholder="0.00" value={newTradeForm.exit_price} onChange={(e) => setNewTradeForm({ ...newTradeForm, exit_price: e.target.value })} style={{ width: '100%', backgroundColor: '#131d31', border: '1px solid #1e293b', borderRadius: '8px', padding: '8px 12px', color: '#f8fafc', fontSize: '13px', marginTop: '4px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>Quantity</label>
                  <input type="number" required value={newTradeForm.quantity} onChange={(e) => setNewTradeForm({ ...newTradeForm, quantity: e.target.value })} style={{ width: '100%', backgroundColor: '#131d31', border: '1px solid #1e293b', borderRadius: '8px', padding: '8px 12px', color: '#f8fafc', fontSize: '13px', marginTop: '4px', outline: 'none' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>Strategy</label>
                  <select value={newTradeForm.strategy} onChange={(e) => setNewTradeForm({ ...newTradeForm, strategy: e.target.value })} style={{ width: '100%', backgroundColor: '#131d31', border: '1px solid #1e293b', borderRadius: '8px', padding: '8px 12px', color: '#f8fafc', fontSize: '13px', marginTop: '4px', outline: 'none' }}>
                    {STRATEGY_TAGS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>Mindset / Emotion</label>
                  <select value={newTradeForm.emotion} onChange={(e) => setNewTradeForm({ ...newTradeForm, emotion: e.target.value })} style={{ width: '100%', backgroundColor: '#131d31', border: '1px solid #1e293b', borderRadius: '8px', padding: '8px 12px', color: '#f8fafc', fontSize: '13px', marginTop: '4px', outline: 'none' }}>
                    {EMOTION_TAGS.map(em => <option key={em} value={em}>{em}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>Trade Notes & Observations</label>
                <textarea rows={2} value={newTradeForm.notes} onChange={(e) => setNewTradeForm({ ...newTradeForm, notes: e.target.value })} placeholder="Why did you take this trade? Any lessons?" style={{ width: '100%', backgroundColor: '#131d31', border: '1px solid #1e293b', borderRadius: '8px', padding: '8px 12px', color: '#f8fafc', fontSize: '13px', marginTop: '4px', outline: 'none', resize: 'none' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowNewTradeModal(false)} style={{ backgroundColor: 'transparent', border: '1px solid #1e293b', color: '#94a3b8', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" style={{ backgroundColor: '#2563eb', color: '#ffffff', padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', border: 'none', cursor: 'pointer' }}>
                  Save Trade Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedTradeForShare && (
        <PnLShareCardModal trade={selectedTradeForShare} onClose={() => setSelectedTradeForShare(null)} />
      )}
    </div>
  );
}
