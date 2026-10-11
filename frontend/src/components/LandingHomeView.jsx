// frontend/src/components/LandingHomeView.jsx
// 🌟 Institutional 6-Hub Fintech Command Center & Interactive Live Financial Sandbox
// Engineered for high user retention (dwell time), 0ms chunk prefetch, real-time WebSocket telemetry, and deep-linked SEO.

import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import {
  TrendingUp, BookOpen, Building2, Calculator,
  Sparkles, ShieldCheck, ArrowRight, CheckCircle2,
  BarChart2, Zap, Layers, Cpu, PieChart,
  Search, ChevronDown, Activity, ArrowUpRight,
  Sliders, Target, Flame, RefreshCw, Play, Award
} from 'lucide-react';

export default function LandingHomeView({
  onOpenPaperTrading,
  onOpenCommunity,
  onOpenOptionChain,
  onOpenTradeDiary,
  onOpenPrimaryMarkets,
  onOpenCalculators,
  onOpenBrokerConnect,
  onOpenWealthFinance,
  onOpenMutualFunds,
  onOpenLeaderboard,
  onOpenAlgoBridge
}) {
  // ─── Category & Hub Search State ───
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // ─── Hero Interactive Cockpit State (4 Live Playable Modes) ───
  const [cockpitTab, setCockpitTab] = useState('TRADE'); // 'TRADE' | 'OPTIONS' | 'CALC' | 'MOVERS'
  const [activeTickerIdx, setActiveTickerIdx] = useState(0);
  const [chartTimeframe, setChartTimeframe] = useState('5m');
  const [tradeSide, setTradeSide] = useState('BUY'); // 'BUY' | 'SELL'
  const [tradeProduct, setTradeProduct] = useState('MIS'); // 'MIS' | 'NRML' | 'BO'
  const [tradeLots, setTradeLots] = useState(2);
  const [slPoints, setSlPoints] = useState(25);
  const [tpPoints, setTpPoints] = useState(60);
  const [simulatedOrder, setSimulatedOrder] = useState(null);

  // ─── Option Chain Interactive Preview State ───
  const [selectedStrikeOffset, setSelectedStrikeOffset] = useState(0);
  const [selectedOptionType, setSelectedOptionType] = useState('CE');

  // ─── Interactive Calculator Sandbox State ───
  const [calcMode, setCalcMode] = useState('SIP'); // 'SIP' | 'EMI'
  const [sipMonthly, setSipMonthly] = useState(25000);
  const [sipRate, setSipRate] = useState(15);
  const [sipYears, setSipYears] = useState(12);
  const [sipStepUp, setSipStepUp] = useState(10);
  const [loanAmount, setLoanAmount] = useState(5000000);
  const [loanRate, setLoanRate] = useState(8.5);
  const [loanYears, setLoanYears] = useState(15);

  // ─── Interactive Trader Edge Lab State (Middle Retention Strip) ───
  const [riskCapital, setRiskCapital] = useState(1000000);
  const [riskPercent, setRiskPercent] = useState(1.0);
  const [riskSlPts, setRiskSlPts] = useState(25);
  const [brokSegment, setBrokSegment] = useState('OPT_BUY'); // 'OPT_BUY' | 'OPT_SELL' | 'FUT' | 'EQ_INTRA'
  const [brokLots, setBrokLots] = useState(4);
  const [disciplineChecks, setDisciplineChecks] = useState([true, true, true, false]);

  const { user, prices, positions, orders, setSelectedSymbol } = useStore(
    useShallow(state => ({
      user: state.user,
      prices: state.prices,
      positions: state.positions,
      orders: state.orders,
      setSelectedSymbol: state.setSelectedSymbol
    }))
  );

  // Prefetch lazy chunks on hover so clicking any Hub opens in 0ms under high load
  const prefetchHubChunk = (hubId) => {
    try {
      if (hubId === 2) import('./TradeDiaryView');
      else if (hubId === 3) import('./PrimaryMarketsView');
      else if (hubId === 4) import('./CalculatorsSuiteView');
      else if (hubId === 5) import('./WealthPersonalFinanceModal');
      else if (hubId === 6) import('./SkandxAlgoView');
      else if (hubId === 7) import('./CommunityFeedView');
    } catch (_) {}
  };

  // Real-Time Live Tickers wired to WebSocket / Store prices
  const LIVE_TICKERS = useMemo(() => {
    const resolvePrice = (keys, fallbackLtp, fallbackChange, fallbackPct, fallbackUp) => {
      for (const k of keys) {
        const p = prices?.[k];
        if (p && Number(p.ltp) > 0) {
          const ltpNum = Number(p.ltp);
          const chNum = Number(p.ch ?? p.change ?? 0);
          const chpNum = Number(p.chp ?? p.pct ?? 0);
          const isUp = chNum >= 0;
          return {
            rawLtp: ltpNum,
            rawCh: chNum,
            rawPct: chpNum,
            ltp: ltpNum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            change: `${isUp ? '+' : ''}${chNum.toFixed(2)} (${isUp ? '+' : ''}${chpNum.toFixed(2)}%)`,
            isUp
          };
        }
      }
      return {
        rawLtp: Number(String(fallbackLtp).replace(/,/g, '')),
        rawCh: fallbackUp ? 104.2 : -42.5,
        rawPct: fallbackPct,
        ltp: fallbackLtp,
        change: fallbackChange,
        isUp: fallbackUp
      };
    };

    return [
      { label: 'NIFTY 50', short: 'NIFTY', lotSize: 75, targetSymbol: 'NSE:NIFTY50-INDEX', ...resolvePrice(['NSE:NIFTY50-INDEX', 'NIFTY50-INDEX', 'NIFTY 50'], '25,014.60', '+104.20 (+0.42%)', 0.42, true) },
      { label: 'BANK NIFTY', short: 'BANKNIFTY', lotSize: 30, targetSymbol: 'NSE:NIFTYBANK-INDEX', ...resolvePrice(['NSE:NIFTYBANK-INDEX', 'NIFTYBANK-INDEX', 'BANKNIFTY'], '51,462.10', '+318.50 (+0.62%)', 0.62, true) },
      { label: 'SENSEX', short: 'SENSEX', lotSize: 20, targetSymbol: 'BSE:SENSEX-INDEX', ...resolvePrice(['BSE:SENSEX-INDEX', 'SENSEX-INDEX', 'SENSEX'], '81,688.45', '+310.80 (+0.38%)', 0.38, true) },
      { label: 'FINNIFTY', short: 'FINNIFTY', lotSize: 65, targetSymbol: 'NSE:FINNIFTY-INDEX', ...resolvePrice(['NSE:FINNIFTY-INDEX', 'FINNIFTY-INDEX'], '23,890.75', '+120.30 (+0.51%)', 0.51, true) },
      { label: 'RELIANCE', short: 'RELIANCE', lotSize: 500, targetSymbol: 'NSE:RELIANCE-EQ', ...resolvePrice(['NSE:RELIANCE-EQ', 'RELIANCE-EQ', 'RELIANCE'], '1,294.50', '+14.80 (+1.16%)', 1.16, true) },
      { label: 'TCS', short: 'TCS', lotSize: 175, targetSymbol: 'NSE:TCS-EQ', ...resolvePrice(['NSE:TCS-EQ', 'TCS-EQ', 'TCS'], '4,142.00', '+32.40 (+0.79%)', 0.79, true) },
      { label: 'GOLD1 ETF', short: 'GOLD1', lotSize: 100, targetSymbol: 'NSE:GOLD1-EQ', ...resolvePrice(['NSE:GOLD1-EQ', 'GOLD1-EQ'], '122.74', '+0.45 (+0.37%)', 0.37, true) },
      { label: 'EGOLD', short: 'EGOLD', lotSize: 100, targetSymbol: 'NSE:EGOLD-EQ', ...resolvePrice(['NSE:EGOLD-EQ', 'EGOLD-EQ'], '146.85', '+0.60 (+0.41%)', 0.41, true) }
    ];
  }, [prices]);

  const activeInstrument = LIVE_TICKERS[activeTickerIdx] || LIVE_TICKERS[0];

  // Live Account & Session Telemetry
  const liveTelemetry = useMemo(() => {
    const balance = Number(user?.balance ?? 1000000);
    const activePositions = (positions || []).filter(p => Number(p.quantity) !== 0);
    const todayOrders = (orders || []).filter(o => o.status === 'EXECUTED' || o.status === 'COMPLETED');
    let realizedPnl = 0;
    todayOrders.forEach(o => {
      if (o.realized_pnl !== undefined && o.realized_pnl !== null) {
        realizedPnl += Number(o.realized_pnl) || 0;
      }
    });
    return {
      balance,
      openCount: activePositions.length,
      executedCount: todayOrders.length,
      realizedPnl
    };
  }, [user?.balance, positions, orders]);

  // Dynamic SVG Chart Generator for Active Instrument & Timeframe
  const chartData = useMemo(() => {
    const base = activeInstrument.rawLtp || 25000;
    const tfSeed = chartTimeframe === '1m' ? 1 : chartTimeframe === '5m' ? 2 : chartTimeframe === '15m' ? 3 : 4;
    const pts = [];
    const candles = [];
    const totalPoints = 24;
    let curr = base * 0.996;
    for (let i = 0; i < totalPoints; i++) {
      const wave = Math.sin((i + activeTickerIdx * 2 + tfSeed) * 0.55) * (base * 0.0018) + (i / totalPoints) * (base * 0.0045);
      const val = curr + wave;
      const open = i === 0 ? val * 0.9995 : pts[i - 1];
      const close = i === totalPoints - 1 ? base : val;
      const high = Math.max(open, close) + base * 0.0009;
      const low = Math.min(open, close) - base * 0.0008;
      pts.push(close);
      candles.push({ open, high, low, close, isUp: close >= open });
    }
    const minVal = Math.min(...candles.map(c => c.low));
    const maxVal = Math.max(...candles.map(c => c.high));
    const span = Math.max(maxVal - minVal, 1);
    const width = 520;
    const height = 148;
    const pathCoords = pts.map((v, idx) => {
      const x = (idx / (totalPoints - 1)) * width;
      const y = height - ((v - minVal) / span) * (height - 24) - 12;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const linePath = `M ${pathCoords.join(' L ')}`;
    const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;
    return { candles, minVal, maxVal, span, width, height, linePath, areaPath };
  }, [activeInstrument.rawLtp, activeTickerIdx, chartTimeframe]);

  // Interactive Quick-Trade Ticket Calculations
  const tradeMetrics = useMemo(() => {
    const qty = tradeLots * (activeInstrument.lotSize || 75);
    const notional = qty * (activeInstrument.rawLtp || 25000);
    const leverage = tradeProduct === 'MIS' ? 5 : tradeProduct === 'BO' ? 6 : 1.5;
    const marginRequired = Math.round(notional / leverage);
    const maxProfit = Math.round(qty * tpPoints);
    const maxRisk = Math.round(qty * slPoints);
    const rrRatio = slPoints > 0 ? (tpPoints / slPoints).toFixed(2) : '2.00';
    const estCharges = Math.round(40 + notional * 0.00035);
    return { qty, notional, marginRequired, maxProfit, maxRisk, rrRatio, estCharges };
  }, [tradeLots, activeInstrument, tradeProduct, slPoints, tpPoints]);

  // Dynamic 7-Strike Option Chain Preview centered around Live Nifty 50 Spot
  const niftySpot = LIVE_TICKERS[0]?.rawLtp || 25014.6;
  const atmStrike = Math.round(niftySpot / 50) * 50;
  const optionChainRows = useMemo(() => {
    const offsets = [-150, -100, -50, 0, 50, 100, 150];
    return offsets.map(offset => {
      const strike = atmStrike + offset;
      const dist = niftySpot - strike;
      const callIntrinsic = Math.max(0, dist);
      const putIntrinsic = Math.max(0, -dist);
      const timeVal = Math.max(28, 138 - Math.abs(offset) * 0.52);
      const callLtp = (callIntrinsic + timeVal).toFixed(2);
      const putLtp = (putIntrinsic + timeVal * 0.96).toFixed(2);
      const callDelta = Math.min(0.88, Math.max(0.14, 0.52 + (dist / 350))).toFixed(2);
      const putDelta = (-Math.min(0.88, Math.max(0.14, 0.48 - (dist / 350)))).toFixed(2);
      const callOiLakhs = (28 + ((strike % 100 === 0 ? 18 : 6) + Math.max(0, offset / 10))).toFixed(1);
      const putOiLakhs = (32 + ((strike % 100 === 0 ? 21 : 8) + Math.max(0, -offset / 10))).toFixed(1);
      const iv = (13.4 + Math.abs(offset) * 0.015).toFixed(1);
      const theta = (-14.2 + Math.abs(offset) * 0.03).toFixed(1);
      return {
        offset,
        strike,
        isAtm: offset === 0,
        callLtp,
        putLtp,
        callDelta,
        putDelta,
        callOiLakhs,
        putOiLakhs,
        iv,
        theta
      };
    });
  }, [atmStrike, niftySpot]);

  const selectedChainRow = optionChainRows.find(r => r.offset === selectedStrikeOffset) || optionChainRows[3];

  // Interactive SIP & Loan EMI Sandbox Calculations
  const calcSandboxResult = useMemo(() => {
    if (calcMode === 'SIP') {
      const r = sipRate / 100 / 12;
      let totalInvested = 0;
      let corpus = 0;
      let currentMonthly = sipMonthly;
      for (let y = 1; y <= sipYears; y++) {
        for (let m = 1; m <= 12; m++) {
          totalInvested += currentMonthly;
          corpus = (corpus + currentMonthly) * (1 + r);
        }
        currentMonthly = currentMonthly * (1 + sipStepUp / 100);
      }
      const wealthGained = Math.max(0, corpus - totalInvested);
      const investedPct = corpus > 0 ? Math.round((totalInvested / corpus) * 100) : 50;
      return {
        primaryLabel: 'Projected Maturity Wealth',
        primaryValue: `₹${Math.round(corpus).toLocaleString('en-IN')}`,
        subLeftLabel: 'Total Invested',
        subLeftValue: `₹${Math.round(totalInvested).toLocaleString('en-IN')}`,
        subRightLabel: 'Wealth Gained',
        subRightValue: `+₹${Math.round(wealthGained).toLocaleString('en-IN')}`,
        multiplier: `${(corpus / Math.max(totalInvested, 1)).toFixed(2)}x`,
        barPct: 100 - investedPct
      };
    } else {
      const r = loanRate / 12 / 100;
      const n = loanYears * 12;
      const emi = r > 0 ? (loanAmount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : loanAmount / n;
      const totalPayable = emi * n;
      const totalInterest = Math.max(0, totalPayable - loanAmount);
      const intPct = totalPayable > 0 ? Math.round((totalInterest / totalPayable) * 100) : 30;
      return {
        primaryLabel: 'Monthly Reducing Balance EMI',
        primaryValue: `₹${Math.round(emi).toLocaleString('en-IN')}/mo`,
        subLeftLabel: 'Loan Principal',
        subLeftValue: `₹${Math.round(loanAmount).toLocaleString('en-IN')}`,
        subRightLabel: 'Total Interest',
        subRightValue: `₹${Math.round(totalInterest).toLocaleString('en-IN')}`,
        multiplier: `${intPct}% Int.`,
        barPct: 100 - intPct
      };
    }
  }, [calcMode, sipMonthly, sipRate, sipYears, sipStepUp, loanAmount, loanRate, loanYears]);

  // Interactive Trader Edge Lab Calculations
  const positionSizerResult = useMemo(() => {
    const maxRiskRs = Math.round(riskCapital * (riskPercent / 100));
    const safeQty = Math.max(1, Math.floor(maxRiskRs / Math.max(riskSlPts, 1)));
    const niftyLots = Math.max(1, Math.floor(safeQty / 75));
    return { maxRiskRs, safeQty, niftyLots };
  }, [riskCapital, riskPercent, riskSlPts]);

  const brokerageLabResult = useMemo(() => {
    const qty = brokLots * 75;
    const premiumOrPrice = brokSegment.startsWith('OPT') ? 180 : 25000;
    const turnover = qty * premiumOrPrice * 2;
    const brokerage = 40;
    const stt = brokSegment === 'OPT_BUY'
      ? Math.round((qty * premiumOrPrice) * 0.001)
      : brokSegment === 'OPT_SELL'
      ? Math.round((qty * premiumOrPrice) * 0.001)
      : brokSegment === 'FUT'
      ? Math.round((qty * premiumOrPrice) * 0.0002)
      : Math.round((qty * premiumOrPrice) * 0.00025);
    const exchangeTxn = Math.round(turnover * (brokSegment.startsWith('OPT') ? 0.0003503 : 0.0000188));
    const gst = Math.round((brokerage + exchangeTxn) * 0.18);
    const stamp = Math.round((qty * premiumOrPrice) * 0.00003);
    const totalTax = brokerage + stt + exchangeTxn + gst + stamp;
    const breakevenPts = (totalTax / Math.max(qty, 1)).toFixed(2);
    return { qty, totalTax, stt, gst, breakevenPts };
  }, [brokSegment, brokLots]);

  const disciplineScore = useMemo(() => {
    const checked = disciplineChecks.filter(Boolean).length;
    return Math.round((checked / disciplineChecks.length) * 100);
  }, [disciplineChecks]);

  const handleTickerClick = (symbol, idx) => {
    if (typeof idx === 'number') {
      setActiveTickerIdx(idx);
      setCockpitTab('TRADE');
    }
    if (typeof setSelectedSymbol === 'function' && symbol) {
      setSelectedSymbol(symbol);
    }
  };

  const handleLaunchSymbolInTerminal = (symbol) => {
    if (typeof setSelectedSymbol === 'function' && symbol) {
      setSelectedSymbol(symbol);
    }
    if (onOpenPaperTrading) onOpenPaperTrading();
  };

  const handleSimulateOrderOnPage = () => {
    setSimulatedOrder({
      symbol: activeInstrument.label,
      side: tradeSide,
      product: tradeProduct,
      qty: tradeMetrics.qty,
      lots: tradeLots,
      entryPrice: activeInstrument.rawLtp,
      slPoints,
      tpPoints,
      simulatedPnl: tradeSide === 'BUY' ? Math.round(tradeMetrics.qty * 6.4) : Math.round(tradeMetrics.qty * 5.8),
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    });
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const HUBS = [
    {
      id: 1,
      hubNum: '01',
      category: 'TRADING',
      title: 'Paper Trading Terminal',
      shortDesc: 'Trade NSE/BSE Equities, F&O Options & MCX Futures with ₹10,00,000 to ₹10 Crore live virtual capital and sub-second WebSocket ticks.',
      icon: TrendingUp,
      color: '#0284c7',
      gradient: 'linear-gradient(145deg, rgba(2, 132, 199, 0.22), rgba(15, 23, 42, 0.95))',
      border: 'rgba(56, 189, 248, 0.35)',
      badge: 'Free ₹10L–₹10Cr Capital',
      badgeColor: '#38bdf8',
      kpiLeft: { label: 'Virtual Margin', value: `₹${(liveTelemetry.balance / 100000).toFixed(2)}L` },
      kpiRight: { label: 'Active Positions', value: `${liveTelemetry.openCount} Open` },
      tags: ['Live WebSockets', 'F&O Options Chain', 'Bracket Orders', 'TradingView Charts'],
      tagActions: {
        'Live WebSockets': () => onOpenPaperTrading(),
        'F&O Options Chain': () => (onOpenOptionChain ? onOpenOptionChain() : onOpenPaperTrading()),
        'Bracket Orders': () => onOpenPaperTrading(),
        'TradingView Charts': () => onOpenPaperTrading()
      },
      actionLabel: 'Launch Terminal Now',
      primaryAction: onOpenPaperTrading,
      quickLinks: [
        { label: 'Live Terminal', action: onOpenPaperTrading },
        { label: 'Option Chain', action: () => (onOpenOptionChain ? onOpenOptionChain() : onOpenPaperTrading()) },
        { label: 'Mutual Funds Desk', action: () => (onOpenMutualFunds ? onOpenMutualFunds() : onOpenPaperTrading()) },
        { label: 'Trader Leaderboard', action: () => (onOpenLeaderboard ? onOpenLeaderboard() : onOpenPaperTrading()) }
      ]
    },
    {
      id: 2,
      hubNum: '02',
      category: 'TRADING',
      title: '8-Pillar Trade Diary & Journal',
      shortDesc: 'Institutional performance journaling covering pre-trade checklists, strategy tags, emotional leak detection, and expectancy analytics.',
      icon: BookOpen,
      color: '#818cf8',
      gradient: 'linear-gradient(145deg, rgba(99, 102, 241, 0.22), rgba(15, 23, 42, 0.95))',
      border: 'rgba(129, 140, 248, 0.35)',
      badge: '8 Core Pillars',
      badgeColor: '#818cf8',
      kpiLeft: { label: 'Architecture', value: '8-Pillar Audit' },
      kpiRight: { label: 'Export Ready', value: 'CSV & Print PDF' },
      tags: ['Checklist', 'Trades', 'Strategies', 'Rules', 'Mistakes', 'AI Summary', 'Reports', 'Risk'],
      tagActions: {
        'Checklist': () => onOpenTradeDiary('CHECKLIST'),
        'Trades': () => onOpenTradeDiary('TRADES'),
        'Strategies': () => onOpenTradeDiary('STRATEGIES'),
        'Rules': () => onOpenTradeDiary('RULES'),
        'Mistakes': () => onOpenTradeDiary('MISTAKES'),
        'AI Summary': () => onOpenTradeDiary('AI_SUMMARY'),
        'Reports': () => onOpenTradeDiary('REPORTS'),
        'Risk': () => onOpenTradeDiary('RISK')
      },
      actionLabel: 'Open Trade Diary',
      primaryAction: () => onOpenTradeDiary('CHECKLIST'),
      quickLinks: [
        { label: 'Pre-Trade Checklist', action: () => onOpenTradeDiary('CHECKLIST') },
        { label: 'Strategy & Mistake Matrix', action: () => onOpenTradeDiary('STRATEGIES') },
        { label: 'AI Journal Summarizer', action: () => onOpenTradeDiary('AI_SUMMARY') },
        { label: 'Risk & Leak Detector', action: () => onOpenTradeDiary('RISK') }
      ]
    },
    {
      id: 3,
      hubNum: '03',
      category: 'MARKETS',
      title: 'Bhavcopy Screener & Deals Hub',
      shortDesc: 'Daily NSE institutional delivery screener (>60% delivery), 2x volume surges, Bulk/Block deals tape & 1-click PAN IPO allotment.',
      icon: Building2,
      color: '#10b981',
      gradient: 'linear-gradient(145deg, rgba(16, 185, 129, 0.22), rgba(15, 23, 42, 0.95))',
      border: 'rgba(16, 185, 129, 0.35)',
      badge: '₹0 NSE Feed',
      badgeColor: '#10b981',
      kpiLeft: { label: 'Delivery Filter', value: '>60% Institutional' },
      kpiRight: { label: 'Primary Desk', value: 'IPO GMP & Deals' },
      tags: ['5:35 PM Daily Cron', 'Bulk & Block Deals', 'Live GMP', 'PAN Allotment'],
      tagActions: {
        '5:35 PM Daily Cron': () => onOpenPrimaryMarkets('BHAVCOPY'),
        'Bulk & Block Deals': () => onOpenPrimaryMarkets('DEALS'),
        'Live GMP': () => onOpenPrimaryMarkets('IPO'),
        'PAN Allotment': () => onOpenPrimaryMarkets('ALLOTMENT')
      },
      actionLabel: 'Explore Primary Markets',
      primaryAction: () => onOpenPrimaryMarkets('BHAVCOPY'),
      quickLinks: [
        { label: 'NSE Delivery Screener (>60%)', action: () => onOpenPrimaryMarkets('BHAVCOPY') },
        { label: 'Bulk & Block Deals Tape', action: () => onOpenPrimaryMarkets('DEALS') },
        { label: 'IPO & SME GMP Hub', action: () => onOpenPrimaryMarkets('IPO') },
        { label: '1-Click PAN IPO Allotment', action: () => onOpenPrimaryMarkets('ALLOTMENT') }
      ]
    },
    {
      id: 4,
      hubNum: '04',
      category: 'CALCULATORS',
      title: 'Financial Calculators Suite & AI Wealth Planning',
      shortDesc: '10 institutional calculators: Reducing & Flat EMI Loans, SIP Step-Up Compounder, MTF 4x Leverage, Stock Averaging, STT & Black-Scholes Greeks.',
      icon: Calculator,
      color: '#f59e0b',
      gradient: 'linear-gradient(145deg, rgba(245, 158, 11, 0.22), rgba(15, 23, 42, 0.95))',
      border: 'rgba(245, 158, 11, 0.35)',
      badge: 'Full Suite + PDF/Excel',
      badgeColor: '#f59e0b',
      kpiLeft: { label: 'Active Engines', value: '10 Calculators' },
      kpiRight: { label: 'Schedules', value: 'Chart + PDF/Excel' },
      tags: ['Reducing Loan EMI', 'Fixed Loan', 'Average Price', 'MTF 4x', 'SIP & Step-Up', 'Mutual Funds', 'AI Tax Copilot', 'Export Schedules'],
      tagActions: {
        'Reducing Loan EMI': () => onOpenCalculators('reducing-loan'),
        'Fixed Loan': () => onOpenCalculators('fixed-loan'),
        'Average Price': () => onOpenCalculators('average-price'),
        'MTF 4x': () => onOpenCalculators('mtf'),
        'SIP & Step-Up': () => onOpenCalculators('sip'),
        'Mutual Funds': () => onOpenCalculators('mutual-funds'),
        'AI Tax Copilot': () => onOpenWealthFinance('AI_COPILOT'),
        'Export Schedules': () => onOpenCalculators('all')
      },
      actionLabel: 'Launch Full Calculator Suite',
      primaryAction: () => onOpenCalculators('all'),
      quickLinks: [
        { label: 'All Calculators Catalog', action: () => onOpenCalculators('all') },
        { label: 'Reducing Loan EMI (Home/Car)', action: () => onOpenCalculators('reducing-loan') },
        { label: 'Fixed / Flat Rate Loan', action: () => onOpenCalculators('fixed-loan') },
        { label: 'Average Share Price', action: () => onOpenCalculators('average-price') },
        { label: 'MTF Financing (4x Leverage)', action: () => onOpenCalculators('mtf') },
        { label: 'SIP & Step-Up Compounder', action: () => onOpenCalculators('sip') }
      ]
    },
    {
      id: 5,
      hubNum: '05',
      category: 'WEALTH',
      title: 'Wealth OS & Tax Hub',
      shortDesc: 'Complete 360° personal financial command center: Multi-asset net worth tracking, 50/30/20 budget leak detector, actuarial HLV gap, and FY25 tax harvesting.',
      icon: PieChart,
      color: '#10b981',
      gradient: 'linear-gradient(145deg, rgba(16, 185, 129, 0.22), rgba(15, 23, 42, 0.95))',
      border: 'rgba(16, 185, 129, 0.35)',
      badge: '360° Financial Cockpit',
      badgeColor: '#10b981',
      kpiLeft: { label: 'Tax Regime', value: 'FY25 STCG/LTCG' },
      kpiRight: { label: 'Protection', value: 'Actuarial HLV + Solvency' },
      tags: ['Consolidated Net Worth', '50/30/20 Budget', 'Expense Leaks', 'Actuarial HLV Gap', 'Family Floater', 'Tax-Loss Harvesting FY25', 'STCG 20% / LTCG 12.5%'],
      tagActions: {
        'Consolidated Net Worth': () => onOpenWealthFinance('NET_WORTH'),
        '50/30/20 Budget': () => onOpenWealthFinance('BUDGET'),
        'Expense Leaks': () => onOpenWealthFinance('BUDGET'),
        'Actuarial HLV Gap': () => onOpenWealthFinance('INSURANCE'),
        'Family Floater': () => onOpenWealthFinance('INSURANCE'),
        'Tax-Loss Harvesting FY25': () => onOpenWealthFinance('TAX_LOSS'),
        'STCG 20% / LTCG 12.5%': () => onOpenWealthFinance('TAX_LOSS')
      },
      actionLabel: 'Launch Wealth OS & Tax Hub',
      primaryAction: () => onOpenWealthFinance('NET_WORTH'),
      quickLinks: [
        { label: 'Consolidated Net Worth & Solvency', action: () => onOpenWealthFinance('NET_WORTH') },
        { label: '50/30/20 Budget & Leak Detector', action: () => onOpenWealthFinance('BUDGET') },
        { label: 'Term Life & Health Protection Gap (HLV)', action: () => onOpenWealthFinance('INSURANCE') },
        { label: 'Tax-Loss Harvesting (Budget FY25)', action: () => onOpenWealthFinance('TAX_LOSS') }
      ]
    },
    {
      id: 6,
      hubNum: '06',
      category: 'TRADING',
      title: 'SkandX Algo Multi-Broker Demat & Bridge Suite',
      shortDesc: 'Multi-broker Demat connection, Dedicated Mumbai BKC Static IPs, TradingView JSON Webhook Bridge & multi-account copy trading.',
      icon: Cpu,
      color: '#0284c7',
      gradient: 'linear-gradient(145deg, rgba(2, 132, 199, 0.22), rgba(15, 23, 42, 0.95))',
      border: 'rgba(56, 189, 248, 0.35)',
      badge: 'SKANDX ALGO PRO',
      badgeColor: '#38bdf8',
      kpiLeft: { label: 'Supported Brokers', value: 'Zerodha, Fyers, Dhan+' },
      kpiRight: { label: 'Bridge Latency', value: '<15ms Webhook' },
      tags: ['Share Demat Link', 'Demat API Keys', 'Static IPs', 'JSON Webhook Bridge', 'TradingView Alerts'],
      tagActions: {
        'Share Demat Link': () => onOpenAlgoBridge('SHARE_LINK'),
        'Demat API Keys': () => onOpenAlgoBridge('API_KEYS'),
        'Static IPs': () => onOpenAlgoBridge('STATIC_IP'),
        'JSON Webhook Bridge': () => onOpenAlgoBridge('WEBHOOK'),
        'TradingView Alerts': () => onOpenAlgoBridge('WEBHOOK')
      },
      actionLabel: 'Launch SkandX Algo Console',
      primaryAction: () => (onOpenAlgoBridge ? onOpenAlgoBridge('SHARE_LINK') : onOpenPaperTrading()),
      quickLinks: [
        { label: 'Share Demat Link', action: () => onOpenAlgoBridge('SHARE_LINK') },
        { label: 'Demat API Keys & Credentials', action: () => onOpenAlgoBridge('API_KEYS') },
        { label: 'Dedicated Static IP Routing', action: () => onOpenAlgoBridge('STATIC_IP') },
        { label: 'JSON Webhook Bridge', action: () => onOpenAlgoBridge('WEBHOOK') }
      ]
    }
  ];

  const SPOTLIGHT_TOOLS = [
    { label: '💬 Traders Community & Clubs', action: () => (onOpenCommunity ? onOpenCommunity() : onOpenPaperTrading()), color: '#38bdf8' },
    { label: '🧮 SIP & Step-Up Calculator', action: () => onOpenCalculators('sip'), color: '#38bdf8' },
    { label: '🏠 Reducing Balance Loan EMI', action: () => onOpenCalculators('reducing-loan'), color: '#10b981' },
    { label: '🏦 Fixed / Flat Rate Loan', action: () => onOpenCalculators('fixed-loan'), color: '#f59e0b' },
    { label: '⚡ MTF 4x Leverage Calculator', action: () => onOpenCalculators('mtf'), color: '#a855f7' },
    { label: '📉 Share Price Averaging', action: () => onOpenCalculators('average-price'), color: '#06b6d4' },
    { label: '✂️ FY25 Tax-Loss Harvester', action: () => onOpenWealthFinance('TAX_LOSS'), color: '#ec4899' },
    { label: '🏛️ Live IPO GMP & Allotment', action: () => onOpenPrimaryMarkets('IPO'), color: '#34d399' },
    { label: '🤖 TradingView Webhook Bridge', action: () => onOpenAlgoBridge('WEBHOOK'), color: '#60a5fa' }
  ];

  const filteredHubs = useMemo(() => {
    return HUBS.filter(hub => {
      const matchCat = selectedCategory === 'ALL' || hub.category === selectedCategory;
      const matchSearch = !searchQuery.trim() ||
        hub.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        hub.shortDesc.toLowerCase().includes(searchQuery.toLowerCase()) ||
        hub.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
        hub.quickLinks.some(q => q.label.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [selectedCategory, searchQuery, liveTelemetry]);

  return (
    <div style={{
      width: '100%',
      minHeight: '100%',
      backgroundColor: '#060911',
      backgroundImage: 'radial-gradient(circle at 18% 12%, rgba(2, 132, 199, 0.14) 0%, transparent 42%), radial-gradient(circle at 84% 18%, rgba(99, 102, 241, 0.13) 0%, transparent 45%), radial-gradient(circle at 50% 65%, rgba(16, 185, 129, 0.07) 0%, transparent 50%)',
      color: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      position: 'relative',
      overflowX: 'hidden'
    }}>
      {/* Scoped Institutional Styles — Eliminates ugly Windows horizontal scrollbars and adds hover polish */}
      <style>{`
        .skx-no-scrollbar::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
        .skx-no-scrollbar { -ms-overflow-style: none !important; scrollbar-width: none !important; }
        .skx-hub-card { transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.22s ease, border-color 0.22s ease; }
        .skx-hub-card:hover { transform: translateY(-4px); box-shadow: 0 20px 42px rgba(0, 0, 0, 0.55) !important; }
        .skx-pill-btn { transition: all 0.16s ease; }
        .skx-pill-btn:hover { transform: translateY(-1px); background: rgba(56, 189, 248, 0.14) !important; border-color: rgba(56, 189, 248, 0.45) !important; }
        .skx-hero-grid { display: grid; grid-template-columns: 1.04fr 1.16fr; gap: 28px; align-items: stretch; }
        .skx-lab-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
        @media (max-width: 1080px) {
          .skx-hero-grid { grid-template-columns: 1fr; }
          .skx-lab-grid { grid-template-columns: 1fr; }
        }
        @keyframes skxLivePulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.35); opacity: 0.55; }
        }
      `}</style>

      {/* 1. Real-Time Clickable Market Ribbon (Zero Horizontal Scrollbar!) */}
      <div
        className="skx-no-scrollbar"
        style={{
          background: 'rgba(8, 12, 22, 0.96)',
          borderBottom: '1px solid rgba(56, 189, 248, 0.14)',
          padding: '7px 18px',
          overflowX: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          fontSize: '11.5px',
          position: 'sticky',
          top: 0,
          zIndex: 60,
          backdropFilter: 'blur(12px)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', whiteSpace: 'nowrap' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.32)',
            padding: '3px 9px',
            borderRadius: '20px',
            color: '#34d399',
            fontWeight: '800',
            fontSize: '10.5px',
            letterSpacing: '0.4px'
          }}>
            <span style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: '#10b981',
              display: 'inline-block',
               boxShadow: '0 0 8px #10b981',
              animation: 'skxLivePulse 1.8s infinite'
            }} />
            LIVE NSE • BSE • MCX
          </div>

          <div style={{ display: 'flex', gap: '8px', whiteSpace: 'nowrap' }}>
            {LIVE_TICKERS.map((t, idx) => {
              const isSelected = activeTickerIdx === idx;
              return (
                <button
                  key={idx}
                  onClick={() => handleTickerClick(t.targetSymbol, idx)}
                  title={`Click to test ${t.label} in Interactive Sandbox or double-click for Full Terminal`}
                  onDoubleClick={() => handleLaunchSymbolInTerminal(t.targetSymbol)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: isSelected ? 'rgba(2, 132, 199, 0.22)' : 'rgba(255, 255, 255, 0.03)',
                    border: isSelected ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid rgba(255, 255, 255, 0.07)',
                    borderRadius: '7px',
                    padding: '4px 10px',
                    cursor: 'pointer',
                    color: '#f8fafc',
                    fontSize: '11.5px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ fontWeight: '700', color: isSelected ? '#38bdf8' : '#cbd5e1' }}>{t.label}</span>
                  <span style={{ fontWeight: '800', color: '#f8fafc', fontVariantNumeric: 'tabular-nums' }}>{t.ltp}</span>
                  <span style={{ color: t.isUp ? '#10b981' : '#ef4444', fontWeight: '700', fontSize: '11px', fontVariantNumeric: 'tabular-nums' }}>
                    {t.change}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="hide-on-mobile" style={{ display: 'flex', alignItems: 'center', gap: '12px', whiteSpace: 'nowrap', fontSize: '11px', color: '#94a3b8' }}>
          <span>INDIA VIX: <strong style={{ color: '#34d399' }}>13.42 (-1.8%)</strong></span>
          <span>•</span>
          <span>NIFTY PCR: <strong style={{ color: '#38bdf8' }}>1.14 (Bullish)</strong></span>
        </div>
      </div>

      {/* 2. Executive Top Navigation Bar */}
      <header style={{
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
        backdropFilter: 'blur(14px)',
        position: 'sticky',
        top: '37px',
        zIndex: 50,
        background: 'rgba(6, 9, 17, 0.88)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '11px', cursor: 'pointer' }} onClick={() => scrollToSection('hubs-command-center')}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '11px',
            background: 'linear-gradient(135deg, #0284c7, #4f46e5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(56, 189, 248, 0.45)',
            border: '1px solid rgba(125, 211, 252, 0.4)'
          }}>
            <TrendingUp size={20} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: '900', fontSize: '18px', letterSpacing: '0.6px', background: 'linear-gradient(to right, #38bdf8, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                SKANDX
              </span>
              <span style={{ fontSize: '9.5px', background: 'rgba(56, 189, 248, 0.16)', border: '1px solid rgba(56, 189, 248, 0.35)', color: '#38bdf8', padding: '1px 6px', borderRadius: '4px', fontWeight: '800' }}>
                PRO OS
              </span>
            </div>
            <span style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: '500' }}>Institutional Paper Trade, Options & Wealth OS</span>
          </div>
        </div>

        {/* Desktop Quick Jump Links */}
        <div className="hide-on-mobile" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            onClick={() => scrollToSection('interactive-edge-lab')}
            style={{ padding: '6px 12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', fontSize: '12px', fontWeight: '700', cursor: 'pointer', borderRadius: '7px', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <Sliders size={13} />
            <span>Trader Edge Lab</span>
          </button>
          <button
            onClick={() => scrollToSection('hubs-command-center')}
            style={{ padding: '6px 12px', background: 'rgba(56, 189, 248, 0.09)', border: '1px solid rgba(56, 189, 248, 0.25)', color: '#38bdf8', fontSize: '12px', fontWeight: '700', cursor: 'pointer', borderRadius: '7px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <span>6 Platform Hubs</span>
            <ChevronDown size={13} />
          </button>
          <button
            onClick={() => (onOpenCommunity ? onOpenCommunity() : onOpenPaperTrading())}
            onMouseEnter={() => prefetchHubChunk(7)}
            style={{ padding: '6px 12px', background: 'rgba(37, 99, 235, 0.14)', border: '1px solid rgba(59, 130, 246, 0.35)', color: '#60a5fa', fontSize: '12px', fontWeight: '700', cursor: 'pointer', borderRadius: '7px' }}
          >
            💬 Community & Clubs
          </button>
          <button
            onClick={() => onOpenTradeDiary('CHECKLIST')}
            onMouseEnter={() => prefetchHubChunk(2)}
            style={{ padding: '6px 11px', background: 'transparent', border: 'none', color: '#cbd5e1', fontSize: '12px', fontWeight: '600', cursor: 'pointer', borderRadius: '6px' }}
          >
            Trade Diary
          </button>
          <button
            onClick={() => onOpenPrimaryMarkets('BHAVCOPY')}
            onMouseEnter={() => prefetchHubChunk(3)}
            style={{ padding: '6px 11px', background: 'transparent', border: 'none', color: '#cbd5e1', fontSize: '12px', fontWeight: '600', cursor: 'pointer', borderRadius: '6px' }}
          >
            Bhavcopy & IPO
          </button>
          <button
            onClick={() => onOpenCalculators('all')}
            onMouseEnter={() => prefetchHubChunk(4)}
            style={{ padding: '6px 11px', background: 'transparent', border: 'none', color: '#fbbf24', fontSize: '12px', fontWeight: '600', cursor: 'pointer', borderRadius: '6px' }}
          >
            10 Calculators
          </button>
          <button
            onClick={() => onOpenWealthFinance('NET_WORTH')}
            onMouseEnter={() => prefetchHubChunk(5)}
            style={{ padding: '6px 11px', background: 'transparent', border: 'none', color: '#34d399', fontSize: '12px', fontWeight: '600', cursor: 'pointer', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <PieChart size={13} /> Wealth & Tax
          </button>
          <button
            onClick={() => onOpenAlgoBridge('SHARE_LINK')}
            onMouseEnter={() => prefetchHubChunk(6)}
            style={{ padding: '6px 11px', background: 'transparent', border: 'none', color: '#cbd5e1', fontSize: '12px', fontWeight: '600', cursor: 'pointer', borderRadius: '6px' }}
          >
            SkandX Algo
          </button>
        </div>

        {/* Direct Action Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={onOpenPaperTrading}
            style={{
              padding: '9px 18px',
              background: 'linear-gradient(135deg, #0284c7, #2563eb)',
              border: '1px solid rgba(125, 211, 252, 0.45)',
              borderRadius: '9px',
              color: '#fff',
              fontWeight: '800',
              fontSize: '12.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 4px 18px rgba(2, 132, 199, 0.4)'
            }}
          >
            <Zap size={14} /> Launch Paper Trading
          </button>
        </div>
      </header>

      {/* 3. Split-Screen Hero + Interactive 4-Tab Live Financial Sandbox */}
      <section style={{
        padding: '28px 22px 24px',
        maxWidth: '1320px',
        margin: '0 auto',
        width: '100%'
      }}>
        <div className="skx-hero-grid">
          {/* LEFT COLUMN: Executive Value Proposition, Live Desk Telemetry & 1-Click Tool Dock */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '18px'
          }}>
            <div>
              {/* Status Pill */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '5px 13px',
                background: 'linear-gradient(90deg, rgba(2, 132, 199, 0.16), rgba(99, 102, 241, 0.16))',
                border: '1px solid rgba(56, 189, 248, 0.32)',
                borderRadius: '20px',
                color: '#7dd3fc',
                fontSize: '11.5px',
                fontWeight: '700',
                marginBottom: '14px'
              }}>
                <Sparkles size={13} color="#38bdf8" />
                <span>India&apos;s #1 Real-Time Paper Trade, Option Greeks &amp; Wealth OS</span>
              </div>

              {/* Commanding Headline */}
              <h1 style={{
                fontSize: 'clamp(28px, 3.4vw, 44px)',
                fontWeight: '900',
                lineHeight: '1.13',
                margin: '0 0 14px',
                letterSpacing: '-0.7px',
                color: '#ffffff'
              }}>
                Trade Live NSE/BSE Markets with{' '}
                <span style={{
                  background: 'linear-gradient(90deg, #38bdf8 0%, #818cf8 55%, #34d399 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>
                  ₹10,00,000 Virtual Capital
                </span>{' '}
                &amp; 6 Pro Suites.
              </h1>

              {/* Subtitle */}
              <p style={{
                fontSize: '14px',
                color: '#94a3b8',
                lineHeight: '1.6',
                margin: '0 0 20px'
              }}>
                Test options strategies, bracket orders, and algorithmic webhooks on real-time market ticks right inside our interactive sandbox — or audit your loans, SIPs, net worth, and FY25 taxes in one unified terminal.
              </p>

              {/* Primary CTA Row */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '20px'
              }}>
                <button
                  onClick={onOpenPaperTrading}
                  style={{
                    padding: '13px 22px',
                    background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                    border: '1px solid rgba(125, 211, 252, 0.4)',
                    borderRadius: '11px',
                    color: '#fff',
                    fontWeight: '800',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 10px 26px rgba(2, 132, 199, 0.42)'
                  }}
                >
                  <TrendingUp size={17} />
                  <span>Open Live Trading Terminal</span>
                  <ArrowRight size={15} />
                </button>

                <button
                  onClick={() => (onOpenOptionChain ? onOpenOptionChain() : onOpenPaperTrading())}
                  style={{
                    padding: '13px 18px',
                    background: 'rgba(99, 102, 241, 0.14)',
                    border: '1px solid rgba(129, 140, 248, 0.4)',
                    borderRadius: '11px',
                    color: '#c7d2fe',
                    fontWeight: '700',
                    fontSize: '13.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    cursor: 'pointer'
                  }}
                >
                  <Layers size={16} color="#818cf8" />
                  <span>Live Option Chain</span>
                </button>

                <button
                  onClick={() => onOpenCalculators('all')}
                  onMouseEnter={() => prefetchHubChunk(4)}
                  style={{
                    padding: '13px 18px',
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.38)',
                    borderRadius: '11px',
                    color: '#fde68a',
                    fontWeight: '700',
                    fontSize: '13.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    cursor: 'pointer'
                  }}
                >
                  <Calculator size={16} color="#fbbf24" />
                  <span>10 Calculators Suite</span>
                </button>
              </div>
            </div>

            {/* Live Account & Session Telemetry Card */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(2, 132, 199, 0.15))',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '15px',
              padding: '16px 18px',
              boxShadow: '0 10px 28px rgba(0, 0, 0, 0.35)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '11px',
                    background: 'rgba(16, 185, 129, 0.16)',
                    border: '1px solid rgba(16, 185, 129, 0.38)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#10b981'
                  }}>
                    <Activity size={22} />
                  </div>
                  <div>
                    <div style={{ fontSize: '10.5px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: '800' }}>
                      {user?.username ? `LIVE TRADING DESK • ${user.username.toUpperCase()}` : 'LIVE SIMULATED TRADING DESK'}
                    </div>
                    <div style={{ fontSize: '19px', fontWeight: '900', color: '#ffffff', fontVariantNumeric: 'tabular-nums' }}>
                      ₹{Math.round(liveTelemetry.balance).toLocaleString('en-IN')}{' '}
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#38bdf8' }}>Available Virtual Capital</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={onOpenPaperTrading}
                  style={{
                    padding: '7px 13px',
                    background: 'rgba(56, 189, 248, 0.14)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    borderRadius: '8px',
                    color: '#38bdf8',
                    fontSize: '11.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <span>Full Desk</span>
                  <ArrowUpRight size={13} />
                </button>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
                paddingTop: '10px',
                borderTop: '1px solid rgba(255, 255, 255, 0.07)',
                fontSize: '12px'
              }}>
                <div style={{ background: 'rgba(0,0,0,0.28)', padding: '8px 10px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Open Positions</div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#f8fafc', marginTop: '2px' }}>{liveTelemetry.openCount} Active</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.28)', padding: '8px 10px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Executed Orders</div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#f8fafc', marginTop: '2px' }}>{liveTelemetry.executedCount} Fills</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.28)', padding: '8px 10px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Realized P&amp;L</div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: liveTelemetry.realizedPnl >= 0 ? '#34d399' : '#f87171', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                    {liveTelemetry.realizedPnl >= 0 ? '+' : ''}₹{liveTelemetry.realizedPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>

            {/* 1-Click Direct Tool Spotlight Dock */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.72)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '14px',
              padding: '12px 14px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '9px'
              }}>
                <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  ⚡ Instant 1-Click Tool Launcher:
                </span>
                <span style={{ fontSize: '10.5px', color: '#38bdf8', fontWeight: '600' }}>0ms Direct Access</span>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                gap: '7px'
              }}>
                {SPOTLIGHT_TOOLS.map((tool, idx) => (
                  <button
                    key={idx}
                    onClick={tool.action}
                    className="skx-pill-btn"
                    style={{
                      padding: '7px 10px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.035)',
                      border: `1px solid ${tool.color}33`,
                      color: '#e2e8f0',
                      fontSize: '11.5px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '5px',
                      textAlign: 'left'
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tool.label}</span>
                    <ArrowUpRight size={12} color={tool.color} style={{ flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Interactive 4-Tab Live Market & Wealth Sandbox (Playable Right on Landing Page!) */}
          <div style={{
            background: 'linear-gradient(165deg, rgba(15, 23, 42, 0.96), rgba(9, 13, 24, 0.98))',
            border: '1px solid rgba(56, 189, 248, 0.32)',
            borderRadius: '18px',
            padding: '18px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '14px'
          }}>
            {/* Top Sandbox Window Bar + 4 Interactive Mode Tabs */}
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                paddingBottom: '12px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                    <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                    <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#cbd5e1', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                    INTERACTIVE TERMINAL SANDBOX (TEST LIVE NOW)
                  </span>
                </div>

                <span style={{
                  fontSize: '10.5px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(16, 185, 129, 0.14)',
                  color: '#34d399',
                  fontWeight: '700'
                }}>
                  ● Interactive Preview
                </span>
              </div>

              {/* 4 Interactive Mode Selector Tabs */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '6px',
                marginTop: '12px',
                background: 'rgba(0, 0, 0, 0.35)',
                padding: '5px',
                borderRadius: '11px',
                border: '1px solid rgba(255, 255, 255, 0.06)'
              }}>
                {[
                  { id: 'TRADE', label: '⚡ Quick Trade' },
                  { id: 'OPTIONS', label: '⛓️ Option Chain' },
                  { id: 'CALC', label: '🧮 SIP & Loan' },
                  { id: 'MOVERS', label: '🔥 NSE Delivery' }
                ].map(tab => {
                  const active = cockpitTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setCockpitTab(tab.id)}
                      style={{
                        padding: '8px 6px',
                        borderRadius: '8px',
                        border: active ? '1px solid rgba(56, 189, 248, 0.45)' : '1px solid transparent',
                        background: active ? 'linear-gradient(135deg, rgba(2, 132, 199, 0.35), rgba(37, 99, 235, 0.35))' : 'transparent',
                        color: active ? '#ffffff' : '#94a3b8',
                        fontSize: '11.5px',
                        fontWeight: active ? '800' : '600',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ─── TAB 1: LIVE INTERACTIVE QUICK-TRADE & CHART SIMULATOR ─── */}
            {cockpitTab === 'TRADE' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Instrument Switcher Pills */}
                <div className="skx-no-scrollbar" style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
                  {LIVE_TICKERS.slice(0, 6).map((inst, idx) => {
                    const active = activeTickerIdx === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setActiveTickerIdx(idx);
                          setSimulatedOrder(null);
                        }}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '7px',
                          border: active ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)',
                          background: active ? 'rgba(56, 189, 248, 0.16)' : 'rgba(255,255,255,0.03)',
                          color: active ? '#38bdf8' : '#cbd5e1',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {inst.short}
                      </button>
                    );
                  })}
                </div>

                {/* Live Price Header + Timeframe Switcher + Interactive SVG Chart */}
                <div style={{
                  background: 'rgba(0, 0, 0, 0.38)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '12px',
                  padding: '12px 14px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '15px', fontWeight: '900', color: '#ffffff' }}>{activeInstrument.label}</span>
                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.14)', color: '#38bdf8', fontWeight: '700' }}>
                          Lot: {activeInstrument.lotSize}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '2px' }}>
                        <span style={{ fontSize: '21px', fontWeight: '900', color: '#f8fafc', fontVariantNumeric: 'tabular-nums' }}>
                          ₹{activeInstrument.ltp}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: activeInstrument.isUp ? '#10b981' : '#ef4444' }}>
                          {activeInstrument.change}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.04)', padding: '3px', borderRadius: '7px' }}>
                      {['1m', '5m', '15m', '1D'].map(tf => (
                        <button
                          key={tf}
                          type="button"
                          onClick={() => setChartTimeframe(tf)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '5px',
                            border: 'none',
                            background: chartTimeframe === tf ? '#0284c7' : 'transparent',
                            color: chartTimeframe === tf ? '#fff' : '#94a3b8',
                            fontSize: '10.5px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          {tf}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Interactive SVG Area + Candlestick Hybrid Chart */}
                  <div style={{ width: '100%', height: '142px', position: 'relative' }}>
                    <svg viewBox={`0 0 ${chartData.width} ${chartData.height}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                      <defs>
                        <linearGradient id="skxChartGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.38" />
                          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      {/* Horizontal Grid Lines */}
                      {[0.2, 0.5, 0.8].map((g, i) => (
                        <line
                          key={i}
                          x1="0"
                          y1={chartData.height * g}
                          x2={chartData.width}
                          y2={chartData.height * g}
                          stroke="rgba(255,255,255,0.05)"
                          strokeDasharray="3 3"
                        />
                      ))}
                      {/* Area & Line Path */}
                      <path d={chartData.areaPath} fill="url(#skxChartGrad)" />
                      <path d={chartData.linePath} fill="none" stroke="#38bdf8" strokeWidth="2.4" strokeLinecap="round" />
                      {/* Overlay Mini Candlesticks */}
                      {chartData.candles.map((c, idx) => {
                        const x = (idx / (chartData.candles.length - 1)) * chartData.width;
                        const yOpen = chartData.height - ((c.open - chartData.minVal) / chartData.span) * (chartData.height - 24) - 12;
                        const yClose = chartData.height - ((c.close - chartData.minVal) / chartData.span) * (chartData.height - 24) - 12;
                        const yHigh = chartData.height - ((c.high - chartData.minVal) / chartData.span) * (chartData.height - 24) - 12;
                        const yLow = chartData.height - ((c.low - chartData.minVal) / chartData.span) * (chartData.height - 24) - 12;
                        const color = c.isUp ? '#10b981' : '#ef4444';
                        return (
                          <g key={idx} opacity="0.85">
                            <line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={color} strokeWidth="1.1" />
                            <rect
                              x={x - 3.2}
                              y={Math.min(yOpen, yClose)}
                              width="6.4"
                              height={Math.max(2.5, Math.abs(yClose - yOpen))}
                              fill={color}
                              rx="1"
                            />
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </div>

                {/* Interactive Order Ticket Controls */}
                <div style={{
                  background: 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {/* BUY / SELL Toggle */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setTradeSide('BUY')}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '7px',
                          border: tradeSide === 'BUY' ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.08)',
                          background: tradeSide === 'BUY' ? 'rgba(16, 185, 129, 0.22)' : 'rgba(255,255,255,0.03)',
                          color: tradeSide === 'BUY' ? '#34d399' : '#94a3b8',
                          fontSize: '12px',
                          fontWeight: '800',
                          cursor: 'pointer'
                        }}
                      >
                        🟢 BUY / LONG
                      </button>
                      <button
                        type="button"
                        onClick={() => setTradeSide('SELL')}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '7px',
                          border: tradeSide === 'SELL' ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.08)',
                          background: tradeSide === 'SELL' ? 'rgba(239, 68, 68, 0.22)' : 'rgba(255,255,255,0.03)',
                          color: tradeSide === 'SELL' ? '#f87171' : '#94a3b8',
                          fontSize: '12px',
                          fontWeight: '800',
                          cursor: 'pointer'
                        }}
                      >
                        🔴 SELL / SHORT
                      </button>
                    </div>

                    {/* Product Type Pills */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {[
                        { id: 'MIS', label: 'MIS 5x' },
                        { id: 'NRML', label: 'NRML' },
                        { id: 'BO', label: 'Bracket SL/TP' }
                      ].map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setTradeProduct(p.id)}
                          style={{
                            padding: '5px 9px',
                            borderRadius: '6px',
                            border: tradeProduct === p.id ? '1px solid rgba(56,189,248,0.5)' : '1px solid rgba(255,255,255,0.08)',
                            background: tradeProduct === p.id ? 'rgba(56,189,248,0.16)' : 'transparent',
                            color: tradeProduct === p.id ? '#38bdf8' : '#94a3b8',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Lot Stepper & SL / Target Sliders */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: '700', marginBottom: '4px' }}>
                        Lots ({tradeMetrics.qty} Qty)
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {[1, 2, 5, 10].map(l => (
                          <button
                            key={l}
                            type="button"
                            onClick={() => setTradeLots(l)}
                            style={{
                              flex: 1,
                              padding: '5px 0',
                              borderRadius: '6px',
                              border: tradeLots === l ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)',
                              background: tradeLots === l ? 'rgba(56,189,248,0.2)' : 'rgba(0,0,0,0.3)',
                              color: tradeLots === l ? '#fff' : '#94a3b8',
                              fontSize: '11px',
                              fontWeight: '800',
                              cursor: 'pointer'
                            }}
                          >
                            {l}L
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#94a3b8', fontWeight: '700', marginBottom: '4px' }}>
                        <span>Stop-Loss</span>
                        <span style={{ color: '#f87171' }}>-{slPoints} pts</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        step="5"
                        value={slPoints}
                        onChange={e => setSlPoints(Number(e.target.value))}
                        style={{ width: '100%', accentColor: '#ef4444', cursor: 'pointer' }}
                      />
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#94a3b8', fontWeight: '700', marginBottom: '4px' }}>
                        <span>Target Profit</span>
                        <span style={{ color: '#34d399' }}>+{tpPoints} pts</span>
                      </div>
                      <input
                        type="range"
                        min="20"
                        max="250"
                        step="10"
                        value={tpPoints}
                        onChange={e => setTpPoints(Number(e.target.value))}
                        style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
                      />
                    </div>
                  </div>

                  {/* Live Margin, Target Profit & Risk-Reward Summary Bar */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '8px',
                    background: 'rgba(0, 0, 0, 0.35)',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    fontSize: '11px'
                  }}>
                    <div>
                      <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: '700' }}>REQ. MARGIN</div>
                      <div style={{ fontWeight: '800', color: '#e2e8f0' }}>₹{tradeMetrics.marginRequired.toLocaleString('en-IN')}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: '700' }}>TARGET PROFIT</div>
                      <div style={{ fontWeight: '800', color: '#34d399' }}>+₹{tradeMetrics.maxProfit.toLocaleString('en-IN')}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: '700' }}>MAX SL RISK</div>
                      <div style={{ fontWeight: '800', color: '#f87171' }}>-₹{tradeMetrics.maxRisk.toLocaleString('en-IN')}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: '700' }}>RISK : REWARD</div>
                      <div style={{ fontWeight: '800', color: '#38bdf8' }}>1 : {tradeMetrics.rrRatio}</div>
                    </div>
                  </div>

                  {/* Simulated Fill Feedback Banner (If user clicked Test Fill) */}
                  {simulatedOrder && (
                    <div style={{
                      background: 'rgba(16, 185, 129, 0.14)',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      borderRadius: '9px',
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      fontSize: '11.5px'
                    }}>
                      <div>
                        <strong style={{ color: '#34d399' }}>✔ SIMULATED {simulatedOrder.side} FILL:</strong>{' '}
                        {simulatedOrder.symbol} ({simulatedOrder.qty} Qty @ ₹{simulatedOrder.entryPrice.toLocaleString('en-IN')})
                      </div>
                      <span style={{ fontWeight: '800', color: '#34d399', whiteSpace: 'nowrap' }}>
                        Live Est. P&amp;L: +₹{simulatedOrder.simulatedPnl.toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleSimulateOrderOnPage}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(56, 189, 248, 0.45)',
                        background: 'rgba(56, 189, 248, 0.12)',
                        color: '#38bdf8',
                        fontWeight: '800',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Play size={13} />
                      <span>Simulate Instant Fill Here</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleLaunchSymbolInTerminal(activeInstrument.targetSymbol)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: 'none',
                        background: tradeSide === 'BUY'
                          ? 'linear-gradient(135deg, #10b981, #059669)'
                          : 'linear-gradient(135deg, #ef4444, #dc2626)',
                        color: '#ffffff',
                        fontWeight: '800',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 14px rgba(0,0,0,0.35)'
                      }}
                    >
                      <span>Execute {tradeSide} in Live Terminal</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ─── TAB 2: LIVE INTERACTIVE OPTION CHAIN & GREEKS SANDBOX ─── */}
            {cockpitTab === 'OPTIONS' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(0,0,0,0.35)',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  fontSize: '11.5px',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}>
                  <div>
                    <span style={{ color: '#94a3b8' }}>NIFTY 50 SPOT: </span>
                    <strong style={{ color: '#f8fafc' }}>₹{niftySpot.toLocaleString('en-IN')}</strong>
                    <span style={{ marginLeft: '10px', color: '#94a3b8' }}>ATM: </span>
                    <strong style={{ color: '#38bdf8' }}>{atmStrike}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span>PCR: <strong style={{ color: '#34d399' }}>1.14</strong></span>
                    <span>Max Pain: <strong style={{ color: '#fbbf24' }}>{atmStrike}</strong></span>
                  </div>
                </div>

                {/* Interactive 7-Strike Option Chain Table */}
                <div style={{
                  background: 'rgba(0,0,0,0.35)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  fontSize: '11px'
                }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 0.8fr 1fr 1.1fr 1fr 0.8fr 1fr',
                    padding: '7px 10px',
                    background: 'rgba(255,255,255,0.04)',
                    color: '#94a3b8',
                    fontWeight: '800',
                    textAlign: 'center',
                    fontSize: '10px'
                  }}>
                    <span>CALL OI</span>
                    <span>CALL Δ</span>
                    <span style={{ color: '#34d399' }}>CALL LTP</span>
                    <span style={{ color: '#38bdf8' }}>STRIKE</span>
                    <span style={{ color: '#f87171' }}>PUT LTP</span>
                    <span>PUT Δ</span>
                    <span>PUT OI</span>
                  </div>

                  {optionChainRows.map((row) => {
                    const isSelected = row.offset === selectedStrikeOffset;
                    return (
                      <div
                        key={row.strike}
                        onClick={() => setSelectedStrikeOffset(row.offset)}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 0.8fr 1fr 1.1fr 1fr 0.8fr 1fr',
                          padding: '7.5px 10px',
                          alignItems: 'center',
                          textAlign: 'center',
                          cursor: 'pointer',
                          background: isSelected
                            ? 'rgba(56, 189, 248, 0.16)'
                            : row.isAtm
                            ? 'rgba(245, 158, 11, 0.08)'
                            : 'transparent',
                          borderTop: '1px solid rgba(255,255,255,0.04)',
                          fontVariantNumeric: 'tabular-nums'
                        }}
                      >
                        <span style={{ color: '#cbd5e1' }}>{row.callOiLakhs}L</span>
                        <span style={{ color: '#94a3b8' }}>{row.callDelta}</span>
                        <span
                          onClick={(e) => { e.stopPropagation(); setSelectedStrikeOffset(row.offset); setSelectedOptionType('CE'); }}
                          style={{ color: '#34d399', fontWeight: '800' }}
                        >
                          ₹{row.callLtp}
                        </span>
                        <span style={{
                          fontWeight: '900',
                          color: row.isAtm ? '#fbbf24' : '#f8fafc',
                          background: row.isAtm ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.04)',
                          borderRadius: '5px',
                          padding: '2px 4px'
                        }}>
                          {row.strike} {row.isAtm ? 'ATM' : ''}
                        </span>
                        <span
                          onClick={(e) => { e.stopPropagation(); setSelectedStrikeOffset(row.offset); setSelectedOptionType('PE'); }}
                          style={{ color: '#f87171', fontWeight: '800' }}
                        >
                          ₹{row.putLtp}
                        </span>
                        <span style={{ color: '#94a3b8' }}>{row.putDelta}</span>
                        <span style={{ color: '#cbd5e1' }}>{row.putOiLakhs}L</span>
                      </div>
                    );
                  })}
                </div>

                {/* Selected Strike Live Greeks Inspector */}
                <div style={{
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid rgba(129, 140, 248, 0.35)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ fontSize: '11.5px' }}>
                    <div style={{ fontWeight: '800', color: '#e2e8f0' }}>
                      Selected: NIFTY {selectedChainRow.strike} {selectedOptionType} @ ₹{selectedOptionType === 'CE' ? selectedChainRow.callLtp : selectedChainRow.putLtp}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '2px' }}>
                      IV: <strong style={{ color: '#38bdf8' }}>{selectedChainRow.iv}%</strong> • Theta: <strong style={{ color: '#f87171' }}>{selectedChainRow.theta}/day</strong> • Delta: <strong style={{ color: '#34d399' }}>{selectedOptionType === 'CE' ? selectedChainRow.callDelta : selectedChainRow.putDelta}</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => (onOpenOptionChain ? onOpenOptionChain() : onOpenPaperTrading())}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                      color: '#fff',
                      fontSize: '11.5px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <span>Trade in Full Option Chain</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            )}

            {/* ─── TAB 3: LIVE INTERACTIVE SIP & LOAN EMI CALCULATOR SANDBOX ─── */}
            {cockpitTab === 'CALC' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setCalcMode('SIP')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      border: calcMode === 'SIP' ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)',
                      background: calcMode === 'SIP' ? 'rgba(56, 189, 248, 0.16)' : 'rgba(255,255,255,0.03)',
                      color: calcMode === 'SIP' ? '#38bdf8' : '#94a3b8',
                      fontSize: '12px',
                      fontWeight: '800',
                      cursor: 'pointer'
                    }}
                  >
                    📈 SIP &amp; Step-Up Wealth Compounder
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalcMode('EMI')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      border: calcMode === 'EMI' ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.08)',
                      background: calcMode === 'EMI' ? 'rgba(16, 185, 129, 0.16)' : 'rgba(255,255,255,0.03)',
                      color: calcMode === 'EMI' ? '#34d399' : '#94a3b8',
                      fontSize: '12px',
                      fontWeight: '800',
                      cursor: 'pointer'
                    }}
                  >
                    🏠 Reducing Balance Loan EMI
                  </button>
                </div>

                {calcMode === 'SIP' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(0,0,0,0.32)', padding: '12px 14px', borderRadius: '11px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: '700', marginBottom: '4px' }}>
                        <span style={{ color: '#cbd5e1' }}>Monthly SIP Investment</span>
                        <span style={{ color: '#38bdf8' }}>₹{sipMonthly.toLocaleString('en-IN')}/mo</span>
                      </div>
                      <input type="range" min="2000" max="200000" step="1000" value={sipMonthly} onChange={e => setSipMonthly(Number(e.target.value))} style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '700', marginBottom: '4px' }}>
                          <span style={{ color: '#94a3b8' }}>Return %</span>
                          <span style={{ color: '#34d399' }}>{sipRate}%</span>
                        </div>
                        <input type="range" min="8" max="25" step="0.5" value={sipRate} onChange={e => setSipRate(Number(e.target.value))} style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '700', marginBottom: '4px' }}>
                          <span style={{ color: '#94a3b8' }}>Duration</span>
                          <span style={{ color: '#f8fafc' }}>{sipYears} Yrs</span>
                        </div>
                        <input type="range" min="3" max="30" step="1" value={sipYears} onChange={e => setSipYears(Number(e.target.value))} style={{ width: '100%', accentColor: '#818cf8', cursor: 'pointer' }} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '700', marginBottom: '4px' }}>
                          <span style={{ color: '#94a3b8' }}>Step-Up</span>
                          <span style={{ color: '#fbbf24' }}>{sipStepUp}%/yr</span>
                        </div>
                        <input type="range" min="0" max="25" step="5" value={sipStepUp} onChange={e => setSipStepUp(Number(e.target.value))} style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer' }} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(0,0,0,0.32)', padding: '12px 14px', borderRadius: '11px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: '700', marginBottom: '4px' }}>
                        <span style={{ color: '#cbd5e1' }}>Loan Principal Amount</span>
                        <span style={{ color: '#34d399' }}>₹{loanAmount.toLocaleString('en-IN')}</span>
                      </div>
                      <input type="range" min="200000" max="20000000" step="100000" value={loanAmount} onChange={e => setLoanAmount(Number(e.target.value))} style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '700', marginBottom: '4px' }}>
                          <span style={{ color: '#94a3b8' }}>Interest Rate (p.a.)</span>
                          <span style={{ color: '#fbbf24' }}>{loanRate}%</span>
                        </div>
                        <input type="range" min="6.5" max="18" step="0.25" value={loanRate} onChange={e => setLoanRate(Number(e.target.value))} style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer' }} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '700', marginBottom: '4px' }}>
                          <span style={{ color: '#94a3b8' }}>Loan Tenure</span>
                          <span style={{ color: '#f8fafc' }}>{loanYears} Years</span>
                        </div>
                        <input type="range" min="1" max="30" step="1" value={loanYears} onChange={e => setLoanYears(Number(e.target.value))} style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Result Output Box */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.18), rgba(16, 185, 129, 0.14))',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  borderRadius: '12px',
                  padding: '12px 14px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>{calcSandboxResult.primaryLabel}</div>
                      <div style={{ fontSize: '23px', fontWeight: '900', color: '#ffffff', fontVariantNumeric: 'tabular-nums' }}>{calcSandboxResult.primaryValue}</div>
                    </div>
                    <span style={{ padding: '4px 10px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontWeight: '800', fontSize: '12px' }}>
                      {calcSandboxResult.multiplier}
                    </span>
                  </div>

                  {/* Visual Composition Bar */}
                  <div style={{ height: '7px', borderRadius: '4px', background: 'rgba(255,255,255,0.12)', overflow: 'hidden', margin: '10px 0', display: 'flex' }}>
                    <div style={{ width: `${100 - calcSandboxResult.barPct}%`, background: '#38bdf8' }} />
                    <div style={{ width: `${calcSandboxResult.barPct}%`, background: '#10b981' }} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#cbd5e1', marginBottom: '10px' }}>
                    <span>{calcSandboxResult.subLeftLabel}: <strong>{calcSandboxResult.subLeftValue}</strong></span>
                    <span>{calcSandboxResult.subRightLabel}: <strong style={{ color: '#34d399' }}>{calcSandboxResult.subRightValue}</strong></span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenCalculators(calcMode === 'SIP' ? 'sip' : 'reducing-loan')}
                    style={{
                      width: '100%',
                      padding: '9px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      color: '#fff',
                      fontWeight: '800',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>Open Full Schedule + Download PDF / Excel</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* ─── TAB 4: LIVE NSE HIGH-DELIVERY (>60%) & IPO GMP PULSE ─── */}
            {cockpitTab === 'MOVERS' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{
                  background: 'rgba(0,0,0,0.35)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '10px',
                  padding: '10px 12px'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#34d399', textTransform: 'uppercase', marginBottom: '8px' }}>
                    🏛️ Institutional High-Delivery Accumulation (&gt;60% NSE Bhavcopy)
                  </div>
                  {[
                    { sym: 'RELIANCE', ltp: LIVE_TICKERS[4]?.ltp || '1,294.50', deliv: '68.4%', vol: '2.1x Surge', target: 'NSE:RELIANCE-EQ' },
                    { sym: 'TCS', ltp: LIVE_TICKERS[5]?.ltp || '4,142.00', deliv: '71.2%', vol: '1.8x Surge', target: 'NSE:TCS-EQ' },
                    { sym: 'HDFCBANK', ltp: '1,684.20', deliv: '66.9%', vol: '2.4x Surge', target: 'NSE:HDFCBANK-EQ' },
                    { sym: 'INFY', ltp: '1,918.40', deliv: '64.5%', vol: '1.7x Surge', target: 'NSE:INFY-EQ' }
                  ].map((item, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '7px 0',
                        borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                        fontSize: '11.5px'
                      }}
                    >
                      <div>
                        <strong style={{ color: '#f8fafc' }}>{item.sym}</strong>
                        <span style={{ color: '#94a3b8', marginLeft: '8px' }}>₹{item.ltp}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ padding: '2px 7px', borderRadius: '5px', background: 'rgba(16,185,129,0.15)', color: '#34d399', fontWeight: '700', fontSize: '10.5px' }}>
                          {item.deliv} Deliv
                        </span>
                        <span style={{ color: '#38bdf8', fontSize: '10.5px', fontWeight: '700' }}>{item.vol}</span>
                        <button
                          type="button"
                          onClick={() => handleLaunchSymbolInTerminal(item.target)}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '5px',
                            border: '1px solid rgba(56,189,248,0.4)',
                            background: 'rgba(56,189,248,0.12)',
                            color: '#38bdf8',
                            fontSize: '10.5px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          Trade ↗
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => onOpenPrimaryMarkets('BHAVCOPY')}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid rgba(16,185,129,0.4)',
                      background: 'rgba(16,185,129,0.14)',
                      color: '#34d399',
                      fontWeight: '800',
                      fontSize: '11.5px',
                      cursor: 'pointer'
                    }}
                  >
                    Open Full Bhavcopy Screener →
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenPrimaryMarkets('IPO')}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid rgba(56,189,248,0.4)',
                      background: 'rgba(56,189,248,0.14)',
                      color: '#38bdf8',
                      fontWeight: '800',
                      fontSize: '11.5px',
                      cursor: 'pointer'
                    }}
                  >
                    Live IPO GMP &amp; PAN Allotment →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. Interactive "Trader Edge & Risk Lab" — 3 Hands-On Widgets Right on the Landing Page */}
      <section
        id="interactive-edge-lab"
        style={{
          maxWidth: '1320px',
          margin: '0 auto',
          width: '100%',
          padding: '8px 22px 28px'
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              padding: '3px 9px',
              borderRadius: '6px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              color: '#34d399',
              fontSize: '10.5px',
              fontWeight: '800',
              textTransform: 'uppercase'
            }}>
              Interactive Trader Edge Lab
            </span>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#f8fafc' }}>
              Size Your Position, Audit Oct-2024 STT Charges &amp; Check Readiness Before You Trade
            </h2>
          </div>
          <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>Adjust sliders &amp; checkboxes live below</span>
        </div>

        <div className="skx-lab-grid">
          {/* WIDGET 1: Instant Position Size & Stop-Loss Risk Calculator */}
          <div style={{
            background: 'linear-gradient(155deg, rgba(15, 23, 42, 0.92), rgba(9, 13, 22, 0.96))',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '16px',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Target size={18} color="#38bdf8" />
                  <span style={{ fontWeight: '800', fontSize: '14px', color: '#f8fafc' }}>1. Instant Position Sizer</span>
                </div>
                <span style={{ fontSize: '10.5px', color: '#38bdf8', fontWeight: '700' }}>Risk Guard</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11.5px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{ color: '#94a3b8' }}>Trading Capital</span>
                    <strong style={{ color: '#f8fafc' }}>₹{(riskCapital / 100000).toFixed(1)} Lakh</strong>
                  </div>
                  <input type="range" min="100000" max="5000000" step="100000" value={riskCapital} onChange={e => setRiskCapital(Number(e.target.value))} style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ color: '#94a3b8' }}>Risk / Trade</span>
                      <strong style={{ color: '#fbbf24' }}>{riskPercent.toFixed(1)}%</strong>
                    </div>
                    <input type="range" min="0.5" max="3.0" step="0.5" value={riskPercent} onChange={e => setRiskPercent(Number(e.target.value))} style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer' }} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ color: '#94a3b8' }}>Stop-Loss</span>
                      <strong style={{ color: '#f87171' }}>{riskSlPts} pts</strong>
                    </div>
                    <input type="range" min="10" max="100" step="5" value={riskSlPts} onChange={e => setRiskSlPts(Number(e.target.value))} style={{ width: '100%', accentColor: '#ef4444', cursor: 'pointer' }} />
                  </div>
                </div>
              </div>
            </div>

            <div style={{
              background: 'rgba(0,0,0,0.35)',
              borderRadius: '10px',
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700' }}>MAX SAFE QUANTITY</div>
                <div style={{ fontSize: '16px', fontWeight: '900', color: '#38bdf8' }}>
                  {positionSizerResult.safeQty} Qty ({positionSizerResult.niftyLots} Nifty Lots)
                </div>
                <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>Max Risk: ₹{positionSizerResult.maxRiskRs.toLocaleString('en-IN')}</div>
              </div>
              <button
                type="button"
                onClick={() => onOpenCalculators('position-sizing')}
                style={{ padding: '7px 11px', borderRadius: '7px', border: '1px solid rgba(56,189,248,0.4)', background: 'rgba(56,189,248,0.12)', color: '#38bdf8', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
              >
                Full Sizer ↗
              </button>
            </div>
          </div>

          {/* WIDGET 2: Live Oct-2024 STT & Breakeven Estimator */}
          <div style={{
            background: 'linear-gradient(155deg, rgba(15, 23, 42, 0.92), rgba(9, 13, 22, 0.96))',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '16px',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calculator size={18} color="#fbbf24" />
                  <span style={{ fontWeight: '800', fontSize: '14px', color: '#f8fafc' }}>2. Live STT &amp; Breakeven Audit</span>
                </div>
                <span style={{ fontSize: '10.5px', color: '#fbbf24', fontWeight: '700' }}>Oct 2024 Mandate</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px', marginBottom: '10px' }}>
                {[
                  { id: 'OPT_BUY', label: 'Opt Buy' },
                  { id: 'OPT_SELL', label: 'Opt Sell' },
                  { id: 'FUT', label: 'Futures' },
                  { id: 'EQ_INTRA', label: 'Intraday' }
                ].map(seg => (
                  <button
                    key={seg.id}
                    type="button"
                    onClick={() => setBrokSegment(seg.id)}
                    style={{
                      padding: '5px 4px',
                      borderRadius: '6px',
                      border: brokSegment === seg.id ? '1px solid #fbbf24' : '1px solid rgba(255,255,255,0.08)',
                      background: brokSegment === seg.id ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.03)',
                      color: brokSegment === seg.id ? '#fde68a' : '#94a3b8',
                      fontSize: '10.5px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    {seg.label}
                  </button>
                ))}
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '3px' }}>
                  <span style={{ color: '#94a3b8' }}>Order Size ({brokerageLabResult.qty} Qty)</span>
                  <strong style={{ color: '#fbbf24' }}>{brokLots} Lots</strong>
                </div>
                <input type="range" min="1" max="20" step="1" value={brokLots} onChange={e => setBrokLots(Number(e.target.value))} style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer' }} />
              </div>
            </div>

            <div style={{
              background: 'rgba(0,0,0,0.35)',
              borderRadius: '10px',
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700' }}>TOTAL TAXES &amp; BREAKEVEN</div>
                <div style={{ fontSize: '16px', fontWeight: '900', color: '#fbbf24' }}>
                  ₹{brokerageLabResult.totalTax} • {brokerageLabResult.breakevenPts} pts to BE
                </div>
                <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>STT: ₹{brokerageLabResult.stt} • GST: ₹{brokerageLabResult.gst}</div>
              </div>
              <button
                type="button"
                onClick={() => onOpenCalculators('brokerage')}
                style={{ padding: '7px 11px', borderRadius: '7px', border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.12)', color: '#fbbf24', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
              >
                Tax Sheet ↗
              </button>
            </div>
          </div>

          {/* WIDGET 3: Pre-Trade 8-Pillar Discipline Readiness Checklist */}
          <div style={{
            background: 'linear-gradient(155deg, rgba(15, 23, 42, 0.92), rgba(9, 13, 22, 0.96))',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '16px',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={18} color="#10b981" />
                  <span style={{ fontWeight: '800', fontSize: '14px', color: '#f8fafc' }}>3. Pre-Trade Discipline Gate</span>
                </div>
                <span style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: disciplineScore === 100 ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)',
                  color: disciplineScore === 100 ? '#34d399' : '#fbbf24',
                  fontWeight: '800'
                }}>
                  {disciplineScore}% Ready
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  'HTF Trend & VWAP structure confirmed',
                  'Stop-Loss & Position Size <= 1.5% capital',
                  'Risk : Reward ratio >= 1 : 2.0 verified',
                  'Zero FOMO / Revenge impulse on entry'
                ].map((rule, idx) => (
                  <label
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '11.5px',
                      color: disciplineChecks[idx] ? '#e2e8f0' : '#94a3b8',
                      cursor: 'pointer',
                      padding: '4px 6px',
                      borderRadius: '6px',
                      background: disciplineChecks[idx] ? 'rgba(16,185,129,0.08)' : 'transparent'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={disciplineChecks[idx]}
                      onChange={() => {
                        const next = [...disciplineChecks];
                        next[idx] = !next[idx];
                        setDisciplineChecks(next);
                      }}
                      style={{ accentColor: '#10b981', cursor: 'pointer' }}
                    />
                    <span>{rule}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{
              background: 'rgba(0,0,0,0.35)',
              borderRadius: '10px',
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ fontSize: '11.5px', fontWeight: '700', color: disciplineScore === 100 ? '#34d399' : '#cbd5e1' }}>
                {disciplineScore === 100 ? '✔ All 4 Core Rules Cleared!' : 'Check rules to unlock 100% score'}
              </div>
              <button
                type="button"
                onClick={() => onOpenTradeDiary('CHECKLIST')}
                style={{ padding: '7px 11px', borderRadius: '7px', border: '1px solid rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.12)', color: '#34d399', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
              >
                Open Journal ↗
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 5. The 6-Hub Institutional Command Center */}
      <section
        id="hubs-command-center"
        style={{
          maxWidth: '1320px',
          margin: '0 auto',
          width: '100%',
          padding: '10px 22px 48px'
        }}
      >
        {/* Section Header */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: '16px',
          gap: '12px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>
              <Sparkles size={14} />
              <span>Complete Platform Ecosystem</span>
            </div>
            <h2 style={{ fontSize: '26px', fontWeight: '900', color: '#f8fafc', margin: 0 }}>
              6 Specialized Institutional Hubs &amp; Suites
            </h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0' }}>
              Click any Hub card, feature pill, or quick link below to jump straight into that workspace.
            </p>
          </div>

          {/* Quick Search Input */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '10px',
            padding: '9px 14px',
            minWidth: '280px',
            maxWidth: '380px'
          }}>
            <Search size={15} color="#38bdf8" />
            <input
              type="text"
              placeholder="Search tools (e.g. Loan, SIP, Tax, Algo, IPO)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '12.5px',
                width: '100%',
                outline: 'none'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Bar */}
        <div
          className="skx-no-scrollbar"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '14px',
            marginBottom: '18px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
          }}
        >
          {[
            { id: 'ALL', label: `All Hubs (${HUBS.length})` },
            { id: 'TRADING', label: `📈 Trading & Algo (${HUBS.filter(h => h.category === 'TRADING').length})` },
            { id: 'MARKETS', label: `🏛️ Primary Markets & IPO (${HUBS.filter(h => h.category === 'MARKETS').length})` },
            { id: 'CALCULATORS', label: `🧮 Financial & Loan Calculators (${HUBS.filter(h => h.category === 'CALCULATORS').length})` },
            { id: 'WEALTH', label: `💰 Wealth OS & Tax Hub (${HUBS.filter(h => h.category === 'WEALTH').length})` }
          ].map(cat => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  padding: '8px 15px',
                  borderRadius: '20px',
                  border: isActive ? '1px solid rgba(125,211,252,0.5)' : '1px solid rgba(255,255,255,0.07)',
                  background: isActive ? 'linear-gradient(135deg, #0284c7, #2563eb)' : 'rgba(255, 255, 255, 0.04)',
                  color: isActive ? '#fff' : '#94a3b8',
                  fontSize: '12.5px',
                  fontWeight: isActive ? '800' : '600',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* 6-Hub Bento Grid Cards */}
        {filteredHubs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: '#94a3b8' }}>
            No tools found matching &ldquo;{searchQuery}&rdquo;. Try searching for &ldquo;SIP&rdquo;, &ldquo;Loan&rdquo;, &ldquo;IPO&rdquo;, &ldquo;Option&rdquo;, or &ldquo;Tax&rdquo;.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(370px, 1fr))',
            gap: '20px'
          }}>
            {filteredHubs.map(hub => {
              const Icon = hub.icon;
              return (
                <div
                  key={hub.id}
                  className="skx-hub-card"
                  onMouseEnter={() => prefetchHubChunk(hub.id)}
                  style={{
                    background: hub.gradient,
                    border: `1px solid ${hub.border}`,
                    borderRadius: '18px',
                    padding: '22px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '14px',
                    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {/* Faint Hub Number Watermark */}
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    right: '14px',
                    fontSize: '48px',
                    fontWeight: '900',
                    color: 'rgba(255, 255, 255, 0.03)',
                    userSelect: 'none',
                    pointerEvents: 'none'
                  }}>
                    {hub.hubNum}
                  </div>

                  <div>
                    {/* Header: Icon, Number & Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                        <div style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '12px',
                          background: `${hub.color}24`,
                          border: `1px solid ${hub.color}55`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: hub.color,
                          flexShrink: 0
                        }}>
                          <Icon size={22} />
                        </div>
                        <div>
                          <span style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: '800', letterSpacing: '0.8px' }}>
                            HUB {hub.hubNum}
                          </span>
                          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#f8fafc', lineHeight: '1.22' }}>
                            {hub.title}
                          </h3>
                        </div>
                      </div>

                      <span style={{
                        fontSize: '10.5px',
                        fontWeight: '800',
                        color: hub.badgeColor,
                        background: `${hub.color}1f`,
                        border: `1px solid ${hub.color}40`,
                        padding: '3px 9px',
                        borderRadius: '6px',
                        whiteSpace: 'nowrap'
                      }}>
                        {hub.badge}
                      </span>
                    </div>

                    {/* Description */}
                    <p style={{ margin: '0 0 12px', fontSize: '12.5px', color: '#cbd5e1', lineHeight: '1.5' }}>
                      {hub.shortDesc}
                    </p>

                    {/* Live Mini Telemetry Strip inside Hub Card */}
                    {hub.kpiLeft && hub.kpiRight && (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '8px',
                        marginBottom: '12px',
                        padding: '9px 11px',
                        borderRadius: '10px',
                        background: 'rgba(0, 0, 0, 0.34)',
                        border: '1px solid rgba(255, 255, 255, 0.06)'
                      }}>
                        <div>
                          <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: '800' }}>{hub.kpiLeft.label}</div>
                          <div style={{ fontSize: '13px', fontWeight: '800', color: '#f8fafc', marginTop: '2px' }}>{hub.kpiLeft.value}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: '800' }}>{hub.kpiRight.label}</div>
                          <div style={{ fontSize: '13px', fontWeight: '800', color: hub.badgeColor, marginTop: '2px' }}>{hub.kpiRight.value}</div>
                        </div>
                      </div>
                    )}

                    {/* Interactive Deep-Linked Tag Pills */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '6px',
                      marginBottom: '8px'
                    }}>
                      {hub.tags.slice(0, 6).map((tag, tIdx) => (
                        <button
                          key={tIdx}
                          type="button"
                          className="skx-pill-btn"
                          onClick={() => {
                            const fn = hub.tagActions?.[tag] || hub.primaryAction;
                            if (fn) fn();
                          }}
                          title={`Open ${tag}`}
                          style={{
                            fontSize: '11px',
                            background: 'rgba(255, 255, 255, 0.045)',
                            border: '1px solid rgba(255, 255, 255, 0.11)',
                            color: '#e2e8f0',
                            padding: '6px 9px',
                            borderRadius: '7px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            textAlign: 'left'
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tag}</span>
                          <span style={{ color: hub.badgeColor, marginLeft: '4px' }}>↗</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* High-Impact Launch Button */}
                  <button
                    type="button"
                    onClick={hub.primaryAction}
                    style={{
                      width: '100%',
                      padding: '11px 16px',
                      background: `linear-gradient(135deg, ${hub.color}, ${hub.color}cc)`,
                      border: 'none',
                      borderRadius: '10px',
                      color: '#fff',
                      fontSize: '13px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: `0 6px 16px ${hub.color}38`
                    }}
                  >
                    <span>{hub.actionLabel}</span>
                    <ArrowRight size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 6. High-Concurrency & Enterprise Performance Guarantee Banner */}
      <section style={{
        background: 'rgba(15, 23, 42, 0.72)',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '28px 22px',
        width: '100%'
      }}>
        <div style={{
          maxWidth: '1320px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8', flexShrink: 0 }}>
              <Zap size={18} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#f8fafc' }}>
                1 Lakh+ User Multi-Core Cluster
              </h4>
              <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: '#94a3b8', lineHeight: '1.45' }}>
                Singleflight request coalescing, zero-zlib WebSocket fan-out, and pooled PostgreSQL engineered for 1,00,000+ active traders.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', flexShrink: 0 }}>
              <ShieldCheck size={18} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#f8fafc' }}>
                Sub-Millisecond RAM Edge Cache
              </h4>
              <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: '#94a3b8', lineHeight: '1.45' }}>
                Live option chains, Bhavcopy screeners, and batch quotes served straight from RAM with zero database bottlenecks.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(129, 140, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8', flexShrink: 0 }}>
              <Cpu size={18} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#f8fafc' }}>
                0ms Hover Chunk Prefetching
              </h4>
              <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: '#94a3b8', lineHeight: '1.45' }}>
                Intelligent bundle preloading and jittered WebSocket reconnection ensure instant page transitions without loading spinners.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Crawlable SEO Deep-Link Footer for Google Search Indexing */}
      <footer style={{
        marginTop: 'auto',
        background: 'rgba(0, 0, 0, 0.65)',
        padding: '28px 24px',
        fontSize: '12px',
        color: '#94a3b8'
      }}>
        <div style={{
          maxWidth: '1320px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            paddingBottom: '16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            fontSize: '11.5px'
          }}>
            <span style={{ color: '#64748b', fontWeight: '700' }}>Direct Tools &amp; Calculators:</span>
            <a href="/paper-trading" onClick={(e) => { e.preventDefault(); onOpenPaperTrading(); }} style={{ color: '#38bdf8', textDecoration: 'none' }}>SkandX Paper Trade</a>
            <span>•</span>
            <a href="/calculators/sip" onClick={(e) => { e.preventDefault(); onOpenCalculators('sip'); }} style={{ color: '#cbd5e1', textDecoration: 'none' }}>SIP Calculator</a>
            <span>•</span>
            <a href="/calculators/reducing-loan" onClick={(e) => { e.preventDefault(); onOpenCalculators('reducing-loan'); }} style={{ color: '#cbd5e1', textDecoration: 'none' }}>Reducing Balance Loan EMI</a>
            <span>•</span>
            <a href="/calculators/fixed-loan" onClick={(e) => { e.preventDefault(); onOpenCalculators('fixed-loan'); }} style={{ color: '#cbd5e1', textDecoration: 'none' }}>Fixed Interest Loan Calculator</a>
            <span>•</span>
            <a href="/calculators/mtf" onClick={(e) => { e.preventDefault(); onOpenCalculators('mtf'); }} style={{ color: '#cbd5e1', textDecoration: 'none' }}>MTF 4x Calculator</a>
            <span>•</span>
            <a href="/calculators/average-price" onClick={(e) => { e.preventDefault(); onOpenCalculators('average-price'); }} style={{ color: '#cbd5e1', textDecoration: 'none' }}>Stock Average Calculator</a>
            <span>•</span>
            <a href="/calculators/brokerage" onClick={(e) => { e.preventDefault(); onOpenCalculators('brokerage'); }} style={{ color: '#cbd5e1', textDecoration: 'none' }}>NSE/BSE Brokerage &amp; STT</a>
            <span>•</span>
            <a href="/wealth-hub" onClick={(e) => { e.preventDefault(); onOpenWealthFinance('NET_WORTH'); }} style={{ color: '#10b981', textDecoration: 'none' }}>Wealth OS &amp; Tax Hub</a>
            <span>•</span>
            <a href="/algo-trading" onClick={(e) => { e.preventDefault(); onOpenAlgoBridge('SHARE_LINK'); }} style={{ color: '#38bdf8', textDecoration: 'none' }}>SkandX Algo Webhook Bridge</a>
            <span>•</span>
            <a href="/primary-markets" onClick={(e) => { e.preventDefault(); onOpenPrimaryMarkets('BHAVCOPY'); }} style={{ color: '#cbd5e1', textDecoration: 'none' }}>Bhavcopy &amp; IPO GMP</a>
          </div>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div>
              <div style={{ fontWeight: '800', color: '#f8fafc', fontSize: '13px', marginBottom: '2px' }}>
                SKANDX PRO • High-Concurrency Trading &amp; Wealth Operating System
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Paper trading simulator uses virtual currency for educational purposes. Fully compliant with Indian regulatory guidelines.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '14px', fontSize: '12px', flexWrap: 'wrap' }}>
              <span style={{ cursor: 'pointer', color: '#cbd5e1' }} onClick={onOpenPaperTrading}>Paper Trading</span>
              <span style={{ cursor: 'pointer', color: '#cbd5e1' }} onClick={() => onOpenTradeDiary('CHECKLIST')}>Trade Diary</span>
              <span style={{ cursor: 'pointer', color: '#cbd5e1' }} onClick={() => onOpenPrimaryMarkets('BHAVCOPY')}>Bhavcopy &amp; Deals</span>
              <span style={{ cursor: 'pointer', color: '#cbd5e1' }} onClick={() => onOpenCalculators('all')}>Calculators</span>
              <span style={{ cursor: 'pointer', color: '#10b981' }} onClick={() => onOpenWealthFinance('NET_WORTH')}>Wealth OS &amp; Tax</span>
              <span style={{ cursor: 'pointer', color: '#38bdf8' }} onClick={() => onOpenAlgoBridge('SHARE_LINK')}>SkandX Algo</span>
            </div>
          </div>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            marginTop: '8px',
            paddingTop: '12px',
            borderTop: '1px solid rgba(148, 163, 184, 0.08)',
            fontSize: '11.5px'
          }}>
            <div style={{ color: '#64748b' }}>
              &copy; {new Date().getFullYear()} SkandX, Trivandrum, Kerala • Hari • <a href="mailto:skandx.in@gmail.com" style={{ color: '#94a3b8', textDecoration: 'none' }}>skandx.in@gmail.com</a> • <a href="tel:+919497861379" style={{ color: '#38bdf8', textDecoration: 'none' }}>+919497861379</a>
            </div>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
              <a href="/aboutus" style={{ color: '#94a3b8', textDecoration: 'none' }}>About Us</a>
              <a href="/pricing" style={{ color: '#94a3b8', textDecoration: 'none' }}>Pricing</a>
              <a href="/privacy-policy" style={{ color: '#94a3b8', textDecoration: 'none' }}>Privacy Policy</a>
              <a href="/terms" style={{ color: '#94a3b8', textDecoration: 'none' }}>Terms of Service</a>
              <a href="/risk-policy" style={{ color: '#94a3b8', textDecoration: 'none' }}>Risk Disclosure</a>
              <a href="/data-rights" style={{ color: '#94a3b8', textDecoration: 'none' }}>Data Rights (DPDP)</a>
              <a href="/accessibility" style={{ color: '#94a3b8', textDecoration: 'none' }}>Accessibility</a>
              <a href="/delete-account" style={{ color: '#f87171', textDecoration: 'none', fontWeight: '600' }}>Delete Account</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
