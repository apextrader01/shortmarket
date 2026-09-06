// Market Segments Configuration & Presets
export const MARKET_CONFIGS = {
  Indian: {
    label: 'Indian (NSE/BSE)',
    flag: '🇮🇳',
    currency: '₹',
    qtyLabel: 'Quantity (Lots/Shares)',
    qtyPlaceholder: 'e.g. 50 (1 Lot Nifty) or 100',
    defaultQty: '50',
    defaultCharges: 40,
    priceStep: '0.05',
    suggestions: ['NIFTY 24500 CE', 'NIFTY 24600 PE', 'BANKNIFTY 52000 CE', 'BANKNIFTY 52500 PE', 'RELIANCE', 'HDFCBANK', 'TCS', 'TATAMOTORS', 'SENSEX 81000 CE']
  },
  Crypto: {
    label: 'Crypto (USDT)',
    flag: '⚡',
    currency: '$',
    qtyLabel: 'Coin Quantity',
    qtyPlaceholder: 'e.g. 0.25 (BTC) or 10 (SOL)',
    defaultQty: '1',
    defaultCharges: 1.5,
    priceStep: '0.01',
    suggestions: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT', 'DOGE/USDT', 'ADA/USDT']
  },
  Forex: {
    label: 'Forex (Pairs)',
    flag: '💱',
    currency: '$',
    qtyLabel: 'Lot Size (Mini/Standard)',
    qtyPlaceholder: 'e.g. 0.10 or 1.00',
    defaultQty: '0.10',
    defaultCharges: 2.0,
    priceStep: '0.00001',
    suggestions: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'XAU/USD (Gold)', 'AUD/USD', 'USD/CAD', 'GBP/JPY']
  },
  US: {
    label: 'US Stocks',
    flag: '🇺🇸',
    currency: '$',
    qtyLabel: 'Share Count',
    qtyPlaceholder: 'e.g. 10 or 50 shares',
    defaultQty: '10',
    defaultCharges: 0,
    priceStep: '0.01',
    suggestions: ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'GOOGL', 'META', 'SPY', 'QQQ']
  }
};

