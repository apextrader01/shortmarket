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
  
  // Responsive Breakpoints
  const [windowWidth, setWindowWidth] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1200);
  const isMobile = windowWidth <= 850;
  const isSmallMobile = windowWidth <= 520;
  const isTinyMobile = windowWidth <= 380;

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Theme Palette Resolver
  const isLight = theme === 'light';
  const colors = useMemo(() => ({
    bgMain: isLight ? '#f4f6f8' : '#0b1320',
    bgSidebar: isLight ? '#ffffff' : '#0f172a',
    bgCard: isLight ? '#ffffff' : '#131d31',
    bgInner: isLight ? '#f8fafc' : '#0f172a',
    bgInput: isLight ? '#ffffff' : '#131d31',
    borderColor: isLight ? '#e2e8f0' : '#1e293b',
    borderHighlight: isLight ? '#cbd5e1' : '#334155',
    textPrimary: isLight ? '#0f172a' : '#f8fafc',
    textSecondary: isLight ? '#475569' : '#94a3b8',
    textMuted: isLight ? '#94a3b8' : '#64748b',
    accentBlue: '#2563eb',
    accentBlueLight: isLight ? '#1d4ed8' : '#60a5fa',
    accentGreen: isLight ? '#16a34a' : '#10b981',
    accentRed: isLight ? '#dc2626' : '#ef4444',
    cardShadow: isLight ? '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' : 'none'
  }), [isLight]);

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
    { id: 'PAPER_TRADING', label: 'Paper trading', icon: Zap, badge: 'Live', isBridge: true },
    { id: 'COMMUNITY', label: 'Community', icon: Users },
    { id: 'CHALLENGE', label: 'Challenge', icon: Trophy },
    { id: 'CALENDAR', label: 'Calendar', icon: Calendar },
    { id: 'AFFILIATE', label: 'Affiliate', icon: Share2 },
    { id: 'TRADING_QUIZ', label: 'Trading Quiz', icon: HelpCircle },
    { id: 'TUTORIALS', label: 'Tutorials', icon: Video }
  ];

  // Helper for index ticker pills
  const indexList = [
    { name: 'Bank', key: 'NSE:NIFTYBANK-INDEX', fallbackPct: -0.43, fallbackLtp: '49,280.15' },
    { name: 'Nifty 50', key: 'NSE:NIFTY50-INDEX', fallbackPct: +0.12, fallbackLtp: '24,850.30' },
    { name: 'Realty', key: 'NSE:NIFTYREALTY-INDEX', fallbackPct: -0.89, fallbackLtp: '945.20' },
    { name: 'Auto', key: 'NSE:NIFTYAUTO-INDEX', fallbackPct: -0.51, fallbackLtp: '21,840.60' },
    { name: 'FMCG', key: 'NSE:NIFTYFMCG-INDEX', fallbackPct: +0.22, fallbackLtp: '56,120.40' }
  ];

  return (
    <div style={{
      display: 'flex',
      width: '100vw',
      height: '100vh',
      backgroundColor: colors.bgMain,
      color: colors.textPrimary,
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* ── MOBILE DRAWER BACKDROP ──────────────────────────────────────── */}
      {isMobile && showMobileSidebar && (
        <div 
          onClick={() => setShowMobileSidebar(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 998,
            transition: 'opacity 0.2s ease'
          }}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── LEFT SIDEBAR (Desktop Fixed / Mobile Slide-Out Drawer) ───────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <aside style={{
        width: isMobile ? '280px' : '240px',
        minWidth: isMobile ? '280px' : '240px',
        maxWidth: isMobile ? '85vw' : '240px',
        backgroundColor: colors.bgSidebar,
        borderRight: `1px solid ${colors.borderColor}`,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
        zIndex: isMobile ? 999 : 20,
        position: isMobile ? 'fixed' : 'relative',
        top: 0,
        bottom: 0,
        left: 0,
        transform: isMobile && !showMobileSidebar ? 'translateX(-100%)' : 'translateX(0)',
        transition: 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: isMobile && showMobileSidebar ? '8px 0 32px rgba(0,0,0,0.45)' : 'none'
      }}>
        {/* Brand Header */}
        <div style={{
          padding: '16px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${colors.borderColor}`,
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)'
            }}>
              <Check size={18} strokeWidth={3} />
            </div>
            <div>
              <span style={{
                fontSize: '17px',
                fontWeight: '800',
                letterSpacing: '-0.3px',
                color: colors.textPrimary
              }}>
                Trade Diary
              </span>
              <div style={{ fontSize: '10px', color: colors.textMuted, fontWeight: '600', marginTop: '-2px' }}>
                JOURNAL & TERMINAL
              </div>
            </div>
          </div>

          {isMobile && (
            <button
              onClick={() => setShowMobileSidebar(false)}
              aria-label="Close navigation"
              style={{
                background: colors.bgInner,
                border: `1px solid ${colors.borderColor}`,
                color: colors.textSecondary,
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Sidebar Navigation Items */}
        <nav style={{ padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
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
                  padding: '10px 12px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: isActive ? '700' : '500',
                  color: isActive ? colors.accentBlueLight : (item.isBridge ? (isLight ? '#0284c7' : '#38bdf8') : colors.textSecondary),
                  backgroundColor: isActive ? (isLight ? 'rgba(37, 99, 235, 0.08)' : 'rgba(37, 99, 235, 0.15)') : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  outline: 'none',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.04)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Icon size={17} color={isActive ? '#2563eb' : (item.isBridge ? '#0284c7' : (isLight ? '#64748b' : '#94a3b8'))} />
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.label}
                </span>

                {item.badge && (
                  <span style={{
                    fontSize: '9px',
                    fontWeight: '800',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px',
                    boxShadow: '0 0 8px rgba(37, 99, 235, 0.5)'
                  }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Live Terminal Launcher Card at Bottom of Sidebar */}
        <div style={{
          padding: '12px',
          margin: '8px',
          borderRadius: '10px',
          background: isLight 
            ? 'linear-gradient(135deg, rgba(37, 99, 235, 0.06), rgba(14, 165, 233, 0.04))' 
            : 'linear-gradient(135deg, rgba(37, 99, 235, 0.12), rgba(14, 165, 233, 0.06))',
          border: `1px solid ${isLight ? 'rgba(37, 99, 235, 0.2)' : 'rgba(59, 130, 246, 0.25)'}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#2563eb', fontSize: '11px', fontWeight: '800' }}>
            <Zap size={14} /> LIVE TERMINAL
          </div>
          <p style={{ fontSize: '11px', color: colors.textSecondary, margin: 0, lineHeight: 1.35 }}>
            Trade live F&O, futures & equities with real-time tick feed.
          </p>
          <button
            onClick={() => {
              if (isMobile) setShowMobileSidebar(false);
              onOpenPaperTrading ? onOpenPaperTrading() : onBack && onBack();
            }}
            style={{
              padding: '8px 10px',
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
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)',
              marginTop: '2px'
            }}
          >
            Launch Terminal <ArrowUpRight size={13} />
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
        minWidth: 0,
        overflow: 'hidden',
        backgroundColor: colors.bgMain
      }}>
        {/* ── TOPBAR: LIVE INDEX TICKERS & CONTROLS ── */}
        <header style={{
          height: isMobile ? '52px' : '56px',
          backgroundColor: colors.bgSidebar,
          borderBottom: `1px solid ${colors.borderColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isMobile ? '0 10px' : '0 24px',
          flexShrink: 0,
          gap: '8px',
          zIndex: 10
        }}>
          {/* Left: Mobile Menu Toggle + Index Tickers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
            {isMobile && (
              <button
                onClick={() => setShowMobileSidebar(true)}
                aria-label="Open Navigation"
                style={{
                  background: isLight ? '#f1f5f9' : '#1e293b',
                  border: `1px solid ${colors.borderColor}`,
                  color: colors.textPrimary,
                  cursor: 'pointer',
                  padding: '7px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '8px',
                  flexShrink: 0
                }}
              >
                <Menu size={19} />
              </button>
            )}

            {/* Index Tickers Bar (Horizontally scrollable with hidden scrollbar) */}
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                overflowX: 'auto',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch',
                minWidth: 0,
                paddingRight: '6px'
              }}
            >
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
                      gap: '4px',
                      fontSize: isMobile ? '11px' : '12px',
                      fontWeight: '600',
                      whiteSpace: 'nowrap',
                      backgroundColor: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.04)',
                      padding: isMobile ? '3px 7px' : '4px 9px',
                      borderRadius: '6px',
                      border: `1px solid ${colors.borderColor}`,
                      flexShrink: 0
                    }}
                  >
                    <span style={{ color: colors.textSecondary }}>{idx.name}:</span>
                    <span style={{
                      color: isPositive ? colors.accentGreen : colors.accentRed,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '12px', flexShrink: 0 }}>
            {/* Direct Paper Trading Button in Topbar */}
            <button
              onClick={() => onOpenPaperTrading ? onOpenPaperTrading() : onBack && onBack()}
              title="Launch Paper Trading Terminal"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: isMobile ? '6px 9px' : '6px 12px',
                borderRadius: '20px',
                backgroundColor: isLight ? 'rgba(37, 99, 235, 0.1)' : 'rgba(37, 99, 235, 0.2)',
                border: `1px solid ${isLight ? 'rgba(37, 99, 235, 0.3)' : 'rgba(59, 130, 246, 0.4)'}`,
                color: colors.accentBlueLight,
                fontSize: isMobile ? '11px' : '12px',
                fontWeight: '700',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <Zap size={13} /> {isTinyMobile ? 'Trade' : (isMobile ? 'Paper Trade' : 'Paper Terminal')}
            </button>

            {/* Dark / Light Toggle Switch */}
            <button
              onClick={toggleTheme}
              title="Toggle Theme"
              aria-label="Toggle Dark/Light Theme"
              style={{
                width: '36px',
                height: '22px',
                borderRadius: '12px',
                backgroundColor: isLight ? '#e2e8f0' : '#1e293b',
                border: `1px solid ${colors.borderColor}`,
                display: 'flex',
                alignItems: 'center',
                padding: '2px',
                cursor: 'pointer',
                justifyContent: isLight ? 'flex-start' : 'flex-end',
                transition: 'all 0.2s ease',
                flexShrink: 0
              }}
            >
              <div style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff'
              }}>
                {isLight ? <Sun size={10} /> : <Moon size={10} />}
              </div>
            </button>

            {/* User Profile Pill */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: isMobile ? '3px' : '4px 10px',
              borderRadius: '20px',
              backgroundColor: isLight ? '#f1f5f9' : '#1e293b',
              border: `1px solid ${colors.borderColor}`,
              cursor: 'pointer',
              flexShrink: 0
            }}>
              <div style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: '700'
              }}>
                {(user?.username || 'U').charAt(0).toUpperCase()}
              </div>
              {!isMobile && (
                <>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: colors.textPrimary, maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.username || 'Trader'}
                  </span>
                  <ChevronDown size={13} color={colors.textSecondary} />
                </>
              )}
            </div>
          </div>
        </header>

        {/* ── SUB-VIEW ROUTER / SCROLLABLE CONTENT ── */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: isMobile ? '12px 10px 80px 10px' : '24px 32px',
          WebkitOverflowScrolling: 'touch'
        }}>
          {/* ══════════════════════════════════════════════════════════════ */}
          {/* 1. DASHBOARD VIEW                                              */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'DASHBOARD' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px', maxWidth: '1400px', margin: '0 auto' }}>
              {/* Top Filters & "+ New Trade" Row */}
              <div style={{ 
                display: 'flex', 
                flexDirection: isSmallMobile ? 'column' : 'row',
                alignItems: isSmallMobile ? 'stretch' : 'center', 
                justifyContent: 'flex-end', 
                gap: '8px' 
              }}>
                <div style={{ display: 'flex', gap: '8px', width: isSmallMobile ? '100%' : 'auto' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <select
                      value={marketSegment}
                      onChange={(e) => setMarketSegment(e.target.value)}
                      style={{
                        width: '100%',
                        backgroundColor: colors.bgInput,
                        border: `1px solid ${colors.borderColor}`,
                        color: colors.textPrimary,
                        padding: '7px 26px 7px 10px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        appearance: 'none',
                        outline: 'none',
                        boxShadow: colors.cardShadow
                      }}
                    >
                      <option value="Indian">🌐 Indian</option>
                      <option value="Crypto">⚡ Crypto</option>
                      <option value="Forex">💱 Forex</option>
                      <option value="US">🇺🇸 US Stocks</option>
                    </select>
                    <ChevronDown size={13} color={colors.textSecondary} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  </div>

                  <div style={{ position: 'relative', flex: 1 }}>
                    <select
                      value={timeRange}
                      onChange={(e) => setTimeRange(e.target.value)}
                      style={{
                        width: '100%',
                        backgroundColor: colors.bgInput,
                        border: `1px solid ${colors.borderColor}`,
                        color: colors.textPrimary,
                        padding: '7px 26px 7px 10px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        appearance: 'none',
                        outline: 'none',
                        boxShadow: colors.cardShadow
                      }}
                    >
                      <option value="TODAY">📅 Today</option>
                      <option value="7D">📅 7 Days</option>
                      <option value="30D">📅 30 Days</option>
                      <option value="90D">📅 90 Days</option>
                      <option value="1Y">📅 1 Year</option>
                      <option value="ALL">📅 All Time</option>
                    </select>
                    <ChevronDown size={13} color={colors.textSecondary} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  </div>
                </div>

                <button
                  onClick={() => setShowNewTradeModal(true)}
                  style={{
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    padding: isSmallMobile ? '9px 16px' : '7px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)',
                    transition: 'background 0.15s'
                  }}
                >
                  <Plus size={15} /> New Trade
                </button>
              </div>

              {/* 4 KPI METRIC CARDS (2x2 on Mobile, 4-col on Desktop) */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', 
                gap: isMobile ? '10px' : '16px' 
              }}>
                {/* 1. HIGHEST P&L */}
                <div style={{ 
                  backgroundColor: colors.bgCard, 
                  border: `1px solid ${colors.borderColor}`, 
                  borderRadius: '12px', 
                  padding: isMobile ? '12px 14px' : '18px 20px', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start',
                  boxShadow: colors.cardShadow
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: isMobile ? '10px' : '11px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      HIGHEST P&L
                    </div>
                    <div style={{ 
                      fontSize: isMobile ? '17px' : '24px', 
                      fontWeight: '800', 
                      color: metrics.highestPnl >= 0 ? colors.accentGreen : colors.accentRed, 
                      margin: '4px 0 2px 0',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      ₹{metrics.highestPnl.toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: '10px', color: colors.textMuted }}>vs last 30 days</div>
                  </div>
                  <div style={{ 
                    width: isMobile ? '32px' : '38px', 
                    height: isMobile ? '32px' : '38px', 
                    borderRadius: '8px', 
                    backgroundColor: 'rgba(16, 185, 129, 0.12)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: colors.accentGreen,
                    flexShrink: 0,
                    marginLeft: '4px'
                  }}>
                    <Wallet size={isMobile ? 16 : 20} />
                  </div>
                </div>

                {/* 2. WIN RATE */}
                <div style={{ 
                  backgroundColor: colors.bgCard, 
                  border: `1px solid ${colors.borderColor}`, 
                  borderRadius: '12px', 
                  padding: isMobile ? '12px 14px' : '18px 20px', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start',
                  boxShadow: colors.cardShadow
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: isMobile ? '10px' : '11px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      WIN RATE
                    </div>
                    <div style={{ 
                      fontSize: isMobile ? '17px' : '24px', 
                      fontWeight: '800', 
                      color: isLight ? '#0284c7' : '#38bdf8', 
                      margin: '4px 0 2px 0',
                      whiteSpace: 'nowrap'
                    }}>
                      {metrics.winRate}%
                    </div>
                    <div style={{ fontSize: '10px', color: colors.textMuted }}>{metrics.wins}W / {metrics.losses}L</div>
                  </div>
                  <div style={{ 
                    width: isMobile ? '32px' : '38px', 
                    height: isMobile ? '32px' : '38px', 
                    borderRadius: '8px', 
                    backgroundColor: 'rgba(56, 189, 248, 0.12)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: isLight ? '#0284c7' : '#38bdf8',
                    flexShrink: 0,
                    marginLeft: '4px'
                  }}>
                    <Trophy size={isMobile ? 16 : 20} />
                  </div>
                </div>

                {/* 3. AVG. RISK/REWARD */}
                <div style={{ 
                  backgroundColor: colors.bgCard, 
                  border: `1px solid ${colors.borderColor}`, 
                  borderRadius: '12px', 
                  padding: isMobile ? '12px 14px' : '18px 20px', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start',
                  boxShadow: colors.cardShadow
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: isMobile ? '10px' : '11px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      RISK/REWARD
                    </div>
                    <div style={{ 
                      fontSize: isMobile ? '17px' : '24px', 
                      fontWeight: '800', 
                      color: isLight ? '#7c3aed' : '#a855f7', 
                      margin: '4px 0 2px 0',
                      whiteSpace: 'nowrap'
                    }}>
                      {metrics.avgRiskReward}
                    </div>
                    <div style={{ fontSize: '10px', color: colors.textMuted }}>Target: 1:2+</div>
                  </div>
                  <div style={{ 
                    width: isMobile ? '32px' : '38px', 
                    height: isMobile ? '32px' : '38px', 
                    borderRadius: '8px', 
                    backgroundColor: 'rgba(168, 85, 247, 0.12)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: isLight ? '#7c3aed' : '#a855f7',
                    flexShrink: 0,
                    marginLeft: '4px'
                  }}>
                    <Scale size={isMobile ? 16 : 20} />
                  </div>
                </div>

                {/* 4. TRADES THIS MONTH */}
                <div style={{ 
                  backgroundColor: colors.bgCard, 
                  border: `1px solid ${colors.borderColor}`, 
                  borderRadius: '12px', 
                  padding: isMobile ? '12px 14px' : '18px 20px', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start',
                  boxShadow: colors.cardShadow
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: isMobile ? '10px' : '11px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      TOTAL TRADES
                    </div>
                    <div style={{ 
                      fontSize: isMobile ? '17px' : '24px', 
                      fontWeight: '800', 
                      color: isLight ? '#ea580c' : '#f97316', 
                      margin: '4px 0 2px 0',
                      whiteSpace: 'nowrap'
                    }}>
                      {metrics.tradesCount}
                    </div>
                    <div style={{ fontSize: '10px', color: colors.textMuted }}>logged trades</div>
                  </div>
                  <div style={{ 
                    width: isMobile ? '32px' : '38px', 
                    height: isMobile ? '32px' : '38px', 
                    borderRadius: '8px', 
                    backgroundColor: 'rgba(249, 115, 22, 0.12)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: isLight ? '#ea580c' : '#f97316',
                    flexShrink: 0,
                    marginLeft: '4px'
                  }}>
                    <BarChart3 size={isMobile ? 16 : 20} />
                  </div>
                </div>
              </div>

              {/* CONFIDENCE INDEX CARD */}
              <div style={{ 
                backgroundColor: colors.bgCard, 
                border: `1px solid ${colors.borderColor}`, 
                borderRadius: '12px', 
                padding: isMobile ? '14px 16px' : '18px 22px', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '10px',
                boxShadow: colors.cardShadow
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: colors.textPrimary }}>Confidence Index</span>
                  <span style={{ fontSize: '11px', color: colors.textMuted }}>{metrics.confidenceScore}% Systematic</span>
                </div>
                <div style={{ position: 'relative', marginTop: '2px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: '700', color: colors.textMuted, marginBottom: '5px' }}>
                    <span style={{ color: colors.accentRed }}>Low Risk Tolerance</span>
                    <span style={{ color: colors.accentGreen }}>High Execution Discipline</span>
                  </div>
                  <div style={{ height: '7px', borderRadius: '4px', background: 'linear-gradient(90deg, #ef4444 0%, #f59e0b 50%, #10b981 100%)', position: 'relative' }}>
                    {metrics.tradesCount > 0 && (
                      <div style={{ 
                        position: 'absolute', 
                        left: `${metrics.confidenceScore}%`, 
                        top: '-4px', 
                        transform: 'translateX(-50%)', 
                        width: '15px', 
                        height: '15px', 
                        borderRadius: '50%', 
                        backgroundColor: '#ffffff', 
                        border: '2px solid #2563eb', 
                        boxShadow: '0 0 6px rgba(0,0,0,0.4)' 
                      }} />
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'center', fontSize: '11px', color: colors.textSecondary, marginTop: '2px' }}>
                  {metrics.tradesCount === 0 ? 'Log your trades to compute execution confidence score.' : `Based on rule adherence and risk-to-reward ratio.`}
                </div>
              </div>

              {/* BOTTOM ROW: CUMULATIVE P&L & TOP TRADES (Stacked on Mobile) */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', 
                gap: isMobile ? '12px' : '16px' 
              }}>
                {/* Cumulative P&L */}
                <div style={{ 
                  backgroundColor: colors.bgCard, 
                  border: `1px solid ${colors.borderColor}`, 
                  borderRadius: '12px', 
                  padding: isMobile ? '16px' : '20px 24px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  minHeight: isMobile ? '200px' : '260px',
                  boxShadow: colors.cardShadow
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', color: colors.textPrimary }}>
                      <TrendingUp size={16} color="#2563eb" /> Cumulative P&L
                    </div>
                    <div style={{ display: 'flex', gap: '3px', backgroundColor: colors.bgInner, padding: '2px', borderRadius: '6px', border: `1px solid ${colors.borderColor}` }}>
                      {['D', 'W', 'M'].map((p) => (
                        <button 
                          key={p} 
                          onClick={() => setPnlPeriod(p)} 
                          style={{ 
                            padding: '3px 8px', 
                            fontSize: '11px', 
                            fontWeight: '700', 
                            borderRadius: '4px', 
                            border: 'none', 
                            backgroundColor: pnlPeriod === p ? '#2563eb' : 'transparent', 
                            color: pnlPeriod === p ? '#ffffff' : colors.textMuted, 
                            cursor: 'pointer' 
                          }}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {allTrades.length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '8px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.accentGreen }}>
                        <TrendingUp size={24} />
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: colors.textPrimary }}>No Trading Data Yet</div>
                      <div style={{ fontSize: '11px', color: colors.textSecondary, maxWidth: '280px' }}>Your equity curve will appear here once you start logging trades.</div>
                      <button 
                        onClick={() => setShowNewTradeModal(true)} 
                        style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '12px', fontWeight: '700', cursor: 'pointer', marginTop: '2px' }}
                      >
                        Start logging your trades →
                      </button>
                    </div>
                  ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: '800', color: metrics.totalPnL >= 0 ? colors.accentGreen : colors.accentRed, marginBottom: '6px' }}>
                        {metrics.totalPnL >= 0 ? '+' : ''}₹{metrics.totalPnL.toLocaleString('en-IN')}
                      </div>
                      <div style={{ fontSize: '12px', color: colors.textSecondary }}>
                        Net P&L across {allTrades.length} trades ({metrics.wins} Wins / {metrics.losses} Losses)
                      </div>
                    </div>
                  )}
                </div>

                {/* Top Trades */}
                <div style={{ 
                  backgroundColor: colors.bgCard, 
                  border: `1px solid ${colors.borderColor}`, 
                  borderRadius: '12px', 
                  padding: isMobile ? '16px' : '20px 24px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  minHeight: isMobile ? '180px' : '260px',
                  boxShadow: colors.cardShadow
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: colors.textPrimary }}>Top Trades</div>
                    <button onClick={() => setActiveTab('TRADES')} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      View All →
                    </button>
                  </div>

                  {metrics.topTrades.length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '8px' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: colors.bgInner, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textMuted }}>
                        <Trophy size={20} />
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: colors.textPrimary }}>No top trades yet</div>
                      <div style={{ fontSize: '11px', color: colors.textSecondary }}>Log winning trades to view highlights</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {metrics.topTrades.map((trade, idx) => (
                        <div 
                          key={trade.id || idx} 
                          style={{ 
                            padding: '9px 12px', 
                            backgroundColor: colors.bgInner, 
                            borderRadius: '8px', 
                            border: `1px solid ${colors.borderColor}`, 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center' 
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: colors.textPrimary }}>{trade.symbol}</div>
                            <div style={{ fontSize: '10px', color: colors.textSecondary }}>{trade.trade_date} • {trade.strategy || 'Breakout'}</div>
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: '800', color: colors.accentGreen }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px', maxWidth: '1000px', margin: '0 auto' }}>
              <div style={{ 
                display: 'flex', 
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between', 
                alignItems: isMobile ? 'flex-start' : 'center',
                gap: '8px'
              }}>
                <div>
                  <h2 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '800', color: colors.textPrimary, margin: 0 }}>Daily Trading Checklist</h2>
                  <p style={{ fontSize: '12px', color: colors.textSecondary, margin: '2px 0 0 0' }}>Build systematic discipline with pre-market prep and post-market review.</p>
                </div>
                <div style={{ 
                  fontSize: '11px', 
                  fontWeight: '700', 
                  color: '#2563eb', 
                  backgroundColor: colors.bgCard, 
                  padding: '5px 12px', 
                  borderRadius: '8px', 
                  border: `1px solid ${colors.borderColor}`,
                  boxShadow: colors.cardShadow
                }}>
                  📅 Today: {todayStr}
                </div>
              </div>

              {/* Pre-Market Section */}
              <div style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.borderColor}`, borderRadius: '12px', padding: isMobile ? '14px' : '20px', boxShadow: colors.cardShadow }}>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#2563eb', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Flame size={16} /> Pre-Market Checklist (Before 09:15 AM)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                        gap: '10px',
                        padding: '9px 12px',
                        backgroundColor: colors.bgInner,
                        borderRadius: '8px',
                        border: todayChecklist.preMarket[item.key] ? '1px solid #2563eb' : `1px solid ${colors.borderColor}`,
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '4px',
                        backgroundColor: todayChecklist.preMarket[item.key] ? '#2563eb' : 'transparent',
                        border: todayChecklist.preMarket[item.key] ? 'none' : `2px solid ${colors.textMuted}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        flexShrink: 0
                      }}>
                        {todayChecklist.preMarket[item.key] && <Check size={12} strokeWidth={3} />}
                      </div>
                      <span style={{
                        fontSize: '12px',
                        color: todayChecklist.preMarket[item.key] ? colors.textPrimary : colors.textSecondary,
                        textDecoration: todayChecklist.preMarket[item.key] ? 'line-through' : 'none',
                        lineHeight: 1.35
                      }}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Post-Market Section */}
              <div style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.borderColor}`, borderRadius: '12px', padding: isMobile ? '14px' : '20px', boxShadow: colors.cardShadow }}>
                <div style={{ fontSize: '13px', fontWeight: '800', color: colors.accentGreen, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={16} /> Post-Market Review (After 03:30 PM)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                        gap: '10px',
                        padding: '9px 12px',
                        backgroundColor: colors.bgInner,
                        borderRadius: '8px',
                        border: todayChecklist.postMarket[item.key] ? `1px solid ${colors.accentGreen}` : `1px solid ${colors.borderColor}`,
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '4px',
                        backgroundColor: todayChecklist.postMarket[item.key] ? colors.accentGreen : 'transparent',
                        border: todayChecklist.postMarket[item.key] ? 'none' : `2px solid ${colors.textMuted}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        flexShrink: 0
                      }}>
                        {todayChecklist.postMarket[item.key] && <Check size={12} strokeWidth={3} />}
                      </div>
                      <span style={{
                        fontSize: '12px',
                        color: todayChecklist.postMarket[item.key] ? colors.textPrimary : colors.textSecondary,
                        textDecoration: todayChecklist.postMarket[item.key] ? 'line-through' : 'none',
                        lineHeight: 1.35
                      }}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Day Notes */}
              <div style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.borderColor}`, borderRadius: '12px', padding: isMobile ? '14px' : '20px', boxShadow: colors.cardShadow }}>
                <div style={{ fontSize: '13px', fontWeight: '800', color: colors.textPrimary, marginBottom: '8px' }}>
                  Daily Reflections & Market Observations
                </div>
                <textarea
                  rows={3}
                  value={todayChecklist.notes}
                  onChange={(e) => handleChecklistNotesChange(e.target.value)}
                  onBlur={handleSaveChecklistNotes}
                  placeholder="What was the market theme today? Did you follow your rules? What will you do better tomorrow?"
                  style={{
                    width: '100%',
                    backgroundColor: colors.bgInput,
                    border: `1px solid ${colors.borderColor}`,
                    borderRadius: '8px',
                    padding: '10px 12px',
                    color: colors.textPrimary,
                    fontSize: '12px',
                    resize: 'vertical',
                    outline: 'none',
                    lineHeight: 1.4
                  }}
                />
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* 3. TRADES TABLE & MOBILE CARDS SUB-VIEW                         */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'TRADES' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <div>
                  <h2 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '800', color: colors.textPrimary, margin: 0 }}>Logged Trades</h2>
                  <p style={{ fontSize: '12px', color: colors.textSecondary, margin: '2px 0 0 0' }}>Comprehensive trade history with tags, strategies, emotions, and P&L cards.</p>
                </div>
                <button
                  onClick={() => setShowNewTradeModal(true)}
                  style={{
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <Plus size={15} /> Add Trade
                </button>
              </div>

              {allTrades.length === 0 ? (
                <div style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.borderColor}`, borderRadius: '12px', padding: '36px 16px', textAlign: 'center', color: colors.textSecondary, boxShadow: colors.cardShadow }}>
                  No trades logged yet. Click "+ Add Trade" or trade in the Paper Trading terminal!
                </div>
              ) : (
                <>
                  {/* MOBILE CARD VIEW FOR SMARTPHONES */}
                  {isMobile ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {allTrades.map((t, idx) => {
                        const net = Number(t.net_pnl || t.realized_pnl || 0);
                        const isWin = net >= 0;

                        return (
                          <div 
                            key={t.id || idx}
                            style={{
                              backgroundColor: colors.bgCard,
                              border: `1px solid ${colors.borderColor}`,
                              borderRadius: '10px',
                              padding: '12px 14px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px',
                              boxShadow: colors.cardShadow
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '10px',
                                  fontWeight: '800',
                                  backgroundColor: t.trade_type === 'BUY' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                  color: t.trade_type === 'BUY' ? colors.accentGreen : colors.accentRed
                                }}>
                                  {t.trade_type}
                                </span>
                                <span style={{ fontSize: '13px', fontWeight: '800', color: colors.textPrimary }}>{t.symbol}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '14px', fontWeight: '800', color: isWin ? colors.accentGreen : colors.accentRed }}>
                                  {isWin ? '+' : ''}₹{net.toLocaleString('en-IN')}
                                </span>
                                <button
                                  onClick={() => setSelectedTradeForShare(t)}
                                  title="Share P&L Card"
                                  style={{ background: 'transparent', border: 'none', color: '#2563eb', cursor: 'pointer', padding: '2px' }}
                                >
                                  <Share2 size={16} />
                                </button>
                              </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: colors.textSecondary }}>
                              <div>
                                Entry: <strong style={{ color: colors.textPrimary }}>₹{Number(t.entry_price || 0).toFixed(2)}</strong> → Exit: <strong style={{ color: colors.textPrimary }}>₹{Number(t.exit_price || 0).toFixed(2)}</strong>
                              </div>
                              <div>
                                Qty: <strong style={{ color: colors.textPrimary }}>{t.quantity}</strong>
                              </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px', borderTop: `1px solid ${colors.borderColor}`, fontSize: '10px', color: colors.textMuted }}>
                              <span>{t.trade_date || todayStr}</span>
                              <span style={{ padding: '2px 6px', borderRadius: '8px', backgroundColor: colors.bgInner, color: colors.accentBlueLight, border: `1px solid ${colors.borderColor}` }}>
                                {t.strategy || 'Breakout'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* DESKTOP RESPONSIVE TABLE */
                    <div style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.borderColor}`, borderRadius: '12px', overflow: 'hidden', boxShadow: colors.cardShadow }}>
                      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px', minWidth: '700px' }}>
                          <thead>
                            <tr style={{ backgroundColor: colors.bgInner, color: colors.textMuted, borderBottom: `1px solid ${colors.borderColor}` }}>
                              <th style={{ padding: '10px 14px' }}>Date</th>
                              <th style={{ padding: '10px 14px' }}>Symbol</th>
                              <th style={{ padding: '10px 14px' }}>Side</th>
                              <th style={{ padding: '10px 14px' }}>Qty</th>
                              <th style={{ padding: '10px 14px' }}>Entry</th>
                              <th style={{ padding: '10px 14px' }}>Exit</th>
                              <th style={{ padding: '10px 14px' }}>Gross P&L</th>
                              <th style={{ padding: '10px 14px' }}>Net P&L</th>
                              <th style={{ padding: '10px 14px' }}>Strategy</th>
                              <th style={{ padding: '10px 14px' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allTrades.map((t, idx) => {
                              const net = Number(t.net_pnl || t.realized_pnl || 0);
                              const isWin = net >= 0;

                              return (
                                <tr key={t.id || idx} style={{ borderBottom: `1px solid ${colors.borderColor}` }}>
                                  <td style={{ padding: '10px 14px', color: colors.textSecondary }}>{t.trade_date || todayStr}</td>
                                  <td style={{ padding: '10px 14px', fontWeight: '700', color: colors.textPrimary }}>{t.symbol}</td>
                                  <td style={{ padding: '10px 14px' }}>
                                    <span style={{
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontSize: '10px',
                                      fontWeight: '800',
                                      backgroundColor: t.trade_type === 'BUY' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                      color: t.trade_type === 'BUY' ? colors.accentGreen : colors.accentRed
                                    }}>
                                      {t.trade_type}
                                    </span>
                                  </td>
                                  <td style={{ padding: '10px 14px', color: colors.textPrimary }}>{t.quantity}</td>
                                  <td style={{ padding: '10px 14px', color: colors.textPrimary }}>₹{Number(t.entry_price || 0).toFixed(2)}</td>
                                  <td style={{ padding: '10px 14px', color: colors.textPrimary }}>₹{Number(t.exit_price || 0).toFixed(2)}</td>
                                  <td style={{ padding: '10px 14px', color: isWin ? colors.accentGreen : colors.accentRed, fontWeight: '700' }}>
                                    {isWin ? '+' : ''}₹{Number(t.realized_pnl || 0).toLocaleString('en-IN')}
                                  </td>
                                  <td style={{ padding: '10px 14px', color: isWin ? colors.accentGreen : colors.accentRed, fontWeight: '800' }}>
                                    {isWin ? '+' : ''}₹{net.toLocaleString('en-IN')}
                                  </td>
                                  <td style={{ padding: '10px 14px' }}>
                                    <span style={{ padding: '2px 8px', borderRadius: '12px', backgroundColor: colors.bgInner, border: `1px solid ${colors.borderColor}`, fontSize: '10px', color: colors.accentBlueLight }}>
                                      {t.strategy || 'Breakout'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '10px 14px' }}>
                                    <button
                                      onClick={() => setSelectedTradeForShare(t)}
                                      title="Share P&L Card"
                                      style={{ background: 'transparent', border: 'none', color: '#2563eb', cursor: 'pointer', padding: '4px' }}
                                    >
                                      <Share2 size={15} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* 4. STRATEGIES SUB-VIEW                                         */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'STRATEGIES' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px', maxWidth: '1100px', margin: '0 auto' }}>
              <div>
                <h2 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '800', color: colors.textPrimary, margin: 0 }}>Trading Strategies</h2>
                <p style={{ fontSize: '12px', color: colors.textSecondary, margin: '2px 0 0 0' }}>Track setup performance, win rate %, and edge per strategy.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: isMobile ? '10px' : '16px' }}>
                {strategies.map((strat) => (
                  <div key={strat.id} style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.borderColor}`, borderRadius: '12px', padding: isMobile ? '14px' : '18px', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: colors.cardShadow }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: '800', color: colors.textPrimary }}>{strat.name || strat.strategy_name}</span>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#2563eb', backgroundColor: isLight ? 'rgba(37, 99, 235, 0.08)' : 'rgba(56, 189, 248, 0.1)', padding: '2px 8px', borderRadius: '10px' }}>
                        {strat.win_rate || 65}% Win Rate
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                      <div style={{ backgroundColor: colors.bgInner, padding: '8px 12px', borderRadius: '8px', border: `1px solid ${colors.borderColor}` }}>
                        <div style={{ fontSize: '10px', color: colors.textMuted }}>TOTAL TRADES</div>
                        <div style={{ fontSize: '15px', fontWeight: '700', color: colors.textPrimary, marginTop: '2px' }}>{strat.total_trades || 20}</div>
                      </div>
                      <div style={{ backgroundColor: colors.bgInner, padding: '8px 12px', borderRadius: '8px', border: `1px solid ${colors.borderColor}` }}>
                        <div style={{ fontSize: '10px', color: colors.textMuted }}>NET P&L</div>
                        <div style={{ fontSize: '15px', fontWeight: '700', color: colors.accentGreen, marginTop: '2px' }}>+₹{(strat.net_pnl || 35000).toLocaleString('en-IN')}</div>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px', maxWidth: '1000px', margin: '0 auto' }}>
              <div>
                <h2 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '800', color: colors.textPrimary, margin: 0 }}>Trading Rules Matrix</h2>
                <p style={{ fontSize: '12px', color: colors.textSecondary, margin: '2px 0 0 0' }}>The rules that protect your capital and ensure long-term consistency.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {rules.map((rule) => (
                  <div key={rule.id} style={{ 
                    backgroundColor: colors.bgCard, 
                    border: `1px solid ${colors.borderColor}`, 
                    borderRadius: '12px', 
                    padding: isMobile ? '12px 14px' : '16px 20px', 
                    display: 'flex', 
                    flexDirection: isMobile ? 'column' : 'row',
                    alignItems: isMobile ? 'flex-start' : 'center', 
                    justifyContent: 'space-between',
                    gap: isMobile ? '8px' : '14px',
                    boxShadow: colors.cardShadow
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                      <div style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', flexShrink: 0 }}>
                        <Scale size={16} />
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: colors.textPrimary, lineHeight: 1.35 }}>{rule.text || rule.rule_text}</div>
                        <div style={{ fontSize: '10px', color: colors.textMuted, marginTop: '2px' }}>Category: {rule.category}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', alignSelf: isMobile ? 'flex-end' : 'center' }}>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: colors.accentGreen, backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '3px 8px', borderRadius: '6px' }}>
                        ✓ {rule.followed || 0} Followed
                      </span>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: colors.accentRed, backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '3px 8px', borderRadius: '6px' }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px', maxWidth: '1000px', margin: '0 auto' }}>
              <div>
                <h2 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '800', color: colors.textPrimary, margin: 0 }}>Mistake Tracker & Cost</h2>
                <p style={{ fontSize: '12px', color: colors.textSecondary, margin: '2px 0 0 0' }}>Quantify the exact financial cost of emotional decisions to eliminate them.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {mistakes.map((m) => (
                  <div key={m.id} style={{ 
                    backgroundColor: colors.bgCard, 
                    border: `1px solid ${colors.borderColor}`, 
                    borderRadius: '12px', 
                    padding: isMobile ? '14px' : '18px 20px', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    gap: '10px',
                    boxShadow: colors.cardShadow
                  }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertTriangle size={15} color={colors.accentRed} style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', fontWeight: '700', color: colors.textPrimary }}>{m.name || m.mistake_name}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '3px', lineHeight: 1.3 }}>
                        Lesson: {m.note || m.lessons_learned || 'Stick strictly to predefined plan'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: colors.accentRed }}>
                        -₹{Number(m.loss || m.loss_incurred || 5000).toLocaleString('en-IN')}
                      </div>
                      <div style={{ fontSize: '10px', color: colors.textMuted }}>Occurred {m.count || m.frequency || 1}x</div>
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
              <div style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.borderColor}`, borderRadius: '12px', padding: isMobile ? '24px 16px' : '32px', textAlign: 'center', boxShadow: colors.cardShadow }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '14px', backgroundColor: 'rgba(37, 99, 235, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', margin: '0 auto 14px auto' }}>
                  <Sparkles size={26} />
                </div>
                <h3 style={{ fontSize: '17px', fontWeight: '800', color: colors.textPrimary, margin: '0 0 6px 0' }}>
                  {sidebarItems.find(i => i.id === activeTab)?.label}
                </h3>
                <p style={{ fontSize: '12px', color: colors.textSecondary, maxWidth: '420px', margin: '0 auto 18px auto', lineHeight: 1.4 }}>
                  This module is active and synced with your Trade Diary account. Log more trades to unlock deep analytics and AI insights!
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                  <button onClick={() => setActiveTab('DASHBOARD')} style={{ backgroundColor: '#2563eb', color: '#ffffff', padding: '8px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', border: 'none', cursor: 'pointer' }}>
                    Dashboard
                  </button>
                  <button onClick={() => onOpenPaperTrading ? onOpenPaperTrading() : onBack && onBack()} style={{ backgroundColor: colors.bgInner, color: colors.textPrimary, border: `1px solid ${colors.borderColor}`, padding: '8px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                    Paper Terminal
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── MODAL: LOG NEW TRADE ─────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showNewTradeModal && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: 'rgba(0, 0, 0, 0.75)', 
          backdropFilter: 'blur(4px)', 
          WebkitBackdropFilter: 'blur(4px)',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 9999, 
          padding: '12px' 
        }}>
          <div style={{ 
            backgroundColor: colors.bgSidebar, 
            border: `1px solid ${colors.borderColor}`, 
            borderRadius: '16px', 
            width: '100%', 
            maxWidth: '540px', 
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: isMobile ? '16px' : '22px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '14px', 
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '800', color: colors.textPrimary }}>
                <Plus size={18} color="#2563eb" /> Log New Trade
              </div>
              <button 
                onClick={() => setShowNewTradeModal(false)} 
                aria-label="Close modal"
                style={{ background: 'transparent', border: 'none', color: colors.textMuted, cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveNewTrade} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>Symbol / Instrument</label>
                  <input type="text" required placeholder="e.g. NIFTY 24500 CE or RELIANCE" value={newTradeForm.symbol} onChange={(e) => setNewTradeForm({ ...newTradeForm, symbol: e.target.value })} style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '13px', marginTop: '3px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>Side</label>
                  <select value={newTradeForm.trade_type} onChange={(e) => setNewTradeForm({ ...newTradeForm, trade_type: e.target.value })} style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '13px', marginTop: '3px', outline: 'none' }}>
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>Entry Price (₹)</label>
                  <input type="number" step="0.05" inputMode="decimal" required placeholder="0.00" value={newTradeForm.entry_price} onChange={(e) => setNewTradeForm({ ...newTradeForm, entry_price: e.target.value })} style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '13px', marginTop: '3px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>Exit Price (₹)</label>
                  <input type="number" step="0.05" inputMode="decimal" required placeholder="0.00" value={newTradeForm.exit_price} onChange={(e) => setNewTradeForm({ ...newTradeForm, exit_price: e.target.value })} style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '13px', marginTop: '3px', outline: 'none' }} />
                </div>
                <div style={{ gridColumn: isMobile ? '1 / -1' : 'auto' }}>
                  <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>Quantity</label>
                  <input type="number" inputMode="numeric" required value={newTradeForm.quantity} onChange={(e) => setNewTradeForm({ ...newTradeForm, quantity: e.target.value })} style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '13px', marginTop: '3px', outline: 'none' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>Strategy</label>
                  <select value={newTradeForm.strategy} onChange={(e) => setNewTradeForm({ ...newTradeForm, strategy: e.target.value })} style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '13px', marginTop: '3px', outline: 'none' }}>
                    {STRATEGY_TAGS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>Mindset / Emotion</label>
                  <select value={newTradeForm.emotion} onChange={(e) => setNewTradeForm({ ...newTradeForm, emotion: e.target.value })} style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '13px', marginTop: '3px', outline: 'none' }}>
                    {EMOTION_TAGS.map(em => <option key={em} value={em}>{em}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>Trade Notes & Reflections</label>
                <textarea rows={2} value={newTradeForm.notes} onChange={(e) => setNewTradeForm({ ...newTradeForm, notes: e.target.value })} placeholder="Why did you take this trade? Any lessons learned?" style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '12px', marginTop: '3px', outline: 'none', resize: 'none' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button type="button" onClick={() => setShowNewTradeModal(false)} style={{ backgroundColor: 'transparent', border: `1px solid ${colors.borderColor}`, color: colors.textSecondary, padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" style={{ backgroundColor: '#2563eb', color: '#ffffff', padding: '8px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', border: 'none', cursor: 'pointer' }}>
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

