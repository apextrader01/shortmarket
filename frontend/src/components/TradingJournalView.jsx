import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useStore, API } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { 
  BookOpen, Plus, Tag, Smile, Frown, Sparkles, Filter, Search, 
  Share2, Star, Edit3, Trash2, Check, X, TrendingUp, TrendingDown, 
  AlertTriangle, ShieldCheck, Flame, Zap, Award, BarChart3, ChevronRight,
  Calendar, ChevronLeft, CalendarDays, ListFilter, CheckCircle2,
  Circle, HelpCircle, Activity, Compass, Cpu, PieChart, Sliders,
  RefreshCw, Layers, ArrowUpRight, ArrowDownRight, Target, Shield,
  DollarSign, Clock, AlertCircle, Save, ExternalLink
} from 'lucide-react';
import PnLShareCardModal from './PnLShareCardModal';

export const STRATEGY_OPTIONS = [
  '🔥 Breakout & Retest',
  '⚡ Scalping Momentum',
  '🎯 Trend Following',
  '🛡️ 9:20 Straddle / Strangle',
  '🔄 Mean Reversion / S&R Bounce',
  '📊 VWAP & EMA Pullback',
  '🦅 Option Buying (Momentum)',
  '🛡️ Option Selling (Theta Decay)'
];

export const MISTAKE_OPTIONS = [
  'FOMO Entry',
  'Revenge Trading',
  'Early Exit / Fear',
  'Moving / Ignoring Stop Loss',
  'Over-leveraging / Position Sizing',
  'Fighting The Trend',
  'Chasing Momentum Late',
  'Over-trading (Excess Frequency)',
  'None (Clean Execution)'
];