import React, { useState, useEffect, useMemo } from 'react';
import { useStore, API } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { 
  LayoutDashboard, CheckSquare, ListOrdered, TrendingUp, Scale, AlertTriangle, 
  Sparkles, BarChart2, ShieldCheck, Zap, Users, Trophy, Calendar, Share2, 
  HelpCircle, Video, Plus, Settings, Sun, Moon, User, ChevronDown, ChevronUp,
  ArrowUpRight, ArrowDownRight, Wallet, Award, BarChart3, Clock, 
  Flame, Check, X, Edit3, Trash2, Search, Filter, RefreshCw, ExternalLink,
  BookOpen, ChevronRight, ChevronLeft, Lock, PlayCircle, Star, ThumbsUp, AlertCircle, Menu,
  Copy, CheckCircle, DollarSign, PieChart, Target, MessageSquare, Download, Play, ShieldAlert, Heart, Share
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

// Initial Quiz Questions
const QUIZ_QUESTIONS = [
  {
    id: 1,
    question: "What is the maximum recommended risk percentage of total account capital per single trade?",
    options: ["1% - 2%", "5% - 10%", "15% - 20%", "50%"],
    correctIndex: 0,
    explanation: "Professional risk management dictates risking no more than 1% to 2% of total capital on any single trade to survive drawdowns."
  },
  {
    id: 2,
    question: "If a trade hits your Stop-Loss level, what is the best disciplined action?",
    options: [
      "Move the Stop-Loss lower to avoid taking the loss",
      "Exit immediately as planned without emotional hesitation",
      "Double your position size to average down",
      "Close the terminal and check back tomorrow"
    ],
    correctIndex: 1,
    explanation: "Exiting immediately protects your capital and keeps your predetermined risk model intact."
  },
  {
    id: 3,
    question: "What does a 1:2 Risk-to-Reward (R:R) ratio mean?",
    options: [
      "You risk 2 points to make 1 point",
      "You risk 1 point to make 2 points",
      "You trade 2 lots instead of 1 lot",
      "You hold the trade for 2 days"
    ],
    correctIndex: 1,
    explanation: "A 1:2 R:R means your expected reward (₹2,000) is twice your defined risk (₹1,000), making you profitable even with a 40% win rate."
  },
  {
    id: 4,
    question: "What causes 'Revenge Trading' in most market participants?",
    options: [
      "Following a pre-written trading plan",
      "Frustration or anger from a losing trade trying to make money back immediately",
      "High market volatility during earnings",
      "Using a high Risk-to-Reward ratio"
    ],
    correctIndex: 1,
    explanation: "Revenge trading is an emotional response to loss where traders abandon their rules to recover money quickly, usually causing larger losses."
  },
  {
    id: 5,
    question: "In Option Trading, what does Theta (Decay) represent?",
    options: [
      "The rate of price change relative to the underlying index",
      "The rate at which option value diminishes over time as expiration approaches",
      "The sensitivity of an option to volatility changes",
      "The amount of brokerage charged by the exchange"
    ],
    correctIndex: 1,
    explanation: "Theta is time decay, which works against option buyers and benefits option sellers each day that passes."
  },
  {
    id: 6,
    question: "Why is a Trading Journal essential for long-term profitability?",
    options: [
      "It is required by SEBI regulations",
      "It helps you identify behavioral leaks, quantify edge, and eliminate repetitive mistakes",
      "It automatically places trades on your behalf",
      "It increases your account leverage"
    ],
    correctIndex: 1,
    explanation: "Journaling allows you to objectively review your decisions, understand which setups yield profit, and eliminate unforced errors."
  }
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
  const [marketSegment, setMarketSegment] = useState('Indian');
  const [timeRange, setTimeRange] = useState('30D');
  const [pnlPeriod, setPnlPeriod] = useState('D');

  // Modals & Forms
  const [showNewTradeModal, setShowNewTradeModal] = useState(false);
  const [showAddStrategyModal, setShowAddStrategyModal] = useState(false);
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [showAddMistakeModal, setShowAddMistakeModal] = useState(false);
  const [showShareSetupModal, setShowShareSetupModal] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [selectedTradeForShare, setSelectedTradeForShare] = useState(null);

  // Journal DB State
  const [dbTrades, setDbTrades] = useState([]);
  const [strategies, setStrategies] = useState([
    { id: 1, name: 'Breakout Momentum', win_rate: 68, total_trades: 24, net_pnl: 48500, color: '#3b82f6', category: 'Momentum', target_rr: '1:2.5' },
    { id: 2, name: 'Support & Resistance Bounce', win_rate: 55, total_trades: 18, net_pnl: 22100, color: '#10b981', category: 'Reversal', target_rr: '1:2' },
    { id: 3, name: 'Option Selling Theta Decay', win_rate: 78, total_trades: 32, net_pnl: 64200, color: '#8b5cf6', category: 'Options', target_rr: '1:1.5' },
    { id: 4, name: 'VWAP Mean Reversion', win_rate: 42, total_trades: 12, net_pnl: -8400, color: '#f59e0b', category: 'Mean Reversion', target_rr: '1:2' },
    { id: 5, name: 'Scalping Quick Momentum', win_rate: 62, total_trades: 28, net_pnl: 31400, color: '#06b6d4', category: 'Scalping', target_rr: '1:1.8' }
  ]);
  const [rules, setRules] = useState([
    { id: 1, text: 'Maximum risk per trade is strictly 1% of total portfolio capital', category: 'RISK', followed: 42, broken: 2, active: true },
    { id: 2, text: 'Never take a trade without a predefined Stop-Loss order in system', category: 'RISK', followed: 48, broken: 0, active: true },
    { id: 3, text: 'Maximum 3 trades per trading day to avoid overtrading & emotional tilt', category: 'DISCIPLINE', followed: 38, broken: 5, active: true },
    { id: 4, text: 'Wait for 5-minute candle close confirmation before breakout entry', category: 'EXECUTION', followed: 31, broken: 4, active: true },
    { id: 5, text: 'No revenge trading after a red trade; step away from screens for 15 mins', category: 'PSYCHOLOGY', followed: 29, broken: 3, active: true },
    { id: 6, text: 'Never average down into a losing intraday position', category: 'RISK', followed: 35, broken: 1, active: true }
  ]);
  const [mistakes, setMistakes] = useState([
    { id: 1, name: 'FOMO Entry on extended green candle', category: 'PSYCHOLOGY', loss: 14500, count: 4, note: 'Wait for pullback to 20 EMA before entering' },
    { id: 2, name: 'Moving Stoploss further down in losing position', category: 'RISK', loss: 22800, count: 2, note: 'Accept initial predefined loss without hesitation' },
    { id: 3, name: 'Trading without setup checklist confirmation', category: 'EXECUTION', loss: 9200, count: 3, note: 'Tick all 4 checklist points prior to order trigger' },
    { id: 4, name: 'Over-leveraged oversized position size', category: 'RISK', loss: 18400, count: 2, note: 'Calculate exact lot size with Risk Calculator first' },
    { id: 5, name: 'Exiting winners too early before target', category: 'PSYCHOLOGY', loss: 11200, count: 5, note: 'Trail stoploss with 9 EMA instead of manual early exit' }
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

  const [newStrategyForm, setNewStrategyForm] = useState({
    name: '',
    category: 'Momentum',
    target_rr: '1:2',
    color: '#3b82f6'
  });

  const [newRuleForm, setNewRuleForm] = useState({
    text: '',
    category: 'RISK'
  });

  const [newMistakeForm, setNewMistakeForm] = useState({
    name: '',
    category: 'PSYCHOLOGY',
    loss: '',
    note: ''
  });

  const [newSetupForm, setNewSetupForm] = useState({
    symbol: 'BANKNIFTY 52000 CE',
    direction: 'LONG',
    entry: '380',
    sl: '340',
    target: '480',
    strategy: '🔥 Breakout',
    rationale: 'Daily consolidation breakout retest with high buying volume.'
  });

  // Today checklist state
  // Checklist Date & Active Selected Day
  const [selectedChecklistDate, setSelectedChecklistDate] = useState(todayStr);
  const [checklistSavedToast, setChecklistSavedToast] = useState(false);
  const [showAddCustomChecklistModal, setShowAddCustomChecklistModal] = useState(false);
  const [customChecklistSection, setCustomChecklistSection] = useState('preMarket');
  const [newCustomTaskText, setNewCustomTaskText] = useState('');
  
  // Custom checklist items state (stored per category)
  const [customChecklistItems, setCustomChecklistItems] = useState({
    preMarket: [
      { id: 'c-pre-1', label: 'Checked Open Interest (PCR Ratio) and Option Chain Build-up', checked: true }
    ],
    inMarket: [
      { id: 'c-in-1', label: 'Maintained strictly 1 trade at a time (No multi-symbol confusion)', checked: true }
    ],
    postMarket: [
      { id: 'c-post-1', label: 'Uploaded trade screenshot with entry/exit marks to journal', checked: false }
    ]
  });

  // Daily Sentiment & Market Theme tags
  const [dailySentiment, setDailySentiment] = useState({
    regime: '🔥 Trending Bullish',
    discipline: '⭐ 5/5 Flawless'
  });

  // Monthly Report Selected Month State
  const [selectedReportMonth, setSelectedReportMonth] = useState('2026-09');

  const [todayChecklist, setTodayChecklist] = useState({
    preMarket: {
      globalMarketsChecked: true,
      supportResistanceDrawn: true,
      dailyRiskLimitSet: true,
      highImpactNewsNoted: false,
      tradingPlanWritten: true
    },
    inMarket: {
      stopLossPlacedImmediately: true,
      positionSizedProperly: true,
      candleCloseWaited: true,
      noRevengeTrading: true
    },
    postMarket: {
      allTradesLogged: true,
      mistakesReviewed: false,
      emotionsDocumented: true,
      dailyPnLReconciled: true
    },
    notes: 'Today followed the 15m breakout strategy cleanly. Avoided entering chop before 10:30 AM.'
  });

  // Risk Calculator State
  const [riskCalc, setRiskCalc] = useState({
    capital: 200000,
    riskPct: 1,
    entry: 450,
    stopLoss: 430,
    target: 500
  });

  // Calendar State
  const [calendarMonthOffset, setCalendarMonthOffset] = useState(0);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(todayStr);

  // Challenge State
  const [challengeDay, setChallengeDay] = useState(14);
  const [claimedToday, setClaimedToday] = useState(false);

  // Affiliate State
  const [copiedLink, setCopiedLink] = useState(false);

  // Trading Quiz State
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizScore, setQuizScore] = useState(null);

  // Tutorials State
  const [completedTutorials, setCompletedTutorials] = useState([1, 2]);

  // AI Summarizer State
  const [aiGenerating, setAiGenerating] = useState(false);

  // Community Feed State
  const [communityPosts, setCommunityPosts] = useState([
    {
      id: 1,
      author: 'Vikram Sharma',
      avatar: 'V',
      time: '2 hours ago',
      symbol: 'NIFTY 24600 CE',
      direction: 'LONG',
      entry: 185,
      sl: 160,
      target: 245,
      strategy: '🔥 Breakout Momentum',
      pnl: '+₹14,200',
      likes: 24,
      comments: 6,
      liked: false,
      rationale: 'Clean flag and pole pattern breakout on 15m chart with 2.5x volume expansion above morning high.'
    },
    {
      id: 2,
      author: 'Rohit Kulkarni',
      avatar: 'R',
      time: '4 hours ago',
      symbol: 'BANKNIFTY 52500 PE',
      direction: 'SHORT',
      entry: 420,
      sl: 455,
      target: 330,
      strategy: '🛡️ Option Selling (Theta Decay)',
      pnl: '+₹9,800',
      likes: 18,
      comments: 3,
      liked: false,
      rationale: 'Heavy call writing at 52500 strike with declining IV. Captured 90 points theta decay without stress.'
    },
    {
      id: 3,
      author: 'Ananya Roy',
      avatar: 'A',
      time: '6 hours ago',
      symbol: 'RELIANCE',
      direction: 'LONG',
      entry: 2980,
      sl: 2955,
      target: 3040,
      strategy: '📊 Support & Resistance',
      pnl: '+₹8,400',
      likes: 31,
      comments: 9,
      liked: false,
      rationale: 'Daily 200 EMA double-bottom bounce confirmation with RSI bullish divergence.'
    }
  ]);

  // Trade Search & Filter State in TRADES tab
  const [tradeSearch, setTradeSearch] = useState('');
  const [tradeSideFilter, setTradeSideFilter] = useState('ALL');
  const [rulesCategoryFilter, setRulesCategoryFilter] = useState('ALL');

  // Fetch backend journal data on mount
  const fetchJournalData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const headers = { 'Authorization': `Bearer ${token}` };

      // Fetch trades
      const resTrades = await fetch(`${API}/api/journal/trades`, { credentials: 'include', headers });
      const dataTrades = await resTrades.json();
      if (dataTrades.success && Array.isArray(dataTrades.trades)) {
        setDbTrades(dataTrades.trades);
      }

      // Fetch checklists
      const resChk = await fetch(`${API}/api/journal/checklists?date=${todayStr}`, { credentials: 'include', headers });
      const dataChk = await resChk.json();
      if (dataChk.success && dataChk.checklists && dataChk.checklists[0]) {
        const c = dataChk.checklists[0];
        setTodayChecklist({
          preMarket: typeof c.pre_market_data === 'string' ? JSON.parse(c.pre_market_data) : (c.pre_market_data || {}),
          inMarket: { stopLossPlacedImmediately: true, positionSizedProperly: true, candleCloseWaited: true, noRevengeTrading: true },
          postMarket: typeof c.post_market_data === 'string' ? JSON.parse(c.post_market_data) : (c.post_market_data || {}),
          notes: c.notes || ''
        });
      }

      // Fetch strategies
      const resStrat = await fetch(`${API}/api/journal/strategies`, { credentials: 'include', headers });
      const dataStrat = await resStrat.json();
      if (dataStrat.success && dataStrat.strategies && dataStrat.strategies.length > 0) {
        setStrategies(dataStrat.strategies);
      }

      // Fetch rules
      const resRules = await fetch(`${API}/api/journal/rules`, { credentials: 'include', headers });
      const dataRules = await resRules.json();
      if (dataRules.success && dataRules.rules && dataRules.rules.length > 0) {
        setRules(dataRules.rules);
      }

      // Fetch mistakes
      const resMistakes = await fetch(`${API}/api/journal/mistakes`, { credentials: 'include', headers });
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
  // Toggle custom checklist item
  const handleToggleCustomChecklistItem = (section, id) => {
    setCustomChecklistItems(prev => ({
      ...prev,
      [section]: prev[section].map(item => item.id === id ? { ...item, checked: !item.checked } : item)
    }));
  };

  // Delete custom checklist item
  const handleDeleteCustomChecklistItem = (section, id, e) => {
    e.stopPropagation();
    setCustomChecklistItems(prev => ({
      ...prev,
      [section]: prev[section].filter(item => item.id !== id)
    }));
  };

  // Add custom checklist item
  const handleAddCustomChecklistItem = (e) => {
    e.preventDefault();
    if (!newCustomTaskText.trim()) return;
    const newItem = {
      id: `custom-${Date.now()}`,
      label: newCustomTaskText.trim(),
      checked: false
    };
    setCustomChecklistItems(prev => ({
      ...prev,
      [customChecklistSection]: [...prev[customChecklistSection], newItem]
    }));
    setNewCustomTaskText('');
    setShowAddCustomChecklistModal(false);
  };

  // Date Navigator Helpers
  const handleShiftChecklistDate = (days) => {
    const current = new Date(selectedChecklistDate);
    current.setDate(current.getDate() + days);
    setSelectedChecklistDate(current.toISOString().split('T')[0]);
  };

  // Explicit Save Checklist Routine
  const handleSaveFullChecklistRoutine = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await fetch(`${API}/api/journal/checklists`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            date: selectedChecklistDate,
            pre_market_data: { ...todayChecklist.preMarket, custom: customChecklistItems.preMarket },
            post_market_data: { ...todayChecklist.postMarket, custom: customChecklistItems.postMarket },
            notes: todayChecklist.notes,
            sentiment: dailySentiment
          })
        });
      }
      setChecklistSavedToast(true);
      setTimeout(() => setChecklistSavedToast(false), 4000);
    } catch (e) {
      console.warn('Checklist save error:', e);
      setChecklistSavedToast(true);
      setTimeout(() => setChecklistSavedToast(false), 4000);
    }
  };

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

    // Market Currency & Formatting Helpers
  const currentMarketConfig = MARKET_CONFIGS[marketSegment] || MARKET_CONFIGS.Indian;
  const currencySymbol = currentMarketConfig.currency;

  const formatMoney = (val, seg = marketSegment) => {
    const num = Number(val || 0);
    const cfg = MARKET_CONFIGS[seg] || MARKET_CONFIGS.Indian;
    const sym = cfg.currency;
    const isNegative = num < 0;
    const absVal = Math.abs(num);
    const formatted = cfg.currency === '₹'
      ? absVal.toLocaleString('en-IN')
      : absVal.toLocaleString('en-US', { minimumFractionDigits: absVal % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 });
    return `${isNegative ? '-' : (num > 0 ? '+' : '')}${sym}${formatted}`;
  };

  const formatMoneyPlain = (val, seg = marketSegment) => {
    const num = Number(val || 0);
    const cfg = MARKET_CONFIGS[seg] || MARKET_CONFIGS.Indian;
    const sym = cfg.currency;
    const absVal = Math.abs(num);
    const formatted = cfg.currency === '₹'
      ? absVal.toLocaleString('en-IN')
      : absVal.toLocaleString('en-US', { minimumFractionDigits: absVal % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 });
    return `${sym}${formatted}`;
  };

  // Strictly Filter Trades by Active Market Segment and Time Range
  const filteredTrades = useMemo(() => {
    return allTrades.filter(t => {
      const seg = (t.market_segment || 'Indian').toLowerCase();
      const currentSeg = marketSegment.toLowerCase();
      if (seg !== currentSeg) return false;

      if (timeRange === 'ALL') return true;
      if (!t.trade_date) return true;

      const tradeTime = new Date(t.trade_date).getTime();
      const now = new Date().getTime();
      const diffDays = (now - tradeTime) / (1000 * 60 * 60 * 24);

      if (timeRange === 'TODAY') return t.trade_date === todayStr;
      if (timeRange === '7D') return diffDays <= 7;
      if (timeRange === '30D') return diffDays <= 30;
      if (timeRange === '90D') return diffDays <= 90;
      if (timeRange === '1Y') return diffDays <= 365;
      return true;
    });
  }, [allTrades, marketSegment, timeRange, todayStr]);

  // Compute Strict Market Segment KPIs
  const metrics = useMemo(() => {
    if (filteredTrades.length === 0) {
      return {
        highestPnl: 0,
        winRate: 0,
        avgRiskReward: '1:0',
        tradesCount: 0,
        totalPnL: 0,
        totalGross: 0,
        totalCharges: 0,
        wins: 0,
        losses: 0,
        confidenceScore: 0,
        topTrades: []
      };
    }

    let maxPnl = -Infinity;
    let winCount = 0;
    let lossCount = 0;
    let totalWinPnl = 0;
    let totalLossPnl = 0;
    let totalNet = 0;
    let totalGross = 0;
    let totalCharges = 0;

    filteredTrades.forEach(t => {
      const pnl = Number(t.net_pnl !== undefined ? t.net_pnl : (t.realized_pnl || 0));
      const gross = Number(t.realized_pnl !== undefined ? t.realized_pnl : (t.net_pnl || 0));
      const chg = Number(t.charges || (marketSegment === 'Indian' ? 40 : (marketSegment === 'US' ? 0 : 2)));
      totalNet += pnl;
      totalGross += gross;
      totalCharges += chg;

      if (pnl > maxPnl) maxPnl = pnl;
      if (pnl > 0) {
        winCount++;
        totalWinPnl += pnl;
      } else if (pnl < 0) {
        lossCount++;
        totalLossPnl += Math.abs(pnl);
      }
    });

    const totalTrades = filteredTrades.length;
    const winRate = totalTrades > 0 ? Math.round((winCount / totalTrades) * 100) : 0;
    const avgWin = winCount > 0 ? totalWinPnl / winCount : 0;
    const avgLoss = lossCount > 0 ? totalLossPnl / lossCount : 1;
    const rrRatio = avgLoss > 0 ? `1:${(avgWin / avgLoss).toFixed(1)}` : '1:2.0';
    const confidence = Math.min(100, Math.max(10, Math.round((winRate * 0.7) + (winCount > 5 ? 25 : 10))));

    const topTrades = [...filteredTrades]
      .filter(t => Number(t.net_pnl !== undefined ? t.net_pnl : t.realized_pnl) > 0)
      .sort((a, b) => Number(b.net_pnl !== undefined ? b.net_pnl : b.realized_pnl) - Number(a.net_pnl !== undefined ? a.net_pnl : a.realized_pnl))
      .slice(0, 4);

    return {
      highestPnl: maxPnl > 0 ? maxPnl : 0,
      winRate,
      avgRiskReward: rrRatio,
      tradesCount: totalTrades,
      totalPnL: totalNet,
      totalGross,
      totalCharges,
      wins: winCount,
      losses: lossCount,
      confidenceScore: confidence,
      topTrades
    };
  }, [filteredTrades, marketSegment]);

  // Handle Save New Trade Form
  const handleSaveNewTrade = async (e) => {
    e.preventDefault();
    const entry = parseFloat(newTradeForm.entry_price);
    const exit = parseFloat(newTradeForm.exit_price);
    const qty = parseInt(newTradeForm.quantity, 10);
    const charges = parseFloat(newTradeForm.charges) || 40;

    let realizedPnl = 0;
    if (!isNaN(entry) && !isNaN(exit) && !isNaN(qty)) {
      realizedPnl = newTradeForm.trade_type === 'BUY' 
        ? (exit - entry) * qty 
        : (entry - exit) * qty;
    }
    const netPnl = realizedPnl - charges;

    const tradeData = {
      ...newTradeForm,
      entry_price: entry,
      exit_price: exit,
      quantity: qty,
      realized_pnl: realizedPnl,
      charges,
      net_pnl: netPnl,
      id: `MANUAL-${Date.now()}`
    };

    setDbTrades(prev => [tradeData, ...prev]);

    try {
      const token = localStorage.getItem('token');
      if (token) {
        await fetch(`${API}/api/journal/trades`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(tradeData)
        });
      }
    } catch (err) {
      console.warn('Trade save to backend error:', err);
    }

    setShowNewTradeModal(false);
  };

  // Rule Follow/Broken Handlers
  const handleRuleFollow = async (ruleId) => {
    setRules(prev => prev.map(r => r.id === ruleId ? { ...r, followed: (r.followed || 0) + 1 } : r));
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await fetch(`${API}/api/journal/rules/${ruleId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ followed: 1 })
        });
      }
    } catch (e) {
      console.warn('Rule update error:', e);
    }
  };

  const handleRuleBreak = async (ruleId) => {
    setRules(prev => prev.map(r => r.id === ruleId ? { ...r, broken: (r.broken || 0) + 1 } : r));
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await fetch(`${API}/api/journal/rules/${ruleId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ broken: 1 })
        });
      }
    } catch (e) {
      console.warn('Rule update error:', e);
    }
  };

  // Add Strategy Handler
  const handleAddStrategy = (e) => {
    e.preventDefault();
    if (!newStrategyForm.name) return;
    const newStrat = {
      id: Date.now(),
      name: newStrategyForm.name,
      category: newStrategyForm.category,
      target_rr: newStrategyForm.target_rr,
      color: newStrategyForm.color,
      win_rate: 60,
      total_trades: 0,
      net_pnl: 0
    };
    setStrategies(prev => [...prev, newStrat]);
    setShowAddStrategyModal(false);
    setNewStrategyForm({ name: '', category: 'Momentum', target_rr: '1:2', color: '#3b82f6' });
  };

  // Add Rule Handler
  const handleAddRule = (e) => {
    e.preventDefault();
    if (!newRuleForm.text) return;
    const newR = {
      id: Date.now(),
      text: newRuleForm.text,
      category: newRuleForm.category,
      followed: 1,
      broken: 0,
      active: true
    };
    setRules(prev => [...prev, newR]);
    setShowAddRuleModal(false);
    setNewRuleForm({ text: '', category: 'RISK' });
  };

  // Add Mistake Handler
  const handleAddMistake = (e) => {
    e.preventDefault();
    if (!newMistakeForm.name) return;
    const newM = {
      id: Date.now(),
      name: newMistakeForm.name,
      category: newMistakeForm.category,
      loss: parseFloat(newMistakeForm.loss) || 5000,
      count: 1,
      note: newMistakeForm.note || 'Review rules before order placement'
    };
    setMistakes(prev => [...prev, newM]);
    setShowAddMistakeModal(false);
    setNewMistakeForm({ name: '', category: 'PSYCHOLOGY', loss: '', note: '' });
  };

  // Add Community Post
  const handleShareSetup = (e) => {
    e.preventDefault();
    if (!newSetupForm.symbol) return;
    const post = {
      id: Date.now(),
      author: user?.username || 'You (Trader)',
      avatar: (user?.username || 'U').charAt(0).toUpperCase(),
      time: 'Just now',
      symbol: newSetupForm.symbol,
      direction: newSetupForm.direction,
      entry: parseFloat(newSetupForm.entry) || 100,
      sl: parseFloat(newSetupForm.sl) || 90,
      target: parseFloat(newSetupForm.target) || 120,
      strategy: newSetupForm.strategy,
      pnl: 'Pending',
      likes: 1,
      comments: 0,
      liked: true,
      rationale: newSetupForm.rationale
    };
    setCommunityPosts(prev => [post, ...prev]);
    setShowShareSetupModal(false);
  };

  // Like Community Post
  const handleLikePost = (postId) => {
    setCommunityPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          likes: p.liked ? p.likes - 1 : p.likes + 1,
          liked: !p.liked
        };
      }
      return p;
    }));
  };

  // Quiz Answer Selection
  const handleSelectQuizAnswer = (qId, optionIdx) => {
    setQuizAnswers(prev => ({ ...prev, [qId]: optionIdx }));
  };

  const handleFinishQuiz = () => {
    let score = 0;
    QUIZ_QUESTIONS.forEach(q => {
      if (quizAnswers[q.id] === q.correctIndex) {
        score++;
      }
    });
    setQuizScore(score);
  };

  // Trigger AI Analysis
  const handleRunAiAnalysis = () => {
    setAiGenerating(true);
    setTimeout(() => {
      setAiGenerating(false);
    }, 1200);
  };

  // Position Sizing Calculations
  const calculatedRisk = useMemo(() => {
    const capital = parseFloat(riskCalc.capital) || 100000;
    const riskPct = parseFloat(riskCalc.riskPct) || 1;
    const entry = parseFloat(riskCalc.entry) || 100;
    const sl = parseFloat(riskCalc.stopLoss) || 90;
    const target = parseFloat(riskCalc.target) || 120;

    const maxLossRupees = capital * (riskPct / 100);
    const slPoints = Math.abs(entry - sl) || 1;
    const targetPoints = Math.abs(target - entry) || 1;

    const suggestedQty = Math.max(1, Math.floor(maxLossRupees / slPoints));
    const totalOrderCost = suggestedQty * entry;
    const potentialLoss = suggestedQty * slPoints;
    const potentialProfit = suggestedQty * targetPoints;
    const rr = (targetPoints / slPoints).toFixed(1);

    return {
      maxLossRupees,
      slPoints,
      targetPoints,
      suggestedQty,
      totalOrderCost,
      potentialLoss,
      potentialProfit,
      rr
    };
  }, [riskCalc]);

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
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 2px 10px rgba(37, 99, 235, 0.4)'
            }}>
              <Check size={18} strokeWidth={3} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: colors.textPrimary, letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                Trade Diary
              </div>
              <div style={{ fontSize: '10px', color: colors.textSecondary, fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
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
                  padding: '9px 12px',
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
                <Icon size={16} color={isActive ? '#2563eb' : (item.isBridge ? '#0284c7' : (isLight ? '#64748b' : '#94a3b8'))} />
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
                <Menu size={18} />
              </button>
            )}

            {/* Scrollable Index Tickers Row */}
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
          padding: isMobile ? '12px 10px 24px 10px' : '24px 32px',
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
                alignItems: 'center', 
                justifyContent: 'space-between', 
                gap: '8px',
                width: '100%'
              }}>
                <div style={{ display: 'flex', gap: '6px', flex: 1, minWidth: 0, maxWidth: isMobile ? '100%' : '320px' }}>
                  <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                    <select
                      value={marketSegment}
                      onChange={(e) => setMarketSegment(e.target.value)}
                      style={{
                        width: '100%',
                        backgroundColor: colors.bgInput,
                        border: `1px solid ${colors.borderColor}`,
                        color: colors.textPrimary,
                        padding: isMobile ? '6px 22px 6px 8px' : '7px 26px 7px 10px',
                        borderRadius: '8px',
                        fontSize: isMobile ? '11px' : '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        appearance: 'none',
                        outline: 'none',
                        boxShadow: colors.cardShadow,
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <option value="Indian">🌐 Indian</option>
                      <option value="Crypto">⚡ Crypto</option>
                      <option value="Forex">💱 Forex</option>
                      <option value="US">🇺🇸 US</option>
                    </select>
                    <ChevronDown size={12} color={colors.textSecondary} style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  </div>

                  <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                    <select
                      value={timeRange}
                      onChange={(e) => setTimeRange(e.target.value)}
                      style={{
                        width: '100%',
                        backgroundColor: colors.bgInput,
                        border: `1px solid ${colors.borderColor}`,
                        color: colors.textPrimary,
                        padding: isMobile ? '6px 22px 6px 8px' : '7px 26px 7px 10px',
                        borderRadius: '8px',
                        fontSize: isMobile ? '11px' : '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        appearance: 'none',
                        outline: 'none',
                        boxShadow: colors.cardShadow,
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <option value="TODAY">📅 Today</option>
                      <option value="7D">📅 7 Days</option>
                      <option value="30D">📅 30 Days</option>
                      <option value="90D">📅 90 Days</option>
                      <option value="1Y">📅 1 Year</option>
                      <option value="ALL">📅 All Time</option>
                    </select>
                    <ChevronDown size={12} color={colors.textSecondary} style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  </div>
                </div>

                {/* + New Trade Button */}
                <button
                  onClick={() => setShowNewTradeModal(true)}
                  style={{
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    padding: isMobile ? '6px 12px' : '7px 14px',
                    borderRadius: '8px',
                    fontSize: isMobile ? '11px' : '12px',
                    fontWeight: '700',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)',
                    transition: 'background 0.15s',
                    flexShrink: 0,
                    whiteSpace: 'nowrap'
                  }}
                >
                  <Plus size={14} /> {isTinyMobile ? 'Trade' : (isSmallMobile ? '+ Trade' : 'New Trade')}
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

                {/* 4. TOTAL TRADES */}
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

              {/* QUICK SHORTCUT ACTIONS BAR */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
                gap: '10px'
              }}>
                <button
                  onClick={() => setActiveTab('CHECKLIST')}
                  style={{
                    backgroundColor: colors.bgCard,
                    border: `1px solid ${colors.borderColor}`,
                    borderRadius: '10px',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    boxShadow: colors.cardShadow,
                    textAlign: 'left'
                  }}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckSquare size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: colors.textPrimary }}>Daily Checklist</div>
                    <div style={{ fontSize: '10px', color: colors.textSecondary }}>Pre & post market</div>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('AI_SUMMARIZER')}
                  style={{
                    backgroundColor: colors.bgCard,
                    border: `1px solid ${colors.borderColor}`,
                    borderRadius: '10px',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    boxShadow: colors.cardShadow,
                    textAlign: 'left'
                  }}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: colors.textPrimary }}>AI Coach Audit</div>
                    <div style={{ fontSize: '10px', color: colors.textSecondary }}>Find behavioral leaks</div>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('RISK_MANAGEMENT')}
                  style={{
                    backgroundColor: colors.bgCard,
                    border: `1px solid ${colors.borderColor}`,
                    borderRadius: '10px',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    boxShadow: colors.cardShadow,
                    textAlign: 'left'
                  }}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: colors.accentGreen, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ShieldCheck size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: colors.textPrimary }}>Risk Calculator</div>
                    <div style={{ fontSize: '10px', color: colors.textSecondary }}>Position & lot sizing</div>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('CALENDAR')}
                  style={{
                    backgroundColor: colors.bgCard,
                    border: `1px solid ${colors.borderColor}`,
                    borderRadius: '10px',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    boxShadow: colors.cardShadow,
                    textAlign: 'left'
                  }}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Calendar size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: colors.textPrimary }}>P&L Calendar</div>
                    <div style={{ fontSize: '10px', color: colors.textSecondary }}>Monthly green streak</div>
                  </div>
                </button>
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
                  <span style={{ fontSize: '11px', color: colors.textMuted }}>{metrics.confidenceScore}% Systematic Execution</span>
                </div>
                <div style={{ position: 'relative', marginTop: '2px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: '700', color: colors.textMuted, marginBottom: '5px' }}>
                    <span style={{ color: colors.accentRed }}>Low Risk Tolerance</span>
                    <span style={{ color: colors.accentGreen }}>High Execution Discipline</span>
                  </div>
                  <div style={{ height: '7px', borderRadius: '4px', background: 'linear-gradient(90deg, #ef4444 0%, #f59e0b 50%, #10b981 100%)', position: 'relative' }}>
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
                  </div>
                </div>
                <div style={{ textAlign: 'center', fontSize: '11px', color: colors.textSecondary, marginTop: '2px' }}>
                  Execution score computed from rule adherence, risk-to-reward ratio, and trade discipline.
                </div>
              </div>

              {/* BOTTOM ROW: CUMULATIVE P&L & TOP TRADES (Stacked on Mobile) */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', 
                gap: isMobile ? '12px' : '16px' 
              }}>
                {/* Cumulative Performance Card with Dynamic SVG Equity Curve */}
                <div style={{ 
                  backgroundColor: colors.bgCard, 
                  border: `1px solid ${colors.borderColor}`, 
                  borderRadius: '12px', 
                  padding: isMobile ? '16px' : '20px 24px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  minHeight: isMobile ? '230px' : '280px',
                  boxShadow: colors.cardShadow
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', color: colors.textPrimary }}>
                      <TrendingUp size={16} color="#2563eb" /> Cumulative Performance ({marketSegment})
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

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: '800', color: metrics.totalPnL >= 0 ? colors.accentGreen : colors.accentRed, marginBottom: '2px' }}>
                        {formatMoney(metrics.totalPnL)}
                      </div>
                      <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '8px' }}>
                        Net P&L across {metrics.tradesCount} {marketSegment} trades ({metrics.wins} Wins / {metrics.losses} Losses) • Charges: {formatMoneyPlain(metrics.totalCharges)}
                      </div>
                    </div>

                    {/* Dynamic Real-Time Cumulative Equity SVG Curve */}
                    <div style={{ width: '100%', minHeight: '130px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', position: 'relative' }}>
                      {filteredTrades.length === 0 ? (
                        <div style={{ 
                          height: '110px', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          border: `1px dashed ${colors.borderColor}`,
                          borderRadius: '8px',
                          backgroundColor: colors.bgInner,
                          color: colors.textMuted,
                          fontSize: '12px',
                          gap: '6px'
                        }}>
                          <TrendingUp size={20} color={colors.textMuted} />
                          <span>No {marketSegment} trades logged in this timeframe.</span>
                          <button 
                            onClick={() => {
                              setNewTradeForm(prev => ({
                                ...prev,
                                market_segment: marketSegment,
                                symbol: MARKET_CONFIGS[marketSegment]?.suggestions[0] || 'NIFTY 24500 CE'
                              }));
                              setShowNewTradeModal(true);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#2563eb',
                              fontSize: '11px',
                              fontWeight: '700',
                              cursor: 'pointer'
                            }}
                          >
                            + Log your first {marketSegment} trade →
                          </button>
                        </div>
                      ) : (
                        (() => {
                          const sorted = [...filteredTrades].sort((a, b) => new Date(a.trade_date || 0) - new Date(b.trade_date || 0));
                          let runCum = 0;
                          const points = [{ xLabel: 'Start', cum: 0, change: 0, date: sorted[0]?.trade_date || todayStr, symbol: 'Start' }];
                          
                          sorted.forEach((t, i) => {
                            const pnl = Number(t.net_pnl !== undefined ? t.net_pnl : (t.realized_pnl || 0));
                            runCum += pnl;
                            points.push({
                              xLabel: `#${i + 1}`,
                              cum: runCum,
                              change: pnl,
                              date: t.trade_date || todayStr,
                              symbol: t.symbol
                            });
                          });

                          const cumValues = points.map(p => p.cum);
                          const minVal = Math.min(0, ...cumValues);
                          const maxVal = Math.max(0, ...cumValues);
                          const rawSpan = maxVal - minVal || 100;
                          const span = rawSpan * 1.25;
                          const topBound = maxVal + (span - rawSpan) * 0.5;

                          const svgW = 560;
                          const svgH = 110;
                          const padX = 20;
                          const padY = 14;

                          const zeroY = padY + ((topBound - 0) / span) * (svgH - padY * 2);

                          const coords = points.map((p, i) => {
                            const x = padX + (i / (points.length - 1 || 1)) * (svgW - padX * 2);
                            const y = padY + ((topBound - p.cum) / span) * (svgH - padY * 2);
                            return { ...p, x, y };
                          });

                          const lineD = coords.reduce((acc, p, i) => i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, '');
                          const areaD = `${lineD} L ${coords[coords.length - 1].x} ${zeroY} L ${coords[0].x} ${zeroY} Z`;
                          const isProfitable = runCum >= 0;
                          const strokeColor = isProfitable ? colors.accentGreen : colors.accentRed;

                          return (
                            <div style={{ width: '100%', position: 'relative' }}>
                              <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: '105px', overflow: 'visible' }}>
                                <defs>
                                  <linearGradient id="cumPnlGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={strokeColor} stopOpacity="0.35" />
                                    <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
                                  </linearGradient>
                                </defs>

                                {/* Zero Baseline */}
                                <line x1={padX} y1={zeroY} x2={svgW - padX} y2={zeroY} stroke={colors.borderColor} strokeDasharray="3 3" strokeWidth="1.5" />

                                {/* Area Glow */}
                                <path d={areaD} fill="url(#cumPnlGradient)" />

                                {/* Stroke Curve */}
                                <path d={lineD} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                                {/* Interactive Data Point Dots */}
                                {coords.map((p, i) => (
                                  <g key={i} style={{ cursor: 'pointer' }}>
                                    <circle
                                      cx={p.x}
                                      cy={p.y}
                                      r={coords.length > 25 ? 2.5 : 4.5}
                                      fill={p.cum >= 0 ? colors.accentGreen : colors.accentRed}
                                      stroke={colors.bgCard}
                                      strokeWidth="2"
                                    />
                                    <title>{`${p.symbol}: ${formatMoney(p.change, marketSegment)}\nCumulative: ${formatMoney(p.cum, marketSegment)}\nDate: ${p.date}`}</title>
                                  </g>
                                ))}
                              </svg>

                              {/* X-Axis Timeline Labels */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: colors.textMuted, marginTop: '2px', padding: '0 4px' }}>
                                <span>{coords[0]?.date || 'Start'}</span>
                                {coords.length > 2 && <span>{coords[Math.floor(coords.length / 2)]?.date}</span>}
                                <span>{coords[coords.length - 1]?.date || 'Latest'}</span>
                              </div>
                            </div>
                          );
                        })()
                      )}
                    </div>
                  </div>
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
                    <div style={{ fontSize: '13px', fontWeight: '700', color: colors.textPrimary }}>Top Highlight Trades</div>
                    <button onClick={() => setActiveTab('TRADES')} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      View All →
                    </button>
                  </div>

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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '800', color: colors.accentGreen }}>
                            {formatMoney(Number(trade.net_pnl !== undefined ? trade.net_pnl : trade.realized_pnl))}
                          </span>
                          <button
                            onClick={() => setSelectedTradeForShare(trade)}
                            title="Share P&L Card"
                            style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: '2px' }}
                          >
                            <Share2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* 2. TRADING CHECKLIST SUB-VIEW                                  */}
          {activeTab === 'CHECKLIST' && (() => {
            // Calculate total and completed tasks
            const preBuiltKeys = {
              preMarket: ['globalMarketsChecked', 'supportResistanceDrawn', 'dailyRiskLimitSet', 'highImpactNewsNoted', 'tradingPlanWritten'],
              inMarket: ['stopLossPlacedImmediately', 'positionSizedProperly', 'candleCloseWaited', 'noRevengeTrading'],
              postMarket: ['allTradesLogged', 'mistakesReviewed', 'emotionsDocumented', 'dailyPnLReconciled']
            };

            const preDone = preBuiltKeys.preMarket.filter(k => todayChecklist.preMarket[k]).length + (customChecklistItems.preMarket.filter(i => i.checked).length);
            const preTotal = preBuiltKeys.preMarket.length + customChecklistItems.preMarket.length;

            const inDone = preBuiltKeys.inMarket.filter(k => todayChecklist.inMarket[k]).length + (customChecklistItems.inMarket.filter(i => i.checked).length);
            const inTotal = preBuiltKeys.inMarket.length + customChecklistItems.inMarket.length;

            const postDone = preBuiltKeys.postMarket.filter(k => todayChecklist.postMarket[k]).length + (customChecklistItems.postMarket.filter(i => i.checked).length);
            const postTotal = preBuiltKeys.postMarket.length + customChecklistItems.postMarket.length;

            const totalDone = preDone + inDone + postDone;
            const totalTasks = preTotal + inTotal + postTotal;
            const pctCompleted = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;
            const is100Pct = pctCompleted === 100;

            // Timing subheaders based on market
            const timingHeaders = {
              Indian: {
                pre: '1. Pre-Market Prep (Before 09:15 AM)',
                in: '2. In-Market Execution (09:15 AM - 03:30 PM)',
                post: '3. Post-Market Review (After 03:30 PM)'
              },
              Crypto: {
                pre: '1. Daily Open Analysis & Liquidity Scan',
                in: '2. Active Setup & High-Volume Execution',
                post: '3. Daily Settlement & Position Review'
              },
              Forex: {
                pre: '1. London / NY Pre-Session Analysis',
                in: '2. Session Overlap Execution',
                post: '3. Daily Close & Pip Reconciliation'
              },
              US: {
                pre: '1. US Pre-Market Prep (Before 09:30 AM EST)',
                in: '2. Regular Trading Hours (09:30 AM - 04:00 PM EST)',
                post: '3. After-Hours Review & Journaling'
              }
            }[marketSegment] || {
              pre: '1. Pre-Market Checklist',
              in: '2. In-Market Execution',
              post: '3. Post-Market Review'
            };

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px', maxWidth: '1000px', margin: '0 auto' }}>
                {/* Header & Date Switcher */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: isMobile ? 'column' : 'row',
                  justifyContent: 'space-between', 
                  alignItems: isMobile ? 'flex-start' : 'center',
                  gap: '10px'
                }}>
                  <div>
                    <h2 style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '800', color: colors.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckSquare size={22} color="#2563eb" /> Daily Trading Checklist
                    </h2>
                    <p style={{ fontSize: '12px', color: colors.textSecondary, margin: '2px 0 0 0' }}>
                      Build systematic discipline with pre-market prep, in-market execution, and post-market review ({marketSegment}).
                    </p>
                  </div>

                  {/* Date Navigator + Streak */}
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: colors.bgCard,
                      border: `1px solid ${colors.borderColor}`,
                      borderRadius: '8px',
                      padding: '4px 6px',
                      boxShadow: colors.cardShadow
                    }}>
                      <button 
                        onClick={() => handleShiftChecklistDate(-1)} 
                        title="Previous Day"
                        style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer', padding: '3px', display: 'flex' }}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: colors.accentBlueLight, padding: '0 4px' }}>
                        📅 {selectedChecklistDate}
                      </span>
                      <button 
                        onClick={() => handleShiftChecklistDate(1)} 
                        title="Next Day"
                        style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer', padding: '3px', display: 'flex' }}
                      >
                        <ChevronRight size={16} />
                      </button>
                      {selectedChecklistDate !== todayStr && (
                        <button 
                          onClick={() => setSelectedChecklistDate(todayStr)} 
                          style={{ background: colors.bgInner, border: `1px solid ${colors.borderColor}`, borderRadius: '4px', fontSize: '10px', fontWeight: '700', padding: '2px 6px', color: colors.textPrimary, cursor: 'pointer', marginLeft: '2px' }}
                        >
                          Today
                        </button>
                      )}
                    </div>

                    <div style={{
                      fontSize: '11px',
                      fontWeight: '800',
                      color: '#f59e0b',
                      backgroundColor: 'rgba(245, 158, 11, 0.1)',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Flame size={14} /> 14-Day Streak
                    </div>
                  </div>
                </div>

                {/* Overall Routine Completion Progress Card */}
                <div style={{
                  backgroundColor: colors.bgCard,
                  border: `1px solid ${is100Pct ? colors.accentGreen : colors.borderColor}`,
                  borderRadius: '12px',
                  padding: isMobile ? '14px' : '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  boxShadow: colors.cardShadow,
                  background: is100Pct ? (isLight ? 'rgba(16, 185, 129, 0.05)' : 'rgba(16, 185, 129, 0.1)') : colors.bgCard
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: colors.textPrimary }}>
                        Daily Routine Completion
                      </span>
                      {is100Pct && (
                        <span style={{ fontSize: '10px', fontWeight: '800', backgroundColor: colors.accentGreen, color: '#ffffff', padding: '2px 8px', borderRadius: '12px' }}>
                          🏆 100% ROUTINE MASTERED!
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: is100Pct ? colors.accentGreen : colors.accentBlueLight }}>
                      {pctCompleted}% ({totalDone}/{totalTasks} Tasks Done)
                    </div>
                  </div>

                  {/* Visual Progress Bar */}
                  <div style={{ width: '100%', height: '8px', backgroundColor: colors.bgInner, borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ 
                      width: `${pctCompleted}%`, 
                      height: '100%', 
                      background: is100Pct ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #3b82f6, #2563eb)',
                      transition: 'width 0.3s ease',
                      borderRadius: '4px'
                    }} />
                  </div>

                  {/* Section Breakdown Badges */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '11px', marginTop: '2px' }}>
                    <span style={{ color: colors.textSecondary }}>
                      Pre-Market: <b style={{ color: preDone === preTotal ? colors.accentGreen : colors.textPrimary }}>{preDone}/{preTotal}</b>
                    </span>
                    <span style={{ color: colors.borderColor }}>•</span>
                    <span style={{ color: colors.textSecondary }}>
                      In-Market: <b style={{ color: inDone === inTotal ? colors.accentGreen : colors.textPrimary }}>{inDone}/{inTotal}</b>
                    </span>
                    <span style={{ color: colors.borderColor }}>•</span>
                    <span style={{ color: colors.textSecondary }}>
                      Post-Market: <b style={{ color: postDone === postTotal ? colors.accentGreen : colors.textPrimary }}>{postDone}/{postTotal}</b>
                    </span>
                  </div>
                </div>

                {/* 1. Pre-Market Section */}
                <div style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.borderColor}`, borderRadius: '12px', padding: isMobile ? '14px' : '20px', boxShadow: colors.cardShadow }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Flame size={16} /> {timingHeaders.pre}
                    </div>
                    <button 
                      onClick={() => {
                        setCustomChecklistSection('preMarket');
                        setShowAddCustomChecklistModal(true);
                      }}
                      style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                    >
                      <Plus size={13} /> Add Task
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { key: 'globalMarketsChecked', label: 'Checked Global Indices (Gift Nifty, US Futures, Asia Open, DXY)' },
                      { key: 'supportResistanceDrawn', label: 'Identified Key Support & Resistance Levels on 15m/1h Chart' },
                      { key: 'dailyRiskLimitSet', label: 'Defined Max Daily Loss Limit (Hard stop if hit)' },
                      { key: 'highImpactNewsNoted', label: 'Checked RBI, Fed, or Corporate Earnings News Calendar' },
                      { key: 'tradingPlanWritten', label: 'Written Trade Plan (Predefined Entry, SL, and Target Price)' }
                    ].map(item => (
                      <div
                        key={item.key}
                        onClick={() => handleToggleChecklistItem('preMarket', item.key)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 12px',
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

                    {/* Custom Pre-Market Items */}
                    {customChecklistItems.preMarket.map(item => (
                      <div
                        key={item.id}
                        onClick={() => handleToggleCustomChecklistItem('preMarket', item.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                          padding: '10px 12px',
                          backgroundColor: colors.bgInner,
                          borderRadius: '8px',
                          border: item.checked ? '1px solid #2563eb' : `1px solid ${colors.borderColor}`,
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                          <div style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '4px',
                            backgroundColor: item.checked ? '#2563eb' : 'transparent',
                            border: item.checked ? 'none' : `2px solid ${colors.textMuted}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            flexShrink: 0
                          }}>
                            {item.checked && <Check size={12} strokeWidth={3} />}
                          </div>
                          <span style={{
                            fontSize: '12px',
                            color: item.checked ? colors.textPrimary : colors.textSecondary,
                            textDecoration: item.checked ? 'line-through' : 'none',
                            lineHeight: 1.35
                          }}>
                            {item.label} <i style={{ fontSize: '10px', color: '#2563eb', fontStyle: 'normal' }}>(Custom)</i>
                          </span>
                        </div>
                        <button 
                          onClick={(e) => handleDeleteCustomChecklistItem('preMarket', item.id, e)}
                          title="Delete custom task"
                          style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', padding: '2px', display: 'flex' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. In-Market Execution Section */}
                <div style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.borderColor}`, borderRadius: '12px', padding: isMobile ? '14px' : '20px', boxShadow: colors.cardShadow }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Scale size={16} /> {timingHeaders.in}
                    </div>
                    <button 
                      onClick={() => {
                        setCustomChecklistSection('inMarket');
                        setShowAddCustomChecklistModal(true);
                      }}
                      style={{ background: 'none', border: 'none', color: '#f59e0b', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                    >
                      <Plus size={13} /> Add Task
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { key: 'stopLossPlacedImmediately', label: 'Placed hard Stop-Loss in system immediately upon entry' },
                      { key: 'positionSizedProperly', label: 'Position size strictly within 1% risk limit' },
                      { key: 'candleCloseWaited', label: 'Waited for 5-minute candle close confirmation (No FOMO)' },
                      { key: 'noRevengeTrading', label: 'No revenge trades taken after initial outcome' }
                    ].map(item => (
                      <div
                        key={item.key}
                        onClick={() => handleToggleChecklistItem('inMarket', item.key)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 12px',
                          backgroundColor: colors.bgInner,
                          borderRadius: '8px',
                          border: todayChecklist.inMarket?.[item.key] ? '1px solid #f59e0b' : `1px solid ${colors.borderColor}`,
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        <div style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '4px',
                          backgroundColor: todayChecklist.inMarket?.[item.key] ? '#f59e0b' : 'transparent',
                          border: todayChecklist.inMarket?.[item.key] ? 'none' : `2px solid ${colors.textMuted}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                          flexShrink: 0
                        }}>
                          {todayChecklist.inMarket?.[item.key] && <Check size={12} strokeWidth={3} />}
                        </div>
                        <span style={{
                          fontSize: '12px',
                          color: todayChecklist.inMarket?.[item.key] ? colors.textPrimary : colors.textSecondary,
                          textDecoration: todayChecklist.inMarket?.[item.key] ? 'line-through' : 'none',
                          lineHeight: 1.35
                        }}>
                          {item.label}
                        </span>
                      </div>
                    ))}

                    {/* Custom In-Market Items */}
                    {customChecklistItems.inMarket.map(item => (
                      <div
                        key={item.id}
                        onClick={() => handleToggleCustomChecklistItem('inMarket', item.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                          padding: '10px 12px',
                          backgroundColor: colors.bgInner,
                          borderRadius: '8px',
                          border: item.checked ? '1px solid #f59e0b' : `1px solid ${colors.borderColor}`,
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                          <div style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '4px',
                            backgroundColor: item.checked ? '#f59e0b' : 'transparent',
                            border: item.checked ? 'none' : `2px solid ${colors.textMuted}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            flexShrink: 0
                          }}>
                            {item.checked && <Check size={12} strokeWidth={3} />}
                          </div>
                          <span style={{
                            fontSize: '12px',
                            color: item.checked ? colors.textPrimary : colors.textSecondary,
                            textDecoration: item.checked ? 'line-through' : 'none',
                            lineHeight: 1.35
                          }}>
                            {item.label} <i style={{ fontSize: '10px', color: '#f59e0b', fontStyle: 'normal' }}>(Custom)</i>
                          </span>
                        </div>
                        <button 
                          onClick={(e) => handleDeleteCustomChecklistItem('inMarket', item.id, e)}
                          title="Delete custom task"
                          style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', padding: '2px', display: 'flex' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Post-Market Section */}
                <div style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.borderColor}`, borderRadius: '12px', padding: isMobile ? '14px' : '20px', boxShadow: colors.cardShadow }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: colors.accentGreen, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShieldCheck size={16} /> {timingHeaders.post}
                    </div>
                    <button 
                      onClick={() => {
                        setCustomChecklistSection('postMarket');
                        setShowAddCustomChecklistModal(true);
                      }}
                      style={{ background: 'none', border: 'none', color: colors.accentGreen, fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                    >
                      <Plus size={13} /> Add Task
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { key: 'allTradesLogged', label: 'All executed trades logged with Entry, Exit, and Quantities' },
                      { key: 'mistakesReviewed', label: 'Logged behavioral or execution mistakes (if any)' },
                      { key: 'emotionsDocumented', label: 'Documented emotional mindset during entries and exits' },
                      { key: 'dailyPnLReconciled', label: 'Net P&L and charges reconciled with broker statement' }
                    ].map(item => (
                      <div
                        key={item.key}
                        onClick={() => handleToggleChecklistItem('postMarket', item.key)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 12px',
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

                    {/* Custom Post-Market Items */}
                    {customChecklistItems.postMarket.map(item => (
                      <div
                        key={item.id}
                        onClick={() => handleToggleCustomChecklistItem('postMarket', item.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                          padding: '10px 12px',
                          backgroundColor: colors.bgInner,
                          borderRadius: '8px',
                          border: item.checked ? `1px solid ${colors.accentGreen}` : `1px solid ${colors.borderColor}`,
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                          <div style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '4px',
                            backgroundColor: item.checked ? colors.accentGreen : 'transparent',
                            border: item.checked ? 'none' : `2px solid ${colors.textMuted}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            flexShrink: 0
                          }}>
                            {item.checked && <Check size={12} strokeWidth={3} />}
                          </div>
                          <span style={{
                            fontSize: '12px',
                            color: item.checked ? colors.textPrimary : colors.textSecondary,
                            textDecoration: item.checked ? 'line-through' : 'none',
                            lineHeight: 1.35
                          }}>
                            {item.label} <i style={{ fontSize: '10px', color: colors.accentGreen, fontStyle: 'normal' }}>(Custom)</i>
                          </span>
                        </div>
                        <button 
                          onClick={(e) => handleDeleteCustomChecklistItem('postMarket', item.id, e)}
                          title="Delete custom task"
                          style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', padding: '2px', display: 'flex' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Daily Reflections & Sentiment Tags */}
                <div style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.borderColor}`, borderRadius: '12px', padding: isMobile ? '14px' : '20px', boxShadow: colors.cardShadow }}>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: colors.textPrimary, marginBottom: '10px' }}>
                    Daily Reflections & Session Observations
                  </div>

                  {/* Sentiment & Regime Tag Chips */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: colors.textSecondary, marginBottom: '4px' }}>Market Theme Today:</div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {['🔥 Trending Bullish', '🔻 Trending Bearish', '⚡ Choppy / Volatile', '😴 Sideways Range', '⚠️ News Driven'].map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setDailySentiment(prev => ({ ...prev, regime: tag }))}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '16px',
                              fontSize: '11px',
                              fontWeight: '600',
                              border: `1px solid ${dailySentiment.regime === tag ? '#2563eb' : colors.borderColor}`,
                              backgroundColor: dailySentiment.regime === tag ? (isLight ? 'rgba(37,99,235,0.12)' : 'rgba(37,99,235,0.25)') : colors.bgInner,
                              color: dailySentiment.regime === tag ? colors.accentBlueLight : colors.textSecondary,
                              cursor: 'pointer'
                            }}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: colors.textSecondary, marginBottom: '4px' }}>Execution Discipline:</div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {['⭐ 5/5 Flawless', '🎯 Plan Followed', '⚠️ Emotional FOMO', '❌ Overtraded / Tilt'].map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setDailySentiment(prev => ({ ...prev, discipline: tag }))}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '16px',
                              fontSize: '11px',
                              fontWeight: '600',
                              border: `1px solid ${dailySentiment.discipline === tag ? colors.accentGreen : colors.borderColor}`,
                              backgroundColor: dailySentiment.discipline === tag ? (isLight ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.25)') : colors.bgInner,
                              color: dailySentiment.discipline === tag ? colors.accentGreen : colors.textSecondary,
                              cursor: 'pointer'
                            }}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <textarea
                    rows={3}
                    value={todayChecklist.notes}
                    onChange={(e) => handleChecklistNotesChange(e.target.value)}
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
                      lineHeight: 1.4,
                      marginBottom: '12px'
                    }}
                  />

                  {/* Save Routine Button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: colors.textMuted }}>
                      {checklistSavedToast ? '✓ Routine saved & synced!' : 'Routine auto-saves with your inputs'}
                    </span>
                    <button
                      onClick={handleSaveFullChecklistRoutine}
                      style={{
                        backgroundColor: '#2563eb',
                        color: '#ffffff',
                        padding: '8px 18px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '700',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)'
                      }}
                    >
                      <CheckCircle size={15} /> Save & Lock Daily Routine
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 3. TRADES TABLE & MOBILE CARDS SUB-VIEW                         */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'TRADES' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px' }}>
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: '8px' }}>
                <div>
                  <h2 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '800', color: colors.textPrimary, margin: 0 }}>Logged Trades Journal</h2>
                  <p style={{ fontSize: '12px', color: colors.textSecondary, margin: '2px 0 0 0' }}>Detailed trade history with strategies, emotions, charges, and shareable cards.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
              </div>

              {/* Filters & Search Row */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                backgroundColor: colors.bgCard,
                padding: '10px 14px',
                borderRadius: '10px',
                border: `1px solid ${colors.borderColor}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: '180px', backgroundColor: colors.bgInner, padding: '6px 10px', borderRadius: '6px', border: `1px solid ${colors.borderColor}` }}>
                  <Search size={14} color={colors.textMuted} />
                  <input
                    type="text"
                    placeholder="Search by symbol..."
                    value={tradeSearch}
                    onChange={(e) => setTradeSearch(e.target.value)}
                    style={{ background: 'transparent', border: 'none', color: colors.textPrimary, fontSize: '12px', outline: 'none', width: '100%' }}
                  />
                </div>
                <select
                  value={tradeSideFilter}
                  onChange={(e) => setTradeSideFilter(e.target.value)}
                  style={{ backgroundColor: colors.bgInner, border: `1px solid ${colors.borderColor}`, color: colors.textPrimary, padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', outline: 'none' }}
                >
                  <option value="ALL">All Sides</option>
                  <option value="BUY">BUY Only</option>
                  <option value="SELL">SELL Only</option>
                </select>
              </div>

              {/* TRADES LIST */}
              {filteredTrades.length === 0 ? (
                <div style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.borderColor}`, borderRadius: '12px', padding: '36px 16px', textAlign: 'center', color: colors.textSecondary, boxShadow: colors.cardShadow }}>
                  No trades logged yet. Click "+ Add Trade" or trade in the Paper Trading terminal!
                </div>
              ) : (
                <>
                  {/* MOBILE CARD VIEW FOR SMARTPHONES */}
                  {isMobile ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {filteredTrades.filter(t => !tradeSearch || t.symbol.toLowerCase().includes(tradeSearch.toLowerCase()))
                        .filter(t => tradeSideFilter === 'ALL' || t.trade_type === tradeSideFilter)
                        .map((t, idx) => {
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
                                    {formatMoney(net, t.market_segment || marketSegment)}
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
                            {filteredTrades.filter(t => !tradeSearch || t.symbol.toLowerCase().includes(tradeSearch.toLowerCase()))
                              .filter(t => tradeSideFilter === 'ALL' || t.trade_type === tradeSideFilter)
                              .map((t, idx) => {
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
                                      {formatMoney(net, t.market_segment || marketSegment)}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '800', color: colors.textPrimary, margin: 0 }}>Trading Strategies</h2>
                  <p style={{ fontSize: '12px', color: colors.textSecondary, margin: '2px 0 0 0' }}>Track setup performance, win rate %, and edge per strategy.</p>
                </div>
                <button
                  onClick={() => setShowAddStrategyModal(true)}
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
                    gap: '6px'
                  }}
                >
                  <Plus size={15} /> Add Strategy
                </button>
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
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '4px' }}>
                      <div style={{ backgroundColor: colors.bgInner, padding: '8px 10px', borderRadius: '8px', border: `1px solid ${colors.borderColor}` }}>
                        <div style={{ fontSize: '10px', color: colors.textMuted }}>TRADES</div>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: colors.textPrimary, marginTop: '2px' }}>{strat.total_trades || 20}</div>
                      </div>
                      <div style={{ backgroundColor: colors.bgInner, padding: '8px 10px', borderRadius: '8px', border: `1px solid ${colors.borderColor}` }}>
                        <div style={{ fontSize: '10px', color: colors.textMuted }}>TARGET R:R</div>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: colors.accentBlueLight, marginTop: '2px' }}>{strat.target_rr || '1:2'}</div>
                      </div>
                      <div style={{ backgroundColor: colors.bgInner, padding: '8px 10px', borderRadius: '8px', border: `1px solid ${colors.borderColor}` }}>
                        <div style={{ fontSize: '10px', color: colors.textMuted }}>NET P&L</div>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: strat.net_pnl >= 0 ? colors.accentGreen : colors.accentRed, marginTop: '2px' }}>
                          {strat.net_pnl >= 0 ? '+' : ''}₹{(strat.net_pnl || 35000).toLocaleString('en-IN')}
                        </div>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '800', color: colors.textPrimary, margin: 0 }}>Trading Rules Matrix</h2>
                  <p style={{ fontSize: '12px', color: colors.textSecondary, margin: '2px 0 0 0' }}>The hard boundaries that protect your capital and ensure consistency.</p>
                </div>
                <button
                  onClick={() => setShowAddRuleModal(true)}
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
                    gap: '6px'
                  }}
                >
                  <Plus size={15} /> Add Rule
                </button>
              </div>

              {/* Category Filter Tabs */}
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
                {['ALL', 'RISK', 'DISCIPLINE', 'EXECUTION', 'PSYCHOLOGY'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setRulesCategoryFilter(cat)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: '700',
                      border: `1px solid ${colors.borderColor}`,
                      backgroundColor: rulesCategoryFilter === cat ? '#2563eb' : colors.bgCard,
                      color: rulesCategoryFilter === cat ? '#ffffff' : colors.textSecondary,
                      cursor: 'pointer'
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {rules
                  .filter(r => rulesCategoryFilter === 'ALL' || r.category === rulesCategoryFilter)
                  .map((rule) => (
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
                        <button
                          onClick={() => handleRuleFollow(rule.id)}
                          style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            color: colors.accentGreen,
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          ✓ {rule.followed || 0} Followed
                        </button>
                        <button
                          onClick={() => handleRuleBreak(rule.id)}
                          style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            color: colors.accentRed,
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          ✕ {rule.broken || 0} Broken
                        </button>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '800', color: colors.textPrimary, margin: 0 }}>Mistake Tracker & Cost</h2>
                  <p style={{ fontSize: '12px', color: colors.textSecondary, margin: '2px 0 0 0' }}>Quantify the exact financial cost of emotional decisions to eliminate them.</p>
                </div>
                <button
                  onClick={() => setShowAddMistakeModal(true)}
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
                    gap: '6px'
                  }}
                >
                  <Plus size={15} /> Log Mistake
                </button>
              </div>

              {/* Total Loss Banner */}
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: colors.accentRed, textTransform: 'uppercase' }}>TOTAL COST OF MISTAKES</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: colors.accentRed, marginTop: '2px' }}>
                    -₹{mistakes.reduce((acc, m) => acc + (parseFloat(m.loss) || 0), 0).toLocaleString('en-IN')}
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: colors.textSecondary, maxWidth: '240px', textAlign: 'right' }}>
                  Eliminating these recurring errors immediately increases your net profitability.
                </div>
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
          {/* 7. AI SUMMARIZER SUB-VIEW                                      */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'AI_SUMMARIZER' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px', maxWidth: '1000px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '800', color: colors.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={20} color="#8b5cf6" /> AI Trading Coach & Summarizer
                  </h2>
                  <p style={{ fontSize: '12px', color: colors.textSecondary, margin: '2px 0 0 0' }}>Deep automated cognitive audit of your trade logs, behavioral habits, and edges.</p>
                </div>
                <button
                  onClick={handleRunAiAnalysis}
                  disabled={aiGenerating}
                  style={{
                    backgroundColor: '#8b5cf6',
                    color: '#ffffff',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 10px rgba(139, 92, 246, 0.35)'
                  }}
                >
                  <Sparkles size={15} /> {aiGenerating ? 'Analyzing...' : 'Generate AI Audit'}
                </button>
              </div>

              {/* AI Coaching Card */}
              <div style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.borderColor}`, borderRadius: '12px', padding: isMobile ? '16px' : '24px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: colors.cardShadow }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${colors.borderColor}`, paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.1)', padding: '4px 10px', borderRadius: '6px' }}>
                      AUDIT STATUS: ACTIVE
                    </span>
                    <span style={{ fontSize: '11px', color: colors.textMuted }}>Dataset: {allTrades.length} Trades Analyzed</span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: colors.accentGreen }}>
                    Grade: A- (88% Efficiency)
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
                  {/* Strengths */}
                  <div style={{ backgroundColor: colors.bgInner, border: `1px solid ${colors.borderColor}`, borderRadius: '10px', padding: '14px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: colors.accentGreen, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle size={15} /> Top Execution Strengths
                    </div>
                    <ul style={{ fontSize: '11px', color: colors.textPrimary, paddingLeft: '18px', margin: 0, lineHeight: 1.6 }}>
                      <li>High 68% win rate on Morning Breakout Setups (09:30 - 11:00 AM).</li>
                      <li>Strict Stop-Loss compliance on 94% of index option trades.</li>
                      <li>Healthy 1:2.4 average Risk-to-Reward ratio on winning days.</li>
                    </ul>
                  </div>

                  {/* Leaks */}
                  <div style={{ backgroundColor: colors.bgInner, border: `1px solid ${colors.borderColor}`, borderRadius: '10px', padding: '14px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: colors.accentRed, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShieldAlert size={15} /> Profit Leaks & Behavioral Flags
                    </div>
                    <ul style={{ fontSize: '11px', color: colors.textPrimary, paddingLeft: '18px', margin: 0, lineHeight: 1.6 }}>
                      <li>72% of losses occurred after 02:15 PM due to late-session chop.</li>
                      <li>Revenge trading detected twice following initial Stop-Loss hits.</li>
                      <li>Cutting winning trades early before reaching full 1:2 target.</li>
                    </ul>
                  </div>
                </div>

                {/* Next Steps */}
                <div style={{ backgroundColor: isLight ? 'rgba(37, 99, 235, 0.05)' : 'rgba(37, 99, 235, 0.1)', border: '1px solid rgba(37, 99, 235, 0.2)', borderRadius: '10px', padding: '14px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: '#2563eb', marginBottom: '6px' }}>
                    🎯 Coach Action Items for Next Session
                  </div>
                  <p style={{ fontSize: '11.5px', color: colors.textPrimary, margin: 0, lineHeight: 1.45 }}>
                    1. Enforce a hard terminal shutdown after 01:30 PM.<br />
                    2. Trail your stop-loss using the 9 EMA instead of manually closing early.<br />
                    3. Limit max daily trades to 3 trades max to eliminate overtrading fatigue.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* 8. REPORTS SUB-VIEW (WITH COMPREHENSIVE MONTHLY REPORT)        */}
          {activeTab === 'REPORTS' && (() => {
            // Group trades by month for the monthly breakdown table
            const monthlyStatsMap = {};
            
            allTrades.forEach(t => {
              const seg = (t.market_segment || 'Indian').toLowerCase();
              if (seg !== marketSegment.toLowerCase()) return;
              
              const d = t.trade_date || todayStr;
              const monthKey = d.substring(0, 7); // e.g. "2026-09"
              
              if (!monthlyStatsMap[monthKey]) {
                monthlyStatsMap[monthKey] = {
                  month: monthKey,
                  totalTrades: 0,
                  wins: 0,
                  losses: 0,
                  grossPnl: 0,
                  charges: 0,
                  netPnl: 0,
                  bestTrade: 0,
                  worstTrade: 0
                };
              }

              const net = Number(t.net_pnl !== undefined ? t.net_pnl : (t.realized_pnl || 0));
              const gross = Number(t.realized_pnl !== undefined ? t.realized_pnl : (t.net_pnl || 0));
              const chg = Number(t.charges || 40);

              const m = monthlyStatsMap[monthKey];
              m.totalTrades += 1;
              if (net > 0) m.wins += 1;
              else if (net < 0) m.losses += 1;
              m.grossPnl += gross;
              m.charges += chg;
              m.netPnl += net;

              if (net > m.bestTrade) m.bestTrade = net;
              if (net < m.worstTrade) m.worstTrade = net;
            });

            const monthlyList = Object.values(monthlyStatsMap).sort((a, b) => b.month.localeCompare(a.month));

            // Strategy breakdown for the active month
            const monthTrades = allTrades.filter(t => {
              const seg = (t.market_segment || 'Indian').toLowerCase();
              if (seg !== marketSegment.toLowerCase()) return false;
              const d = t.trade_date || todayStr;
              return d.startsWith(selectedReportMonth);
            });

            const stratMap = {};
            monthTrades.forEach(t => {
              const s = t.strategy || '🔥 General Setup';
              if (!stratMap[s]) {
                stratMap[s] = { name: s, count: 0, wins: 0, net: 0 };
              }
              const net = Number(t.net_pnl !== undefined ? t.net_pnl : (t.realized_pnl || 0));
              stratMap[s].count += 1;
              if (net > 0) stratMap[s].wins += 1;
              stratMap[s].net += net;
            });
            const stratList = Object.values(stratMap).sort((a, b) => b.net - a.net);

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px', maxWidth: '1100px', margin: '0 auto' }}>
                {/* Reports Header & Month Picker */}
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: '8px' }}>
                  <div>
                    <h2 style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '800', color: colors.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <BarChart2 size={22} color="#2563eb" /> Performance & Monthly Reports
                    </h2>
                    <p style={{ fontSize: '12px', color: colors.textSecondary, margin: '2px 0 0 0' }}>
                      Comprehensive monthly P&L statements, strategy efficiency, and Day-of-Week breakdown ({marketSegment}).
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                      <select
                        value={selectedReportMonth}
                        onChange={(e) => setSelectedReportMonth(e.target.value)}
                        style={{
                          backgroundColor: colors.bgCard,
                          border: `1px solid ${colors.borderColor}`,
                          color: colors.textPrimary,
                          padding: '6px 26px 6px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          outline: 'none',
                          appearance: 'none',
                          boxShadow: colors.cardShadow
                        }}
                      >
                        <option value="2026-09">📅 September 2026</option>
                        <option value="2026-08">📅 August 2026</option>
                        <option value="2026-07">📅 July 2026</option>
                        <option value="2026-06">📅 June 2026</option>
                      </select>
                      <ChevronDown size={12} color={colors.textSecondary} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>

                    <button
                      onClick={() => window.print()}
                      style={{
                        backgroundColor: isLight ? '#f1f5f9' : '#1e293b',
                        border: `1px solid ${colors.borderColor}`,
                        color: colors.textPrimary,
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Download size={14} /> Export / Print
                    </button>
                  </div>
                </div>

                {/* 8 INSTITUTIONAL PERFORMANCE KPI CARDS */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '10px' }}>
                  {[
                    { label: 'PROFIT FACTOR', val: metrics.tradesCount > 0 ? (metrics.losses > 0 ? ((metrics.wins * 1.5) / (metrics.losses || 1)).toFixed(2) : '∞') : '0.00', color: colors.accentGreen },
                    { label: 'EXPECTANCY', val: metrics.tradesCount > 0 ? formatMoney(Math.round(metrics.totalPnL / (metrics.tradesCount || 1)), marketSegment) : formatMoneyPlain(0, marketSegment), color: colors.accentBlueLight },
                    { label: 'WIN RATE', val: `${metrics.winRate}% (${metrics.wins}W / ${metrics.losses}L)`, color: metrics.winRate >= 50 ? colors.accentGreen : colors.accentRed },
                    { label: 'LARGEST WIN', val: formatMoney(metrics.highestPnl, marketSegment), color: colors.accentGreen },
                    { label: 'GROSS P&L', val: formatMoney(metrics.totalGross, marketSegment), color: colors.textPrimary },
                    { label: 'BROKERAGE & CHARGES', val: formatMoneyPlain(metrics.totalCharges, marketSegment), color: colors.textMuted },
                    { label: 'AVG RISK / REWARD', val: metrics.avgRiskReward, color: colors.accentBlueLight },
                    { label: 'NET PROFIT', val: formatMoney(metrics.totalPnL, marketSegment), color: metrics.totalPnL >= 0 ? colors.accentGreen : colors.accentRed }
                  ].map((k, i) => (
                    <div key={i} style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.borderColor}`, borderRadius: '10px', padding: '12px 14px', boxShadow: colors.cardShadow }}>
                      <div style={{ fontSize: '10px', fontWeight: '700', color: colors.textMuted }}>{k.label}</div>
                      <div style={{ fontSize: '16px', fontWeight: '800', color: k.color, marginTop: '3px' }}>{k.val}</div>
                    </div>
                  ))}
                </div>

                {/* MONTH-BY-MONTH HISTORICAL BREAKDOWN TABLE */}
                <div style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.borderColor}`, borderRadius: '12px', padding: isMobile ? '16px' : '20px', boxShadow: colors.cardShadow }}>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: colors.textPrimary, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={16} color="#2563eb" /> Month-by-Month Statement ({marketSegment})
                  </div>

                  {monthlyList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 12px', color: colors.textMuted, fontSize: '12px' }}>
                      No trades logged in {marketSegment} yet. Log trades to generate monthly reports!
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${colors.borderColor}`, color: colors.textMuted, fontSize: '11px' }}>
                            <th style={{ padding: '8px 10px' }}>MONTH</th>
                            <th style={{ padding: '8px 10px' }}>TRADES</th>
                            <th style={{ padding: '8px 10px' }}>WIN RATE</th>
                            <th style={{ padding: '8px 10px' }}>GROSS P&L</th>
                            <th style={{ padding: '8px 10px' }}>CHARGES</th>
                            <th style={{ padding: '8px 10px' }}>NET P&L</th>
                            <th style={{ padding: '8px 10px' }}>STATUS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthlyList.map(m => {
                            const wr = m.totalTrades > 0 ? Math.round((m.wins / m.totalTrades) * 100) : 0;
                            const isWin = m.netPnl >= 0;
                            return (
                              <tr key={m.month} style={{ borderBottom: `1px solid ${colors.borderColor}` }}>
                                <td style={{ padding: '10px', fontWeight: '700', color: colors.textPrimary }}>
                                  📅 {m.month}
                                </td>
                                <td style={{ padding: '10px', color: colors.textSecondary }}>
                                  {m.totalTrades} ({m.wins}W / {m.losses}L)
                                </td>
                                <td style={{ padding: '10px', fontWeight: '700', color: wr >= 50 ? colors.accentGreen : colors.accentRed }}>
                                  {wr}%
                                </td>
                                <td style={{ padding: '10px', color: colors.textPrimary }}>
                                  {formatMoney(m.grossPnl, marketSegment)}
                                </td>
                                <td style={{ padding: '10px', color: colors.textMuted }}>
                                  {formatMoneyPlain(m.charges, marketSegment)}
                                </td>
                                <td style={{ padding: '10px', fontWeight: '800', color: isWin ? colors.accentGreen : colors.accentRed }}>
                                  {formatMoney(m.netPnl, marketSegment)}
                                </td>
                                <td style={{ padding: '10px' }}>
                                  <span style={{
                                    padding: '3px 8px',
                                    borderRadius: '12px',
                                    fontSize: '10px',
                                    fontWeight: '800',
                                    backgroundColor: isWin ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                    color: isWin ? colors.accentGreen : colors.accentRed
                                  }}>
                                    {isWin ? 'PROFITABLE' : 'DRAWDOWN'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* TWO COLUMN ROW: STRATEGY EFFICIENCY & DAY OF WEEK */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
                  {/* Monthly Strategy Breakdown */}
                  <div style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.borderColor}`, borderRadius: '12px', padding: isMobile ? '16px' : '20px', boxShadow: colors.cardShadow }}>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: colors.textPrimary, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Target size={16} color="#2563eb" /> Strategy Performance ({selectedReportMonth})
                    </div>
                    {stratList.length === 0 ? (
                      <div style={{ fontSize: '12px', color: colors.textMuted, padding: '16px 0', textAlign: 'center' }}>
                        No strategy logs for this month.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {stratList.map(s => {
                          const wr = s.count > 0 ? Math.round((s.wins / s.count) * 100) : 0;
                          return (
                            <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', backgroundColor: colors.bgInner, borderRadius: '8px', border: `1px solid ${colors.borderColor}` }}>
                              <div>
                                <div style={{ fontSize: '12px', fontWeight: '700', color: colors.textPrimary }}>{s.name}</div>
                                <div style={{ fontSize: '10px', color: colors.textSecondary }}>{s.count} Trades • {wr}% Win Rate</div>
                              </div>
                              <div style={{ fontSize: '13px', fontWeight: '800', color: s.net >= 0 ? colors.accentGreen : colors.accentRed }}>
                                {formatMoney(s.net, marketSegment)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Day of Week Analysis */}
                  <div style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.borderColor}`, borderRadius: '12px', padding: isMobile ? '16px' : '20px', boxShadow: colors.cardShadow }}>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: colors.textPrimary, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={16} color="#f59e0b" /> Performance by Day of Week
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {[
                        { day: 'Monday', pnl: metrics.totalPnL > 0 ? Math.round(metrics.totalPnL * 0.3) : 0, trades: Math.ceil(metrics.tradesCount * 0.2) },
                        { day: 'Tuesday', pnl: metrics.totalPnL > 0 ? Math.round(metrics.totalPnL * 0.22) : 0, trades: Math.ceil(metrics.tradesCount * 0.2) },
                        { day: 'Wednesday', pnl: metrics.totalPnL > 0 ? Math.round(metrics.totalPnL * 0.38) : 0, trades: Math.ceil(metrics.tradesCount * 0.3) },
                        { day: 'Thursday (Expiry)', pnl: metrics.totalPnL > 0 ? Math.round(metrics.totalPnL * 0.18) : 0, trades: Math.ceil(metrics.tradesCount * 0.2) },
                        { day: 'Friday', pnl: metrics.totalPnL > 0 ? Math.round(metrics.totalPnL * -0.08) : 0, trades: Math.ceil(metrics.tradesCount * 0.1) }
                      ].map(d => (
                        <div key={d.day} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
                          <span style={{ width: '110px', fontWeight: '600', color: colors.textPrimary, fontSize: '11px' }}>{d.day}</span>
                          <div style={{ flex: 1, backgroundColor: colors.bgInner, height: '16px', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                            <div style={{ width: `${Math.min(100, Math.max(8, Math.abs(d.pnl) / ((metrics.totalPnL || 1) * 0.01)))}%`, backgroundColor: d.pnl >= 0 ? colors.accentGreen : colors.accentRed, height: '100%' }} />
                          </div>
                          <span style={{ width: '85px', textAlign: 'right', fontWeight: '700', color: d.pnl >= 0 ? colors.accentGreen : colors.accentRed, fontSize: '11px' }}>
                            {formatMoney(d.pnl, marketSegment)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 9. RISK MANAGEMENT SUB-VIEW                                    */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'RISK_MANAGEMENT' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px', maxWidth: '1000px', margin: '0 auto' }}>
              <div>
                <h2 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '800', color: colors.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={20} color={colors.accentGreen} /> Position Sizing & Risk Management
                </h2>
                <p style={{ fontSize: '12px', color: colors.textSecondary, margin: '2px 0 0 0' }}>Calculate exact allowed quantities so you never exceed your 1% risk threshold.</p>
              </div>

              {/* Interactive Calculator */}
              <div style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.borderColor}`, borderRadius: '12px', padding: isMobile ? '16px' : '24px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: colors.cardShadow }}>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#2563eb' }}>
                  Interactive Position Sizer
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '700', color: colors.textSecondary }}>CAPITAL (₹)</label>
                    <input
                      type="number"
                      value={riskCalc.capital}
                      onChange={(e) => setRiskCalc({ ...riskCalc, capital: e.target.value })}
                      style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '7px 8px', color: colors.textPrimary, fontSize: '12px', marginTop: '3px', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '700', color: colors.textSecondary }}>MAX RISK (%)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={riskCalc.riskPct}
                      onChange={(e) => setRiskCalc({ ...riskCalc, riskPct: e.target.value })}
                      style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '7px 8px', color: colors.textPrimary, fontSize: '12px', marginTop: '3px', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '700', color: colors.textSecondary }}>ENTRY PRICE (₹)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={riskCalc.entry}
                      onChange={(e) => setRiskCalc({ ...riskCalc, entry: e.target.value })}
                      style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '7px 8px', color: colors.textPrimary, fontSize: '12px', marginTop: '3px', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '700', color: colors.textSecondary }}>STOP LOSS (₹)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={riskCalc.stopLoss}
                      onChange={(e) => setRiskCalc({ ...riskCalc, stopLoss: e.target.value })}
                      style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '7px 8px', color: colors.textPrimary, fontSize: '12px', marginTop: '3px', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '700', color: colors.textSecondary }}>TARGET (₹)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={riskCalc.target}
                      onChange={(e) => setRiskCalc({ ...riskCalc, target: e.target.value })}
                      style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '7px 8px', color: colors.textPrimary, fontSize: '12px', marginTop: '3px', outline: 'none' }}
                    />
                  </div>
                </div>

                {/* Outputs Banner */}
                <div style={{ backgroundColor: colors.bgInner, border: `1px solid ${colors.borderColor}`, borderRadius: '10px', padding: '16px', display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: colors.textMuted }}>MAX RUPEE RISK</div>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: colors.accentRed, marginTop: '2px' }}>
                      ₹{calculatedRisk.maxLossRupees.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: colors.textMuted }}>ALLOWED QUANTITY</div>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: '#2563eb', marginTop: '2px' }}>
                      {calculatedRisk.suggestedQty} Qty
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: colors.textMuted }}>POTENTIAL PROFIT</div>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: colors.accentGreen, marginTop: '2px' }}>
                      +₹{calculatedRisk.potentialProfit.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: colors.textMuted }}>REWARD-TO-RISK</div>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: colors.accentBlueLight, marginTop: '2px' }}>
                      1 : {calculatedRisk.rr}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* 10. COMMUNITY SUB-VIEW                                         */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'COMMUNITY' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px', maxWidth: '1000px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '800', color: colors.textPrimary, margin: 0 }}>Community Trade Ideas</h2>
                  <p style={{ fontSize: '12px', color: colors.textSecondary, margin: '2px 0 0 0' }}>Verified trade setups and technical analysis from top disciplined traders.</p>
                </div>
                <button
                  onClick={() => setShowShareSetupModal(true)}
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
                    gap: '6px'
                  }}
                >
                  <Plus size={15} /> Share Setup
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {communityPosts.map((post) => (
                  <div key={post.id} style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.borderColor}`, borderRadius: '12px', padding: isMobile ? '14px' : '18px', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: colors.cardShadow }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#2563eb', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700' }}>
                          {post.avatar}
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: '700', color: colors.textPrimary }}>{post.author}</div>
                          <div style={{ fontSize: '10px', color: colors.textMuted }}>{post.time}</div>
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: '800', color: colors.accentGreen, backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '3px 8px', borderRadius: '6px' }}>
                        {post.pnl}
                      </span>
                    </div>

                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '800', color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{post.symbol}</span>
                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: post.direction === 'LONG' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: post.direction === 'LONG' ? colors.accentGreen : colors.accentRed }}>
                          {post.direction}
                        </span>
                      </div>
                      <p style={{ fontSize: '11.5px', color: colors.textSecondary, margin: '4px 0 0 0', lineHeight: 1.4 }}>
                        {post.rationale}
                      </p>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: `1px solid ${colors.borderColor}` }}>
                      <span style={{ fontSize: '10px', color: colors.accentBlueLight, fontWeight: '600' }}>
                        {post.strategy}
                      </span>
                      <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                        <button
                          onClick={() => handleLikePost(post.id)}
                          style={{ background: 'none', border: 'none', color: post.liked ? '#2563eb' : colors.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '600' }}
                        >
                          <ThumbsUp size={13} /> {post.likes}
                        </button>
                        <span style={{ color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                          <MessageSquare size={13} /> {post.comments}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* 11. CHALLENGE SUB-VIEW                                         */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'CHALLENGE' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px', maxWidth: '1000px', margin: '0 auto' }}>
              <div>
                <h2 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '800', color: colors.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Trophy size={20} color="#f59e0b" /> 30-Day Consistency Challenge
                </h2>
                <p style={{ fontSize: '12px', color: colors.textSecondary, margin: '2px 0 0 0' }}>Trade with strict rules for 30 consecutive days to unlock the Master Trader Badge.</p>
              </div>

              {/* Progress Card */}
              <div style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.borderColor}`, borderRadius: '12px', padding: isMobile ? '16px' : '24px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: colors.cardShadow }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: colors.textPrimary }}>Current Progress: Day {challengeDay} of 30</span>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#2563eb' }}>{Math.round((challengeDay / 30) * 100)}% Complete</span>
                </div>
                <div style={{ height: '8px', borderRadius: '4px', backgroundColor: colors.bgInner, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(challengeDay / 30) * 100}%`, backgroundColor: '#2563eb' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', color: colors.textSecondary }}>🔥 Active Streak: 14 Days Zero Rule Breaks</span>
                  <button
                    onClick={() => {
                      if (!claimedToday) {
                        setChallengeDay(d => Math.min(30, d + 1));
                        setClaimedToday(true);
                      }
                    }}
                    disabled={claimedToday}
                    style={{
                      backgroundColor: claimedToday ? colors.accentGreen : '#2563eb',
                      color: '#ffffff',
                      padding: '6px 14px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '700',
                      border: 'none',
                      cursor: claimedToday ? 'default' : 'pointer'
                    }}
                  >
                    {claimedToday ? '✓ Checked-In Today' : 'Check In for Today'}
                  </button>
                </div>
              </div>

              {/* Badges Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '10px' }}>
                {[
                  { name: 'Day 1 Kickoff', icon: '🔰', unlocked: true },
                  { name: '7-Day Zero FOMO', icon: '🛡️', unlocked: true },
                  { name: '14-Day Discipline', icon: '🎯', unlocked: true },
                  { name: '30-Day Master', icon: '🏆', unlocked: false }
                ].map((b, i) => (
                  <div key={i} style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.borderColor}`, borderRadius: '10px', padding: '16px', textAlign: 'center', opacity: b.unlocked ? 1 : 0.45 }}>
                    <div style={{ fontSize: '28px', marginBottom: '6px' }}>{b.icon}</div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: colors.textPrimary }}>{b.name}</div>
                    <div style={{ fontSize: '10px', color: b.unlocked ? colors.accentGreen : colors.textMuted, marginTop: '2px', fontWeight: '600' }}>
                      {b.unlocked ? 'UNLOCKED' : 'LOCKED'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* 12. CALENDAR SUB-VIEW                                          */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'CALENDAR' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px', maxWidth: '1000px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '800', color: colors.textPrimary, margin: 0 }}>Monthly P&L Calendar</h2>
                  <p style={{ fontSize: '12px', color: colors.textSecondary, margin: '2px 0 0 0' }}>Visual daily heatmap of green vs red days and session summaries.</p>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => setCalendarMonthOffset(o => o - 1)} style={{ background: colors.bgCard, border: `1px solid ${colors.borderColor}`, color: colors.textPrimary, padding: '4px 8px', borderRadius: '6px', cursor: 'pointer' }}>
                    <ChevronLeft size={14} />
                  </button>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: colors.textPrimary, display: 'flex', alignItems: 'center', padding: '0 8px' }}>
                    September 2026
                  </span>
                  <button onClick={() => setCalendarMonthOffset(o => o + 1)} style={{ background: colors.bgCard, border: `1px solid ${colors.borderColor}`, color: colors.textPrimary, padding: '4px 8px', borderRadius: '6px', cursor: 'pointer' }}>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              {/* Calendar Heatmap Grid */}
              <div style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.borderColor}`, borderRadius: '12px', padding: isMobile ? '12px' : '20px', boxShadow: colors.cardShadow }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', textAlign: 'center', marginBottom: '8px' }}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} style={{ fontSize: '11px', fontWeight: '700', color: colors.textMuted }}>{d}</div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                  {Array.from({ length: 30 }).map((_, i) => {
                    const dayNum = i + 1;
                    const isGreen = [1, 2, 4, 7, 8, 9, 11, 14, 15, 16, 18, 21, 22].includes(dayNum);
                    const isRed = [3, 10, 17, 24].includes(dayNum);
                    const isWeekend = (dayNum % 7 === 0) || (dayNum % 7 === 6);
                    const pnlVal = isGreen ? 4200 : (isRed ? -2100 : 0);

                    return (
                      <div
                        key={i}
                        onClick={() => setSelectedCalendarDate(`2026-09-${dayNum < 10 ? '0' + dayNum : dayNum}`)}
                        style={{
                          backgroundColor: isWeekend ? 'transparent' : (isGreen ? 'rgba(16, 185, 129, 0.12)' : (isRed ? 'rgba(239, 68, 68, 0.12)' : colors.bgInner)),
                          border: selectedCalendarDate === `2026-09-${dayNum < 10 ? '0' + dayNum : dayNum}` ? '2px solid #2563eb' : `1px solid ${colors.borderColor}`,
                          borderRadius: '8px',
                          padding: '8px 4px',
                          minHeight: isMobile ? '48px' : '64px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          cursor: 'pointer'
                        }}
                      >
                        <span style={{ fontSize: '11px', fontWeight: '700', color: colors.textPrimary }}>{dayNum}</span>
                        {!isWeekend && pnlVal !== 0 && (
                          <span style={{ fontSize: '10px', fontWeight: '800', color: pnlVal > 0 ? colors.accentGreen : colors.accentRed }}>
                            {pnlVal > 0 ? '+' : ''}₹{Math.abs(pnlVal)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* 13. AFFILIATE SUB-VIEW                                         */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'AFFILIATE' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px', maxWidth: '1000px', margin: '0 auto' }}>
              <div>
                <h2 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '800', color: colors.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Share2 size={20} color="#2563eb" /> Affiliate & Partner Program
                </h2>
                <p style={{ fontSize: '12px', color: colors.textSecondary, margin: '2px 0 0 0' }}>Earn 30% lifetime recurring commissions on every trader you invite.</p>
              </div>

              {/* Commission Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '10px' }}>
                {[
                  { label: 'TOTAL CLICKS', val: '142' },
                  { label: 'REFERRALS', val: '18' },
                  { label: 'ACTIVE PRO USERS', val: '6' },
                  { label: 'UNPAID COMMISSIONS', val: '₹4,800', highlight: true }
                ].map((s, i) => (
                  <div key={i} style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.borderColor}`, borderRadius: '10px', padding: '12px 14px', boxShadow: colors.cardShadow }}>
                    <div style={{ fontSize: '10px', color: colors.textMuted, fontWeight: '700' }}>{s.label}</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: s.highlight ? colors.accentGreen : colors.textPrimary, marginTop: '2px' }}>{s.val}</div>
                  </div>
                ))}
              </div>

              {/* Referral Link Box */}
              <div style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.borderColor}`, borderRadius: '12px', padding: isMobile ? '16px' : '20px', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: colors.cardShadow }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: colors.textPrimary }}>Your Unique Referral Link</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    readOnly
                    value={`https://shortedge.trade/ref/${user?.username || 'trader'}`}
                    style={{ flex: 1, backgroundColor: colors.bgInner, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 12px', color: colors.textPrimary, fontSize: '12px', outline: 'none' }}
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`https://shortedge.trade/ref/${user?.username || 'trader'}`);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                    style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Copy size={14} /> {copiedLink ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* 14. TRADING QUIZ SUB-VIEW                                      */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'TRADING_QUIZ' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px', maxWidth: '1000px', margin: '0 auto' }}>
              <div>
                <h2 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '800', color: colors.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <HelpCircle size={20} color="#3b82f6" /> Trading Psychology & Execution Quiz
                </h2>
                <p style={{ fontSize: '12px', color: colors.textSecondary, margin: '2px 0 0 0' }}>Test your risk discipline and market knowledge with instant evaluations.</p>
              </div>

              {quizScore !== null ? (
                <div style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.borderColor}`, borderRadius: '12px', padding: '28px 20px', textAlign: 'center', boxShadow: colors.cardShadow }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🏆</div>
                  <h3 style={{ fontSize: '18px', fontWeight: '800', color: colors.textPrimary, margin: '0 0 4px 0' }}>
                    Quiz Completed: {quizScore} / {QUIZ_QUESTIONS.length} Correct
                  </h3>
                  <p style={{ fontSize: '12px', color: colors.textSecondary, margin: '0 0 16px 0' }}>
                    {quizScore >= 5 ? 'Master of Execution Discipline! You possess solid risk foundations.' : 'Keep practicing risk rules to avoid unforced trading errors.'}
                  </p>
                  <button onClick={() => { setQuizAnswers({}); setQuizScore(null); }} style={{ backgroundColor: '#2563eb', color: '#ffffff', padding: '8px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', border: 'none', cursor: 'pointer' }}>
                    Retake Quiz
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {QUIZ_QUESTIONS.map((q, idx) => (
                    <div key={q.id} style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.borderColor}`, borderRadius: '12px', padding: isMobile ? '14px' : '18px', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: colors.cardShadow }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: colors.textPrimary }}>
                        {idx + 1}. {q.question}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {q.options.map((opt, optIdx) => {
                          const isSelected = quizAnswers[q.id] === optIdx;
                          return (
                            <button
                              key={optIdx}
                              onClick={() => handleSelectQuizAnswer(q.id, optIdx)}
                              style={{
                                textAlign: 'left',
                                padding: '9px 12px',
                                borderRadius: '8px',
                                border: isSelected ? '1px solid #2563eb' : `1px solid ${colors.borderColor}`,
                                backgroundColor: isSelected ? (isLight ? 'rgba(37, 99, 235, 0.08)' : 'rgba(37, 99, 235, 0.15)') : colors.bgInner,
                                color: isSelected ? colors.accentBlueLight : colors.textPrimary,
                                fontSize: '12px',
                                fontWeight: isSelected ? '700' : '500',
                                cursor: 'pointer'
                              }}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={handleFinishQuiz}
                    disabled={Object.keys(quizAnswers).length < QUIZ_QUESTIONS.length}
                    style={{
                      backgroundColor: Object.keys(quizAnswers).length < QUIZ_QUESTIONS.length ? colors.borderColor : '#2563eb',
                      color: '#ffffff',
                      padding: '10px 20px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '700',
                      border: 'none',
                      cursor: Object.keys(quizAnswers).length < QUIZ_QUESTIONS.length ? 'not-allowed' : 'pointer',
                      alignSelf: 'center',
                      marginTop: '6px'
                    }}
                  >
                    Submit Quiz Answers
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* 15. TUTORIALS SUB-VIEW                                         */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'TUTORIALS' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px', maxWidth: '1000px', margin: '0 auto' }}>
              <div>
                <h2 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '800', color: colors.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Video size={20} color="#2563eb" /> Video Masterclasses & Tutorials
                </h2>
                <p style={{ fontSize: '12px', color: colors.textSecondary, margin: '2px 0 0 0' }}>Step-by-step masterclasses on systematic journaling, breakout strategies, and risk.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '14px' }}>
                {[
                  { id: 1, title: 'Trade Diary 101: How to Journal for 2x Win Rate', duration: '12 mins', category: 'Journaling' },
                  { id: 2, title: 'The 1% Position Sizing Blueprint: Capital Defense', duration: '18 mins', category: 'Risk' },
                  { id: 3, title: 'High Probability Breakout Setups on 15m Candles', duration: '24 mins', category: 'Strategy' },
                  { id: 4, title: 'Conquering FOMO & Revenge Trading Psychology', duration: '15 mins', category: 'Psychology' }
                ].map(v => (
                  <div key={v.id} style={{ backgroundColor: colors.bgCard, border: `1px solid ${colors.borderColor}`, borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: colors.cardShadow }}>
                    <div style={{ height: '120px', backgroundColor: colors.bgInner, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', position: 'relative' }}>
                      <PlayCircle size={36} />
                      <span style={{ position: 'absolute', bottom: '8px', right: '8px', backgroundColor: 'rgba(0,0,0,0.7)', color: '#ffffff', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                        {v.duration}
                      </span>
                    </div>
                    <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: '800', color: '#2563eb' }}>{v.category}</span>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: colors.textPrimary, lineHeight: 1.35 }}>{v.title}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── MODALS: FORMS & DIALOGS ───────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {/* 1. LOG NEW TRADE MODAL */}
      {showNewTradeModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '12px' }}>
          <div style={{ backgroundColor: colors.bgSidebar, border: `1px solid ${colors.borderColor}`, borderRadius: '16px', width: '100%', maxWidth: '540px', maxHeight: '92vh', overflowY: 'auto', padding: isMobile ? '16px' : '22px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '800', color: colors.textPrimary }}>
                <Plus size={18} color="#2563eb" /> Log New Trade
              </div>
              <button onClick={() => setShowNewTradeModal(false)} aria-label="Close modal" style={{ background: 'transparent', border: 'none', color: colors.textMuted, cursor: 'pointer', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            {/* Market Segment Selector Tabs */}
            <div>
              <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '700', display: 'block', marginBottom: '4px' }}>
                Select Market Segment
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {Object.entries(MARKET_CONFIGS).map(([key, cfg]) => {
                  const isSelected = (newTradeForm.market_segment || 'Indian') === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setNewTradeForm(prev => ({
                          ...prev,
                          market_segment: key,
                          symbol: cfg.suggestions[0] || '',
                          quantity: cfg.defaultQty,
                          charges: cfg.defaultCharges.toString()
                        }));
                      }}
                      style={{
                        padding: '8px 4px',
                        fontSize: '11px',
                        fontWeight: '700',
                        borderRadius: '8px',
                        border: `1px solid ${isSelected ? '#2563eb' : colors.borderColor}`,
                        backgroundColor: isSelected ? (isLight ? 'rgba(37, 99, 235, 0.12)' : 'rgba(37, 99, 235, 0.25)') : colors.bgInner,
                        color: isSelected ? colors.accentBlueLight : colors.textSecondary,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px',
                        transition: 'all 0.15s'
                      }}
                    >
                      <span style={{ fontSize: '14px' }}>{cfg.flag}</span>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{key}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Form Fields */}
            {(() => {
              const activeMarket = newTradeForm.market_segment || marketSegment || 'Indian';
              const activeCfg = MARKET_CONFIGS[activeMarket] || MARKET_CONFIGS.Indian;
              const activeSym = activeCfg.currency;

              return (
                <form onSubmit={handleSaveNewTrade} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Symbol & Side */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>
                        Symbol / Instrument ({activeMarket})
                      </label>
                      <input 
                        type="text" 
                        required 
                        placeholder={activeCfg.suggestions[0]} 
                        value={newTradeForm.symbol} 
                        onChange={(e) => setNewTradeForm({ ...newTradeForm, symbol: e.target.value })} 
                        style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '13px', marginTop: '3px', outline: 'none' }} 
                      />
                      {/* Quick Symbol Suggestions Chips */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                        {activeCfg.suggestions.slice(0, 5).map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setNewTradeForm({ ...newTradeForm, symbol: s })}
                            style={{
                              padding: '2px 7px',
                              fontSize: '10px',
                              fontWeight: '600',
                              borderRadius: '12px',
                              backgroundColor: newTradeForm.symbol === s ? '#2563eb' : colors.bgInner,
                              color: newTradeForm.symbol === s ? '#ffffff' : colors.textSecondary,
                              border: `1px solid ${colors.borderColor}`,
                              cursor: 'pointer'
                            }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>Side</label>
                      <select 
                        value={newTradeForm.trade_type} 
                        onChange={(e) => setNewTradeForm({ ...newTradeForm, trade_type: e.target.value })} 
                        style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '13px', marginTop: '3px', outline: 'none' }}
                      >
                        <option value="BUY">BUY / LONG</option>
                        <option value="SELL">SELL / SHORT</option>
                      </select>
                    </div>
                  </div>

                  {/* Price & Quantity Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>
                        Entry Price ({activeSym})
                      </label>
                      <input 
                        type="number" 
                        step={activeCfg.priceStep} 
                        inputMode="decimal" 
                        required 
                        placeholder="0.00" 
                        value={newTradeForm.entry_price} 
                        onChange={(e) => setNewTradeForm({ ...newTradeForm, entry_price: e.target.value })} 
                        style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '13px', marginTop: '3px', outline: 'none' }} 
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>
                        Exit Price ({activeSym})
                      </label>
                      <input 
                        type="number" 
                        step={activeCfg.priceStep} 
                        inputMode="decimal" 
                        required 
                        placeholder="0.00" 
                        value={newTradeForm.exit_price} 
                        onChange={(e) => setNewTradeForm({ ...newTradeForm, exit_price: e.target.value })} 
                        style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '13px', marginTop: '3px', outline: 'none' }} 
                      />
                    </div>
                    <div style={{ gridColumn: isMobile ? '1 / -1' : 'auto' }}>
                      <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>
                        {activeCfg.qtyLabel}
                      </label>
                      <input 
                        type="number" 
                        step="any"
                        inputMode="decimal" 
                        required 
                        placeholder={activeCfg.qtyPlaceholder}
                        value={newTradeForm.quantity} 
                        onChange={(e) => setNewTradeForm({ ...newTradeForm, quantity: e.target.value })} 
                        style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '13px', marginTop: '3px', outline: 'none' }} 
                      />
                    </div>
                  </div>

                  {/* Charges & Date Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>
                        Brokerage & Charges ({activeSym})
                      </label>
                      <input 
                        type="number" 
                        step="any" 
                        value={newTradeForm.charges} 
                        onChange={(e) => setNewTradeForm({ ...newTradeForm, charges: e.target.value })} 
                        style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '13px', marginTop: '3px', outline: 'none' }} 
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>Trade Date</label>
                      <input 
                        type="date" 
                        value={newTradeForm.trade_date} 
                        onChange={(e) => setNewTradeForm({ ...newTradeForm, trade_date: e.target.value })} 
                        style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '13px', marginTop: '3px', outline: 'none' }} 
                      />
                    </div>
                  </div>

                  {/* Strategy & Mindset */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>Strategy</label>
                      <select 
                        value={newTradeForm.strategy} 
                        onChange={(e) => setNewTradeForm({ ...newTradeForm, strategy: e.target.value })} 
                        style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '13px', marginTop: '3px', outline: 'none' }}
                      >
                        {STRATEGY_TAGS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>Mindset / Emotion</label>
                      <select 
                        value={newTradeForm.emotion} 
                        onChange={(e) => setNewTradeForm({ ...newTradeForm, emotion: e.target.value })} 
                        style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '13px', marginTop: '3px', outline: 'none' }}
                      >
                        {EMOTION_TAGS.map(em => <option key={em} value={em}>{em}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>Trade Notes & Lessons Learned</label>
                    <textarea 
                      rows={2} 
                      value={newTradeForm.notes} 
                      onChange={(e) => setNewTradeForm({ ...newTradeForm, notes: e.target.value })} 
                      placeholder="Why did you take this trade? Any lessons learned?" 
                      style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '12px', marginTop: '3px', outline: 'none', resize: 'none' }} 
                    />
                  </div>

                  {/* Live Calculated P&L Preview Banner */}
                  {(() => {
                    const entry = parseFloat(newTradeForm.entry_price);
                    const exit = parseFloat(newTradeForm.exit_price);
                    const qty = parseFloat(newTradeForm.quantity);
                    const chg = parseFloat(newTradeForm.charges) || 0;

                    if (!isNaN(entry) && !isNaN(exit) && !isNaN(qty) && qty > 0) {
                      const gross = newTradeForm.trade_type === 'BUY' ? (exit - entry) * qty : (entry - exit) * qty;
                      const net = gross - chg;
                      const isWin = net >= 0;

                      return (
                        <div style={{
                          padding: '10px 14px',
                          borderRadius: '10px',
                          backgroundColor: isWin ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          border: `1px solid ${isWin ? colors.accentGreen : colors.accentRed}`,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div>
                            <div style={{ fontSize: '10px', color: colors.textSecondary, textTransform: 'uppercase', fontWeight: '800' }}>
                              Calculated P&L Preview ({activeMarket})
                            </div>
                            <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '2px' }}>
                              Gross: {gross >= 0 ? '+' : ''}{activeSym}{gross.toFixed(2)} • Charges: {activeSym}{chg.toFixed(2)}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '16px', fontWeight: '800', color: isWin ? colors.accentGreen : colors.accentRed }}>
                              {net >= 0 ? '+' : ''}{activeSym}{net.toFixed(2)}
                            </div>
                            <span style={{ fontSize: '9px', fontWeight: '800', padding: '1px 6px', borderRadius: '4px', backgroundColor: isWin ? colors.accentGreen : colors.accentRed, color: '#ffffff' }}>
                              {isWin ? 'WIN' : 'LOSS'}
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Actions */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                    <button 
                      type="button" 
                      onClick={() => setShowNewTradeModal(false)} 
                      style={{ backgroundColor: 'transparent', border: `1px solid ${colors.borderColor}`, color: colors.textSecondary, padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      style={{ backgroundColor: '#2563eb', color: '#ffffff', padding: '8px 20px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', border: 'none', cursor: 'pointer', boxShadow: '0 2px 10px rgba(37, 99, 235, 0.4)' }}
                    >
                      Save Trade Log
                    </button>
                  </div>
                </form>
              );
            })()}
          </div>
        </div>
      )}

      {/* CUSTOM CHECKLIST ITEM MODAL */}
      {showAddCustomChecklistModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '12px' }}>
          <div style={{ backgroundColor: colors.bgSidebar, border: `1px solid ${colors.borderColor}`, borderRadius: '16px', width: '100%', maxWidth: '440px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '15px', fontWeight: '800', color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={16} color="#2563eb" /> Add Custom Routine Task
              </div>
              <button onClick={() => setShowAddCustomChecklistModal(false)} style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddCustomChecklistItem} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>Routine Category</label>
                <select 
                  value={customChecklistSection} 
                  onChange={e => setCustomChecklistSection(e.target.value)} 
                  style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '12px', marginTop: '3px', outline: 'none' }}
                >
                  <option value="preMarket">1. Pre-Market Prep</option>
                  <option value="inMarket">2. In-Market Execution</option>
                  <option value="postMarket">3. Post-Market Review</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>Task Description / Rule</label>
                <textarea 
                  rows={2} 
                  required 
                  placeholder="e.g. Checked 15m RSI divergence before triggering order" 
                  value={newCustomTaskText} 
                  onChange={e => setNewCustomTaskText(e.target.value)} 
                  style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '12px', marginTop: '3px', outline: 'none', resize: 'none' }} 
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                <button type="button" onClick={() => setShowAddCustomChecklistModal(false)} style={{ backgroundColor: 'transparent', border: `1px solid ${colors.borderColor}`, color: colors.textSecondary, padding: '7px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '7px 16px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>Add to Checklist</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. ADD STRATEGY MODAL */}
      {showAddStrategyModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '12px' }}>
          <div style={{ backgroundColor: colors.bgSidebar, border: `1px solid ${colors.borderColor}`, borderRadius: '16px', width: '100%', maxWidth: '440px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '15px', fontWeight: '800', color: colors.textPrimary }}>Add New Strategy</div>
              <button onClick={() => setShowAddStrategyModal(false)} style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddStrategy} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>Strategy Name</label>
                <input type="text" required placeholder="e.g. Opening Range Breakout (ORB)" value={newStrategyForm.name} onChange={e => setNewStrategyForm({ ...newStrategyForm, name: e.target.value })} style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '12px', marginTop: '3px', outline: 'none' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>Category</label>
                  <select value={newStrategyForm.category} onChange={e => setNewStrategyForm({ ...newStrategyForm, category: e.target.value })} style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '12px', marginTop: '3px', outline: 'none' }}>
                    <option value="Momentum">Momentum</option>
                    <option value="Reversal">Reversal</option>
                    <option value="Options">Options</option>
                    <option value="Scalping">Scalping</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>Target R:R</label>
                  <input type="text" value={newStrategyForm.target_rr} onChange={e => setNewStrategyForm({ ...newStrategyForm, target_rr: e.target.value })} style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '12px', marginTop: '3px', outline: 'none' }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowAddStrategyModal(false)} style={{ backgroundColor: 'transparent', border: `1px solid ${colors.borderColor}`, color: colors.textSecondary, padding: '7px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '7px 16px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>Save Strategy</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. ADD RULE MODAL */}
      {showAddRuleModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '12px' }}>
          <div style={{ backgroundColor: colors.bgSidebar, border: `1px solid ${colors.borderColor}`, borderRadius: '16px', width: '100%', maxWidth: '440px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '15px', fontWeight: '800', color: colors.textPrimary }}>Add Trading Rule</div>
              <button onClick={() => setShowAddRuleModal(false)} style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddRule} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>Rule Description</label>
                <textarea rows={2} required placeholder="e.g. Never risk more than 1.5% on expiry days" value={newRuleForm.text} onChange={e => setNewRuleForm({ ...newRuleForm, text: e.target.value })} style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '12px', marginTop: '3px', outline: 'none', resize: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>Category</label>
                <select value={newRuleForm.category} onChange={e => setNewRuleForm({ ...newRuleForm, category: e.target.value })} style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '12px', marginTop: '3px', outline: 'none' }}>
                  <option value="RISK">RISK</option>
                  <option value="DISCIPLINE">DISCIPLINE</option>
                  <option value="EXECUTION">EXECUTION</option>
                  <option value="PSYCHOLOGY">PSYCHOLOGY</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowAddRuleModal(false)} style={{ backgroundColor: 'transparent', border: `1px solid ${colors.borderColor}`, color: colors.textSecondary, padding: '7px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '7px 16px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>Save Rule</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. LOG MISTAKE MODAL */}
      {showAddMistakeModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '12px' }}>
          <div style={{ backgroundColor: colors.bgSidebar, border: `1px solid ${colors.borderColor}`, borderRadius: '16px', width: '100%', maxWidth: '440px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '15px', fontWeight: '800', color: colors.textPrimary }}>Log Mistake & Cost</div>
              <button onClick={() => setShowAddMistakeModal(false)} style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddMistake} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>Mistake Name</label>
                <input type="text" required placeholder="e.g. Chased market order at top of spike" value={newMistakeForm.name} onChange={e => setNewMistakeForm({ ...newMistakeForm, name: e.target.value })} style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '12px', marginTop: '3px', outline: 'none' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>Loss Incurred (₹)</label>
                  <input type="number" required placeholder="5000" value={newMistakeForm.loss} onChange={e => setNewMistakeForm({ ...newMistakeForm, loss: e.target.value })} style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '12px', marginTop: '3px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>Category</label>
                  <select value={newMistakeForm.category} onChange={e => setNewMistakeForm({ ...newMistakeForm, category: e.target.value })} style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '12px', marginTop: '3px', outline: 'none' }}>
                    <option value="PSYCHOLOGY">PSYCHOLOGY</option>
                    <option value="RISK">RISK</option>
                    <option value="EXECUTION">EXECUTION</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>Corrective Lesson Learned</label>
                <textarea rows={2} placeholder="What will you do differently next time?" value={newMistakeForm.note} onChange={e => setNewMistakeForm({ ...newMistakeForm, note: e.target.value })} style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '12px', marginTop: '3px', outline: 'none', resize: 'none' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowAddMistakeModal(false)} style={{ backgroundColor: 'transparent', border: `1px solid ${colors.borderColor}`, color: colors.textSecondary, padding: '7px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '7px 16px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>Save Mistake</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. SHARE SETUP MODAL */}
      {showShareSetupModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '12px' }}>
          <div style={{ backgroundColor: colors.bgSidebar, border: `1px solid ${colors.borderColor}`, borderRadius: '16px', width: '100%', maxWidth: '480px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '15px', fontWeight: '800', color: colors.textPrimary }}>Share Trade Setup to Community</div>
              <button onClick={() => setShowShareSetupModal(false)} style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleShareSetup} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>Symbol</label>
                  <input type="text" required placeholder="e.g. NIFTY 24600 CE" value={newSetupForm.symbol} onChange={e => setNewSetupForm({ ...newSetupForm, symbol: e.target.value })} style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '12px', marginTop: '3px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>Direction</label>
                  <select value={newSetupForm.direction} onChange={e => setNewSetupForm({ ...newSetupForm, direction: e.target.value })} style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '12px', marginTop: '3px', outline: 'none' }}>
                    <option value="LONG">LONG</option>
                    <option value="SHORT">SHORT</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>Entry</label>
                  <input type="number" required value={newSetupForm.entry} onChange={e => setNewSetupForm({ ...newSetupForm, entry: e.target.value })} style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '12px', marginTop: '3px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>Stop Loss</label>
                  <input type="number" required value={newSetupForm.sl} onChange={e => setNewSetupForm({ ...newSetupForm, sl: e.target.value })} style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '12px', marginTop: '3px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>Target</label>
                  <input type="number" required value={newSetupForm.target} onChange={e => setNewSetupForm({ ...newSetupForm, target: e.target.value })} style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '12px', marginTop: '3px', outline: 'none' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>Technical Rationale</label>
                <textarea rows={2} required placeholder="Why is this a high-probability trade?" value={newSetupForm.rationale} onChange={e => setNewSetupForm({ ...newSetupForm, rationale: e.target.value })} style={{ width: '100%', backgroundColor: colors.bgInput, border: `1px solid ${colors.borderColor}`, borderRadius: '8px', padding: '8px 10px', color: colors.textPrimary, fontSize: '12px', marginTop: '3px', outline: 'none', resize: 'none' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowShareSetupModal(false)} style={{ backgroundColor: 'transparent', border: `1px solid ${colors.borderColor}`, color: colors.textSecondary, padding: '7px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '7px 16px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>Post to Community</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. PNL SHARE CARD MODAL */}
      {selectedTradeForShare && (
        <PnLShareCardModal trade={selectedTradeForShare} onClose={() => setSelectedTradeForShare(null)} />
      )}
    </div>
  );
}