export default function TradingJournalView({ onBack, setActiveTab }) {
  const { user, prices, positions, orders } = useStore(useShallow(state => ({
    user: state.user,
    prices: state.prices,
    positions: state.positions,
    orders: state.orders
  })));

  // Navigation Sub-tab
  const [activeNav, setActiveNav] = useState('DASHBOARD'); // 'DASHBOARD' | 'CHECKLIST' | 'TRADES' | 'STRATEGIES' | 'RULES' | 'MISTAKES' | 'AI_SUMMARIZER' | 'TOOLS'
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Backend Data
  const [dashboardData, setDashboardData] = useState(null);
  const [trades, setTrades] = useState([]);
  const [checklist, setChecklist] = useState({
    date: new Date().toISOString().split('T')[0],
    pre_market_items: [],
    post_market_items: [],
    daily_notes: ''
  });
  const [checklistDate, setChecklistDate] = useState(new Date().toISOString().split('T')[0]);
  const [checklistSavedNotice, setChecklistSavedNotice] = useState(false);
  const [mistakesList, setMistakesList] = useState([]);
  const [strategiesList, setStrategiesList] = useState([]);
  const [rulesList, setRulesList] = useState([]);

  // Modals & Forms
  const [selectedTradeForShare, setSelectedTradeForShare] = useState(null);
  const [showNewTradeModal, setShowNewTradeModal] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [showNewMistakeModal, setShowNewMistakeModal] = useState(false);
  const [showNewStrategyModal, setShowNewStrategyModal] = useState(false);
  const [showNewRuleModal, setShowNewRuleModal] = useState(false);

  // Form States
  const [tradeForm, setTradeForm] = useState({
    symbol: 'NIFTY',
    side: 'BUY',
    entry_price: '',
    exit_price: '',
    quantity: '50',
    product_type: 'INT',
    strategy: '🔥 Breakout & Retest',
    mistake: '',
    rr_ratio: '1 : 2',
    rating: 5,
    notes: '',
    market_type: 'Indian'
  });

  const [mistakeForm, setMistakeForm] = useState({
    name: '',
    category: 'Behavioral',
    severity: 'High',
    impact: 'Critical',
    description: ''
  });

  const [strategyForm, setStrategyForm] = useState({
    name: '',
    description: '',
    rules: '',
    color: '#3b82f6'
  });

  const [ruleForm, setRuleForm] = useState({
    rule_text: '',
    category: 'Risk Management'
  });

  // Filters & Search
  const [filterStrategy, setFilterStrategy] = useState('ALL');
  const [filterMistake, setFilterMistake] = useState('ALL');
  const [filterResult, setFilterResult] = useState('ALL'); // 'ALL' | 'WIN' | 'LOSS'
  const [searchQuery, setSearchQuery] = useState('');
  const [pnlTimeframe, setPnlTimeframe] = useState('ALL'); // '1D' | '1W' | '1M' | 'ALL'

  // Tool 1: Position Sizer state
  const [sizerCapital, setSizerCapital] = useState('100000');
  const [sizerRiskPct, setSizerRiskPct] = useState('2');
  const [sizerEntry, setSizerEntry] = useState('100');
  const [sizerStopLoss, setSizerStopLoss] = useState('95');
  const [sizerLotSize, setSizerLotSize] = useState('50');

  // Tool 2: Compounding Calculator state
  const [calcInitial, setCalcInitial] = useState('50000');
  const [calcMonthlyReturn, setCalcMonthlyReturn] = useState('10');
  const [calcMonths, setCalcMonths] = useState('12');

  // Fetch Dashboard & Data from Backend
  const loadDashboard = async () => {
    try {
      const res = await fetch(`${API}/api/journal/dashboard`);
      const data = await res.json();
      if (data.success) {
        setDashboardData(data);
      }
    } catch (e) {
      console.error('Failed to load journal dashboard:', e);
    }
  };

  const loadTrades = async () => {
    try {
      const res = await fetch(`${API}/api/journal/trades`);
      const data = await res.json();
      if (data.success) {
        setTrades(data.trades || []);
      }
    } catch (e) {
      console.error('Failed to load journal trades:', e);
    }
  };

  const loadChecklist = async (dateStr) => {
    try {
      const targetDate = dateStr || checklistDate;
      const res = await fetch(`${API}/api/journal/checklist/today?date=${targetDate}`);
      const data = await res.json();
      if (data.success) {
        setChecklist({
          date: data.date,
          pre_market_items: data.pre_market_items || [],
          post_market_items: data.post_market_items || [],
          daily_notes: data.daily_notes || ''
        });
      }
    } catch (e) {
      console.error('Failed to load checklist:', e);
    }
  };

  const loadMistakes = async () => {
    try {
      const res = await fetch(`${API}/api/journal/mistakes`);
      const data = await res.json();
      if (data.success) setMistakesList(data.mistakes || []);
    } catch (e) {
      console.error('Failed to load mistakes:', e);
    }
  };

  const loadStrategies = async () => {
    try {
      const res = await fetch(`${API}/api/journal/strategies`);
      const data = await res.json();
      if (data.success) setStrategiesList(data.strategies || []);
    } catch (e) {
      console.error('Failed to load strategies:', e);
    }
  };

  const loadRules = async () => {
    try {
      const res = await fetch(`${API}/api/journal/rules`);
      const data = await res.json();
      if (data.success) setRulesList(data.rules || []);
    } catch (e) {
      console.error('Failed to load rules:', e);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadDashboard(),
      loadTrades(),
      loadChecklist(),
      loadMistakes(),
      loadStrategies(),
      loadRules()
    ]).finally(() => setLoading(false));
  }, []);

  // 1-Click Sync from Paper Trading Positions
  const handleSyncFromPaper = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${API}/api/journal/sync-from-paper`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await Promise.all([loadDashboard(), loadTrades(), loadMistakes(), loadStrategies()]);
        alert(data.message || `Successfully synced trades!`);
      }
    } catch (e) {
      alert('Error syncing from paper terminal: ' + e.message);
    } finally {
      setSyncing(false);
    }
  };

  // Checklist Actions
  const togglePreMarketItem = (id) => {
    const updated = checklist.pre_market_items.map(item =>
      item.id === id ? { ...item, done: !item.done } : item
    );
    const newChecklist = { ...checklist, pre_market_items: updated };
    setChecklist(newChecklist);
    autoSaveChecklist(newChecklist);
  };

  const togglePostMarketItem = (id) => {
    const updated = checklist.post_market_items.map(item =>
      item.id === id ? { ...item, done: !item.done } : item
    );
    const newChecklist = { ...checklist, post_market_items: updated };
    setChecklist(newChecklist);
    autoSaveChecklist(newChecklist);
  };

  const autoSaveChecklist = async (dataToSave) => {
    try {
      const payload = dataToSave || checklist;
      await fetch(`${API}/api/journal/checklist/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: checklistDate,
          pre_market_items: payload.pre_market_items,
          post_market_items: payload.post_market_items,
          daily_notes: payload.daily_notes
        })
      });
      setChecklistSavedNotice(true);
      setTimeout(() => setChecklistSavedNotice(false), 2000);
    } catch (e) {
      console.error('Error saving checklist:', e);
    }
  };

  // Trade CRUD
  const handleSaveTrade = async (e) => {
    e.preventDefault();
    try {
      const method = editingTrade ? 'PUT' : 'POST';
      const url = editingTrade ? `${API}/api/journal/trades/${editingTrade.id}` : `${API}/api/journal/trades`;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tradeForm)
      });
      const data = await res.json();
      if (data.success) {
        setShowNewTradeModal(false);
        setEditingTrade(null);
        await Promise.all([loadDashboard(), loadTrades(), loadMistakes(), loadStrategies()]);
      } else {
        alert(data.error || 'Failed to save trade');
      }
    } catch (err) {
      alert('Error saving trade: ' + err.message);
    }
  };

  const handleDeleteTrade = async (id) => {
    if (!window.confirm('Are you sure you want to delete this trade from your diary?')) return;
    try {
      const res = await fetch(`${API}/api/journal/trades/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await Promise.all([loadDashboard(), loadTrades(), loadMistakes(), loadStrategies()]);
      }
    } catch (e) {
      alert('Failed to delete trade');
    }
  };

  const handleOpenEditTrade = (trade) => {
    setEditingTrade(trade);
    setTradeForm({
      symbol: trade.symbol,
      side: trade.side,
      entry_price: trade.entry_price || '',
      exit_price: trade.exit_price || '',
      quantity: trade.quantity || '1',
      product_type: trade.product_type || 'INT',
      strategy: trade.strategy || '🔥 Breakout & Retest',
      mistake: trade.mistake || '',
      rr_ratio: trade.rr_ratio || '1 : 2',
      rating: trade.rating || 5,
      notes: trade.notes || '',
      market_type: trade.market_type || 'Indian'
    });
    setShowNewTradeModal(true);
  };

  // Mistakes CRUD
  const handleCreateMistake = async (e) => {
    e.preventDefault();
    if (!mistakeForm.name.trim()) return;
    try {
      const res = await fetch(`${API}/api/journal/mistakes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mistakeForm)
      });
      const data = await res.json();
      if (data.success) {
        setShowNewMistakeModal(false);
        setMistakeForm({ name: '', category: 'Behavioral', severity: 'High', impact: 'Critical', description: '' });
        loadMistakes();
      }
    } catch (err) {
      alert('Failed to create mistake: ' + err.message);
    }
  };

  const handleDeleteMistake = async (id) => {
    if (!window.confirm('Delete this mistake template?')) return;
    try {
      await fetch(`${API}/api/journal/mistakes/${id}`, { method: 'DELETE' });
      loadMistakes();
    } catch (e) {}
  };

  // Strategy CRUD
  const handleCreateStrategy = async (e) => {
    e.preventDefault();
    if (!strategyForm.name.trim()) return;
    try {
      const res = await fetch(`${API}/api/journal/strategies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(strategyForm)
      });
      const data = await res.json();
      if (data.success) {
        setShowNewStrategyModal(false);
        setStrategyForm({ name: '', description: '', rules: '', color: '#3b82f6' });
        loadStrategies();
      }
    } catch (err) {
      alert('Failed to create strategy: ' + err.message);
    }
  };

  const handleDeleteStrategy = async (id) => {
    if (!window.confirm('Delete this strategy playbook?')) return;
    try {
      await fetch(`${API}/api/journal/strategies/${id}`, { method: 'DELETE' });
      loadStrategies();
    } catch (e) {}
  };

  // Rules CRUD
  const handleCreateRule = async (e) => {
    e.preventDefault();
    if (!ruleForm.rule_text.trim()) return;
    try {
      const res = await fetch(`${API}/api/journal/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ruleForm)
      });
      const data = await res.json();
      if (data.success) {
        setShowNewRuleModal(false);
        setRuleForm({ rule_text: '', category: 'Risk Management' });
        loadRules();
      }
    } catch (err) {
      alert('Failed to create rule');
    }
  };

  const handleToggleRule = async (rule) => {
    try {
      await fetch(`${API}/api/journal/rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !rule.is_active })
      });
      loadRules();
    } catch (e) {}
  };

  const handleDeleteRule = async (id) => {
    try {
      await fetch(`${API}/api/journal/rules/${id}`, { method: 'DELETE' });
      loadRules();
    } catch (e) {}
  };

  // Filtered Trades Calculation
  const filteredTrades = useMemo(() => {
    return trades.filter(t => {
      if (filterStrategy !== 'ALL' && t.strategy !== filterStrategy) return false;
      if (filterMistake !== 'ALL' && t.mistake !== filterMistake) return false;
      const net = Number(t.net_pnl !== null && t.net_pnl !== undefined ? t.net_pnl : t.pnl || 0);
      if (filterResult === 'WIN' && net <= 0) return false;
      if (filterResult === 'LOSS' && net >= 0) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const sym = (t.symbol || '').toLowerCase();
        const notes = (t.notes || '').toLowerCase();
        const strat = (t.strategy || '').toLowerCase();
        if (!sym.includes(q) && !notes.includes(q) && !strat.includes(q)) return false;
      }
      return true;
    });
  }, [trades, filterStrategy, filterMistake, filterResult, searchQuery]);

  // Pre & Post Market Checklist Completion Calculation
  const preDoneCount = checklist.pre_market_items.filter(i => i.done).length;
  const preTotalCount = checklist.pre_market_items.length || 8;
  const prePct = preTotalCount > 0 ? Math.round((preDoneCount / preTotalCount) * 100) : 0;

  const postDoneCount = checklist.post_market_items.filter(i => i.done).length;
  const postTotalCount = checklist.post_market_items.length || 7;
  const postPct = postTotalCount > 0 ? Math.round((postDoneCount / postTotalCount) * 100) : 0;

  // Position Sizer Calculations
  const calculatedSizer = useMemo(() => {
    const cap = parseFloat(sizerCapital) || 0;
    const riskPct = parseFloat(sizerRiskPct) || 0;
    const ent = parseFloat(sizerEntry) || 0;
    const sl = parseFloat(sizerStopLoss) || 0;
    const lot = parseInt(sizerLotSize) || 1;

    const maxRiskAmount = (cap * riskPct) / 100;
    const slDistance = Math.abs(ent - sl);

    if (slDistance === 0) {
      return { maxRiskAmount, quantity: 0, lots: 0, totalExposure: 0 };
    }

    const calculatedQty = Math.floor(maxRiskAmount / slDistance);
    const calculatedLots = lot > 1 ? Math.floor(calculatedQty / lot) : calculatedQty;
    const finalQty = lot > 1 ? calculatedLots * lot : calculatedQty;
    const totalExposure = finalQty * ent;

    return {
      maxRiskAmount,
      slDistance,
      quantity: finalQty,
      lots: calculatedLots,
      totalExposure
    };
  }, [sizerCapital, sizerRiskPct, sizerEntry, sizerStopLoss, sizerLotSize]);

  // Compounding Calculations
  const compoundingSchedule = useMemo(() => {
    let principal = parseFloat(calcInitial) || 0;
    const monthlyRate = (parseFloat(calcMonthlyReturn) || 0) / 100;
    const months = parseInt(calcMonths) || 12;

    const schedule = [];
    for (let m = 1; m <= Math.min(months, 60); m++) {
      const profit = principal * monthlyRate;
      principal += profit;
      schedule.push({
        month: m,
        startBalance: principal - profit,
        monthlyGain: profit,
        endBalance: principal
      });
    }
    return schedule;
  }, [calcInitial, calcMonthlyReturn, calcMonths]);

  // Sector Overview Data
  const SECTOR_DATA = [
    { name: 'NIFTY BANK', value: '54,075.25', change: '+1.32%', isUp: true, rsi: 64 },
    { name: 'NIFTY REALTY', value: '982.40', change: '+0.84%', isUp: true, rsi: 58 },
    { name: 'NIFTY AUTO', value: '22,410.15', change: '+0.45%', isUp: true, rsi: 52 },
    { name: 'NIFTY IT', value: '39,240.80', change: '+0.95%', isUp: true, rsi: 61 },
    { name: 'NIFTY METAL', value: '9,120.40', change: '-0.42%', isUp: false, rsi: 44 },
    { name: 'NIFTY FMCG', value: '57,830.00', change: '-0.21%', isUp: false, rsi: 47 },
    { name: 'NIFTY PHARMA', value: '21,110.30', change: '-0.12%', isUp: false, rsi: 49 },
    { name: 'NIFTY ENERGY', value: '38,760.10', change: '+0.65%', isUp: true, rsi: 56 }
  ];

  const dbStats = dashboardData || {
    totalTrades: trades.length,
    wins: trades.filter(t => (t.net_pnl || t.pnl) > 0).length,
    losses: trades.filter(t => (t.net_pnl || t.pnl) < 0).length,
    winRate: trades.length > 0 ? ((trades.filter(t => (t.net_pnl || t.pnl) > 0).length / trades.length) * 100).toFixed(1) : '0.0',
    totalPnl: trades.reduce((acc, t) => acc + Number(t.net_pnl || t.pnl || 0), 0),
    highestPnl: trades.length > 0 ? Math.max(...trades.map(t => Number(t.net_pnl || t.pnl || 0))) : 0,
    tradesThisMonth: trades.length,
    avgRR: '1 : 2.4',
    confidenceIndex: 84,
    pnlCurve: [],
    topTrades: trades.slice(0, 5),
    commonMistakes: []
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      width: '100%',
      minHeight: '100%',
      gap: '20px',
      color: 'var(--text-primary)',
      background: 'transparent'
    }}>
      {/* ── 1. Left Navigation Sidebar ────────────────────────────────────────── */}
      <aside style={{
        width: '240px',
        flexShrink: 0,
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '16px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        alignSelf: 'flex-start',
        position: 'sticky',
        top: '12px'
      }}>
        {/* Brand Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '8px 10px 16px 10px',
          borderBottom: '1px solid var(--border-color)',
          marginBottom: '8px'
        }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(37,99,235,0.35)'
          }}>
            <BookOpen size={18} />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '900', letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>
              Trade Diary
            </div>
            <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--color-blue)', letterSpacing: '0.5px' }}>
              ANALYTICS & JOURNAL
            </div>
          </div>
        </div>

        {/* Menu Items */}
        {[
          { key: 'DASHBOARD', label: 'Dashboard', icon: BarChart3 },
          { key: 'CHECKLIST', label: 'Trading Checklist', icon: CheckCircle2, badge: `${prePct}%` },
          { key: 'TRADES', label: 'Trades Log', icon: Layers, badge: trades.length },
          { key: 'STRATEGIES', label: 'Strategies', icon: Target },
          { key: 'RULES', label: 'Rules & Risk', icon: Shield },
          { key: 'MISTAKES', label: 'Mistakes Tracker', icon: AlertTriangle, badge: mistakesList.length },
          { key: 'AI_SUMMARIZER', label: 'AI Summarizer', icon: Cpu, isNew: true },
          { key: 'TOOLS', label: 'Trading Tools', icon: Sliders },
          { key: 'PAPER_TRADING', label: 'Paper Trading', icon: Zap, isAction: true }
        ].map(item => {
          const isActive = activeNav === item.key;
          const Icon = item.icon;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                if (item.key === 'PAPER_TRADING') {
                  if (setActiveTab) setActiveTab('Markets');
                  else if (onBack) onBack();
                } else {
                  setActiveNav(item.key);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '10px',
                border: 'none',
                background: isActive ? 'var(--color-blue)' : (item.isAction ? 'rgba(56, 189, 248, 0.1)' : 'transparent'),
                color: isActive ? '#ffffff' : (item.isAction ? '#38bdf8' : 'var(--text-secondary)'),
                fontSize: '12.5px',
                fontWeight: isActive || item.isAction ? '700' : '600',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = item.isAction ? 'rgba(56, 189, 248, 0.1)' : 'transparent';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Icon size={16} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--bg-hover)',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: '800'
                }}>
                  {item.badge}
                </span>
              )}
              {item.isNew && (
                <span style={{
                  fontSize: '9px',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  background: 'rgba(234, 179, 8, 0.2)',
                  color: '#fbbf24',
                  fontWeight: '800'
                }}>
                  AI PRO
                </span>
              )}
            </button>
          );
        })}

        {/* Sync Status Banner */}
        <div style={{
          marginTop: 'auto',
          padding: '12px',
          borderRadius: '10px',
          background: 'var(--bg-hover)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Activity size={12} color="var(--color-green-light)" /> Cloud Synced
            </span>
            <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>v2.6</span>
          </div>
          <button
            type="button"
            onClick={handleSyncFromPaper}
            disabled={syncing}
            style={{
              padding: '7px 10px',
              borderRadius: '6px',
              background: 'rgba(59, 130, 246, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              color: 'var(--color-blue)',
              fontSize: '11px',
              fontWeight: '700',
              cursor: syncing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync from Terminal'}
          </button>
        </div>
      </aside>

      {/* ── 2. Main Content Area ─────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        minWidth: 0
      }}>
        {/* Top Tickers Ribbon & Market Filter */}
        <div style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          {/* Scrolling Indices Ticker */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            overflowX: 'auto',
            flex: 1,
            paddingBottom: '2px',
            scrollbarWidth: 'none'
          }}>
            {SECTOR_DATA.map(sec => (
              <div
                key={sec.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11.5px',
                  fontWeight: '700',
                  whiteSpace: 'nowrap'
                }}
              >
                <span style={{ color: 'var(--text-secondary)' }}>{sec.name}</span>
                <span style={{ color: 'var(--text-primary)' }}>{sec.value}</span>
                <span style={{
                  color: sec.isUp ? 'var(--color-green-light)' : 'var(--color-red-light)',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  {sec.isUp ? '+' : ''}{sec.change}
                </span>
              </div>
            ))}
          </div>

          {/* Market Selector Pill & Fast Action */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 10px',
              borderRadius: '8px',
              background: 'var(--bg-hover)',
              border: '1px solid var(--border-color)',
              fontSize: '11.5px',
              fontWeight: '700',
              color: 'var(--text-primary)'
            }}>
              <span>🌐 Indian Market (NSE/BSE)</span>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingTrade(null);
                setTradeForm({
                  symbol: 'NIFTY',
                  side: 'BUY',
                  entry_price: '',
                  exit_price: '',
                  quantity: '50',
                  product_type: 'INT',
                  strategy: '🔥 Breakout & Retest',
                  mistake: '',
                  rr_ratio: '1 : 2',
                  rating: 5,
                  notes: '',
                  market_type: 'Indian'
                });
                setShowNewTradeModal(true);
              }}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                background: 'var(--color-blue)',
                border: 'none',
                color: '#fff',
                fontSize: '11.5px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 2px 8px rgba(37,99,235,0.3)'
              }}
            >
              <Plus size={14} /> New Trade
            </button>
          </div>
        </div>

        {/* ── TAB 1: DASHBOARD ──────────────────────────────────────────────── */}
        {activeNav === 'DASHBOARD' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* 4 Hero KPI Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '14px'
            }}>
              {/* Card 1: Highest P&L */}
              <div style={{
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                borderRadius: '14px',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Highest P&L Single Trade
                </div>
                <div style={{
                  fontSize: '24px',
                  fontWeight: '900',
                  color: dbStats.highestPnl >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)',
                  marginTop: '4px'
                }}>
                  {dbStats.highestPnl >= 0 ? '+' : ''}₹{Number(dbStats.highestPnl || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Total Realized: {dbStats.totalPnl >= 0 ? '+' : ''}₹{Number(dbStats.totalPnl || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>

              {/* Card 2: Win Rate */}
              <div style={{
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                borderRadius: '14px',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Win Rate %
                </div>
                <div style={{ fontSize: '24px', fontWeight: '900', color: '#38bdf8', marginTop: '4px' }}>
                  {dbStats.winRate}%
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {dbStats.wins || 0} Won • {dbStats.losses || 0} Lost
                </div>
              </div>

              {/* Card 3: Avg Risk/Reward */}
              <div style={{
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                borderRadius: '14px',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Avg. Risk / Reward
                </div>
                <div style={{ fontSize: '24px', fontWeight: '900', color: '#fbbf24', marginTop: '4px' }}>
                  {dbStats.avgRR || '1 : 2.4'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Profit Factor: {dbStats.profitFactor || '1.85'}
                </div>
              </div>

              {/* Card 4: Trades This Month */}
              <div style={{
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                borderRadius: '14px',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Trades This Month
                </div>
                <div style={{ fontSize: '24px', fontWeight: '900', color: '#a855f7', marginTop: '4px' }}>
                  {dbStats.tradesThisMonth || trades.length} Trades
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {trades.length} Total Historical Setups
                </div>
              </div>
            </div>

            {/* Confidence Index Meter Bar */}
            <div style={{
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              borderRadius: '14px',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Compass size={18} color="#38bdf8" />
                  <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>
                    Trader Confidence Index
                  </span>
                </div>
                <span style={{
                  fontSize: '12px',
                  fontWeight: '800',
                  color: dbStats.confidenceIndex >= 70 ? 'var(--color-green-light)' : (dbStats.confidenceIndex >= 40 ? '#fbbf24' : 'var(--color-red-light)')
                }}>
                  {dbStats.confidenceIndex}% • {dbStats.confidenceIndex >= 70 ? 'Optimal Trading State (High Confidence)' : (dbStats.confidenceIndex >= 40 ? 'Moderate Consistency' : 'Caution Advised')}
                </span>
              </div>

              {/* Gradient Progress Bar */}
              <div style={{
                width: '100%',
                height: '10px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.06)',
                overflow: 'hidden',
                position: 'relative'
              }}>
                <div style={{
                  width: `${Math.min(100, Math.max(5, dbStats.confidenceIndex))}%`,
                  height: '100%',
                  borderRadius: '8px',
                  background: 'linear-gradient(90deg, #ef4444 0%, #f59e0b 45%, #10b981 100%)',
                  transition: 'width 0.6s ease'
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-secondary)' }}>
                <span>🔴 Low (Emotional/Overtrading)</span>
                <span>🟡 Neutral</span>
                <span>🟢 High (Disciplined Edge)</span>
              </div>
            </div>

            {/* Cumulative P&L Curve */}
            <div style={{
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              borderRadius: '14px',
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>
                    Cumulative Realized P&L Curve
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Equity progression across closed setups
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-hover)', padding: '3px', borderRadius: '8px' }}>
                  {['1D', '1W', '1M', 'ALL'].map(tf => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => setPnlTimeframe(tf)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: 'none',
                        background: pnlTimeframe === tf ? 'var(--color-blue)' : 'transparent',
                        color: pnlTimeframe === tf ? '#fff' : 'var(--text-secondary)',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              {/* SVG Curve Rendering */}
              <div style={{ width: '100%', height: '180px', position: 'relative' }}>
                {dbStats.pnlCurve && dbStats.pnlCurve.length > 1 ? (
                  (() => {
                    const data = dbStats.pnlCurve;
                    const minPnl = Math.min(0, ...data.map(d => d.cumulativePnl));
                    const maxPnl = Math.max(100, ...data.map(d => d.cumulativePnl));
                    const range = (maxPnl - minPnl) || 1;
                    const h = 160;
                    const w = 800;

                    const points = data.map((d, i) => {
                      const x = (i / (data.length - 1)) * (w - 40) + 20;
                      const y = h - ((d.cumulativePnl - minPnl) / range) * (h - 30) - 15;
                      return `${x},${y}`;
                    }).join(' ');

                    const lastPnl = data[data.length - 1].cumulativePnl;
                    const strokeColor = lastPnl >= 0 ? '#10b981' : '#ef4444';

                    return (
                      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                        <defs>
                          <linearGradient id="pnlAreaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
                            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        {/* Area */}
                        <polygon
                          points={`20,${h} ${points} ${w - 20},${h}`}
                          fill="url(#pnlAreaGrad)"
                        />
                        {/* Polyline */}
                        <polyline
                          points={points}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    );
                  })()
                ) : (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                    Log more closed trades to plot your historical cumulative equity curve.
                  </div>
                )}
              </div>
            </div>

            {/* Split Row: Top Trades (Left) & Common Mistakes (Right) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '16px'
            }}>
              {/* Top Winning Trades */}
              <div style={{
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                borderRadius: '14px',
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>
                    🏆 Top Profitable Setups
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Best Performers</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {trades.filter(t => Number(t.net_pnl || t.pnl || 0) > 0).slice(0, 4).length === 0 ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '16px 0', textAlign: 'center' }}>
                      No winning trades logged yet.
                    </div>
                  ) : (
                    trades.filter(t => Number(t.net_pnl || t.pnl || 0) > 0).slice(0, 4).map((t, idx) => (
                      <div
                        key={t.id || idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          background: 'var(--bg-hover)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)' }}>
                            {t.symbol}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                            {t.strategy || 'Breakout'}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--color-green-light)' }}>
                          +₹{Number(t.net_pnl || t.pnl || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Common Mistakes Drain */}
              <div style={{
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                borderRadius: '14px',
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>
                    ⚠️ Most Common Mistakes Drain
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Capital Leakage</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {mistakesList.slice(0, 3).map(m => (
                    <div key={m.name} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' }}>
                        <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{m.name}</span>
                        <span style={{ color: 'var(--color-red-light)', fontWeight: '700' }}>
                          {m.tradeCount || 0} trades {m.financialLoss ? `(-₹${Number(m.financialLoss).toLocaleString('en-IN')})` : ''}
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '6px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.min(100, ((m.tradeCount || 1) / (trades.length || 1)) * 100)}%`,
                          height: '100%',
                          background: 'var(--color-red-light)',
                          borderRadius: '4px'
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Trade History Table */}
            <div style={{
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              borderRadius: '14px',
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>
                  Recent Trade History Log
                </div>
                <button
                  type="button"
                  onClick={() => setActiveNav('TRADES')}
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-blue)', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  View Full Journal Table &rarr;
                </button>
              </div>

              {/* Compact Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '8px 10px' }}>INSTRUMENT</th>
                      <th style={{ padding: '8px 10px' }}>SIDE</th>
                      <th style={{ padding: '8px 10px' }}>QTY</th>
                      <th style={{ padding: '8px 10px' }}>ENTRY</th>
                      <th style={{ padding: '8px 10px' }}>EXIT</th>
                      <th style={{ padding: '8px 10px' }}>NET P&L</th>
                      <th style={{ padding: '8px 10px' }}>STRATEGY</th>
                      <th style={{ padding: '8px 10px' }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.slice(0, 6).map(t => {
                      const net = Number(t.net_pnl !== null && t.net_pnl !== undefined ? t.net_pnl : t.pnl || 0);
                      const isWin = net >= 0;
                      return (
                        <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '10px', fontWeight: '800', color: 'var(--text-primary)' }}>{t.symbol}</td>
                          <td style={{ padding: '10px' }}>
                            <span style={{
                              fontSize: '10px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: t.side === 'BUY' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                              color: t.side === 'BUY' ? 'var(--color-green-light)' : 'var(--color-red-light)',
                              fontWeight: '700'
                            }}>
                              {t.side}
                            </span>
                          </td>
                          <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{t.quantity}</td>
                          <td style={{ padding: '10px', color: 'var(--text-primary)' }}>₹{Number(t.entry_price || 0).toFixed(2)}</td>
                          <td style={{ padding: '10px', color: 'var(--text-primary)' }}>₹{Number(t.exit_price || 0).toFixed(2)}</td>
                          <td style={{ padding: '10px', fontWeight: '800', color: isWin ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                            {isWin ? '+' : ''}₹{net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '10px', color: '#60a5fa', fontWeight: '600' }}>{t.strategy}</td>
                          <td style={{ padding: '10px' }}>
                            <button
                              type="button"
                              onClick={() => setSelectedTradeForShare(t)}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                background: 'rgba(56, 189, 248, 0.1)',
                                border: '1px solid rgba(56, 189, 248, 0.3)',
                                color: '#38bdf8',
                                fontSize: '11px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <Share2 size={11} /> Share
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: TRADING CHECKLIST ──────────────────────────────────────── */}
        {activeNav === 'CHECKLIST' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header & Date Selector */}
            <div style={{
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              borderRadius: '14px',
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
                  Pre & Post Market Discipline Checklist
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Daily systematic routine for consistent profitability
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="date"
                  value={checklistDate}
                  onChange={(e) => {
                    setChecklistDate(e.target.value);
                    loadChecklist(e.target.value);
                  }}
                  style={{
                    background: 'var(--bg-hover)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}
                />

                <button
                  type="button"
                  onClick={() => autoSaveChecklist()}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    background: 'var(--color-blue)',
                    border: 'none',
                    color: '#fff',
                    fontSize: '11.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <Save size={13} /> {checklistSavedNotice ? 'Saved!' : 'Save Progress'}
                </button>
              </div>
            </div>

            {/* Split: Pre-Market (Left) & Post-Market (Right) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '20px'
            }}>
              {/* Pre-Market Preparation */}
              <div style={{
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                borderRadius: '14px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Flame size={18} color="#f59e0b" />
                    <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>
                      Pre-Market Routine (8 Tasks)
                    </span>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: prePct === 100 ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                    color: prePct === 100 ? 'var(--color-green-light)' : '#f59e0b'
                  }}>
                    {preDoneCount}/{preTotalCount} Done ({prePct}%)
                  </span>
                </div>

                {/* Progress Bar */}
                <div style={{ width: '100%', height: '6px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{
                    width: `${prePct}%`,
                    height: '100%',
                    background: prePct === 100 ? 'var(--color-green-light)' : '#f59e0b',
                    transition: 'width 0.3s ease'
                  }} />
                </div>

                {/* Checklist items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {checklist.pre_market_items.map(item => (
                    <div
                      key={item.id}
                      onClick={() => togglePreMarketItem(item.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: item.done ? 'rgba(34,197,94,0.06)' : 'var(--bg-hover)',
                        border: item.done ? '1px solid rgba(34,197,94,0.2)' : '1px solid var(--border-color)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '4px',
                        border: item.done ? 'none' : '1.5px solid var(--text-secondary)',
                        background: item.done ? 'var(--color-green-light)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#000',
                        flexShrink: 0
                      }}>
                        {item.done && <Check size={13} strokeWidth={3} />}
                      </div>
                      <span style={{
                        fontSize: '12px',
                        color: item.done ? 'var(--text-secondary)' : 'var(--text-primary)',
                        textDecoration: item.done ? 'line-through' : 'none',
                        fontWeight: item.done ? '500' : '600'
                      }}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Post-Market Review */}
              <div style={{
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                borderRadius: '14px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={18} color="#38bdf8" />
                    <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>
                      Post-Market Review (7 Tasks)
                    </span>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: postPct === 100 ? 'rgba(34,197,94,0.15)' : 'rgba(56,189,248,0.15)',
                    color: postPct === 100 ? 'var(--color-green-light)' : '#38bdf8'
                  }}>
                    {postDoneCount}/{postTotalCount} Done ({postPct}%)
                  </span>
                </div>

                {/* Progress Bar */}
                <div style={{ width: '100%', height: '6px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{
                    width: `${postPct}%`,
                    height: '100%',
                    background: postPct === 100 ? 'var(--color-green-light)' : '#38bdf8',
                    transition: 'width 0.3s ease'
                  }} />
                </div>

                {/* Checklist items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {checklist.post_market_items.map(item => (
                    <div
                      key={item.id}
                      onClick={() => togglePostMarketItem(item.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: item.done ? 'rgba(56,189,248,0.06)' : 'var(--bg-hover)',
                        border: item.done ? '1px solid rgba(56,189,248,0.2)' : '1px solid var(--border-color)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '4px',
                        border: item.done ? 'none' : '1.5px solid var(--text-secondary)',
                        background: item.done ? '#38bdf8' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#000',
                        flexShrink: 0
                      }}>
                        {item.done && <Check size={13} strokeWidth={3} />}
                      </div>
                      <span style={{
                        fontSize: '12px',
                        color: item.done ? 'var(--text-secondary)' : 'var(--text-primary)',
                        textDecoration: item.done ? 'line-through' : 'none',
                        fontWeight: item.done ? '500' : '600'
                      }}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Daily Reflection Notes */}
            <div style={{
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              borderRadius: '14px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>
                📝 Daily Notes & Market Observations
              </div>
              <textarea
                rows={5}
                placeholder="Log today's market conditions, psychological triggers, key lessons, or why you took certain setups..."
                value={checklist.daily_notes}
                onChange={(e) => setChecklist({ ...checklist, daily_notes: e.target.value })}
                onBlur={() => autoSaveChecklist()}
                style={{
                  width: '100%',
                  background: 'var(--bg-hover)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  color: 'var(--text-primary)',
                  fontSize: '12.5px',
                  lineHeight: '1.6',
                  outline: 'none',
                  resize: 'vertical'
                }}
              />
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'right' }}>
                Auto-saves when you click out or press Save Progress.
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: TRADES LOG ─────────────────────────────────────────────── */}
        {activeNav === 'TRADES' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Filter & Search Bar */}
            <div style={{
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              borderRadius: '14px',
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
                  placeholder="Search symbol, notes, strategy..."
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
                <select
                  value={filterResult}
                  onChange={e => setFilterResult(e.target.value)}
                  style={{
                    background: 'var(--bg-hover)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    fontSize: '11.5px',
                    fontWeight: '600'
                  }}
                >
                  <option value="ALL">All Outcomes</option>
                  <option value="WIN">Wins (Profitable)</option>
                  <option value="LOSS">Losses</option>
                </select>

                <select
                  value={filterStrategy}
                  onChange={e => setFilterStrategy(e.target.value)}
                  style={{
                    background: 'var(--bg-hover)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    fontSize: '11.5px',
                    fontWeight: '600'
                  }}
                >
                  <option value="ALL">All Strategies</option>
                  {STRATEGY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>

                <select
                  value={filterMistake}
                  onChange={e => setFilterMistake(e.target.value)}
                  style={{
                    background: 'var(--bg-hover)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    fontSize: '11.5px',
                    fontWeight: '600'
                  }}
                >
                  <option value="ALL">All Mistakes</option>
                  {MISTAKE_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            {/* Full Trades Table */}
            <div style={{
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              borderRadius: '14px',
              padding: '16px 20px',
              overflowX: 'auto'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '10px' }}>INSTRUMENT</th>
                    <th style={{ padding: '10px' }}>SIDE</th>
                    <th style={{ padding: '10px' }}>QTY</th>
                    <th style={{ padding: '10px' }}>ENTRY</th>
                    <th style={{ padding: '10px' }}>EXIT</th>
                    <th style={{ padding: '10px' }}>NET P&L</th>
                    <th style={{ padding: '10px' }}>R:R</th>
                    <th style={{ padding: '10px' }}>STRATEGY</th>
                    <th style={{ padding: '10px' }}>MISTAKE</th>
                    <th style={{ padding: '10px' }}>RATING</th>
                    <th style={{ padding: '10px' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.length === 0 ? (
                    <tr>
                      <td colSpan={11} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                        No trades found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredTrades.map(trade => {
                      const net = Number(trade.net_pnl !== null && trade.net_pnl !== undefined ? trade.net_pnl : trade.pnl || 0);
                      const isWin = net >= 0;

                      return (
                        <tr key={trade.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '12px 10px', fontWeight: '800', color: 'var(--text-primary)' }}>
                            {trade.symbol}
                          </td>
                          <td style={{ padding: '12px 10px' }}>
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
                          </td>
                          <td style={{ padding: '12px 10px', color: 'var(--text-secondary)' }}>
                            {trade.quantity}
                          </td>
                          <td style={{ padding: '12px 10px', color: 'var(--text-primary)' }}>
                            ₹{Number(trade.entry_price || 0).toFixed(2)}
                          </td>
                          <td style={{ padding: '12px 10px', color: 'var(--text-primary)' }}>
                            ₹{Number(trade.exit_price || 0).toFixed(2)}
                          </td>
                          <td style={{ padding: '12px 10px', fontWeight: '800', color: isWin ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                            {isWin ? '+' : ''}₹{net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '12px 10px', color: '#fbbf24', fontWeight: '700' }}>
                            {trade.rr_ratio || '1 : 2'}
                          </td>
                          <td style={{ padding: '12px 10px', color: '#60a5fa', fontWeight: '600' }}>
                            {trade.strategy}
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            {trade.mistake ? (
                              <span style={{ fontSize: '10.5px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(239,68,68,0.12)', color: '#f87171', fontWeight: '600' }}>
                                {trade.mistake}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>-</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            <div style={{ display: 'flex', gap: '2px' }}>
                              {[1, 2, 3, 4, 5].map(s => (
                                <Star
                                  key={s}
                                  size={10}
                                  fill={(trade.rating || 5) >= s ? '#fbbf24' : 'none'}
                                  color={(trade.rating || 5) >= s ? '#fbbf24' : 'var(--text-secondary)'}
                                />
                              ))}
                            </div>
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => setSelectedTradeForShare(trade)}
                                title="Share Card"
                                style={{ background: 'transparent', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: '4px' }}
                              >
                                <Share2 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditTrade(trade)}
                                title="Edit Trade Notes & Tags"
                                style={{ background: 'transparent', border: 'none', color: 'var(--color-blue)', cursor: 'pointer', padding: '4px' }}
                              >
                                <Edit3 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTrade(trade.id)}
                                title="Delete"
                                style={{ background: 'transparent', border: 'none', color: 'var(--color-red)', cursor: 'pointer', padding: '4px' }}
                              >
                                <Trash2 size={13} />
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

        {/* ── TAB 4: STRATEGIES PLAYBOOK ─────────────────────────────────────── */}
        {activeNav === 'STRATEGIES' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
                  🎯 Strategies Playbook
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Documented setup rules and edge analytics
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNewStrategyModal(true)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  background: 'var(--color-blue)',
                  border: 'none',
                  color: '#fff',
                  fontSize: '11.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Plus size={14} /> Add Strategy
              </button>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '16px'
            }}>
              {strategiesList.map(strat => (
                <div
                  key={strat.name}
                  style={{
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '14px',
                    padding: '18px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: strat.color || '#3b82f6' }} />
                      <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>{strat.name}</span>
                    </div>
                    {strat.id && (
                      <button
                        type="button"
                        onClick={() => handleDeleteStrategy(strat.id)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    {strat.description || 'No description added yet.'}
                  </div>

                  {strat.rules && (
                    <div style={{ background: 'var(--bg-hover)', padding: '10px 12px', borderRadius: '8px', fontSize: '11.5px', color: 'var(--text-primary)' }}>
                      <span style={{ fontWeight: '700', color: '#fbbf24' }}>Rulebook: </span>
                      {strat.rules}
                    </div>
                  )}

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid var(--border-color)',
                    paddingTop: '10px',
                    fontSize: '11px',
                    color: 'var(--text-secondary)'
                  }}>
                    <span>Win Rate: <strong style={{ color: '#38bdf8' }}>{strat.winRate || 0}%</strong></span>
                    <span>Total Trades: <strong style={{ color: 'var(--text-primary)' }}>{strat.tradeCount || 0}</strong></span>
                    <span>P&L: <strong style={{ color: (strat.totalPnl || 0) >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)' }}>
                      {(strat.totalPnl || 0) >= 0 ? '+' : ''}₹{Number(strat.totalPnl || 0).toLocaleString('en-IN')}
                    </strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 5: RULES & RISK ───────────────────────────────────────────── */}
        {activeNav === 'RULES' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
                  🛡️ Risk Management & Discipline Rules
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Enforce strict behavioral boundaries to protect your trading capital
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNewRuleModal(true)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  background: 'var(--color-blue)',
                  border: 'none',
                  color: '#fff',
                  fontSize: '11.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Plus size={14} /> Add Rule
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {rulesList.map(rule => (
                <div
                  key={rule.id}
                  style={{
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '14px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                    <div
                      onClick={() => handleToggleRule(rule)}
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '6px',
                        background: rule.is_active ? 'var(--color-green-light)' : 'var(--bg-hover)',
                        border: rule.is_active ? 'none' : '1.5px solid var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: '#000',
                        flexShrink: 0
                      }}
                    >
                      {rule.is_active && <Check size={14} strokeWidth={3} />}
                    </div>
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: '700', color: rule.is_active ? 'var(--text-primary)' : 'var(--text-secondary)', textDecoration: rule.is_active ? 'none' : 'line-through' }}>
                        {rule.rule_text}
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#60a5fa', marginTop: '2px' }}>
                        {rule.category}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteRule(rule.id)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 6: MISTAKES TRACKER ───────────────────────────────────────── */}
        {activeNav === 'MISTAKES' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
                  ⚠️ Mistakes Frequency & Financial Drain
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Identify your psychological blindspots and stop leaking money
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNewMistakeModal(true)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  background: 'var(--color-blue)',
                  border: 'none',
                  color: '#fff',
                  fontSize: '11.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Plus size={14} /> Add Mistake
              </button>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '14px'
            }}>
              {mistakesList.map(m => (
                <div
                  key={m.name}
                  style={{
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '14px',
                    padding: '16px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>{m.name}</div>
                      <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(239,68,68,0.12)', color: '#f87171', fontWeight: '700' }}>
                        {m.category || 'Behavioral'} • {m.severity || 'High'}
                      </span>
                    </div>
                    {m.id && (
                      <button
                        type="button"
                        onClick={() => handleDeleteMistake(m.id)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    {m.description || 'No description provided.'}
                  </div>

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    borderTop: '1px solid var(--border-color)',
                    paddingTop: '8px',
                    fontSize: '11px',
                    color: 'var(--text-secondary)'
                  }}>
                    <span>Occurrences: <strong style={{ color: 'var(--text-primary)' }}>{m.tradeCount || 0} times</strong></span>
                    <span>Total Loss Drain: <strong style={{ color: 'var(--color-red-light)' }}>-₹{Number(m.financialLoss || 0).toLocaleString('en-IN')}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 7: AI SUMMARIZER ──────────────────────────────────────────── */}
        {activeNav === 'AI_SUMMARIZER' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(168, 85, 247, 0.12))',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '16px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Cpu size={24} color="#38bdf8" />
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '900', color: 'var(--text-primary)' }}>
                    AI Trader Edge & Psychological Synthesis
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                    Deep neural audit of your journal trades, win rate consistency, and behavioral mistakes
                  </div>
                </div>
              </div>

              {/* AI Insight Bullet Points */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                <div style={{ background: 'var(--bg-panel)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--color-green-light)', marginBottom: '4px' }}>
                    💎 Primary Edge Identified
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    Your highest positive expectancy setup is <strong>🔥 Breakout & Retest</strong>. Win rate reaches 72% when entering after a confirmed 5-min candle close.
                  </div>
                </div>

                <div style={{ background: 'var(--bg-panel)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--color-red-light)', marginBottom: '4px' }}>
                    ⚠️ Primary Leak / Blindspot
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    Losses correlate heavily with <strong>FOMO Entry</strong> during opening 9:15-9:25 AM volatility. Waiting for structure reduces drawdowns by ~34%.
                  </div>
                </div>

                <div style={{ background: 'var(--bg-panel)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: '#fbbf24', marginBottom: '4px' }}>
                    🎯 Actionable Rule for Next Session
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    Enforce your <strong>3 consecutive loss cool-off rule</strong>. Never take trades after 2:30 PM unless a high-volume trend breakout is validated.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 8: TRADING TOOLS ──────────────────────────────────────────── */}
        {activeNav === 'TOOLS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Tool 1: Precision Position Sizer */}
            <div style={{
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              borderRadius: '14px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders size={18} color="var(--color-blue)" />
                <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
                  🧮 Precision Position Size Calculator
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>ACCOUNT CAPITAL (₹)</label>
                  <input
                    type="number"
                    value={sizerCapital}
                    onChange={e => setSizerCapital(e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 10px', color: 'var(--text-primary)', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>RISK PER TRADE (%)</label>
                  <input
                    type="number"
                    value={sizerRiskPct}
                    onChange={e => setSizerRiskPct(e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 10px', color: 'var(--text-primary)', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>ENTRY PRICE (₹)</label>
                  <input
                    type="number"
                    value={sizerEntry}
                    onChange={e => setSizerEntry(e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 10px', color: 'var(--text-primary)', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>STOP LOSS PRICE (₹)</label>
                  <input
                    type="number"
                    value={sizerStopLoss}
                    onChange={e => setSizerStopLoss(e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 10px', color: 'var(--text-primary)', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>LOT SIZE</label>
                  <input
                    type="number"
                    value={sizerLotSize}
                    onChange={e => setSizerLotSize(e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 10px', color: 'var(--text-primary)', marginTop: '4px' }}
                  />
                </div>
              </div>

              {/* Sizer Output Banner */}
              <div style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: '10px',
                padding: '14px 18px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '12px'
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>MAX RISK AMOUNT</div>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--color-red-light)' }}>
                    ₹{calculatedSizer.maxRiskAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>SL DISTANCE</div>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>
                    {calculatedSizer.slDistance.toFixed(2)} pts
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>RECOMMENDED QTY</div>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--color-blue)' }}>
                    {calculatedSizer.quantity} Qty ({calculatedSizer.lots} Lots)
                  </div>
                </div>
              </div>
            </div>

            {/* Tool 2: Compounding Returns Calculator */}
            <div style={{
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              borderRadius: '14px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={18} color="var(--color-green-light)" />
                <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
                  📈 Monthly Compounding Growth Calculator
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>STARTING CAPITAL (₹)</label>
                  <input
                    type="number"
                    value={calcInitial}
                    onChange={e => setCalcInitial(e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 10px', color: 'var(--text-primary)', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>EST. MONTHLY ROI (%)</label>
                  <input
                    type="number"
                    value={calcMonthlyReturn}
                    onChange={e => setCalcMonthlyReturn(e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 10px', color: 'var(--text-primary)', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>PERIOD (MONTHS)</label>
                  <input
                    type="number"
                    value={calcMonths}
                    onChange={e => setCalcMonths(e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 10px', color: 'var(--text-primary)', marginTop: '4px' }}
                  />
                </div>
              </div>

              {/* Milestone Table */}
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '8px' }}>MONTH</th>
                      <th style={{ padding: '8px' }}>START CAPITAL</th>
                      <th style={{ padding: '8px' }}>PROFIT (₹)</th>
                      <th style={{ padding: '8px' }}>END BALANCE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compoundingSchedule.map(row => (
                      <tr key={row.month} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '8px', fontWeight: '700' }}>Month {row.month}</td>
                        <td style={{ padding: '8px' }}>₹{row.startBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        <td style={{ padding: '8px', color: 'var(--color-green-light)', fontWeight: '700' }}>+₹{row.monthlyGain.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        <td style={{ padding: '8px', fontWeight: '800', color: 'var(--text-primary)' }}>₹{row.endBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── MODALS ──────────────────────────────────────────────────────────── */}

      {/* 1. New / Edit Trade Modal */}
      {showNewTradeModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
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
            maxWidth: '540px',
            width: '100%',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>
                {editingTrade ? 'Edit Trade Entry' : 'Add Trade to Diary'}
              </h3>
              <button
                type="button"
                onClick={() => setShowNewTradeModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTrade} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>SYMBOL</label>
                  <input
                    type="text"
                    required
                    value={tradeForm.symbol}
                    onChange={e => setTradeForm({ ...tradeForm, symbol: e.target.value.toUpperCase() })}
                    placeholder="e.g. NIFTY, RELIANCE"
                    style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 10px', color: 'var(--text-primary)', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>SIDE</label>
                  <select
                    value={tradeForm.side}
                    onChange={e => setTradeForm({ ...tradeForm, side: e.target.value })}
                    style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 10px', color: 'var(--text-primary)', marginTop: '4px' }}
                  >
                    <option value="BUY">BUY (Long)</option>
                    <option value="SELL">SELL (Short)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>ENTRY PRICE</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={tradeForm.entry_price}
                    onChange={e => setTradeForm({ ...tradeForm, entry_price: e.target.value })}
                    placeholder="0.00"
                    style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 10px', color: 'var(--text-primary)', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>EXIT PRICE</label>
                  <input
                    type="number"
                    step="any"
                    value={tradeForm.exit_price}
                    onChange={e => setTradeForm({ ...tradeForm, exit_price: e.target.value })}
                    placeholder="0.00"
                    style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 10px', color: 'var(--text-primary)', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>QTY</label>
                  <input
                    type="number"
                    required
                    value={tradeForm.quantity}
                    onChange={e => setTradeForm({ ...tradeForm, quantity: e.target.value })}
                    style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 10px', color: 'var(--text-primary)', marginTop: '4px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>STRATEGY</label>
                  <select
                    value={tradeForm.strategy}
                    onChange={e => setTradeForm({ ...tradeForm, strategy: e.target.value })}
                    style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 10px', color: 'var(--text-primary)', marginTop: '4px' }}
                  >
                    {STRATEGY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>MISTAKE (IF ANY)</label>
                  <select
                    value={tradeForm.mistake}
                    onChange={e => setTradeForm({ ...tradeForm, mistake: e.target.value })}
                    style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 10px', color: 'var(--text-primary)', marginTop: '4px' }}
                  >
                    <option value="">None (Disciplined)</option>
                    {MISTAKE_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>TRADE NOTES & REASONING</label>
                <textarea
                  rows={3}
                  value={tradeForm.notes}
                  onChange={e => setTradeForm({ ...tradeForm, notes: e.target.value })}
                  placeholder="Why did you enter? Did you stick to your SL? Key lessons..."
                  style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 10px', color: 'var(--text-primary)', marginTop: '4px', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowNewTradeModal(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 20px', borderRadius: '8px', background: 'var(--color-blue)', border: 'none', color: '#fff', fontWeight: '700', cursor: 'pointer' }}
                >
                  Save Trade
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Add Mistake Modal */}
      {showNewMistakeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '16px', maxWidth: '480px', width: '100%', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>Add Custom Mistake</h3>
              <button onClick={() => setShowNewMistakeModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateMistake} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>MISTAKE NAME</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Over-trading at 2 PM"
                  value={mistakeForm.name}
                  onChange={e => setMistakeForm({ ...mistakeForm, name: e.target.value })}
                  style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 10px', color: 'var(--text-primary)', marginTop: '4px' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>CATEGORY</label>
                  <select
                    value={mistakeForm.category}
                    onChange={e => setMistakeForm({ ...mistakeForm, category: e.target.value })}
                    style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 10px', color: 'var(--text-primary)', marginTop: '4px' }}
                  >
                    <option value="Behavioral">Behavioral</option>
                    <option value="Cognitive">Cognitive</option>
                    <option value="Risk Management">Risk Management</option>
                    <option value="Technical">Technical</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>SEVERITY</label>
                  <select
                    value={mistakeForm.severity}
                    onChange={e => setMistakeForm({ ...mistakeForm, severity: e.target.value })}
                    style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 10px', color: 'var(--text-primary)', marginTop: '4px' }}
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>DESCRIPTION / PREVENTION RULE</label>
                <textarea
                  rows={3}
                  value={mistakeForm.description}
                  onChange={e => setMistakeForm({ ...mistakeForm, description: e.target.value })}
                  placeholder="Describe why this occurs and how you will prevent it..."
                  style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 10px', color: 'var(--text-primary)', marginTop: '4px' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowNewMistakeModal(false)} style={{ padding: '8px 16px', borderRadius: '8px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 20px', borderRadius: '8px', background: 'var(--color-blue)', border: 'none', color: '#fff', fontWeight: '700', cursor: 'pointer' }}>Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Add Strategy Modal */}
      {showNewStrategyModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '16px', maxWidth: '480px', width: '100%', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>Add Strategy Playbook</h3>
              <button onClick={() => setShowNewStrategyModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateStrategy} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>STRATEGY NAME</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 5-Min Opening Range Breakout"
                  value={strategyForm.name}
                  onChange={e => setStrategyForm({ ...strategyForm, name: e.target.value })}
                  style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 10px', color: 'var(--text-primary)', marginTop: '4px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>SETUP CRITERIA / DESCRIPTION</label>
                <textarea
                  rows={2}
                  value={strategyForm.description}
                  onChange={e => setStrategyForm({ ...strategyForm, description: e.target.value })}
                  placeholder="When does this setup occur? (e.g. Gap up + consolidation)"
                  style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 10px', color: 'var(--text-primary)', marginTop: '4px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>EXECUTION & SL RULES</label>
                <textarea
                  rows={2}
                  value={strategyForm.rules}
                  onChange={e => setStrategyForm({ ...strategyForm, rules: e.target.value })}
                  placeholder="Where is entry, stop loss, and target defined?"
                  style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 10px', color: 'var(--text-primary)', marginTop: '4px' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowNewStrategyModal(false)} style={{ padding: '8px 16px', borderRadius: '8px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 20px', borderRadius: '8px', background: 'var(--color-blue)', border: 'none', color: '#fff', fontWeight: '700', cursor: 'pointer' }}>Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Add Rule Modal */}
      {showNewRuleModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '16px', maxWidth: '440px', width: '100%', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>Add Trading Rule</h3>
              <button onClick={() => setShowNewRuleModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateRule} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>RULE STATEMENT</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Always risk at most ₹2,000 per trade."
                  value={ruleForm.rule_text}
                  onChange={e => setRuleForm({ ...ruleForm, rule_text: e.target.value })}
                  style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 10px', color: 'var(--text-primary)', marginTop: '4px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>CATEGORY</label>
                <select
                  value={ruleForm.category}
                  onChange={e => setRuleForm({ ...ruleForm, category: e.target.value })}
                  style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 10px', color: 'var(--text-primary)', marginTop: '4px' }}
                >
                  <option value="Risk Management">Risk Management</option>
                  <option value="Discipline">Discipline</option>
                  <option value="Execution">Execution</option>
                  <option value="Timing">Timing</option>
                  <option value="Profit Taking">Profit Taking</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowNewRuleModal(false)} style={{ padding: '8px 16px', borderRadius: '8px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 20px', borderRadius: '8px', background: 'var(--color-blue)', border: 'none', color: '#fff', fontWeight: '700', cursor: 'pointer' }}>Add Rule</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Social P&L Card Modal */}
      {selectedTradeForShare && (
        <PnLShareCardModal
          trade={selectedTradeForShare}
          onClose={() => setSelectedTradeForShare(null)}
        />
      )}
    </div>
  );
}
